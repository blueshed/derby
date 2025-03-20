// Bun API server
import { serve } from "bun";
import { handleHttpRequest, jsonResponse } from "./api";
import { createWebSocketHandler } from "./websocket";
import { join, resolve } from "path";
import { stat } from "fs/promises";

// Use environment variables with fallbacks
const PORT = process.env.HTTP_PORT || 3000;
const API_PATH = "/api/";
const STATIC_DIR = resolve(process.env.STATIC_DIR || "./client/dist");

// Function to serve static files from client/dist
async function serveStatic(path) {
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
}

// Main HTTP server with integrated WebSocket support
const server = serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${method} ${path}`);

    // Upgrade WebSocket connections
    if (server.upgrade(req)) {
      return; // Return if the connection was upgraded
    }

    // Handle CORS preflight requests
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // API route handler
    if (path.startsWith(API_PATH)) {
      try {
        return await handleHttpRequest(req, API_PATH);
      } catch (error) {
        console.error(`[${timestamp}] Error:`, error);
        return jsonResponse({ error: error.message }, 500);
      }
    }

    // Serve static files for any other path
    return serveStatic(path);
  },

  error(error) {
    console.error(`Server error: ${error}`);
  },

  // Integrate WebSocket handler
  websocket: createWebSocketHandler()
});

console.log(`HTTP & WebSocket Server started at ${new Date().toISOString()}`);
console.log(`Server listening on http://localhost:${PORT}`);
console.log(`WebSocket endpoint available at ws://localhost:${PORT}`);
console.log(`Serving static files from ${STATIC_DIR}`);
