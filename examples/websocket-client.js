#!/usr/bin/env bun

/**
 * Example WebSocket client for Derby JSON-RPC API
 * 
 * To run: bun examples/websocket-client.js
 */

// Simple WebSocket client for Node.js/Bun
class DerbyClient {
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.id = 1;
        this.callbacks = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`Connecting to ${this.url}...`);
                this.socket = new WebSocket(this.url);

                this.socket.onopen = () => {
                    console.log(`Connected to ${this.url}`);
                    resolve();
                };

                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };

                this.socket.onclose = () => {
                    console.log('Connection closed');
                };

                this.socket.onmessage = (event) => {
                    try {
                        console.log(`Received data: ${event.data}`);
                        const response = JSON.parse(event.data);

                        // Check if we have a callback for this id
                        if (response.id && this.callbacks.has(response.id)) {
                            const { resolve, reject } = this.callbacks.get(response.id);

                            if (response.error) {
                                reject(response.error);
                            } else {
                                resolve(response.result);
                            }

                            // Remove the callback
                            this.callbacks.delete(response.id);
                        } else {
                            // No callback found (notification or unknown id)
                            console.log('Received message without callback:', response);
                        }
                    } catch (error) {
                        console.error('Error processing message:', error);
                    }
                };
            } catch (error) {
                console.error('Connection error:', error);
                reject(error);
            }
        });
    }

    async call(method, params) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket is not connected'));
                return;
            }

            const id = this.id++;

            // Store callback
            this.callbacks.set(id, { resolve, reject });

            // Send JSON-RPC request
            const request = {
                jsonrpc: '2.0',
                method,
                params,
                id
            };

            console.log(`Sending request:`, request);
            const jsonString = JSON.stringify(request);
            console.log(`Sending raw data: ${jsonString}`);
            this.socket.send(jsonString);
        });
    }

    close() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

async function main() {
    // Create client
    const client = new DerbyClient('ws://localhost:3001');

    try {
        // Connect to server
        await client.connect();

        // Call the custom 'hello' method defined in the example server
        console.log("Calling 'hello' method...");
        const helloResult = await client.call('hello', { name: 'Derby User' });
        console.log('\nHello method result:', helloResult);

        // Try to call the built-in 'sql' method (if SQL files are set up)
        try {
            console.log("\nCalling 'sql' method...");
            const users = await client.call('sql', {
                name: 'get_users',
                parameters: { limit: 10, offset: 0 }
            });
            console.log('\nUsers query result:', users);
        } catch (error) {
            console.log('\nError calling sql method:', error);
            console.log('(This is expected if you don\'t have the SQL files set up yet)');
        }

        // Test with an invalid method
        try {
            console.log("\nCalling non-existent method...");
            await client.call('non_existent_method', {});
        } catch (error) {
            console.log('\nExpected error for non-existent method:', error);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Close the connection
        console.log('\nClosing connection...');
        client.close();
    }
}

// Run the client if executed directly
if (process.argv[1] === import.meta.url) {
    main().catch(console.error);
} 