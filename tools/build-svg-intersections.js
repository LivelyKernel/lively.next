/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var commonjs = require('rollup-plugin-commonjs');

var targetFile = "dist/svg-intersections.js",
    kldAffine, kldPolynomial, bezier;

module.exports = Promise.resolve()
 .then(() => rollup.rollup({
   entry: "node_modules/svg-intersections/node_modules/kld-affine/index.js",
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
    entry: "node_modules/svg-intersections/node_modules/kld-polynomial/index.js",
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
    entry: "node_modules/svg-intersections/lib/functions/bezier.js",
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
      moduleName: 'bezier',
    }))
  .then(bundled => { bezier = bundled.code })
  .then(() => rollup.rollup({
    entry: "node_modules/svg-intersections/index.js",
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
      moduleName: 'svgIntersections',
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
  var roots;
  ${kldAffine}
  ${kldPolynomial}
  ${bundled.code}
  ${bezier}
  if (typeof module !== "undefined" && typeof require === "function") {
     module.exports = GLOBAL.svgIntersections;
     module.exports.bezier = GLOBAL.bezier;
  }
})();`;
  })

  // 4. create files
  .then(source => {
    fs.writeFileSync(targetFile, source);
  })

  .catch(err => console.error(err));
