/*global require,module,__dirname*/
var Browserify = require("browserify");
var path = require('path');
var fs = require('fs');
var Module = require('module');
var flatn = require('flatn');
require('flatn/module-resolver.js');

const npmPaths = require.resolve.paths('.').sort((a,b) => a.length - b.length),
      flatnPaths = flatn.packageDirsFromEnv().packageCollectionDirs;

function versionify(id) {
  let cfg;
  for (let prefix of [...npmPaths, ...flatnPaths]) {
    if (id.startsWith(prefix)) {
      const splitId = id.replace(prefix, '').split('/');
      const pkgPath = prefix + splitId[1] + '/package.json';
      if (fs.existsSync(pkgPath)) {
         cfg = JSON.parse(fs.readFileSync(pkgPath));
         return [splitId[0], cfg.version, ...splitId.slice(1)].join('/');
      }
      return splitId.join('/');
    }
  }
  return id;
}

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
            let browserifyMod = parent.modules[id],
                origId = id;
            // shim module resolution
            if (browserifyMod) {
              if (!fs.existsSync(browserifyMod)) {
                 browserifyMod = Module._resolveFilename(path.dirname(browserifyMod));
              }
              browserifyMod = resolveToBrowserVersion(browserifyMod);
              // console.log(origId, '=>', versionify(browserifyMod));
              return resolve(browserifyMod, parent, cb);
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
            id = Module._resolveFilename(id, parent);
            if (!fs.existsSync(id)) {
              id = Module._resolveFilename(path.dirname(id), parent);
            }
            id = resolveToBrowserVersion(id);
            // console.log(origId, '=>', versionify(id));
            resolve(id, parent, cb);
        };
    }(b._bresolve));
  
  b.add(require.resolve("pouchdb-adapter-memory"));
  b.bundle(function(err, buf) {
    if (err) return reject(err);
    require("fs").writeFileSync(require("path").join(__dirname, "../dist/pouchdb-adapter-mem.js"), String(buf));
    resolve(String(buf))
  });
});
