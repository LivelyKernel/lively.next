/*global require,module,__dirname*/
var Browserify = require("browserify");
var babel = require('babel-core');

module.exports = new Promise(function(resolve, reject) {
  var b = Browserify({standalone: "pouchdb-adapter-memory"});

  b.add(require.resolve("pouchdb-adapter-memory"));
  b.bundle(function(err, buf) {
    if (err) return reject(err);
    let code = String(buf);
    // transpile to es5
    let options = {
      sourceMap: undefined, // 'inline' || true || false
      inputSourceMap: undefined,
      babelrc: false,
      presets: [[require.resolve("babel-preset-es2015"), {"modules": false}]],
      plugins: ['babel-plugin-transform-exponentiation-operator', 'babel-plugin-transform-async-to-generator',
                'babel-plugin-syntax-object-rest-spread', 'babel-plugin-transform-object-rest-spread'].map(name => require.resolve(name)),
      code: true,
      ast: false
    };
    code = babel.transform(code, options).code;
    require("fs").writeFileSync(require("path").join(__dirname, "../dist/pouchdb-adapter-mem.js"), code);
    resolve(String(buf))
  });
});
