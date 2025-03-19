-- Migration: Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    given_name TEXT,
    family_name TEXT,
    permission TEXT DEFAULT 'user',
    preferences TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert sample data if table is empty
INSERT INTO users (email, password, given_name, family_name, permission)
SELECT 'admin@example.com', 'admin_password', 'Admin', 'User', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com');

INSERT INTO users (email, password, given_name, family_name)
SELECT 'user@example.com', 'user_password', 'Test', 'User'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'user@example.com'); 