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
		fontsMap = {},
		currValues,
		currSubset = [],
		translateSubset = function() {
			if ( !currSubset.length ) {
				return;
			}

			font.subset = currSubset.map(function( glyph ) {
				return font.charMap[ glyph.ot.unicode ];
			}).filter(function( glyph ) { return glyph; });

			currSubset = font.subset;
		};

	self.postMessage({ type: 'ready' });

	prototypo.paper.setup({
		width: 1024,
		height: 1024
	});

	// mini router
	self.onmessage = function(e) {
		handlers[ e.data.type ]( e.data.data, e.data.name );
	};

	handlers.font = function( fontSource, name ) {
		// TODO: this should be done using a memoizing table of limited size
		if ( name in fontsMap ) {
			font = fontsMap[name];
			translateSubset();
			return;
		}

		var fontObj = JSON.parse( fontSource );

		font = prototypo.parametricFont(fontObj);
		fontsMap[name] = font;

		translateSubset();

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
		// Why did I do that?
		// // invalidate the previous subset
		// currSubset = [];

		font.update( params );
		// the following is required so that the globalMatrix of glyphs takes
		// the font matrix into account. I assume this is done in the main
		// thread when calling view.update();
		font._project._updateVersion++;
		font.updateOTCommands();
		var buffer = font.ot.toBuffer();
		self.postMessage( buffer, [ buffer ] );
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
		var buffer = font.ot.toBuffer();
		self.postMessage( buffer, [ buffer ] );
	};
}

// When the worker is loaded from URL, worker() needs to be called explicitely
if ( typeof global === 'undefined' && 'importScripts' in self ) {
	worker();
} else {
	module.exports = worker;
}
