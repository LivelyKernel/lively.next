import { pt, Point, rect, Color } from 'lively.graphics';
import { Morph, Image } from 'lively.morphic';
import { connect } from 'lively.bindings';

/*
 * This module provides a canvas widget to display pixel-based data.
 */

export class Canvas extends Morph {
  static get properties () {
    return {
      extent: { defaultValue: pt(200, 200) },
      fill: { defaultValue: Color.transparent },
      contextType: { defaultValue: '2d' },
      // https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
      willReadFrequently: { defaultValue: false },

      preserveContents: { defaultValue: true },

      canvasExtent: {
        get () { return this._canvas && pt(this._canvas.width, this._canvas.height); }
        // set(ext) { this.pixelRatio = ... }
      },
      canvasBounds: {
        readOnly: true,
        get () { return this._canvas && this.canvasExtent.extentAsRectangle(); }
      },

      _serializedContents: {
        get () { return this.preserveContents && this.toDataURI(); },
        set (s) { this.withContextDo(() => this.fromDataURI(s)); }
      }
    };
  }

  // get canvasBounds() { return this._canvas && this.canvasExtent.extentAsRectangle(); }
  get context () {
    if (this._canvas) { return this._canvas.getContext(this.contextType, { willReadFrequently: this.willReadFrequently }); } else if (!this.world() || !this.env.renderer.getNodeForMorph(this)) {
      console.warn('Context not yet rendered. Please ensure that the Canvas Morph has been rendered first before accessing the context. This can be achieved by waiting for the whenRendered() promise before you proceed accessing the context property.');
    }
    return null;
  }

  set _canvas (new_canvas) {
    // renderer created a new HTMLCanvasElement for us
    const old_canvas = this.__canvas__;
    this.__canvas__ = new_canvas;
    this.restoreContent(old_canvas, new_canvas);
  }

  get _canvas () { return this.__canvas__; }

  constructor (props = {}) {
    super(props);
    connect(this, 'extent', this, 'onExtentChanged');
  }

  afterRender (canvasNode, hasNewCanvasNode) {
    if (hasNewCanvasNode) this._canvas = canvasNode;
    else if (typeof this.__canvas_init__ === 'function') {
      this.__canvas_init__();
      delete this.__canvas_init__;
    }
  }

  restoreContent (old_canvas, new_canvas) {
    const { contextType, preserveContents } = this;
    if (typeof this.__canvas_init__ === 'function') {
      this.__canvas_init__();
      delete this.__canvas_init__;
    } else if (preserveContents && contextType === '2d' &&
               old_canvas && old_canvas !== new_canvas) {
      this.context.drawImage(old_canvas, 0, 0);
    }
  }

  onExtentChanged () {
    if (this._canvas && this.preserveContents && this.context.getImageData) {
      const { width: w, height: h } = this._canvas;
      if (!w || !h) return;
      const contents = this.context.getImageData(0, 0, w, h);
      this.__canvas_init__ = () => {
        this.context.putImageData(contents, 0, 0);
      };
    }
  }

