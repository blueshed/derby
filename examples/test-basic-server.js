#!/usr/bin/env bun

import { spawn } from "child_process";
import { resolve } from "path";

/**
 * Simple test script for basic-server.js
 * - Starts the server
 * - Tests basic endpoints
 * - Shuts down the server
 */
async function main() {
    // Server process
    let serverProcess = null;

    try {
        console.log("====================================");
        console.log("Starting server test");
        console.log("====================================");

        // Start the server
        console.log("Starting the server...");
        serverProcess = spawn("bun", ["run", resolve("examples/basic-server.js")], {
            stdio: "inherit",
            env: {
                ...process.env,
                PORT: "3999" // Use a different port
            }
        });

        // Wait for server to start
        console.log("Waiting for server to start...");
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test HTTP endpoint
        console.log("\nTesting HTTP API...");
        try {
            const response = await fetch("http://localhost:3999/api/get_users?limit=5&offset=0");
            const data = await response.json();
            console.log("HTTP API Response:", data);

            if (response.ok) {
                console.log("✅ HTTP API test passed");
            } else {
                console.log("❌ HTTP API test failed");
            }
        } catch (error) {
            console.error("❌ HTTP API test failed:", error.message);
        }

        // Test WebSocket
        console.log("\nTesting WebSocket API...");
        try {
            const ws = new WebSocket("ws://localhost:3999");

            // Wait for connection
            await new Promise((resolve, reject) => {
                ws.onopen = resolve;
                ws.onerror = reject;

                // Add timeout
                setTimeout(() => reject(new Error("WebSocket connection timeout")), 3000);
            });

            // Send test request
            const requestId = Date.now();
            ws.send(JSON.stringify({
                jsonrpc: "2.0",
                method: "hello",
                params: { name: "Tester" },
                id: requestId
            }));

            // Wait for response
            const result = await new Promise((resolve, reject) => {
                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.id === requestId) {
                            resolve(data);
                        }
                    } catch (error) {
                        reject(error);
                    }
                };

                // Add timeout
                setTimeout(() => reject(new Error("WebSocket response timeout")), 3000);
            });

            console.log("WebSocket API Response:", result);
            console.log("✅ WebSocket API test passed");

            // Close WebSocket
            ws.close();
        } catch (error) {
            console.error("❌ WebSocket API test failed:", error.message);
        }

        console.log("\n====================================");
        console.log("Test summary");
        console.log("====================================");
        console.log("Server started successfully!");

    } catch (error) {
        console.error("Test error:", error);
    } finally {
        // Shutdown server
        console.log("\nShutting down server...");
        if (serverProcess) {
            serverProcess.kill();
        }
    }
}

// Run the test
main().catch(console.error); 