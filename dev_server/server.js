/*
* Central application server for the EMERGE system.
* Handles communication between various clients, e.g. interface panels and the EMERGE application.
* Updates dataset, informs about interactions, stores state variables.
*
* @author Faisal T.
* Created 29-05-2015.
*/


/*
*
* TO DO;
*
* NOTE: In C#, dataobject accessed using following example syntax - parsedData["data"][x][y]["val"];
*
*/


var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

// Variables
var _DATASET_WINDOW		= [];
var _ALL_DATA			= [];
var _NUMROWS			= 10;
var _NUMCOLS			= 10;
var _WINDOWSIZE			= 10;
var _COLLENGTH			= 0;
var _ROWLENGTH			= 0;
var _DATAREPO			= "http://localhost/GraphDisplay/data/";

//var _CSVFILE			= "appropriateness.csv";
//var _XMLCOLOURSFILE	= "appropriateness.metadata";

var _CSVFILE			= "EU_Values3.csv";
var _XMLCOLOURSFILE		= "EU_Values3.metadata";

var _DATAINITIALIZED	= false;
var _CLIENTCOUNTER 		= 0;
var _X_SCROLLINDEX		= 0;
var _Y_SCROLLINDEX		= 0;
var _ANIMATION_TIME		= 50;
var LOGGING_ENABLED		= false;

// Variables for filtering
var PRESS_COMPARE_COUNTER 			= 0;
var COMPARE_TIMER_STARTED 			= false;
var COMPARE_TIME_1 					= 0;
var COMPARE_TIME_2 					= 0;
var FILTER_COMPARISON_INTERVAL 		= 800;
var FILTER_COMPARISON_TIMER_TICK 	= 50;
var rowcomparison_array = Array();
var filterCoordinates = Array();

// Dataset to use
var DataSetObject 		= new DataSetObject(_DATAREPO+_CSVFILE, _DATAREPO+_XMLCOLOURSFILE); // Initialize the dataset
var DATA_INDEX 			= new DataIndex(); // Initialize data index tracking object
var LockedData			= new LockedData();
var DataHistory 		= new DataHistory();
var DATAMAX_LIMITER		= 1;
var DATAMIN_LIMITER		= 0.3;

// Socket function variables - Listener variables
var DEBUG_DATA 				= "DEBUG_DATA"; // listens for data during debug mode : typically simplified data format
var DATASET_WINDOW 			= "DATASET_WINDOW"; // data in the 'current window' e.g. in the current 10x10 grid space
var RESET_ALL				= "RESET_ALL"; // reset all variables

var REQUEST_COLUMN_LENGTH		= "REQUEST_COLUMN_LENGTH";
var REQUEST_ALLCOLUMNS			= "REQUEST_ALLCOLUMNS";
var REQUEST_ROW_LENGTH			= "REQUEST_ROW_LENGTH";
var REQUEST_ALLROWS				= "REQUEST_ALLROWS";

var COL_SWAP					= "COL_SWAP";
var ROW_SWAP					= "ROW_SWAP";

var UPDATE_DATASET_SCROLLX		= "UPDATE_DATASET_SCROLLX";
var UPDATE_DATASET_SCROLLY		= "UPDATE_DATASET_SCROLLY";

var SET_ANNOTATED				= "SET_ANNOTATED";
var SET_FILTERED				= "SET_FILTERED";

var ACTION_UNDO					= "ACTION_UNDO";
var ACTION_REDO					= "ACTION_REDO";
var ACTION_RELOAD				= "ACTION_RELOAD";

var CREATE_SNAPSHOT				= "CREATE_SNAPSHOT";
var SHOW_SNAPSHOT				= "SHOW_SNAPSHOT";
var REMOVE_SNAPSHOT				= "REMOVE_SNAPSHOT";

// Socket function variables - Broadcast variables.
var DATASET_WINDOW_UPDATE			= "DATASET_WINDOW_UPDATE"; // broadcast and globally update the dataset window values
var DATASET_WINDOW_UPDATE_LIMITED 	= "DATASET_WINDOW_UPDATE_LIMITED";
var DATASET_X_SCROLLBAR_UPDATE		= "DATASET_X_SCROLLBAR_UPDATE";
var DATASET_Y_SCROLLBAR_UPDATE		= "DATASET_Y_SCROLLBAR_UPDATE";
var DATASET_X_LABEL_UPDATE			= "DATASET_X_LABEL_UPDATE";
var DATASET_Y_LABEL_UPDATE			= "DATASET_Y_LABEL_UPDATE";
var UNITYCLIENT_DATASET_WINDOW_UPDATE = "UNITYCLIENT_DATASET_WINDOW_UPDATE";

var LOCKED_CLIENT 					= "";
var UNITYROOM						= "UNITYROOM";
var MAINROOM						= "MAINROOM";

// Websocket variables.
var port			= 8383;
var app 			= io = require('socket.io').listen(app);

// Allows writing/appending to file.
var fs 				= require('fs');

// Listen on specified port.
app.listen(port);

// Server start-up information.
console.log("\r\nNode.js Server for EMERGE");
console.log("Listening on port: "+port);
require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  console.log('Local IP Address: '+add+"\r\n");
});




