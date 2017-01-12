(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
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

  const Point2D = GLOBAL.kldAffine.Point2D;
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
 *   copyright 2002, 2103 Kevin Lindsey
 *
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
    for ( var i = this.getDegree(); i >= 0; i-- ) {
        if ( Math.abs( this.coefs[i] ) <= Polynomial.TOLERANCE )
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
 *  http://www.magic-software.com
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

        if ( Math.abs(discrim) <= Polynomial.TOLERANCE ) discrim = 0;

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
 *  getQuarticRoots
 *
 *  This code is based on MgcPolynomial.cpp written by David Eberly.  His
 *  code along with many other excellent examples are avaiable at his site:
 *  http://www.magic-software.com
 */
Polynomial.prototype.getQuarticRoots = function() {
    var results = new Array();

    if ( this.getDegree() == 4 ) {
        var c4 = this.coefs[4];
        var c3 = this.coefs[3] / c4;
        var c2 = this.coefs[2] / c4;
        var c1 = this.coefs[1] / c4;
        var c0 = this.coefs[0] / c4;

        var resolveRoots = new Polynomial(
            1, -c2, c3*c1 - 4*c0, -c3*c3*c0 + 4*c2*c0 -c1*c1
        ).getCubicRoots();
        var y       = resolveRoots[0];
        var discrim = c3*c3/4 - c2 + y;

        if ( Math.abs(discrim) <= Polynomial.TOLERANCE ) discrim = 0;

        if ( discrim > 0 ) {
            var e     = Math.sqrt(discrim);
            var t1    = 3*c3*c3/4 - e*e - 2*c2;
            var t2    = ( 4*c3*c2 - 8*c1 - c3*c3*c3 ) / ( 4*e );
            var plus  = t1+t2;
            var minus = t1-t2;

            if ( Math.abs(plus)  <= Polynomial.TOLERANCE ) plus  = 0;
            if ( Math.abs(minus) <= Polynomial.TOLERANCE ) minus = 0;

            if ( plus >= 0 ) {
                var f = Math.sqrt(plus);

                results.push( -c3/4 + (e+f)/2 );
                results.push( -c3/4 + (e-f)/2 );
            }
            if ( minus >= 0 ) {
                var f = Math.sqrt(minus);

                results.push( -c3/4 + (f-e)/2 );
                results.push( -c3/4 - (f+e)/2 );
            }
        } else if ( discrim < 0 ) {
            // no roots
        } else {
            var t2 = y*y - 4*c0;

            if ( t2 >= -Polynomial.TOLERANCE ) {
                if ( t2 < 0 ) t2 = 0;

                t2 = 2*Math.sqrt(t2);
                t1 = 3*c3*c3/4 - 2*c2;
                if ( t1+t2 >= Polynomial.TOLERANCE ) {
                    var d = Math.sqrt(t1+t2);

                    results.push( -c3/4 + d/2 );
                    results.push( -c3/4 - d/2 );
                }
                if ( t1-t2 >= Polynomial.TOLERANCE ) {
                    var d = Math.sqrt(t1-t2);

                    results.push( -c3/4 + d/2 );
                    results.push( -c3/4 - d/2 );
                }
            }
        }
    }

    return results;
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

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};





function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var IntersectionParams$2 = createCommonjsModule(function (module) {
/**
 *
 *   IntersectionParams.js
 *
 *   copyright 2002, Kevin Lindsey
 * 
 *   contribution {@link http://github.com/Quazistax/kld-polynomial}
 *       @copyright 2015 Robert Benko (Quazistax) <quazistax@gmail.com>
 *       @license MIT
 */

(function (global, factory) {
    //// AMD - commented out until all dependencies are wrapped in AMD compatible way
    //if (typeof define === 'function' && define.amd) {
    //    define(factory);
    //} else
    if ('object' === 'object' && 'object' === 'object') {
        // CommonJS
        module.exports = factory();
    } else {
        //classic script - populating global namespace
        global.IntersectionParams = factory();
    }
}(commonjsGlobal, function () {


    /**
     *  IntersectionParams
     *
     *  @param {String} name
     *  @param {Array<Point2D} params
     *  @returns {IntersectionParams}
     */
    function IntersectionParams(name, params) {
        this.init(name, params);
    }

    /**
     *  init
     *
     *  @param {String} type
     *  @param {Array<Point2D>} params
     */
    IntersectionParams.prototype.init = function (type, params) {
        this.type = type;
        this.params = params;
        this.meta = {};
    };
       
    IntersectionParams.TYPE = {};
    var IPTYPE = IntersectionParams.TYPE;
    !function () {
        var d = Object.defineProperty;
        d(IPTYPE, 'LINE', { value: 'Line' });
        d(IPTYPE, 'RECT', { value: 'Rectangle' });
        d(IPTYPE, 'ROUNDRECT', { value: 'RoundRectangle' });
        d(IPTYPE, 'CIRCLE', { value: 'Circle' });
        d(IPTYPE, 'ELLIPSE', { value: 'Ellipse' });
        d(IPTYPE, 'POLYGON', { value: 'Polygon' });
        d(IPTYPE, 'POLYLINE', { value: 'Polyline' });
        d(IPTYPE, 'PATH', { value: 'Path' });
        d(IPTYPE, 'ARC', { value: 'Arc' });
        d(IPTYPE, 'BEZIER2', { value: 'Bezier2' });
        d(IPTYPE, 'BEZIER3', { value: 'Bezier3' });
    }();

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
    IntersectionParams.newArc = function (startPoint, endPoint, rx, ry, angle, largeArcFlag, sweepFlag) {
        var p = IntersectionParams.Utils.getArcParamaters(startPoint, endPoint, rx, ry, angle, largeArcFlag, sweepFlag);
        return new IntersectionParams(IPTYPE.ARC, [p.center, p.rx, p.ry, (angle * Math.PI / 180), p.theta1, p.deltaTheta]);
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        Creates IntersectionParams for bezier2.
    
        @param {Point2D} p1
        @param {Point2D} p2
        @param {Point2D} p3
        @returns {IntersectionParams}
    */
    IntersectionParams.newBezier2 = function (p1, p2, p3) {
        return new IntersectionParams(IPTYPE.BEZIER2, [p1, p2, p3]);
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
    IntersectionParams.newBezier3 = function (p1, p2, p3, p4) {
        return new IntersectionParams(IPTYPE.BEZIER3, [p1, p2, p3, p4]);
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        Creates IntersectionParams for circle.
    
        @param {Point2D} c
        @param {Number} r
        @returns {IntersectionParams}
    */
    IntersectionParams.newCircle = function (c, r) {
        return new IntersectionParams(IPTYPE.CIRCLE, [c, r]);
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        Creates IntersectionParams for ellipse.
    
        @param {Point2D} c
        @param {Number} rx
        @param {Number} ry
        @returns {IntersectionParams}
    */
    IntersectionParams.newEllipse = function (c, rx, ry) {
        return new IntersectionParams(IPTYPE.ELLIPSE, [c, rx, ry]);
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        Creates IntersectionParams for line.
    
        @param {Point2D} a1
        @param {Point2D} a2
        @returns {IntersectionParams}
    */
    IntersectionParams.newLine = function (a1, a2) {
        return new IntersectionParams(IPTYPE.LINE, [a1, a2]);
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        Creates IntersectionParams for polygon.
    
        @param {Array<Point2D>} points
        @returns {IntersectionParams}
    */
    IntersectionParams.newPolygon = function (points) {
        return new IntersectionParams(IPTYPE.POLYGON, [points]);
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        Creates IntersectionParams for polyline.
    
         @param {Array<Point2D>} points
        @returns {IntersectionParams}
    */
    IntersectionParams.newPolyline = function (points) {
        return new IntersectionParams(IPTYPE.POLYLINE, [points]);
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        Creates IntersectionParams for path.
    
        @param {Array<IntersectionParams>} segments
        @returns {IntersectionParams}
    */
    IntersectionParams.newPath = function (segments) {
        return new IntersectionParams(IPTYPE.PATH, [segments]);
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
    IntersectionParams.newRect = function (x, y, width, height) {
        var points = [];
        points.push(new Point2D(x, y));
        points.push(new Point2D(x + width, y));
        points.push(new Point2D(x + width, y + height));
        points.push(new Point2D(x, y + height));
        return new IntersectionParams(IPTYPE.RECT, [points]);
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
    IntersectionParams.newRoundRect = function (x, y, width, height, rx, ry) {
        if (rx === 0 && ry === 0)
            return IntersectionParams.newRect(x, y, width, height);
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
        shape.push(new IntersectionParams(IPTYPE.ARC, [new Point2D(x1, y1), rx, ry, 0, degreesToRadians(180), degreesToRadians(90)]));
        shape.push(new IntersectionParams(IPTYPE.LINE, [new Point2D(x1, y0), new Point2D(x2, y0)]));
        shape.push(new IntersectionParams(IPTYPE.ARC, [new Point2D(x2, y1), rx, ry, 0, degreesToRadians(-90), degreesToRadians(90)]));
        shape.push(new IntersectionParams(IPTYPE.LINE, [new Point2D(x3, y1), new Point2D(x3, y2)]));
        shape.push(new IntersectionParams(IPTYPE.ARC, [new Point2D(x2, y2), rx, ry, 0, degreesToRadians(0), degreesToRadians(90)]));
        shape.push(new IntersectionParams(IPTYPE.LINE, [new Point2D(x2, y3), new Point2D(x1, y3)]));
        shape.push(new IntersectionParams(IPTYPE.ARC, [new Point2D(x1, y2), rx, ry, 0, degreesToRadians(90), degreesToRadians(90)]));
        shape.push(new IntersectionParams(IPTYPE.LINE, [new Point2D(x0, y2), new Point2D(x0, y1)]));
        shape[shape.length - 1].meta.closePath = true;
        return new IntersectionParams(IPTYPE.ROUNDRECT, [shape]);
    };

    ///////////////////////////////////////////////////////////////////
    IntersectionParams.Utils = {};
    ///////////////////////////////////////////////////////////////////

    ///////////////////////////////////////////////////////////////////
    /** 
        getArcParamaters
    
        @param {Point2D} startPoint
        @param {Point2D} endPoint
        @param {Number} rx
        @param {Number} ry
        @param {Number} angle - in degrees
        @param {Boolean} arcFlag
        @param {Boolean} sweepFlag
        @returns {{ center: Point2D, rx: Number, ry: Number, theta1: Number, deltaTheta: Number }}
    */
    IntersectionParams.Utils.getArcParamaters = function (startPoint, endPoint, rx, ry, angle, arcFlag, sweepFlag) {
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
            center: new Point2D(cxp * c - cyp * s + mid.x, cxp * s + cyp * c + mid.y),
            rx: rx,
            ry: ry,
            theta1: theta1,
            deltaTheta: deltaTheta
        };
    };

    return IntersectionParams;
}));
});

var Intersection$1 = createCommonjsModule(function (module) {
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

(function (global, factory) {
    //// AMD - commented out until all dependencies are wrapped in AMD compatible way
    //if (typeof define === 'function' && define.amd) {
    //    define(['kld/Point2D', 'kld/Vector2D', 'kld/Matrix2D', 'kld/Polynomial', 'kld/IntersectionParams'], factory);
    //} else
    if ('object' === 'object' && 'object' === 'object') {
        // CommonJS - Node.js assumed, for other CommonJS environments or folder structures - customize to
        // suit your needs or give proposal for more general solution
        module.exports = factory(
            kldAffine.Point2D,
            kldAffine.Vector2D,
            kldAffine.Matrix2D,
            kldPolynomial.Polynomial,
            IntersectionParams$2
            );
    } else {
        //classic script - populating global namespace
        global.Intersection = factory(Point2D, Vector2D, Matrix2D, Polynomial, IntersectionParams);
    }
}(commonjsGlobal, function (Point2D, Vector2D, Matrix2D, Polynomial, IntersectionParams) {


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

    // static methods
        
    ///////////////////////////////////////////////////////////////////
    /** 
        intersectShapes
    
        @param {IntersectionParams} shape1
        @param {IntersectionParams} shape2
        @param {Matrix2D} [m1]
        @param {Matrix2D} [m2]
        @returns {Intersection}
    */
    Intersection.intersectShapes = function (shape1, shape2, m1, m2) {
        var ip1 = shape1;
        var ip2 = shape2;
        var result;
        var IPTYPE = IntersectionParams.TYPE;

        var stat = Intersection.intersectShapes;
        if (!stat.composedShapeMethods) {
            stat.composedShapeMethods = {};
            stat.composedShapeMethods[IPTYPE.PATH] = Intersection.intersectPathShape;
            stat.composedShapeMethods[IPTYPE.POLYLINE] = Intersection.intersectLinesShape;
            stat.composedShapeMethods[IPTYPE.POLYGON] = Intersection.intersectLinesShape;
            stat.composedShapeMethods[IPTYPE.RECT] = Intersection.intersectLinesShape;
            stat.composedShapeMethods[IPTYPE.ROUNDRECT] = Intersection.intersectPathShape;
            stat.composedShapeMethods[IPTYPE.ARC] = Intersection.intersectArcShape;
        }

        if (ip1 !== null && ip2 !== null) {
            var method;

            if (method = stat.composedShapeMethods[ip1.type]) {
                result = method(ip1, ip2, m1, m2);
            }
            else if (method = stat.composedShapeMethods[ip2.type]) {
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
                                console.log('Unknown shape: ' + type);
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
                

                if (!(method in Intersection))
                    throw new Error("Intersection not available: " + method);

                result = Intersection[method].apply(null, params);

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
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        intersectPathShape
    
        @param {IntersectionParams} path
        @param {IntersectionParams} shape
        @param {Matrix2D} [m1]
        @param {Matrix2D} [m2]
        @returns {Intersection}
    */
    Intersection.intersectPathShape = function (path, shape, m1, m2) {
        var result = new Intersection();
        var pathParams = path.params[0];
        var inter0;
        var previnter;
        for (var inter, i = 0; i < pathParams.length; i++) {
            inter = Intersection.intersectShapes(pathParams[i], shape, m1, m2);
            if (!inter0)
                inter0 = inter;
            if (previnter) {
                Intersection.Utils.removeClosePoints(previnter.points, inter.points);
                result.appendPoints(previnter.points);
            }
            previnter = inter;
        }
        if (previnter) {
            result.appendPoints(previnter.points);
        }
        return result;
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        intersectLinesShape
    
        @param {IntersectionParams} lines - IntersectionParams with points as first parameter (like types RECT, POLYLINE or POLYGON)
        @param {IntersectionParams} shape - IntersectionParams of other shape
        @param {Matrix2D} [m1]
        @param {Matrix2D} [m2]
        @param {Boolean} [closed] - if set, determines if line between first and last point will be taken into callculation too. If not set, it's true for RECT and POLYGON, false for other <b>lines</b> types.
        @returns {Intersection}
    */
    Intersection.intersectLinesShape = function (lines, shape, m1, m2, closed) {
        var IPTYPE = IntersectionParams.TYPE;
        var line_points = lines.params[0];
        var ip = new IntersectionParams(IPTYPE.LINE, [0, 0]);
        var result = new Intersection();
        var inter, i;
        var intersectLine = function (i1, i2) {
            ip.params[0] = line_points[i1];
            ip.params[1] = line_points[i2];
            inter = Intersection.intersectShapes(ip, shape, m1, m2);
            Intersection.Utils.removeClosePoints(inter.points, [line_points[i2]]);
            result.appendPoints(inter.points);
        };
        for (i = 0; i < line_points.length - 1; i++) {
            intersectLine(i, i + 1);
        }
        if (typeof closed !== 'undefined' && closed || lines.type === IPTYPE.RECT || lines.type === IPTYPE.POLYGON) {
            intersectLine(line_points.length - 1, 0);
        }
        return result;
    };

    ///////////////////////////////////////////////////////////////////
    /** 
        intersectArcShape
    
        @param {IntersectionParams} arc
        @param {IntersectionParams} shape
        @param {Matrix2D} [m1]
        @param {Matrix2D} [m2]
        @returns {Intersection}
    */
    Intersection.intersectArcShape = function (arc, shape, m1, m2) {
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
            res = Intersection.intersectShapes(IntersectionParams.newEllipse(c1, rx1, ry1), shape, m1, m2);
        }
        else {
            m1 = m1.multiply(Matrix2D.IDENTITY.translate(c1.x, c1.y).rotate(phi1));
            c1 = new Point2D(0, 0);
            phi1 = 0;
            res = Intersection.intersectShapes(IntersectionParams.newEllipse(c1, rx1, ry1), shape, m1, m2);
        }
        res = Intersection.Utils.removePointsNotInArc(res, c1, rx1, ry1, phi1, th1, dth1, m1);
        return res;
    };

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
    Intersection.intersectBezier2Bezier2 = function(a1, a2, a3, b1, b2, b3) {
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
    Intersection.intersectBezier2Bezier3 = function(a1, a2, a3, b1, b2, b3, b4) {
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
        Intersection.Utils.removeMultipleRootsIn01(roots);

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
    Intersection.intersectBezier2Ellipse = function(p1, p2, p3, ec, rx, ry) {
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
    Intersection.intersectBezier2Line = function(p1, p2, p3, a1, a2) {
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
    Intersection.intersectBezier3Bezier3 = function(a1, a2, a3, a4, b1, b2, b3, b4) {
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
        Intersection.Utils.removeMultipleRootsIn01(roots);

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
    Intersection.intersectBezier3Ellipse = function(p1, p2, p3, p4, ec, rx, ry) {
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
        Intersection.Utils.removeMultipleRootsIn01(roots);

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
    Intersection.intersectBezier3Line = function(p1, p2, p3, p4, a1, a2) {
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
    Intersection.intersectEllipseEllipse = function (c1, rx1, ry1, c2, rx2, ry2) {
        var a = [
            ry1 * ry1, 0, rx1 * rx1, -2 * ry1 * ry1 * c1.x, -2 * rx1 * rx1 * c1.y,
            ry1 * ry1 * c1.x * c1.x + rx1 * rx1 * c1.y * c1.y - rx1 * rx1 * ry1 * ry1
        ];
        var b = [
            ry2 * ry2, 0, rx2 * rx2, -2 * ry2 * ry2 * c2.x, -2 * rx2 * rx2 * c2.y,
            ry2 * ry2 * c2.x * c2.x + rx2 * rx2 * c2.y * c2.y - rx2 * rx2 * ry2 * ry2
        ];

        var yPoly = Intersection.Utils.bezout (a, b);
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
    };


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
    Intersection.intersectEllipseLine = function(c, rx, ry, a1, a2) {
        var result;
        var origin = new Vector2D(a1.x, a1.y);
        var dir    = Vector2D.fromPoints(a1, a2);
        var center = new Vector2D(c.x, c.y);
        var diff   = origin.subtract(center);
        var mDir   = new Vector2D( dir.x/(rx*rx),  dir.y/(ry*ry)  );
        var mDiff  = new Vector2D( diff.x/(rx*rx), diff.y/(ry*ry) );

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
    };


    /**
     *  intersectLineLine
     *
     *  @param {Point2D} a1
     *  @param {Point2D} a2
     *  @param {Point2D} b1
     *  @param {Point2D} b2
     *  @returns {Intersection}
     */
    Intersection.intersectLineLine = function(a1, a2, b1, b2) {
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
    };


    /**
     *  intersectRayRay
     *
     *  @param {Point2D} a1
     *  @param {Point2D} a2
     *  @param {Point2D} b1
     *  @param {Point2D} b2
     *  @returns {Intersection}
     */
    Intersection.intersectRayRay = function(a1, a2, b1, b2) {
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
    };

    ///////////////////////////////////////////////////////////////////
    Intersection.Utils = {};
    ///////////////////////////////////////////////////////////////////

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
    Intersection.Utils.bezout = function (e1, e2) {
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
    };

    ///////////////////////////////////////////////////////////////////
    /**
        intended for removal of multiple "identical" root copies, when roots are in interval [0,1]
    
        @param {Array<Number>} roots - will be modified, almost identical root copies will be removed
    */
    Intersection.Utils.removeMultipleRootsIn01 = function (roots) {
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
    };

    ///////////////////////////////////////////////////////////////////
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
    Intersection.Utils.removePointsNotInArc = function (intersection, c, rx, ry, phi, th1, dth, m) {
        if (intersection.points.length === 0) return intersection;
        if (m && !m.isIdentity())
            var mp = m.inverse();
        var np = [];
        var vx = new Vector2D(1, 0);
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
            a = vx.transform(m3).angleBetween(Vector2D.fromPoints(c, (mp) ? p.transform(mp) : p));
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
    };

    ///////////////////////////////////////////////////////////////////
    /**
        points1 will be modified, points close (almost identical) to any point in points2 will be removed

        @param {Array<Point2D>} points1 - will be modified, points close to any point in points2 will be removed
        @param {Array<Point2D>} points2
    */
    Intersection.Utils.removeClosePoints = function (points1, points2) {
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
    };

    return Intersection;
}));
});

// expose module classes

var Intersection = Intersection$1;
var IntersectionParams$1 = IntersectionParams$2;

// expose affine module classes
var Point2D$1 = kldAffine.Point2D;

var index = {
	Intersection: Intersection,
	IntersectionParams: IntersectionParams$1,
	Point2D: Point2D$1
};

exports['default'] = index;
exports.Intersection = Intersection;
exports.IntersectionParams = IntersectionParams$1;
exports.Point2D = Point2D$1;

}((this.kldIntersections = this.kldIntersections || {}),GLOBAL.kldAffine,GLOBAL.kldPolynomial));

  if (typeof module !== "undefined" && typeof require === "function") module.exports = GLOBAL.kldIntersections;
})();