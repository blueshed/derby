import { test, expect, beforeAll, afterAll } from "bun:test";
import { executeNamedQuery } from "../db";

// Test direct database access
test("Database - executeNamedQuery with get_users", async () => {
    const result = await executeNamedQuery("get_users");
    expect(Array.isArray(result)).toBe(true);

    // Assuming there's at least one user in the database
    if (result.length > 0) {
        const user = result[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("email");
    }
});

test("Database - executeNamedQuery with get_profile and params", async () => {
    // Test with ID 1 (assuming it exists)
    const result = await executeNamedQuery("get_profile", { id: 1 });
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
        const profile = result[0];
        expect(profile).toHaveProperty("id", 1);
        expect(profile).toHaveProperty("email");
        expect(profile).toHaveProperty("given_name");
    }
});

test("Database - create_user, update_user, and delete_user", async () => {
    // Step 1: Create a new user
    const testEmail = `test-${Date.now()}@example.com`;
    const newUser = {
        email: testEmail,
        password: "test_password",
        given_name: "Test",
        family_name: "User",
        permission: "user",
        preferences: JSON.stringify({ theme: "dark" })
    };

    // Create the user
    const createResult = await executeNamedQuery("create_user", newUser);
    expect(Array.isArray(createResult)).toBe(true);
    expect(createResult.length).toBe(1);

    const createdUser = createResult[0];
    expect(createdUser).toHaveProperty("id");
    expect(createdUser.email).toBe(testEmail);
    expect(createdUser.given_name).toBe("Test");
    expect(createdUser.family_name).toBe("User");

    const userId = createdUser.id;

    // Step 2: Update the user
    const updatedName = "Updated";
    const updatedPreferences = JSON.stringify({ theme: "light", notifications: true });

    const updateResult = await executeNamedQuery("update_user", {
        id: userId,
        given_name: updatedName,
        preferences: updatedPreferences
    });

    expect(Array.isArray(updateResult)).toBe(true);
    expect(updateResult.length).toBe(1);
    expect(updateResult[0].id).toBe(userId);
    expect(updateResult[0].given_name).toBe(updatedName);
    expect(updateResult[0].family_name).toBe("User"); // Unchanged

    // Step 3: Verify update with get_profile
    const getResult = await executeNamedQuery("get_profile", { id: userId });
    expect(getResult.length).toBe(1);
    expect(getResult[0].given_name).toBe(updatedName);
    expect(getResult[0].preferences).toBe(updatedPreferences);

    // Step 4: Delete the user
    const deleteResult = await executeNamedQuery("delete_user", { id: userId });
    expect(Array.isArray(deleteResult)).toBe(true);
    expect(deleteResult.length).toBe(1);
    expect(deleteResult[0].id).toBe(userId);

    // Step 5: Verify user has been deleted
    const verifyResult = await executeNamedQuery("get_profile", { id: userId });
    expect(verifyResult.length).toBe(0); // Should return empty array for deleted user
});

test("Database - update_user with non-existent ID", async () => {
    const nonExistentId = 9999; // Assuming this ID doesn't exist

    // Try to update non-existent user
    const updateResult = await executeNamedQuery("update_user", {
        id: nonExistentId,
        given_name: "Should Not Update"
    });

    // Should return empty array when no rows affected
    expect(Array.isArray(updateResult)).toBe(true);
    expect(updateResult.length).toBe(0);
});

test("Database - delete_user with non-existent ID", async () => {
    const nonExistentId = 9999; // Assuming this ID doesn't exist

    // Try to delete non-existent user
    const deleteResult = await executeNamedQuery("delete_user", {
        id: nonExistentId
    });

    // Should return empty array when no rows affected
    expect(Array.isArray(deleteResult)).toBe(true);
    expect(deleteResult.length).toBe(0);
});

test("Database - partial updates with different fields", async () => {
    // Create a test user
    const testEmail = `partial-update-${Date.now()}@example.com`;
    const newUser = {
        email: testEmail,
        password: "password123",
        given_name: "Partial",
        family_name: "Update",
        permission: "user",
        preferences: JSON.stringify({ notifications: false })
    };

    // Create the user
    const createResult = await executeNamedQuery("create_user", newUser);
    const userId = createResult[0].id;

    // Test 1: Update only given_name
    const updateNameResult = await executeNamedQuery("update_user", {
        id: userId,
        given_name: "UpdatedFirst"
    });
    expect(updateNameResult[0].given_name).toBe("UpdatedFirst");
    expect(updateNameResult[0].family_name).toBe("Update"); // Unchanged

    // Test 2: Update only family_name
    const updateFamilyResult = await executeNamedQuery("update_user", {
        id: userId,
        family_name: "UpdatedLast"
    });
    expect(updateFamilyResult[0].given_name).toBe("UpdatedFirst"); // Still has previous update
    expect(updateFamilyResult[0].family_name).toBe("UpdatedLast");

    // Test 3: Update preferences
    const newPrefs = JSON.stringify({ theme: "dark", notifications: true });
    const updatePrefsResult = await executeNamedQuery("update_user", {
        id: userId,
        preferences: newPrefs
    });
    expect(updatePrefsResult[0].preferences).toBe(newPrefs);
    expect(updatePrefsResult[0].given_name).toBe("UpdatedFirst"); // Unchanged

    // Clean up
    await executeNamedQuery("delete_user", { id: userId });
});

