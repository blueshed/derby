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

-- Insert sample data if table is empty
INSERT INTO profiles (user_id, bio, website)
SELECT 1, 'Administrator account', 'https://example.com/admin'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = 1);

INSERT INTO profiles (user_id, bio)
SELECT 2, 'Regular user account'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 2)
AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = 2); 