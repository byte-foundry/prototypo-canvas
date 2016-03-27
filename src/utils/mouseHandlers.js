var paper = require('prototypo.js').paper;

function wheelHandler( event ) {
	var bcr = this.canvas.getBoundingClientRect(),
		currPos = new paper.Point(
			event.clientX - bcr.left,
			event.clientY - bcr.top
		),
		viewPos = this.view.viewToProject( currPos ),
		// normalize the deltaY value. Expected values are ~40 pixels or 3 lines
		factor = 1 + ( this.opts.zoomFactor *
			( Math.abs( event.deltaY / event.deltaMode ? 3 : 40 * 20 ) ) ),
		newZoom =
			event.deltaY < 0 ?
				this.view.zoom * factor :
				event.deltaY > 0 ?
					this.view.zoom / factor :
					this.view.zoom,
		beta = this.view.zoom / newZoom,
		difference = viewPos.subtract( this.view.center ),
		newCenter = viewPos.subtract( difference.multiply(beta) );

	this.zoom = newZoom;
	this.view.center = newCenter;

	event.preventDefault();
}

function moveHandler(event) {
	if ( !this.isMousedown ) {
		return;
	}

	var currPos = new paper.Point( event.clientX, event.clientY ),
		delta = currPos.subtract( this.prevPos );

	this.prevPos = currPos;

	this.view.center = this.view.center.subtract(
			delta.divide( this.view.zoom * window.devicePixelRatio) );
}

function downHandler(event) {
	if (event.button && event.button !== 0) {
		return;
	}

	this.isMousedown = true;
	this.prevPos = new paper.Point( event.clientX, event.clientY );
}

function upHandler() {
	this.isMousedown = false;
}

function zoomIn() {
	this.zoom = this.view.zoom * 1 + this.opts.zoomFactor;
}

function zoomOut() {
	this.zoom = this.view.zoom / 1 + this.opts.zoomFactor;
}

module.exports = {
	onWheel: wheelHandler,
	onMove: moveHandler,
	onDown: downHandler,
	onUp: upHandler,
	zoomIn: zoomIn,
	zoomOut: zoomOut
};
