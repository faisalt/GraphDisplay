/* 
 * Simple Javascript Inheritance.
 * @author John Resig (http://ejohn.org/)
 * @license MIT Licensed
 * http://ejohn.org/blog/simple-javascript-inheritance/
 */
 
 /*
 * TO DO / COMPLETE:
 * - Add a *widget* function, which does things like undo, redo, reset, etc.
 * - Rather than having lowerpanel and leftpanel interfaces - change this to X_Interface(POSITION), Y_Interface(POSITION) where position is left/right, top/bottom.
 * - Need to reverse the X interface and Y interface on displays where users are viewing the graph 'upside down' i.e. from the other side of the normal orientation.
 */
 
(function(){var e=false,t=/xyz/.test(function(){xyz})?/\b_super\b/:/.*/;this.Class=function(){};Class.extend=function(n){function o(){if(!e&&this.init)this.init.apply(this,arguments)}var r=this.prototype;e=true;var i=new this;e=false;for(var s in n){i[s]=typeof n[s]=="function"&&typeof r[s]=="function"&&t.test(n[s])?function(e,t){return function(){var n=this._super;this._super=r[e];var i=t.apply(this,arguments);this._super=n;return i}}(s,n[s]):n[s]}o.prototype=i;o.prototype.constructor=o;o.extend=arguments.callee;return o}})()
	
var comms 				= null;
var commsReady 			= false;
var touch 				= null;
var USE_DATASET_COLOURS = true;		// Do we use the colours from the data set when plotting infovis data.
var GRAPH_SERVER 		= HOST;

var LEFTSCROLLNUB 		= 0;
var windowsize			= 10;
var _CLIENT				= "";

var target_wCol 		= 0;  
var current_wCol 		= 0;
var target_wRow			= 0;
var current_wRow		= 0;

if(LOGGING_ENABLED) { var DRAGCOUNT=0; var SCROLLDRAGCOUNT=0; }
	

/** Set labels for the lower panel columns. */
function setXAxisLabel(i, value) { $("#axislabel_x_" + i).find("div.text").find('span.spantext').text(value); }
/** Set labels for the left hand panel rows. */
function setYAxisLabel(i, value) { $("#axislabel_y_" + i).find("div.text").find('span.spantext_y').text(value); }
/** Keep a number within a given range. */
Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max); };
/** Get current time in milliseconds. */
function timestamp() {
	var d = new Date();
	return d.getTime();
}

/** Start up the comms with the graph using a reconnecting websocket. */
function initComms(clientID, study_port, onOpen) {
	// Connect to the graph.
	_CLIENT = clientID;
	function connect() {
		comms = io.connect("ws://" + GRAPH_SERVER + ":" + study_port);
		comms.on("connect", function(data) {
			console.log("Handshake Initiated");
			comms.emit("clientConnection", clientID, function(data) {
				console.log("Server msg: "+data);
				console.log("Handshake Complete!");
				if(commsReady == false) onOpen();
				commsReady=true;
			});
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
		console.log("Error: cannot connect to socket.io");
		initComms(clientID, study_port, onOpen); // try to reconnect after timeout
	  }
	});
}

var EmergeInterface = Class.extend({ 
	init : function(settings) {	
	},
	widgets : function(feature) {
		if(feature.undo == true) {
			//Add undo button, on click, send comms message
			if($('input#undo_widget').length > 0) {
				$('input#undo_widget').parent().empty();
			}
			$('div.widget_box').append('<div class="widgets"><input type="image" onclick="" id="undo_widget" src="images/undo.png"></input></div>');
			$('input#undo_widget').on('click', function() {
				comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"UNDO", Timestamp:timestamp()}));
				comms.emit("ACTION_UNDO", _CLIENT, function(data) {
					if(data == "SUCCESS") {
						comms.emit("UPDATE_GUI", _CLIENT);
					}
				});
			});
		}
		if(feature.redo == true) {
			//Add redo button, on click, send comms message
			if($('input#redo_widget').length > 0) {
				$('input#redo_widget').parent().empty();
			}
			$('div.widget_box').append('<div class="widgets"><input type="image" onclick="" id="redo_widget" src="images/redo.png"></input></div>');
			$('input#redo_widget').on('click', function() {
				comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"REDO", Timestamp:timestamp()}));
				comms.emit("ACTION_REDO", _CLIENT, function(data) {
					if(data == "SUCCESS") {
						comms.emit("UPDATE_GUI", _CLIENT);
					}
				});
			});
			
		}
		if(feature.reload == true) {
			//Add reload button
			if($('input#reload_widget').length > 0) {
				$('input#reload_widget').parent().empty();
			}
			$('div.widget_box').append('<div class="widgets"><input type="image" onclick="" id="reload_widget" src="images/reload.png"></input></div>');
			$('input#reload_widget').on('click', function() {
				comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"RELOAD", Timestamp:timestamp()}));
				comms.emit("ACTION_RELOAD", _CLIENT, function(data) {
					if(data == "SUCCESS") {
						comms.emit("UPDATE_GUI", _CLIENT);
					}
				});
			});
		}
	}
});


