if ( typeof global === 'undefined' && 'importScripts' in self ) {
	// When the worker is loaded by URL, the search fragment must include
	// the URL of prototypo.js
	self.importScripts( decodeURIComponent(
		self.location.search.replace(/(\?|&)bundleurl=(.*?)(&|$)/, '$2')
	) );
}

function worker() {
	var font,
		handlers = {},
		fontRegister = {},
		currValues,
		currSubset = [];

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
		var fontObj = JSON.parse( fontSource );

		if ( fontRegister[fontObj.fontinfo.familyName] ) {
			font = fontRegister[fontObj.fontinfo.familyName];
		} else {
			font = prototypo.parametricFont(fontObj);
			fontRegister[fontObj.fontinfo.familyName] = font;
		}

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
		// invalidate the previous subset
		currSubset = [];

		font.update( params );
		// the following is required so that the globalMatrix of glyphs takes
		// the font matrix into account. I assume this is done in the main
		// thread when calling view.update();
		font._project._updateVersion++;
		font.updateOTCommands()
			.addToFonts();
	};

	handlers.subset = function( set ) {
		var prevGlyphs = currSubset.map(function( glyph ) {
			return glyph.name;
		});
		font.subset = set;
		currSubset = font.subset;

		// search for glyphs *added* to the subset
		currSubset.filter(function( glyph ) {
			return prevGlyphs.indexOf( glyph.name ) === -1;

		// update those glyphs
		}).forEach(function( glyph ) {
			glyph.update( currValues );
			glyph.updateOTCommands();
		});

		// Recreate the correct font.ot.glyphs array, without touching the ot
		// commands
		font.updateOTCommands([]);
		font.addToFonts();
	};
}

// When the worker is loaded from URL, worker() needs to be called explicitely
if ( typeof global === 'undefined' && 'importScripts' in self ) {
	worker();
} else {
	module.exports = worker;
}
