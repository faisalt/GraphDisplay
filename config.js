/* 
* Configuration file to declare constants, etc. 
*/

// Websocket port
var WS_PORT = 8383;

// Number of 'bars' on the x and y axis
var Y_LIMIT = 10;
var X_LIMIT = 10;

// Host reference
var HOST = "148.88.227.243";
//var HOST = "localhost";

// URL to datasets
var DS_URL = "http://"+HOST+"/GraphDisplay/data/";

// Dataset to use
var FORCE_DS = "Rainfall-v2";

// Should AJAX calls use the cache?
$.ajaxSetup({ cache: false });

// Debug mode
var DEBUG_MODE = false;