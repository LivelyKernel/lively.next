var show = console.log;

var testEval = "Object.keys(currentSystem().__lively_vm__.loadedModules)";

require("./index-node.js").bootstrap()
  .then(vm => {
    show("lively.vm bootstrapped...!");
    return vm.es6.runEval(testEval, {targetModule: "lively.vm/lib/es6-interface.js"})
  })
  .then(result => {
    if (result.error || result.value instanceof Error) throw (result.error || result.value);
    show(testEval + " => ", result.value);
    show("DONE")
  })
  .catch(err => {
    if (err.originalErr) err = err.originalErr;
    show(err.stack);
    console.error(err.stack);
  });
