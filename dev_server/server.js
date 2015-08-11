/*
* Central application server for the EMERGE system.
* Handles communication between various clients, e.g. interface panels and the EMERGE application.
* Updates dataset, informs about interactions, stores state variables.
*
* Created 29-05-2015.
*/


/*
*
* TO DO;
* - Sort out what happens if other panels are added (e.g. data reset handling)
* - ASSIGN IDs TO ROWS AND COLUMNS FOR TRACKING EVENTS:
* 		- reset individual panels while preserving the row orders, etc. of the other.
* 		- UNDO/REDO functionality: store state (store indices rather than actual dataset).
* - Make data values into data objects so they have properties like id, annotated, and filtered.
*
* NOTE: In C#, dataobject accessed using following example syntax - parsedData["data"][x][y]["val"];
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
var _CSVFILE			= "Rainfall-v2.csv";
var _XMLCOLOURSFILE		= "Rainfall-v2.metadata";
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
var FILTER_COMPARISON_INTERVAL 		= 500;
var FILTER_COMPARISON_TIMER_TICK 	= 50;
var rowcomparison_array = Array();
var filterCoordinates = Array();

// Dataset to use
var DataSetObject 		= new DataSetObject(_DATAREPO+_CSVFILE, _DATAREPO+_XMLCOLOURSFILE); // Initialize the dataset
var DATA_INDEX 			= new DataIndex(); // Initialize data index tracking object
var DataHistory 		= new DataHistory();
var LockedData			= new LockedData();
var DATAMAX_LIMITER		= 0.9;
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

// Socket function variables - Broadcast variables.
var DATASET_WINDOW_UPDATE			= "DATASET_WINDOW_UPDATE"; // broadcast and globally update the dataset window values
var DATASET_WINDOW_UPDATE_LIMITED 	= "DATASET_WINDOW_UPDATE_LIMITED";
var DATASET_X_SCROLLBAR_UPDATE		= "DATASET_X_SCROLLBAR_UPDATE";
var DATASET_Y_SCROLLBAR_UPDATE		= "DATASET_Y_SCROLLBAR_UPDATE";
var DATASET_X_LABEL_UPDATE			= "DATASET_X_LABEL_UPDATE";
var DATASET_Y_LABEL_UPDATE			= "DATASET_Y_LABEL_UPDATE";

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
	socket.on("clientConnection", function (clientid, callback) {
		console.log("\r\nClient "+clientid+" has connected! \r\n");
		_CLIENTCOUNTER++; // Incrememnt the client counter.
		callback("CONNECTED"); // Once data loaded, etc. respond to client.
    });
	socket.on("EMERGEClient", function(clientid) {
		console.log("\r\nClient "+clientid+" has connected!\r\n");
		_CLIENTCOUNTER++;
	});
	/* Relay requests */
	socket.on(DATASET_WINDOW_UPDATE, function() {
		socket.emit(DATASET_WINDOW_UPDATE, sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	
	socket.on("UPDATE_GUI", function(client) {
		// socket.emit = local, socket.broadcast.emit = global
		socket.emit(DATASET_X_LABEL_UPDATE, JSON.stringify({columns:DataSetObject.AllColumnValues()}));
		socket.broadcast.emit(DATASET_X_LABEL_UPDATE, JSON.stringify({columns:DataSetObject.AllColumnValues()}));
		socket.emit(DATASET_X_SCROLLBAR_UPDATE, JSON.stringify({xindex:DATA_INDEX.getXScrollIndex(), xlabels:DataSetObject.AllColumnValues()}));
		socket.broadcast.emit(DATASET_X_SCROLLBAR_UPDATE, JSON.stringify({xindex:DATA_INDEX.getXScrollIndex(), xlabels:DataSetObject.AllColumnValues()}));
		socket.emit(DATASET_Y_LABEL_UPDATE, JSON.stringify({rows:DataSetObject.AllRowValues()}));
		socket.broadcast.emit(DATASET_Y_LABEL_UPDATE, JSON.stringify({rows:DataSetObject.AllRowValues()}));
		socket.emit(DATASET_Y_SCROLLBAR_UPDATE, JSON.stringify({yindex:DATA_INDEX.getYScrollIndex(), ylabels:DataSetObject.AllRowValues()}));
		socket.broadcast.emit(DATASET_Y_SCROLLBAR_UPDATE, JSON.stringify({yindex:DATA_INDEX.getYScrollIndex(), ylabels:DataSetObject.AllRowValues()}));
	});
	
	/* Request Handlers */
	socket.on(REQUEST_COLUMN_LENGTH, function(message, callback) {
		var clength = DataSetObject.TotalMaxColumns();
		callback(clength);
	});
	socket.on(REQUEST_ALLCOLUMNS, function(message, callback) {
		var cdata = DataSetObject.AllColumnValues();
		var send_xindex = DATA_INDEX.getXScrollIndex();
		callback(JSON.stringify({data:cdata, xindex:send_xindex}));
	});
	
	socket.on(REQUEST_ROW_LENGTH, function(message, callback) {
		var rlength = DataSetObject.TotalMaxRows();
		callback(rlength);
	});
	socket.on(REQUEST_ALLROWS, function(message, callback) {
		var rdata = DataSetObject.AllRowValues();
		var send_yindex = DATA_INDEX.getYScrollIndex();
		callback(JSON.stringify({data:rdata, yindex:send_yindex}));
	});
	/* End Request Handlers*/
	
	/* Action Handlers */
	socket.on(COL_SWAP, function (message) {
		var colstoswap = JSON.parse(message);
		swapCol(colstoswap.column_1, colstoswap.column_2);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		DataHistory.add();
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
		socket.broadcast.emit(DATASET_X_LABEL_UPDATE, JSON.stringify({columns:DataSetObject.AllColumnValues()}));
		socket.broadcast.emit(DATASET_X_SCROLLBAR_UPDATE, JSON.stringify({xindex:DATA_INDEX.getXScrollIndex(), xlabels:DataSetObject.AllColumnValues()}));
	});
	socket.on(UPDATE_DATASET_SCROLLX, function(message, callback) {
		var params = JSON.parse(message);
		var pos = params.position;
		dataScrollX(pos);
		DataHistory.add();
		// Send back new labels on client GUI
		callback(JSON.stringify(DataSetObject.AllColumnValues()));
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
		socket.broadcast.emit(DATASET_X_SCROLLBAR_UPDATE, JSON.stringify({xindex:DATA_INDEX.getXScrollIndex(), xlabels:DataSetObject.AllColumnValues()}));
	});
	
	socket.on(ROW_SWAP, function (message) {
		var rowstoswap = JSON.parse(message);
		swapRow(rowstoswap.row_1, rowstoswap.row_2);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		DataHistory.add();
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
		socket.broadcast.emit(DATASET_Y_LABEL_UPDATE, JSON.stringify({rows:DataSetObject.AllRowValues()}));
		socket.broadcast.emit(DATASET_Y_SCROLLBAR_UPDATE, JSON.stringify({yindex:DATA_INDEX.getYScrollIndex(), ylabels:DataSetObject.AllRowValues()}));
	});
	socket.on(UPDATE_DATASET_SCROLLY, function(message, callback) {
		var params = JSON.parse(message);
		var pos = params.position;
		dataScrollY(pos);
		DataHistory.add();
		// Send back new labels on client GUI
		callback(JSON.stringify(DataSetObject.AllRowValues()));
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
		socket.broadcast.emit(DATASET_Y_SCROLLBAR_UPDATE, JSON.stringify({yindex:DATA_INDEX.getYScrollIndex(), ylabels:DataSetObject.AllRowValues()}));
	});
	socket.on(SET_ANNOTATED, function(data) {
		//TO DO fix that this gets called multiple times - maybe fix in c# code.
		var annotated_coords = JSON.parse(data);
		var annotated_row = annotated_coords["annotated_coordinate"][0];
		var annotated_col = annotated_coords["annotated_coordinate"][1];
		annotateDataPoint(annotated_row, annotated_col);
		DataHistory.add();
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		//console.log("Row: " + annotated_row + ", Col: "+annotated_col);
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
		DataHistory.add();
		//parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	/* Undo and Redo commands. */
	socket.on(ACTION_UNDO, function(data, callback) {
		DataHistory.undo();
		callback("SUCCESS");
	});
	socket.on(ACTION_REDO, function(data, callback) {
		DataHistory.redo();
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
	// Base values (start state)
	dataHistoryArray.push([
		JSON.parse(JSON.stringify(DataSetObject.AllDataVals().slice(0))), 
		DataSetObject.AllRowValues().slice(0), 
		DataSetObject.AllColumnValues().slice(0), 
		DATA_INDEX.getXScrollIndex(), 
		DATA_INDEX.getYScrollIndex()
	]);
	// Store a copy of the dataset, including indices, row and columns, etc.
	this.add = function() {
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
			DATA_INDEX.getYScrollIndex()
		]);
		// Needs to access the data back one step.
		undoCount = dataHistoryArray.length-1;
		redoCount = dataHistoryArray.length-1;
	}
	// Go back into the data history.
	this.undo = function() {
		if(undoCount >= 0) {
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
		if(redoCount <= dataHistoryArray.length) {
			REDO_MODE = true;
			if(redoCount < dataHistoryArray.length-1) { redoCount++; }
			DataSetObject.setAllDataVals(dataHistoryArray[redoCount][0].slice(0)); 
			DataSetObject.setAllRowValues(dataHistoryArray[redoCount][1].slice(0));
			DataSetObject.setAllColumnValues(dataHistoryArray[redoCount][2].slice(0)); 
			DATA_INDEX.setXScrollIndex(dataHistoryArray[redoCount][3]);
			DATA_INDEX.setYScrollIndex(dataHistoryArray[redoCount][4]);
			undoCount = redoCount;
		}
	}
	// Reset to the 'start state' of the graph.
	this.resetAll = function() {
		DataSetObject.resetData();
		REDO_MODE = false;
		UNDO_MODE = false;
		undoCount = 0; redoCount=0;
		dataHistoryArray = Array();
		dataHistoryArray.push([
			JSON.parse(JSON.stringify(DataSetObject.AllDataVals().slice(0))), 
			DataSetObject.AllRowValues().slice(0), 
			DataSetObject.AllColumnValues().slice(0), 
			DATA_INDEX.getXScrollIndex(), 
			DATA_INDEX.getYScrollIndex()
		]);
	}
}

function LockedData() {
	var lockedRows=[], lockedColumns=[];
	this.addLockedRows=function(index) {
		var data = DataSetObject.AllDataVals();
		var x = DATA_INDEX.getXScrollIndex();
		var y = DATA_INDEX.getYScrollIndex();
		index = parseInt(index+y);
		var temparray = [];
		for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) { 
			if(row == index) {
				for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
					data[index][col].locked = true;	
					temparray.push(data[index][col]); //holds the values for locked down column
				}
			}
		}
		lockedRows.push([index, temparray]);
	}
	this.addLockedColumns=function(index) {
		var data = DataSetObject.AllDataVals();
		var x = DATA_INDEX.getXScrollIndex();
		var y = DATA_INDEX.getYScrollIndex();
		index = parseInt(index+x);
		var temparray = [];
		for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) { 
			data[row][index].locked = true;	
			temparray.push(data[row][index]); //holds the values for locked down column
		}
		lockedColumns.push([index, temparray]);
	}
	this.getLockedRows=function() { return lockedRows; }
	this.getLockedColumns=function() { return lockedColumns; }
	this.clearLockedRows=function() { lockedRows=[]; }
	this.clearLockedColumns=function() { lockedColumns=[]; }
}

function biggerOrEqualToZero(element, index, array) { return element >= 0; }
function equalToZero(element, index, array) {  return element == 0; }

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

// DELETE
LockedData.addLockedColumns(0);
LockedData.addLockedColumns(1);
LockedData.addLockedColumns(5);

LockedData.addLockedRows(0);
LockedData.addLockedRows(1);

var col_lockenabled = true;
var row_lockenabled = false;
parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));

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
		this.locked=false;
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
			temp_data_object.push(dataobj);
			count++;
		}
	}
	for(var col=1;col<maxcols; col++) {	colmap.push(col-1); }
	
	var max = allData.reduce(function(max, arr) { return Math.max(max, arr[0]); }, -Infinity);
	var min = allData.reduce(function(min, arr) { return Math.min(min, arr[0]); },  Infinity);	
	
	// Get the data values, specific to a given grid size, and based on x and y index (if user has been scrolling)
	this.getDataWindow = function() {
		var datawindow=[];
		var data = this.AllDataVals();
		var x = DATA_INDEX.getXScrollIndex();
		var y = DATA_INDEX.getYScrollIndex();
		
		// TO DO - REMOVE THIS ONCE IMPLEMENTED
		if(col_lockenabled == false && row_lockenabled == false) {
			for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) {
				var data_row = [];
				datawindow.push(data_row);
				for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
					data_row.push(data[row][col]);
				}
			}
			return datawindow;
		}
		else if(col_lockenabled == true) {
			// All this stuff is mainly for the column mode anyway
			// Need to handle row locking after this - should hopefully be slightly simpler
			// ********************* IMPORTANT - NEED TO HANDLE IF THERE IS A ROW LOCKED - get datawindow with row locked ***************************
			// Could checked for locked == true on rows, and then if true, get those values
			
			var lockedColumns = LockedData.getLockedColumns();
			var lockedColNum = lockedColumns.length;
			var lockedIndices = [];
			var lockedIndicesGrid = [];
			for(var i=0; i<lockedColNum; i++) {
				if((lockedColumns[i][0] - x) >= 0) {
					lockedIndices.push((lockedColumns[i][0] - x));
				}
				lockedIndicesGrid.push(lockedColumns[i][0]);
			}			
			
			for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) {
				var data_row = [];
				for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
					if(lockedIndices.length > 0 && lockedIndices.every(biggerOrEqualToZero)) {
						if(lockedIndices.every(CHECK_FALSE, {myval:col-x})) {
							data_row.push(data[row][col]);
						}
					}	
					else {
						if(col < parseInt(_NUMCOLS+x)-lockedColNum)
						data_row.push(data[row][col+lockedColNum]);
					}
				}
				if(lockedIndices.length >0) { data_row = data_row.slice((lockedColNum - lockedIndices.length), data_row.length); }
				datawindow.push(data_row);
			}						
			for(var i=0; i<lockedColNum; i++) {
				for(var j=0; j<datawindow.length; j++) {
					datawindow[j].push(lockedColumns[i][1][j]); //Index 1 is values 
				}
			}
			var newwindow=[]; lockedIndicesGrid = lockedIndicesGrid.sort();			
			//console.log(JSON.stringify(lockedIndicesGrid) + " | " + startindex + " | datawindow length: " + datawindow.length); 
			for(var i=0; i<datawindow.length; i++) {
				var s=[]; var count=0;
				var startindex = (datawindow.length - lockedIndicesGrid.length);
				for(var j=0; j<datawindow[i].length; j++) {
					if(lockedIndicesGrid.indexOf(j) != -1) {
						s.push(datawindow[i][startindex]);
						startindex++;
					}
					else if(lockedIndicesGrid.indexOf(j) == -1) {
						s.push(datawindow[i][count]);
						count++;
					}
				}
				newwindow.push(s);
			}
			return newwindow;
		}   // --------------------------------------------------------------------------------------------------------------------------
		else if(row_lockenabled == true) {
			// All this stuff is mainly for the column mode anyway
			// Need to handle row locking after this - should hopefully be slightly simpler
			var lockedRows = LockedData.getLockedRows();
			var lockedRowNum = lockedRows.length;
			var lockedIndices = [];
			var lockedIndicesGrid = [];
			for(var i=0; i<lockedRowNum; i++) {
				if((lockedRows[i][0] - y) >= 0) {
					lockedIndices.push((lockedRows[i][0] - y));
				}
				lockedIndicesGrid.push(lockedRows[i][0]);
			}			
			
			//console.log(JSON.stringify(lockedRows));
			console.log(x);
			for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) {
				var data_row = []; resetPrintOnce();
				for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
					if(lockedIndices.length > 0 && lockedIndices.every(biggerOrEqualToZero)) {
						if(lockedIndices.every(CHECK_FALSE, {myval:row-y})) {
							data_row.push(data[row][col]);
						}
					}	
					else {
						if(row < parseInt(_NUMROWS+y)-lockedRowNum)
						data_row.push(data[row+lockedRowNum][col]);
					}
				}
				//if(lockedIndices.length >0) { data_row = data_row.slice((lockedRowNum - lockedIndices.length), data_row.length); } //not for here
				
				if(data_row.length > 0) {
					datawindow.push(data_row);
				}
			}	
			
			if(lockedIndices.length >0) { 
				if((lockedRowNum - lockedIndices.length) > 0) {
					datawindow.splice((0),1);  
				}
			}
			
			for(var i=0; i<lockedRowNum; i++) {
				datawindow.push(lockedRows[i][1]); //Index 1 is values 
			}
			
			
			// Reorder stuff
			var newwindow=[]; lockedIndicesGrid = lockedIndicesGrid.sort();		
			//console.log(JSON.stringify(lockedIndicesGrid) + " | " + startindex + " | datawindow length: " + datawindow.length); 
			var s=[]; var count=0;
			var startindex = (datawindow.length - lockedIndicesGrid.length);
			for(var i=0; i<datawindow.length; i++) {
				if(lockedIndicesGrid.indexOf(i) != -1) {
					newwindow.push(datawindow[startindex]);
					startindex++;
				}
				else if(lockedIndicesGrid.indexOf(i) == -1) {
					newwindow.push(datawindow[count]);
					count++;
				}
			}
			return newwindow;
		}
	}
	// Get all the values of the dataset
	this.AllDataVals = function() {	return allDataObjects;	}
	this.setAllDataVals = function(data) { 	allDataObjects = data; allData = data; }
	// Get all the row values of the dataset.
	this.AllRowValues = function() { return allRows; }
	// Set all row values, e.g. if rows have been reorganized by user.
	this.setAllRowValues = function(data) { allRows = data;	}
	// Get all the column values of the dataset.
	this.AllColumnValues = function() {	return allCols;	}
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
				temp_data_object.push(dataobj);	count++;
			}
		}
	}
	// Functions below need a reference table - if resetting only the columns, or only the rows.
	this.resetColumnData = function() {	}
	this.resetRowData = function() { }
	this.setRowMap = function(newrows) { rowmap = newrows; }
	this.setColMap = function(newcols) { colmap = newcols; }
	this.getRowMap = function() { return rowmap	}
	this.getColMap = function() { return colmap; }
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
	if(axis == "COLUMN") {
		var cols = DataSetObject.AllColumnValues();
		var colmap = DataSetObject.getColMap();
		var xindex = DATA_INDEX.getXScrollIndex();
		rc1 = xindex+rc1; rc2 = xindex+rc2;
		cols = swap(cols, rc1, rc2);
		colmap = swap(colmap, rc1, rc2);
		data = swapInner(data, rc1, rc2);
		DataSetObject.setAllColumnValues(cols);
		DataSetObject.setColMap(colmap);
	}
	// Update rows and dataset
	if(axis == "ROW") {
		var rows = DataSetObject.AllRowValues();
		var rowmap = DataSetObject.getRowMap();
		var yindex = DATA_INDEX.getYScrollIndex();
		rc1 = yindex+rc1; rc2 = yindex+rc2;
		rows = swap(rows, rc1, rc2);
		data = swap(data, rc1, rc2);
		rowmap = swap(rowmap, rc1, rc2);
		DataSetObject.setAllRowValues(rows);
		DataSetObject.setRowMap(rowmap);
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
	data[parseInt(row+yindex)][parseInt(col+xindex)].annotated = true;
	DataSetObject.setAllDataVals(data);
}
/* End Data Annotation Functions */



