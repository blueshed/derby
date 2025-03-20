import { createSqliteAdapter } from './sqlite.js';
import { createPostgresAdapter } from './postgres.js';

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

export { createSqliteAdapter, createPostgresAdapter }; 