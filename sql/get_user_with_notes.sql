
            -- Get user details
            SELECT id, username, email, created_at 
            FROM users 
            WHERE id = $user_id;
            
            -- Get user's notes
            SELECT id, title, content, created_at 
            FROM notes 
            WHERE user_id = $user_id
            ORDER BY created_at DESC
        