var X_AxisInterface = EmergeInterface.extend({
	_XLABELS : [],
	_COLLENGTH : 0,
	_XINDEX : 0,
	init: function(callback) {
		// Ask server for GUI details, like column labels, etc.
		comms.emit("REQUEST_ALLCOLUMNS", _CLIENT, function(data) {
			var callback_data = JSON.parse(data);
			_XLABELS = callback_data.data;
			_COLLENGTH = callback_data.data.length;
			_XINDEX = callback_data.xindex;
			if(_XLABELS != "") { callback(); }
		});
		
		
	},
	addLoggingListeners : function(settings) {
		if(LOGGING_ENABLED) {
			// TO DO: Log touches anywhere on the display, which does not involve the GUI components, and send command to server.
			$('body').click(function(e) {
				if(!$(e.target).is('div#loweraxis') && !$(e.target).is('div.control') && !$(e.target).is('div.text') && !$(e.target).is('div.dropzone') && !$(e.target).is('div.widget_box') 
				&& !$(e.target).is('div.widgets') && !$(e.target).is('img#leftarrow') && !$(e.target).is('img#uparrow') && !$(e.target).is('img#downarrow') && !$(e.target).is('img#rightarrow') 
				&& !$(e.target).is('div#hscroll') && !$(e.target).is('div#vscroll') && !$(e.target).is('input#undo_widget') && !$(e.target).is('input#redo_widget') && !$(e.target).is('input#reload_widget')
				&& !$(e.target).is('div.nub_x') && !$(e.target).is('div.ghost_x') && !$(e.target).is('div.nub_y') && !$(e.target).is('div.ghost_y') && !$(e.target).is('span.spantext')) {
					//Click or touch is outside any function buttons
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"NON_FUNCTIONAL", Timestamp:timestamp()}));
				}
				if($(e.target).is('img#uparrow') || $(e.target).is('img#leftarrow')) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LEFT_SCROLL_BUTTON", Timestamp:timestamp()}));
				}
				if($(e.target).is('img#downarrow') || $(e.target).is('img#rightarrow')) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"RIGHT_SCROLL_BUTTON", Timestamp:timestamp()}));
				}
				if($(e.target).is('div#hscroll') || $(e.target).is('div#vscroll')) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"SCROLLBAR", Timestamp:timestamp()}));
				}
			});
			$('div.text').on('click',function() {
				comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LABEL_CLICK", Timestamp:timestamp()}));
			});

		}
	},
	generateColumnLabels : function(settings) {
		// Reference element the axis go into.
		var root = $("body").find("#loweraxis");
		// In case of a disconnect / reconnect event, don't want to add the UI elements more than once, so empty the div if stuff is in there
		if($("body").find("#loweraxis").children().length > 0) { $("body").find("#loweraxis").empty(); }
		// X Axis - or axis on the lower end of the graph
		if(settings.reverse == true) {
			for (var i = X_LIMIT-1; i >=0 ; --i) {
				$("<div>").appendTo(root)
				.append($("<div>").addClass("text axis_label_lower draggable_x drag-drop_x"))
				.append($("<div>").addClass("bar"))
				.addClass("control axislabel x")
				.attr("id", "axislabel_x_" + i)
				.data("axis", "x").data("idx", i)
				.append($("<div>").addClass("dropzone_x"));
				$("#axislabel_x_" + i).find("div.text").append($('<span class="spantext">'));
			}
			$("div#loweraxis").find("div#axislabel_x_0").css("margin-right", "0px");
		} else {
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
			$("div#loweraxis").find("div#axislabel_x_9").css("margin-right", "0px");
		}
		
		// Get the labels for the x axis, i.e. the lower panel and add them to the interface.
		for (var col = 0; col < X_LIMIT; ++col) { setXAxisLabel(col,  _XLABELS[col]); }
		
		comms.on("DATASET_X_LABEL_UPDATE", function(data) {
			var parsed = JSON.parse(data);
			_XLABELS = parsed.columns;
			for (var col = 0; col < X_LIMIT; ++col) { setXAxisLabel(col,  _XLABELS[col]); }
		});
		
		if(settings.draggableLabels == true) {
			this.dragMoveListener = function(event) {
				var target = event.target,
					// keep the dragged position in the data-x/data-y attributes
					x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
					y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
				// translate the element
				target.style.webkitTransform =
				target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
				// update the posiion attributes
				target.setAttribute('data-x', x); target.setAttribute('data-y', y);
				if(LOGGING_ENABLED) { 
					if(DRAGCOUNT < 1) {
						comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LABEL_DRAG_START", Timestamp:timestamp()}));
						DRAGCOUNT++;
					}
				}
			},
			interact('.draggable_x').on('doubletap', function(e) {
				var curr_index = $(e.currentTarget).parent().data('idx');
				comms.emit("LOCK_COLUMN", curr_index);
			});
			interact('.draggable_x').draggable({
				// enable inertial throwing
				inertia: false,
				// keep the element within the area of it's parent
				restrict: { restriction: "parent", endOnly: true, elementRect: { top: 0, left: 0, bottom: 0, right: 0 }},
				// call this function on every dragmove event
				onmove: this.dragMoveListener,
				// call this function on every dragend event
				onend: function (event) {
					var textEl = event.target.querySelector('p');
					$(event.target).removeAttr('style'); $(event.target).removeAttr('data-x'); $(event.target).removeAttr('data-y');
					textEl && (textEl.textContent = 'moved a distance of ' + (Math.sqrt(event.dx * event.dx + event.dy * event.dy)|0) + 'px');
				}
			});
			interact('.dropzone_x').dropzone({
				accept: '.draggable_x',
				ondropactivate: function (event) {
					//add feedback (highlighting) to the target being moved
					event.relatedTarget.classList.add('drag-active_x');
				},
				ondragenter: function (event) {
					//add feedback (highlighting) to the target being moved to
					$(event.target).parent().find('.draggable_x').get(0).classList.add('drop-target_x');
				},
				ondragleave: function (event) {
					//remove feedback (highlighting) from the target being moved to
					$(event.target).parent().find('.draggable_x').get(0).classList.remove('drop-target_x');
				},
				ondrop: function (event) {
					//when the user drops a target - if on top of another target, and drop-target_x is activated, enable swapping
					if($(event.relatedTarget).hasClass('drag-active_x') &&  
						$(event.target).parent().find('.draggable_x').hasClass('drop-target_x') &&
						!$(event.target).parent().find('.draggable_x').hasClass('drag-active_x')){
						ENABLESWAP = true;
					} else { 
						ENABLESWAP = false; 
						
					}
					
					//remove feedback (highlighting) from the target being moved to and also the target
					var a = $('div.drag-active_x').get(0);
					var b = $('div.drop-target_x').get(0);
					$a_parent = $('div.drag-active_x').parent();
					$b_parent = $('div.drop-target_x').parent();
					
					if(ENABLESWAP == true) {
						$('div.drag-active_x').remove();
						$('div.drop-target_x').remove();
						
						$a_parent.prepend(b);
						$b_parent.prepend(a);
						$b_elem = $b_parent.find('.draggable_x');
						$a_elem = $a_parent.find('.draggable_x');
						
						$a_elem.css({'transform':'','-webkit-transform':''});
						$b_elem.css({'transform':'','-webkit-transform':''});
						
						//indicate that the swapping has occurred and on which rows
						$a_elem.animate( { backgroundColor:'white'}, 500).animate( { backgroundColor:'#FFFFC8'}, 500, function() { $(this).removeAttr('style');});
						$b_elem.animate( { backgroundColor:'white'}, 500).animate( { backgroundColor:'#FFFFC8'}, 500, function() { $(this).removeAttr('style');});
						
						var c1 = $a_parent.data('idx');
						var c2 = $b_parent.data('idx');

						// Tell server that user wants to swap two columns
						comms.emit("COL_SWAP", JSON.stringify({column_1:c1, column_2:c2}));
						if(LOGGING_ENABLED) { 
							if(DRAGCOUNT > 0) {
								comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LABEL_DRAG_SUCCESSFULL", Timestamp:timestamp()}));
								DRAGCOUNT=0;
							}
						}
					}
					else {
						if(LOGGING_ENABLED) { 
							if(DRAGCOUNT > 0) {
								comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LABEL_DRAG_FAILED", Timestamp:timestamp()}));
								DRAGCOUNT=0;
							}
						}
					}
					//event.relatedTarget.classList.remove('drag-active_x');
					$a_parent.find('.draggable_x').get(0).classList.remove('drop-target_x');
					
				},
				ondropdeactivate: function (event) {
					event.relatedTarget.classList.remove('drag-active_x');
					event.target.classList.remove('drag-active_x');
				}
			});
		}
	},
	/* Add navigation functionality, for going through datasets larger than the 10x10 grid on the EMERGE system. */
	addScrollbarNavigation : function(settings) {
		var LOWERSCROLLNUB = 0;
		/** Redraw the data set with a given window. */
		var redraw = function(wcol) {
			// Limit to 0 and len-windowsize.
			wcol = wcol.clamp(0, _COLLENGTH - windowsize);
			// Push to the graph with explicit normalisation parameters.
			comms.emit("UPDATE_DATASET_SCROLLX", JSON.stringify({position:wcol}), function(data) {
				if(data != "") {
					_XLABELS = JSON.parse(data);
					// Update the column labels to reflect the new window.
					for (var i=0; i<windowsize; ++i) { setXAxisLabel(i, _XLABELS[wcol + i]); }
					// Update the position of the ghost scrollbars on the lower panel.
					$("#hscroll .ghost_x").css("left", ((wcol / _COLLENGTH) * 100) + "%");
				}
			});
		}
		/** Animate the scrolling action on the lower panel (x axis) **/
		var scrollAnimate = function() {
			// Cap targets and current.
			target_wCol = target_wCol.clamp(0, _COLLENGTH);
			current_wCol = current_wCol.clamp(0, _COLLENGTH);
			// Move slider/send data if current position doesn't equal to target
			if(current_wCol != target_wCol) {
				// Compute direction of motion.
				var step = 1;
				var dx = (target_wCol < current_wCol) ? -step : step;
				// Bring it closer.
				var bMoved = false;
				if (target_wCol != current_wCol) { current_wCol += dx; bMoved -= true; }
				// Redraw and repeat.
				redraw(current_wCol);
				setTimeout(scrollAnimate, settings.scroll_speed);
			}
		}
		if($('body').find("#lowernavigationfunctions").children().length > 0) { $('body').find("#lowernavigationfunctions").empty(); }
		
		if(settings.reverse == true) { 
			$('body').find("#lowernavigationfunctions").append('<img id="rightarrow" src="images/rightarrow.png"></img><div id="hscroll" class="scroll_x"><div class="nub_x"></div><div class="ghost_x"></div></div><img id="leftarrow" src="images/leftarrow.png"></img></div>');
			$('div#hscroll').css('transform', 'rotate(180deg)'); 
			$('img#leftarrow').css({ 'bottom':'0.5%', 'right':'0.01%', 'transform':'rotate(180deg)'	});
			$('img#rightarrow').css({ 'bottom':'0.5%', 'left':'0.01%', 'transform':'rotate(180deg)'	});
		}
		else {
			$('body').find("#lowernavigationfunctions").append('<img id="leftarrow" src="images/leftarrow.png"></img><div id="hscroll" class="scroll_x"><div class="nub_x"></div><div class="ghost_x"></div></div><img id="rightarrow" src="images/rightarrow.png"></div>');
			$('img#rightarrow').css({ 'bottom':'0.5%', 'right':'0.01%' });
			$('img#leftarrow').css({ 'bottom':'0.5%', 'left':'0.01%' });
		}
		
		var hscroll_size = (windowsize / _COLLENGTH)*100;
		if(hscroll_size < 5) hscroll_size=5;
		LOWERSCROLLNUB = Math.round(hscroll_size);
		
		$("#hscroll .nub_x").css("width", LOWERSCROLLNUB+"%");
		$("#hscroll .ghost_x").css("width", LOWERSCROLLNUB+"%");
		
		//For reverse interfaces
		var temp = parseFloat(LOWERSCROLLNUB/100).toFixed(1);
		var clampLower = parseFloat(1-temp).toFixed(1);
		var clampLowerPercent = clampLower*100;
		
		// On connect, if scrolling has already taken place. But also need to do this dynamically.
		if(_XINDEX > 0 ) {
			target_wCol = _XINDEX;
			current_wCol = _XINDEX;
			$("#hscroll .ghost_x").css("left", ((_XINDEX / _COLLENGTH) * 100) + "%"); 			
			if(settings.reverse == true) { $("#hscroll .nub_x").css("right", clampLowerPercent - (((_XINDEX / _COLLENGTH) * 100)) + "%"); }
			else { $("#hscroll .nub_x").css("left", ((_XINDEX / _COLLENGTH) * 100) + "%"); }			
			for (var i=0; i<windowsize; ++i) { setXAxisLabel(i, _XLABELS[_XINDEX + i]); }
		}
		comms.on("DATASET_X_SCROLLBAR_UPDATE", function(data) {
			var parsed = JSON.parse(data);
			_XINDEX = parsed.xindex;
			target_wCol = _XINDEX;
			current_wCol = _XINDEX;
			_XLABELS = parsed.xlabels;
			$("#hscroll .ghost_x").css("left", ((_XINDEX / _COLLENGTH) * 100) + "%"); 
			if(settings.reverse == true) { $("#hscroll .nub_x").css("right", clampLowerPercent - (((_XINDEX / _COLLENGTH) * 100)) + "%"); }
			else { $("#hscroll .nub_x").css("left", ((_XINDEX / _COLLENGTH) * 100) + "%"); } 
			for (var i=0; i<windowsize; ++i) { setXAxisLabel(i, _XLABELS[_XINDEX + i]); }
		});
		
		// Touch event handlers
		$(".scroll_x").bind("touchmove", function(event) {	
			// One event only, get position of touch as a percentage.
			var that = $(this);
			var touches = event.originalEvent.touches;
			if (touches.length != 1) return;
			var touch =  touches[0];			
			// Compute position of touch as a percentage.
			var x = (touch.pageX - that.offset().left) / that.width();
			var temp = parseFloat(LOWERSCROLLNUB/100).toFixed(1);
			var clampLower = parseFloat(1-temp).toFixed(1);	
			if(settings.reverse == true) { var percent = clampLower-x;	} 
			else { var percent = x; }			
			// Update scrollbars.
			if(settings.reverse == true) {
				x=x.clamp(0,clampLower);
				that.find(".nub_x").css("right", (x * 100) + "%");
			}
			else { 
				percent = percent.clamp(0, clampLower); 
				that.find(".nub_x").css("left", (percent * 100) + "%"); 
			}
			// Adjust the percentage relative to the window size.
			target_wCol = Math.floor(_COLLENGTH * percent);		
			if(LOGGING_ENABLED) { 
				if(SCROLLDRAGCOUNT < 1) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"SCROLLBAR_DRAG_START", Timestamp:timestamp()}));
					SCROLLDRAGCOUNT++;
				}
			}			
		});
		$(".scroll_x").on("touchend", function(e) { 
			scrollAnimate(); 
			if(LOGGING_ENABLED) { 
				if(SCROLLDRAGCOUNT > 0) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"SCROLLBAR_DRAG_END", Timestamp:timestamp()}));
					SCROLLDRAGCOUNT=0;
				}
			}
		});
		
		$('#rightarrow').bind("touchstart, click", function(event) {
			var that = $(this);
			that.attr("src", "images/rightarrow_selected.png");
			if(target_wCol < (_COLLENGTH)-windowsize && target_wCol > -1) {
				target_wCol += 1; scrollAnimate();
			}
		});
		$('#leftarrow').bind("touchstart, click", function(event) {
			var that = $(this);
			that.attr("src", "images/leftarrow_selected.png");
			if(target_wCol > -1) {
				target_wCol -= 1; scrollAnimate();
			}
		});	
		$('#rightarrow').on("touchend", function(event) {	var that = $(this);	that.attr("src", "images/rightarrow.png"); });
		$('#leftarrow').on("touchend", function(event) {	var that = $(this);	that.attr("src", "images/leftarrow.png"); });
	}
});





