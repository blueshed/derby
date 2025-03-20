-- Migration: Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert some example data if table is empty
INSERT INTO users (name, email, password_hash)
SELECT 'Admin User', 'admin@example.com', 'hashed_password'
WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);

INSERT INTO users (name, email, password_hash)
SELECT 'John Doe', 'john@example.com', 'hashed_password'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'John Doe');

INSERT INTO users (name, email, password_hash)
SELECT 'Jane Smith', 'jane@example.com', 'hashed_password'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Jane Smith'); 