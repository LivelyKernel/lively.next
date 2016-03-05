var System = require("systemjs");
var conf = require("../dist/es6-runtime-config.json");
conf = JSON.parse(JSON.stringify(conf).replace(/__AST_DIR__/g, "./"));
System.config(conf);
System.import("lively.ast")
  .then(ast => {
    console.log(ast.fuzzyParse("1+3 0"));
    console.log(ast.stringify(ast.parse("1+3")));
    console.log("DONE");
  }).catch(err => console.error("ERROR", err));
