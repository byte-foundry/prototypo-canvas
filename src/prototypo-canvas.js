var prototypo		= require('prototypo.js');
var assign			= require('es6-object-assign').assign;
var cloneDeep		= require('lodash/cloneDeep');
var forEach			= require('lodash/forEach');
var EventEmitter	= require('wolfy87-eventemitter');
var glyph			= require('./utils/glyph');
var mouseHandlers	= require('./utils/mouseHandlers');
var init			= require('./utils/init');
var loadFont		= require('./utils/loadFont');
var { drawUIEditor, createUIEditor } = require('./utils/ui-editor');

var _ = { assign: assign, cloneDeep: cloneDeep, forEach: forEach },
	paper = prototypo.paper;

var fontsMap;
var UIEditor;

var confirmCursorsChanges = function(instance, oldCursors) {
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

	instance.emitEvent('manualchange', [ createIdentityCursors(newCursors), true ]);
};

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

	this.scope = paper;
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
	this.isMousedown = false;
	this.exportingZip = false;
	this.allowMove = true;
	this.isShiftPressed = false;
	this.glyphPoints = [];
	this.shiftLock = {
		deltaX: 0,
		deltaY: 0,
		isLocked: false,
		direction: '',
		isLineDrawn: false,
	};
	this.snapping = {
		isSnapped: false,
		axis: '',
		deltaX: 0,
		deltaY: 0,
		snappedTo: undefined,
	};

	if (fontsMap) {
		this.fontsMap = fontsMap;
	} else {
		this.fontsMap = fontsMap = {};
	}

	this.typographicFrame = {
		spacingLeft: new paper.Shape.Rectangle(new paper.Point(-100000, -50000), new paper.Size(100000, 100000)),
		spacingRight: new paper.Shape.Rectangle(new paper.Point(-100000, -50000), new paper.Size(100000, 100000)),
		low: new paper.Shape.Rectangle(new paper.Point(-50000, 0), new paper.Size(100000, 1)),
		xHeight: new paper.Shape.Rectangle(new paper.Point(-50000, 0), new paper.Size(100000, 1)),
		capHeight: new paper.Shape.Rectangle(new paper.Point(-50000, 0), new paper.Size(100000, 1)),
		shiftLockHelper: undefined,
		snappingHelper: undefined,
	};
	this.typographicFrame.spacingLeft.fillColor = 'rgba(235,235,235,0.5)';
	this.typographicFrame.spacingLeft.strokeColor = '#24d390';
	this.typographicFrame.spacingRight.fillColor = 'rgba(235,235,235,0.5)';
	this.typographicFrame.spacingRight.strokeColor = '#24d390';
	this.typographicFrame.low.fillColor = '#777777';
	this.typographicFrame.xHeight.fillColor = '#777777';
	this.typographicFrame.capHeight.fillColor = '#777777';

	this.view.onMouseMove = function(e) {
		if (!pCanvasInstance.allowMove) {
			e.preventDefault();
			e.stopPropagation();
		}

		return false;
	}

	var pCanvasInstance = this;

	var emitEvent = this.emitEvent.bind(this);

	if (UIEditor) {
		UIEditor.remove();
	}

	UIEditor = createUIEditor(paper, {
		onCursorsChanged(cursors) {
			emitEvent('manualchange', [ cursors ]);
			if (!UIEditor.changesToConfirm) {
				UIEditor.changesToConfirm = cursors;
			}
		},
		onConfirmChanges() {
			var cursors = UIEditor.changesToConfirm;
			confirmCursorsChanges(pCanvasInstance, cursors);
			delete UIEditor.changesToConfirm;
		},
		onResetCursor(contourId, nodeId) {
			emitEvent('manualreset', [ contourId, nodeId ]);
		}
	});

	this.setupEvents( pCanvasInstance );

	// this.grid = new Grid( paper );

	// bind workerHandlers
	if ( this.worker ) {
		this.worker.port.addEventListener('message', function(e) {
			if (e.data.handler === 'font') {
				this.emitEvent( 'worker.fontCreated');
			}

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
		this.rafId = raf(updateLoop);

			/*if (this.latestRafValues && this.currGlyph && !this.exportingZip) {
			this.font.update( this.latestRafValues, [ this.currGlyph ] );
			this.view.update();
			drawTypographicFrame.bind(this)();
			delete this.latestRafValues;
		}*/

		if (this.prevGlyph !== this.currGlyph) {
			this.prevGlyph = this.currGlyph;

			delete UIEditor.selection;
		}

		drawTypographicFrame.bind(this)();
		drawUIEditor(paper, !this._showNodes, UIEditor);
	};
	updateLoop();
}

function drawTypographicFrame() {
	if (this.currGlyph && this.currGlyph.ot.advanceWidth) {
		var spacingRight = this.currGlyph.ot.advanceWidth + 100000 / 2;
		this.typographicFrame.spacingRight.position = new paper.Point(spacingRight, 0);
		if (this.latestValues) {
			this.typographicFrame.xHeight.position = new paper.Point(0, this.latestValues.xHeight);
			this.typographicFrame.capHeight.position = new paper.Point(0, this.latestValues.xHeight + this.latestValues.capDelta);
		}
	}

	this.typographicFrame.spacingLeft.strokeWidth = 1 / this.zoom;
	this.typographicFrame.spacingRight.strokeWidth = 1 / this.zoom;
	this.typographicFrame.low.size.height = 1 / this.zoom;
	this.typographicFrame.xHeight.size.height = 1 / this.zoom;
	this.typographicFrame.capHeight.size.height = 1 / this.zoom;
	if (this.typographicFrame.shiftLockHelper) {
		this.typographicFrame.shiftLockHelper.strokeWidth = 2 / this.zoom;
		this.typographicFrame.shiftLockHelper.dashArray = [ 8 / this.zoom, 8 / this.zoom ]
	}
	if (this.typographicFrame.snappingHelper) {
		this.typographicFrame.snappingHelper.strokeWidth = 2 / this.zoom
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
		}
	},
	showNodes: {
		get: function() {
			return this._showNodes;
		},
		set: function( bool ) {
			this._showNodes = bool;
		}
	},
	showCoords: {
		get: function() {
			return paper.settings.drawCoords;
		},
		set: function( bool ) {
			paper.settings.drawCoords = bool;
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

PrototypoCanvas.stopRaf = function(instance) {
	if (instance && instance.rafId) {
		var cancelRaf = window.cancelAnimationFrame || window.mozCancelAnimationFrame;
		cancelRaf(instance.rafId);
	}
};

PrototypoCanvas.prototype.displayChar = function( code ) {
	this.latestChar = code;
	this.displayGlyph( typeof code === 'string' ?
		this.font.charMap[ code.charCodeAt(0) ] : code
	);
};

PrototypoCanvas.prototype.setupCanvas = function( canvas ) {
	if (canvas !== this.view._element) {
		this.scope.setup(canvas);
		this.view = this.scope.view;
		this.setupEvents( this );
	}
}

PrototypoCanvas.prototype.setupEvents = function( pCanvasInstance ) {
	var emitEvent = this.emitEvent.bind(this);
	this.view.onKeyDown = function(event) {
		if (event.event.keyCode === 16) {
			this.isShiftPressed = true;
		}
	}

	this.view.onKeyUp = function(event) {
		if (event.event.keyCode === 16) {
			this.isShiftPressed = false;
			pCanvasInstance.shiftLock.isLocked = false;
			pCanvasInstance.shiftLock.isLineDrawn = false;
			pCanvasInstance.shiftLock.deltaX = 0;
			pCanvasInstance.shiftLock.deltaY = 0;
			pCanvasInstance.shiftLock.direction = '';
			pCanvasInstance.typographicFrame.shiftLockHelper ? pCanvasInstance.typographicFrame.shiftLockHelper.remove() : null;
			if (pCanvasInstance.snapping.isLineDrawn) {
				//Unsnap without moving the cursor and remove helpine when shift is released
				pCanvasInstance.snapping.deltaX = 0;
				pCanvasInstance.snapping.deltaY = 0;
				pCanvasInstance.snapping.isSnapped = false;
				pCanvasInstance.snapping.axis = '';
				pCanvasInstance.snapping.snappedTo = undefined;
				pCanvasInstance.typographicFrame.snappingHelper.remove();
			}
		}
	}

	this.view.onMouseDown = function(event) {
		if (pCanvasInstance._showNodes) {
			// if visible, skeleton points can be matched
			var skeletons = paper.project.getItems({ selected: true }).filter((item) => { return item.skeleton && !item.visible; });
			skeletons.forEach((item) => { item.visible = true; });

			var results = paper.project.hitTestAll(event.point, {
				match(hit) {
					return hit.item.skeleton || hit.segment.expandedFrom;
				},
				segments: true,
				handles: true,
				tolerance: (20 * Math.exp(-0.12 * this.zoom)).toFixed(1), //TODO: better exponential to have perfect tolerance with zoom
			});
			// matching skeleton first
			var hitResult = results.filter((hit) => { return hit.item.expandedTo; })[0] || results[0];

			skeletons.forEach((item) => {
				item.visible = false;
			});

			if (hitResult) {
				if (hitResult.segment.expandedTo) {
					skeletons.forEach((item) => {
						_.forEach(item.expandedTo, function(expanded) {
							expanded.selected = false;
						});
						item.selected = false;
					});

					_.forEach(hitResult.segment.expandedTo, function(expanded) {
						expanded.selected = true;
						hitResult.segment.selected = true;
					});
				}
				else if (hitResult.segment.expandedFrom) {
					skeletons.forEach((item) => {
						_.forEach(item.expandedTo, function(expanded) {
							expanded.selected = false;
						});
						item.selected = false;
					});

					_.forEach(hitResult.segment.expandedFrom.expandedTo, function(expanded) {
						expanded.selected = true;
						hitResult.segment.selected = true;
					});
				}

				if (hitResult.type.startsWith('handle')) {
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


				skeletons.forEach((item) => {
					item.segments.forEach((segment) => {
						if (segment !== this.selectedSegment) {
							pCanvasInstance.glyphPoints.push({ x: segment.point.x, y: segment.point.y });
						}
					});
				});
				return;
			}
		}

		if (pCanvasInstance.allowMove) {
			pCanvasInstance.prevPos = new paper.Point(event.event.clientX, event.event.clientY);
		}
	};

	this.view.onMouseDrag = function(event) {
		var changes = {
			type: '',
			data: {
				contourIdx: undefined,
				nodeIdx: undefined
			},
			cursors: {}
		}
		let snappingTrigger = 10 / pCanvasInstance.zoom;
		let unSnappingTrigger = 15 / pCanvasInstance.zoom;
		let lockTrigger = 4 / pCanvasInstance.zoom;
		let switchDirectionTrigger = 12 / pCanvasInstance.zoom;
		let xDirection = (event.delta.x > 0) ? 'right' : 'left';
		let yDirection = (event.delta.y < 0) ? 'top' : 'bottom';

		if (this.selectedHandle && this.selectedSegment.expandedFrom && pCanvasInstance._showNodes) {
			changes.type = 'dir';
		} else if (this.selectedSegment && pCanvasInstance._showNodes) {
			changes.data.contourIdx = this.selectedSegment.contourIdx;
			changes.data.nodeIdx = this.selectedSegment.nodeIdx;
			if (this.selectedSegment.path.skeleton) {
				// change skeleton x, y
				changes.type = 'skeleton';

				//Snapping mechanism
				if (!pCanvasInstance.snapping.isSnapped) {
					//Not yet snapped, scan all nodes to get a match
					for (let glyphPoint of pCanvasInstance.glyphPoints) {
						if (Math.abs(this.selectedSegment.point.x - glyphPoint.x) < snappingTrigger) {
							changes.type = 'skeletonGotSnapped';
							pCanvasInstance.snapping.isSnapped = true;
							pCanvasInstance.snapping.axis = 'x';
							pCanvasInstance.snapping.snappedTo = glyphPoint;
							break;
						}
						if (Math.abs(this.selectedSegment.point.y - glyphPoint.y) < snappingTrigger) {
							changes.type = 'skeletonGotSnapped';
							pCanvasInstance.snapping.isSnapped = true;
							pCanvasInstance.snapping.axis = 'y';
							pCanvasInstance.snapping.snappedTo = glyphPoint;
							break;
						}
					}
				} else {
					//Snapped, engage the unsnapping loop
					changes.type = 'skeletonSnapped';
					pCanvasInstance.snapping.deltaX += event.delta.x;
					pCanvasInstance.snapping.deltaY += event.delta.y;
					if ( ( pCanvasInstance.snapping.axis === 'y' && Math.abs(pCanvasInstance.snapping.deltaY) > unSnappingTrigger )  ||
						( pCanvasInstance.snapping.axis === 'x' && Math.abs(pCanvasInstance.snapping.deltaX) > unSnappingTrigger ) ) {
						// Reached the trigger, unsnap it
						changes.type = 'skeletonUnSnapped';
					}
				}
			} else {
				changes.type = 'width';
			}
		} else if (pCanvasInstance.prevPos) {
			var currPos = new paper.Point(event.event.clientX, event.event.clientY),
				delta = currPos.subtract(pCanvasInstance.prevPos);

			pCanvasInstance.prevPos = currPos;

			this.center = this.center.subtract(delta.divide(this.zoom * window.devicePixelRatio));
			return;
		}

		if (this.isShiftPressed) {
			//Handle shift lock
			if (pCanvasInstance.shiftLock.deltaX > 8 || pCanvasInstance.shiftLock.deltaY > 8) {
				pCanvasInstance.shiftLock.deltaX = Math.abs(event.delta.x);
				pCanvasInstance.shiftLock.deltaY = Math.abs(event.delta.y);
			} else {
				pCanvasInstance.shiftLock.deltaX += Math.abs(event.delta.x);
				pCanvasInstance.shiftLock.deltaY += Math.abs(event.delta.y);
			}
			if (!pCanvasInstance.shiftLock.isLocked) {
				if (Math.abs(pCanvasInstance.shiftLock.deltaX - pCanvasInstance.shiftLock.deltaY) > lockTrigger) {
					pCanvasInstance.shiftLock.direction = pCanvasInstance.shiftLock.deltaX > pCanvasInstance.shiftLock.deltaY ? 'horizontal' : 'vertical';
					pCanvasInstance.shiftLock.isLocked = true;
				}
			} else if (Math.abs(pCanvasInstance.shiftLock.deltaX - pCanvasInstance.shiftLock.deltaY) > switchDirectionTrigger) {
					pCanvasInstance.typographicFrame.shiftLockHelper ? pCanvasInstance.typographicFrame.shiftLockHelper.remove() : null;
					pCanvasInstance.shiftLock.isLineDrawn = false;
					pCanvasInstance.shiftLock.direction = pCanvasInstance.shiftLock.deltaX > pCanvasInstance.shiftLock.deltaY ? 'horizontal' : 'vertical';
			}
			if (!pCanvasInstance.shiftLock.isLineDrawn && pCanvasInstance.shiftLock.isLocked) {
				// draw helpline
				pCanvasInstance.typographicFrame.shiftLockHelper = pCanvasInstance.shiftLock.direction === 'vertical' ?
				new paper.Path.Line(
					new paper.Point( this.selectedSegment.point.x - 1 / pCanvasInstance.zoom , 50000 ),
					new paper.Point( this.selectedSegment.point.x - 1 / pCanvasInstance.zoom, -50000 )
				) :
				new paper.Path.Line(
					new paper.Point( -100000, this.selectedSegment.point.y ),
					new paper.Point( 100000, this.selectedSegment.point.y )
				);
				pCanvasInstance.typographicFrame.shiftLockHelper.strokeColor = '#00c4d6';
				pCanvasInstance.typographicFrame.shiftLockHelper.applyMatrix = false;
				pCanvasInstance.shiftLock.isLineDrawn = true;
			}
		}

		switch (changes.type) {
			case 'dir':
				var transformedEventPoint = new paper.Point(event.point.x, -event.point.y);
				var mouseVecNorm = transformedEventPoint.subtract(this.skewedSelectedSegmentPoint).length;

				var eventNormalized = event.delta.multiply(this.selectedHandleNorm / mouseVecNorm);
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
				//If point is smooth we take the dir that is not undefined else we take the dir
				//we're modifying
				var dirType = this.selectedSegment.expandedFrom.type === 'smooth' ?
						!this.selectedSegment.expandedFrom.dirIn ?
							'dirOut' :
							'dirIn' :
						(invertDir && !isDirIn) || (!invertDir && isDirIn) ?
						'dirIn' :
						'dirOut';

				changes.data.contourIdx = this.selectedSegment.expandedFrom.contourIdx;
				changes.data.nodeIdx = this.selectedSegment.expandedFrom.nodeIdx;
				changes.cursors = { [`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.${dirType}`]: successAngle };
				break;
			case 'width':
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

				if (this.selectedSegment === this.selectedSegment.expandedFrom.expandedTo[0]) {
					deltaWidth *= -1;
					if (distrib !== 0) {
						deltaWidth /= distrib;
					}
				} else if (distrib !== 1) {
					deltaWidth /= (1 - distrib);
				}

				changes.data.contourIdx = this.selectedSegment.expandedFrom.contourIdx;
				changes.data.nodeIdx = this.selectedSegment.expandedFrom.nodeIdx;
				changes.cursors = {
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.expand`]: { width: deltaWidth },
				};
				break;
			case 'skeleton':
				changes.cursors = {
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: event.delta.x,
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: -event.delta.y,
				};
				break;
			case 'skeletonGotSnapped':
				if (pCanvasInstance.snapping.axis === 'x') {
					changes.cursors = {
						[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: pCanvasInstance.snapping.snappedTo.x - this.selectedSegment.point.x,
						[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: -event.delta.y,
					};
					pCanvasInstance.typographicFrame.snappingHelper =	new paper.Path.Line(
						new paper.Point( this.selectedSegment.point.x + pCanvasInstance.snapping.snappedTo.x - this.selectedSegment.point.x, this.selectedSegment.point.y - event.delta.y),
						new paper.Point( pCanvasInstance.snapping.snappedTo.x, pCanvasInstance.snapping.snappedTo.y )
					);
				} else {
					changes.cursors = {
						[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: event.delta.x,
						[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: pCanvasInstance.snapping.snappedTo.y - this.selectedSegment.point.y,
					};
					pCanvasInstance.typographicFrame.snappingHelper =	new paper.Path.Line(
						new paper.Point( this.selectedSegment.point.x + event.delta.x, this.selectedSegment.point.y + pCanvasInstance.snapping.snappedTo.y - this.selectedSegment.point.y),
						new paper.Point( pCanvasInstance.snapping.snappedTo.x, pCanvasInstance.snapping.snappedTo.y )
					);
				}
				pCanvasInstance.typographicFrame.snappingHelper.strokeColor = '#FF4AFF';
				pCanvasInstance.typographicFrame.snappingHelper.opacity = 0.5;
				pCanvasInstance.typographicFrame.snappingHelper.applyMatrix = false;
				pCanvasInstance.shiftLock.isLineDrawn = true;
				break;
			case 'skeletonSnapped':
				if (pCanvasInstance.snapping.axis === 'y') {
					pCanvasInstance.typographicFrame.snappingHelper.segments[0].point.x =  !pCanvasInstance.shiftLock.isLocked ?
					this.selectedSegment.point.x + event.delta.x :
					this.selectedSegment.point.x;
				}
				if (pCanvasInstance.snapping.axis === 'x') {
					pCanvasInstance.typographicFrame.snappingHelper.segments[0].point.y = !pCanvasInstance.shiftLock.isLocked ?
					this.selectedSegment.point.y - event.delta.y :
					this.selectedSegment.point.y;
				}
				changes.cursors = pCanvasInstance.snapping.axis === 'y' ?
				{
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: event.delta.x,
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: 0,
				} :
				{
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: 0,
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: -event.delta.y,
				};
				break;
			case 'skeletonUnSnapped':
				changes.cursors = pCanvasInstance.snapping.axis === 'y' ?
				{
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: event.delta.x,
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: yDirection === 'bottom' ?
																									-unSnappingTrigger :
																									unSnappingTrigger,
				} :
				{
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: xDirection === 'right' ?
																									unSnappingTrigger :
																									-unSnappingTrigger,
					[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: -event.delta.y,
				};
				pCanvasInstance.snapping.deltaX = 0;
				pCanvasInstance.snapping.deltaY = 0;
				pCanvasInstance.snapping.isSnapped = false;
				pCanvasInstance.snapping.axis = '';
				pCanvasInstance.snapping.snappedTo = undefined;
				pCanvasInstance.typographicFrame.snappingHelper.remove();
				break;
			default:
				break;
		}

		let sendManualChanges = (cursors) => {
			emitEvent('manualchange', [ cursors ]);
		}

		// Send computed changes
		if (this.isShiftPressed) {
			// only use the delta according to the direction set
			changes.cursors = pCanvasInstance.shiftLock.direction === 'vertical' ?
			{
				[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: 0,
				[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: -event.delta.y,
			} :
			{
				[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.x`]: event.delta.x,
				[`contours.${changes.data.contourIdx}.nodes.${changes.data.nodeIdx}.y`]: 0,
			};
		}
		this.changesToConfirm = changes.cursors;
		sendManualChanges(changes.cursors);
		pCanvasInstance.prevPos = null;
	};

	this.view.onMouseUp = function() {
		if (this.changesToConfirm) {
			confirmCursorsChanges(pCanvasInstance, this.changesToConfirm);
			delete this.changesToConfirm;
		}
		pCanvasInstance.prevPos = undefined;
		this.selectedHandle = null;
		this.selectedSegment = null;
		pCanvasInstance.glyphPoints = [];
		pCanvasInstance.snapping.deltaX = 0;
		pCanvasInstance.snapping.deltaY = 0;
		pCanvasInstance.snapping.isSnapped = false;
		pCanvasInstance.snapping.axis = '';
		pCanvasInstance.snapping.snappedTo = undefined;
		pCanvasInstance.typographicFrame.snappingHelper ? pCanvasInstance.typographicFrame.snappingHelper.remove() : null;
	};
}

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
	'getGlyphsProperties'
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

PrototypoCanvas.prototype.getGlyphsProperties = function(properties, callback) {
	this.enqueue({
		type: 'getGlyphsProperties',
		data: {
			properties: properties
		},
		callback: (typeof callback === 'function' ? callback : undefined)
	});
}

PrototypoCanvas.prototype.setAlternateFor = function( unicode, glyphName ) {
	var result = [];
	if ( !glyphName ) {
		Object.keys(unicode).forEach(function(code) {

			if ( +code === this.currGlyph.src.unicode ) {
				this.displayChar( this.font.glyphMap[unicode[code]] );
			}

			result = result.concat(this.font.setAlternatesFor(code, unicode[code]));
		}.bind(this));

		this.enqueue({
			type: 'alternate',
			data: {
				altList: unicode
			}
		});
	} else {
		result = result.concat(this.font.setAlternatesFor(unicode, glyphName));

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
	return result;
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
