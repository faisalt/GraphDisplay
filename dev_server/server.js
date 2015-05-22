var WebSocketServer = require('ws').Server; 
var wss = new WebSocketServer({port: 8383});

wss.on('connection', function(ws) {
    ws.on('message', function(message) {
		var parsedmsg = JSON.parse(message);
		var parseddata = parsedmsg.data;
		//console.log(parseddata);
		var str="";
		for(var i=0; i<parseddata.length; i++) {
			for(var j=0; j<parseddata[i].length; j++) {
				str += (j==(parseddata[i].length - 1)) ? parseddata[i][j] : parseddata[i][j] + ", ";
			}
			console.log("Row "+i+" : " + str);
			str="";
		}
		console.log("");
		console.log("============================");
		console.log("");
    });
});