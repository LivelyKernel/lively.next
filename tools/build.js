/*global require, process*/

var fs = require("fs"),
    path = require("path"),
    rollup = require('rollup'),
    babel = require('rollup-plugin-babel');

var targetFile = "dist/lively.lang.js", langSource;

// output format - 'amd', 'cjs', 'es6', 'iife', 'umd'

module.exports = Promise.resolve()

  // 2. bundle local esm modules
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      babel({
        exclude: 'node_modules/**',
        sourceMap: false,
        "presets": [["es2015", {modules: false}]],
        "plugins": ["syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"]
    })]
  }))

  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.lang'
    }))

  // 3. inject dependencies
  .then(bundled => fs.writeFileSync(targetFile, bundled.code))
  .then(() => console.log(`lively.lang bundled into ${process.cwd()}/${targetFile}`))
  .catch(err => { console.error(err.stack || err); throw err; });
