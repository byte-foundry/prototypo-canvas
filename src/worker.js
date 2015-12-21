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
			font.updateOTCommands();
			var result = font.toArrayBuffer();
			return result;
		};

		handlers.soloAlternate = function( params ) {
			font.setAlternateFor( params.unicode, params.glyphName );

			if (!currValues) {
				return true;
			}

			font.subset = font.subset.map(function( glyph ) {
				return String.fromCharCode(glyph.unicode);
			}).join('');

			var altGlyph = font.glyphMap[params.glyphName];

			altGlyph.update( currValues );
			altGlyph.updateOTCommands();

			// Recreate the correct font.ot.glyphs.glyphs object, without
			// touching the ot commands
			// Recreate the correct font.ot.glyphs.glyphs object, without
			// touching the ot commands
			font.updateOT({ set: undefined });
			return font.toArrayBuffer();
		};

		handlers.alternate = function( params ) {
			if ( params.altList ) {
				Object.keys( params.altList ).forEach(function( unicode ) {
					handlers.soloAlternate({
						unicode: unicode,
						glyphName: params.altList[unicode]
					});
				});
			} else {
				handlers.soloAlternate( params );
			}
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

			// Recreate the correct font.ot.glyphs.glyphs object, without
			// touching the ot commands
			font.updateOT({ set: undefined });
			return font.toArrayBuffer();
		};

		handlers.otfFont = function(data) {
			// force-update of the whole font, ignoring the current subset
			var allChars = font.getGlyphSubset( false );
			var fontValues = data && data.values || currValues;
			font.update( fontValues, allChars );

			font.updateOTCommands( allChars, data && data.merged || false );

			var family = font.ot.familyName;
			var style = font.ot.styleName;

			//TODO: understand why we need to save the familyName and
			//and set them back into the font.ot for it to be able to
			//export multiple font
			font.ot.familyName = data && data.family || 'Prototypo';
			font.ot.styleName = data && data.style || 'regular';

			var result = font.toArrayBuffer();

			font.ot.familyName = family;
			font.ot.styleName = style;

			return result;
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
