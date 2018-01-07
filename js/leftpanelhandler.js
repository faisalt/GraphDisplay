/*
* Handlers for the left-hand panel of the graph display
* Created: 15th May 2015.
*/

/** @brief: handler for when the user drags a row to reorganize them **/
function addDragHandlers() {
	interact('.draggable_y').draggable({
		// enable inertial throwing
		inertia: false,
		// keep the element within the area of it's parent
		restrict: {
		  restriction: "parent",
		  endOnly: true,
		  //elementRect: { top: 0, left: 0.001, bottom: 2, right: 1  }
		},
		// call this function on every dragmove event
		onmove: dragMoveListener,
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
				
				swapRow(r1, r2);
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

/** @brief: handler whilst the user is moving a row **/
function dragMoveListener (event) {
    var target = event.target,
        // keep the dragged position in the data-x/data-y attributes
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
    // translate the element
    target.style.webkitTransform =
    target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
    // update the posiion attributes
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
}