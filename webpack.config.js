var path = require('path');

module.exports = {
	entry: [ './src/prototypo-canvas.js' ],
	output: {
		path: path.join(__dirname, 'dist'),
		filename: 'prototypo-canvas.js',
		library: 'PrototypoCanvas',
        libraryTarget: 'umd',
	},
	externals: {
		'prototypo.js': 'prototypo'
	},
	node: {
		Buffer: false,
	}
};
