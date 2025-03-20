// Export main APIs
export { createServer } from "./core/server.js";
export { mergeConfig, defaultConfig } from "./core/config.js";

// Export database helpers
export { executeNamedQuery } from "./core/db.js";
export { createSqliteAdapter } from "./adapters/sqlite.js";
export { createPostgresAdapter } from "./adapters/postgres.js";

// Export core modules
export { createWebSocketHandler } from "./core/websocket.js";
export { createStaticHandler } from "./core/static.js";
export { handleHttpRequest, jsonResponse } from "./core/api.js";

/**
 * Derby - A lightweight web application framework for Bun
 * @module derby
 */

/**
 * Create a Derby application
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Derby server instance
 */
export default async function derby(config = {}) {
    const { createServer } = await import("./core/server.js");
    return createServer(config);
} 