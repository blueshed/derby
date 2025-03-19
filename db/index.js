import { createDatabaseAdapter } from "./adapter.js";

// Use environment variable for database connection with fallback
const DB_URL = process.env.DATABASE_URL || "sqlite:///./derby.sqlite";

// Create database adapter based on connection URL
const dbAdapter = createDatabaseAdapter(DB_URL);

// Initialize the database
await dbAdapter.initialize();

/**
 * Executes a named SQL query from the sql directory
 * @param {string} queryName - Name of the SQL file (without .sql extension)
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
export async function executeNamedQuery(queryName, params = {}) {
    return dbAdapter.executeNamedQuery(queryName, params);
}

export default dbAdapter; 