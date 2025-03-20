-- Migration: Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    website TEXT,
    social_links TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Clear any existing profile data for our test users
DELETE FROM profiles 
WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin@example.com', 'user@example.com'));

-- Get the admin user ID (should be 1, but we'll query to be sure)
INSERT INTO profiles (user_id, bio, website)
SELECT id, 'Administrator account', 'https://example.com/admin'
FROM users WHERE email = 'admin@example.com';

-- Get the regular user ID
INSERT INTO profiles (user_id, bio)
SELECT id, 'Regular user account'
FROM users WHERE email = 'user@example.com'; 