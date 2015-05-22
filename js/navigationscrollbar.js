/**
* Adds a navigation scrollbar to the interface along with appropriate handlers.
*/
var LEFTSCROLLNUB 	= 0;
var LOWERSCROLLNUB 	= 0;

/** Add a navigation scrollbar to the lower panel (i.e. x axis) **/
function addLowerNavigationScrollbar() {
	addGraphicalScrollbar();
	adjustLowerScrollbarSize();
	addScrollbarHandlers();
}
/** Add a navigation scrollbar to the left panel (i.e. y axis) **/
function addLeftNavigationScrollbar() {
	addLeftGraphicalScrollbar();
	adjustLeftScrollbarSize();
	addLeftScrollbarHandlers();
}
/** Add the scrollbar div (lower) **/
function addGraphicalScrollbar() {
	$('body').append('<img id="leftarrow" src="images/leftarrow.png"></img><div id="hscroll" class="scroll_x"><div class="nub_x"></div><div class="ghost_x"></div></div><img id="rightarrow" src="images/rightarrow.png"></div>');
}
/** Add the scrollbar div (left) **/
function addLeftGraphicalScrollbar() {
	$('body').append('<img id="uparrow" src="images/arrow.png"></img><div id="vscroll" class="scroll_y"><div class="nub_y"></div><div class="ghost_y"></div></div><img id="downarrow" src="images/arrowdn.png"></img>');
}
/** Adjust lower scrollbar to the dataset size **/
function adjustLowerScrollbarSize() {
	var hscroll_size = (windowsize / _COLLENGTH)*100;
	if(hscroll_size < 5) hscroll_size=5;
	LOWERSCROLLNUB = Math.round(hscroll_size);
	$("#hscroll .nub_x").css("width", LOWERSCROLLNUB+"%");
	$("#hscroll .ghost_x").css("width", LOWERSCROLLNUB+"%");
}
/** Add handlers for the scrollbar to navigate through a dataset. */
function addScrollbarHandlers() {
	$(".scroll_x").bind("touchmove", function(event) {		
		// One event only, get position of touch as a percentage.
		var that = $(this);
		var touches = event.originalEvent.touches;
		if (touches.length != 1) return;
		var touch =  touches[0];
		// Compute position of touch as a percentage.
		var xaxis = that.attr("id") == "hscroll";
		var x = (touch.pageX - that.offset().left) / that.width();
		var percent = x;
		var temp = parseFloat(LOWERSCROLLNUB/100).toFixed(1);
		var clampLower = parseFloat(1-temp).toFixed(1);
		percent = percent.clamp(0, clampLower);// 1 - (windowsize / (xaxis ? dDataSet.columns.length : dDataSet.rows.length) )
		// Update scrollbars.
		that.find(".nub_x").css(xaxis ? "left" : "top", (percent * 100) + "%");
		// Adjust the percentage relative to the window size.
		if (xaxis) target_wCol = Math.floor(_COLLENGTH * percent);
		else target_wRow = Math.floor(_ROWLENGTH * percent);
		scrollAnimate();
	});
	$('#rightarrow').bind("touchstart", function(event) {
		var that = $(this);
		that.attr("src", "images/rightarrow_sel.png");
		if(target_wCol < parseInt(_COLLENGTH)-windowsize && target_wCol > -1) {
			target_wCol += 1;
			scrollAnimate();
		}
	});
	$('#leftarrow').bind("touchstart", function(event) {
		var that = $(this);
		that.attr("src", "images/leftarrow_sel.png");
		if(target_wCol > -1) {
			target_wCol -= 1;
			scrollAnimate();
		}
	});	
	$('#rightarrow').bind("touchend", function(event) {	var that = $(this);	that.attr("src", "images/rightarrow.png"); });
	$('#leftarrow').bind("touchend", function(event) {	var that = $(this);	that.attr("src", "images/leftarrow.png"); });
}
/** Animate the scrolling action on the lower panel (x axis) **/
function scrollAnimate() {
	// Cap targets and current.
	target_wCol = target_wCol.clamp(0, _COLLENGTH);
	current_wCol = current_wCol.clamp(0, _COLLENGTH);
	// Move slider/send data if current position doesn't equal to target
	if(current_wCol != target_wCol) {
		// Make sure we are running fast!
		send("zixelspeed", { speed: 0 });
		// Compute direction of motion.
		var step = 1;
		var dx = (target_wCol < current_wCol) ? -step : step;
		// Bring it closer.
		var bMoved = false;
		if (target_wCol != current_wCol) { current_wCol += dx; bMoved -= true; }
		// Redraw and repeat.
		redraw(current_wCol);
		setTimeout(scrollAnimate, 500);
	}
}
/** Redraw the data set with a given window. */
function redraw(wcol) {
	// Limit to 0 and len-windowsize.
	wcol = wcol.clamp(0, _COLLENGTH - windowsize);
	 // Compute the window.
	var data = emptyBlock();
	var yindex = parseInt(localStorage.getItem('YINDEX'));
	for (var row=0; row<windowsize; ++row){
		for (var col=0; col<windowsize; ++col) { 
			data[row][col] = _allData[yindex + row][wcol + col]; 
		}
	}
	localStorage['XINDEX'] = wcol;
	_LastDataSet = data;
	localStorage["LASTDATASET"] = JSON.stringify(data);
	// Push to the graph with explicit normalisation parameters.
	
	send("boundeddataset", { 
		data:_LastDataSet,
		minz: DATAMIN - (DATAMIN * 0.2),
		maxz: DATAMAX + ((DATAMAX-DATAMIN) * 0.8),
	});
	// Update the rows and column labels to reflect the new window.
	for (var i=0; i<windowsize; ++i) { setXAxisLabel(i, _allCols[wcol + i]); }
	// Update the position of the ghost scrollbars on the lower panel.
	$("#hscroll .ghost_x").css("left", ((wcol / _COLLENGTH) * 100) + "%");
}

