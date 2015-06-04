var prototypo = require('prototypo.js'),
	assign = require('lodash.assign'),
	shell = require('./worker');

var _ = { assign: assign },
	paper = prototypo.paper,
	URL = window.URL || window.webkitURL,
	workerSource;

function PrototypoCanvas( opts ) {
	paper.setup( opts.canvas );
	// enable pointerevents on the canvas
	opts.canvas.setAttribute('touch-action', 'none');

	this.opts = _.assign({
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
	this.font = prototypo.parametricFont( opts.fontSource );
	this.isMousedown = false;

	this.worker.onmessage = function(e) {console.log(e.data);
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

	}.bind(this);

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
}

PrototypoCanvas.prototype.wheelHandler = function( event ) {
	var bcr = this.canvas.getBoundingClientRect(),
		currPos = new paper.Point(
			event.clientX - bcr.left,
			event.clientY - bcr.top
		),
		viewPos = this.view.viewToProject( currPos ),
		// the expected delatY is 3, but it's different in MacOS
		factor = 1 + ( this.opts.zoomFactor * ( Math.abs(event.deltaY) / 3 ) ),
		newZoom =
			event.deltaY < 0 ?
				this.view.zoom * factor :
				event.deltaY > 0 ?
					this.view.zoom / factor :
					this.view.zoom,
		beta = this.view.zoom / newZoom,
		difference = viewPos.subtract( this.view.center ),
		newCenter = viewPos.subtract( difference.multiply(beta) );

	this.view.zoom = newZoom;
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
	this.view.zoom *= 1 + this.opts.zoomFactor;
};

PrototypoCanvas.prototype.zoomOut = function() {
	this.view.zoom /= 1 + this.opts.zoomFactor;
};

PrototypoCanvas.prototype.zoom = function( zoom ) {
	this.view.zoom = zoom;
};

PrototypoCanvas.prototype.displayGlyph = function( name ) {
	if ( this.currGlyph === this.font.glyphMap[name] ) {
		return;
	}

	// hide previous glyph
	if ( this.currGlyph ) {
		this.currGlyph.visible = false;
		this.currGlyph.components.forEach(function(component) {
			component.visible = false;
		});
	}

	this.currGlyph = this.font.glyphMap[name];

	// make sure the glyph is up-to-update
	if ( this.currValues ) {
		this.currGlyph.update( this.currValues );
	}

	// .. and show it
	this.currGlyph.visible = true;
	this.currGlyph.contours.forEach(function(contour) {
		contour.visible = !contour.skeleton;
	});
	this.currGlyph.components.forEach(function(component) {
		component.visible = true;
		component.contours.forEach(function(contour) {
			contour.visible = !contour.skeleton;
		});
	});

	this.view.update();
};

PrototypoCanvas.prototype.update = function( values ) {
	if ( this.currGlyph ) {
		this.currGlyph.update( values );
		this.view.update();
	}

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
		this.latestValues = values;
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

PrototypoCanvas.load = function( opts ) {
	opts = _.assign({
		fontUrl: 'font.json',
		prototypoUrl: 'prototypo.js'

	}, opts);

	return Promise.all([
		!opts.fontSource && opts.fontUrl,
		!workerSource && opts.prototypoUrl
	].map(function( url ) {
		return url && fetch( url );

	})).then(function( results ) {
		return Promise.all([
			results[0] && results[0].text(),
			results[1] && results[1].text()
		]);

	}).then(function( results ) {
		if ( results[0] ) {
			opts.fontSource = JSON.parse( results[0] );
		}
		if ( results[1] ) {
			opts.workerSource = workerSource =
				'(' +
				shell.toString().replace('\'prototypo.js\';', function() {
					return results[1];
				}) +
				// IIFE power
				')();' +
				// For some reason [object Object] is appended to the source
				// by Firefox when the worker is created, which causes the
				// script to throw without the following comment.
				'//';
		}

		// create the worker
		return new Promise(function( resolve ) {
			var worker = new Worker(
				URL.createObjectURL(
					new Blob([
						opts.workerSource,
						{ type: 'text/javascript' }
					])
				)
			);

			worker.onmessage = function(e) {
				// load the font
				if ( e.data.type === 'ready' ) {
					worker.postMessage({
						type: 'font',
						data: results[0]
					});

				// reuse the solvingOrders computed in the worker (this is a
				// fairly heavy operation that, better doing it only once,
				// asynchronously)
				} else if ( e.data.type === 'solvingOrders' ) {
					opts.worker = worker;
					// merge solvingOrders with the source
					Object.keys( e.data.data ).forEach(function(key) {
						if ( e.data.data[key] ) {
							opts.fontSource.glyphs[key].solvingOrder =
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
};

module.exports = PrototypoCanvas;
