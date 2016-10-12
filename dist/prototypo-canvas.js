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
	var cloneDeep		= __webpack_require__(4);
	var EventEmitter	= __webpack_require__(106);
	var glyph			= __webpack_require__(107);
	var mouseHandlers	= __webpack_require__(109);
	var init			= __webpack_require__(110);
	var loadFont		= __webpack_require__(112);
	var {drawUIEditor, createUIEditor} = __webpack_require__(113);
	
	var _ = { assign: assign, cloneDeep: cloneDeep },
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
	
		this.typographicFrame = {
			spacingLeft: new paper.Shape.Rectangle(new paper.Point(-100000, -50000), new paper.Size(100000, 100000)),
			spacingRight: new paper.Shape.Rectangle(new paper.Point(-100000, -50000), new paper.Size(100000, 100000)),
			low: new paper.Shape.Rectangle(new paper.Point(-50000, 0), new paper.Size(100000, 1)),
			xHeight: new paper.Shape.Rectangle(new paper.Point(-50000, 0), new paper.Size(100000, 1)),
			capHeight: new paper.Shape.Rectangle(new paper.Point(-50000, 0), new paper.Size(100000, 1)),
		};
		this.typographicFrame.spacingLeft.fillColor = '#f5f5f5';
		this.typographicFrame.spacingLeft.strokeColor = '#24d390';
		this.typographicFrame.spacingRight.fillColor = '#f5f5f5';
		this.typographicFrame.spacingRight.strokeColor = '#24d390';
		this.typographicFrame.low.fillColor = '#777777';
		this.typographicFrame.xHeight.fillColor = '#777777';
		this.typographicFrame.capHeight.fillColor = '#777777';
	
		var pCanvasInstance = this;
	
		var emitEvent = this.emitEvent.bind(this);
	
		var confirmCursorsChanges = function(oldCursors) {
			const newCursors = _.cloneDeep(oldCursors);
			const createIdentityCursors = function(cursors) {
				Object.keys(cursors).forEach((key) => {
					switch (typeof cursors[key]) {
						case 'number': cursors[key] = 0; break;
						case 'string': cursors[key] = '0deg'; break;
						case 'object': cursors[key] = createIdentityCursors(cursors[key]); break;
					}
				});
				return cursors;
			};
	
			emitEvent('manualchange', [createIdentityCursors(newCursors), true]);
		};
	
		var UIEditor = createUIEditor(paper, {
			onCursorsChanged(cursors) {
				emitEvent('manualchange', [cursors]);
			if(!UIEditor.changesToConfirm) {
				UIEditor.changesToConfirm = cursors;
			}
			},
			onConfirmChanges() {
				var cursors = UIEditor.changesToConfirm;
				confirmCursorsChanges(cursors);
				delete UIEditor.changesToConfirm;
			}
		});
	
		this.view.onMouseDown = function(event) {
			if(pCanvasInstance._showNodes) {
				// if visible, skeleton points can be matched
				var skeletons = paper.project.getItems({selected: true}).filter((item) => { return item.skeleton && !item.visible; });
				skeletons.forEach((item) => { item.visible = true; });
	
				var results = paper.project.hitTestAll(event.point, {
					match(hit) {
						return hit.item.skeleton || hit.segment.expandedFrom;
					},
					segments: true,
					handles: true,
					tolerance: (10 * Math.exp(-0.12 * this.zoom)).toFixed(1), //TODO: better exponential to have perfect tolerance with zoom
				});
				// matching skeleton first
				var hitResult = results.filter((hit) => { return hit.item.expandedTo; })[0] || results[0];
	
				skeletons.forEach((item) => { item.visible = false; });
	
				if(hitResult) {
					if(hitResult.type.startsWith('handle')) {
						this.selectedHandle = hitResult.type == 'handle-in' ? hitResult.segment.handleIn : hitResult.segment.handleOut;
						this.selectedHandlePos = new paper.Point(this.selectedHandle.x, this.selectedHandle.y);
						this.selectedHandleNorm = this.selectedHandle.length;
						this.selectedHandleAngle = this.selectedHandle.angle;
					}
					this.selectedSegment = hitResult.segment;
					this.skewedSelectedSegmentPoint = new paper.Point(
						this.selectedSegment.x + (this.selectedSegment.expandedFrom || this.selectedSegment).path.viewMatrix.c / paper.view.zoom  * this.selectedSegment.y,
						this.selectedSegment.y
					);
					this.selectedSegmentNorm = this.skewedSelectedSegmentPoint.length;
					this.selectedSegmentAngle = this.skewedSelectedSegmentPoint.angle;
	
					UIEditor.selection = this.selectedSegment.expandedFrom ? this.selectedSegment.expandedFrom : this.selectedSegment;
	
					return;
				}
			}
	
			pCanvasInstance.prevPos = new paper.Point(event.event.clientX, event.event.clientY);
		};
	
		this.view.onMouseDrag = function(event) {
			console.log(event.delta);
			if(this.selectedHandle && this.selectedSegment.expandedFrom && pCanvasInstance._showNodes) {
				// change dir
				var transformedEventPoint = new paper.Point(event.point.x, -event.point.y);
				var mouseVecNorm = transformedEventPoint.subtract(this.skewedSelectedSegmentPoint).length;
	
				var eventNormalized = event.delta.multiply(this.selectedHandleNorm/mouseVecNorm);
				var newHandlePosition = new paper.Point(
					this.selectedHandlePos.x + eventNormalized.x,
					this.selectedHandlePos.y - eventNormalized.y
				);
	
				var normalizedHandle = newHandlePosition.normalize().multiply(this.selectedHandleNorm);
				this.selectedHandlePos.x = normalizedHandle.x;
				this.selectedHandlePos.y = normalizedHandle.y;
				var successAngle = (normalizedHandle.angle - this.selectedHandleAngle) / 180 * Math.PI;
				this.selectedHandleAngle = normalizedHandle.angle;
	
				var invertDir = this.selectedSegment === this.selectedSegment.expandedFrom.expandedTo[1];
				var isDirIn = this.selectedHandle === this.selectedSegment.handleIn;
				var dirType = (invertDir && !isDirIn) || (!invertDir && isDirIn) ? 'dirIn' : 'dirOut';
	
				var contourIdx = this.selectedSegment.expandedFrom.contourIdx;
				var nodeIdx = this.selectedSegment.expandedFrom.nodeIdx;
				var cursors = { [`contours.${contourIdx}.nodes.${nodeIdx}.${dirType}`]: successAngle };
				this.changesToConfirm = cursors;
				return emitEvent('manualchange', [cursors]);
			}
			else if (this.selectedSegment && pCanvasInstance._showNodes) {
				if(this.selectedSegment.path.skeleton) {
					// change skeleton x, y
					var contourIdx = this.selectedSegment.contourIdx;
					var nodeIdx = this.selectedSegment.nodeIdx;
					var cursors = {
						[`contours.${contourIdx}.nodes.${nodeIdx}.x`]: event.delta.x,
						[`contours.${contourIdx}.nodes.${nodeIdx}.y`]: -event.delta.y,
					};
					this.changesToConfirm = cursors;
					return emitEvent('manualchange', [cursors]);
				}
				else {
					// change width
	
					if (this.selectedSegment.expandedFrom.skeletonBaseWidth === undefined) {
						this.selectedSegment.expandedFrom.skeletonBaseWidth = this.selectedSegment.expandedFrom.expand.width;
					}
					var angle = this.selectedSegment.expandedFrom.expand.angle;
					var distrib = this.selectedSegment.expandedFrom.expand.distr;
					var baseWidth = this.selectedSegment.expandedFrom.skeletonBaseWidth;
					var direction = new paper.Point(
						Math.cos(angle),
						Math.sin(angle)
					);
					var deltaWidth = (direction.x * event.delta.x - direction.y * event.delta.y) / baseWidth;
	
					if(this.selectedSegment === this.selectedSegment.expandedFrom.expandedTo[0]) {
						deltaWidth *= -1;
						if (distrib !== 0) {
							deltaWidth /= distrib;
						}
					}
					else if (distrib !== 1) {
						deltaWidth /= (1 - distrib);
					}
	
					var contourIdx = this.selectedSegment.expandedFrom.contourIdx;
					var nodeIdx = this.selectedSegment.expandedFrom.nodeIdx;
					var cursors = {
						[`contours.${contourIdx}.nodes.${nodeIdx}.expand`]: { width: deltaWidth },
					};
					this.changesToConfirm = cursors;
					return emitEvent('manualchange', [cursors]);
				}
			}
			else if(pCanvasInstance.prevPos) {
				var currPos = new paper.Point(event.event.clientX, event.event.clientY),
					delta = currPos.subtract(pCanvasInstance.prevPos);
	
				pCanvasInstance.prevPos = currPos;
	
				this.center = this.center.subtract(delta.divide(this.zoom * window.devicePixelRatio));
				return;
			}
	
			pCanvasInstance.prevPos = null;
		};
	
		this.view.onMouseUp = function(event) {
			if(this.changesToConfirm) {
				confirmCursorsChanges(this.changesToConfirm);
				delete this.changesToConfirm;
			}
			this.selectedHandle = null;
			this.selectedSegment = null;
		};
	
		// this.grid = new Grid( paper );
	
		// bind workerHandlers
		if ( this.worker ) {
			this.worker.port.addEventListener('message', function(e) {
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
	
		// setup raf loop
		var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
		var updateLoop = () => {
			raf(updateLoop);
	
			if (this.latestRafValues && this.currGlyph && !this.exportingZip) {
				this.font.update( this.latestRafValues, [ this.currGlyph ] );
				this.view.update();
				drawTypographicFrame.bind(this)();
				delete this.latestRafValues;
			}
	
			drawUIEditor(paper, !this._showNodes, UIEditor);
	
			if(this.prevGlyph !== this.currGlyph) {
				this.prevGlyph = this.currGlyph;
	
				delete UIEditor.selection;
			}
		};
		updateLoop();
	}
	
	function drawTypographicFrame() {
		if (this.currGlyph) {
			var spacingRight = this.currGlyph.ot.advanceWidth + 100000 / 2;
			this.typographicFrame.spacingRight.position = new paper.Point(spacingRight, 0);
			this.typographicFrame.xHeight.position = new paper.Point(0, this.latestRafValues.xHeight);
			this.typographicFrame.capHeight.position = new paper.Point(0, this.latestRafValues.capHeight);
		}
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
	PrototypoCanvas.prototype.displayComponents = glyph.displayComponents;
	PrototypoCanvas.prototype.displayComponentList = glyph.displayComponentList;
	PrototypoCanvas.prototype.changeComponent = glyph.changeComponent;
	
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
		'alternate',
		'getGlyphProperty'
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
	
				this.worker.port.postMessage( this.currentJob );
	
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
	
	PrototypoCanvas.prototype.getGlyphProperty = function(glyph, properties, callback) {
		var unicode = 0;
	
		if (typeof glyph === 'string' && glyph.length > 0){
			if (glyph.length > 1) {
				glyph = glyph[0];
			}
	
			unicode = glyph.charCodeAt(0);
		}
		else if (typeof glyph === 'number') {
			unicode = glyph;
		}
	
		this.enqueue({
			type: 'getGlyphProperty',
			data: {
				unicode: unicode,
				properties: properties
			},
			callback: (typeof callback === 'function' ? callback : undefined)
		});
	}
	
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
		function( cb, name, merged, values, user ) {
			this.generateOtf(function( data ) {
				this.font.download( data, name, user, merged );
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
	
	PrototypoCanvas.prototype.openInGlyphr = function( cb, name, merged, values, user ) {
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
	
				// font backup
				this.generateOtf(function( arrayBuffer ) {
					fetch(
						[
							'https://merge.prototypo.io',
							name.family,
							name.style,
							user,
							name.template || 'unknown'
						].join('/'), {
							method: 'POST',
							headers: { 'Content-Type': 'application/otf' },
							body: arrayBuffer
					});
				}.bind(this), name, false, values);
	
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

	var baseClone = __webpack_require__(5);
	
	/**
	 * This method is like `_.clone` except that it recursively clones `value`.
	 *
	 * @static
	 * @memberOf _
	 * @since 1.0.0
	 * @category Lang
	 * @param {*} value The value to recursively clone.
	 * @returns {*} Returns the deep cloned value.
	 * @see _.clone
	 * @example
	 *
	 * var objects = [{ 'a': 1 }, { 'b': 2 }];
	 *
	 * var deep = _.cloneDeep(objects);
	 * console.log(deep[0] === objects[0]);
	 * // => false
	 */
	function cloneDeep(value) {
	  return baseClone(value, true, true);
	}
	
	module.exports = cloneDeep;


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var Stack = __webpack_require__(6),
	    arrayEach = __webpack_require__(46),
	    assignValue = __webpack_require__(47),
	    baseAssign = __webpack_require__(50),
	    cloneBuffer = __webpack_require__(73),
	    copyArray = __webpack_require__(74),
	    copySymbols = __webpack_require__(75),
	    getAllKeys = __webpack_require__(78),
	    getTag = __webpack_require__(81),
	    initCloneArray = __webpack_require__(87),
	    initCloneByTag = __webpack_require__(88),
	    initCloneObject = __webpack_require__(103),
	    isArray = __webpack_require__(58),
	    isBuffer = __webpack_require__(59),
	    isObject = __webpack_require__(24),
	    keys = __webpack_require__(52);
	
	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    arrayTag = '[object Array]',
	    boolTag = '[object Boolean]',
	    dateTag = '[object Date]',
	    errorTag = '[object Error]',
	    funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]',
	    mapTag = '[object Map]',
	    numberTag = '[object Number]',
	    objectTag = '[object Object]',
	    regexpTag = '[object RegExp]',
	    setTag = '[object Set]',
	    stringTag = '[object String]',
	    symbolTag = '[object Symbol]',
	    weakMapTag = '[object WeakMap]';
	
	var arrayBufferTag = '[object ArrayBuffer]',
	    dataViewTag = '[object DataView]',
	    float32Tag = '[object Float32Array]',
	    float64Tag = '[object Float64Array]',
	    int8Tag = '[object Int8Array]',
	    int16Tag = '[object Int16Array]',
	    int32Tag = '[object Int32Array]',
	    uint8Tag = '[object Uint8Array]',
	    uint8ClampedTag = '[object Uint8ClampedArray]',
	    uint16Tag = '[object Uint16Array]',
	    uint32Tag = '[object Uint32Array]';
	
	/** Used to identify `toStringTag` values supported by `_.clone`. */
	var cloneableTags = {};
	cloneableTags[argsTag] = cloneableTags[arrayTag] =
	cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] =
	cloneableTags[boolTag] = cloneableTags[dateTag] =
	cloneableTags[float32Tag] = cloneableTags[float64Tag] =
	cloneableTags[int8Tag] = cloneableTags[int16Tag] =
	cloneableTags[int32Tag] = cloneableTags[mapTag] =
	cloneableTags[numberTag] = cloneableTags[objectTag] =
	cloneableTags[regexpTag] = cloneableTags[setTag] =
	cloneableTags[stringTag] = cloneableTags[symbolTag] =
	cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
	cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
	cloneableTags[errorTag] = cloneableTags[funcTag] =
	cloneableTags[weakMapTag] = false;
	
	/**
	 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
	 * traversed objects.
	 *
	 * @private
	 * @param {*} value The value to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @param {boolean} [isFull] Specify a clone including symbols.
	 * @param {Function} [customizer] The function to customize cloning.
	 * @param {string} [key] The key of `value`.
	 * @param {Object} [object] The parent object of `value`.
	 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
	 * @returns {*} Returns the cloned value.
	 */
	function baseClone(value, isDeep, isFull, customizer, key, object, stack) {
	  var result;
	  if (customizer) {
	    result = object ? customizer(value, key, object, stack) : customizer(value);
	  }
	  if (result !== undefined) {
	    return result;
	  }
	  if (!isObject(value)) {
	    return value;
	  }
	  var isArr = isArray(value);
	  if (isArr) {
	    result = initCloneArray(value);
	    if (!isDeep) {
	      return copyArray(value, result);
	    }
	  } else {
	    var tag = getTag(value),
	        isFunc = tag == funcTag || tag == genTag;
	
	    if (isBuffer(value)) {
	      return cloneBuffer(value, isDeep);
	    }
	    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
	      result = initCloneObject(isFunc ? {} : value);
	      if (!isDeep) {
	        return copySymbols(value, baseAssign(result, value));
	      }
	    } else {
	      if (!cloneableTags[tag]) {
	        return object ? value : {};
	      }
	      result = initCloneByTag(value, tag, baseClone, isDeep);
	    }
	  }
	  // Check for circular references and return its corresponding clone.
	  stack || (stack = new Stack);
	  var stacked = stack.get(value);
	  if (stacked) {
	    return stacked;
	  }
	  stack.set(value, result);
	
	  var props = isArr ? undefined : (isFull ? getAllKeys : keys)(value);
	  arrayEach(props || value, function(subValue, key) {
	    if (props) {
	      key = subValue;
	      subValue = value[key];
	    }
	    // Recursively populate clone (susceptible to call stack limits).
	    assignValue(result, key, baseClone(subValue, isDeep, isFull, customizer, key, value, stack));
	  });
	  return result;
	}
	
	module.exports = baseClone;


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	var ListCache = __webpack_require__(7),
	    stackClear = __webpack_require__(15),
	    stackDelete = __webpack_require__(16),
	    stackGet = __webpack_require__(17),
	    stackHas = __webpack_require__(18),
	    stackSet = __webpack_require__(19);
	
	/**
	 * Creates a stack cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Stack(entries) {
	  var data = this.__data__ = new ListCache(entries);
	  this.size = data.size;
	}
	
	// Add methods to `Stack`.
	Stack.prototype.clear = stackClear;
	Stack.prototype['delete'] = stackDelete;
	Stack.prototype.get = stackGet;
	Stack.prototype.has = stackHas;
	Stack.prototype.set = stackSet;
	
	module.exports = Stack;


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	var listCacheClear = __webpack_require__(8),
	    listCacheDelete = __webpack_require__(9),
	    listCacheGet = __webpack_require__(12),
	    listCacheHas = __webpack_require__(13),
	    listCacheSet = __webpack_require__(14);
	
	/**
	 * Creates an list cache object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function ListCache(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	// Add methods to `ListCache`.
	ListCache.prototype.clear = listCacheClear;
	ListCache.prototype['delete'] = listCacheDelete;
	ListCache.prototype.get = listCacheGet;
	ListCache.prototype.has = listCacheHas;
	ListCache.prototype.set = listCacheSet;
	
	module.exports = ListCache;


/***/ },
/* 8 */
/***/ function(module, exports) {

	/**
	 * Removes all key-value entries from the list cache.
	 *
	 * @private
	 * @name clear
	 * @memberOf ListCache
	 */
	function listCacheClear() {
	  this.__data__ = [];
	  this.size = 0;
	}
	
	module.exports = listCacheClear;


/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var assocIndexOf = __webpack_require__(10);
	
	/** Used for built-in method references. */
	var arrayProto = Array.prototype;
	
	/** Built-in value references. */
	var splice = arrayProto.splice;
	
	/**
	 * Removes `key` and its value from the list cache.
	 *
	 * @private
	 * @name delete
	 * @memberOf ListCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function listCacheDelete(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  if (index < 0) {
	    return false;
	  }
	  var lastIndex = data.length - 1;
	  if (index == lastIndex) {
	    data.pop();
	  } else {
	    splice.call(data, index, 1);
	  }
	  --this.size;
	  return true;
	}
	
	module.exports = listCacheDelete;


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var eq = __webpack_require__(11);
	
	/**
	 * Gets the index at which the `key` is found in `array` of key-value pairs.
	 *
	 * @private
	 * @param {Array} array The array to inspect.
	 * @param {*} key The key to search for.
	 * @returns {number} Returns the index of the matched value, else `-1`.
	 */
	function assocIndexOf(array, key) {
	  var length = array.length;
	  while (length--) {
	    if (eq(array[length][0], key)) {
	      return length;
	    }
	  }
	  return -1;
	}
	
	module.exports = assocIndexOf;


/***/ },
/* 11 */
/***/ function(module, exports) {

	/**
	 * Performs a
	 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	 * comparison between two values to determine if they are equivalent.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'a': 1 };
	 * var other = { 'a': 1 };
	 *
	 * _.eq(object, object);
	 * // => true
	 *
	 * _.eq(object, other);
	 * // => false
	 *
	 * _.eq('a', 'a');
	 * // => true
	 *
	 * _.eq('a', Object('a'));
	 * // => false
	 *
	 * _.eq(NaN, NaN);
	 * // => true
	 */
	function eq(value, other) {
	  return value === other || (value !== value && other !== other);
	}
	
	module.exports = eq;


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	var assocIndexOf = __webpack_require__(10);
	
	/**
	 * Gets the list cache value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf ListCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function listCacheGet(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  return index < 0 ? undefined : data[index][1];
	}
	
	module.exports = listCacheGet;


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	var assocIndexOf = __webpack_require__(10);
	
	/**
	 * Checks if a list cache value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf ListCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function listCacheHas(key) {
	  return assocIndexOf(this.__data__, key) > -1;
	}
	
	module.exports = listCacheHas;


/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	var assocIndexOf = __webpack_require__(10);
	
	/**
	 * Sets the list cache `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf ListCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the list cache instance.
	 */
	function listCacheSet(key, value) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  if (index < 0) {
	    ++this.size;
	    data.push([key, value]);
	  } else {
	    data[index][1] = value;
	  }
	  return this;
	}
	
	module.exports = listCacheSet;


/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	var ListCache = __webpack_require__(7);
	
	/**
	 * Removes all key-value entries from the stack.
	 *
	 * @private
	 * @name clear
	 * @memberOf Stack
	 */
	function stackClear() {
	  this.__data__ = new ListCache;
	  this.size = 0;
	}
	
	module.exports = stackClear;


/***/ },
/* 16 */
/***/ function(module, exports) {

	/**
	 * Removes `key` and its value from the stack.
	 *
	 * @private
	 * @name delete
	 * @memberOf Stack
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function stackDelete(key) {
	  var data = this.__data__,
	      result = data['delete'](key);
	
	  this.size = data.size;
	  return result;
	}
	
	module.exports = stackDelete;


/***/ },
/* 17 */
/***/ function(module, exports) {

	/**
	 * Gets the stack value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Stack
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function stackGet(key) {
	  return this.__data__.get(key);
	}
	
	module.exports = stackGet;


/***/ },
/* 18 */
/***/ function(module, exports) {

	/**
	 * Checks if a stack value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Stack
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function stackHas(key) {
	  return this.__data__.has(key);
	}
	
	module.exports = stackHas;


/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	var ListCache = __webpack_require__(7),
	    Map = __webpack_require__(20),
	    MapCache = __webpack_require__(31);
	
	/** Used as the size to enable large array optimizations. */
	var LARGE_ARRAY_SIZE = 200;
	
	/**
	 * Sets the stack `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Stack
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the stack cache instance.
	 */
	function stackSet(key, value) {
	  var data = this.__data__;
	  if (data instanceof ListCache) {
	    var pairs = data.__data__;
	    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
	      pairs.push([key, value]);
	      this.size = ++data.size;
	      return this;
	    }
	    data = this.__data__ = new MapCache(pairs);
	  }
	  data.set(key, value);
	  this.size = data.size;
	  return this;
	}
	
	module.exports = stackSet;


/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(21),
	    root = __webpack_require__(27);
	
	/* Built-in method references that are verified to be native. */
	var Map = getNative(root, 'Map');
	
	module.exports = Map;


/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	var baseIsNative = __webpack_require__(22),
	    getValue = __webpack_require__(30);
	
	/**
	 * Gets the native function at `key` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {string} key The key of the method to get.
	 * @returns {*} Returns the function if it's native, else `undefined`.
	 */
	function getNative(object, key) {
	  var value = getValue(object, key);
	  return baseIsNative(value) ? value : undefined;
	}
	
	module.exports = getNative;


/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	var isFunction = __webpack_require__(23),
	    isMasked = __webpack_require__(25),
	    isObject = __webpack_require__(24),
	    toSource = __webpack_require__(29);
	
	/**
	 * Used to match `RegExp`
	 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
	 */
	var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
	
	/** Used to detect host constructors (Safari). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;
	
	/** Used for built-in method references. */
	var funcProto = Function.prototype,
	    objectProto = Object.prototype;
	
	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/** Used to detect if a method is native. */
	var reIsNative = RegExp('^' +
	  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
	  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);
	
	/**
	 * The base implementation of `_.isNative` without bad shim checks.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a native function,
	 *  else `false`.
	 */
	function baseIsNative(value) {
	  if (!isObject(value) || isMasked(value)) {
	    return false;
	  }
	  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
	  return pattern.test(toSource(value));
	}
	
	module.exports = baseIsNative;


/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(24);
	
	/** `Object#toString` result references. */
	var funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]',
	    proxyTag = '[object Proxy]';
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;
	
	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 9 which returns 'object' for typed array and other constructors.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag || tag == proxyTag;
	}
	
	module.exports = isFunction;


