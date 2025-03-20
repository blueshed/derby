# Derby

A lightweight web application framework for Bun with a SQL-first approach and JSON-RPC over WebSockets.

## Features

- **SQL-First Approach**: Define your API by writing SQL queries in `.sql` files
- **JSON-RPC 2.0 WebSockets**: Standardized communication protocol with proper error handling
- **HTTP API**: RESTful endpoints for traditional web applications
- **Static File Serving**: Serve your SPA or static website
- **Multiple Database Support**: SQLite (built-in) and PostgreSQL (adapter provided)
- **Simple Configuration**: Environment variables or programmatic configuration
- **Zero Dependencies**: Built on Bun's native capabilities

## Installation

```bash
bun add derby
```

## Quick Start

### 1. Create a basic server

```javascript
// server.js
import derby from 'derby';

// Create and start the server with default configuration
const server = await derby();
server.start();
```

### 2. Create SQL queries

```sql
-- sql/get_users.sql
SELECT id, name, email FROM users
WHERE name LIKE '%' || :search || '%'
LIMIT :limit;
```

### 3. Access via HTTP

```bash
curl "http://localhost:3000/api/get_users?search=john&limit=10"
```

### 4. Access via WebSocket (JSON-RPC 2.0)

```javascript
// client.js
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  // JSON-RPC 2.0 request
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'sql',
    params: {
      name: 'get_users',
      parameters: { search: 'john', limit: 10 }
    },
    id: 1
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log(response.result); // Array of users
};
```

## Configuration

Derby can be configured using environment variables or by passing a configuration object:

```javascript
import derby from 'derby';

const server = await derby({
  port: 8080,
  database: {
    type: 'sqlite',
    connectionString: 'file:myapp.db',
    sqlPath: './queries',
    logSql: true
  },
  staticDir: './public',
  apiPath: '/api',
  cors: {
    enabled: true,
    origin: '*'
  }
});

server.start();
```

## Custom WebSocket Methods

You can add custom WebSocket methods to handle specific functionality:

```javascript
import derby, { createServer } from 'derby';

const server = await createServer({
  websocket: {
    methods: {
      'echo': async (params) => {
        return params; // Echo back the parameters
      },
      'add': async (params) => {
        const { a, b } = params;
        if (typeof a !== 'number' || typeof b !== 'number') {
          throw { code: -32602, message: 'Invalid parameters: numbers required' };
        }
        return a + b;
      }
    }
  }
});

server.start();
```

## JSON-RPC 2.0 WebSocket API

Derby implements the [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification) over WebSockets:

### Request format

```javascript
{
  "jsonrpc": "2.0",
  "method": "sql",
  "params": {
    "name": "get_users",
    "parameters": { "search": "john", "limit": 10 }
  },
  "id": 1
}
```

### Response format

```javascript
{
  "jsonrpc": "2.0",
  "result": [
    { "id": 1, "name": "John Doe", "email": "john@example.com" },
    { "id": 2, "name": "Johnny Smith", "email": "johnny@example.com" }
  ],
  "id": 1
}
```

### Error response

```javascript
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found"
  },
  "id": 1
}
```

## Error Codes

Derby follows the JSON-RPC 2.0 standard error codes:

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON was received |
| -32600 | Invalid Request | The JSON sent is not a valid Request object |
| -32601 | Method not found | The method does not exist / is not available |
| -32602 | Invalid params | Invalid method parameter(s) |
| -32603 | Internal error | Internal JSON-RPC error |

## Advanced Usage

### Database Transactions

```javascript
import { createServer } from 'derby';

const server = await createServer();
const { db } = server;

// Add a custom WebSocket method that uses a transaction
server.websocketHandler.registerMethod('createUser', async (params) => {
  return await db.transaction(async () => {
    // Execute multiple queries in a transaction
    const user = await db.executeQuery(
      'INSERT INTO users (name, email) VALUES (:name, :email) RETURNING id',
      { name: params.name, email: params.email }
    );
    
    await db.executeQuery(
      'INSERT INTO profiles (user_id, bio) VALUES (:userId, :bio)',
      { userId: user[0].id, bio: params.bio || '' }
    );
    
    return user[0];
  });
});

server.start();
```

### Custom Database Adapter

```javascript
import { createServer, createBaseAdapter } from 'derby';

// Create a custom database adapter
function createMyDbAdapter(connectionString) {
  const baseAdapter = createBaseAdapter();
  
  return {
    ...baseAdapter,
    
    async init() {
      // Initialize your database connection
      console.log('Custom DB adapter initialized');
      this.isInitialized = true;
    },
    
    async executeQuery(sql, params) {
      // Implement query execution logic
      console.log(`Executing query: ${sql}`);
      console.log('Parameters:', params);
      
      // Return mock data for demonstration
      return [{ id: 1, name: 'Test User' }];
    }
  };
}

// Use custom adapter
const server = await createServer({
  database: {
    // Use a factory function that creates your custom adapter
    adapter: () => createMyDbAdapter('custom://connection')
  }
});

server.start();
```

## Advanced Configuration

### SQL Caching

By default, Derby loads SQL queries directly from disk on each execution, which ensures changes to SQL files are immediately reflected without server restarts during development.

For production environments, you can enable SQL caching for better performance:

```javascript
// Enable SQL caching for performance in production
const server = await derby({
  database: {
    // ... other database options
    disableCache: false // Enable SQL caching
  }
});
```

You can also configure this through the `DB_CACHE_ENABLED` environment variable:

```bash
# For production
DB_CACHE_ENABLED=true bun run server.js
```

## License

MIT

## Examples

Derby comes with several examples to help you get started:

### Minimal Example

A self-contained example that demonstrates the basics of Derby including WebSocket JSON-RPC:

```bash
bun run examples/minimal.js
```

### Basic Server

A more comprehensive example showing how to configure and run a Derby server:

```bash
bun run examples/basic-server.js
```

### WebSocket Client

A standalone WebSocket client for testing JSON-RPC functionality:

```bash
bun run examples/websocket-client.js
```

### SQL Examples

SQL query examples are included in `examples/sql/` directory.

You can create your own SQL queries in this directory and they will be automatically loaded by the example server. 