import { Path } from "lively.lang";
import { parse, query } from "lively.ast";

export async function extractTestDescriptors(sourceOrAst, positionAsIndex) {
  // Expects mocha.js like test definitions: https://mochajs.org/#getting-started
  // Extracts nested "describe" and "it" suite and test definitions from the
  // source code and associates setup (before(Each)) and tear down (after(Each))
  // code with them. Handy to run tests at point etc.

  var parsed = typeof sourceOrAst === "string" ? parse(sourceOrAst) : sourceOrAst,
       nodes = query.nodesAt(positionAsIndex, parsed)
                 .filter(n => n.type === "CallExpression"
                           && n.callee.name
                           && n.callee.name.match(/describe|it/)
                           && n.arguments[0].type === "Literal"),
       setupCalls = nodes.map(n => {
                       var innerCode = Path("arguments.1.body.body").get(n);
                       if (!innerCode) return null;
                       return innerCode
                                 .filter(n =>
                                      n.expression && n.expression.type === "CallExpression"
                                   && n.expression.callee.name
                                   && n.expression.callee.name.match(/before(Each)?/))
                                 .map(n => n.expression.arguments[0]); }),
       teardownCalls = nodes.map(n => {
                       var innerCode = Path("arguments.1.body.body").get(n);
                       if (!innerCode) return null;
                       return innerCode
                                 .filter(n =>
                                      n.expression && n.expression.type === "CallExpression"
                                   && n.expression.callee.name
                                   && n.expression.callee.name.match(/after(Each)?/))
                                 .map(n => n.expression.arguments[0]); }),

       testDescriptors = nodes.map((n,i) => ({
         type: n.callee.name.match(/describe/) ? "suite" : "test",
         title: n.arguments[0].value,
         astNode: n,
         setupCalls: setupCalls[i],
         teardownCalls: teardownCalls[i],
       }));
  return testDescriptors;
}