function addLowerNavigationScrollbar() {
	addGraphicalScrollbar();
	addScrollbarHandlers();
}
function addLeftNavigationScrollbar() {
	addLeftGraphicalScrollbar();
	addLeftScrollbarHandlers();
}

function addGraphicalScrollbar() {
	$('body').append('<div id="hscroll" class="scroll_x"><div class="nub_x"></div><div class="ghost_x"></div></div>');
}

function addLeftGraphicalScrollbar() {
	$('body').append('<div id="vscroll" class="scroll_y"><div class="nub_y"></div><div class="ghost_y"></div></div>');
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
		var y = (touch.pageY - that.offset().top)  / that.height();
		var percent = xaxis ? x : y;
		percent = percent.clamp(0, 0.9);// 1 - (windowsize / (xaxis ? dDataSet.columns.length : dDataSet.rows.length) )

		// Update scrollbars.
		that.find(".nub_x").css(xaxis ? "left" : "top", (percent * 100) + "%");
		
		// Adjust the percentage relative to the window size.
		if (xaxis) target_wCol = Math.floor(_COLLENGTH * percent);
		else target_wRow = Math.floor(_ROWLENGTH * percent);
		
		scrollAnimate();
	});
}

function scrollAnimate() {
	// Make sure we are running fast!
	send("zixelspeed", { speed: 0 });
	
	// Cap targets and current.
	target_wCol = target_wCol.clamp(0, _COLLENGTH);
	target_wRow = target_wRow.clamp(0, _ROWLENGTH);
	current_wCol = current_wCol.clamp(0, _COLLENGTH);
	current_wRow = current_wRow.clamp(0, _ROWLENGTH);
	
	// Move slider/send data if current position doesn't equal to target
	if(current_wCol != target_wCol) {
		// Compute direction of motion.
		var step = 1;
		var dx = (target_wCol < current_wCol) ? -step : step;
		var dy = (target_wRow < current_wRow) ? -step : step;
		
		// Bring it closer.
		var bMoved = false;
		if (target_wCol != current_wCol) { current_wCol += dx; bMoved -= true; }
		if (target_wRow != current_wRow) { current_wRow += dy; bMoved -= true;  }
		
		// Redraw and repeat.
		redraw(current_wRow, current_wCol);
		setTimeout(scrollAnimate, 500);
	}
}
/** Redraw the data set with a given window. */
function redraw(wrow, wcol) {
	// Limit to 0 and len-windowsize.
	wrow = wrow.clamp(0, _ROWLENGTH - windowsize);
	wcol = wcol.clamp(0, _COLLENGTH - windowsize);
	 // Compute the window.
	var data = emptyBlock();
	for (var row=0; row<windowsize; ++row){
		for (var col=0; col<windowsize; ++col) { 
			data[row][col] = _allData[wrow + row][wcol + col]; 
		}
	}
	_LastDataSet = data;
	// Push to the graph with explicit normalisation parameters.
	send("boundeddataset", { 
		data:_LastDataSet,
		minz: DATAMIN - (DATAMIN * 0.2),
		maxz: DATAMAX + ((DATAMAX-DATAMIN) * 0.8),
	});
	// Update the rows and column labels to reflect the new window.
	for (var i=0; i<windowsize; ++i) {
		setXAxisLabel(i, _allCols[wcol + i])
		setYAxisLabel(i, _allRows[wrow + i])
	}
	// Update the position of the ghost scrollbars on the lower panel.
	$("#hscroll .ghost_x").css("left", ((wcol / _COLLENGTH) * 100) + "%");
	$("#vscroll .ghost_x").css("top", ((wrow / _ROWLENGTH) * 100) + "%");
}


function addLeftScrollbarHandlers() {
	$(".scroll_y").bind("touchmove", function(event) {		
		// One event only, get position of touch as a percentage.
		var that = $(this);
		var touches = event.originalEvent.touches;
		if (touches.length != 1) return;
		var touch =  touches[0];
		
		// Compute position of touch as a percentage.
		var yaxis = that.attr("id") == "vscroll";
		var x = (touch.pageX - that.offset().left) / that.width();
		var y = (touch.pageY - that.offset().top)  / that.height();
		var percent = yaxis ? y : x;
		percent = percent.clamp(0, 0.9);// 1 - (windowsize / (xaxis ? dDataSet.columns.length : dDataSet.rows.length) )

		// Update scrollbars.
		that.find(".nub_y").css(yaxis ? "top" : "left", (percent * 100) + "%");
		
		// Adjust the percentage relative to the window size.
		if (yaxis) target_wRow = Math.floor(_ROWLENGTH * percent);
		else target_wcOL = Math.floor(_COLLENGTH * percent);
		
		scrollAnimate_Y();
	});
}


function scrollAnimate_Y() {
	// Make sure we are running fast!
	send("zixelspeed", { speed: 0 });
	
	// Cap targets and current.
	target_wCol = target_wCol.clamp(0, _COLLENGTH);
	target_wRow = target_wRow.clamp(0, _ROWLENGTH);
	current_wCol = current_wCol.clamp(0, _COLLENGTH);
	current_wRow = current_wRow.clamp(0, _ROWLENGTH);
	// Move slider/send data if current position doesn't equal to target
	if(current_wRow != target_wRow) {
		// Compute direction of motion.
		var step = 1;
		var dx = (target_wCol < current_wCol) ? -step : step;
		var dy = (target_wRow < current_wRow) ? -step : step;
		
		// Bring it closer.
		var bMoved = false;
		if (target_wCol != current_wCol) { current_wCol += dx; bMoved -= true; }
		if (target_wRow != current_wRow) { current_wRow += dy; bMoved -= true;  }
		
		// Redraw and repeat.
		redraw_Y(current_wRow, current_wCol);
		setTimeout(scrollAnimate_Y, 500);
	}
}

/** Redraw the data set with a given window. */
function redraw_Y(wrow, wcol) {
	// Limit to 0 and len-windowsize.
	wrow = wrow.clamp(0, _ROWLENGTH - windowsize);
	wcol = wcol.clamp(0, _COLLENGTH - windowsize);
	
	// Compute the window.
	var data = emptyBlock();
	for (var row=0; row<windowsize; ++row){
		for (var col=0; col<windowsize; ++col) { 
			data[row][col] = _allData[wrow + row][wcol + col]; 
		}
	}
	_LastDataSet = data;
	// Push to the graph with explicit normalisation parameters.
	send("boundeddataset", { 
		data:_LastDataSet,
		minz: DATAMIN - (DATAMIN * 0.2),
		maxz: DATAMAX + ((DATAMAX-DATAMIN) * 0.8),
	});
	// Update the rows and column labels to reflect the new window.
	for (var i=0; i<windowsize; ++i) {
		setXAxisLabel(i, _allCols[wcol + i])
		setYAxisLabel(i, _allRows[wrow + i])
	}
	// Update the position of the ghost scrollbars on the lower panel.
	$("#hscroll .ghost_x").css("left", ((wcol / _COLLENGTH) * 100) + "%");
	$("#vscroll .ghost_x").css("top", ((wrow / _ROWLENGTH) * 100) + "%");
}