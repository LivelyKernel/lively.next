(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang) {
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var get$1 = function get$1(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get$1(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};



var set$1 = function set$1(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set$1(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

function parse$1(string$$1) {
	var color = new Color$1(string$$1);
	return { red: color.red() / 255, green: color.green() / 255, blue: color.blue() / 255, alpha: color.alpha() };
}

// http://upshots.org/javascript/javascript-color-class
// MIT licensed, Copyright (c) 2011 Mike Dunn
// https://github.com/moagrius/Color/blob/master/LICENSE

var Events = {
	RGB_UPDATED: 'RGBUpdated',
	HSL_UPDATED: 'HSLUpdated',
	HSV_UPDATED: 'HSVUpdated',
	HEX_UPDATED: 'HexUpdated',
	INT_UPDATED: 'IntUpdated',
	UPDATED: 'updated'
};

var namedColors = {
	'transparent': 'rgba(0, 0, 0, 0)', 'aliceblue': '#F0F8FF', 'antiquewhite': '#FAEBD7', 'aqua': '#00FFFF', 'aquamarine': '#7FFFD4',
	'azure': '#F0FFFF', 'beige': '#F5F5DC', 'bisque': '#FFE4C4', 'black': '#000000', 'blanchedalmond': '#FFEBCD', 'blue': '#0000FF', 'blueviolet': '#8A2BE2',
	'brown': '#A52A2A', 'burlywood': '#DEB887', 'cadetblue': '#5F9EA0', 'chartreuse': '#7FFF00', 'chocolate': '#D2691E', 'coral': '#FF7F50',
	'cornflowerblue': '#6495ED', 'cornsilk': '#FFF8DC', 'crimson': '#DC143C', 'cyan': '#00FFFF', 'darkblue': '#00008B', 'darkcyan': '#008B8B', 'darkgoldenrod': '#B8860B',
	'darkgray': '#A9A9A9', 'darkgrey': '#A9A9A9', 'darkgreen': '#006400', 'darkkhaki': '#BDB76B', 'darkmagenta': '#8B008B', 'darkolivegreen': '#556B2F',
	'darkorange': '#FF8C00', 'darkorchid': '#9932CC', 'darkred': '#8B0000', 'darksalmon': '#E9967A', 'darkseagreen': '#8FBC8F', 'darkslateblue': '#483D8B',
	'darkslategray': '#2F4F4F', 'darkslategrey': '#2F4F4F', 'darkturquoise': '#00CED1', 'darkviolet': '#9400D3', 'deeppink': '#FF1493', 'deepskyblue': '#00BFFF',
	'dimgray': '#696969', 'dimgrey': '#696969', 'dodgerblue': '#1E90FF', 'firebrick': '#B22222', 'floralwhite': '#FFFAF0', 'forestgreen': '#228B22',
	'fuchsia': '#FF00FF', 'gainsboro': '#DCDCDC', 'ghostwhite': '#F8F8FF', 'gold': '#FFD700', 'goldenrod': '#DAA520', 'gray': '#808080', 'grey': '#808080',
	'green': '#008000', 'greenyellow': '#ADFF2F', 'honeydew': '#F0FFF0', 'hotpink': '#FF69B4', 'indianred': '#CD5C5C', 'indigo': '#4B0082', 'ivory': '#FFFFF0',
	'khaki': '#F0E68C', 'lavender': '#E6E6FA', 'lavenderblush': '#FFF0F5', 'lawngreen': '#7CFC00', 'lemonchiffon': '#FFFACD', 'lightblue': '#ADD8E6',
	'lightcoral': '#F08080', 'lightcyan': '#E0FFFF', 'lightgoldenrodyellow': '#FAFAD2', 'lightgray': '#D3D3D3', 'lightgrey': '#D3D3D3', 'lightgreen': '#90EE90',
	'lightpink': '#FFB6C1', 'lightsalmon': '#FFA07A', 'lightseagreen': '#20B2AA', 'lightskyblue': '#87CEFA', 'lightslategray': '#778899',
	'lightslategrey': '#778899', 'lightsteelblue': '#B0C4DE', 'lightyellow': '#FFFFE0', 'lime': '#00FF00', 'limegreen': '#32CD32', 'linen': '#FAF0E6',
	'magenta': '#FF00FF', 'maroon': '#800000', 'mediumaquamarine': '#66CDAA', 'mediumblue': '#0000CD', 'mediumorchid': '#BA55D3', 'mediumpurple': '#9370D8',
	'mediumseagreen': '#3CB371', 'mediumslateblue': '#7B68EE', 'mediumspringgreen': '#00FA9A', 'mediumturquoise': '#48D1CC', 'mediumvioletred': '#C71585',
	'midnightblue': '#191970', 'mintcream': '#F5FFFA', 'mistyrose': '#FFE4E1', 'moccasin': '#FFE4B5', 'navajowhite': '#FFDEAD', 'navy': '#000080', 'oldlace': '#FDF5E6',
	'olive': '#808000', 'olivedrab': '#6B8E23', 'orange': '#FFA500', 'orangered': '#FF4500', 'orchid': '#DA70D6', 'palegoldenrod': '#EEE8AA',
	'palegreen': '#98FB98', 'paleturquoise': '#AFEEEE', 'palevioletred': '#D87093', 'papayawhip': '#FFEFD5', 'peachpuff': '#FFDAB9', 'peru': '#CD853F',
	'pink': '#FFC0CB', 'plum': '#DDA0DD', 'powderblue': '#B0E0E6', 'purple': '#800080', 'red': '#FF0000', 'rosybrown': '#BC8F8F', 'royalblue': '#4169E1',
	'saddlebrown': '#8B4513', 'salmon': '#FA8072', 'sandybrown': '#F4A460', 'seagreen': '#2E8B57', 'seashell': '#FFF5EE', 'sienna': '#A0522D', 'silver': '#C0C0C0',
	'skyblue': '#87CEEB', 'slateblue': '#6A5ACD', 'slategray': '#708090', 'slategrey': '#708090', 'snow': '#FFFAFA', 'springgreen': '#00FF7F',
	'steelblue': '#4682B4', 'tan': '#D2B48C', 'teal': '#008080', 'thistle': '#D8BFD8', 'tomato': '#FF6347', 'turquoise': '#40E0D0', 'violet': '#EE82EE'
};

var absround = function absround(number) {
	return 0.5 + number << 0;
};

var hue2rgb = function hue2rgb(a, b, c) {
	if (c < 0) c += 1;
	if (c > 1) c -= 1;
	if (c < 1 / 6) return a + (b - a) * 6 * c;
	if (c < 1 / 2) return b;
	if (c < 2 / 3) return a + (b - a) * (2 / 3 - c) * 6;
	return a;
};

var p2v = function p2v(p) {
	return isPercent.test(p) ? absround(parseInt(p) * 2.55) : p;
};

var isHex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
var isHSL = /^hsla?\((\d{1,3}?),\s*(\d{1,3}%),\s*(\d{1,3}%)(,\s*[01]?\.?\d*)?\)$/;
var isRGB = /^rgba?\((\d{1,3}%?),\s*(\d{1,3}%?),\s*(\d{1,3}%?)(,\s*[01]?\.?\d*)?\)$/;
var isPercent = /^\d+(\.\d+)*%$/;

var hexBit = /([0-9a-f])/gi;
var leadHex = /^#/;

var matchHSL = /^hsla?\((\d{1,3}),\s*(\d{1,3})%,\s*(\d{1,3})%(,\s*([01]?\.?\d*))?\)$/;
var matchRGB = /^rgba?\((\d{1,3}%?),\s*(\d{1,3}%?),\s*(\d{1,3}%?)(,\s*([01]?\.?\d*))?\)$/;

function Color$1(value) {

	this._listeners = {};

	this.subscribe(Events.RGB_UPDATED, this._RGBUpdated);
	this.subscribe(Events.HEX_UPDATED, this._HEXUpdated);
	this.subscribe(Events.HSL_UPDATED, this._HSLUpdated);
	this.subscribe(Events.HSV_UPDATED, this._HSVUpdated);
	this.subscribe(Events.INT_UPDATED, this._INTUpdated);

	this.parse(value);
}

Color$1.prototype._decimal = 0;
Color$1.prototype._hex = '#000000';
Color$1.prototype._red = 0;
Color$1.prototype._green = 0;
Color$1.prototype._blue = 0;
Color$1.prototype._hue = 0;
Color$1.prototype._saturation = 0;
Color$1.prototype._lightness = 0;
Color$1.prototype._brightness = 0;
Color$1.prototype._alpha = 1;

Color$1.prototype.parse = function (value) {
	if (typeof value == 'undefined') {
		return this;
	}
	switch (true) {
		case isFinite(value):
			this.decimal(value);
			this.output = Color$1.INT;
			return this;
		case value instanceof Color$1:
			this.copy(value);
			return this;
		default:
			switch (typeof value === 'undefined' ? 'undefined' : _typeof(value)) {
				case 'object':
					this.set(value);
					return this;
				case 'string':
					switch (true) {
						case namedColors.hasOwnProperty(value):
							value = namedColors[value];
							var stripped = value.replace(leadHex, '');
							this.decimal(parseInt(stripped, 16));
							return this;
						case isHex.test(value):
							var stripped = value.replace(leadHex, '');
							if (stripped.length == 3) {
								stripped = stripped.replace(hexBit, '$1$1');
							};
							this.decimal(parseInt(stripped, 16));
							return this;
						case isRGB.test(value):
							var parts = value.match(matchRGB);
							this.red(p2v(parts[1]));
							this.green(p2v(parts[2]));
							this.blue(p2v(parts[3]));
							this.alpha(parseFloat(parts[5]) || 1);
							this.output = (isPercent.test(parts[1]) ? 2 : 1) + (parts[5] ? 2 : 0);
							return this;
						case isHSL.test(value):
							var parts = value.match(matchHSL);
							this.hue(parseInt(parts[1]));
							this.saturation(parseInt(parts[2]));
							this.lightness(parseInt(parts[3]));
							this.alpha(parseFloat(parts[5]) || 1);
							this.output = parts[5] ? 6 : 5;
							return this;
					};
			};

	}
	return this;
};

Color$1.prototype.clone = function () {
	return new Color$1(this.decimal());
};

Color$1.prototype.copy = function (color) {
	this.set(color.decimal());
	return this;
};

Color$1.prototype.set = function (key, value) {
	if (arguments.length == 1) {
		if ((typeof key === 'undefined' ? 'undefined' : _typeof(key)) == 'object') {
			for (var p in key) {
				if (typeof this[p] == 'function') {
					this[p](key[p]);
				}
			}
		} else if (isFinite(key)) {
			this.decimal(key);
		}
	} else if (typeof this[key] == 'function') {
		this[key](value);
	}
	return this;
};

Color$1.prototype.interpolate = function (destination, factor) {
	if (!(destination instanceof Color$1)) {
		destination = new Color$1(destination);
	}
	this._red = absround(+this._red + (destination._red - this._red) * factor);
	this._green = absround(+this._green + (destination._green - this._green) * factor);
	this._blue = absround(+this._blue + (destination._blue - this._blue) * factor);
	this._alpha = absround(+this._alpha + (destination._alpha - this._alpha) * factor);
	this.broadcast(Events.RGB_UPDATED);
	this.broadcast(Events.UPDATED);
	return this;
};

Color$1.prototype._RGB2HSL = function () {

	var r = this._red / 255;
	var g = this._green / 255;
	var b = this._blue / 255;

	var max = Math.max(r, g, b);
	var min = Math.min(r, g, b);
	var l = (max + min) / 2;
	var v = max;

	if (max == min) {
		this._hue = 0;
		this._saturation = 0;
		this._lightness = absround(l * 100);
		this._brightness = absround(v * 100);
		return;
	}

	var d = max - min;
	var s = d / (l <= 0.5 ? max + min : 2 - max - min);
	var h = (max == r ? (g - b) / d + (g < b ? 6 : 0) : max == g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;

	this._hue = absround(h * 360);
	this._saturation = absround(s * 100);
	this._lightness = absround(l * 100);
	this._brightness = absround(v * 100);
};

Color$1.prototype._HSL2RGB = function () {
	var h = this._hue / 360;
	var s = this._saturation / 100;
	var l = this._lightness / 100;
	var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	var p = 2 * l - q;
	this._red = absround(hue2rgb(p, q, h + 1 / 3) * 255);
	this._green = absround(hue2rgb(p, q, h) * 255);
	this._blue = absround(hue2rgb(p, q, h - 1 / 3) * 255);
};

Color$1.prototype._HSV2RGB = function () {
	var h = this._hue / 360;
	var s = this._saturation / 100;
	var v = this._brightness / 100;
	var r = 0;
	var g = 0;
	var b = 0;
	var i = Math.floor(h * 6);
	var f = h * 6 - i;
	var p = v * (1 - s);
	var q = v * (1 - f * s);
	var t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0:
			r = v, g = t, b = p;
			break;
		case 1:
			r = q, g = v, b = p;
			break;
		case 2:
			r = p, g = v, b = t;
			break;
		case 3:
			r = p, g = q, b = v;
			break;
		case 4:
			r = t, g = p, b = v;
			break;
		case 5:
			r = v, g = p, b = q;
			break;
	}
	this._red = absround(r * 255);
	this._green = absround(g * 255);
	this._blue = absround(b * 255);
};

Color$1.prototype._INT2HEX = function () {
	var x = this._decimal.toString(16);
	x = '000000'.substr(0, 6 - x.length) + x;
	this._hex = '#' + x.toUpperCase();
};

Color$1.prototype._INT2RGB = function () {
	this._red = this._decimal >> 16;
	this._green = this._decimal >> 8 & 0xFF;
	this._blue = this._decimal & 0xFF;
};

Color$1.prototype._HEX2INT = function () {
	this._decimal = parseInt(this._hex, 16);
};

Color$1.prototype._RGB2INT = function () {
	this._decimal = this._red << 16 | this._green << 8 & 0xffff | this._blue;
};

Color$1.prototype._RGBUpdated = function () {
	this._RGB2INT();
	this._RGB2HSL();
	this._INT2HEX();
};
Color$1.prototype._HSLUpdated = function () {
	this._HSL2RGB();
	this._RGB2INT();
	this._INT2HEX();
};
Color$1.prototype._HSVUpdated = function () {
	this._HSV2RGB();
	this._RGB2INT();
	this._INT2HEX();
};
Color$1.prototype._HEXUpdated = function () {
	this._HEX2INT();
	this._INT2RGB();
	this._RGB2HSL();
};
Color$1.prototype._INTUpdated = function () {
	this._INT2RGB();
	this._RGB2HSL();
	this._INT2HEX();
};

Color$1.prototype._broadcastUpdate = function () {
	this.broadcast(Event.UPDATED);
};

Color$1.prototype.decimal = function (value) {
	return this._handle('_decimal', value, Events.INT_UPDATED);
};

Color$1.prototype.hex = function (value) {
	return this._handle('_hex', value, Events.HEX_UPDATED);
};

Color$1.prototype.red = function (value) {
	return this._handle('_red', value, Events.RGB_UPDATED);
};

Color$1.prototype.green = function (value) {
	return this._handle('_green', value, Events.RGB_UPDATED);
};

Color$1.prototype.blue = function (value) {
	return this._handle('_blue', value, Events.RGB_UPDATED);
};

Color$1.prototype.hue = function (value) {
	return this._handle('_hue', value, Events.HSL_UPDATED);
};

Color$1.prototype.saturation = function (value) {
	return this._handle('_saturation', value, Events.HSL_UPDATED);
};

Color$1.prototype.lightness = function (value) {
	return this._handle('_lightness', value, Events.HSL_UPDATED);
};

Color$1.prototype.brightness = function (value) {
	return this._handle('_brightness', value, Events.HSV_UPDATED);
};

Color$1.prototype.alpha = function (value) {
	return this._handle('_alpha', value);
};

Color$1.prototype._handle = function (prop, value, event) {
	if (typeof this[prop] != 'undefined') {
		if (typeof value != 'undefined') {
			if (value != this[prop]) {
				this[prop] = value;
				if (event) {
					this.broadcast(event);
				}
			}
			this.broadcast(Event.UPDATED);
		}
	}
	return this[prop];
};

Color$1.prototype.getHex = function () {
	return this._hex;
};

Color$1.prototype.getRGB = function () {
	var components = [absround(this._red), absround(this._green), absround(this._blue)];
	return 'rgb(' + components.join(', ') + ')';
};

Color$1.prototype.getPRGB = function () {
	var components = [absround(100 * this._red / 255) + '%', absround(100 * this._green / 255) + '%', absround(100 * this._blue / 255) + '%'];
	return 'rgb(' + components.join(', ') + ')';
};

Color$1.prototype.getRGBA = function () {
	var components = [absround(this._red), absround(this._green), absround(this._blue), this._alpha];
	return 'rgba(' + components.join(', ') + ')';
};

Color$1.prototype.getPRGBA = function () {
	var components = [absround(100 * this._red / 255) + '%', absround(100 * this._green / 255) + '%', absround(100 * this._blue / 255) + '%', this._alpha];
	return 'rgba(' + components.join(', ') + ')';
};

Color$1.prototype.getHSL = function () {
	var components = [absround(this._hue), absround(this._saturation) + '%', absround(this._lightness) + '%'];
	return 'hsl(' + components.join(', ') + ')';
};

Color$1.prototype.getHSLA = function () {
	var components = [absround(this._hue), absround(this._saturation) + '%', absround(this._lightness) + '%', this._alpha];
	return 'hsla(' + components.join(', ') + ')';
};

Color$1.prototype.format = function (string$$1) {
	var tokens = {
		r: this._red,
		g: this._green,
		b: this._blue,
		h: this._hue,
		s: this._saturation,
		l: this._lightness,
		v: this._brightness,
		a: this._alpha,
		x: this._hex,
		d: this._decimal
	};
	for (var token in tokens) {
		string$$1 = string$$1.split('%' + token + '%').join(tokens[token]);
	}
	return string$$1;
};

Color$1.prototype.output = 0;

Color$1.HEX = 0;
Color$1.RGB = 1;
Color$1.PRGB = 2;
Color$1.RGBA = 3;
Color$1.PRGBA = 4;
Color$1.HSL = 5;
Color$1.HSLA = 6;
Color$1.INT = 7;

Color$1.prototype.toString = function () {
	switch (this.output) {
		case 0:
			return this.getHex();
		case 1:
			return this.getRGB();
		case 2:
			return this.getPRGB();
		case 3:
			return this.getRGBA();
		case 4:
			return this.getPRGBA();
		case 5:
			return this.getHSL();
		case 6:
			return this.getHSLA();
		case 7:
			return this._decimal;
	}
	return this.getHex();
};

Color$1.prototype._listeners = null;
Color$1.prototype._isSubscribed = function (type) {
	return this._listeners[type] != null;
};

Color$1.prototype.subscribe = function (type, callback) {
	if (!this._isSubscribed(type)) {
		this._listeners[type] = [];
	}
	this._listeners[type].push(callback);
};

Color$1.prototype.unsubscribe = function (type, callback) {
	if (!this._isSubscribed(type)) {
		return;
	}
	var stack = this._listeners[type];
	for (var i = 0, l = stack.length; i < l; i++) {
		if (stack[i] === callback) {
			stack.splice(i, 1);
			return this.unsubscribe(type, callback);
		}
	}
};

Color$1.prototype.broadcast = function (type, params) {
	if (!this._isSubscribed(type)) {
		return;
	}
	var stack = this._listeners[type];
	var l = stack.length;
	for (var i = 0; i < l; i++) {
		stack[i].apply(this, params);
	}
};

Color$1.prototype.tween = function (duration, color) {
	if (!(color instanceof Color$1)) {
		color = new Color$1(color);
	}
	var start = +new Date();
	var ref = this;
	this.broadcast('tweenStart');
	var interval = setInterval(function () {
		var ellapsed = +new Date() - start;
		var delta = Math.min(1, ellapsed / duration);
		ref.interpolate(color, delta);
		ref.broadcast('tweenProgress');
		if (delta == 1) {
			clearInterval(interval);
			ref.broadcast('tweenComplete');
		}
	}, 20);
	return interval;
};

Color$1.prototype.bind = function (object, property) {
	var ref = this;
	this.subscribe('updated', function () {
		object[property] = ref.toString();
	});
};

Color$1.random = function () {
	return new Color$1(absround(Math.random() * 16777215));
};

Color$1.bind = function (object, property) {
	var color = new Color$1(object[property]);
	color.bind(object, property);
	return color;
};

// adapted from convert-css-length
// MIT licensed, Copyright (c) 2015 Kyle Mathews
// https://github.com/KyleAMathews/convert-css-length/blob/master/LICENSE

var baseFontSize = "16px";
var parseUnit;
var unit;
var unitLess;

if (System.get("@system-env").browser) {
  try {
    var newBaseFontSize = cssLengthParser(16)(window.getComputedStyle(document.body).fontSize);
    if (newBaseFontSize && newBaseFontSize.slice(0, 3) !== "NaN") baseFontSize = newBaseFontSize;
  } catch (e) {}
}

function unit(length) {
  return parseUnit(length)[1];
}

function unitLess(length) {
  return parseUnit(length)[0];
}

function genericCssLengthParser(baseFontSize) {
  if (baseFontSize == null) {
    baseFontSize = baseFontSize;
  }
  return function (length, toUnit, fromContext, toContext) {
    var fromUnit, outputLength, pxLength;
    if (fromContext == null) {
      fromContext = baseFontSize;
    }
    if (toContext == null) {
      toContext = fromContext;
    }
    fromUnit = unit(length);
    if (fromUnit === toUnit) {
      return length;
    }
    pxLength = unitLess(length);
    if (unit(fromContext) !== "px") {
      console.warn("Parameter fromContext must resolve to a value in pixel units.");
    }
    if (unit(toContext) !== "px") {
      console.warn("Parameter toContext must resolve to a value in pixel units.");
    }
    if (fromUnit !== "px") {
      if (fromUnit === "em") {
        pxLength = unitLess(length) * unitLess(fromContext);
      } else if (fromUnit === "rem") {
        pxLength = unitLess(length) * unitLess(baseFontSize);
      } else if (fromUnit === "ex") {
        pxLength = unitLess(length) * unitLess(fromContext) * 2;
      } else if (fromUnit === "ch" || fromUnit === "vw" || fromUnit === "vh" || fromUnit === "vmin") {
        console.warn(fromUnit + " units can't be reliably converted; Returning original value.");
        return length;
      } else {
        console.warn(fromUnit + " is an unknown or unsupported length unit; Returning original value.");
        return length;
      }
    }
    outputLength = pxLength;
    if (toUnit !== "px") {
      if (toUnit === "em") {
        outputLength = pxLength / unitLess(toContext);
      } else if (toUnit === "rem") {
        outputLength = pxLength / unitLess(baseFontSize);
      } else if (toUnit === "ex") {
        outputLength = pxLength / unitLess(toContext) / 2;
      } else if (toUnit === "ch" || toUnit === "vw" || toUnit === "vh" || toUnit === "vmin") {
        console.warn(toUnit + " units can't be reliably converted; Returning original value.");
        return length;
      } else {
        console.warn(toUnit + " is an unknown or unsupported length unit; Returning original value.");
        return length;
      }
    }
    return parseFloat(outputLength.toFixed(5)) + toUnit;
  };
}

var parseCssLength = genericCssLengthParser(baseFontSize);

function cssLengthToPixels(length) {
  return Number(parseCssLength(length, "px").slice(0, -2));
}

var Point = function () {
  createClass(Point, null, [{
    key: "ensure",
    value: function ensure(duck) {
      return duck instanceof Point ? duck : new Point(duck.x, duck.y);
    }
  }, {
    key: "polar",
    value: function polar(r, theta) {
      // theta=0 is East on the screen,
      // increases in counter-clockwise direction
      return new Point(r * Math.cos(theta), r * Math.sin(theta));
    }
  }, {
    key: "random",
    value: function random(scalePt) {
      return new Point(lively_lang.num.randomSmallerInteger(scalePt.x), lively_lang.num.randomSmallerInteger(scalePt.y));
    }
  }, {
    key: "fromLiteral",
    value: function fromLiteral(literal) {
      return pt(literal.x, literal.y);
    }
  }, {
    key: "fromTuple",
    value: function fromTuple(tuple) {
      return pt(tuple[0], tuple[1]);
    }
  }]);

  function Point(x, y) {
    classCallCheck(this, Point);

    this.x = x || 0;
    this.y = y || 0;
  }

  createClass(Point, [{
    key: "getX",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // accessing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    value: function getX() {
      return this.x;
    }
  }, {
    key: "getY",
    value: function getY() {
      return this.y;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // arithmetic
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "toFixed",
    value: function toFixed(val) {
      return new Point(this.x.toFixed(val), this.y.toFixed(val));
    }
  }, {
    key: "addPt",
    value: function addPt(p) {
      return new Point(this.x + p.x, this.y + p.y);
    }
  }, {
    key: "addXY",
    value: function addXY(dx, dy) {
      return new Point(this.x + dx, this.y + dy);
    }
  }, {
    key: "midPt",
    value: function midPt(p) {
      return new Point((this.x + p.x) / 2, (this.y + p.y) / 2);
    }
  }, {
    key: "subPt",
    value: function subPt(p) {
      return new Point(this.x - p.x, this.y - p.y);
    }
  }, {
    key: "subXY",
    value: function subXY(dx, dy) {
      return new Point(this.x - dx, this.y - dy);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // transforming
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "scaleBy",
    value: function scaleBy(scaleX, scaleYOrUndefined) {
      return new Point(this.x * scaleX, this.y * (scaleYOrUndefined || scaleX));
    }
  }, {
    key: "scaleByPt",
    value: function scaleByPt(scalePt) {
      return new Point(this.x * scalePt.x, this.y * scalePt.y);
    }
  }, {
    key: "negated",
    value: function negated() {
      return new Point(-this.x, -this.y);
    }
  }, {
    key: "inverted",
    value: function inverted() {
      return new Point(1.0 / this.x, 1.0 / this.y);
    }
  }, {
    key: "invertedSafely",
    value: function invertedSafely() {
      return new Point(this.x && 1.0 / this.x, this.y && 1.0 / this.y);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // comparing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "lessPt",
    value: function lessPt(p) {
      return this.x < p.x && this.y < p.y;
    }
  }, {
    key: "leqPt",
    value: function leqPt(p) {
      return this.x <= p.x && this.y <= p.y;
    }
  }, {
    key: "eqPt",
    value: function eqPt(p) {
      return this.x == p.x && this.y == p.y;
    }
  }, {
    key: "equals",
    value: function equals(p) {
      return this.x == p.x && this.y == p.y;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // instance creation
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "withX",
    value: function withX(x) {
      return pt(x, this.y);
    }
  }, {
    key: "withY",
    value: function withY(y) {
      return pt(this.x, y);
    }
  }, {
    key: "copy",
    value: function copy() {
      return new Point(this.x, this.y);
    }
  }, {
    key: "minPt",
    value: function minPt(p, acc) {
      if (!acc) acc = new Point(0, 0);
      acc.x = Math.min(this.x, p.x);
      acc.y = Math.min(this.y, p.y);
      return acc;
    }
  }, {
    key: "maxPt",
    value: function maxPt(p, acc) {
      if (!acc) acc = new Point(0, 0);
      acc.x = Math.max(this.x, p.x);
      acc.y = Math.max(this.y, p.y);
      return acc;
    }
  }, {
    key: "random",
    value: function random() {
      return Point.random(this);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // point functions
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "normalized",
    value: function normalized() {
      var r = this.r();
      return pt(this.x / r, this.y / r);
    }
  }, {
    key: "fastNormalized",
    value: function fastNormalized() {
      var r = this.fastR();
      return pt(this.x / r, this.y / r);
    }
  }, {
    key: "dotProduct",
    value: function dotProduct(p) {
      return this.x * p.x + this.y * p.y;
    }
  }, {
    key: "matrixTransform",
    value: function matrixTransform(mx, acc) {
      var x = mx.a * this.x + mx.c * this.y + mx.e,
          y = mx.b * this.x + mx.d * this.y + mx.f;
      // if no accumulator passed, allocate a fresh one
      return !acc ? pt(x, y) : Object.assign(acc, { x: x, y: y });
    }
  }, {
    key: "matrixTransformDirection",
    value: function matrixTransformDirection(mx, acc) {
      var x = mx.a * this.x + mx.c * this.y,
          y = mx.b * this.x + mx.d * this.y;
      // if no accumulator passed, allocate a fresh one
      return !acc ? pt(x, y) : Object.assign(acc, { x: x, y: y });
    }
  }, {
    key: "griddedBy",
    value: function griddedBy(grid) {
      return pt(this.x - this.x % grid.x, this.y - this.y % grid.y);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // geometry computation
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "roundTo",
    value: function roundTo(quantum) {
      return new Point(lively_lang.num.roundTo(this.x, quantum), lively_lang.num.roundTo(this.y, quantum));
    }
  }, {
    key: "dist",
    value: function dist(p) {
      var dx = this.x - p.x,
          dy = this.y - p.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }, {
    key: "distSquared",
    value: function distSquared(p) {
      var dx = this.x - p.x,
          dy = this.y - p.y;
      return dx * dx + dy * dy;
    }
  }, {
    key: "nearestPointOnLineBetween",
    value: function nearestPointOnLineBetween(p1, p2) {
      if (p1.x == p2.x) return pt(p1.x, this.y);
      if (p1.y == p2.y) return pt(this.x, p1.y);
      var x1 = p1.x,
          y1 = p1.y,
          x21 = p2.x - x1,
          y21 = p2.y - y1,
          t = ((this.y - y1) / x21 + (this.x - x1) / y21) / (x21 / y21 + y21 / x21);
      return pt(x1 + t * x21, y1 + t * y21);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // polar coordinates
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "r",
    value: function r() {
      // Polar coordinates (theta=0 is East on screen, and increases in CCW
      // direction
      return Math.sqrt(this.x * this.x + this.y * this.y);
    }
  }, {
    key: "fastR",
    value: function fastR() {
      // actually, r() might be faster...
      var a = this.x * this.x + this.y * this.y;
      var x = 17;
      for (var i = 0; i < 6; i++) {
        x = (x + a / x) / 2;
      }return x;
    }
  }, {
    key: "theta",
    value: function theta() {
      return Math.atan2(this.y, this.x);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // converting
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "asRectangle",
    value: function asRectangle() {
      return new Rectangle(this.x, this.y, 0, 0);
    }
  }, {
    key: "extent",
    value: function extent(ext) {
      return new Rectangle(this.x, this.y, ext.x, ext.y);
    }
  }, {
    key: "extentAsRectangle",
    value: function extentAsRectangle() {
      return new Rectangle(0, 0, this.x, this.y);
    }
  }, {
    key: "lineTo",
    value: function lineTo(end) {
      return new Line(this, end);
    }
  }, {
    key: "toTuple",
    value: function toTuple() {
      return [this.x, this.y];
    }
  }, {
    key: "toLiteral",
    value: function toLiteral() {
      return { x: this.x, y: this.y };
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // debugging
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "toString",
    value: function toString() {
      return lively_lang.string.format("pt(%1.f,%1.f)", this.x, this.y);
    }
  }, {
    key: "inspect",
    value: function inspect() {
      return JSON.stringify(this);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // serialization
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "__serialize__",
    value: function __serialize__() {
      return { __expr__: this.toString(), bindings: { "lively.graphics/geometry-2d.js": ["pt"] } };
    }
  }, {
    key: "isPoint",
    get: function get() {
      return true;
    }
  }]);
  return Point;
}();

var Rectangle = function () {
  createClass(Rectangle, [{
    key: "corners",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    //  initialize
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    get: function get() {
      return ["topLeft", "topRight", "bottomRight", "bottomLeft"];
    }
  }, {
    key: "sides",
    get: function get() {
      return ["leftCenter", "rightCenter", "topCenter", "bottomCenter"];
    }
  }], [{
    key: "fromAny",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // factory methods
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    value: function fromAny(ptA, ptB) {
      return rect(ptA.minPt(ptB), ptA.maxPt(ptB));
    }
  }, {
    key: "fromLiteral",
    value: function fromLiteral(literal) {
      return new Rectangle(literal.x, literal.y, literal.width, literal.height);
    }
  }, {
    key: "fromTuple",
    value: function fromTuple(tuple) {
      return new Rectangle(tuple[0], tuple[1], tuple[2], tuple[3]);
    }
  }, {
    key: "unionPts",
    value: function unionPts(points) {
      var min = points[0],
          max = points[0];

      // starts from 1 intentionally
      for (var i = 1; i < points.length; i++) {
        min = min.minPt(points[i]);
        max = max.maxPt(points[i]);
      }

      return rect(min, max);
    }
  }, {
    key: "ensure",
    value: function ensure(duck) {
      return duck instanceof Rectangle ? duck : new Rectangle(duck.x, duck.y, duck.width, duck.height);
    }
  }, {
    key: "fromElement",
    value: function fromElement(element) {
      // FIXME
      if (typeof element.getBoundingClientRect === "function") {
        var b = element.getBoundingClientRect();
        return rect(b.left, b.top, b.width, b.height);
      } else if (element.namespaceURI == "http://www.w3.org/1999/xhtml") {
        var x = cssLengthToPixels(element.style.left || "0px"),
            y = cssLengthToPixels(element.style.top || "0px"),
            width = cssLengthToPixels(element.style.width || "0px"),
            height = cssLengthToPixels(element.style.hieght || "0px");
        return new Rectangle(x, y, width, height);
      }
      if (element.namespaceURI == "http://www.w3.org/2000/svg") {
        return new Rectangle(element.x.baseVal.value, element.y.baseVal.value, element.width.baseVal.value, element.height.baseVal.value);
      }
      throw new Error('Cannot create Rectangle from ' + element);
    }
  }, {
    key: "inset",
    value: function inset(left, top, right, bottom) {
      if (top === undefined) top = left;
      if (right === undefined) right = left;
      if (bottom === undefined) bottom = top;
      return new Rectangle(left, top, right - left, bottom - top);
    }
  }]);

  function Rectangle(x, y, w, h) {
    classCallCheck(this, Rectangle);

    this.x = x || 0;
    this.y = y || 0;
    this.width = w || 0;
    this.height = h || 0;
  }

  createClass(Rectangle, [{
    key: "getX",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // accessing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    value: function getX() {
      return this.x;
    }
  }, {
    key: "getY",
    value: function getY() {
      return this.y;
    }
  }, {
    key: "getWidth",
    value: function getWidth() {
      return this.width;
    }
  }, {
    key: "getHeight",
    value: function getHeight() {
      return this.height;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // instance creation
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "copy",
    value: function copy() {
      return new Rectangle(this.x, this.y, this.width, this.height);
    }
  }, {
    key: "toFixed",
    value: function toFixed(val) {
      return new Rectangle(this.x.toFixed(val), this.y.toFixed(val), this.width.toFixed(val), this.height.toFixed(val));
    }
  }, {
    key: "withWidth",
    value: function withWidth(w) {
      return new Rectangle(this.x, this.y, w, this.height);
    }
  }, {
    key: "withHeight",
    value: function withHeight(h) {
      return new Rectangle(this.x, this.y, this.width, h);
    }
  }, {
    key: "withX",
    value: function withX(x) {
      return new Rectangle(x, this.y, this.width, this.height);
    }
  }, {
    key: "withY",
    value: function withY(y) {
      return new Rectangle(this.x, y, this.width, this.height);
    }
  }, {
    key: "withExtent",
    value: function withExtent(ext) {
      return new Rectangle(this.x, this.y, ext.x, ext.y);
    }
  }, {
    key: "withTopLeft",
    value: function withTopLeft(p) {
      return Rectangle.fromAny(p, this.bottomRight());
    }
  }, {
    key: "withTopRight",
    value: function withTopRight(p) {
      return Rectangle.fromAny(this.bottomLeft(), p);
    }
  }, {
    key: "withBottomRight",
    value: function withBottomRight(p) {
      return Rectangle.fromAny(p, this.topLeft());
    }
  }, {
    key: "withBottomLeft",
    value: function withBottomLeft(p) {
      return Rectangle.fromAny(p, this.topRight());
    }
  }, {
    key: "withLeftCenter",
    value: function withLeftCenter(p) {
      return new Rectangle(p.x, this.y, this.width + (this.x - p.x), this.height);
    }
  }, {
    key: "withRightCenter",
    value: function withRightCenter(p) {
      return new Rectangle(this.x, this.y, p.x - this.x, this.height);
    }
  }, {
    key: "withTopCenter",
    value: function withTopCenter(p) {
      return new Rectangle(this.x, p.y, this.width, this.height + (this.y - p.y));
    }
  }, {
    key: "withBottomCenter",
    value: function withBottomCenter(p) {
      return new Rectangle(this.x, this.y, this.width, p.y - this.y);
    }
  }, {
    key: "withCenter",
    value: function withCenter(p) {
      return new Rectangle(p.x - this.width / 2, p.y - this.height / 2, this.width, this.height);
    }
  }, {
    key: "insetBy",
    value: function insetBy(d) {
      return new Rectangle(this.x + d, this.y + d, this.width - d * 2, this.height - d * 2);
    }
  }, {
    key: "insetByPt",
    value: function insetByPt(p) {
      return new Rectangle(this.x + p.x, this.y + p.y, this.width - p.x * 2, this.height - p.y * 2);
    }
  }, {
    key: "grid",
    value: function grid(rows, cols) {
      var w = this.width / cols,
          h = this.height / rows;
      return lively_lang.grid.mapCreate(rows, cols, function (i, j) {
        return new Rectangle(w * j, h * i, w, h);
      });
    }
  }, {
    key: "divide",
    value: function divide(relativeRects) {
      // takes an array of rectangles specifying the relative parts to divide
      // this by. Example:
      // rect(0,0,100,50).divide([rect(0.2,0,0.3,0.5)])
      //   === [rect(20,0,30,25)]
      var orig = this;
      return relativeRects.map(function (relRect) {
        return rect(orig.x + orig.width * relRect.x, orig.y + orig.height * relRect.y, orig.width * relRect.width, orig.height * relRect.height);
      });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // converting
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "toTuple",
    value: function toTuple() {
      return [this.x, this.y, this.width, this.height];
    }
  }, {
    key: "lineTo",
    value: function lineTo(otherRect) {
      var center1 = this.center(),
          center2 = otherRect.center(),
          lineBetween = center1.lineTo(center2),
          start = this.lineIntersection(lineBetween)[0],
          end = otherRect.lineIntersection(lineBetween)[0];
      return start && end && start.lineTo(end);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // comparing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "equals",
    value: function equals(other) {
      if (!other) {
        return false;
      }
      return this.x == other.x && this.y == other.y && this.width == other.width && this.height == other.height;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // debugging
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "inspect",
    value: function inspect() {
      return JSON.stringify(this);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // accessing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "topLeft",
    value: function topLeft() {
      return new Point(this.x, this.y);
    }
  }, {
    key: "topRight",
    value: function topRight() {
      return new Point(this.maxX(), this.y);
    }
  }, {
    key: "bottomRight",
    value: function bottomRight() {
      return new Point(this.maxX(), this.maxY());
    }
  }, {
    key: "bottomLeft",
    value: function bottomLeft() {
      return new Point(this.x, this.maxY());
    }
  }, {
    key: "leftCenter",
    value: function leftCenter() {
      return new Point(this.x, this.center().y);
    }
  }, {
    key: "rightCenter",
    value: function rightCenter() {
      return new Point(this.maxX(), this.center().y);
    }
  }, {
    key: "topCenter",
    value: function topCenter() {
      return new Point(this.center().x, this.y);
    }
  }, {
    key: "bottomCenter",
    value: function bottomCenter() {
      return new Point(this.center().x, this.maxY());
    }
  }, {
    key: "extent",
    value: function extent() {
      return new Point(this.width, this.height);
    }
  }, {
    key: "center",
    value: function center() {
      return new Point(this.x + this.width / 2, this.y + this.height / 2);
    }
  }, {
    key: "topEdge",
    value: function topEdge() {
      return new Line(this.topLeft(), this.topRight());
    }
  }, {
    key: "bottomEdge",
    value: function bottomEdge() {
      return new Line(this.bottomLeft(), this.bottomRight());
    }
  }, {
    key: "leftEdge",
    value: function leftEdge() {
      return new Line(this.topLeft(), this.bottomLeft());
    }
  }, {
    key: "rightEdge",
    value: function rightEdge() {
      return new Line(this.topRight(), this.bottomRight());
    }
  }, {
    key: "edges",
    value: function edges() {
      return [this.topEdge(), this.rightEdge(), this.bottomEdge(), this.leftEdge()];
    }
  }, {
    key: "allPoints",
    value: function allPoints() {
      // take rectangle as discrete grid and return all points in the grid
      // rect(3,4,2,3).allPoints() == [pt(3,4),pt(4,4),pt(3,5),pt(4,5),pt(3,6),pt(4,6)]
      // if you want to convert points to indices use
      // var w = 5, h = 7; rect(3,4,2,3).allPoints().map(function(p) { return p.y * w + p.x; }) == [23,24,28,29,33,34]
      var x = this.x,
          y = this.y,
          w = this.width,
          h = this.height,
          points = [];
      for (var j = y; j < y + h; j++) {
        for (var i = x; i < x + w; i++) {
          points.push(pt(i, j));
        }
      }return points;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // testing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "isNonEmpty",
    value: function isNonEmpty(rect) {
      return this.width > 0 && this.height > 0;
    }
  }, {
    key: "containsRect",
    value: function containsRect(r) {
      return this.x <= r.x && this.y <= r.y && r.maxX() <= this.maxX() && r.maxY() <= this.maxY();
    }
  }, {
    key: "intersects",
    value: function intersects(r) {
      return this.intersection(r).isNonEmpty();
    }
  }, {
    key: "containsPoint",
    value: function containsPoint(p) {
      return this.x <= p.x && p.x <= this.x + this.width && this.y <= p.y && p.y <= this.y + this.height;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // transforming
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "translatedBy",
    value: function translatedBy(d) {
      return new Rectangle(this.x + d.x, this.y + d.y, this.width, this.height);
    }
  }, {
    key: "scaleByRect",
    value: function scaleByRect(r) {
      // r is a relative rect, as a pane spec in a window
      return new Rectangle(this.x + r.x * this.width, this.y + r.y * this.height, r.width * this.width, r.height * this.height);
    }
  }, {
    key: "scaleRectIn",
    value: function scaleRectIn(fullRect) {
      // return a relative rect for this as a part of fullRect
      return new Rectangle((this.x - fullRect.x) / fullRect.width, (this.y - fullRect.y) / fullRect.height, this.width / fullRect.width, this.height / fullRect.height);
    }
  }, {
    key: "scaleRectTo",
    value: function scaleRectTo(fullRect) {
      // scale the rect until it reaches the bounds of the full rect
      var height, width, scale;
      if (this.width > this.height) {
        width = this.width;
      } else {
        height = this.height;
      }

      if (width) {
        scale = fullRect.width / width;
      } else {
        scale = fullRect.height / height;
      }

      return this.withExtent(this.extent().scaleBy(scale)).withCenter(this.center());
    }
  }, {
    key: "expandBy",
    value: function expandBy(delta) {
      return this.insetBy(0 - delta);
    }
  }, {
    key: "translateForInclusion",
    value: function translateForInclusion(other) {
      var x = other.x,
          y = other.y,
          r = x + other.width,
          b = y + other.height;
      if (r > this.right()) x -= r - this.right();
      if (b > this.bottom()) y -= b - this.bottom();
      if (x < this.x) x = this.x;
      if (y < this.y) y = this.y;
      return rect(x, y, other.width, other.height);
    }
  }, {
    key: "transformRectForInclusion",
    value: function transformRectForInclusion(other) {
      var topLeft = this.topLeft().maxPt(other.topLeft()),
          newBottomRight = topLeft.addPt(other.extent()),
          innerBottomRight = this.bottomRight().minPt(newBottomRight);
      return rect(topLeft, innerBottomRight);
    }
  }, {
    key: "insetByRect",
    value: function insetByRect(r) {
      return new Rectangle(this.x + r.left(), this.y + r.top(), this.width - (r.left() + r.right()), this.height - (r.top() + r.bottom()));
    }
  }, {
    key: "outsetByRect",
    value: function outsetByRect(r) {
      return new Rectangle(this.x - r.left(), this.y - r.top(), this.width + (r.left() + r.right()), this.height + (r.top() + r.bottom()));
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // relations
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "intersection",
    value: function intersection(rect) {
      var nx = Math.max(this.x, rect.x);
      var ny = Math.max(this.y, rect.y);
      var nw = Math.min(this.x + this.width, rect.x + rect.width) - nx;
      var nh = Math.min(this.y + this.height, rect.y + rect.height) - ny;
      return new Rectangle(nx, ny, nw, nh);
    }
  }, {
    key: "union",
    value: function union(r) {
      return rect(this.topLeft().minPt(r.topLeft()), this.bottomRight().maxPt(r.bottomRight()));
    }
  }, {
    key: "lineIntersection",
    value: function lineIntersection(line) {
      return this.edges().map(function (edge) {
        return edge.intersection(line);
      }).filter(function (ea) {
        return !!ea;
      });
    }
  }, {
    key: "dist",
    value: function dist(rect) {
      var p1 = this.closestPointToPt(rect.center());
      var p2 = rect.closestPointToPt(p1);
      return p1.dist(p2);
    }
  }, {
    key: "relativeToAbsPoint",
    value: function relativeToAbsPoint(relPt) {
      return new Point(this.x + this.width * relPt.x, this.y + this.height * relPt.y);
    }
  }, {
    key: "closestPointToPt",
    value: function closestPointToPt(p) {
      // Assume p lies outside me; return a point on my perimeter
      return pt(Math.min(Math.max(this.x, p.x), this.maxX()), Math.min(Math.max(this.y, p.y), this.maxY()));
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // properties
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "maxX",
    value: function maxX() {
      return this.x + this.width;
    }
  }, {
    key: "maxY",
    value: function maxY() {
      return this.y + this.height;
    }
  }, {
    key: "realWidth",
    value: function realWidth() {
      return this.x < 0 ? -this.x + this.width : this.width;
    }
  }, {
    key: "realHeight",
    value: function realHeight() {
      return this.y < 0 ? -this.y + this.height : this.height;
    }
  }, {
    key: "area",
    value: function area() {
      var area = this.width * this.height,
          sign = this.width < 0 && this.height < 0 ? -1 : 1;
      return sign * area;
    }
  }, {
    key: "randomPoint",
    value: function randomPoint() {
      return Point.random(pt(this.width, this.height)).addPt(this.topLeft());
    }
  }, {
    key: "constrainPt",
    value: function constrainPt(pt) {
      return pt.maxPt(this.topLeft()).minPt(this.bottomRight());
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // SVG interface
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // modeled after the CSS box model: http://www.w3.org/TR/REC-CSS2/box.html

  }, {
    key: "left",
    value: function left() {
      return this.x;
    }
  }, {
    key: "right",
    value: function right() {
      return this.maxX();
    }
  }, {
    key: "top",
    value: function top() {
      return this.y;
    }
  }, {
    key: "bottom",
    value: function bottom() {
      return this.maxY();
    }
  }, {
    key: "toInsetTuple",
    value: function toInsetTuple() {
      return [this.left(), this.top(), this.right(), this.bottom()];
    }
  }, {
    key: "toAttributeValue",
    value: function toAttributeValue(d) {
      var d = 0.01,
          result = [this.left()];
      if (this.top() === this.bottom() && this.left() === this.right()) {
        if (this.top() === this.left()) result.push(this.top());
      } else result = result.concat([this.top(), this.right(), this.bottom()]);
      return result.invoke('roundTo', d || 0.01);
    }
  }, {
    key: "toLiteral",
    value: function toLiteral() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // part support
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "partNamed",
    value: function partNamed(partName) {
      return this[partName].call(this);
    }
  }, {
    key: "withPartNamed",
    value: function withPartNamed(partName, newValue) {
      return this[this.setterName(partName)].call(this, newValue);
    }
  }, {
    key: "setterName",
    value: function setterName(partName) {
      return "with" + partName[0].toUpperCase() + partName.slice(1);
    }
  }, {
    key: "partNameNear",
    value: function partNameNear(partNames, p, dist) {
      var partName = this.partNameNearest(partNames, p);
      return p.dist(this.partNamed(partName)) < dist ? partName : null;
    }
  }, {
    key: "partNameNearest",
    value: function partNameNearest(partNames, p) {
      var dist = 1.0e99,
          partName = partNames[0];

      for (var i = 0; i < partNames.length; i++) {
        var partName = partNames[i],
            pDist = p.dist(this.partNamed(partName));
        if (pDist < dist) {
          var nearest = partName;dist = pDist;
        }
      }

      return nearest;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // printing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "toString",
    value: function toString() {
      return lively_lang.string.format("rect(%s,%s,%s,%s)", this.x, this.y, this.width, this.height);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // serialization
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "__serialize__",
    value: function __serialize__() {
      return { __expr__: this.toString(), bindings: { "lively.graphics/geometry-2d.js": ["rect"] } };
    }
  }, {
    key: "isRectangle",
    get: function get() {
      return true;
    }
  }]);
  return Rectangle;
}();

var Transform = function () {
  createClass(Transform, [{
    key: "exp",
    get: function get() {
      return 0.0001; /*precision*/
    }
  }]);

  function Transform(translation, rotation, scale) {
    classCallCheck(this, Transform);

    // matrix is a duck with a,b,c,d,e,f, could be an SVG matrix or a
    // Lively Transform
    // alternatively, its a combination of translation rotation and scale
    if (translation) {
      if (translation instanceof Point) {
        var delta = translation,
            angleInRadians = rotation || 0.0,
            scale = scale;
        if (scale === undefined) {
          scale = pt(1.0, 1.0);
        }
        this.a = this.ensureNumber(scale.x * Math.cos(angleInRadians));
        this.b = this.ensureNumber(scale.y * Math.sin(angleInRadians));
        this.c = this.ensureNumber(scale.x * -Math.sin(angleInRadians));
        this.d = this.ensureNumber(scale.y * Math.cos(angleInRadians));
        this.e = this.ensureNumber(delta.x);
        this.f = this.ensureNumber(delta.y);

        // avoid inaccurate translations in Chrome
        if (this.a > 1) this.a = Math.round(this.a * Math.pow(10, 2)) / Math.pow(10, 2);
        if (this.d > 1) this.d = Math.round(this.d * Math.pow(10, 2)) / Math.pow(10, 2);
      } else {
        this.fromMatrix(translation);
      }
    } else {
      this.a = this.d = 1.0;
      this.b = this.c = this.e = this.f = 0.0;
    }
  }

  createClass(Transform, [{
    key: "copy",
    value: function copy() {
      return new Transform(this);
    }
  }, {
    key: "fromMatrix",
    value: function fromMatrix(mx) {
      this.a = this.ensureNumber(mx.a);
      this.b = this.ensureNumber(mx.b);
      this.c = this.ensureNumber(mx.c);
      this.d = this.ensureNumber(mx.d);
      this.e = this.ensureNumber(mx.e);
      this.f = this.ensureNumber(mx.f);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // accessing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "getRotation",
    value: function getRotation() {
      // in degrees
      // Note the ambiguity with negative scales is resolved by assuming
      // scale x is positive
      var r = lively_lang.num.toDegrees(Math.atan2(-this.c, this.a));

      // don't bother with values very close to 0
      return Math.abs(r) < this.eps ? 0 : r;
    }
  }, {
    key: "getScale",
    value: function getScale() {
      // Note the ambiguity with negative scales and rotation is resolved by assuming scale x is positive
      var a = this.a,
          c = this.c,
          s = Math.sqrt(a * a + c * c);

      // don't bother with values very close to 1
      return Math.abs(s - 1) < this.eps ? 1 : s;
    }
  }, {
    key: "getScalePoint",
    value: function getScalePoint() {
      // Note the ambiguity with negative scales and rotation is resolved by
      // assuming scale x is positive
      var a = this.a,
          b = this.b,
          c = this.c,
          d = this.d,
          sx = Math.sqrt(a * a + c * c),
          r = Math.atan2(-c, a),
          // radians
      // avoid div by 0
      sy = Math.abs(b) > Math.abs(d) ? b / Math.sin(r) : d / Math.cos(r);
      return pt(sx, sy);
    }
  }, {
    key: "getTranslation",
    value: function getTranslation() {
      return pt(this.e, this.f);
    }
  }, {
    key: "setTranslation",
    value: function setTranslation(delta) {
      this.e = delta.x;
      this.f = delta.y;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // testing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "isTranslation",
    value: function isTranslation() {
      // as specified in:
      // http://www.w3.org/TR/SVG11/coords.html#InterfaceSVGTransform
      return this.a == 1 && this.b == 0 && this.c == 0 && this.d == 1;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // converting
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "toSVGAttributeValue",
    value: function toSVGAttributeValue() {
      var delta = this.getTranslation(),
          attr = "translate(" + delta.x + "," + delta.y + ")",
          theta = this.getRotation(),
          sp = this.getScalePoint();

      if (theta != 0.0) attr += " rotate(" + this.getRotation() + ")"; // in degrees
      if (sp.x != 1.0 || sp.y != 1.0) attr += " scale(" + sp.x + "," + sp.y + ")";

      return attr;
    }
  }, {
    key: "toCSSValue",
    value: function toCSSValue(bounds) {
      var attr = '',
          delta = this.getTranslation();

      attr += "translate(" + delta.x.toFixed(2) + "px," + delta.y.toFixed(2) + "px)";

      if (bounds) {
        // FIXME this is to fix the rotation...!
        var offsetX = bounds.width / 2;
        var offsetY = bounds.height / 2;
        attr += " translate(" + offsetX.toFixed(2) + "px," + offsetY.toFixed(2) + "px)";
      }

      var theta = this.getRotation();
      if (theta != 0.0) attr += " rotate(" + this.getRotation().toFixed(2) + "deg)";

      if (bounds) {
        // FIXME this is to fix the rotation...!
        var offsetX = bounds.width / 2;
        var offsetY = bounds.height / 2;
        attr += " translate(" + (offsetX * -1).toFixed(2) + "px," + (offsetY * -1).toFixed(2) + "px)";
      }

      var sp = this.getScalePoint();
      if (sp.x != 1.0 || sp.y != 1.0) {
        attr += " scale(" + sp.x.toFixed(2) + "," + sp.y.toFixed(2) + ")";
      }

      return attr;
    }
  }, {
    key: "toCSSTransformString",
    value: function toCSSTransformString() {
      var rot = this.getRotation(),
          scale = this.getScale();
      return "translate(" + this.e + "px," + this.f + "px) rotate(" + rot + "deg) scale(" + scale + "," + scale + ")";
    }
  }, {
    key: "toString",
    value: function toString() {
      return this.toCSSTransformString();
    }
  }, {
    key: "toMatrix",
    value: function toMatrix() {
      return this.copy();
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // transforming
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "transformPoint",
    value: function transformPoint(p, acc) {
      return p.matrixTransform(this, acc);
    }
  }, {
    key: "transformDirection",
    value: function transformDirection(p, acc) {
      return p.matrixTransformDirection(this, acc);
    }
  }, {
    key: "matrixTransformForMinMax",
    value: function matrixTransformForMinMax(pt, minPt, maxPt) {
      var x = this.a * pt.x + this.c * pt.y + this.e,
          y = this.b * pt.x + this.d * pt.y + this.f;
      if (x > maxPt.x) maxPt.x = x;
      if (y > maxPt.y) maxPt.y = y;
      if (x < minPt.x) minPt.x = x;
      if (y < minPt.y) minPt.y = y;
    }
  }, {
    key: "transformRectToRect",
    value: function transformRectToRect(r) {
      var minPt = pt(Infinity, Infinity),
          maxPt = pt(-Infinity, -Infinity);
      this.matrixTransformForMinMax(r.topLeft(), minPt, maxPt);
      this.matrixTransformForMinMax(r.bottomRight(), minPt, maxPt);
      if (!this.isTranslation()) {
        this.matrixTransformForMinMax(r.topRight(), minPt, maxPt);
        this.matrixTransformForMinMax(r.bottomLeft(), minPt, maxPt);
      }
      return rect(minPt, maxPt);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // matrix operations
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "preConcatenate",
    value: function preConcatenate(t) {
      var m = this.matrix_ || this.toMatrix();
      this.a = t.a * m.a + t.c * m.b;
      this.b = t.b * m.a + t.d * m.b;
      this.c = t.a * m.c + t.c * m.d;
      this.d = t.b * m.c + t.d * m.d;
      this.e = t.a * m.e + t.c * m.f + t.e;
      this.f = t.b * m.e + t.d * m.f + t.f;
      this.matrix_ = this.toMatrix();
      return this;
    }
  }, {
    key: "invert",
    value: function invert() {
      var m = this.copy();

      var det = m.a * m.d - m.c * m.b,
          invdet = 1 / det;

      this.a = m.d * invdet;
      this.b = -m.b * invdet;
      this.c = -m.c * invdet;
      this.d = m.a * invdet;
      this.e = (m.c * m.f - m.e * m.d) * invdet;
      this.f = -(m.a * m.f - m.b * m.e) * invdet;

      return this;
    }
  }, {
    key: "inverse",
    value: function inverse() {
      var matrix = this.matrix_ || this.toMatrix();
      var result = new this.constructor(matrix);
      result.invert();
      return result;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // helper
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "ensureNumber",
    value: function ensureNumber(value) {
      // note that if a,b,.. f are not numbers, it's usually a
      // problem, which may crash browsers (like Safari) that don't
      // do good typechecking of SVGMatrix properties
      if (isNaN(value)) {
        throw new Error('not a number');
      }
      return value;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // serialization
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "__serialize__",
    value: function __serialize__() {
      return {
        __expr__: "new Transform({a: " + this.a + ", b: " + this.b + ", c: " + this.c + ", d: " + this.d + ", e: " + this.e + ", f: " + this.f + "})",
        bindings: { "lively.graphics/geometry-2d.js": ["Transform"] }
      };
    }
  }, {
    key: "isTransform",
    get: function get() {
      return true;
    }
  }]);
  return Transform;
}();

var Line = function () {
  createClass(Line, null, [{
    key: "fromCoords",
    value: function fromCoords(startX, startY, endX, endY) {
      return new Line(pt(startX, startY), pt(endX, endY));
    }
  }]);

  function Line(start, end) {
    classCallCheck(this, Line);

    this.start = start;
    this.end = end;
  }

  createClass(Line, [{
    key: "sampleN",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // accessing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    value: function sampleN(n) {
      // return n points that are collinear with this and are between
      // this.start and this.end
      n = n || 10;
      var vector = this.end.subPt(this.start),
          stepPt = vector.scaleBy(1 / n),
          result = [];
      for (var i = 0; i <= n; i++) {
        result.push(this.start.addPt(stepPt.scaleBy(i)));
      }
      return result;
    }
  }, {
    key: "sample",
    value: function sample(length) {
      return this.sampleN(this.length() / length);
    }
  }, {
    key: "length",
    value: function length() {
      return this.start.dist(this.end);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // testing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "equals",
    value: function equals(otherLine) {
      if (!otherLine) return false;
      return this.start.eqPt(otherLine.start) && this.end.eqPt(otherLine.end);
    }
  }, {
    key: "includesPoint",
    value: function includesPoint(p, unconstrained) {
      // test whether p is collinear with this.start, this.end
      // constrained: p also needs to be on segment between start, end
      var x1 = this.start.x,
          y1 = this.start.y,
          x2 = this.end.x,
          y2 = this.end.y,
          x3 = p.x,
          y3 = p.y,
          collinear = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1) === 0;
      if (unconstrained || !collinear) return collinear;
      var xMin = Math.min(x1, x2),
          yMin = Math.min(y1, y2),
          xMax = Math.max(x1, x2),
          yMax = Math.max(y1, y2);
      return xMin <= x3 && x3 <= xMax && yMin <= y3 && y3 <= yMax;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // intersection
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "intersection",
    value: function intersection(otherLine, unconstrained) {
      // constrained: intersection has to be between start/ends of this and
      // otherLine
      // http://en.wikipedia.org/wiki/Line-line_intersection
      //       .. (x1, y1)
      //         ..              ..... (x4,y4)
      //           ..    ........
      // (x3,y3) .....X..
      //    .....      ..
      //                 ..  (x2, y2)
      var eps = 0.0001,
          start1 = this.start,
          end1 = this.end,
          start2 = otherLine.start,
          end2 = otherLine.end,
          x1 = start1.x,
          y1 = start1.y,
          x2 = end1.x,
          y2 = end1.y,
          x3 = start2.x,
          y3 = start2.y,
          x4 = end2.x,
          y4 = end2.y;

      var x = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)),
          y = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));

      // are lines parallel?
      if (x === Infinity || y === Infinity) return null;

      if (!unconstrained) {
        if (!lively_lang.num.between(x, x1, x2, eps) || !lively_lang.num.between(y, y1, y2, eps) || !lively_lang.num.between(x, x3, x4, eps) || !lively_lang.num.between(y, y3, y4, eps)) return null;
      }

      return pt(x, y);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // debugging
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "toString",
    value: function toString() {
      return lively_lang.string.format('Line((%s,%s), (%s,%s))', this.start.x, this.start.y, this.end.x, this.end.y);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // serialization
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "__serialize__",
    value: function __serialize__() {
      return {
        __expr__: "Line.fromCoords(" + this.start.x + ", " + this.start.y + ", " + this.end.x + ", " + this.end.y + ")",
        bindings: { "lively.graphics/geometry-2d.js": ["Line"] }
      };
    }
  }, {
    key: "isLine",
    get: function get() {
      return true;
    }
  }]);
  return Line;
}();

function rect(arg1, arg2, arg3, arg4) {
  // arg1 and arg2 can be location and corner or
  // arg1/arg2 = location x/y and arg3/arg4 = extent x/y
  var x, y, w, h;
  if (typeof arg1 === 'number') {
    x = arg1, y = arg2, w = arg3, h = arg4;
  } else {
    x = arg1.x;y = arg1.y;
    w = arg2.x - x;h = arg2.y - y;
  }
  return new Rectangle(x, y, w, h);
}

function pt(x, y) {
  return new Point(x, y);
}

function floor(x) {
  return Math.floor(x * 255.99);
}

var rgbaRegex = new RegExp('\\s*rgba?\\s*\\(\\s*(\\d+)(%?)\\s*,\\s*(\\d+)(%?)\\s*,\\s*(\\d+)(%?)\\s*(?:,\\s*([0-9\\.]+)\\s*)?\\)\\s*');

var ColorHarmony = function () {
  function ColorHarmony() {
    classCallCheck(this, ColorHarmony);
  }

  createClass(ColorHarmony, null, [{
    key: "offsets",
    value: function offsets() {
      return null;
    }
  }, {
    key: "stepCount",
    value: function stepCount() {
      return 0;
    }
  }, {
    key: "stepSize",
    value: function stepSize() {
      return 0;
    }
  }, {
    key: "chord",
    value: function chord(_ref) {
      var _this = this;

      var hue = _ref.hue,
          saturation = _ref.saturation,
          brightness = _ref.brightness;

      var offsets = this.offsets() || lively_lang.arr.range(0, this.steps()).map(function (i) {
        return i * _this.stepSize();
      });
      return offsets.map(function (offset) {
        return Color.hsb(hue + offset % 360, saturation, brightness);
      });
    }
  }, {
    key: "name",
    get: function get() {
      return "Color Harmony";
    }
  }]);
  return ColorHarmony;
}();

var Complementary = function (_ColorHarmony) {
  inherits(Complementary, _ColorHarmony);

  function Complementary() {
    classCallCheck(this, Complementary);
    return possibleConstructorReturn(this, (Complementary.__proto__ || Object.getPrototypeOf(Complementary)).apply(this, arguments));
  }

  createClass(Complementary, null, [{
    key: "steps",
    value: function steps() {
      return 1;
    }
  }, {
    key: "stepSize",
    value: function stepSize() {
      return 180;
    }
  }, {
    key: "name",
    get: function get() {
      return "Complement";
    }
  }]);
  return Complementary;
}(ColorHarmony);

var Triadic = function (_ColorHarmony2) {
  inherits(Triadic, _ColorHarmony2);

  function Triadic() {
    classCallCheck(this, Triadic);
    return possibleConstructorReturn(this, (Triadic.__proto__ || Object.getPrototypeOf(Triadic)).apply(this, arguments));
  }

  createClass(Triadic, null, [{
    key: "steps",
    value: function steps() {
      return 2;
    }
  }, {
    key: "stepSize",
    value: function stepSize() {
      return 120;
    }
  }, {
    key: "name",
    get: function get() {
      return "Triadic";
    }
  }]);
  return Triadic;
}(ColorHarmony);

var Tetradic = function (_ColorHarmony3) {
  inherits(Tetradic, _ColorHarmony3);

  function Tetradic() {
    classCallCheck(this, Tetradic);
    return possibleConstructorReturn(this, (Tetradic.__proto__ || Object.getPrototypeOf(Tetradic)).apply(this, arguments));
  }

  createClass(Tetradic, null, [{
    key: "offsets",
    value: function offsets() {
      return [0, 60, 180, 240];
    }
  }, {
    key: "name",
    get: function get() {
      return "Tetradic";
    }
  }]);
  return Tetradic;
}(ColorHarmony);

var Quadratic = function (_ColorHarmony4) {
  inherits(Quadratic, _ColorHarmony4);

  function Quadratic() {
    classCallCheck(this, Quadratic);
    return possibleConstructorReturn(this, (Quadratic.__proto__ || Object.getPrototypeOf(Quadratic)).apply(this, arguments));
  }

  createClass(Quadratic, null, [{
    key: "steps",
    value: function steps() {
      return 3;
    }
  }, {
    key: "stepSize",
    value: function stepSize() {
      return 90;
    }
  }, {
    key: "name",
    get: function get() {
      return "Quadratic";
    }
  }]);
  return Quadratic;
}(ColorHarmony);

var Analogous = function (_ColorHarmony5) {
  inherits(Analogous, _ColorHarmony5);

  function Analogous() {
    classCallCheck(this, Analogous);
    return possibleConstructorReturn(this, (Analogous.__proto__ || Object.getPrototypeOf(Analogous)).apply(this, arguments));
  }

  createClass(Analogous, null, [{
    key: "steps",
    value: function steps() {
      return 5;
    }
  }, {
    key: "offsets",
    value: function offsets() {
      return [-60, -30, 0, 30, 60];
    }
  }, {
    key: "name",
    get: function get() {
      return "Analogous";
    }
  }]);
  return Analogous;
}(ColorHarmony);

var Neutral = function (_ColorHarmony6) {
  inherits(Neutral, _ColorHarmony6);

  function Neutral() {
    classCallCheck(this, Neutral);
    return possibleConstructorReturn(this, (Neutral.__proto__ || Object.getPrototypeOf(Neutral)).apply(this, arguments));
  }

  createClass(Neutral, null, [{
    key: "offsets",
    value: function offsets() {
      return [-30, -15, 0, 15, 30];
    }
  }, {
    key: "name",
    get: function get() {
      return "Neutral";
    }
  }]);
  return Neutral;
}(ColorHarmony);

var Color = function () {
  createClass(Color, [{
    key: "isColor",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // instance side
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    get: function get() {
      return true;
    }
  }], [{
    key: "random",


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // class side
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    value: function random(min, max) {
      if (min === undefined) min = 0;
      if (max === undefined) max = 255;
      return Color.rgb(lively_lang.num.random(min, max), lively_lang.num.random(min, max), lively_lang.num.random(min, max));
    }
  }, {
    key: "hsb",
    value: function hsb(hue, sat, brt) {
      var s = sat,
          b = brt;
      // zero saturation yields gray with the given brightness
      if (sat == 0) return new Color(b, b, b);
      var h = hue % 360,
          h60 = h / 60,
          i = Math.floor(h60),
          // integer part of hue
      f = h60 - i,
          // fractional part of hue
      p = (1.0 - s) * b,
          q = (1.0 - s * f) * b,
          t = (1.0 - s * (1.0 - f)) * b;

      switch (i) {
        case 0:
          return new Color(b, t, p);
        case 1:
          return new Color(q, b, p);
        case 2:
          return new Color(p, b, t);
        case 3:
          return new Color(p, q, b);
        case 4:
          return new Color(t, p, b);
        case 5:
          return new Color(b, p, q);
        default:
          return new Color(0, 0, 0);
      }
    }
  }, {
    key: "wheel",
    value: function wheel() {
      var n = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;
      return Color.wheelHsb(n, 0.0, 0.9, 0.7);
    }
  }, {
    key: "wheelHsb",
    value: function wheelHsb(n, hue, sat, brt) {
      // Return an array of n colors of varying hue
      var a = new Array(n),
          step = 360.0 / Math.max(n, 1);
      for (var i = 0; i < n; i++) {
        a[i] = Color.hsb(hue + i * step, sat, brt);
      }
      return a;
    }
  }, {
    key: "rgb",
    value: function rgb(r, g, b) {
      return new Color(r / 255, g / 255, b / 255);
    }
  }, {
    key: "rgbHex",
    value: function rgbHex(colorHexString) {
      var colorData = this.parseHex(colorHexString);
      if (colorData && colorData[0] >= 0 && colorData[1] >= 0 && colorData[2] >= 0) {
        return new Color(colorData[0], colorData[1], colorData[2]);
      } else {
        return null;
      }
    }
  }, {
    key: "rgba",
    value: function rgba(r, g, b, a) {
      return new Color(r / 255, g / 255, b / 255, a);
    }
  }, {
    key: "fromLiteral",
    value: function fromLiteral(spec) {
      return new Color(spec.r, spec.g, spec.b, spec.a);
    }
  }, {
    key: "fromTuple",
    value: function fromTuple(tuple) {
      return new Color(tuple[0], tuple[1], tuple[2], tuple[3]);
    }
  }, {
    key: "fromTuple8Bit",
    value: function fromTuple8Bit(tuple) {
      return new Color(tuple[0] / 255, tuple[1] / 255, tuple[2] / 255, tuple[3] / 255);
    }
  }, {
    key: "fromString",
    value: function fromString(str) {
      if (!str || str === 'none') {
        return null;
      } else {
        return parse$1(str);
      }
    }
  }, {
    key: "parse",
    value: function parse(str) {
      var color;
      if (!str || str === 'none') {
        return null;
      } else {
        color = parse$1(str);
        return [color.red(), color.green(), color.blue(), color.alpha()];
      }
    }
  }, {
    key: "parseRGB",
    value: function parseRGB(str) {
      // match string of the form rgb([r],[g],[b]) or rgb([r%],[g%],[b%]),
      // allowing whitespace between all components
      var match = str.match(this.rgbaRegex);
      if (match) {
        var r = parseInt(match[1]) / (match[2] ? 100 : 255);
        var g = parseInt(match[3]) / (match[4] ? 100 : 255);
        var b = parseInt(match[5]) / (match[6] ? 100 : 255);
        var a = match[7] ? parseFloat(match[7]) : 1.0;
        return [r, g, b, a];
      }
      return null;
    }
  }, {
    key: "parseHex",
    value: function parseHex(colStr) {
      var rHex,
          gHex,
          bHex,
          str = '';
      for (var i = 0; i < colStr.length; i++) {
        var c = colStr[i].toLowerCase();
        if (c == 'a' || c == 'b' || c == 'c' || c == 'd' || c == 'e' || c == 'f' || c == '0' || c == '1' || c == '2' || c == '3' || c == '4' || c == '5' || c == '6' || c == '7' || c == '8' || c == '9') {
          str += c;
        }
      }
      if (str.length == 6) {
        rHex = str.substring(0, 2);
        gHex = str.substring(2, 4);
        bHex = str.substring(4, 6);
      } else if (str.length == 3) {
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
      var r = parseInt(rHex, 16) / 255,
          g = parseInt(gHex, 16) / 255,
          b = parseInt(bHex, 16) / 255;
      return [r, g, b];
    }
  }, {
    key: "rgbaRegex",
    get: function get() {
      return rgbaRegex;
    }
  }, {
    key: "black",
    get: function get() {
      return black;
    }
  }, {
    key: "almostBlack",
    get: function get() {
      return almostBlack;
    }
  }, {
    key: "white",
    get: function get() {
      return white;
    }
  }, {
    key: "gray",
    get: function get() {
      return gray;
    }
  }, {
    key: "red",
    get: function get() {
      return red;
    }
  }, {
    key: "green",
    get: function get() {
      return green;
    }
  }, {
    key: "yellow",
    get: function get() {
      return yellow;
    }
  }, {
    key: "blue",
    get: function get() {
      return blue;
    }
  }, {
    key: "purple",
    get: function get() {
      return purple;
    }
  }, {
    key: "magenta",
    get: function get() {
      return magenta;
    }
  }, {
    key: "pink",
    get: function get() {
      return pink;
    }
  }, {
    key: "turquoise",
    get: function get() {
      return turquoise;
    }
  }, {
    key: "tangerine",
    get: function get() {
      return tangerine;
    }
  }, {
    key: "orange",
    get: function get() {
      return orange;
    }
  }, {
    key: "cyan",
    get: function get() {
      return cyan;
    }
  }, {
    key: "brown",
    get: function get() {
      return brown;
    }
  }, {
    key: "limeGreen",
    get: function get() {
      return limeGreen;
    }
  }, {
    key: "darkGray",
    get: function get() {
      return darkGray;
    }
  }, {
    key: "lightGray",
    get: function get() {
      return lightGray;
    }
  }, {
    key: "veryLightGray",
    get: function get() {
      return veryLightGray;
    }
  }, {
    key: "transparent",
    get: function get() {
      return transparent;
    }
  }]);

  function Color(r, g, b, a) {
    classCallCheck(this, Color);

    this.r = r || 0;
    this.g = g || 0;
    this.b = b || 0;
    this.a = a || (a === 0 ? 0 : 1);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  createClass(Color, [{
    key: "grayValue",
    value: function grayValue() {
      return (this.r + this.g + this.b) / 3;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // comparing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "equals",
    value: function equals(other) {
      if (!other) return false;
      return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // transforming
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "darker",
    value: function darker(recursion) {
      var result = this.mixedWith(Color.black, 0.5);
      return recursion > 1 ? result.darker(recursion - 1) : result;
    }
  }, {
    key: "lighter",
    value: function lighter(recursion) {
      if (recursion == 0) return this;
      var result = this.mixedWith(Color.white, 0.5);
      return recursion > 1 ? result.lighter(recursion - 1) : result;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // printing
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "toString",
    value: function toString() {
      return this.a === 1 ? "rgb(" + floor(this.r) + "," + floor(this.g) + "," + floor(this.b) + ")" : this.toRGBAString();
    }
  }, {
    key: "toRGBAString",
    value: function toRGBAString() {
      function floor(x) {
        return Math.floor(x * 255.99);
      }
      return "rgba(" + floor(this.r) + "," + floor(this.g) + "," + floor(this.b) + "," + this.a + ")";
    }
  }, {
    key: "toHexString",
    value: function toHexString() {
      function floor(x) {
        return Math.floor(x * 255.99);
      }
      function addLeadingZero(string$$1) {
        var s = string$$1;
        while (s.length < 2) {
          s = '0' + s;
        }
        return s;
      }
      return addLeadingZero(floor(this.r).toString(16)) + addLeadingZero(floor(this.g).toString(16)) + addLeadingZero(floor(this.b).toString(16));
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // converting
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "toTuple",
    value: function toTuple() {
      return [this.r, this.g, this.b, this.a];
    }
  }, {
    key: "toTuple8Bit",
    value: function toTuple8Bit() {
      return [this.r * 255, this.g * 255, this.b * 255, this.a * 255];
    }
  }, {
    key: "toHSB",
    value: function toHSB() {
      var max = Math.max(this.r, this.g, this.b),
          min = Math.min(this.r, this.g, this.b),
          h,
          s,
          b = max;
      if (max == min) {
        h = 0;
      } else if (max == this.r) {
        h = 60 * (0 + (this.g - this.b) / (max - min));
      } else if (max == this.g) {
        h = 60 * (2 + (this.b - this.r) / (max - min));
      } else if (max == this.b) {
        h = 60 * (4 + (this.r - this.g) / (max - min));
      }
      h = (h + 360) % 360;
      s = max == 0 ? 0 : (max - min) / max;
      return [h, s, b];
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // instance creation
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "withA",
    value: function withA(a) {
      return new Color(this.r, this.g, this.b, a);
    }
  }, {
    key: "mixedWith",
    value: function mixedWith(other, proportion) {
      // Mix with another color -- 1.0 is all this, 0.0 is all other
      var p = proportion,
          q = 1.0 - p;
      return new Color(this.r * p + other.r * q, this.g * p + other.g * q, this.b * p + other.b * q, this.a * p + other.a * q);
    }

    // FIXME: invert sounds like mutation, versus createInverse or similar

  }, {
    key: "invert",
    value: function invert() {
      return Color.rgb(255 * (1 - this.r), 255 * (1 - this.g), 255 * (1 - this.b));
    }
  }, {
    key: "toCSSString",
    value: function toCSSString() {
      return this.toRGBAString();
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // serialization
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "__serialize__",
    value: function __serialize__() {
      return {
        __expr__: "Color." + this.toString(),
        bindings: { "lively.graphics/color.js": ["Color"] }
      };
    }
  }]);
  return Color;
}();

var Gradient = function () {
  function Gradient(stops) {
    classCallCheck(this, Gradient);

    this.stops = stops || [];
  }

  createClass(Gradient, [{
    key: "getStopsLighter",
    value: function getStopsLighter(n) {
      return this.stops.collect(function (ea) {
        return { offset: ea.offset, color: ea.color.lighter(n) };
      });
    }
  }, {
    key: "getStopsDarker",
    value: function getStopsDarker(n) {
      return this.stops.collect(function (ea) {
        return { offset: ea.offset, color: ea.color.darker(n) };
      });
    }
  }, {
    key: "isGradient",
    get: function get() {
      return true;
    }
  }]);
  return Gradient;
}();

var LinearGradient = function (_Gradient) {
  inherits(LinearGradient, _Gradient);

  function LinearGradient(_ref2) {
    var stops = _ref2.stops,
        vector = _ref2.vector;
    classCallCheck(this, LinearGradient);

    var _this8 = possibleConstructorReturn(this, (LinearGradient.__proto__ || Object.getPrototypeOf(LinearGradient)).call(this, stops));

    _this8.vector = vector;
    return _this8;
  }

  createClass(LinearGradient, [{
    key: "angleToRect",
    value: function angleToRect(rad) {
      return Point.polar(1, rad).extentAsRectangle().withCenter(pt(.5, .5));
    }
  }, {
    key: "vectorAsAngle",
    value: function vectorAsAngle() {
      return this.vector.extent().theta();
    }
  }, {
    key: "toString",
    value: function toString() {
      return this.toCSSString();
    }
  }, {
    key: "lighter",
    value: function lighter(n) {
      return new this.constructor(this.getStopsLighter(n), this.vector);
    }
  }, {
    key: "darker",
    value: function darker() {
      return new this.constructor(this.getStopsDarker(), this.vector);
    }
  }, {
    key: "toCSSString",
    value: function toCSSString() {
      // default webkit way of defining gradients
      var str = "-webkit-gradient(linear,\n        " + this.vector.x * 100.0 + "% \n        " + this.vector.y * 100.0 + "%, \n        " + this.vector.maxX() * 100.0 + "% \n        " + this.vector.maxY() * 100.0 + "%";
      for (var i = 0; i < this.stops.length; i++) {
        str += ",color-stop(" + ((this.stops[i].offset * 100).toFixed() + "%") + ", " + this.stops[i].color.toRGBAString() + ")";
      }str += ')';
      return str;
    }
  }, {
    key: "type",
    get: function get() {
      return "linearGradient";
    }
  }, {
    key: "vectors",
    get: function get() {
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
  }, {
    key: "vector",
    get: function get() {
      return this._vector;
    },
    set: function set(value) {
      if (!value) this._vector = this.vectors.northsouth;else if (typeof value === "string") this._vector = this.vectors[value.toLowerCase()];else if (typeof value === "number") this._vector = this.angleToRect(value); //radians
      else this._vector = value;
    }
  }]);
  return LinearGradient;
}(Gradient);

var RadialGradient = function (_Gradient2) {
  inherits(RadialGradient, _Gradient2);

  function RadialGradient(_ref3) {
    var stops = _ref3.stops,
        focus = _ref3.focus,
        bounds = _ref3.bounds;
    classCallCheck(this, RadialGradient);

    var _this9 = possibleConstructorReturn(this, (RadialGradient.__proto__ || Object.getPrototypeOf(RadialGradient)).call(this, stops));

    _this9.focus = focus || pt(0.5, 0.5);
    _this9.bounds = bounds || new Rectangle(0, 0, 20, 20);
    return _this9;
  }

  createClass(RadialGradient, [{
    key: "toString",
    value: function toString() {
      return this.toCSSString();
    }
  }, {
    key: "lighter",
    value: function lighter(n) {
      return new this.constructor(this.getStopsLighter(n), this.focus);
    }
  }, {
    key: "darker",
    value: function darker() {
      return new this.constructor(this.getStopsDarker(), this.focus);
    }
  }, {
    key: "toCSSString",
    value: function toCSSString() {
      var innerCircle = this.focus.scaleBy(100.0),
          ext = this.bounds.extent();
      var str = "radial-gradient(" + ext.x / 2 + "px " + ext.y / 2 + "px ellipse at " + innerCircle.x + "% " + innerCircle.y + "% ";
      for (var i = 0; i < this.stops.length; i++) {
        str += "," + this.stops[i].color.toRGBAString() + " " + ((this.stops[i].offset * 100).toFixed() + "%");
      }str += ')';
      return str;
    }
  }, {
    key: "type",
    get: function get() {
      return "radialGradient";
    }
  }]);
  return RadialGradient;
}(Gradient);

/* 
   Flat design or flat UI colors are quite popular in web design today 
   where bold, bright colors are used to create clean, simple interfaces.
*/

var flatDesignColors = ["#1abc9c", "#e8f8f5", "#d1f2eb", "#a3e4d7", "#76d7c4", "#48c9b0", "#1abc9c", "#17a589", "#148f77", "#117864", "#0e6251", "#16a085", "#e8f6f3", "#d0ece7", "#a2d9ce", "#73c6b6", "#45b39d", "#16a085", "#138d75", "#117a65", "#0e6655", "#0b5345", "#2ecc71", "#eafaf1", "#d5f5e3", "#abebc6", "#82e0aa", "#58d68d", "#2ecc71", "#28b463", "#239b56", "#1d8348", "#186a3b", "#27ae60", "#e9f7ef", "#d4efdf", "#a9dfbf", "#7dcea0", "#52be80", "#27ae60", "#229954", "#1e8449", "#196f3d", "#145a32", "#3498db", "#ebf5fb", "#d6eaf8", "#aed6f1", "#85c1e9", "#5dade2", "#3498db", "#2e86c1", "#2874a6", "#21618c", "#1b4f72", "#2980b9", "#eaf2f8", "#d4e6f1", "#a9cce3", "#7fb3d5", "#5499c7", "#2980b9", "#2471a3", "#1f618d", "#1a5276", "#154360", "#9b59b6", "#f5eef8", "#ebdef0", "#d7bde2", "#c39bd3", "#af7ac5", "#9b59b6", "#884ea0", "#76448a", "#633974", "#512e5f", "#8e44ad", "#f4ecf7", "#e8daef", "#d2b4de", "#bb8fce", "#a569bd", "#8e44ad", "#7d3c98", "#6c3483", "#5b2c6f", "#4a235a", "#34495e", "#ebedef", "#d6dbdf", "#aeb6bf", "#85929e", "#5d6d7e", "#34495e", "#2e4053", "#283747", "#212f3c", "#1b2631", "#2c3e50", "#eaecee", "#d5d8dc", "#abb2b9", "#808b96", "#566573", "#2c3e50", "#273746", "#212f3d", "#1c2833", "#17202a", "#f1c40f", "#fef9e7", "#fcf3cf", "#f9e79f", "#f7dc6f", "#f4d03f", "#f1c40f", "#d4ac0d", "#b7950b", "#9a7d0a", "#7d6608", "#f39c12", "#fef5e7", "#fdebd0", "#fad7a0", "#f8c471", "#f5b041", "#f39c12", "#d68910", "#b9770e", "#9c640c", "#7e5109", "#e67e22", "#fdf2e9", "#fae5d3", "#f5cba7", "#f0b27a", "#eb984e", "#e67e22", "#ca6f1e", "#af601a", "#935116", "#784212", "#d35400", "#fbeee6", "#f6ddcc", "#edbb99", "#e59866", "#dc7633", "#d35400", "#ba4a00", "#a04000", "#873600", "#6e2c00", "#e74c3c", "#fdedec", "#fadbd8", "#f5b7b1", "#f1948a", "#ec7063", "#e74c3c", "#cb4335", "#b03a2e", "#943126", "#78281f", "#c0392b", "#f9ebea", "#f2d7d5", "#e6b0aa", "#d98880", "#cd6155", "#c0392b", "#a93226", "#922b21", "#7b241c", "#641e16", "#ecf0f1", "#fdfefe", "#fbfcfc", "#f7f9f9", "#f4f6f7", "#f0f3f4", "#ecf0f1", "#d0d3d4", "#b3b6b7", "#979a9a", "#7b7d7d", "#bdc3c7", "#f8f9f9", "#f2f3f4", "#e5e7e9", "#d7dbdd", "#cacfd2", "#bdc3c7", "#a6acaf", "#909497", "#797d7f", "#626567", "#95a5a6", "#f4f6f6", "#eaeded", "#d5dbdb", "#bfc9ca", "#aab7b8", "#95a5a6", "#839192", "#717d7e", "#5f6a6a", "#4d5656", "#7f8c8d", "#f2f4f4", "#e5e8e8", "#ccd1d1", "#b2babb", "#99a3a4", "#7f8c8d", "#707b7c", "#616a6b", "#515a5a", "#424949"];

/*
  Material design is a visual language and design system developed 
  by Google with an almost flat style and vibrant color schemes.
*/

var materialDesignColors = ["#f44336", "#ffebee", "#ffcdd2", "#ef9a9a", "#e57373", "#ef5350", "#f44336", "#e53935", "#d32f2f", "#c62828", "#b71c1c", "#ff8a80", "#ff5252", "#ff1744", "#d50000", "#e91e63", "#fce4ec", "#f8bbd0", "#f48fb1", "#f06292", "#ec407a", "#e91e63", "#d81b60", "#c2185b", "#ad1457", "#880e4f", "#ff80ab", "#ff4081", "#f50057", "#c51162", "#9c27b0", "#f3e5f5", "#e1bee7", "#ce93d8", "#ba68c8", "#ab47bc", "#9c27b0", "#8e24aa", "#7b1fa2", "#6a1b9a", "#4a148c", "#ea80fc", "#e040fb", "#d500f9", "#aa00ff", "#673ab7", "#ede7f6", "#d1c4e9", "#b39ddb", "#9575cd", "#7e57c2", "#673ab7", "#5e35b1", "#512da8", "#4527a0", "#311b92", "#b388ff", "#7c4dff", "#651fff", "#6200ea", "#3f51b5", "#e8eaf6", "#c5cae9", "#9fa8da", "#7986cb", "#5c6bc0", "#3f51b5", "#3949ab", "#303f9f", "#283593", "#1a237e", "#8c9eff", "#536dfe", "#3d5afe", "#304ffe", "#2196f3", "#e3f2fd", "#bbdefb", "#90caf9", "#64b5f6", "#42a5f5", "#2196f3", "#1e88e5", "#1976d2", "#1565c0", "#0d47a1", "#82b1ff", "#448aff", "#2979ff", "#2962ff", "#03a9f4", "#e1f5fe", "#b3e5fc", "#81d4fa", "#4fc3f7", "#29b6f6", "#03a9f4", "#039be5", "#0288d1", "#0277bd", "#01579b", "#80d8ff", "#40c4ff", "#00b0ff", "#0091ea", "#00bcd4", "#e0f7fa", "#b2ebf2", "#80deea", "#4dd0e1", "#26c6da", "#00bcd4", "#00acc1", "#0097a7", "#00838f", "#006064", "#84ffff", "#18ffff", "#00e5ff", "#00b8d4", "#009688", "#e0f2f1", "#b2dfdb", "#80cbc4", "#4db6ac", "#26a69a", "#009688", "#00897b", "#00796b", "#00695c", "#004d40", "#a7ffeb", "#64ffda", "#1de9b6", "#00bfa5", "#4caf50", "#e8f5e9", "#c8e6c9", "#a5d6a7", "#81c784", "#66bb6a", "#4caf50", "#43a047", "#388e3c", "#2e7d32", "#1b5e20", "#b9f6ca", "#69f0ae", "#00e676", "#00c853", "#8bc34a", "#f1f8e9", "#dcedc8", "#c5e1a5", "#aed581", "#9ccc65", "#8bc34a", "#7cb342", "#689f38", "#558b2f", "#33691e", "#ccff90", "#b2ff59", "#76ff03", "#64dd17", "#cddc39", "#f9fbe7", "#f0f4c3", "#e6ee9c", "#dce775", "#d4e157", "#cddc39", "#c0ca33", "#afb42b", "#9e9d24", "#827717", "#f4ff81", "#eeff41", "#c6ff00", "#aeea00", "#ffeb3b", "#fffde7", "#fff9c4", "#fff59d", "#fff176", "#ffee58", "#ffeb3b", "#fdd835", "#fbc02d", "#f9a825", "#f57f17", "#ffff8d", "#ffff00", "#ffea00", "#ffd600", "#ffc107", "#fff8e1", "#ffecb3", "#ffe082", "#ffd54f", "#ffca28", "#ffc107", "#ffb300", "#ffa000", "#ff8f00", "#ff6f00", "#ffe57f", "#ffd740", "#ffc400", "#ffab00", "#ff9800", "#fff3e0", "#ffe0b2", "#ffcc80", "#ffb74d", "#ffa726", "#ff9800", "#fb8c00", "#f57c00", "#ef6c00", "#e65100", "#ffd180", "#ffab40", "#ff9100", "#ff6d00", "#ff5722", "#fbe9e7", "#ffccbc", "#ffab91", "#ff8a65", "#ff7043", "#ff5722", "#f4511e", "#e64a19", "#d84315", "#bf360c", "#ff9e80", "#ff6e40", "#ff3d00", "#dd2c00", "#795548", "#efebe9", "#d7ccc8", "#bcaaa4", "#a1887f", "#8d6e63", "#795548", "#6d4c41", "#5d4037", "#4e342e", "#3e2723", "#9e9e9e", "#fafafa", "#f5f5f5", "#eeeeee", "#e0e0e0", "#bdbdbd", "#9e9e9e", "#757575", "#616161", "#424242", "#212121", "#607d8b", "#eceff1", "#cfd8dc", "#b0bec5", "#90a4ae", "#78909c", "#607d8b", "#546e7a", "#455a64", "#37474f", "#263238", "#ffffff", "#000000"];

var webSafeColors = ["ccff00", "ccff33", "ccff66", "ccff99", "ccffcc", "ccffff", "ffffff", "ffffcc", "ffff99", "ffff66", "ffff33", "ffff00", "cccc00", "cccc33", "cccc66", "cccc99", "cccccc", "ccccff", "ffccff", "ffcccc", "ffcc99", "ffcc66", "ffcc33", "ffcc00", "cc9900", "cc9933", "cc9966", "cc9999", "cc99cc", "cc99ff", "ff99ff", "ff99cc", "ff9999", "ff9966", "ff9933", "ff9900", "cc6600", "cc6633", "cc6666", "cc6699", "cc66cc", "cc66ff", "ff66ff", "ff66cc", "ff6699", "ff6666", "ff6633", "ff6600", "cc3300", "cc3333", "cc3366", "cc3399", "cc33cc", "cc33ff", "ff33ff", "ff33cc", "ff3399", "ff3366", "ff3333", "ff3300", "cc0000", "cc0033", "cc0066", "cc0099", "cc00cc", "cc00ff", "ff00ff", "ff00cc", "ff0099", "ff0066", "ff0033", "ff0000", "660000", "660033", "660066", "660099", "6600cc", "6600ff", "9900ff", "9900cc", "990099", "990066", "990033", "990000", "663300", "663333", "663366", "663399", "6633cc", "6633ff", "9933ff", "9933cc", "993399", "993366", "993333", "993300", "666600", "666633", "666666", "666699", "6666cc", "6666ff", "9966ff", "9966cc", "996699", "996666", "996633", "996600", "669900", "669933", "669966", "669999", "6699cc", "6699ff", "9999ff", "9999cc", "999999", "999966", "999933", "999900", "66cc00", "66cc33", "66cc66", "66cc99", "66cccc", "66ccff", "99ccff", "99cccc", "99cc99", "99cc66", "99cc33", "99cc00", "66ff00", "66ff33", "66ff66", "66ff99", "66ffcc", "66ffff", "99ffff", "99ffcc", "99ff99", "99ff66", "99ff33", "99ff00", "00ff00", "00ff33", "00ff66", "00ff99", "00ffcc", "00ffff", "33ffff", "33ffcc", "33ff99", "33ff66", "33ff33", "33ff00", "00cc00", "00cc33", "00cc66", "00cc99", "00cccc", "00ccff", "33ccff", "33cccc", "33cc99", "33cc66", "33cc33", "33cc00", "009900", "009933", "009966", "009999", "0099cc", "0099ff", "3399ff", "3399cc", "339999", "339966", "339933", "339900", "006600", "006633", "006666", "006699", "0066cc", "0066ff", "3366ff", "3366cc", "336699", "336666", "336633", "336600", "003300", "003333", "003366", "003399", "0033cc", "0033ff", "3333ff", "3333cc", "333399", "333366", "333333", "333300", "000000", "000033", "000066", "000099", "0000cc", "0000ff", "3300ff", "3300cc", "330099", "330066", "330033", "330000"];

// well-known colors
var black = new Color(0, 0, 0);
var almostBlack = Color.rgb(64, 64, 64);
var white = new Color(1, 1, 1);
var gray = new Color(0.8, 0.8, 0.8);
var red = new Color(0.8, 0, 0);
var green = new Color(0, 0.8, 0);
var yellow = new Color(0.8, 0.8, 0);
var blue = new Color(0, 0, 0.8);
var purple = new Color(1, 0, 1);
var magenta = new Color(1, 0, 1);
var pink = Color.rgb(255, 30, 153);
var turquoise = Color.rgb(0, 240, 255);
var tangerine = Color.rgb(242, 133, 0);
var orange = Color.rgb(255, 153, 0);
var cyan = Color.rgb(0, 255, 255);
var brown = Color.rgb(182, 67, 0);
var limeGreen = Color.rgb(51, 255, 0);
var darkGray = Color.rgb(102, 102, 102);
var lightGray = Color.rgb(230, 230, 230);
var veryLightGray = Color.rgb(243, 243, 243);
var transparent = Color.rgba(0, 0, 0, 0);

exports.Complementary = Complementary;
exports.Triadic = Triadic;
exports.Tetradic = Tetradic;
exports.Quadratic = Quadratic;
exports.Analogous = Analogous;
exports.Neutral = Neutral;
exports.Color = Color;
exports.LinearGradient = LinearGradient;
exports.RadialGradient = RadialGradient;
exports.flatDesignColors = flatDesignColors;
exports.materialDesignColors = materialDesignColors;
exports.webSafeColors = webSafeColors;
exports.black = black;
exports.almostBlack = almostBlack;
exports.white = white;
exports.gray = gray;
exports.red = red;
exports.green = green;
exports.yellow = yellow;
exports.blue = blue;
exports.purple = purple;
exports.magenta = magenta;
exports.pink = pink;
exports.turquoise = turquoise;
exports.tangerine = tangerine;
exports.orange = orange;
exports.cyan = cyan;
exports.brown = brown;
exports.limeGreen = limeGreen;
exports.darkGray = darkGray;
exports.lightGray = lightGray;
exports.veryLightGray = veryLightGray;
exports.transparent = transparent;
exports.Point = Point;
exports.Rectangle = Rectangle;
exports.Transform = Transform;
exports.Line = Line;
exports.rect = rect;
exports.pt = pt;

}((this.lively.graphics = this.lively.graphics || {}),lively.lang));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.graphics;
})();