import { createBaseAdapter } from "./base.js";
import { sql, SQL } from "bun";

/**
 * Transform SQL parameters for PostgreSQL with named substitution support
 * @param {string} sql - SQL query with named parameters
 * @param {Object} params - Parameter values
 * @returns {Object} Transformed SQL and parameters
 */
export function postgresTransformer(sql, params) {
    // If no params, return as is
    if (!params || Object.keys(params).length === 0) {
        return { sql, params: {} };
    }

    // Convert $name params to :name which Bun can use for named params
    let transformedSql = sql.replace(/\$(\w+)/g, (match, paramName) => {
        return `:${paramName}`;
    });

    // Return the SQL with :name syntax and the original params object
    return { sql: transformedSql, params };
}

/**
 * Create a PostgreSQL database adapter
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Object} PostgreSQL adapter
 */
export function createPostgresAdapter(connectionString) {
    // Create base adapter
    const adapter = createBaseAdapter();
    let pgClient = null;

    // Clean up the connection string if needed
    const connString = connectionString.startsWith('postgres://')
        ? connectionString
        : `postgres://${connectionString}`;

    // Add PostgreSQL-specific properties and methods
    return {
        ...adapter,

        // Set the database type
        type: 'postgres',

        // Override SQL transformer with PostgreSQL-specific version
        sqlTransformer: postgresTransformer,

        /**
         * Initialize the database connection
         */
        async init() {
            // Hide password in logs for security
            const maskedConnString = connString.replace(/:[^:]*@/, ':****@');
            console.log(`Initializing PostgreSQL with connection: ${maskedConnString}`);

            try {
                // Create PostgreSQL client using Bun's built-in SQL support
                pgClient = new SQL({
                    url: connString,
                    // Add connection pool settings
                    max: 20,             // Maximum connections in pool
                    idleTimeout: 30,     // Close idle connections after 30s
                    connectionTimeout: 5, // Timeout when establishing new connections
                });

                // Test the connection using tagged template literals directly
                try {
                    const result = await pgClient`SELECT 1 as test`;

                    if (result && result.length > 0) {
                        console.log("Successfully connected to PostgreSQL database");
                        this.isInitialized = true;
                        return this;
                    } else {
                        throw new Error("Failed to verify PostgreSQL connection");
                    }
                } catch (error) {
                    // Handle specific PostgreSQL errors
                    if (error.code === 'ERR_POSTGRES_SERVER_ERROR') {
                        if (error.errno === '28P01') {
                            throw new Error(`Authentication failed: Invalid username or password`);
                        } else if (error.errno === '3D000') {
                            throw new Error(`Database "${connString.split('/').pop()}" does not exist`);
                        }
                    }

                    // Re-throw the original error if not handled above
                    throw error;
                }
            } catch (error) {
                console.error("PostgreSQL connection error:", error.message);
                throw error;
            }
        },

        /**
         * Close the database connection
         */
        async close() {
            console.log("Closing PostgreSQL connection");
            // Let Bun handle connection pool closing
            pgClient = null;
            this.isInitialized = false;
        },

        /**
         * Execute a query against the PostgreSQL database
         * @param {string} sql - SQL query to execute
         * @param {Object|Array} params - Query parameters
         * @returns {Array} Query results
         */
        async executeQuery(sql, params = {}) {
            if (!this.isInitialized || !pgClient) {
                throw new Error("PostgreSQL adapter not initialized");
            }

            try {
                // Special case for migration table creation which can fail with parameter processing
                if (sql.includes('CREATE TABLE IF NOT EXISTS _migrations')) {
                    console.log("Using direct migration table creation");
                    return await pgClient`
                        CREATE TABLE IF NOT EXISTS _migrations (
                            name TEXT PRIMARY KEY,
                            executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                        )
                    `;
                }

                // Transform parameters if needed
                const { sql: transformedSql, params: transformedParams } =
                    this.sqlTransformer(sql, params);

                console.log(`[PG] Executing SQL: ${transformedSql}`);

                // For multi-statement queries, split them and execute each separately
                if (transformedSql.split(';').filter(s => s.trim()).length > 1) {
                    let allResults = [];
                    const statements = transformedSql.split(';').filter(s => s.trim());

                    for (const stmt of statements) {
                        try {
                            // For multi-statement queries, use direct execution without parameters
                            // as parameters are typically only used in single statements
                            const results = await pgClient`${stmt}`;

                            if (results && results.length > 0) {
                                allResults = [...allResults, ...results];
                            }
                        } catch (err) {
                            console.error(`Error executing statement: ${stmt}`, err);
                            // Continue with next statement rather than failing entirely
                        }
                    }

                    return allResults;
                } else {
                    // Single statement
                    return await this.executeSingleStatement(transformedSql, transformedParams);
                }
            } catch (error) {
                // Format the error message for better debugging
                if (error.code === 'ERR_POSTGRES_SERVER_ERROR') {
                    console.error(`PostgreSQL query error [${error.errno}]: ${error.message}`);
                } else {
                    console.error("PostgreSQL query error:", error.message);
                }
                throw error;
            }
        },

        /**
         * Execute a single SQL statement
         * @private
         * @param {string} stmt - SQL statement to execute
         * @param {Object} params - Query parameters
         * @returns {Array} Query results
         */
        async executeSingleStatement(stmt, params = {}) {
            if (!params || Object.keys(params).length === 0) {
                // No parameters - use simple tagged template
                return await pgClient`${stmt}`;
            }

            // Use the sql helper from Bun with named parameters support
            try {
                // Create an SQL statement with named parameters
                return await pgClient(stmt, params);
            } catch (error) {
                console.error("Error executing statement with parameters:", error);
                throw error;
            }
        },

        /**
         * Execute a transaction
         * @param {Function} callback - Transaction callback
         * @returns {*} Transaction result
         */
        async transaction(callback) {
            if (!this.isInitialized || !pgClient) {
                throw new Error("PostgreSQL adapter not initialized");
            }

            try {
                // Use Bun's native transaction support
                return await pgClient.begin(async (tx) => {
                    // Create a temporary adapter for the transaction
                    const txAdapter = { ...this };

                    // Override executeQuery to use the transaction context
                    txAdapter.executeSingleStatement = async (stmt, params = {}) => {
                        if (!params || Object.keys(params).length === 0) {
                            return await tx`${stmt}`;
                        } else {
                            // Use named parameters with transaction
                            return await tx(stmt, params);
                        }
                    };

                    // Call the callback with the transaction adapter
                    return await callback(txAdapter);
                });
            } catch (error) {
                // Format the error message for better debugging
                if (error.code === 'ERR_POSTGRES_SERVER_ERROR') {
                    console.error(`PostgreSQL transaction error [${error.errno}]: ${error.message}`);
                } else {
                    console.error("PostgreSQL transaction error:", error.message);
                }
                throw error;
            }
        }
    };
} 