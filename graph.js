/* 
 * graph.js
 * API for the Physical Graph.
 * Created: 17th Sept 2014
 * 
 */

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

//var BAR_SiZE_M		= 0.011;
//var BAR_SPACE_M 	= 0.0085;

var GRAPH_SERVER 	= "localhost";


/** Round to a fixed number of digits */
function rf(f, dp){ var r = Math.pow(10, dp); return (Math.round(f * r) / r).toFixed(dp); }

/** Linear interpolation. */
function lerp(v1, v2, amount) { return v1 + (v2 - v1) * amount; }

/** Convert between mm and pixels for width and height. */
function cw(v){ return Convert_Meters2Pixels(v * 0.001, "w"); }		// Convert mm to pixels for width.
function ch(v){ return Convert_Meters2Pixels(v * 0.001, "h"); }		// Convert mm to pixels for height.

/** Does a string start with a value. */
if (typeof String.prototype.startsWith != 'function') { String.prototype.startsWith = function (str){ return this.indexOf(str) == 0; }; }

/** Keep a number within a given range. */
Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max); };

/** Swap two elements of an array and return the array. */
function swap(arr, a, b) { var tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp; return arr; }

/** Swap an array within an array. */
function swapInner(arr, a, b) { for (var row = 0; row < 10; ++row) swap(arr[row], a, b); return arr;  }

/** Call a function after a given amount of time. */
function after(time, func) { setTimeout(func, time); }

/** Perform a deep copy of multi-diensional objects. */
function deepCopy(obj) { if (Object.prototype.toString.call(obj) === '[object Array]') { var out = [], i = 0, len = obj.length; for ( ; i < len; i++ ) { out[i] = arguments.callee(obj[i]); } return out; } if (typeof obj === 'object') { var out = {}, i; for ( i in obj ) { out[i] = arguments.callee(obj[i]); } return out; } return obj; }



function dimensions() {
	
	// Compute the graph dimensions relative to physical size.
	return {
			
			border_w 	: cw(115),		// Space between the screws and the start of the graph in the x axis.
			border_h 	: ch(115),		// Space between the screws and the start of the graph in the y axis.
			
			block_w 	: cw(190),		// Width of the graph block (where the sliders are).
			block_h 	: ch(190),		// Height of the graph block (where the sliders are).
			
			sldr_w		: cw(12),			// Width of a slider hole.
			sldr_h		: ch(12),			// Height of a slider hole.
			
			sldrspc_w	: cw(8),			// Width of a slider hole.
			sldrspc_h	: ch(8),			// Height of a slider hole.
			
		}
}

/** Start up the touch detection process. */
function initTouch() {
	
	// If the Surface is not present, we are on a screen so bail.
	if (window["Surface"] === undefined) {
		console.log("Ubi Displays not present.");
		return;
	}
	
	// Start multi-touch.
	touch = new KinectTouch({
		debug : false,              // Turn on debug points.
		trails : false,             // Turn on finger trails (this shows the Kinect data used to detect the finger).
		point_limit : 200,          // The number of points we are allowed to process.
		surface_zoffset : 0.015,    // The offset from the surface (in meters) at which to start capturing data.
		height : 0.01,              // The distance from the surface offset (in meters) at which to stop capturing data.
		sendemptyframes : true,     // Do we want to send the touch processor empty frames.
	});
	
	// Set up a pre-processor that ignores the columns in the center.
	touch.preProcessPoint = function(p) { 
		if ((p.x < GBOUNDX || p.x > GBOUNDMAX-GBOUNDX) || 
			(p.y < GBOUNDY || p.y > GBOUNDMAX-GBOUNDY)) 
			return p;
		return null;
	}
}

