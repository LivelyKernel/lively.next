(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  var roots;
  (function (exports) {
'use strict';

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var Point2D_1 = createCommonjsModule(function (module) {
/**
 *
 *   Point2D.js
 *
 *   copyright 2001-2002, 2013 Kevin Lindsey
 *
 */

/**
 *  Point2D
 *
 *  @param {Number} x
 *  @param {Number} y
 *  @returns {Point2D}
 */
function Point2D(x, y) {
    Object.defineProperties(this, {
        "x": {
            value: x,
            writable: false,
            enumerable: true,
            configurable: false
        },
        "y": {
            value: y,
            writable: false,
            enumerable: true,
            configurable: false
        }
    });
    // this.x = x;
    // this.y = y;
}

/**
 *  clone
 *
 *  @returns {Point2D}
 */
Point2D.prototype.clone = function() {
    return new Point2D(this.x, this.y);
};

/**
 *  add
 *
 *  @param {Point2D|Vector2D} that
 *  @returns {Point2D}
 */
Point2D.prototype.add = function(that) {
    return new Point2D(this.x+that.x, this.y+that.y);
};

/**
 *  subtract
 *
 *  @param { Vector2D | Point2D } that
 *  @returns {Point2D}
 */
Point2D.prototype.subtract = function(that) {
    return new Point2D(this.x-that.x, this.y-that.y);
};

/**
 *  multiply
 *
 *  @param {Number} scalar
 *  @returns {Point2D}
 */
Point2D.prototype.multiply = function(scalar) {
    return new Point2D(this.x*scalar, this.y*scalar);
};

/**
 *  divide
 *
 *  @param {Number} scalar
 *  @returns {Point2D}
 */
Point2D.prototype.divide = function(scalar) {
    return new Point2D(this.x/scalar, this.y/scalar);
};

/**
 *  equals
 *
 *  @param {Point2D} that
 *  @returns {Boolean}
 */
Point2D.prototype.equals = function(that) {
    return ( this.x == that.x && this.y == that.y );
};

// utility methods

/**
 *  lerp
 *
 *  @param { Vector2D | Point2D } that
 *  @param {Number} t
 @  @returns {Point2D}
 */
Point2D.prototype.lerp = function(that, t) {
    var omt = 1.0 - t;

    return new Point2D(
        this.x * omt + that.x * t,
        this.y * omt + that.y * t
    );
};

/**
 *  distanceFrom
 *
 *  @param {Point2D} that
 *  @returns {Number}
 */
Point2D.prototype.distanceFrom = function(that) {
    var dx = this.x - that.x;
    var dy = this.y - that.y;

    return Math.sqrt(dx*dx + dy*dy);
};

/**
 *  min
 *
 *  @param {Point2D} that
 *  @returns {Number}
 */
Point2D.prototype.min = function(that) {
    return new Point2D(
        Math.min( this.x, that.x ),
        Math.min( this.y, that.y )
    );
};

/**
 *  max
 *
 *  @param {Point2D} that
 *  @returns {Number}
 */
Point2D.prototype.max = function(that) {
    return new Point2D(
        Math.max( this.x, that.x ),
        Math.max( this.y, that.y )
    );
};

/**
 *  transform
 *
 *  @param {Matrix2D}
 *  @result {Point2D}
 */
Point2D.prototype.transform = function(matrix) {
    return new Point2D(
        matrix.a * this.x + matrix.c * this.y + matrix.e,
        matrix.b * this.x + matrix.d * this.y + matrix.f
    );
};

/**
 *  toString
 *
 *  @returns {String}
 */
Point2D.prototype.toString = function() {
    return "point(" + this.x + "," + this.y + ")";
};

{
    module.exports = Point2D;
}
});

var Vector2D_1 = createCommonjsModule(function (module) {
/**
 *
 *   Vector2D.js
 *
 *   copyright 2001-2002, 2013 Kevin Lindsey
 *
 */

/**
 *  Vector2D
 *
 *  @param {Number} x
 *  @param {Number} y
 *  @returns {Vector2D}
 */
function Vector2D(x, y) {
    Object.defineProperties(this, {
        "x": {
            value: x,
            writable: false,
            enumerable: true,
            configurable: false
        },
        "y": {
            value: y,
            writable: false,
            enumerable: true,
            configurable: false
        }
    });
    // this.x = x;
    // this.y = y;
}

/**
 *  fromPoints
 *
 *  @param {Point2D} p1
 *  @param {Point2D} p2
 *  @returns {Vector2D}
 */
Vector2D.fromPoints = function(p1, p2) {
    return new Vector2D(
        p2.x - p1.x,
        p2.y - p1.y
    );
};

/**
 *  length
 *
 *  @returns {Number}
 */
Vector2D.prototype.length = function() {
    return Math.sqrt(this.x*this.x + this.y*this.y);
};

/**
 *  magnitude
 *
 *  @returns {Number}
 */
Vector2D.prototype.magnitude = function() {
    return this.x*this.x + this.y*this.y;
};

/**
 *  dot
 *
 *  @param {Vector2D} that
 *  @returns {Number}
 */
Vector2D.prototype.dot = function(that) {
    return this.x*that.x + this.y*that.y;
};

/**
 *  cross
 *
 *  @param {Vector2D} that
 *  @returns {Number}
 */
Vector2D.prototype.cross = function(that) {
    return this.x*that.y - this.y*that.x;
};

/**
 *  determinant
 *
 *  @param {Vector2D} that
 *  @returns {Number}
 */
Vector2D.prototype.determinant = function(that) {
    return this.x*that.y - this.y*that.x;
};

/**
 *  unit
 *
 *  @returns {Vector2D}
 */
Vector2D.prototype.unit = function() {
    return this.divide( this.length() );
};

/**
 *  add
 *
 *  @param {Vector2D} that
 *  @returns {Vector2D}
 */
Vector2D.prototype.add = function(that) {
    return new Vector2D(this.x + that.x, this.y + that.y);
};

/**
 *  subtract
 *
 *  @param {Vector2D} that
 *  @returns {Vector2D}
 */
Vector2D.prototype.subtract = function(that) {
    return new Vector2D(this.x - that.x, this.y - that.y);
};

/**
 *  multiply
 *
 *  @param {Number} scalar
 *  @returns {Vector2D}
 */
Vector2D.prototype.multiply = function(scalar) {
    return new Vector2D(this.x * scalar, this.y * scalar);
};

/**
 *  divide
 *
 *  @param {Number} scalar
 *  @returns {Vector2D}
 */
Vector2D.prototype.divide = function(scalar) {
    return new Vector2D(this.x / scalar, this.y / scalar);
};

/**
 *  angleBetween
 *
 *  @param {Vector2D} that
 *  @returns {Number}
 */
Vector2D.prototype.angleBetween = function(that) {
    var cos = this.dot(that) / (this.length() * that.length());
    if (cos < -1) {
        cos = -1;
    }
    else if (cos > 1) {
        cos = 1;
    }
    var radians = Math.acos(cos);

    return (this.cross(that) < 0.0) ? -radians : radians;
};

/**
 *  Find a vector is that is perpendicular to this vector
 *
 *  @returns {Vector2D}
 */
Vector2D.prototype.perp = function() {
    return new Vector2D(-this.y, this.x);
};

/**
 *  Find the component of the specified vector that is perpendicular to
 *  this vector
 *
 *  @param {Vector2D} that
 *  @returns {Vector2D}
 */
Vector2D.prototype.perpendicular = function(that) {
    return this.subtract(this.project(that));
};

/**
 *  project
 *
 *  @param {Vector2D} that
 *  @returns {Vector2D}
 */
Vector2D.prototype.project = function(that) {
    var percent = this.dot(that) / that.dot(that);

    return that.multiply(percent);
};

/**
 *  transform
 *
 *  @param {Matrix2D}
 *  @returns {Vector2D}
 */
Vector2D.prototype.transform = function(matrix) {
    return new Vector2D(
        matrix.a * this.x + matrix.c * this.y,
        matrix.b * this.x + matrix.d * this.y
    );
};

/**
 *  equals
 *
 *  @param {Vector2D} that
 *  @returns {Boolean}
 */
Vector2D.prototype.equals = function(that) {
    return (
        this.x === that.x &&
        this.y === that.y
    );
};

/**
 *  toString
 *
 *  @returns {String}
 */
Vector2D.prototype.toString = function() {
    return "vector(" + this.x + "," + this.y + ")";
};

{
    module.exports = Vector2D;
}
});

var Matrix2D_1 = createCommonjsModule(function (module) {
/**
 *
 *   Matrix2D.js
 *
 *   copyright 2001-2002, 2013 Kevin Lindsey
 *
 */

/**
 *  Matrix2D
 *
 *  @param {Number} a
 *  @param {Number} b
 *  @param {Number} c
 *  @param {Number} d
 *  @param {Number} e
 *  @param {Number} f
 *  @returns {Matrix2D}
 */
function Matrix2D(a, b, c, d, e, f) {
    Object.defineProperties(this, {
        "a": {
            value: (a !== undefined) ? a : 1,
            writable: false,
            enumerable: true,
            configurable: false
        },
        "b": {
            value: (b !== undefined) ? b : 0,
            writable: false,
            enumerable: true,
            configurable: false
        },
        "c": {
            value: (c !== undefined) ? c : 0,
            writable: false,
            enumerable: true,
            configurable: false
        },
        "d": {
            value: (d !== undefined) ? d : 1,
            writable: false,
            enumerable: true,
            configurable: false
        },
        "e": {
            value: (e !== undefined) ? e : 0,
            writable: false,
            enumerable: true,
            configurable: false
        },
        "f": {
            value: (f !== undefined) ? f : 0,
            writable: false,
            enumerable: true,
            configurable: false
        }
    });
    // this.a = (a !== undefined) ? a : 1;
    // this.b = (b !== undefined) ? b : 0;
    // this.c = (c !== undefined) ? c : 0;
    // this.d = (d !== undefined) ? d : 1;
    // this.e = (e !== undefined) ? e : 0;
    // this.f = (f !== undefined) ? f : 0;
}

/**
 *  Identity matrix
 *
 *  @returns {Matrix2D}
 */
Matrix2D.IDENTITY = new Matrix2D(1, 0, 0, 1, 0, 0);

// TODO: rotate, skew, etc. matrices as well?

/**
 *  multiply
 *
 *  @pararm {Matrix2D} that
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.multiply = function(that) {
    return new Matrix2D(
        this.a * that.a + this.c * that.b,
        this.b * that.a + this.d * that.b,
        this.a * that.c + this.c * that.d,
        this.b * that.c + this.d * that.d,
        this.a * that.e + this.c * that.f + this.e,
        this.b * that.e + this.d * that.f + this.f
    );
};

/**
 *  inverse
 *
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.inverse = function() {
    var det1 = this.a * this.d - this.b * this.c;

    if ( det1 == 0.0 )
        throw("Matrix is not invertible");

    var idet = 1.0 / det1;
    var det2 = this.f * this.c - this.e * this.d;
    var det3 = this.e * this.b - this.f * this.a;

    return new Matrix2D(
        this.d * idet,
       -this.b * idet,
       -this.c * idet,
        this.a * idet,
          det2 * idet,
          det3 * idet
    );
};

/**
 *  translate
 *
 *  @param {Number} tx
 *  @param {Number} ty
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.translate = function(tx, ty) {
    return new Matrix2D(
        this.a,
        this.b,
        this.c,
        this.d,
        this.a * tx + this.c * ty + this.e,
        this.b * tx + this.d * ty + this.f
    );
};

/**
 *  scale
 *
 *  @param {Number} scale
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.scale = function(scale) {
    return new Matrix2D(
        this.a * scale,
        this.b * scale,
        this.c * scale,
        this.d * scale,
        this.e,
        this.f
    );
};

/**
 *  scaleAt
 *
 *  @param {Number} scale
 *  @param {Point2D} center
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.scaleAt = function(scale, center) {
    var dx = center.x - scale * center.x;
    var dy = center.y - scale * center.y;

    return new Matrix2D(
        this.a * scale,
        this.b * scale,
        this.c * scale,
        this.d * scale,
        this.a * dx + this.c * dy + this.e,
        this.b * dx + this.d * dy + this.f
    );
};

/**
 *  scaleNonUniform
 *
 *  @param {Number} scaleX
 *  @param {Number} scaleY
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.scaleNonUniform = function(scaleX, scaleY) {
    return new Matrix2D(
        this.a * scaleX,
        this.b * scaleX,
        this.c * scaleY,
        this.d * scaleY,
        this.e,
        this.f
    );
};

/**
 *  scaleNonUniformAt
 *
 *  @param {Number} scaleX
 *  @param {Number} scaleY
 *  @param {Point2D} center
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.scaleNonUniformAt = function(scaleX, scaleY, center) {
    var dx = center.x - scaleX * center.x;
    var dy = center.y - scaleY * center.y;

    return new Matrix2D(
        this.a * scaleX,
        this.b * scaleX,
        this.c * scaleY,
        this.d * scaleY,
        this.a * dx + this.c * dy + this.e,
        this.b * dx + this.d * dy + this.f
    );
};

/**
 *  rotate
 *
 *  @param {Number} radians
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.rotate = function(radians) {
    var c = Math.cos(radians);
    var s = Math.sin(radians);

    return new Matrix2D(
        this.a *  c + this.c * s,
        this.b *  c + this.d * s,
        this.a * -s + this.c * c,
        this.b * -s + this.d * c,
        this.e,
        this.f
    );
};

/**
 *  rotateAt
 *
 *  @param {Number} radians
 *  @param {Point2D} center
 *  @result {Matrix2D}
 */
Matrix2D.prototype.rotateAt = function(radians, center) {
    var c = Math.cos(radians);
    var s = Math.sin(radians);
    var t1 = -center.x + center.x * c - center.y * s;
    var t2 = -center.y + center.y * c + center.x * s;

    return new Matrix2D(
        this.a *  c + this.c * s,
        this.b *  c + this.d * s,
        this.a * -s + this.c * c,
        this.b * -s + this.d * c,
        this.a * t1 + this.c * t2 + this.e,
        this.b * t1 + this.d * t2 + this.f
    );
};

/**
 *  rotateFromVector
 *
 *  @param {Vector2D}
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.rotateFromVector = function(vector) {
    var unit = vector.unit();
    var c = unit.x; // cos
    var s = unit.y; // sin

    return new Matrix2D(
        this.a *  c + this.c * s,
        this.b *  c + this.d * s,
        this.a * -s + this.c * c,
        this.b * -s + this.d * c,
        this.e,
        this.f
    );
};

/**
 *  flipX
 *
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.flipX = function() {
    return new Matrix2D(
        -this.a,
        -this.b,
         this.c,
         this.d,
         this.e,
         this.f
    );
};

/**
 *  flipY
 *
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.flipY = function() {
    return new Matrix2D(
         this.a,
         this.b,
        -this.c,
        -this.d,
         this.e,
         this.f
    );
};

/**
 *  skewX
 *
 *  @pararm {Number} radians
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.skewX = function(radians) {
    var t = Math.tan(radians);

    return new Matrix2D(
        this.a,
        this.b,
        this.a * t + this.c,
        this.b * t + this.d,
        this.e,
        this.f
    );
};

// TODO: skewXAt

/**
 *  skewY
 *
 *  @pararm {Number} radians
 *  @returns {Matrix2D}
 */
Matrix2D.prototype.skewY = function(radians) {
    var t = Math.tan(angle);

    return matrix_new(
        this.a + this.c * t,
        this.b + this.d * t,
        this.c,
        this.d,
        this.e,
        this.f
    );
};

// TODO: skewYAt

/**
 *  isIdentity
 *
 *  @returns {Boolean}
 */
Matrix2D.prototype.isIdentity = function() {
    return (
        this.a === 1.0 &&
        this.b === 0.0 &&
        this.c === 0.0 &&
        this.d === 1.0 &&
        this.e === 0.0 &&
        this.f === 0.0
    );
};

/**
 *  isInvertible
 *
 *  @returns {Boolean}
 */
Matrix2D.prototype.isInvertible = function() {
    this.a * this.d - this.b * this.c !== 0.0;
};

/**
 *  getScale
 *
 *  @returns {scaleX: Number, scaleY: Number}
 */
Matrix2D.prototype.getScale = function() {
    return {
        scaleX: Math.sqrt(this.a * this.a + this.c * this.c),
        scaleY: Math.sqrt(this.b * this.b + this.d * this.d)
    };
};

/**
 *  equals
 *
 *  @param {Matrix2D} that
 *  @returns {Boolean}
 */
Matrix2D.prototype.equals = function(that) {
    return (
        this.a === that.a &&
        this.b === that.b &&
        this.c === that.c &&
        this.d === that.d &&
        this.e === that.e &&
        this.f === that.f
    );
};

/**
 *  toString
 *
 *  @returns {String}
 */
Matrix2D.prototype.toString = function() {
    return (
        "matrix(" +
        this.a + "," +
        this.b + "," +
        this.c + "," +
        this.d + "," +
        this.e + "," +
        this.f + ")"
    );
};

{
    module.exports = Matrix2D;
}
});

// expose classes

var Point2D = Point2D_1;
var Vector2D = Vector2D_1;
var Matrix2D = Matrix2D_1;

var index = {
	Point2D: Point2D,
	Vector2D: Vector2D,
	Matrix2D: Matrix2D
};

exports['default'] = index;
exports.Point2D = Point2D;
exports.Vector2D = Vector2D;
exports.Matrix2D = Matrix2D;

}((this.kldAffine = this.kldAffine || {})));

  (function (exports) {
'use strict';

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var Polynomial_1 = createCommonjsModule(function (module) {
/**
 *
 *   Polynomial.js
 *
 *   copyright 2002, 2013 Kevin Lindsey
 * 
 *   contribution {@link http://github.com/Quazistax/kld-polynomial}
 *       @copyright 2015 Robert Benko (Quazistax) <quazistax@gmail.com>
 *       @license MIT
 */

Polynomial.TOLERANCE = 1e-6;
Polynomial.ACCURACY  = 15;


/**
 *  interpolate
 *
 *  @param {Array<Number>} xs
 *  @param {Array<Number>} ys
 *  @param {Number} n
 *  @param {Number} offset
 *  @param {Number} x
 *
 *  @returns {y:Number, dy:Number}
 */
Polynomial.interpolate = function(xs, ys, n, offset, x) {
    if ( xs.constructor !== Array || ys.constructor !== Array )
        throw new Error("Polynomial.interpolate: xs and ys must be arrays");
    if ( isNaN(n) || isNaN(offset) || isNaN(x) )
        throw new Error("Polynomial.interpolate: n, offset, and x must be numbers");

    var y  = 0;
    var dy = 0;
    var c = new Array(n);
    var d = new Array(n);
    var ns = 0;
    var result;

    var diff = Math.abs(x - xs[offset]);
    for ( var i = 0; i < n; i++ ) {
        var dift = Math.abs(x - xs[offset+i]);

        if ( dift < diff ) {
            ns = i;
            diff = dift;
        }
        c[i] = d[i] = ys[offset+i];
    }
    y = ys[offset+ns];
    ns--;

    for ( var m = 1; m < n; m++ ) {
        for ( var i = 0; i < n-m; i++ ) {
            var ho = xs[offset+i] - x;
            var hp = xs[offset+i+m] - x;
            var w = c[i+1]-d[i];
            var den = ho - hp;

            if ( den == 0.0 ) {
                result = { y: 0, dy: 0};
                break;
            }

            den = w / den;
            d[i] = hp*den;
            c[i] = ho*den;
        }
        dy = (2*(ns+1) < (n-m)) ? c[ns+1] : d[ns--];
        y += dy;
    }

    return { y: y, dy: dy };
};


/**
 *  Polynomial
 *
 *  @returns {Polynomial}
 */
function Polynomial() {
    this.init( arguments );
}


/**
 *  init
 */
Polynomial.prototype.init = function(coefs) {
    this.coefs = new Array();

    for ( var i = coefs.length - 1; i >= 0; i-- )
        this.coefs.push( coefs[i] );

    this._variable = "t";
    this._s = 0;
};


/**
 *  eval
 */
Polynomial.prototype.eval = function(x) {
    if ( isNaN(x) )
        throw new Error("Polynomial.eval: parameter must be a number");

    var result = 0;

    for ( var i = this.coefs.length - 1; i >= 0; i-- )
        result = result * x + this.coefs[i];

    return result;
};


/**
 *  add
 */
Polynomial.prototype.add = function(that) {
    var result = new Polynomial();
    var d1 = this.getDegree();
    var d2 = that.getDegree();
    var dmax = Math.max(d1,d2);

    for ( var i = 0; i <= dmax; i++ ) {
        var v1 = (i <= d1) ? this.coefs[i] : 0;
        var v2 = (i <= d2) ? that.coefs[i] : 0;

        result.coefs[i] = v1 + v2;
    }

    return result;
};


/**
 *  multiply
 */
Polynomial.prototype.multiply = function(that) {
    var result = new Polynomial();

    for ( var i = 0; i <= this.getDegree() + that.getDegree(); i++ )
        result.coefs.push(0);

    for ( var i = 0; i <= this.getDegree(); i++ )
        for ( var j = 0; j <= that.getDegree(); j++ )
            result.coefs[i+j] += this.coefs[i] * that.coefs[j];

    return result;
};


/**
 *  divide_scalar
 */
Polynomial.prototype.divide_scalar = function(scalar) {
    for ( var i = 0; i < this.coefs.length; i++ )
        this.coefs[i] /= scalar;
};


/**
 *  simplify
 */
Polynomial.prototype.simplify = function() {
    var TOLERANCE = 1e-15;
    for ( var i = this.getDegree(); i >= 0; i-- ) {
        if ( Math.abs( this.coefs[i] ) <= TOLERANCE )
            this.coefs.pop();
        else
            break;
    }
};


/**
 *  bisection
 */
Polynomial.prototype.bisection = function(min, max) {
    var minValue = this.eval(min);
    var maxValue = this.eval(max);
    var result;

    if ( Math.abs(minValue) <= Polynomial.TOLERANCE )
        result = min;
    else if ( Math.abs(maxValue) <= Polynomial.TOLERANCE )
        result = max;
    else if ( minValue * maxValue <= 0 ) {
        var tmp1  = Math.log(max - min);
        var tmp2  = Math.LN10 * Polynomial.ACCURACY;
        var iters = Math.ceil( (tmp1+tmp2) / Math.LN2 );

        for ( var i = 0; i < iters; i++ ) {
            result = 0.5 * (min + max);
            var value = this.eval(result);

            if ( Math.abs(value) <= Polynomial.TOLERANCE ) {
                break;
            }

            if ( value * minValue < 0 ) {
                max = result;
                maxValue = value;
            } else {
                min = result;
                minValue = value;
            }
        }
    }

    return result;
};


/**
 *  toString
 */
Polynomial.prototype.toString = function() {
    var coefs = new Array();
    var signs = new Array();

    for ( var i = this.coefs.length - 1; i >= 0; i-- ) {
        var value = Math.round(this.coefs[i]*1000)/1000;
        //var value = this.coefs[i];

        if ( value != 0 ) {
            var sign = ( value < 0 ) ? " - " : " + ";

            value = Math.abs(value);
            if ( i > 0 )
                if ( value == 1 )
                    value = this._variable;
                else
                    value += this._variable;
            if ( i > 1 ) value += "^" + i;

            signs.push( sign );
            coefs.push( value );
        }
    }

    signs[0] = ( signs[0] == " + " ) ? "" : "-";

    var result = "";
    for ( var i = 0; i < coefs.length; i++ )
        result += signs[i] + coefs[i];

    return result;
};


/**
 *  trapezoid
 *  Based on trapzd in "Numerical Recipes in C", page 137
 */
Polynomial.prototype.trapezoid = function(min, max, n) {
    if ( isNaN(min) || isNaN(max) || isNaN(n) )
        throw new Error("Polynomial.trapezoid: parameters must be numbers");

    var range = max - min;
    var TOLERANCE = 1e-7;

    if ( n == 1 ) {
        var minValue = this.eval(min);
        var maxValue = this.eval(max);
        this._s = 0.5*range*( minValue + maxValue );
    } else {
        var it = 1 << (n-2);
        var delta = range / it;
        var x = min + 0.5*delta;
        var sum = 0;

        for ( var i = 0; i < it; i++ ) {
            sum += this.eval(x);
            x += delta;
        }
        this._s = 0.5*(this._s + range*sum/it);
    }

    if ( isNaN(this._s) )
        throw new Error("Polynomial.trapezoid: this._s is NaN");

    return this._s;
};


/**
 *  simpson
 *  Based on trapzd in "Numerical Recipes in C", page 139
 */
Polynomial.prototype.simpson = function(min, max) {
    if ( isNaN(min) || isNaN(max) )
        throw new Error("Polynomial.simpson: parameters must be numbers");

    var range = max - min;
    var st = 0.5 * range * ( this.eval(min) + this.eval(max) );
    var t = st;
    var s = 4.0*st/3.0;
    var os = s;
    var ost = st;
    var TOLERANCE = 1e-7;

    var it = 1;
    for ( var n = 2; n <= 20; n++ ) {
        var delta = range / it;
        var x     = min + 0.5*delta;
        var sum   = 0;

        for ( var i = 1; i <= it; i++ ) {
            sum += this.eval(x);
            x += delta;
        }

        t = 0.5 * (t + range * sum / it);
        st = t;
        s = (4.0*st - ost)/3.0;

        if ( Math.abs(s-os) < TOLERANCE*Math.abs(os) )
            break;

        os = s;
        ost = st;
        it <<= 1;
    }

    return s;
};


/**
 *  romberg
 */
Polynomial.prototype.romberg = function(min, max) {
    if ( isNaN(min) || isNaN(max) )
        throw new Error("Polynomial.romberg: parameters must be numbers");

    var MAX = 20;
    var K = 3;
    var TOLERANCE = 1e-6;
    var s = new Array(MAX+1);
    var h = new Array(MAX+1);
    var result = { y: 0, dy: 0 };

    h[0] = 1.0;
    for ( var j = 1; j <= MAX; j++ ) {
        s[j-1] = this.trapezoid(min, max, j);
        if ( j >= K ) {
            result = Polynomial.interpolate(h, s, K, j-K, 0.0);
            if ( Math.abs(result.dy) <= TOLERANCE*result.y) break;
        }
        s[j] = s[j-1];
        h[j] = 0.25 * h[j-1];
    }

    return result.y;
};

// getters and setters

/**
 *  get degree
 */
Polynomial.prototype.getDegree = function() {
    return this.coefs.length - 1;
};


/**
 *  getDerivative
 */
Polynomial.prototype.getDerivative = function() {
    var derivative = new Polynomial();

    for ( var i = 1; i < this.coefs.length; i++ ) {
        derivative.coefs.push(i*this.coefs[i]);
    }

    return derivative;
};


/**
 *  getRoots
 */
Polynomial.prototype.getRoots = function() {
    var result;

    this.simplify();
    switch ( this.getDegree() ) {
        case 0: result = new Array();              break;
        case 1: result = this.getLinearRoot();     break;
        case 2: result = this.getQuadraticRoots(); break;
        case 3: result = this.getCubicRoots();     break;
        case 4: result = this.getQuarticRoots();   break;
        default:
            result = new Array();
            // should try Newton's method and/or bisection
    }

    return result;
};


/**
 *  getRootsInInterval
 */
Polynomial.prototype.getRootsInInterval = function(min, max) {
    var roots = new Array();
    var root;

    if ( this.getDegree() == 1 ) {
        root = this.bisection(min, max);
        if ( root != null ) roots.push(root);
    } else {
        // get roots of derivative
        var deriv  = this.getDerivative();
        var droots = deriv.getRootsInInterval(min, max);

        if ( droots.length > 0 ) {
            // find root on [min, droots[0]]
            root = this.bisection(min, droots[0]);
            if ( root != null ) roots.push(root);

            // find root on [droots[i],droots[i+1]] for 0 <= i <= count-2
            for ( i = 0; i <= droots.length-2; i++ ) {
                root = this.bisection(droots[i], droots[i+1]);
                if ( root != null ) roots.push(root);
            }

            // find root on [droots[count-1],xmax]
            root = this.bisection(droots[droots.length-1], max);
            if ( root != null ) roots.push(root);
        } else {
            // polynomial is monotone on [min,max], has at most one root
            root = this.bisection(min, max);
            if ( root != null ) roots.push(root);
        }
    }

    return roots;
};


/**
 *  getLinearRoot
 */
Polynomial.prototype.getLinearRoot = function() {
    var result = new Array();
    var a = this.coefs[1];

    if ( a != 0 )
        result.push( -this.coefs[0] / a );

    return result;
};


/**
 *  getQuadraticRoots
 */
Polynomial.prototype.getQuadraticRoots = function() {
    var results = new Array();

    if ( this.getDegree() == 2 ) {
        var a = this.coefs[2];
        var b = this.coefs[1] / a;
        var c = this.coefs[0] / a;
        var d = b*b - 4*c;

        if ( d > 0 ) {
            var e = Math.sqrt(d);

            results.push( 0.5 * (-b + e) );
            results.push( 0.5 * (-b - e) );
        } else if ( d == 0 ) {
            // really two roots with same value, but we only return one
            results.push( 0.5 * -b );
        }
    }

    return results;
};


/**
 *  getCubicRoots
 *
 *  This code is based on MgcPolynomial.cpp written by David Eberly.  His
 *  code along with many other excellent examples are avaiable at his site:
 *  http://www.geometrictools.com
 */
Polynomial.prototype.getCubicRoots = function() {
    var results = new Array();

    if ( this.getDegree() == 3 ) {
        var c3 = this.coefs[3];
        var c2 = this.coefs[2] / c3;
        var c1 = this.coefs[1] / c3;
        var c0 = this.coefs[0] / c3;

        var a       = (3*c1 - c2*c2) / 3;
        var b       = (2*c2*c2*c2 - 9*c1*c2 + 27*c0) / 27;
        var offset  = c2 / 3;
        var discrim = b*b/4 + a*a*a/27;
        var halfB   = b / 2;

        var ZEROepsilon = this.zeroErrorEstimate();
        if (Math.abs(discrim) <= ZEROepsilon) discrim = 0;

        if ( discrim > 0 ) {
            var e = Math.sqrt(discrim);
            var tmp;
            var root;

            tmp = -halfB + e;
            if ( tmp >= 0 )
                root = Math.pow(tmp, 1/3);
            else
                root = -Math.pow(-tmp, 1/3);

            tmp = -halfB - e;
            if ( tmp >= 0 )
                root += Math.pow(tmp, 1/3);
            else
                root -= Math.pow(-tmp, 1/3);

            results.push( root - offset );
        } else if ( discrim < 0 ) {
            var distance = Math.sqrt(-a/3);
            var angle    = Math.atan2( Math.sqrt(-discrim), -halfB) / 3;
            var cos      = Math.cos(angle);
            var sin      = Math.sin(angle);
            var sqrt3    = Math.sqrt(3);

            results.push( 2*distance*cos - offset );
            results.push( -distance * (cos + sqrt3 * sin) - offset);
            results.push( -distance * (cos - sqrt3 * sin) - offset);
        } else {
            var tmp;

            if ( halfB >= 0 )
                tmp = -Math.pow(halfB, 1/3);
            else
                tmp = Math.pow(-halfB, 1/3);

            results.push( 2*tmp - offset );
            // really should return next root twice, but we return only one
            results.push( -tmp - offset );
        }
    }

    return results;
};

/**
    Sign of a number (+1, -1, +0, -0).
 */
var sign = function (x) {
    return typeof x === 'number' ? x ? x < 0 ? -1 : 1 : x === x ? x : NaN : NaN;
};


///////////////////////////////////////////////////////////////////
/**
    Calculates roots of quartic polynomial. <br/>
    First, derivative roots are found, then used to split quartic polynomial 
    into segments, each containing one root of quartic polynomial.
    Segments are then passed to newton's method to find roots.

    @returns {Array<Number>} roots
*/
Polynomial.prototype.getQuarticRoots = function () {
    var results = [];

    var n = this.getDegree();
    if (n == 4) {

        var poly = new Polynomial();
        poly.coefs = this.coefs.slice();
        poly.divide_scalar(poly.coefs[n]);
        var ERRF = 1e-15;
        if (Math.abs(poly.coefs[0]) < 10 * ERRF * Math.abs(poly.coefs[3]))
            poly.coefs[0] = 0;
        var poly_d = poly.getDerivative();
        var derrt = poly_d.getRoots().sort(function (a, b) { return a - b; });
        var dery = [];
        var nr = derrt.length - 1;
        var i;
        var rb = this.bounds();
        maxabsX = Math.max(Math.abs(rb.minX), Math.abs(rb.maxX));
        var ZEROepsilon = this.zeroErrorEstimate(maxabsX);
        
        for (i = 0; i <= nr; i++) {
            dery.push(poly.eval(derrt[i]));
        }

        for (i = 0; i <= nr; i++) {
            if (Math.abs(dery[i]) < ZEROepsilon)
                dery[i] = 0;
        }

        i = 0;
        var dx = Math.max(0.1 * (rb.maxX - rb.minX) / n, ERRF);
        var guesses = [];
        var minmax = [];
        if (nr > -1) {
            if (dery[0] != 0) {
                if (sign(dery[0]) != sign(poly.eval(derrt[0] - dx) - dery[0])) {
                    guesses.push(derrt[0] - dx);
                    minmax.push([rb.minX, derrt[0]]);
                }
            }
            else {
                results.push(derrt[0], derrt[0]);
                i++;
            }

            for (; i < nr; i++) {
                if (dery[i + 1] == 0) {
                    results.push(derrt[i + 1], derrt[i + 1]);
                    i++;
                }
                else if (sign(dery[i]) != sign(dery[i + 1])) {
                    guesses.push((derrt[i] + derrt[i + 1]) / 2);
                    minmax.push([derrt[i], derrt[i + 1]]);
                }
            }
            if (dery[nr] != 0 && sign(dery[nr]) != sign(poly.eval(derrt[nr] + dx) - dery[nr])) {
                guesses.push(derrt[nr] + dx);
                minmax.push([derrt[nr], rb.maxX]);
            }
        }

        var f = function (x) { return poly.eval(x); };
        var df = function (x) { return poly_d.eval(x); };
        if (guesses.length > 0) {
            for (i = 0; i < guesses.length; i++) {
                guesses[i] = Polynomial.newton_secant_bisection(guesses[i], f, df, 32, minmax[i][0], minmax[i][1]);
            }
        }

        results = results.concat(guesses);
    }
    return results;
};

///////////////////////////////////////////////////////////////////
/**
    Estimate what is the maximum polynomial evaluation error value under which polynomial evaluation could be in fact 0.
    
    @returns {Number} 
*/
Polynomial.prototype.zeroErrorEstimate = function (maxabsX) {
    var poly = this;
    var ERRF = 1e-15;
    if (typeof maxabsX === 'undefined') {
        var rb = poly.bounds();
        maxabsX = Math.max(Math.abs(rb.minX), Math.abs(rb.maxX));
    }
    if (maxabsX < 0.001) {
        return 2*Math.abs(poly.eval(ERRF));
    }
    var n = poly.coefs.length - 1;
    var an = poly.coefs[n];
    return 10 * ERRF * poly.coefs.reduce(function (m, v, i) {
        var nm = v / an * Math.pow(maxabsX, i);
        return nm > m ? nm : m;
    }, 0);
};

///////////////////////////////////////////////////////////////////
/**
    Calculates upper Real roots bounds. <br/>
    Real roots are in interval [negX, posX]. Determined by Fujiwara method.
    @see {@link http://en.wikipedia.org/wiki/Properties_of_polynomial_roots}

    @returns {{ negX: Number, posX: Number }}
*/
Polynomial.prototype.bounds_UpperReal_Fujiwara = function () {
    var a = this.coefs;
    var n = a.length - 1;
    var an = a[n];
    if (an != 1) {
        a = this.coefs.map(function (v) { return v / an; });
    }
    var b = a.map(function (v, i) { return (i < n) ? Math.pow(Math.abs((i == 0) ? v / 2 : v), 1 / (n - i)) : v; });

    var coefSelectionFunc;
    var find2Max = function (acc, bi, i) {
        if (coefSelectionFunc(i)) {
            if (acc.max < bi) {
                acc.nearmax = acc.max;
                acc.max = bi;
            }
            else if (acc.nearmax < bi) {
                acc.nearmax = bi;
            }
        }
        return acc;
    };

    coefSelectionFunc = function (i) { return i < n && a[i] < 0; };
    var max_nearmax_pos = b.reduce(find2Max, { max: 0, nearmax: 0 });

    coefSelectionFunc = function (i) { return i < n && ((n % 2 == i % 2) ? a[i] < 0 : a[i] > 0); };
    var max_nearmax_neg = b.reduce(find2Max, { max: 0, nearmax: 0 });

    return {
        negX: -2 * max_nearmax_neg.max,
        posX: 2 * max_nearmax_pos.max
    };
};


///////////////////////////////////////////////////////////////////
/** 
    Calculates lower Real roots bounds. <br/>
    There are no Real roots in interval <negX, posX>. Determined by Fujiwara method.
    @see {@link http://en.wikipedia.org/wiki/Properties_of_polynomial_roots}

    @returns {{ negX: Number, posX: Number }}
*/
Polynomial.prototype.bounds_LowerReal_Fujiwara = function () {
    var poly = new Polynomial();
    poly.coefs = this.coefs.slice().reverse();
    var res = poly.bounds_UpperReal_Fujiwara();
    res.negX = 1 / res.negX;
    res.posX = 1 / res.posX;
    return res;
};


///////////////////////////////////////////////////////////////////
/** 
    Calculates left and right Real roots bounds. <br/>
    Real roots are in interval [minX, maxX]. Combines Fujiwara lower and upper bounds to get minimal interval.
    @see {@link http://en.wikipedia.org/wiki/Properties_of_polynomial_roots}

    @returns {{ minX: Number, maxX: Number }}
*/
Polynomial.prototype.bounds = function () {
    var urb = this.bounds_UpperReal_Fujiwara();
    var rb = { minX: urb.negX, maxX: urb.posX };
    if (urb.negX === 0 && urb.posX === 0)
        return rb;
    if (urb.negX === 0) {
        rb.minX = this.bounds_LowerReal_Fujiwara().posX;
    }
    else if (urb.posX === 0) {
        rb.maxX = this.bounds_LowerReal_Fujiwara().negX;
    }
    if (rb.minX > rb.maxX) {
        //console.log('Polynomial.prototype.bounds: poly has no real roots? or floating point error?');
        rb.minX = rb.maxX = 0;
    }
    return rb;
    // TODO: if sure that there are no complex roots 
    // (maybe by using Sturm's theorem) use:
    //return this.bounds_Real_Laguerre();
};


/////////////////////////////////////////////////////////////////// 
/**
    Newton's (Newton-Raphson) method for finding Real roots on univariate function. <br/>
    When using bounds, algorithm falls back to secant if newton goes out of range.
    Bisection is fallback for secant when determined secant is not efficient enough.
    @see {@link http://en.wikipedia.org/wiki/Newton%27s_method}
    @see {@link http://en.wikipedia.org/wiki/Secant_method}
    @see {@link http://en.wikipedia.org/wiki/Bisection_method}

    @param {Number} x0 - Inital root guess
    @param {function(x)} f - Function which root we are trying to find
    @param {function(x)} df - Derivative of function f
    @param {Number} max_iterations - Maximum number of algorithm iterations
    @param {Number} [min_x] - Left bound value
    @param {Number} [max_x] - Right bound value
    @returns {Number} - root
*/
Polynomial.newton_secant_bisection = function (x0, f, df, max_iterations, min, max) {
    var x, prev_dfx = 0, dfx, prev_x_ef_correction = 0, x_correction, x_new;
    var v, y_atmin, y_atmax;
    x = x0;
    var ACCURACY = 14;
    var min_correction_factor = Math.pow(10, -ACCURACY);
    var isBounded = (typeof min === 'number' && typeof max === 'number');
    if (isBounded) {
        if (min > max)
            throw new Error("newton root finding: min must be greater than max");
        y_atmin = f(min);
        y_atmax = f(max);
        if (sign(y_atmin) ==  sign(y_atmax))
            throw new Error("newton root finding: y values of bounds must be of opposite sign");
    }

    var isEnoughCorrection = function () {
        // stop if correction is too small
        // or if correction is in simple loop
        return (Math.abs(x_correction) <= min_correction_factor * Math.abs(x))
            || (prev_x_ef_correction == (x - x_correction) - x);
    };

    var i;
    //var stepMethod;
    //var details = [];
    for (i = 0; i < max_iterations; i++) {
        dfx = df(x);
        if (dfx == 0) {
            if (prev_dfx == 0) {
                // error
                throw new Error("newton root finding: df(x) is zero");
                //return null;
            }
            else {
                // use previous derivation value
                dfx = prev_dfx;
            }
            // or move x a little?
            //dfx = df(x != 0 ? x + x * 1e-15 : 1e-15);
        }
        //stepMethod = 'newton';
        prev_dfx = dfx;
        y = f(x);
        x_correction = y / dfx;
        x_new = x - x_correction;
        if (isEnoughCorrection()) {
            break;
        }

        if (isBounded) {
            if (sign(y) == sign(y_atmax)) {
                max = x;
                y_atmax = y;
            }
            else if (sign(y) == sign(y_atmin)) {
                min = x;
                y_atmin = y;
            }
            else {
                x = x_new;
                //console.log("newton root finding: sign(y) not matched.");
                break;
            }

            if ((x_new < min) || (x_new > max)) {
                if (sign(y_atmin) == sign(y_atmax)) {
                    break;
                }

                var RATIO_LIMIT = 50;
                var AIMED_BISECT_OFFSET = 0.25; // [0, 0.5)
                var dy = y_atmax - y_atmin;
                var dx = max - min;

                if (dy == 0) {
                    //stepMethod = 'bisect';
                    x_correction = x - (min + dx * 0.5);
                }
                else if (Math.abs(dy / Math.min(y_atmin, y_atmax)) > RATIO_LIMIT) {
                    //stepMethod = 'aimed bisect';
                    x_correction = x - (min + dx * (0.5 + (Math.abs(y_atmin) < Math.abs(y_atmax) ? -AIMED_BISECT_OFFSET : AIMED_BISECT_OFFSET)));
                }
                else {
                    //stepMethod = 'secant'; 
                    x_correction = x - (min - y_atmin / dy * dx);
                }
                x_new = x - x_correction;

                if (isEnoughCorrection()) {
                    break;
                }
            }
        }
        //details.push([stepMethod, i, x, x_new, x_correction, min, max, y]);
        prev_x_ef_correction = x - x_new;
        x = x_new;
    }
    //details.push([stepMethod, i, x, x_new, x_correction, min, max, y]);
    //console.log(details.join('\r\n'));
    //if (i == max_iterations)
    //    console.log('newt: steps=' + ((i==max_iterations)? i:(i + 1)));
    return x;
};

{
    module.exports = Polynomial;
}
});

var SqrtPolynomial_1 = createCommonjsModule(function (module) {
/**
 *
 *   SqrtPolynomial.js
 *
 *   copyright 2003, 2013 Kevin Lindsey
 *
 */

{
    var Polynomial = Polynomial_1;
}

/**
 *   class variables
 */
SqrtPolynomial.VERSION = 1.0;

// setup inheritance
SqrtPolynomial.prototype             = new Polynomial();
SqrtPolynomial.prototype.constructor = SqrtPolynomial;
SqrtPolynomial.superclass            = Polynomial.prototype;


/**
 *  SqrtPolynomial
 */
function SqrtPolynomial() {
    this.init( arguments );
}


/**
 *  eval
 *
 *  @param {Number} x
 *  @returns {Number}
 */
SqrtPolynomial.prototype.eval = function(x) {
    var TOLERANCE = 1e-7;
    var result = SqrtPolynomial.superclass.eval.call(this, x);

    // NOTE: May need to change the following.  I added these to capture
    // some really small negative values that were being generated by one
    // of my Bezier arcLength functions
    if ( Math.abs(result) < TOLERANCE ) result = 0;
    if ( result < 0 )
        throw new Error("SqrtPolynomial.eval: cannot take square root of negative number");

    return Math.sqrt(result);
};

SqrtPolynomial.prototype.toString = function() {
    var result = SqrtPolynomial.superclass.toString.call(this);

    return "sqrt(" + result + ")";
};

{
    module.exports = SqrtPolynomial;
}
});

// expose classes

var Polynomial = Polynomial_1;
var SqrtPolynomial = SqrtPolynomial_1;

var index = {
	Polynomial: Polynomial,
	SqrtPolynomial: SqrtPolynomial
};

exports['default'] = index;
exports.Polynomial = Polynomial;
exports.SqrtPolynomial = SqrtPolynomial;

}((this.kldPolynomial = this.kldPolynomial || {})));

  (function (exports,kldAffine,kldPolynomial) {
'use strict';

kldAffine = 'default' in kldAffine ? kldAffine['default'] : kldAffine;
kldPolynomial = 'default' in kldPolynomial ? kldPolynomial['default'] : kldPolynomial;

var Point2D$1 = kldAffine.Point2D;


/**
    getArcParameters

    @param {Point2D} startPoint
    @param {Point2D} endPoint
    @param {Number} rx
    @param {Number} ry
    @param {Number} angle - in degrees
    @param {Boolean} arcFlag
    @param {Boolean} sweepFlag
    @returns {{ center: Point2D, rx: Number, ry: Number, theta1: Number, deltaTheta: Number }}
*/
function getArcParameters(startPoint, endPoint, rx, ry, angle, arcFlag, sweepFlag) {
    function radian(ux, uy, vx, vy) {
        var dot = ux * vx + uy * vy;
        var mod = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
        var rad = Math.acos(dot / mod);
        if (ux * vy - uy * vx < 0.0) rad = -rad;
        return rad;
    }
    angle = angle * Math.PI / 180;
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    var TOLERANCE = 1e-6;
    var halfDiff = startPoint.subtract(endPoint).divide(2);
    var x1p = halfDiff.x * c + halfDiff.y * s;
    var y1p = halfDiff.x * -s + halfDiff.y * c;
    var x1px1p = x1p * x1p;
    var y1py1p = y1p * y1p;
    var lambda = (x1px1p / (rx * rx)) + (y1py1p / (ry * ry));
    var factor;
    if (lambda > 1) {
        factor = Math.sqrt(lambda);
        rx *= factor;
        ry *= factor;
    }
    var rxrx = rx * rx;
    var ryry = ry * ry;
    var rxy1 = rxrx * y1py1p;
    var ryx1 = ryry * x1px1p;
    factor = (rxrx * ryry - rxy1 - ryx1) / (rxy1 + ryx1);
    if (Math.abs(factor) < TOLERANCE) factor = 0;
    var sq = Math.sqrt(factor);
    if (arcFlag == sweepFlag) sq = -sq;
    var mid = startPoint.add(endPoint).divide(2);
    var cxp = sq * rx * y1p / ry;
    var cyp = sq * -ry * x1p / rx;
    //return new Point2D(cxp * c - cyp * s + mid.x, cxp * s + cyp * c + mid.y);

    var xcr1 = (x1p - cxp) / rx;
    var xcr2 = (x1p + cxp) / rx;
    var ycr1 = (y1p - cyp) / ry;
    var ycr2 = (y1p + cyp) / ry;

    var vcr1 = new Vector2D(1, 0);
    var theta1 = radian(1.0, 0.0, xcr1, ycr1);

    var deltaTheta = radian(xcr1, ycr1, -xcr2, -ycr2);
    var PIx2 = Math.PI * 2.0;
    while (deltaTheta > PIx2) deltaTheta -= PIx2;
    while (deltaTheta < 0.0) deltaTheta += PIx2;
    if (sweepFlag == false) deltaTheta -= PIx2;

    return {
        center: new Point2D$1(cxp * c - cyp * s + mid.x, cxp * s + cyp * c + mid.y),
        rx: rx,
        ry: ry,
        theta1: theta1,
        deltaTheta: deltaTheta
    };
}


/**
 *  IntersectionParams
 *
 *  @param {String} name
 *  @param {Array<Point2D} params
 *  @returns {IntersectionParams}
 */
function IntersectionParams$1(name, params) {
    this.init(name, params);
}

/**
 *  init
 *
 *  @param {String} type
 *  @param {Array<Point2D>} params
 */
IntersectionParams$1.prototype.init = function (type, params) {
    this.type = type;
    this.params = params;
    this.meta = {};
};

IntersectionParams$1.TYPE = {};
var IPTYPE$1 = IntersectionParams$1.TYPE;
IPTYPE$1.LINE = 'Line';
IPTYPE$1.RECT = 'Rectangle';
IPTYPE$1.ROUNDRECT = 'RoundRectangle';
IPTYPE$1.CIRCLE = 'Circle';
IPTYPE$1.ELLIPSE = 'Ellipse';
IPTYPE$1.POLYGON = 'Polygon';
IPTYPE$1.POLYLINE = 'Polyline';
IPTYPE$1.PATH = 'Path';
IPTYPE$1.ARC = 'Arc';
IPTYPE$1.BEZIER2 = 'Bezier2';
IPTYPE$1.BEZIER3 = 'Bezier3';


function parsePointsString(points) {
    return points.split(" ").map(function(point) {
        point = point.split(",");
        return new Point2D$1(point[0], point[1]);
    });
}

IntersectionParams$1.newShape = function(svgElementName, props) {
    svgElementName = svgElementName.toLowerCase();

    if(svgElementName === "line") {
        return IntersectionParams$1.newLine(
            new Point2D$1(props.x1, props.y1),
            new Point2D$1(props.x2, props.y2)
        );
    }

    if(svgElementName === "rect") {
        if(props.rx > 0 || props.ry > 0) {
            return IntersectionParams$1.newRoundRect(
                props.x, props.y,
                props.width, props.height,
                props.rx, props.ry
            );
        } else {
            return IntersectionParams$1.newRect(
                props.x, props.y,
                props.width, props.height
            );
        }
    }

    if(svgElementName === "circle") {
        return IntersectionParams$1.newCircle(
            new Point2D$1(props.cx, props.cy),
            props.r
        );
    }

    if(svgElementName === "ellipse") {
        return IntersectionParams$1.newEllipse(
            new Point2D$1(props.cx, props.cy),
            props.rx, props.ry
        );
    }

    if(svgElementName === "polygon") {
        return IntersectionParams$1.newPolygon(
            parsePointsString(props.points)
        );
    }

    if(svgElementName === "polyline") {
        return IntersectionParams$1.newPolyline(
            parsePointsString(props.points)
        );
    }

    if(svgElementName === "path") {
        return IntersectionParams$1.newPath(
            props.d
        );
    }

};


///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for arc.

    @param {Point2D} startPoint - arc start point
    @param {Point2D} endPoint - arc end point
    @param {Number} rx - arc ellipse x radius
    @param {Number} ry - arc ellipse y radius
    @param {Number} angle - arc ellipse rotation in degrees
    @param {Boolean} largeArcFlag
    @param {Boolean} sweepFlag
    @returns {IntersectionParams}
*/
IntersectionParams$1.newArc = function (startPoint, endPoint, rx, ry, angle, largeArcFlag, sweepFlag) {
    var p = getArcParameters(startPoint, endPoint, rx, ry, angle, largeArcFlag, sweepFlag);
    return new IntersectionParams$1(IPTYPE$1.ARC, [p.center, p.rx, p.ry, (angle * Math.PI / 180), p.theta1, p.deltaTheta]);
};

///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for bezier2.

    @param {Point2D} p1
    @param {Point2D} p2
    @param {Point2D} p3
    @returns {IntersectionParams}
*/
IntersectionParams$1.newBezier2 = function (p1, p2, p3) {
    return new IntersectionParams$1(IPTYPE$1.BEZIER2, [p1, p2, p3]);
};

///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for bezier3.

    @param {Point2D} p1
    @param {Point2D} p2
    @param {Point2D} p3
    @param {Point2D} p4
    @returns {IntersectionParams}
*/
IntersectionParams$1.newBezier3 = function (p1, p2, p3, p4) {
    return new IntersectionParams$1(IPTYPE$1.BEZIER3, [p1, p2, p3, p4]);
};

///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for circle.

    @param {Point2D} c
    @param {Number} r
    @returns {IntersectionParams}
*/
IntersectionParams$1.newCircle = function (c, r) {
    return new IntersectionParams$1(IPTYPE$1.CIRCLE, [c, r]);
};

///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for ellipse.

    @param {Point2D} c
    @param {Number} rx
    @param {Number} ry
    @returns {IntersectionParams}
*/
IntersectionParams$1.newEllipse = function (c, rx, ry) {
    return new IntersectionParams$1(IPTYPE$1.ELLIPSE, [c, rx, ry]);
};

///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for line.

    @param {Point2D} a1
    @param {Point2D} a2
    @returns {IntersectionParams}
*/
IntersectionParams$1.newLine = function (a1, a2) {
    return new IntersectionParams$1(IPTYPE$1.LINE, [a1, a2]);
};

///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for polygon.

    @param {Array<Point2D>} points
    @returns {IntersectionParams}
*/
IntersectionParams$1.newPolygon = function (points) {
    return new IntersectionParams$1(IPTYPE$1.POLYGON, [points]);
};

///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for polyline.

     @param {Array<Point2D>} points
    @returns {IntersectionParams}
*/
IntersectionParams$1.newPolyline = function (points) {
    return new IntersectionParams$1(IPTYPE$1.POLYLINE, [points]);
};


///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for rectangle.

    @param {Number} x
    @param {Number} y
    @param {Number} width
    @param {Number} height
    @returns {IntersectionParams}
*/
IntersectionParams$1.newRect = function (x, y, width, height) {
    var points = [];
    points.push(new Point2D$1(x, y));
    points.push(new Point2D$1(x + width, y));
    points.push(new Point2D$1(x + width, y + height));
    points.push(new Point2D$1(x, y + height));
    return new IntersectionParams$1(IPTYPE$1.RECT, [points]);
};

var degreesToRadians = function (angle) {
    return angle * Math.PI / 180;
};
///////////////////////////////////////////////////////////////////
/**
    Creates IntersectionParams for round rectangle, or for rectangle if rx and ry are 0.

    @param {Number} x
    @param {Number} y
    @param {Number} width
    @param {Number} height
    @param {Number} rx
    @param {Number} ry
    @returns {IntersectionParams}
*/
IntersectionParams$1.newRoundRect = function (x, y, width, height, rx, ry) {
    if (rx === 0 && ry === 0)
        return IntersectionParams$1.newRect(x, y, width, height);
    if (rx === 0)
        rx = ry;
    if (ry === 0)
        ry = rx;
    if (rx > width / 2)
        rx = width / 2;
    if (ry > height / 2)
        rx = height / 2;
    var shape = [];
    var x0 = x, x1 = x + rx, x2 = x + width - rx, x3 = x + width;
    var y0 = y, y1 = y + ry, y2 = y + height - ry, y3 = y + height;
    shape.push(new IntersectionParams$1(IPTYPE$1.ARC, [new Point2D$1(x1, y1), rx, ry, 0, degreesToRadians(180), degreesToRadians(90)]));
    shape.push(new IntersectionParams$1(IPTYPE$1.LINE, [new Point2D$1(x1, y0), new Point2D$1(x2, y0)]));
    shape.push(new IntersectionParams$1(IPTYPE$1.ARC, [new Point2D$1(x2, y1), rx, ry, 0, degreesToRadians(-90), degreesToRadians(90)]));
    shape.push(new IntersectionParams$1(IPTYPE$1.LINE, [new Point2D$1(x3, y1), new Point2D$1(x3, y2)]));
    shape.push(new IntersectionParams$1(IPTYPE$1.ARC, [new Point2D$1(x2, y2), rx, ry, 0, degreesToRadians(0), degreesToRadians(90)]));
    shape.push(new IntersectionParams$1(IPTYPE$1.LINE, [new Point2D$1(x2, y3), new Point2D$1(x1, y3)]));
    shape.push(new IntersectionParams$1(IPTYPE$1.ARC, [new Point2D$1(x1, y2), rx, ry, 0, degreesToRadians(90), degreesToRadians(90)]));
    shape.push(new IntersectionParams$1(IPTYPE$1.LINE, [new Point2D$1(x0, y2), new Point2D$1(x0, y1)]));
    shape[shape.length - 1].meta.closePath = true;
    return new IntersectionParams$1(IPTYPE$1.ROUNDRECT, [shape]);
};




function Token(type, text) {
    if (arguments.length > 0) {
        this.init(type, text);
    }
}
Token.prototype.init = function(type, text) {
    this.type = type;
    this.text = text;
};
Token.prototype.typeis = function(type) {
    return this.type == type;
};
var Path = {};
Path.COMMAND = 0;
Path.NUMBER = 1;
Path.EOD = 2;
Path.PARAMS = {
    A: ["rx", "ry", "x-axis-rotation", "large-arc-flag", "sweep-flag", "x", "y"],
    a: ["rx", "ry", "x-axis-rotation", "large-arc-flag", "sweep-flag", "x", "y"],
    C: ["x1", "y1", "x2", "y2", "x", "y"],
    c: ["x1", "y1", "x2", "y2", "x", "y"],
    H: ["x"],
    h: ["x"],
    L: ["x", "y"],
    l: ["x", "y"],
    M: ["x", "y"],
    m: ["x", "y"],
    Q: ["x1", "y1", "x", "y"],
    q: ["x1", "y1", "x", "y"],
    S: ["x2", "y2", "x", "y"],
    s: ["x2", "y2", "x", "y"],
    T: ["x", "y"],
    t: ["x", "y"],
    V: ["y"],
    v: ["y"],
    Z: [],
    z: []
};

function tokenize(d) {
    var tokens = new Array();
    while (d != "") {
        if (d.match(/^([ \t\r\n,]+)/)) {
            d = d.substr(RegExp.$1.length);
        } else if (d.match(/^([aAcChHlLmMqQsStTvVzZ])/)) {
            tokens[tokens.length] = new Token(Path.COMMAND, RegExp.$1);
            d = d.substr(RegExp.$1.length);
        } else if (d.match(/^(([-+]?[0-9]+(\.[0-9]*)?|[-+]?\.[0-9]+)([eE][-+]?[0-9]+)?)/)) {
            tokens[tokens.length] = new Token(Path.NUMBER, parseFloat(RegExp.$1));
            d = d.substr(RegExp.$1.length);
        } else {
            throw new Error("Unrecognized segment command: " + d);
        }
    }
    tokens[tokens.length] = new Token(Path.EOD, null);
    return tokens;
}

IntersectionParams$1.newPath = function(d) {
    var tokens = tokenize(d);
    var index = 0;
    var token = tokens[index];
    var mode = "BOD";
    var segments = [];

    while (!token.typeis(Path.EOD)) {
        var param_length;
        var params = new Array();
        if (mode == "BOD") {
            if (token.text == "M" || token.text == "m") {
                index++;
                param_length = Path.PARAMS[token.text].length;
                mode = token.text;
            } else {
                throw new Error("Path data must begin with a moveto command");
            }
        } else {
            if (token.typeis(Path.NUMBER)) {
                param_length = Path.PARAMS[mode].length;
            } else {
                index++;
                param_length = Path.PARAMS[token.text].length;
                mode = token.text;
            }
        }
        if ((index + param_length) < tokens.length) {
            for (var i = index; i < index + param_length; i++) {
                var number = tokens[i];
                if (number.typeis(Path.NUMBER)) params[params.length] = number.text;
                else throw new Error("Parameter type is not a number: " + mode + "," + number.text);
            }
            var segment;
            var length = segments.length;
            var previous = (length == 0) ? null : segments[length - 1];
            switch (mode) {
                case "A":
                    segment = new AbsoluteArcPath(params, previous);
                    break;
                case "C":
                    segment = new AbsoluteCurveto3(params, previous);
                    break;
                case "c":
                    segment = new RelativeCurveto3(params, previous);
                    break;
                case "H":
                    segment = new AbsoluteHLineto(params, previous);
                    break;
                case "L":
                    segment = new AbsoluteLineto(params, previous);
                    break;
                case "l":
                    segment = new RelativeLineto(params, previous);
                    break;
                case "M":
                    segment = new AbsoluteMoveto(params, previous);
                    break;
                case "m":
                    segment = new RelativeMoveto(params, previous);
                    break;
                case "Q":
                    segment = new AbsoluteCurveto2(params, previous);
                    break;
                case "q":
                    segment = new RelativeCurveto2(params, previous);
                    break;
                case "S":
                    segment = new AbsoluteSmoothCurveto3(params, previous);
                    break;
                case "s":
                    segment = new RelativeSmoothCurveto3(params, previous);
                    break;
                case "T":
                    segment = new AbsoluteSmoothCurveto2(params, previous);
                    break;
                case "t":
                    segment = new RelativeSmoothCurveto2(params, previous);
                    break;
                case "Z":
                    segment = new RelativeClosePath(params, previous);
                    break;
                case "z":
                    segment = new RelativeClosePath(params, previous);
                    break;
                default:
                    throw new Error("Unsupported segment type: " + mode);
            }
            segments.push(segment);
            index += param_length;
            token = tokens[index];
            if (mode == "M") mode = "L";
            if (mode == "m") mode = "l";
        } else {
            throw new Error("Path data ended before all parameters were found");
        }
    }

    var segmentParams = [];
    for(i=0; i<segments.length; i++) {
        var ip = segments[i].getIntersectionParams();
        if(ip) {
            segmentParams.push(ip);
        }
    }

    return new IntersectionParams$1(IPTYPE$1.PATH, [segmentParams]);
};


function AbsolutePathSegment(command, params, previous) {
    if (arguments.length > 0) this.init(command, params, previous);
}
AbsolutePathSegment.prototype.init = function(command, params, previous) {
    this.command = command;
    this.previous = previous;
    this.points = [];
    var index = 0;
    while (index < params.length) {
        this.points.push(new Point2D$1(params[index], params[index + 1]));
        index += 2;
    }
};
AbsolutePathSegment.prototype.getLastPoint = function() {
    return this.points[this.points.length - 1];
};
AbsolutePathSegment.prototype.getIntersectionParams = function() {
    return null;
};



function AbsoluteArcPath(params, previous) {
    if (arguments.length > 0) {
        this.init("A", params, previous);
    }
}
AbsoluteArcPath.prototype = new AbsolutePathSegment();
AbsoluteArcPath.prototype.constructor = AbsoluteCurveto2;
AbsoluteArcPath.superclass = AbsolutePathSegment.prototype;

AbsoluteArcPath.prototype.init = function(command, params, previous) {
    var point = new Array();
    var y = params.pop();
    var x = params.pop();
    point.push(x, y);
    AbsoluteArcPath.superclass.init.call(this, command, point, previous);
    this.rx = parseFloat(params.shift());
    this.ry = parseFloat(params.shift());
    this.angle = parseFloat(params.shift());
    this.arcFlag = parseFloat(params.shift());
    this.sweepFlag = parseFloat(params.shift());
};
AbsoluteArcPath.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Ellipse", [this.getCenter(), this.rx, this.ry]);
};
AbsoluteArcPath.prototype.getCenter = function() {
    var startPoint = this.previous.getLastPoint();
    var endPoint = this.points[0];
    var rx = this.rx;
    var ry = this.ry;
    var angle = this.angle * Math.PI / 180;
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    var TOLERANCE = 1e-6;
    var halfDiff = startPoint.subtract(endPoint).divide(2);
    var x1p = halfDiff.x * c + halfDiff.y * s;
    var y1p = halfDiff.x * -s + halfDiff.y * c;
    var x1px1p = x1p * x1p;
    var y1py1p = y1p * y1p;
    var lambda = (x1px1p / (rx * rx)) + (y1py1p / (ry * ry));
    if (lambda > 1) {
        var factor = Math.sqrt(lambda);
        rx *= factor;
        ry *= factor;
    }
    var rxrx = rx * rx;
    var ryry = ry * ry;
    var rxy1 = rxrx * y1py1p;
    var ryx1 = ryry * x1px1p;
    var factor = (rxrx * ryry - rxy1 - ryx1) / (rxy1 + ryx1);
    if (Math.abs(factor) < TOLERANCE) factor = 0;
    var sq = Math.sqrt(factor);
    if (this.arcFlag == this.sweepFlag) sq = -sq;
    var mid = startPoint.add(endPoint).divide(2);
    var cxp = sq * rx * y1p / ry;
    var cyp = sq * -ry * x1p / rx;
    return new Point2D$1(cxp * c - cyp * s + mid.x, cxp * s + cyp * c + mid.y);
};



function AbsoluteCurveto2(params, previous) {
    if (arguments.length > 0) {
        this.init("Q", params, previous);
    }
}
AbsoluteCurveto2.prototype = new AbsolutePathSegment();
AbsoluteCurveto2.prototype.constructor = AbsoluteCurveto2;
AbsoluteCurveto2.superclass = AbsolutePathSegment.prototype;

AbsoluteCurveto2.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Bezier2", [this.previous.getLastPoint(), this.points[0], this.points[1]]);
};



function AbsoluteCurveto3(params, previous) {
    if (arguments.length > 0) {
        this.init("C", params, previous);
    }
}
AbsoluteCurveto3.prototype = new AbsolutePathSegment();
AbsoluteCurveto3.prototype.constructor = AbsoluteCurveto3;
AbsoluteCurveto3.superclass = AbsolutePathSegment.prototype;

AbsoluteCurveto3.prototype.getLastControlPoint = function() {
    return this.points[1];
};
AbsoluteCurveto3.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Bezier3", [this.previous.getLastPoint(), this.points[0], this.points[1], this.points[2]]);
};


