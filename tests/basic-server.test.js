import { test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import { resolve } from "path";

// Server process
let serverProcess = null;
const PORT = 3999;

// Setup: Start the server before all tests
beforeAll(async () => {
    // Start server with custom port
    serverProcess = spawn("bun", ["examples/basic-server.js"], {
        stdio: "pipe", // Capture output
        env: {
            ...process.env,
            PORT: PORT.toString()
        }
    });

    // Log server output for debugging
    serverProcess.stdout.on("data", (data) => {
        console.log(`Server stdout: ${data}`);
    });

    serverProcess.stderr.on("data", (data) => {
        console.error(`Server stderr: ${data}`);
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
});

// Teardown: Stop the server after all tests
afterAll(() => {
    if (serverProcess) {
        console.log("Shutting down server...");
        serverProcess.kill();
    }
});

// Test HTTP API
test("HTTP API should return user data", async () => {
    const response = await fetch(`http://localhost:${PORT}/api/get_users?limit=5&offset=0`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
});

// Test WebSocket API
test("WebSocket API should handle hello method", async () => {
    // Create WebSocket connection
    const ws = new WebSocket(`ws://localhost:${PORT}`);

    // Wait for connection to open
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        setTimeout(() => reject(new Error("WebSocket connection timeout")), 3000);
    });

    // Test the hello method
    const testName = "Bun Tester";
    const requestId = Date.now();

    // Send request
    ws.send(JSON.stringify({
        jsonrpc: "2.0",
        method: "hello",
        params: { name: testName },
        id: requestId
    }));

    // Wait for response
    const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("WebSocket response timeout"));
        }, 3000);

        ws.onmessage = (event) => {
            clearTimeout(timeout);
            try {
                const data = JSON.parse(event.data);
                if (data.id === requestId) {
                    resolve(data);
                }
            } catch (error) {
                reject(error);
            }
        };
    });

    // Verify response
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(requestId);
    expect(response.result).toBeDefined();
    expect(response.result.message).toBe(`Hello, ${testName}!`);

    // Close connection
    ws.close();
});

// Test non-existent method
test("WebSocket API should handle non-existent method with proper error", async () => {
    // Create WebSocket connection
    const ws = new WebSocket(`ws://localhost:${PORT}`);

    // Wait for connection to open
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        setTimeout(() => reject(new Error("WebSocket connection timeout")), 3000);
    });

    // Test non-existent method
    const requestId = Date.now();

    // Send request
    ws.send(JSON.stringify({
        jsonrpc: "2.0",
        method: "non_existent_method",
        params: {},
        id: requestId
    }));

    // Wait for response
    const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("WebSocket response timeout"));
        }, 3000);

        ws.onmessage = (event) => {
            clearTimeout(timeout);
            try {
                const data = JSON.parse(event.data);
                if (data.id === requestId) {
                    resolve(data);
                }
            } catch (error) {
                reject(error);
            }
        };
    });

    // Verify error response
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(requestId);
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(-32601); // Method not found

    // Close connection
    ws.close();
});

// Test query method via WebSocket
test("WebSocket API should handle sql method", async () => {
    // Create WebSocket connection
    const ws = new WebSocket(`ws://localhost:${PORT}`);

    // Wait for connection to open
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        setTimeout(() => reject(new Error("WebSocket connection timeout")), 3000);
    });

    // Test the sql method
    const requestId = Date.now();

    // Send request for get_users query
    ws.send(JSON.stringify({
        jsonrpc: "2.0",
        method: "sql",
        params: {
            name: "get_users",
            parameters: { limit: 5, offset: 0 }
        },
        id: requestId
    }));

    // Wait for response
    const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("WebSocket response timeout"));
        }, 3000);

        ws.onmessage = (event) => {
            clearTimeout(timeout);
            try {
                const data = JSON.parse(event.data);
                if (data.id === requestId) {
                    resolve(data);
                }
            } catch (error) {
                reject(error);
            }
        };
    });

    // Verify response
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(requestId);
    expect(response.result).toBeDefined();

    // Response should be an array of users
    expect(Array.isArray(response.result)).toBe(true);

    // Close connection
    ws.close();
}); 