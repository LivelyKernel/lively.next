/*
Integration helpers to make lively.system work with old LivelyKernel installs.
*/

export function bootstrapLivelySystem() {
  // for loading an instrumented version of the packages comprising the lively.system
  var indicator;
  return Promise.resolve()
  .then(() => lively.ide.withLoadingIndicatorDo("bootstrapping"))
  .then(i => indicator = i)
  .then(() => lively.modules.importPackage("node_modules/lively-system-interface"))
  .then(() => System.import("lively-system-interface/lively-kernel-extensions.js"))
  .then(() => lively.modules.removePackage(URL.root.join("node_modules/lively.modules").toString()))
  .then(() => lively.modules.importPackage("lively.lang").then(m => {
    delete m._prevLivelyGlobal
    // lively.lang = m;
  }))
  .then(() => lively.modules.importPackage("lively.ast").then(m => {
    lively.ast = m;
  }))
  .then(() => lively.modules.importPackage("lively.vm").then(m => {
    lively.vm = m;
    lively.lang.VM = m;
  }))
  .then(() => lively.modules.importPackage("lively.modules").then(m => {
    lively.modules = m;
    lively.modules.unwrapModuleLoad(); lively.modules.wrapModuleLoad();
  }))
  .then(() => show("lively.system bootstrapped!"))
  .catch(err => $world.logError(err))
  .then(() => indicator.remove());
}

  // bootstrapLivelySystem().then(() => 
  //   delete lively.lang._prevLivelyGlobal)

// reloadLivelySystem()
export function reloadLivelySystem() {
  // Ensures that a bootstrapped lively.system is removed from the runtime

  var indicator;
  return Promise.resolve()
  .then(() => lively.ide.withLoadingIndicatorDo("reloading..."))
  .then(i => indicator = i)
  .then(() => {

    // delete window.System;
    // delete window.lively.lang;
    delete window.lively.ast;
    delete window.lively.modules;
    delete window.lively.vm;
    delete window.lively.lang.vm;
  
    var libs = [
      "node_modules/lively.modules/node_modules/systemjs/dist/system.src.js", 
      "node_modules/lively.lang/dist/lively.lang.js", 
      "node_modules/lively.ast/dist/lively.ast_no-deps.js", 
      "node_modules/lively.vm/dist/lively.vm_no-deps.js",
      "node_modules/lively.modules/dist/lively.modules_no-deps.js", 
    ];
  
    var tests = [
      () => typeof System !== "undefined",
      () => typeof lively.lang !== "undefined",
      () => typeof lively.ast !== "undefined",
      () => typeof lively.vm !== "undefined",
      () => typeof lively.modules !== "undefined",
    ]

    return lively.lang.promise.chain(
      libs
        .map(path => lively.Config.rootPath + path)
        .map((url, i) => () => {
          JSLoader.forcedReload(url);
          return lively.lang.promise.delay(400)
            .then(() => lively.lang.promise.waitFor(tests[i]));
        }));
  })
  .then(() => {
    (function fixModulesForOldLivelyModuleSystem() {
      delete lively.lang._prevLivelyGlobal;

      var vm = lively.vm;
      delete lively.vm;
      lively.vm = Object.assign(module("lively.vm"), vm);
      lively.lang.VM = lively.vm;
      lively.vm.isLoaded == lively.lang.fun.True;
  
      var ast = lively.ast, acorn = ast.acorn;
      delete lively.ast;
      Object.assign(module("lively.ast"), ast, {acorn: Object.assign(module("lively.ast.acorn"), acorn)});
      module("lively.ast").isLoaded = lively.lang.fun.True;
      module("lively.ast.acorn").isLoaded = lively.lang.fun.True;
    })();
  })
  .then(() => show("lively.system core reloaded"))
  .then(() => bootstrapLivelySystem())
  // .then(() => $world.onLoad())
  .catch(err => $world.logError(err))
  .then(() => indicator.remove());

}
