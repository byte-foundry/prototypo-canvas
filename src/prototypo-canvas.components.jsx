import React, {Component} from 'react';
import prototypo from 'prototypo.js';
import PrototypoCanvas from './prototypo-canvas.js';
import forEach from 'lodash/forEach';
import isEqual from 'lodash/isEqual';

let canvasBackRef;
let projectBackRef;

export default class PrototypoCanvasContainer extends Component {
	constructor(props) {
		super(props);
		this.state = {};
		this.wheel = this.wheel.bind(this);
		this.mouseUp = this.mouseUp.bind(this);
		this.reset = this.reset.bind(this);
	}

	componentWillUnmount() {
		canvasBackRef = this.refs.canvas;
		this.state.instance.stopRaf();
	}

	componentWillReceiveProps(nextProps) {
		if (this.state.instance !== '') {
			if (this.state.instance) {
				const values = {
					...nextProps.values,
					altList: nextProps.altList || {},
				};

				if (nextProps.exportTag) {
					this.props.preExport();
					this.state.instance.download(
						nextProps.afterExport,
						nextProps.exportName,
						nextProps.exportMerged,
						nextProps.exportValues,
						nextProps.exportEmail
					)
				}

				if (nextProps.exportGlyphrTag) {
					this.props.preExportGlyphr();
					this.state.instance.openInGlyphr(
						nextProps.afterExportGlyphr,
						nextProps.exportName,
						nextProps.exportMerged,
						nextProps.exportValues,
						nextProps.exportEmail
					)
				}

				if (nextProps.familyName !== this.props.familyName) {
					this.props.preLoad()
					this.setState({
						loading: true,
					});
					this.state.instance.loadFont(nextProps.familyName, nextProps.json, nextProps.db)
						.then(() => {
							this.props.setGlyphs(this.state.instance.font.altMap);
						});

					this.state.instance.addOnceListener('worker.fontCreated', () => {
						this.props.afterLoad();
						this.setState({
							loading: false,
						});
						this.forceUpdate();
					});
				}
				else if (
					(!_.isEqual(this.state.instance.latestValues, {...this.state.instance.latestValues, ...values}))
					&& !this.state.loading
				) {
					this.state.instance.update(values);
				}

				if (
					this.state.instance.subset
						.map(function(glyph) {
							return String.fromCharCode(glyph.unicode)
						}).join('')
					!== this.state.instance.font.normalizeSubset(nextProps.subset)
						.map(function(glyph) {
							return String.fromCharCode(glyph.unicode)
						}).join('')
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

				this.props.preLoad()
				PrototypoCanvas.init({
					canvas: this.refs.canvas,
					workerUrl: this.props.workerUrl,
					workerDeps: this.props.workerDeps,
					jQueryListeners: false,
				}).then(async (instance) => {
					instance.addOnceListener('worker.fontCreated', () => {
						this.props.afterLoad()
					});

					await instance.loadFont(this.props.familyName, this.props.json, this.props.db);
					if (canvasBackRef) {
						canvasBackRef = undefined;
					}
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
							(glyphProperties) => {
								this.props.afterFontComputation({
									glyphProperties,
									totalHeight: this.props.values.xHeight + Math.max(this.props.values.capDelta, this.props.values.ascender) - this.props.values.descender
								});
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

	reset() {
		this.props.resetView(
			this.state.instance.currGlyph.bounds.center.x,
			-this.state.instance.currGlyph.bounds.center.y,
		);
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
		if (this.state.instance && this.state.instance !== '' && this.refs.canvas) {
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
			<div className="prototypo-canvas-container" ref="container" onDoubleClick={this.reset}>
				<canvas ref="canvas"></canvas>
				{overlay}
			</div>
		)
	}
};