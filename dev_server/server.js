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

// Variables for filtering
var PRESS_COMPARE_COUNTER 			= 0;
var COMPARE_TIMER_STARTED 			= false;
var COMPARE_TIME_1 					= 0;
var COMPARE_TIME_2 					= 0;
var FILTER_COMPARISON_INTERVAL 		= 1000;
var FILTER_COMPARISON_TIMER_TICK 	= 50;

// Dataset to use
var DataSetObject 		= new DataSetObject(_DATAREPO+_CSVFILE, _DATAREPO+_XMLCOLOURSFILE); // Initialize the dataset
var DATA_INDEX 			= new DataIndex(); // Initialize data index tracking object
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

// Socket function variables - Broadcast variables.
var DATASET_WINDOW_UPDATE		= "DATASET_WINDOW_UPDATE"; // broadcast and globally update the dataset window values
var DATASET_WINDOW_UPDATE_LIMITED = "DATASET_WINDOW_UPDATE_LIMITED";


// Websocket variables.
var port			= 8383;
var app 			= io = require('socket.io').listen(app);

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
		// Incrememnt the client counter
		_CLIENTCOUNTER++;
		// Once data loaded, etc. respond to client
		callback("CONNECTED");
    });
	socket.on("EMERGEClient", function(clientid) {
		console.log("\r\nClient "+clientid+" has connected!\r\n");
		_CLIENTCOUNTER++;
	});
	
	socket.on(DATASET_WINDOW_UPDATE, function() {
		socket.emit(DATASET_WINDOW_UPDATE, sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	
	/* Request Handlers */
	socket.on(REQUEST_COLUMN_LENGTH, function(message, callback) {
		var clength = DataSetObject.TotalMaxColumns();
		callback(clength);
	});
	socket.on(REQUEST_ALLCOLUMNS, function(message, callback) {
		var cdata = DataSetObject.AllColumnValues();
		callback(JSON.stringify(cdata));
	});
	
	socket.on(REQUEST_ROW_LENGTH, function(message, callback) {
		var rlength = DataSetObject.TotalMaxRows();
		callback(rlength);
	});
	socket.on(REQUEST_ALLROWS, function(message, callback) {
		var rdata = DataSetObject.AllRowValues();
		callback(JSON.stringify(rdata));
	});
	/* End Request Handlers*/
	
	/* Action Handlers */
	socket.on(COL_SWAP, function (message) {
		var colstoswap = JSON.parse(message);
		swapCol(colstoswap.column_1, colstoswap.column_2);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
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
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	
	socket.on(ROW_SWAP, function (message) {
		var rowstoswap = JSON.parse(message);
		swapRow(rowstoswap.row_1, rowstoswap.row_2);
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	socket.on(UPDATE_DATASET_SCROLLY, function(message, callback) {
		var params = JSON.parse(message);
		var min = params.min_param;
		var max = params.max_param;
		var pos = params.position;
		dataScrollY(pos);
		// Send back new labels on client GUI
		callback(JSON.stringify(DataSetObject.AllRowValues()));
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
	});
	socket.on(SET_ANNOTATED, function(data) {
		// Requires datapoint indices.
		// Take into account xscroll index and yscroll index. IMPORTANT: ROWS are REVERSED! so need to handle this.
		var annotated_coords = JSON.parse(data);
		var annotated_row = annotated_coords["annotated_coordinate"][0];
		var annotated_col = annotated_coords["annotated_coordinate"][1];
		annotateDataPoint(annotated_row, annotated_col);
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
		parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
		socket.broadcast.emit("DATASET_WINDOW_UPDATE", sendBigJSONdata({dataset:true, rowcolors:true, minz:true, maxz:true, animationTime:true}));
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
function DataSetObject(csvfile, xmlfile) {
	
	// Each data value as an object with properties.
	var dataValObject = function(id, val, x, y) {
		this.id=id;
		this.x=x; // X coordinate in the grid
		this.y=y; // Y coordinate in the grid
		this.val=val; // The actual value
		this.annotated=false; // Whether user has annotated a datapoint (e.g. pulled a bar)
		this.filtered=false; // Whether this datapoint has been filtered out (i.e. hidden)
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
	for(var row=1; row<maxrows+1; row++) {
		var temp_data=[];
		var temp_data_object=[];
		allData.push(temp_data);
		allDataObjects.push(temp_data_object);
		for(var col=1;col<maxcols; col++) {
			temp_data.push(_CSVDATA[row][col]);
			var dataobj = new dataValObject(count, _CSVDATA[row][col], row-1, col-1);
			temp_data_object.push(dataobj);
			count++;
		}
	}
		
	var max = allData.reduce(function(max, arr) { return Math.max(max, arr[0]); }, -Infinity);
	var min = allData.reduce(function(min, arr) { return Math.min(min, arr[0]); },  Infinity);	
	
	// Get the data values, specific to a given grid size, and based on x and y index (if user has been scrolling)
	this.getDataWindow = function() {
		var datawindow=[];
		var data = this.AllDataVals();
		var x = DATA_INDEX.getXScrollIndex();
		var y = DATA_INDEX.getYScrollIndex();
		for (var row = parseInt(y); row < parseInt(_NUMROWS+y); ++row) {
			var data_row = [];
			datawindow.push(data_row);
			for (var col = parseInt(x); col < parseInt(_NUMCOLS+x); ++col) {
				data_row.push(data[row][col]);
			}
		}
		return datawindow;
	}
	// Get all the values of the dataset
	this.AllDataVals = function() {	return allDataObjects;	}
	this.setAllDataVals = function(data) { 	allData = data; }
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
	// Functions below need a reference table.
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
	if(axis == "COLUMN") {
		var cols = DataSetObject.AllColumnValues();
		var xindex = DATA_INDEX.getXScrollIndex();
		rc1 = xindex+rc1; rc2 = xindex+rc2;
		swap(cols, rc1, rc2);
		data = swapInner(data, rc1, rc2);
		DataSetObject.setAllColumnValues(cols);
	}
	// Update rows and dataset
	if(axis == "ROW") {
		var rows = DataSetObject.AllRowValues();
		var yindex = DATA_INDEX.getYScrollIndex();
		rc1 = yindex+rc1; rc2 = yindex+rc2;
		swap(rows, rc1, rc2);
		
		// TODO the rows need reversing, otherwise, problems!!
		
		data = swap(data, rc1, rc2); //_CHECK if definitely should be using swap 
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
	data[parseInt(row+yindex)][parseInt(col+xindex)].annotated = true;
	DataSetObject.setAllDataVals(data);
}
/* End Data Annotation Functions */



/* Data Filtering functions */
/*
* TO DO - some kind of efficient way of detecting duplicate values being sent by the graph (or handle this in the graph software).
*/
var rowcomparison_array = Array();
var filterCoordinates = Array();



function filterDataPoint(row, col) {
	var data = DataSetObject.AllDataVals();
	var xindex = DATA_INDEX.getXScrollIndex(); // apply to columns
	var yindex = DATA_INDEX.getYScrollIndex(); // apply to rows
	
	if(row == 0 || row == 9) {
		// These are the vertical rows or columns - if facing the bar chart from normal mapping.
		PRESS_COMPARE_COUNTER++;
		rowcomparison_array.push(parseInt(col + xindex));
		filterCoordinates.push(parseInt(row + yindex));
		filterCoordinates.push(parseInt(col + xindex));
		if(COMPARE_TIMER_STARTED == false) {
			COMPARE_TIME_1 = timestamp();
			beginCompareTimer("COMPARE_COL");
		}
	}
	else if(col == 0 || col == 9) {
		// These are the vertical rows or columns - if facing the bar chart from normal mapping.
		PRESS_COMPARE_COUNTER++;
		rowcomparison_array.push(parseInt(row + yindex));
		filterCoordinates.push(parseInt(row + yindex));
		filterCoordinates.push(parseInt(col + xindex));
		if(COMPARE_TIMER_STARTED == false) {
			COMPARE_TIME_1 = timestamp();
			beginCompareTimer("COMPARE_ROW");
		}
	}
	else {
		// Individual data point needs to be filtered
		data[parseInt(row+yindex)][parseInt(col+xindex)].filtered = true;
		DataSetObject.setAllDataVals(data);
	}
}

function filterSingleDataPoint() {
	var data = DataSetObject.AllDataVals();
	data[filterCoordinates[0]][filterCoordinates[1]].filtered = true;
	DataSetObject.setAllDataVals(data);
	filterCoordinates = Array();
}

function filterCompare(mode) {
	if(rowcomparison_array[0] != rowcomparison_array[1]) {
		var data = DataSetObject.AllDataVals();
		var xindex = DATA_INDEX.getXScrollIndex(); // apply to columns
		var yindex = DATA_INDEX.getYScrollIndex(); // apply to rows
		if(mode == "COMPARE_COL") {
			for(var i=yindex; i<(_NUMROWS+yindex); i++) {
				for(var j=xindex; j<(_NUMCOLS+xindex); j++) {
					if(j != rowcomparison_array[0] && j != rowcomparison_array[1]) {
						data[i][j].filtered = true;
					}
				}
			}
		}
		else if(mode == "COMPARE_ROW") {
			for(var i=yindex; i<(_NUMROWS+yindex); i++) {
				if(i != rowcomparison_array[0] && i != rowcomparison_array[1]) {
					for(var j=xindex; j<(_NUMCOLS+xindex); j++) {
						data[i][j].filtered = true;
					}
				}
			}
		}
		DataSetObject.setAllDataVals(data);
		rowcomparison_array = Array();
	}
	rowcomparison_array = Array();
	//parseDebugMessage(JSON.stringify({data : DataSetObject.getDataWindow()}));
}

function beginCompareTimer(mode) {
	COMPARE_TIMER_STARTED = true;
	COMPARE_TIME_2 = timestamp();
	if(PRESS_COMPARE_COUNTER == 2 && (COMPARE_TIME_2 - COMPARE_TIME_1) < FILTER_COMPARISON_INTERVAL) {
		// In filter compare mode - two bars have been pressed consecutively (or close enough).
		console.log("FILTER TO COMPARE!!!");
		COMPARE_TIMER_STARTED = false;
		PRESS_COMPARE_COUNTER = 0;
		COMPARE_TIME_2 = 0; COMPARE_TIME_1 = 0;
		filterCoordinates = Array();
		filterCompare(mode);
		return;
	} else if((COMPARE_TIME_2 - COMPARE_TIME_1) > FILTER_COMPARISON_INTERVAL) {
		// Not in compare mode, filtering individual data point.
		console.log("DO NOT filter!!!");
		COMPARE_TIMER_STARTED = false;
		PRESS_COMPARE_COUNTER = 0;
		COMPARE_TIME_2 = 0; COMPARE_TIME_1 = 0;
		rowcomparison_array = Array();
		filterSingleDataPoint();
		return;
	}
	setTimeout(function() {
		beginCompareTimer(mode);
	}, FILTER_COMPARISON_TIMER_TICK);
}
/* End Data Filtering functions. */


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
			str += (j==(parseddata[i].length - 1)) ? parseddata[i][j].filtered : parseddata[i][j].filtered + ", ";
		}
		console.log("Row "+i+" : " + str); str="";
	}
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