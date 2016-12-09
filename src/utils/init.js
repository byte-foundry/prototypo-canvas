var shell = require('./../worker');

var URL = typeof window !== 'undefined' && ( window.URL || window.webkitURL );

var prototypoWorker;

module.exports = function init( opts ) {
	var constructor = this;

	// the worker can be loaded from a file by specifying its url (dev
	// environment), or by building it as a blob, from a require'd file.
	if ( !opts.workerUrl ) {
		opts.workerUrl = URL.createObjectURL(
			new Blob([
				// IIFE power
				'(' + shell.toString() + ')();' +
				// For some reason [object Object] is appended to the source
				// by Firefox when the worker is created, which causes the
				// script to throw without the following comment.
				'//',
				{ type: 'text/javascript' }
			])
		);
	}

	// create the worker
	return new Promise(function( resolve ) {
		if (prototypoWorker) {
			opts.worker = prototypoWorker
			resolve();
		} else {
			var worker = opts.worker = new SharedWorker( opts.workerUrl),
				handler = function initWorker() {
					worker.port.removeEventListener('message', handler);
					resolve();
				};
			prototypoWorker = worker;

			worker.port.onmessage = handler;
			worker.port.start();

			var data = {
				exportPort: opts.export || false,
				deps: Array.isArray( opts.workerDeps ) ?
					opts.workerDeps :
					[ opts.workerDeps ]
			};

			worker.port.postMessage( data );
		}
	}).then(function() {
		return new constructor( opts );
	});
};