function AbsoluteHLineto(params, previous) {
    if (arguments.length > 0) {
        this.init("H", params, previous);
    }
}
AbsoluteHLineto.prototype = new AbsolutePathSegment();
AbsoluteHLineto.prototype.constructor = AbsoluteHLineto;
AbsoluteHLineto.superclass = AbsolutePathSegment.prototype;

AbsoluteHLineto.prototype.init = function(command, params, previous) {
    var prevPoint = previous.getLastPoint();
    var point = new Array();
    point.push(params.pop(), prevPoint.y);
    AbsoluteHLineto.superclass.init.call(this, command, point, previous);
};


function AbsoluteLineto(params, previous) {
    if (arguments.length > 0) {
        this.init("L", params, previous);
    }
}
AbsoluteLineto.prototype = new AbsolutePathSegment();
AbsoluteLineto.prototype.constructor = AbsoluteLineto;
AbsoluteLineto.superclass = AbsolutePathSegment.prototype;

AbsoluteLineto.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Line", [this.previous.getLastPoint(), this.points[0]]);
};



function AbsoluteMoveto(params, previous) {
    if (arguments.length > 0) {
        this.init("M", params, previous);
    }
}
AbsoluteMoveto.prototype = new AbsolutePathSegment();
AbsoluteMoveto.prototype.constructor = AbsoluteMoveto;
AbsoluteMoveto.superclass = AbsolutePathSegment.prototype;


