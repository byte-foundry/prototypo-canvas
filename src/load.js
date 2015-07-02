var shell = require('./worker'),
	assign = require('es6-object-assign').assign;

var _ = { assign: assign },
	URL = global.URL || global.webkitURL;

function load( opts ) {
	var PrototypoCanvas = this;

	opts = _.assign({
		fontUrl: 'font.json',
		prototypoUrl: 'prototypo.js'
	}, opts);

	// if the sources are provided
	return Promise.all([
		!opts.fontSource && opts.fontUrl,
		!opts.prototypoSource && opts.prototypoUrl
	].map(function( url ) {
		// only fetch the resources if we have just the url, not the source
		return url && fetch( url );

	})).then(function( results ) {
		// parse fetched resources
		return Promise.all([
			results[0] && results[0].text(),
			results[1] && results[1].text()
		]);

	}).then(function( results ) {
		if ( results[0] ) {
			opts.fontSource = results[0];
		}
		if ( results[1] ) {
			opts.prototypoSource = results[1];
		}

		opts.fontObj = JSON.parse( opts.fontSource );
		// the worker can be created by specifying the URL of the complete
		// file (dev environment), or by creating
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

		// create the worker
		return new Promise(function( resolve ) {
			var worker = new Worker( opts.workerUrl );

			worker.onmessage = function(e) {
				// load the font
				if ( e.data.type === 'ready' ) {
					worker.postMessage({
						type: 'font',
						data: opts.fontSource
					});

				// reuse the solvingOrders computed in the worker (this is a
				// fairly heavy operation, better doing it only once,
				// asynchronously)
				} else if ( e.data.type === 'solvingOrders' ) {
					opts.worker = worker;
					// merge solvingOrders with the source
					Object.keys( e.data.data ).forEach(function(key) {
						if ( e.data.data[key] ) {
							opts.fontObj.glyphs[key].solvingOrder =
								e.data.data[key];
						}
					});

					// We're done with the asynchronous stuff!
					resolve();
				}
			};
		});
	}).then(function() {
		return new PrototypoCanvas( opts );
	});
}

module.exports = load;
