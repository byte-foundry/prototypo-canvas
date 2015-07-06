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

},{"./worker":5,"es6-object-assign":1}],4:[function(require,module,exports){
var prototypo = (typeof window !== "undefined" ? window.prototypo : typeof global !== "undefined" ? global.prototypo : null),
	assign = require('es6-object-assign').assign,
	// Grid = require('./grid'),
	_drawSelected = require('./drawNodes')._drawSelected,
	load = require('./load');

var _ = { assign: assign },
	paper = prototypo.paper;

// handles buffers coming from the worker
function fontBufferHandler(e) {
	// prevent the worker to be stuck with a busy flag if this method throws
	this.isWorkerBusy = false;

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
}

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

	this.worker.onmessage = fontBufferHandler.bind(this);

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
			if ( !this.isWorkerBusy ) {
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

	if ( !this.isWorkerBusy ) {
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

PrototypoCanvas.prototype.download = function() {
	if ( !this.latestBuffer ) {
		// the UI should wait for the first update to happen before allowing
		// the download button to be clicked
		return;
	}

	this.font.download( this.latestBuffer );
};

PrototypoCanvas.load = load;

paper.PaperScope.prototype.Path.prototype._drawSelected = _drawSelected;
_.assign( paper.settings, {
	handleSize: 6,
	handleColor: '#FF725E',
	nodeColor: '#00C4D6',
	drawCoords: false,
	handleFont: '12px monospace'
});

module.exports = PrototypoCanvas;

},{"./drawNodes":2,"./load":3,"es6-object-assign":1}],5:[function(require,module,exports){
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

},{}]},{},[4])(4)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXM2LW9iamVjdC1hc3NpZ24vc3JjL2luZGV4LmpzIiwic3JjL2RyYXdOb2Rlcy5qcyIsInNyYy9sb2FkLmpzIiwic3JjL3Byb3RvdHlwby1jYW52YXMuanMiLCJzcmMvd29ya2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5VUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQ29kZSByZWZhY3RvcmVkIGZyb20gTW96aWxsYSBEZXZlbG9wZXIgTmV0d29yazpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL09iamVjdC9hc3NpZ25cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGFzc2lnbih0YXJnZXQsIGZpcnN0U291cmNlKSB7XG4gIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCB8fCB0YXJnZXQgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY29udmVydCBmaXJzdCBhcmd1bWVudCB0byBvYmplY3QnKTtcbiAgfVxuXG4gIHZhciB0byA9IE9iamVjdCh0YXJnZXQpO1xuICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBuZXh0U291cmNlID0gYXJndW1lbnRzW2ldO1xuICAgIGlmIChuZXh0U291cmNlID09PSB1bmRlZmluZWQgfHwgbmV4dFNvdXJjZSA9PT0gbnVsbCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgdmFyIGtleXNBcnJheSA9IE9iamVjdC5rZXlzKE9iamVjdChuZXh0U291cmNlKSk7XG4gICAgZm9yICh2YXIgbmV4dEluZGV4ID0gMCwgbGVuID0ga2V5c0FycmF5Lmxlbmd0aDsgbmV4dEluZGV4IDwgbGVuOyBuZXh0SW5kZXgrKykge1xuICAgICAgdmFyIG5leHRLZXkgPSBrZXlzQXJyYXlbbmV4dEluZGV4XTtcbiAgICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihuZXh0U291cmNlLCBuZXh0S2V5KTtcbiAgICAgIGlmIChkZXNjICE9PSB1bmRlZmluZWQgJiYgZGVzYy5lbnVtZXJhYmxlKSB7XG4gICAgICAgIHRvW25leHRLZXldID0gbmV4dFNvdXJjZVtuZXh0S2V5XTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRvO1xufVxuXG5mdW5jdGlvbiBwb2x5ZmlsbCgpIHtcbiAgaWYgKCFPYmplY3QuYXNzaWduKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KE9iamVjdCwgJ2Fzc2lnbicsIHtcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogYXNzaWduXG4gICAgfSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFzc2lnbjogYXNzaWduLFxuICBwb2x5ZmlsbDogcG9seWZpbGxcbn07XG4iLCIvLyBQYXRoI19zZWxlY3RlZFNlZ21lbnRTdGF0ZSBpcyB0aGUgYWRkaXRpb24gb2YgYWxsIHNlZ21lbnQncyBzdGF0ZXMsIGFuZCBpc1xuLy8gY29tcGFyZWQgd2l0aCBTZWxlY3Rpb25TdGF0ZS5TRUdNRU5ULCB0aGUgY29tYmluYXRpb24gb2YgYWxsIFNlbGVjdGlvblN0YXRlc1xuLy8gdG8gc2VlIGlmIGFsbCBzZWdtZW50cyBhcmUgZnVsbHkgc2VsZWN0ZWQuXG52YXIgU2VsZWN0aW9uU3RhdGUgPSB7XG5cdFx0SEFORExFX0lOOiAxLFxuXHRcdEhBTkRMRV9PVVQ6IDIsXG5cdFx0UE9JTlQ6IDQsXG5cdFx0U0VHTUVOVDogNyAvLyBIQU5ETEVfSU4gfCBIQU5ETEVfT1VUIHwgUE9JTlRcblx0fSxcblx0d29ybGRDb29yZHMgPSBuZXcgRmxvYXQzMkFycmF5KDYpLFxuXHR2aWV3Q29vcmRzID0gbmV3IEZsb2F0MzJBcnJheSg2KTtcblxuZnVuY3Rpb24gZHJhd0hhbmRsZXMoY3R4LCBzZWdtZW50cywgbWF0cml4LCBzZXR0aW5ncywgem9vbSkge1xuXHR2YXIgc2l6ZSA9IHNldHRpbmdzLmhhbmRsZVNpemUsXG5cdFx0aGFsZiA9IHNpemUgLyAyLFxuXHRcdHBYLFxuXHRcdHBZO1xuXG5cdGZ1bmN0aW9uIGRyYXdIYW5kbGUoaikge1xuXHRcdHZhciBoWCA9IE1hdGgucm91bmQoIHZpZXdDb29yZHNbal0gKSxcblx0XHRcdGhZID0gTWF0aC5yb3VuZCggdmlld0Nvb3Jkc1tqICsgMV0gKSxcblx0XHRcdHRleHQ7XG5cblx0XHRpZiAoIHZpZXdDb29yZHNbMF0gIT09IHZpZXdDb29yZHNbal0gfHxcblx0XHRcdFx0dmlld0Nvb3Jkc1sxXSAhPT0gdmlld0Nvb3Jkc1tqICsgMV0pIHtcblxuXHRcdFx0Y3R4LmJlZ2luUGF0aCgpO1xuXHRcdFx0Y3R4LnN0cm9rZVN0eWxlID0gc2V0dGluZ3MuaGFuZGxlQ29sb3I7XG5cdFx0XHRjdHguZmlsbFN0eWxlID0gc2V0dGluZ3MuaGFuZGxlQ29sb3I7XG5cdFx0XHRjdHgubW92ZVRvKHBYLCBwWSk7XG5cdFx0XHRjdHgubGluZVRvKGhYLCBoWSk7XG5cdFx0XHRjdHguc3Ryb2tlKCk7XG5cdFx0XHRjdHguYmVnaW5QYXRoKCk7XG5cdFx0XHRjdHguYXJjKGhYLCBoWSwgaGFsZiwgMCwgTWF0aC5QSSAqIDIsIHRydWUpO1xuXHRcdFx0Y3R4LmZpbGwoKTtcblxuXHRcdFx0aWYgKCBzZXR0aW5ncy5kcmF3Q29vcmRzICkge1xuXHRcdFx0XHR0ZXh0ID0gTWF0aC5yb3VuZCggd29ybGRDb29yZHNbal0gKSArICcsJyArXG5cdFx0XHRcdFx0TWF0aC5yb3VuZCggd29ybGRDb29yZHNbaiArIDFdICk7XG5cblx0XHRcdFx0Ly8gdXNlIGFscGhhIHRvIHJlZHVjZSB0aGUgY2x1dHRlciBjYXVzZWQgYnkgYWxsIHRoaXMgdGV4dCB3aGVuXG5cdFx0XHRcdC8vIHpvb21pbmcgb3V0XG5cdFx0XHRcdGlmICggem9vbSA8IDEuNyApIHtcblx0XHRcdFx0XHRjdHguZ2xvYmFsQWxwaGEgPSAwLjI7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHpvb20gPCAzICkge1xuXHRcdFx0XHRcdGN0eC5nbG9iYWxBbHBoYSA9IDAuNDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjdHguZmlsbFRleHQoXG5cdFx0XHRcdFx0dGV4dCxcblx0XHRcdFx0XHRoWCAtIGhhbGYgLSAzIC0gY3R4Lm1lYXN1cmVUZXh0KHRleHQpLndpZHRoLFxuXHRcdFx0XHRcdC8vIFRoZSB0ZXh0IGlzIHNsaWdodGx5IGFib3ZlIHRoZSBtYXJrZXIuIFRoaXMgYXZvaWRzXG5cdFx0XHRcdFx0Ly8gb3ZlcmxhcHBpbmcgd2hlbiB0aGUgaGFuZGxlIHZlY3RvciBpcyBob3Jpem9udGFsLCB3aGljaFxuXHRcdFx0XHRcdC8vIGlzIHF1aXRlIGEgZnJlcXVlbnQgY2FzZS5cblx0XHRcdFx0XHRoWSAtIDJcblx0XHRcdFx0KTtcblx0XHRcdFx0aWYgKCB6b29tIDwgMyApIHtcblx0XHRcdFx0XHRjdHguZ2xvYmFsQWxwaGEgPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Zm9yICh2YXIgaSA9IDAsIGwgPSBzZWdtZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0XHR2YXIgc2VnbWVudCA9IHNlZ21lbnRzW2ldO1xuXHRcdHNlZ21lbnQuX3RyYW5zZm9ybUNvb3JkaW5hdGVzKG51bGwsIHdvcmxkQ29vcmRzLCBmYWxzZSk7XG5cdFx0c2VnbWVudC5fdHJhbnNmb3JtQ29vcmRpbmF0ZXMobWF0cml4LCB2aWV3Q29vcmRzLCBmYWxzZSk7XG5cdFx0dmFyIHN0YXRlID0gc2VnbWVudC5fc2VsZWN0aW9uU3RhdGU7XG5cdFx0cFggPSBNYXRoLnJvdW5kKCB2aWV3Q29vcmRzWzBdICk7XG5cdFx0cFkgPSBNYXRoLnJvdW5kKCB2aWV3Q29vcmRzWzFdICk7XG5cdFx0aWYgKCBzdGF0ZSAmIC8qIz0qLyBTZWxlY3Rpb25TdGF0ZS5IQU5ETEVfSU4gKSB7XG5cdFx0XHRkcmF3SGFuZGxlKDIpO1xuXHRcdH1cblx0XHRpZiAoIHN0YXRlICYgLyojPSovIFNlbGVjdGlvblN0YXRlLkhBTkRMRV9PVVQgKSB7XG5cdFx0XHRkcmF3SGFuZGxlKDQpO1xuXHRcdH1cblx0XHQvLyBEcmF3IGEgcmVjdGFuZ2xlIGF0IHNlZ21lbnQucG9pbnQ6XG5cdFx0Y3R4LmZpbGxTdHlsZSA9IHNldHRpbmdzLm5vZGVDb2xvcjtcblx0XHRjdHguZmlsbFJlY3QoIHBYIC0gaGFsZiwgcFkgLSBoYWxmLCBzaXplLCBzaXplICk7XG5cdFx0Y3R4LmZvbnQgPSBzZXR0aW5ncy5oYW5kbGVGb250O1xuXG5cdFx0aWYgKCBzZXR0aW5ncy5kcmF3Q29vcmRzICkge1xuXHRcdFx0aWYgKCB6b29tIDwgMS43ICkge1xuXHRcdFx0XHRjdHguZ2xvYmFsQWxwaGEgPSAwLjQ7XG5cdFx0XHR9XG5cdFx0XHRjdHguZmlsbFRleHQoXG5cdFx0XHRcdE1hdGgucm91bmQoIHdvcmxkQ29vcmRzWzBdICkgKyAnLCcgK1xuXHRcdFx0XHRNYXRoLnJvdW5kKCB3b3JsZENvb3Jkc1sxXSApLFxuXHRcdFx0XHRwWCArIGhhbGYgKyA1LFxuXHRcdFx0XHRwWSAtIDJcblx0XHRcdCk7XG5cdFx0XHRpZiAoIHpvb20gPCAxLjcgKSB7XG5cdFx0XHRcdGN0eC5nbG9iYWxBbHBoYSA9IDE7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIF9kcmF3U2VsZWN0ZWQoIGN0eCwgbWF0cml4ICkge1xuXHRjdHguYmVnaW5QYXRoKCk7XG5cdC8vIE5vdyBzdHJva2UgaXQgYW5kIGRyYXcgaXRzIGhhbmRsZXM6XG5cdGN0eC5zdHJva2UoKTtcblx0ZHJhd0hhbmRsZXMoXG5cdFx0Y3R4LFxuXHRcdHRoaXMuX3NlZ21lbnRzLFxuXHRcdG1hdHJpeCxcblx0XHR0aGlzLl9wcm9qZWN0Ll9zY29wZS5zZXR0aW5ncyxcblx0XHR0aGlzLl9wcm9qZWN0Ll92aWV3Ll96b29tXG5cdCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBfZHJhd1NlbGVjdGVkOiBfZHJhd1NlbGVjdGVkIH07XG4iLCJ2YXIgc2hlbGwgPSByZXF1aXJlKCcuL3dvcmtlcicpLFxuXHRhc3NpZ24gPSByZXF1aXJlKCdlczYtb2JqZWN0LWFzc2lnbicpLmFzc2lnbjtcblxudmFyIF8gPSB7IGFzc2lnbjogYXNzaWduIH0sXG5cdFVSTCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICggd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMICk7XG5cbmZ1bmN0aW9uIGxvYWQoIG9wdHMgKSB7XG5cdHZhciBQcm90b3R5cG9DYW52YXMgPSB0aGlzO1xuXG5cdG9wdHMgPSBfLmFzc2lnbih7XG5cdFx0Zm9udFVybDogJ2ZvbnQuanNvbicsXG5cdFx0cHJvdG90eXBvVXJsOiAncHJvdG90eXBvLmpzJ1xuXHR9LCBvcHRzKTtcblxuXHQvLyBpZiB0aGUgc291cmNlcyBhcmUgcHJvdmlkZWRcblx0cmV0dXJuIFByb21pc2UuYWxsKFtcblx0XHQhb3B0cy5mb250U291cmNlICYmIG9wdHMuZm9udFVybCxcblx0XHQhb3B0cy5wcm90b3R5cG9Tb3VyY2UgJiYgb3B0cy5wcm90b3R5cG9Vcmxcblx0XS5tYXAoZnVuY3Rpb24oIHVybCApIHtcblx0XHQvLyBvbmx5IGZldGNoIHRoZSByZXNvdXJjZXMgaWYgd2UgaGF2ZSBqdXN0IHRoZSB1cmwsIG5vdCB0aGUgc291cmNlXG5cdFx0cmV0dXJuIHVybCAmJiBmZXRjaCggdXJsICk7XG5cblx0fSkpLnRoZW4oZnVuY3Rpb24oIHJlc3VsdHMgKSB7XG5cdFx0Ly8gcGFyc2UgZmV0Y2hlZCByZXNvdXJjZXNcblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoW1xuXHRcdFx0cmVzdWx0c1swXSAmJiByZXN1bHRzWzBdLnRleHQoKSxcblx0XHRcdHJlc3VsdHNbMV0gJiYgcmVzdWx0c1sxXS50ZXh0KClcblx0XHRdKTtcblxuXHR9KS50aGVuKGZ1bmN0aW9uKCByZXN1bHRzICkge1xuXHRcdGlmICggcmVzdWx0c1swXSApIHtcblx0XHRcdG9wdHMuZm9udFNvdXJjZSA9IHJlc3VsdHNbMF07XG5cdFx0fVxuXHRcdGlmICggcmVzdWx0c1sxXSApIHtcblx0XHRcdG9wdHMucHJvdG90eXBvU291cmNlID0gcmVzdWx0c1sxXTtcblx0XHR9XG5cblx0XHRvcHRzLmZvbnRPYmogPSBKU09OLnBhcnNlKCBvcHRzLmZvbnRTb3VyY2UgKTtcblx0XHQvLyB0aGUgd29ya2VyIGNhbiBiZSBjcmVhdGVkIGJ5IHNwZWNpZnlpbmcgdGhlIFVSTCBvZiB0aGUgY29tcGxldGVcblx0XHQvLyBmaWxlIChkZXYgZW52aXJvbm1lbnQpLCBvciBieSBjcmVhdGluZ1xuXHRcdGlmICggb3B0cy53b3JrZXJVcmwgKSB7XG5cdFx0XHQvLyBUaGUgc2VhcmNoIGZyYWdtZW50IG9mIHdvcmtlclVybCBtdXN0IGluY2x1ZGUgcHJvdG90eXBvLmpzIFVSTFxuXHRcdFx0b3B0cy53b3JrZXJVcmwgKz1cblx0XHRcdFx0Jz9idW5kbGV1cmw9JyArIGVuY29kZVVSSUNvbXBvbmVudCggb3B0cy5wcm90b3R5cG9VcmwgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3B0cy53b3JrZXJVcmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKFxuXHRcdFx0XHRuZXcgQmxvYihbXG5cdFx0XHRcdFx0b3B0cy5wcm90b3R5cG9Tb3VyY2UgKyAnO1xcblxcbicgK1xuXHRcdFx0XHRcdC8vIElJRkUgcG93ZXJcblx0XHRcdFx0XHQnKCcgKyBzaGVsbC50b1N0cmluZygpICsgJykoKTsnICtcblx0XHRcdFx0XHQvLyBGb3Igc29tZSByZWFzb24gW29iamVjdCBPYmplY3RdIGlzIGFwcGVuZGVkIHRvIHRoZSBzb3VyY2Vcblx0XHRcdFx0XHQvLyBieSBGaXJlZm94IHdoZW4gdGhlIHdvcmtlciBpcyBjcmVhdGVkLCB3aGljaCBjYXVzZXMgdGhlXG5cdFx0XHRcdFx0Ly8gc2NyaXB0IHRvIHRocm93IHdpdGhvdXQgdGhlIGZvbGxvd2luZyBjb21tZW50LlxuXHRcdFx0XHRcdCcvLycsXG5cdFx0XHRcdFx0eyB0eXBlOiAndGV4dC9qYXZhc2NyaXB0JyB9XG5cdFx0XHRcdF0pXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8vIGNyZWF0ZSB0aGUgd29ya2VyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKCByZXNvbHZlICkge1xuXHRcdFx0dmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoIG9wdHMud29ya2VyVXJsICk7XG5cblx0XHRcdHdvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdC8vIGxvYWQgdGhlIGZvbnRcblx0XHRcdFx0aWYgKCBlLmRhdGEudHlwZSA9PT0gJ3JlYWR5JyApIHtcblx0XHRcdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XHRcdFx0dHlwZTogJ2ZvbnQnLFxuXHRcdFx0XHRcdFx0ZGF0YTogb3B0cy5mb250U291cmNlXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Ly8gcmV1c2UgdGhlIHNvbHZpbmdPcmRlcnMgY29tcHV0ZWQgaW4gdGhlIHdvcmtlciAodGhpcyBpcyBhXG5cdFx0XHRcdC8vIGZhaXJseSBoZWF2eSBvcGVyYXRpb24sIGJldHRlciBkb2luZyBpdCBvbmx5IG9uY2UsXG5cdFx0XHRcdC8vIGFzeW5jaHJvbm91c2x5KVxuXHRcdFx0XHR9IGVsc2UgaWYgKCBlLmRhdGEudHlwZSA9PT0gJ3NvbHZpbmdPcmRlcnMnICkge1xuXHRcdFx0XHRcdG9wdHMud29ya2VyID0gd29ya2VyO1xuXHRcdFx0XHRcdC8vIG1lcmdlIHNvbHZpbmdPcmRlcnMgd2l0aCB0aGUgc291cmNlXG5cdFx0XHRcdFx0T2JqZWN0LmtleXMoIGUuZGF0YS5kYXRhICkuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0XHRcdGlmICggZS5kYXRhLmRhdGFba2V5XSApIHtcblx0XHRcdFx0XHRcdFx0b3B0cy5mb250T2JqLmdseXBoc1trZXldLnNvbHZpbmdPcmRlciA9XG5cdFx0XHRcdFx0XHRcdFx0ZS5kYXRhLmRhdGFba2V5XTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdC8vIFdlJ3JlIGRvbmUgd2l0aCB0aGUgYXN5bmNocm9ub3VzIHN0dWZmIVxuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9KTtcblx0fSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gbmV3IFByb3RvdHlwb0NhbnZhcyggb3B0cyApO1xuXHR9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsb2FkO1xuIiwidmFyIHByb3RvdHlwbyA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LnByb3RvdHlwbyA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwucHJvdG90eXBvIDogbnVsbCksXG5cdGFzc2lnbiA9IHJlcXVpcmUoJ2VzNi1vYmplY3QtYXNzaWduJykuYXNzaWduLFxuXHQvLyBHcmlkID0gcmVxdWlyZSgnLi9ncmlkJyksXG5cdF9kcmF3U2VsZWN0ZWQgPSByZXF1aXJlKCcuL2RyYXdOb2RlcycpLl9kcmF3U2VsZWN0ZWQsXG5cdGxvYWQgPSByZXF1aXJlKCcuL2xvYWQnKTtcblxudmFyIF8gPSB7IGFzc2lnbjogYXNzaWduIH0sXG5cdHBhcGVyID0gcHJvdG90eXBvLnBhcGVyO1xuXG4vLyBoYW5kbGVzIGJ1ZmZlcnMgY29taW5nIGZyb20gdGhlIHdvcmtlclxuZnVuY3Rpb24gZm9udEJ1ZmZlckhhbmRsZXIoZSkge1xuXHQvLyBwcmV2ZW50IHRoZSB3b3JrZXIgdG8gYmUgc3R1Y2sgd2l0aCBhIGJ1c3kgZmxhZyBpZiB0aGlzIG1ldGhvZCB0aHJvd3Ncblx0dGhpcy5pc1dvcmtlckJ1c3kgPSBmYWxzZTtcblxuXHRpZiAoICEoZS5kYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHRoaXMubGF0ZXN0QnVmZmVyID0gZS5kYXRhO1xuXHR0aGlzLmZvbnQuYWRkVG9Gb250cyggZS5kYXRhICk7XG5cblx0Ly8gcHJvY2VzcyBsYXRlc3QgVmFsdWVzXG5cdGlmICggdGhpcy5sYXRlc3RXb3JrZXJWYWx1ZXMgKSB7XG5cdFx0dGhpcy5pc1dvcmtlckJ1c3kgPSB0cnVlO1xuXHRcdHRoaXMud29ya2VyLnBvc3RNZXNzYWdlKHtcblx0XHRcdHR5cGU6ICd1cGRhdGUnLFxuXHRcdFx0ZGF0YTogdGhpcy5sYXRlc3RXb3JrZXJWYWx1ZXNcblx0XHR9KTtcblxuXHRcdGRlbGV0ZSB0aGlzLmxhdGVzdFdvcmtlclZhbHVlcztcblxuXHR9IGVsc2UgaWYgKCB0aGlzLmxhdGVzdFN1YnNldCApIHtcblx0XHR0aGlzLmlzV29ya2VyQnVzeSA9IHRydWU7XG5cdFx0dGhpcy53b3JrZXIucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0dHlwZTogJ3N1YnNldCcsXG5cdFx0XHRkYXRhOiB0aGlzLmxhdGVzdFN1YnNldFxuXHRcdH0pO1xuXG5cdFx0ZGVsZXRlIHRoaXMubGF0ZXN0U3Vic2V0O1xuXHR9XG59XG5cbi8vIGNvbnN0cnVjdG9yXG5mdW5jdGlvbiBQcm90b3R5cG9DYW52YXMoIG9wdHMgKSB7XG5cdHBhcGVyLnNldHVwKCBvcHRzLmNhbnZhcyApO1xuXHQvLyBlbmFibGUgcG9pbnRlcmV2ZW50cyBvbiB0aGUgY2FudmFzXG5cdG9wdHMuY2FudmFzLnNldEF0dHJpYnV0ZSgndG91Y2gtYWN0aW9uJywgJ25vbmUnKTtcblxuXHR0aGlzLm9wdHMgPSBfLmFzc2lnbih7XG5cdFx0ZmlsbDogdHJ1ZSxcblx0XHRzaG9Ob2RlczogZmFsc2UsXG5cdFx0em9vbUZhY3RvcjogMC4wNSxcblx0XHRqUXVlcnlMaXN0ZW5lcnM6IHRydWVcblx0fSwgb3B0cyk7XG5cblx0dGhpcy5jYW52YXMgPSBvcHRzLmNhbnZhcztcblx0dGhpcy52aWV3ID0gcGFwZXIudmlldztcblx0dGhpcy52aWV3LmNlbnRlciA9IFsgMCwgMCBdO1xuXHR0aGlzLnByb2plY3QgPSBwYXBlci5wcm9qZWN0O1xuXHR0aGlzLnByb2plY3QuYWN0aXZlTGF5ZXIuYXBwbHlNYXRyaXggPSBmYWxzZTtcblx0dGhpcy5wcm9qZWN0LmFjdGl2ZUxheWVyLnNjYWxlKCAxLCAtMSApO1xuXHR0aGlzLndvcmtlciA9IG9wdHMud29ya2VyO1xuXHR0aGlzLl9maWxsID0gdGhpcy5vcHRzLmZpbGw7XG5cdHRoaXMuX3Nob3dOb2RlcyA9IHRoaXMub3B0cy5zaG93Tm9kZXM7XG5cblx0Ly8gdGhpcy5ncmlkID0gbmV3IEdyaWQoIHBhcGVyICk7XG5cblx0dGhpcy5mb250ID0gcHJvdG90eXBvLnBhcmFtZXRyaWNGb250KCBvcHRzLmZvbnRPYmogKTtcblx0dGhpcy5pc01vdXNlZG93biA9IGZhbHNlO1xuXG5cdHRoaXMud29ya2VyLm9ubWVzc2FnZSA9IGZvbnRCdWZmZXJIYW5kbGVyLmJpbmQodGhpcyk7XG5cblx0Ly8galF1ZXJ5IGlzIGFuIG9wdGlvbmFsIGRlcGVuZGVuY3lcblx0aWYgKCAoICdqUXVlcnknIGluIHdpbmRvdyApICYmIHRoaXMub3B0cy5qUXVlcnlMaXN0ZW5lcnMgKSB7XG5cdFx0dmFyICQgPSB3aW5kb3cualF1ZXJ5LFxuXHRcdFx0dHlwZSA9ICggJ1BvaW50ZXJFdmVudHNQb2x5ZmlsbCcgaW4gd2luZG93ICkgfHxcblx0XHRcdFx0KCAnUG9pbnRlckV2ZW50JyBpbiB3aW5kb3cgKSA/ICdwb2ludGVyJyA6ICdtb3VzZSc7XG5cblx0XHQkKG9wdHMuY2FudmFzKS5vbiggJ3doZWVsJywgdGhpcy53aGVlbEhhbmRsZXIuYmluZCh0aGlzKSApO1xuXG5cdFx0JChvcHRzLmNhbnZhcykub24oIHR5cGUgKyAnbW92ZScsIHRoaXMubW92ZUhhbmRsZXIuYmluZCh0aGlzKSApO1xuXG5cdFx0JChvcHRzLmNhbnZhcykub24oIHR5cGUgKyAnZG93bicsIHRoaXMuZG93bkhhbmRsZXIuYmluZCh0aGlzKSApO1xuXG5cdFx0JChkb2N1bWVudCkub24oIHR5cGUgKyAndXAnLCB0aGlzLnVwSGFuZGxlci5iaW5kKHRoaXMpICk7XG5cdH1cblxuXHR2YXIgcmFmID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuXHRcdFx0d2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSxcblx0XHR1cGRhdGVMb29wID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyYWYodXBkYXRlTG9vcCk7XG5cblx0XHRcdGlmICggIXRoaXMubGF0ZXN0UmFmVmFsdWVzIHx8ICF0aGlzLmN1cnJHbHlwaCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmZvbnQudXBkYXRlKCB0aGlzLmxhdGVzdFJhZlZhbHVlcywgWyB0aGlzLmN1cnJHbHlwaCBdICk7XG5cblx0XHRcdHRoaXMudmlldy51cGRhdGUoKTtcblx0XHRcdGRlbGV0ZSB0aGlzLmxhdGVzdFJhZlZhbHVlcztcblxuXHRcdH0uYmluZCh0aGlzKTtcblx0dXBkYXRlTG9vcCgpO1xufVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyggUHJvdG90eXBvQ2FudmFzLnByb3RvdHlwZSwge1xuXHR6b29tOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnZpZXcuem9vbTtcblx0XHR9LFxuXHRcdHNldDogZnVuY3Rpb24oIHpvb20gKSB7XG5cdFx0XHR0aGlzLnZpZXcuem9vbSA9IHpvb207XG5cdFx0XHQvLyB0aGlzLmdyaWQuem9vbSA9IHpvb207XG5cdFx0fVxuXHR9LFxuXHRmaWxsOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9maWxsO1xuXHRcdH0sXG5cdFx0c2V0OiBmdW5jdGlvbiggYm9vbCApIHtcblx0XHRcdHRoaXMuX2ZpbGwgPSBib29sO1xuXHRcdFx0dGhpcy5kaXNwbGF5R2x5cGgoKTtcblx0XHR9XG5cdH0sXG5cdHNob3dOb2Rlczoge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2hvd05vZGVzO1xuXHRcdH0sXG5cdFx0c2V0OiBmdW5jdGlvbiggYm9vbCApIHtcblx0XHRcdHRoaXMuX3Nob3dOb2RlcyA9IGJvb2w7XG5cdFx0XHR0aGlzLmRpc3BsYXlHbHlwaCgpO1xuXHRcdH1cblx0fSxcblx0c2hvd0Nvb3Jkczoge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gcGFwZXIuc2V0dGluZ3MuZHJhd0Nvb3Jkcztcblx0XHR9LFxuXHRcdHNldDogZnVuY3Rpb24oIGJvb2wgKSB7XG5cdFx0XHRwYXBlci5zZXR0aW5ncy5kcmF3Q29vcmRzID0gYm9vbDtcblx0XHRcdHRoaXMuZGlzcGxheUdseXBoKCk7XG5cdFx0fVxuXHR9LFxuXHRzdWJzZXQ6IHtcblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZm9udC5zdWJzZXQ7XG5cdFx0fSxcblx0XHRzZXQ6IGZ1bmN0aW9uKCBzZXQgKSB7XG5cdFx0XHRpZiAoICF0aGlzLmlzV29ya2VyQnVzeSApIHtcblx0XHRcdFx0aWYgKCB0aGlzLmN1cnJTdWJzZXQgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHQvLyBibG9jayB1cGRhdGVzXG5cdFx0XHRcdFx0dGhpcy5pc1dvcmtlckJ1c3kgPSB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy53b3JrZXIucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XHRcdHR5cGU6ICdzdWJzZXQnLFxuXHRcdFx0XHRcdGRhdGE6IHNldFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0Ly8gaWYgdGhlIHdvcmtlciBpcyBhbHJlYWR5IGJ1c3ksIHN0b3JlIHRoZSBsYXRlc3QgdmFsdWVzIHNvIHRoYXQgd2Vcblx0XHRcdC8vIGNhbiBldmVudHVhbGx5IHVwZGF0ZSB0aGUgZm9udCB3aXRoIHRoZSBsYXRlc3QgdmFsdWVzXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxhdGVzdFN1YnNldCA9IHNldDtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5mb250LnN1YnNldCA9IHRoaXMuY3VyclN1YnNldCA9IHNldDtcblx0XHR9XG5cdH1cbn0pO1xuXG5Qcm90b3R5cG9DYW52YXMucHJvdG90eXBlLndoZWVsSGFuZGxlciA9IGZ1bmN0aW9uKCBldmVudCApIHtcblx0dmFyIGJjciA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuXHRcdGN1cnJQb3MgPSBuZXcgcGFwZXIuUG9pbnQoXG5cdFx0XHRldmVudC5jbGllbnRYIC0gYmNyLmxlZnQsXG5cdFx0XHRldmVudC5jbGllbnRZIC0gYmNyLnRvcFxuXHRcdCksXG5cdFx0dmlld1BvcyA9IHRoaXMudmlldy52aWV3VG9Qcm9qZWN0KCBjdXJyUG9zICksXG5cdFx0Ly8gbm9ybWFsaXplIHRoZSBkZWx0YVkgdmFsdWUuIEV4cGVjdGVkIHZhbHVlcyBhcmUgfjQwIHBpeGVscyBvciAzIGxpbmVzXG5cdFx0ZmFjdG9yID0gMSArICggdGhpcy5vcHRzLnpvb21GYWN0b3IgKlxuXHRcdFx0KCBNYXRoLmFicyggZXZlbnQuZGVsdGFZIC8gZXZlbnQuZGVsdGFNb2RlID8gMyA6IDQwICogMjAgKSApICksXG5cdFx0bmV3Wm9vbSA9XG5cdFx0XHRldmVudC5kZWx0YVkgPCAwID9cblx0XHRcdFx0dGhpcy52aWV3Lnpvb20gKiBmYWN0b3IgOlxuXHRcdFx0XHRldmVudC5kZWx0YVkgPiAwID9cblx0XHRcdFx0XHR0aGlzLnZpZXcuem9vbSAvIGZhY3RvciA6XG5cdFx0XHRcdFx0dGhpcy52aWV3Lnpvb20sXG5cdFx0YmV0YSA9IHRoaXMudmlldy56b29tIC8gbmV3Wm9vbSxcblx0XHRkaWZmZXJlbmNlID0gdmlld1Bvcy5zdWJ0cmFjdCggdGhpcy52aWV3LmNlbnRlciApLFxuXHRcdG5ld0NlbnRlciA9IHZpZXdQb3Muc3VidHJhY3QoIGRpZmZlcmVuY2UubXVsdGlwbHkoYmV0YSkgKTtcblxuXHR0aGlzLnpvb20gPSBuZXdab29tO1xuXHR0aGlzLnZpZXcuY2VudGVyID0gbmV3Q2VudGVyO1xuXG5cdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59O1xuXG5Qcm90b3R5cG9DYW52YXMucHJvdG90eXBlLm1vdmVIYW5kbGVyID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0aWYgKCAhdGhpcy5pc01vdXNlZG93biApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHR2YXIgY3VyclBvcyA9IG5ldyBwYXBlci5Qb2ludCggZXZlbnQuY2xpZW50WCwgZXZlbnQuY2xpZW50WSApLFxuXHRcdGRlbHRhID0gY3VyclBvcy5zdWJ0cmFjdCggdGhpcy5wcmV2UG9zICk7XG5cblx0dGhpcy5wcmV2UG9zID0gY3VyclBvcztcblxuXHR0aGlzLnZpZXcuY2VudGVyID0gdGhpcy52aWV3LmNlbnRlci5zdWJ0cmFjdChcblx0XHRcdGRlbHRhLmRpdmlkZSggdGhpcy52aWV3Lnpvb20gKSApO1xufTtcblxuUHJvdG90eXBvQ2FudmFzLnByb3RvdHlwZS5kb3duSGFuZGxlciA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdGlmIChldmVudC5idXR0b24gJiYgZXZlbnQuYnV0dG9uICE9PSAwKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0dGhpcy5pc01vdXNlZG93biA9IHRydWU7XG5cdHRoaXMucHJldlBvcyA9IG5ldyBwYXBlci5Qb2ludCggZXZlbnQuY2xpZW50WCwgZXZlbnQuY2xpZW50WSApO1xufTtcblxuUHJvdG90eXBvQ2FudmFzLnByb3RvdHlwZS51cEhhbmRsZXIgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pc01vdXNlZG93biA9IGZhbHNlO1xufTtcblxuUHJvdG90eXBvQ2FudmFzLnByb3RvdHlwZS56b29tSW4gPSBmdW5jdGlvbigpIHtcblx0dGhpcy56b29tID0gdGhpcy52aWV3Lnpvb20gKiAxICsgdGhpcy5vcHRzLnpvb21GYWN0b3I7XG59O1xuXG5Qcm90b3R5cG9DYW52YXMucHJvdG90eXBlLnpvb21PdXQgPSBmdW5jdGlvbigpIHtcblx0dGhpcy56b29tID0gdGhpcy52aWV3Lnpvb20gLyAxICsgdGhpcy5vcHRzLnpvb21GYWN0b3I7XG59O1xuXG5Qcm90b3R5cG9DYW52YXMucHJvdG90eXBlLmRpc3BsYXlHbHlwaCA9IGZ1bmN0aW9uKCBfZ2x5cGggKSB7XG5cdHZhciBnbHlwaCA9XG5cdFx0XHQvLyBubyBnbHlwaCBtZWFucyB3ZSdyZSBzd2l0Y2hpbmcgZmlsbCBtb2RlIGZvciB0aGUgY3VycmVudCBnbHlwaFxuXHRcdFx0X2dseXBoID09PSB1bmRlZmluZWQgPyB0aGlzLmN1cnJHbHlwaCA6XG5cdFx0XHQvLyBhY2NlcHQgZ2x5cGggbmFtZSBhbmQgZ2x5cGggb2JqZWN0XG5cdFx0XHR0eXBlb2YgX2dseXBoID09PSAnc3RyaW5nJyA/IHRoaXMuZm9udC5nbHlwaE1hcFtfZ2x5cGhdIDpcblx0XHRcdF9nbHlwaDtcblxuXHRpZiAoIGdseXBoID09PSB1bmRlZmluZWQgKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Ly8gaGlkZSBwcmV2aW91cyBnbHlwaFxuXHRpZiAoIHRoaXMuY3VyckdseXBoICYmIHRoaXMuY3VyckdseXBoICE9PSBnbHlwaCApIHtcblx0XHR0aGlzLmN1cnJHbHlwaC52aXNpYmxlID0gZmFsc2U7XG5cdFx0dGhpcy5jdXJyR2x5cGguY29tcG9uZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGNvbXBvbmVudCkge1xuXHRcdFx0Y29tcG9uZW50LnZpc2libGUgPSBmYWxzZTtcblx0XHR9LCB0aGlzKTtcblx0fVxuXG5cdHRoaXMuY3VyckdseXBoID0gZ2x5cGg7XG5cblx0Ly8gbWFrZSBzdXJlIHRoZSBnbHlwaCBpcyB1cC10by11cGRhdGVcblx0aWYgKCBfZ2x5cGggJiYgdGhpcy5sYXRlc3RWYWx1ZXMgKSB7XG5cdFx0dGhpcy5jdXJyR2x5cGgudXBkYXRlKCB0aGlzLmxhdGVzdFZhbHVlcyApO1xuXHR9XG5cblx0Ly8gLi4gYW5kIHNob3cgaXRcblx0dGhpcy5jdXJyR2x5cGgudmlzaWJsZSA9IHRydWU7XG5cblx0aWYgKCB0aGlzLl9maWxsICkge1xuXHRcdHRoaXMuY3VyckdseXBoLmZpbGxDb2xvciA9ICcjMzMzMzMzJztcblx0XHR0aGlzLmN1cnJHbHlwaC5zdHJva2VXaWR0aCA9IDA7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5jdXJyR2x5cGguZmlsbENvbG9yID0gbnVsbDtcblx0XHR0aGlzLmN1cnJHbHlwaC5zdHJva2VXaWR0aCA9IDE7XG5cdH1cblxuXHR0aGlzLmN1cnJHbHlwaC5jb250b3Vycy5mb3JFYWNoKGZ1bmN0aW9uKGNvbnRvdXIpIHtcblx0XHRjb250b3VyLmZ1bGx5U2VsZWN0ZWQgPSB0aGlzLl9zaG93Tm9kZXMgJiYgIWNvbnRvdXIuc2tlbGV0b247XG5cdH0sIHRoaXMpO1xuXG5cdHRoaXMuY3VyckdseXBoLmNvbXBvbmVudHMuZm9yRWFjaChmdW5jdGlvbihjb21wb25lbnQpIHtcblx0XHRjb21wb25lbnQudmlzaWJsZSA9IHRydWU7XG5cdFx0Y29tcG9uZW50LmNvbnRvdXJzLmZvckVhY2goZnVuY3Rpb24oY29udG91cikge1xuXHRcdFx0Y29udG91ci5mdWxseVNlbGVjdGVkID0gdGhpcy5fc2hvd05vZGVzICYmICFjb250b3VyLnNrZWxldG9uO1xuXHRcdH0sIHRoaXMpO1xuXHR9LCB0aGlzKTtcblxuXHR0aGlzLnZpZXcuX3Byb2plY3QuX25lZWRzVXBkYXRlID0gdHJ1ZTtcblx0dGhpcy52aWV3LnVwZGF0ZSgpO1xufTtcblxuUHJvdG90eXBvQ2FudmFzLnByb3RvdHlwZS5kaXNwbGF5Q2hhciA9IGZ1bmN0aW9uKCBjb2RlICkge1xuXHR0aGlzLmRpc3BsYXlHbHlwaCggdHlwZW9mIGNvZGUgPT09ICdzdHJpbmcnID9cblx0XHR0aGlzLmZvbnQuY2hhck1hcFsgY29kZS5jaGFyQ29kZUF0KDApIF0gOiBjb2RlXG5cdCk7XG59O1xuXG5Qcm90b3R5cG9DYW52YXMucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCB2YWx1ZXMgKSB7XG5cdC8vIGxhdGVzdFZhbHVlcyBhcmUgdXNlZCBpbiBkaXNwbGF5R2x5cGhcblx0Ly8gbGF0ZXN0V29ya2VyVmFsdWVzIGlzIHVzZWQgYW5kIGRpc3Bvc2VkIGJ5IHRoZSBmb250QnVmZmVySGFuZGxlclxuXHQvLyBsYXRlc3RSYWZWYWx1ZXMgaXMgdXNlZCBhbmQgZGlzcG9zZWQgYnkgdGhlIHJhZiBsb29wXG5cdC8vIHNvIHdlIG5lZWQgYWxsIHRocmVlIVxuXHR0aGlzLmxhdGVzdFZhbHVlcyA9IHRoaXMubGF0ZXN0UmFmVmFsdWVzID0gdmFsdWVzO1xuXG5cdGlmICggIXRoaXMuaXNXb3JrZXJCdXN5ICkge1xuXHRcdC8vIGJsb2NrIHVwZGF0ZXNcblx0XHR0aGlzLmlzV29ya2VyQnVzeSA9IHRydWU7XG5cblx0XHR0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7XG5cdFx0XHR0eXBlOiAndXBkYXRlJyxcblx0XHRcdGRhdGE6IHZhbHVlc1xuXHRcdH0pO1xuXG5cdC8vIGlmIHRoZSB3b3JrZXIgaXMgYWxyZWFkeSBidXN5LCBzdG9yZSB0aGUgbGF0ZXN0IHZhbHVlcyBzbyB0aGF0IHdlIGNhblxuXHQvLyBldmVudHVhbGx5IHVwZGF0ZSB0aGUgZm9udCB3aXRoIHRoZSBsYXRlc3QgdmFsdWVzXG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5sYXRlc3RXb3JrZXJWYWx1ZXMgPSB2YWx1ZXM7XG5cdH1cbn07XG5cblByb3RvdHlwb0NhbnZhcy5wcm90b3R5cGUuZG93bmxvYWQgPSBmdW5jdGlvbigpIHtcblx0aWYgKCAhdGhpcy5sYXRlc3RCdWZmZXIgKSB7XG5cdFx0Ly8gdGhlIFVJIHNob3VsZCB3YWl0IGZvciB0aGUgZmlyc3QgdXBkYXRlIHRvIGhhcHBlbiBiZWZvcmUgYWxsb3dpbmdcblx0XHQvLyB0aGUgZG93bmxvYWQgYnV0dG9uIHRvIGJlIGNsaWNrZWRcblx0XHRyZXR1cm47XG5cdH1cblxuXHR0aGlzLmZvbnQuZG93bmxvYWQoIHRoaXMubGF0ZXN0QnVmZmVyICk7XG59O1xuXG5Qcm90b3R5cG9DYW52YXMubG9hZCA9IGxvYWQ7XG5cbnBhcGVyLlBhcGVyU2NvcGUucHJvdG90eXBlLlBhdGgucHJvdG90eXBlLl9kcmF3U2VsZWN0ZWQgPSBfZHJhd1NlbGVjdGVkO1xuXy5hc3NpZ24oIHBhcGVyLnNldHRpbmdzLCB7XG5cdGhhbmRsZVNpemU6IDYsXG5cdGhhbmRsZUNvbG9yOiAnI0ZGNzI1RScsXG5cdG5vZGVDb2xvcjogJyMwMEM0RDYnLFxuXHRkcmF3Q29vcmRzOiBmYWxzZSxcblx0aGFuZGxlRm9udDogJzEycHggbW9ub3NwYWNlJ1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUHJvdG90eXBvQ2FudmFzO1xuIiwiaWYgKCB0eXBlb2YgZ2xvYmFsID09PSAndW5kZWZpbmVkJyAmJiAnaW1wb3J0U2NyaXB0cycgaW4gc2VsZiApIHtcblx0Ly8gV2hlbiB0aGUgd29ya2VyIGlzIGxvYWRlZCBieSBVUkwsIHRoZSBzZWFyY2ggZnJhZ21lbnQgbXVzdCBpbmNsdWRlXG5cdC8vIHRoZSBVUkwgb2YgcHJvdG90eXBvLmpzXG5cdHNlbGYuaW1wb3J0U2NyaXB0cyggZGVjb2RlVVJJQ29tcG9uZW50KFxuXHRcdHNlbGYubG9jYXRpb24uc2VhcmNoLnJlcGxhY2UoLyhcXD98JilidW5kbGV1cmw9KC4qPykoJnwkKS8sICckMicpXG5cdCkgKTtcbn1cblxuZnVuY3Rpb24gd29ya2VyKCkge1xuXHR2YXIgZm9udCxcblx0XHRoYW5kbGVycyA9IHt9LFxuXHRcdGN1cnJWYWx1ZXMsXG5cdFx0Y3VyclN1YnNldCA9IFtdO1xuXG5cdHNlbGYucG9zdE1lc3NhZ2UoeyB0eXBlOiAncmVhZHknIH0pO1xuXG5cdHByb3RvdHlwby5wYXBlci5zZXR1cCh7XG5cdFx0d2lkdGg6IDEwMjQsXG5cdFx0aGVpZ2h0OiAxMDI0XG5cdH0pO1xuXG5cdC8vIE92ZXJ3cml0ZSBhZGRUb0ZvbnRzIHRvIHNlbmQgdGhlIGJ1ZmZlciBvdmVyIHRvIHRoZSBVSVxuXHRwcm90b3R5cG8ucGFwZXIuRm9udC5wcm90b3R5cGUuYWRkVG9Gb250cyA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBidWZmZXIgPSB0aGlzLm90LnRvQnVmZmVyKCk7XG5cdFx0c2VsZi5wb3N0TWVzc2FnZSggYnVmZmVyLCBbIGJ1ZmZlciBdICk7XG5cdH07XG5cblx0Ly8gbWluaSByb3V0ZXJcblx0c2VsZi5vbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG5cdFx0aGFuZGxlcnNbIGUuZGF0YS50eXBlIF0oIGUuZGF0YS5kYXRhICk7XG5cdH07XG5cblx0aGFuZGxlcnMuZm9udCA9IGZ1bmN0aW9uKCBmb250U291cmNlICkge1xuXHRcdGZvbnQgPSBwcm90b3R5cG8ucGFyYW1ldHJpY0ZvbnQoIEpTT04ucGFyc2UoIGZvbnRTb3VyY2UgKSApO1xuXHRcdHZhciBzb2x2aW5nT3JkZXJzID0ge307XG5cdFx0T2JqZWN0LmtleXMoIGZvbnQuZ2x5cGhNYXAgKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0c29sdmluZ09yZGVyc1trZXldID0gZm9udC5nbHlwaE1hcFtrZXldLnNvbHZpbmdPcmRlcjtcblx0XHR9KTtcblxuXHRcdHNlbGYucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0dHlwZTogJ3NvbHZpbmdPcmRlcnMnLFxuXHRcdFx0ZGF0YTogc29sdmluZ09yZGVyc1xuXHRcdH0pO1xuXHR9O1xuXG5cdGhhbmRsZXJzLnVwZGF0ZSA9IGZ1bmN0aW9uKCBwYXJhbXMgKSB7XG5cdFx0Y3VyclZhbHVlcyA9IHBhcmFtcztcblx0XHQvLyBpbnZhbGlkYXRlIHRoZSBwcmV2aW91cyBzdWJzZXRcblx0XHRjdXJyU3Vic2V0ID0gW107XG5cblx0XHRmb250LnVwZGF0ZSggcGFyYW1zICk7XG5cdFx0Ly8gdGhlIGZvbGxvd2luZyBpcyByZXF1aXJlZCBzbyB0aGF0IHRoZSBnbG9iYWxNYXRyaXggb2YgZ2x5cGhzIHRha2VzXG5cdFx0Ly8gdGhlIGZvbnQgbWF0cml4IGludG8gYWNjb3VudC4gSSBhc3N1bWUgdGhpcyBpcyBkb25lIGluIHRoZSBtYWluXG5cdFx0Ly8gdGhyZWFkIHdoZW4gY2FsbGluZyB2aWV3LnVwZGF0ZSgpO1xuXHRcdGZvbnQuX3Byb2plY3QuX3VwZGF0ZVZlcnNpb24rKztcblx0XHRmb250LnVwZGF0ZU9UQ29tbWFuZHMoKVxuXHRcdFx0LmFkZFRvRm9udHMoKTtcblx0fTtcblxuXHRoYW5kbGVycy5zdWJzZXQgPSBmdW5jdGlvbiggc2V0ICkge1xuXHRcdHZhciBwcmV2R2x5cGhzID0gY3VyclN1YnNldC5tYXAoZnVuY3Rpb24oIGdseXBoICkge1xuXHRcdFx0cmV0dXJuIGdseXBoLm5hbWU7XG5cdFx0fSk7XG5cdFx0Zm9udC5zdWJzZXQgPSBzZXQ7XG5cdFx0Y3VyclN1YnNldCA9IGZvbnQuc3Vic2V0O1xuXG5cdFx0Ly8gc2VhcmNoIGZvciBnbHlwaHMgKmFkZGVkKiB0byB0aGUgc3Vic2V0XG5cdFx0Y3VyclN1YnNldC5maWx0ZXIoZnVuY3Rpb24oIGdseXBoICkge1xuXHRcdFx0cmV0dXJuIHByZXZHbHlwaHMuaW5kZXhPZiggZ2x5cGgubmFtZSApID09PSAtMTtcblxuXHRcdC8vIHVwZGF0ZSB0aG9zZSBnbHlwaHNcblx0XHR9KS5mb3JFYWNoKGZ1bmN0aW9uKCBnbHlwaCApIHtcblx0XHRcdGdseXBoLnVwZGF0ZSggY3VyclZhbHVlcyApO1xuXHRcdFx0Z2x5cGgudXBkYXRlT1RDb21tYW5kcygpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gUmVjcmVhdGUgdGhlIGNvcnJlY3QgZm9udC5vdC5nbHlwaHMgYXJyYXksIHdpdGhvdXQgdG91Y2hpbmcgdGhlIG90XG5cdFx0Ly8gY29tbWFuZHNcblx0XHRmb250LnVwZGF0ZU9UQ29tbWFuZHMoW10pO1xuXHRcdGZvbnQuYWRkVG9Gb250cygpO1xuXHR9O1xufVxuXG4vLyBXaGVuIHRoZSB3b3JrZXIgaXMgbG9hZGVkIGZyb20gVVJMLCB3b3JrZXIoKSBuZWVkcyB0byBiZSBjYWxsZWQgZXhwbGljaXRlbHlcbmlmICggdHlwZW9mIGdsb2JhbCA9PT0gJ3VuZGVmaW5lZCcgJiYgJ2ltcG9ydFNjcmlwdHMnIGluIHNlbGYgKSB7XG5cdHdvcmtlcigpO1xufSBlbHNlIHtcblx0bW9kdWxlLmV4cG9ydHMgPSB3b3JrZXI7XG59XG4iXX0=
