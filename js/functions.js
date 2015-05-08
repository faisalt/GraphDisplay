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
		console.log(kMessage);
		
	};
}

/** Add axis to the graph. */
function drawAxis() {
	
	// Reference element the axis go into.
	var root = $("body");
	
	// Y Axis - or axis on the left hand side of the graph
	for (var i = 0; i < Y_LIMIT; ++i) {
		$("<div>").appendTo(root)
			.append($("<div>").addClass("text axis_label draggable drag-drop").text("v"))
			.append($("<div>").addClass("bar"))
			.addClass("control axislabel y")
			.attr("id", "axislabel_y_" + i)
			.data("axis", "y").data("idx", i)
	}
	// Stick some initial labels on them.
	for (var i = 0; i < 10; ++i){
		setYAxisLabel(i, i + 1);
	}
}

function setYAxisLabel(i, value) { $("#axislabel_y_" + i).find("div.text").text(value); }


/**
 * @brief Load a data set from a CSV file.
 * @param sDataSet The data set to load.
 * @param name The name that describes the data set.
 */
function graphDataSet(sDataSet, name) {	
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
		
		// Save row labels.
		_LastRowLabels = [0,0,0,0,0,0,0,0,0,0];
		for (var row = 1; row < 11; ++row) {
			setYAxisLabel(9 - (row - 1),  lines[row][0]);
			_LastRowLabels[9 - (row - 1)] = lines[row][0];
		}
		
		// Read data in and store in 2D array i.e. data
		var data = [];
		for (var row = 1; row < 11; ++row) {
			var data_row = [];
			data.push(data_row);
			for (var col = 1; col < 11; ++col) {
				data_row.push( lines[row][col] );
			}
		}
		data.reverse();
		
		// Dispatch to the graph.
		blitData(data);
		blitRowColours();
		
		// Load meta-data.
		$.ajax({
			url: "data/" + sDataSet + ".metadata",
			aync: false,
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
				rows.reverse();
				
				// Send row colours too.
				if (USE_DATASET_COLOURS) {
					blitRowColours(rows);
				}
			}			
		});
	}
	
	// Load the data set from a file.
	$.ajax({
		url: DS_URL + sDataSet + ".csv",
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
	if (rows === undefined)	{
		_LastColourSet = null;
		//send("rowcolours")
		return;
	}
	send("rowcolours", { data : rows });
	_LastColourSet = rows;
}

function send(action, data) {
	if(action == "dataset") {console.log(data);	}
	if (!commsReady)
		return;
	comms.send(JSON.stringify({ action : action, data : data }));
}

interact('.draggable')
  .draggable({
    // enable inertial throwing
    inertia: false,
    // keep the element within the area of it's parent
    restrict: {
      restriction: "parent",
      endOnly: true,
      elementRect: { top: 0, left: 0.001, bottom: 2, right: 1  }
    },

    // call this function on every dragmove event
    onmove: dragMoveListener,
    // call this function on every dragend event
    onend: function (event) {
      var textEl = event.target.querySelector('p');

      textEl && (textEl.textContent =
        'moved a distance of '
        + (Math.sqrt(event.dx * event.dx +
                     event.dy * event.dy)|0) + 'px');
    }
});

function dragMoveListener (event) {
    var target = event.target,
        // keep the dragged position in the data-x/data-y attributes
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

    // translate the element
    target.style.webkitTransform =
    target.style.transform =
      'translate(' + x + 'px, ' + y + 'px)';

    // update the posiion attributes
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
 }
