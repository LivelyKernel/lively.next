/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var commonjs = require('rollup-plugin-commonjs');

var targetFile = "dist/kld-intersections.js",
    kldAffine, kldPolynomial;

module.exports = Promise.resolve()
 .then(() => rollup.rollup({
   entry: "node_modules/kld-intersections/node_modules/kld-affine/index.js",
   plugins: [
     commonjs({
     ignoreGlobal: false,
     sourceMap: false,
   })]
 }))
 .then(bundle =>
   bundle.generate({
     format: 'iife',
     moduleName: 'kldAffine',
   }))
  .then(bundled => { kldAffine = bundled.code })
  .then(() => rollup.rollup({
    entry: "node_modules/kld-intersections/node_modules/kld-polynomial/index.js",
    plugins: [
      commonjs({
      ignoreGlobal: false,
      sourceMap: false,
    })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'kldPolynomial',
    }))
   .then(bundled => { kldPolynomial = bundled.code })
  .then(() => rollup.rollup({
    entry: "node_modules/kld-intersections/index.js",
    plugins: [
      commonjs({
      include: ["lib/**", "node_modules/**"],
      ignoreGlobal: false,
      sourceMap: false,
    })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'kldIntersections',
      globals: {
        "kld-affine": 'GLOBAL.kldAffine',
        "kld-polynomial": 'GLOBAL.kldPolynomial',
        "Point2D": "GLOBAL.Point2D"
      }
    }))
  .then(bundled => {
    return `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${kldAffine}
  const Point2D = GLOBAL.kldAffine.Point2D;
  ${kldPolynomial}
  ${bundled.code}
  if (typeof module !== "undefined" && typeof require === "function") module.exports = GLOBAL.kldIntersections;
})();`;
  })

  // 4. create files
  .then(source => {
    fs.writeFileSync(targetFile, source);
  })

  .catch(err => console.error(err));
