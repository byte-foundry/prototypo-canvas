function createUIEditor(paper, options) {
	var UIEditor = {
		onExpandChanged: options.onExpandChanged,
	};

	var directionHandle = new paper.Path.Arc({
		from: new paper.Point(0,0).rotate(-30, new paper.Point(0, 40)),
		through: [0, 0],
		to: new paper.Point(0,0).rotate(30, new paper.Point(0, 40)),
		strokeColor: '#24d390',
		transformContent: false,
	});

	directionHandle.onMouseDown = function(event) {
		this.selectedHandlePos = new paper.Point(directionHandle.position).subtract(UIEditor.selection);
		this.selectedHandleNorm = this.selectedHandlePos.length;
		this.selectedHandleAngle = this.selectedHandlePos.angle;
	};

	directionHandle.onMouseDrag = function(event) {
		var transformedEventPoint = new paper.Point(event.point.x, -event.point.y);
		var mouseVecNorm = transformedEventPoint.subtract(UIEditor.selection).length;

		var eventNormalized = event.delta.multiply(this.selectedHandleNorm/mouseVecNorm);
		var newHandlePosition = new paper.Point(
			this.selectedHandlePos.x + eventNormalized.x,
			this.selectedHandlePos.y - eventNormalized.y
		);

		var normalizedHandle = newHandlePosition.normalize().multiply(this.selectedHandleNorm);
		directionHandle.position.x = normalizedHandle.add(UIEditor.selection).x;
		directionHandle.position.y = normalizedHandle.add(UIEditor.selection).y;
		var deltaAngle = normalizedHandle.angle - this.selectedHandleAngle;

		this.selectedHandleAngle = normalizedHandle.angle;
		this.selectedHandlePos = new paper.Point(directionHandle.position).subtract(UIEditor.selection);
		UIEditor.onExpandChanged(`contours.${UIEditor.selection.contourIdx}.nodes.${UIEditor.selection.nodeIdx}.expand`, {
			angle: deltaAngle * Math.PI / 180,
		});

		return false; // prevent anything else to move
	};

	UIEditor.directionHandle = directionHandle;

	return UIEditor;
}

function drawUIEditor(paper, UIEditor) {
	if(!UIEditor || !UIEditor.selection) {
		return;
	}

	var directionHandle = UIEditor.directionHandle;
	directionHandle.bringToFront();

	var orthVect = new paper.Point(-Math.sin(UIEditor.selection.expand.angle), Math.cos(UIEditor.selection.expand.angle));
	directionHandle.rotation = orthVect.angle + 90;
	directionHandle.position = UIEditor.selection.point.add(orthVect.multiply(40));
	directionHandle.strokeWidth = 10 * (0.5 / paper.view.zoom);
}

module.exports = {
	createUIEditor,
	drawUIEditor,
};
