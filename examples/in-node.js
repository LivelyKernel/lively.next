require("systemjs")
require("../node_modules/lively.ast/dist/lively.ast.js")
require("../dist/lively.vm.js")

lively.vm.runEval("1 + 2")
  .then(result => console.log(`1 + 2 = ${JSON.stringify(result, null, 2)}`))
  .catch(err => console.error(err.stack));
  