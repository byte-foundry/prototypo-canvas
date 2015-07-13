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

module.exports = { _drawSelected: _drawSelected };

},{}],3:[function(require,module,exports){
// var dotsvgTemplate = require('./dotsvg.tpl');

// handles buffers coming from the worker
module.exports = function fontBufferHandler(e) {
	// prevent the worker to be stuck with a busy flag if this method throws
	this.isWorkerBusy = false;

	// if ( 'type' in e.data ) {
	// 	if ( e.data.type === 'otfFont' ) {
	// 		this.font.download( this.latestBuffer );
	// 	}
	//
	// 	if ( typeof this.fontCb === 'function' ) {
	// 		this.fontCb();
	// 	}
	//
	// 	this.fontCb = false;
	// }

	if ( !(e.data instanceof ArrayBuffer) ) {
		return;
	}

	this.latestBuffer = e.data;
	this.font.addToFonts( e.data );

	// process latest Values
	if ( this.latestWorkerValues ) {
		this.isWorkerBusy = true;
		this.worker.postMessage({
			type: 'update',
			data: this.latestWorkerValues
		});

		delete this.latestWorkerValues;

	} else if ( this.latestSubset ) {
		this.isWorkerBusy = true;
		this.worker.postMessage({
			type: 'subset',
			data: this.latestSubset
		});

		delete this.latestSubset;
	}
};

},{}],4:[function(require,module,exports){
var shell = require('./worker'),
	assign = require('es6-object-assign').assign;

var _ = { assign: assign },
	URL = typeof window !== 'undefined' && ( window.URL || window.webkitURL );

function load( opts ) {
	var PrototypoCanvas = this;

	opts = _.assign({
		fontUrl: 'font.json',
		prototypoUrl: 'prototypo.js'
	}, opts);

	// if the sources are provided
	return Promise.all([
		!opts.fontSource && opts.fontUrl,
		!opts.prototypoSource && opts.prototypoUrl
	].map(function( url ) {
		// only fetch the resources if we have just the url, not the source
		return url && fetch( url );

	})).then(function( results ) {
		// parse fetched resources
		return Promise.all([
			results[0] && results[0].text(),
			results[1] && results[1].text()
		]);

	}).then(function( results ) {
		if ( results[0] ) {
			opts.fontSource = results[0];
		}
		if ( results[1] ) {
			opts.prototypoSource = results[1];
		}

		opts.fontObj = JSON.parse( opts.fontSource );
		// the worker can be created by specifying the URL of the complete
		// file (dev environment), or by creating
		if ( opts.workerUrl ) {
			// The search fragment of workerUrl must include prototypo.js URL
			opts.workerUrl +=
				'?bundleurl=' + encodeURIComponent( opts.prototypoUrl );
		} else {
			opts.workerUrl = URL.createObjectURL(
				new Blob([
					opts.prototypoSource + ';\n\n' +
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
			var worker = new Worker( opts.workerUrl );

			worker.onmessage = function(e) {
				// load the font
				if ( e.data.type === 'ready' ) {
					worker.postMessage({
						type: 'font',
						data: opts.fontSource
					});

				// reuse the solvingOrders computed in the worker (this is a
				// fairly heavy operation, better doing it only once,
				// asynchronously)
				} else if ( e.data.type === 'solvingOrders' ) {
					opts.worker = worker;
					// merge solvingOrders with the source
					Object.keys( e.data.data ).forEach(function(key) {
						if ( e.data.data[key] ) {
							opts.fontObj.glyphs[key].solvingOrder =
								e.data.data[key];
						}
					});

					// We're done with the asynchronous stuff!
					resolve();
				}
			};
		});
	}).then(function() {
		return new PrototypoCanvas( opts );
	});
}

module.exports = load;

},{"./worker":6,"es6-object-assign":1}],5:[function(require,module,exports){
var prototypo = (typeof window !== "undefined" ? window.prototypo : typeof global !== "undefined" ? global.prototypo : null),
	assign = require('es6-object-assign').assign,
	// Grid = require('./grid'),
	fontBufferHandler = require('./fontBufferHandler'),
	_drawSelected = require('./drawNodes')._drawSelected,
	load = require('./load');

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
		jQueryListeners: true
	}, opts);

	this.canvas = opts.canvas;
	this.view = paper.view;
	this.view.center = [ 0, 0 ];
	this.project = paper.project;
	this.project.activeLayer.applyMatrix = false;
	this.project.activeLayer.scale( 1, -1 );
	this.worker = opts.worker;
	this._fill = this.opts.fill;
	this._showNodes = this.opts.showNodes;

	// this.grid = new Grid( paper );

	this.font = prototypo.parametricFont( opts.fontObj );
	this.isMousedown = false;

	if ( this.worker ) {
		this.worker.onmessage = fontBufferHandler.bind(this);
	}

	// jQuery is an optional dependency
	if ( ( 'jQuery' in window ) && this.opts.jQueryListeners ) {
		var $ = window.jQuery,
			type = ( 'PointerEventsPolyfill' in window ) ||
				( 'PointerEvent' in window ) ? 'pointer' : 'mouse';

		$(opts.canvas).on( 'wheel', this.wheelHandler.bind(this) );

		$(opts.canvas).on( type + 'move', this.moveHandler.bind(this) );

		$(opts.canvas).on( type + 'down', this.downHandler.bind(this) );

		$(document).on( type + 'up', this.upHandler.bind(this) );
	}

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
			if ( this.worker && !this.isWorkerBusy ) {
				if ( this.currSubset !== undefined ) {
					// block updates
					this.isWorkerBusy = true;
				}

				this.worker.postMessage({
					type: 'subset',
					data: set
				});

			// if the worker is already busy, store the latest values so that we
			// can eventually update the font with the latest values
			} else {
				this.latestSubset = set;
			}

			this.font.subset = this.currSubset = set;
		}
	}
});