/***/ },
/* 24 */
/***/ function(module, exports) {

	/**
	 * Checks if `value` is the
	 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  var type = typeof value;
	  return value != null && (type == 'object' || type == 'function');
	}
	
	module.exports = isObject;


/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	var coreJsData = __webpack_require__(26);
	
	/** Used to detect methods masquerading as native. */
	var maskSrcKey = (function() {
	  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
	  return uid ? ('Symbol(src)_1.' + uid) : '';
	}());
	
	/**
	 * Checks if `func` has its source masked.
	 *
	 * @private
	 * @param {Function} func The function to check.
	 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
	 */
	function isMasked(func) {
	  return !!maskSrcKey && (maskSrcKey in func);
	}
	
	module.exports = isMasked;


/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	var root = __webpack_require__(27);
	
	/** Used to detect overreaching core-js shims. */
	var coreJsData = root['__core-js_shared__'];
	
	module.exports = coreJsData;


/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	var freeGlobal = __webpack_require__(28);
	
	/** Detect free variable `self`. */
	var freeSelf = typeof self == 'object' && self && self.Object === Object && self;
	
	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function('return this')();
	
	module.exports = root;


/***/ },
/* 28 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {/** Detect free variable `global` from Node.js. */
	var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;
	
	module.exports = freeGlobal;
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 29 */
/***/ function(module, exports) {

	/** Used for built-in method references. */
	var funcProto = Function.prototype;
	
	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;
	
	/**
	 * Converts `func` to its source code.
	 *
	 * @private
	 * @param {Function} func The function to process.
	 * @returns {string} Returns the source code.
	 */
	function toSource(func) {
	  if (func != null) {
	    try {
	      return funcToString.call(func);
	    } catch (e) {}
	    try {
	      return (func + '');
	    } catch (e) {}
	  }
	  return '';
	}
	
	module.exports = toSource;


/***/ },
/* 30 */
/***/ function(module, exports) {

	/**
	 * Gets the value at `key` of `object`.
	 *
	 * @private
	 * @param {Object} [object] The object to query.
	 * @param {string} key The key of the property to get.
	 * @returns {*} Returns the property value.
	 */
	function getValue(object, key) {
	  return object == null ? undefined : object[key];
	}
	
	module.exports = getValue;


/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	var mapCacheClear = __webpack_require__(32),
	    mapCacheDelete = __webpack_require__(40),
	    mapCacheGet = __webpack_require__(43),
	    mapCacheHas = __webpack_require__(44),
	    mapCacheSet = __webpack_require__(45);
	
	/**
	 * Creates a map cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function MapCache(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	// Add methods to `MapCache`.
	MapCache.prototype.clear = mapCacheClear;
	MapCache.prototype['delete'] = mapCacheDelete;
	MapCache.prototype.get = mapCacheGet;
	MapCache.prototype.has = mapCacheHas;
	MapCache.prototype.set = mapCacheSet;
	
	module.exports = MapCache;


/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	var Hash = __webpack_require__(33),
	    ListCache = __webpack_require__(7),
	    Map = __webpack_require__(20);
	
	/**
	 * Removes all key-value entries from the map.
	 *
	 * @private
	 * @name clear
	 * @memberOf MapCache
	 */
	function mapCacheClear() {
	  this.size = 0;
	  this.__data__ = {
	    'hash': new Hash,
	    'map': new (Map || ListCache),
	    'string': new Hash
	  };
	}
	
	module.exports = mapCacheClear;


/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	var hashClear = __webpack_require__(34),
	    hashDelete = __webpack_require__(36),
	    hashGet = __webpack_require__(37),
	    hashHas = __webpack_require__(38),
	    hashSet = __webpack_require__(39);
	
	/**
	 * Creates a hash object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Hash(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	// Add methods to `Hash`.
	Hash.prototype.clear = hashClear;
	Hash.prototype['delete'] = hashDelete;
	Hash.prototype.get = hashGet;
	Hash.prototype.has = hashHas;
	Hash.prototype.set = hashSet;
	
	module.exports = Hash;


/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	var nativeCreate = __webpack_require__(35);
	
	/**
	 * Removes all key-value entries from the hash.
	 *
	 * @private
	 * @name clear
	 * @memberOf Hash
	 */
	function hashClear() {
	  this.__data__ = nativeCreate ? nativeCreate(null) : {};
	  this.size = 0;
	}
	
	module.exports = hashClear;


/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(21);
	
	/* Built-in method references that are verified to be native. */
	var nativeCreate = getNative(Object, 'create');
	
	module.exports = nativeCreate;


/***/ },
/* 36 */
/***/ function(module, exports) {

	/**
	 * Removes `key` and its value from the hash.
	 *
	 * @private
	 * @name delete
	 * @memberOf Hash
	 * @param {Object} hash The hash to modify.
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function hashDelete(key) {
	  var result = this.has(key) && delete this.__data__[key];
	  this.size -= result ? 1 : 0;
	  return result;
	}
	
	module.exports = hashDelete;


/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	var nativeCreate = __webpack_require__(35);
	
	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = '__lodash_hash_undefined__';
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/**
	 * Gets the hash value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Hash
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function hashGet(key) {
	  var data = this.__data__;
	  if (nativeCreate) {
	    var result = data[key];
	    return result === HASH_UNDEFINED ? undefined : result;
	  }
	  return hasOwnProperty.call(data, key) ? data[key] : undefined;
	}
	
	module.exports = hashGet;


/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	var nativeCreate = __webpack_require__(35);
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/**
	 * Checks if a hash value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Hash
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function hashHas(key) {
	  var data = this.__data__;
	  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
	}
	
	module.exports = hashHas;


/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	var nativeCreate = __webpack_require__(35);
	
	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = '__lodash_hash_undefined__';
	
	/**
	 * Sets the hash `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Hash
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the hash instance.
	 */
	function hashSet(key, value) {
	  var data = this.__data__;
	  this.size += this.has(key) ? 0 : 1;
	  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
	  return this;
	}
	
	module.exports = hashSet;


/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	var getMapData = __webpack_require__(41);
	
	/**
	 * Removes `key` and its value from the map.
	 *
	 * @private
	 * @name delete
	 * @memberOf MapCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function mapCacheDelete(key) {
	  var result = getMapData(this, key)['delete'](key);
	  this.size -= result ? 1 : 0;
	  return result;
	}
	
	module.exports = mapCacheDelete;


/***/ },
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	var isKeyable = __webpack_require__(42);
	
	/**
	 * Gets the data for `map`.
	 *
	 * @private
	 * @param {Object} map The map to query.
	 * @param {string} key The reference key.
	 * @returns {*} Returns the map data.
	 */
	function getMapData(map, key) {
	  var data = map.__data__;
	  return isKeyable(key)
	    ? data[typeof key == 'string' ? 'string' : 'hash']
	    : data.map;
	}
	
	module.exports = getMapData;