function AbsoluteSmoothCurveto2(params, previous) {
    if (arguments.length > 0) {
        this.init("T", params, previous);
    }
}
AbsoluteSmoothCurveto2.prototype = new AbsolutePathSegment();
AbsoluteSmoothCurveto2.prototype.constructor = AbsoluteSmoothCurveto2;
AbsoluteSmoothCurveto2.superclass = AbsolutePathSegment.prototype;

AbsoluteSmoothCurveto2.prototype.getControlPoint = function() {
    var lastPoint = this.previous.getLastPoint();
    var point;
    if (this.previous.command.match(/^[QqTt]$/)) {
        var ctrlPoint = this.previous.getControlPoint();
        var diff = ctrlPoint.subtract(lastPoint);
        point = lastPoint.subtract(diff);
    } else {
        point = lastPoint;
    }
    return point;
};
AbsoluteSmoothCurveto2.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Bezier2", [this.previous.getLastPoint(), this.getControlPoint(), this.points[0]]);
};


function AbsoluteSmoothCurveto3(params, previous) {
    if (arguments.length > 0) {
        this.init("S", params, previous);
    }
}
AbsoluteSmoothCurveto3.prototype = new AbsolutePathSegment();
AbsoluteSmoothCurveto3.prototype.constructor = AbsoluteSmoothCurveto3;
AbsoluteSmoothCurveto3.superclass = AbsolutePathSegment.prototype;

