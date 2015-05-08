
/*
 * Snippit code for various API Calls.
 * John Hardy 2012
 * 
 * 
 */
 
 
 
/**
 * Getting information about the surface your application is displayed on.
 */
console.log( Surface.Name );        // Will give you the name of the surface this display is on.
console.log( Surface.Width );       // The width of the current surface in meters.
console.log( Surface.Height );      // The height of the current surface in meters.
console.log( Surface.AspectRatio ); // The w/h aspect ration of the current surface.
console.log( Surface.Angle );       // The angle of the current surface relative to the calibration plane (i.e. desk / wall / floor etc).



/**
 * Enable multi-touch.
 * You will need to have included this script: transient_api.js in your <head>.
 */
var mt = null;  // Global variable that allows you to control the touch processor.

$(document).ready(function() {  // Called once the page has finished loading.
	
	// Get us some multitouch.
	mt = new KinectTouch({
		debug : false,              // Turn on debug points.
		trails : true,              // Turn on finger trails (this shows the Kinect data used to detect the finger).
		point_limit : 200,          // The number of points we are allowed to process at once.  Turning this up can get laggy.
		surface_zoffset : 0.015,    // The offset from the surface (in meters) at which to start capturing data.
		height : 0.01,              // The distance from the surface offset (in meters) at which to stop capturing data.
	});
	
	// Update the surface properties
	Surface_PropertiesChanged();
});




/**
 * Handling changes to the size of the display.
 * The 'Surface_PropertiesChanged' function is called by the toolkit if the display changes.
 */
// You can implement it on your own pages like this:
function Surface_PropertiesChanged()
{
	// Resize some elements??
}




/**
 * Listen to touch events with JQuery.
 */