/***/ },
/* 42 */
/***/ function(module, exports) {

	/**
	 * Checks if `value` is suitable for use as unique object key.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
	 */
	function isKeyable(value) {
	  var type = typeof value;
	  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
	    ? (value !== '__proto__')
	    : (value === null);
	}
	
	module.exports = isKeyable;


/***/ },
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	var getMapData = __webpack_require__(41);
	
	/**
	 * Gets the map value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf MapCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function mapCacheGet(key) {
	  return getMapData(this, key).get(key);
	}
	
	module.exports = mapCacheGet;


/***/ },
/* 44 */
/***/ function(module, exports, __webpack_require__) {

	var getMapData = __webpack_require__(41);
	
	/**
	 * Checks if a map value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf MapCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function mapCacheHas(key) {
	  return getMapData(this, key).has(key);
	}
	
	module.exports = mapCacheHas;


/***/ },
/* 45 */
/***/ function(module, exports, __webpack_require__) {

	var getMapData = __webpack_require__(41);
	
	/**
	 * Sets the map `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf MapCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the map cache instance.
	 */
	function mapCacheSet(key, value) {
	  var data = getMapData(this, key),
	      size = data.size;
	
	  data.set(key, value);
	  this.size += data.size == size ? 0 : 1;
	  return this;
	}
	
	module.exports = mapCacheSet;


/***/ },
/* 46 */
/***/ function(module, exports) {

	/**
	 * A specialized version of `_.forEach` for arrays without support for
	 * iteratee shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns `array`.
	 */
	function arrayEach(array, iteratee) {
	  var index = -1,
	      length = array ? array.length : 0;
	
	  while (++index < length) {
	    if (iteratee(array[index], index, array) === false) {
	      break;
	    }
	  }
	  return array;
	}
	
	module.exports = arrayEach;


/***/ },
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	var baseAssignValue = __webpack_require__(48),
	    eq = __webpack_require__(11);
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/**
	 * Assigns `value` to `key` of `object` if the existing value is not equivalent
	 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	 * for equality comparisons.
	 *
	 * @private
	 * @param {Object} object The object to modify.
	 * @param {string} key The key of the property to assign.
	 * @param {*} value The value to assign.
	 */
	function assignValue(object, key, value) {
	  var objValue = object[key];
	  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
	      (value === undefined && !(key in object))) {
	    baseAssignValue(object, key, value);
	  }
	}
	
	module.exports = assignValue;


