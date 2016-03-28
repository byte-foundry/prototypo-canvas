function prepareWorker(self) {
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

		function fillOs2Values(fontOt, values) {
			var weightChooser = [
				{ test: 20,		value: 'THIN' },
				{ test: 40,		value: 'EXTRA_LIGHT' },
				{ test: 60,		value: 'LIGHT' },
				{ test: 90,		value: 'NORMAL' },
				{ test: 110,	value: 'MEDIUM' },
				{ test: 130,	value: 'SEMI_BOLD' },
				{ test: 150,	value: 'BOLD' },
				{ test: 170,	value: 'EXTRA_BOLD' },
				{ test: 190,	value: 'BLACK' }
			];

			var widthChooser = [
				{ test: 0.5,	value: 'ULTRA_CONDENSED' },
				{ test: 0.625,	value: 'EXTRA_CONDENSED' },
				{ test: 0.75,	value: 'CONDENSED' },
				{ test: 0.875,	value: 'SEMI_CONDENSED' },
				{ test: 1,		value: 'MEDIUM' },
				{ test: 1.125,	value: 'SEMI_EXPANDED' },
				{ test: 1.25,	value: 'EXPANDED' },
				{ test: 1.50,	value: 'EXTRA_EXPANDED' },
				{ test: 2,		value: 'ULTRA_CONDENSED' }
			]

			weightChooser.forEach(function(weightObj) {
				if ( values.thickness > weightObj.test ) {
					fontOt.tables.os2.weightClass = (
						fontOt.usWeightClasses[ weightObj.value ]
					);
				}
			});

			widthChooser.forEach(function(widthObj) {
				if ( values.width > widthObj.test ) {
					fontOt.tables.os2.widthClass = (
						fontOt.usWidthClasses[ widthObj.value ]
					);
				}
			});

			var fsSel = 0;
			if (values.slant > 0 ) {
				fsSel = fsSel | fontOt.fsSelectionValues.ITALIC;
			}

			if (fontOt.tables.os2.weightClass > fontOt.usWeightClasses.NORMAL) {
				fsSel = fsSel | fontOt.fsSelectionValues.BOLD;
			}

			if (fsSel === 0) {
				fsSel = fontOt.fsSelectionValues.REGULAR;
			}

			fontOt.tables.os2.fsSelection = fsSel;
		}

		handlers.otfFont = function(data) {
			// force-update of the whole font, ignoring the current subset
			var allChars = font.getGlyphSubset( false );
			var fontValues = data && data.values || currValues;
			font.update( fontValues, allChars );

			font.updateOTCommands( allChars, data && data.merged || false );

			var family = font.ot.names.fontFamily.en;
			var style = font.ot.names.fontSubfamily.en;
			var fullName = font.ot.names.fullName.en;
			var names = font.ot.names;

			//TODO: understand why we need to save the familyName and
			//and set them back into the font.ot for it to be able to
			//export multiple font
			var variantName =
				( data && data.style ? data.style.toLowerCase() : 'regular' )
				.replace(/^./, function(a) { return a.toUpperCase(); });
			names.fontFamily.en = data && data.family || 'Prototypo';
			names.fontSubfamily.en = variantName;
			names.preferredFamily = names.fontFamily;
			names.preferredSubfamily = names.fontSubFamily;
			names.postScriptName.en =
				names.fontFamily.en + '-' + names.fontSubfamily.en;
			names.uniqueID = { en: (
				'Prototypo: ' +
				names.fontFamily.en +
				' ' +
				names.fontSubfamily.en +
				':2016'
			) };
			names.fullName.en =
				names.fontFamily.en + ' ' + names.fontSubfamily.en;
			names.version.en = 'Version 1.0';
			fillOs2Values(font.ot, fontValues);

			var result = font.toArrayBuffer();

			names.fontFamily.en = family;
			names.fontSubfamily.en = style;
			names.fullName.en = fullName;

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

debugger;
onconnect = function(e) {
	debugger;
	var port = e.ports[0];

	prepareWorker(port);

	port.start();
};

// When the worker is loaded from URL, worker() needs to be called explicitely
//if ( typeof global === 'undefined' && 'importScripts' in self ) {
//	prepareWorker();
//} else {
//	module.exports = prepareWorker;
//}