// When the touch is started.
$('#some_id').bind('touchstart', function(e)
{
	// Do something.. perhaps change the touched element to orange?
	$(this).css({"background-color": "orange"});
}

// When the touch is stopped.
$('#some_id').bind('touchend', function(e)
{
	// Do something.. 
}

// When the touch is moved or hovering over (one event every frame).
$('#some_id').bind('touchmove', function(e)
{
	// Do something.. 
}

// You can get the following data out of the touch event 'e'.

$('#some_id').bind('touchmove', function(e)
{
	var orig = e.originalEvent;   // Get the non-jquery wrapped event.
	
	orig.touches               // The list of current touches.
	orig.targetTouches         // The list of current touches, that are touching this element.
	orig.changedTouches        // [touch, ] The touch that fired the event.
	orig.targetTouches.length  // The number of touches in the target element.
	
	var touch = orig.targetTouches[0];
	touch.identifier  // A unique number for this touch.
	touch.pageX       // The position of the touch in X. (0 = left)
	touch.pageY       // The position of the touch in Y. (0 = top)
	touch.target      // The element that has been touched.
	
}




// Please be aware, that JQuery wraps events - you will need to use e.originalEvent 
// http://stackoverflow.com/questions/7878617/jquery-and-touchstart-touchmove-touchend


/**
 * @brief Converts x pixels to meters for the display that calls it.
 * @param f The number of pixels.
 * @param axis "w" or "h".
 * @return f pixels in meters.
 */
w = Convert_Pixels2Meters(800, "w");
h = Convert_Pixels2Meters(600, "h");

/**
 * @brief Converts x meters to pixels for the display that calls it.
 * @param f The number of meters.
 * @param axis "w" or "h".
 * @return f meters in pixels.
 */
wpx = Convert_Meters2Pixels(0.10, "w");
hpx = Convert_Meters2Pixels(0.10, "h");




/**
 * Playing a sound stored on the HDD.  This only accepts WAV files.
 */
Authority.request("PlaySound", { file : "C:\\Users\\John\\Desktop\\sounds\\move-it.wave" });


/**
 * @brief Detect motion in an area above (or below) a display surface.
 * This works by creating a virtual 3D cube (usually above a display).  When the Kinect detects movement in this space, it will call a function
 * (even if nothing is detected) which says how much movement was detected.
 * The movement is an array of 3D points (given as a percentage of the surface dimensions).
 */
Authority.request("KinectLowestPointCube", {
	relativeto : Surface.Name,		     // The surface you want to use to position the detector relative too.
	surface_zoffset : 0.01,              // The offset from the surface (in meters) at which to start capturing data (i.e. the bottom of the cube).
	height: 0.05,                        // The distance from the surface offset (in meters) at which to stop capturing data (i.e. the top of the cube).
	point_limit : 200,                   // The number of points we are allowed to process at once.  Turning this up can get laggy.
	callback : "Handle_MotionDetection", // The function to call when motion is detected.
});

// Called when motion is detected.
function Handle_MotionDetection(points)
{
	// If nothing was detected.
	if (points.length == 0)
	{
		// Do something.
	}
	
	// If we have a significant amount of motion.
	else if (points.length > 40)
	{
		// Do something else.
	}
	
	// If not!
	else
	{
		// Otherwise, do not!
	}
	
	// Get the first motion point [0] in the array.
	// The coordinates are in the 0-1 range.
	//var x = Math.abs(points[0][0]);
	//var y = Math.abs(points[0][1]);
	//var z = Math.abs(points[0][2]);
}


/**
 * Sending Messages between displays.
 */
// In the JS of the calling display.
Authority.call("Surface 1", "functionName", { "some" : "data" });

// In the JS of the receiving display.
function functionName(src_name, data)
{
	console.log(src_name) ; // The name of the calling surface.
	console.log(data.some); // Some data it sent in the message.
}




/**
 * Close this display (i.e. the one which called the function).
 * This will remove the web-page content that is currently on it.
 */
Authority.request("closedisplay");




/**
 * Close a display on another surface (i.e. one that did not necessarily call the function).
 * This will remove the web-page content that is currently on it.
 */
Authority.request("closetargetdisplay", { target : "Surface Name" } );




/**
 * Move this display to another surface.
 * @param dest The name of the surface you want this (the calling display) to move too.
 * Note: If there is another display open on the target surface, it will be closed.
 */
Authority.request("movedisplay", { dest : "New Surface Name" } );




/**
 * Swap this display with one on another surface.
 * @param target The name of the surface you want this (the calling display) to appear on.
 * Note: If there is another display open on the target surface, it will swap places with the calling display.
 */
Authority.request("swapdisplay", { target : "Surface 2" } );




/**
 * Move a target display to another surface.
 * @param target The name of the surface which you want to move.
 * @param dest The name of the surface you want the target display to move too.
 * @param override If the dest surface already has a display on it, setting this to True will remove it and replace it with our display.
 *                 If this is set to false, the call will do nothing.
 */
Authority.request("movetargetdisplay", { target : "Surface 1", dest : "Surface 2", override : true } );




/**
 * Swap a target display with one on another surface.
 * @param target The name of the surface which you want to close
 * @param dest The name of the surface you want the target display to move too.
 */
Authority.request("swaptargetdisplays", { target1 : "Surface 1", target2 : "Surface2" } );




/**
 * Find out what surfaces are available.
 */
Authority.request("surfacelist", { callback : "myfunction" } );

// The function that will be called with the information you requested.
function myfunction(surface_list) {
	for (var i = 0; i < surface_list.length; ++i)
	    console.log(surface_list[i]);
}




/**
 * Get information about the surfaces that exist.
 */
Authority.request("surfaceinfo", { callback : "myfunction", surfaces : ["Surface 1", "Surface 2"] } );

// The function that will be called with the information you requested.
function myfunction(surfaces) {
	for(var name in surfaces) {
		// You can then get at the details of a surface like so:
		/*
		surfaces[name].Name  // Its unique id.
		surfaces[name].View  // The URL of the display on the surface. Null if empty.
		surfaces[name].Width
		surfaces[name].Height
		surfaces[name].AspectRatio
		surfaces[name].Angle
		surfaces[name].World // Contains world coordinates.. see 'Surface.World.topleft.x' etc.
		*/
	}
}





/**
 * Getting information about the surface you are on, in and its place in the world.
 */
console.log ( Surface.World.topleft.x, Surface.World.topleft.y, Surface.World.topleft.z );                 // Top left coordinate.
console.log ( Surface.World.topright.x, Surface.World.topright.y, Surface.World.topright.z );              // Top right coordinate.
console.log ( Surface.World.bottomleft.x, Surface.World.bottomleft.y, Surface.World.bottomleft.z );        // Bottom left coordinate.
console.log ( Surface.World.bottomright.x, Surface.World.bottomright.y, Surface.World.bottomright.z );     // Bottom right coordinate.
console.log ( Surface.World.normal.x, Surface.World.normal.y, Surface.World.normal.z );                    // Normal to the surface plane.


