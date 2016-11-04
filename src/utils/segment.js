var SelectionState = {
		HANDLE_IN: 1,
		HANDLE_OUT: 2,
		POINT: 4,
		SEGMENT: 7 // HANDLE_IN | HANDLE_OUT | POINT
	};

function drawSelected(ctx, matrix) {
	ctx.beginPath();
	ctx.stroke();

	drawSegment(ctx,
		matrix,
		this,
		this._project._scope.settings,
		this._project._view._zoom);
}

function drawSegment(ctx, matrix, segment, settings, zoom) {
	var size = settings.handleSize,
		half = size / 2,
		pX,
		pY;

	var worldCoords = new Float32Array(6),
		viewCoords = new Float32Array(6);
	segment._transformCoordinates(null, worldCoords, false);
	segment._transformCoordinates(matrix, viewCoords, false);
	var state = segment._selection;
	pX = Math.round( viewCoords[0] );
	pY = Math.round( viewCoords[1] );
	if ( state & /*#=*/ SelectionState.HANDLE_IN ) {
		drawHandle(ctx, zoom, 2, viewCoords, settings, worldCoords, pX, pY);
	}
	if ( state & /*#=*/ SelectionState.HANDLE_OUT ) {
		drawHandle(ctx, zoom, 4, viewCoords, settings, worldCoords, pX, pY);
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

function drawHandle(ctx, zoom, j, viewCoords, settings, worldCoords, pX, pY) {
	var size = settings.handleSize,
		half = size / 2,
		hX = Math.round( viewCoords[j] ),
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

module.exports = {
	drawSegment: drawSegment,
	drawHandle: drawHandle,
	drawSelected: drawSelected,
}
