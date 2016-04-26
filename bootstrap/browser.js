System.import("lively.modules")
  .then((m) => {
    log("lively.modules loaded")
    var livelyModulesDir = System.map["lively.modules"];
    var S = window.System = m.System;
    return m.registerPackage(livelyModulesDir)
      .then(() => S.import(livelyModulesDir + "/index.js"))
      .then(m => {
        log("Successfully bootstrapped lively.modules \n" + Object.keys(m));
        if (!window.lively) window.lively = {};
        window.lively.modules = m;
        
        installInLively();
      });
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
  var logEl = document.querySelector("#log");
  if (logEl) {
    var stringified = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
    logEl.insertAdjacentHTML("beforeend", '<li><pre>' + stringified + '</li>');
  }
}


function installInLively() {
  // FIXME this should go into the lively.modules integration...
  if (typeof lively !== "undefined" && lively.whenLoaded) {
    lively.whenLoaded(() => {
      if (!lively.modules.isHookInstalled("lively_protocol_fetch")) {
        // lively.modules.removeHook("fetch", "lively_protocol_fetch");
        lively.modules.installHook("fetch", function lively_protocol_fetch(proceed, load) {
          if (load.name.startsWith("lively://")) {
            var match = load.name.match(/lively:\/\/([^\/]+)\/(.*)$/),
                worldId = match[1], localObjectName = match[2];
            return (typeof $morph !== "undefined" && $morph(localObjectName) && $morph(localObjectName).textString)
                || `/*Could not locate ${load.name}*/`;
          }
          return proceed(load);
        });
      }
    });
  }
}