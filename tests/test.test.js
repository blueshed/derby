import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { serve } from "bun";
import { handleHttpRequest, jsonResponse } from "../api.js";
import { executeNamedQuery } from "../db/index.js";

// Setup environment for testing
process.env.SQL_DIR = process.env.SQL_DIR || "sql";
process.env.DATABASE_URL = process.env.DATABASE_URL || "sqlite:./test_derby.sqlite";

// Database connection for direct tests
let db;

// Server setup for API tests
let server;
const TEST_PORT = 3032;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const API_PATH = "/api/";

// Start a test server before tests
beforeAll(async () => {
    return new Promise((resolve) => {
        // Create test server with same configuration as main server
        server = serve({
            port: TEST_PORT,

            async fetch(req, server) {
                const url = new URL(req.url);
                const method = req.method;
                const path = url.pathname;
                const timestamp = new Date().toISOString();

                console.log(`[API TEST] [${timestamp}] ${method} ${path}`);

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
                        console.error(`[API TEST] [${timestamp}] Error:`, error);
                        return jsonResponse({ error: error.message }, 500);
                    }
                }

                // Default route
                return new Response("API Test Server", {
                    headers: { "Content-Type": "text/plain" },
                });
            },

            error(error) {
                console.error(`[API TEST] Server error: ${error}`);
            }
        });

        console.log(`[API TEST] API test server started on port ${TEST_PORT}`);
        setTimeout(resolve, 100); // Short delay to ensure server is ready
    });
});

// Close the server after tests
afterAll(async () => {
    server.stop();
    console.log("[API TEST] API test server stopped");
});

// Database direct tests
describe("Database", () => {
    test("executeNamedQuery with get_users", async () => {
        const results = await executeNamedQuery("get_users");

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);

        // Check user properties
        const user = results[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("given_name");
        expect(user).toHaveProperty("family_name");
    });

    test("executeNamedQuery with get_profile and params", async () => {
        const results = await executeNamedQuery("get_profile", { id: 1 });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(1);

        const profile = results[0];
        expect(profile).toHaveProperty("id");
        expect(profile).toHaveProperty("email");
        expect(profile).toHaveProperty("given_name");
    });

    test("create_user, update_user, and delete_user", async () => {
        // Create user
        const testEmail = `test-${Date.now()}@example.com`;
        const createResults = await executeNamedQuery("create_user", {
            email: testEmail,
            password: "test_password",
            given_name: "Test",
            family_name: "User",
            permission: "user",
            preferences: JSON.stringify({ theme: "dark" })
        });

        expect(createResults.length).toBe(1);
        expect(createResults[0].email).toBe(testEmail);

        const userId = createResults[0].id;

        // Update user
        const updateResults = await executeNamedQuery("update_user", {
            id: userId,
            given_name: "Updated",
            preferences: JSON.stringify({ theme: "light", notifications: true })
        });

        expect(updateResults.length).toBe(1);
        expect(updateResults[0].given_name).toBe("Updated");

        // Verify update
        const getResults = await executeNamedQuery("get_profile", { id: userId });
        expect(getResults.length).toBe(1);
        expect(getResults[0].given_name).toBe("Updated");

        // Delete user
        await executeNamedQuery("delete_user", { id: userId });

        // Verify deletion
        const verifyResults = await executeNamedQuery("get_profile", { id: userId });
        expect(verifyResults.length).toBe(0);
    });

    test("update_user with non-existent ID", async () => {
        const results = await executeNamedQuery("update_user", {
            id: 9999,
            given_name: "Should Not Update"
        });

        expect(results.length).toBe(0);
    });

    test("delete_user with non-existent ID", async () => {
        await executeNamedQuery("delete_user", { id: 9999 });
    });

    test("partial updates with different fields", async () => {
        // Create test user
        const testEmail = `partial-update-${Date.now()}@example.com`;
        const createResults = await executeNamedQuery("create_user", {
            email: testEmail,
            password: "password123",
            given_name: "Partial",
            family_name: "Update",
            permission: "user",
            preferences: JSON.stringify({ notifications: false })
        });

        const userId = createResults[0].id;

        // Update only first name
        await executeNamedQuery("update_user", {
            id: userId,
            given_name: "UpdatedFirst"
        });

        // Update only last name
        await executeNamedQuery("update_user", {
            id: userId,
            family_name: "UpdatedLast"
        });

        // Update only preferences
        await executeNamedQuery("update_user", {
            id: userId,
            preferences: JSON.stringify({ theme: "dark", notifications: true })
        });

        // Verify all updates were applied
        const getResults = await executeNamedQuery("get_profile", { id: userId });
        expect(getResults.length).toBe(1);
        expect(getResults[0].given_name).toBe("UpdatedFirst");
        expect(getResults[0].family_name).toBe("UpdatedLast");
        expect(JSON.parse(getResults[0].preferences)).toEqual({ theme: "dark", notifications: true });

        // Clean up
        await executeNamedQuery("delete_user", { id: userId });
    });

    test("error handling for non-existent query", async () => {
        try {
            await executeNamedQuery("non_existent_query");
            // If no error is thrown, fail the test
            expect(true).toBe(false);
        } catch (error) {
            expect(error.message).toContain("not found");
        }
    });
});

