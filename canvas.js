import { pt, rect, Color } from "lively.graphics";
import { Morph } from "lively.morphic";
import { connect } from "lively.bindings";


/*

This module provides a canvas widget to display pixel-based data.

*/

export class Canvas extends Morph {
  static get properties() {
    return {
      extent:       {defaultValue: pt(200,200)},
      fill:         {defaultValue: Color.transparent},
      contextType:  {defaultValue: '2d'},

      preserveContents: {defaultValue: true},

      canvasExtent: {
        get() { return this._canvas && pt(this._canvas.width, this._canvas.height); },
        // set(ext) { this.pixelRatio = ... }
      },
      canvasBounds: {
        readOnly: true,
        get() { return this._canvas && this.canvasExtent.extentAsRectangle(); }
      },

      _serializedContents: {
        get() { return this.preserveContents && this.toDataURI(); },
        set(s) { this.withContextDo(() => this.fromDataURI(s)); },
      },
    };
  }

  //get canvasBounds() { return this._canvas && this.canvasExtent.extentAsRectangle(); }
  get context() { return this._canvas && this._canvas.getContext(this.contextType); }

  set _canvas(new_canvas) {
    // renderer created a new HTMLCanvasElement for us
    const old_canvas = this.__canvas__;
    this.__canvas__ = new_canvas;
    this.restoreContent(old_canvas, new_canvas);
  }
  get _canvas() { return this.__canvas__; }

  constructor(props = {}) {
    super(props);
    connect(this, 'extent', this, 'onExtentChanged');
  }

  afterRender(canvasNode, hasNewCanvasNode) {
    if (hasNewCanvasNode) this._canvas = canvasNode;
    else if (typeof this.__canvas_init__ === "function") {
      this.__canvas_init__();
      delete this.__canvas_init__;
    }
  }

  restoreContent(old_canvas, new_canvas) {
    let {contextType, preserveContents} = this;
    if (typeof this.__canvas_init__ === "function") {
      this.__canvas_init__();
      delete this.__canvas_init__;
    } else if (preserveContents && contextType == "2d"
               && old_canvas && old_canvas !== new_canvas) {
      this.context.drawImage(old_canvas, 0, 0);
    }
  }

  onExtentChanged() {
    if (this._canvas && this.preserveContents) {
      const {width: w, height: h} = this._canvas;
      const contents = this.context.getImageData(0, 0, w, h);
      this.__canvas_init__ = () => {
        this.context.putImageData(contents, 0, 0);
      };
    }
  }

  clear(color) {
    const ctx = this.context;
    if (ctx) {
      const {width: w, height: h} = this._canvas;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (color) {
        if (color.toCSSString) color = color.toCSSString();
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      ctx.restore();
    }
  }

  render(renderer) { return renderer.renderCanvas(this); }

  withContextDo(func) {
    if (this._canvas) func(this.context);
    else this.__canvas_init__ = () => func(this.context);
  }

  toDataURI() { return this._canvas && this._canvas.toDataURL(); }

  fromDataURI(uri) {
    const img = new Image();
    img.onload = () => {
      this._canvas.width = img.width;
      this._canvas.height = img.height;
      this.context.drawImage(img, 0, 0);
    };
    img.src = uri;
  }

  imageData(bounds) {
    if (!bounds) bounds = this.canvasBounds;
    let {x, y, width, height} = bounds;
    return this.context.getImageData(x, y, width, height);
  }

  nonTransparentArea() {
    let imageData = this.imageData();
    let {data, width, height} = imageData;
    let minX = width, minY = height;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < minX; x++)
        if (data[(y * width + x) * 4 + 3] > 0) {
          minX = x;
          if (minY > y) minY = y;
        }
    if (minX === width) return rect(0, 0, 0, 0);
    let maxX = minX, maxY = minY;
    for (let y = height - 1; y > minY; y--)
      for (let x = width - 1; x > maxX; x--)
        if (data[(y * width + x) * 4 + 3] > 0) {
          maxX = x;
          if (maxY < y) maxY = y;
        }
    return {
      imageData,
      bounds: rect(minX, minY, maxX - minX + 1, maxY - minY + 1),
    };
  }

  trimNonTransparent() {
    let {imageData, bounds} = this.nonTransparentArea();
    if (!bounds.topLeft().equals(pt(0,0))) {
      let {context} = this,
          {x, y, width, height} = bounds;
      context.putImageData(imageData, -x, -y, x, y, width, height);
      this.position = this.position.addPt(bounds.topLeft());
    }
    if (!bounds.extent().equals(this.extent)) {
      this.extent = bounds.extent();
    }
  }
}
