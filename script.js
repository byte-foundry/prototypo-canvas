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
		serifBall: 1,
		capHeight: 750,
		contrast: 1,
		ascenderHeight: 750,
		spacing: 1.1
	},
	alphabet = 'bcdefg';
	// alphabet = 'A';

canvasEl.width = 1024;
canvasEl.height = 1024;

document.getElementById('main').appendChild( canvasEl );

window.PrototypoCanvas.init({
	canvas: canvasEl,
	// comment the following line to test "production mode", where worker is
	// built from source instead of file
	workerUrl: 'src/worker.js',
	prototypoUrl: document.querySelector('script[src*=prototypo\\.]').src
}).then(function( instance ) {
	return instance.loadFont(
		'john-fell', 'node_modules/john-fell.ptf/dist/font.json');

}).then(function( instance ) {
	instance.update( values );
	instance.displayChar( 'a' );
	instance.subset = 'bcdefg';
	$('#glyphList').val('a');
	$('#sample').val( alphabet );
	$('#outline').attr({ checked: false });
	$('#nodes').attr({ checked: false });
	$('#coords').attr({ checked: false });

	$('#zoomIn').on('click', function() {
		instance.zoomIn();
	});
	$('#zoomOut').on('click', function() {
		instance.zoomOut();
	});
	$('#zoomReset').on('click', function() {
		instance.zoom = 1;
	});
	$('#glyphList').on('input', function( event ) {
		if ( event.target.value === '' ) {
			return;
		}

		instance.displayChar( event.target.value );
	});
	$('#thickness').on('input', function( event ) {
		values.thickness = +event.target.value;
		instance.update( values );
	});
	$('#slant').on('input', function( event ) {
		values.slant = +event.target.value;
		instance.update( values );
	});
	$('#export').on('click', function() {
		instance.download();
	});
	$('#sample').on('input', function( event ) {
		instance.subset = event.target.value;
	});
	$('#outline').on('change', function( event ) {
		instance.fill = !$(event.target).is(':checked');
	});
	$('#nodes').on('change', function( event ) {
		instance.showNodes = $(event.target).is(':checked');
	});
	$('#coords').on('change', function( event ) {
		instance.showCoords = $(event.target).is(':checked');
	});
	$('#load-venus').on('click', function() {
		instance.loadFont(
			'grotesk', 'node_modules/venus.ptf/dist/font.json'
		).then(function() {
			instance.update( values );
			$('#sample')[0].style.fontFamily = '"Prototypo Grotesk"';
		});
	});
	$('#load-john').on('click', function() {
		instance.loadFont(
			'john-fell', 'node_modules/john-fell.ptf/dist/font.json'
		).then(function() {
			instance.update( values );
			$('#sample')[0].style.fontFamily = '"Prototypo John Fell"';
		});

	});

	paper.view.update();
});