// HTTP API tests
describe("API", () => {
    test("Get all users", async () => {
        const response = await fetch(`${BASE_URL}${API_PATH}get_users`);
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test("Get user profile by ID", async () => {
        const response = await fetch(`${BASE_URL}${API_PATH}get_profile?id=1`);
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0].id).toBe(1);
    });

    test("Full CRUD operations using direct SQL query paths", async () => {
        // Create user
        const testEmail = `api-test-${Date.now()}@example.com`;
        const createResponse = await fetch(`${BASE_URL}${API_PATH}create_user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: testEmail,
                password: "api_test_password",
                given_name: "API",
                family_name: "Test",
                permission: "user"
            })
        });

        expect(createResponse.status).toBe(200);
        const createData = await createResponse.json();
        expect(createData[0].email).toBe(testEmail);

        const userId = createData[0].id;

        // Update user
        const updateResponse = await fetch(`${BASE_URL}${API_PATH}update_user`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: userId,
                given_name: "Updated"
            })
        });

        expect(updateResponse.status).toBe(200);

        // Delete user
        const deleteResponse = await fetch(`${BASE_URL}${API_PATH}delete_user?id=${userId}`, {
            method: "DELETE"
        });

        expect(deleteResponse.status).toBe(200);
    });

    test("Support different HTTP methods for parameter extraction", async () => {
        // POST with JSON body
        const createResponse = await fetch(`${BASE_URL}${API_PATH}create_user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: `method-test-${Date.now()}@example.com`,
                password: "method_test_password",
                given_name: "Method",
                family_name: "Test"
            })
        });

        expect(createResponse.status).toBe(200);
        const userData = await createResponse.json();
        const userId = userData[0].id;

        // Clean up
        await fetch(`${BASE_URL}${API_PATH}delete_user?id=${userId}`, {
            method: "DELETE"
        });
    });

    test("Handle update of non-existent user", async () => {
        const updateResponse = await fetch(`${BASE_URL}${API_PATH}update_user`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: 9999,
                given_name: "Should Not Update"
            })
        });

        expect(updateResponse.status).toBe(200);
        const data = await updateResponse.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(0);
    });

    test("Handle delete of non-existent user", async () => {
        const deleteResponse = await fetch(`${BASE_URL}${API_PATH}delete_user?id=9999`, {
            method: "DELETE"
        });

        expect(deleteResponse.status).toBe(200);
    });

    test("Handle non-existent query", async () => {
        const response = await fetch(`${BASE_URL}${API_PATH}non_existent_query`);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBeDefined();
    });

    test("Handle invalid parameters", async () => {
        const response = await fetch(`${BASE_URL}${API_PATH}get_profile?id=9999`);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(0);
    });
}); 