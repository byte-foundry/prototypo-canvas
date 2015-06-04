var canvasEl = document.createElement('canvas'),
	prototypo = window.prototypo,
	paper = prototypo.paper,
	values = {
		xHeight: 500,
		capDelta: 250,
		ascender: 250,
		descender: -250,
		crossbar: 1,
		width: 1,
		slant: 0,
		overshoot: 10,
		thickness: 85,
		_contrast: -1,
		aperture: 1,
		opticThickness: 1,
		curviness: 0.6,
		breakPath: 0,
		axis: 0,
		serifWidth: 65,
		midWidth: 1,
		serifHeight: 20,
		serifMedian: 1,
		serifCurve: 15,
		serifRoundness: 1,
		serifArc: 0,
		serifTerminal: 0,
		serifTerminalCurve: 1,
		spurHeight: 1,
		serifRotate: 1,
		capHeight: 750,
		contrast: 1,
		ascenderHeight: 750,
		spacing: 1.1
	},
	// alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz';
	alphabet = 'A';

canvasEl.width = 1024;
canvasEl.height = 1024;

document.getElementById('main').appendChild( canvasEl );

window.PrototypoCanvas.load({
	canvas: canvasEl,
	fontUrl: 'node_modules/genese.ptf/dist/font.json',
	prototypoUrl: document.querySelector('script[src*=prototypo\\.]').src

}).then(function( instance ) {
	instance.update( values );
	instance.subset( alphabet );
	instance.displayGlyph( 'A_cap' );
	$('#glyphList').val('A_cap');
	$('#sample').val( alphabet );

	paper.view.update();

	$('#zoomIn').on('click', function() {
		instance.zoomIn();
	});
	$('#zoomOut').on('click', function() {
		instance.zoomOut();
	});
	$('#zoomReset').on('click', function() {
		instance.zoom(1);
	});
	$('#glyphList').on('change', function( event ) {
		instance.displayGlyph( event.target.value );
	});
	$('#thickness').on('input', function( event ) {
		values.thickness = +event.target.value;
		instance.update( values );
	});
	$('#export').on('click', function() {
		instance.download();
	});
	$('#sample').on('input', function( event ) {
		instance.subset( event.target.value );
	});
});
