var cloneDeep		= require('lodash/cloneDeep');
var _ = { cloneDeep: cloneDeep };
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

module.exports = function loadFont( name, fontSource, db ) {
	// ignore the job currently running, empty the queue and clear update values
	this.emptyQueue();
	this.latestValues = this.latestRafValues = null;

	// TODO: memoizing should have a limited size!
	if ( name in this.fontsMap ) {
		this.font = this.fontsMap[name];
		if (this.font.project !== this.project) {
			this.font._setProject(this.project);
			this.project.activeLayer.addChild(this.font);
		}
		this.font.resetComponents();
		translateGlyph( this );
		this.worker.port.postMessage({
			type: 'font',
			name: name,
			db: db
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
					if ( typeof e.data !== 'object' ) {
						return;
					}
					this.worker.port.removeEventListener('message', handler);

					// merge solvingOrders with the source
					Object.keys( e.data.solvingOrders ).forEach(function(key) {
						if ( fontObj.glyphs[key] ) {
							fontObj.glyphs[key].solvingOrder = e.data.solvingOrders[key];
						}
					});

					this.font = prototypo.parametricFont( fontObj );
					this.fontsMap[name] = this.font;
					translateGlyph( this );

					resolve( this );
				}.bind(this);

			this.worker.port.addEventListener('message', handler);

			this.worker.port.postMessage({
				type: 'font',
				name: name,
				db: db,
				data: fontSource
			});

		}.bind(this));
	}.bind(this));
};
