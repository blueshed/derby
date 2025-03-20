import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3100');

ws.on('open', function open() {
    console.log('Connected to server');

    // Send a JSON-RPC request for get_users
    const request = {
        jsonrpc: '2.0',
        method: 'query',
        params: {
            name: 'get_users',
            parameters: {}
        },
        id: 1
    };

    console.log('Sending:', JSON.stringify(request, null, 2));
    ws.send(JSON.stringify(request));
});

let sentLegacyRequest = false;

ws.on('message', function incoming(data) {
    const response = JSON.parse(data);
    console.log('Received:', JSON.stringify(response, null, 2));

    // After welcome message, send the JSON-RPC request
    if (response.method === 'connection') {
        return;
    }

    // After first query response, try a legacy format request
    if (response.id === 1 && !sentLegacyRequest) {
        sentLegacyRequest = true;
        const legacyRequest = {
            queryName: 'get_profile',
            params: { id: 1 },
            requestId: 2
        };

        console.log('Sending legacy format:', JSON.stringify(legacyRequest, null, 2));
        ws.send(JSON.stringify(legacyRequest));
        return;
    }

    // After legacy response, close
    if (response.id === 2) {
        setTimeout(() => {
            console.log('Closing connection');
            ws.close();
            process.exit(0);
        }, 100);
    }
});

ws.on('error', console.error); 