test("Database - error handling for non-existent query", async () => {
    try {
        await executeNamedQuery("non_existent_query");
        // If we reach here, the test failed
        expect(false).toBe(true);
    } catch (error) {
        expect(error.message).toContain("Query not found");
    }
});

// Test API endpoints
let server;

beforeAll(() => {
    // Start server for API tests - import dynamically to avoid port conflicts
    server = Bun.spawn(["bun", "index.js"], {
        stdout: "pipe",
        stderr: "pipe",
    });

    // Give the server a moment to start
    return new Promise(resolve => setTimeout(resolve, 500));
});

afterAll(() => {
    // Shut down server after tests
    server?.kill();
});

test("API - Get all users", async () => {
    const response = await fetch("http://localhost:3000/api/get_users");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);

    if (data.length > 0) {
        expect(data[0]).toHaveProperty("id");
        expect(data[0]).toHaveProperty("email");
    }
});

test("API - Get user profile by ID", async () => {
    const response = await fetch("http://localhost:3000/api/get_profile?id=1");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);

    if (data.length > 0) {
        expect(data[0]).toHaveProperty("id", 1);
        expect(data[0]).toHaveProperty("email");
    }
});

test("API - Full CRUD operations using direct SQL query paths", async () => {
    // Step 1: Create a new user with POST to create_user
    const testEmail = `api-test-${Date.now()}@example.com`;
    const userData = new URLSearchParams({
        email: testEmail,
        password: "api_test_password",
        given_name: "API",
        family_name: "Test",
        permission: "user",
        preferences: JSON.stringify({ notifications: true })
    });

    const createResponse = await fetch("http://localhost:3000/api/create_user", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: userData
    });

    expect(createResponse.status).toBe(200);

    const createData = await createResponse.json();
    expect(Array.isArray(createData)).toBe(true);
    expect(createData.length).toBe(1);

    const createdUser = createData[0];
    expect(createdUser).toHaveProperty("id");
    expect(createdUser.email).toBe(testEmail);

    const userId = createdUser.id;

    // Step 2: Update the user with POST to update_user
    const updateData = new URLSearchParams({
        id: userId,
        given_name: "Updated",
        preferences: JSON.stringify({ theme: "system" })
    });

    const updateResponse = await fetch("http://localhost:3000/api/update_user", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: updateData
    });

    expect(updateResponse.status).toBe(200);

    const updateResult = await updateResponse.json();
    expect(Array.isArray(updateResult)).toBe(true);
    expect(updateResult.length).toBe(1);
    expect(updateResult[0].given_name).toBe("Updated");

    // Step 3: Delete the user with DELETE to delete_user
    const deleteResponse = await fetch(`http://localhost:3000/api/delete_user?id=${userId}`, {
        method: "DELETE"
    });

    expect(deleteResponse.status).toBe(200);

    const deleteResult = await deleteResponse.json();
    expect(Array.isArray(deleteResult)).toBe(true);
    expect(deleteResult.length).toBe(1);
    expect(deleteResult[0].id).toBe(userId);

    // Step 4: Verify deletion
    const verifyResponse = await fetch(`http://localhost:3000/api/get_profile?id=${userId}`);
    expect(verifyResponse.status).toBe(200);

    const verifyData = await verifyResponse.json();
    expect(Array.isArray(verifyData)).toBe(true);
    expect(verifyData.length).toBe(0); // Should be empty for deleted user
});

test("API - Support different HTTP methods for parameter extraction", async () => {
    // Create a user with JSON body via POST
    const testEmail = `method-test-${Date.now()}@example.com`;
    const userData = {
        email: testEmail,
        password: "json_test_password",
        given_name: "Method",
        family_name: "Test",
        permission: "user",
        preferences: JSON.stringify({ theme: "dark" })
    };

    const createResponse = await fetch("http://localhost:3000/api/create_user", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(userData)
    });

    expect(createResponse.status).toBe(200);

    const user = (await createResponse.json())[0];
    const userId = user.id;

    // Clean up
    await fetch(`http://localhost:3000/api/delete_user?id=${userId}`, {
        method: "DELETE"
    });
});

test("API - Handle update of non-existent user", async () => {
    const nonExistentId = 9999; // Assuming this ID doesn't exist

    const updateData = new URLSearchParams({
        id: nonExistentId,
        given_name: "Should Not Update"
    });

    const response = await fetch("http://localhost:3000/api/update_user", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: updateData
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0); // Should return empty array
});

test("API - Handle delete of non-existent user", async () => {
    const nonExistentId = 9999; // Assuming this ID doesn't exist

    const response = await fetch(`http://localhost:3000/api/delete_user?id=${nonExistentId}`, {
        method: "DELETE"
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0); // Should return empty array
});

test("API - Handle non-existent query", async () => {
    const response = await fetch("http://localhost:3000/api/non_existent_query");
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("Query not found");
});

test("API - Handle invalid parameters", async () => {
    // Test with a non-existent ID
    const response = await fetch("http://localhost:3000/api/get_profile?id=9999");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0); // Should return an empty array
}); 