import { expect, test, beforeAll, afterAll } from "bun:test";
import { serve } from "bun";
import { handleHttpRequest, jsonResponse } from "../api.js";

// Setup environment
process.env.SQL_DIR = process.env.SQL_DIR || "sql";
process.env.DATABASE_URL = process.env.DATABASE_URL || "sqlite:./test_derby.sqlite";

// Server setup
let server;
const TEST_PORT = 3031;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const API_PATH = "/api/";

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

                console.log(`[HTTP TEST] [${timestamp}] ${method} ${path}`);

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
                if (path.startsWith(API_PATH)) {
                    try {
                        return await handleHttpRequest(req, API_PATH);
                    } catch (error) {
                        console.error(`[HTTP TEST] [${timestamp}] Error:`, error);
                        return jsonResponse({ error: error.message }, 500);
                    }
                }

                // Default route
                return new Response("HTTP Test API Server", {
                    headers: { "Content-Type": "text/plain" },
                });
            },

            error(error) {
                console.error(`[HTTP TEST] Server error: ${error}`);
            }
        });

        console.log(`[HTTP TEST] HTTP test server started on port ${TEST_PORT}`);
        setTimeout(resolve, 100); // Short delay to ensure server is ready
    });
});

// Close the server after tests
afterAll(() => {
    return new Promise((resolve) => {
        server.stop();
        console.log("[HTTP TEST] HTTP test server stopped");
        setTimeout(resolve, 100); // Give some time for cleanup
    });
});

test("HTTP API should retrieve users", async () => {
    const response = await fetch(`${BASE_URL}${API_PATH}get_users`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
});

test("HTTP API should retrieve a profile with parameters", async () => {
    const response = await fetch(`${BASE_URL}${API_PATH}get_profile?id=1`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toBe(1);
});

test("HTTP API should handle POST requests with JSON body", async () => {
    const newUser = {
        email: `test-${Date.now()}@example.com`,
        password: "test_password",
        given_name: "Test",
        family_name: "User"
    };

    const response = await fetch(`${BASE_URL}${API_PATH}create_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser)
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toBeDefined();
});

test("HTTP API should handle non-existent queries", async () => {
    const response = await fetch(`${BASE_URL}${API_PATH}non_existent_query`);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBeDefined();
});

test("HTTP API should handle errors gracefully", async () => {
    const response = await fetch(`${BASE_URL}${API_PATH}get_profile?id=99999`);
    expect(response.status).toBe(200);

    const data = await response.json();
    // Derby API should handle missing data by returning an empty array
    // (In some systems this would be a 404, but our API handles it gracefully)
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
}); 