/***/ },
/* 48 */
/***/ function(module, exports, __webpack_require__) {

	var defineProperty = __webpack_require__(49);
	
	/**
	 * The base implementation of `assignValue` and `assignMergeValue` without
	 * value checks.
	 *
	 * @private
	 * @param {Object} object The object to modify.
	 * @param {string} key The key of the property to assign.
	 * @param {*} value The value to assign.
	 */
	function baseAssignValue(object, key, value) {
	  if (key == '__proto__' && defineProperty) {
	    defineProperty(object, key, {
	      'configurable': true,
	      'enumerable': true,
	      'value': value,
	      'writable': true
	    });
	  } else {
	    object[key] = value;
	  }
	}
	
	module.exports = baseAssignValue;


/***/ },
/* 49 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(21);
	
	var defineProperty = (function() {
	  try {
	    var func = getNative(Object, 'defineProperty');
	    func({}, '', {});
	    return func;
	  } catch (e) {}
	}());
	
	module.exports = defineProperty;


/***/ },
/* 50 */
/***/ function(module, exports, __webpack_require__) {

	var copyObject = __webpack_require__(51),
	    keys = __webpack_require__(52);
	
	/**
	 * The base implementation of `_.assign` without support for multiple sources
	 * or `customizer` functions.
	 *
	 * @private
	 * @param {Object} object The destination object.
	 * @param {Object} source The source object.
	 * @returns {Object} Returns `object`.
	 */
	function baseAssign(object, source) {
	  return object && copyObject(source, keys(source), object);
	}
	
	module.exports = baseAssign;


/***/ },
/* 51 */
/***/ function(module, exports, __webpack_require__) {

	var assignValue = __webpack_require__(47),
	    baseAssignValue = __webpack_require__(48);
	
	/**
	 * Copies properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy properties from.
	 * @param {Array} props The property identifiers to copy.
	 * @param {Object} [object={}] The object to copy properties to.
	 * @param {Function} [customizer] The function to customize copied values.
	 * @returns {Object} Returns `object`.
	 */
	function copyObject(source, props, object, customizer) {
	  var isNew = !object;
	  object || (object = {});
	
	  var index = -1,
	      length = props.length;
	
	  while (++index < length) {
	    var key = props[index];
	
	    var newValue = customizer
	      ? customizer(object[key], source[key], key, object, source)
	      : undefined;
	
	    if (newValue === undefined) {
	      newValue = source[key];
	    }
	    if (isNew) {
	      baseAssignValue(object, key, newValue);
	    } else {
	      assignValue(object, key, newValue);
	    }
	  }
	  return object;
	}
	
	module.exports = copyObject;


/***/ },
/* 52 */
/***/ function(module, exports, __webpack_require__) {

	var arrayLikeKeys = __webpack_require__(53),
	    baseKeys = __webpack_require__(68),
	    isArrayLike = __webpack_require__(72);
	
	/**
	 * Creates an array of the own enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects. See the
	 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	 * for more details.
	 *
	 * @static
	 * @since 0.1.0
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keys(new Foo);
	 * // => ['a', 'b'] (iteration order is not guaranteed)
	 *
	 * _.keys('hi');
	 * // => ['0', '1']
	 */
	function keys(object) {
	  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
	}
	
	module.exports = keys;


/***/ },
/* 53 */
/***/ function(module, exports, __webpack_require__) {

	var baseTimes = __webpack_require__(54),
	    isArguments = __webpack_require__(55),
	    isArray = __webpack_require__(58),
	    isBuffer = __webpack_require__(59),
	    isIndex = __webpack_require__(62),
	    isTypedArray = __webpack_require__(63);
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/**
	 * Creates an array of the enumerable property names of the array-like `value`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @param {boolean} inherited Specify returning inherited property names.
	 * @returns {Array} Returns the array of property names.
	 */
	function arrayLikeKeys(value, inherited) {
	  var isArr = isArray(value),
	      isArg = !isArr && isArguments(value),
	      isBuff = !isArr && !isArg && isBuffer(value),
	      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
	      skipIndexes = isArr || isArg || isBuff || isType,
	      result = skipIndexes ? baseTimes(value.length, String) : [],
	      length = result.length;
	
	  for (var key in value) {
	    if ((inherited || hasOwnProperty.call(value, key)) &&
	        !(skipIndexes && (
	           // Safari 9 has enumerable `arguments.length` in strict mode.
	           key == 'length' ||
	           // Node.js 0.10 has enumerable non-index properties on buffers.
	           (isBuff && (key == 'offset' || key == 'parent')) ||
	           // PhantomJS 2 has enumerable non-index properties on typed arrays.
	           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
	           // Skip index properties.
	           isIndex(key, length)
	        ))) {
	      result.push(key);
	    }
	  }
	  return result;
	}
	
	module.exports = arrayLikeKeys;


/***/ },
/* 54 */
/***/ function(module, exports) {

	/**
	 * The base implementation of `_.times` without support for iteratee shorthands
	 * or max array length checks.
	 *
	 * @private
	 * @param {number} n The number of times to invoke `iteratee`.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns the array of results.
	 */
	function baseTimes(n, iteratee) {
	  var index = -1,
	      result = Array(n);
	
	  while (++index < n) {
	    result[index] = iteratee(index);
	  }
	  return result;
	}
	
	module.exports = baseTimes;


/***/ },
/* 55 */
/***/ function(module, exports, __webpack_require__) {

	var baseIsArguments = __webpack_require__(56),
	    isObjectLike = __webpack_require__(57);
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/** Built-in value references. */
	var propertyIsEnumerable = objectProto.propertyIsEnumerable;
	
	/**
	 * Checks if `value` is likely an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
	  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
	    !propertyIsEnumerable.call(value, 'callee');
	};
	
	module.exports = isArguments;


/***/ },
/* 56 */
/***/ function(module, exports, __webpack_require__) {

	var isObjectLike = __webpack_require__(57);
	
	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]';
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;
	
	/**
	 * The base implementation of `_.isArguments`.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 */
	function baseIsArguments(value) {
	  return isObjectLike(value) && objectToString.call(value) == argsTag;
	}
	
	module.exports = baseIsArguments;


/***/ },
/* 57 */
/***/ function(module, exports) {

	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return value != null && typeof value == 'object';
	}
	
	module.exports = isObjectLike;


/***/ },
/* 58 */
/***/ function(module, exports) {

	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(document.body.children);
	 * // => false
	 *
	 * _.isArray('abc');
	 * // => false
	 *
	 * _.isArray(_.noop);
	 * // => false
	 */
	var isArray = Array.isArray;
	
	module.exports = isArray;


/***/ },
/* 59 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(module) {var root = __webpack_require__(27),
	    stubFalse = __webpack_require__(61);
	
	/** Detect free variable `exports`. */
	var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;
	
	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;
	
	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports = freeModule && freeModule.exports === freeExports;
	
	/** Built-in value references. */
	var Buffer = moduleExports ? root.Buffer : undefined;
	
	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;
	
	/**
	 * Checks if `value` is a buffer.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.3.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
	 * @example
	 *
	 * _.isBuffer(new Buffer(2));
	 * // => true
	 *
	 * _.isBuffer(new Uint8Array(2));
	 * // => false
	 */
	var isBuffer = nativeIsBuffer || stubFalse;
	
	module.exports = isBuffer;
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(60)(module)))

/***/ },
/* 60 */
/***/ function(module, exports) {

	module.exports = function(module) {
		if(!module.webpackPolyfill) {
			module.deprecate = function() {};
			module.paths = [];
			// module.parent = undefined by default
			module.children = [];
			module.webpackPolyfill = 1;
		}
		return module;
	}


/***/ },
/* 61 */
/***/ function(module, exports) {

	/**
	 * This method returns `false`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.13.0
	 * @category Util
	 * @returns {boolean} Returns `false`.
	 * @example
	 *
	 * _.times(2, _.stubFalse);
	 * // => [false, false]
	 */
	function stubFalse() {
	  return false;
	}
	
	module.exports = stubFalse;


/***/ },
/* 62 */
/***/ function(module, exports) {

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;
	
	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;
	
	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return !!length &&
	    (typeof value == 'number' || reIsUint.test(value)) &&
	    (value > -1 && value % 1 == 0 && value < length);
	}
	
	module.exports = isIndex;


/***/ },
/* 63 */
/***/ function(module, exports, __webpack_require__) {

	var baseIsTypedArray = __webpack_require__(64),
	    baseUnary = __webpack_require__(66),
	    nodeUtil = __webpack_require__(67);
	
	/* Node.js helper references. */
	var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
	
	/**
	 * Checks if `value` is classified as a typed array.
	 *
	 * @static
	 * @memberOf _
	 * @since 3.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	 * @example
	 *
	 * _.isTypedArray(new Uint8Array);
	 * // => true
	 *
	 * _.isTypedArray([]);
	 * // => false
	 */
	var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
	
	module.exports = isTypedArray;


/***/ },
/* 64 */
/***/ function(module, exports, __webpack_require__) {

	var isLength = __webpack_require__(65),
	    isObjectLike = __webpack_require__(57);
	
	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    arrayTag = '[object Array]',
	    boolTag = '[object Boolean]',
	    dateTag = '[object Date]',
	    errorTag = '[object Error]',
	    funcTag = '[object Function]',
	    mapTag = '[object Map]',
	    numberTag = '[object Number]',
	    objectTag = '[object Object]',
	    regexpTag = '[object RegExp]',
	    setTag = '[object Set]',
	    stringTag = '[object String]',
	    weakMapTag = '[object WeakMap]';
	
	var arrayBufferTag = '[object ArrayBuffer]',
	    dataViewTag = '[object DataView]',
	    float32Tag = '[object Float32Array]',
	    float64Tag = '[object Float64Array]',
	    int8Tag = '[object Int8Array]',
	    int16Tag = '[object Int16Array]',
	    int32Tag = '[object Int32Array]',
	    uint8Tag = '[object Uint8Array]',
	    uint8ClampedTag = '[object Uint8ClampedArray]',
	    uint16Tag = '[object Uint16Array]',
	    uint32Tag = '[object Uint32Array]';
	
	/** Used to identify `toStringTag` values of typed arrays. */
	var typedArrayTags = {};
	typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
	typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
	typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
	typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
	typedArrayTags[uint32Tag] = true;
	typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
	typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
	typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
	typedArrayTags[errorTag] = typedArrayTags[funcTag] =
	typedArrayTags[mapTag] = typedArrayTags[numberTag] =
	typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
	typedArrayTags[setTag] = typedArrayTags[stringTag] =
	typedArrayTags[weakMapTag] = false;
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;
	
	/**
	 * The base implementation of `_.isTypedArray` without Node.js optimizations.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	 */
	function baseIsTypedArray(value) {
	  return isObjectLike(value) &&
	    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
	}
	
	module.exports = baseIsTypedArray;


/***/ },
/* 65 */
/***/ function(module, exports) {

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;
	
	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This method is loosely based on
	 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' &&
	    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}
	
	module.exports = isLength;


/***/ },
/* 66 */
/***/ function(module, exports) {

	/**
	 * The base implementation of `_.unary` without support for storing metadata.
	 *
	 * @private
	 * @param {Function} func The function to cap arguments for.
	 * @returns {Function} Returns the new capped function.
	 */
	function baseUnary(func) {
	  return function(value) {
	    return func(value);
	  };
	}
	
	module.exports = baseUnary;


/***/ },
/* 67 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(module) {var freeGlobal = __webpack_require__(28);
	
	/** Detect free variable `exports`. */
	var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;
	
	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;
	
	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports = freeModule && freeModule.exports === freeExports;
	
	/** Detect free variable `process` from Node.js. */
	var freeProcess = moduleExports && freeGlobal.process;
	
	/** Used to access faster Node.js helpers. */
	var nodeUtil = (function() {
	  try {
	    return freeProcess && freeProcess.binding('util');
	  } catch (e) {}
	}());
	
	module.exports = nodeUtil;
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(60)(module)))

/***/ },
/* 68 */
/***/ function(module, exports, __webpack_require__) {

	var isPrototype = __webpack_require__(69),
	    nativeKeys = __webpack_require__(70);
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/**
	 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 */
	function baseKeys(object) {
	  if (!isPrototype(object)) {
	    return nativeKeys(object);
	  }
	  var result = [];
	  for (var key in Object(object)) {
	    if (hasOwnProperty.call(object, key) && key != 'constructor') {
	      result.push(key);
	    }
	  }
	  return result;
	}
	
	module.exports = baseKeys;


/***/ },
/* 69 */
/***/ function(module, exports) {

	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/**
	 * Checks if `value` is likely a prototype object.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	 */
	function isPrototype(value) {
	  var Ctor = value && value.constructor,
	      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;
	
	  return value === proto;
	}
	
	module.exports = isPrototype;


/***/ },
/* 70 */
/***/ function(module, exports, __webpack_require__) {

	var overArg = __webpack_require__(71);
	
	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeKeys = overArg(Object.keys, Object);
	
	module.exports = nativeKeys;


/***/ },
/* 71 */
/***/ function(module, exports) {

	/**
	 * Creates a unary function that invokes `func` with its argument transformed.
	 *
	 * @private
	 * @param {Function} func The function to wrap.
	 * @param {Function} transform The argument transform.
	 * @returns {Function} Returns the new function.
	 */
	function overArg(func, transform) {
	  return function(arg) {
	    return func(transform(arg));
	  };
	}
	
	module.exports = overArg;


/***/ },
/* 72 */
/***/ function(module, exports, __webpack_require__) {

	var isFunction = __webpack_require__(23),
	    isLength = __webpack_require__(65);
	
	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null && isLength(value.length) && !isFunction(value);
	}
	
	module.exports = isArrayLike;


