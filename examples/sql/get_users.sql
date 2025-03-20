-- Example query to get users from a database
-- Parameters:
--   :limit - Maximum number of users to return (default: 10)
--   :offset - Number of users to skip (default: 0)
--   :search - Optional search term for name

SELECT 
  id,
  name,
  email,
  created_at
FROM 
  users
WHERE 
  (:search IS NULL OR name LIKE '%' || :search || '%')
ORDER BY 
  id ASC
LIMIT 
  CASE 
    WHEN :limit IS NULL THEN 10 
    ELSE :limit 
  END
OFFSET 
  CASE 
    WHEN :offset IS NULL THEN 0 
    ELSE :offset 
  END; 