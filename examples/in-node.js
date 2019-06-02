var vm = require("../dist/lively.vm.js")

vm.runEval("1 + 2")
  .then(result => console.log(`1 + 2 = ${JSON.stringify(result, null, 2)}`))
  .catch(err => console.error(err.stack));
  