/***/ },
/* 73 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(module) {var root = __webpack_require__(27);
	
	/** Detect free variable `exports`. */
	var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;
	
	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;
	
	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports = freeModule && freeModule.exports === freeExports;
	
	/** Built-in value references. */
	var Buffer = moduleExports ? root.Buffer : undefined,
	    allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined;
	
	/**
	 * Creates a clone of  `buffer`.
	 *
	 * @private
	 * @param {Buffer} buffer The buffer to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Buffer} Returns the cloned buffer.
	 */
	function cloneBuffer(buffer, isDeep) {
	  if (isDeep) {
	    return buffer.slice();
	  }
	  var length = buffer.length,
	      result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
	
	  buffer.copy(result);
	  return result;
	}
	
	module.exports = cloneBuffer;
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(60)(module)))

/***/ },
/* 74 */
/***/ function(module, exports) {

	/**
	 * Copies the values of `source` to `array`.
	 *
	 * @private
	 * @param {Array} source The array to copy values from.
	 * @param {Array} [array=[]] The array to copy values to.
	 * @returns {Array} Returns `array`.
	 */
	function copyArray(source, array) {
	  var index = -1,
	      length = source.length;
	
	  array || (array = Array(length));
	  while (++index < length) {
	    array[index] = source[index];
	  }
	  return array;
	}
	
	module.exports = copyArray;


/***/ },
/* 75 */
/***/ function(module, exports, __webpack_require__) {

	var copyObject = __webpack_require__(51),
	    getSymbols = __webpack_require__(76);
	
	/**
	 * Copies own symbol properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy symbols from.
	 * @param {Object} [object={}] The object to copy symbols to.
	 * @returns {Object} Returns `object`.
	 */
	function copySymbols(source, object) {
	  return copyObject(source, getSymbols(source), object);
	}
	
	module.exports = copySymbols;


/***/ },
/* 76 */
/***/ function(module, exports, __webpack_require__) {

	var overArg = __webpack_require__(71),
	    stubArray = __webpack_require__(77);
	
	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeGetSymbols = Object.getOwnPropertySymbols;
	
	/**
	 * Creates an array of the own enumerable symbol properties of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of symbols.
	 */
	var getSymbols = nativeGetSymbols ? overArg(nativeGetSymbols, Object) : stubArray;
	
	module.exports = getSymbols;


/***/ },
/* 77 */
/***/ function(module, exports) {

	/**
	 * This method returns a new empty array.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.13.0
	 * @category Util
	 * @returns {Array} Returns the new empty array.
	 * @example
	 *
	 * var arrays = _.times(2, _.stubArray);
	 *
	 * console.log(arrays);
	 * // => [[], []]
	 *
	 * console.log(arrays[0] === arrays[1]);
	 * // => false
	 */
	function stubArray() {
	  return [];
	}
	
	module.exports = stubArray;


/***/ },
/* 78 */
/***/ function(module, exports, __webpack_require__) {

	var baseGetAllKeys = __webpack_require__(79),
	    getSymbols = __webpack_require__(76),
	    keys = __webpack_require__(52);
	
	/**
	 * Creates an array of own enumerable property names and symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names and symbols.
	 */
	function getAllKeys(object) {
	  return baseGetAllKeys(object, keys, getSymbols);
	}
	
	module.exports = getAllKeys;


/***/ },
/* 79 */
/***/ function(module, exports, __webpack_require__) {

	var arrayPush = __webpack_require__(80),
	    isArray = __webpack_require__(58);
	
	/**
	 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
	 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
	 * symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Function} keysFunc The function to get the keys of `object`.
	 * @param {Function} symbolsFunc The function to get the symbols of `object`.
	 * @returns {Array} Returns the array of property names and symbols.
	 */
	function baseGetAllKeys(object, keysFunc, symbolsFunc) {
	  var result = keysFunc(object);
	  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
	}
	
	module.exports = baseGetAllKeys;


/***/ },
/* 80 */
/***/ function(module, exports) {

	/**
	 * Appends the elements of `values` to `array`.
	 *
	 * @private
	 * @param {Array} array The array to modify.
	 * @param {Array} values The values to append.
	 * @returns {Array} Returns `array`.
	 */
	function arrayPush(array, values) {
	  var index = -1,
	      length = values.length,
	      offset = array.length;
	
	  while (++index < length) {
	    array[offset + index] = values[index];
	  }
	  return array;
	}
	
	module.exports = arrayPush;


/***/ },
/* 81 */
/***/ function(module, exports, __webpack_require__) {

	var DataView = __webpack_require__(82),
	    Map = __webpack_require__(20),
	    Promise = __webpack_require__(83),
	    Set = __webpack_require__(84),
	    WeakMap = __webpack_require__(85),
	    baseGetTag = __webpack_require__(86),
	    toSource = __webpack_require__(29);
	
	/** `Object#toString` result references. */
	var mapTag = '[object Map]',
	    objectTag = '[object Object]',
	    promiseTag = '[object Promise]',
	    setTag = '[object Set]',
	    weakMapTag = '[object WeakMap]';
	
	var dataViewTag = '[object DataView]';
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;
	
	/** Used to detect maps, sets, and weakmaps. */
	var dataViewCtorString = toSource(DataView),
	    mapCtorString = toSource(Map),
	    promiseCtorString = toSource(Promise),
	    setCtorString = toSource(Set),
	    weakMapCtorString = toSource(WeakMap);
	
	/**
	 * Gets the `toStringTag` of `value`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	var getTag = baseGetTag;
	
	// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
	if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
	    (Map && getTag(new Map) != mapTag) ||
	    (Promise && getTag(Promise.resolve()) != promiseTag) ||
	    (Set && getTag(new Set) != setTag) ||
	    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
	  getTag = function(value) {
	    var result = objectToString.call(value),
	        Ctor = result == objectTag ? value.constructor : undefined,
	        ctorString = Ctor ? toSource(Ctor) : undefined;
	
	    if (ctorString) {
	      switch (ctorString) {
	        case dataViewCtorString: return dataViewTag;
	        case mapCtorString: return mapTag;
	        case promiseCtorString: return promiseTag;
	        case setCtorString: return setTag;
	        case weakMapCtorString: return weakMapTag;
	      }
	    }
	    return result;
	  };
	}
	
	module.exports = getTag;


/***/ },
/* 82 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(21),
	    root = __webpack_require__(27);
	
	/* Built-in method references that are verified to be native. */
	var DataView = getNative(root, 'DataView');
	
	module.exports = DataView;


/***/ },
/* 83 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(21),
	    root = __webpack_require__(27);
	
	/* Built-in method references that are verified to be native. */
	var Promise = getNative(root, 'Promise');
	
	module.exports = Promise;


/***/ },
/* 84 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(21),
	    root = __webpack_require__(27);
	
	/* Built-in method references that are verified to be native. */
	var Set = getNative(root, 'Set');
	
	module.exports = Set;


/***/ },
/* 85 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(21),
	    root = __webpack_require__(27);
	
	/* Built-in method references that are verified to be native. */
	var WeakMap = getNative(root, 'WeakMap');
	
	module.exports = WeakMap;


/***/ },
/* 86 */
/***/ function(module, exports) {

	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;
	
	/**
	 * The base implementation of `getTag`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	function baseGetTag(value) {
	  return objectToString.call(value);
	}
	
	module.exports = baseGetTag;


/***/ },
/* 87 */
/***/ function(module, exports) {

	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/**
	 * Initializes an array clone.
	 *
	 * @private
	 * @param {Array} array The array to clone.
	 * @returns {Array} Returns the initialized clone.
	 */
	function initCloneArray(array) {
	  var length = array.length,
	      result = array.constructor(length);
	
	  // Add properties assigned by `RegExp#exec`.
	  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
	    result.index = array.index;
	    result.input = array.input;
	  }
	  return result;
	}
	
	module.exports = initCloneArray;


