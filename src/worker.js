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
				{
					test: 20,
					value: fontOt.usWeightClasses.THIN,
				},
				{
					test: 40,
					value: fontOt.usWeightClasses.EXTRA_LIGHT,
				},
				{
					test: 60,
					value: fontOt.usWeightClasses.LIGHT,
				},
				{
					test: 90,
					value: fontOt.usWeightClasses.NORMAL,
				},
				{
					test: 110,
					value: fontOt.usWeightClasses.MEDIUM,
				},
				{
					test: 130,
					value: fontOt.usWeightClasses.SEMI_BOLD,
				},
				{
					test: 150,
					value: fontOt.usWeightClasses.BOLD,
				},
				{
					test: 170,
					value: fontOt.usWeightClasses.EXTRA_BOLD,
				},
				{
					test: 190,
					value: fontOt.usWeightClasses.BLACK,
				},
			];

			var widthChooser = [
				{
					test: 0.5,
					value: fontOt.usWidthClasses.ULTRA_CONDENSED,
				},
				{
					test: 0.625,
					value: fontOt.usWidthClasses.EXTRA_CONDENSED,
				},
				{
					test: 0.75,
					value: fontOt.usWidthClasses.CONDENSED,
				},
				{
					test: 0.875,
					value: fontOt.usWidthClasses.SEMI_CONDENSED,
				},
				{
					test: 1,
					value: fontOt.usWidthClasses.MEDIUM,
				},
				{
					test: 1.125,
					value: fontOt.usWidthClasses.SEMI_EXPANDED,
				},
				{
					test: 1.25,
					value: fontOt.usWidthClasses.EXPANDED,
				},
				{
					test: 1.50,
					value: fontOt.usWidthClasses.EXTRA_EXPANDED,
				},
				{
					test: 2,
					value: fontOt.usWidthClasses.ULTRA_CONDENSED,
				},
			]

			weightChooser.forEach(function(weightObj) {
				if (values.thickness > weightObj.test) {
					fontOt.os2Values.weightClass = weightObj.value;
				}
			});

			widthChooser.forEach(function(widthObj) {
				if (values.thickness > widthObj.test) {
					fontOt.os2Values.widthClass = widthObj.value;
				}
			});
			
			var fsSel = 0;
			if (values.slant > 0 ) {
				fsSel = fsSel | fontOt.fsSelectionValues.ITALIC;
			}

			if (fontOt.os2Values.weightClass > fontOt.usWeightClasses.NORMAL) {
				fsSel = fsSel | fontOt.fsSelectionValues.BOLD;
			}

			if (fsSel === 0) {
				fsSel = fontOt.fsSelectionValues.REGULAR;
			}

			fontOt.os2Values.fsSelection = fsSel;
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

			//TODO: understand why we need to save the familyName and
			//and set them back into the font.ot for it to be able to
			//export multiple font
			var variantName = data && data.style.toLowerCase() || 'regular';
			variantName = variantName.charAt(0).toUpperCase() + variantName.slice(1);
			font.ot.names.fontFamily.en = data && data.family || 'Prototypo';
			font.ot.names.fontSubfamily.en = variantName;
			font.ot.names.preferredFamily = font.ot.names.fontFamily;
			font.ot.names.preferredSubfamily = font.ot.names.fontSubFamily;
			font.ot.names.postScriptName.en = font.ot.names.fontFamily.en + '-' + font.ot.names.fontSubfamily.en;
			font.ot.names.uniqueID = {
				en:'Prototypo: ' + font.ot.names.fontFamily.en + ' ' + font.ot.names.fontSubfamily.en + ':2016',
			}
			font.ot.names.fullName.en = font.ot.names.fontFamily.en + ' ' + font.ot.names.fontSubfamily.en; 
			font.ot.names.version.en = 'Version 1.0';
			fillOs2Values(font.ot, fontValues);

			var result = font.toArrayBuffer();

			font.ot.names.fontFamily.en = family;
			font.ot.names.fontSubfamily.en = style;
			font.ot.names.fullName.en = fullName;

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
