var prototypo		= require('prototypo.js');
var assign			= require('es6-object-assign').assign;
var cloneDeep		= require('lodash/cloneDeep');
var EventEmitter	= require('wolfy87-eventemitter');
var glyph			= require('./utils/glyph');
var mouseHandlers	= require('./utils/mouseHandlers');
var init			= require('./utils/init');
var loadFont		= require('./utils/loadFont');
var {drawUIEditor, createUIEditor} = require('./utils/ui-editor');

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
