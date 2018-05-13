var Browserify = require("browserify");
var path = require('path');
var fs = require('fs');

function getPackageConfig(modulePath) {
  let pkgPath = path.dirname(modulePath) + '/package.json';
   if (fs.existsSync(pkgPath)) {
     return JSON.parse(fs.readFileSync(pkgPath));
   }
}

function resolveToBrowserVersion(modulePath) {
  let config = getPackageConfig(modulePath);
  if (config && config.browser && typeof config.browser == 'string') {
     return path.resolve(path.dirname(modulePath), config.browser);
  }
  return modulePath
}

module.exports = new Promise(function(resolve, reject) {
  var b = Browserify({standalone: "pouchdb-adapter-memory"});

   b._bresolve = (function (resolve) {
        return function (id, parent, cb) {
            let browserifyMod = parent.modules[id];
            // shim module resolution
            if (browserifyMod) {
              if (!fs.existsSync(browserifyMod)) {
                 browserifyMod = require.resolve(path.dirname(browserifyMod));
              }
              return resolve(resolveToBrowserVersion(browserifyMod), parent, cb);
            }
            // relative module resolution
            if (id.includes('./') && !path.isAbsolute(id)) {
              // check for browser specific remapping as well
              let config = getPackageConfig(parent.id);
              if (config && config.browser && config.browser[id + '.js']) {
                id = config.browser[id + '.js'];
              }
              id = path.resolve(path.dirname(parent.id), id);
               
            }
             // external module resolution
            id = require.resolve(id);
            if (!fs.existsSync(id)) {
              id = require.resolve(path.dirname(id));
            }
            resolve( resolveToBrowserVersion(id), parent, cb);
        };
    }(b._bresolve));
  
  b.add(require.resolve("pouchdb-adapter-memory"));
  b.bundle(function(err, buf) {
    if (err) return reject(err);
    require("fs").writeFileSync(require("path").join(__dirname, "../dist/pouchdb-adapter-mem.js"), String(buf));
    resolve(String(buf))
  });
});
