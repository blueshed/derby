#!/usr/bin/env bun
import derby from '../src/index.js';
import { join } from "path";

/**
 * Basic Derby server example
 */
async function main() {
    try {
        // Example server configuration
        const config = {
            port: process.env.PORT || 3001,
            database: {
                type: "sqlite",
                connectionString: "file:" + join(process.cwd(), "derby-example.db"),
                sqlPath: join(process.cwd(), "examples/sql"),
                logSql: true,
                // To enable SQL caching for performance in production:
                // disableCache: false
            },
            staticDir: join(process.cwd(), "examples/public"),
            cors: {
                enabled: true
            },
            websocket: {
                methods: {
                    // Example custom WebSocket method
                    hello: async (params) => {
                        return {
                            message: `Hello, ${params.name || 'World'}!`,
                            timestamp: new Date().toISOString()
                        };
                    }
                }
            }
        };

        // Create and start the server
        console.log("Starting server with configuration:", config);
        const server = await derby(config);
        await server.start();

        console.log(`Server running at http://localhost:${config.port}`);
        console.log(`WebSocket available at ws://localhost:${config.port}`);
        console.log("Press Ctrl+C to stop");

        // Show how to access server components
        console.log('Server components available:');
        console.log('- server.config: Current configuration');
        console.log('- server.db: Database adapter');
        console.log('- server.websocketHandler: WebSocket handler with methods\n');

        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\nShutting down...');
            server.stop();
            process.exit(0);
        });
    } catch (error) {
        console.error("Error starting server:", error);
        process.exit(1);
    }
}

// Run the server
main(); 