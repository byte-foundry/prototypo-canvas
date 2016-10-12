var ComponentMenu = require('../ui/componentMenu');
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
