/* 
 * functions.js
 * API for the Physical Graph.
 * Modified for the touch panels functionality.
 * Created: 17th Sept 2014. Edited: 12th May 2015.
 * TO DO items are marked in comments with _CHECK so just ctrl-F
 * 
 */
 
 /* 
 * Simple Javascript Inheritance.
 * @author John Resig (http://ejohn.org/)
 * @license MIT Licensed
 * http://ejohn.org/blog/simple-javascript-inheritance/
 */
(function(){var e=false,t=/xyz/.test(function(){xyz})?/\b_super\b/:/.*/;this.Class=function(){};Class.extend=function(n){function o(){if(!e&&this.init)this.init.apply(this,arguments)}var r=this.prototype;e=true;var i=new this;e=false;for(var s in n){i[s]=typeof n[s]=="function"&&typeof r[s]=="function"&&t.test(n[s])?function(e,t){return function(){var n=this._super;this._super=r[e];var i=t.apply(this,arguments);this._super=n;return i}}(s,n[s]):n[s]}o.prototype=i;o.prototype.constructor=o;o.extend=arguments.callee;return o}})()
 
var comms 				= null;
var commsReady 			= false;
var touch 				= null;
var USE_DATASET_COLOURS = true;		// Do we use the colours from the data set when plotting infovis data.
var ANIM = 2000;

// Percentage widths.
var GBOUNDX 		= 25;
var GBOUNDY 		= 25;
var GBOUNDMAX 		= 100;
var GBOUNDW			= GBOUNDMAX - (GBOUNDX*2);
var GBOUNDH			= GBOUNDMAX - (GBOUNDY*2);

var ENABLESWAP		= false;

/* Possible locks to handle simultaneous row dragging/scrolling navigation 
 * - or find a way to do both at the same time - then probably put the panel handlers in here rather than separate
*/
var DRAGLOCK		= false;
var NAVIGATIONLOCK	= false;
var _LastRowLabels 	= null;
var GRAPH_SERVER 	= HOST;

var _ROWLENGTH 		= 0;
var _COLLENGTH 		= 0;
var target_wCol 	= 0;  
var target_wRow 	= 0;
var current_wCol 	= 0; 
var current_wRow 	= 0;
var windowsize 		= 10;
var _allData 		= [];
var _allCols		= [];
var _allRows		= [];

var DATAMIN 		= 0;
var DATAMAX 		= 0;

/** Keep a number within a given range. */
Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max); };
/** Swap two elements of an array and return the array. */
function swap(arr, a, b) { var tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp; return arr; }
/** Swap an array within an array. */
function swapInner(arr, a, b) { for (var row = 0; row < Y_LIMIT; ++row) { swap(arr[row], a, b); } return arr; }
/** Set labels for the lower panel columns. */
function setXAxisLabel(i, value) { $("#axislabel_x_" + i).find("div.text").find('span.spantext').text(value); }
/** Set labels for the left hand panel rows. */
function setYAxisLabel(i, value) { $("#axislabel_y_" + i).find("div.text").text(value); }

/** Create a zeroed data block. */
function emptyBlock() {
	var data = [];
	for (var row = 0; row < Y_LIMIT; ++row){
		var data_row = [];
		data.push(data_row);
		for (var col = 0; col < X_LIMIT; ++col){
			data_row.push( 0.0 );
		}
	}
	return data;
}
/** Start up the comms with the graph using a reconnecting websocket. */
function initComms(clientID, study_port, onOpen) {
	// Connect to the graph.
	function connect() {
		comms = io.connect("ws://" + GRAPH_SERVER + ":" + study_port);
		comms.on("connect", function(data) {
			console.log("Connected");
			commsReady=true;
			onOpen();
			comms.emit("clientConnection", clientID);
		});
		comms.on("connect_error", function(err) {
			// Fires when server disconnects AFTER connection had already been made
			console.log("Connection Failed");
			commsReady=false;
		});
	}
	$.ajax({
	  url: 'http://'+GRAPH_SERVER+':'+study_port+'/socket.io/socket.io.js',
	  dataType: "script",
	  timeout:6000,
	  success: function(data){ connect(); },
	  error:function(jqXHR, status, err) {
		  initComms(clientID, study_port, onOpen); // try to reconnect after timeout
	  }
	});
}
/** Add axis to the left panel of the graph. */
function drawLeftAxis() {
	// Reference element the axis go into.
	var root = $("body").find("#leftaxis");
	// Y Axis - or axis on the left hand side of the graph
	for (var i = Y_LIMIT-1; i > -1; --i) {
		$("<div>").appendTo(root)
			.append($("<div>").addClass("text axis_label_left draggable_y drag-drop_y"))
			.append($("<div>").addClass("bar"))
			.addClass("control axislabel y")
			.attr("id", "axislabel_y_" + i)
			.data("axis", "y").data("idx", i)
			.append($("<div>").addClass("dropzone_y"))
	}
}
/** Add axis to the bottom panel of the graph. */
function drawLowerAxis() {
	// Reference element the axis go into.
	var root = $("body").find("#loweraxis");
	// X Axis - or axis on the lower end of the graph
	for (var i = 0; i < X_LIMIT; ++i) {
		$("<div>").appendTo(root)
		.append($("<div>").addClass("text axis_label_lower draggable_x drag-drop_x"))
		.append($("<div>").addClass("bar"))
		.addClass("control axislabel x")
		.attr("id", "axislabel_x_" + i)
		.data("axis", "x").data("idx", i)
		.append($("<div>").addClass("dropzone_x"));
		$("#axislabel_x_" + i).find("div.text").append($('<span class="spantext">'));
	}
}
/**
 * @brief Load a data set from a CSV file.
 * @param sDataSet The data set to load.
 * @param name The name that describes the data set.
 */
