import { test, expect, beforeAll, afterAll } from "bun:test";
import { createSqliteAdapter } from "../src/adapters/sqlite.js";
import { join } from "path";
import { mkdir, writeFile, rm } from "fs/promises";

// Test database and SQL paths
const TEST_DB_PATH = "test-derby.db";
const TEST_SQL_DIR = "tests/sql";
const TEST_USER_QUERY = join(TEST_SQL_DIR, "get_users.sql");
let adapter;

// Set up test environment
beforeAll(async () => {
    // Create test SQL directory if it doesn't exist
    try {
        await mkdir(TEST_SQL_DIR, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }

    // Create test SQL file
    await writeFile(TEST_USER_QUERY, `
-- Test query with different parameter types
SELECT 
  id, name, email 
FROM users 
WHERE (:search IS NULL OR name LIKE '%' || :search || '%')
ORDER BY id ASC
LIMIT :limit
OFFSET COALESCE(:offset, 0);
    `);

    // Create and initialize adapter
    adapter = createSqliteAdapter(`file:${TEST_DB_PATH}`);
    await adapter.init();

    // Create test table and data one statement at a time
    // Create table
    await adapter.executeQuery(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);

    // Clean existing data
    await adapter.executeQuery("DELETE FROM users;");

    // Insert test users one by one
    await adapter.executeQuery("INSERT INTO users (name, email) VALUES ('User 1', 'user1@example.com');");
    await adapter.executeQuery("INSERT INTO users (name, email) VALUES ('User 2', 'user2@example.com');");
    await adapter.executeQuery("INSERT INTO users (name, email) VALUES ('User 3', 'user3@example.com');");
    await adapter.executeQuery("INSERT INTO users (name, email) VALUES ('User 4', 'user4@example.com');");
    await adapter.executeQuery("INSERT INTO users (name, email) VALUES ('User 5', 'user5@example.com');");
});

// Clean up after tests
afterAll(async () => {
    await adapter.close();
    try {
        // Remove test database and SQL files
        await rm(TEST_DB_PATH);
        await rm(TEST_USER_QUERY);
    } catch (error) {
        console.warn("Cleanup error:", error);
    }
});

test("should handle named parameters correctly", async () => {
    // Test with a simple query using named parameters
    const sql = "SELECT * FROM users WHERE id <= :limit ORDER BY id";
    const result = await adapter.executeQuery(sql, { limit: 3 });

    expect(result.length).toBe(3);
    expect(result[0].id).toBe(1);
    expect(result[2].id).toBe(3);
});

test("should handle named parameters with LIMIT clause", async () => {
    // Test with LIMIT clause and offset
    const result = await adapter.executeQuery(
        "SELECT * FROM users ORDER BY id LIMIT :limit OFFSET :offset",
        { limit: 2, offset: 1 }
    );

    expect(result.length).toBe(2);
    expect(result[0].id).toBe(2); // Should start from second record
    expect(result[1].id).toBe(3);
});

test("should handle complex SQL with multiple parameters", async () => {
    // Test with the example get_users.sql file
    const sql = `
SELECT 
  id, name, email 
FROM users 
WHERE (:search IS NULL OR name LIKE '%' || :search || '%')
ORDER BY id ASC
LIMIT :limit
OFFSET COALESCE(:offset, 0);`;

    // Test with limit only
    const result1 = await adapter.executeQuery(sql, { limit: 2 });
    expect(result1.length).toBe(2);

    // Test with limit and offset
    const result2 = await adapter.executeQuery(sql, { limit: 2, offset: 2 });
    expect(result2.length).toBe(2);
    expect(result2[0].id).toBe(3);

    // Test with search parameter
    const result3 = await adapter.executeQuery(sql, {
        limit: 5,
        search: "User"
    });
    expect(result3.length).toBe(5);

    // Test with search parameter that matches some records
    const result4 = await adapter.executeQuery(sql, {
        limit: 5,
        search: "User 1"
    });
    expect(result4.length).toBe(1);
    expect(result4[0].name).toBe("User 1");
}); 