AbsoluteSmoothCurveto3.prototype.getFirstControlPoint = function() {
    var lastPoint = this.previous.getLastPoint();
    var point;
    if (this.previous.command.match(/^[SsCc]$/)) {
        var lastControl = this.previous.getLastControlPoint();
        var diff = lastControl.subtract(lastPoint);
        point = lastPoint.subtract(diff);
    } else {
        point = lastPoint;
    }
    return point;
};
AbsoluteSmoothCurveto3.prototype.getLastControlPoint = function() {
    return this.points[0];
};
AbsoluteSmoothCurveto3.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Bezier3", [this.previous.getLastPoint(), this.getFirstControlPoint(), this.points[0], this.points[1]]);
};


function RelativePathSegment(command, params, previous) {
    if (arguments.length > 0) this.init(command, params, previous);
}
RelativePathSegment.prototype = new AbsolutePathSegment();
RelativePathSegment.prototype.constructor = RelativePathSegment;
RelativePathSegment.superclass = AbsolutePathSegment.prototype;

RelativePathSegment.prototype.init = function(command, params, previous) {
    this.command = command;
    this.previous = previous;
    this.points = [];
    var lastPoint;
    if (this.previous) lastPoint = this.previous.getLastPoint();
    else lastPoint = new Point2D$1(0, 0);
    var index = 0;
    while (index < params.length) {
        var point = new Point2D$1(lastPoint.x + params[index], lastPoint.y + params[index + 1]);
        this.points.push(point);
        index += 2;
    }
};

function RelativeClosePath(params, previous) {
    if (arguments.length > 0) {
        this.init("z", params, previous);
    }
}
RelativeClosePath.prototype = new RelativePathSegment();
RelativeClosePath.prototype.constructor = RelativeClosePath;
RelativeClosePath.superclass = RelativePathSegment.prototype;
RelativeClosePath.prototype.getLastPoint = function() {
    var current = this.previous;
    var point;
    while (current) {
        if (current.command.match(/^[mMzZ]$/)) {
            point = current.getLastPoint();
            break;
        }
        current = current.previous;
    }
    return point;
};
RelativeClosePath.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Line", [this.previous.getLastPoint(), this.getLastPoint()]);
};


function RelativeCurveto2(params, previous) {
    if (arguments.length > 0) {
        this.init("q", params, previous);
    }
}
RelativeCurveto2.prototype = new RelativePathSegment();
RelativeCurveto2.prototype.constructor = RelativeCurveto2;
RelativeCurveto2.superclass = RelativePathSegment.prototype;

RelativeCurveto2.prototype.getControlPoint = function() {
    return this.points[0];
};
RelativeCurveto2.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Bezier2", [this.previous.getLastPoint(), this.points[0], this.points[1]]);
};


function RelativeCurveto3(params, previous) {
    if (arguments.length > 0) {
        this.init("c", params, previous);
    }
}
RelativeCurveto3.prototype = new RelativePathSegment();
RelativeCurveto3.prototype.constructor = RelativeCurveto3;
RelativeCurveto3.superclass = RelativePathSegment.prototype;

RelativeCurveto3.prototype.getLastControlPoint = function() {
    return this.points[1];
};
RelativeCurveto3.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Bezier3", [this.previous.getLastPoint(), this.points[0], this.points[1], this.points[2]]);
};


function RelativeLineto(params, previous) {
    if (arguments.length > 0) {
        this.init("l", params, previous);
    }
}
RelativeLineto.prototype = new RelativePathSegment();
RelativeLineto.prototype.constructor = RelativeLineto;
RelativeLineto.superclass = RelativePathSegment.prototype;

RelativeLineto.prototype.toString = function() {
    var points = new Array();
    var command = "";
    var lastPoint;
    var point;
    if (this.previous) lastPoint = this.previous.getLastPoint();
    else lastPoint = new Point(0, 0);
    point = this.points[0].subtract(lastPoint);
    if (this.previous.constructor != this.constuctor)
        if (this.previous.constructor != RelativeMoveto) cmd = this.command;
    return cmd + point.toString();
};
RelativeLineto.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Line", [this.previous.getLastPoint(), this.points[0]]);
};



function RelativeMoveto(params, previous) {
    if (arguments.length > 0) {
        this.init("m", params, previous);
    }
}
RelativeMoveto.prototype = new RelativePathSegment();
RelativeMoveto.prototype.constructor = RelativeMoveto;
RelativeMoveto.superclass = RelativePathSegment.prototype;



function RelativeSmoothCurveto2(params, previous) {
    if (arguments.length > 0) {
        this.init("t", params, previous);
    }
}
RelativeSmoothCurveto2.prototype = new RelativePathSegment();
RelativeSmoothCurveto2.prototype.constructor = RelativeSmoothCurveto2;
RelativeSmoothCurveto2.superclass = RelativePathSegment.prototype;

RelativeSmoothCurveto2.prototype.getControlPoint = function() {
    var lastPoint = this.previous.getLastPoint();
    var point;
    if (this.previous.command.match(/^[QqTt]$/)) {
        var ctrlPoint = this.previous.getControlPoint();
        var diff = ctrlPoint.subtract(lastPoint);
        point = lastPoint.subtract(diff);
    } else {
        point = lastPoint;
    }
    return point;
};
RelativeSmoothCurveto2.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Bezier2", [this.previous.getLastPoint(), this.getControlPoint(), this.points[0]]);
};



function RelativeSmoothCurveto3(params, previous) {
    if (arguments.length > 0) {
        this.init("s", params, previous);
    }
}
RelativeSmoothCurveto3.prototype = new RelativePathSegment();
RelativeSmoothCurveto3.prototype.constructor = RelativeSmoothCurveto3;
RelativeSmoothCurveto3.superclass = RelativePathSegment.prototype;

RelativeSmoothCurveto3.prototype.getFirstControlPoint = function() {
    var lastPoint = this.previous.getLastPoint();
    var point;
    if (this.previous.command.match(/^[SsCc]$/)) {
        var lastControl = this.previous.getLastControlPoint();
        var diff = lastControl.subtract(lastPoint);
        point = lastPoint.subtract(diff);
    } else {
        point = lastPoint;
    }
    return point;
};
RelativeSmoothCurveto3.prototype.getLastControlPoint = function() {
    return this.points[0];
};
RelativeSmoothCurveto3.prototype.getIntersectionParams = function() {
    return new IntersectionParams$1("Bezier3", [this.previous.getLastPoint(), this.getFirstControlPoint(), this.points[0], this.points[1]]);
};


var IntersectionParams_1 = IntersectionParams$1;

/**
 *  Intersection
 */
function Intersection$1(status) {
    this.init(status);
}

/**
 *  init
 *
 *  @param {String} status
 *  @returns {Intersection}
 */
Intersection$1.prototype.init = function(status) {
    this.status = status;
    this.points = [];
};

/**
 *  appendPoint
 *
 *  @param {Point2D} point
 */
Intersection$1.prototype.appendPoint = function(point) {
    this.points.push(point);
};

/**
 *  appendPoints
 *
 *  @param {Array<Point2D>} points
 */
Intersection$1.prototype.appendPoints = function(points) {
    this.points = this.points.concat(points);
};

var Intersection_1 = Intersection$1;

/**
 *
 *  Intersection.js
 *
 *  copyright 2002, 2013 Kevin Lindsey
 *
 *  contribution {@link http://github.com/Quazistax/kld-intersections}
 *      @copyright 2015 Robert Benko (Quazistax) <quazistax@gmail.com>
 *      @license MIT
 */
 
var Point2D = kldAffine.Point2D;
var Vector2D$1 = kldAffine.Vector2D;
var Matrix2D = kldAffine.Matrix2D;
var Polynomial = kldPolynomial.Polynomial;
var IntersectionParams = IntersectionParams_1;
var Intersection = Intersection_1;

var IPTYPE = IntersectionParams.TYPE;



/**
 *  bezout
 *
 *  This code is based on MgcIntr2DElpElp.cpp written by David Eberly.  His
 *  code along with many other excellent examples are avaiable at his site:
 *  http://www.geometrictools.com
 *
 *  @param {Array<Point2D>} e1
 *  @param {Array<Point2D>} e2
 *  @returns {Polynomial}
 */
function bezout(e1, e2) {
    var AB    = e1[0]*e2[1] - e2[0]*e1[1];
    var AC    = e1[0]*e2[2] - e2[0]*e1[2];
    var AD    = e1[0]*e2[3] - e2[0]*e1[3];
    var AE    = e1[0]*e2[4] - e2[0]*e1[4];
    var AF    = e1[0]*e2[5] - e2[0]*e1[5];
    var BC    = e1[1]*e2[2] - e2[1]*e1[2];
    var BE    = e1[1]*e2[4] - e2[1]*e1[4];
    var BF    = e1[1]*e2[5] - e2[1]*e1[5];
    var CD    = e1[2]*e2[3] - e2[2]*e1[3];
    var DE    = e1[3]*e2[4] - e2[3]*e1[4];
    var DF    = e1[3]*e2[5] - e2[3]*e1[5];
    var BFpDE = BF + DE;
    var BEmCD = BE - CD;

    return new Polynomial(
        AB*BC - AC*AC,
        AB*BEmCD + AD*BC - 2*AC*AE,
        AB*BFpDE + AD*BEmCD - AE*AE - 2*AC*AF,
        AB*DF + AD*BFpDE - 2*AE*AF,
        AD*DF - AF*AF
    );
}

/**
    Removes from intersection points those points that are not between two rays determined by arc parameters.
    Rays begin at ellipse center and go through arc startPoint/endPoint.

    @param {Intersection} intersection - will be modified and returned
    @param {Point2D} c - center of arc ellipse
    @param {Number} rx
    @param {Number} ry
    @param {Number} phi - in radians
    @param {Number} th1 - in radians
    @param {Number} dth - in radians
    @param {Matrix2D} [m] - arc transformation matrix
    @returns {Intersection}
*/
function removePointsNotInArc(intersection, c, rx, ry, phi, th1, dth, m) {
    if (intersection.points.length === 0) return intersection;
    if (m && !m.isIdentity())
        var mp = m.inverse();
    var np = [];
    var vx = new Vector2D$1(1, 0);
    var pi2 = Math.PI * 2;
    var wasNeg = dth < 0;
    var wasBig = Math.abs(dth) > Math.PI;
    var m1 = new Matrix2D().scaleNonUniform(1, ry / rx).rotate(th1);
    var m2 = new Matrix2D().scaleNonUniform(1, ry / rx).rotate(th1 + dth);

    th1 = (vx.angleBetween(vx.transform(m1)) + pi2) % pi2;
    dth = vx.transform(m1).angleBetween(vx.transform(m2));
    dth = (wasBig ? pi2 - Math.abs(dth) : Math.abs(dth)) * (wasNeg ? -1 : 1);
    var m3 = new Matrix2D().rotate(phi).multiply(m1);

    for (var i = 0, p, a; i < intersection.points.length; i++) {
        p = intersection.points[i];
        a = vx.transform(m3).angleBetween(Vector2D$1.fromPoints(c, (mp) ? p.transform(mp) : p));
        if (dth >= 0) {
            a = (a + 2 * pi2) % pi2;
            if (a <= dth)
                np.push(p);
        } else {
            a = (a - 2 * pi2) % pi2;
            if (a >= dth)
                np.push(p);
        }
    }
    intersection.points = np;
    return intersection;
}

/**
    points1 will be modified, points close (almost identical) to any point in points2 will be removed

    @param {Array<Point2D>} points1 - will be modified, points close to any point in points2 will be removed
    @param {Array<Point2D>} points2
*/
function removeClosePoints(points1, points2) {
    if (points1.length === 0 || points2.length === 0)
        return;
    var maxf = function (p, v) { if (p < v.x) p = v.x; if (p < v.y) p = v.y; return p; };
    var max = points1.reduce(maxf, 0);
    max = points2.reduce(maxf, max);
    var ERRF = 1e-15;
    var ZEROepsilon = 100 * max * ERRF * Math.SQRT2;
    var j;
    for (var i = 0; i < points1.length;) {
        for (j = 0; j < points2.length; j++) {
            if (points1[i].distanceFrom(points2[j]) <= ZEROepsilon) {
                points1.splice(i, 1);
                break;
            }
        }
        if (j == points2.length)
            i++;
    }
}

