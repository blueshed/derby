import { test, expect } from "bun:test";

// Use environment variables with fallbacks
const PORT = process.env.HTTP_PORT || 3000;
const API_BASE_URL = `http://localhost:${PORT}/api`;

test("HTTP API should retrieve users", async () => {
    const response = await fetch(`${API_BASE_URL}/get_users`);

    expect(response.status).toBe(200);
    const users = await response.json();

    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);

    // Check first user has expected properties
    const firstUser = users[0];
    expect(firstUser).toHaveProperty("id");
    expect(firstUser).toHaveProperty("email");
});

test("HTTP API should retrieve a profile with parameters", async () => {
    const response = await fetch(`${API_BASE_URL}/get_profile?id=1`);

    expect(response.status).toBe(200);
    const profiles = await response.json();

    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBe(1);

    const profile = profiles[0];
    expect(profile).toHaveProperty("id", 1);
    expect(profile).toHaveProperty("email");
});

test("HTTP API should handle POST requests with JSON body", async () => {
    // Create a unique test user
    const testEmail = `http-test-${Date.now()}@example.com`;
    const userData = {
        email: testEmail,
        password: "test_password",
        given_name: "HTTP",
        family_name: "Test",
        permission: "user",
        preferences: JSON.stringify({ theme: "dark" })
    };

    // Create user
    const createResponse = await fetch(`${API_BASE_URL}/create_user`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(userData)
    });

    expect(createResponse.status).toBe(200);
    const createResult = await createResponse.json();

    expect(Array.isArray(createResult)).toBe(true);
    expect(createResult.length).toBe(1);
    expect(createResult[0].email).toBe(testEmail);

    // Clean up - delete the created user
    const userId = createResult[0].id;
    await fetch(`${API_BASE_URL}/delete_user?id=${userId}`, {
        method: "DELETE"
    });
});

test("HTTP API should handle non-existent queries", async () => {
    const response = await fetch(`${API_BASE_URL}/non_existent_query`);

    expect(response.status).toBe(404);
    const error = await response.json();

    expect(error).toHaveProperty("error");
    expect(error.error).toContain("Query not found");
});

test("HTTP API should handle errors gracefully", async () => {
    // Using a very high ID that shouldn't exist
    const response = await fetch(`${API_BASE_URL}/get_profile?id=99999`);

    expect(response.status).toBe(200);
    const result = await response.json();

    // Should return an empty array when no matching data
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
}); 