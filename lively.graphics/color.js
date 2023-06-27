/* eslint-disable no-use-before-define */

import { num, obj, arr } from 'lively.lang';
import { parse } from './color-parser.js';
import { Rectangle, rect, pt, Point } from './geometry-2d.js';
import { notYetImplemented } from 'lively.lang/function.js';

function floor (x) { return Math.floor(x * 255.99); }

const rgbaRegex = new RegExp('\\s*rgba?\\s*\\(\\s*(\\d+)(%?)\\s*,\\s*(\\d+)(%?)\\s*,\\s*(\\d+)(%?)\\s*(?:,\\s*([0-9\\.]+)\\s*)?\\)\\s*');

function pad (array, n, getPadElement = arr.last) {
  return [...array, ...(new Array(Math.max(n - array.length, 0)).fill(getPadElement(array)))];
}

class ColorHarmony {
  offsets () { return null; }

  stepCount () { return 0; }

  stepSize () { return 0; }

  get name () { return 'Color Harmony'; }

  chord ({ hue, saturation, brightness }) {
    const offsets = this.offsets() || arr.range(0, this.steps()).map(i => i * this.stepSize());
    return offsets.map(offset => Color.hsb(hue + offset % 360, saturation, brightness));
  }
}

export class Complementary extends ColorHarmony {
  get name () { return 'Complement'; }
  steps () { return 1; }
  stepSize () { return 180; }
}

export class Triadic extends ColorHarmony {
  get name () { return 'Triadic'; }
  steps () { return 2; }
  stepSize () { return 120; }
}

export class Tetradic extends ColorHarmony {
  get name () { return 'Tetradic'; }
  offsets () { return [0, 60, 180, 240]; }
}

export class Quadratic extends ColorHarmony {
  get name () { return 'Quadratic'; }
  steps () { return 3; }
  stepSize () { return 90; }
}

export class Analogous extends ColorHarmony {
  get name () { return 'Analogous'; }
  steps () { return 5; }
  offsets () { return [-60, -30, 0, 30, 60]; }
}

export class Neutral extends ColorHarmony {
  get name () { return 'Neutral'; }
  offsets () { return [-30, -15, 0, 15, 30]; }
}

export class Color {
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // class side
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  static random (min, max) {
    if (min === undefined) min = 0;
    if (max === undefined) max = 255;
    return Color.rgb(
      num.random(min, max),
      num.random(min, max),
      num.random(min, max));
  }

  static hsb (hue, sat, brt) {
    const s = sat;
    const b = brt;
    // zero saturation yields gray with the given brightness
    if (sat === 0) return new Color(b, b, b);
    const h = hue % 360;
    const h60 = h / 60;
    const i = Math.floor(h60); // integer part of hue
    const f = h60 - i; // fractional part of hue
    const p = (1.0 - s) * b;
    const q = (1.0 - (s * f)) * b;
    const t = (1.0 - (s * (1.0 - f))) * b;

    switch (i) {
      case 0: return new Color(b, t, p);
      case 1: return new Color(q, b, p);
      case 2: return new Color(p, b, t);
      case 3: return new Color(p, q, b);
      case 4: return new Color(t, p, b);
      case 5: return new Color(b, p, q);
      default: return new Color(0, 0, 0);
    }
  }

  static wheel (n = 10) { return Color.wheelHsb(n, 0.0, 0.9, 0.7); }

  static wheelHsb (n, hue, sat, brt) {
    // Return an array of n colors of varying hue
    const a = new Array(n);
    const step = 360.0 / (Math.max(n, 1));
    for (let i = 0; i < n; i++) {
      a[i] = Color.hsb(hue + i * step, sat, brt);
    }
    return a;
  }

  static rgb (r, g, b) { return new Color(r / 255, g / 255, b / 255); }

  static rgbHex (colorHexString) {
    const colorData = this.parseHex(colorHexString);
    if (colorData && colorData[0] >= 0 && colorData[1] >= 0 && colorData[2] >= 0) {
      return new Color(colorData[0], colorData[1], colorData[2]);
    } else {
      return null;
    }
  }

