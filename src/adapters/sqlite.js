import { Database } from "bun:sqlite";
import { createBaseAdapter } from "./base.js";

/**
 * SQLite-specific SQL transformer
 * @param {string} sql - SQL query
 * @param {Object} params - Query parameters
 * @returns {Object} Transformed SQL and parameters
 */
function sqliteTransformer(sql, params) {
    // SQLite uses named parameters with : prefix
    // We don't need to transform anything since it matches our format
    return { sql, params };
}

/**
 * Create a SQLite database adapter
 * @param {string} connectionString - SQLite connection string
 * @returns {Object} SQLite adapter
 */
export function createSqliteAdapter(connectionString) {
    // Create base adapter
    const adapter = createBaseAdapter();

    // Clean up connection string
    const dbPath = connectionString.replace(/^file:/, "");

    // Override SQL transformer
    adapter.sqlTransformer = sqliteTransformer;

    // Add SQLite-specific properties and methods
    return {
        ...adapter,

        // SQLite database instance
        db: null,

        /**
         * Initialize the database connection
         */
        async init() {
            console.log(`Initializing SQLite with path: ${dbPath}`);
            this.db = new Database(dbPath);
            this.isInitialized = true;
            console.log("Database adapter initialized");
        },

        /**
         * Close the database connection
         */
        async close() {
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            this.isInitialized = false;
            console.log("SQLite connection closed");
        },

        /**
         * Execute a query against the SQLite database
         * @param {string} sql - SQL query to execute
         * @param {Object} params - Query parameters
         * @returns {Array} Query results
         */
        async executeQuery(sql, params = {}) {
            if (!this.db) {
                throw new Error("Database not initialized");
            }

            try {
                // Check if SQL contains multiple statements
                if (sql.includes(';') && sql.trim().split(';').filter(s => s.trim()).length > 1) {
                    // Multi-statement case
                    const statements = sql.split(';').filter(s => s.trim());
                    let results = [];

                    for (const statement of statements) {
                        if (!statement.trim()) continue;

                        try {
                            let result;
                            if (Object.keys(params).length > 0) {
                                const stmt = this.db.prepare(statement);
                                result = stmt.all(params);
                            } else {
                                result = this.db.query(statement).all();
                            }

                            if (result && result.length > 0) {
                                results = result;
                            }
                        } catch (err) {
                            console.warn(`Statement error: ${err.message}`);
                            // Continue to next statement
                        }
                    }

                    return results;
                } else {
                    // Single statement
                    if (Object.keys(params).length > 0) {
                        try {
                            const stmt = this.db.prepare(sql);
                            return stmt.all(params);
                        } catch (err) {
                            console.warn(`Parameter binding error: ${err.message}`);
                            return this.db.query(sql).all();
                        }
                    } else {
                        return this.db.query(sql).all();
                    }
                }
            } catch (error) {
                console.error("SQLite query error:", error);
                throw error;
            }
        }
    };
} 