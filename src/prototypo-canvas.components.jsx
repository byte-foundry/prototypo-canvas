import React, {Component} from 'react';
import prototypo from 'prototypo.js';
import PrototypoCanvas from './prototypo-canvas.js';
import forEach from 'lodash/forEach';

export default class PrototypoCanvasContainer extends Component {
	constructor(props) {
		super(props);
		this.state = {};
		this.wheel = this.wheel.bind(this);
		this.mouseUp = this.mouseUp.bind(this);
	}

	componentWillReceiveProps(nextProps) {
		if (this.state.instance !== '') {
			if (this.state.instance) {
				if (nextProps.familyName !== this.props.familyName) {
					this.state.instance.loadFont(nextProps.familyName, nextProps.json, nextProps.db)
						.then(() => {
							this.props.setGlyphs(this.state.instance.font.altMap);
						});
				}

				if (nextProps.values !== this.props.values || nextProps.altList !== this.props.altList) {
					const values = {
						...nextProps.values,
						altList: nextProps.altList || {},
					}
					this.state.instance.update(values);
				}

				if (
					this.state.instance.subset.map(function(glyph) { return String.fromCharCode(glyph.unicode) }).join('')
					!== this.state.instance.font.normalizeSubset(nextProps.subset).map(function(glyph) { return String.fromCharCode(glyph.unicode) }).join('')
				) {
					this.state.instance.subset = nextProps.subset;
				}

				if (nextProps.canvasMode !== this.state.instance.canvasMode) {
					this.state.instance.canvasMode = nextProps.canvasMode;
					this.state.instance.showNodes = nextProps.canvasMode === 'select-points';
					this.state.instance.allowMove = nextProps.canvasMode === 'move';
					const showComponent = nextProps.canvasMode === 'components';
					const oldShowComponent = this.state.instance._showComponents;

					this.state.instance._showComponents = showComponent;
					if (showComponent !== oldShowComponent) {
						this.state.instance.displayGlyph();
					}
				}
			}
			else if (this.props.workerUrl && this.props.workerDeps) {
				this.setState({
					instance: '',
				});

				PrototypoCanvas.init({
					canvas: this.refs.canvas,
					workerUrl: this.props.workerUrl,
					workerDeps: this.props.workerDeps,
					jQueryListeners: false,
				}).then(async (instance) => {
					await instance.loadFont(this.props.familyName, this.props.json, this.props.db);
					this.props.setGlyphs(instance.font.altMap);

					instance.addListener('worker.fontLoaded',() => {
						instance.getGlyphsProperties(
							[
								'advanceWidth',
								'spacingLeft',
								'spacingRight',
								'baseSpacingLeft',
								'baseSpacingRight',
								'glyphWidth'
							],
							(props) => {
								this.props.storeProperties(props);
							}
						);
					});

					instance.addListener('component.change', function(glyph, id, name) {
						this.props.changeComponent({glyph, id, name});
					}.bind(this));

					this.refs.container.addEventListener('wheel', this.wheel);
					this.refs.container.addEventListener('mouseleave', this.props.mouseLeave);
					this.refs.container.addEventListener('mouseenter', this.props.mouseEnter);
					this.refs.container.addEventListener('mouseup', this.mouseUp);
					this.refs.container.addEventListener('mousedown', this.props.mouseDown);

					instance.displayChar(this.props.selected);
					const values = {
						...this.props.values,
						altList: this.props.altList || {},
					}
					instance.update(values);
					instance.subset = this.props.subset;
					instance.on('manualchange', (changes, force = false) => {
						this.props.changeManualNode({changes, force, glyphName: instance.currGlyph.name});
					});
					instance.on('manualreset', (contourId, nodeId, force = true) => {
						this.props.resetManualNode({contourId, nodeId, force, glyphName: instance.currGlyph.name});
					});

					return this.setState({
						instance,
					});

				});
			}
		}
	}

	mouseUp(e) {
		this.props.mouseUp(this.state.instance.zoom, this.state.instance.view.center);
	}


	wheel(e) {
		this.state.instance.onWheel.bind(this.state.instance)(e);
		this.props.wheel(this.state.instance.zoom, this.state.instance.view.center);
	}

	componentDidUpdate() {
		if (this.state.instance && this.state.instance !== '' && this.state.instance.currGlyph) {
			this.changeFontInstanceValues();
			this.resizeCanvas();
			this.state.instance.displayChar(this.props.selected);
		}
	}

	changeFontInstanceValues() {
		this.state.instance.zoom = this.props.uiZoom ? this.props.uiZoom : 0.5;
		this.state.instance.view.center = this.props.uiPos
			? this.props.uiPos instanceof prototypo.paper.Point
				? this.props.uiPos
				: new prototypo.paper.Point(this.props.uiPos[1], this.props.uiPos[2])
			: this.state.instance.view.center;

		this.state.instance.showCoords = this.props.uiCoords || false;
		this.state.instance.fill = !this.props.uiOutline;
	}

	resizeCanvas() {
		if (this.state.instance && this.state.instance !== '') {
			const oldSize = new prototypo.paper.Size(this.refs.canvas.clientWidth,
				this.refs.canvas.clientHeight);

			if (oldSize.width && oldSize.height) {
				const centerClone = this.state.instance.view.center.clone();
				const center = new prototypo.paper.Point(
					centerClone.x,
					-centerClone.y
				);
				const glyphCenter = this.state.instance.currGlyph.getPosition();

				const oldGlyphRelativePos = glyphCenter.subtract(center);
				const newSize = new prototypo.paper.Size(
					this.refs.container.clientWidth, this.refs.container.clientHeight);
				const ratio = newSize.divide(oldSize);

				const newDistance = new prototypo.paper.Point(oldGlyphRelativePos.x * ratio.width, oldGlyphRelativePos.y * ratio.height);
				const newCenterPosNotTransformed = glyphCenter.subtract(newDistance);
				const newCenterPos = new prototypo.paper.Point(
					newCenterPosNotTransformed.x,
					-newCenterPosNotTransformed.y
				);
			}

			this.refs.canvas.width = this.refs.container.clientWidth;
			this.refs.canvas.height = this.refs.container.clientHeight;
			this.state.instance.view.viewSize = [this.refs.container.clientWidth, this.refs.container.clientHeight];
			this.state.instance.view.update();
		}
	}

	render() {
		const overlay = (!this.state.instance || this.state.instance === '') || true ? <div className="prototypo-canvas-overlay"></div> : false;

		return (
			<div className="prototypo-canvas-container" ref="container">
				<canvas ref="canvas"></canvas>
				{overlay}
			</div>
		)
	}
};