  static rgba (r, g, b, a) {
    return new Color(r / 255, g / 255, b / 255, a);
  }

  static fromLiteral (spec) {
    return new Color(spec.r, spec.g, spec.b, spec.a);
  }

  static fromTuple (tuple) {
    return new Color(tuple[0], tuple[1], tuple[2], tuple[3]);
  }

  static fromTuple8Bit (tuple) {
    return new Color(tuple[0] / 255, tuple[1] / 255, tuple[2] / 255, tuple[3] / 255);
  }

  static fromString (str) {
    if (!str || str === 'none') {
      return null;
    } else {
      return this.fromTuple(this.parse(str));
    }
  }

  static get rgbaRegex () { return rgbaRegex; }

  static parse (str) {
    let color;
    if (!str || str === 'none') {
      return null;
    } else {
      color = parse(str);
      return [color.red, color.green, color.blue, color.alpha];
    }
  }

  static parseRGB (str) {
    // match string of the form rgb([r],[g],[b]) or rgb([r%],[g%],[b%]),
    // allowing whitespace between all components
    const match = str.match(this.rgbaRegex);
    if (match) {
      const r = parseInt(match[1]) / (match[2] ? 100 : 255);
      const g = parseInt(match[3]) / (match[4] ? 100 : 255);
      const b = parseInt(match[5]) / (match[6] ? 100 : 255);
      const a = match[7] ? parseFloat(match[7]) : 1.0;
      return [r, g, b, a];
    }
    return null;
  }

  static parseHex (colStr) {
    let rHex; let gHex; let bHex; let str = '';
    for (let i = 0; i < colStr.length; i++) {
      const c = colStr[i].toLowerCase();
      if (c === 'a' || c === 'b' || c === 'c' || c === 'd' || c === 'e' || c === 'f' || c === '0' || c === '1' ||
        c === '2' || c === '3' || c === '4' || c === '5' || c === '6' || c === '7' || c === '8' || c === '9') {
        str += c;
      }
    }
    if (str.length === 6) {
      rHex = str.substring(0, 2);
      gHex = str.substring(2, 4);
      bHex = str.substring(4, 6);
    } else if (str.length === 3) {
      // short form like #C00
      rHex = str.substring(0, 1);
      rHex += rHex;
      gHex = str.substring(1, 2);
      gHex += gHex;
      bHex = str.substring(2, 3);
      bHex += bHex;
    } else {
      return null;
    }
    const r = parseInt(rHex, 16) / 255;
    const g = parseInt(gHex, 16) / 255;
    const b = parseInt(bHex, 16) / 255;
    return [r, g, b];
  }

