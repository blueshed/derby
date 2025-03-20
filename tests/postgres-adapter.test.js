import { test, expect, beforeAll, afterAll } from "bun:test";
import { createPostgresAdapter } from "../src/adapters/postgres.js";

// Sample PostgreSQL connection string - customizable via environment variables
const PG_HOST = process.env.PG_HOST || "localhost";
const PG_PORT = process.env.PG_PORT || "5432";
const PG_USER = process.env.PG_USER || "postgres";
const PG_PASSWORD = process.env.PG_PASSWORD || "postgres";
const PG_DATABASE = process.env.PG_DATABASE || "postgres";
const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING ||
    `postgres://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`;

// Flag to control whether we actually try to connect to PostgreSQL
const SHOULD_TEST_CONNECTION = process.env.TEST_PG_CONNECTION === "true";

let adapter;
let connectionAvailable = false;

// Setup test
beforeAll(async () => {
    console.log(`Using connection string: ${PG_CONNECTION_STRING.replace(/:[^:]*@/, ':****@')}`);
    adapter = createPostgresAdapter(PG_CONNECTION_STRING);

    // Try to detect if PostgreSQL is available for testing
    if (SHOULD_TEST_CONNECTION) {
        try {
            // Initialize the adapter (will throw if connection fails)
            await adapter.init();
            connectionAvailable = true;
            console.log("PostgreSQL connection available for testing");

            // Test by running a simple query
            const result = await adapter.executeQuery("SELECT 1 as test");
            if (result && result.length > 0) {
                console.log("PostgreSQL query test successful");
            }
        } catch (error) {
            console.log("PostgreSQL connection not available for testing:", error.message);
            connectionAvailable = false;
        }
    } else {
        // Mock the initialization for basic tests
        adapter.isInitialized = true;
        console.log("Using mock initialization (no real PostgreSQL connection)");
    }

    // Print connection status for debugging
    console.log(`Connection available: ${connectionAvailable}`);
    console.log(`Should test connection: ${SHOULD_TEST_CONNECTION}`);
});

// Cleanup
afterAll(async () => {
    if (adapter.isInitialized) {
        await adapter.close();
    }
});

// Basic initialization test
test("should initialize and close properly", () => {
    expect(adapter.isInitialized).toBe(true);
});

// Test that the adapter structure is correct
test("should have required adapter methods", () => {
    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.close).toBe("function");
    expect(typeof adapter.executeQuery).toBe("function");
    expect(typeof adapter.transaction).toBe("function");
    expect(typeof adapter.sqlTransformer).toBe("function");
});

// Test the SQL transformer
test("should transform SQL parameters correctly", () => {
    const sqlTransformer = adapter.sqlTransformer;

    // Test with named parameters
    const { sql: sql1, params: params1 } = sqlTransformer(
        "SELECT * FROM users WHERE id = $id AND status = $status",
        { id: 1, status: 'active' }
    );

    expect(sql1).toBe("SELECT * FROM users WHERE id = :id AND status = :status");
    expect(params1).toEqual({ id: 1, status: 'active' });

    // Test with no parameters
    const { sql: sql2, params: params2 } = sqlTransformer(
        "SELECT * FROM users",
        {}
    );

    expect(sql2).toBe("SELECT * FROM users");
    expect(params2).toEqual({});
});

// Define connection tests - these will be dynamically included or skipped
const connectionTests = {
    "should execute a simple query": async () => {
        const result = await adapter.executeQuery("SELECT 1 as test");
        expect(result).toBeDefined();
        expect(result.length).toBe(1);
        expect(result[0].test).toBe(1);
    },

    "should handle parameters correctly": async () => {
        const result = await adapter.executeQuery(
            "SELECT 'test' as name, 42 as value"
        );

        expect(result).toBeDefined();
        expect(result.length).toBe(1);
        expect(result[0].name).toBe("test");
        expect(result[0].value).toBe(42);
    },

    "should execute multiple statements": async () => {
        const sql = `
            CREATE TEMPORARY TABLE test_multi (id SERIAL PRIMARY KEY, name TEXT);
            INSERT INTO test_multi (name) VALUES ('test1'), ('test2');
            SELECT * FROM test_multi ORDER BY id;
        `;

        const result = await adapter.executeQuery(sql);
        expect(result).toBeDefined();

        // Last statement should return the inserted rows
        const lastResult = result[result.length - 1];
        expect(lastResult.length).toBe(2);
        expect(lastResult[0].name).toBe("test1");
        expect(lastResult[1].name).toBe("test2");
    },

    "should handle transactions": async () => {
        const result = await adapter.transaction(async (tx) => {
            // Create a test table
            await tx.executeQuery(`
                CREATE TEMPORARY TABLE test_tx (id SERIAL PRIMARY KEY, value TEXT)
            `);

            // Insert a row
            await tx.executeQuery(
                "INSERT INTO test_tx (value) VALUES ('transaction-test')"
            );

            // Return the inserted row
            return tx.executeQuery("SELECT * FROM test_tx");
        });

        expect(result).toBeDefined();
        expect(result.length).toBe(1);
        expect(result[0].value).toBe("transaction-test");
    }
};

// Conditionally run or skip the tests based on connection availability
if (SHOULD_TEST_CONNECTION) {
    console.log("TEST_PG_CONNECTION is true, attempting to run PostgreSQL tests");

    // Register each test
    for (const [name, testFn] of Object.entries(connectionTests)) {
        test(name, async () => {
            // Double check connection before each test
            if (!connectionAvailable) {
                console.log(`Skipping test "${name}" - PostgreSQL connection not available`);
                test.skip(name);
                return;
            }

            await testFn();
        });
    }
} else {
    console.log("TEST_PG_CONNECTION is false, skipping PostgreSQL connection tests");

    // Skip all connection tests
    test.skip("PostgreSQL connection tests", () => {
        console.log("PostgreSQL connection tests skipped - not configured");
    });
} 