/* **** Data Filtering functions **** */

// Data points need to be filtered in 2 modes - single points, and comparing 2 rows (where everything else is filtered out/hidden).
function filterDataPoint(row, col) {
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
	var data = DataSetObject.AllDataVals();
	var xindex = DATA_INDEX.getXScrollIndex(); // apply to columns
	var yindex = DATA_INDEX.getYScrollIndex(); // apply to rows
	for(var i=0; i<filterCoordinates.length; i++) {
		data[parseInt(filterCoordinates[i][0] + yindex)][parseInt(filterCoordinates[i][1]+xindex)].filtered = true;
	}
	if(LOGGING_ENABLED == true) { logData(","+timestamp()+",FILTER_SINGLE_VALUE, FILTERING, EMERGE_SYSTEM"); }
	DataSetObject.setAllDataVals(data);
	filterCoordinates = Array();
}
// Compare two rows or columns, keep these ones and filter out the rest of the data window.
function filterCompare(mode, grp1, grp2) {
	var data = DataSetObject.AllDataVals();
	var xindex = DATA_INDEX.getXScrollIndex(); // apply to columns
	var yindex = DATA_INDEX.getYScrollIndex(); // apply to rows
	if(mode == "COMPARE_COL") {
		// Columns according to normal orientation.
		grp1 = parseInt(grp1 + xindex);
		grp2 = parseInt(grp2 + xindex);
		for(var i=yindex; i<(_NUMROWS+yindex); i++) {
			for(var j=xindex; j<(_NUMCOLS+xindex); j++) {
				if(j != grp1 && j != grp2) {
					data[i][j].filtered = true;
				}
			}
		}
		if(LOGGING_ENABLED == true) { logData(","+timestamp()+",COMPARE_COLUMNS, FILTERING, EMERGE_SYSTEM"); }
	} else if(mode == "COMPARE_ROW") {
		// Rows according to normal orientation.
		grp1 = parseInt(grp1 + yindex);
		grp2 = parseInt(grp2 + yindex);
		for(var i=yindex; i<(_NUMROWS+yindex); i++) {
			if(i != grp1 && i != grp2) {
				for(var j=xindex; j<(_NUMCOLS+xindex); j++) {
					data[i][j].filtered = true;
				}
			}
		}
		if(LOGGING_ENABLED == true) { logData(","+timestamp()+",COMPARE_ROWS, FILTERING, EMERGE_SYSTEM"); }
	}
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
				filterCompare("COMPARE_COL", filterCoordinates[0][1], filterCoordinates[1][1]);
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
				filterCompare("COMPARE_COL", filterCoordinates[0][1], filterCoordinates[1][1]);
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
	for (var line in lines) { lines[line] = lines[line].split(","); }
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
	var rm = DataSetObject.getRowMap();
	var cm = DataSetObject.getColMap();
	/*
	console.log("\r\n");
	console.log("Row map: " + JSON.stringify(rm));
	console.log("Col map: " + JSON.stringify(cm));
	*/
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
/** Keep a number within a given range. */
Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max); };