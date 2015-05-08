/* 
 * 
 * This is an API which wraps access to Markus Funk's object detection code.
 * 
 * 
 * Created: 27th May 2012
 * 
 */

/** Are we currently running an object search? */
var ObjectSearch_Running = false;

/**
 * @brief Search for an object in a particular area by looking at the
 * objects in the folder path.
 * @param sFolderPath The path to the folder to search.
 * @param jCallback A function to call back once all objects have been detected.
 * @param jCallbackLive A function to call back with the detected object as soon as it happens. Async.
 * @param iWebcam The number of the webcam to use. i.e. 0 or 1
 * @param bDebug Are we in debug mode.
 */
function ObjectSearch (sFolderPath, jCallback, jCallbackLive, iWebcam, bDebug) {
	
	// Prevent the object search from running twice.
	if (ObjectSearch_Running == true)
	{
		console.log("Object search is already running. Skipping.");
		return;
	}
	
	// Start it.
	ObjectSearch_Running = true;
	
	// Settings.
	iWebcam = iWebcam || 0;
	bDebug  = bDebug  || true;
	var sProcessPath = "C:\\ObjectDetection\\bin\\ObjectDetectionSuite.exe";
	var sDebug = ""+bDebug;// "true" // "true"
	var iCheckCount = 3;
	
	
	// List of found objects.
	var lOutput = [];
	
	// Create a temp callback function for the data.
	var sDataCallback   = "ObjectSearch_DataCB";
	window["ObjectSearch_DataCB"] = function(data)
	{
		// Check it is useful data.
		if (data.indexOf("<OBJECT>") == 0)
		{
			var sFile = data.substring(8);
			lOutput.push(sFile);
			if (jCallbackLive)
				jCallbackLive(sFile);
		}
	};
	
	// Create a temp callback function for when the process terminates.
	var sFinishCallback = "ObjectSearch_FinishCB";
	window["ObjectSearch_FinishCB"] = function(data)
	{
		// Tada!
		//console.log("Object Search Complete");
		
		// reset the flag.
		ObjectSearch_Running = false;
		
		// clean up
		delete window["ObjectSearch_DataCB"]
		delete window["ObjectSearch_FinishCB"]
		
		// Callback with all objects.
		if (jCallback)
			jCallback(lOutput);
	};
	
	Authority.log(sFolderPath+" "+iCheckCount+" "+sDebug+" " + iWebcam)
	// Make the request to start the object detector.
	Authority.request("startprocess", {
		
		"process" : sProcessPath,
		"arguments" : sFolderPath+" "+iCheckCount+" "+sDebug,
		//"arguments" : sFolderPath+" "+iCheckCount+" "+sDebug+" " + iWebcam,
		
		"async" : true,
		"callback" : sDataCallback,
		"finished" : sFinishCallback,
		
		"nowindow" : !bDebug, // false shows window
	});
	
};