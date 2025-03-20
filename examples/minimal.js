#!/usr/bin/env bun

import { createServer } from '../src/core/server.js';
import { mergeConfig } from '../src/core/config.js';

/**
 * Minimal Derby server and client test
 */
async function main() {
    try {
        console.log("Starting Derby minimal example...");

        // Configure server with minimal options
        const config = mergeConfig({
            port: 3001,
            database: {
                type: 'sqlite',
                connectionString: ':memory:'
            },
            websocket: {
                methods: {
                    // Echo method returns parameters unchanged
                    'echo': async (params) => {
                        console.log("Echo method called with:", params);
                        return params;
                    },

                    // Hello method with name parameter
                    'hello': async (params) => {
                        const name = params?.name || 'World';
                        console.log(`Hello method called with name: ${name}`);
                        return {
                            message: `Hello, ${name}!`,
                            timestamp: new Date().toISOString()
                        };
                    }
                }
            }
        });

        // Create server
        console.log("Creating server...");
        const server = await createServer(config);

        // Start server
        console.log("Starting server...");
        server.start();
        console.log(`Server started on port ${config.port}`);

        // Create WebSocket client and test functions
        console.log("\n--- TESTING WEBSOCKET CLIENT ---");

        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // Connect to WebSocket
        console.log("Connecting to WebSocket...");
        const ws = new WebSocket(`ws://localhost:${config.port}`);

        // Setup logging
        ws.onopen = () => {
            console.log("WebSocket connection opened");

            // Test echo method
            console.log("Testing echo method...");
            const request1 = {
                jsonrpc: "2.0",
                method: "echo",
                params: { test: "value", number: 42 },
                id: 1
            };
            ws.send(JSON.stringify(request1));

            // Test hello method
            setTimeout(() => {
                console.log("Testing hello method...");
                const request2 = {
                    jsonrpc: "2.0",
                    method: "hello",
                    params: { name: "Derby Tester" },
                    id: 2
                };
                ws.send(JSON.stringify(request2));
            }, 500);

            // Test non-existent method
            setTimeout(() => {
                console.log("Testing non-existent method...");
                const request3 = {
                    jsonrpc: "2.0",
                    method: "non_existent",
                    params: {},
                    id: 3
                };
                ws.send(JSON.stringify(request3));
            }, 1000);

            // Close after tests
            setTimeout(() => {
                console.log("Closing WebSocket connection...");
                ws.close();
            }, 1500);

            // Shutdown server after tests
            setTimeout(() => {
                console.log("Shutting down server...");
                server.stop();
                console.log("Server stopped");
                process.exit(0);
            }, 2000);
        };

        ws.onmessage = (event) => {
            console.log(`Received message: ${event.data}`);
            try {
                const data = JSON.parse(event.data);
                if (data.error) {
                    console.log(`Error response (ID ${data.id}):`, data.error);
                } else {
                    console.log(`Success response (ID ${data.id}):`, data.result);
                }
            } catch (error) {
                console.error("Error parsing message:", error);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
            console.log("WebSocket connection closed");
        };

    } catch (error) {
        console.error("Example error:", error);
        process.exit(1);
    }
}

// Run the example
main().catch(console.error); 