// The basic intersection functions for all SVG shapes expect bezier curves
// If you need to support bezier curves, plug in the functions/bezier module
// like this: intersect.plugin( require('svg-intersections/lib/functions/bezier') )
var intersectionFunctions = {
            
    /**
        intersectPathShape

        @param {IntersectionParams} path
        @param {IntersectionParams} shape
        @param {Matrix2D} [m1]
        @param {Matrix2D} [m2]
        @returns {Intersection}
    */
    intersectPathShape: function (path, shape, m1, m2) {
        var result = new Intersection();
        var pathParams = path.params[0];
        var inter0;
        var previnter;
        for (var inter, i = 0; i < pathParams.length; i++) {
            inter = intersect$1(pathParams[i], shape, m1, m2);
            if (!inter0)
                inter0 = inter;
            if (previnter) {
                removeClosePoints(previnter.points, inter.points);
                result.appendPoints(previnter.points);
            }
            previnter = inter;
        }
        if (previnter) {
            result.appendPoints(previnter.points);
        }
        return result;
    },


    /**
        intersectLinesShape

        @param {IntersectionParams} lines - IntersectionParams with points as first parameter (like types RECT, POLYLINE or POLYGON)
        @param {IntersectionParams} shape - IntersectionParams of other shape
        @param {Matrix2D} [m1]
        @param {Matrix2D} [m2]
        @param {Boolean} [closed] - if set, determines if line between first and last point will be taken into callculation too. If not set, it's true for RECT and POLYGON, false for other <b>lines</b> types.
        @returns {Intersection}
    */
    intersectLinesShape: function (lines, shape, m1, m2, closed) {
        var IPTYPE = IntersectionParams.TYPE;
        var line_points = lines.params[0];
        var ip = new IntersectionParams(IPTYPE.LINE, [0, 0]);
        var result = new Intersection();
        var inter, i;
        var intersectLine = function (i1, i2) {
            ip.params[0] = line_points[i1];
            ip.params[1] = line_points[i2];
            inter = intersect$1(ip, shape, m1, m2);
            removeClosePoints(inter.points, [line_points[i2]]);
            result.appendPoints(inter.points);
        };
        for (i = 0; i < line_points.length - 1; i++) {
            intersectLine(i, i + 1);
        }
        if (typeof closed !== 'undefined' && closed || lines.type === IPTYPE.RECT || lines.type === IPTYPE.POLYGON) {
            intersectLine(line_points.length - 1, 0);
        }
        return result;
    },

    ///////////////////////////////////////////////////////////////////
    /**
        intersectArcShape

        @param {IntersectionParams} arc
        @param {IntersectionParams} shape
        @param {Matrix2D} [m1]
        @param {Matrix2D} [m2]
        @returns {Intersection}
    */
    intersectArcShape: function (arc, shape, m1, m2) {
        m1 = m1 || Matrix2D.IDENTITY;
        m2 = m2 || Matrix2D.IDENTITY;
        var c1 = arc.params[0],
            rx1 = arc.params[1],
            ry1 = arc.params[2],
            phi1 = arc.params[3],
            th1 = arc.params[4],
            dth1 = arc.params[5];

        var res;
        if (m1.isIdentity() && phi1 === 0) {
            res = intersect$1(IntersectionParams.newEllipse(c1, rx1, ry1), shape, m1, m2);
        }
        else {
            m1 = m1.multiply(Matrix2D.IDENTITY.translate(c1.x, c1.y).rotate(phi1));
            c1 = new Point2D(0, 0);
            phi1 = 0;
            res = intersect$1(IntersectionParams.newEllipse(c1, rx1, ry1), shape, m1, m2);
        }
        res = removePointsNotInArc(res, c1, rx1, ry1, phi1, th1, dth1, m1);
        return res;
    },

    /**
     *  Finds intersection points of two ellipses. <br/>
     *
     *  This code is based on MgcIntr2DElpElp.cpp written by David Eberly. His
     *  code along with many other excellent examples are avaiable at his site:
     *  http://www.geometrictools.com
     *
     *  Changes - 2015 Robert Benko (Quazistax)
     *
     *  @param {Point2D} c1
     *  @param {Number} rx1
     *  @param {Number} ry1
     *  @param {Point2D} c2
     *  @param {Number} rx2
     *  @param {Number} ry2
     *  @returns {Intersection}
     */
    intersectEllipseEllipse: function (c1, rx1, ry1, c2, rx2, ry2) {
        var a = [
            ry1 * ry1, 0, rx1 * rx1, -2 * ry1 * ry1 * c1.x, -2 * rx1 * rx1 * c1.y,
            ry1 * ry1 * c1.x * c1.x + rx1 * rx1 * c1.y * c1.y - rx1 * rx1 * ry1 * ry1
        ];
        var b = [
            ry2 * ry2, 0, rx2 * rx2, -2 * ry2 * ry2 * c2.x, -2 * rx2 * rx2 * c2.y,
            ry2 * ry2 * c2.x * c2.x + rx2 * rx2 * c2.y * c2.y - rx2 * rx2 * ry2 * ry2
        ];

        var yPoly = bezout(a, b);
        var yRoots = yPoly.getRoots();
        var epsilon = 1e-3;
        var norm0 = (a[0] * a[0] + 2 * a[1] * a[1] + a[2] * a[2]) * epsilon;
        var norm1 = (b[0] * b[0] + 2 * b[1] * b[1] + b[2] * b[2]) * epsilon;
        var result = new Intersection();

        var i;
        //Handling root calculation error causing not detecting intersection
        var clip = function (val, min, max) { return Math.max(min, Math.min(max, val)); };
        for (i = 0 ; i < yRoots.length; i++) {
            yRoots[i] = clip(yRoots[i], c1.y - ry1, c1.y + ry1);
            yRoots[i] = clip(yRoots[i], c2.y - ry2, c2.y + ry2);
        }

        //For detection of multiplicated intersection points
        yRoots.sort(function (a, b) { return a - b; });
        var rootPointsN = [];

        for (var y = 0; y < yRoots.length; y++) {
            var xPoly = new Polynomial(
                a[0],
                a[3] + yRoots[y] * a[1],
                a[5] + yRoots[y] * (a[4] + yRoots[y] * a[2])
            );
            var ERRF = 1e-15;
            if (Math.abs(xPoly.coefs[0]) < 10 * ERRF * Math.abs(xPoly.coefs[2]))
                xPoly.coefs[0] = 0;
            var xRoots = xPoly.getRoots();

            rootPointsN.push(0);
            for (var x = 0; x < xRoots.length; x++) {
                var test =
                    (a[0] * xRoots[x] + a[1] * yRoots[y] + a[3]) * xRoots[x] +
                    (a[2] * yRoots[y] + a[4]) * yRoots[y] + a[5];
                if (Math.abs(test) < norm0) {
                    test =
                        (b[0] * xRoots[x] + b[1] * yRoots[y] + b[3]) * xRoots[x] +
                        (b[2] * yRoots[y] + b[4]) * yRoots[y] + b[5];
                    if (Math.abs(test) < norm1) {
                        result.appendPoint(new Point2D(xRoots[x], yRoots[y]));
                        rootPointsN[y] += 1;
                    }
                }
            }
        }

        if (result.points.length <= 0)
            return result;

        //Removal of multiplicated intersection points
        var pts = result.points;
        if (pts.length == 8) {
            pts = pts.splice(0, 6);
            pts.splice(2, 2);
        }
        else if (pts.length == 7) {
            pts = pts.splice(0, 6);
            pts.splice(2, 2);
            pts.splice(rootPointsN.indexOf(1), 1);
        }
        else if (pts.length == 6) {
            pts.splice(2, 2);
            //console.log('ElEl 6pts: N: ' + rootPointsN.toString());
            if (rootPointsN.indexOf(0) > -1) {
                if (pts[0].distanceFrom(pts[1]) < pts[2].distanceFrom(pts[3])) {
                    pts.splice(0, 1);
                }
                else {
                    pts.splice(2, 1);
                }
            }
            else if (rootPointsN[0] == rootPointsN[3]) {
                pts.splice(1, 2);
            }
        }
        else if (pts.length == 4) {
            if (
                (yRoots.length == 2)
            || (yRoots.length == 4 && (rootPointsN[0] == 2 && rootPointsN[1] == 2 || rootPointsN[2] == 2 && rootPointsN[3] == 2))
            ) {
                pts.splice(2, 2);
            }
        }
        else if (pts.length == 3 || pts.length == 5) {
            i = rootPointsN.indexOf(2);
            if (i > -1) {
                if (pts.length == 3)
                    i = i % 2;
                var ii = i + (i % 2 ? -1 : 2);
                var d1, d2, d3;
                d1 = pts[i].distanceFrom(pts[i + 1]);
                d2 = pts[i].distanceFrom(pts[ii]);
                d3 = pts[i + 1].distanceFrom(pts[ii]);
                if (d1 < d2 && d1 < d3) {
                    pts.splice(i, 1);
                }
                else {
                    pts.splice(ii, 1);
                }
            }
        }

        var poly = yPoly;
        var ZEROepsilon = yPoly.zeroErrorEstimate();
        ZEROepsilon *= 100 * Math.SQRT2;
        for (i = 0; i < pts.length - 1;) {
            if (pts[i].distanceFrom(pts[i + 1]) < ZEROepsilon) {
                pts.splice(i + 1, 1);
                continue;
            }
            i++;
        }

        result.points = pts;
        return result;
    },


    /**
     *  intersectEllipseLine
     *
     *  NOTE: Rotation will need to be added to this function
     *
     *  @param {Point2D} c
     *  @param {Number} rx
     *  @param {Number} ry
     *  @param {Point2D} a1
     *  @param {Point2D} a2
     *  @returns {Intersection}
     */
    intersectEllipseLine: function(c, rx, ry, a1, a2) {
        var result;
        var origin = new Vector2D$1(a1.x, a1.y);
        var dir    = Vector2D$1.fromPoints(a1, a2);
        var center = new Vector2D$1(c.x, c.y);
        var diff   = origin.subtract(center);
        var mDir   = new Vector2D$1( dir.x/(rx*rx),  dir.y/(ry*ry)  );
        var mDiff  = new Vector2D$1( diff.x/(rx*rx), diff.y/(ry*ry) );

        var a = dir.dot(mDir);
        var b = dir.dot(mDiff);
        var c = diff.dot(mDiff) - 1.0;
        var d = b*b - a*c;

        var ERRF = 1e-15;
        var ZEROepsilon = 10 * Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) * ERRF;
        if (Math.abs(d) < ZEROepsilon) {
            d = 0;
        }

        if ( d < 0 ) {
            result = new Intersection("Outside");
        } else if ( d > 0 ) {
            var root = Math.sqrt(d);
            var t_a  = (-b - root) / a;
            var t_b  = (-b + root) / a;

            t_b = (t_b > 1) ? t_b - ERRF : (t_b < 0) ? t_b + ERRF : t_b;
            t_a = (t_a > 1) ? t_a - ERRF : (t_a < 0) ? t_a + ERRF : t_a;

            if ( (t_a < 0 || 1 < t_a) && (t_b < 0 || 1 < t_b) ) {
                if ( (t_a < 0 && t_b < 0) || (t_a > 1 && t_b > 1) )
                    result = new Intersection("Outside");
                else
                    result = new Intersection("Inside");
            } else {
                result = new Intersection();
                if ( 0 <= t_a && t_a <= 1 )
                    result.appendPoint( a1.lerp(a2, t_a) );
                if ( 0 <= t_b && t_b <= 1 )
                    result.appendPoint( a1.lerp(a2, t_b) );
            }
        } else {
            var t = -b/a;
            if ( 0 <= t && t <= 1 ) {
                result = new Intersection();
                result.appendPoint( a1.lerp(a2, t) );
            } else {
                result = new Intersection("Outside");
            }
        }

        return result;
    },


    /**
     *  intersectLineLine
     *
     *  @param {Point2D} a1
     *  @param {Point2D} a2
     *  @param {Point2D} b1
     *  @param {Point2D} b2
     *  @returns {Intersection}
     */
    intersectLineLine: function(a1, a2, b1, b2) {
        var result;
        var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
        var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
        var u_b  = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

        if ( u_b !== 0 ) {
            var ua = ua_t / u_b;
            var ub = ub_t / u_b;

            if ( 0 <= ua && ua <= 1 && 0 <= ub && ub <= 1 ) {
                result = new Intersection();
                result.points.push(
                    new Point2D(
                        a1.x + ua * (a2.x - a1.x),
                        a1.y + ua * (a2.y - a1.y)
                    )
                );
            } else {
                result = new Intersection();
            }
        } else {
            if ( ua_t === 0 || ub_t === 0 ) {
                result = new Intersection("Coincident");
            } else {
                result = new Intersection("Parallel");
            }
        }

        return result;
    },


    /**
     *  intersectRayRay
     *
     *  @param {Point2D} a1
     *  @param {Point2D} a2
     *  @param {Point2D} b1
     *  @param {Point2D} b2
     *  @returns {Intersection}
     */
    intersectRayRay: function(a1, a2, b1, b2) {
        var result;

        var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
        var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
        var u_b  = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

        if ( u_b !== 0 ) {
            var ua = ua_t / u_b;

            result = new Intersection();
            result.points.push(
                new Point2D(
                    a1.x + ua * (a2.x - a1.x),
                    a1.y + ua * (a2.y - a1.y)
                )
            );
        } else {
            if ( ua_t === 0 || ub_t === 0 ) {
                result = new Intersection("Coincident");
            } else {
                result = new Intersection("Parallel");
            }
        }

        return result;
    }
};

var composedShapeMethods = {};
composedShapeMethods[IPTYPE.PATH] = intersectionFunctions.intersectPathShape;
composedShapeMethods[IPTYPE.POLYLINE] = intersectionFunctions.intersectLinesShape;
composedShapeMethods[IPTYPE.POLYGON] = intersectionFunctions.intersectLinesShape;
composedShapeMethods[IPTYPE.RECT] = intersectionFunctions.intersectLinesShape;
composedShapeMethods[IPTYPE.ROUNDRECT] = intersectionFunctions.intersectPathShape;
composedShapeMethods[IPTYPE.ARC] = intersectionFunctions.intersectArcShape;



function intersect$1(shape1, shape2, m1, m2) {
    var ip1 = shape1;
    var ip2 = shape2;
    var result;

    if (ip1 !== null && ip2 !== null) {
        var method;
        if (method = composedShapeMethods[ip1.type]) {
            result = method(ip1, ip2, m1, m2);
        }
        else if (method = composedShapeMethods[ip2.type]) {
            result = method(ip2, ip1, m2, m1);
        }
        else {
            var params;

            var params1, params2, type1, type2;

            if (ip1.type === IPTYPE.CIRCLE) {
                params1 = [ip1.params[0], ip1.params[1], ip1.params[1]];
                type1 = IPTYPE.ELLIPSE;
            }
            else {
                params1 = ip1.params.slice();
                type1 = ip1.type;
            }

            if (ip2.type === IPTYPE.CIRCLE) {
                params2 = [ip2.params[0], ip2.params[1], ip2.params[1]];
                type2 = IPTYPE.ELLIPSE;
            }
            else {
                params2 = ip2.params.slice();
                type2 = ip2.type;
            }

            //var m1 = new Matrix2D(), m2 = new Matrix2D();
            var SMF = 1;
            var itm;
            var useCTM = (m1 instanceof Matrix2D && m2 instanceof Matrix2D);// && (!m1.isIdentity() || !m2.isIdentity()));
            if (useCTM) {
                if (type1 === IPTYPE.ELLIPSE && type2 === IPTYPE.ELLIPSE) {
                    var m1_, m2_;
                    var d2;
                    var c1 = params1[0], rx1 = params1[1], ry1 = params1[2];
                    var c2 = params2[0], rx2 = params2[1], ry2 = params2[2];

                    m1 = m1.multiply(Matrix2D.IDENTITY.translate(c1.x, c1.y).scaleNonUniform(rx1 / SMF, ry1 / SMF));
                    c1 = new Point2D(0, 0);
                    rx1 = ry1 = SMF;

                    m2 = m2.multiply(Matrix2D.IDENTITY.translate(c2.x, c2.y).scaleNonUniform(rx2, ry2));
                    c2 = new Point2D(0, 0);
                    rx2 = ry2 = 1;

                    d2 = m1.inverse().multiply(m2).getDecompositionTRSR();
                    m1_ = d2.R.inverse().multiply(d2.T.inverse());
                    m2_ = d2.S;

                    rx2 = m2_.a;
                    ry2 = m2_.d;
                    c1 = c1.transform(m1_);
                    itm = m1.multiply(m1_.inverse());

                    params1[0] = c1;
                    params1[1] = rx1;
                    params1[2] = ry1;
                    params2[0] = c2;
                    params2[1] = rx2;
                    params2[2] = ry2;
                }
                else {
                    var transParams = function (type, params, m) {
                        var transParam = function (i) {
                            params[i] = params[i].transform(m);
                        };

                        if (type === IPTYPE.LINE) {
                            transParam(0);
                            transParam(1);
                        }
                        else if (type === IPTYPE.BEZIER2) {
                            transParam(0);
                            transParam(1);
                            transParam(2);
                        }
                        else if (type === IPTYPE.BEZIER3) {
                            transParam(0);
                            transParam(1);
                            transParam(2);
                            transParam(3);
                        }
                        else {
                            throw new Error('Unknown shape: ' + type);
                        }
                    };

                    if (type2 === IPTYPE.ELLIPSE) {
                        var tmp;
                        tmp = params2; params2 = params1; params1 = tmp;
                        tmp = type2; type2 = type1; type1 = tmp;
                        tmp = m2; m2 = m1; m1 = tmp;
                    }

                    if (type1 === IPTYPE.ELLIPSE) {
                        var c1 = params1[0], rx1 = params1[1], ry1 = params1[2];

                        m1 = m1.multiply(Matrix2D.IDENTITY.translate(c1.x, c1.y).scaleNonUniform(rx1 / SMF, ry1 / SMF));
                        c1 = new Point2D(0, 0);
                        rx1 = ry1 = SMF;

                        m2_ = m1.inverse().multiply(m2);
                        transParams(type2, params2, m2_);

                        itm = m1;

                        params1[0] = c1;
                        params1[1] = rx1;
                        params1[2] = ry1;
                    }
                    else {
                        transParams(type1, params1, m1);
                        transParams(type2, params2, m2);
                        itm = Matrix2D.IDENTITY;
                    }
                }
            }

            if (type1 < type2) {
                method = "intersect" + type1 + type2;
                params = params1.concat(params2);
            } else {
                method = "intersect" + type2 + type1;
                params = params2.concat(params1);
            }

            result = intersectionFunctions[method].apply(null, params);

            if (useCTM) {
                for (var i = 0; i < result.points.length; i++) {
                    result.points[i] = result.points[i].transform(itm);
                }
            }
        }
    } else {
        result = new Intersection();
    }

    return result;
}

intersect$1.plugin = function() {
    for(var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        for(var key in arg) {
            if(arg.hasOwnProperty(key)) {
                intersectionFunctions[key] = arg[key];
            }
        }
    }
};

var intersect_1 = intersect$1;

// expose module classes

var intersect = intersect_1;
var shape = IntersectionParams_1.newShape;

var index = {
	intersect: intersect,
	shape: shape
};

