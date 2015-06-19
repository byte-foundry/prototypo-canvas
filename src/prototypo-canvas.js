var prototypo = require('prototypo.js'),
	assign = require('./assignPolyfill'),
	// Grid = require('./grid'),
	_drawSelected = require('./drawNodes')._drawSelected,
	load = require('./load');

var _ = { assign: assign },
	paper = prototypo.paper;

// handles buffers coming from the worker
function fontBufferHandler(e) {
	if ( !(e.data instanceof ArrayBuffer) ) {
		this.isWorkerBusy = false;
		return;
	}

	this.latestBuffer = e.data;
	this.font.addToFonts( e.data );

	// process latest Values
	if ( this.latestValues ) {
		this.worker.postMessage({
			type: 'update',
			data: this.latestValues
		});

		delete this.latestValues;

	} else if ( this.latestSubset ) {
		this.worker.postMessage({
			type: 'subset',
			data: this.latestSubset
		});

		delete this.latestSubset;

	} else {
		this.isWorkerBusy = false;
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

			this.currGlyph.update( this.latestRafValues );
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
			( Math.abs( event.deltaY / event.deltaMode ? 3 : 40 ) ) ) / 20,
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
	if ( _glyph && this.currValues ) {
		this.currGlyph.update( this.currValues );
	}

	// .. and show it
	this.currGlyph.visible = true;

	if ( this._fill ) {
		this.currGlyph.fillColor = 'black';
		this.currGlyph.strokeWidth = 0;
	} else {
		this.currGlyph.fillColor = null;
		this.currGlyph.strokeWidth = 4;
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
	this.latestRafValues = values;

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

	this.currValues = values;
};

PrototypoCanvas.prototype.subset = function( string ) {
	if ( !this.isWorkerBusy ) {
		if ( this.currSubset !== undefined ) {
			// block updates
			this.isWorkerBusy = true;
		}

		this.worker.postMessage({
			type: 'subset',
			data: string
		});

	// if the worker is already busy, store the latest values so that we can
	// eventually update the font with the latest values
	} else {
		this.latestSubset = string;
	}

	this.currSubset = string;
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
