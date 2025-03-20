import { expect, test, beforeAll, afterAll } from "bun:test";
import { WebSocket } from "ws";
import { serve } from "bun";
import { createWebSocketHandler } from "../websocket.js";
import { handleHttpRequest, jsonResponse } from "../api.js";

// Setup environment
process.env.SQL_DIR = process.env.SQL_DIR || "sql";
process.env.DATABASE_URL = process.env.DATABASE_URL || "sqlite:./test_derby.sqlite";

// Server setup
let server;
const TEST_PORT = 3030;
let serverUrl = `ws://localhost:${TEST_PORT}`;
let ws;
let messageQueue = [];
let connectionMessage = null;

// Start a test server before tests
beforeAll(() => {
    return new Promise((resolve) => {
        // Create test server with same configuration as main server
        server = serve({
            port: TEST_PORT,

            async fetch(req, server) {
                const url = new URL(req.url);
                const method = req.method;
                const path = url.pathname;
                const timestamp = new Date().toISOString();

                console.log(`[TEST] [${timestamp}] ${method} ${path}`);

                // Upgrade WebSocket connections
                if (server.upgrade(req)) {
                    return; // Return if the connection was upgraded
                }

                // Handle CORS preflight requests
                if (method === "OPTIONS") {
                    return new Response(null, {
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type",
                        },
                    });
                }

                // API route handler
                if (path.startsWith("/api/")) {
                    try {
                        return await handleHttpRequest(req, "/api/");
                    } catch (error) {
                        console.error(`[TEST] [${timestamp}] Error:`, error);
                        return jsonResponse({ error: error.message }, 500);
                    }
                }

                // Default route
                return new Response("Test API Server", {
                    headers: { "Content-Type": "text/plain" },
                });
            },

            error(error) {
                console.error(`[TEST] Server error: ${error}`);
            },

            // Integrate WebSocket handler
            websocket: createWebSocketHandler()
        });

        console.log(`[TEST] WebSocket test server started on port ${TEST_PORT}`);
        setTimeout(resolve, 100); // Short delay to ensure server is ready
    });
});

// Close the server after tests
afterAll(() => {
    return new Promise((resolve) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
        server.stop();
        console.log("[TEST] WebSocket test server stopped");
        setTimeout(resolve, 100); // Give some time for cleanup
    });
});

// Setup WebSocket connection for tests
test("WebSocket connection", async () => {
    ws = new WebSocket(serverUrl);

    await new Promise((resolve) => {
        ws.on("open", () => {
            console.log("[TEST] WebSocket connection established");
        });

        ws.on("message", (data) => {
            const message = JSON.parse(data.toString());
            console.log("[TEST] Received:", message);

            // Store the connection message - supports both formats
            if (message.action === "connection" || message.method === "connection") {
                connectionMessage = message;
                resolve();
            } else {
                // Store response for later tests
                messageQueue.push(message);
            }
        });
    });

    // Check connection message
    expect(connectionMessage).toBeDefined();
    // Support both old and new formats
    if (connectionMessage.jsonrpc) {
        expect(connectionMessage.jsonrpc).toBe("2.0");
        expect(connectionMessage.method).toBe("connection");
        expect(connectionMessage.params.args).toBeDefined();
    } else {
        expect(connectionMessage.action).toBe("connection");
        expect(connectionMessage.args).toBeDefined();
    }
});

// Function to send JSON-RPC query
function sendJsonRpcQuery(queryName, params = {}, id = "test-id") {
    const request = {
        jsonrpc: "2.0",
        method: "query",
        params: {
            name: queryName,
            parameters: params
        },
        id: id
    };
    ws.send(JSON.stringify(request));
}

// Function to send legacy query format
function sendLegacyQuery(queryName, params = {}, requestId = "test-id") {
    const request = {
        queryName: queryName,
        params: params,
        requestId: requestId
    };
    ws.send(JSON.stringify(request));
}

// Wait for WebSocket response
function waitForResponse(timeout = 3000) {
    return new Promise((resolve, reject) => {
        // Check if we already have a message
        if (messageQueue.length > 0) {
            return resolve(messageQueue.shift());
        }

        // Setup listener for new messages
        const messageHandler = (data) => {
            const message = JSON.parse(data.toString());
            console.log("[TEST] Received in handler:", message);
            messageQueue.push(message);
        };

        ws.on("message", messageHandler);

        // Setup timeout
        const timeoutId = setTimeout(() => {
            ws.removeListener("message", messageHandler);
            reject(new Error(`Timeout waiting for WebSocket response after ${timeout}ms`));
        }, timeout);

        // Setup interval to check queue
        const intervalId = setInterval(() => {
            if (messageQueue.length > 0) {
                clearTimeout(timeoutId);
                clearInterval(intervalId);
                ws.removeListener("message", messageHandler);
                resolve(messageQueue.shift());
            }
        }, 50);
    });
}

// Test JSON-RPC format
test("WebSocket JSON-RPC: get_users query", async () => {
    // Send query
    sendJsonRpcQuery("get_users");

    // Wait for response
    const response = await waitForResponse();

    // Check response format
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe("test-id");
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result)).toBe(true);
});

// Test legacy format
test("WebSocket Legacy: get_users query", async () => {
    // Send legacy query
    sendLegacyQuery("get_users");

    // Wait for response
    const response = await waitForResponse();

    // Check response format (should be converted to JSON-RPC format)
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe("test-id");
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result)).toBe(true);
});

test("WebSocket: get_profile query with parameters", async () => {
    // Send query with parameter
    sendJsonRpcQuery("get_profile", { id: 1 });

    // Wait for response
    const response = await waitForResponse();

    // Check response format
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe("test-id");
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result)).toBe(true);
    expect(response.result.length).toBeGreaterThan(0);
    expect(response.result[0].id).toBe(1);
});

test("WebSocket: direct method call", async () => {
    // Clear any pending messages
    messageQueue = [];

    // Send direct method call instead of using query method
    ws.send(JSON.stringify({
        jsonrpc: "2.0",
        method: "get_users",
        params: {},
        id: "direct-call"
    }));

    // Wait for response
    const response = await waitForResponse();

    // Check response format
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe("direct-call");
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result)).toBe(true);
});

test("WebSocket: non_existent_query", async () => {
    // Clear any pending messages
    messageQueue = [];

    // Send non-existent query
    sendJsonRpcQuery("non_existent_query");

    // Wait for response
    const response = await waitForResponse();

    // Check error response format
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe("test-id");
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(-32601); // METHOD_NOT_FOUND
});

test("WebSocket: invalid JSON-RPC request", async () => {
    // Clear any pending messages
    messageQueue = [];

    // Send invalid JSON-RPC request
    ws.send(JSON.stringify({ invalid: "request" }));

    // Wait for response
    const response = await waitForResponse();

    // Check error response format
    expect(response.jsonrpc).toBe("2.0");
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(-32600); // INVALID_REQUEST
}); 