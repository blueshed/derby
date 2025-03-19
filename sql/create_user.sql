INSERT INTO users (
    email,
    password,
    given_name,
    family_name,
    permission,
    preferences
) VALUES (
    $email,
    $password,
    $given_name,
    $family_name,
    $permission,
    COALESCE($preferences, '{}')
)
RETURNING id, email, given_name, family_name, permission, preferences; 