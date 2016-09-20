var paper = require('prototypo.js').paper;

function wheelHandler( event ) {
	// normalize the deltaY value. Expected values are ~40 pixels or 3 lines
	var factor = 1 + ( this.opts.zoomFactor *
			( Math.abs( event.deltaY / event.deltaMode ? 3 : 40 * 20 ) ) ),
		newZoom =
			event.deltaY < 0 ?
				this.view.zoom * factor :
				event.deltaY > 0 ?
					this.view.zoom / factor :
					this.view.zoom;


	if ( newZoom > 0.07 ) {
		var mousePosition = new paper.Point( event.offsetX / window.devicePixelRatio, event.offsetY / window.devicePixelRatio );
		var viewPosition = this.view.viewToProject( mousePosition );
		var pc = viewPosition.subtract( this.view.center );
		var newPosition = viewPosition.subtract(
			pc.multiply( this.view.zoom / newZoom )
		).subtract( this.view.center );

		this.zoom = newZoom;
		this.view.center = this.view.center.add(newPosition);
	}

	event.preventDefault();
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
	onUp: upHandler,
	zoomIn: zoomIn,
	zoomOut: zoomOut
};