/** Start up the comms with the graph using a reconnecting websocket. */
function initComms(study_port, onOpen) {
	
	// Connect to the graph.
	comms = new ReconnectingWebSocket("ws://" + GRAPH_SERVER + ":" + study_port);
	
	// Status function bindings.
	comms.onconnecting	= function() { /*console.log("[Comms] Connecting");*/ commsReady = false; }
	comms.onopen 		= function() { console.log("[Comms] Connected"); commsReady = true; if (onOpen) onOpen(); }
	comms.onclose 		= function() { console.log("[Comms] Disconnected"); commsReady = false; }
	comms.onerror  		= function() { console.log("[Comms] Connection Error"); commsReady = false;	}
	
	// Logic function bindings (i.e. data processing).
	comms.onmessage	= function(event) {
		
		// Pull valid data from the graph.
		var kMessage 	= JSON.parse(event.data);
		
		// See if we can find a function to invoke.
		if (kMessage.action == "function")
		{
			window[kMessage.data.name].apply(window, kMessage.data.args)
		}
	};
}

function send(action, data) {
	console.log("===Action==\n"+action+"\n===End action==");
	console.log(data);
	if (!commsReady)
		return;
	comms.send(JSON.stringify({ action : action, data : data }));
}


/** GRAPH FUNCTIONS */

/** Add axes to the graph. */
function drawAxes() {
	
	// Reference element the axis go into.
	var root = $("body");
	
	// Compute updated graph dimensions.
	var graph = dimensions();
	
	// Size for each axis label.
	var axis_labelH = ch(50);
	var axis_labelW = cw(50);
	
	// X Axis
	for (var i = 0; i < 10; ++i) 
	{
		$("<div>").appendTo(root)
			.append($("<div>").addClass("text").text("h"))
			.append($("<div>").addClass("bar"))
			.addClass("control axislabel x")
			.attr("id", "axislabel_x_" + i)
			.data("axis", "x").data("idx", i)
			.css({
				"bottom"	: graph.border_h - axis_labelH, 
				"left" 		: graph.border_w + ((graph.sldr_w + graph.sldrspc_w) * i),
				"width"		: graph.sldr_w,
				"height"	: axis_labelH,
			})
	}
	
	// Y Axis
	for (var i = 0; i < 10; ++i) 
	{
		$("<div>").appendTo(root)
			.append($("<div>").addClass("text").text("v"))
			.append($("<div>").addClass("bar"))
			.addClass("control axislabel y")
			.attr("id", "axislabel_y_" + i)
			.data("axis", "y").data("idx", i)
			.css({
				"left"		: graph.border_w - axis_labelW, 
				"bottom" 	: graph.border_h + ((graph.sldr_h + graph.sldrspc_h) * i),
				"height"	: graph.sldr_h,
				"width"		: axis_labelW,
			})
	}
	
	// Stick some initial labels on them.
	for (var i = 0; i < 10; ++i)
	{
		setXAxisLabel(i, i + 1);
		setYAxisLabel(i, i + 1);
	}
}

function setXAxisLabel(i, value) { $("#axislabel_x_" + i).find("div.text").text(value); }
function setYAxisLabel(i, value) { $("#axislabel_y_" + i).find("div.text").text(value); }

function getXAxisLabel(i, value) { return $("#axislabel_x_" + i).find("div.text").text(); }
function getYAxisLabel(i, value) { return $("#axislabel_y_" + i).find("div.text").text(); }

function selectAxisLabels(row, col) {
	// Reset colours.
	$(".axislabel").removeClass("selected");//.css("background-color", "transparent"); //.axislabel div.text
	
	// If no row, bail.
	if (row === undefined)
		return;
	
	// Set colours.
	$("#axislabel_x_" + col).addClass("selected");//.find("div.text").css("background-color", "blue");
	$("#axislabel_y_" + row).addClass("selected");//.find("div.text").css("background-color", "red");
}


var _zMin = 0;
var _zMax = 1.0;
/** Update the min max range so the UI gives good values.  Called by the graph behaviour */
function setAxisZRange(min, max) 	{ _zMin = min; _zMax = max; }
/** Work out the adjusted z range based on the plotted function. */
function adjustZRange(value)  		{ return lerp(_zMin, _zMax, value); }
/** Reset the z range. */
function resetZRange()				{ _zMin = 0.0; _zMax = 1.0; }


