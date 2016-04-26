require("../load-from-source.js");


System.import("lively.modules")
  .then((m) => {
    log("lively.modules loaded")
    var livelyModulesDir = System.baseURL;
    var S = global.System = m.System;
    return m.registerPackage(livelyModulesDir)
      .then(() => S.import(livelyModulesDir + "/index.js"))
      .then(module => log("Successfully bootstrapped lively.modules \n" + Object.keys(module)))
      .catch(err => log(String(err)))
  })
  .catch(err => {
    if (err.originalErr) log(err.originalErr.stack);
    log(err.stack || err);
    log(systemConfPrint());
  })

function systemConfPrint() {
  var S = System;
  var json = {
    baseURL: S.baseURL,
    transpiler: S.transpiler,
    defaultJSExtensions: S.defaultJSExtensions,
    map: S.map,
    meta: S.meta,
    packages: S.packages,
    paths: S.paths,
    packageConfigPaths: S.packageConfigPaths,
  }
  return JSON.stringify(json, null, 2);
}


function log(msg) {
  console.log(msg);
  var stringified = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
}
