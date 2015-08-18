/* eslint-disable no-mixed-requires */
var expect = require('../node_modules/chai').expect,
	prototypo = global.prototypo = require('../node_modules/prototypo.js'),
	PrototypoCanvas = require('../dist/prototypo-canvas');

describe('prototypo-canvas', function() {
	// before(function() {
	// });

	describe('base functions', function() {
		it('loads correctly', function() {
			expect(prototypo).to.be.a('function');
			expect(PrototypoCanvas).to.be.a('function');
			expect(PrototypoCanvas.init).to.be.a('function');
		});
	});
});
