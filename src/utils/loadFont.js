// switch the current glyph with one that has the same name
// in the next font, or one with the same unicode, or .undef
function translateGlyph( self ) {
	if ( !self.currGlyph ) {
		return;
	}

	self.displayGlyph(
		self.font.glyphMap[ self.currGlyph.name ] ||
		self.font.charMap[ self.currGlyph.ot.unicode ] ||
		self.font.glyphMap[ '.undef' ]
	);
}

module.exports = function loadFont( name, fontSource ) {
	// ignore the job currently running, empty the queue and clear update values
	this.emptyQueue();
	this.latestValues = this.latestRafValues = null;

	// TODO: memoizing should have a limited size!
	if ( name in this.fontsMap ) {
		this.font = this.fontsMap[name];
		translateGlyph( this );
		this.worker.postMessage({
			type: 'font',
			name: name
		});
		return Promise.resolve( this.font );
	}

	return ( fontSource.charAt(0) === '{' ?
		Promise.resolve( fontSource ) :
		// fetch the resource from URL
		fetch( fontSource )

	).then(function( result ) {
		return typeof result === 'string' || result.text();

	}).then(function( result ) {
		if ( result !== true ) {
			fontSource = result;
		}

		return new Promise(function( resolve ) {
			var fontObj = JSON.parse( fontSource ),
				handler = function( e ) {
					if ( e.data.type !== 'solvingOrders' ) {
						return;
					}
					this.worker.removeEventListener('message', handler);

					// merge solvingOrders with the source
					Object.keys( e.data.data ).forEach(function(key) {
						if ( fontObj.glyphs[key] ) {
							fontObj.glyphs[key].solvingOrder = e.data.data[key];
						}
					});

					this.font = prototypo.parametricFont( fontObj );
					this.fontsMap[name] = this.font;
					translateGlyph( this );

					resolve( this );
				}.bind(this);

			this.worker.addEventListener('message', handler);

			this.worker.postMessage({
				type: 'font',
				name: name,
				data: fontSource
			});

		}.bind(this));
	}.bind(this));
};
