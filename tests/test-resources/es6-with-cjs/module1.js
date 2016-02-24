var loaded = false;

System.import("./tests/test-resources/es6/module1.js")
  .then(() => loaded = true)
  .catch(err => console.error(err.stack || err))

exports.x = 1;