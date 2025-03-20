
            INSERT INTO notes (user_id, title, content)
            VALUES ($user_id, $title, $content)
            RETURNING id, user_id, title, content, created_at
        