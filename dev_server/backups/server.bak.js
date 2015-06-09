/*
* Central server for the EMERGE system.
* Handles communication between various clients, e.g. interface panels and the EMERGE application.
* Updates dataset, informs about interactions, stores state variables.
*
* Created 29-05-2015.
*/


/*
* TO DO;
* - sort out interactions between DataWindow vs. entire DataSet
* - sort out colour handling
* - sort out sending stuff to graph application (C# app)
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
var _DATAINITIALIZED	= false;
var _CLIENTCOUNTER 		= 0;
var _X_SCROLLINDEX		= 0;
var _Y_SCROLLINDEX		= 0;

// Dataset to use
var _ROWS 				= [];
var _COLS 				= [];

var DataSetObject 		= new DataSetObject(_DATAREPO+_CSVFILE);
var DATA_INDEX 			= new DataIndex();

// Socket function variables - Listeners
var DEBUG_DATA 				= "DEBUG_DATA"; // listens for data during debug mode : typically simplified data format
var DATASET_WINDOW 			= "DATASET_WINDOW"; // data in the 'current window' e.g. in the current 10x10 grid space
var RESET_ALL				= "RESET_ALL"; // reset all variables

var Y_AXIS_LABELS_REQUEST		= "Y_AXIS_LABELS_REQUEST";
var X_AXIS_LABELS_REQUEST		= "X_AXIS_LABELS_REQUEST";
var REQUEST_COLUMN_LENGTH		= "REQUEST_COLUMN_LENGTH";
var REQUEST_ALLCOLUMNS			= "REQUEST_ALLCOLUMNS";

var COL_SWAP					= "COL_SWAP";
var ROW_SWAP					= "ROW_SWAP";

var UPDATE_DATASET_SCROLLX		= "UPDATE_DATASET_SCROLLX";

// Socket function variables - Emitters
var DATASET_WINDOW_UPDATE	= "DATASET_WINDOW_UPDATE"; // broadcast and globally update the dataset window values
var UPDATE_ALLDATA			= "UPDATE_ALLDATA"; // broadcast and globally update the entire data set

// Websocket variables
var port			= 8383;
var app 			= io = require('socket.io').listen(app);




// Listen on specified port
app.listen(port);
console.log("\r\nNode.js Server for EMERGE");
console.log("Listening on port: "+port+"\r\n");
// Handle incoming requests from clients on connection
io.sockets.on('connection', function (socket) {
	socket.on("clientConnection", function (clientid, callback) {
		console.log("\r\nClient [["+clientid+"]] has connected! \r\n");
		// Incrememnt the client counter
		_CLIENTCOUNTER++;
		updateGlobalDataSet();
		// Once data loaded, etc. respond to client
		callback("CONNECTED");
    });
	/* Request Handlers */
	socket.on(Y_AXIS_LABELS_REQUEST, function(message, callback) {
		callback(String(_ROWS));
	});
	socket.on(X_AXIS_LABELS_REQUEST, function(message, callback) {
		_COLS = JSON.stringify(DataSetObject.Columns());
		if(_COLS != "") callback(_COLS);
	});
	socket.on(REQUEST_COLUMN_LENGTH, function(message, callback) {
		var clength = DataSetObject.TotalMaxColumns();
		callback(clength);
	});
	socket.on(REQUEST_ALLCOLUMNS, function(message, callback) {
		var cdata = DataSetObject.AllColumnValues();
		callback(JSON.stringify(cdata));
	});
	/* End Request Handlers*/
	
	/* Action Handlers */
	socket.on(COL_SWAP, function (message) {
		var colstoswap = JSON.parse(message);
		swapCol(colstoswap.column_1, colstoswap.column_2);
		// Broadcast update
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		
		//socket.broadcast.emit("DATASET_WINDOW_UPDATE", JSON.stringify(DataSetObject.DataWindow()));
	});
	socket.on(UPDATE_DATASET_SCROLLX, function(message, callback) {
		var params = JSON.parse(message);
		var min = params.min_param;
		var max = params.max_param;
		var pos = params.position;
		dataScrollX(pos);
		// Send back new labels on client GUI
		callback(JSON.stringify(DataSetObject.AllColumnValues()));
		
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		
		//socket.broadcast.emit("DATASET_WINDOW_UPDATE", JSON.stringify(DataSetObject.getDataWindow()));
	});
	/* End Action Handlers */
			
	/* General Socket Handlers */
	socket.on("error", function(message) {
		console.log(message);
	});
	socket.on("disconnect", function(message) {
		_CLIENTCOUNTER--;
		if(_CLIENTCOUNTER == 0) { 
			resetAll();
		}
		console.log("A client has disconnected. Number of clients remaining: "+_CLIENTCOUNTER);
	});
	socket.on(RESET_ALL, function(message) {
		if(message == "RESET_ALL") { resetAll(); }
	});
	// Debug handler
	socket.on(DEBUG_DATA, function(message) {
		parseDebugMessage(message);
	});
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
/** Create a dataset object so that we can easily extract properties, like row,column names, specific portions of data, etc. */
function DataSetObject(csvfile) {
	var _CSVDATA = readCSVFile(csvfile);
	
	_DATAINITIALIZED = true;
	
	var allRows = [];
	var maxrows = _CSVDATA.length-1;
	for(var row=1; row<maxrows+1; row++) { allRows.push(_CSVDATA[row][0]); }
	var allCols = [];
	var maxcols = _CSVDATA[0].length;
	for(var col=1;col<maxcols; col++) { allCols.push(_CSVDATA[0][col]); }
	var allData=[];
	for(var row=1; row<maxrows+1; row++) {
		var temp_data=[];
		allData.push(temp_data);
		for(var col=1;col<maxcols; col++) {
			temp_data.push(_CSVDATA[row][col]);
		}
	}

	// Get the column values of the dataset, specific to a given grid size
	this.Columns = function() {
		var collabels = [0,0,0,0,0,0,0,0,0,0];
		for (var col = 1; col < _NUMCOLS+1; ++col) {
			collabels[col - 1] = _CSVDATA[0][col];
		}
		return collabels;
	}
	// Get the row values of the dataset, specific to a given grid size
	this.Rows = function() {
		var rowlabels = [0,0,0,0,0,0,0,0,0,0];
		for (var row = 1; row < _NUMROWS+1; ++row) {
			rowlabels[9 - (row - 1)] = _CSVDATA[row][0];
		}
		return rowlabels;
	}
	// Get the data values, specific to a given grid size
	this.getDataWindow = function() {
		var datawindow=[];
		var data = this.AllDataVals();
		var x = DATA_INDEX.getXScrollIndex();
		var y = DATA_INDEX.getYScrollIndex();
		for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) {
			var data_row = [];
			datawindow.push(data_row);
			for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
				data_row.push(data[row][col] );
			}
		}
		return datawindow;
	}
	// Get all the values of the dataset
	this.AllDataVals = function() {	return allData;	}
	this.setAllDataVals = function(data) { allData = data; }
	// Get all the row values of the dataset
	this.AllRowValues = function() { return allRows; }
	this.setAllRowValues = function(data) { allRows = data;	}
	// Get all the column values of the dataset
	this.AllColumnValues = function() {	return allCols;	}
	this.setAllColumnValues = function(data) { allCols = data; }
	// Maximum value of the entire dataset
	this.DataMaxValue = function() {
		return this.AllDataVals().reduce(function(max, arr) { return Math.max(max, arr[0]); }, -Infinity);
	}
	// Minimum value of the entire dataset
	this.DataMinValue = function() {
		return this.AllDataVals().reduce(function(min, arr) { return Math.min(min, arr[0]); },  Infinity);
	}
	// Maximum number of rows in the entire dataset
	this.TotalMaxRows = function() { return _CSVDATA.length-1;	}
	// Minimum number of rows in the entire dataset
	this.TotalMaxColumns = function() { return _CSVDATA[0].length;	}
}
/*  End dataset parsing functions  */

