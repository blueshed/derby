// WebSocket server that uses JSON-RPC 2.0 protocol
import { handleApiQuery } from "./api";

// JSON-RPC 2.0 Error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

/**
 * Creates a WebSocket handler that implements JSON-RPC 2.0
 * @returns {Object} WebSocket configuration object
 */
export function createWebSocketHandler() {
    return {
        open(ws) {
            console.log("WebSocket connection opened");
            // Send a welcome message
            ws.send(JSON.stringify({
                jsonrpc: "2.0",
                method: "connection",
                params: {
                    message: "Connected to Derby SQL JSON-RPC API",
                    timestamp: new Date().toISOString()
                }
            }));
        },
        async message(ws, message) {
            let request;
            let id = null;

            try {
                // Parse the request
                try {
                    request = JSON.parse(message);
                    id = request.id || request.requestId; // Support both formats
                } catch (e) {
                    return sendError(ws, PARSE_ERROR, "Invalid JSON", null);
                }

                console.log("Received WebSocket message:", request);

                // Handle legacy format (pre-JSON-RPC)
                if (request.queryName) {
                    console.log("Processing legacy format request");
                    // Convert to new format internally
                    const legacyRequest = {
                        jsonrpc: "2.0",
                        method: "query",
                        params: {
                            name: request.queryName,
                            parameters: request.params || {}
                        },
                        id: request.requestId
                    };
                    return await handleQuery(ws, legacyRequest);
                }

                // Validate JSON-RPC request
                if (!request.jsonrpc || request.jsonrpc !== "2.0" || !request.method) {
                    return sendError(ws, INVALID_REQUEST, "Invalid JSON-RPC request", id);
                }

                // Handle different methods
                switch (request.method) {
                    case "query":
                        await handleQuery(ws, request);
                        break;

                    // Direct method calls for backward compatibility
                    case "get_users":
                    case "get_profile":
                    case "create_user":
                    case "update_user":
                    case "delete_user":
                        // Handle direct method calls by converting to query method
                        const directRequest = {
                            ...request,
                            method: "query",
                            params: {
                                name: request.method,
                                parameters: request.params || {}
                            }
                        };
                        await handleQuery(ws, directRequest);
                        break;

                    default:
                        return sendError(ws, METHOD_NOT_FOUND, `Method '${request.method}' not found`, id);
                }
            } catch (error) {
                console.error("WebSocket error:", error);
                sendError(ws, INTERNAL_ERROR, error.message, id);
            }
        },
        close(ws, code, message) {
            console.log(`WebSocket connection closed: ${code}`, message);
        },
        drain(ws) {
            console.log("WebSocket backpressure drained");
        }
    };
}

/**
 * Handle SQL query method
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} request - JSON-RPC request
 */
async function handleQuery(ws, request) {
    const { id, params } = request;

    // Validate parameters
    if (!params || !params.name) {
        return sendError(ws, INVALID_PARAMS, "Missing query name", id);
    }

    try {
        // Execute the query using the API handler
        const result = await handleApiQuery(params.name, params.parameters || {});

        if (result.success) {
            // Send success response
            ws.send(JSON.stringify({
                jsonrpc: "2.0",
                result: result.data,
                id: id
            }));
        } else {
            // Send error response with the appropriate error code
            let errorCode = INTERNAL_ERROR;
            if (result.status === 404) errorCode = METHOD_NOT_FOUND;
            if (result.status === 400) errorCode = INVALID_PARAMS;

            sendError(ws, errorCode, result.error, id);
        }
    } catch (error) {
        sendError(ws, INTERNAL_ERROR, error.message, id);
    }
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