PrototypoCanvas.prototype.wheelHandler = function( event ) {
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
};

PrototypoCanvas.prototype.moveHandler = function(event) {
	if ( !this.isMousedown ) {
		return;
	}

	var currPos = new paper.Point( event.clientX, event.clientY ),
		delta = currPos.subtract( this.prevPos );

	this.prevPos = currPos;

	this.view.center = this.view.center.subtract(
			delta.divide( this.view.zoom ) );
};

PrototypoCanvas.prototype.downHandler = function(event) {
	if (event.button && event.button !== 0) {
		return;
	}

	this.isMousedown = true;
	this.prevPos = new paper.Point( event.clientX, event.clientY );
};

PrototypoCanvas.prototype.upHandler = function() {
	this.isMousedown = false;
};

PrototypoCanvas.prototype.zoomIn = function() {
	this.zoom = this.view.zoom * 1 + this.opts.zoomFactor;
};

PrototypoCanvas.prototype.zoomOut = function() {
	this.zoom = this.view.zoom / 1 + this.opts.zoomFactor;
};

PrototypoCanvas.prototype.displayGlyph = function( _glyph ) {
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

	this.currGlyph.components.forEach(function(component) {
		component.visible = true;
		component.contours.forEach(function(contour) {
			contour.fullySelected = this._showNodes && !contour.skeleton;
		}, this);
	}, this);

	this.view._project._needsUpdate = true;
	this.view.update();
};

PrototypoCanvas.prototype.displayChar = function( code ) {
	this.displayGlyph( typeof code === 'string' ?
		this.font.charMap[ code.charCodeAt(0) ] : code
	);
};

PrototypoCanvas.prototype.update = function( values ) {
	// latestValues are used in displayGlyph
	// latestWorkerValues is used and disposed by the fontBufferHandler
	// latestRafValues is used and disposed by the raf loop
	// so we need all three!
	this.latestValues = this.latestRafValues = values;

	if ( this.worker && !this.isWorkerBusy ) {
		// block updates
		this.isWorkerBusy = true;

		this.worker.postMessage({
			type: 'update',
			data: values
		});

	// if the worker is already busy, store the latest values so that we can
	// eventually update the font with the latest values
	} else {
		this.latestWorkerValues = values;
	}
};

