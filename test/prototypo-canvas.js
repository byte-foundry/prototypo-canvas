describe('prototypo-canvas', function() {
	describe('base functions', function() {
		it('loads correctly', function() {
			expect(prototypo).to.be.an('object');
			expect(PrototypoCanvas).to.be.a('function');
			expect(PrototypoCanvas.init).to.be.a('function');
		});
	});
});
