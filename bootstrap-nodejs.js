require("./index-node.js").load()
  .then(vm => vm.bootstrap())
  .then(vm => {
    console.log("lively.vm bootstrapped...!");
    return vm.es6.runEval("Object.keys(currentSystem().__lively_vm__.loadedModules)", {targetModule: "./lib/es6-interface.js"})
  })
  .then(result => console.log(result)) // load check
  .then(() => console.log("DONE"))
  .catch(err => console.error(err.stack || err));