function graphDataSet(sDataSet, name, callback) {	
	// Guess at the name.
	name = name || sDataSet;
	// Fade out the function name.
	$("#datainfo").fadeOut();
	$("#datainfo").find("span.title").text("loading '"+sDataSet+"'");
	
	// Function to process data set.
	function processData(csv) {
		// Split into lines and commas.
		var lines = csv.split(/\r|\r?\n/g);
		for (var line in lines) { lines[line] = lines[line].split(","); }
		_ROWLENGTH=lines.length-1;
		_COLLENGTH=lines[0].length;
		// Save row labels - left panel
		_LastRowLabels = [0,0,0,0,0,0,0,0,0,0];
		for (var row = 1; row < 11; ++row) {
			setYAxisLabel(9 - (row - 1),  lines[row][0]);
			_LastRowLabels[9 - (row - 1)] = lines[row][0];
		}
		// Save column labels - bottom panel
		_LastColLabels = [0,0,0,0,0,0,0,0,0,0];
		for (var col = 1; col < 11; ++col) {
			setXAxisLabel(col - 1,  lines[0][col]);
			_LastColLabels[col - 1] = lines[0][col];
		}
		// Store all values in a big array (for navigation)
		_allRows=[]; _allCols=[]; _allData=[];
		for(var row=1; row<_ROWLENGTH+1; row++) {
			var temp_data=[];
			_allRows.push(lines[row][0]);
			_allData.push(temp_data);
			for(var col=1;col<_COLLENGTH; col++) {
				temp_data.push(lines[row][col]);
			}
		}		
		for(var col=1;col<_COLLENGTH; col++) { _allCols.push(lines[0][col]); }
		
		updateAllData(_allData, _allRows, _allCols);

		// Get the minimum and maximum of the data set
		DATAMAX = _allData.reduce(function(max, arr) { return Math.max(max, arr[0]); }, -Infinity);
		DATAMIN = _allData.reduce(function(min, arr) { return Math.min(min, arr[0]); },  Infinity);
		
		// Read data in and store in 2D array i.e. data
		var data = [];
		for (var row = 1; row < 11; ++row) {
			var data_row = [];
			data.push(data_row);
			for (var col = 1; col < 11; ++col) {
				data_row.push( lines[row][col] );
			}
		}
		//data.reverse(); //_CHECK
		// Dispatch to the graph.
		blitData(data);
		blitRowColours();
		// Load meta-data.
		$.ajax({
			url: "data/" + sDataSet + ".metadata",
			async: false,
			dataType: "xml",
			success: function(xml) {
				// Read title.
				var title = $(xml).find("title").text();
				$("#datainfo").find("span.title").text(title);
				$("#datainfo").fadeIn();
				// Read row colours.
				var rows = [];
				$(xml).find("color").each(function(i, el){
					rows.push({ r : $(this).attr("r"), g : $(this).attr("g"), b : $(this).attr("b") });
				});
				//rows.reverse(); //_CHECK
				// Send row colours too.
				if (USE_DATASET_COLOURS) { blitRowColours(rows); }
			}			
		});
	}
	// Load the data set from a file.
	$.ajax({
		url: DS_URL + sDataSet + ".csv",
		dataType: "text",
		success: function(data) {
			processData(data);
			callback();
		} 
	});
	
}

/** Blit a row of data items to the graph. Format: [ [c0, c1, .. ], [c0, c1, .. ], ... ] */
function blitData(heights) {
	send("boundeddataset", { 
		data:heights,
		minz: DATAMIN - (DATAMIN * 0.2),
		maxz: DATAMAX + ((DATAMAX-DATAMIN) * 0.8),
	});
	_LastDataSet = heights;
}