  static get named () {
    if (this._named) return this._named;
    return this._named = {
      black: new Color(0, 0, 0),
      almostBlack: Color.rgb(64, 64, 64),
      white: new Color(1, 1, 1),
      gray: new Color(0.8, 0.8, 0.8),
      red: new Color(0.8, 0, 0),
      green: new Color(0, 0.8, 0),
      yellow: new Color(0.8, 0.8, 0),
      lightBlue: new Color.rgb(117, 190, 235),
      blue: new Color(0, 0, 0.8),
      purple: new Color(0.5, 0, 0.5),
      magenta: new Color(1, 0, 1),
      pink: Color.rgb(255, 30, 153),
      turquoise: Color.rgb(0, 240, 255),
      tangerine: Color.rgb(242, 133, 0),
      orange: Color.rgb(255, 153, 0),
      cyan: Color.rgb(0, 255, 255),
      brown: Color.rgb(182, 67, 0),
      limeGreen: Color.rgb(51, 255, 0),
      darkGray: Color.rgb(102, 102, 102),
      lightGray: Color.rgb(230, 230, 230),
      veryLightGray: Color.rgb(243, 243, 243),
      transparent: Color.rgba(69, 85, 134, 0),
      lively: Color.rgb(245, 124, 0),
      link: Color.rgb(26, 21, 191)
    };
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // instance side
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get isColor () { return true; }

  constructor (r, g, b, a) {
    // Upon loading a world this is sometimes called with a string instead of a number
    // which is why the parsing is necessary here.
    // Fixme: This should not be needed in an optimal case. 2022-021-21
    this.r = r ? num.roundTo(Number.parseFloat(r), 1e-4) : 0;
    this.g = g ? num.roundTo(Number.parseFloat(g), 1e-4) : 0;
    this.b = b ? num.roundTo(Number.parseFloat(b), 1e-4) : 0;
    this.a = a ? num.roundTo(Number.parseFloat(a), 1e-4) : (a === 0 ? 0 : 1);
  }

  get nickname () {
    const found = Object.entries(Color._named).find(([name, color]) => color === this);
    if (found) return found[0];
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  grayValue () {
    return (this.r + this.g + this.b) / 3;
  }

  /**
   * Returns the perceived brightness of the color.
   * @returns {number}
   */
  luma () {
    return 0.299 * this.r + 0.587 * this.g + 0.114 * this.b;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // comparing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  equals (other) {
    if (!other) return false;
    return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transforming
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  darker (recursion) {
    const result = this.mixedWith(Color.black, 0.5);
    return recursion > 1 ? result.darker(recursion - 1) : result;
  }

  lighter (recursion) {
    if (recursion === 0) { return this; }
    const result = this.mixedWith(Color.white, 0.5);
    return recursion > 1 ? result.lighter(recursion - 1) : result;
  }

  interpolate (p, other) {
    if (other.isGradient) {
      return other.interpolate((1 - p), this);
    }
    other = obj.isArray(other) ? other : other.toTuple();
    return Color.fromTuple(this.toTuple().map((v, k) => num.interpolate(p, v, other[k])));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // printing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  toString () {
    return this.a === 1
      ? 'rgb(' + floor(this.r) + ',' + floor(this.g) + ',' + floor(this.b) + ')'
      : this.toRGBAString();
  }

  toRGBAString () {
    function floor (x) { return Math.floor(x * 255.99); }
    return 'rgba(' + floor(this.r) + ',' + floor(this.g) + ',' + floor(this.b) + ',' + this.a + ')';
  }

  toHexString () {
    function floor (x) { return Math.floor(x * 255.99); }
    function addLeadingZero (string) {
      let s = string;
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    }
    return addLeadingZero(floor(this.r).toString(16)) +
        addLeadingZero(floor(this.g).toString(16)) +
        addLeadingZero(floor(this.b).toString(16));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // converting
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  toTuple () {
    return [this.r, this.g, this.b, this.a];
  }

  toTuple8Bit () {
    return [this.r * 255, this.g * 255, this.b * 255, this.a * 255];
  }

  toHSB () {
    const max = Math.max(this.r, this.g, this.b);
    const min = Math.min(this.r, this.g, this.b);
    let h; let s; const b = max;
    if (max === min) {
      h = 0;
    } else if (max === this.r) {
      h = 60 * (0 + ((this.g - this.b) / (max - min)));
    } else if (max === this.g) {
      h = 60 * (2 + ((this.b - this.r) / (max - min)));
    } else if (max === this.b) {
      h = 60 * (4 + ((this.r - this.g) / (max - min)));
    }
    h = (h + 360) % 360;
    s = max === 0 ? 0 : (max - min) / max;
    return [h, s, b];
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // instance creation
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  withA (a) {
    return new Color(this.r, this.g, this.b, a);
  }

  mixedWith (other, proportion) {
    // Mix with another color -- 1.0 is all this, 0.0 is all other
    const p = proportion;
    const q = 1.0 - p;
    return new Color(this.r * p + other.r * q, this.g * p + other.g * q, this.b * p + other.b * q, this.a * p + other.a * q);
  }

  // FIXME: invert sounds like mutation, versus createInverse or similar
  invert () {
    return Color.rgb(255 * (1 - this.r), 255 * (1 - this.g), 255 * (1 - this.b));
  }

  toCSSString () {
    return this.toRGBAString();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  __serialize__ () {
    return {
      __expr__: 'Color.' + (this.nickname || this.toString()),
      bindings: { 'lively.graphics/color.js': ['Color'] }
    };
  }

  toJSExpr () {
    return `Color.${this.name || this.toString()}`;
  }

  get name () {
    const named = Color.named;
    return Object.keys(named).find(ea => named[ea].equals(this));
  }
}

Object.assign(Color, Color.named);

class Gradient {
  static create (offsetAndColors) {
    /*
     Create a linear gradient by specifying only the
     stops in a less cumbersome fashion:
       LinearGradient.create({"0": Color.red, ".5": Color.green, ...)
    */
    const parsedStops = [];
    for (const offset in offsetAndColors) {
      parsedStops.push({ offset: Number(offset), color: offsetAndColors[offset] });
    }
    return new this({ stops: parsedStops });
  }

  static parse (str) {
    if (str.startsWith('radial-gradient')) {
      return RadialGradient.parse(str);
    }
    if (str.startsWith('linear-gradient')) {
      return LinearGradient.parse(str);
    }
    // fallback to color
    return Color.fromTuple(Color.parse(str));
  }

  constructor (stops) {
    this.stops = stops ? stops.map(s => s) : [];
  }

  equals (other) {
    if (other && other.isGradient) {
      return this.toString() === other.toString();
    }
    return false;
  }

  getStopsLighter (n) {
    return this.stops.map(function (ea) {
      return { offset: ea.offset, color: ea.color.lighter(n) };
    });
  }

  getStopsDarker (n) {
    return this.stops.map(function (ea) {
      return { offset: ea.offset, color: ea.color.darker(n) };
    });
  }

  get isGradient () { return true; }

  interpolateStops (i, stops) {
    const ownStops = pad(this.stops, stops.length);
    const otherStops = pad(stops, this.stops.length);
    const interpolatedStops = [];
    let idx, c1, c2, off1, off2;
    for (idx = 0; idx < ownStops.length; idx++) {
      ({ color: c1, offset: off1 } = ownStops[idx]);
      ({ color: c2, offset: off2 } = otherStops[idx]);
      interpolatedStops.push({
        color: c1.interpolate(i, c2),
        offset: num.interpolate(i, off1, off2)
      });
    }
    return interpolatedStops;
  }

  __serialize__ () {
    return {
      __expr__: this.toJSExpr(),
      bindings: {
        'lively.graphics/color.js': ['Color', 'RadialGradient', 'LinearGradient'],
        'lively.graphics/geometry-2d.js': ['pt', 'rect']
      }
    };
  }
}

export class LinearGradient extends Gradient {
  static parse (str) {
    notYetImplemented('Parsing `LinearGradient`');
  }

  constructor ({ stops, vector } = {}) {
    super(stops);
    this.vector = vector;
  }

  get type () { return 'linearGradient'; }

  get vectors () {
    return {
      northsouth: rect(pt(0, 0), pt(0, 1)),
      northeast: rect(pt(1, 0), pt(0, 1)),
      westeast: rect(pt(1, 0), pt(0, 0)),
      southeast: rect(pt(1, 1), pt(0, 0)),
      southnorth: rect(pt(0, 1), pt(0, 0)),
      southwest: rect(pt(0, 1), pt(1, 0)), // Down and to the left
      eastwest: rect(pt(0, 0), pt(1, 0)),
      northwest: rect(pt(0, 0), pt(1, 1))
    };
  }

  angleToRect (rad) {
    return Point.polar(1, rad).extentAsRectangle().withCenter(pt(0.5, 0.5));
  }

  vectorAsAngle () {
    return this.vector.extent().theta();
  }

  toString () { return this.toCSSString(); }

  get vector () { return this._vector; }
  set vector (value) {
    if (!value) this._vector = this.vectors.northsouth;
    else if (typeof value === 'string') this._vector = this.vectors[value.toLowerCase()];
    else if (typeof value === 'number') this._vector = this.angleToRect(value); // radians
    else this._vector = value;
  }

  lighter (n) { return new this.constructor({ stops: this.getStopsLighter(n), vector: this.vector }); }
  darker (n) { return new this.constructor({ stops: this.getStopsDarker(n), vector: this.vector }); }

  interpolate (i, other, target = { width: 1000, height: 1000 }) {
    if (other.isColor) {
      other = new LinearGradient({
        vector: this.vector,
        stops: this.stops.map(({ offset }) => {
          return { color: other, offset };
        })
      });
    }

    if (other.type === 'radialGradient') {
      // fancy trans gradient interpolation
      if (i < 0.5) {
        return new LinearGradient({
          vector: this.vector.interpolate(i, rect(0, 0, 0, 1)),
          // use monochrome stops instead
          stops: this.interpolateStops(i, other.stops.map(({ color, offset }, i) => {
            return { color, offset: 1 };
          }))
        });
      }
      if (i >= 0.5) {
        return new RadialGradient({
          stops: this.interpolateStops(i, other.stops),
          focus: pt(0.5, 0).interpolate(i, other.focus),
          bounds: rect(0, 0, target.width * 100, target.height * 2).interpolate(i, other.bounds)
        });
      }
    }

    // else we just simply interpolate between the stops
    return new LinearGradient({
      stops: this.interpolateStops(i, other.stops),
      vector: this.vector.interpolate(i, other.vector)
    });
  }

  toCSSString () {
    // default webkit way of defining gradients
    const deg = num.toDegrees(this.vectorAsAngle()) + 90;
    let str = 'linear-gradient(' + (deg + 'deg,');
    str += this.stops.map(s => `${s.color.toRGBAString()} ${(s.offset * 100).toFixed() + '%'}`).join(',');
    str += ')';
    return str;
  }

  toJSExpr () {
    const stops = this.stops.map(ea => `{offset: ${ea.offset}, color: ${ea.color.toJSExpr()}}`).join(', ');
    return `new LinearGradient({stops: [${stops}], vector: ${this.vector}})`;
  }
}

export class RadialGradient extends Gradient {
  static parse (str) {
    notYetImplemented('Parsing `RadialGradient`');
  }

  constructor ({ stops, focus, bounds } = {}) {
    super(stops);
    this.focus = focus || pt(0.5, 0.5);
    this.bounds = bounds || new Rectangle(0, 0, 20, 20);
  }

  get type () { return 'radialGradient'; }

  toString () { return this.toCSSString(); }

  lighter (n) { return new this.constructor({ stops: this.getStopsLighter(n), focus: this.focus, bounds: this.bounds }); }
  darker () { return new this.constructor({ stops: this.getStopsDarker(), focus: this.focus, bounds: this.bounds }); }

  interpolate (i, other, target = { height: 1000, width: 1000 }) {
    if (other.isColor) {
      other = new RadialGradient({
        vector: this.vector,
        bounds: this.bounds,
        stops: this.stops.map(({ offset }) => {
          return { color: other, offset };
        })
      });
    }

    if (other.type === 'linearGradient') {
      return other.interpolate(1 - i, this, target);
    }
    // plain radial to radial tweening
    return new RadialGradient({
      bounds: this.bounds.interpolate(i, other.bounds),
      stops: this.interpolateStops(i, other.stops),
      focus: this.focus.interpolate(i, other.focus)
    });
  }

  toCSSString () {
    const innerCircle = this.focus.scaleBy(100.0);
    const ext = this.bounds.extent();
    let str = `radial-gradient(${ext.x / 2}px ${ext.y / 2}px at ${innerCircle.x}% ${innerCircle.y}%`;
    for (let i = 0; i < this.stops.length; i++) { str += `,${this.stops[i].color.toRGBAString()} ${(this.stops[i].offset * 100).toFixed() + '%'}`; }
    str += ')';
    return str;
  }

  toJSExpr () {
    const stops = this.stops.map(ea => `{offset: ${ea.offset}, color: ${ea.color.toJSExpr()}}`).join(', ');
    return `new RadialGradient({stops: [${stops}], bounds: ${this.bounds}, focus: ${this.focus.toString(false)}})`;
  }
}

export const rainbow = [
  Color.purple, Color.blue, Color.lightBlue, Color.green, Color.yellow, Color.orange, Color.red, Color.transparent // transparent is used to force mixed state for opacity as well
];
/*
   Flat design or flat UI colors are quite popular in web design today
   where bold, bright colors are used to create clean, simple interfaces.
*/

export const flatDesignColors = [
  '#1abc9c', '#e8f8f5', '#d1f2eb', '#a3e4d7', '#76d7c4', '#48c9b0', '#1abc9c', '#17a589', '#148f77', '#117864', '#0e6251', '#16a085',
  '#e8f6f3', '#d0ece7', '#a2d9ce', '#73c6b6', '#45b39d', '#16a085', '#138d75', '#117a65', '#0e6655', '#0b5345', '#2ecc71', '#eafaf1',
  '#d5f5e3', '#abebc6', '#82e0aa', '#58d68d', '#2ecc71', '#28b463', '#239b56', '#1d8348', '#186a3b', '#27ae60', '#e9f7ef', '#d4efdf',
  '#a9dfbf', '#7dcea0', '#52be80', '#27ae60', '#229954', '#1e8449', '#196f3d', '#145a32', '#3498db', '#ebf5fb', '#d6eaf8', '#aed6f1',
  '#85c1e9', '#5dade2', '#3498db', '#2e86c1', '#2874a6', '#21618c', '#1b4f72', '#2980b9', '#eaf2f8', '#d4e6f1', '#a9cce3', '#7fb3d5',
  '#5499c7', '#2980b9', '#2471a3', '#1f618d', '#1a5276', '#154360', '#9b59b6', '#f5eef8', '#ebdef0', '#d7bde2', '#c39bd3', '#af7ac5',
  '#9b59b6', '#884ea0', '#76448a', '#633974', '#512e5f', '#8e44ad', '#f4ecf7', '#e8daef', '#d2b4de', '#bb8fce', '#a569bd', '#8e44ad',
  '#7d3c98', '#6c3483', '#5b2c6f', '#4a235a', '#34495e', '#ebedef', '#d6dbdf', '#aeb6bf', '#85929e', '#5d6d7e', '#34495e', '#2e4053',
  '#283747', '#212f3c', '#1b2631', '#2c3e50', '#eaecee', '#d5d8dc', '#abb2b9', '#808b96', '#566573', '#2c3e50', '#273746', '#212f3d',
  '#1c2833', '#17202a', '#f1c40f', '#fef9e7', '#fcf3cf', '#f9e79f', '#f7dc6f', '#f4d03f', '#f1c40f', '#d4ac0d', '#b7950b', '#9a7d0a',
  '#7d6608', '#f39c12', '#fef5e7', '#fdebd0', '#fad7a0', '#f8c471', '#f5b041', '#f39c12', '#d68910', '#b9770e', '#9c640c', '#7e5109',
  '#e67e22', '#fdf2e9', '#fae5d3', '#f5cba7', '#f0b27a', '#eb984e', '#e67e22', '#ca6f1e', '#af601a', '#935116', '#784212', '#d35400',
  '#fbeee6', '#f6ddcc', '#edbb99', '#e59866', '#dc7633', '#d35400', '#ba4a00', '#a04000', '#873600', '#6e2c00', '#e74c3c', '#fdedec',
  '#fadbd8', '#f5b7b1', '#f1948a', '#ec7063', '#e74c3c', '#cb4335', '#b03a2e', '#943126', '#78281f', '#c0392b', '#f9ebea', '#f2d7d5',
  '#e6b0aa', '#d98880', '#cd6155', '#c0392b', '#a93226', '#922b21', '#7b241c', '#641e16', '#ecf0f1', '#fdfefe', '#fbfcfc', '#f7f9f9',
  '#f4f6f7', '#f0f3f4', '#ecf0f1', '#d0d3d4', '#b3b6b7', '#979a9a', '#7b7d7d', '#bdc3c7', '#f8f9f9', '#f2f3f4', '#e5e7e9', '#d7dbdd',
  '#cacfd2', '#bdc3c7', '#a6acaf', '#909497', '#797d7f', '#626567', '#95a5a6', '#f4f6f6', '#eaeded', '#d5dbdb', '#bfc9ca', '#aab7b8',
  '#95a5a6', '#839192', '#717d7e', '#5f6a6a', '#4d5656', '#7f8c8d', '#f2f4f4', '#e5e8e8', '#ccd1d1', '#b2babb', '#99a3a4', '#7f8c8d',
  '#707b7c', '#616a6b', '#515a5a', '#424949'];

/*
  Material design is a visual language and design system developed
  by Google with an almost flat style and vibrant color schemes.
*/

export const materialDesignColors = [
  '#f44336', '#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828',
  '#b71c1c', '#ff8a80', '#ff5252', '#ff1744', '#d50000', '#e91e63', '#fce4ec', '#f8bbd0', '#f48fb1', '#f06292',
  '#ec407a', '#e91e63', '#d81b60', '#c2185b', '#ad1457', '#880e4f', '#ff80ab', '#ff4081', '#f50057', '#c51162',
  '#9c27b0', '#f3e5f5', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#9c27b0', '#8e24aa', '#7b1fa2', '#6a1b9a',
  '#4a148c', '#ea80fc', '#e040fb', '#d500f9', '#aa00ff', '#673ab7', '#ede7f6', '#d1c4e9', '#b39ddb', '#9575cd',
  '#7e57c2', '#673ab7', '#5e35b1', '#512da8', '#4527a0', '#311b92', '#b388ff', '#7c4dff', '#651fff', '#6200ea',
  '#3f51b5', '#e8eaf6', '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0', '#3f51b5', '#3949ab', '#303f9f', '#283593',
  '#1a237e', '#8c9eff', '#536dfe', '#3d5afe', '#304ffe', '#2196f3', '#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6',
  '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0', '#0d47a1', '#82b1ff', '#448aff', '#2979ff', '#2962ff',
  '#03a9f4', '#e1f5fe', '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#039be5', '#0288d1', '#0277bd',
  '#01579b', '#80d8ff', '#40c4ff', '#00b0ff', '#0091ea', '#00bcd4', '#e0f7fa', '#b2ebf2', '#80deea', '#4dd0e1',
  '#26c6da', '#00bcd4', '#00acc1', '#0097a7', '#00838f', '#006064', '#84ffff', '#18ffff', '#00e5ff', '#00b8d4',
  '#009688', '#e0f2f1', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00897b', '#00796b', '#00695c',
  '#004d40', '#a7ffeb', '#64ffda', '#1de9b6', '#00bfa5', '#4caf50', '#e8f5e9', '#c8e6c9', '#a5d6a7', '#81c784',
  '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20', '#b9f6ca', '#69f0ae', '#00e676', '#00c853',
  '#8bc34a', '#f1f8e9', '#dcedc8', '#c5e1a5', '#aed581', '#9ccc65', '#8bc34a', '#7cb342', '#689f38', '#558b2f',
  '#33691e', '#ccff90', '#b2ff59', '#76ff03', '#64dd17', '#cddc39', '#f9fbe7', '#f0f4c3', '#e6ee9c', '#dce775',
  '#d4e157', '#cddc39', '#c0ca33', '#afb42b', '#9e9d24', '#827717', '#f4ff81', '#eeff41', '#c6ff00', '#aeea00',
  '#ffeb3b', '#fffde7', '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#ffeb3b', '#fdd835', '#fbc02d', '#f9a825',
  '#f57f17', '#ffff8d', '#ffff00', '#ffea00', '#ffd600', '#ffc107', '#fff8e1', '#ffecb3', '#ffe082', '#ffd54f',
  '#ffca28', '#ffc107', '#ffb300', '#ffa000', '#ff8f00', '#ff6f00', '#ffe57f', '#ffd740', '#ffc400', '#ffab00',
  '#ff9800', '#fff3e0', '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00',
  '#e65100', '#ffd180', '#ffab40', '#ff9100', '#ff6d00', '#ff5722', '#fbe9e7', '#ffccbc', '#ffab91', '#ff8a65',
  '#ff7043', '#ff5722', '#f4511e', '#e64a19', '#d84315', '#bf360c', '#ff9e80', '#ff6e40', '#ff3d00', '#dd2c00',
  '#795548', '#efebe9', '#d7ccc8', '#bcaaa4', '#a1887f', '#8d6e63', '#795548', '#6d4c41', '#5d4037', '#4e342e',
  '#3e2723', '#9e9e9e', '#fafafa', '#f5f5f5', '#eeeeee', '#e0e0e0', '#bdbdbd', '#9e9e9e', '#757575', '#616161',
  '#424242', '#212121', '#607d8b', '#eceff1', '#cfd8dc', '#b0bec5', '#90a4ae', '#78909c', '#607d8b', '#546e7a',
  '#455a64', '#37474f', '#263238', '#ffffff', '#000000'];

export const webSafeColors = ['ccff00', 'ccff33', 'ccff66', 'ccff99', 'ccffcc', 'ccffff', 'ffffff', 'ffffcc', 'ffff99', 'ffff66', 'ffff33', 'ffff00', 'cccc00', 'cccc33', 'cccc66', 'cccc99', 'cccccc', 'ccccff', 'ffccff', 'ffcccc', 'ffcc99', 'ffcc66', 'ffcc33', 'ffcc00', 'cc9900', 'cc9933', 'cc9966', 'cc9999', 'cc99cc', 'cc99ff', 'ff99ff', 'ff99cc', 'ff9999', 'ff9966', 'ff9933', 'ff9900', 'cc6600', 'cc6633', 'cc6666', 'cc6699', 'cc66cc', 'cc66ff', 'ff66ff', 'ff66cc', 'ff6699', 'ff6666', 'ff6633', 'ff6600', 'cc3300', 'cc3333', 'cc3366', 'cc3399', 'cc33cc', 'cc33ff', 'ff33ff', 'ff33cc', 'ff3399', 'ff3366', 'ff3333', 'ff3300', 'cc0000', 'cc0033', 'cc0066', 'cc0099', 'cc00cc', 'cc00ff', 'ff00ff', 'ff00cc', 'ff0099', 'ff0066', 'ff0033', 'ff0000', '660000', '660033', '660066', '660099', '6600cc', '6600ff', '9900ff', '9900cc', '990099', '990066', '990033', '990000', '663300', '663333', '663366', '663399', '6633cc', '6633ff', '9933ff', '9933cc', '993399', '993366', '993333', '993300', '666600', '666633', '666666', '666699', '6666cc', '6666ff', '9966ff', '9966cc', '996699', '996666', '996633', '996600', '669900', '669933', '669966', '669999', '6699cc', '6699ff', '9999ff', '9999cc', '999999', '999966', '999933', '999900', '66cc00', '66cc33', '66cc66', '66cc99', '66cccc', '66ccff', '99ccff', '99cccc', '99cc99', '99cc66', '99cc33', '99cc00', '66ff00', '66ff33', '66ff66', '66ff99', '66ffcc', '66ffff', '99ffff', '99ffcc', '99ff99', '99ff66', '99ff33', '99ff00', '00ff00', '00ff33', '00ff66', '00ff99', '00ffcc', '00ffff', '33ffff', '33ffcc', '33ff99', '33ff66', '33ff33', '33ff00', '00cc00', '00cc33', '00cc66', '00cc99', '00cccc', '00ccff', '33ccff', '33cccc', '33cc99', '33cc66', '33cc33', '33cc00', '009900', '009933', '009966', '009999', '0099cc', '0099ff', '3399ff', '3399cc', '339999', '339966', '339933', '339900', '006600', '006633', '006666', '006699', '0066cc', '0066ff', '3366ff', '3366cc', '336699', '336666', '336633', '336600', '003300', '003333', '003366', '003399', '0033cc', '0033ff', '3333ff', '3333cc', '333399', '333366', '333333', '333300', '000000', '000033', '000066', '000099', '0000cc', '0000ff', '3300ff', '3300cc', '330099', '330066', '330033', '330000'];
