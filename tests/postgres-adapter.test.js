import { test, expect, beforeAll, afterAll } from "bun:test";
import { createPostgresAdapter } from "../src/adapters/postgres.js";

// Sample PostgreSQL connection string
const PG_CONNECTION_STRING = "postgres://postgres:secret@localhost:5432/fruity";

// Flag to control whether we actually try to connect to PostgreSQL
const SHOULD_TEST_CONNECTION = false; // Set to true to test actual connection

let adapter;
let connectionAvailable = false;

// Setup test
beforeAll(async () => {
    adapter = createPostgresAdapter(PG_CONNECTION_STRING);

    // Try to detect if PostgreSQL is available for testing
    if (SHOULD_TEST_CONNECTION) {
        try {
            // Simple connectivity check with timeout
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000);

            // Attempt to fetch from localhost:5432
            const response = await fetch("http://localhost:5432", {
                signal: controller.signal
            }).catch(() => null);

            clearTimeout(id);
            connectionAvailable = response !== null;
        } catch (error) {
            console.log("PostgreSQL connection not available for testing");
            connectionAvailable = false;
        }
    }

    await adapter.init();
});

// Cleanup
afterAll(async () => {
    await adapter.close();
});

// Basic initialization test
test("should initialize and close properly", () => {
    expect(adapter.isInitialized).toBe(true);
});

// Test that current stub implementation throws appropriate errors
test("should throw not implemented error for executeQuery", async () => {
    let error;
    try {
        await adapter.executeQuery("SELECT 1");
    } catch (e) {
        error = e;
    }

    expect(error).toBeDefined();
    expect(error.message).toContain("PostgreSQL adapter is not fully implemented");
});

// Test that the adapter structure is correct
test("should have required adapter methods", () => {
    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.close).toBe("function");
    expect(typeof adapter.executeQuery).toBe("function");
    // Future PostgreSQL adapter methods would be tested here
});

// Conditional tests that run only if PostgreSQL is available
if (SHOULD_TEST_CONNECTION && connectionAvailable) {
    test("should connect to PostgreSQL database", () => {
        // Future implementation
        expect(adapter.isInitialized).toBe(true);
    });

    test("should execute a simple query", async () => {
        // This test is skipped with the current stub implementation
        // Future implementation would test actual query execution
    });
} else {
    test.skip("PostgreSQL connection tests skipped (connection not available)", () => {
        console.log("Skipping PostgreSQL connection tests");
    });
} 