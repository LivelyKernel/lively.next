// require("./index-node.js").load()
//   .then(vm => vm.bootstrap(() => System._nodeRequire(__dirname + "/index-node").configure()))
//   .then(vm => {
//     console.log("lively.vm bootstrapped...!");
//     return vm.es6.runEval("Object.keys(currentSystem().__lively_vm__.loadedModules)", {targetModule: "./lib/es6-interface.js"})
//   })
//   .then(result => console.log(result)) // load check
//   .then(() => console.log("DONE"))
//   .catch(err => console.error(err.stack || err));

var show = console.log;

require("./index-node.js").bootstrap()
  .then(vm => {
    show("lively.vm bootstrapped...!");
    return vm.es6.runEval("Object.keys(currentSystem().__lively_vm__.loadedModules)", {targetModule: "lively.vm/lib/es6-interface.js"})
  })
  .then(result => {
    show(result);
    show("DONE")
  })
  .catch(err => {
    if (err.originalErr) err = err.originalErr;
    show(err.stack);
    console.error(err.stack);
  });