PrototypoCanvas.prototype.download = function( name, cb ) {
	if ( !this.worker || !this.latestValues || this.fontCb ) {
		// the UI should wait for the first update to happen before allowing
		// the download button to be clicked
		return;
	}

	this.fontCb = cb || true;
	this.isWorkerBusy = true;

	// We don't care if the worker is busy here
	this.worker.postMessage({
		type: 'otfFont'
	});
};

PrototypoCanvas.prototype.openInGlyphr = function( cb ) {
	if ( !this.worker || !this.latestValues || this.fontCb ) {
		// the UI should wait for the first update to happen before allowing
		// the download button to be clicked
		return;
	}

	// We don't care if the worker is busy here
	this.fontCb = cb || true;
	this.isWorkerBusy = true;

	// We don't care if the worker is busy here
	this.worker.postMessage({
		type: 'svgFont'
	});
};

PrototypoCanvas.load = load;

// overwrite the appearance of #selected items in paper.js
paper.PaperScope.prototype.Path.prototype._drawSelected = _drawSelected;
_.assign( paper.settings, {
	handleSize: 6,
	handleColor: '#FF725E',
	nodeColor: '#00C4D6',
	drawCoords: false,
	handleFont: '12px monospace'
});

module.exports = PrototypoCanvas;

},{"./drawNodes":2,"./fontBufferHandler":3,"./load":4,"es6-object-assign":1}],6:[function(require,module,exports){
if ( typeof global === 'undefined' && 'importScripts' in self ) {
	// When the worker is loaded by URL, the search fragment must include
	// the URL of prototypo.js
	self.importScripts( decodeURIComponent(
		self.location.search.replace(/(\?|&)bundleurl=(.*?)(&|$)/, '$2')
	) );
}

function worker() {
	var font,
		handlers = {},
		currValues,
		currSubset = [];

	self.postMessage({ type: 'ready' });

	prototypo.paper.setup({
		width: 1024,
		height: 1024
	});

	// Overwrite addToFonts to send the buffer over to the UI
	prototypo.paper.Font.prototype.addToFonts = function() {
		var buffer = this.ot.toBuffer();
		self.postMessage( buffer, [ buffer ] );
	};

	// mini router
	self.onmessage = function(e) {
		handlers[ e.data.type ]( e.data.data );
	};

	handlers.font = function( fontSource ) {
		font = prototypo.parametricFont( JSON.parse( fontSource ) );
		var solvingOrders = {};
		Object.keys( font.glyphMap ).forEach(function(key) {
			solvingOrders[key] = font.glyphMap[key].solvingOrder;
		});

		self.postMessage({
			type: 'solvingOrders',
			data: solvingOrders
		});
	};

	handlers.update = function( params ) {
		currValues = params;
		// invalidate the previous subset
		currSubset = [];

		font.update( params );
		// the following is required so that the globalMatrix of glyphs takes
		// the font matrix into account. I assume this is done in the main
		// thread when calling view.update();
		font._project._updateVersion++;
		font.updateOTCommands()
			.addToFonts();
	};

	handlers.subset = function( set ) {
		var prevGlyphs = currSubset.map(function( glyph ) {
			return glyph.name;
		});
		font.subset = set;
		currSubset = font.subset;

		// search for glyphs *added* to the subset
		currSubset.filter(function( glyph ) {
			return prevGlyphs.indexOf( glyph.name ) === -1;

		// update those glyphs
		}).forEach(function( glyph ) {
			glyph.update( currValues );
			glyph.updateOTCommands();
		});

		// Recreate the correct font.ot.glyphs array, without touching the ot
		// commands
		font.updateOTCommands([]);
		font.addToFonts();
	};
}

// When the worker is loaded from URL, worker() needs to be called explicitely
if ( typeof global === 'undefined' && 'importScripts' in self ) {
	worker();
} else {
	module.exports = worker;
}

},{}]},{},[5])(5)
});


//# sourceMappingURL=prototypo-canvas.js.map