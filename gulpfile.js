const gulp		= require('gulp');
const shelter	= require('gulp-shelter')(gulp);

const src = 'src';
const dest = 'dist';
const project = 'prototypo-canvas';

const webpack = 'webpack --devtool source-map';
const dist = `${webpack}`;
const watch = `${webpack} --watch`;
const eslint = `eslint ${src}/**.js test/**.js`;
const browsersync = `browser-sync start --server --files "${dest}/${project}.js, script.js, index.html"`;
const mocha = `mocha-phantomjs test.html`;

shelter({
	dist: {
		dsc: 'generate dist files',
		cmd: dist
	},
	build: {
		dsc: `Lint code, generate ${project}.js and test it`,
		cmd: `${eslint} && ${dist} && ${mocha}`
	},
	serve: {
		dsc: 'Opens index.html and live-reload on changes',
		cmd: `${watch} & ${browsersync}`
	},
	test: {
		dsc: `Build ${project}.js + map and test it`,
		cmd: `${webpack} && ${mocha}`
	}
});
