import { createServer } from '../src/index.js';

/**
 * Example server demonstrating Derby with PostgreSQL
 * 
 * Prerequisites:
 * - PostgreSQL server running
 * - Environment variables set or connection string provided
 * 
 * To run with environment variables:
 * PGUSER=yourusername PGPASSWORD=yourpassword PGDATABASE=yourdb bun examples/postgres-server.js
 * 
 * Or set up a .env file with:
 * PGHOST=localhost
 * PGPORT=5432
 * PGUSER=yourusername
 * PGPASSWORD=yourpassword
 * PGDATABASE=yourdb
 */

// Get PostgreSQL connection details from environment variables or use defaults
const PGHOST = process.env.PGHOST || 'localhost';
const PGPORT = process.env.PGPORT || '5432';
const PGUSER = process.env.PGUSER || process.env.PGUSERNAME || 'postgres';
const PGPASSWORD = process.env.PGPASSWORD || '';  // Empty default password for security
const PGDATABASE = process.env.PGDATABASE || 'postgres';
const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING ||
    `postgres://${PGUSER}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT}/${PGDATABASE}`;

async function startServer() {
    console.log('Starting PostgreSQL example server...');
    // Hide password in console for security
    const maskedConnectionString = PG_CONNECTION_STRING.replace(/:[^:]*@/, ':****@');
    console.log(`PostgreSQL connection: ${maskedConnectionString}`);

    // Check if password is empty
    if (!PGPASSWORD && !process.env.PG_CONNECTION_STRING) {
        console.warn('\nWARNING: No PostgreSQL password provided.');
        console.warn('Set the PGPASSWORD environment variable or provide a full connection string.');
        console.warn('Example: PGUSER=yourusername PGPASSWORD=yourpassword bun examples/postgres-server.js\n');
    }

    try {
        // Create server with PostgreSQL database
        const server = await createServer({
            port: 3001,
            database: {
                type: 'postgres',
                connectionString: PG_CONNECTION_STRING,
                logSql: true
            },
            staticDir: './examples/public',
            cors: {
                enabled: true,
                origin: '*'
            }
        });

        // Initialize database with test tables and data
        await setupDatabase(server);

        // Start the server
        server.start();

        console.log('PostgreSQL example server running on http://localhost:3001');
        console.log('WebSocket endpoint available at ws://localhost:3001');
        console.log('API available at http://localhost:3001/api');
        console.log('\nExamples:');
        console.log('- http://localhost:3001/api/get_users');
        console.log('- Try the WebSocket client: bun examples/websocket-client.js');

    } catch (error) {
        console.error('\nFailed to start PostgreSQL example server:');

        // Provide helpful error messages based on error type
        if (error.message && error.message.includes('password authentication failed')) {
            console.error('Authentication error: Invalid username or password');
            console.error('Please check your PostgreSQL credentials and try again.');
            console.error('You can set them using environment variables:');
            console.error('  PGUSER=yourusername PGPASSWORD=yourpassword PGDATABASE=yourdb bun examples/postgres-server.js');
        } else if (error.message && error.message.includes('connect')) {
            console.error('Connection error: Could not connect to PostgreSQL server');
            console.error('Please check if PostgreSQL is running and the connection details are correct:');
            console.error(`  Host: ${PGHOST}`);
            console.error(`  Port: ${PGPORT}`);
            console.error(`  Database: ${PGDATABASE}`);
        } else {
            console.error(error);
        }
    }
}

/**
 * Setup test database with tables and sample data
 */
async function setupDatabase(server) {
    const { db } = server;

    console.log('Setting up test database...');

    try {
        // Create test tables
        await db.executeQuery(`
            -- Drop tables if they exist
            DROP TABLE IF EXISTS notes;
            DROP TABLE IF EXISTS users;
            
            -- Create users table
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Create notes table
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Insert sample data
            INSERT INTO users (name, email) VALUES 
                ('Alice Johnson', 'alice@example.com'),
                ('Bob Smith', 'bob@example.com'),
                ('Charlie Brown', 'charlie@example.com')
            ON CONFLICT (email) DO NOTHING;
            
            -- Insert sample notes
            INSERT INTO notes (user_id, title, content) VALUES 
                (1, 'First Note', 'This is Alice''s first note'),
                (1, 'Shopping List', 'Milk, Bread, Eggs'),
                (2, 'Meeting Notes', 'Discuss project timeline'),
                (3, 'Ideas', 'App feature brainstorming')
            ON CONFLICT DO NOTHING;
        `);

        // Create SQL files directory if it doesn't exist
        const sqlDir = './sql';
        if (!await Bun.file(sqlDir).exists()) {
            await Bun.mkdir(sqlDir);
        }

        // Create sample SQL queries
        await Bun.write(`${sqlDir}/get_users.sql`, `
            SELECT id, name, email, created_at 
            FROM users 
            ORDER BY name
        `);

        await Bun.write(`${sqlDir}/get_user_with_notes.sql`, `
            -- Get user details
            SELECT id, name, email, created_at 
            FROM users 
            WHERE id = $user_id;
            
            -- Get user's notes
            SELECT id, title, content, created_at 
            FROM notes 
            WHERE user_id = $user_id
            ORDER BY created_at DESC
        `);

        await Bun.write(`${sqlDir}/create_note.sql`, `
            INSERT INTO notes (user_id, title, content)
            VALUES ($user_id, $title, $content)
            RETURNING id, user_id, title, content, created_at
        `);

        console.log('Database setup complete.');
    } catch (error) {
        console.error('Error setting up database:', error);
        throw error;
    }
}

startServer(); 