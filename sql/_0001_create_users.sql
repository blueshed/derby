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

-- Insert sample data using direct inserts (more reliable than conditional inserts)
-- First delete any existing test users to avoid conflicts
DELETE FROM users WHERE email IN ('admin@example.com', 'user@example.com');

-- Insert admin user
INSERT INTO users (email, password, given_name, family_name, permission)
VALUES ('admin@example.com', 'admin_password', 'Admin', 'User', 'admin');

-- Insert regular user
INSERT INTO users (email, password, given_name, family_name) 
VALUES ('user@example.com', 'user_password', 'Test', 'User');