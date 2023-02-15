/**
 * Utility functions for JS Numbers.
 * @module lively.lang/number
 */

/**
 * Returns a random number between (and including) `min` and `max`.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function random (min, max) {
  min = min || 0;
  max = max || 100;
  return Math.round(Math.random() * (max - min) + min);
}

/**
 * Returns randomized numbers in a normal distribution that can be
 * controlled using the `mean` and `stdDev` parameters
 * @param {number} mean - Mean of the distribution to use
 * @param {number} stdDev - Standard deviation of the distribution to use
 * @returns {number}
 */
function normalRandom (mean, stdDev) {
  let spare; let isSpareReady = false;
  return function (mean, stdDev) {
    if (isSpareReady) {
      isSpareReady = false;
      return spare * stdDev + mean;
    } else {
      let u, v, s;
      do {
        u = Math.random() * 2 - 1;
        v = Math.random() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const mul = Math.sqrt(-2.0 * Math.log(s) / s);
      spare = v * mul;
      isSpareReady = true;
      return mean + stdDev * u * mul;
    }
  };
}

/**
 * Returns a random, whole number smaller than `n`
 * @param {number} n - Exclkusive upper bound of the number to return
 * @returns {number}
 */
function randomSmallerInteger (n) { return Math.floor(Math.random() * n); }

/**
 * Interpret `n` as byte size and return a more readable version.
 * E.g. `num.humanReadableByteSize(Math.pow(2,32))` returns "4096MB"
 *  @param {number} n - The number of bytes
 * @returns {string}
 */
function humanReadableByteSize (n) {
  function round (n) { return Math.round(n * 100) / 100; }
  if (n < 1000) return String(round(n)) + 'B';
  n = n / 1024;
  if (n < 1000) return String(round(n)) + 'KB';
  n = n / 1024;
  return String(round(n)) + 'MB';
}

/**
 * Returns the average of the numbers contained in the array `numbers`
 * @param {number[]} numbers
 * @returns {number}
 */
function average (numbers) {
  return numbers.reduce(function (sum, n) { return sum + n; }, 0) / numbers.length;
}

/**
 * Returns the increase of the average of a (hypothetical) colletion when `newVal` would be added to the collection.
 * @param {number} newVal - The value to "add" to the collection
 * @param {number} oldAvg - Average of a collection
 * @param {number} n  - Number of elements in the collection
 * @returns {number}
 */
function averageInc (newVal, oldAvg, n) {
  return (newVal - oldAvg) / n + oldAvg;
}

/**
 * Returns the median of the numbers contained in the array `numbers`
 * @param {numbers[]} numbers
 * @returns {number}
 */
function median (numbers) {
  const sorted = numbers.sort(function (a, b) { return b - a; });
  const len = numbers.length;
  return len % 2 === 0
    ? 0.5 * (sorted[len / 2 - 1] + sorted[len / 2])
    : sorted[(len - 1) / 2];
}

/**
 * Returns wether `x` is between `a` and `b` and keeps `eps` distance from both of them.
 * @param {number} x - The number that should be between two bounds
 * @param {number} a - One bound (can be upper or lower)
 * @param {number} b - Another bound (can be upper or lower)
 * @param {number} eps - Epsilon value that indicates the distance that should be kept from the boundaries
 * @returns {boolean}
 */
function between (x, a, b, eps) {
  eps = eps || 0;
  let min, max;
  if (a < b) { min = a, max = b; } else { max = a, min = b; }
  return (max - x + eps >= 0) && (min - x - eps <= 0);
}

/**
 * Clamps `x` between `lower` and `upper`, i.e. if `x` is smaller than `lower`, return `lower`. If it is higher than `upper` return `upper`. If `x` is between `lower` and `upper`, `x` is returned.
 * @param {number} x - The number to clamp
 * @param {number} lower - The lower bound
 * @param {number} upper - The upper bound
 * @returns {number}
 */
function clamp (x, lower, upper) {
  return Math.max(lower, Math.min(upper, x));
}

/**
 * Numerically sort an array of numbers `arr`.
 * By default, JavaScripts `sort()` is lexically.
 * @param {number[]} arr
 * @returns {number[]}
 */
function sort (arr) {
  return arr.sort(function (a, b) { return a - b; });
}

/**
 * This converts the length value `string` to pixels or the specified `toUnit`.
 *
 * Supported units are: mm, cm, in, px, pt, pc.
 * @param {string} string - A string denoting a length (e.g. `'3cm'`)
 * @param {string} toUnit - A string denoting a supported unit (e.g. `'mm'`)
 * @returns {number}
 */
function parseLength (string, toUnit) {
  toUnit = toUnit || 'px';
  const match = string.match(/([0-9\.]+)\s*(.*)/);
  if (!match || !match[1]) return undefined;
  const length = parseFloat(match[1]);
  const fromUnit = match[2];
  return convertLength(length, fromUnit, toUnit);
}

const convertLength = (function () {
  function toCm (n, unit) {
    // as defined in http://www.w3.org/TR/css3-values/#absolute-lengths
    if (unit === 'cm') return n;
    else if (unit === 'mm') return n * 0.1;
    else if (unit === 'in') return n * 2.54;
    else if (unit === 'px') return n * toCm(1 / 96, 'in');
    else if (unit === 'pt') return n * toCm(1 / 72, 'in');
    else if (unit === 'pc') return n * toCm(12, 'pt');
  }
  return function to (length, fromUnit, toUnit) {
    if (fromUnit === toUnit) return length;
    else if (toUnit === 'cm') return toCm(length, fromUnit);
    else if (fromUnit === 'cm') return length / toCm(1, toUnit);
    else return to(to(length, fromUnit, 'cm'), 'cm', toUnit);
  };
})();

/**
 * Given a float value `f`, returns the number of decimals it has.
 * @param {number} f
 * @returns {number}
 */
function precision (f) {
  if (!isFinite(f)) return 0;
  let e = 1; let p = 0;
  while (Math.round(f * e) / e !== f) { e *= 10; p++; }
  return p;
}

/**
 * Rounds a number `n` with `quantum` used as precision.
 * @param {number} n - The number to round
 * @param {number} quantum - e.g. 0.01
 * @returns {number}
 */
function roundTo (n, quantum) {
  // for JS rounding to work we need the reciprocal
  quantum = 1 / quantum;
  return Math.round(n * quantum) / quantum;
}

/**
 * This function is useful to implement smooth transitions and snapping.
 *
 * Map all values that are within `detent/2` of any multiple of `grid` to
 * that multiple. Otherwise, if `snap` is true, return self, meaning that
 * the values in the dead zone will never be returned.
 *
 * If `snap` is false, then expand the range between dead zone so that
 * it covers the range between multiples of the grid, and scale the value
 * by that factor.
 *
 * Examples:
 * ```
 * // With snapping:
 * num.detent(0.11, 0.2, 0.5, true) => 0.11
 * num.detent(0.39, 0.2, 0.5, true) => 0.39
 * num.detent(0.55, 0.2, 0.5, true) => 0.5
 * num.detent(0.61, 0.2, 0.5, true) => 0.61
 * // Smooth transitions without snapping:
 * num.detent(0.1,  0.2, 0.5) => 0
 * num.detent(0.11,  0.2, 0.5) => 0.0166666
 * num.detent(0.34,  0.2, 0.5)  => 0.4
 * num.detent(0.39,  0.2, 0.5) => 0.4833334
 * num.detent(0.4,  0.2, 0.5) => 0.5
 * num.detent(0.6,  0.2, 0.5) => 0.5
 * ```
 * @param {number} n - The number to detent
 * @param {number} detent - The width of the 'dead zone' around the grid
 * @param {number} grid - The width of the grid
 * @param {boolean} snap - Wether snapping is active
 * @returns {number}
 */
function detent (n, detent, grid, snap) {
  const r1 = roundTo(n, grid); // Nearest multiple of grid
  if (Math.abs(n - r1) < detent / 2) return r1; // Snap to that multiple...
  if (snap) return n; // ...and return n
  // or compute nearest end of dead zone
  const r2 = n < r1 ? r1 - (detent / 2) : r1 + (detent / 2);
  // and scale values between dead zones to fill range between multiples
  return r1 + ((n - r2) * grid / (grid - detent));
}

/**
 * Returns `n` radians converted to degrees.
 * @param {number} n - A value in radiants
 * @returns {number}
 */
function toDegrees (n) {
  return (n * 180 / Math.PI) % 360;
}

/**
 * Returns `n` degrees converted to radiants.
 * @param {number} n - A value in degrees
 * @returns {number}
 */
function toRadians (n) {
  return n / 180 * Math.PI;
}

/**
 * Calculates the waiting time for `attempt` according to [exponential backoff](https://www.awsarchitectureblog.com/2015/03/backoff.html).
 * @param {number} attempt - Number of attempt
 * @param {number} base - Wait time for the first try
 * @param {number} cap - Maximum waiting time
 * @returns {number}
 */
function backoff (attempt, base = 5/* ms */, cap = 30000/* ms */) {
  const temp = Math.min(cap, base * Math.pow(2, attempt));
  const sleep = temp / 2 + Math.round(Math.random() * (temp / 2));
  return Math.min(cap, base + (Math.random() * (sleep * 3 - base)));
}

/**
 * Linearly interpolates between `a` and `b` to `i` percent.
 * @param {number} i - Percentage to which the interpolation is done
 * @param {number} a - Start value of the interpolation
 * @param {number} b - End value of the interpolation
 * @returns {number}
 */
function interpolate (i, a, b) { return a + (i * (b - a)); }

export {
  random,
  normalRandom,
  randomSmallerInteger,
  humanReadableByteSize,
  average,
  averageInc,
  median,
  between,
  sort,
  parseLength,
  convertLength,
  roundTo,
  detent,
  toDegrees,
  toRadians,
  backoff,
  interpolate,
  clamp,
  precision
};
