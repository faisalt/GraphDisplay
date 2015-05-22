/* 
* Configuration file to declare constants, etc. 
*/

// Websocket port
var WS_PORT = 8383;

// Number of 'bars' on the x and y axis
var Y_LIMIT = 10;
var X_LIMIT = 10;

// Host reference
//var HOST = "148.88.227.201";
var HOST = "localhost";

// URL to datasets
var DS_URL = "http://"+HOST+"/GraphDisplay/data/";

// Dataset to use
var FORCE_DS = "Rainfall-v2";

// Should AJAX calls use the cache?
$.ajaxSetup({ cache: false });

/* GLOBAL variables */
localStorage['XINDEX'] = 0;
localStorage['YINDEX'] = 0;
localStorage["LASTDATASET"]=[]; // Dataset changes from other panels - e.g. if user scrolls through values in lower panel.
localStorage["ANNOTATED"]=[]; // List of Annotated bars (x,y coordinates that need to be recorded).
localStorage["SWAPPEDCOLS"]=[]; // List of columns that have been swapped (re organized).
localStorage["SWAPPEDROWS"]=[]; // List of rows that have been swapped (re organized).

localStorage["DATAINITIALIZED"]=false; // TO DO : avoid data reset when a new display connects (if one is already connected).

// Debug mode
var DEBUG_MODE = true;