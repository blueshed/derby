// Database adapter with lifecycle hooks
import { Database } from "bun:sqlite";
import { readdir } from "node:fs/promises";

// Get SQL directory from environment variable or use default
const SQL_DIR = process.env.SQL_DIR || "sql";

/**
 * Default file resolver that loads SQL from the filesystem
 * @param {string} queryName - Name of the SQL query
 * @returns {Promise<string>} The SQL file content
 */
async function defaultFileResolver(queryName) {
    const queryFile = Bun.file(`${SQL_DIR}/${queryName}.sql`);
    if (!(await queryFile.exists())) {
        throw new Error(`Could not find SQL file: ${queryName}`);
    }
    return queryFile.text();
}

/**
 * Default SQL transformer that returns the SQL as-is
 * @param {string} sql - The raw SQL from the file
 * @param {string} queryName - Name of the SQL query
 * @param {Object} params - The parameters being passed
 * @returns {string} The transformed SQL
 */
function defaultSqlTransformer(sql, queryName, params) {
    return sql;
}

/**
 * Default parameter formatter that returns parameters as-is
 * @param {Object} params - The parameters to format
 * @param {string} queryName - Name of the SQL query
 * @returns {Object} The formatted parameters
 */
function defaultParameterFormatter(params, queryName) {
    return params;
}

/**
 * Default result transformer that returns results as-is
 * @param {Array} results - The raw results from the database
 * @param {string} queryName - Name of the SQL query
 * @returns {Array} The transformed results
 */
function defaultResultTransformer(results, queryName) {
    return results;
}

/**
 * Creates a database adapter based on the connection URL
 * @param {string} connectionUrl - Database connection URL
 * @returns {Object} A database adapter
 */
export function createDatabaseAdapter(connectionUrl) {
    const [protocol, connectionString] = connectionUrl.split("://");

    switch (protocol) {
        case "sqlite":
            return createSqliteAdapter(connectionString);
        case "postgres":
            return createPostgresAdapter(connectionString);
        default:
            throw new Error(`Unsupported database protocol: ${protocol}`);
    }
}

/**
 * Creates a base adapter with customizable lifecycle hooks
 * @returns {Object} A base adapter
 */
function createBaseAdapter() {
    return {
        // Customizable hooks with default implementations
        fileResolver: defaultFileResolver,
        sqlTransformer: defaultSqlTransformer,
        parameterFormatter: defaultParameterFormatter,
        resultTransformer: defaultResultTransformer,

        // Main query execution function that uses the hooks
        async executeNamedQuery(queryName, params = {}) {
            try {
                // 1. Resolve and load the SQL file
                const sqlContent = await this.fileResolver(queryName);

                // 2. Transform the SQL if needed
                const sqlQuery = await this.sqlTransformer(sqlContent, queryName, params);

                // 3. Format parameters for the specific database
                const formattedParams = await this.parameterFormatter(params, queryName);

                // 4. Execute the query (implementation-specific)
                const rawResults = await this.executeQuery(sqlQuery, formattedParams);

                // 5. Transform the results if needed
                return this.resultTransformer(rawResults, queryName);
            } catch (error) {
                if (error.message.includes('Could not find SQL file')) {
                    throw new Error(`Query not found: ${queryName}`);
                }
                throw error;
            }
        },

        // Abstract method to be implemented by specific adapters
        async executeQuery(sqlQuery, params) {
            throw new Error("executeQuery method must be implemented by adapter");
        },

        // List all migration files in the sql directory
        async listMigrationFiles() {
            try {
                // Get all SQL files in the configured SQL directory
                const files = await readdir(SQL_DIR);

                // Filter for migration files (start with _) and sort them
                return files
                    .filter(file => file.startsWith('_') && file.endsWith('.sql'))
                    .sort(); // Alphabetical order ensures migrations run in sequence
            } catch (error) {
                console.error(`Error listing migration files from ${SQL_DIR}:`, error);
                return [];
            }
        },

        // Setup migration tracking table
        async setupMigrationTable() {
            const createMigrationsTable = `
                CREATE TABLE IF NOT EXISTS _migrations (
                    name TEXT NOT NULL,
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (name)
                );
            `;
            await this.executeQuery(createMigrationsTable, {});
        },

        // Get list of already applied migrations
        async getAppliedMigrations() {
            const appliedMigrations = await this.executeQuery(
                "SELECT name FROM _migrations ORDER BY name", {}
            );
            return new Set(appliedMigrations.map(m => m.name));
        },

        // Record a migration as applied
        async recordMigration(migrationName) {
            console.log(`Recording migration in database: ${migrationName}`);
            const migrationNameStr = String(migrationName);
            try {
                const result = await this.executeQuery(
                    "INSERT INTO _migrations (name) VALUES ($name) RETURNING name, applied_at",
                    { $name: migrationNameStr }
                );

                console.log("Insert result:", result);

                if (result.length === 0) {
                    console.error(`Warning: Failed to record migration ${migrationNameStr} in database`);
                } else {
                    console.log(`Successfully recorded migration: ${migrationNameStr}`);
                }
            } catch (error) {
                console.error(`Error recording migration ${migrationName}:`, error);
                throw error;
            }
        },

        // Run a specific migration
        async runMigration(migrationFile) {
            console.log(`Applying migration: ${migrationFile}`);

            // Get the SQL content, removing the .sql extension
            const migrationName = migrationFile.replace('.sql', '');
            const sql = await this.fileResolver(migrationName);

            // Execute the migration SQL
            await this.executeQuery(sql, {});

            // Record the migration as applied (store the full filename for tracking)
            await this.recordMigration(migrationFile);

            console.log(`Migration applied: ${migrationFile}`);
        },

        // Run all pending migrations
        async runMigrations() {
            try {
                // First ensure migrations table exists
                await this.setupMigrationTable();

                // Get list of already applied migrations
                const appliedSet = await this.getAppliedMigrations();

                // Find all migration files
                const migrationFiles = await this.listMigrationFiles();
                if (migrationFiles.length === 0) {
                    console.log(`No migration files found in directory: ${SQL_DIR}`);
                    return;
                }

                console.log(`Found ${migrationFiles.length} migration files in ${SQL_DIR}`);

                // Count how many migrations will be applied
                const pendingMigrations = migrationFiles.filter(
                    file => !appliedSet.has(file)
                );

                if (pendingMigrations.length === 0) {
                    console.log("No pending migrations to apply");
                    return;
                }

                console.log(`Applying ${pendingMigrations.length} pending migrations...`);

                // Run migrations in order
                for (const migFile of pendingMigrations) {
                    await this.runMigration(migFile);
                }

                console.log("All migrations applied successfully");
            } catch (error) {
                console.error("Migration error:", error);
                throw error;
            }
        },

        // Database initialization
        async initialize() {
            try {
                console.log(`Using SQL directory: ${SQL_DIR}`);
                // Run migrations (including _init_.sql if it exists)
                await this.runMigrations();
            } catch (error) {
                console.error("Database initialization error:", error);
                throw error;
            }
        }
    };
}

