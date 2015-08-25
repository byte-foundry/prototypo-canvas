function prepareWorker() {
	function runWorker() {
		var font,
			handlers = {},
			fontsMap = {},
			currValues,
			currSubset = [],
			//jscs:disable
			// template = function svg(_font, glyphs) {
			// 	return '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC\n\t"-//W3C//DTD SVG 1.1//EN"\n\t"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg">\n<metadata></metadata>\n<defs>\n<font id="' + _font.ot.familyName.replace(' ', '') + '" horiz-adv-x="1191">\n<font-face\n\tfont-family="' + _font.ot.familyName + '"\n\tfont-weight="500"\n\tfont-stretch="normal"\n\tunits-per-em="1024"\n\tascent="' + _font.fontinfo.ascender + '"\n\tdescent="' + _font.fontinfo.descender + '" />\n<missing-glyph horiz-adv-x="500" />\n<glyph name=".notdef" unicode="&#xd;" horiz-adv-x="681" />\n' + glyphs.map(function (glyph) {
			// 		// exclude .notdef, which is included above with valid unicode
			// 		return glyph.ot.unicode === 0 ? '' : '<glyph\n\t\tname="' + glyph.name + '"\n\t\tunicode="&#' + glyph.ot.unicode + ';"\n\t\thoriz-adv-x="' + glyph.ot.advanceWidth + '"\n\t\td="' + glyph.svgData + '"/>';
			// 	}).join('\n') + '\n</font>\n</defs>\n</svg>';
			// },
			//jscs:enable
			translateSubset = function() {
				if ( !currSubset.length ) {
					return;
				}

				font.subset = currSubset.map(function( glyph ) {
					return font.charMap[ glyph.ot.unicode ];
				}).filter(function( glyph ) { return glyph; });

				currSubset = font.subset;
			};

		prototypo.paper.setup({
			width: 1024,
			height: 1024
		});

		// mini router
		self.onmessage = function(e) {
			if ( e.data.type && e.data.type in handlers ) {
				handlers[ e.data.type ]( e.data.data, e.data.name );
			}
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

			font.update( currValues );
			// the following is required so that the globalMatrix of glyphs
			// takes the font matrix into account. I assume this is done in the
			// main thread when calling view.update();
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

			// Recreate the correct font.ot.glyphs array, without touching the
			// ot commands
			font.updateOTCommands([]);
			var buffer = font.ot.toBuffer();
			self.postMessage( buffer, [ buffer ] );
		};

		handlers.otfFont = function() {
			// force-update of the whole font, ignoring the current subset
			var allChars = font.getGlyphSubset( false );
			font.update( currValues, allChars );

			font.updateOTCommands( allChars );
			var buffer = font.ot.toBuffer();
			self.postMessage( buffer, [ buffer ] );
		};

		// handlers.svgFont = function() {
		// 	// force-update of the whole font, ignoring the current subset
		// 	var allChars = font.getGlyphSubset( false );
		// 	font.update( currValues, allChars );
		//
		// 	font.updateSVGData( allChars );
		// 	self.postMessage( template( font, allChars ) );
		// };
	}

	// This is how bundle dependencies are loaded
	if ( typeof global === 'undefined' && 'importScripts' in self ) {
		self.addEventListener('message', function initWorker( e ) {
			self.removeEventListener('message', initWorker);
			self.importScripts( e.data );
			runWorker();
			self.postMessage('ready');
		});
	}
}

// When the worker is loaded from URL, worker() needs to be called explicitely
if ( typeof global === 'undefined' && 'importScripts' in self ) {
	prepareWorker();
} else {
	module.exports = prepareWorker;
}
