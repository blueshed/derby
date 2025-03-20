import { join, dirname } from "path";
import { readdir, readFile } from "fs/promises";
import { createSqliteAdapter } from "../adapters/sqlite.js";
import { createPostgresAdapter } from "../adapters/postgres.js";

// Internal cache for named SQL queries
const queryCache = new Map();

// Store a reference to the SQL path for reloading
let globalSqlPath = null;
let disableCaching = false;

/**
 * Setup database based on configuration
 * @param {Object} config - Database configuration
 * @returns {Object} Database adapter
 */
export async function setupDatabase(config) {
    // Store the SQL path and caching flag globally
    globalSqlPath = config.sqlPath;
    disableCaching = config.disableCache;

    if (disableCaching) {
        console.log("SQL query caching is disabled - queries will be loaded from disk on each execution");
    }

    // Create adapter based on database type
    let adapter;

    switch (config.type.toLowerCase()) {
        case "sqlite":
            adapter = createSqliteAdapter(config.connectionString);
            break;
        case "postgres":
            adapter = createPostgresAdapter(config.connectionString);
            break;
        default:
            throw new Error(`Unsupported database type: ${config.type}`);
    }

    // Initialize adapter
    await adapter.init();

    // Create migrations table if needed
    await createMigrationsTable(adapter);

    // Load SQL queries
    if (config.sqlPath) {
        // Load all SQL files
        const sqlFiles = await loadSqlFiles(config.sqlPath, config.logSql);

        // Execute migrations first
        await executeMigrations(adapter, sqlFiles, config.logSql);
    }

    return adapter;
}

/**
 * Create migrations tracking table
 * @param {Object} db - Database adapter
 */
async function createMigrationsTable(db) {
    try {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS _migrations (
                name TEXT PRIMARY KEY,
                executed_at TEXT NOT NULL
            )
        `;

        await db.executeQuery(createTableSQL);
        console.log("Migrations table ready");
    } catch (error) {
        console.error("Error creating migrations table:", error);
        throw error;
    }
}

/**
 * Load SQL files from directory
 * @param {string} sqlPath - Path to SQL files directory
 * @param {boolean} logSql - Whether to log loaded SQL
 * @returns {Array} SQL files information
 */
async function loadSqlFiles(sqlPath, logSql = false) {
    try {
        // Get all SQL files
        const files = await readdir(sqlPath, { recursive: true });
        const sqlFiles = files.filter(file => file.endsWith(".sql"));

        // Parse files
        const fileInfo = [];

        // Load each SQL file
        for (const file of sqlFiles) {
            const filePath = join(sqlPath, file);
            const queryName = file.replace(/\.sql$/, "");

            const sql = await readFile(filePath, "utf-8");

            // Determine if it's a migration (starts with underscore)
            const isMigration = queryName.startsWith("_");

            fileInfo.push({
                name: queryName,
                path: filePath,
                sql,
                isMigration
            });

            // Only cache non-migration queries
            if (!isMigration) {
                queryCache.set(queryName, sql);

                if (logSql) {
                    console.log(`Loaded SQL query: ${queryName}`);
                }
            }
        }

        console.log(`Loaded ${fileInfo.filter(f => !f.isMigration).length} SQL queries`);
        return fileInfo;
    } catch (error) {
        console.error("Error loading SQL files:", error);
        throw error;
    }
}

/**
 * Execute migration files
 * @param {Object} db - Database adapter
 * @param {Array} sqlFiles - SQL files information
 * @param {boolean} logSql - Whether to log migrations
 */
async function executeMigrations(db, sqlFiles, logSql = false) {
    try {
        // Get migration files
        const migrations = sqlFiles.filter(file => file.isMigration);

        if (migrations.length === 0) {
            console.log("No migrations found");
            return;
        }

        // Get executed migrations
        const result = await db.executeQuery(
            "SELECT name FROM _migrations"
        );

        const executedMigrations = new Set(result.map(row => row.name));

        // Sort migrations by name
        migrations.sort((a, b) => a.name.localeCompare(b.name));

        // Execute pending migrations
        let executedCount = 0;

        for (const migration of migrations) {
            if (executedMigrations.has(migration.name)) {
                if (logSql) {
                    console.log(`Migration already executed: ${migration.name}`);
                }
                continue;
            }

            // Execute migration
            console.log(`Executing migration: ${migration.name}`);
            await db.executeQuery(migration.sql);

            // Record migration execution
            await db.executeQuery(
                "INSERT INTO _migrations (name, executed_at) VALUES (:name, datetime('now'))",
                { name: migration.name }
            );

            executedCount++;
        }

        console.log(`Executed ${executedCount} migrations`);
    } catch (error) {
        console.error("Error executing migrations:", error);
        throw error;
    }
}

/**
 * Load SQL file directly from disk
 * @param {string} name - Name of the query
 * @returns {Promise<string>} SQL content
 */
async function loadSqlFromDisk(name) {
    if (!globalSqlPath) {
        throw new Error("SQL path not configured");
    }

    const filePath = join(globalSqlPath, `${name}.sql`);
    try {
        return await readFile(filePath, "utf-8");
    } catch (error) {
        console.error(`Error loading SQL file ${filePath}:`, error);
        throw new Error(`Query '${name}' not found`);
    }
}

/**
 * Execute a named SQL query
 * @param {string} name - Name of the query
 * @param {Object} params - Query parameters
 * @param {Object} db - Database adapter
 * @returns {Object} Query result
 */
export async function executeNamedQuery(name, params = {}, db) {
    let sql;

    if (disableCaching) {
        // When caching is disabled, load the SQL file directly from disk
        try {
            sql = await loadSqlFromDisk(name);
        } catch (error) {
            return {
                success: false,
                status: 404,
                error: error.message
            };
        }
    } else {
        // Use the cached version
        // Check if query exists
        if (!queryCache.has(name)) {
            return {
                success: false,
                status: 404,
                error: `Query '${name}' not found`
            };
        }

        // Get query from cache
        sql = queryCache.get(name);
    }

    try {
        // Execute query
        const result = await db.executeQuery(sql, params);

        return {
            success: true,
            data: result
        };
    } catch (error) {
        console.error(`Error executing query '${name}':`, error);

        return {
            success: false,
            status: 500,
            error: error.message
        };
    }
} 