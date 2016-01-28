/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
  run(env.acorn, env.escodegen, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, escodegen, lively, lang, exports) {

var methods = {

  withMozillaAstDo: function(ast, state, func) {
    // simple interface to mozilla AST visitor. function gets passed three
    // arguments:
    // acceptNext, -- continue visiting
    // node, -- current node being visited
    // state -- state variable that is passed along
    var vis = new exports.MozillaAST.BaseVisitor(),
        origAccept = vis.accept;
    vis.accept = function(node, depth, st, path) {
      var next = function() { origAccept.call(vis, node, depth, st, path); }
      return func(next, node, st, depth, path);
    }
    return vis.accept(ast, 0, state, []);
  },

  printAst: function(astOrSource, options) {
    options = options || {};
    var printSource = options.printSource || false,
      printPositions = options.printPositions || false,
      printIndex = options.printIndex || false,
      source, ast, tree = [];

    if (typeof astOrSource === "string") {
      source = astOrSource;
      ast = lively.ast.acorn.parse(astOrSource);
    } else { ast = astOrSource; source = options.source || ast.source; }

    if (printSource && !ast.source) { // ensure that nodes have source attached
      if (!source) {
        source = escodegen.generate(ast);
        ast = exports.acorn.parse(source);
      }
      acorn.walk.addSource(ast, source);
    }

    function printFunc(ea) {
      var string = ea.path + ':' + ea.node.type, additional = [];
      if (printIndex) { additional.push(ea.index); }
      if (printPositions) { additional.push(ea.node.start + '-' + ea.node.end); }
      if (printSource) {
        var src = ea.node.source || source.slice(ea.node.start, ea.node.end),
          printed = lively.lang.string.print.print(src.truncate(60).replace(/\n/g, '').replace(/\s+/g, ' '));
        additional.push(printed);
      }
      if (additional.length) { string += '(' + additional.join(',') + ')'; }
      return string;
    }

    new exports.MozillaAST.PrinterVisitor().accept(ast, {index: 0}, tree, []);
    return lively.lang.string.printTree(tree[0], printFunc, function(ea) { return ea.children; }, '  ');
  },

  compareAst: function(node1, node2) {
    if (!node1 || !node2) throw new Error('node' + (node1 ? '1' : '2') + ' not defined');
    var state = {completePath: [], comparisons: {errors: []}};
    new exports.ComparisonVisitor().accept(node1, node2, state, []);
    return !state.comparisons.errors.length ? null : state.comparisons.errors.pluck('msg');
  },

  pathToNode: function(ast, index, options) {
    options = options || {};
    if (!ast.astIndex) acorn.walk.addAstIndex(ast);
    var vis = new exports.MozillaAST.BaseVisitor(), found = null;
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
    }).call(vis,ast, [], {}, []);
    return found;
  },

  rematchAstWithSource: function(ast, source, addLocations, subTreePath) {
    addLocations = !!addLocations;
    var ast2 = exports.parse(source, addLocations ? { locations: true } : undefined),
        visitor = new exports.MozillaAST.BaseVisitor();
    if (subTreePath) ast2 = lang.Path(subTreePath).get(ast2);

    visitor.accept = function(node, depth, state, path) {
      path = path || [];
      var node2 = path.reduce(function(node, pathElem) {
        return node[pathElem];
      }, ast);
      node2.start = node.start;
      node2.end = node.end;
      if (addLocations) node2.loc = node.loc;
      return this['visit' + node.type](node, depth, state, path);
    }

    visitor.accept(ast2);
  },

  stringify: function(ast, options) {
    return escodegen.generate(ast, options)
  }

}

lang.obj.extend(exports, methods);

// FIXME! Don't extend acorn object!
lang.obj.extend(acorn, methods);

});
