var ComponentMenu = require('../ui/componentMenu');
var paper = prototypo;
var segment = require('./segment.js');

function displayComponents( glyph, showNodes ) {
	glyph.components.forEach(function(component) {
		component.visible = true;
		component.contours.forEach(function(contour) {
			contour.fullySelected = showNodes && !contour.skeleton;
		});

		var componentColor = this.fill ? '#333333' : undefined;
		var componentHoverColor = '#24d390';

		if (component.multiple) {
			if (component.name.indexOf('none') !== -1 && component.anchors[0].anchor) {
				if (!component.optionPoint) {
					var point = new paper.Shape.Circle({
						center: component.anchors[0].anchor,
						radius: 10 / this.view.zoom,
						strokeWidth: 2 / this.view.zoom,
						fillColor: new paper.Color(0.5, 1, 1, 0.01),
						strokeColor: new paper.Color(0.5, 0.5, 0.5),
					});

					var oldDraw = point.draw;
					point.draw = function() {
						point.radius = 10 / this.view.zoom;
						point.strokeWidth = 2 / this.view.zoom,
						oldDraw.apply(point, arguments);
					}.bind(this);

					point.onMouseEnter = function() {
						if (this._showComponents) {
							point.strokeColor = componentHoverColor;
						}
					}.bind(this);

					point.onMouseLeave = function() {
						if (this._showComponents) {
							point.strokeColor = new paper.Color(0.5, 0.5, 0.5);
						}
					}.bind(this);

					point.onClick = function(event) {
						if (this._showComponents) {
							event.preventDefault();
							event.stopPropagation();
							this.displayComponentList(glyph, component.componentId, event.point);

							this.view.onClick = function(event) {
								glyph.componentMenu.removeMenu();
								this.view.onClick = undefined;
							}.bind(this);
						}
					}.bind(this);

					component.optionPoint = point;
				}
				else {
					if (!this._showComponents) {
						component.optionPoint.strokeColor = undefined;
					}
					else {
						component.optionPoint.strokeColor = new paper.Color(0.5, 0.5, 0.5);
					}
				}
			}
			else {
				if (this._showComponents) {
					component.fillColor = new paper.Color(0.5, 0.5, 0.5);
				}
				else {
					component.fillColor = componentColor;
				}

				component.onMouseEnter = function() {
					if (this._showComponents) {
						component.oldFillColor = component.fillColor;
						component.fillColor = new paper.Color(0.141176,0.827451,0.56470588);
					}
				}.bind(this);

				component.onMouseLeave = function() {
					if (this._showComponents) {
						component.fillColor = component.oldFillColor;
					}
				}.bind(this);

				component.onClick = function(event) {
					if (this._showComponents) {
						event.preventDefault();
						event.stopPropagation();
						this.displayComponentList(glyph, component.componentId, event.point);

						this.view.onClick = function(event) {
							glyph.componentMenu.removeMenu();
							this.view.onClick = undefined;
						}.bind(this);
					}
				}.bind(this);
			}
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

			if (component.optionPoint) {
				component.optionPoint.remove();
				component.optionPoint = undefined;
			}
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
		prototypo.Utils.updateParameters( this.font, this.latestValues );
		var glyphAlt = this.currGlyph.update( this.latestValues );
		if (glyphAlt !== glyph) {
			return this.displayGlyph(glyphAlt);
		}
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
		if (contour.skeleton) {
			contour.fullySelected = this._showNodes;
		}
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

	for (var i = 0, l = segments.length; i < l; i++) {
		if (segments[i].selected) {
			segment.drawSegment(ctx, matrix, segments[i], settings, zoom);
		}
	}
}

function drawSkeletonNode(ctx, segments, matrix, settings, zoom) {
	var size = settings.handleSize,
		half = size / 2,
		pX,
		pY;

	for (var i = 0, l = segments.length; i < l; i++) {
		var segment = segments[i];
		segment._transformCoordinates(null, worldCoords, false);
		segment._transformCoordinates(matrix, viewCoords, false);
		var state = segment._selection;
		pX = Math.round( viewCoords[0] );
		pY = Math.round( viewCoords[1] );
		if (segment.expand) {
			ctx.strokeStyle = settings.nodeColor;
			ctx.strokeRect( pX - (half + 1), pY - (half + 1), size + 1, size + 1 );
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

		if (segment.selected) {
			drawSkeleton(ctx, segment, matrix, settings, zoom);
		}
	}
}

function drawSkeleton(ctx, segment, matrix, settings, zoom) {
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
	ctx.lineWidth = 1;
}

function _drawSelected( ctx, matrix ) {
	if (this.fullySelected || (this.expandedFrom && this.expandedFrom.fullySelected)) {
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
			drawSkeletonNode(ctx,
				this._segments,
				matrix,
				this._project._scope.settings,
				this._project._view._zoom
			)
		}
	}
}

function displayComponentList( glyph, componentId, point ) {
	point.y = -point.y
	var component = glyph.components.filter(function(element) { return element.componentId === componentId})[0];

	if (component.multiple) {
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
