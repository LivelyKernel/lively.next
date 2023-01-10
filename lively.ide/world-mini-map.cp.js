/* global XMLSerializer */
import { ViewModel, part, Morph, component } from 'lively.morphic';
import { Canvas } from 'lively.components/canvas.js';
import { pt, Color } from 'lively.graphics';
import { max, min } from 'lively.lang/array.js';
import { delay } from 'lively.lang/promise.js';

class MiniMapModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['isMiniMap', 'drawMorphs', 'relayout', 'onDrag', 'onMouseDown'];
        }
      }
    };
  }

  get context () {
    return this.view.context;
  }

  get isMiniMap () {
    return true;
  }

  repositionViewPort (evt) {
    const clickedPositionOnMap = this.view.localize(evt.position);

    const clickedPositionInCanvasSpace = pt(this.xFromMapSpaceToCanvasSpace(clickedPositionOnMap.x), this.yFromMapSpaceToCanvasSpace(clickedPositionOnMap.y));
    const currentViewportPosition = $world.screenToWorld(pt($world.windowBounds().width / 2, $world.windowBounds().height / 2));

    const offsetShift = clickedPositionInCanvasSpace.subPt(currentViewportPosition);

    $world.scrollWorld(offsetShift.x, offsetShift.y);
  }

  onMouseDown (evt) {
    this.repositionViewPort(evt);
  }

  onDrag (evt) {
    if (!this.view.bounds().containsPoint(evt.position)) return;
    this.repositionViewPort(evt);
  }

  relayout () {
    const { view } = this;
    if ($world.activeSideBars.includes('properties panel')) view.position = pt($world.get('properties panel').left - 10 - view.width, $world.extent.y - 10 - view.height);
    else view.position = pt($world.right - 10 - view.width, $world.extent.y - 10 - view.height);
  }

  viewDidLoad () {
    const worldBounds = $world.windowBounds();
    this.ratio = worldBounds.width / worldBounds.height;

    this.view.width = 300;
    this.view.height = this.view.width / this.ratio;
    this.view.env.forceUpdate();

    this.relayout();
    this.view.startStepping(100, 'drawMorphs');
  }

  updateMapSpace () {
    // The width and height of the world which are visible when not zoomed/scrolled; due to the size of the browser window
    const defaultScreenCutoffs = {
      top: 0,
      left: 0,
      right: $world.windowBounds().width,
      bottom: $world.windowBounds().height
    };

    // find the highest left and right position that is taken up by a morph
    const xPositionsForMin = $world.morphsInWorld.map(m => m.positionOnCanvas.x);
    const xPositionsForMax = $world.morphsInWorld.map(m => m.positionOnCanvas.x + m.width);
    const maxX = max(xPositionsForMax) || 0;
    const minX = min(xPositionsForMin) || 0;

    // find the highest position in top and bottom direction that a morph currently holds
    const yPositionsForMin = $world.morphsInWorld.map(m => m.positionOnCanvas.y);
    const yPositionsForMax = $world.morphsInWorld.map(m => m.positionOnCanvas.y + m.height);
    const maxY = max(yPositionsForMax) || 0;
    const minY = min(yPositionsForMin) || 0;

    // the area covered by the minimap is spanned by:
    // - morphs positioned on the world canvas
    // - the current viewport
    // - we always keep the "default world canvas"
    const mapSpace = {
      top: Math.min(minY, $world.screenToWorld(pt(0, 0)).y, defaultScreenCutoffs.top),
      left: Math.min(minX, $world.screenToWorld(pt(0, 0)).x, defaultScreenCutoffs.left),
      right: Math.max(maxX, $world.screenToWorld(pt(defaultScreenCutoffs.right, defaultScreenCutoffs.bottom)).x, defaultScreenCutoffs.right),
      bottom: Math.max(maxY, $world.screenToWorld(pt(defaultScreenCutoffs.right, defaultScreenCutoffs.bottom)).y, defaultScreenCutoffs.bottom)
    };

    // how large is the canvas currently?
    this.virtualHeight = (mapSpace.top * -1) + mapSpace.bottom;
    this.virtualWidth = (mapSpace.left * -1) + mapSpace.right;

    // in case we grew to the top or to the left, elements there have negative corrdinates
    // to move them in the positive quadrants when drawing on the canvas later, calculate how to compoensate for this if necessary
    this.balanceNegativeTop = 0;
    this.balanceNegativeLeft = 0;
    if (mapSpace.top < 0) this.balanceNegativeTop = -1 * mapSpace.top;
    if (mapSpace.left < 0) this.balanceNegativeLeft = -1 * mapSpace.left;

    // the minimap has a fixed aspect ratio
    // we pad the current size of the canvas until we reach this aspect ratio
    // this requires corrections later on, e.g., if we pad the width for 40px in total we want to keep the canvas centered
    // -> everything we draw on the minimap needs to be moved 20px to the right
    this.widthCorrection = 0;
    this.heightCorrection = 0;
    if (this.virtualWidth > this.virtualHeight) { // we are a rectangle with proper orientation
      const goalHeight = this.virtualWidth / this.ratio;
      if (this.virtualHeight > goalHeight) { // despite proper orientation we need to padd the width
        this.widthCorrection = ((this.virtualHeight * this.ratio) - this.virtualWidth);
      } else { // this.virtualHeight < goalHeight
        this.heightCorrection = (goalHeight - this.virtualHeight);
      }
    } else { // we are not properly oriented, our height is larger than our width
      const goalWidth = this.virtualHeight * this.ratio;
      if (this.virtualWidth > goalWidth) {
        this.heightCorrection = ((this.virtualWidth / this.ratio) - this.virtualHeight);
      } else { // virtualWidht < goalWidht
        this.widthCorrection = (goalWidth - this.virtualWidth);
      }
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // Helper functions which take a number representing a width/height in current world space
  // and scale it so that the correct width/height in virtual space (on minimap) is returned
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  heightFromCanvasSpaceToMapSpace (number) {
    return (number / (this.virtualHeight + this.heightCorrection)) * this.view.height;
  }

  widthFromCanvasSpaceToMapSpace (number) {
    return (number / (this.virtualWidth + this.widthCorrection)) * 300;
  }

  xFromMapSpaceToCanvasSpace (number) {
    return ((number / 300) * (this.virtualWidth + this.widthCorrection)) - (this.balanceNegativeLeft + (this.widthCorrection / 2));
  }

  yFromMapSpaceToCanvasSpace (number) {
    return ((number / this.view.height) * (this.virtualHeight + this.heightCorrection)) - (this.balanceNegativeTop + (this.heightCorrection / 2));
  }

  createCurrentViewPortMorph () {
    const height = $world.screenToWorld($world.bottomRight).y - $world.screenToWorld($world.topLeft).y;
    const width = $world.screenToWorld($world.bottomRight).x - $world.screenToWorld($world.topLeft).x;

    const viewPort = new Morph({
      name: 'viewport',
      extent: pt(width, height),
      borderWidth: 15,
      borderColor: Color.lively,
      fill: Color.transparent
    });
    viewPort._positionOnCanvas = $world.screenToWorld(pt(0, 0));
    return viewPort;
  }

  async drawMorphs () {
    const { context } = this;

    this.updateMapSpace();

    let itemsToDraw = [$world.morphsInWorld.map(morph => morph.withAllSubmorphsSelect(() => true)), this.createCurrentViewPortMorph()];
    itemsToDraw = itemsToDraw.flat(1000); // make it really, really flat bro

    // We need perform some tricks to render polygons on canvas.
    // Unfortunately, those tricks are asynchronous.
    // Since delays once the actual redrawing on the canvas start cause optical flickers
    // we do those tricks here and store all necessary data.
    // This way, the actual drawing on the canvas can happen synchronously and all at once.
    for (let currentItem of itemsToDraw) {
      if (currentItem.isPath) {
        await this.prepareImageDataForPolygons(currentItem);
      }
    }

    this.view.clear(null);
    let virtualWidthDivisor = this.virtualWidth + this.widthCorrection;
    let virtualHeightDivisor = this.virtualHeight + this.heightCorrection;
    let widthBalancing = this.balanceNegativeLeft + (this.widthCorrection / 2);
    let topBalancing = this.balanceNegativeTop + (this.heightCorrection / 2);

    itemsToDraw.forEach((m) => {
      let xPos = (m.positionOnCanvas.x + widthBalancing) / virtualWidthDivisor;
      xPos = (300 * xPos);

      let yPos = (m.positionOnCanvas.y + topBalancing) / virtualHeightDivisor;
      yPos = (this.view.height * yPos);

      let width = this.widthFromCanvasSpaceToMapSpace(m.width);
      let height = this.heightFromCanvasSpaceToMapSpace(m.height);
      this.renderMorphPreviewOnCanvas(m, xPos, yPos, width, height, context);
    });
  }

  async prepareImageDataForPolygons (polygon) {
    // see https://stackoverflow.com/questions/3768565/drawing-an-svg-file-on-a-html5-canvas
    const svg = $world.env.renderer.getNodeForMorph(polygon).querySelector('svg');
    const img = $world.env.domEnv.document.createElement('img');

    const xml = new XMLSerializer().serializeToString(svg);

    const svg64 = btoa(xml);
    const b64Start = 'data:image/svg+xml;base64,';
    const image64 = b64Start + svg64;

    img.src = image64;
    polygon.imgData = img;
    await delay(1);
  }

  renderMorphPreviewOnCanvas (morph, xPos, yPos, width, height, context) {
    const m = morph;
    context.setTransform(1, 0, 0, 1, 0, 0); // reset context rotation
    if (m.getGlobalTransform().getRotation()) {
      context.translate(xPos, yPos);
      context.rotate(m.getGlobalTransform().getRotation() * Math.PI / 180);
      xPos = 0;
      yPos = 0;
    }

    context.beginPath();
    if (m.isImage) {
      const img = $world.env.renderer.getNodeForMorph(m).querySelector('img');
      context.drawImage(img, xPos, yPos, width, height);
      return;
    }
    if (m.isPath) {
      context.drawImage(m.imgData, xPos, yPos, width, height);
      return;
    }

    context.lineWidth = m.borderWidth.top / 5;
    context.strokeStyle = m.borderColor.top; // this assumes that the border has the same color on all sides
    context.fillStyle = m.fill;

    if (m.fill.isGradient) {
      if (m.fill.type === 'linearGradient') {
        const vec = m.fill.vector.toPoints();
        const grad = context.createLinearGradient((vec[0].x * width) + xPos, (vec[0].y * height) + yPos, (width * vec[1].x) + xPos, (height * vec[1].y) + yPos);
        m.fill.stops.forEach(stop => grad.addColorStop(stop.offset, stop.color));
        context.fillStyle = grad;
      }
      if (m.fill.type === 'radialGradient') {
        // Canvas2D does only support radial gradiants with two exact circles
        // since we allow for arbitrary "circles", i.e., ellipsis, this does not map well
        // since lossy translating the gradient would be a bit complicated for doubtful payoff
        // we just display the same colors used in the radial gradiant as linear ¯\_(ツ)_/¯
        const grad = context.createLinearGradient(xPos, yPos, width + xPos, height + yPos);
        m.fill.stops.forEach(stop => grad.addColorStop(stop.offset, stop.color));
        context.fillStyle = grad;
      }
    }

    if (m.isEllipse) {
      context.ellipse(xPos + (width / 2), yPos + (height / 2), width / 2, height / 2, 0, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
      return;
    }
    const bR = m.borderRadius;
    context.roundRect(xPos, yPos, width, height, [bR.topLeft, bR.topRight, bR.bottomRight, bR.topRight]);
    context.fill();
    context.stroke();
  }
}

// part(WorldMiniMap).openInWorld();
export const WorldMiniMap = component({
  name: 'world mini map',
  type: Canvas,
  defaultViewModel: MiniMapModel,
  extent: pt(100, 100),
  fill: Color.transparent,
  borderWidth: 0,
  dropShadow: {
    blur: 10,
    color: Color.black.withA(0.5)
  },
  borderRadius: {
    bottomLeft: 0,
    bottomRight: 5,
    topLeft: 0,
    topRight: 0
  },
  epiMorph: true,
  draggable: true
});
