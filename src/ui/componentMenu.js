var prototypo = require('prototypo.js'),
	paper = prototypo.paper;

var blackColor = '#333333';
var greenColor = '#24d390';
var whiteColor = '#fefefe';
var animationFrameLength = 20;
var animationAngleRotation = 180;
var componentItemHeight = 40;
var componentItemMargin = 3;
var componentItemPadding = 12;
var componentListMargin = {
	x: 12,
	y: 5,
};

function ComponentMenu( args ) {
	paper.Group.prototype.constructor.apply( this );

	this.pivot = new paper.Point(0, 0);
	this.position = new paper.Point(0,0);
	this.componentList = args.components;
	this.componentItems = [];
	this.itemGroup = new paper.Group();
	this.pointArg = args.point;
	this.callback = args.callback;

	var factorGen = new EaseInTimer(animationFrameLength);

	if (this.displayComponentList()) {
		this.onFrame = function() {
			var frameFactor = factorGen.getNextFactor();
			var angle = animationAngleRotation * frameFactor;

			if (EaseInTimer.frameCount === animationFrameLength) {
				this.onFrame = undefined;
			}
		}
	}

	var oldDraw = this.draw;
	this.draw = function() {

		if (this.itemGroup.onFrame) {
			this.itemGroup.setMatrix(new paper.Matrix(1 / this.view.zoom, 0, 0, this.itemGroup.scaling.y, this.pointArg.x - componentListMargin.x / this.view.zoom, this.pointArg.y + componentListMargin.y / this.view.zoom));
		}
		else {
			this.itemGroup.setMatrix(new paper.Matrix(1 / this.view.zoom, 0, 0, 1 / this.view.zoom, this.pointArg.x - componentListMargin.x / this.view.zoom, this.pointArg.y + componentListMargin.y / this.view.zoom));
		}
		oldDraw.apply(this, arguments);
	}.bind(this);
}

ComponentMenu.prototype = Object.create(paper.Group.prototype);
ComponentMenu.prototype.constructor = ComponentMenu;

ComponentMenu.prototype.displayComponentList = function() {
	var shouldCreate = this.componentItems.length !== this.componentList.length;

	if (shouldCreate) {
		var self = this;
		var componentItems = [];
		this.componentList.forEach(function(component, i) {
			var position = new paper.Point(0, i * (componentItemHeight + componentItemMargin));
			var item = new ComponentMenuItem({
					point: position,
					text: component,
					container: self,
				});
			componentItems.push(item);
			this.itemGroup.addChild(item);
			item.onClick = function() {
				this.callback(component);
			}.bind(this);
		}.bind(this));
		this.componentItems = componentItems;
	}

	this.itemGroup.applyMatrix = false;
	this.itemGroup.setMatrix(new paper.Matrix(1 / this.view.zoom, 0, 0, 0, this.pointArg.x - componentListMargin.x / this.view.zoom, this.pointArg.y + componentListMargin.y / this.view.zoom));

	var factorGen = new EaseInTimer(animationFrameLength, 0);

	this.itemGroup.onFrame = function() {
		var frameFactor = factorGen.getNextFactor();
		this.itemGroup.setMatrix(new paper.Matrix(1 / this.view.zoom, 0, 0, this.itemGroup.matrix.d + frameFactor / this.view.zoom, this.pointArg.x - componentListMargin.x / this.view.zoom, this.pointArg.y + componentListMargin.y / this.view.zoom));
		if (this.itemGroup.scaling.y >= 1) {
			this.itemGroup.setMatrix(new paper.Matrix(1 / this.view.zoom, 0, 0, 1 / this.view.zoom, this.pointArg.x - componentListMargin.x / this.view.zoom, this.pointArg.y + componentListMargin.y / this.view.zoom));
			this.itemGroup.onFrame = undefined;
		}

	}.bind(this);

	return shouldCreate;
}

ComponentMenu.prototype.removeMenu = function() {
	this.remove();
	this.itemGroup.remove();
}

function ComponentMenuItem( args ) {
	paper.Group.prototype.constructor.apply( this );
	var bg = new paper.Shape.Rectangle(args.point, new paper.Size(200, componentItemHeight));
	bg.fillColor = blackColor;
	this.onMouseEnter = function() {
		bg.fillColor = greenColor;
	}
	this.onMouseLeave = function() {
		bg.fillColor = blackColor;
	}
	this.addChild(bg);

	var text = new paper.PointText(new paper.Point(componentItemPadding, componentItemPadding));
	text.content = args.text;
	text.fontSize = 16;
	text.fillColor = whiteColor;
	text.matrix.d = -1;
	var textContainer = new paper.Group({
		children: [text],
		pivot: new paper.Point(0, 0),
		position: args.point,
	});
	this.addChild(textContainer);
}

ComponentMenuItem.prototype = Object.create(paper.Group.prototype);
ComponentMenuItem.prototype.constructor = ComponentMenu;

function EaseInTimer(animationFrameLength, startValue) {
	this.frameCount = 0;
	this.animationFrameLength = animationFrameLength;
	this.startValue = startValue != undefined ? startValue : -Math.E;
	this.stepFactor = -this.startValue + Math.E
	this.areaMultiplier = 2 * Math.E / this.stepFactor;
}

EaseInTimer.prototype.getNextFactor = function() {
	//tanh is good approximation to ease in ease out function
	//we use d/dx(tanh) = 1 - tanh^2 to compute our diff angle
	//since tanh varies between -1 and 1 we divide the derivative by two
	//so that the angle at the end is animationAngleRotation
	return this.areaMultiplier * (1 - Math.pow(Math.tanh(this.startValue + this.stepFactor * (this.frameCount++ / this.animationFrameLength)), 2)) / 2 * ( this.stepFactor / this.animationFrameLength);
}

module.exports = ComponentMenu;
