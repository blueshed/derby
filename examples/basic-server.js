import derby from '../src/index.js';

/**
 * Basic Derby server example
 */
async function main() {
    try {
        // Get port from environment variable or use default
        const port = parseInt(process.env.PORT || "3001", 10);

        // Create a Derby server with custom configuration
        const server = await derby({
            port: port,
            database: {
                type: 'sqlite',
                connectionString: 'file:derby-example.db',
                sqlPath: './examples/sql',
                logSql: true
            },
            staticDir: './examples/public',
            cors: {
                enabled: true
            },
            websocket: {
                methods: {
                    // Custom WebSocket method
                    'hello': async (params) => {
                        const name = params?.name || 'World';
                        return { message: `Hello, ${name}!`, timestamp: new Date().toISOString() };
                    }
                }
            }
        });

        // Start the server
        server.start();

        console.log('\nTry these endpoints:');
        console.log(`- HTTP API: http://localhost:${port}/api/get_users`);
        console.log(`- Static files: http://localhost:${port}/`);
        console.log(`- WebSocket: ws://localhost:${port} (use the client in examples/websocket-client.js)\n`);

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
        console.error('Error starting server:', error);
        process.exit(1);
    }
}

// Run the server
main(); 