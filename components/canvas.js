import { pt, Color } from "lively.graphics";
import { Morph } from "lively.morphic";

/*

This module provides a canvas widget to display pixel-based data.

*/

export class Canvas extends Morph {
  static get properties() {
    return {
      extent:       {defaultValue: pt(200,200)},
      fill:         {defaultValue: Color.transparent},
 
      canvasBounds: {
        get() { return this._canvas && this.canvasExtent.extentAsRectangle() }
      },
      canvasExtent: {
        get() { return this._canvas && pt(this._canvas.width, this._canvas.height) }
      },
      context: {
        get() { return this._canvas && this._canvas.getContext("2d"); }
      },
    }
  }

  clear() {
    const ctx = this.context;
    if (ctx) {
        const extent = this.canvasExtent,
              height = extent.y,
              width = extent.x;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.restore();
    }
  }

  render(renderer) { return renderer.renderCanvas(this); }
}