/** Dataset parsing functions: extract dataset, row values, column values, etc. */
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
	lines = allText.split(/\r|\r?\n/g);
	for (var line in lines) { lines[line] = lines[line].split(","); }
	return lines;
}




/* Data Navigation Functions */
/** Handle data scrolling on the lower panel or x axis. */
function dataScrollX(pos) {
	var data = emptyBlock();
	var mydata = DataSetObject.AllDataVals();
	var yindex = DATA_INDEX.getYScrollIndex(); //_CHECK : replace with the y position from the left panel (or whichever panel controls the y axis)
	for (var row=0; row<_NUMROWS; ++row){
		for (var col=0; col<_NUMCOLS; ++col) { 
			data[row][col] = mydata[yindex + row][pos + col]; 
		}
	}
	DATA_INDEX.setXScrollIndex(pos);
}
function dataScrollY(pos) {
	var data = emptyBlock();
	var mydata = DataSetObject.AllDataVals();
	var xindex =  DATA_INDEX.getXScrollIndex(); //_CHECK : replace with the x position from the left panel (or whichever panel controls the y axis)
	for (var row=0; row<_NUMROWS; ++row){
		for (var col=0; col<_NUMCOLS; ++col) { 
			data[row][col] = mydata[pos + row][xindex + col]; 
		}
	}
	DATA_INDEX.setYScrollIndex(pos);
}
/* End Data Navigation Functions */




