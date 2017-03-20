module.exports = new Promise(function(resolve, reject) {
  var b = require("browserify")({standalone: "pouchdb-adapter-mem"});
  b.add(require.resolve("pouchdb-adapter-memory"));
  b.bundle(function(err, buf) {
    if (err) reject(err);
    else resolve(String(buf))
  });
});