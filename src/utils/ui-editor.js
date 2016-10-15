function createUIEditor(paper, options) {
	var UIEditor = {
		onCursorsChanged: options.onCursorsChanged,
		onConfirmChanges: options.onConfirmChanges,
		onResetCursor: options.onResetCursor,
	};

	var distributionHandle = new paper.Path.RegularPolygon({
		center: [0, 0],
		sides: 3,
		radius: 15,
		fillColor: '#24d390',
		transformContent: false,
	});

	var resetHandle = new paper.Group({
		children: [
			new paper.Path('M0,12 a12,12 0 1,0 0,-1 z'),
			new paper.Path('M9.47,7.894C9.458,7.893,9.449,7.896,9.439,7.896l0-0.766V6.353c0-0.044-0.007-0.087-0.018-0.128 C9.418,6.213,9.414,6.202,9.411,6.19C9.4,6.158,9.387,6.129,9.371,6.1C9.366,6.091,9.362,6.082,9.356,6.073 c-0.021-0.032-0.043-0.062-0.07-0.089C9.284,5.981,9.282,5.981,9.279,5.979C9.243,5.943,9.201,5.912,9.155,5.889 C8.98,5.8,8.771,5.815,8.613,5.931L4.646,9.41C4.511,9.509,4.431,9.665,4.431,9.832c0,0.167,0.081,0.322,0.215,0.421l3.968,3.479 c0.096,0.07,0.212,0.099,0.328,0.094h0c0.035-0.002,0.069-0.004,0.103-0.013c0.038-0.009,0.075-0.021,0.111-0.038 c0.175-0.089,0.284-0.269,0.284-0.464l0-1.6c3.214,0.212,5.544,1.585,5.544,3.271c0,0.998-0.808,1.951-2.214,2.614 c-0.145,0.068-0.21,0.238-0.149,0.386c0.048,0.115,0.159,0.185,0.277,0.185c0.033,0,0.067-0.006,0.101-0.018 c2.863-1.024,4.572-2.796,4.572-4.736C17.569,10.689,14.163,8.367,9.47,7.894z'),
		],
		transformContent: false,
	});
	resetHandle.children[0].fillColor = '#24d390';
	resetHandle.children[0].transformContent = false;
	resetHandle.children[1].fillColor = '#fefefe';
	resetHandle.children[1].transformContent = false;

	distributionHandle.onMouseDrag = function(event) {
		var expandVect = UIEditor.selection.expandedTo[0].point.subtract(UIEditor.selection.expandedTo[1].point);
		var direction = new paper.Point(
			Math.cos(UIEditor.selection.expand.angle),
			Math.sin(UIEditor.selection.expand.angle)
		);
		var deltaWidth = direction.x * event.delta.x - direction.y * event.delta.y;
		var deltaDistr = deltaWidth / expandVect.length;
		if(UIEditor.selection.expand.distr + deltaDistr >= 1) {
			deltaDistr = Math.min(deltaDistr, 0);
		} else if(UIEditor.selection.expand.distr + deltaDistr <= 0) {
			deltaDistr = Math.max(deltaDistr, 0);
		}

		const { contourIdx, nodeIdx } = UIEditor.selection;
		UIEditor.onCursorsChanged({
			[`contours.${contourIdx}.nodes.${nodeIdx}.expand`]: {
				distr: deltaDistr,
			},
			[`contours.${contourIdx}.nodes.${nodeIdx}.x`]: - expandVect.multiply(deltaDistr).x,
			[`contours.${contourIdx}.nodes.${nodeIdx}.y`]: - expandVect.multiply(deltaDistr).y,
		});

		return false; // prevent anything else to move
	};

	distributionHandle.onMouseUp = function(event) {
		UIEditor.onConfirmChanges();
	}

	var directionHandle = new paper.Path.Arc({
		from: new paper.Point(0,0).rotate(-30, new paper.Point(0, 40)),
		through: [0, 0],
		to: new paper.Point(0,0).rotate(30, new paper.Point(0, 40)),
		strokeColor: '#24d390',
		strokeWidth: 10,
		transformContent: false,
	});

	directionHandle.onMouseDown = function(event) {
		var skewedSelection = new paper.Point(
			UIEditor.selection.x + UIEditor.selection.path.viewMatrix.c / paper.view.zoom  * UIEditor.selection.y,
			UIEditor.selection.y
		);
		this.selectedHandlePos = new paper.Point(directionHandle.position).subtract(skewedSelection);
		this.selectedHandleNorm = this.selectedHandlePos.length;
		this.selectedHandleAngle = this.selectedHandlePos.angle;
	};

	directionHandle.onMouseDrag = function(event) {
		var transformedEventPoint = new paper.Point(event.point.x, -event.point.y);
		var skewedSelection = new paper.Point(
			UIEditor.selection.x + UIEditor.selection.path.viewMatrix.c / paper.view.zoom  * UIEditor.selection.y,
			UIEditor.selection.y
		);
		var mouseVecNorm = transformedEventPoint.subtract(skewedSelection).length;

		var eventNormalized = event.delta.multiply(this.selectedHandleNorm/mouseVecNorm);
		var newHandlePosition = new paper.Point(
			this.selectedHandlePos.x + eventNormalized.x,
			this.selectedHandlePos.y - eventNormalized.y
		);

		var normalizedHandle = newHandlePosition.normalize().multiply(this.selectedHandleNorm);
		directionHandle.position.x = normalizedHandle.add(skewedSelection).x;
		directionHandle.position.y = normalizedHandle.add(skewedSelection).y;
		var deltaAngle = normalizedHandle.angle - this.selectedHandleAngle;

		this.selectedHandleAngle = normalizedHandle.angle;
		this.selectedHandlePos = new paper.Point(directionHandle.position).subtract(skewedSelection);
		UIEditor.onCursorsChanged({
			[`contours.${UIEditor.selection.contourIdx}.nodes.${UIEditor.selection.nodeIdx}.expand`]: {
				angle: deltaAngle * Math.PI / 180,
			},
		});

		return false; // prevent anything else to move
	};

	directionHandle.onMouseUp = function(event) {
		UIEditor.onConfirmChanges();
	}

	resetHandle.onClick = function() {
		UIEditor.onResetCursor(UIEditor.selection.contourIdx, UIEditor.selection.nodeIdx);
	}

	UIEditor.distributionHandle = distributionHandle;
	UIEditor.directionHandle = directionHandle;
	UIEditor.resetHandle = resetHandle;

	return UIEditor;
}

