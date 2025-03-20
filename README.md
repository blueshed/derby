# Derby - SQL Query API Server

A lightweight SQL query execution engine over HTTP and WebSocket interfaces.

## Overview

Derby provides a simple way to expose SQL queries as API endpoints. It automatically maps:
- URL paths to SQL files (e.g., `/api/get_users` → `sql/get_users.sql`)
- Request parameters to SQL query parameters

## Features

- **HTTP API** - Execute SQL queries via HTTP requests
- **JSON-RPC WebSocket API** - Execute SQL queries via standardized JSON-RPC 2.0 protocol
- **Parameter Handling** - Extracts parameters from query string, JSON body, or form data
- **Modular Design** - Cleanly separated components for database, API, and servers
- **Environment Configuration** - Configurable database connection, port, and SQL directory
- **Unified Server** - HTTP and WebSocket services run on the same port
- **Database Adapters** - Support for multiple database types via the same API
- **Customizable Query Lifecycle** - Hooks for file loading, SQL transformation, and result processing
- **Automatic Migrations** - File-based migration system with sequential execution
- **Static File Serving** - Integrated static file server for Single Page Applications (SPAs)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd derby

# Install dependencies
bun install
```

### Usage

```bash
# Start the server
bun run start

# Or start with custom configuration
HTTP_PORT=4000 DATABASE_URL="postgres://user:pass@localhost:5432/derby" SQL_DIR="./queries" STATIC_DIR="./public" bun run start
```

This starts:
- Combined HTTP & WebSocket server on the configured port (default: 3000)
- Serves static files from the configured directory (default: ./client/dist)

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection URL in SQLAlchemy-like format | `sqlite:///./derby.sqlite` |
| `HTTP_PORT` | Port to run the HTTP and WebSocket server on | `3000` |
| `SQL_DIR` | Directory containing SQL query and migration files | `sql` |
| `STATIC_DIR` | Directory containing static files for serving | `./client/dist` |

### Supported Database URLs

- **SQLite**: `sqlite:///./path/to/database.sqlite`
- **PostgreSQL**: `postgres://username:password@hostname:port/database`

## API Usage

### HTTP API

```bash
# GET request with parameters
curl "http://localhost:3000/api/get_profile?id=1"

# POST request with JSON body
curl -X POST "http://localhost:3000/api/create_user" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password","given_name":"Test","family_name":"User"}'

# DELETE request
curl -X DELETE "http://localhost:3000/api/delete_user?id=123"
```

### WebSocket API (JSON-RPC 2.0)

```javascript
// Connect to WebSocket server (use the same port as HTTP)
const ws = new WebSocket("ws://localhost:3000");

// Listen for messages
ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log(response);
};

// Send a query using JSON-RPC 2.0
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  method: "query",
  params: {
    name: "get_users",
    parameters: {}
  },
  id: "request-1"
}));

// Send a query with parameters
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  method: "query",
  params: {
    name: "get_profile", 
    parameters: { id: 1 }
  },
  id: "request-2"
}));
```

#### JSON-RPC Response Format

Successful response:
```json
{
  "jsonrpc": "2.0",
  "result": [...], // Query results
  "id": "request-1"
}
```

Error response:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601, // Standard JSON-RPC error code
    "message": "Method not found"
  },
  "id": "request-1"
}
```

### JSON-RPC Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid request | Request does not follow JSON-RPC 2.0 specification |
| -32601 | Method not found | Requested method/query does not exist |
| -32602 | Invalid params | Required parameters missing or incorrect |
| -32603 | Internal error | Server error during execution |

## Static File Serving

Derby can serve static files from a configurable directory, making it perfect for hosting Single Page Applications (SPAs) alongside your API.

### Features

- **SPA Support** - Serves `index.html` for client-side routing paths
- **Directory Traversal Protection** - Prevents access to files outside the static directory
- **Configurable Root** - Set the static directory with the `STATIC_DIR` environment variable
- **API Coexistence** - API paths take precedence over static files

### Usage with a Vue/React/Angular App

1. Build your frontend app:
   ```bash
   # Example with a Vue app
   cd client
   npm run build  # Creates dist/ directory with built files
   ```

2. Start Derby server:
   ```bash
   # It will serve the client/dist directory by default
   bun run start
   ```

3. Access your app at http://localhost:3000

## Project Structure

```
derby/
├── index.js         # Combined HTTP/WebSocket server setup
├── api.js           # Core API handling
├── db/              # Database module
│   ├── index.js     # Main database interface
│   └── adapter.js   # Adapter implementation with lifecycle hooks
├── websocket.js     # WebSocket handler with JSON-RPC implementation
├── sql/             # SQL query files (configurable via SQL_DIR)
│   ├── _0001_create_users.sql   # Migration: Create users table
│   ├── _0002_create_profiles.sql # Migration: Create profiles table
│   ├── get_users.sql
│   ├── get_profile.sql
│   ├── create_user.sql
│   ├── update_user.sql
│   └── delete_user.sql
├── client/          # Frontend application
│   ├── src/         # Source code
│   └── dist/        # Built files (served by default)
└── tests/           # Test files
    ├── http.test.js     # HTTP API tests
    ├── websocket.test.js # WebSocket API tests
    └── test.test.js     # Database tests
```

## Database Migration System

Derby includes an automatic migration system that runs when the server starts:

1. **How It Works**:
   - Any SQL file in the configured SQL directory starting with an underscore (`_`) is considered a migration
   - Migrations run in alphanumeric order (e.g., `_0001_...` before `_0002_...`)
   - Each migration runs once and is tracked in a `_migrations` table
   - Migrations use the same adapter system as regular queries

2. **Creating Migrations**:
   - Name migration files with a prefix for ordering: `_0001_description.sql`
   - Each migration should be idempotent (safe to run multiple times)
   - Use `CREATE TABLE IF NOT EXISTS` and similar constructs
   - Migrations can include schema changes and data seeding

3. **Migration Status**:
   - The system automatically creates a `_migrations` table to track applied migrations
   - When a migration is applied, its filename is recorded to prevent re-running

4. **Custom SQL Directory**:
   - Set the `SQL_DIR` environment variable to use a different location for SQL files
   - All migrations and queries will be loaded from this directory

## Extending the Database Layer

Derby uses a modular database adapter system with customizable hooks:

| Hook | Description | Use Case |
|------|-------------|----------|
| `fileResolver` | Loads SQL content from a source | Change SQL storage location |
| `sqlTransformer` | Modifies SQL before execution | Adapt SQL for different databases |
| `parameterFormatter` | Formats parameters for the db | Handle different parameter syntaxes |
| `resultTransformer` | Processes query results | Normalize or enhance results |

## Testing

```bash
# Run all tests
bun run test

# Run HTTP API tests only
bun run test:http

# Run WebSocket API tests only
bun run test:ws

# Run DB/file tests only
bun run test:db

# Run with isolated test database
bun run test:isolated
```

## License

This project is licensed under the MIT License. 