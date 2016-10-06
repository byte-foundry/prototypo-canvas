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

function ComponentMenu( args ) {
	paper.Group.prototype.constructor.apply( this );

	this.pivot = new paper.Point(0, 0);
	this.matrix.d = -1;
	this.position = new paper.Point(0,0);
	this.componentList = args.components;
	this.anchorPoint = args.point;
	this.componentItems = [];
	this.itemGroup = new paper.Group();
	this.pointArg = args.point;
	this.callback = args.callback;

	var circle = new paper.Shape.Circle(new paper.Point(0, 0), 16.4);
	circle.fillColor = blackColor;
	circle.matrix.ty = args.point.y;
	circle.matrix.tx = args.point.x;
	this.circle = circle;
	this.addChild(circle);

	var icon = new paper.CompoundPath('M27.1,16.1l-1.6-0.2c0-1.1-0.3-2.1-0.7-3.1l1.3-1c0.1-0.1,0.1-0.2,0.2-0.3 c0-0.1,0-0.2-0.1-0.3l-1.8-2.4c-0.1-0.1-0.2-0.1-0.3-0.2c-0.1,0-0.2,0-0.3,0.1l-1.2,0.9c-0.8-0.7-1.7-1.3-2.8-1.8L20,6.3 c0-0.1,0-0.2-0.1-0.3c-0.1-0.1-0.2-0.1-0.3-0.2l-3-0.4c-0.1,0-0.2,0-0.3,0.1c-0.1,0.1-0.1,0.2-0.2,0.3l-0.2,1.5 c-1.1,0-2.2,0.3-3.2,0.7l-0.9-1.2c-0.1-0.2-0.4-0.2-0.6-0.1L8.8,8.5C8.7,8.6,8.6,8.7,8.6,8.8c0,0.1,0,0.2,0.1,0.3l0.9,1.2 C8.8,11.1,8.2,12,7.8,13l-1.5-0.2c-0.1,0-0.2,0-0.3,0.1c-0.1,0.1-0.1,0.2-0.2,0.3l-0.4,3c0,0.2,0.1,0.4,0.3,0.5l1.5,0.2 C7.3,18,7.6,19.1,8,20.1l-1.3,1c-0.2,0.1-0.2,0.4-0.1,0.6L8.5,24c0.1,0.2,0.4,0.2,0.6,0.1l1.3-0.9c0.8,0.7,1.8,1.3,2.7,1.7 l-0.2,1.7c0,0.2,0.1,0.4,0.3,0.5l3,0.4c0,0,0,0,0.1,0c0.2,0,0.4-0.1,0.4-0.4l0.2-1.6c1.1-0.1,2.1-0.3,3.1-0.7l1,1.4 c0.1,0.2,0.4,0.2,0.6,0.1l2.4-1.8c0.1-0.1,0.1-0.2,0.2-0.3c0-0.1,0-0.2-0.1-0.3l-1-1.3c0.7-0.8,1.3-1.7,1.7-2.7l1.7,0.2 c0.2,0,0.4-0.1,0.5-0.3l0.4-3C27.4,16.4,27.3,16.2,27.1,16.1z M16.4,20.2c-2.1,0-3.8-1.7-3.8-3.8c0-2.1,1.7-3.8,3.8-3.8 s3.8,1.7,3.8,3.8C20.2,18.5,18.5,20.2,16.4,20.2z');
	icon.fillColor = whiteColor;
	icon.position = circle.position;
	this.icon = icon;
	this.addChild(icon);

	this.onMouseEnter = function() {
		this.circle.fillColor = greenColor;
	}

	this.onMouseLeave = function() {
		this.circle.fillColor = blackColor;
	}

	this.onMouseDown = function(event) {
		event.preventDefault();
		event.stopPropagation();
	}

	this.onClick = function(event) {
		event.preventDefault();
		event.stopPropagation();
		var factorGen = new EaseInTimer(animationFrameLength);

		if (this.displayComponentList()) {
			this.onFrame = function() {
				var frameFactor = factorGen.getNextFactor();
				var angle = animationAngleRotation * frameFactor;
				this.icon.rotate(angle, this.circle.bounds.center);

				if (EaseInTimer.frameCount === animationFrameLength) {
					this.onFrame = undefined;
				}
			}
		}
	}
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
	this.itemGroup.setMatrix(new paper.Matrix(1, 0, 0, 0, this.pointArg.x - 12, this.pointArg.y + 22));
	var factorGen = new EaseInTimer(animationFrameLength, 0);
	this.itemGroup.onFrame = function() {
		var frameFactor = factorGen.getNextFactor();
		this.itemGroup.setMatrix(new paper.Matrix(1, 0, 0, this.itemGroup.matrix.d + frameFactor, this.pointArg.x - 12, this.pointArg.y + 22));
		if (this.itemGroup.scaling.y >= 1) {
			this.itemGroup.setMatrix(new paper.Matrix(1, 0, 0, 1, this.pointArg.x - 12, this.pointArg.y + 22));
			this.itemGroup.onFrame = undefined;
		}

	}.bind(this);

	return shouldCreate;
}

ComponentMenu.prototype.removeMenu = function() {
	this.remove();
	this.itemGroup.remove();
	this.icon.remove();
	this.circle.remove();
}

function ComponentMenuItem( args ) {
	paper.Group.prototype.constructor.apply( this );
	var bg = new paper.Shape.Rectangle(args.point, new paper.Size(200, componentItemHeight));
	bg.fillColor = blackColor;
	bg.onMouseEnter = function() {
		bg.fillColor = greenColor;
	}
	bg.onMouseLeave = function() {
		bg.fillColor = blackColor;
	}
	this.addChild(bg);

	var text = new paper.PointText(new paper.Point(componentItemPadding, componentItemPadding));
	text.content = args.text;
	text.fontSize = 20;
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
