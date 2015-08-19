var shell = require('./../worker');

var URL = typeof window !== 'undefined' && ( window.URL || window.webkitURL );

module.exports = function init( opts ) {
	var PrototypoCanvas = this;

	return ( opts.prototypoSource ?
		Promise.resolve( opts.prototypoSource ) :
		// fetch the resource from URL
		fetch( opts.prototypoUrl )

	).then(function( result ) {
		return typeof result === 'string' || result.text();

	}).then(function( result ) {
		if ( result !== true ) {
			opts.prototypoSource = result;
		}

		// the worker can be loaded from a file by specifying its url (dev
		// environment), or by building it as a blob, from a require'd file.
		if ( opts.workerUrl ) {
			// The search fragment of workerUrl must include prototypo.js URL
			opts.workerUrl +=
				'?bundleurl=' + encodeURIComponent( opts.prototypoUrl );

		} else {
			opts.workerUrl = URL.createObjectURL(
				new Blob([
					opts.prototypoSource + ';\n\n' +
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

	}).then(function() {
		// create the worker
		return new Promise(function( resolve ) {
			var worker = opts.worker = new Worker( opts.workerUrl );

			worker.onmessage = function(e) {
				if ( e.data.type === 'ready' ) {
					resolve();
				}
			};
		});

	}).then(function() {
		return new PrototypoCanvas( opts );
	});
};
