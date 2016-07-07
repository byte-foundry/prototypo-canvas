var prototypo		= require('prototypo.js');
var assign			= require('es6-object-assign').assign;
var EventEmitter	= require('wolfy87-eventemitter');
var glyph			= require('./utils/glyph');
var mouseHandlers	= require('./utils/mouseHandlers');
var init			= require('./utils/init');
var loadFont		= require('./utils/loadFont');

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
				fetch('http://localhost:3000/' +
					name.family + '/' +
					name.style + '/' +
					user +
					(name.template ? '/' + name.template : ''), {
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