/***/ },
/* 88 */
/***/ function(module, exports, __webpack_require__) {

	var cloneArrayBuffer = __webpack_require__(89),
	    cloneDataView = __webpack_require__(91),
	    cloneMap = __webpack_require__(92),
	    cloneRegExp = __webpack_require__(96),
	    cloneSet = __webpack_require__(97),
	    cloneSymbol = __webpack_require__(100),
	    cloneTypedArray = __webpack_require__(102);
	
	/** `Object#toString` result references. */
	var boolTag = '[object Boolean]',
	    dateTag = '[object Date]',
	    mapTag = '[object Map]',
	    numberTag = '[object Number]',
	    regexpTag = '[object RegExp]',
	    setTag = '[object Set]',
	    stringTag = '[object String]',
	    symbolTag = '[object Symbol]';
	
	var arrayBufferTag = '[object ArrayBuffer]',
	    dataViewTag = '[object DataView]',
	    float32Tag = '[object Float32Array]',
	    float64Tag = '[object Float64Array]',
	    int8Tag = '[object Int8Array]',
	    int16Tag = '[object Int16Array]',
	    int32Tag = '[object Int32Array]',
	    uint8Tag = '[object Uint8Array]',
	    uint8ClampedTag = '[object Uint8ClampedArray]',
	    uint16Tag = '[object Uint16Array]',
	    uint32Tag = '[object Uint32Array]';
	
	/**
	 * Initializes an object clone based on its `toStringTag`.
	 *
	 * **Note:** This function only supports cloning values with tags of
	 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	 *
	 * @private
	 * @param {Object} object The object to clone.
	 * @param {string} tag The `toStringTag` of the object to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the initialized clone.
	 */
	function initCloneByTag(object, tag, cloneFunc, isDeep) {
	  var Ctor = object.constructor;
	  switch (tag) {
	    case arrayBufferTag:
	      return cloneArrayBuffer(object);
	
	    case boolTag:
	    case dateTag:
	      return new Ctor(+object);
	
	    case dataViewTag:
	      return cloneDataView(object, isDeep);
	
	    case float32Tag: case float64Tag:
	    case int8Tag: case int16Tag: case int32Tag:
	    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
	      return cloneTypedArray(object, isDeep);
	
	    case mapTag:
	      return cloneMap(object, isDeep, cloneFunc);
	
	    case numberTag:
	    case stringTag:
	      return new Ctor(object);
	
	    case regexpTag:
	      return cloneRegExp(object);
	
	    case setTag:
	      return cloneSet(object, isDeep, cloneFunc);
	
	    case symbolTag:
	      return cloneSymbol(object);
	  }
	}
	
	module.exports = initCloneByTag;


/***/ },
/* 89 */
/***/ function(module, exports, __webpack_require__) {

	var Uint8Array = __webpack_require__(90);
	
	/**
	 * Creates a clone of `arrayBuffer`.
	 *
	 * @private
	 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
	 * @returns {ArrayBuffer} Returns the cloned array buffer.
	 */
	function cloneArrayBuffer(arrayBuffer) {
	  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
	  new Uint8Array(result).set(new Uint8Array(arrayBuffer));
	  return result;
	}
	
	module.exports = cloneArrayBuffer;


/***/ },
/* 90 */
/***/ function(module, exports, __webpack_require__) {

	var root = __webpack_require__(27);
	
	/** Built-in value references. */
	var Uint8Array = root.Uint8Array;
	
	module.exports = Uint8Array;


/***/ },
/* 91 */
/***/ function(module, exports, __webpack_require__) {

	var cloneArrayBuffer = __webpack_require__(89);
	
	/**
	 * Creates a clone of `dataView`.
	 *
	 * @private
	 * @param {Object} dataView The data view to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned data view.
	 */
	function cloneDataView(dataView, isDeep) {
	  var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
	  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
	}
	
	module.exports = cloneDataView;


/***/ },
/* 92 */
/***/ function(module, exports, __webpack_require__) {

	var addMapEntry = __webpack_require__(93),
	    arrayReduce = __webpack_require__(94),
	    mapToArray = __webpack_require__(95);
	
	/**
	 * Creates a clone of `map`.
	 *
	 * @private
	 * @param {Object} map The map to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned map.
	 */
	function cloneMap(map, isDeep, cloneFunc) {
	  var array = isDeep ? cloneFunc(mapToArray(map), true) : mapToArray(map);
	  return arrayReduce(array, addMapEntry, new map.constructor);
	}
	
	module.exports = cloneMap;


/***/ },
/* 93 */
/***/ function(module, exports) {

	/**
	 * Adds the key-value `pair` to `map`.
	 *
	 * @private
	 * @param {Object} map The map to modify.
	 * @param {Array} pair The key-value pair to add.
	 * @returns {Object} Returns `map`.
	 */
	function addMapEntry(map, pair) {
	  // Don't return `map.set` because it's not chainable in IE 11.
	  map.set(pair[0], pair[1]);
	  return map;
	}
	
	module.exports = addMapEntry;


/***/ },
/* 94 */
/***/ function(module, exports) {

	/**
	 * A specialized version of `_.reduce` for arrays without support for
	 * iteratee shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @param {*} [accumulator] The initial value.
	 * @param {boolean} [initAccum] Specify using the first element of `array` as
	 *  the initial value.
	 * @returns {*} Returns the accumulated value.
	 */
	function arrayReduce(array, iteratee, accumulator, initAccum) {
	  var index = -1,
	      length = array ? array.length : 0;
	
	  if (initAccum && length) {
	    accumulator = array[++index];
	  }
	  while (++index < length) {
	    accumulator = iteratee(accumulator, array[index], index, array);
	  }
	  return accumulator;
	}
	
	module.exports = arrayReduce;


/***/ },
/* 95 */
/***/ function(module, exports) {

	/**
	 * Converts `map` to its key-value pairs.
	 *
	 * @private
	 * @param {Object} map The map to convert.
	 * @returns {Array} Returns the key-value pairs.
	 */
	function mapToArray(map) {
	  var index = -1,
	      result = Array(map.size);
	
	  map.forEach(function(value, key) {
	    result[++index] = [key, value];
	  });
	  return result;
	}
	
	module.exports = mapToArray;


/***/ },
/* 96 */
/***/ function(module, exports) {

	/** Used to match `RegExp` flags from their coerced string values. */
	var reFlags = /\w*$/;
	
	/**
	 * Creates a clone of `regexp`.
	 *
	 * @private
	 * @param {Object} regexp The regexp to clone.
	 * @returns {Object} Returns the cloned regexp.
	 */
	function cloneRegExp(regexp) {
	  var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
	  result.lastIndex = regexp.lastIndex;
	  return result;
	}
	
	module.exports = cloneRegExp;


/***/ },
/* 97 */
/***/ function(module, exports, __webpack_require__) {

	var addSetEntry = __webpack_require__(98),
	    arrayReduce = __webpack_require__(94),
	    setToArray = __webpack_require__(99);
	
	/**
	 * Creates a clone of `set`.
	 *
	 * @private
	 * @param {Object} set The set to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned set.
	 */
	function cloneSet(set, isDeep, cloneFunc) {
	  var array = isDeep ? cloneFunc(setToArray(set), true) : setToArray(set);
	  return arrayReduce(array, addSetEntry, new set.constructor);
	}
	
	module.exports = cloneSet;


/***/ },
/* 98 */
/***/ function(module, exports) {

	/**
	 * Adds `value` to `set`.
	 *
	 * @private
	 * @param {Object} set The set to modify.
	 * @param {*} value The value to add.
	 * @returns {Object} Returns `set`.
	 */
	function addSetEntry(set, value) {
	  // Don't return `set.add` because it's not chainable in IE 11.
	  set.add(value);
	  return set;
	}
	
	module.exports = addSetEntry;


/***/ },
/* 99 */
/***/ function(module, exports) {

	/**
	 * Converts `set` to an array of its values.
	 *
	 * @private
	 * @param {Object} set The set to convert.
	 * @returns {Array} Returns the values.
	 */
	function setToArray(set) {
	  var index = -1,
	      result = Array(set.size);
	
	  set.forEach(function(value) {
	    result[++index] = value;
	  });
	  return result;
	}
	
	module.exports = setToArray;


/***/ },
/* 100 */
/***/ function(module, exports, __webpack_require__) {

	var Symbol = __webpack_require__(101);
	
	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : undefined,
	    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;
	
	/**
	 * Creates a clone of the `symbol` object.
	 *
	 * @private
	 * @param {Object} symbol The symbol object to clone.
	 * @returns {Object} Returns the cloned symbol object.
	 */
	function cloneSymbol(symbol) {
	  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
	}
	
	module.exports = cloneSymbol;


/***/ },
/* 101 */
/***/ function(module, exports, __webpack_require__) {

	var root = __webpack_require__(27);
	
	/** Built-in value references. */
	var Symbol = root.Symbol;
	
	module.exports = Symbol;


/***/ },
/* 102 */
/***/ function(module, exports, __webpack_require__) {

	var cloneArrayBuffer = __webpack_require__(89);
	
	/**
	 * Creates a clone of `typedArray`.
	 *
	 * @private
	 * @param {Object} typedArray The typed array to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned typed array.
	 */
	function cloneTypedArray(typedArray, isDeep) {
	  var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
	  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
	}
	
	module.exports = cloneTypedArray;


/***/ },
/* 103 */
/***/ function(module, exports, __webpack_require__) {

	var baseCreate = __webpack_require__(104),
	    getPrototype = __webpack_require__(105),
	    isPrototype = __webpack_require__(69);
	
	/**
	 * Initializes an object clone.
	 *
	 * @private
	 * @param {Object} object The object to clone.
	 * @returns {Object} Returns the initialized clone.
	 */
	function initCloneObject(object) {
	  return (typeof object.constructor == 'function' && !isPrototype(object))
	    ? baseCreate(getPrototype(object))
	    : {};
	}
	
	module.exports = initCloneObject;


/***/ },
/* 104 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(24);
	
	/** Built-in value references. */
	var objectCreate = Object.create;
	
	/**
	 * The base implementation of `_.create` without support for assigning
	 * properties to the created object.
	 *
	 * @private
	 * @param {Object} proto The object to inherit from.
	 * @returns {Object} Returns the new object.
	 */
	var baseCreate = (function() {
	  function object() {}
	  return function(proto) {
	    if (!isObject(proto)) {
	      return {};
	    }
	    if (objectCreate) {
	      return objectCreate(proto);
	    }
	    object.prototype = proto;
	    var result = new object;
	    object.prototype = undefined;
	    return result;
	  };
	}());
	
	module.exports = baseCreate;