/** Transmit a list of row colours to the graph. Format: [ {r:.., g:.., b:...}, ... ] */
function blitRowColours(rows) {
	if (rows === undefined)	{
		_LastColourSet = null;
		//send("rowcolours")
		return;
	}
	send("rowcolours", { data : rows });
	_LastColourSet = rows;
}
function updateAllData(data, rows, cols) {
	if (!commsReady)
		return;
	comms.emit("UPDATE_ALLDATA", JSON.stringify({data:data, rows:rows, cols:cols}));
}
function send(action, data) {
	if (!commsReady)
		return;
	if(DEBUG_MODE == true) {
		// A dumbed down version of the data sent to the server
		if(action == "boundeddataset") { comms.emit("DEBUG_DATA", JSON.stringify({data:data.data})); }
	}
	else { comms.emit("DATASET_WINDOW", JSON.stringify({ action : action, data : data })); }
}
/** Tell the system to swap rows and inform the graph **/
function swapRow(r1, r2) {
	// Bail if nothing to do.
	if (r1 == r2) return;
	// On the last data, swap the rows and cols, then re-transmit.
	swap(_LastDataSet, r1, r2);
	swap(_LastColourSet, r1, r2);
	swap(_LastRowLabels, r1, r2);
	// Transmit data to graph.
	blitData(_LastDataSet);
	blitRowColours(_LastColourSet);
}

/** Tell the system to swap a column (lower panel columns). */
function swapCol(c1, c2) {
	// Bail if nothing to do.
	if (c1 == c2) return;
	// On the last data, swap the rows and cols, then re-blit.
	swapInner(_LastDataSet, c1, c2);
	swapInner(_LastColourSet, c1, c2);
	swap(_LastColLabels, c1, c2);
	// Blit data to graph.
	blitData(_LastDataSet);
	blitRowColours(_LastColourSet);
}

var EMERGE_INTERFACE = Class.extend ({
	init:function(settings) {
		
	},
	
	blitData : function(heights) {
		this.send("boundeddataset", { 
			data:heights,
			minz: DATAMIN - (DATAMIN * 0.2),
			maxz: DATAMAX + ((DATAMAX-DATAMIN) * 0.8),
		});
		_LastDataSet = heights;
	},

	/** Transmit a list of row colours to the graph. Format: [ {r:.., g:.., b:...}, ... ] */
	blitRowColours : function(rows) {
		if (rows === undefined)	{
			_LastColourSet = null;
			return;
		}
		this.send("rowcolours", { data : rows });
		_LastColourSet = rows;
	},
	
	updateAllData : function(data, rows, cols) {
		if (!commsReady)
			return;
		comms.emit("UPDATE_ALLDATA", JSON.stringify({data:data, rows:rows, cols:cols}));
	},
	
	send : function(action, data) {
		if (!commsReady)
			return;
		if(DEBUG_MODE == true) {
			// A dumbed down version of the data sent to the server
			if(action == "boundeddataset") { comms.emit("DEBUG_DATA", JSON.stringify({data:data.data})); }
		}
		else { comms.emit("DATASET_WINDOW", JSON.stringify({ action : action, data : data })); }
	},
	
	swapCol : function(c1, c2) {
		// Bail if nothing to do.
		if (c1 == c2) return;
		// On the last data, swap the rows and cols, then re-blit.
		swapInner(_LastDataSet, c1, c2);
		swapInner(_LastColourSet, c1, c2);
		swap(_LastColLabels, c1, c2);
		// Blit data to graph.
		blitData(_LastDataSet);
		blitRowColours(_LastColourSet);
	},
	
		swapRow : function (r1, r2) {
		// Bail if nothing to do.
		if (r1 == r2) return;
		// On the last data, swap the rows and cols, then re-transmit.
		swap(_LastDataSet, r1, r2);
		swap(_LastColourSet, r1, r2);
		swap(_LastRowLabels, r1, r2);
		// Transmit data to graph.
		blitData(_LastDataSet);
		blitRowColours(_LastColourSet);
	}
});


var LowerPanel = Class.extend({
	init: function(settings) {
		if(settings.draggableLabels == true) {
			
		}
	}
});



/* Unimplemented functions */
function overrideDataSet() {}
function forceSwap(row, col) {}
function storeSwappedCol(col) {}
function storeSwappedRow(row) {}
function setTouchedValue(row, col, value) {} // Set a datapoint to be annotated - as triggered by the GRAPH client (C# app)
function removeTouchedValue(row, col, value) {}