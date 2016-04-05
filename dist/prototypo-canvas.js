(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("prototypo"));
	else if(typeof define === 'function' && define.amd)
		define(["prototypo"], factory);
	else if(typeof exports === 'object')
		exports["PrototypoCanvas"] = factory(require("prototypo"));
	else
		root["PrototypoCanvas"] = factory(root["prototypo"]);
})(this, function(__WEBPACK_EXTERNAL_MODULE_2__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	var prototypo		= __webpack_require__(2);
	var assign			= __webpack_require__(3).assign;
	var EventEmitter	= __webpack_require__(4);
	var glyph			= __webpack_require__(5);
	var mouseHandlers	= __webpack_require__(6);
	var init			= __webpack_require__(7);
	var loadFont		= __webpack_require__(9);
	
	var _ = { assign: assign },
		paper = prototypo.paper;
	
	// constructor
	function PrototypoCanvas( opts ) {
		paper.setup( opts.canvas );
		paper.settings.hitTolerance = 1;
		// enable pointerevents on the canvas
		opts.canvas.setAttribute('touch-action', 'none');
	
		this.opts = _.assign({
			fill: true,
			shoNodes: false,
			zoomFactor: 0.05,
			jQueryListeners: true,
			glyphrUrl: 'http://www.glyphrstudio.com/online/'
		}, opts);
	
		this.canvas = opts.canvas;
		this.view = paper.view;
		this.view.center = [ 0, 0 ];
		this.project = paper.project;
		this.project.activeLayer.applyMatrix = false;
		this.project.activeLayer.scale( 1, -1 );
		this.worker = opts.worker;
		this._queue = [];
		this._fill = this.opts.fill;
		this._showNodes = this.opts.showNodes;
		this.fontsMap = {};
		this.isMousedown = false;
		this.exportingZip = false;
	
		// this.grid = new Grid( paper );
	
		// bind workerHandlers
		if ( this.worker ) {
			this.worker.addEventListener('message', function(e) {
				// the job might have been cancelled
				if ( !this.currentJob ) {
					return;
				}
	
				if ( this.currentJob.callback ) {
					this.currentJob.callback( e.data );
	
				// default callback for buffers: use it as a font
				} else if ( e.data instanceof ArrayBuffer ) {
					try {
						this.font.addToFonts( e.data );
						this.emitEvent( 'worker.fontLoaded');
	
					} catch ( error ) {
						this.emitEvent( 'fonterror', [ error ] );
					}
				}
	
				this.currentJob = false;
				this.dequeue();
	
			}.bind(this));
		}
	
		// bind mouseHandlers (jQuery is an optional dependency)
		if ( ( 'jQuery' in window ) && this.opts.jQueryListeners ) {
			var $ = window.jQuery,
				type = ( 'PointerEventsPolyfill' in window ) ||
					( 'PointerEvent' in window ) ? 'pointer' : 'mouse';
	
			$(opts.canvas).on( 'wheel', this.onWheel.bind(this) );
	
			$(opts.canvas).on( type + 'move', this.onMove.bind(this) );
	
			$(opts.canvas).on( type + 'down', this.onDown.bind(this) );
	
			$(document).on( type + 'up', this.onUp.bind(this) );
		}
	
		// setup raf loop
		var raf = window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame,
			updateLoop = function() {
				raf(updateLoop);
	
				if (
					!this.latestRafValues ||
					!this.currGlyph ||
					this.exportingZip
				) {
					return;
				}
	
				this.font.update( this.latestRafValues, [ this.currGlyph ] );
				this.view.update();
				delete this.latestRafValues;
	
			}.bind(this);
		updateLoop();
	}
	
	PrototypoCanvas.prototype = Object.create( EventEmitter.prototype );
	PrototypoCanvas.init = init;
	PrototypoCanvas.prototype.loadFont = loadFont;
	_.assign( PrototypoCanvas.prototype, mouseHandlers );
	
	Object.defineProperties( PrototypoCanvas.prototype, {
		zoom: {
			get: function() {
				return this.view.zoom;
			},
			set: function( zoom ) {
				this.view.zoom = zoom;
				// this.grid.zoom = zoom;
			}
		},
		fill: {
			get: function() {
				return this._fill;
			},
			set: function( bool ) {
				this._fill = bool;
				this.displayGlyph();
			}
		},
		showNodes: {
			get: function() {
				return this._showNodes;
			},
			set: function( bool ) {
				this._showNodes = bool;
				this.displayGlyph();
			}
		},
		showCoords: {
			get: function() {
				return paper.settings.drawCoords;
			},
			set: function( bool ) {
				paper.settings.drawCoords = bool;
				this.displayGlyph();
			}
		},
		subset: {
			get: function() {
				return this.font.subset;
			},
			set: function( set ) {
				this.enqueue({
					type: 'subset',
					data: set
				});
	
				this.font.subset = set;
			}
		}
	});
	
	PrototypoCanvas.prototype.displayGlyph = glyph.displayGlyph;
	
	PrototypoCanvas.prototype.displayChar = function( code ) {
		this.latestChar = code;
		this.displayGlyph( typeof code === 'string' ?
			this.font.charMap[ code.charCodeAt(0) ] : code
		);
	};
	
	// overwrite the appearance of #selected items in paper.js
	paper.PaperScope.prototype.Path.prototype._drawSelected = glyph._drawSelected;
	_.assign( paper.settings, {
		handleSize: 6,
		handleColor: '#FF725E',
		skeletonColor: '#24D390',
		nodeColor: '#00C4D6',
		drawCoords: false,
		handleFont: '12px monospace'
	});
	
	// The worker queue is not your ordinary queue: the priority of the job is
	// defined arbitrarily, and any message previously present
	// at this position will be overwritten. The priorities associated to the
	// message type are hardcoded below (in ascending priority order).
	PrototypoCanvas.priorities = [
		'update',
		'subset',
		'svgFont',
		'otfFont',
		'alternate'
	];
	
	PrototypoCanvas.prototype.enqueue = function( message ) {
		var priority = PrototypoCanvas.priorities.indexOf( message.type );
	
		if (this._queue[ priority ] === undefined) {
			this._queue[ priority ] = [];
		}
	
		if ( message.serialized ) {
			this._queue[ priority ].push(message);
	
		} else {
			this._queue[ priority ][0] = message;
		}
	
		this.dequeue();
	};
	
	PrototypoCanvas.prototype.dequeue = function() {
		if ( this.currentJob || !this.worker ) {
			return;
		}
	
		// send the highest priority mesage in the queue (0 is lowest)
		for ( var i = this._queue.length; i--; ) {
			if ( this._queue[i] && this._queue[i].length > 0 ) {
				this.currentJob = this._queue[i].shift();
	
				// the callback function shouldn't be sent
				var cb = this.currentJob.callback;
				delete this.currentJob.callback;
	
				this.worker.postMessage( this.currentJob );
	
				this.currentJob.callback = cb;
				break;
			}
		}
	};
	
	PrototypoCanvas.prototype.emptyQueue = function() {
		this._queue = [];
		this.currentJob = false;
	};
	
	PrototypoCanvas.prototype.update = function( values ) {
		// latestValues are used in displayGlyph
		// latestWorkerValues is used and disposed by th/sue fontBufferHandler
		// latestRafValues is used and disposed by the raf loop
		// so we need all three!
		this.latestValues = this.latestRafValues = values;
	
		this.enqueue({
			type: 'update',
			data: values
		});
	};
	
	PrototypoCanvas.prototype.setAlternateFor = function( unicode, glyphName ) {
		if ( !glyphName ) {
			Object.keys(unicode).forEach(function(code) {
	
				if ( +code === this.currGlyph.src.unicode ) {
					this.displayChar( this.font.glyphMap[unicode[code]] );
				}
	
				this.font.setAlternateFor(code, unicode[code]);
			}.bind(this));
	
			this.enqueue({
				type: 'alternate',
				data: {
					altList: unicode
				}
			});
		} else {
			this.font.setAlternateFor( unicode, glyphName );
	
			this.displayChar( this.font.glyphMap[glyphName] );
	
			this.enqueue({
				type: 'alternate',
				data: {
					unicode: unicode,
					glyphName: glyphName
				}
			});
		}
		this.update( this.latestValues );
	};
	
	PrototypoCanvas.prototype.download =
		function( cb, name, merged, values, user) {
			this.generateOtf(function( data ) {
				this.font.download( data, merged, name, user );
				if ( cb ) {
					cb();
				}
			}.bind(this), name, false, values);
		};
	
	PrototypoCanvas.prototype.getBlob = function( cb, name, merged, values ) {
		return new Promise(function( resolve, reject ) {
			try {
				this.generateOtf( function( data ) {
					resolve( {
						buffer: data,
						variant: name.style
					});
					if ( cb ) {
						cb();
					}
				}, name, merged, values, true);
			} catch ( err ) {
				reject(err);
			}
		}.bind(this));
	};
	
	PrototypoCanvas.prototype.generateOtf =
		function( cb, name, merged, values, serialized ) {
			if ( !this.worker || ( !this.latestValues && !values ) ) {
				// the UI should wait for the first update to happen before allowing
				// the download button to be clicked
				return false;
			}
	
			this.enqueue({
				type: 'otfFont',
				data: {
					family: name && name.family,
					style: name && name.style,
					merged: merged,
					values: values
				},
				callback: function( data ) {
					if ( cb ) {
						cb(data);
					}
				},
				serialized: serialized
			});
		};
	
	PrototypoCanvas.prototype.openInGlyphr = function( cb ) {
		if ( !this.worker || !this.latestValues ) {
			// the UI should wait for the first update to happen before allowing
			// the download button to be clicked
			return false;
		}
	
		this.enqueue({
			// otf/svg switch
			type: 'otfFont',
			// type: 'svgFont',
			callback: function( data ) {
				var handler = function(e) {
					window.removeEventListener('message', handler);
					if ( e.data !== 'ready' ) {
						return;
					}
					// otf/svg switch
					e.source.postMessage( data, e.origin, [ data ] );
					// e.source.postMessage( data, e.origin );
					if ( cb ) {
						cb();
					}
				};
	
				window.open( this.opts.glyphrUrl );
				window.addEventListener('message', handler);
			}.bind(this)
		});
	};
	
	module.exports = PrototypoCanvas;


/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_2__;

/***/ },
/* 3 */
/***/ function(module, exports) {

	/**
	 * Code refactored from Mozilla Developer Network:
	 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
	 */
	
	'use strict';
	
	function assign(target, firstSource) {
	  if (target === undefined || target === null) {
	    throw new TypeError('Cannot convert first argument to object');
	  }
	
	  var to = Object(target);
	  for (var i = 1; i < arguments.length; i++) {
	    var nextSource = arguments[i];
	    if (nextSource === undefined || nextSource === null) {
	      continue;
	    }
	
	    var keysArray = Object.keys(Object(nextSource));
	    for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
	      var nextKey = keysArray[nextIndex];
	      var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
	      if (desc !== undefined && desc.enumerable) {
	        to[nextKey] = nextSource[nextKey];
	      }
	    }
	  }
	  return to;
	}
	
	function polyfill() {
	  if (!Object.assign) {
	    Object.defineProperty(Object, 'assign', {
	      enumerable: false,
	      configurable: true,
	      writable: true,
	      value: assign
	    });
	  }
	}
	
	module.exports = {
	  assign: assign,
	  polyfill: polyfill
	};


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/*!
	 * EventEmitter v4.2.11 - git.io/ee
	 * Unlicense - http://unlicense.org/
	 * Oliver Caldwell - http://oli.me.uk/
	 * @preserve
	 */
	
	;(function () {
	    'use strict';
	
	    /**
	     * Class for managing events.
	     * Can be extended to provide event functionality in other classes.
	     *
	     * @class EventEmitter Manages event registering and emitting.
	     */
	    function EventEmitter() {}
	
	    // Shortcuts to improve speed and size
	    var proto = EventEmitter.prototype;
	    var exports = this;
	    var originalGlobalValue = exports.EventEmitter;
	
	    /**
	     * Finds the index of the listener for the event in its storage array.
	     *
	     * @param {Function[]} listeners Array of listeners to search through.
	     * @param {Function} listener Method to look for.
	     * @return {Number} Index of the specified listener, -1 if not found
	     * @api private
	     */
	    function indexOfListener(listeners, listener) {
	        var i = listeners.length;
	        while (i--) {
	            if (listeners[i].listener === listener) {
	                return i;
	            }
	        }
	
	        return -1;
	    }
	
	    /**
	     * Alias a method while keeping the context correct, to allow for overwriting of target method.
	     *
	     * @param {String} name The name of the target method.
	     * @return {Function} The aliased method
	     * @api private
	     */
	    function alias(name) {
	        return function aliasClosure() {
	            return this[name].apply(this, arguments);
	        };
	    }
	
	    /**
	     * Returns the listener array for the specified event.
	     * Will initialise the event object and listener arrays if required.
	     * Will return an object if you use a regex search. The object contains keys for each matched event. So /ba[rz]/ might return an object containing bar and baz. But only if you have either defined them with defineEvent or added some listeners to them.
	     * Each property in the object response is an array of listener functions.
	     *
	     * @param {String|RegExp} evt Name of the event to return the listeners from.
	     * @return {Function[]|Object} All listener functions for the event.
	     */
	    proto.getListeners = function getListeners(evt) {
	        var events = this._getEvents();
	        var response;
	        var key;
	
	        // Return a concatenated array of all matching events if
	        // the selector is a regular expression.
	        if (evt instanceof RegExp) {
	            response = {};
	            for (key in events) {
	                if (events.hasOwnProperty(key) && evt.test(key)) {
	                    response[key] = events[key];
	                }
	            }
	        }
	        else {
	            response = events[evt] || (events[evt] = []);
	        }
	
	        return response;
	    };
	
	    /**
	     * Takes a list of listener objects and flattens it into a list of listener functions.
	     *
	     * @param {Object[]} listeners Raw listener objects.
	     * @return {Function[]} Just the listener functions.
	     */
	    proto.flattenListeners = function flattenListeners(listeners) {
	        var flatListeners = [];
	        var i;
	
	        for (i = 0; i < listeners.length; i += 1) {
	            flatListeners.push(listeners[i].listener);
	        }
	
	        return flatListeners;
	    };
	
	    /**
	     * Fetches the requested listeners via getListeners but will always return the results inside an object. This is mainly for internal use but others may find it useful.
	     *
	     * @param {String|RegExp} evt Name of the event to return the listeners from.
	     * @return {Object} All listener functions for an event in an object.
	     */
	    proto.getListenersAsObject = function getListenersAsObject(evt) {
	        var listeners = this.getListeners(evt);
	        var response;
	
	        if (listeners instanceof Array) {
	            response = {};
	            response[evt] = listeners;
	        }
	
	        return response || listeners;
	    };
	
	    /**
	     * Adds a listener function to the specified event.
	     * The listener will not be added if it is a duplicate.
	     * If the listener returns true then it will be removed after it is called.
	     * If you pass a regular expression as the event name then the listener will be added to all events that match it.
	     *
	     * @param {String|RegExp} evt Name of the event to attach the listener to.
	     * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.addListener = function addListener(evt, listener) {
	        var listeners = this.getListenersAsObject(evt);
	        var listenerIsWrapped = typeof listener === 'object';
	        var key;
	
	        for (key in listeners) {
	            if (listeners.hasOwnProperty(key) && indexOfListener(listeners[key], listener) === -1) {
	                listeners[key].push(listenerIsWrapped ? listener : {
	                    listener: listener,
	                    once: false
	                });
	            }
	        }
	
	        return this;
	    };
	
	    /**
	     * Alias of addListener
	     */
	    proto.on = alias('addListener');
	
	    /**
	     * Semi-alias of addListener. It will add a listener that will be
	     * automatically removed after its first execution.
	     *
	     * @param {String|RegExp} evt Name of the event to attach the listener to.
	     * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.addOnceListener = function addOnceListener(evt, listener) {
	        return this.addListener(evt, {
	            listener: listener,
	            once: true
	        });
	    };
	
	    /**
	     * Alias of addOnceListener.
	     */
	    proto.once = alias('addOnceListener');
	
	    /**
	     * Defines an event name. This is required if you want to use a regex to add a listener to multiple events at once. If you don't do this then how do you expect it to know what event to add to? Should it just add to every possible match for a regex? No. That is scary and bad.
	     * You need to tell it what event names should be matched by a regex.
	     *
	     * @param {String} evt Name of the event to create.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.defineEvent = function defineEvent(evt) {
	        this.getListeners(evt);
	        return this;
	    };
	
	    /**
	     * Uses defineEvent to define multiple events.
	     *
	     * @param {String[]} evts An array of event names to define.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.defineEvents = function defineEvents(evts) {
	        for (var i = 0; i < evts.length; i += 1) {
	            this.defineEvent(evts[i]);
	        }
	        return this;
	    };
	
	    /**
	     * Removes a listener function from the specified event.
	     * When passed a regular expression as the event name, it will remove the listener from all events that match it.
	     *
	     * @param {String|RegExp} evt Name of the event to remove the listener from.
	     * @param {Function} listener Method to remove from the event.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.removeListener = function removeListener(evt, listener) {
	        var listeners = this.getListenersAsObject(evt);
	        var index;
	        var key;
	
	        for (key in listeners) {
	            if (listeners.hasOwnProperty(key)) {
	                index = indexOfListener(listeners[key], listener);
	
	                if (index !== -1) {
	                    listeners[key].splice(index, 1);
	                }
	            }
	        }
	
	        return this;
	    };
	
	    /**
	     * Alias of removeListener
	     */
	    proto.off = alias('removeListener');
	
	    /**
	     * Adds listeners in bulk using the manipulateListeners method.
	     * If you pass an object as the second argument you can add to multiple events at once. The object should contain key value pairs of events and listeners or listener arrays. You can also pass it an event name and an array of listeners to be added.
	     * You can also pass it a regular expression to add the array of listeners to all events that match it.
	     * Yeah, this function does quite a bit. That's probably a bad thing.
	     *
	     * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add to multiple events at once.
	     * @param {Function[]} [listeners] An optional array of listener functions to add.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.addListeners = function addListeners(evt, listeners) {
	        // Pass through to manipulateListeners
	        return this.manipulateListeners(false, evt, listeners);
	    };
	
	    /**
	     * Removes listeners in bulk using the manipulateListeners method.
	     * If you pass an object as the second argument you can remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
	     * You can also pass it an event name and an array of listeners to be removed.
	     * You can also pass it a regular expression to remove the listeners from all events that match it.
	     *
	     * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to remove from multiple events at once.
	     * @param {Function[]} [listeners] An optional array of listener functions to remove.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.removeListeners = function removeListeners(evt, listeners) {
	        // Pass through to manipulateListeners
	        return this.manipulateListeners(true, evt, listeners);
	    };
	
	    /**
	     * Edits listeners in bulk. The addListeners and removeListeners methods both use this to do their job. You should really use those instead, this is a little lower level.
	     * The first argument will determine if the listeners are removed (true) or added (false).
	     * If you pass an object as the second argument you can add/remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
	     * You can also pass it an event name and an array of listeners to be added/removed.
	     * You can also pass it a regular expression to manipulate the listeners of all events that match it.
	     *
	     * @param {Boolean} remove True if you want to remove listeners, false if you want to add.
	     * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add/remove from multiple events at once.
	     * @param {Function[]} [listeners] An optional array of listener functions to add/remove.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.manipulateListeners = function manipulateListeners(remove, evt, listeners) {
	        var i;
	        var value;
	        var single = remove ? this.removeListener : this.addListener;
	        var multiple = remove ? this.removeListeners : this.addListeners;
	
	        // If evt is an object then pass each of its properties to this method
	        if (typeof evt === 'object' && !(evt instanceof RegExp)) {
	            for (i in evt) {
	                if (evt.hasOwnProperty(i) && (value = evt[i])) {
	                    // Pass the single listener straight through to the singular method
	                    if (typeof value === 'function') {
	                        single.call(this, i, value);
	                    }
	                    else {
	                        // Otherwise pass back to the multiple function
	                        multiple.call(this, i, value);
	                    }
	                }
	            }
	        }
	        else {
	            // So evt must be a string
	            // And listeners must be an array of listeners
	            // Loop over it and pass each one to the multiple method
	            i = listeners.length;
	            while (i--) {
	                single.call(this, evt, listeners[i]);
	            }
	        }
	
	        return this;
	    };
	
	    /**
	     * Removes all listeners from a specified event.
	     * If you do not specify an event then all listeners will be removed.
	     * That means every event will be emptied.
	     * You can also pass a regex to remove all events that match it.
	     *
	     * @param {String|RegExp} [evt] Optional name of the event to remove all listeners for. Will remove from every event if not passed.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.removeEvent = function removeEvent(evt) {
	        var type = typeof evt;
	        var events = this._getEvents();
	        var key;
	
	        // Remove different things depending on the state of evt
	        if (type === 'string') {
	            // Remove all listeners for the specified event
	            delete events[evt];
	        }
	        else if (evt instanceof RegExp) {
	            // Remove all events matching the regex.
	            for (key in events) {
	                if (events.hasOwnProperty(key) && evt.test(key)) {
	                    delete events[key];
	                }
	            }
	        }
	        else {
	            // Remove all listeners in all events
	            delete this._events;
	        }
	
	        return this;
	    };
	
	    /**
	     * Alias of removeEvent.
	     *
	     * Added to mirror the node API.
	     */
	    proto.removeAllListeners = alias('removeEvent');
	
	    /**
	     * Emits an event of your choice.
	     * When emitted, every listener attached to that event will be executed.
	     * If you pass the optional argument array then those arguments will be passed to every listener upon execution.
	     * Because it uses `apply`, your array of arguments will be passed as if you wrote them out separately.
	     * So they will not arrive within the array on the other side, they will be separate.
	     * You can also pass a regular expression to emit to all events that match it.
	     *
	     * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
	     * @param {Array} [args] Optional array of arguments to be passed to each listener.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.emitEvent = function emitEvent(evt, args) {
	        var listenersMap = this.getListenersAsObject(evt);
	        var listeners;
	        var listener;
	        var i;
	        var key;
	        var response;
	
	        for (key in listenersMap) {
	            if (listenersMap.hasOwnProperty(key)) {
	                listeners = listenersMap[key].slice(0);
	                i = listeners.length;
	
	                while (i--) {
	                    // If the listener returns true then it shall be removed from the event
	                    // The function is executed either with a basic call or an apply if there is an args array
	                    listener = listeners[i];
	
	                    if (listener.once === true) {
	                        this.removeListener(evt, listener.listener);
	                    }
	
	                    response = listener.listener.apply(this, args || []);
	
	                    if (response === this._getOnceReturnValue()) {
	                        this.removeListener(evt, listener.listener);
	                    }
	                }
	            }
	        }
	
	        return this;
	    };
	
	    /**
	     * Alias of emitEvent
	     */
	    proto.trigger = alias('emitEvent');
	
	    /**
	     * Subtly different from emitEvent in that it will pass its arguments on to the listeners, as opposed to taking a single array of arguments to pass on.
	     * As with emitEvent, you can pass a regex in place of the event name to emit to all events that match it.
	     *
	     * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
	     * @param {...*} Optional additional arguments to be passed to each listener.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.emit = function emit(evt) {
	        var args = Array.prototype.slice.call(arguments, 1);
	        return this.emitEvent(evt, args);
	    };
	
	    /**
	     * Sets the current value to check against when executing listeners. If a
	     * listeners return value matches the one set here then it will be removed
	     * after execution. This value defaults to true.
	     *
	     * @param {*} value The new value to check for when executing listeners.
	     * @return {Object} Current instance of EventEmitter for chaining.
	     */
	    proto.setOnceReturnValue = function setOnceReturnValue(value) {
	        this._onceReturnValue = value;
	        return this;
	    };
	
	    /**
	     * Fetches the current value to check against when executing listeners. If
	     * the listeners return value matches this one then it should be removed
	     * automatically. It will return true by default.
	     *
	     * @return {*|Boolean} The current value to check for or the default, true.
	     * @api private
	     */
	    proto._getOnceReturnValue = function _getOnceReturnValue() {
	        if (this.hasOwnProperty('_onceReturnValue')) {
	            return this._onceReturnValue;
	        }
	        else {
	            return true;
	        }
	    };
	
	    /**
	     * Fetches the events object and creates one if required.
	     *
	     * @return {Object} The events storage object.
	     * @api private
	     */
	    proto._getEvents = function _getEvents() {
	        return this._events || (this._events = {});
	    };
	
	    /**
	     * Reverts the global {@link EventEmitter} to its previous value and returns a reference to this version.
	     *
	     * @return {Function} Non conflicting EventEmitter class.
	     */
	    EventEmitter.noConflict = function noConflict() {
	        exports.EventEmitter = originalGlobalValue;
	        return EventEmitter;
	    };
	
	    // Expose the class either via AMD, CommonJS or the global object
	    if (true) {
	        !(__WEBPACK_AMD_DEFINE_RESULT__ = function () {
	            return EventEmitter;
	        }.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	    }
	    else if (typeof module === 'object' && module.exports){
	        module.exports = EventEmitter;
	    }
	    else {
	        exports.EventEmitter = EventEmitter;
	    }
	}.call(this));


/***/ },
/* 5 */
/***/ function(module, exports) {

	function displayComponents( glyph, showNodes ) {
		glyph.components.forEach(function(component) {
			component.visible = true;
			component.contours.forEach(function(contour) {
				contour.fullySelected = showNodes && !contour.skeleton;
			});
	
			if ( component.components.length ) {
				displayComponents( component, showNodes );
			}
		});
	}
	
	function displayGlyph( _glyph ) {
		var glyph =
				// no glyph means we're switching fill mode for the current glyph
				_glyph === undefined ? this.currGlyph :
				// accept glyph name and glyph object
				typeof _glyph === 'string' ? this.font.glyphMap[_glyph] :
				_glyph;
	
		if ( glyph === undefined ) {
			return;
		}
	
		// hide previous glyph
		if ( this.currGlyph && this.currGlyph !== glyph ) {
			this.currGlyph.visible = false;
			this.currGlyph.components.forEach(function(component) {
				component.visible = false;
			}, this);
		}
	
		this.currGlyph = glyph;
	
		// make sure the glyph is up-to-update
		if ( _glyph && this.latestValues ) {
			this.currGlyph.update( this.latestValues );
		}
	
		// .. and show it
		this.currGlyph.visible = true;
	
		if ( this._fill ) {
			this.currGlyph.fillColor = '#333333';
			this.currGlyph.strokeWidth = 0;
		} else {
			this.currGlyph.fillColor = null;
			this.currGlyph.strokeWidth = 1;
		}
	
		this.currGlyph.contours.forEach(function(contour) {
			contour.fullySelected = this._showNodes;
		}, this);
	
		if ( this.currGlyph.components.length ) {
			displayComponents( this.currGlyph, this._showNodes );
		}
	
		this.view._project._needsUpdate = true;
		this.view.update();
	}
	
	// Path#_selectedSegmentState is the addition of all segment's states, and is
	// compared with SelectionState.SEGMENT, the combination of all SelectionStates
	// to see if all segments are fully selected.
	var SelectionState = {
			HANDLE_IN: 1,
			HANDLE_OUT: 2,
			POINT: 4,
			SEGMENT: 7 // HANDLE_IN | HANDLE_OUT | POINT
		},
		worldCoords = new Float32Array(6),
		viewCoords = new Float32Array(6);
	
	function drawHandles(ctx, segments, matrix, settings, zoom) {
		var size = settings.handleSize,
			half = size / 2,
			pX,
			pY;
	
		function drawHandle(j) {
			var hX = Math.round( viewCoords[j] ) * window.devicePixelRatio,
				hY = Math.round( viewCoords[j + 1] ) * window.devicePixelRatio,
				text;
	
			if ( viewCoords[0] !== viewCoords[j] ||
					viewCoords[1] !== viewCoords[j + 1]) {
	
				ctx.beginPath();
				ctx.strokeStyle = settings.handleColor;
				ctx.fillStyle = settings.handleColor;
				ctx.moveTo(pX, pY);
				ctx.lineTo(hX, hY);
				ctx.stroke();
				ctx.beginPath();
				ctx.arc(hX, hY, half, 0, Math.PI * 2, true);
				ctx.fill();
	
				if ( settings.drawCoords ) {
					text = Math.round( worldCoords[j] ) + ',' +
						Math.round( worldCoords[j + 1] );
	
					// use alpha to reduce the clutter caused by all this text when
					// zooming out
					if ( zoom < 1.7 ) {
						ctx.globalAlpha = 0.2;
					} else if ( zoom < 3 ) {
						ctx.globalAlpha = 0.4;
					}
					ctx.fillText(
						text,
						hX - half - 3 - ctx.measureText(text).width,
						// The text is slightly above the marker. This avoids
						// overlapping when the handle vector is horizontal, which
						// is quite a frequent case.
						hY - 2
					);
					if ( zoom < 3 ) {
						ctx.globalAlpha = 1;
					}
				}
			}
		}
	
		for (var i = 0, l = segments.length; i < l; i++) {
			var segment = segments[i];
			segment._transformCoordinates(null, worldCoords, false);
			segment._transformCoordinates(matrix, viewCoords, false);
			var state = segment._selection;
			pX = Math.round( viewCoords[0] ) * window.devicePixelRatio;
			pY = Math.round( viewCoords[1] ) * window.devicePixelRatio;
			if ( state & /*#=*/ SelectionState.HANDLE_IN ) {
				drawHandle(2);
			}
			if ( state & /*#=*/ SelectionState.HANDLE_OUT ) {
				drawHandle(4);
			}
			// Draw a rectangle at segment.point:
			ctx.fillStyle = settings.nodeColor;
			ctx.fillRect( pX - half, pY - half, size, size );
			ctx.font = settings.handleFont;
	
			if ( settings.drawCoords ) {
				if ( zoom < 1.7 ) {
					ctx.globalAlpha = 0.4;
				}
				ctx.fillText(
					Math.round( worldCoords[0] ) + ',' +
					Math.round( worldCoords[1] ),
					pX + half + 5,
					pY - 2
				);
				if ( zoom < 1.7 ) {
					ctx.globalAlpha = 1;
				}
			}
		}
	}
	
	function drawSkeletons(ctx, segments, matrix, settings, zoom) {
		function drawBones(start, end, width) {
			var sX = Math.round( start[0] ) * window.devicePixelRatio,
				sY = Math.round( start[1] ) * window.devicePixelRatio,
				eX = Math.round( end[0] ) * window.devicePixelRatio,
				eY = Math.round( end[1] ) * window.devicePixelRatio;
			ctx.beginPath();
			ctx.strokeStyle = settings.skeletonColor;
			ctx.lineWidth = width;
			ctx.moveTo(sX, sY);
			ctx.lineTo(eX, eY);
			ctx.stroke();
		}
	
		for (var i = 0, l = segments.length; i < l; i++) {
			var segment = segments[i];
			var state = segment._selection;
			var boneStartCoords = new Float32Array(6);
			segment._transformCoordinates(matrix, boneStartCoords, false);
	
			if (segments.length > i+1) {
				var end = segments[i+1];
				var boneEndCoords = new Float32Array(6);
				end._transformCoordinates(matrix, boneEndCoords, false);
				drawBones(boneStartCoords, boneEndCoords, 2);
			}
	
			if (segment.expandedTo && segment.expandedTo.length > 0) {
				var firstRib = segment.expandedTo[0];
				var secondRib = segment.expandedTo[1];
				var ribFirstCoords = new Float32Array(6);
				var ribSecondCoords = new Float32Array(6);
				firstRib._transformCoordinates(matrix, ribFirstCoords, false);
				secondRib._transformCoordinates(matrix, ribSecondCoords, false);
				drawBones(boneStartCoords, ribFirstCoords, 1);
				drawBones(boneStartCoords, ribSecondCoords, 1);
			}
		}
		ctx.lineWidth = 1;
	}
	
	function _drawSelected( ctx, matrix ) {
		ctx.beginPath();
		// Now stroke it and draw its handles:
		ctx.stroke();
		drawHandles(
			ctx,
			this._segments,
			matrix,
			this._project._scope.settings,
			this._project._view._zoom
		);
		if (this.skeleton) {
			drawSkeletons(
				ctx,
				this._segments,
				matrix,
				this._project._scope.settings,
				this._project._view._zoom
			);
		}
	}
	
	module.exports = {
		displayGlyph: displayGlyph,
		_drawSelected: _drawSelected
	};


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	var paper = __webpack_require__(2).paper;
	
	function wheelHandler( event ) {
		var bcr = this.canvas.getBoundingClientRect(),
			currPos = new paper.Point(
				event.clientX - bcr.left,
				event.clientY - bcr.top
			),
			viewPos = this.view.viewToProject( currPos ),
			// normalize the deltaY value. Expected values are ~40 pixels or 3 lines
			factor = 1 + ( this.opts.zoomFactor *
				( Math.abs( event.deltaY / event.deltaMode ? 3 : 40 * 20 ) ) ),
			newZoom =
				event.deltaY < 0 ?
					this.view.zoom * factor :
					event.deltaY > 0 ?
						this.view.zoom / factor :
						this.view.zoom,
			beta = this.view.zoom / newZoom,
			difference = viewPos.subtract( this.view.center ),
			newCenter = viewPos.subtract( difference.multiply(beta) );
	
		this.zoom = newZoom;
		this.view.center = newCenter;
	
		event.preventDefault();
	}
	
	function moveHandler(event) {
		if ( !this.isMousedown ) {
			return;
		}
	
		var currPos = new paper.Point( event.clientX, event.clientY ),
			delta = currPos.subtract( this.prevPos );
	
		this.prevPos = currPos;
	
		this.view.center = this.view.center.subtract(
				delta.divide( this.view.zoom * window.devicePixelRatio) );
	}
	
	function downHandler(event) {
		if (event.button && event.button !== 0) {
			return;
		}
	
		this.isMousedown = true;
		this.prevPos = new paper.Point( event.clientX, event.clientY );
	}
	
	function upHandler() {
		this.isMousedown = false;
	}
	
	function zoomIn() {
		this.zoom = this.view.zoom * 1 + this.opts.zoomFactor;
	}
	
	function zoomOut() {
		this.zoom = this.view.zoom / 1 + this.opts.zoomFactor;
	}
	
	module.exports = {
		onWheel: wheelHandler,
		onMove: moveHandler,
		onDown: downHandler,
		onUp: upHandler,
		zoomIn: zoomIn,
		zoomOut: zoomOut
	};


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	var shell = __webpack_require__(8);
	
	var URL = typeof window !== 'undefined' && ( window.URL || window.webkitURL );
	
	module.exports = function init( opts ) {
		var constructor = this;
	
		// the worker can be loaded from a file by specifying its url (dev
		// environment), or by building it as a blob, from a require'd file.
		if ( !opts.workerUrl ) {
			opts.workerUrl = URL.createObjectURL(
				new Blob([
					// IIFE power
					'(' + shell.toString() + ')();' +
					// For some reason [object Object] is appended to the source
					// by Firefox when the worker is created, which causes the
					// script to throw without the following comment.
					'//',
					{ type: 'text/javascript' }
				])
			);
		}
	
		// create the worker
		return new Promise(function( resolve ) {
			var worker = opts.worker = new Worker( opts.workerUrl ),
				handler = function initWorker() {
					worker.removeEventListener('message', handler);
					resolve();
				};
	
			worker.addEventListener('message', handler);
			worker.postMessage( Array.isArray( opts.workerDeps ) ?
				opts.workerDeps :
				[ opts.workerDeps ]
			);
	
		}).then(function() {
			return new constructor( opts );
		});
	};


/***/ },
/* 8 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {function prepareWorker() {
		function runWorker() {
			var font,
				handlers = {},
				fontsMap = {},
				currValues,
				currSubset = [],
				translateSubset = function() {
					if ( !currSubset.length ) {
						return;
					}
	
					font.subset = currSubset.map(function( glyph ) {
						return font.charMap[ glyph.ot.unicode ];
					}).filter(Boolean);
	
					currSubset = font.subset;
				};
	
			prototypo.paper.setup({
				width: 1024,
				height: 1024
			});
	
			// mini router
			self.onmessage = function(e) {
				var result;
	
				if ( e.data.type && e.data.type in handlers ) {
					result = handlers[ e.data.type ]( e.data.data, e.data.name );
	
					if ( result === null ) {
						return;
					}
	
					self.postMessage(
						result,
						result instanceof ArrayBuffer ? [ result ] : undefined );
				}
			};
	
			handlers.font = function( fontSource, name ) {
				// TODO: this should be done using a memoizing table of limited size
				if ( name in fontsMap ) {
					font = fontsMap[name];
					translateSubset();
					return null;
				}
	
				var fontObj = JSON.parse( fontSource );
	
				font = prototypo.parametricFont(fontObj);
				fontsMap[name] = font;
	
				translateSubset();
	
				var solvingOrders = {};
				Object.keys( font.glyphMap ).forEach(function(key) {
					solvingOrders[key] = font.glyphMap[key].solvingOrder;
				});
	
				return solvingOrders;
			};
	
			handlers.update = function( params ) {
				currValues = params;
				font.update( currValues );
				font.updateOTCommands();
				var result = font.toArrayBuffer();
				return result;
			};
	
			handlers.soloAlternate = function( params ) {
				font.setAlternateFor( params.unicode, params.glyphName );
	
				if (!currValues) {
					return true;
				}
	
				font.subset = font.subset.map(function( glyph ) {
					return String.fromCharCode(glyph.unicode);
				}).join('');
	
				var altGlyph = font.glyphMap[params.glyphName];
	
				altGlyph.update( currValues );
				altGlyph.updateOTCommands();
	
				// Recreate the correct font.ot.glyphs.glyphs object, without
				// touching the ot commands
				font.updateOT({ set: undefined });
				return font.toArrayBuffer();
			};
	
			handlers.alternate = function( params ) {
				if ( params.altList ) {
					Object.keys( params.altList ).forEach(function( unicode ) {
						handlers.soloAlternate({
							unicode: unicode,
							glyphName: params.altList[unicode]
						});
					});
				} else {
					handlers.soloAlternate( params );
				}
			};
	
			handlers.subset = function( set ) {
				var prevGlyphs = currSubset.map(function( glyph ) {
					return glyph.name;
				});
				font.subset = set;
				currSubset = font.subset;
	
				if ( !currValues ) {
					return true;
				}
	
				// search for glyphs *added* to the subset
				currSubset.filter(function( glyph ) {
					return prevGlyphs.indexOf( glyph.name ) === -1;
	
				// update those glyphs
				}).forEach(function( glyph ) {
					glyph.update( currValues );
					glyph.updateOTCommands();
				});
	
				// Recreate the correct font.ot.glyphs.glyphs object, without
				// touching the ot commands
				font.updateOT({ set: undefined });
				return font.toArrayBuffer();
			};
	
			function fillOs2Values(fontOt, values) {
				var weightChooser = [
					{ test: 20,		value: 'THIN' },
					{ test: 40,		value: 'EXTRA_LIGHT' },
					{ test: 60,		value: 'LIGHT' },
					{ test: 90,		value: 'NORMAL' },
					{ test: 110,	value: 'MEDIUM' },
					{ test: 130,	value: 'SEMI_BOLD' },
					{ test: 150,	value: 'BOLD' },
					{ test: 170,	value: 'EXTRA_BOLD' },
					{ test: 190,	value: 'BLACK' }
				];
	
				var widthChooser = [
					{ test: 0.5,	value: 'ULTRA_CONDENSED' },
					{ test: 0.625,	value: 'EXTRA_CONDENSED' },
					{ test: 0.75,	value: 'CONDENSED' },
					{ test: 0.875,	value: 'SEMI_CONDENSED' },
					{ test: 1,		value: 'MEDIUM' },
					{ test: 1.125,	value: 'SEMI_EXPANDED' },
					{ test: 1.25,	value: 'EXPANDED' },
					{ test: 1.50,	value: 'EXTRA_EXPANDED' },
					{ test: 2,		value: 'ULTRA_CONDENSED' }
				]
	
				weightChooser.forEach(function(weightObj) {
					if ( values.thickness > weightObj.test ) {
						fontOt.tables.os2.weightClass = (
							fontOt.usWeightClasses[ weightObj.value ]
						);
					}
				});
	
				widthChooser.forEach(function(widthObj) {
					if ( values.width > widthObj.test ) {
						fontOt.tables.os2.widthClass = (
							fontOt.usWidthClasses[ widthObj.value ]
						);
					}
				});
	
				var fsSel = 0;
				if (values.slant > 0 ) {
					fsSel = fsSel | fontOt.fsSelectionValues.ITALIC;
				}
	
				if (fontOt.tables.os2.weightClass > fontOt.usWeightClasses.NORMAL) {
					fsSel = fsSel | fontOt.fsSelectionValues.BOLD;
				}
	
				if (fsSel === 0) {
					fsSel = fontOt.fsSelectionValues.REGULAR;
				}
	
				fontOt.tables.os2.fsSelection = fsSel;
			}
	
			handlers.otfFont = function(data) {
				// force-update of the whole font, ignoring the current subset
				var allChars = font.getGlyphSubset( false );
				var fontValues = data && data.values || currValues;
				font.update( fontValues, allChars );
	
				font.updateOTCommands( allChars, data && data.merged || false );
	
				var family = font.ot.names.fontFamily.en;
				var style = font.ot.names.fontSubfamily.en;
				var fullName = font.ot.names.fullName.en;
				var names = font.ot.names;
	
				//TODO: understand why we need to save the familyName and
				//and set them back into the font.ot for it to be able to
				//export multiple font
				var variantName =
					( data && data.style ? data.style.toLowerCase() : 'regular' )
					.replace(/^./, function(a) { return a.toUpperCase(); });
				names.fontFamily.en = data && data.family || 'Prototypo';
				names.fontSubfamily.en = variantName;
				names.preferredFamily = names.fontFamily;
				names.preferredSubfamily = names.fontSubFamily;
				names.postScriptName.en =
					names.fontFamily.en + '-' + names.fontSubfamily.en;
				names.uniqueID = { en: (
					'Prototypo: ' +
					names.fontFamily.en +
					' ' +
					names.fontSubfamily.en +
					':2016'
				) };
				names.fullName.en =
					names.fontFamily.en + ' ' + names.fontSubfamily.en;
				names.version.en = 'Version 1.0';
				fillOs2Values(font.ot, fontValues);
	
				var result = font.toArrayBuffer();
	
				names.fontFamily.en = family;
				names.fontSubfamily.en = style;
				names.fullName.en = fullName;
	
				return result;
			};
		}
	
		// This is how bundle dependencies are loaded
		if ( typeof global === 'undefined' && 'importScripts' in self ) {
			var handler = function initWorker( e ) {
					self.removeEventListener('message', handler);
					self.importScripts( e.data );
					runWorker();
					self.postMessage('ready');
				};
	
			self.addEventListener('message', handler);
		}
	}
	
	// When the worker is loaded from URL, worker() needs to be called explicitely
	if ( typeof global === 'undefined' && 'importScripts' in self ) {
		prepareWorker();
	} else {
		module.exports = prepareWorker;
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 9 */
/***/ function(module, exports) {

	// switch the current glyph with one that has the same name
	// in the next font, or one with the same unicode, or .undef
	function translateGlyph( self ) {
		if ( !self.currGlyph ) {
			return;
		}
	
		self.displayGlyph(
			self.font.glyphMap[ self.currGlyph.name ] ||
			self.font.charMap[ self.currGlyph.ot.unicode ] ||
			self.font.glyphMap[ '.undef' ]
		);
	}
	
	module.exports = function loadFont( name, fontSource ) {
		// ignore the job currently running, empty the queue and clear update values
		this.emptyQueue();
		this.latestValues = this.latestRafValues = null;
	
		// TODO: memoizing should have a limited size!
		if ( name in this.fontsMap ) {
			this.font = this.fontsMap[name];
			translateGlyph( this );
			this.worker.postMessage({
				type: 'font',
				name: name
			});
			return Promise.resolve( this.font );
		}
	
		return ( fontSource.charAt(0) === '{' ?
			Promise.resolve( fontSource ) :
			// fetch the resource from URL
			fetch( fontSource )
	
		).then(function( result ) {
			return typeof result === 'string' || result.text();
	
		}).then(function( result ) {
			if ( result !== true ) {
				fontSource = result;
			}
	
			return new Promise(function( resolve ) {
				var fontObj = JSON.parse( fontSource ),
					handler = function( e ) {
						if ( typeof e.data !== 'object' ) {
							return;
						}
						this.worker.removeEventListener('message', handler);
	
						// merge solvingOrders with the source
						Object.keys( e.data ).forEach(function(key) {
							if ( fontObj.glyphs[key] ) {
								fontObj.glyphs[key].solvingOrder = e.data[key];
							}
						});
	
						this.font = prototypo.parametricFont( fontObj );
						this.fontsMap[name] = this.font;
						translateGlyph( this );
	
						resolve( this );
					}.bind(this);
	
				this.worker.addEventListener('message', handler);
	
				this.worker.postMessage({
					type: 'font',
					name: name,
					data: fontSource
				});
	
			}.bind(this));
		}.bind(this));
	};


/***/ }
/******/ ])
});
;
//# sourceMappingURL=prototypo-canvas.js.map