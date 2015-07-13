// var dotsvgTemplate = require('./dotsvg.tpl');

// handles buffers coming from the worker
module.exports = function fontBufferHandler(e) {
	// prevent the worker to be stuck with a busy flag if this method throws
	this.isWorkerBusy = false;

	// if ( 'type' in e.data ) {
	// 	if ( e.data.type === 'otfFont' ) {
	// 		this.font.download( this.latestBuffer );
	// 	}
	//
	// 	if ( typeof this.fontCb === 'function' ) {
	// 		this.fontCb();
	// 	}
	//
	// 	this.fontCb = false;
	// }

	if ( !(e.data instanceof ArrayBuffer) ) {
		return;
	}

	this.latestBuffer = e.data;
	this.font.addToFonts( e.data );

	// process latest Values
	if ( this.latestWorkerValues ) {
		this.isWorkerBusy = true;
		this.worker.postMessage({
			type: 'update',
			data: this.latestWorkerValues
		});

		delete this.latestWorkerValues;

	} else if ( this.latestSubset ) {
		this.isWorkerBusy = true;
		this.worker.postMessage({
			type: 'subset',
			data: this.latestSubset
		});

		delete this.latestSubset;
	}
};
