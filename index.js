// Bun API server
import { serve } from "bun";
import { handleHttpRequest, jsonResponse } from "./api";
import { createWebSocketHandler } from "./websocket";

// Use environment variable for port with fallback to 3000
const PORT = process.env.HTTP_PORT || 3000;
const API_PATH = "/api/";

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

    // Default route
    return new Response("API Server - Use /api/queryName to execute SQL queries", {
      headers: { "Content-Type": "text/plain" },
    });
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
