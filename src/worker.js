var ports = [],
	exportPorts = [],
	font,
	originSubset = {},
	currValues,
	currName,
	currSubset = [],
	arrayBufferMap = {},
	worker = self,
	fontsMap = {},
	prototypoObj,
	translateSubset = function() {
		if ( !currSubset.length ) {
			return;
		}

		font.subset = currSubset.map(function( glyph ) {
			return font.charMap[ glyph.ot.unicode ];
		}).filter(Boolean);

		currSubset = font.subset;
	};

function subset( eData ) {
	var set = eData.data,
		add = eData.add,
		origin = eData.origin || 'native';

	var prevGlyphs = currSubset.map(function( glyph ) {
		return glyph.name;
	});
	if (add) {
		originSubset[origin] = set + originSubset[origin];
	} else {
		originSubset[origin] = set;
	}

	if ( origin ) {
		var currentStringSubset = Object
		.keys(originSubset)
		.map(function( key ) {
			return originSubset[key];
		}).join('');
		font.subset = currentStringSubset + set;
	} else {
		font.subset = set;
	}
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
}

function runSharedWorker(self) {
	var handlers = {};
	self.addEventListener('message', function(e) {
		var result;

		if ( e.data.type && e.data.type in handlers ) {
			result = handlers[ e.data.type ]( e.data );

			if ( result === null ) {
				return;
			}

			arrayBufferMap[currName] = result;

			ports.forEach(function(port) {
				port.postMessage(
					result
				);
			});

			exportPorts.forEach(function(port) {
				port.postMessage(
					[ result, currName ]
				);
			});
		}
	});

	handlers.fontData = function( eData) {
		var name = eData.name;

		self.postMessage(
			[ arrayBufferMap[name], name ]
		);
		return null;
	}

	handlers.subset = subset;
}

function runWorker(self) {
	var handlers = {};

	prototypoObj.paper.setup({
		width: 1024,
		height: 1024
	});

	// mini router
	self.addEventListener('message', function(e) {
		var result;

		if ( e.data.type && e.data.type in handlers ) {
			result = handlers[ e.data.type ]( e.data );

			if ( result === null ) {
				return;
			}

			arrayBufferMap[currName] = result;

			ports.forEach(function(port) {
				port.postMessage(
					result
				);
			});

			exportPorts.forEach(function(port) {
				port.postMessage(
					[ result, currName ]
				);
			});
		}
	});

	handlers.closeAll = function() {
		ports.splice(ports.indexOf(self), 1);

		if (ports.length === 0) {
			worker.close();
		}
	}

	handlers.font = function( eData ) {
		var fontSource = eData.data,
			templateName = eData.name,
			name = eData.db;

		//reset currValues to avoid using old values stored in the shared worker
		currValues = undefined;

		// TODO: this should be done using a memoizing table of limited size
		currName = name;
		if ( templateName in fontsMap ) {
			font = fontsMap[templateName];
			translateSubset();
			return null;
		}

		var fontObj = JSON.parse( fontSource );

		font = prototypoObj.parametricFont(fontObj);
		fontsMap[templateName] = font;

		translateSubset();

		var solvingOrders = {};
		Object.keys( font.glyphMap ).forEach(function(key) {
			solvingOrders[key] = font.glyphMap[key].solvingOrder;
		});

		return solvingOrders;
	};

	handlers.update = function( eData ) {
		var params = eData.data;

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

	handlers.alternate = function( eData ) {
		var params = eData.data;

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

	handlers.subset = subset;

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

	handlers.otfFont = function( eData ) {
		var data = eData.data;
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

function prepareWorker(self) {

	// This is how bundle dependencies are loaded
	if ( typeof global === 'undefined' && importScripts ) {
		var handler = function initWorker( e ) {
				self.removeEventListener('message', handler);
				if (!prototypoObj) {
					importScripts( e.data.deps );
					prototypoObj = prototypo;
				}
				if ( e.data.exportPort ) {
					exportPorts.push(self);

					//If there is no producer we do not launch the export port
					if (ports.length === 0) {
						self.shouldBeLaunchedLater = true;
					} else {
						runSharedWorker(self);
						self.postMessage('ready');
					}

				} else {
					ports.push(self);
					runWorker(self);

					exportPorts.forEach(function( port ) {
						if (port.shouldBeLaunchedLater) {
							runSharedWorker(port);
							port.postMessage('ready');
						}
					});
					self.postMessage('ready');
				}
			};

		self.addEventListener('message', handler);
	}
}

onconnect = function(e) {
	var port = e.ports[0];
	prepareWorker(port);

	port.start();
};