/** Is auto-touch enabled or disabled. */
function setAutoTouch(bState) { send("autotouch", {state:bState || true}); /*console.log("Autotouch " + ((bState || true) ? "enabled" : "disabled")); */ }

/** Dummy function to handle auto-touch info. */
function handleAutoTouch(touched, pushed, pulled) {}


/**
 * @brief Plot a function from a math string.
 * @param sFunction The math string to plot.
 */
function graphFunction(sFunction, xmin, xmax, ymin, ymax) {
	
	// Hide if no data.
	if (sFunction === undefined)
	{
		$("#datainfo").fadeOut();
		return;
	}
	
	// Fade in.
	$("#datainfo").find("span").text(sFunction);
	$("#datainfo").fadeIn();
	
	// Reset the zrange.  It will be updated by the graph behaviour.
	resetZRange();
	
	// Arguments.
	var args = { xmin: xmin||-1, xmax: xmax||1, ymin:ymin||-1, ymax: ymax||1 };
	
	// Signal the graph to draw the function.
	send("functionplot", { 
		func: sFunction, 
		args: args,
	});
	
	// Update the axis labels.
	for (var i = 0; i < 10; ++i)
	{
		setXAxisLabel(i, rf(lerp(args.xmin, args.xmax, i / 9), 1) );
		setYAxisLabel(i, rf(lerp(args.ymin, args.ymax, i / 9), 1) );
	}
}

var _LastDataSet = null;
var _LastColourSet = null;
var _LastRowLabels = null;
var _LastColLabels = null;

/**
 * @brief Load a data set from a CSV file.
 * @param sDataSet The data set to load.
 * @param name The name that describes the data set.
 */
function graphDataSet(sDataSet, name) {	
	console.log("GraphDataSet called");
	// Guess at the name.
	name = name || sDataSet;
	
	// Fade out the function name.
	$("#datainfo").fadeOut();
	$("#datainfo").find("span.title").text("loading '"+sDataSet+"'");
	
	// Function to process data set.
	function processData(csv) {
		
		// Split into lines and commas.
		var lines = csv.split(/\r|\r?\n/g);
		for (var line in lines)
			lines[line] = lines[line].split(",");
		
		// Read headers from each.
		//for (var col = 1; col < 11; ++col) setXAxisLabel(col - 1,  lines[0][col]);
		//for (var row = 1; row < 11; ++row) setYAxisLabel(row - 1,  lines[row][0]);
		
		// Save row labels.
		_LastRowLabels = [0,0,0,0,0,0,0,0,0,0];
		for (var row = 1; row < 11; ++row)
		{
			setYAxisLabel(9 - (row - 1),  lines[row][0]);
			_LastRowLabels[9 - (row - 1)] = lines[row][0];
		}
		
		// Save col labels.
		_LastColLabels = [0,0,0,0,0,0,0,0,0,0];
		for (var col = 1; col < 11; ++col)
		{
			setXAxisLabel(col - 1,  lines[0][col]);
			_LastColLabels[col - 1] = lines[0][col];
		}
		
		// Read data in.
		var data = [];
		for (var row = 1; row < 11; ++row)
		{
			var data_row = [];
			data.push(data_row);
			for (var col = 1; col < 11; ++col)
			{
				data_row.push( lines[row][col] );
			}
		}
		data.reverse();
		
		// Dispatch to the graph.
		blitData(data);
		blitRowColours();
		//send("dataset", {data:data});
		
		// Load meta-data.
		$.ajax({
			url: "data/" + sDataSet + ".metadata",
			aync: false,
			dataType: "xml",
			success: function(xml)
			{
				// Read title.
				var title = $(xml).find("title").text();
				$("#datainfo").find("span.title").text(title);
				$("#datainfo").fadeIn();
				
				// Read row colours.
				var rows = [];
				$(xml).find("color").each(function(i, el){
					rows.push({ r : $(this).attr("r"), g : $(this).attr("g"), b : $(this).attr("b") });
				});
				rows.reverse();
				
				// Send row colours too.
				if (USE_DATASET_COLOURS)
				{
					blitRowColours(rows);
					//send("rowcolours", { data : rows });
					//_LastColourSet = rows;
				}
			}
			
		});
	}
	
	// Load the data set from a file.
	$.ajax({
		url: "data/" + sDataSet + ".csv",
		aync: false,
		success: processData,
		dataType: "text"
	});
}

