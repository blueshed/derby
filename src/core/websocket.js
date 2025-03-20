/**
 * WebSocket handler that implements JSON-RPC 2.0 protocol
 */

// JSON-RPC 2.0 Error codes
export const RPC_ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603
};

/**
 * Creates a WebSocket handler that implements JSON-RPC 2.0
 * @param {Object} customMethods - Object containing method handlers
 * @returns {Object} WebSocket configuration object
 */
export function createWebSocketHandler(customMethods = {}) {
    // Copy custom methods to avoid mutation
    const methods = { ...customMethods };

    // Connected clients for broadcasting
    const clients = new Set();

    // Helper to send an error response
    const sendError = (ws, id, code, message) => {
        console.log(`Sending error: ${code} - ${message}`);
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            error: {
                code,
                message
            },
            id
        }));
    };

    // Helper to process a message
    const processMessage = async (ws, message) => {
        console.log("Received WebSocket message:", message);

        // Parse message as JSON
        let request;
        try {
            request = JSON.parse(message);
        } catch (error) {
            console.error("Invalid JSON:", error);
            return sendError(ws, null, RPC_ERROR_CODES.PARSE_ERROR, "Invalid JSON");
        }

        const id = request.id;

        try {
            // Validate JSON-RPC request
            if (!request.jsonrpc || request.jsonrpc !== "2.0" || !request.method) {
                console.log("Invalid JSON-RPC request:", request);
                return sendError(ws, id, RPC_ERROR_CODES.INVALID_REQUEST, "Invalid JSON-RPC request");
            }

            // Look up the method handler
            const methodHandler = methods[request.method];
            if (!methodHandler) {
                console.log(`Method not found: ${request.method}`);
                return sendError(
                    ws,
                    id,
                    RPC_ERROR_CODES.METHOD_NOT_FOUND,
                    `Method '${request.method}' not found`
                );
            }

            // Execute the method
            console.log(`Executing method '${request.method}'`);
            const result = await methodHandler(request.params, id, ws);

            // Send successful response
            ws.send(JSON.stringify({
                jsonrpc: "2.0",
                result,
                id
            }));
        } catch (error) {
            console.error(`Error executing method '${request.method}':`, error);

            if (error && typeof error === "object") {
                const code = error.code || RPC_ERROR_CODES.INTERNAL_ERROR;
                const message = error.message || "Internal error";
                sendError(ws, id, code, message);
            } else {
                sendError(ws, id, RPC_ERROR_CODES.INTERNAL_ERROR, String(error));
            }
        }
    };

    // Create and return the WebSocket handler
    return {
        // Method registry
        methods,

        /**
         * Get a registered method
         * @param {string} name - Method name
         * @returns {Function} Method handler or undefined
         */
        getMethod(name) {
            return methods[name];
        },

        /**
         * Register a new method
         * @param {string} name - Method name
         * @param {Function} handler - Method handler
         */
        registerMethod(name, handler) {
            methods[name] = handler;
            console.log(`Registered WebSocket method: ${name}`);
        },

        /**
         * Handle WebSocket connection open
         * @param {WebSocket} ws - WebSocket connection
         */
        open(ws) {
            clients.add(ws);
            console.log(`WebSocket client connected. Total clients: ${clients.size}`);
        },

        /**
         * Handle WebSocket message
         * @param {WebSocket} ws - WebSocket connection
         * @param {string} message - Message data
         */
        async message(ws, message) {
            return processMessage(ws, message);
        },

        /**
         * Handle WebSocket connection close
         * @param {WebSocket} ws - WebSocket connection
         */
        close(ws) {
            clients.delete(ws);
            console.log(`WebSocket client disconnected. Total clients: ${clients.size}`);
        },

        /**
         * Broadcast a message to all connected clients
         * @param {Object} data - Data to broadcast
         */
        broadcast(data) {
            const message = JSON.stringify({
                jsonrpc: "2.0",
                method: "notification",
                params: data
            });

            for (const client of clients) {
                if (client.readyState === 1) { // OPEN
                    client.send(message);
                }
            }
        },

        /**
         * Send an error response
         * @param {WebSocket} ws - WebSocket connection
         * @param {string|number} id - Request ID
         * @param {number} code - Error code
         * @param {string} message - Error message
         */
        sendError(ws, id, code, message) {
            return sendError(ws, id, code, message);
        }
    };
}

/**
 * Send a broadcast message to all subscribed clients
 * @param {WebSocket} ws - WebSocket connection 
 * @param {string} action - Action name
 * @param {Object} data - Data to broadcast
 */
export function broadcast(ws, action, data) {
    ws.send(JSON.stringify({
        action,
        args: data,
        timestamp: new Date().toISOString()
    }));
}

/**
 * Send a JSON-RPC error response
 * @param {WebSocket} ws - WebSocket connection
 * @param {number} code - Error code
 * @param {string} message - Error message
 * @param {string|number|null} id - Request ID or null
 */
function sendError(ws, code, message, id) {
    ws.send(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: code,
            message: message
        },
        id: id
    }));
} 