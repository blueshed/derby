import { executeNamedQuery } from "./db.js";

/**
 * Create a JSON response with proper headers
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @returns {Response} HTTP response
 */
export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        status
    });
}

/**
 * Extract parameters from HTTP request
 * @param {Request} req - HTTP request
 * @returns {Promise<Object>} Request parameters
 */
export async function extractParamsFromRequest(req) {
    const url = new URL(req.url);
    const method = req.method;
    const params = {};

    // Extract query string parameters
    for (const [key, value] of url.searchParams.entries()) {
        // Handle numeric values
        if (!isNaN(value) && value.trim() !== '') {
            params[key] = Number(value);
        } else {
            params[key] = value;
        }
    }

    // Extract body parameters for POST/PUT
    if (method === "POST" || method === "PUT") {
        const contentType = req.headers.get("Content-Type") || "";

        if (contentType.includes("application/json")) {
            // JSON body
            try {
                const body = await req.json();
                Object.assign(params, body);
            } catch (error) {
                console.error("Error parsing JSON body:", error);
            }
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
            // Form data
            try {
                const formData = await req.formData();
                for (const [key, value] of formData.entries()) {
                    params[key] = value;
                }
            } catch (error) {
                console.error("Error parsing form data:", error);
            }
        }
    }

    return params;
}

/**
 * Handle an API query
 * @param {string} queryName - Query name
 * @param {Object} params - Query parameters
 * @param {Object} db - Database adapter
 * @returns {Promise<Object>} Query result
 */
export async function handleApiQuery(queryName, params = {}, db) {
    try {
        if (!queryName) {
            return {
                success: false,
                status: 400,
                error: "Missing query name"
            };
        }

        console.log(`Processing API query: ${queryName} with params:`, params);

        // Execute the named query
        const result = await executeNamedQuery(queryName, params, db);
        return result;
    } catch (error) {
        console.error(`Error handling API query '${queryName}':`, error);

        return {
            success: false,
            status: 500,
            error: error.message
        };
    }
}

/**
 * Handle HTTP request to API
 * @param {Request} req - HTTP request
 * @param {string} apiPath - API base path
 * @param {Object} db - Database adapter
 * @returns {Promise<Response>} HTTP response
 */
export async function handleHttpRequest(req, apiPath, db) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Normalize API path to ensure it has trailing slash
    const normalizedApiPath = apiPath.endsWith('/') ? apiPath : apiPath + '/';

    // Extract the query name from the URL path
    const queryName = path.substring(path.indexOf(normalizedApiPath) + normalizedApiPath.length);

    console.log(`API request for query: '${queryName}'`);

    if (!queryName) {
        return jsonResponse({
            success: false,
            error: "Missing query name"
        }, 400);
    }

    // Extract parameters from request
    const params = await extractParamsFromRequest(req);

    // Execute the query
    const result = await handleApiQuery(queryName, params, db);

    if (result.success) {
        return jsonResponse(result.data);
    } else {
        return jsonResponse({
            success: false,
            error: result.error
        }, result.status || 500);
    }
} 