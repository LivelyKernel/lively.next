var fs = require("fs");
var lang = require("lively.lang");
var estree = require("estree-to-js");
var estreeVisitor = "generated/estree-visitor.js";

function createEstreeVisitorModule() {
  var estreeSpec = JSON.parse(fs.readFileSync(require.resolve("estree-to-js/generated/es6.json"))),
      source = estree.createVisitor(estreeSpec, []/*exceptions*/, "Visitor") + "\nmodule.exports = Visitor;"
  return lang.promise(fs.writeFile)(estreeVisitor, source);
}

createEstreeVisitorModule();
