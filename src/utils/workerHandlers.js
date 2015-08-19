// var dotsvgTemplate = require('./dotsvg.tpl');

// handles buffers coming from the worker
function fontBufferHandler(e) {
	if ( !(e.data instanceof ArrayBuffer) ) {
		return;
	}

	this.latestBuffer = e.data;
	this.font.addToFonts( this.latestBuffer );
}

function otfFontHandler(e) {console.log('here');
	this.latestBuffer = e.data;
	this.font.download( this.latestBuffer );
}

function svgFontHandler() {

}

module.exports = {
	updateHandler: fontBufferHandler,
	subsetHandler: fontBufferHandler,
	otfFontHandler: otfFontHandler,
	svgFontHandler: svgFontHandler
};
