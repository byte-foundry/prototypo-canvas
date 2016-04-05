var $ = jQuery,
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
		_contrastExtremity: -1,
		aperture: 1,
		apertureTop: 1,
		apertureBottom: 1,
		curviness: 0.6,
		opticThickness: 1,
		breakPath: 1,
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
		serifBall: 1
	},
	char = 'A',
	alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

$('#glyphList').val( char );
$('#sample').val( alphabet );
$('#outline').attr({ checked: false });
$('#nodes').attr({ checked: false });
$('#coords').attr({ checked: false });
$('#profile').attr({ checked: false });

window.PrototypoCanvas.init({
	canvas: document.getElementById('canvas'),
	// comment the following line to test "production mode", where worker is
	// built from source instead of file
	workerUrl: 'src/worker.js',
	workerDeps: document.querySelector('script[src*=prototypo\\.]').src,
	// uncomment and customize only when using a local version of Glyphr
	glyphrUrl: 'http://localhost:8080/dev/Glyphr_Studio.html'
}).then(function( instance ) {
	return instance.loadFont(
		'john-fell', 'node_modules/john-fell.ptf/dist/font.json');

}).then(function( instance ) {
	instance.displayChar( char );
	instance.subset = alphabet;
	instance.update( values );

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
	$('#exportm').on('click', function() {
		instance.download( false, undefined, true );
	});
	$('#exportv').on('click', function() {
		values.slant = 0;
		instance.download(function() {
			values.slant = 45;
			instance.download(null, { style: 'italic' }, false, values);

		}, { style: 'regular' }, false, values);
	});
	$('#glyphr').on('click', function() {
		instance.openInGlyphr();
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
	var fontsMap = {
		'venus': 'Prototypo Grotesk',
		'john-fell': 'Prototypo John Fell',
		'elzevir': 'Prototypo Elzevir'
	};
	$('#load-font').on('change', function() {
		var val = this.value;
		instance.loadFont(
			val, 'node_modules/' + val + '.ptf/dist/font.json'
		).then(function() {
			instance.update( values );
			$('#sample')[0].style.fontFamily = '"' + fontsMap[val] + '"';
		});
	});
	var $perfs = $('#perfs'),
		frameRequest,
		workerProfile;
	function updateLoop() {
		frameRequest = window.requestAnimationFrame(updateLoop);

		values.thickness = 30 + Math.random() * 150;
		// update only the worker
		instance.enqueue({
			type: 'update',
			data: values,
			callback: function() {
				workerProfile.count++;
				workerProfile.end = performance.now();
				$perfs.text( ( workerProfile.end - workerProfile.start ) /
					workerProfile.count );
			}
		});
	}
	$('#profile').on('change', function( event ) {
		if ( $(event.target).is(':checked') ) {
			workerProfile = {
				start: performance.now(),
				count: 0
			};
			updateLoop();

		} else {
			window.cancelAnimationFrame(frameRequest);
		}
	});

	paper.view.update();
});
