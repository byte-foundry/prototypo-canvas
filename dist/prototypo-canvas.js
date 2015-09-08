(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.PrototypoCanvas = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
var prototypo = (typeof window !== "undefined" ? window.prototypo : typeof global !== "undefined" ? global.prototypo : null),
	assign = require('es6-object-assign').assign,
	// Grid = require('./grid'),
	glyph = require('./utils/glyph'),
	mouseHandlers = require('./utils/mouseHandlers'),
	init = require('./utils/init'),
	loadFont = require('./utils/loadFont');

var _ = { assign: assign },
	paper = prototypo.paper;

// constructor
function PrototypoCanvas( opts ) {
	paper.setup( opts.canvas );
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
				this.font.addToFonts( e.data );
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

			if ( !this.latestRafValues || !this.currGlyph ) {
				return;
			}

			this.font.update( this.latestRafValues, [ this.currGlyph ] );
			this.view.update();
			delete this.latestRafValues;

		}.bind(this);
	updateLoop();
}

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
	nodeColor: '#00C4D6',
	drawCoords: false,
	handleFont: '12px monospace'
});

// The worker queue is not your ordinary queue: the priority of the job is
// defined arbitrarily, and any message previously present
// at this position will be overwritten. The priorities associated to the
// message type are hardcoded below (in ascending priority order).
PrototypoCanvas.priorities = [ 'update', 'subset', 'svgFont', 'otfFont' ];
PrototypoCanvas.prototype.enqueue = function( message ) {
	this._queue[ PrototypoCanvas.priorities.indexOf( message.type ) ] = message;
	this.dequeue();
};

PrototypoCanvas.prototype.dequeue = function() {
	if ( this.currentJob || !this.worker ) {
		return;
	}

	// send the highest priority mesage in the queue (0 is lowest)
	for ( var i = this._queue.length; i--; ) {
		if ( this._queue[i] ) {
			this.currentJob = this._queue[i];

			// the callback function shouldn't be sent
			var cb = this.currentJob.callback;
			delete this.currentJob.callback;

			this.worker.postMessage( this.currentJob );

			this.currentJob.callback = cb;
			this._queue[i] = null;
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

PrototypoCanvas.prototype.download = function( cb, name ) {
	if ( !this.worker || !this.latestValues ) {
		// the UI should wait for the first update to happen before allowing
		// the download button to be clicked
		return false;
	}

	this.enqueue({
		type: 'otfFont',
		data: name,
		callback: function( data ) {
			this.font.download( data );
			if ( cb ) {
				cb();
			}
		}.bind(this)
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

},{"./utils/glyph":3,"./utils/init":4,"./utils/loadFont":5,"./utils/mouseHandlers":6,"es6-object-assign":1}],3:[function(require,module,exports){
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
		contour.fullySelected = this._showNodes && !contour.skeleton;
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
		var state = segment._selectionState;
		pX = Math.round( viewCoords[0] );
		pY = Math.round( viewCoords[1] );
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
}

module.exports = {
	displayGlyph: displayGlyph,
	_drawSelected: _drawSelected
};

},{}],4:[function(require,module,exports){
var shell = require('./../worker');

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

},{"./../worker":7}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
var paper = (typeof window !== "undefined" ? window.prototypo : typeof global !== "undefined" ? global.prototypo : null).paper;

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
	onMove: moveHandler,
	onDown: downHandler,
	onUp: upHandler,
	zoomIn: zoomIn,
	zoomOut: zoomOut
};

},{}],7:[function(require,module,exports){
function prepareWorker() {
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
			// the following is required so that the globalMatrix of glyphs
			// takes the font matrix into account. I assume this is done in the
			// main thread when calling view.update();
			font._project._updateVersion++;
			font.updateOTCommands();
			return font.ot.toBuffer();
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

			// Recreate the correct font.ot.glyphs array, without touching the
			// ot commands
			font.ot.glyphs = font.getGlyphSubset().map(function( glyph ) {
				return glyph.ot;
			});
			return font.ot.toBuffer();
		};

		handlers.otfFont = function() {
			// force-update of the whole font, ignoring the current subset
			var allChars = font.getGlyphSubset( false );
			font.update( currValues, allChars );

			font.updateOTCommands( allChars );
			return font.ot.toBuffer();
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

},{}]},{},[2])(2)
});


//# sourceMappingURL=prototypo-canvas.js.map