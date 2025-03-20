import { serve } from "bun";
import { handleHttpRequest, jsonResponse, handleApiQuery } from "./api.js";
import { createWebSocketHandler } from "./websocket.js";
import { setupDatabase } from "./db.js";
import { mergeConfig } from "./config.js";
import { createStaticHandler } from "./static.js";

/**
 * Create a Derby server instance
 * @param {Object} userConfig - User configuration
 * @returns {Object} Server instance with start/stop methods
 */
export async function createServer(userConfig = {}) {
    // Merge with default configuration
    const config = mergeConfig(userConfig);

    // Initialize database
    const db = await setupDatabase(config.database);

    // Create WebSocket handler with provided methods
    const websocketHandler = createWebSocketHandler(config.websocket.methods);

    // Add standard sql method if not already defined
    if (!websocketHandler.getMethod('sql')) {
        websocketHandler.registerMethod('sql', async (params, id, ws) => {
            if (!params || !params.name) {
                throw {
                    code: -32602,
                    message: "Missing query name"
                };
            }

            const result = await handleApiQuery(params.name, params.parameters || {}, db);

            if (result.success) {
                return result.data;
            } else {
                // Map API error codes to JSON-RPC error codes
                let errorCode = -32603; // Internal error by default
                if (result.status === 404) errorCode = -32601; // Method not found
                if (result.status === 400) errorCode = -32602; // Invalid params

                throw {
                    code: errorCode,
                    message: result.error
                };
            }
        });
    }

    // Create static file handler
    const staticHandler = createStaticHandler(config.staticDir);

    // Create server
    const server = serve({
        port: config.port,

        async fetch(req, server) {
            const url = new URL(req.url);
            const method = req.method;
            const path = url.pathname;
            const timestamp = new Date().toISOString();

            console.log(`[${timestamp}] ${method} ${path}`);

            // WebSocket upgrade
            if (server.upgrade(req)) {
                return; // Return if the connection was upgraded
            }

            // CORS handling
            if (method === "OPTIONS" && config.cors.enabled) {
                return new Response(null, {
                    headers: {
                        "Access-Control-Allow-Origin": config.cors.origin,
                        "Access-Control-Allow-Methods": config.cors.methods,
                        "Access-Control-Allow-Headers": config.cors.headers,
                    },
                });
            }

            // API handling
            if (path.startsWith(config.apiPath)) {
                try {
                    return await handleHttpRequest(req, config.apiPath, db);
                } catch (error) {
                    console.error(`[${timestamp}] Error:`, error);
                    return jsonResponse({ error: error.message }, 500);
                }
            }

            // Static file serving
            return staticHandler(path);
        },

        error(error) {
            console.error(`Server error:`, error);
        },

        // Integrate WebSocket handler
        websocket: websocketHandler
    });

    return {
        start() {
            console.log(`Derby server started at ${new Date().toISOString()}`);
            console.log(`HTTP server listening on http://localhost:${config.port}`);
            console.log(`WebSocket endpoint available at ws://localhost:${config.port}`);
            console.log(`Serving static files from ${config.staticDir}`);
            return server;
        },

        stop() {
            console.log("Stopping Derby server...");
            server.stop();
            console.log("Derby server stopped");
        },

        // Expose the underlying server object
        server,

        // Expose key components for extensibility
        config,
        db,
        websocketHandler
    };
} 