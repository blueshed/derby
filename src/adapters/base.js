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
 * SQL parameter transformer - converts named parameters to the format
 * expected by the database driver
 * @param {string} sql - SQL query with named parameters
 * @param {Object} params - Parameter values
 * @returns {Object} Transformed SQL and parameters
 */
export function defaultSqlTransformer(sql, params) {
    // By default, we just pass the SQL and parameters through unchanged
    return { sql, params };
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
 * Creates a base adapter with customizable lifecycle hooks
 * @returns {Object} A base adapter
 */
export function createBaseAdapter() {
    return {
        // Connection state
        isInitialized: false,

        // Default SQL transformer
        sqlTransformer: defaultSqlTransformer,

        /**
         * Initialize the database connection
         */
        async init() {
            this.isInitialized = true;
            console.log("Database adapter initialized");
        },

        /**
         * Close the database connection
         */
        async close() {
            this.isInitialized = false;
            console.log("Database adapter closed");
        },

        /**
         * Execute a SQL query
         * @param {string} sql - SQL query
         * @param {Object} params - Query parameters
         * @returns {Array} Query results
         */
        async executeQuery(sql, params = {}) {
            throw new Error("executeQuery must be implemented by adapter");
        },

        /**
         * Execute a transaction
         * @param {Function} callback - Transaction callback
         * @returns {*} Transaction result
         */
        async transaction(callback) {
            throw new Error("transaction must be implemented by adapter");
        },

        // Customizable hooks with default implementations
        fileResolver: defaultFileResolver,
        parameterFormatter: defaultParameterFormatter,
        resultTransformer: defaultResultTransformer,

        // Main query execution function that uses the hooks
        async executeNamedQuery(queryName, params = {}) {
            try {
                // 1. Resolve and load the SQL file
                const sqlContent = await this.fileResolver(queryName);

                // 2. Transform the SQL if needed
                const { sql, transformedParams } = await this.sqlTransformer(sqlContent, params);

                // 3. Format parameters for the specific database
                const formattedParams = await this.parameterFormatter(transformedParams, queryName);

                // 4. Execute the query (implementation-specific)
                const rawResults = await this.executeQuery(sql, formattedParams);

                // 5. Transform the results if needed
                return this.resultTransformer(rawResults, queryName);
            } catch (error) {
                if (error.message.includes('Could not find SQL file')) {
                    throw new Error(`Query not found: ${queryName}`);
                }
                throw error;
            }
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