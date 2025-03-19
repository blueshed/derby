import { test, expect, beforeAll, afterAll } from "bun:test";

// Centralized WebSocket connection and message tracking
let ws;
const responses = new Map();
let connectionMessage;

// Use environment variable for port with fallback to 3000
const PORT = process.env.HTTP_PORT || 3000;

beforeAll(() => {
    return new Promise((resolve) => {
        console.log("Connecting to WebSocket server...");
        ws = new WebSocket(`ws://localhost:${PORT}`);

        ws.onopen = () => {
            console.log("WebSocket connection established");
            resolve();
        };

        ws.onmessage = (event) => {
            const response = JSON.parse(event.data);

            if (response.type === "connection") {
                connectionMessage = response;
            } else if (response.requestId) {
                responses.set(response.requestId, response);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    });
});

afterAll(() => {
    return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.onclose = () => {
                console.log("WebSocket connection closed");
                resolve();
            };
            ws.close();
        } else {
            resolve();
        }
    });
});

test("WebSocket should establish connection", () => {
    expect(connectionMessage).toBeDefined();
    expect(connectionMessage.type).toBe("connection");
    expect(connectionMessage.message).toContain("Connected to Derby SQL WebSocket API");
});

test("WebSocket should retrieve users", async () => {
    const requestId = sendQuery("get_users");

    // Wait for response
    const response = await waitForResponse(requestId);

    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThan(0);

    // Check if first user has expected properties
    const firstUser = response.data[0];
    expect(firstUser).toHaveProperty("id");
    expect(firstUser).toHaveProperty("email");
});

test("WebSocket should retrieve a profile with parameters", async () => {
    const requestId = sendQuery("get_profile", { id: 1 });

    // Wait for response
    const response = await waitForResponse(requestId);

    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBe(1);

    const profile = response.data[0];
    expect(profile).toHaveProperty("id", 1);
    expect(profile).toHaveProperty("email");
});

test("WebSocket should handle non-existent queries", async () => {
    const requestId = sendQuery("non_existent_query");

    // Wait for response
    const response = await waitForResponse(requestId);

    expect(response.success).toBe(false);
    expect(response.error).toContain("Query not found");
    expect(response.status).toBe(404);
});

function sendQuery(queryName, params = {}) {
    const requestId = `test-${queryName}-${Date.now()}`;
    const request = {
        queryName,
        params,
        requestId
    };

    console.log(`Sending ${queryName} query with requestId: ${requestId}`);
    ws.send(JSON.stringify(request));
    return requestId;
}

// Helper function to wait for a specific response
async function waitForResponse(requestId, timeout = 2000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        if (responses.has(requestId)) {
            return responses.get(requestId);
        }

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error(`Timeout waiting for response to ${requestId}`);
} 