var Y_AxisInterface = EmergeInterface.extend({
	_YLABELS : [],
	_ROWLENGTH : 0,
	_YINDEX : 0,
	init: function(callback) {
		// Ask server for GUI details, like column labels, etc.
		comms.emit("REQUEST_ALLROWS", _CLIENT, function(data) {
			var callback_data = JSON.parse(data);
			_YLABELS = callback_data.data;
			_ROWLENGTH = callback_data.data.length;
			_YINDEX = callback_data.yindex;
			if(_YLABELS != "") { callback(); }
		});
	},
	addLoggingListeners : function(settings) {
		if(LOGGING_ENABLED) {
			// TO DO: Log touches anywhere on the display, which does not involve the GUI components, and send command to server.
			$('body').click(function(e) {
				if(!$(e.target).is('div#loweraxis') && !$(e.target).is('div.control') && !$(e.target).is('div.text') && !$(e.target).is('div.dropzone') && !$(e.target).is('div.widget_box') 
				&& !$(e.target).is('div.widgets') && !$(e.target).is('img#leftarrow') && !$(e.target).is('img#uparrow') && !$(e.target).is('img#downarrow') && !$(e.target).is('img#rightarrow') 
				&& !$(e.target).is('div#hscroll') && !$(e.target).is('div#vscroll') && !$(e.target).is('input#undo_widget') && !$(e.target).is('input#redo_widget') && !$(e.target).is('input#reload_widget')
				&& !$(e.target).is('div.nub_x') && !$(e.target).is('div.ghost_x') && !$(e.target).is('div.nub_y') && !$(e.target).is('div.ghost_y') && !$(e.target).is('span.spantext')) {
					//Click or touch is outside any function buttons
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"NON_FUNCTIONAL", Timestamp:timestamp()}));
				}
				if($(e.target).is('img#uparrow') || $(e.target).is('img#leftarrow')) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LEFT_SCROLL_BUTTON", Timestamp:timestamp()}));
				}
				if($(e.target).is('img#downarrow') || $(e.target).is('img#rightarrow')) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"RIGHT_SCROLL_BUTTON", Timestamp:timestamp()}));
				}
				if($(e.target).is('div#hscroll') || $(e.target).is('div#vscroll')) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"SCROLLBAR", Timestamp:timestamp()}));
				}
			});
			$('div.text').on('click',function() {
				comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LABEL_CLICK", Timestamp:timestamp()}));
			});

		}
	},
	generateRowLabels : function(settings) {
		// Reference element the axis go into.
		var root = $("body").find("#leftaxis");
		if($("body").find("#leftaxis").children().length > 0) { $("body").find("#leftaxis").empty(); }
		// Y Axis - or axis on the left hand side of the graph
		if(settings.reverse == true) {
			for (var i = 0; i < Y_LIMIT; ++i) {
				$("<div>").appendTo(root)
				.append($("<div>").addClass("text axis_label_left draggable_y drag-drop_y"))
				.append($("<div>").addClass("bar"))
				.addClass("control axislabel y")
				.attr("id", "axislabel_y_" + i)
				.data("axis", "y").data("idx", i)
				.append($("<div>").addClass("dropzone_y"));
				$("#axislabel_y_" + i).find("div.text").append($('<span class="spantext_y">'));
			}
			$("div#leftaxis").find("div#axislabel_y_9").css("margin-right", "0px");
		}
		else {
			for (var i = Y_LIMIT-1; i > -1; --i) {
				$("<div>").appendTo(root)
				.append($("<div>").addClass("text axis_label_left draggable_y drag-drop_y"))
				.append($("<div>").addClass("bar"))
				.addClass("control axislabel y")
				.attr("id", "axislabel_y_" + i)
				.data("axis", "y").data("idx", i)
				.append($("<div>").addClass("dropzone_y"));
				$("#axislabel_y_" + i).find("div.text").append($('<span class="spantext_y">'));
			}
			$("div#leftaxis").find("div#axislabel_y_0").css("margin-right", "0px");
		}
		

		// Get the labels for the y axis, i.e. the left panel and add them to the interface.
		for (var row = 0; row < Y_LIMIT; ++row) { setYAxisLabel(row,  _YLABELS[row]); }
		
		comms.on("DATASET_Y_LABEL_UPDATE", function(data) {
			var parsed = JSON.parse(data);
			_YLABELS = parsed.rows;
			for (var row = 0; row < Y_LIMIT; ++row) { setYAxisLabel(row,  _YLABELS[row]); }
		});
		
		if(settings.draggableLabels == true) {
			this.dragMoveListener = function(event) {
				var target = event.target,
					// keep the dragged position in the data-x/data-y attributes
					x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
					y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
				// translate the element
				target.style.webkitTransform =
				target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
				// update the posiion attributes
				target.setAttribute('data-x', x); target.setAttribute('data-y', y);
				if(LOGGING_ENABLED) { 
					if(DRAGCOUNT < 1) {
						comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LABEL_DRAG_START", Timestamp:timestamp()}));
						DRAGCOUNT++;
					}
				}
			},
			interact('.draggable_y').on('doubletap', function(e) {
				var curr_index = $(e.currentTarget).parent().data('idx');
				console.log("locking");
				comms.emit("LOCK_ROW", curr_index);
			});
			interact('.draggable_y').draggable({
				// enable inertial throwing
				inertia: false,
				// keep the element within the area of it's parent
				restrict: { restriction: "parent", endOnly: true },
				// call this function on every dragmove event
				onmove: this.dragMoveListener,
				// call this function on every dragend event
				onend: function (event) {
				  var textEl = event.target.querySelector('p');
				  $(event.target).removeAttr('style');
				  $(event.target).removeAttr('data-x');
				  $(event.target).removeAttr('data-y');
				  textEl && (textEl.textContent =
					'moved a distance of ' + (Math.sqrt(event.dx * event.dx + event.dy * event.dy)|0) + 'px');
				}
			});
			interact('.dropzone_y').dropzone({
				accept: '.draggable_y',
				ondropactivate: function (event) {
					//add feedback (highlighting) to the target being moved
					event.relatedTarget.classList.add('drag-active_y');
				},
				ondragenter: function (event) {
					//add feedback (highlighting) to the target being moved to
					$(event.target).parent().find('.draggable_y').get(0).classList.add('drop-target_y');
				},
				ondragleave: function (event) {
					//remove feedback (highlighting) from the target being moved to
					$(event.target).parent().find('.draggable_y').get(0).classList.remove('drop-target_y');
				},
				ondrop: function (event) {
					//when the user drops a target - if on top of another target, and drop-target_y is activated, enable swapping
					if($(event.relatedTarget).hasClass('drag-active_y') &&  
						$(event.target).parent().find('.draggable_y').hasClass('drop-target_y') &&
						!$(event.target).parent().find('.draggable_y').hasClass('drag-active_y')){
						ENABLESWAP = true;
						if(settings.loggingEnabled == true) {
							// TODO stub : user has swapped a row
						}
					} else { ENABLESWAP = false; }
					
					//remove feedback (highlighting) from the target being moved to and also the target
					var a = $('div.drag-active_y').get(0);
					var b = $('div.drop-target_y').get(0);
					$a_parent = $('div.drag-active_y').parent();
					$b_parent = $('div.drop-target_y').parent();
					
					if(ENABLESWAP == true) {
						$('div.drag-active_y').remove();
						$('div.drop-target_y').remove();
						
						$a_parent.prepend(b);
						$b_parent.prepend(a);
						$b_elem = $b_parent.find('.draggable_y');
						$a_elem = $a_parent.find('.draggable_y');
						
						$a_elem.css({'transform':'','-webkit-transform':''});
						$b_elem.css({'transform':'','-webkit-transform':''});
						
						//indicate that the swapping has occurred and on which rows
						$a_elem.animate( { backgroundColor:'white'}, 500).animate( { backgroundColor:'#FFFFC8'}, 500, function() { $(this).removeAttr('style');});
						$b_elem.animate( { backgroundColor:'white'}, 500).animate( { backgroundColor:'#FFFFC8'}, 500, function() { $(this).removeAttr('style');});
						
						var r1 = $a_parent.data('idx');
						var r2 = $b_parent.data('idx');
						comms.emit("ROW_SWAP", JSON.stringify({row_1:r1, row_2:r2}));
						if(LOGGING_ENABLED) { 
							if(DRAGCOUNT > 0) {
								comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LABEL_DRAG_SUCCESSFULL", Timestamp:timestamp()}));
								DRAGCOUNT=0;
							}
						}
					}
					else {
						if(LOGGING_ENABLED) { 
							if(DRAGCOUNT > 0) {
								comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"LABEL_DRAG_FAILED", Timestamp:timestamp()}));
								DRAGCOUNT=0;
							}
						}
					}
					//event.relatedTarget.classList.remove('drag-active_y');
					$a_parent.find('.draggable_y').get(0).classList.remove('drop-target_y');
					
				},
				ondropdeactivate: function (event) {
					event.relatedTarget.classList.remove('drag-active_y');
					event.target.classList.remove('drag-active_y');
				}
			});
		}
	},
	/* Add navigation functionality, for going through datasets larger than the 10x10 grid on the EMERGE system. */
	addScrollbarNavigation : function(settings) {
		var LEFTSCROLLNUB = 0;
		/** Redraw the data set with a given window. */
		var redraw = function(wrow) {
			// Limit to 0 and len-windowsize.
			wrow = wrow.clamp(0, _ROWLENGTH - windowsize);
			
			// Push to the graph with explicit normalisation parameters.
			comms.emit("UPDATE_DATASET_SCROLLY", JSON.stringify({position:wrow}), function(data) {
				if(data != "") {
					_YLABELS = JSON.parse(data);
					// Update the column labels to reflect the new window.
					for (var i=0; i<windowsize; ++i) { setYAxisLabel(i, _YLABELS[wrow + i]); }
					// Update the position of the ghost scrollbars on the left panel.
					$("#vscroll .ghost_y").css("left", ((wrow / _ROWLENGTH) * 100) + "%");
				}
			});
		}
		/** Animate the scrolling action on the left panel (y axis) **/
		var scrollAnimate = function() {
			// Cap targets and current.
			target_wRow = target_wRow.clamp(0, _ROWLENGTH);
			current_wRow = current_wRow.clamp(0, _ROWLENGTH);
			//console.log(target_wRow +" | "+ current_wRow);
			// Move slider/send data if current position doesn't equal to target
			if(current_wRow != target_wRow) {
				// Compute direction of motion.
				var step = 1;
				var dy = (target_wRow < current_wRow) ? -step : step;
				// Bring it closer.
				var bMoved = false;
				if (target_wRow != current_wRow) { current_wRow += dy; bMoved -= true;  }
				// Redraw and repeat.
				redraw(current_wRow);
				setTimeout(scrollAnimate, 150);
			} 
		}
		if($('body').find("#leftnavigationfunctions").children().length > 0) { $('body').find("#leftnavigationfunctions").empty(); }
		
		
		if(settings.reverse == true) { 
			$('body').find("#leftnavigationfunctions").append('<img id="downarrow" src="images/rightarrow.png"></img></img><div id="vscroll" class="scroll_y"><div class="nub_y"></div><div class="ghost_y"></div></div><img id="uparrow" src="images/leftarrow.png"></img>');
			$('img#downarrow').css({ 'bottom':'0.5%', 'left':'0.5%', 'transform':'rotate(180deg)'	});
			$('img#uparrow').css({ 'bottom':'0.5%', 'right':'0.01%', 'transform':'rotate(180deg)'	});
		}
		else {
			$('body').find("#leftnavigationfunctions").append('<img id="uparrow" src="images/leftarrow.png"></img><div id="vscroll" class="scroll_y"><div class="nub_y"></div><div class="ghost_y"></div></div><img id="downarrow" src="images/rightarrow.png"></img>');
			$("div#vscroll").css("transform", "rotate(180deg)");
			$('img#uparrow').css({ 'bottom':'0.5%', 'left':'0.5%' });
			$('img#downarrow').css({ 'bottom':'0.5%', 'right':'0.01%' });
		}
		
		var limiter=1; //look and feel purposes
		var vscroll_size = (windowsize / _ROWLENGTH)*100;
		if(vscroll_size < 5) vscroll_size=5;
		LEFTSCROLLNUB = Math.round(vscroll_size);
		
		$("#vscroll .nub_y").css("width", (LEFTSCROLLNUB-limiter)+"%");
		$("#vscroll .ghost_y").css("width", LEFTSCROLLNUB+"%");
		
		//For reverse interfaces
		var temp = parseFloat(LEFTSCROLLNUB/100).toFixed(1);
		var clampUpper = parseFloat(1-temp).toFixed(1);
		var clampUpperPercent = clampUpper*100;
		
		// On connect, if scrolling has already taken place, then update GUI accordingly. But also need to do this dynamically.
		if(_YINDEX > 0 ) {
			target_wRow = _YINDEX;
			current_wRow = _YINDEX;
			$("#vscroll .ghost_y").css("left", ((_YINDEX / _ROWLENGTH) * 100) + "%");
			if(settings.reverse == true) { $("#vscroll .nub_y").css("left", ((_YINDEX / _ROWLENGTH) * 100) + "%"); }
			else { $("#vscroll .nub_y").css("right", clampUpperPercent - (((_YINDEX / _ROWLENGTH) * 100)) + "%"); } 
			for (var i=0; i<windowsize; ++i) { setYAxisLabel(i, _YLABELS[_YINDEX + i]); }
		}
		comms.on("DATASET_Y_SCROLLBAR_UPDATE", function(data) {
			var parsed = JSON.parse(data);
			_YINDEX = parsed.yindex;
			target_wRow = _YINDEX;
			current_wRow = _YINDEX;
			_YLABELS = parsed.ylabels;
			$("#vscroll .ghost_y").css("left", ((_YINDEX / _ROWLENGTH) * 100) + "%");
			if(settings.reverse == true) { $("#vscroll .nub_y").css("left", ((_YINDEX / _ROWLENGTH) * 100) + "%"); }
			else { $("#vscroll .nub_y").css("right", clampUpperPercent - (((_YINDEX / _ROWLENGTH) * 100)) + "%"); }  
			for (var i=0; i<windowsize; ++i) { setYAxisLabel(i, _YLABELS[_YINDEX + i]); }
		});
		
		$(".scroll_y").bind("touchmove", function(event) {	
			// One event only, get position of touch as a percentage.
			var that = $(this);
			var touches = event.originalEvent.touches;
			if (touches.length != 1) return;
			var touch =  touches[0];
			var y = (touch.pageX - that.offset().left) / that.width();
			var temp = parseFloat(LEFTSCROLLNUB/100).toFixed(1);
			var clampUpper = parseFloat(1-temp).toFixed(1);
			if(settings.reverse == true) { 
				var percent = y; 
			} else { 
				var percent = clampUpper-y;	
			}		
			// Update scrollbars.
			if(settings.reverse == true) {
				percent = percent.clamp(0, (clampUpper));
				that.find(".nub_y").css("left", (percent * 100) + "%");
			} else {
				y=y.clamp(0,clampUpper);
				that.find(".nub_y").css("right", (y * 100) + "%");
			}
			// Adjust the percentage relative to the window size.
			target_wRow = Math.floor(_ROWLENGTH * percent);
			if(LOGGING_ENABLED) { 
				if(SCROLLDRAGCOUNT < 1) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"SCROLLBAR_DRAG_START", Timestamp:timestamp()}));
					SCROLLDRAGCOUNT++;
				}
			}		
		});
		
		$(".scroll_y").on("touchend", function(e) {
			scrollAnimate();
			if(LOGGING_ENABLED) { 
				if(SCROLLDRAGCOUNT > 0) {
					comms.emit("ACTION_LOG", JSON.stringify({Device_ID:_CLIENT, Action_Name:"UI_PRESS", Action_Type:"SCROLLBAR_DRAG_END", Timestamp:timestamp()}));
					SCROLLDRAGCOUNT=0;
				}
			}
		});
		$('#downarrow').bind("touchstart, click", function(event) {
			var that = $(this);
			that.attr("src", "images/rightarrow_selected.png");
			if(target_wRow > -1) {
				target_wRow -= 1;
				scrollAnimate();
			}
		});
		$('#uparrow').bind("touchstart, click", function(event) {
			var that = $(this);
			that.attr("src", "images/leftarrow_selected.png");
			if(target_wRow < parseInt(_ROWLENGTH)-windowsize && target_wRow > -1) {
				target_wRow += 1;
				scrollAnimate();
			}
		});	
		$('#downarrow').bind("touchend", function(event) { var that = $(this); that.attr("src", "images/rightarrow.png"); });
		$('#uparrow').bind("touchend", function(event) { var that = $(this); that.attr("src", "images/leftarrow.png"); });
	}
});
