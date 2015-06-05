module.exports = function worker() {
	'prototypo.js';

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
console.profile('a');
		font.update( params );
console.profileEnd('a');
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
};