/**
 * Creates a SQLite-specific adapter
 * @param {string} connectionString - SQLite connection string
 * @returns {Object} A SQLite adapter
 */
function createSqliteAdapter(connectionString) {
    // Parse the connection path (remove leading /)
    const dbPath = connectionString.replace(/^\//, "");
    console.log(`Initializing SQLite with path: ${dbPath}`);

    const db = new Database(dbPath);
    const adapter = createBaseAdapter();

    // Override with SQLite-specific implementations
    adapter.executeQuery = async (sqlQuery, params) => {
        // For migration files with multiple statements, split and execute each one
        if (sqlQuery.includes(';') && Object.keys(params).length === 0) {
            console.log("Executing multi-statement SQL query");
            const statements = sqlQuery.split(';').filter(stmt => stmt.trim());
            let results = [];

            for (const statement of statements) {
                if (statement.trim()) {
                    console.log(`Executing statement: ${statement.trim().substring(0, 60)}${statement.length > 60 ? '...' : ''}`);
                    try {
                        const result = db.query(statement).all();
                        results.push(result);
                    } catch (error) {
                        console.error(`Error executing statement: ${statement.trim()}`);
                        console.error(error);
                        throw error;
                    }
                }
            }
            return results.flat();
        }

        // Standard query execution for single statements
        const hasParams = Object.keys(params).length > 0;
        if (hasParams) {
            console.log("Executing SQLite query with parameters:", params);
            return db.query(sqlQuery).all(params);
        }
        console.log("Executing SQLite query without parameters");
        return db.query(sqlQuery).all();
    };

    // Format parameters for SQLite's $name format
    adapter.parameterFormatter = async (params) => {
        const formattedParams = {};
        for (const [key, value] of Object.entries(params)) {
            formattedParams[key.startsWith('$') ? key : `$${key}`] = value;
        }
        return formattedParams;
    };

    return adapter;
}

/**
 * Creates a PostgreSQL-specific adapter
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Object} A PostgreSQL adapter
 */
function createPostgresAdapter(connectionString) {
    console.log(`Initializing PostgreSQL with connection: ${connectionString}`);

    try {
        // Dynamically import the postgres module
        const { postgres } = Bun;
        const db = postgres(connectionString);
        const adapter = createBaseAdapter();

        // Override with PostgreSQL-specific implementations
        adapter.executeQuery = async (sqlQuery, params) => {
            const hasParams = Object.keys(params).length > 0;
            if (hasParams) {
                console.log("Executing PostgreSQL query with parameters:", params);
                return db.query(sqlQuery, params);
            }
            console.log("Executing PostgreSQL query without parameters");
            return db.query(sqlQuery);
        };

        // Adapt SQL queries for PostgreSQL if needed
        adapter.sqlTransformer = (sql, queryName, params) => {
            // Convert SQLite's INSERT OR REPLACE to PostgreSQL's INSERT ON CONFLICT
            // This is a simple example; real implementations might need more complex transformations
            return sql.replace(/INSERT OR REPLACE/gi, "INSERT");
        };

        return adapter;
    } catch (error) {
        console.error("Error creating PostgreSQL adapter:", error);
        throw new Error(`PostgreSQL adapter creation failed: ${error.message}`);
    }
}

export default createDatabaseAdapter; 