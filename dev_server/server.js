var WebSocketServer = require('ws').Server; 
var wss = new WebSocketServer({port: 8383});

wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        console.log('received: ', message);
    });
});