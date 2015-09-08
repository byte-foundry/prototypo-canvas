function prepareWorker() {
	function runWorker() {
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
				}).filter(Boolean);

				currSubset = font.subset;
			};

		prototypo.paper.setup({
			width: 1024,
			height: 1024
		});

		// mini router
		self.onmessage = function(e) {
			var result;

			if ( e.data.type && e.data.type in handlers ) {
				result = handlers[ e.data.type ]( e.data.data, e.data.name );

				if ( result === null ) {
					return;
				}

				self.postMessage(
					result,
					result instanceof ArrayBuffer ? [ result ] : undefined );
			}
		};

		handlers.font = function( fontSource, name ) {
			// TODO: this should be done using a memoizing table of limited size
			if ( name in fontsMap ) {
				font = fontsMap[name];
				translateSubset();
				return null;
			}

			var fontObj = JSON.parse( fontSource );

			font = prototypo.parametricFont(fontObj);
			fontsMap[name] = font;

			translateSubset();

			var solvingOrders = {};
			Object.keys( font.glyphMap ).forEach(function(key) {
				solvingOrders[key] = font.glyphMap[key].solvingOrder;
			});

			return solvingOrders;
		};

		handlers.update = function( params ) {
			currValues = params;
			font.update( currValues );
			// the following is required so that the globalMatrix of glyphs
			// takes the font matrix into account. I assume this is done in the
			// main thread when calling view.update();
			font._project._updateVersion++;
			font.updateOTCommands();
			return font.ot.toBuffer();
		};

		handlers.subset = function( set ) {
			var prevGlyphs = currSubset.map(function( glyph ) {
				return glyph.name;
			});
			font.subset = set;
			currSubset = font.subset;

			if ( !currValues ) {
				return true;
			}

			// search for glyphs *added* to the subset
			currSubset.filter(function( glyph ) {
				return prevGlyphs.indexOf( glyph.name ) === -1;

			// update those glyphs
			}).forEach(function( glyph ) {
				glyph.update( currValues );
				glyph.updateOTCommands();
			});

			// Recreate the correct font.ot.glyphs array, without touching the
			// ot commands
			font.ot.glyphs = font.getGlyphSubset().map(function( glyph ) {
				return glyph.ot;
			});
			return font.ot.toBuffer();
		};

		handlers.otfFont = function() {
			// force-update of the whole font, ignoring the current subset
			var allChars = font.getGlyphSubset( false );
			font.update( currValues, allChars );

			font.updateOTCommands( allChars );
			return font.ot.toBuffer();
		};
	}

	// This is how bundle dependencies are loaded
	if ( typeof global === 'undefined' && 'importScripts' in self ) {
		var handler = function initWorker( e ) {
				self.removeEventListener('message', handler);
				self.importScripts( e.data );
				runWorker();
				self.postMessage('ready');
			};

		self.addEventListener('message', handler);
	}
}

// When the worker is loaded from URL, worker() needs to be called explicitely
if ( typeof global === 'undefined' && 'importScripts' in self ) {
	prepareWorker();
} else {
	module.exports = prepareWorker;
}