function drawUIEditor(paper, hide, UIEditor) {
	var directionHandle = UIEditor.directionHandle;
	var distributionHandle = UIEditor.distributionHandle;
	var resetHandle = UIEditor.resetHandle;

	directionHandle.visible = !hide && UIEditor.selection;
	distributionHandle.visible = !hide && UIEditor.selection;
	resetHandle.visible = !hide && UIEditor.selection;

	if(!UIEditor.selection) {
		return;
	}

	directionHandle.bringToFront();
	distributionHandle.bringToFront();
	resetHandle.bringToFront();

	var orthVect = new paper.Point(-Math.sin(UIEditor.selection.expand.angle), Math.cos(UIEditor.selection.expand.angle));
	var tangentVect = new paper.Point( orthVect.y, -orthVect.x);

	// we need to reset rotation and scaling before setting them, because PaperJS
	// see https://github.com/paperjs/paper.js/issues/1177
	distributionHandle.rotation = 0;
	distributionHandle.scaling = 1;

	distributionHandle.rotation = orthVect.angle - 30;
	distributionHandle.position = UIEditor.selection.point.add(orthVect.multiply(-40 * 0.5 / paper.view.zoom));
	distributionHandle.scaling = 1 * (0.5 / paper.view.zoom);
	var skewMatrix = new paper.Matrix(1, 0, 0, 1, UIEditor.selection.path.viewMatrix.c / paper.view.zoom  * UIEditor.selection.y, 0);
	distributionHandle.matrix = distributionHandle.matrix.prepend(skewMatrix);

	directionHandle.rotation = 0;
	directionHandle.scaling = 1;
	directionHandle.rotation = orthVect.angle + 90;
	directionHandle.position = UIEditor.selection.point.add(orthVect.multiply(75 * 0.5 / paper.view.zoom));
	directionHandle.scaling = 1 * (0.5 / paper.view.zoom);
	directionHandle.matrix = directionHandle.matrix.prepend(skewMatrix);

	resetHandle.children.forEach(function(child) {
		child.rotation = 0;
		child.scaling = 1;
		child.position = UIEditor.selection.point.add(tangentVect.multiply(75 * 0.5 / paper.view.zoom));
		child.scaling = 2 * (0.5 / paper.view.zoom);
		child.matrix = child.matrix.prepend(skewMatrix);
	});
}

module.exports = {
	createUIEditor,
	drawUIEditor,
};
