// Path#_selectedSegmentState is the addition of all segment's states, and is
// compared with SelectionState.SEGMENT, the combination of all SelectionStates
// to see if all segments are fully selected.
var SelectionState = {
		HANDLE_IN: 1,
		HANDLE_OUT: 2,
		POINT: 4,
		SEGMENT: 7 // HANDLE_IN | HANDLE_OUT | POINT
	},
	coords = new Float32Array(6);

function drawHandles(ctx, segments, matrix, settings) {
	var size = settings.handleSize,
		half = size / 2,
		pX,
		pY;

	function drawHandle(index) {
		var hX = coords[index],
			hY = coords[index + 1];

		if (pX !== hX || pY !== hY) {
			ctx.beginPath();
			ctx.strokeStyle = settings.handleColor;
			ctx.fillStyle = settings.handleColor;
			ctx.moveTo(pX, pY);
			ctx.lineTo(hX, hY);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(hX, hY, half, 0, Math.PI * 2, true);
			ctx.fill();
		}
	}

	for (var i = 0, l = segments.length; i < l; i++) {
		var segment = segments[i];
		segment._transformCoordinates(matrix, coords, false);
		var state = segment._selectionState;
		pX = coords[0];
		pY = coords[1];
		if ( state & /*#=*/ SelectionState.HANDLE_IN ) {
			drawHandle(2);
		}
		if ( state & /*#=*/ SelectionState.HANDLE_OUT ) {
			drawHandle(4);
		}
		// Draw a rectangle at segment.point:
		ctx.fillStyle = settings.nodeColor;
		ctx.fillRect( pX - half, pY - half, size, size );
		// If the point is not selected, draw a white square that is 1 px
		// smaller on all sides:
		if ( !(state & /*#=*/ SelectionState.POINT) ) {
			var fillStyle = ctx.fillStyle;
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(pX - half + 1, pY - half + 1, size - 2, size - 2);
			ctx.fillStyle = fillStyle;
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
		this._project._scope.settings
	);
}

module.exports = { _drawSelected: _drawSelected };
