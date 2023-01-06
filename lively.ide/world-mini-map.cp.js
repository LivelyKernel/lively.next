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
          return ['isMiniMap', 'drawMorphs', 'relayout'];
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

  async drawMorphs () {
    const { context } = this;

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
    const realCutoffs = {
      top: Math.min(minY, $world.screenToWorld(pt(0, 0)).y, defaultScreenCutoffs.top),
      left: Math.min(minX, $world.screenToWorld(pt(0, 0)).x, defaultScreenCutoffs.left),
      right: Math.max(maxX, $world.screenToWorld(pt(defaultScreenCutoffs.right, defaultScreenCutoffs.bottom)).x, defaultScreenCutoffs.right),
      bottom: Math.max(maxY, $world.screenToWorld(pt(defaultScreenCutoffs.right, defaultScreenCutoffs.bottom)).y, defaultScreenCutoffs.bottom)
    };

    // how large is the canvas currently?
    const virtualHeight = (realCutoffs.top * -1) + realCutoffs.bottom;
    const virtualWidth = (realCutoffs.left * -1) + realCutoffs.right;

    // in case we grew to the top or to the left, elements there have negative corrdinates
    // to move them in the positive quadrants when drawing on the canvas later, calculate how to compoensate for this if necessary
    let balanceNegativeTop = 0;
    let balanceNegativeLeft = 0;
    if (realCutoffs.top < 0) balanceNegativeTop = -1 * realCutoffs.top;
    if (realCutoffs.left < 0) balanceNegativeLeft = -1 * realCutoffs.left;

    // the minimap has a fixed aspect ratio
    // we pad the current size of the canvas until we reach this aspect ratio
    // this requires corrections later on, e.g., if we pad the width for 40px in total we want to keep the canvas centered
    // -> everything we draw on the minimap needs to be moved 20px to the right
    let widthCorrection = 0;
    let heightCorrection = 0;
    if (virtualWidth > virtualHeight) { // we are a rectangle with proper orientation
      const goalHeight = virtualWidth / this.ratio;
      if (virtualHeight > goalHeight) { // despite proper orientation we need to padd the width
        widthCorrection = ((virtualHeight * this.ratio) - virtualWidth);
      } else { // virtualHeight < goalHeight
        heightCorrection = (goalHeight - virtualHeight);
      }
    } else { // we are not properly oriented, our height is larger than our width
      const goalWidth = virtualHeight * this.ratio;
      if (virtualWidth > goalWidth) {
        heightCorrection = ((virtualWidth / this.ratio) - virtualHeight);
      } else { // virtualWidht < goalWidht
        widthCorrection = (goalWidth - virtualWidth);
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Helper functions which take a number representing a width/height in current world space
    // and scale it so that the correct width/height in virtual space (on minimap) is returned
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    const scaleHeight = (number) => {
      let height = number / (virtualHeight + heightCorrection);
      return this.view.height * height;
    };
    const scaleWidth = (number) => {
      let width = number / (virtualWidth + widthCorrection);
      return 300 * width;
    };

    const height = $world.screenToWorld($world.bottomRight).y - $world.screenToWorld($world.topLeft).y;
    const width = $world.screenToWorld($world.bottomRight).x - $world.screenToWorld($world.topLeft).x;

    const viewPort = new Morph({
      name: 'viewport',
      extent: pt(width, height),
      borderWidth: 15,
      borderColor: Color.lively,
      fill: Color.transparent
    });

    let itemsToDraw = [$world.morphsInWorld.map(morph => morph.withAllSubmorphsSelect(() => true)), viewPort];
    itemsToDraw = itemsToDraw.flat(1000); // make it really, really flat bro

    // we need perform some tricks to render polygons on canvas
    // unfortunately, those tricks are asynchronous
    // since delays once the actual redrawing on the canvas start cause optical flickers
    // do it here and store all necessary data
    // this way, the actual drawing on the canvas can happen synchronously
    for (let currentItem of itemsToDraw) {
      if (currentItem.isPath) {
        await this.prepareImageDataForPolygons(currentItem);
      }
    }

    this.view.clear(null);
    itemsToDraw.forEach((m) => {
      // we need the udnerscore property to be present but cannot initialize it in constructor call above
      if (m.name === 'viewport') m._positionOnCanvas = $world.screenToWorld(pt(0, 0));

      const scaledWidthCorrection = scaleWidth(widthCorrection) / 2;
      let xPos = ((m.positionOnCanvas.x + balanceNegativeLeft + (widthCorrection / 2)) / (virtualWidth + widthCorrection));
      xPos = (300 * xPos);
      const scaledHeightCorrection = scaleHeight(heightCorrection) / 2;
      let yPos = ((m.positionOnCanvas.y + balanceNegativeTop + (heightCorrection / 2)) / (virtualHeight + heightCorrection));
      yPos = (this.view.height * yPos);
      let width = scaleWidth(m.width);
      let height = scaleHeight(m.height);
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
  epiMorph: true
});
