/*
* Handlers for the left-hand panel of the graph display
* Created: 15th May 2015.
*/

/** @brief: handler for when the user drags a row to reorganize them **/
function addLowerDragHandlers() {
	interact('.draggable')
	  .draggable({
		// enable inertial throwing
		inertia: false,
		// keep the element within the area of it's parent
		restrict: {
		  restriction: "parent",
		  endOnly: true,
		  elementRect: { top: 0, left: 0, bottom: 0, right: 0 }
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
		accept: '.draggable',
		ondropactivate: function (event) {
			//add feedback (highlighting) to the target being moved
			event.relatedTarget.classList.add('drag-active');
		},
		ondragenter: function (event) {
			//add feedback (highlighting) to the target being moved to
			$(event.target).parent().find('.draggable').get(0).classList.add('drop-target');
		},
		ondragleave: function (event) {
			//remove feedback (highlighting) from the target being moved to
			$(event.target).parent().find('.draggable').get(0).classList.remove('drop-target');
		},
		ondrop: function (event) {
			//when the user drops a target - if on top of another target, and drop-target is activated, enable swapping
			if($(event.relatedTarget).hasClass('drag-active') &&  
				$(event.target).parent().find('.draggable').hasClass('drop-target') &&
				!$(event.target).parent().find('.draggable').hasClass('drag-active')){
				ENABLESWAP = true;
			} else { ENABLESWAP = false; }
			
			//remove feedback (highlighting) from the target being moved to and also the target
			var a = $('div.drag-active').get(0);
			var b = $('div.drop-target').get(0);
			$a_parent = $('div.drag-active').parent();
			$b_parent = $('div.drop-target').parent();
			
			if(ENABLESWAP == true) {
				$('div.drag-active').remove();
				$('div.drop-target').remove();
				
				$a_parent.prepend(b);
				$b_parent.prepend(a);
				$b_elem = $b_parent.find('.draggable');
				$a_elem = $a_parent.find('.draggable');
				
				$a_elem.css({'transform':'','-webkit-transform':''});
				$b_elem.css({'transform':'','-webkit-transform':''});
				
				//indicate that the swapping has occurred and on which rows
				$a_elem.animate( { backgroundColor:'white'}, 500).animate( { backgroundColor:'#FFFFC8'}, 500, function() { $(this).removeAttr('style');});
				$b_elem.animate( { backgroundColor:'white'}, 500).animate( { backgroundColor:'#FFFFC8'}, 500, function() { $(this).removeAttr('style');});
				
				var r1 = $a_parent.data('idx');
				var r2 = $b_parent.data('idx');
				
				swapRow(r1, r2);
			}
			//event.relatedTarget.classList.remove('drag-active');
			$a_parent.find('.draggable').get(0).classList.remove('drop-target');
			
		},
		ondropdeactivate: function (event) {
			event.relatedTarget.classList.remove('drag-active');
			event.target.classList.remove('drag-active');
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