exports['default'] = index;
exports.intersect = intersect;
exports.shape = shape;

}((this.svgIntersections = this.svgIntersections || {}),GLOBAL.kldAffine,GLOBAL.kldPolynomial));

  (function (exports,kldAffine,kldPolynomial) {
'use strict';

kldAffine = 'default' in kldAffine ? kldAffine['default'] : kldAffine;
kldPolynomial = 'default' in kldPolynomial ? kldPolynomial['default'] : kldPolynomial;

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

/**
 *  Intersection
 */
function Intersection(status) {
    this.init(status);
}

/**
 *  init
 *
 *  @param {String} status
 *  @returns {Intersection}
 */
Intersection.prototype.init = function(status) {
    this.status = status;
    this.points = [];
};

/**
 *  appendPoint
 *
 *  @param {Point2D} point
 */
Intersection.prototype.appendPoint = function(point) {
    this.points.push(point);
};

/**
 *  appendPoints
 *
 *  @param {Array<Point2D>} points
 */
Intersection.prototype.appendPoints = function(points) {
    this.points = this.points.concat(points);
};

var Intersection_1 = Intersection;

var bezier = createCommonjsModule(function (module) {
var Intersection = Intersection_1;

var affine = kldAffine;
var Point2D = affine.Point2D;
var Vector2D = affine.Vector2D;

var Polynomial = kldPolynomial.Polynomial;

function removeMultipleRootsIn01(roots) {
    var ZEROepsilon = 1e-15;
    roots.sort(function (a, b) { return a - b; });
    for (var i = 1; i < roots.length;) {
        if (Math.abs(roots[i] - roots[i - 1]) < ZEROepsilon) {
            roots.splice(i, 1);
        }
        else {
            i++;
        }
    }
}

module.exports = {};


/**
 *  intersectBezier2Bezier2
 *
 *  @param {Point2D} a1
 *  @param {Point2D} a2
 *  @param {Point2D} a3
 *  @param {Point2D} b1
 *  @param {Point2D} b2
 *  @param {Point2D} b3
 *  @returns {Intersection}
 */
module.exports.intersectBezier2Bezier2 = function(a1, a2, a3, b1, b2, b3) {
    var a, b;
    var c12, c11, c10;
    var c22, c21, c20;
    var result = new Intersection();
    var poly;

    a = a2.multiply(-2);
    c12 = a1.add(a.add(a3));

    a = a1.multiply(-2);
    b = a2.multiply(2);
    c11 = a.add(b);

    c10 = new Point2D(a1.x, a1.y);

    a = b2.multiply(-2);
    c22 = b1.add(a.add(b3));

    a = b1.multiply(-2);
    b = b2.multiply(2);
    c21 = a.add(b);

    c20 = new Point2D(b1.x, b1.y);

    var v0, v1, v2, v3, v4, v5, v6;
    if ( c12.y === 0 ) {
        v0 = c12.x*(c10.y - c20.y);
        v1 = v0 - c11.x*c11.y;
        v2 = v0 + v1;
        v3 = c11.y*c11.y;

        poly = new Polynomial(
            c12.x*c22.y*c22.y,
            2*c12.x*c21.y*c22.y,
            c12.x*c21.y*c21.y - c22.x*v3 - c22.y*v0 - c22.y*v1,
            -c21.x*v3 - c21.y*v0 - c21.y*v1,
            (c10.x - c20.x)*v3 + (c10.y - c20.y)*v1
        );
    } else {
        v0 = c12.x*c22.y - c12.y*c22.x;
        v1 = c12.x*c21.y - c21.x*c12.y;
        v2 = c11.x*c12.y - c11.y*c12.x;
        v3 = c10.y - c20.y;
        v4 = c12.y*(c10.x - c20.x) - c12.x*v3;
        v5 = -c11.y*v2 + c12.y*v4;
        v6 = v2*v2;

        poly = new Polynomial(
            v0*v0,
            2*v0*v1,
            (-c22.y*v6 + c12.y*v1*v1 + c12.y*v0*v4 + v0*v5) / c12.y,
            (-c21.y*v6 + c12.y*v1*v4 + v1*v5) / c12.y,
            (v3*v6 + v4*v5) / c12.y
        );
    }

    var roots = poly.getRoots();
    for ( var i = 0; i < roots.length; i++ ) {
        var s = roots[i];

        if ( 0 <= s && s <= 1 ) {
            var xRoots = new Polynomial(
                c12.x,
                c11.x,
                c10.x - c20.x - s*c21.x - s*s*c22.x
            ).getRoots();
            var yRoots = new Polynomial(
                c12.y,
                c11.y,
                c10.y - c20.y - s*c21.y - s*s*c22.y
            ).getRoots();

            if ( xRoots.length > 0 && yRoots.length > 0 ) {
                var TOLERANCE = 1e-4;

                checkRoots:
                    for ( var j = 0; j < xRoots.length; j++ ) {
                        var xRoot = xRoots[j];

                        if ( 0 <= xRoot && xRoot <= 1 ) {
                            for ( var k = 0; k < yRoots.length; k++ ) {
                                if ( Math.abs( xRoot - yRoots[k] ) < TOLERANCE ) {
                                    result.points.push( c22.multiply(s*s).add(c21.multiply(s).add(c20)) );
                                    break checkRoots;
                                }
                            }
                        }
                    }
            }
        }
    }

    return result;
};


/**
 *  intersectBezier2Bezier3
 *
 *  @param {Point2D} a1
 *  @param {Point2D} a2
 *  @param {Point2D} a3
 *  @param {Point2D} b1
 *  @param {Point2D} b2
 *  @param {Point2D} b3
 *  @param {Point2D} b4
 *  @returns {Intersection}
 */
module.exports.intersectBezier2Bezier3 = function(a1, a2, a3, b1, b2, b3, b4) {
    var a, b,c, d;
    var c12, c11, c10;
    var c23, c22, c21, c20;
    var result = new Intersection();

    a = a2.multiply(-2);
    c12 = a1.add(a.add(a3));

    a = a1.multiply(-2);
    b = a2.multiply(2);
    c11 = a.add(b);

    c10 = new Point2D(a1.x, a1.y);

    a = b1.multiply(-1);
    b = b2.multiply(3);
    c = b3.multiply(-3);
    d = a.add(b.add(c.add(b4)));
    c23 = new Vector2D(d.x, d.y);

    a = b1.multiply(3);
    b = b2.multiply(-6);
    c = b3.multiply(3);
    d = a.add(b.add(c));
    c22 = new Vector2D(d.x, d.y);

    a = b1.multiply(-3);
    b = b2.multiply(3);
    c = a.add(b);
    c21 = new Vector2D(c.x, c.y);

    c20 = new Vector2D(b1.x, b1.y);

    var c10x2 = c10.x*c10.x;
    var c10y2 = c10.y*c10.y;
    var c11x2 = c11.x*c11.x;
    var c11y2 = c11.y*c11.y;
    var c12x2 = c12.x*c12.x;
    var c12y2 = c12.y*c12.y;
    var c20x2 = c20.x*c20.x;
    var c20y2 = c20.y*c20.y;
    var c21x2 = c21.x*c21.x;
    var c21y2 = c21.y*c21.y;
    var c22x2 = c22.x*c22.x;
    var c22y2 = c22.y*c22.y;
    var c23x2 = c23.x*c23.x;
    var c23y2 = c23.y*c23.y;

    var poly = new Polynomial(
        -2*c12.x*c12.y*c23.x*c23.y + c12x2*c23y2 + c12y2*c23x2,
        -2*c12.x*c12.y*c22.x*c23.y - 2*c12.x*c12.y*c22.y*c23.x + 2*c12y2*c22.x*c23.x +
            2*c12x2*c22.y*c23.y,
        -2*c12.x*c21.x*c12.y*c23.y - 2*c12.x*c12.y*c21.y*c23.x - 2*c12.x*c12.y*c22.x*c22.y +
            2*c21.x*c12y2*c23.x + c12y2*c22x2 + c12x2*(2*c21.y*c23.y + c22y2),
        2*c10.x*c12.x*c12.y*c23.y + 2*c10.y*c12.x*c12.y*c23.x + c11.x*c11.y*c12.x*c23.y +
            c11.x*c11.y*c12.y*c23.x - 2*c20.x*c12.x*c12.y*c23.y - 2*c12.x*c20.y*c12.y*c23.x -
            2*c12.x*c21.x*c12.y*c22.y - 2*c12.x*c12.y*c21.y*c22.x - 2*c10.x*c12y2*c23.x -
            2*c10.y*c12x2*c23.y + 2*c20.x*c12y2*c23.x + 2*c21.x*c12y2*c22.x -
            c11y2*c12.x*c23.x - c11x2*c12.y*c23.y + c12x2*(2*c20.y*c23.y + 2*c21.y*c22.y),
        2*c10.x*c12.x*c12.y*c22.y + 2*c10.y*c12.x*c12.y*c22.x + c11.x*c11.y*c12.x*c22.y +
            c11.x*c11.y*c12.y*c22.x - 2*c20.x*c12.x*c12.y*c22.y - 2*c12.x*c20.y*c12.y*c22.x -
            2*c12.x*c21.x*c12.y*c21.y - 2*c10.x*c12y2*c22.x - 2*c10.y*c12x2*c22.y +
            2*c20.x*c12y2*c22.x - c11y2*c12.x*c22.x - c11x2*c12.y*c22.y + c21x2*c12y2 +
            c12x2*(2*c20.y*c22.y + c21y2),
        2*c10.x*c12.x*c12.y*c21.y + 2*c10.y*c12.x*c21.x*c12.y + c11.x*c11.y*c12.x*c21.y +
            c11.x*c11.y*c21.x*c12.y - 2*c20.x*c12.x*c12.y*c21.y - 2*c12.x*c20.y*c21.x*c12.y -
            2*c10.x*c21.x*c12y2 - 2*c10.y*c12x2*c21.y + 2*c20.x*c21.x*c12y2 -
            c11y2*c12.x*c21.x - c11x2*c12.y*c21.y + 2*c12x2*c20.y*c21.y,
        -2*c10.x*c10.y*c12.x*c12.y - c10.x*c11.x*c11.y*c12.y - c10.y*c11.x*c11.y*c12.x +
            2*c10.x*c12.x*c20.y*c12.y + 2*c10.y*c20.x*c12.x*c12.y + c11.x*c20.x*c11.y*c12.y +
            c11.x*c11.y*c12.x*c20.y - 2*c20.x*c12.x*c20.y*c12.y - 2*c10.x*c20.x*c12y2 +
            c10.x*c11y2*c12.x + c10.y*c11x2*c12.y - 2*c10.y*c12x2*c20.y -
            c20.x*c11y2*c12.x - c11x2*c20.y*c12.y + c10x2*c12y2 + c10y2*c12x2 +
            c20x2*c12y2 + c12x2*c20y2
    );
    var roots = poly.getRootsInInterval(0,1);
    module.exports.Utils.removeMultipleRootsIn01(roots);

    for ( var i = 0; i < roots.length; i++ ) {
        var s = roots[i];
        var xRoots = new Polynomial(
            c12.x,
            c11.x,
            c10.x - c20.x - s*c21.x - s*s*c22.x - s*s*s*c23.x
        ).getRoots();
        var yRoots = new Polynomial(
            c12.y,
            c11.y,
            c10.y - c20.y - s*c21.y - s*s*c22.y - s*s*s*c23.y
        ).getRoots();

        if ( xRoots.length > 0 && yRoots.length > 0 ) {
            var TOLERANCE = 1e-4;

            checkRoots:
                for ( var j = 0; j < xRoots.length; j++ ) {
                    var xRoot = xRoots[j];

                    if ( 0 <= xRoot && xRoot <= 1 ) {
                        for ( var k = 0; k < yRoots.length; k++ ) {
                            if ( Math.abs( xRoot - yRoots[k] ) < TOLERANCE ) {
                                var v = c23.multiply(s * s * s).add(c22.multiply(s * s).add(c21.multiply(s).add(c20)));
                                result.points.push(new Point2D(v.x, v.y));
                                break checkRoots;
                            }
                        }
                    }
                }
        }
    }

    return result;

};

/**
 *  intersectBezier2Ellipse
 *
 *  @param {Point2D} p1
 *  @param {Point2D} p2
 *  @param {Point2D} p3
 *  @param {Point2D} ec
 *  @param {Number} rx
 *  @param {Number} ry
 *  @returns {Intersection}
 */
module.exports.intersectBezier2Ellipse = function(p1, p2, p3, ec, rx, ry) {
    var a, b;       // temporary variables
    var c2, c1, c0; // coefficients of quadratic
    var result = new Intersection();

    a = p2.multiply(-2);
    c2 = p1.add(a.add(p3));

    a = p1.multiply(-2);
    b = p2.multiply(2);
    c1 = a.add(b);

    c0 = new Point2D(p1.x, p1.y);

    var rxrx  = rx*rx;
    var ryry  = ry*ry;
    var roots = new Polynomial(
        ryry*c2.x*c2.x + rxrx*c2.y*c2.y,
        2*(ryry*c2.x*c1.x + rxrx*c2.y*c1.y),
        ryry*(2*c2.x*c0.x + c1.x*c1.x) + rxrx*(2*c2.y*c0.y+c1.y*c1.y) -
            2*(ryry*ec.x*c2.x + rxrx*ec.y*c2.y),
        2*(ryry*c1.x*(c0.x-ec.x) + rxrx*c1.y*(c0.y-ec.y)),
        ryry*(c0.x*c0.x+ec.x*ec.x) + rxrx*(c0.y*c0.y + ec.y*ec.y) -
            2*(ryry*ec.x*c0.x + rxrx*ec.y*c0.y) - rxrx*ryry
    ).getRoots();

    for ( var i = 0; i < roots.length; i++ ) {
        var t = roots[i];

        if ( 0 <= t && t <= 1 )
            result.points.push( c2.multiply(t*t).add(c1.multiply(t).add(c0)) );
    }

    return result;
};


/**
 *  intersectBezier2Line
 *
 *  @param {Point2D} p1
 *  @param {Point2D} p2
 *  @param {Point2D} p3
 *  @param {Point2D} a1
 *  @param {Point2D} a2
 *  @returns {Intersection}
 */
module.exports.intersectBezier2Line = function(p1, p2, p3, a1, a2) {
    var a, b;             // temporary variables
    var c2, c1, c0;       // coefficients of quadratic
    var cl;               // c coefficient for normal form of line
    var n;                // normal for normal form of line
    var min = a1.min(a2); // used to determine if point is on line segment
    var max = a1.max(a2); // used to determine if point is on line segment
    var result = new Intersection();

    a = p2.multiply(-2);
    c2 = p1.add(a.add(p3));

    a = p1.multiply(-2);
    b = p2.multiply(2);
    c1 = a.add(b);

    c0 = new Point2D(p1.x, p1.y);

    // Convert line to normal form: ax + by + c = 0
    // Find normal to line: negative inverse of original line's slope
    n = new Vector2D(a1.y - a2.y, a2.x - a1.x);

    // Determine new c coefficient
    cl = a1.x*a2.y - a2.x*a1.y;

    // Transform cubic coefficients to line's coordinate system and find roots
    // of cubic
    roots = new Polynomial(
        n.dot(c2),
        n.dot(c1),
        n.dot(c0) + cl
    ).getRoots();

    // Any roots in closed interval [0,1] are intersections on Bezier, but
    // might not be on the line segment.
    // Find intersections and calculate point coordinates
    for ( var i = 0; i < roots.length; i++ ) {
        var t = roots[i];

        if ( 0 <= t && t <= 1 ) {
            // We're within the Bezier curve
            // Find point on Bezier
            var p4 = p1.lerp(p2, t);
            var p5 = p2.lerp(p3, t);

            var p6 = p4.lerp(p5, t);

            // See if point is on line segment
            // Had to make special cases for vertical and horizontal lines due
            // to slight errors in calculation of p6
            if ( a1.x == a2.x ) {
                if ( min.y <= p6.y && p6.y <= max.y ) {
                    result.appendPoint( p6 );
                }
            } else if ( a1.y == a2.y ) {
                if ( min.x <= p6.x && p6.x <= max.x ) {
                    result.appendPoint( p6 );
                }
            } else if (min.x <= p6.x && p6.x <= max.x && min.y <= p6.y && p6.y <= max.y) {
                result.appendPoint( p6 );
            }
        }
    }

    return result;
};


/**
 *  intersectBezier3Bezier3
 *
 *  @param {Point2D} a1
 *  @param {Point2D} a2
 *  @param {Point2D} a3
 *  @param {Point2D} a4
 *  @param {Point2D} b1
 *  @param {Point2D} b2
 *  @param {Point2D} b3
 *  @param {Point2D} b4
 *  @returns {Intersection}
 */
module.exports.intersectBezier3Bezier3 = function(a1, a2, a3, a4, b1, b2, b3, b4) {
    var a, b, c, d;         // temporary variables
    var c13, c12, c11, c10; // coefficients of cubic
    var c23, c22, c21, c20; // coefficients of cubic
    var result = new Intersection();

    // Calculate the coefficients of cubic polynomial
    a = a1.multiply(-1);
    b = a2.multiply(3);
    c = a3.multiply(-3);
    d = a.add(b.add(c.add(a4)));
    c13 = new Vector2D(d.x, d.y);

    a = a1.multiply(3);
    b = a2.multiply(-6);
    c = a3.multiply(3);
    d = a.add(b.add(c));
    c12 = new Vector2D(d.x, d.y);

    a = a1.multiply(-3);
    b = a2.multiply(3);
    c = a.add(b);
    c11 = new Vector2D(c.x, c.y);

    c10 = new Vector2D(a1.x, a1.y);

    a = b1.multiply(-1);
    b = b2.multiply(3);
    c = b3.multiply(-3);
    d = a.add(b.add(c.add(b4)));
    c23 = new Vector2D(d.x, d.y);

    a = b1.multiply(3);
    b = b2.multiply(-6);
    c = b3.multiply(3);
    d = a.add(b.add(c));
    c22 = new Vector2D(d.x, d.y);

    a = b1.multiply(-3);
    b = b2.multiply(3);
    c = a.add(b);
    c21 = new Vector2D(c.x, c.y);

    c20 = new Vector2D(b1.x, b1.y);

    var c10x2 = c10.x*c10.x;
    var c10x3 = c10.x*c10.x*c10.x;
    var c10y2 = c10.y*c10.y;
    var c10y3 = c10.y*c10.y*c10.y;
    var c11x2 = c11.x*c11.x;
    var c11x3 = c11.x*c11.x*c11.x;
    var c11y2 = c11.y*c11.y;
    var c11y3 = c11.y*c11.y*c11.y;
    var c12x2 = c12.x*c12.x;
    var c12x3 = c12.x*c12.x*c12.x;
    var c12y2 = c12.y*c12.y;
    var c12y3 = c12.y*c12.y*c12.y;
    var c13x2 = c13.x*c13.x;
    var c13x3 = c13.x*c13.x*c13.x;
    var c13y2 = c13.y*c13.y;
    var c13y3 = c13.y*c13.y*c13.y;
    var c20x2 = c20.x*c20.x;
    var c20x3 = c20.x*c20.x*c20.x;
    var c20y2 = c20.y*c20.y;
    var c20y3 = c20.y*c20.y*c20.y;
    var c21x2 = c21.x*c21.x;
    var c21x3 = c21.x*c21.x*c21.x;
    var c21y2 = c21.y*c21.y;
    var c22x2 = c22.x*c22.x;
    var c22x3 = c22.x*c22.x*c22.x;
    var c22y2 = c22.y*c22.y;
    var c23x2 = c23.x*c23.x;
    var c23x3 = c23.x*c23.x*c23.x;
    var c23y2 = c23.y*c23.y;
    var c23y3 = c23.y*c23.y*c23.y;
    var poly = new Polynomial(
        -c13x3*c23y3 + c13y3*c23x3 - 3*c13.x*c13y2*c23x2*c23.y +
            3*c13x2*c13.y*c23.x*c23y2,
        -6*c13.x*c22.x*c13y2*c23.x*c23.y + 6*c13x2*c13.y*c22.y*c23.x*c23.y + 3*c22.x*c13y3*c23x2 -
            3*c13x3*c22.y*c23y2 - 3*c13.x*c13y2*c22.y*c23x2 + 3*c13x2*c22.x*c13.y*c23y2,
        -6*c21.x*c13.x*c13y2*c23.x*c23.y - 6*c13.x*c22.x*c13y2*c22.y*c23.x + 6*c13x2*c22.x*c13.y*c22.y*c23.y +
            3*c21.x*c13y3*c23x2 + 3*c22x2*c13y3*c23.x + 3*c21.x*c13x2*c13.y*c23y2 - 3*c13.x*c21.y*c13y2*c23x2 -
            3*c13.x*c22x2*c13y2*c23.y + c13x2*c13.y*c23.x*(6*c21.y*c23.y + 3*c22y2) + c13x3*(-c21.y*c23y2 -
            2*c22y2*c23.y - c23.y*(2*c21.y*c23.y + c22y2)),
        c11.x*c12.y*c13.x*c13.y*c23.x*c23.y - c11.y*c12.x*c13.x*c13.y*c23.x*c23.y + 6*c21.x*c22.x*c13y3*c23.x +
            3*c11.x*c12.x*c13.x*c13.y*c23y2 + 6*c10.x*c13.x*c13y2*c23.x*c23.y - 3*c11.x*c12.x*c13y2*c23.x*c23.y -
            3*c11.y*c12.y*c13.x*c13.y*c23x2 - 6*c10.y*c13x2*c13.y*c23.x*c23.y - 6*c20.x*c13.x*c13y2*c23.x*c23.y +
            3*c11.y*c12.y*c13x2*c23.x*c23.y - 2*c12.x*c12y2*c13.x*c23.x*c23.y - 6*c21.x*c13.x*c22.x*c13y2*c23.y -
            6*c21.x*c13.x*c13y2*c22.y*c23.x - 6*c13.x*c21.y*c22.x*c13y2*c23.x + 6*c21.x*c13x2*c13.y*c22.y*c23.y +
            2*c12x2*c12.y*c13.y*c23.x*c23.y + c22x3*c13y3 - 3*c10.x*c13y3*c23x2 + 3*c10.y*c13x3*c23y2 +
            3*c20.x*c13y3*c23x2 + c12y3*c13.x*c23x2 - c12x3*c13.y*c23y2 - 3*c10.x*c13x2*c13.y*c23y2 +
            3*c10.y*c13.x*c13y2*c23x2 - 2*c11.x*c12.y*c13x2*c23y2 + c11.x*c12.y*c13y2*c23x2 - c11.y*c12.x*c13x2*c23y2 +
            2*c11.y*c12.x*c13y2*c23x2 + 3*c20.x*c13x2*c13.y*c23y2 - c12.x*c12y2*c13.y*c23x2 -
            3*c20.y*c13.x*c13y2*c23x2 + c12x2*c12.y*c13.x*c23y2 - 3*c13.x*c22x2*c13y2*c22.y +
            c13x2*c13.y*c23.x*(6*c20.y*c23.y + 6*c21.y*c22.y) + c13x2*c22.x*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c13x3*(-2*c21.y*c22.y*c23.y - c20.y*c23y2 - c22.y*(2*c21.y*c23.y + c22y2) - c23.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        6*c11.x*c12.x*c13.x*c13.y*c22.y*c23.y + c11.x*c12.y*c13.x*c22.x*c13.y*c23.y + c11.x*c12.y*c13.x*c13.y*c22.y*c23.x -
            c11.y*c12.x*c13.x*c22.x*c13.y*c23.y - c11.y*c12.x*c13.x*c13.y*c22.y*c23.x - 6*c11.y*c12.y*c13.x*c22.x*c13.y*c23.x -
            6*c10.x*c22.x*c13y3*c23.x + 6*c20.x*c22.x*c13y3*c23.x + 6*c10.y*c13x3*c22.y*c23.y + 2*c12y3*c13.x*c22.x*c23.x -
            2*c12x3*c13.y*c22.y*c23.y + 6*c10.x*c13.x*c22.x*c13y2*c23.y + 6*c10.x*c13.x*c13y2*c22.y*c23.x +
            6*c10.y*c13.x*c22.x*c13y2*c23.x - 3*c11.x*c12.x*c22.x*c13y2*c23.y - 3*c11.x*c12.x*c13y2*c22.y*c23.x +
            2*c11.x*c12.y*c22.x*c13y2*c23.x + 4*c11.y*c12.x*c22.x*c13y2*c23.x - 6*c10.x*c13x2*c13.y*c22.y*c23.y -
            6*c10.y*c13x2*c22.x*c13.y*c23.y - 6*c10.y*c13x2*c13.y*c22.y*c23.x - 4*c11.x*c12.y*c13x2*c22.y*c23.y -
            6*c20.x*c13.x*c22.x*c13y2*c23.y - 6*c20.x*c13.x*c13y2*c22.y*c23.x - 2*c11.y*c12.x*c13x2*c22.y*c23.y +
            3*c11.y*c12.y*c13x2*c22.x*c23.y + 3*c11.y*c12.y*c13x2*c22.y*c23.x - 2*c12.x*c12y2*c13.x*c22.x*c23.y -
            2*c12.x*c12y2*c13.x*c22.y*c23.x - 2*c12.x*c12y2*c22.x*c13.y*c23.x - 6*c20.y*c13.x*c22.x*c13y2*c23.x -
            6*c21.x*c13.x*c21.y*c13y2*c23.x - 6*c21.x*c13.x*c22.x*c13y2*c22.y + 6*c20.x*c13x2*c13.y*c22.y*c23.y +
            2*c12x2*c12.y*c13.x*c22.y*c23.y + 2*c12x2*c12.y*c22.x*c13.y*c23.y + 2*c12x2*c12.y*c13.y*c22.y*c23.x +
            3*c21.x*c22x2*c13y3 + 3*c21x2*c13y3*c23.x - 3*c13.x*c21.y*c22x2*c13y2 - 3*c21x2*c13.x*c13y2*c23.y +
            c13x2*c22.x*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c13x2*c13.y*c23.x*(6*c20.y*c22.y + 3*c21y2) +
            c21.x*c13x2*c13.y*(6*c21.y*c23.y + 3*c22y2) + c13x3*(-2*c20.y*c22.y*c23.y - c23.y*(2*c20.y*c22.y + c21y2) -
            c21.y*(2*c21.y*c23.y + c22y2) - c22.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        c11.x*c21.x*c12.y*c13.x*c13.y*c23.y + c11.x*c12.y*c13.x*c21.y*c13.y*c23.x + c11.x*c12.y*c13.x*c22.x*c13.y*c22.y -
            c11.y*c12.x*c21.x*c13.x*c13.y*c23.y - c11.y*c12.x*c13.x*c21.y*c13.y*c23.x - c11.y*c12.x*c13.x*c22.x*c13.y*c22.y -
            6*c11.y*c21.x*c12.y*c13.x*c13.y*c23.x - 6*c10.x*c21.x*c13y3*c23.x + 6*c20.x*c21.x*c13y3*c23.x +
            2*c21.x*c12y3*c13.x*c23.x + 6*c10.x*c21.x*c13.x*c13y2*c23.y + 6*c10.x*c13.x*c21.y*c13y2*c23.x +
            6*c10.x*c13.x*c22.x*c13y2*c22.y + 6*c10.y*c21.x*c13.x*c13y2*c23.x - 3*c11.x*c12.x*c21.x*c13y2*c23.y -
            3*c11.x*c12.x*c21.y*c13y2*c23.x - 3*c11.x*c12.x*c22.x*c13y2*c22.y + 2*c11.x*c21.x*c12.y*c13y2*c23.x +
            4*c11.y*c12.x*c21.x*c13y2*c23.x - 6*c10.y*c21.x*c13x2*c13.y*c23.y - 6*c10.y*c13x2*c21.y*c13.y*c23.x -
            6*c10.y*c13x2*c22.x*c13.y*c22.y - 6*c20.x*c21.x*c13.x*c13y2*c23.y - 6*c20.x*c13.x*c21.y*c13y2*c23.x -
            6*c20.x*c13.x*c22.x*c13y2*c22.y + 3*c11.y*c21.x*c12.y*c13x2*c23.y - 3*c11.y*c12.y*c13.x*c22x2*c13.y +
            3*c11.y*c12.y*c13x2*c21.y*c23.x + 3*c11.y*c12.y*c13x2*c22.x*c22.y - 2*c12.x*c21.x*c12y2*c13.x*c23.y -
            2*c12.x*c21.x*c12y2*c13.y*c23.x - 2*c12.x*c12y2*c13.x*c21.y*c23.x - 2*c12.x*c12y2*c13.x*c22.x*c22.y -
            6*c20.y*c21.x*c13.x*c13y2*c23.x - 6*c21.x*c13.x*c21.y*c22.x*c13y2 + 6*c20.y*c13x2*c21.y*c13.y*c23.x +
            2*c12x2*c21.x*c12.y*c13.y*c23.y + 2*c12x2*c12.y*c21.y*c13.y*c23.x + 2*c12x2*c12.y*c22.x*c13.y*c22.y -
            3*c10.x*c22x2*c13y3 + 3*c20.x*c22x2*c13y3 + 3*c21x2*c22.x*c13y3 + c12y3*c13.x*c22x2 +
            3*c10.y*c13.x*c22x2*c13y2 + c11.x*c12.y*c22x2*c13y2 + 2*c11.y*c12.x*c22x2*c13y2 -
            c12.x*c12y2*c22x2*c13.y - 3*c20.y*c13.x*c22x2*c13y2 - 3*c21x2*c13.x*c13y2*c22.y +
            c12x2*c12.y*c13.x*(2*c21.y*c23.y + c22y2) + c11.x*c12.x*c13.x*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c21.x*c13x2*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c12x3*c13.y*(-2*c21.y*c23.y - c22y2) +
            c10.y*c13x3*(6*c21.y*c23.y + 3*c22y2) + c11.y*c12.x*c13x2*(-2*c21.y*c23.y - c22y2) +
            c11.x*c12.y*c13x2*(-4*c21.y*c23.y - 2*c22y2) + c10.x*c13x2*c13.y*(-6*c21.y*c23.y - 3*c22y2) +
            c13x2*c22.x*c13.y*(6*c20.y*c22.y + 3*c21y2) + c20.x*c13x2*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c13x3*(-2*c20.y*c21.y*c23.y - c22.y*(2*c20.y*c22.y + c21y2) - c20.y*(2*c21.y*c23.y + c22y2) -
            c21.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        -c10.x*c11.x*c12.y*c13.x*c13.y*c23.y + c10.x*c11.y*c12.x*c13.x*c13.y*c23.y + 6*c10.x*c11.y*c12.y*c13.x*c13.y*c23.x -
            6*c10.y*c11.x*c12.x*c13.x*c13.y*c23.y - c10.y*c11.x*c12.y*c13.x*c13.y*c23.x + c10.y*c11.y*c12.x*c13.x*c13.y*c23.x +
            c11.x*c11.y*c12.x*c12.y*c13.x*c23.y - c11.x*c11.y*c12.x*c12.y*c13.y*c23.x + c11.x*c20.x*c12.y*c13.x*c13.y*c23.y +
            c11.x*c20.y*c12.y*c13.x*c13.y*c23.x + c11.x*c21.x*c12.y*c13.x*c13.y*c22.y + c11.x*c12.y*c13.x*c21.y*c22.x*c13.y -
            c20.x*c11.y*c12.x*c13.x*c13.y*c23.y - 6*c20.x*c11.y*c12.y*c13.x*c13.y*c23.x - c11.y*c12.x*c20.y*c13.x*c13.y*c23.x -
            c11.y*c12.x*c21.x*c13.x*c13.y*c22.y - c11.y*c12.x*c13.x*c21.y*c22.x*c13.y - 6*c11.y*c21.x*c12.y*c13.x*c22.x*c13.y -
            6*c10.x*c20.x*c13y3*c23.x - 6*c10.x*c21.x*c22.x*c13y3 - 2*c10.x*c12y3*c13.x*c23.x + 6*c20.x*c21.x*c22.x*c13y3 +
            2*c20.x*c12y3*c13.x*c23.x + 2*c21.x*c12y3*c13.x*c22.x + 2*c10.y*c12x3*c13.y*c23.y - 6*c10.x*c10.y*c13.x*c13y2*c23.x +
            3*c10.x*c11.x*c12.x*c13y2*c23.y - 2*c10.x*c11.x*c12.y*c13y2*c23.x - 4*c10.x*c11.y*c12.x*c13y2*c23.x +
            3*c10.y*c11.x*c12.x*c13y2*c23.x + 6*c10.x*c10.y*c13x2*c13.y*c23.y + 6*c10.x*c20.x*c13.x*c13y2*c23.y -
            3*c10.x*c11.y*c12.y*c13x2*c23.y + 2*c10.x*c12.x*c12y2*c13.x*c23.y + 2*c10.x*c12.x*c12y2*c13.y*c23.x +
            6*c10.x*c20.y*c13.x*c13y2*c23.x + 6*c10.x*c21.x*c13.x*c13y2*c22.y + 6*c10.x*c13.x*c21.y*c22.x*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c23.y + 6*c10.y*c20.x*c13.x*c13y2*c23.x + 2*c10.y*c11.y*c12.x*c13x2*c23.y -
            3*c10.y*c11.y*c12.y*c13x2*c23.x + 2*c10.y*c12.x*c12y2*c13.x*c23.x + 6*c10.y*c21.x*c13.x*c22.x*c13y2 -
            3*c11.x*c20.x*c12.x*c13y2*c23.y + 2*c11.x*c20.x*c12.y*c13y2*c23.x + c11.x*c11.y*c12y2*c13.x*c23.x -
            3*c11.x*c12.x*c20.y*c13y2*c23.x - 3*c11.x*c12.x*c21.x*c13y2*c22.y - 3*c11.x*c12.x*c21.y*c22.x*c13y2 +
            2*c11.x*c21.x*c12.y*c22.x*c13y2 + 4*c20.x*c11.y*c12.x*c13y2*c23.x + 4*c11.y*c12.x*c21.x*c22.x*c13y2 -
            2*c10.x*c12x2*c12.y*c13.y*c23.y - 6*c10.y*c20.x*c13x2*c13.y*c23.y - 6*c10.y*c20.y*c13x2*c13.y*c23.x -
            6*c10.y*c21.x*c13x2*c13.y*c22.y - 2*c10.y*c12x2*c12.y*c13.x*c23.y - 2*c10.y*c12x2*c12.y*c13.y*c23.x -
            6*c10.y*c13x2*c21.y*c22.x*c13.y - c11.x*c11.y*c12x2*c13.y*c23.y - 2*c11.x*c11y2*c13.x*c13.y*c23.x +
            3*c20.x*c11.y*c12.y*c13x2*c23.y - 2*c20.x*c12.x*c12y2*c13.x*c23.y - 2*c20.x*c12.x*c12y2*c13.y*c23.x -
            6*c20.x*c20.y*c13.x*c13y2*c23.x - 6*c20.x*c21.x*c13.x*c13y2*c22.y - 6*c20.x*c13.x*c21.y*c22.x*c13y2 +
            3*c11.y*c20.y*c12.y*c13x2*c23.x + 3*c11.y*c21.x*c12.y*c13x2*c22.y + 3*c11.y*c12.y*c13x2*c21.y*c22.x -
            2*c12.x*c20.y*c12y2*c13.x*c23.x - 2*c12.x*c21.x*c12y2*c13.x*c22.y - 2*c12.x*c21.x*c12y2*c22.x*c13.y -
            2*c12.x*c12y2*c13.x*c21.y*c22.x - 6*c20.y*c21.x*c13.x*c22.x*c13y2 - c11y2*c12.x*c12.y*c13.x*c23.x +
            2*c20.x*c12x2*c12.y*c13.y*c23.y + 6*c20.y*c13x2*c21.y*c22.x*c13.y + 2*c11x2*c11.y*c13.x*c13.y*c23.y +
            c11x2*c12.x*c12.y*c13.y*c23.y + 2*c12x2*c20.y*c12.y*c13.y*c23.x + 2*c12x2*c21.x*c12.y*c13.y*c22.y +
            2*c12x2*c12.y*c21.y*c22.x*c13.y + c21x3*c13y3 + 3*c10x2*c13y3*c23.x - 3*c10y2*c13x3*c23.y +
            3*c20x2*c13y3*c23.x + c11y3*c13x2*c23.x - c11x3*c13y2*c23.y - c11.x*c11y2*c13x2*c23.y +
            c11x2*c11.y*c13y2*c23.x - 3*c10x2*c13.x*c13y2*c23.y + 3*c10y2*c13x2*c13.y*c23.x - c11x2*c12y2*c13.x*c23.y +
            c11y2*c12x2*c13.y*c23.x - 3*c21x2*c13.x*c21.y*c13y2 - 3*c20x2*c13.x*c13y2*c23.y + 3*c20y2*c13x2*c13.y*c23.x +
            c11.x*c12.x*c13.x*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c12x3*c13.y*(-2*c20.y*c23.y - 2*c21.y*c22.y) +
            c10.y*c13x3*(6*c20.y*c23.y + 6*c21.y*c22.y) + c11.y*c12.x*c13x2*(-2*c20.y*c23.y - 2*c21.y*c22.y) +
            c12x2*c12.y*c13.x*(2*c20.y*c23.y + 2*c21.y*c22.y) + c11.x*c12.y*c13x2*(-4*c20.y*c23.y - 4*c21.y*c22.y) +
            c10.x*c13x2*c13.y*(-6*c20.y*c23.y - 6*c21.y*c22.y) + c20.x*c13x2*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) +
            c21.x*c13x2*c13.y*(6*c20.y*c22.y + 3*c21y2) + c13x3*(-2*c20.y*c21.y*c22.y - c20y2*c23.y -
            c21.y*(2*c20.y*c22.y + c21y2) - c20.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        -c10.x*c11.x*c12.y*c13.x*c13.y*c22.y + c10.x*c11.y*c12.x*c13.x*c13.y*c22.y + 6*c10.x*c11.y*c12.y*c13.x*c22.x*c13.y -
            6*c10.y*c11.x*c12.x*c13.x*c13.y*c22.y - c10.y*c11.x*c12.y*c13.x*c22.x*c13.y + c10.y*c11.y*c12.x*c13.x*c22.x*c13.y +
            c11.x*c11.y*c12.x*c12.y*c13.x*c22.y - c11.x*c11.y*c12.x*c12.y*c22.x*c13.y + c11.x*c20.x*c12.y*c13.x*c13.y*c22.y +
            c11.x*c20.y*c12.y*c13.x*c22.x*c13.y + c11.x*c21.x*c12.y*c13.x*c21.y*c13.y - c20.x*c11.y*c12.x*c13.x*c13.y*c22.y -
            6*c20.x*c11.y*c12.y*c13.x*c22.x*c13.y - c11.y*c12.x*c20.y*c13.x*c22.x*c13.y - c11.y*c12.x*c21.x*c13.x*c21.y*c13.y -
            6*c10.x*c20.x*c22.x*c13y3 - 2*c10.x*c12y3*c13.x*c22.x + 2*c20.x*c12y3*c13.x*c22.x + 2*c10.y*c12x3*c13.y*c22.y -
            6*c10.x*c10.y*c13.x*c22.x*c13y2 + 3*c10.x*c11.x*c12.x*c13y2*c22.y - 2*c10.x*c11.x*c12.y*c22.x*c13y2 -
            4*c10.x*c11.y*c12.x*c22.x*c13y2 + 3*c10.y*c11.x*c12.x*c22.x*c13y2 + 6*c10.x*c10.y*c13x2*c13.y*c22.y +
            6*c10.x*c20.x*c13.x*c13y2*c22.y - 3*c10.x*c11.y*c12.y*c13x2*c22.y + 2*c10.x*c12.x*c12y2*c13.x*c22.y +
            2*c10.x*c12.x*c12y2*c22.x*c13.y + 6*c10.x*c20.y*c13.x*c22.x*c13y2 + 6*c10.x*c21.x*c13.x*c21.y*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c22.y + 6*c10.y*c20.x*c13.x*c22.x*c13y2 + 2*c10.y*c11.y*c12.x*c13x2*c22.y -
            3*c10.y*c11.y*c12.y*c13x2*c22.x + 2*c10.y*c12.x*c12y2*c13.x*c22.x - 3*c11.x*c20.x*c12.x*c13y2*c22.y +
            2*c11.x*c20.x*c12.y*c22.x*c13y2 + c11.x*c11.y*c12y2*c13.x*c22.x - 3*c11.x*c12.x*c20.y*c22.x*c13y2 -
            3*c11.x*c12.x*c21.x*c21.y*c13y2 + 4*c20.x*c11.y*c12.x*c22.x*c13y2 - 2*c10.x*c12x2*c12.y*c13.y*c22.y -
            6*c10.y*c20.x*c13x2*c13.y*c22.y - 6*c10.y*c20.y*c13x2*c22.x*c13.y - 6*c10.y*c21.x*c13x2*c21.y*c13.y -
            2*c10.y*c12x2*c12.y*c13.x*c22.y - 2*c10.y*c12x2*c12.y*c22.x*c13.y - c11.x*c11.y*c12x2*c13.y*c22.y -
            2*c11.x*c11y2*c13.x*c22.x*c13.y + 3*c20.x*c11.y*c12.y*c13x2*c22.y - 2*c20.x*c12.x*c12y2*c13.x*c22.y -
            2*c20.x*c12.x*c12y2*c22.x*c13.y - 6*c20.x*c20.y*c13.x*c22.x*c13y2 - 6*c20.x*c21.x*c13.x*c21.y*c13y2 +
            3*c11.y*c20.y*c12.y*c13x2*c22.x + 3*c11.y*c21.x*c12.y*c13x2*c21.y - 2*c12.x*c20.y*c12y2*c13.x*c22.x -
            2*c12.x*c21.x*c12y2*c13.x*c21.y - c11y2*c12.x*c12.y*c13.x*c22.x + 2*c20.x*c12x2*c12.y*c13.y*c22.y -
            3*c11.y*c21x2*c12.y*c13.x*c13.y + 6*c20.y*c21.x*c13x2*c21.y*c13.y + 2*c11x2*c11.y*c13.x*c13.y*c22.y +
            c11x2*c12.x*c12.y*c13.y*c22.y + 2*c12x2*c20.y*c12.y*c22.x*c13.y + 2*c12x2*c21.x*c12.y*c21.y*c13.y -
            3*c10.x*c21x2*c13y3 + 3*c20.x*c21x2*c13y3 + 3*c10x2*c22.x*c13y3 - 3*c10y2*c13x3*c22.y + 3*c20x2*c22.x*c13y3 +
            c21x2*c12y3*c13.x + c11y3*c13x2*c22.x - c11x3*c13y2*c22.y + 3*c10.y*c21x2*c13.x*c13y2 -
            c11.x*c11y2*c13x2*c22.y + c11.x*c21x2*c12.y*c13y2 + 2*c11.y*c12.x*c21x2*c13y2 + c11x2*c11.y*c22.x*c13y2 -
            c12.x*c21x2*c12y2*c13.y - 3*c20.y*c21x2*c13.x*c13y2 - 3*c10x2*c13.x*c13y2*c22.y + 3*c10y2*c13x2*c22.x*c13.y -
            c11x2*c12y2*c13.x*c22.y + c11y2*c12x2*c22.x*c13.y - 3*c20x2*c13.x*c13y2*c22.y + 3*c20y2*c13x2*c22.x*c13.y +
            c12x2*c12.y*c13.x*(2*c20.y*c22.y + c21y2) + c11.x*c12.x*c13.x*c13.y*(6*c20.y*c22.y + 3*c21y2) +
            c12x3*c13.y*(-2*c20.y*c22.y - c21y2) + c10.y*c13x3*(6*c20.y*c22.y + 3*c21y2) +
            c11.y*c12.x*c13x2*(-2*c20.y*c22.y - c21y2) + c11.x*c12.y*c13x2*(-4*c20.y*c22.y - 2*c21y2) +
            c10.x*c13x2*c13.y*(-6*c20.y*c22.y - 3*c21y2) + c20.x*c13x2*c13.y*(6*c20.y*c22.y + 3*c21y2) +
            c13x3*(-2*c20.y*c21y2 - c20y2*c22.y - c20.y*(2*c20.y*c22.y + c21y2)),
        -c10.x*c11.x*c12.y*c13.x*c21.y*c13.y + c10.x*c11.y*c12.x*c13.x*c21.y*c13.y + 6*c10.x*c11.y*c21.x*c12.y*c13.x*c13.y -
            6*c10.y*c11.x*c12.x*c13.x*c21.y*c13.y - c10.y*c11.x*c21.x*c12.y*c13.x*c13.y + c10.y*c11.y*c12.x*c21.x*c13.x*c13.y -
            c11.x*c11.y*c12.x*c21.x*c12.y*c13.y + c11.x*c11.y*c12.x*c12.y*c13.x*c21.y + c11.x*c20.x*c12.y*c13.x*c21.y*c13.y +
            6*c11.x*c12.x*c20.y*c13.x*c21.y*c13.y + c11.x*c20.y*c21.x*c12.y*c13.x*c13.y - c20.x*c11.y*c12.x*c13.x*c21.y*c13.y -
            6*c20.x*c11.y*c21.x*c12.y*c13.x*c13.y - c11.y*c12.x*c20.y*c21.x*c13.x*c13.y - 6*c10.x*c20.x*c21.x*c13y3 -
            2*c10.x*c21.x*c12y3*c13.x + 6*c10.y*c20.y*c13x3*c21.y + 2*c20.x*c21.x*c12y3*c13.x + 2*c10.y*c12x3*c21.y*c13.y -
            2*c12x3*c20.y*c21.y*c13.y - 6*c10.x*c10.y*c21.x*c13.x*c13y2 + 3*c10.x*c11.x*c12.x*c21.y*c13y2 -
            2*c10.x*c11.x*c21.x*c12.y*c13y2 - 4*c10.x*c11.y*c12.x*c21.x*c13y2 + 3*c10.y*c11.x*c12.x*c21.x*c13y2 +
            6*c10.x*c10.y*c13x2*c21.y*c13.y + 6*c10.x*c20.x*c13.x*c21.y*c13y2 - 3*c10.x*c11.y*c12.y*c13x2*c21.y +
            2*c10.x*c12.x*c21.x*c12y2*c13.y + 2*c10.x*c12.x*c12y2*c13.x*c21.y + 6*c10.x*c20.y*c21.x*c13.x*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c21.y + 6*c10.y*c20.x*c21.x*c13.x*c13y2 + 2*c10.y*c11.y*c12.x*c13x2*c21.y -
            3*c10.y*c11.y*c21.x*c12.y*c13x2 + 2*c10.y*c12.x*c21.x*c12y2*c13.x - 3*c11.x*c20.x*c12.x*c21.y*c13y2 +
            2*c11.x*c20.x*c21.x*c12.y*c13y2 + c11.x*c11.y*c21.x*c12y2*c13.x - 3*c11.x*c12.x*c20.y*c21.x*c13y2 +
            4*c20.x*c11.y*c12.x*c21.x*c13y2 - 6*c10.x*c20.y*c13x2*c21.y*c13.y - 2*c10.x*c12x2*c12.y*c21.y*c13.y -
            6*c10.y*c20.x*c13x2*c21.y*c13.y - 6*c10.y*c20.y*c21.x*c13x2*c13.y - 2*c10.y*c12x2*c21.x*c12.y*c13.y -
            2*c10.y*c12x2*c12.y*c13.x*c21.y - c11.x*c11.y*c12x2*c21.y*c13.y - 4*c11.x*c20.y*c12.y*c13x2*c21.y -
            2*c11.x*c11y2*c21.x*c13.x*c13.y + 3*c20.x*c11.y*c12.y*c13x2*c21.y - 2*c20.x*c12.x*c21.x*c12y2*c13.y -
            2*c20.x*c12.x*c12y2*c13.x*c21.y - 6*c20.x*c20.y*c21.x*c13.x*c13y2 - 2*c11.y*c12.x*c20.y*c13x2*c21.y +
            3*c11.y*c20.y*c21.x*c12.y*c13x2 - 2*c12.x*c20.y*c21.x*c12y2*c13.x - c11y2*c12.x*c21.x*c12.y*c13.x +
            6*c20.x*c20.y*c13x2*c21.y*c13.y + 2*c20.x*c12x2*c12.y*c21.y*c13.y + 2*c11x2*c11.y*c13.x*c21.y*c13.y +
            c11x2*c12.x*c12.y*c21.y*c13.y + 2*c12x2*c20.y*c21.x*c12.y*c13.y + 2*c12x2*c20.y*c12.y*c13.x*c21.y +
            3*c10x2*c21.x*c13y3 - 3*c10y2*c13x3*c21.y + 3*c20x2*c21.x*c13y3 + c11y3*c21.x*c13x2 - c11x3*c21.y*c13y2 -
            3*c20y2*c13x3*c21.y - c11.x*c11y2*c13x2*c21.y + c11x2*c11.y*c21.x*c13y2 - 3*c10x2*c13.x*c21.y*c13y2 +
            3*c10y2*c21.x*c13x2*c13.y - c11x2*c12y2*c13.x*c21.y + c11y2*c12x2*c21.x*c13.y - 3*c20x2*c13.x*c21.y*c13y2 +
            3*c20y2*c21.x*c13x2*c13.y,
        c10.x*c10.y*c11.x*c12.y*c13.x*c13.y - c10.x*c10.y*c11.y*c12.x*c13.x*c13.y + c10.x*c11.x*c11.y*c12.x*c12.y*c13.y -
            c10.y*c11.x*c11.y*c12.x*c12.y*c13.x - c10.x*c11.x*c20.y*c12.y*c13.x*c13.y + 6*c10.x*c20.x*c11.y*c12.y*c13.x*c13.y +
            c10.x*c11.y*c12.x*c20.y*c13.x*c13.y - c10.y*c11.x*c20.x*c12.y*c13.x*c13.y - 6*c10.y*c11.x*c12.x*c20.y*c13.x*c13.y +
            c10.y*c20.x*c11.y*c12.x*c13.x*c13.y - c11.x*c20.x*c11.y*c12.x*c12.y*c13.y + c11.x*c11.y*c12.x*c20.y*c12.y*c13.x +
            c11.x*c20.x*c20.y*c12.y*c13.x*c13.y - c20.x*c11.y*c12.x*c20.y*c13.x*c13.y - 2*c10.x*c20.x*c12y3*c13.x +
            2*c10.y*c12x3*c20.y*c13.y - 3*c10.x*c10.y*c11.x*c12.x*c13y2 - 6*c10.x*c10.y*c20.x*c13.x*c13y2 +
            3*c10.x*c10.y*c11.y*c12.y*c13x2 - 2*c10.x*c10.y*c12.x*c12y2*c13.x - 2*c10.x*c11.x*c20.x*c12.y*c13y2 -
            c10.x*c11.x*c11.y*c12y2*c13.x + 3*c10.x*c11.x*c12.x*c20.y*c13y2 - 4*c10.x*c20.x*c11.y*c12.x*c13y2 +
            3*c10.y*c11.x*c20.x*c12.x*c13y2 + 6*c10.x*c10.y*c20.y*c13x2*c13.y + 2*c10.x*c10.y*c12x2*c12.y*c13.y +
            2*c10.x*c11.x*c11y2*c13.x*c13.y + 2*c10.x*c20.x*c12.x*c12y2*c13.y + 6*c10.x*c20.x*c20.y*c13.x*c13y2 -
            3*c10.x*c11.y*c20.y*c12.y*c13x2 + 2*c10.x*c12.x*c20.y*c12y2*c13.x + c10.x*c11y2*c12.x*c12.y*c13.x +
            c10.y*c11.x*c11.y*c12x2*c13.y + 4*c10.y*c11.x*c20.y*c12.y*c13x2 - 3*c10.y*c20.x*c11.y*c12.y*c13x2 +
            2*c10.y*c20.x*c12.x*c12y2*c13.x + 2*c10.y*c11.y*c12.x*c20.y*c13x2 + c11.x*c20.x*c11.y*c12y2*c13.x -
            3*c11.x*c20.x*c12.x*c20.y*c13y2 - 2*c10.x*c12x2*c20.y*c12.y*c13.y - 6*c10.y*c20.x*c20.y*c13x2*c13.y -
            2*c10.y*c20.x*c12x2*c12.y*c13.y - 2*c10.y*c11x2*c11.y*c13.x*c13.y - c10.y*c11x2*c12.x*c12.y*c13.y -
            2*c10.y*c12x2*c20.y*c12.y*c13.x - 2*c11.x*c20.x*c11y2*c13.x*c13.y - c11.x*c11.y*c12x2*c20.y*c13.y +
            3*c20.x*c11.y*c20.y*c12.y*c13x2 - 2*c20.x*c12.x*c20.y*c12y2*c13.x - c20.x*c11y2*c12.x*c12.y*c13.x +
            3*c10y2*c11.x*c12.x*c13.x*c13.y + 3*c11.x*c12.x*c20y2*c13.x*c13.y + 2*c20.x*c12x2*c20.y*c12.y*c13.y -
            3*c10x2*c11.y*c12.y*c13.x*c13.y + 2*c11x2*c11.y*c20.y*c13.x*c13.y + c11x2*c12.x*c20.y*c12.y*c13.y -
            3*c20x2*c11.y*c12.y*c13.x*c13.y - c10x3*c13y3 + c10y3*c13x3 + c20x3*c13y3 - c20y3*c13x3 -
            3*c10.x*c20x2*c13y3 - c10.x*c11y3*c13x2 + 3*c10x2*c20.x*c13y3 + c10.y*c11x3*c13y2 +
            3*c10.y*c20y2*c13x3 + c20.x*c11y3*c13x2 + c10x2*c12y3*c13.x - 3*c10y2*c20.y*c13x3 - c10y2*c12x3*c13.y +
            c20x2*c12y3*c13.x - c11x3*c20.y*c13y2 - c12x3*c20y2*c13.y - c10.x*c11x2*c11.y*c13y2 +
            c10.y*c11.x*c11y2*c13x2 - 3*c10.x*c10y2*c13x2*c13.y - c10.x*c11y2*c12x2*c13.y + c10.y*c11x2*c12y2*c13.x -
            c11.x*c11y2*c20.y*c13x2 + 3*c10x2*c10.y*c13.x*c13y2 + c10x2*c11.x*c12.y*c13y2 +
            2*c10x2*c11.y*c12.x*c13y2 - 2*c10y2*c11.x*c12.y*c13x2 - c10y2*c11.y*c12.x*c13x2 + c11x2*c20.x*c11.y*c13y2 -
            3*c10.x*c20y2*c13x2*c13.y + 3*c10.y*c20x2*c13.x*c13y2 + c11.x*c20x2*c12.y*c13y2 - 2*c11.x*c20y2*c12.y*c13x2 +
            c20.x*c11y2*c12x2*c13.y - c11.y*c12.x*c20y2*c13x2 - c10x2*c12.x*c12y2*c13.y - 3*c10x2*c20.y*c13.x*c13y2 +
            3*c10y2*c20.x*c13x2*c13.y + c10y2*c12x2*c12.y*c13.x - c11x2*c20.y*c12y2*c13.x + 2*c20x2*c11.y*c12.x*c13y2 +
            3*c20.x*c20y2*c13x2*c13.y - c20x2*c12.x*c12y2*c13.y - 3*c20x2*c20.y*c13.x*c13y2 + c12x2*c20y2*c12.y*c13.x
    );
    var roots = poly.getRootsInInterval(0,1);
    module.exports.Utils.removeMultipleRootsIn01(roots);

    for ( var i = 0; i < roots.length; i++ ) {
        var s = roots[i];
        var xRoots = new Polynomial(
            c13.x,
            c12.x,
            c11.x,
            c10.x - c20.x - s*c21.x - s*s*c22.x - s*s*s*c23.x
        ).getRoots();
        var yRoots = new Polynomial(
            c13.y,
            c12.y,
            c11.y,
            c10.y - c20.y - s*c21.y - s*s*c22.y - s*s*s*c23.y
        ).getRoots();

        if ( xRoots.length > 0 && yRoots.length > 0 ) {
            var TOLERANCE = 1e-4;

            checkRoots:
                for ( var j = 0; j < xRoots.length; j++ ) {
                    var xRoot = xRoots[j];

                    if ( 0 <= xRoot && xRoot <= 1 ) {
                        for ( var k = 0; k < yRoots.length; k++ ) {
                            if ( Math.abs( xRoot - yRoots[k] ) < TOLERANCE ) {
                                var v = c23.multiply(s * s * s).add(c22.multiply(s * s).add(c21.multiply(s).add(c20)));
                                result.points.push(new Point2D(v.x, v.y));
                                break checkRoots;
                            }
                        }
                    }
                }
        }
    }

    return result;
};

/**
 *  intersectBezier3Ellipse
 *
 *  @param {Point2D} p1
 *  @param {Point2D} p2
 *  @param {Point2D} p3
 *  @param {Point2D} p4
 *  @param {Point2D} ec
 *  @param {Number} rx
 *  @param {Number} ry
 *  @returns {Intersection}
 */
module.exports.intersectBezier3Ellipse = function(p1, p2, p3, p4, ec, rx, ry) {
    var a, b, c, d;       // temporary variables
    var c3, c2, c1, c0;   // coefficients of cubic
    var result = new Intersection();

    // Calculate the coefficients of cubic polynomial
    a = p1.multiply(-1);
    b = p2.multiply(3);
    c = p3.multiply(-3);
    d = a.add(b.add(c.add(p4)));
    c3 = new Vector2D(d.x, d.y);

    a = p1.multiply(3);
    b = p2.multiply(-6);
    c = p3.multiply(3);
    d = a.add(b.add(c));
    c2 = new Vector2D(d.x, d.y);

    a = p1.multiply(-3);
    b = p2.multiply(3);
    c = a.add(b);
    c1 = new Vector2D(c.x, c.y);

    c0 = new Vector2D(p1.x, p1.y);

    var rxrx  = rx*rx;
    var ryry  = ry*ry;
    var poly = new Polynomial(
        c3.x*c3.x*ryry + c3.y*c3.y*rxrx,
        2*(c3.x*c2.x*ryry + c3.y*c2.y*rxrx),
        2*(c3.x*c1.x*ryry + c3.y*c1.y*rxrx) + c2.x*c2.x*ryry + c2.y*c2.y*rxrx,
        2*c3.x*ryry*(c0.x - ec.x) + 2*c3.y*rxrx*(c0.y - ec.y) +
            2*(c2.x*c1.x*ryry + c2.y*c1.y*rxrx),
        2*c2.x*ryry*(c0.x - ec.x) + 2*c2.y*rxrx*(c0.y - ec.y) +
            c1.x*c1.x*ryry + c1.y*c1.y*rxrx,
        2*c1.x*ryry*(c0.x - ec.x) + 2*c1.y*rxrx*(c0.y - ec.y),
        c0.x*c0.x*ryry - 2*c0.y*ec.y*rxrx - 2*c0.x*ec.x*ryry +
            c0.y*c0.y*rxrx + ec.x*ec.x*ryry + ec.y*ec.y*rxrx - rxrx*ryry
    );
    var roots = poly.getRootsInInterval(0,1);
    module.exports.Utils.removeMultipleRootsIn01(roots);

    for ( var i = 0; i < roots.length; i++ ) {
        var t = roots[i];
        var v = c3.multiply(t * t * t).add(c2.multiply(t * t).add(c1.multiply(t).add(c0)));
        result.points.push(new Point2D(v.x, v.y));
    }

    return result;
};


/**
 *  intersectBezier3Line
 *
 *  Many thanks to Dan Sunday at SoftSurfer.com.  He gave me a very thorough
 *  sketch of the algorithm used here.  Without his help, I'm not sure when I
 *  would have figured out this intersection problem.
 *
 *  @param {Point2D} p1
 *  @param {Point2D} p2
 *  @param {Point2D} p3
 *  @param {Point2D} p4
 *  @param {Point2D} a1
 *  @param {Point2D} a2
 *  @returns {Intersection}
 */
module.exports.intersectBezier3Line = function(p1, p2, p3, p4, a1, a2) {
    var a, b, c, d;       // temporary variables
    var c3, c2, c1, c0;   // coefficients of cubic
    var cl;               // c coefficient for normal form of line
    var n;                // normal for normal form of line
    var min = a1.min(a2); // used to determine if point is on line segment
    var max = a1.max(a2); // used to determine if point is on line segment
    var result = new Intersection();

    // Start with Bezier using Bernstein polynomials for weighting functions:
    //     (1-t^3)P1 + 3t(1-t)^2P2 + 3t^2(1-t)P3 + t^3P4
    //
    // Expand and collect terms to form linear combinations of original Bezier
    // controls.  This ends up with a vector cubic in t:
    //     (-P1+3P2-3P3+P4)t^3 + (3P1-6P2+3P3)t^2 + (-3P1+3P2)t + P1
    //             /\                  /\                /\       /\
    //             ||                  ||                ||       ||
    //             c3                  c2                c1       c0

    // Calculate the coefficients
    a = p1.multiply(-1);
    b = p2.multiply(3);
    c = p3.multiply(-3);
    d = a.add(b.add(c.add(p4)));
    c3 = new Vector2D(d.x, d.y);

    a = p1.multiply(3);
    b = p2.multiply(-6);
    c = p3.multiply(3);
    d = a.add(b.add(c));
    c2 = new Vector2D(d.x, d.y);

    a = p1.multiply(-3);
    b = p2.multiply(3);
    c = a.add(b);
    c1 = new Vector2D(c.x, c.y);

    c0 = new Vector2D(p1.x, p1.y);

    // Convert line to normal form: ax + by + c = 0
    // Find normal to line: negative inverse of original line's slope
    n = new Vector2D(a1.y - a2.y, a2.x - a1.x);

    // Determine new c coefficient
    cl = a1.x*a2.y - a2.x*a1.y;

    // ?Rotate each cubic coefficient using line for new coordinate system?
    // Find roots of rotated cubic
    roots = new Polynomial(
        n.dot(c3),
        n.dot(c2),
        n.dot(c1),
        n.dot(c0) + cl
    ).getRoots();

    // Any roots in closed interval [0,1] are intersections on Bezier, but
    // might not be on the line segment.
    // Find intersections and calculate point coordinates
    for ( var i = 0; i < roots.length; i++ ) {
        var t = roots[i];

        if ( 0 <= t && t <= 1 ) {
            // We're within the Bezier curve
            // Find point on Bezier
            var p5 = p1.lerp(p2, t);
            var p6 = p2.lerp(p3, t);
            var p7 = p3.lerp(p4, t);

            var p8 = p5.lerp(p6, t);
            var p9 = p6.lerp(p7, t);

            var p10 = p8.lerp(p9, t);

            // See if point is on line segment
            // Had to make special cases for vertical and horizontal lines due
            // to slight errors in calculation of p10
            if ( a1.x == a2.x ) {
                if ( min.y <= p10.y && p10.y <= max.y ) {
                    result.appendPoint( p10 );
                }
            } else if ( a1.y == a2.y ) {
                if ( min.x <= p10.x && p10.x <= max.x ) {
                    result.appendPoint( p10 );
                }
            } else if (min.x <= p10.x && p10.x <= max.x && min.y <= p10.y && p10.y <= max.y) {
                result.appendPoint( p10 );
            }
        }
    }

    return result;
};
});

var bezier_1 = bezier.intersectBezier2Bezier2;
var bezier_2 = bezier.intersectBezier2Bezier3;
var bezier_3 = bezier.intersectBezier2Ellipse;
var bezier_4 = bezier.intersectBezier2Line;
var bezier_5 = bezier.intersectBezier3Bezier3;
var bezier_6 = bezier.intersectBezier3Ellipse;
var bezier_7 = bezier.intersectBezier3Line;

exports['default'] = bezier;
exports.intersectBezier2Bezier2 = bezier_1;
exports.intersectBezier2Bezier3 = bezier_2;
exports.intersectBezier2Ellipse = bezier_3;
exports.intersectBezier2Line = bezier_4;
exports.intersectBezier3Bezier3 = bezier_5;
exports.intersectBezier3Ellipse = bezier_6;
exports.intersectBezier3Line = bezier_7;

}((this.bezier = this.bezier || {}),kldAffine,kldPolynomial));

  if (typeof module !== "undefined" && typeof require === "function") {
     module.exports = GLOBAL.svgIntersections;
     module.exports.bezier = GLOBAL.bezier;
  }
})();