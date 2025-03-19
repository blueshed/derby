// WebSocket server that uses the same API handler
import { handleApiQuery } from "./api";

/**
 * Creates a WebSocket handler that can be added to an HTTP server
 * @returns {Object} WebSocket configuration object
 */
export function createWebSocketHandler() {
    return {
        open(ws) {
            console.log("WebSocket connection opened");
            // Send a welcome message
            ws.send(JSON.stringify({
                type: "connection",
                message: "Connected to Derby SQL WebSocket API",
                timestamp: new Date().toISOString()
            }));
        },
        async message(ws, message) {
            try {
                // Parse the request
                const request = JSON.parse(message);
                const { queryName, params = {}, requestId } = request;

                console.log(`[WebSocket] Processing query: ${queryName}`);
                console.log("Parameters:", params);

                // Use the same API handler
                const result = await handleApiQuery(queryName, params);

                // Send back the response with requestId for correlation
                ws.send(JSON.stringify({
                    requestId,
                    ...result
                }));
            } catch (error) {
                console.error("WebSocket error:", error);
                ws.send(JSON.stringify({
                    success: false,
                    error: "Invalid request format: " + error.message,
                    status: 400
                }));
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