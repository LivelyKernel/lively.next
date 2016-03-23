/*global process, global, exports*/

import { string, Path } from "lively.lang";
import { BaseVisitor, PrinterVisitor, ComparisonVisitor } from "./mozilla-ast-visitors.js"
import stringify from "./stringify.js";
import { acorn } from "./acorn-extension.js";
import { parse } from "./parser.js";

var methods = {

  withMozillaAstDo: function(parsed, state, func) {
    // simple interface to mozilla AST visitor. function gets passed three
    // arguments:
    // acceptNext, -- continue visiting
    // node, -- current node being visited
    // state -- state variable that is passed along
    var vis = new BaseVisitor(),
        origAccept = vis.accept;
    vis.accept = function(node, depth, st, path) {
      var next = function() { origAccept.call(vis, node, depth, st, path); }
      return func(next, node, st, depth, path);
    }
    return vis.accept(parsed, 0, state, []);
  },

  printAst: function(astOrSource, options) {
    options = options || {};
    var printSource = options.printSource || false,
      printPositions = options.printPositions || false,
      printIndex = options.printIndex || false,
      source, parsed, tree = [];

    if (typeof astOrSource === "string") {
      source = astOrSource;
      parsed = parse(astOrSource);
    } else { parsed = astOrSource; source = options.source || parsed.source; }

    if (printSource && !parsed.source) { // ensure that nodes have source attached
      if (!source) {
        source = stringify(parsed);
        parsed = parse(source);
      }
      acorn.walk.addSource(parsed, source);
    }

    function printFunc(ea) {
      var string = ea.path + ':' + ea.node.type, additional = [];
      if (printIndex) { additional.push(ea.index); }
      if (printPositions) { additional.push(ea.node.start + '-' + ea.node.end); }
      if (printSource) {
        var src = ea.node.source || source.slice(ea.node.start, ea.node.end),
          printed = string.print.print(src.truncate(60).replace(/\n/g, '').replace(/\s+/g, ' '));
        additional.push(printed);
      }
      if (additional.length) { string += '(' + additional.join(',') + ')'; }
      return string;
    }

    new PrinterVisitor().accept(parsed, {index: 0}, tree, []);
    return string.printTree(tree[0], printFunc, function(ea) { return ea.children; }, '  ');
  },

  compareAst: function(node1, node2) {
    if (!node1 || !node2) throw new Error('node' + (node1 ? '1' : '2') + ' not defined');
    var state = {completePath: [], comparisons: {errors: []}};
    new ComparisonVisitor().accept(node1, node2, state, []);
    return !state.comparisons.errors.length ? null : state.comparisons.errors.pluck('msg');
  },

  pathToNode: function(parsed, index, options) {
    options = options || {};
    if (!parsed.astIndex) acorn.walk.addAstIndex(parsed);
    var vis = new BaseVisitor(), found = null;
    (vis.accept = function (node, pathToHere, state, path) {
      if (found) return;
      var fullPath = pathToHere.concat(path);
      if (node.astIndex === index) {
        var pathString = fullPath
          .map(function(ea) { return typeof ea === 'string' ? '.' + ea : '[' + ea + ']'})
          .join('');
        found = {pathString: pathString, path: fullPath, node: node};
      }
      return this['visit' + node.type](node, fullPath, state, path);
    }).call(vis,parsed, [], {}, []);
    return found;
  },

  rematchAstWithSource: function(parsed, source, addLocations, subTreePath) {
    addLocations = !!addLocations;
    var parsed2 = parse(source, addLocations ? { locations: true } : undefined),
        visitor = new BaseVisitor();
    if (subTreePath) parsed2 = Path(subTreePath).get(parsed2);

    visitor.accept = function(node, depth, state, path) {
      path = path || [];
      var node2 = path.reduce(function(node, pathElem) {
        return node[pathElem];
      }, parsed);
      node2.start = node.start;
      node2.end = node.end;
      if (addLocations) node2.loc = node.loc;
      return this['visit' + node.type](node, depth, state, path);
    }

    visitor.accept(parsed2);
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var withMozillaAstDo = methods.withMozillaAstDo,
    printAst = methods.printAst,
    compareAst = methods.compareAst,
    pathToNode = methods.pathToNode,
    rematchAstWithSource = methods.rematchAstWithSource;

export {
  withMozillaAstDo,
  printAst,
  compareAst,
  pathToNode,
  rematchAstWithSource
}

// obj.extend(ast, methods);

// FIXME! Don't extend acorn object!
// obj.extend(ast.acorn, methods);
