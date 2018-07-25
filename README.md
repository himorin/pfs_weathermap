Weathermap HTML client of CONBU
===============================

This is client side implementation of weathermap for CONBU API. 
To run this weathermap, user need to setup API server also.

Setup and configuration
-----------------------

Copy files into webroot, and place json configuration file to a specify image 
file of the network map and specifications of network links.

Json configuration file
-----------------------

See sample.json for sample. For production, place json configuration file as 
config.json (hardcoaded in JavaScript).

* config part
  * 'arrow' defines size of arrow
    * 'width' for total width of body
    * 'head' for length of head (head with 90 degree open angle will be drawn, width is twice of 'head')
  * 'target' defines target network information of weathermap
    * 'name' for name of target
    * 'maxsave' for day(s) to store information in LocalStorage, data will be keied with 'target.name'
  * 'data' defines remote data acquisition handling: if 'url' is specified, acquire remote data from 'url' (default '' - no read) with interval of 'interval' seconds (default 60 seconds).
  * 'image' defines background image
    * 'file' for file name
    * 'width' and 'height' for display size
    * 'font' for font size in SVG
    * 'legend' for top-left of legend window by x and y
    * 'lastupdated' for top-left of last updated string by x and y
    * 'locale' for locale of display (e.g. date format of last updated, user agent default if null)
  * 'load' defines color scheme
    * "na" (if none applicable) and "unit" (for legend) are required
    * "max" is optional for values over the maximum threshold with default of "na"
    * add number with html color key pair for threshold. numbers are considered as max of each span.
    * 0 to minimum number is the first span with color specified as the minimum nubmer one.
    * "conv" is a conversion rate from raw data to display data, like bps to Mbps (set to 1000000.0)
  * 'history' defines array of color scheme used in history graph
    * just an array but not hash. default to list in weathermap.js
* link part
  * each entry is identified by its key
  * each entry shall have 'up' and 'down' with a pair of 'x' and 'y' for position at image
    * if 'name' is defined for each ('up' or 'down') its value will be used for an identifier (key) to get value from JSON data
  * 'up' is a position of up side of link, 'down' is of down side

Json data file and periodic data update
---------------------------------------

This script will try to read Json data file from specified URL in config 
part (config.data.url), if nothing defined as its value just do nothing.
For each point of data file acquisition, display will be updated by 
configuration and continues to operate. 
Once error occurs on periodic data upadte, such as 404 return from server 
or invalid JSON data, periodical operation will stop. 
Data from specified URL are taken as raw read value (cumulative) but not 
network bandwidth like in bps.

Also, user script can call 'SetLoadData' function with one hash to update. 

Graph SVG
---------

You can modify default SVG definitions in index.html, but also change defConfig 
hash for graph_history part. xorig, xwidth, yorig, ywidth is defined for 
origin point of x (value), width of x (normally negative), and both for y 
(time). 

