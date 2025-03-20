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
    // Transform parameter names to add : prefix if missing
    const transformedParams = {};

    for (const [key, value] of Object.entries(params)) {
        // If key already starts with :, use it as is
        if (key.startsWith(':')) {
            transformedParams[key] = value;
        } else {
            // Otherwise add the : prefix
            transformedParams[`:${key}`] = value;
        }
    }

    return {
        sql,
        params: transformedParams
    };
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

        // Set the database type
        type: 'sqlite',

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

            // Apply parameter transformation
            const { params: transformedParams } = sqliteTransformer(sql, params);

            try {
                // Check if this is a multi-statement query
                if (sql.includes(';')) {
                    const statements = sql
                        .split(';')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);

                    if (statements.length > 1) {
                        console.log("Executing multi-statement SQLite query");

                        let allResults = [];
                        for (const stmt of statements) {
                            try {
                                let result;
                                if (Object.keys(transformedParams).length > 0) {
                                    try {
                                        const prepared = this.db.prepare(stmt);
                                        result = prepared.all(transformedParams);
                                    } catch (err) {
                                        console.warn(`Parameter binding error in statement: ${err.message}`);
                                        result = this.db.query(stmt).all();
                                    }
                                } else {
                                    result = this.db.query(stmt).all();
                                }

                                if (result && result.length > 0) {
                                    allResults = [...allResults, ...result];
                                }
                            } catch (err) {
                                console.error(`Error executing SQLite statement: ${stmt}`, err);
                                // Continue to next statement rather than failing
                            }
                        }
                        return allResults;
                    }
                }

                // Single statement case (the simple path)
                if (Object.keys(transformedParams).length > 0) {
                    try {
                        const stmt = this.db.prepare(sql);
                        return stmt.all(transformedParams);
                    } catch (err) {
                        console.warn(`Parameter binding error: ${err.message}`);
                        return this.db.query(sql).all();
                    }
                } else {
                    return this.db.query(sql).all();
                }
            } catch (error) {
                console.error("SQLite query error:", error);
                throw error;
            }
        }
    };
} 