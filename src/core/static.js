import { join, resolve } from "path";
import { stat } from "fs/promises";

/**
 * Create a static file handler for serving files from a directory
 * @param {string} staticDir - Directory to serve files from
 * @returns {Function} Handler function for serving static files
 */
export function createStaticHandler(staticDir) {
    // Resolve the static directory path
    const STATIC_DIR = resolve(staticDir);
    console.log(`Static file handler initialized for directory: ${STATIC_DIR}`);

    /**
     * Handle static file requests
     * @param {string} path - Request path
     * @returns {Promise<Response>} HTTP response with file or error
     */
    return async function serveStatic(path) {
        try {
            // Normalize path to prevent path traversal attacks
            const normalizedPath = join(STATIC_DIR, path);

            // Ensure the path is still within the static directory
            if (!normalizedPath.startsWith(STATIC_DIR)) {
                return new Response("Forbidden", { status: 403 });
            }

            try {
                // Check if the file exists
                const stats = await stat(normalizedPath);

                // If it's a directory, try to serve index.html from that directory
                if (stats.isDirectory()) {
                    return serveStatic("/index.html");
                }

                // Serve the file with appropriate content type
                const f = Bun.file(normalizedPath);
                return new Response(f);
            } catch (error) {
                console.error(`Static file error: ${error.message}`);

                // For 404, serve the index.html (for SPA client-side routing)
                if (error.code === "ENOENT") {
                    return serveStatic("/index.html");
                }

                return new Response("Not Found", { status: 404 });
            }
        } catch (error) {
            console.error(`Error serving static file: ${error}`);
            return new Response("Server Error", { status: 500 });
        }
    };
} 