/***/ },
/* 105 */
/***/ function(module, exports, __webpack_require__) {

	var overArg = __webpack_require__(71);
	
	/** Built-in value references. */
	var getPrototype = overArg(Object.getPrototypeOf, Object);
	
	module.exports = getPrototype;


/***/ },
/* 106 */
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
/* 107 */
/***/ function(module, exports, __webpack_require__) {

	var ComponentMenu = __webpack_require__(108);
	var paper = prototypo;
	
	function displayComponents( glyph, showNodes ) {
		glyph.components.forEach(function(component) {
			component.visible = true;
			component.contours.forEach(function(contour) {
				contour.fullySelected = showNodes && !contour.skeleton;
			});
	
			if (component.choice && Array.isArray(component.choice)) {
				component.onMouseEnter = function() {
					component.oldFillColor = component.fillColor;
					component.fillColor = new paper.Color(0.141176,0.827451,0.56470588);
				};
	
				component.onMouseLeave = function() {
					component.fillColor = component.oldFillColor;
				};
	
				component.onClick = function(event) {
					event.preventDefault();
					event.stopPropagation();
					this.displayComponentList(glyph, component.componentId, event.point);
	
					this.view.onClick = function(event) {
						glyph.componentMenu.removeMenu();
						this.view.onClick = undefined;
					}.bind(this);
				}.bind(this);
			}
	
			if ( component.components.length ) {
				this.displayComponents( component, showNodes );
			}
		}.bind(this));
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
			this.currGlyph.contours.forEach(({segments}) => {
				segments.forEach(({directionHandle}) => {
					if(directionHandle) {
						directionHandle.visible = false;
					}
				})
			});
		}
	
		this.currGlyph = glyph;
	
		// make sure the glyph is up-to-update
		if ( _glyph && this.latestValues ) {
			this.currGlyph.update( this.latestValues );
		}
	
		// .. and show it
		this.currGlyph.visible = true;
	
		if ( this._fill ) {
			this.currGlyph.fillColor = new paper.Color(0.2, 0.2, 0.2);
			this.currGlyph.strokeWidth = 0;
		} else {
			this.currGlyph.fillColor = new paper.Color(1, 1, 1, 0.01);
			this.currGlyph.strokeWidth = 1;
		}
	
		this.currGlyph.contours.forEach(function(contour) {
			contour.fullySelected = this._showNodes;
		}, this);
	
		if ( this.currGlyph.components.length ) {
			this.displayComponents( this.currGlyph, this._showNodes );
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
			var hX = Math.round( viewCoords[j] ),
				hY = Math.round( viewCoords[j + 1] ),
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
			pX = Math.round( viewCoords[0] );
			pY = Math.round( viewCoords[1] );
			if ( state & /*#=*/ SelectionState.HANDLE_IN ) {
				drawHandle(2);
			}
			if ( state & /*#=*/ SelectionState.HANDLE_OUT ) {
				drawHandle(4);
			}
			if (segment.expand) {
				ctx.strokeStyle = settings.nodeColor;
				ctx.strokeRect( pX - (half + 1), pY - (half + 1), size + 1, size + 1 );
			}
			else if (!segment.expandedTo){
				// Draw a rectangle at segment.point:
				ctx.fillStyle = settings.nodeColor;
				ctx.fillRect( pX - half, pY - half, size, size );
			}
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
			var sX = Math.round( start[0] ),
				sY = Math.round( start[1] ),
				eX = Math.round( end[0] ),
				eY = Math.round( end[1] );
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
	
			if (segment.expand && segment.expandedTo && segment.expandedTo.length > 0) {
				var firstRib = segment.expandedTo[0];
				var secondRib = segment.expandedTo[1];
				var ribFirstCoords = new Float32Array(6);
				var ribSecondCoords = new Float32Array(6);
				firstRib._transformCoordinates(matrix, ribFirstCoords, false);
				secondRib._transformCoordinates(matrix, ribSecondCoords, false);
				drawBones(boneStartCoords, ribFirstCoords, 1);
				drawBones(boneStartCoords, ribSecondCoords, 1);
			} else {
				var firstRib = segment.expandedTo[0];
				var secondRib = segment.expandedTo[1];
				var ribFirstCoords = new Float32Array(6);
				var ribSecondCoords = new Float32Array(6);
				firstRib._transformCoordinates(matrix, ribFirstCoords, false);
				secondRib._transformCoordinates(matrix, ribSecondCoords, false);
				drawBones(ribFirstCoords, ribSecondCoords, 1);
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
	
	function displayComponentList( glyph, componentId, point ) {
		point.y = -point.y
		var component = glyph.components.filter(function(element) { return element.componentId === componentId})[0];
	
		if (component.choice && component.choice.length > 1) {
			if (glyph.componentMenu) {
				glyph.componentMenu.removeMenu();
			}
	
			var menu = new ComponentMenu({
				point: component.children[0].bounds.bottomLeft,
				components: glyph.componentLists[componentId],
				callback: function(componentName) {
					this.changeComponent(glyph, componentId, componentName);
				}.bind(this),
			});
	
			glyph.componentMenu = menu;
		}
	}
	
	 function changeComponent( glyph, componentId, componentName) {
		 this.emit('component.change', glyph, componentId, componentName);
	}
	
	module.exports = {
		displayGlyph: displayGlyph,
		displayComponents: displayComponents,
		displayComponentList: displayComponentList,
		changeComponent: changeComponent,
		_drawSelected: _drawSelected
	};


/***/ },
/* 108 */
/***/ function(module, exports, __webpack_require__) {

	var prototypo = __webpack_require__(2),
		paper = prototypo.paper;
	
	var blackColor = '#333333';
	var greenColor = '#24d390';
	var whiteColor = '#fefefe';
	var animationFrameLength = 20;
	var animationAngleRotation = 180;
	var componentItemHeight = 40;
	var componentItemMargin = 3;
	var componentItemPadding = 12;
	
	function ComponentMenu( args ) {
		paper.Group.prototype.constructor.apply( this );
	
		this.pivot = new paper.Point(0, 0);
		this.matrix.d = -1;
		this.position = new paper.Point(0,0);
		this.componentList = args.components;
		this.anchorPoint = args.point;
		this.componentItems = [];
		this.itemGroup = new paper.Group();
		this.pointArg = args.point;
		this.callback = args.callback;
	
		var circle = new paper.Shape.Circle(new paper.Point(0, 0), 16.4);
		circle.fillColor = blackColor;
		circle.matrix.ty = args.point.y;
		circle.matrix.tx = args.point.x;
		this.circle = circle;
		this.addChild(circle);
	
		var icon = new paper.CompoundPath('M27.1,16.1l-1.6-0.2c0-1.1-0.3-2.1-0.7-3.1l1.3-1c0.1-0.1,0.1-0.2,0.2-0.3 c0-0.1,0-0.2-0.1-0.3l-1.8-2.4c-0.1-0.1-0.2-0.1-0.3-0.2c-0.1,0-0.2,0-0.3,0.1l-1.2,0.9c-0.8-0.7-1.7-1.3-2.8-1.8L20,6.3 c0-0.1,0-0.2-0.1-0.3c-0.1-0.1-0.2-0.1-0.3-0.2l-3-0.4c-0.1,0-0.2,0-0.3,0.1c-0.1,0.1-0.1,0.2-0.2,0.3l-0.2,1.5 c-1.1,0-2.2,0.3-3.2,0.7l-0.9-1.2c-0.1-0.2-0.4-0.2-0.6-0.1L8.8,8.5C8.7,8.6,8.6,8.7,8.6,8.8c0,0.1,0,0.2,0.1,0.3l0.9,1.2 C8.8,11.1,8.2,12,7.8,13l-1.5-0.2c-0.1,0-0.2,0-0.3,0.1c-0.1,0.1-0.1,0.2-0.2,0.3l-0.4,3c0,0.2,0.1,0.4,0.3,0.5l1.5,0.2 C7.3,18,7.6,19.1,8,20.1l-1.3,1c-0.2,0.1-0.2,0.4-0.1,0.6L8.5,24c0.1,0.2,0.4,0.2,0.6,0.1l1.3-0.9c0.8,0.7,1.8,1.3,2.7,1.7 l-0.2,1.7c0,0.2,0.1,0.4,0.3,0.5l3,0.4c0,0,0,0,0.1,0c0.2,0,0.4-0.1,0.4-0.4l0.2-1.6c1.1-0.1,2.1-0.3,3.1-0.7l1,1.4 c0.1,0.2,0.4,0.2,0.6,0.1l2.4-1.8c0.1-0.1,0.1-0.2,0.2-0.3c0-0.1,0-0.2-0.1-0.3l-1-1.3c0.7-0.8,1.3-1.7,1.7-2.7l1.7,0.2 c0.2,0,0.4-0.1,0.5-0.3l0.4-3C27.4,16.4,27.3,16.2,27.1,16.1z M16.4,20.2c-2.1,0-3.8-1.7-3.8-3.8c0-2.1,1.7-3.8,3.8-3.8 s3.8,1.7,3.8,3.8C20.2,18.5,18.5,20.2,16.4,20.2z');
		icon.fillColor = whiteColor;
		icon.position = circle.position;
		this.icon = icon;
		this.addChild(icon);
	
		this.onMouseEnter = function() {
			this.circle.fillColor = greenColor;
		}
	
		this.onMouseLeave = function() {
			this.circle.fillColor = blackColor;
		}
	
		this.onMouseDown = function(event) {
			event.preventDefault();
			event.stopPropagation();
		}
	
		this.onClick = function(event) {
			event.preventDefault();
			event.stopPropagation();
			var factorGen = new EaseInTimer(animationFrameLength);
	
			if (this.displayComponentList()) {
				this.onFrame = function() {
					var frameFactor = factorGen.getNextFactor();
					var angle = animationAngleRotation * frameFactor;
					this.icon.rotate(angle, this.circle.bounds.center);
	
					if (EaseInTimer.frameCount === animationFrameLength) {
						this.onFrame = undefined;
					}
				}
			}
		}
	}
	
	ComponentMenu.prototype = Object.create(paper.Group.prototype);
	ComponentMenu.prototype.constructor = ComponentMenu;
	
	ComponentMenu.prototype.displayComponentList = function() {
		var shouldCreate = this.componentItems.length !== this.componentList.length;
	
		if (shouldCreate) {
			var self = this;
			var componentItems = [];
			this.componentList.forEach(function(component, i) {
				var position = new paper.Point(0, i * (componentItemHeight + componentItemMargin));
				var item = new ComponentMenuItem({
						point: position,
						text: component,
						container: self,
					});
				componentItems.push(item);
				this.itemGroup.addChild(item);
				item.onClick = function() {
					this.callback(component);
				}.bind(this);
			}.bind(this));
			this.componentItems = componentItems;
		}
		this.itemGroup.applyMatrix = false;
		this.itemGroup.setMatrix(new paper.Matrix(1, 0, 0, 0, this.pointArg.x - 12, this.pointArg.y + 22));
		var factorGen = new EaseInTimer(animationFrameLength, 0);
		this.itemGroup.onFrame = function() {
			var frameFactor = factorGen.getNextFactor();
			this.itemGroup.setMatrix(new paper.Matrix(1, 0, 0, this.itemGroup.matrix.d + frameFactor, this.pointArg.x - 12, this.pointArg.y + 22));
			if (this.itemGroup.scaling.y >= 1) {
				this.itemGroup.setMatrix(new paper.Matrix(1, 0, 0, 1, this.pointArg.x - 12, this.pointArg.y + 22));
				this.itemGroup.onFrame = undefined;
			}
	
		}.bind(this);
	
		return shouldCreate;
	}
	
	ComponentMenu.prototype.removeMenu = function() {
		this.remove();
		this.itemGroup.remove();
		this.icon.remove();
		this.circle.remove();
	}
	
	function ComponentMenuItem( args ) {
		paper.Group.prototype.constructor.apply( this );
		var bg = new paper.Shape.Rectangle(args.point, new paper.Size(200, componentItemHeight));
		bg.fillColor = blackColor;
		bg.onMouseEnter = function() {
			bg.fillColor = greenColor;
		}
		bg.onMouseLeave = function() {
			bg.fillColor = blackColor;
		}
		this.addChild(bg);
	
		var text = new paper.PointText(new paper.Point(componentItemPadding, componentItemPadding));
		text.content = args.text;
		text.fontSize = 20;
		text.fillColor = whiteColor;
		text.matrix.d = -1;
		var textContainer = new paper.Group({
			children: [text],
			pivot: new paper.Point(0, 0),
			position: args.point,
		});
		this.addChild(textContainer);
	}
	
	ComponentMenuItem.prototype = Object.create(paper.Group.prototype);
	ComponentMenuItem.prototype.constructor = ComponentMenu;
	
	function EaseInTimer(animationFrameLength, startValue) {
		this.frameCount = 0;
		this.animationFrameLength = animationFrameLength;
		this.startValue = startValue != undefined ? startValue : -Math.E;
		this.stepFactor = -this.startValue + Math.E
		this.areaMultiplier = 2 * Math.E / this.stepFactor;
	}
	
	EaseInTimer.prototype.getNextFactor = function() {
		//tanh is good approximation to ease in ease out function
		//we use d/dx(tanh) = 1 - tanh^2 to compute our diff angle
		//since tanh varies between -1 and 1 we divide the derivative by two
		//so that the angle at the end is animationAngleRotation
		return this.areaMultiplier * (1 - Math.pow(Math.tanh(this.startValue + this.stepFactor * (this.frameCount++ / this.animationFrameLength)), 2)) / 2 * ( this.stepFactor / this.animationFrameLength);
	}
	
	module.exports = ComponentMenu;


/***/ },
/* 109 */
/***/ function(module, exports, __webpack_require__) {

	var paper = __webpack_require__(2).paper;
	
	function wheelHandler( event ) {
		// normalize the deltaY value. Expected values are ~40 pixels or 3 lines
		var factor = 1 + ( this.opts.zoomFactor *
				( Math.abs( event.deltaY / event.deltaMode ? 3 : 40 * 20 ) ) ),
			newZoom =
				event.deltaY < 0 ?
					this.view.zoom * factor :
					event.deltaY > 0 ?
						this.view.zoom / factor :
						this.view.zoom;
	
	
		if ( newZoom > 0.07 ) {
			var mousePosition = new paper.Point( event.offsetX, event.offsetY);
			var viewPosition = this.view.viewToProject( mousePosition );
			var pc = viewPosition.subtract( this.view.center );
			var newPosition = viewPosition.subtract(
				pc.multiply( this.view.zoom / newZoom )
			).subtract( this.view.center );
	
			this.zoom = newZoom;
			this.view.center = this.view.center.add(newPosition);
		}
	
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
				delta.divide( this.view.zoom ) );
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
		zoomIn: zoomIn,
		zoomOut: zoomOut
	};


/***/ },
/* 110 */
/***/ function(module, exports, __webpack_require__) {

	var shell = __webpack_require__(111);
	
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
			var worker = opts.worker = new SharedWorker( opts.workerUrl),
				handler = function initWorker() {
					worker.port.removeEventListener('message', handler);
					resolve();
				};
			window.worker = worker;
	
			worker.port.onmessage = handler;
			worker.port.start();
	
			var data = {
				exportPort: opts.export || false,
				deps: Array.isArray( opts.workerDeps ) ?
					opts.workerDeps :
					[ opts.workerDeps ]
			};
	
			worker.port.postMessage( data );
		}).then(function() {
			return new constructor( opts );
		});
	};


