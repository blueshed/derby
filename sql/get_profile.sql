select
    id,
    email,
    given_name,
    family_name,
    permission,
    preferences
from
    users
where
    id = $id;
