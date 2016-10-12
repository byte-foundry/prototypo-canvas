function createUIEditor(paper, options) {
	var UIEditor = {
		onCursorsChanged: options.onCursorsChanged,
		onConfirmChanges: options.onConfirmChanges,
	};

	var distributionHandle = new paper.Path.RegularPolygon({
		center: [0, 0],
		sides: 3,
		radius: 15,
		fillColor: '#24d390',
		transformContent: false,
	});

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

	UIEditor.distributionHandle = distributionHandle;
	UIEditor.directionHandle = directionHandle;

	return UIEditor;
}

function drawUIEditor(paper, hide, UIEditor) {
	var directionHandle = UIEditor.directionHandle;
	var distributionHandle = UIEditor.distributionHandle;

	directionHandle.visible = !hide && UIEditor.selection;
	distributionHandle.visible = !hide && UIEditor.selection;

	if(!UIEditor.selection) {
		return;
	}

	directionHandle.bringToFront();
	distributionHandle.bringToFront();

	var orthVect = new paper.Point(-Math.sin(UIEditor.selection.expand.angle), Math.cos(UIEditor.selection.expand.angle));

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
}

module.exports = {
	createUIEditor,
	drawUIEditor,
};
