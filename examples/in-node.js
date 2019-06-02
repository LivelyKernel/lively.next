var ast = require("../dist/lively.ast.js");

console.log(ast.stringify(ast.parse("1+2")));

console.log(ast.query.topLevelDeclsAndRefs(ast.parse("this.x = foo")));
