UPDATE users
SET
    email = COALESCE($email, email),
    given_name = COALESCE($given_name, given_name),
    family_name = COALESCE($family_name, family_name),
    permission = COALESCE($permission, permission),
    preferences = COALESCE($preferences, preferences),
    updated_at = CURRENT_TIMESTAMP
WHERE
    id = $id
RETURNING id, email, given_name, family_name, permission, preferences; 