  clear (color) {
    const ctx = this.context;
    if (ctx) {
      const { width: w, height: h } = this._canvas;
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

  getNodeForRenderer (renderer) {
    return renderer.nodeForCanvas(this);
  }

  getHooksForRenderer (renderer) {
    return renderer.hooksForCanvas();
  }

  render (renderer) { return renderer.renderCanvas(this); }

  withContextDo (func) {
    if (this._canvas) func(this.context);
    else this.__canvas_init__ = () => func(this.context);
  }

  toDataURI () { return this._canvas && this._canvas.toDataURL(); }

  fromDataURI (uri) {
    const img = new Image();
    img.onload = () => {
      this._canvas.width = img.width;
      this._canvas.height = img.height;
      this.context.drawImage(img, 0, 0);
    };
    img.src = uri;
  }

  imageData (bounds) {
    if (!bounds) bounds = this.canvasBounds;
    const { x, y, width, height } = bounds;
    return this.context.getImageData(x, y, width, height);
  }

  nonTransparentArea () {
    const imageData = this.imageData();
    const { data, width, height } = imageData;
    let minX = width; let minY = height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < minX; x++) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          minX = x;
          if (minY > y) minY = y;
        }
      }
    }
    if (minX === width) return rect(0, 0, 0, 0);
    let maxX = minX; let maxY = minY;
    for (let y = height - 1; y > minY; y--) {
      for (let x = width - 1; x > maxX; x--) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          maxX = x;
          if (maxY < y) maxY = y;
        }
      }
    }
    return {
      imageData,
      bounds: rect(minX, minY, maxX - minX + 1, maxY - minY + 1)
    };
  }

  trimNonTransparent () {
    const { imageData, bounds } = this.nonTransparentArea();
    if (!bounds.topLeft().equals(pt(0, 0))) {
      const { context } = this;
      const { x, y, width, height } = bounds;
      context.putImageData(imageData, -x, -y, x, y, width, height);
      this.position = this.position.addPt(bounds.topLeft());
    }
    if (!bounds.extent().equals(this.extent)) {
      this.extent = bounds.extent();
    }
  }

  finishDraw (style = {}) {
    /*
      Convenience method.  This just takes care of the
      housekeeping of actually drawing the finished path
      if fill is true, fill the path.
    */
    const c = this.context;
    let {
      color = 'rgba(0,0,0,0.6)',
      width = 4,
      fill = false
    } = style;
    let fillColor = style.fillColor || color;

    if (color.toCSSString) color = color.toCSSString();
    if (fillColor.toCSSString) fillColor = fillColor.toCSSString();

    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
    c.closePath();

    if (fill) {
      c.fillStyle = fillColor;
      c.fill();
    }
  }

  arc (center, radius, startTheta, endTheta, counterClockwise = false, style = {}) {
    const c = this.context;
    c.beginPath();
    c.arc(center.x, center.y, radius, startTheta, endTheta, counterClockwise);
    this.finishDraw(style);
  }

  polygon (vertices, style = {}) {
    /*
      draw a polygon, given n points as vertices

      this.polygon([pt(0,0), pt(20,20), pt(0, 20)], {fill: true, fillColor:Color.green});
    */
    const c = this.context;
    c.beginPath();
    c.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 0; i < vertices.length; i++) {
      c.lineTo(vertices[i].x, vertices[i].y);
    }
    c.lineTo(vertices[0].x, vertices[0].y);
    this.finishDraw(style);
  }

  text (textString, atPt, style = {}) {
    /*
      write textString at atPt as guided by style

      this.text('Hello World', this.extent.scaleBy(0.5), {angle: Math.PI/4, color: 'red', align: 'center', font: '30px Comic Sans MS'});
      this.text('Hello World', this.extent.scaleBy(0.5), {color: 'red', align: 'center', font: '30px Comic Sans MS'});
      this.text('Hello World', this.extent.scaleBy(0.5));
    */
    const ctx = this.context;
    const {
      color = 'black',
      font = '14px Arial',
      align = 'start',
      baseline = 'bottom'
    } = style;

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (style.angle && !isNaN(style.angle)) {
      ctx.translate(atPt.x, atPt.y);
      ctx.rotate(style.angle);
      ctx.translate(-atPt.x, -atPt.y);
    }
    ctx.fillText(textString, atPt.x, atPt.y);
    ctx.restore();
  }

  line (from, to, style = {}) {
    const c = this.context;
    let color = style.color || 'rgba(0,0,0,0.6)';
    const width = style.width || 4;
    if (color.toCSSString) color = color.toCSSString();
    c.strokeStyle = color;
    c.beginPath();
    c.lineWidth = width;
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
    c.closePath();
  }

  spiral () {
    this.clear(Color.white);
    let start = this.innerBounds().center();
    let rotation = 0; let stepSize = 1;
    for (let i = 0; i < 150; i++) {
      const end = start.addPt(Point.polar(stepSize, rotation));
      this.line(start, end, { color: Color.random() });
      start = end;
      rotation += Math.PI / 10;
      stepSize += 0.3;
    }
  }

  rect (atPt, extent, style = {}) {
    // this.rect(pt(20,20), pt(50,50), {fill: true, fillColor: Color.red})
    const c = this.context; c.beginPath(); c.rect(atPt.x, atPt.y, extent.x, extent.y); this.finishDraw(style);
  }
}
