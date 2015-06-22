if ( 'importScripts' in self ) {
	// When the worker is loaded by URL, the search fragment must include
	// the URL of prototypo.js
	self.importScripts( decodeURIComponent(
		self.location.search.replace(/(\?|&)bundleurl=(.*?)(&|$)/, '$2')
	) );
}

function worker() {
	var font,
		handlers = {},
		currValues;

	self.postMessage({ type: 'ready' });

	prototypo.paper.setup({
		width: 1024,
		height: 1024
	});

	// Overwrite addToFonts to send the buffer over to the UI
	prototypo.paper.Font.prototype.addToFonts = function() {
		var buffer = this.ot.toBuffer();
		self.postMessage( buffer, [ buffer ] );
	};

	// mini router
	self.onmessage = function(e) {
		handlers[ e.data.type ]( e.data.data );
	};

	handlers.font = function( fontSource ) {
		font = prototypo.parametricFont( JSON.parse( fontSource ) );
		var solvingOrders = {};
		Object.keys( font.glyphMap ).forEach(function(key) {
			solvingOrders[key] = font.glyphMap[key].solvingOrder;
		});

		self.postMessage({
			type: 'solvingOrders',
			data: solvingOrders
		});
	};

	handlers.update = function( params ) {
		currValues = params;

		font.update( params );

		font.updateOTCommands()
			.addToFonts();
	};

	handlers.subset = function( string ) {
		var prevSubset = font.subset || Object.keys( font.charMap );
		font.subset = string;
		var currSubset = font.subset || Object.keys( font.charMap );

		// search for chars *added* to the subset
		currSubset.filter(function( code ) {
			return prevSubset.indexOf( code ) === -1;

		// update those glyphs
		}).forEach(function( code ) {
			if ( font.charMap[code] ) {
				font.charMap[code].update( currValues );
				font.updateOTCommands();
			}
		});

		font.addToFonts();
	};
}

// When the worker is loaded from URL, worker() needs to be called explicitely
if ( 'importScripts' in self ) {
	worker();
} else {
	module.exports = worker;
}