/* Data Organization functions */
/** Swap two elements of an array and return the array. */
function swap(arr, a, b) { var tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp; return arr; }
/** Swap an array within an array. */
function swapInner(arr, a, b) { for (var row = 0; row < _NUMROWS; ++row) { swap(arr[row], a, b); } return arr; }
/** Tell the system to swap a column (lower panel columns). */
function swapCol(c1, c2) {
	// Bail if nothing to do.
	if (c1 == c2) return;
	var data = DataSetObject.getDataWindow();
	swapInner(data, c1, c2);
	updateGlobalDataSet("COLUMN", c1, c2);
	// Broadcast new data
}
function swapRow(r1, r2) {
	// Bail if nothing to do.
	if (r1 == r2) return;
	var data = DataSetObject.getDataWindow();
	swap(data, r1, r2);
	updateGlobalDataSet("ROW", r1, r2);
	// Broadcast new data
}
/** Update all columns, rows and data of the entire dataset. */
function updateGlobalDataSet(axis, rc1, rc2) {
	var data = DataSetObject.AllDataVals();
	if(axis == "COLUMN") {
		var cols = DataSetObject.AllColumnValues();
		var xindex = DATA_INDEX.getXScrollIndex();
		rc1 = xindex+rc1; rc2 = xindex+rc2;
		swap(cols, rc1, rc2);
		swapInner(data, rc1, rc2);
		DataSetObject.setAllColumnValues(cols);
	}
	// Update rows and dataset
	if(axis == "ROW") {
		var rows = DataSetObject.AllRowValues();
		var yindex = DATA_INDEX.getYScrollIndex();
		rc1 = yindex+rc1; rc2 = yindex+rc2;
		swap(rows, rc1, rc2);
		swap(data, rc1, rc2); //_CHECK if definitely should be using swap 
		DataSetObject.setAllRowValues(rows);
	}
	// this should be updating the entire dataset (kept separate from datawindow)
	// maybe modify getdatawindow to return datawindow based on x and y index, etc.
	DataSetObject.setAllDataVals(data); 
}
/* End Data Organization functions*/




/* General Functions */
/** Make the DEBUG values legible */
function parseDebugMessage(message) {
	var parsedmsg = JSON.parse(message);
	var parseddata = parsedmsg.data;
	var str="";
	for(var i=0; i<parseddata.length; i++) {
		for(var j=0; j<parseddata[i].length; j++) {
			str += (j==(parseddata[i].length - 1)) ? parseddata[i][j] : parseddata[i][j] + ", ";
		}
		console.log("Row "+i+" : " + str); str="";
	}
	console.log("\r\n \r\n");
}
/** Reset all variables. */
function resetAll() {
	_DATASET_WINDOW	= [];
	_ALL_DATA = [];
	_DATAINITIALIZED = false;
}
/** Create a zeroed data block. */
function emptyBlock() {
	var data = [];
	for (var row = 0; row < _NUMROWS; ++row){ var data_row = []; data.push(data_row);
		for (var col = 0; col < _NUMCOLS; ++col){ data_row.push( 0.0 );	}
	}
	return data;
}
/** Keep a number within a given range. */
Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max); };