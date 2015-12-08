// this needs to be manually converted and inlined in worker.js
// until I figure out a way to require stuff inside that worker.js
module.exports = function svg( _font, glyphs ) {
	var enFamilyName = _font.ot.getEnglishName('fontFamily');
	return (
`<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC
	"-//W3C//DTD SVG 1.1//EN"
	"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg">
<metadata></metadata>
<defs>
<font id="${ enFamilyName.replace(' ', '') }" horiz-adv-x="1191">
<font-face
	font-family="${ enFamilyName }"
	font-weight="500"
	font-stretch="normal"
	units-per-em="1024"
	ascent="${ _font.fontinfo.ascender }"
	descent="${ _font.fontinfo.descender }" />
<missing-glyph horiz-adv-x="500" />
<glyph name=".notdef" unicode="&#xd;" horiz-adv-x="681" />
${ glyphs.map(function(glyph) {
	// exclude .notdef, which is included above with valid unicode
	return glyph.ot.unicode === 0 ? '' : `<glyph
		name="${ glyph.name }"
		unicode="&#${ glyph.ot.unicode };"
		horiz-adv-x="${ glyph.ot.advanceWidth }"
		d="${ glyph.svgData }"/>`;
}).join('\n') }
</font>
</defs>
</svg>` );
};

// function svg( _font, glyphs ) {
// 	return [
// 		'<?xml version="1.0" standalone="no"?>',
// 		'<!DOCTYPE svg PUBLIC',
// 		'	"-//W3C//DTD SVG 1.1//EN"',
// 		'	"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
// 		'<svg xmlns="http://www.w3.org/2000/svg">',
// 		'<metadata></metadata>',
// 		'<defs>',
// 		'<font id="' + font.ot.familyName.replace(' ', '') +
// 			'" horiz-adv-x="1191">',
// 		'<font-face',
// 		'	font-family="' + font.ot.familyName + '"',
// 		'	font-weight="500"',
// 		'	font-stretch="normal"',
// 		'	units-per-em="1024"',
// 		'	ascent="' + font.fontinfo.ascender + '"',
// 		'	descent="' + font.fontinfo.descender + '" />',
// 		'<missing-glyph horiz-adv-x="500" />',
// 		'<glyph name=".notdef" unicode="&#xd;" horiz-adv-x="681" />',
// 		glyphs.map(function(glyph) {
// 			// exclude .notdef, which is included above with valid unicode
// 			return glyph.ot.unicode === 0 ? '' : [
// 				'	<glyph',
// 				'		name="' + glyph.name + '"',
// 				'		unicode="&#' + glyph.ot.unicode + ';"',
// 				'		horiz-adv-x="' + glyph.ot.advanceWidth + '"',
// 				'		d="' + glyph.svgData + '"/>'
// 			].join('\n');
// 		}).join('\n'),
// 		'</font>',
// 		'</defs>',
// 		'</svg>'
// 	].join('\n');
// }