/* ========================================================================
 * ====================== LEFT PANEL scrollbar ============================
 * ========================================================================
 */
function adjustLeftScrollbarSize() {
	var limiter=1; //look and feel purposes
	var vscroll_size = (windowsize / _ROWLENGTH)*100;
	if(vscroll_size < 5) vscroll_size=5;
	LEFTSCROLLNUB = Math.round(vscroll_size);
	$("#vscroll .nub_y").css("height", (LEFTSCROLLNUB-limiter)+"%");
	$("#vscroll .ghost_y").css("height", LEFTSCROLLNUB+"%");
}
 
 /** Handlers for scrolling on the left hand panel (i.e. y axis). **/
function addLeftScrollbarHandlers() {	
	$(".scroll_y").bind("touchmove", function(event) {		
		// One event only, get position of touch as a percentage.
		var that = $(this);
		var touches = event.originalEvent.touches;
		if (touches.length != 1) return;
		var touch =  touches[0];
		// Compute position of touch as a percentage.
		var yaxis = that.attr("id") == "vscroll";
		var y = (touch.pageY - that.offset().top)  / that.height();
		var percent = y;
		var temp = parseFloat(LEFTSCROLLNUB/100).toFixed(1);
		var clampUpper = parseFloat(1-temp).toFixed(1);
		percent = percent.clamp(0, (clampUpper));// 1 - (windowsize / (xaxis ? dDataSet.columns.length : dDataSet.rows.length) )
		// Update scrollbars.
		that.find(".nub_y").css("top", (percent * 100) + "%");
		// Adjust the percentage relative to the window size.
		if (yaxis) target_wRow = Math.floor(_ROWLENGTH * percent);
		else target_wcOL = Math.floor(_COLLENGTH * percent);
		scrollAnimate_Y();
	});
	$('#downarrow').bind("touchstart", function(event) {
		var that = $(this);
		that.attr("src", "images/arrowdn_sel.png");
		if(target_wRow < parseInt(_ROWLENGTH)-windowsize && target_wRow > -1) {
			target_wRow += 1;
			scrollAnimate_Y();
		}
	});
	$('#uparrow').bind("touchstart", function(event) {
		var that = $(this);
		that.attr("src", "images/arrow_sel.png");
		if(target_wRow > -1) {
			target_wRow -= 1;
			scrollAnimate_Y();
		}
	});	
	$('#downarrow').bind("touchend", function(event) {	var that = $(this);	that.attr("src", "images/arrowdn.png"); });
	$('#uparrow').bind("touchend", function(event) {	var that = $(this);	that.attr("src", "images/arrow.png"); });
}
 /** Animate the scrollbar. **/
function scrollAnimate_Y() {
	// Cap targets and current.
	target_wRow = target_wRow.clamp(0, _ROWLENGTH);
	current_wRow = current_wRow.clamp(0, _ROWLENGTH);
	//console.log(target_wRow +" | "+ current_wRow);
	// Move slider/send data if current position doesn't equal to target
	if(current_wRow != target_wRow) {
		// Make sure we are running fast!
		send("zixelspeed", { speed: 0 });
		// Compute direction of motion.
		var step = 1;
		var dy = (target_wRow < current_wRow) ? -step : step;
		// Bring it closer.
		var bMoved = false;
		if (target_wRow != current_wRow) { current_wRow += dy; bMoved -= true;  }
		// Redraw and repeat.
		redraw_Y(current_wRow);
		setTimeout(scrollAnimate_Y, 500);
	} 
}
/** Redraw the data set with a given window. */
function redraw_Y(wrow) {
	// Limit to 0 and len-windowsize.
	wrow = wrow.clamp(0, _ROWLENGTH - windowsize);	
	// Compute the window.
	var data = emptyBlock();
	var xindex = parseInt(localStorage.getItem('XINDEX'));
	for (var row=0; row<windowsize; ++row){
		for (var col=0; col<windowsize; ++col) { 
			data[row][col] = _allData[wrow + row][xindex + col]; 
		}
	}
	localStorage['YINDEX'] = wrow;
	_LastDataSet = data;
	localStorage["LASTDATASET"] = JSON.stringify(data);
	
	// Push to the graph with explicit normalisation parameters.
	send("boundeddataset", { 
		data:_LastDataSet,
		minz: DATAMIN - (DATAMIN * 0.2),
		maxz: DATAMAX + ((DATAMAX-DATAMIN) * 0.8),
	});
	// Update the rows and column labels to reflect the new window.
	for (var i=0; i<windowsize; ++i) {
		setYAxisLabel(i, _allRows[wrow + i])
	}
	// Update the position of the ghost scrollbars on the lower panel.
	$("#vscroll .ghost_y").css("top", ((wrow / _ROWLENGTH) * 100) + "%");
}