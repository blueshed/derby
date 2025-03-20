import { join } from "path";

/**
 * Default configuration for Derby server
 */
export const defaultConfig = {
    // Server settings
    port: process.env.PORT || 3000,

    // Database settings
    database: {
        type: "sqlite",
        connectionString: process.env.DATABASE_URL || "file:derby.db",
        sqlPath: process.env.SQL_PATH || join(process.cwd(), "sql"),
        logSql: process.env.LOG_SQL === "true"
    },

    // Static file settings
    staticDir: process.env.STATIC_DIR || join(process.cwd(), "public"),

    // API settings
    apiPath: process.env.API_PATH || "/api",

    // WebSocket settings
    websocket: {
        methods: {},
        jsonRpc: {
            version: "2.0",
            supportLegacy: true
        }
    },

    // CORS settings
    cors: {
        enabled: process.env.CORS_ENABLED === "true",
        origin: process.env.CORS_ORIGIN || "*",
        methods: process.env.CORS_METHODS || "GET, POST, PUT, DELETE, OPTIONS",
        headers: process.env.CORS_HEADERS || "Content-Type, Authorization"
    }
};

/**
 * Merge user configuration with default configuration
 * @param {Object} userConfig - User configuration object
 * @returns {Object} - Merged configuration
 */
export function mergeConfig(userConfig = {}) {
    // Deep merge function for nested objects
    const deepMerge = (target, source) => {
        const output = { ...target };

        for (const key in source) {
            if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
                output[key] = deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }

        return output;
    };

    return deepMerge(defaultConfig, userConfig);
} 