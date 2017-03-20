module.exports = new Promise(function(resolve, reject) {
  var b = require("browserify")({standalone: "pouchdb-adapter-memory"});
  b.add(require.resolve("pouchdb-adapter-memory"));
  b.bundle(function(err, buf) {
    if (err) return reject(err);
    require("fs").writeFileSync(require("path").join(__dirname, "../dist/pouchdb-adapter-mem.js"), String(buf));
    resolve(String(buf))
  });
});