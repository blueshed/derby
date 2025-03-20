// Test script to verify that the WebSocket JSON-RPC server works with the client RPC implementation

import WebSocket from "ws";

// Function to generate UUIDs like the client does
function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Connect to the server
const ws = new WebSocket("ws://localhost:3001/");

// Set up message handling
ws.on("open", () => {
    console.log("Connected to server");

    // Wait a short time for the welcome message
    setTimeout(() => {
        // Send a standard JSON-RPC 2.0 request
        const requestId = uuidv4();
        console.log(`Sending JSON-RPC request with ID: ${requestId}`);

        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method: "query",
            params: {
                name: "get_users",
                parameters: {}
            },
            id: requestId
        }));

        // After a short delay, send a legacy format request
        setTimeout(() => {
            const legacyId = uuidv4();
            console.log(`Sending legacy format request with ID: ${legacyId}`);

            ws.send(JSON.stringify({
                queryName: "get_profile",
                params: { id: 1 },
                requestId: legacyId
            }));

            // Close the connection after processing
            setTimeout(() => {
                console.log("Closing connection");
                ws.close();
                process.exit(0);
            }, 500);
        }, 500);
    }, 500);
});

// Handle responses
ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    console.log("Received message:", message);
});

// Handle errors
ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    process.exit(1);
});

// Handle close
ws.on("close", () => {
    console.log("Connection closed");
}); 