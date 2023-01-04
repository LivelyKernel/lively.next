/* global XMLSerializer */
import { ViewModel, Morph, part, component } from 'lively.morphic';
import { Canvas } from 'lively.components/canvas.js';
import { pt, Color } from 'lively.graphics';
import { max, min } from 'lively.lang/array.js';

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

  drawMorphs () {
    const defaultScreenCutoffs = {
      top: 0,
      left: 0,
      right: 1980,
      bottom: 1080
    };
    const { context } = this;
    this.view.clear(null);

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

    const itemsToDraw = [...$world.morphsInWorld, new Morph({ position: pt(0, 0), extent: pt(1920, 1080), borderWidth: 15, borderColor: Color.black, positionOnCanvas: $world.screenToWorld(pt(0, 0)), fill: Color.transparent })];
    itemsToDraw.forEach(m => {
      let xPos = ((m.positionOnCanvas.x + balanceNegativeLeft) / virtualWidth);
      xPos = 300 * xPos;
      let yPos = ((m.positionOnCanvas.y + balanceNegativeTop) / virtualHeight);
      yPos = this.view.height * yPos;
      let width = m.extent.x / (virtualWidth + widthCorrection);
      width = 300 * width;
      let height = m.extent.y / (virtualHeight + heightCorrection);
      height = this.view.height * height;

      context.setTransform(1, 0, 0, 1, 0, 0); // reset context rotation
      if (m.rotation) {
        context.translate(xPos, yPos);
        context.rotate(m.rotation);
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
        // see https://stackoverflow.com/questions/3768565/drawing-an-svg-file-on-a-html5-canvas
        const svg = $world.env.renderer.getNodeForMorph(m).querySelector('svg');
        const img = $world.env.domEnv.document.createElement('img');

        const xml = new XMLSerializer().serializeToString(svg);

        const svg64 = btoa(xml);
        const b64Start = 'data:image/svg+xml;base64,';
        const image64 = b64Start + svg64;

        img.src = image64;
        setTimeout(() => {
          context.drawImage(img, xPos, yPos, width, height);
        }, 10);
        return;
      }

      context.lineWidth = m.borderWidth.top / 5;
      context.strokeStyle = m.borderColor.top; // this assumes that the border has the same color on all sides
      context.fillStyle = m.fill;

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
    });
  }
}

// part(WorldMiniMap).openInWorld();
export const WorldMiniMap = component({
  name: 'world mini map',
  type: Canvas,
  defaultViewModel: MiniMapModel,
  extent: pt(100, 100),
  fill: Color.transparent,
  borderWidth: 1,
  borderColor: Color.black
});