// Handle incoming requests from clients on connection
io.sockets.on('connection', function (socket) {
	//console.log("A client has connected with ID: " + socket.id);
	socket.on("clientConnection", function (clientid, callback) {
		console.log("\r\nClient "+clientid+" has connected! \r\n");
		_CLIENTCOUNTER++; // Incrememnt the client counter.
		socket.join(MAINROOM);
		callback("CONNECTED"); // Once data loaded, etc. respond to client.
    });
	socket.on("EMERGEClient", function(clientid) {
		console.log("\r\nClient "+clientid+" has connected!\r\n");
		_CLIENTCOUNTER++;
		socket.join(MAINROOM);
	});
	/* Relay requests */
	socket.on(DATASET_WINDOW_UPDATE, function() {
		socket.emit(DATASET_WINDOW_UPDATE, sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	
	socket.on("UPDATE_GUI", function(client) {
		// socket.emit = local, socket.broadcast.emit = global
		socket.emit(DATASET_X_LABEL_UPDATE, JSON.stringify({columns:DataSetObject.getColumnLabelWindow(), lockedColumns : LockedData.getActualColumnIndices(), snapshots: DataHistory.getSnapshots()}));
		socket.broadcast.emit(DATASET_X_LABEL_UPDATE, JSON.stringify({columns:DataSetObject.getColumnLabelWindow(), lockedColumns : LockedData.getActualColumnIndices(), snapshots: DataHistory.getSnapshots()}));
		socket.emit(DATASET_X_SCROLLBAR_UPDATE, JSON.stringify({xindex:DATA_INDEX.getXScrollIndex(), xlabels:DataSetObject.getColumnLabelWindow()}));
		socket.broadcast.emit(DATASET_X_SCROLLBAR_UPDATE, JSON.stringify({xindex:DATA_INDEX.getXScrollIndex(), xlabels:DataSetObject.getColumnLabelWindow()}));
		socket.emit(DATASET_Y_LABEL_UPDATE, JSON.stringify({rows:DataSetObject.getRowLabelWindow(), lockedRows : LockedData.getActualRowIndices()}));
		socket.broadcast.emit(DATASET_Y_LABEL_UPDATE, JSON.stringify({rows:DataSetObject.getRowLabelWindow(), lockedRows : LockedData.getActualRowIndices()}));
		socket.emit(DATASET_Y_SCROLLBAR_UPDATE, JSON.stringify({yindex:DATA_INDEX.getYScrollIndex(), ylabels:DataSetObject.getRowLabelWindow()}));
		socket.broadcast.emit(DATASET_Y_SCROLLBAR_UPDATE, JSON.stringify({yindex:DATA_INDEX.getYScrollIndex(), ylabels:DataSetObject.getRowLabelWindow()}));
		
	});
	
	socket.on("UNITY_SOCKET", function(data) {
		console.log("UNITY SOCKET HAS CONNECTED");
		_CLIENTCOUNTER++;
		socket.emit("UNITY_PING", {client_id:socket.id});
	});
	socket.on("UNITY_LOCK", function(data)  {
		LOCKED_CLIENT = data;
		socket.join(UNITYROOM);
	});
	
	/* Request Handlers */
	socket.on(REQUEST_COLUMN_LENGTH, function(message, callback) {
		var clength = DataSetObject.TotalMaxColumns();
		callback(clength);
	});
	socket.on(REQUEST_ALLCOLUMNS, function(message, callback) {
		var cdata = DataSetObject.getColumnLabelWindow();
		var send_xindex = DATA_INDEX.getXScrollIndex();
		callback(JSON.stringify({data:cdata, xindex:send_xindex, lockedColumns : LockedData.getActualColumnIndices(), col_length:DataSetObject.TotalMaxColumns(), snapshots: DataHistory.getSnapshots()}));
	});
	
	socket.on("REQUEST_SNAPSHOTS", function(message, callback) {
		callback(JSON.stringify({snapshots: DataHistory.getSnapshots()}));
	});
	socket.on("UPDATE_SNAPSHOTS", function(message) {
		socket.broadcast.emit("UPDATE_SNAPSHOTS", JSON.stringify({snapshots: DataHistory.getSnapshots()}));
		socket.emit("UPDATE_SNAPSHOTS", JSON.stringify({snapshots: DataHistory.getSnapshots()}));
	});
	
	socket.on(REQUEST_ROW_LENGTH, function(message, callback) {
		var rlength = DataSetObject.TotalMaxRows();
		callback(rlength);
	});
	socket.on(REQUEST_ALLROWS, function(message, callback) {
		var rdata = DataSetObject.getRowLabelWindow();
		var send_yindex = DATA_INDEX.getYScrollIndex();
		callback(JSON.stringify({data:rdata, yindex:send_yindex, lockedRows : LockedData.getActualRowIndices(), row_length:DataSetObject.TotalMaxRows()}));
	});
	/* End Request Handlers*/
	
	/* Action Handlers */
	socket.on(COL_SWAP, function (message) {
		var colstoswap = JSON.parse(message);
		swapCol(colstoswap.column_1, colstoswap.column_2);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		DataHistory.add();
		socket.broadcast.emit(DATASET_WINDOW_UPDATE, sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
		socket.broadcast.emit(DATASET_X_LABEL_UPDATE, JSON.stringify({columns:DataSetObject.getColumnLabelWindow()}));
		socket.broadcast.emit(DATASET_X_SCROLLBAR_UPDATE, JSON.stringify({xindex:DATA_INDEX.getXScrollIndex(), xlabels:DataSetObject.getColumnLabelWindow()}));
	});
	socket.on(UPDATE_DATASET_SCROLLX, function(message, callback) {
		var params = JSON.parse(message);
		var pos = params.position;
		dataScrollX(pos);
		DataHistory.add();
		// Send back new labels on client GUI
		//callback(JSON.stringify(DataSetObject.AllColumnValues()));
		callback(JSON.stringify(DataSetObject.getColumnLabelWindow()));
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		
		socket.to(MAINROOM).emit(DATASET_WINDOW_UPDATE, sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
		socket.to(UNITYROOM).emit(UNITYCLIENT_DATASET_WINDOW_UPDATE, {data:DataSetObject.getDataWindow(), minz:DataSetObject.DataMinValue(), maxz:DataSetObject.DataMaxValue()});
		socket.to(MAINROOM).emit(DATASET_X_SCROLLBAR_UPDATE, JSON.stringify({xindex:DATA_INDEX.getXScrollIndex(), xlabels:DataSetObject.getColumnLabelWindow()}));
	});
	
	socket.on(ROW_SWAP, function (message) {
		var rowstoswap = JSON.parse(message);
		swapRow(rowstoswap.row_1, rowstoswap.row_2);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		DataHistory.add();
		socket.broadcast.emit(DATASET_WINDOW_UPDATE, sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
		socket.broadcast.emit(DATASET_Y_LABEL_UPDATE, JSON.stringify({rows:DataSetObject.getRowLabelWindow()}));
		socket.broadcast.emit(DATASET_Y_SCROLLBAR_UPDATE, JSON.stringify({yindex:DATA_INDEX.getYScrollIndex(), ylabels:DataSetObject.getRowLabelWindow()}));
	});
	socket.on(UPDATE_DATASET_SCROLLY, function(message, callback) {
		var params = JSON.parse(message);
		var pos = params.position;
		dataScrollY(pos);
		DataHistory.add();
		// Send back new labels on client GUI
		callback(JSON.stringify(DataSetObject.getRowLabelWindow()));
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit(DATASET_WINDOW_UPDATE, sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
		socket.broadcast.emit(UNITYCLIENT_DATASET_WINDOW_UPDATE, {data:DataSetObject.getDataWindow(), minz:DataSetObject.DataMinValue(), maxz:DataSetObject.DataMaxValue()});
		socket.broadcast.emit(DATASET_Y_SCROLLBAR_UPDATE, JSON.stringify({yindex:DATA_INDEX.getYScrollIndex(), ylabels:DataSetObject.getRowLabelWindow()}));
	});
	socket.on(SET_ANNOTATED, function(data) {
		//TO DO fix that this gets called multiple times - maybe fix in c# code.
		var annotated_coords = JSON.parse(data);
		var annotated_row = annotated_coords["annotated_coordinate"][0];
		var annotated_col = annotated_coords["annotated_coordinate"][1];
		console.log("Row: " + annotated_row + ", Col: "+annotated_col);
		annotateDataPoint(annotated_row, annotated_col);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	socket.on(SET_FILTERED, function(data) {
		// Requires filtered rows, and bounding values, i.e. scroll positions.
		// Take into account xscroll index and yscroll index
		var filtered_coords = JSON.parse(data);
		var filtered_row = filtered_coords["filtered_coordinate"][0];
		var filtered_col = filtered_coords["filtered_coordinate"][1];
		console.log(filtered_row + ", " + filtered_col);
		filterDataPoint(filtered_row, filtered_col);
		//parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	
	socket.on("LOCK_COLUMN", function(data) {
		var lockedRows = LockedData.getLockedRows();
		if(lockedRows.length == 0) {
			console.log("Locking Column " + parseInt(data));
			LockedData.addLockedColumns(parseInt(data));
			parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
			DataHistory.add(["COLUMN_LOCK", data]);
		}
		else  { console.log("One or more rows are already locked"); }
	});
	socket.on("UNLOCK_COLUMN", function(data) {
		console.log("Unlocking Column " + parseInt(data));
		LockedData.clearLockedColumn(data);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		DataHistory.add(["COLUMN_UNLOCK", data]);
	});
	
	socket.on("LOCK_ROW", function(data) {
		var lockedColumns = LockedData.getLockedColumns();
		if(lockedColumns.length == 0) {
			console.log("Locking Row " + parseInt(data));
			LockedData.addLockedRows(parseInt(data));
			parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
			DataHistory.add(["ROW_LOCK", data]);
		}
		else { console.log("One or more columns are already locked"); }
	});
	socket.on("UNLOCK_ROW", function(data) {
		console.log("Unlocking Row " + parseInt(data));
		LockedData.clearLockedRow(data);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		DataHistory.add(["ROW_UNLOCK", data]);
	});
	/* Snapshot commands. */
	socket.on(CREATE_SNAPSHOT, function(data, callback) {
		DataHistory.addSnapshot(parseInt(data));
		//DataHistory.add();
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		callback("SUCCESS");
	});
	socket.on(SHOW_SNAPSHOT, function(data, callback) {
		//DataHistory.add();
		DataHistory.showSnapshot(parseInt(data));
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		callback("SUCCESS");
	});
	socket.on(REMOVE_SNAPSHOT, function(data, callback) {
		//DataHistory.add();
		console.log("Remove snapshot: " + parseInt(data));
		DataHistory.removeSnapshot(parseInt(data));
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		callback("SUCCESS");
	});
	/* Undo and Redo commands. */
	socket.on(ACTION_UNDO, function(data, callback) {
		DataHistory.undo();
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		callback("SUCCESS");
	});
	socket.on(ACTION_REDO, function(data, callback) {
		DataHistory.redo();
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		callback("SUCCESS");
	});
	socket.on(ACTION_RELOAD, function(data, callback) {
		DataHistory.resetAll();
		callback("SUCCESS");
	});
	// Below is the action logging for the collaboration user study
	socket.on("ACTION_LOG", function(data) {
		if(LOGGING_ENABLED) {
			console.log(data);
			var parsed = JSON.parse(data);
			logData(","+parsed.Timestamp+","+parsed.Action_Name+","+parsed.Action_Type+","+parsed.Device_ID);
		}
	});
	/* End Action Handlers */
			
	/* General Socket Handlers */
	socket.on("error", function(message) {
		console.log(message);
	});
	// Sometimes called when client hasn't actualled disconnected - need to check this
	socket.on("disconnect", function(message) {
		_CLIENTCOUNTER--;
		if(_CLIENTCOUNTER == 0) { } // Normally a reset function, but sometimes disconnect randomly fires
		console.log("A client has disconnected. Number of clients remaining: "+_CLIENTCOUNTER);
	});
	socket.on(RESET_ALL, function(message) {
		// REDO THIS BIT TO DIFFERENT TYPES OF RESET, i.e. data reset, annotation reset, etc. etc.
		if(message == "RESET_ALL") { 
			//resetAll(); 
		}
		console.log(message + " has requested a Reset.");
		socket.broadcast.emit("RESET", "RESET DATA");
	});
	// Debug handler
	socket.on(DEBUG_DATA, function(message) { });
});

parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));



/** DataIndex objects to track the x and y position during navigation (scrolling). */
function DataIndex() {
	var scrollindex_x = 0, scrollindex_y = 0;
	this.getXScrollIndex = function() { return scrollindex_x; }
	this.getYScrollIndex = function() { return scrollindex_y; }
	this.setXScrollIndex = function(val_x) { scrollindex_x = val_x; }
	this.setYScrollIndex = function(val_y) { scrollindex_y = val_y; }
	this.resetXScrollIndex = function() { scrollindex_x = 0; }
	this.resetYScrollIndex = function() { scrollindex_y = 0; }
}

/** Historical data stored here. Also undo and redo feature, which accesses data 'states' at specific points. */
function DataHistory() {
	var undoCount = 0; // Keep a count - array accessor
	var redoCount = 0;
	var dataHistoryArray = Array(); // Array of historical data
	var UNDO_MODE = false;
	var REDO_MODE = false;
	var DISABLE_REDO = false;
	
	var SNAPSHOT_1=[];
	var SNAPSHOT_LOCKED_1=[];
	var SNAPSHOT_2=[];
	var SNAPSHOT_LOCKED_2=[];
	var SNAPSHOT_3=[];
	var SNAPSHOT_LOCKED_3=[];
	var SNAPSHOT_4=[];
	var SNAPSHOT_LOCKED_4=[];
	
	// Base values (start state)
	dataHistoryArray.push([
		JSON.parse(JSON.stringify(DataSetObject.AllDataVals().slice(0))), 
		DataSetObject.AllRowValues().slice(0), 
		DataSetObject.AllColumnValues().slice(0), 
		DATA_INDEX.getXScrollIndex(), 
		DATA_INDEX.getYScrollIndex(),
		""
	]);
	// Store a copy of the dataset, including indices, row and columns, etc.
	this.add = function(param) {
		param = param || "";
		if(UNDO_MODE == true || REDO_MODE == true) {
			dataHistoryArray = dataHistoryArray.slice(0,parseInt(undoCount+1));
			UNDO_MODE = false;
			REDO_MODE = false;
		}
		dataHistoryArray.push([
			JSON.parse(JSON.stringify(DataSetObject.AllDataVals().slice(0))),
			DataSetObject.AllRowValues().slice(0), 
			DataSetObject.AllColumnValues().slice(0), 
			DATA_INDEX.getXScrollIndex(), 
			DATA_INDEX.getYScrollIndex(),
			param
		]);
		// Needs to access the data back one step.
		undoCount = dataHistoryArray.length-1;
		redoCount = dataHistoryArray.length-1;
	}
	// Go back into the data history.
	this.undo = function() {
		if(undoCount >= 0) {
			if(dataHistoryArray[undoCount][5] != "") {
				if(dataHistoryArray[undoCount][5][0] == "COLUMN_LOCK") {
					console.log("Undo a " + dataHistoryArray[undoCount][5][0] + " at index: " + dataHistoryArray[undoCount][5][1]);
					LockedData.clearLockedColumn(dataHistoryArray[undoCount][5][1]);
				}
				
				if(dataHistoryArray[undoCount][5][0] == "COLUMN_UNLOCK") {
					console.log("Undo a " + dataHistoryArray[undoCount][5][0] + " at index: " + dataHistoryArray[undoCount][5][1]);
					LockedData.addLockedColumns(dataHistoryArray[undoCount][5][1]);
				}
				
				if(dataHistoryArray[undoCount][5][0] == "ROW_LOCK") {
					console.log("Undo a " + dataHistoryArray[undoCount][5][0] + " at index: " + dataHistoryArray[undoCount][5][1]);
					LockedData.clearLockedRow(dataHistoryArray[undoCount][5][1]);
				}
				
				if(dataHistoryArray[undoCount][5][0] == "ROW_UNLOCK") {
					console.log("Undo a " + dataHistoryArray[undoCount][5][0] + " at index: " + dataHistoryArray[undoCount][5][1]);
					LockedData.addLockedRows(dataHistoryArray[undoCount][5][1]);
				}
			}
			UNDO_MODE = true; 
			if(undoCount > 0) { undoCount--; }
			DataSetObject.setAllDataVals(JSON.parse(JSON.stringify(dataHistoryArray[undoCount][0].slice(0)))); 
			DataSetObject.setAllRowValues(dataHistoryArray[undoCount][1].slice(0));
			DataSetObject.setAllColumnValues(dataHistoryArray[undoCount][2].slice(0)); 
			DATA_INDEX.setXScrollIndex(dataHistoryArray[undoCount][3]);
			DATA_INDEX.setYScrollIndex(dataHistoryArray[undoCount][4]);
			redoCount = undoCount;
		}
	}
	// Go forward in the data history.
	this.redo = function() {
		console.log(dataHistoryArray.length + " | " + redoCount);
		if(redoCount <= dataHistoryArray.length - 2) {
			console.log("IN REDO");
			REDO_MODE = true;
			if(redoCount < dataHistoryArray.length-1) { redoCount++; }
			if(dataHistoryArray[redoCount][5] != "") {
				if(dataHistoryArray[redoCount][5][0] == "COLUMN_LOCK") {
					console.log("Redo a locked " + dataHistoryArray[redoCount][5][0] + " at index: " + dataHistoryArray[redoCount][5][1]);
					LockedData.addLockedColumns(dataHistoryArray[redoCount][5][1]);
				}
				if(dataHistoryArray[redoCount][5][0] == "COLUMN_UNLOCK") {
					console.log("Redo a locked " + dataHistoryArray[redoCount][5][0] + " at index: " + dataHistoryArray[redoCount][5][1]);
					LockedData.clearLockedColumn(dataHistoryArray[redoCount][5][1]);
				}
				
				if(dataHistoryArray[redoCount][5][0] == "ROW_LOCK") {
					console.log("Redo a locked " + dataHistoryArray[redoCount][5][0] + " at index: " + dataHistoryArray[redoCount][5][1]);
					LockedData.addLockedRows(dataHistoryArray[redoCount][5][1]);
				}
				if(dataHistoryArray[redoCount][5][0] == "ROW_UNLOCK") {
					console.log("Redo a locked " + dataHistoryArray[redoCount][5][0] + " at index: " + dataHistoryArray[redoCount][5][1]);
					LockedData.clearLockedRow(dataHistoryArray[redoCount][5][1]);
				}
			}
			DataSetObject.setAllDataVals(JSON.parse(JSON.stringify(dataHistoryArray[redoCount][0].slice(0)))); 
			DataSetObject.setAllRowValues(dataHistoryArray[redoCount][1].slice(0));
			DataSetObject.setAllColumnValues(dataHistoryArray[redoCount][2].slice(0)); 
			DATA_INDEX.setXScrollIndex(dataHistoryArray[redoCount][3]);
			DATA_INDEX.setYScrollIndex(dataHistoryArray[redoCount][4]);
			undoCount = redoCount;
		}
	}
	// Store a snapshot
	this.addSnapshot=function(param) {
		switch(param) {
			case 1:
				SNAPSHOT_1 = this.getMostRecent();
				SNAPSHOT_LOCKED_1 = LockedData.getAllLockedVariables();
				break;
			case 2:
				SNAPSHOT_2 = this.getMostRecent();
				SNAPSHOT_LOCKED_2 = LockedData.getAllLockedVariables();
				break;
			case 3:
				SNAPSHOT_3 = this.getMostRecent();
				SNAPSHOT_LOCKED_3 = LockedData.getAllLockedVariables();
				break;
			case 4:
				SNAPSHOT_4 = this.getMostRecent();
				SNAPSHOT_LOCKED_4 = LockedData.getAllLockedVariables();
				break;
			default:
				"";
		}
	}
	this.showSnapshot=function(param) {
		switch(param) {
			case 1:
				LockedData.setAllLockedVariables(SNAPSHOT_LOCKED_1);
				DataSetObject.setAllDataVals(JSON.parse(JSON.stringify(SNAPSHOT_1[0].slice(0)))); 
				DataSetObject.setAllRowValues(SNAPSHOT_1[1].slice(0));
				DataSetObject.setAllColumnValues(SNAPSHOT_1[2].slice(0)); 
				DATA_INDEX.setXScrollIndex(SNAPSHOT_1[3]);
				DATA_INDEX.setYScrollIndex(SNAPSHOT_1[4]);
				break;
			case 2:
				LockedData.setAllLockedVariables(SNAPSHOT_LOCKED_2);
				DataSetObject.setAllDataVals(JSON.parse(JSON.stringify(SNAPSHOT_2[0].slice(0)))); 
				DataSetObject.setAllRowValues(SNAPSHOT_2[1].slice(0));
				DataSetObject.setAllColumnValues(SNAPSHOT_2[2].slice(0)); 
				DATA_INDEX.setXScrollIndex(SNAPSHOT_2[3]);
				DATA_INDEX.setYScrollIndex(SNAPSHOT_2[4]);
				break;
			case 3:
				LockedData.setAllLockedVariables(SNAPSHOT_LOCKED_3);
				DataSetObject.setAllDataVals(JSON.parse(JSON.stringify(SNAPSHOT_3[0].slice(0)))); 
				DataSetObject.setAllRowValues(SNAPSHOT_3[1].slice(0));
				DataSetObject.setAllColumnValues(SNAPSHOT_3[2].slice(0)); 
				DATA_INDEX.setXScrollIndex(SNAPSHOT_3[3]);
				DATA_INDEX.setYScrollIndex(SNAPSHOT_3[4]);
				break;
			case 4:
				LockedData.setAllLockedVariables(SNAPSHOT_LOCKED_4);
				DataSetObject.setAllDataVals(JSON.parse(JSON.stringify(SNAPSHOT_4[0].slice(0)))); 
				DataSetObject.setAllRowValues(SNAPSHOT_4[1].slice(0));
				DataSetObject.setAllColumnValues(SNAPSHOT_4[2].slice(0)); 
				DATA_INDEX.setXScrollIndex(SNAPSHOT_4[3]);
				DATA_INDEX.setYScrollIndex(SNAPSHOT_4[4]);
				break;
			default:
				"";
		}
	}
	this.removeSnapshot=function(param) {
		// Remove specified snapshot and set the data to ...?
		switch(param) {
			case 1:
				SNAPSHOT_1 = [];
				SNAPSHOT_LOCKED_1 = [];
				break;
			case 2:
				SNAPSHOT_2 = [];
				SNAPSHOT_LOCKED_2 = [];
				break;
			case 3:
				SNAPSHOT_3 = [];
				SNAPSHOT_LOCKED_3 = [];
				break;
			case 4:
				SNAPSHOT_4 = [];
				SNAPSHOT_LOCKED_4 = [];
				break;
			default:
				"";
		}
	}
	this.getSnapshots=function() {
		//For client GUI purposes
		var snapshotarray = [];
		snapshotarray.push([1, SNAPSHOT_1.length],[2, SNAPSHOT_2.length],[3, SNAPSHOT_3.length],[4, SNAPSHOT_4.length]);
		return snapshotarray;
	}
	this.getMostRecent=function() {
		// Return most recently added element to the history.
		return JSON.parse(JSON.stringify(dataHistoryArray[parseInt(dataHistoryArray.length - 1)].slice(0)));
	}
	this.savePreSnapshotView=function() { }
	this.getPreSnapshotView=function() { }
	// Reset to the 'start state' of the graph.
	this.resetAll = function() {
		DataSetObject.resetData();
		LockedData.resetLockedData();
		REDO_MODE = false;
		UNDO_MODE = false;
		undoCount = 0; redoCount=0;
		dataHistoryArray = Array();
		dataHistoryArray.push([
			JSON.parse(JSON.stringify(DataSetObject.AllDataVals().slice(0))), 
			DataSetObject.AllRowValues().slice(0), 
			DataSetObject.AllColumnValues().slice(0), 
			DATA_INDEX.getXScrollIndex(), 
			DATA_INDEX.getYScrollIndex(),
			""
		]);
	}
}


/** Handles data locking - i.e. if users want to keep a row or column in place whilst scrolling through the rest of the data. */
function LockedData() {
	var lockedRows=[], lockedColumns=[], lockedRowIndices=[], lockedColIndices=[], 
	actualColIndices=[], actualRowIndices=[], lastDataWindow=[];
	var globalLockedCols=[];
	var originalColIndices=[];
	var originalRowIndices=[];
	var mappedColumnIndices=[];
	var mappedRowIndices=[];
	this.getGlobalLockedCols=function() {return globalLockedCols; }
	this.addLockedRows=function(index) {
		var data = DataSetObject.AllDataVals();
		var x = DATA_INDEX.getXScrollIndex();
		var y = DATA_INDEX.getYScrollIndex();
		actualRowIndices.push(index);
		var temparray = [];
		var mydata = this.getLastLockedDataWindow();
		var globalRowIndex = mydata[index][0].row_id;
		var original = mydata[index][0].original_row_id;
		mappedRowIndices.push(parseInt(original));
		temparray = data[globalRowIndex];
		data.splice(globalRowIndex,1);
		originalRowIndices.push(original);
		DataSetObject.remapData(); // IMPORTANT !
		printFriendly(temparray);
		lockedRows.push([index, temparray]);
	}
	this.addLockedColumns=function(index) {
		var data = DataSetObject.AllDataVals();
		var x = DATA_INDEX.getXScrollIndex();
		var y = DATA_INDEX.getYScrollIndex();
		actualColIndices.push(index);
		var temparray = [];
		var mydata = this.getLastLockedDataWindow();
		var globalColIndex = mydata[0][index].col_id;
		var original = mydata[0][index].original_col_id;
		mappedColumnIndices.push(parseInt(original));
		// Store the locked dataset.
		for (var row = 0; row < DataSetObject.TotalMaxRows(); ++row) {
			temparray.push(data[row][globalColIndex]); //holds the values for locked down column
		}
		// Delete the locked column from dataset.
		for (var row = 0; row < DataSetObject.TotalMaxRows(); ++row) {
			data[row].splice(globalColIndex, 1);
		}
		globalLockedCols.push(globalColIndex);
		originalColIndices.push(original);
		DataSetObject.remapData(); // IMPORTANT !
		printFriendly(temparray);
		lockedColumns.push([index, temparray]);
	}
	this.getLockedRows=function() { 
		if(lockedRows.length > 0) {	lockedRows.sort(); return lockedRows; }
		else return lockedRows;
	}
	this.getLockedColumns=function() { 
		if(lockedColumns.length > 0) { lockedColumns.sort(); return lockedColumns; }
		else return lockedColumns; 
	}
	this.clearLockedColumn=function(index) {
		var data = DataSetObject.AllDataVals();
		var y = DATA_INDEX.getYScrollIndex(); 
		var x = DATA_INDEX.getXScrollIndex();
		var mydata = this.getLastLockedDataWindow();
		var globalColIndex = mydata[0][index].original_col_id;
		
		var temp=[];
		if(lockedColumns.length > 0) {
			for(var i=0; i<lockedColumns.length; i++) {
				if(lockedColumns[i][0] == index) {
					temp = lockedColumns[i][1].slice(0);
					lockedColumns.splice(i, 1);
				}
			}
		}
		var insertCount=0;
		originalColIndices.map(function(val) {
			if(globalColIndex > val) {	insertCount++;	}
		});
		
		var arr_index = mappedColumnIndices.indexOf(globalColIndex);
		if(arr_index > -1) { mappedColumnIndices.splice(arr_index, 1); }
		var arr_index2 = actualColIndices.indexOf(index);
		if(arr_index2 > -1) { actualColIndices.splice(arr_index2, 1); }
		var arr_index3 = originalColIndices.indexOf(globalColIndex);
		if(arr_index3 > -1) { originalColIndices.splice(arr_index3, 1); }
		globalColIndex = parseInt(globalColIndex - insertCount);
		
		// Re-insert locked column that has been taken out.
		console.log("Re-inserting column at position: " + globalColIndex);
		for (var row = 0; row < DataSetObject.TotalMaxRows(); ++row) {
			data[row].splice(globalColIndex, 0, temp[row]);
		}
		DataSetObject.remapData(); // IMPORTANT !
		DataSetObject.remapOriginalColumnIndices();
	}
	this.clearLockedRow=function(index) {
		var data = DataSetObject.AllDataVals();
		var y = DATA_INDEX.getYScrollIndex(); 
		var x = DATA_INDEX.getXScrollIndex();
		var mydata = this.getLastLockedDataWindow();
		var globalRowIndex = mydata[index][0].original_row_id;
		
		var temp=[];
		if(lockedRows.length > 0) {
			for(var i=0; i<lockedRows.length; i++) {
				if(lockedRows[i][0] == index) {
					temp = lockedRows[i][1].slice(0);
					lockedRows.splice(i, 1);
				}
			}
		}
		var insertCount=0;
		originalRowIndices.map(function(val) {
			if(globalRowIndex > val) {	insertCount++;	}
		});
		var arr_index = mappedRowIndices.indexOf(globalRowIndex);
		if(arr_index > -1) { mappedRowIndices.splice(arr_index, 1); }
		var arr_index2 = actualRowIndices.indexOf(index);
		if(arr_index2 > -1) { actualRowIndices.splice(arr_index2, 1); }
		var arr_index3 = originalRowIndices.indexOf(globalRowIndex);
		if(arr_index3 > -1) { originalRowIndices.splice(arr_index3, 1); }
		
		globalRowIndex = parseInt(globalRowIndex - insertCount);
		
		// Re-insert locked row that has been taken out.
		data.splice(globalRowIndex, 0, temp);
		DataSetObject.remapData(); // IMPORTANT !
		DataSetObject.remapOriginalRowIndices();
	}
	this.clearLockedRows=function() { lockedRows=[]; }
	this.clearLockedColumns=function() { lockedColumns=[]; }
	this.getActualColumnIndices=function() { return actualColIndices; }
	this.getActualRowIndices=function() { return actualRowIndices; }
	this.setLastLockedDataWindow=function(dw) {	lastDataWindow = JSON.parse(JSON.stringify(dw.slice(0)));	}
	this.getLastLockedDataWindow=function() { return lastDataWindow; }
	this.getMappedColumnIndices=function() { return mappedColumnIndices; }
	this.getMappedRowIndices=function() { return mappedRowIndices; }
	this.resetLockedData=function() {
		lockedRows=[], lockedColumns=[], lockedRowIndices=[], lockedColIndices=[], 
		actualColIndices=[], actualRowIndices=[], lastDataWindow=[], mappedColumnIndices=[],
		mappedRowIndices=[]; globalLockedCols=[]; originalColIndices=[]; originalRowIndices=[];
	}
	this.getAllLockedVariables=function() {
		var giantLockedArray=[];
		giantLockedArray.push(lockedRows.slice(0));
		giantLockedArray.push(lockedColumns.slice(0));
		giantLockedArray.push(lockedRowIndices.slice(0));
		giantLockedArray.push(lockedColIndices.slice(0));
		giantLockedArray.push(actualColIndices.slice(0));
		giantLockedArray.push(actualRowIndices.slice(0));
		giantLockedArray.push(mappedColumnIndices.slice(0));
		giantLockedArray.push(mappedRowIndices.slice(0));
		giantLockedArray.push(globalLockedCols.slice(0));
		giantLockedArray.push(originalColIndices.slice(0));
		giantLockedArray.push(originalRowIndices.slice(0));
		return giantLockedArray;
	}
	this.setAllLockedVariables=function(savedGiantLockedArray) {
		console.log(JSON.stringify(savedGiantLockedArray));
		lockedRows = savedGiantLockedArray[0].slice(0);
		lockedColumns = savedGiantLockedArray[1].slice(0);
		lockedRowIndices = savedGiantLockedArray[2].slice(0);
		lockedColIndices = savedGiantLockedArray[3].slice(0);
		actualColIndices = savedGiantLockedArray[4].slice(0);
		actualRowIndices = savedGiantLockedArray[5].slice(0);
		mappedColumnIndices = savedGiantLockedArray[6].slice(0);
		mappedRowIndices = savedGiantLockedArray[7].slice(0);
		globalLockedCols = savedGiantLockedArray[8].slice(0);
		originalColIndices = savedGiantLockedArray[9].slice(0);
		originalRowIndices = savedGiantLockedArray[10].slice(0);
	}
}

var CHECK_FALSE = function(val) {
    if(val != this.myval) {
        return true;
    } else return false;
}
var CHECK_TRUE = function(val) {
    if(val == this.myval) {
        return true;
    } else return false;
}
var pcount=0;
function resetPrintOnce() { pcount = 0;}
function printOnce(v) {
	if(pcount<1) {
		console.log(v);
		pcount++;
	}
}


/** Create a dataset object so that we can easily extract properties, like row,column names, specific portions of data, etc. */
function DataSetObject(csvfile, xmlfile) {	
	// Each data value as an object with properties.
	var dataValObject = function(id, val, x, y) {
		this.id=id;
		this.x=x; // X coordinate in the grid
		this.y=y; // Y coordinate in the grid
		this.val=val; // The actual value
		this.annotated=false; // Whether user has annotated a datapoint (e.g. pulled a bar)
		this.filtered=false; // Whether this datapoint has been filtered out (i.e. hidden)
		this.row_id=0; // Current row id
		this.col_id=0; // Current col id
		this.original_col_id=0; // Original col id - should NOT be changed
		this.original_row_id=0; // Original row id - should NOT be changed
		this.col_text=""; // Column label
		this.row_text=""; // Row label
		this.init = function() { }
	}
	
	// Get data from the CSV file
	var _CSVDATA = readCSVFile(csvfile);
	// Get metadata of the CSV file - i.e. colours
	var _ROWCOLORS = readMetaData_XML(xmlfile);
	
	_DATAINITIALIZED = true;
	
	var maxrows = _CSVDATA.length-1;
	var maxcols = _CSVDATA[0].length;
	
	var allRows = [];
	for(var row=1; row<maxrows+1; row++) { allRows.push(_CSVDATA[row][0]); }
	
	var allCols = [];
	for(var col=1;col<maxcols; col++) { allCols.push(_CSVDATA[0][col]); }
	
	var allData=[];	var allDataObjects=[]; var count = 0;
	var rowmap = [], colmap = [];
	
	for(var row=1; row<maxrows+1; row++) {
		var temp_data=[];
		var temp_data_object=[];
		allData.push(temp_data);
		allDataObjects.push(temp_data_object);
		rowmap.push(row-1);
		for(var col=1;col<maxcols; col++) {
			temp_data.push(_CSVDATA[row][col]);
			var dataobj = new dataValObject(count, _CSVDATA[row][col], row-1, col-1);
			dataobj.col_id = parseInt(col-1);
			dataobj.original_col_id = parseInt(col-1);
			dataobj.row_id = parseInt(row-1);
			dataobj.original_row_id = parseInt(row-1);
			dataobj.col_text = allCols[parseInt(col-1)];
			dataobj.row_text = allRows[parseInt(row-1)];
			temp_data_object.push(dataobj);
			count++;
		}
	}
	var unchangedDataObjects=JSON.parse(JSON.stringify(allDataObjects.slice(0)));
	
	for(var col=1;col<maxcols; col++) {	colmap.push(col-1); }
	
	var max = allData.reduce(function(max, arr) { return Math.max(max, arr[0]); }, -Infinity);
	console.log("Maximum val is: " + max);
	var min = allData.reduce(function(min, arr) { return Math.min(min, arr[0]); },  Infinity);	
	console.log("Minimum val is: " + min);
	
	// Get the data values, specific to a given grid size, and based on x and y index (if user has been scrolling)
	this.getDataWindow = function() {
		var datawindow=[];
		var data = this.AllDataVals();
		var x = DATA_INDEX.getXScrollIndex();
		var y = DATA_INDEX.getYScrollIndex();
		
		var lockedColumns = LockedData.getLockedColumns();
		var lockedColNum = lockedColumns.length;
		var actualColIndices=LockedData.getActualColumnIndices().slice(0);
		actualColIndices.sort();
		
		var lockedRows = LockedData.getLockedRows();
		var lockedRowNum = lockedRows.length;
		var actualRowIndices=LockedData.getActualRowIndices().slice(0);
		actualRowIndices.sort();
		
		// If no locks are present.
		if(lockedColNum == 0 && lockedRowNum == 0) {
			for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) {
				var data_row = [];
				datawindow.push(data_row);
				for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
					data_row.push(data[row][col]);
				}
			}
			LockedData.setLastLockedDataWindow(datawindow);
			return datawindow;
		}
		else if(lockedColNum > 0 && lockedRowNum == 0) { /* ************ If only columns are locked ***************** */
			// Create the datawindow and only add unlocked columns.
			for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) {
				var data_row = [];
				for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
					data_row.push(data[row][col]);
				}
				if(parseInt(data_row.length + lockedColNum) > _NUMCOLS) { 
					data_row = data_row.slice(0, parseInt(_NUMCOLS-lockedColNum)); 
				}
				datawindow.push(data_row);
			}
			// Now add the locked columns to the appropriate indices.
			for(var i=0; i<lockedColNum; i++) {
				var count=0;
				for(var row=parseInt(y); row<parseInt(_NUMROWS+y); row++) {
					datawindow[count].splice(actualColIndices[i], 0, lockedColumns[i][1][row]);
					count++;
				}
			}
			LockedData.setLastLockedDataWindow(datawindow);
			return datawindow;
		}
		else if(lockedColNum == 0 && lockedRowNum > 0) { /* ************ If only rows are locked ******************* */
			// This shouldn't happen, but better safe than sorry. Probably should be data length from current position, rather than overall data length.
			var y_limit=0;
			if(data.length < parseInt(_NUMROWS+y)) { y_limit = data.length;	} 
			else { y_limit =  parseInt(_NUMROWS+y);	}
			for (var row = parseInt(y); row < y_limit; ++row) {
				var data_row = [];
				for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
					data_row.push(data[row][col]);
				}	
				datawindow.push(data_row);
			}	
			if(parseInt(datawindow.length + lockedRowNum) > _NUMROWS) { 
				datawindow = datawindow.slice(0, parseInt(_NUMROWS-lockedRowNum)); 
			}
			for(var i=0; i<lockedRowNum; i++) {
				var lockedRowChunk=[];
				for(var col=parseInt(x); col<parseInt(_NUMCOLS+x); col++) { lockedRowChunk.push(lockedRows[i][1][col]); }
				datawindow.splice(actualRowIndices[i], 0, lockedRowChunk);
			}
			LockedData.setLastLockedDataWindow(datawindow);
			return datawindow;
		}
	}
	// Get all the values of the dataset
	this.AllDataVals = function() {	return allDataObjects;	}
	this.setAllDataVals = function(data) { 	allDataObjects = data; allData = data; }
	// Get all the row values of the dataset.
	this.AllRowValues = function() { return allRows; }
	this.getRowLabelWindow = function() {
		var dataWindow = this.getDataWindow();
		var labels=[];
		for(var i=0; i<dataWindow.length; i++) {
			labels.push(dataWindow[i][0].row_text)
		}
		return labels;
	}
	// Set all row values, e.g. if rows have been reorganized by user.
	this.setAllRowValues = function(data) { allRows = data;	}
	// Get all the column values of the dataset.
	this.AllColumnValues = function() {	return allCols;	}
	this.getColumnLabelWindow = function() {
		var dataWindow = this.getDataWindow();
		var labels = [];
		for(var i=0; i<dataWindow[0].length; i++) {
			labels.push(dataWindow[0][i].col_text);
		}
		return labels;
	}
	// Set all column values, e.g. if columns are reorganized by user.
	this.setAllColumnValues = function(data) { allCols = data; }
	// Maximum value of the entire dataset.
	this.DataMaxValue = function() { 		
		return (max + ((max-min) * DATAMAX_LIMITER));
	}
	// Minimum value of the entire dataset.
	this.DataMinValue = function() { 
		return (min - (min * DATAMIN_LIMITER));
	}
	// Maximum number of rows in the entire dataset.
	this.TotalMaxRows = function() { return _CSVDATA.length-1;	}
	// Minimum number of rows in the entire dataset.
	this.TotalMaxColumns = function() { return _CSVDATA[0].length;	}
	// Set the row colours, e.g. when user reorganizes columns/rows.
	this.setColors = function(colors) { _ROWCOLORS = colors; }
	// Get the row colours.
	this.getColors = function() { return _ROWCOLORS; }
	this.resetData = function() {
		DATA_INDEX.resetXScrollIndex();	DATA_INDEX.resetYScrollIndex();
		allRows = []; allCols = []; allData=[]; allDataObjects=[]; count=0;
		
		for(var row=1; row<maxrows+1; row++) { allRows.push(_CSVDATA[row][0]); }
		for(var col=1;col<maxcols; col++) { allCols.push(_CSVDATA[0][col]); }		
		
		for(var row=1; row<maxrows+1; row++) {
			var temp_data=[]; var temp_data_object=[]; 
			allData.push(temp_data); allDataObjects.push(temp_data_object);
			for(var col=1;col<maxcols; col++) { 
				temp_data.push(_CSVDATA[row][col]); 
				var dataobj = new dataValObject(count, _CSVDATA[row][col], row-1, col-1);
				dataobj.col_id = parseInt(col-1);
				dataobj.original_col_id = parseInt(col-1);
				dataobj.row_id = parseInt(row-1);
				dataobj.original_row_id = parseInt(row-1);
				dataobj.col_text = allCols[parseInt(col-1)];
				dataobj.row_text = allRows[parseInt(row-1)];
				temp_data_object.push(dataobj);
				count++;
			}
		}
	}
	this.remapData = function() {
		var data = this.AllDataVals();
		for(var row=0; row<data.length; row++) {
			for(var col=0;col<data[row].length; col++) {
				data[row][col].col_id = parseInt(col);
				data[row][col].row_id = parseInt(row);
			}
		}
	}
	this.remapOriginalColumnIndices = function() {
		var locked = LockedData.getMappedColumnIndices().sort();
		var data = this.AllDataVals();
		console.log("remapping original column indices. Locked: " + JSON.stringify(locked));
		for(var row=0; row<data.length; row++) {
			var colCount=0;
			for(var col=0;col<data[row].length; col++) {
				var temp = col;
				locked.map(function(val) {
					if(temp == val) { colCount++; }
					temp++; // Checks for subsequent locked columns.
				});
				data[row][col].original_col_id = parseInt(colCount);
				colCount++;
			}
		}
	}
	this.remapOriginalRowIndices = function() {
		var locked = LockedData.getMappedRowIndices().sort();
		var data = this.AllDataVals();
		console.log("remapping original row indices");
		var rowCount=0;
		for(var row=0; row<data.length; row++) {
			var temp = row;
			locked.map(function(val) {
				if(temp == val) { rowCount++; }
				temp++; // Checks if there are subsequent locked rows.
			});
			for(var col=0;col<data[row].length; col++) {
				data[row][col].original_row_id = parseInt(rowCount);
			}
			rowCount++;
		}
	}
	// Unused functions (but could be interesting).
	this.resetColumnData = function() {	}
	this.resetRowData = function() { }
}

/* Data Navigation Functions: Handle data scrolling on the x and y axis */
/** Increment/decrement X axis index. */
function dataScrollX(pos) {	DATA_INDEX.setXScrollIndex(pos); }
/** Increment/decrement Y axis index. */
function dataScrollY(pos) {	DATA_INDEX.setYScrollIndex(pos); }
/* End Data Navigation Functions */

/* Data Organization functions */
/** Swap two elements of an array and return the array. */
function swap(arr, a, b) { var tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp; return arr; }
/** Swap an array within an array. */
function swapInner(arr, a, b){ for(var row=0; row<DataSetObject.TotalMaxRows(); ++row){ swap(arr[row], a, b); } return arr; }
/** Tell the system to swap a column (lower panel columns). */
function swapCol(c1, c2) {
	// Bail if nothing to do.
	if (c1 == c2) return;
	var colorset = DataSetObject.getColors();
	//swap(colorset, c1, c2); // I suppose this would be needed if colors are set by column rather than row
	DataSetObject.setColors(colorset);
	updateGlobalDataSet("COLUMN", c1, c2);
}
function swapRow(r1, r2) {
	// Bail if nothing to do.
	if (r1 == r2) return;
	var colorset = DataSetObject.getColors();
	swap(colorset, r1, r2);
	DataSetObject.setColors(colorset);
	updateGlobalDataSet("ROW", r1, r2);
}
/** Update all columns, rows and data of the entire dataset. */
function updateGlobalDataSet(axis, rc1, rc2) {
	var data = DataSetObject.AllDataVals();
	var currentWindow = DataSetObject.getDataWindow();
	if(axis == "COLUMN") {
		var cols = DataSetObject.AllColumnValues();
		var xindex = DATA_INDEX.getXScrollIndex();
		var rc1_orig = rc1;
		var rc2_orig = rc2;		

		rc1 = currentWindow[0][rc1_orig].col_id;
		rc1_o = currentWindow[0][rc1_orig].original_col_id;
		rc2 = currentWindow[0][rc2_orig].col_id
		rc2_o = currentWindow[0][rc2_orig].original_col_id

		for (var row = 0; row < DataSetObject.TotalMaxRows(); ++row) {
			data[row][rc2].original_col_id = rc1_o;
			data[row][rc2].col_id = rc1;
			data[row][rc1].original_col_id = rc2_o;
			data[row][rc1].col_id = rc2;
		}
		data = swapInner(data, rc1, rc2);
	}
	// Update rows and dataset
	if(axis == "ROW") {
		var rows = DataSetObject.AllRowValues();
		var yindex = DATA_INDEX.getYScrollIndex();
		var rc1_orig = rc1;
		var rc2_orig = rc2;
		
		rc1 = currentWindow[rc1_orig][0].row_id;
		rc1_o = currentWindow[rc1_orig][0].original_row_id;
		rc2 = currentWindow[rc2_orig][0].row_id;
		rc2_o = currentWindow[rc2_orig][0].original_row_id;
		
		for (var col = 0; col < DataSetObject.TotalMaxColumns()-1; ++col) {
			data[rc2][col].original_row_id = rc1_o;
			data[rc2][col].row_id = rc1;
			data[rc1][col].original_row_id = rc2_o;
			data[rc1][col].row_id = rc2;
		}
		rows = swap(rows, rc1, rc2);
		data = swap(data, rc1, rc2);
		DataSetObject.setAllRowValues(rows);
	}
	// This should be updating the entire dataset (kept separate from datawindow)
	DataSetObject.setAllDataVals(data); 
}
/* End Data Organization Functions */


/* Data Annotation functions */
function annotateDataPoint(row, col) {
	var data = DataSetObject.AllDataVals();
	var xindex = DATA_INDEX.getXScrollIndex(); // apply to columns
	var yindex = DATA_INDEX.getYScrollIndex(); // apply to rows
	
	var mywindow = DataSetObject.getDataWindow();
	var actual_x = mywindow[row][col].row_id;
	var actual_y = mywindow[row][col].col_id;

	if(data[actual_x][actual_y].annotated == false && data[actual_x][actual_y].filtered == false) {
		data[actual_x][actual_y].annotated = true;
		DataHistory.add();
		logData(","+timestamp()+",ANNOTATIE_BAR, ANNOTATION, EMERGE_SYSTEM");
	}
	else if(data[actual_x][actual_y].annotated == true && data[actual_x][actual_y].filtered == false) {
		data[actual_x][actual_y].annotated = false;
		DataHistory.add();
		logData(","+timestamp()+",REMOVE_ANNOTATED, ANNOTATION, EMERGE_SYSTEM");
	}
	else if(data[actual_x][actual_y].filtered == true && data[actual_x][actual_y].annotated == false) {
		data[actual_x][actual_y].filtered = false;
		DataHistory.add();
		logData(","+timestamp()+",REMOVE_FILTERED, FILTERING, EMERGE_SYSTEM");
	}
	
	DataSetObject.setAllDataVals(data);
}
/* End Data Annotation Functions */



/* **** Data Filtering functions **** */

// Data points need to be filtered in 2 modes - single points, and comparing 2 rows (where everything else is filtered out/hidden).
function filterDataPoint(row, col) {
	var mywindow = DataSetObject.getDataWindow();
	var actual_x = mywindow[row][col].row_id;
	var actual_y = mywindow[row][col].col_id;
	// TO DO - fix this, as it's causing inconsistencies
	filterCoordinates.push([parseInt(row), parseInt(col)]);
	
	PRESS_COMPARE_COUNTER++;
	/* Start timer to detect whether we need to compare two rows or filter out a single point. Timer is set to 
	 * detect presses within a specific timeframe. */
	if(COMPARE_TIMER_STARTED == false) {
		COMPARE_TIME_1 = timestamp();
		beginCompareTimer();
	}
}
// Filter a single data point.
function filterSingleDataPoint() {
	console.log("filtering single data point");
	var data = DataSetObject.AllDataVals();
	var xindex = DATA_INDEX.getXScrollIndex(); // apply to columns
	var yindex = DATA_INDEX.getYScrollIndex(); // apply to rows
	
	var mywindow = DataSetObject.getDataWindow();
	var actual_x = mywindow[filterCoordinates[i][0]][filterCoordinates[i][1]].row_id;
	var actual_y = mywindow[filterCoordinates[i][0]][filterCoordinates[i][1]].col_id;
	
	for(var i=0; i<filterCoordinates.length; i++) {
		data[actual_x][actual_y].filtered = true;
		data[actual_x][actual_y].annotated = false;
	}
	if(LOGGING_ENABLED == true) { logData(","+timestamp()+",FILTER_SINGLE_VALUE, FILTERING, EMERGE_SYSTEM"); }
	DataSetObject.setAllDataVals(data);
	DataHistory.add();
	filterCoordinates = Array();
}
// Compare two rows or columns, keep these ones and filter out the rest of the data window.
function filterCompare(mode, grp1, grp2, param1, param2) {
	var data = DataSetObject.AllDataVals();
	var xindex = DATA_INDEX.getXScrollIndex(); // apply to columns
	var yindex = DATA_INDEX.getYScrollIndex(); // apply to rows
	if(mode == "COMPARE_COL") {
		// Columns according to normal orientation.
		console.log("Comparing columns");
		grp1 = parseInt(grp1);
		grp2 = parseInt(grp2);
		
		var mywindow = DataSetObject.getDataWindow();
		var actualcol_1 = mywindow[param1][grp1].col_id;
		var actualcol_2 = mywindow[param2][grp2].col_id;
		
		// Get number of columns locked and subtract that from the total numcols + xindex
		// or just replace data with datawindow
		
		for(var i=yindex; i<(_NUMROWS+yindex); i++) {
			for(var j=xindex; j<(_NUMCOLS+xindex); j++) {
				if(j != actualcol_1 && j != actualcol_2) {
					data[i][j].filtered = true;
				}
			}
		}
		if(LOGGING_ENABLED == true) { logData(","+timestamp()+",COMPARE_COLUMNS, FILTERING, EMERGE_SYSTEM"); }
	} else if(mode == "COMPARE_ROW") {
		// Rows according to normal orientation.
		console.log("Comparing rows");
		grp1 = parseInt(grp1);
		grp2 = parseInt(grp2);
		for(var i=yindex; i<(_NUMROWS+yindex); i++) {
			if(i != grp1 && i != grp2) {
				for(var j=xindex; j<(_NUMCOLS+xindex); j++) {
					data[i][j].filtered = true;
				}
			}
		}
		if(LOGGING_ENABLED == true) { logData(","+timestamp()+",COMPARE_ROWS, FILTERING, EMERGE_SYSTEM"); }
	}
	DataHistory.add();
	DataSetObject.setAllDataVals(data);
}
/* Checks whether synchronous presses are detected within a timeframe (i.e. if two data points side-by-side are pressed within this timeframe, 
 * it is assumed they are pressed consecutively for comparison).
 */
function beginCompareTimer() {
	COMPARE_TIMER_STARTED = true;
	COMPARE_TIME_2 = timestamp();
	if(PRESS_COMPARE_COUNTER == 2 && (COMPARE_TIME_2 - COMPARE_TIME_1) < FILTER_COMPARISON_INTERVAL) {
		// If two datapoints are selected, and are along the edges of the graph, then compare those two rows or columns.
		// TO DO - need to make below more efficient, MASSIVE IF STATEMENTS!!! ARGH!
		if(filterCoordinates.length > 1) {
			if((filterCoordinates[0][0] == 0 && filterCoordinates[1][0] == 0 && filterCoordinates[1][1] == 1) || (filterCoordinates[1][0] == 0 && filterCoordinates[0][0] == 0 && filterCoordinates[0][1] == 1) ||
			(filterCoordinates[0][0] == 0 && filterCoordinates[1][0] == 0 && filterCoordinates[1][1] == 8) || (filterCoordinates[1][0] == 0 && filterCoordinates[0][0] == 0 && filterCoordinates[0][1] == 8) || 
			(filterCoordinates[0][0] == 9 && filterCoordinates[1][0] == 9 && filterCoordinates[1][1] == 1) || (filterCoordinates[1][0] == 9 && filterCoordinates[0][0] == 9 && filterCoordinates[0][1] == 1) ||
			(filterCoordinates[0][0] == 9 && filterCoordinates[1][0] == 9 && filterCoordinates[1][1] == 8) || (filterCoordinates[1][0] == 9 && filterCoordinates[0][0] == 9 && filterCoordinates[0][1] == 8)){
				console.log("compare columns, special");
				filterCompare("COMPARE_COL", filterCoordinates[0][1], filterCoordinates[1][1], filterCoordinates[0][0], filterCoordinates[1][0]);
			}
			else if((filterCoordinates[0][1] == 0 && filterCoordinates[1][1] == 0 && filterCoordinates[1][0] == 1) || (filterCoordinates[1][1] == 0 && filterCoordinates[0][1] == 0 && filterCoordinates[0][0] == 1) ||
			(filterCoordinates[0][1] == 0 && filterCoordinates[1][1] == 0 && filterCoordinates[1][0] == 8) || (filterCoordinates[1][1] == 0 && filterCoordinates[0][1] == 0 && filterCoordinates[0][0] == 8) ||
			(filterCoordinates[0][1] == 9 && filterCoordinates[1][1] == 9 && filterCoordinates[1][0] == 1) || (filterCoordinates[1][1] == 9 && filterCoordinates[0][1] == 9 && filterCoordinates[0][0] == 1) ||
			(filterCoordinates[0][1] == 9 && filterCoordinates[1][1] == 9 && filterCoordinates[1][0] == 8) || (filterCoordinates[1][1] == 9 && filterCoordinates[0][1] == 9 && filterCoordinates[0][0] == 8)){
				console.log("compare rows, special");
				filterCompare("COMPARE_ROW", filterCoordinates[0][0], filterCoordinates[1][0]);
			}
			else if((filterCoordinates[0][0] == 0 && filterCoordinates[1][0] == 0) || (filterCoordinates[0][0] == 9 && filterCoordinates[1][0] == 9)) {
				console.log("compare columns");
				filterCompare("COMPARE_COL", filterCoordinates[0][1], filterCoordinates[1][1], filterCoordinates[0][0], filterCoordinates[1][0]);
			}
			else if((filterCoordinates[0][1] == 0 && filterCoordinates[1][1] == 0) || (filterCoordinates[0][1] == 9 && filterCoordinates[1][1] == 9)) {
				console.log("compare rows");
				filterCompare("COMPARE_ROW", filterCoordinates[0][0], filterCoordinates[1][0]);
			}
			else {
				filterSingleDataPoint();
			}
		}
		COMPARE_TIMER_STARTED = false;
		PRESS_COMPARE_COUNTER = 0;
		COMPARE_TIME_2 = 0; COMPARE_TIME_1 = 0;
		filterCoordinates = Array();
		return;
	} 
	else if((COMPARE_TIME_2 - COMPARE_TIME_1) > FILTER_COMPARISON_INTERVAL) {
		// Time is up - filter single data point.
		COMPARE_TIMER_STARTED = false;
		PRESS_COMPARE_COUNTER = 0;
		COMPARE_TIME_2 = 0; COMPARE_TIME_1 = 0;
		rowcomparison_array = Array();
		filterSingleDataPoint();
		return;
	}
	setTimeout(function() {
		beginCompareTimer();
	}, FILTER_COMPARISON_TIMER_TICK);
}

/* **** End Data Filtering functions. **** */


/* DataSet parsing functions: extract dataset, row values, column values, etc. */
/** Read values from a CSV file. */
function readCSVFile(file) {
	var rawFile = new XMLHttpRequest();
	var allText="";
	rawFile.open("GET", file, false);
	rawFile.onreadystatechange = function () {
		if(rawFile.readyState === 4) {
			if(rawFile.status === 200 || rawFile.status == 0) { allText = rawFile.responseText;	}
		}
	}
	rawFile.send(null);
	var lines = allText.split(/\r|\r?\n/g);
	for (var line in lines) { 
		lines[line] = lines[line].split(","); 
	}
	return lines;
}
/** Read the metadata file associated with the CSV file. */
function readMetaData_XML(file) {
	var rawFile = new XMLHttpRequest();
	var allText="";
	rawFile.open("GET", file, false);
	rawFile.onreadystatechange = function () {
		if(rawFile.readyState === 4) {
			if(rawFile.status === 200 || rawFile.status == 0) { allText = rawFile.responseText;	}
		}
	}
	rawFile.send(null);
	var parseString = require('xml2js').parseString;
	var colors="";
	parseString(allText, function(err, result) {
		colors = result['dataInfo']['colorCoding'][0].palette[0].color;
	});
	var rows=[];
	for(var i=0; i<colors.length; i++) {
		rows.push({ r : colors[i].$.r, g : colors[i].$.g, b : colors[i].$.b });
	}
	return rows;
}
/* End DataSet parsing functions */

/* General Functions */
/** Function to append to file for logging purposes - i.e. for the collaboration user study. */
function logData(data) {
	data = data + "\r\n";
	//TO DO: check if file exists, if not, create file, then append
	fs.appendFile('logs/EMERGE_LOG.txt', data, function (err) {
		if(err) { return console.log("Could not write to file \r\n" + err); }
		else { }
	});
}
/** Get current time in milliseconds. */
function timestamp() {
	var d = new Date();
	return d.getTime();
}
/** Set options for sending JSON data string, and return the JSON string. This is to be sent to the EMERGE application. */
function sendBigJSONdata(params) {
	var JSONString = "{}";
	var JSON_Object = JSON.parse(JSONString);
	if(params.dataset == true) { JSON_Object['data'] = DataSetObject.getDataWindow(); }
	if(params.rowcolors == true) { JSON_Object['rowcolors'] = DataSetObject.getColors(); }
	if(params.minz == true) { JSON_Object["minz"] = DataSetObject.DataMinValue(); }
	if(params.maxz == true) { JSON_Object["maxz"] = DataSetObject.DataMaxValue(); }
	if(params.animationTime == true) { JSON_Object["animTime"] = _ANIMATION_TIME; }
	JSONString = JSON.stringify(JSON_Object);
	return JSONString;
}

/** Show an array legibly. */
function printFriendly(array) {
	var str="";
	for(var i=0; i<array.length; i++) {
		str+=array[i].val+", ";
	}	
	console.log("Locking these values: " + str + "\r\n");
}

/** Make the DEBUG values legible */
function parseDebugMessage(message) {
	var parsedmsg = JSON.parse(message);
	var parseddata = parsedmsg.data;
	var str="";
	for(var i=0; i<parseddata.length; i++) {
		for(var j=0; j<parseddata[i].length; j++) {
			str += (j==(parseddata[i].length - 1)) ? parseddata[i][j].val : parseddata[i][j].val + ", ";
		}
		console.log("Row "+i+" : " + str); str="";
	}
	console.log("\r\n");
	//console.log(JSON.stringify(DataSetObject.getColumnLabelWindow()));
	//console.log(JSON.stringify(DataSetObject.getRowLabelWindow()));
	console.log("\r\n \r\n");
}
/** Reset all variables. */
function resetAll() {
	console.log("\r\nResetting Dataset\r\n");
	_DATASET_WINDOW	= [];
	_ALL_DATA = [];
	_DATAINITIALIZED = false;
	DataSetObject.resetData();
}
/** Create a zeroed data block. */
function emptyBlock() {
	var data = [];
	for (var row = 0; row < _NUMROWS; ++row){ var data_row = []; data.push(data_row);
		for (var col = 0; col < _NUMCOLS; ++col){ data_row.push( 0.0 );	}
	}
	return data;
}
/** Reverse the row numbers. */
function reverseRowNumbers(rownum) {
	return (_NUMROWS-1) - rownum;
}
function biggerOrEqualToZero(element, index, array) { return element >= 0; }
function equalToZero(element, index, array) {  return element == 0; }
/** Keep a number within a given range. */
Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max); };

/** Move Array element from one position to another. */
Array.prototype.move = function (old_index, new_index) {
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this; // for testing purposes
};
/** Gets the minimum value from the array. */
Array.min = function( array ){
    return Math.min.apply( Math, array );
};