/** Blit a row of data items to the graph. Format: [ [c0, c1, .. ], [c0, c1, .. ], ... ] */
function blitData(heights) {
	
	send("dataset", {data:heights});
	_LastDataSet = heights;
}

/** Blit a list of row colours to the graph. Format: [ {r:.., g:.., b:...}, ... ] */
function blitRowColours(rows) {
	
	if (rows === undefined)
	{
		_LastColourSet = null;
		//send("rowcolours")
		return;
	}
	
	send("rowcolours", { data : rows });
	_LastColourSet = rows;
}



/** Create a zeroed data block to blit. */
function identity() {
	
	var data = [];
	for (var row = 0; row < 10; ++row)
	{
		var data_row = [];
		data.push(data_row);
		for (var col = 0; col < 10; ++col)
		{
			data_row.push( 0.0 );
		}
	}
	return data;
}

/** Tell the system to swap a row. */
function swapRow(r1, r2) {
	
	// Bail if nothing to do.
	if (r1 == r2) return;
	
	// On the last data, swap the rows and cols, then re-blit.
	swap(_LastDataSet, r1, r2);
	swap(_LastColourSet, r1, r2);
	swap(_LastRowLabels, r1, r2);
	
	// Blit data to graph.
	blitData(_LastDataSet);
	blitRowColours(_LastColourSet);
	
	// Relabel axis.
	for (var i = 0; i < 10; ++i)
		setYAxisLabel(i, _LastRowLabels[i]);
}

/** Tell the system to swap a row. */
function swapCol(c1, c2) {
	
	// Bail if nothing to do.
	if (c1 == c2) return;
	
	// On the last data, swap the rows and cols, then re-blit.
	swapInner(_LastDataSet, c1, c2);
	console.log("B");
	swapInner(_LastColourSet, c1, c2);
	swap(_LastColLabels, c1, c2);
	
	// Blit data to graph.
	blitData(_LastDataSet);
	blitRowColours(_LastColourSet);
	
	// Relabel axis.
	for (var i = 0; i < 10; ++i)
		setXAxisLabel(i, _LastColLabels[i]);
}






/** STUDY MODES */
var mode = "M1";	// Current mode.

/** Start up the mode system */
function initModes(startMode) {
	
	// Select mode when a mode button is pressed.
	$("#modes li").bind("touchstart", function(){  _setMode($(this).attr("mode"));  });
	
	// Start in M1.
	startMode = startMode || "M1";
	_setMode(startMode);
	$("#modes li[mode="+startMode+"]").addClass("selected");
}

/** Set a mode. */
function _setMode(m) {
	
	// Deselect all modes.
	$("#modes li").removeClass("selected");
	
	// Select new mode.
	var button = $("#modes li[mode="+m+"]");
	button.addClass("selected");
	mode = button.attr("mode");
	
	send("zixelspeed");		// Reset the zixel speed to default.
	send("rowcolours");		// Reset row colours.
	send("reset");			// Reset other modal states.
	//send("freeze", {state : false});	// Unfreeze things.
	
	// Deselect axis labels.
	selectAxisLabels();
	
	// Tell the graph program what is going on.
	send("mode", { mode : mode })
	setMode(mode);
	
	// Clear any overrides.
	send("override");
	
	// Reset sound limiter.
	_dSounds = {}
	
	// Play the mode change sound.
	new Audio("snd/buttons/on_affirm/techy_affirm.wav").play();
	
}

/** SOUND HELPERS  */
var _dSounds = {}
function playSound(file) {
	if (_dSounds[file] === undefined)
		_dSounds[file] = 0;
	
	if (_dSounds[file] > 2)
		return;
		
	//console.log("playing: " + file);
	_dSounds[file] += 1;
	var a = new Audio(file);
	a.addEventListener('ended', function() { _dSounds[file] -= 1; } );
	a.play();
}