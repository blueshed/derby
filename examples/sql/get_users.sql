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
LIMIT  COALESCE(:limit, 10)
OFFSET COALESCE(:offset, 0); 