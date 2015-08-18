module.exports = function( font ) {
	return (
`<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC
	"-//W3C//DTD SVG 1.1//EN"
	"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg">
<metadata></metadata>
<defs>
<font id="${ font.ot.familyName }" horiz-adv-x="1191">
<font-face
	units-per-em="1024"
	ascent="${ font.fontinfo.ascender }"
	descent="${ font.fontifo.descender }" />
<missing-glyph horiz-adv-x="500" />
<glyph unicode="&#xd;" horiz-adv-x="681" />
${ font.glyphs.forEach(function(glyph) {
	return `<glyph
		unicode="&#${ glyph.ot.unicode }};"
		horiz-adv-x="${ glyph.ot.advanceWidth }"
		d="${ glyph.svgData }"/>`;
}) }
</font>
</defs>
</svg>` );
};