/***/ },
/* 111 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {var ports = [],
		exportPorts = [],
		font,
		originSubset = {},
		currValues,
		currName,
		currSubset = [],
		arrayBufferMap = {},
		worker = self,
		fontsMap = {},
		prototypoObj,
		translateSubset = function() {
			if ( !currSubset.length ) {
				return;
			}
	
			font.subset = currSubset.map(function( glyph ) {
				return font.charMap[ glyph.ot.unicode ];
			}).filter(Boolean);
	
			currSubset = font.subset;
		};
	
	function subset( eData ) {
		var set = eData.data,
			add = eData.add,
			origin = eData.origin || 'native';
	
		var prevGlyphs = currSubset.map(function( glyph ) {
			return glyph.name;
		});
		if (add) {
			originSubset[origin] = set + originSubset[origin];
		} else {
			originSubset[origin] = set;
		}
	
		if ( origin ) {
			var currentStringSubset = Object
			.keys(originSubset)
			.map(function( key ) {
				return originSubset[key];
			}).join('');
			font.subset = currentStringSubset + set;
		} else {
			font.subset = set;
		}
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
	}
	
	function runSharedWorker(self) {
		var handlers = {};
		self.addEventListener('message', function(e) {
			var result;
	
			if ( e.data.type && e.data.type in handlers ) {
				result = handlers[ e.data.type ]( e.data );
	
				if ( result === null ) {
					return;
				}
	
				arrayBufferMap[currName] = result;
	
				ports.forEach(function(port) {
					port.postMessage(
						result
					);
				});
	
				exportPorts.forEach(function(port) {
					port.postMessage(
						[ result, currName ]
					);
				});
			}
		});
	
		handlers.fontData = function( eData) {
			var name = eData.name;
	
			self.postMessage(
				[ arrayBufferMap[name], name ]
			);
			return null;
		}
	
		handlers.subset = subset;
	}
	
	function runWorker(self) {
		var handlers = {};
	
		prototypoObj.paper.setup({
			width: 1024,
			height: 1024
		});
	
		// mini router
		self.addEventListener('message', function(e) {
			var result;
	
			if ( e.data.type && e.data.type in handlers ) {
				result = handlers[ e.data.type ]( e.data );
	
				if ( result === null ) {
					return;
				}
	
				arrayBufferMap[currName] = result;
	
				ports.forEach(function(port) {
					port.postMessage(
						result
					);
				});
	
				exportPorts.forEach(function(port) {
					port.postMessage(
						[ result, currName ]
					);
				});
			}
		});
	
		handlers.closeAll = function() {
			ports.splice(ports.indexOf(self), 1);
	
			if (ports.length === 0) {
				worker.close();
			}
		}
	
		handlers.font = function( eData ) {
			var fontSource = eData.data,
				templateName = eData.name,
				name = eData.db;
	
			//reset currValues to avoid using old values stored in the shared worker
			currValues = undefined;
	
			// TODO: this should be done using a memoizing table of limited size
			currName = name;
			if ( templateName in fontsMap ) {
				font = fontsMap[templateName];
				translateSubset();
				return null;
			}
	
			var fontObj = JSON.parse( fontSource );
	
			font = prototypoObj.parametricFont(fontObj);
			fontsMap[templateName] = font;
	
			translateSubset();
	
			var solvingOrders = {};
			Object.keys( font.glyphMap ).forEach(function(key) {
				solvingOrders[key] = font.glyphMap[key].solvingOrder;
			});
	
			return solvingOrders;
		};
	
		handlers.update = function( eData ) {
			var params = eData.data;
	
			currValues = params;
			font.update( currValues );
			font.updateOTCommands();
			var result = font.toArrayBuffer();
			return result;
		};
	
		handlers.getGlyphProperty = function(eData) {
			var result = null;
	
			if (eData.data) {
				var unicode = eData.data.unicode;
				var properties = eData.data.properties;
				result = {};
	
				font.glyphs.forEach(function(glyph) {
					if (glyph.unicode === unicode) {
						if (typeof properties === 'string') {
							result[properties] = glyph[properties];
						}
						else if (Array.isArray(properties)) {
							properties.forEach(function(property) {
								result[property] = glyph[property];
							});
						}
					}
				});
			}
	
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
	
		handlers.alternate = function( eData ) {
			var params = eData.data;
	
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
	
		handlers.subset = subset;
	
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
	
		handlers.otfFont = function( eData ) {
			var data = eData.data;
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
	
		handlers.changeCursorsToManual = function(eData) {
			var cursors = eData.cursors;
			var glyphUnicode = eData.glyphUnicode;
	
			font.changeCursorsToManual(glyphUnicode, cursors);
		};
	}
	
	function prepareWorker(self) {
	
		// This is how bundle dependencies are loaded
		if ( typeof global === 'undefined' && importScripts ) {
			var handler = function initWorker( e ) {
					self.removeEventListener('message', handler);
					if (!prototypoObj) {
						importScripts( e.data.deps );
						prototypoObj = prototypo;
					}
					if ( e.data.exportPort ) {
						exportPorts.push(self);
	
						//If there is no producer we do not launch the export port
						if (ports.length === 0) {
							self.shouldBeLaunchedLater = true;
						} else {
							runSharedWorker(self);
							self.postMessage('ready');
						}
	
					} else {
						ports.push(self);
						runWorker(self);
	
						exportPorts.forEach(function( port ) {
							if (port.shouldBeLaunchedLater) {
								runSharedWorker(port);
								port.postMessage('ready');
							}
						});
						self.postMessage('ready');
					}
				};
	
			self.addEventListener('message', handler);
		}
	}
	
	onconnect = function(e) {
		var port = e.ports[0];
		prepareWorker(port);
	
		port.start();
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 112 */
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
	
	module.exports = function loadFont( name, fontSource, db ) {
		// ignore the job currently running, empty the queue and clear update values
		this.emptyQueue();
		this.latestValues = this.latestRafValues = null;
	
		// TODO: memoizing should have a limited size!
		if ( name in this.fontsMap ) {
			this.font = _.deepClone(this.fontsMap[name]);
			translateGlyph( this );
			this.worker.port.postMessage({
				type: 'font',
				name: name,
				db: db
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
						this.worker.port.removeEventListener('message', handler);
	
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
	
				this.worker.port.addEventListener('message', handler);
	
				this.worker.port.postMessage({
					type: 'font',
					name: name,
					db: db,
					data: fontSource
				});
	
			}.bind(this));
		}.bind(this));
	};


/***/ },
/* 113 */
/***/ function(module, exports) {

	function createUIEditor(paper, options) {
		var UIEditor = {
			onCursorsChanged: options.onCursorsChanged,
			onConfirmChanges: options.onConfirmChanges,
		};
	
		var distributionHandle = new paper.Path.RegularPolygon({
			center: [0, 0],
			sides: 3,
			radius: 15,
			fillColor: '#24d390',
			transformContent: false,
		});
	
		distributionHandle.onMouseDrag = function(event) {
			var expandVect = UIEditor.selection.expandedTo[0].point.subtract(UIEditor.selection.expandedTo[1].point);
			var direction = new paper.Point(
				Math.cos(UIEditor.selection.expand.angle),
				Math.sin(UIEditor.selection.expand.angle)
			);
			var deltaWidth = direction.x * event.delta.x - direction.y * event.delta.y;
			var deltaDistr = deltaWidth / expandVect.length;
			if(UIEditor.selection.expand.distr + deltaDistr >= 1) {
				deltaDistr = Math.min(deltaDistr, 0);
			} else if(UIEditor.selection.expand.distr + deltaDistr <= 0) {
				deltaDistr = Math.max(deltaDistr, 0);
			}
	
			const { contourIdx, nodeIdx } = UIEditor.selection;
			UIEditor.onCursorsChanged({
				[`contours.${contourIdx}.nodes.${nodeIdx}.expand`]: {
					distr: deltaDistr,
				},
				[`contours.${contourIdx}.nodes.${nodeIdx}.x`]: - expandVect.multiply(deltaDistr).x,
				[`contours.${contourIdx}.nodes.${nodeIdx}.y`]: - expandVect.multiply(deltaDistr).y,
			});
	
			return false; // prevent anything else to move
		};
	
		distributionHandle.onMouseUp = function(event) {
			UIEditor.onConfirmChanges();
		}
	
		var directionHandle = new paper.Path.Arc({
			from: new paper.Point(0,0).rotate(-30, new paper.Point(0, 40)),
			through: [0, 0],
			to: new paper.Point(0,0).rotate(30, new paper.Point(0, 40)),
			strokeColor: '#24d390',
			strokeWidth: 10,
			transformContent: false,
		});
	
		directionHandle.onMouseDown = function(event) {
			var skewedSelection = new paper.Point(
				UIEditor.selection.x + UIEditor.selection.path.viewMatrix.c / paper.view.zoom  * UIEditor.selection.y,
				UIEditor.selection.y
			);
			this.selectedHandlePos = new paper.Point(directionHandle.position).subtract(skewedSelection);
			this.selectedHandleNorm = this.selectedHandlePos.length;
			this.selectedHandleAngle = this.selectedHandlePos.angle;
		};
	
		directionHandle.onMouseDrag = function(event) {
			var transformedEventPoint = new paper.Point(event.point.x, -event.point.y);
			var skewedSelection = new paper.Point(
				UIEditor.selection.x + UIEditor.selection.path.viewMatrix.c / paper.view.zoom  * UIEditor.selection.y,
				UIEditor.selection.y
			);
			var mouseVecNorm = transformedEventPoint.subtract(skewedSelection).length;
	
			var eventNormalized = event.delta.multiply(this.selectedHandleNorm/mouseVecNorm);
			var newHandlePosition = new paper.Point(
				this.selectedHandlePos.x + eventNormalized.x,
				this.selectedHandlePos.y - eventNormalized.y
			);
	
			var normalizedHandle = newHandlePosition.normalize().multiply(this.selectedHandleNorm);
			directionHandle.position.x = normalizedHandle.add(skewedSelection).x;
			directionHandle.position.y = normalizedHandle.add(skewedSelection).y;
			var deltaAngle = normalizedHandle.angle - this.selectedHandleAngle;
	
			this.selectedHandleAngle = normalizedHandle.angle;
			this.selectedHandlePos = new paper.Point(directionHandle.position).subtract(skewedSelection);
			UIEditor.onCursorsChanged({
				[`contours.${UIEditor.selection.contourIdx}.nodes.${UIEditor.selection.nodeIdx}.expand`]: {
					angle: deltaAngle * Math.PI / 180,
				},
			});
	
			return false; // prevent anything else to move
		};
	
		directionHandle.onMouseUp = function(event) {
			UIEditor.onConfirmChanges();
		}
	
		UIEditor.distributionHandle = distributionHandle;
		UIEditor.directionHandle = directionHandle;
	
		return UIEditor;
	}
	
	function drawUIEditor(paper, hide, UIEditor) {
		var directionHandle = UIEditor.directionHandle;
		var distributionHandle = UIEditor.distributionHandle;
	
		directionHandle.visible = !hide && UIEditor.selection;
		distributionHandle.visible = !hide && UIEditor.selection;
	
		if(!UIEditor.selection) {
			return;
		}
	
		directionHandle.bringToFront();
		distributionHandle.bringToFront();
	
		var orthVect = new paper.Point(-Math.sin(UIEditor.selection.expand.angle), Math.cos(UIEditor.selection.expand.angle));
	
		// we need to reset rotation and scaling before setting them, because PaperJS
		// see https://github.com/paperjs/paper.js/issues/1177
		distributionHandle.rotation = 0;
		distributionHandle.scaling = 1;
	
		distributionHandle.rotation = orthVect.angle - 30;
		distributionHandle.position = UIEditor.selection.point.add(orthVect.multiply(-40 * 0.5 / paper.view.zoom));
		distributionHandle.scaling = 1 * (0.5 / paper.view.zoom);
		var skewMatrix = new paper.Matrix(1, 0, 0, 1, UIEditor.selection.path.viewMatrix.c / paper.view.zoom  * UIEditor.selection.y, 0);
		distributionHandle.matrix = distributionHandle.matrix.prepend(skewMatrix);
	
		directionHandle.rotation = 0;
		directionHandle.scaling = 1;
		directionHandle.rotation = orthVect.angle + 90;
		directionHandle.position = UIEditor.selection.point.add(orthVect.multiply(75 * 0.5 / paper.view.zoom));
		directionHandle.scaling = 1 * (0.5 / paper.view.zoom);
		directionHandle.matrix = directionHandle.matrix.prepend(skewMatrix);
	}
	
	module.exports = {
		createUIEditor,
		drawUIEditor,
	};


/***/ }
/******/ ])
});
;
//# sourceMappingURL=prototypo-canvas.js.map