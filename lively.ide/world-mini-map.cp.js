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
          return ['isMiniMap', 'drawMorphs'];
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

  viewDidLoad () {
    // TODO: maybe this should be definable through the config?
    this.ratio = 16 / 9;
    this.view.width = 300;

    this.view.height = this.view.width / this.ratio;
    this.view.env.forceUpdate();
    this.drawMorphs();
  }

  async drawMorphs () {
    const defaultScreenCutoffs = {
      top: 0,
      left: 0,
      right: 1980,
      bottom: 1080
    };
    const { context } = this;

    const xPositionsForMin = $world.morphsInWorld.map(m => m.positionOnCanvas.x);
    const xPositionsForMax = $world.morphsInWorld.map(m => m.positionOnCanvas.x + m.width);
    const maxX = max(xPositionsForMax) || 0;
    const minX = min(xPositionsForMin) || 0;

    const yPositionsForMin = $world.morphsInWorld.map(m => m.positionOnCanvas.y);
    const yPositionsForMax = $world.morphsInWorld.map(m => m.positionOnCanvas.y + m.height);
    const maxY = max(yPositionsForMax) || 0;
    const minY = min(yPositionsForMin) || 0;

    const realCutoffs = {
      top: Math.min(defaultScreenCutoffs.top, minY),
      left: Math.min(defaultScreenCutoffs.left, minX),
      right: Math.max(defaultScreenCutoffs.right, maxX),
      bottom: Math.max(defaultScreenCutoffs.bottom, maxY)
    };

    const virtualHeight = (realCutoffs.top * -1) + realCutoffs.bottom;
    const virtualWidth = (realCutoffs.left * -1) + realCutoffs.right;

    let balanceNegativeTop = 0;
    let balanceNegativeLeft = 0;
    if (realCutoffs.top < 0) balanceNegativeTop = -1 * realCutoffs.top;
    if (realCutoffs.left < 0) balanceNegativeLeft = -1 * realCutoffs.left;

    let widthCorrection = 0;
    let heightCorrection = 0;
    if (virtualWidth > virtualHeight) { // we are a rectangle with proper orientation
      const goalHeight = virtualWidth / this.ratio;
      if (virtualHeight > goalHeight) { // despite proper orientation we need to padd the width
        widthCorrection = ((goalHeight * this.ratio) - virtualWidth);
      } else { // virtualHeight < goalHeight
        heightCorrection = (goalHeight - virtualHeight);
      }
    } else { // we are not properly oriented, our height is larger than our width
      const goalWidth = virtualHeight * this.ratio;
      if (virtualWidth > goalWidth) {
        heightCorrection = ((goalWidth / this.ratio) - virtualHeight);
      } else { // virtualWidht < goalWidht
        widthCorrection = (goalWidth - virtualWidth);
      }
    }

    const scaleHeight = (number) => {
      let height = number / (virtualHeight + heightCorrection);
      return this.view.height * height;
    };

    let itemsToDraw = [$world.morphsInWorld.map(morph => morph.withAllSubmorphsSelect(() => true)), new Morph({ name: 'viewport', extent: pt(1920, 1080), borderWidth: 15, borderColor: Color.lively, fill: Color.transparent })];
    itemsToDraw = itemsToDraw.flat(1000);

    for (let i = 0; i < itemsToDraw.length; i++) {
      const currentItem = itemsToDraw[i];
      if (currentItem.isPath) {
        await this.prepareImageDataForPolygons(currentItem);
      }
    }

    this.view.clear(null);
    itemsToDraw.forEach((m) => {
      if (m.name === 'viewport') m._positionOnCanvas = $world.screenToWorld(pt(0, 0));

      let xPos = ((m.positionOnCanvas.x + balanceNegativeLeft) / virtualWidth);
      xPos = 300 * xPos;
      let yPos = ((m.positionOnCanvas.y + balanceNegativeTop) / virtualHeight);
      yPos = this.view.height * yPos;
      let width = scaleWidth(m.width);
      let height = scaleHeight(m.height);
      this.renderMorphPreviewOnCanvas(m, xPos, yPos, width, height, context);

      function scaleWidth (number) {
        let width = number / (virtualWidth + widthCorrection);
        return 300 * width;
      }
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

  }
});
