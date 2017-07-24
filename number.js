/*
 * Utility functions for JS Numbers.
 */

function random(min, max) {
  // random number between (and including) `min` and `max`
  min = min || 0;
  max  = max || 100;
  return Math.round(Math.random() * (max-min) + min)
}

var normalRandom = (function(mean, stdDev) {
  // returns randomized numbers in a normal distribution that can be
  // controlled ising the `mean` and `stdDev` parameters
  var spare, isSpareReady = false;
  return function(mean, stdDev) {
    if (isSpareReady) {
      isSpareReady = false;
      return spare * stdDev + mean;
    } else {
      var u, v, s;
      do {
        u = Math.random() * 2 - 1;
        v = Math.random() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s == 0);
      var mul = Math.sqrt(-2.0 * Math.log(s) / s);
      spare = v * mul;
      isSpareReady = true;
      return mean + stdDev * u * mul;
    }
  }
})();

function randomSmallerInteger (n) { return Math.floor(Math.random() * n); }

function humanReadableByteSize(n) {
  // interpret `n` as byte size and print a more readable version
  // Example:
  //   num.humanReadableByteSize(Math.pow(2,32)) // => "4096MB"
  function round(n) { return Math.round(n * 100) / 100 }
  if (n < 1000) return String(round(n)) + 'B'
  n = n / 1024;
  if (n < 1000) return String(round(n)) + 'KB'
  n = n / 1024;
  return String(round(n)) + 'MB'
}

function average(numbers) {
  // show-in-doc
  return numbers.reduce(function(sum, n) { return sum + n; }, 0) / numbers.length;
}

function averageInc(newVal, oldAvg, n) {
  // show-in-doc
  // Example:
  //   let nums = range(0, 10).map(() => random(0, 10))
  //   nums.reduce((avg, ea, i) => avgInc(ea, avg, i+1), 0);
  return (newVal - oldAvg)/n + oldAvg;
}

function median(numbers) {
  // show-in-doc
  var sorted = numbers.sort(function(a,b) { return b - a; }),
      len = numbers.length;
  return len % 2 === 0 ?
    0.5 * (sorted[len/2-1] + sorted[len/2]) :
    sorted[(len-1)/2];
}

function between(x, a, b, eps) {
  // is `a` <= `x` <= `y`?
  eps = eps || 0;
  var min, max;
  if (a < b) { min = a, max = b }
  else { max = a, min = b }
  return (max - x + eps >= 0) && (min - x - eps <= 0);
}

function sort(arr) {
  // numerical sort, JavaScript native `sort` function is lexical by default.
  return arr.sort(function(a,b) { return a-b; });
}

function parseLength(string, toUnit) {
  // This converts the length value to pixels or the specified `toUnit`.
  // length converstion, supported units are: mm, cm, in, px, pt, pc
  // Examples:
  // num.parseLength('3cm') // => 113.38582677165354
  // num.parseLength('3cm', "in") // => 1.1811023622047243
  toUnit = toUnit || 'px'
  var match = string.match(/([0-9\.]+)\s*(.*)/);
  if (!match || !match[1]) return undefined;
  var length = parseFloat(match[1]),
    fromUnit = match[2];
  return convertLength(length, fromUnit, toUnit);
}

var convertLength = (function() {
  // ignore-in-doc
  // num.convertLength(20, 'px', 'pt').roundTo(0.01)
  function toCm(n, unit) {
    // as defined in http://www.w3.org/TR/css3-values/#absolute-lengths
    if (unit === 'cm') return n;
    else if (unit === 'mm') return n*0.1;
    else if (unit === 'in') return n*2.54;
    else if (unit === 'px') return n*toCm(1/96, 'in');
    else if (unit === 'pt') return n*toCm(1/72, 'in');
    else if (unit === 'pc') return n*toCm(12, 'pt');
  }
  return function to(length, fromUnit, toUnit) {
    if (fromUnit === toUnit) return length;
    else if (toUnit === "cm") return toCm(length, fromUnit);
    else if (fromUnit === "cm") return length / toCm(1, toUnit);
    else return to(to(length, fromUnit, 'cm'), 'cm', toUnit);
  }
})();

function roundTo(n, quantum) {
  // `quantum` is something like 0.01,

  // for JS rounding to work we need the reciprocal
  quantum = 1 / quantum;
  return Math.round(n * quantum) / quantum;
}

function detent(n, detent, grid, snap) {
  // This function is useful to implement smooth transitions and snapping.
  // Map all values that are within detent/2 of any multiple of grid to
  // that multiple. Otherwise, if snap is true, return self, meaning that
  // the values in the dead zone will never be returned. If snap is
  // false, then expand the range between dead zone so that it covers the
  // range between multiples of the grid, and scale the value by that
  // factor.
  // Examples:
  // // With snapping:
  // num.detent(0.11, 0.2, 0.5, true) // => 0.11
  // num.detent(0.39, 0.2, 0.5, true) // => 0.39
  // num.detent(0.55, 0.2, 0.5, true)  // => 0.5
  // num.detent(0.61, 0.2, 0.5, true)   // => 0.61
  // // Smooth transitions without snapping:
  // num.detent(0.1,  0.2, 0.5) // => 0
  // num.detent(0.11,  0.2, 0.5) // => 0.0166666
  // num.detent(0.34,  0.2, 0.5)  // => 0.4
  // num.detent(0.39,  0.2, 0.5) // => 0.4833334
  // num.detent(0.4,  0.2, 0.5) // => 0.5
  // num.detent(0.6,  0.2, 0.5) // => 0.5
  var r1 = roundTo(n, grid); // Nearest multiple of grid
  if (Math.abs(n - r1) < detent / 2) return r1; // Snap to that multiple...
  if (snap) return n // ...and return n
  // or compute nearest end of dead zone
  var r2 = n < r1 ? r1 - (detent / 2) : r1 + (detent / 2);
  // and scale values between dead zones to fill range between multiples
  return r1 + ((n - r2) * grid / (grid - detent));
}

function toDegrees(n) {
  // Example:
  // num.toDegrees(Math.PI/2) // => 90
  return (n * 180 / Math.PI) % 360;
}

function toRadians(n) {
  // Example:
  // num.toRadians(180) // => 3.141592653589793
  return n / 180 * Math.PI;
}

function backoff(attempt, base = 5/*ms*/, cap = 30000/*ms*/) {
  // exponential backoff function
  // https://www.awsarchitectureblog.com/2015/03/backoff.html
  let temp = Math.min(cap, base * Math.pow(2, attempt)),
      sleep = temp / 2 + Math.round(Math.random() * (temp / 2));
  return Math.min(cap, base + (Math.random() * (sleep*3-base)));
}

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
  backoff
}
