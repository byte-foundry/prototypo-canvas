function Grid( paper ) {
	this.view = paper.view;
	this.patternCanvas = document.createElement('canvas');
	this.backgroundCanvas = document.createElement('canvas');

	this.patternCanvas.width = 100;
	this.patternCanvas.height = 100;

	this.patternCtx = this.patternCanvas.getContext('2d');
	this.backgroundCtx = this.backgroundCanvas.getContext('2d');
	this.raster = paper.project.activeLayer.addChild(
		new paper.Raster( this.backgroundCanvas )
	);

	this.zoom = 1;
}

Object.defineProperty( Grid.prototype, 'zoom', {
	get: function() {
		return this.view.zoom;
	},
	set: function( coef ) {
		var size = this.view.size,
			prevWidth = this.backgroundCanvas.width,
			prevHeight = this.backgroundCanvas.height,
			currWidth = size.width,
			currHeight = size.height;

		this.backgroundCtx.clearRect( 0, 0, prevWidth, prevHeight );
		// Should resizing live in its own method?
		if ( prevWidth !== currWidth ) {
			this.backgroundCanvas.width = currWidth;
		}
		if ( prevHeight !== currHeight ) {
			this.backgroundCanvas.height = currHeight;
		}

		this.patternCtx.beginPath();
		this.patternCtx.strokeWidth = 1 / coef;
		this.patternCtx.strokeStyle = 'blue';
		this.patternCtx.moveTo(0, 0);
		this.patternCtx.lineTo(100, 0);
		this.patternCtx.stroke();
		this.patternCtx.strokeStyle = 'red';
		this.patternCtx.moveTo(0, 0);
		this.patternCtx.lineTo(0, 100);
		this.patternCtx.stroke();

		var pattern = this.backgroundCtx.createPattern(
			this.patternCanvas,
			'repeat'
		);
		this.backgroundCtx.fillStyle = pattern;
		this.backgroundCtx.fillRect(0, 0, currWidth, currHeight);

		// this.raster.set({
		// 	// size: [ width * 2, height * 2 ],
		// 	// `position` set the position of the center of the raster, not its
		// 	// bottom-right corner. So [width, height] results in a grid
		// 	// starting at [0, 0].
		// 	// We need to center the grid while keeping lines aligned with our
		// 	// vertical and horizontal origin, hence the rounding.
		// 	// position: [
		// 	// 	(( width * 2 ) - ( Math.round( width * 2 / 100 ) * 100 )) / 2,
		// 	// 	(( height * 2 ) - ( Math.round( height * 2 / 100 ) * 100 )) / 2
		// 	// ]
		//
		// });
		//this.raster.drawImage( this.backgroundCanvas );
	}
});

module.exports = Grid;
