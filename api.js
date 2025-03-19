import { executeNamedQuery } from "./db";

/**
 * Creates a JSON response with proper headers
 */
export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

/**
 * Extract parameters from various request types (GET, POST)
 */
export async function extractParamsFromRequest(req) {
    const params = {};
    const url = new URL(req.url);

    // Get parameters from URL query string
    for (const [key, value] of url.searchParams.entries()) {
        params[key] = value;
    }

    // For POST/PUT/DELETE requests, also parse the body
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
        const contentType = req.headers.get("Content-Type") || "";

        if (contentType.includes("application/json")) {
            try {
                // Parse JSON body
                const body = await req.json();
                Object.assign(params, body);
            } catch (e) {
                // If JSON parsing fails, continue without body params
                console.log("JSON parsing failed:", e);
            }
        }
        else if (contentType.includes("application/x-www-form-urlencoded")) {
            try {
                // Parse form data
                const formData = await req.formData();
                for (const [key, value] of formData.entries()) {
                    params[key] = value;
                }
            } catch (e) {
                // If form parsing fails, continue without body params
                console.log("Form data parsing failed:", e);
            }
        }
    }

    return params;
}

/**
 * Core API handler that can be used by both HTTP and WebSocket interfaces
 * 
 * @param {string} queryName - The name of the SQL query to execute
 * @param {Object} params - Parameters to pass to the query
 * @returns {Object} Result object with success, data, status, and error properties
 */
export async function handleApiQuery(queryName, params = {}) {
    try {
        // Execute the named query
        const result = await executeNamedQuery(queryName, params);
        return {
            success: true,
            data: result,
            status: 200
        };
    } catch (error) {
        if (error.message.includes('Query not found')) {
            return {
                success: false,
                error: error.message,
                status: 404
            };
        }

        // Other errors
        return {
            success: false,
            error: error.message,
            status: 500
        };
    }
}

/**
 * HTTP API request handler
 */
export async function handleHttpRequest(req, apiPath) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Extract query name from the path
    const queryName = path.substring(apiPath.length);
    console.log(`Processing query: ${queryName} [${method}]`);

    try {
        // Extract parameters from request
        const params = await extractParamsFromRequest(req);
        console.log("Parameters:", params);

        // Handle the query
        const result = await handleApiQuery(queryName, params);

        // Convert to HTTP response
        return jsonResponse(result.success ? result.data : { error: result.error }, result.status);
    } catch (error) {
        console.error(`Error handling request:`, error);
        return jsonResponse({ error: error.message }, 500);
    }
} 