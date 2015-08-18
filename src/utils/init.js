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

// function changeFont( opts, values ) {
//
// 	return Promise.all([
// 		!opts.fontSource && opts.fontUrl
// 	].map(function( url ) {
// 		// only fetch the resources if we have just the url, not the source
// 		return url && fetch( url );
//
// 	})).then(function( results ) {
// 		// parse fetched resources
// 		return Promise.all([
// 			results[0] && results[0].text()
// 		]);
//
// 	}).then(function( results ) {
// 		if ( results[0] ) {
// 			opts.fontSource = results[0];
// 		}
//
// 		opts.fontObj = JSON.parse( opts.fontSource );
// 		return new Promise(function( resolve ) {
//
// 			worker.postMessage({
// 				type: 'font',
// 				data: opts.fontSource
// 			});
//
// 			worker.onmessage = function(e) {
// 				// load the font
// 				if ( e.data.type === 'solvingOrders' ) {
// 					opts.worker = worker;
// 					// merge solvingOrders with the source
// 					Object.keys( e.data.data ).forEach(function(key) {
// 						if ( e.data.data[key] ) {
// 							opts.fontObj.glyphs[key].solvingOrder =
// 								e.data.data[key];
// 						}
// 					});
//
// 					// We're done with the asynchronous stuff!
// 					resolve();
// 				}
// 			};
// 		});
// 	}).then(function() {
// 		instance.loadFont( opts );
// 	});
// }

// module.exports = {
// 	init: init,
// 	changeFont: changeFont
// };
