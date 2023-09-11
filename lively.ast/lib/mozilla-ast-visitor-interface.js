/* global process, global, exports */
import { string, Path } from 'lively.lang';
import { BaseVisitor, PrinterVisitor, ComparisonVisitor } from './mozilla-ast-visitors.js';
import stringify from './stringify.js';
import { addAstIndex } from './acorn-extension.js';
import { parse, addSource } from './parser.js';

function withMozillaAstDo (parsed, state, func) {
  // simple interface to mozilla AST visitor. function gets passed three
  // arguments:
  // acceptNext, -- continue visiting
  // node, -- current node being visited
  // state -- state variable that is passed along
  const vis = new BaseVisitor();
  const origAccept = vis.accept;
  vis.accept = function (node, st, path) {
    const next = function () { origAccept.call(vis, node, st, path); };
    state = func(next, node, st, path);
    return node;
  };
  vis.accept(parsed, state, []);
  return state;
}

function printAst (astOrSource, options) {
  options = options || {};
  const printSource = options.printSource || false;
  const printPositions = options.printPositions || false;
  const printIndex = options.printIndex || false;
  let source; let parsed; const tree = [];

  if (typeof astOrSource === 'string') {
    source = astOrSource;
    parsed = parse(astOrSource);
  } else { parsed = astOrSource; source = options.source || parsed.source; }

  if (printSource && !parsed.source) { // ensure that nodes have source attached
    if (!source) {
      source = stringify(parsed);
      parsed = parse(source);
    }
    addSource(parsed, source);
  }

  function printFunc (ea) {
    let line = ea.path + ':' + ea.node.type; const additional = [];
    if (printIndex) { additional.push(ea.index); }
    if (printPositions) { additional.push(ea.node.start + '-' + ea.node.end); }
    if (printSource) {
      const src = ea.node.source || source.slice(ea.node.start, ea.node.end);
      const printed = string.print(src.truncate(60).replace(/\n/g, '').replace(/\s+/g, ' '));
      additional.push(printed);
    }
    if (additional.length) { line += '(' + additional.join(',') + ')'; }
    return line;
  }

  new PrinterVisitor().accept(parsed, { index: 0, tree: tree }, []);
  return string.printTree(tree[0], printFunc, ea => ea.children, '  ');
}

function compareAst (node1, node2) {
  if (!node1 || !node2) throw new Error('node' + (node1 ? '1' : '2') + ' not defined');
  const state = { completePath: [], comparisons: { errors: [] } };
  new ComparisonVisitor().accept(node1, node2, state, []);
  return !state.comparisons.errors.length ? null : state.comparisons.errors.pluck('msg');
}

function pathToNode (parsed, index, options) {
  options = options || {};
  if (!parsed.astIndex) addAstIndex(parsed);
  const vis = new BaseVisitor(); let found = null;
  (vis.accept = function (node, pathToHere, state, path) {
    if (found) return;
    const fullPath = pathToHere.concat(path);
    if (node.astIndex === index) {
      const pathString = fullPath
        .map(function (ea) { return typeof ea === 'string' ? '.' + ea : '[' + ea + ']'; })
        .join('');
      found = { pathString: pathString, path: fullPath, node: node };
    }
    return this['visit' + node.type](node, fullPath, state, path);
  }).call(vis, parsed, [], {}, []);
  return found;
}

function rematchAstWithSource (parsed, source, addLocations, subTreePath) {
  addLocations = !!addLocations;
  let parsed2 = parse(source, addLocations ? { locations: true } : undefined);
  const visitor = new BaseVisitor();
  if (subTreePath) parsed2 = Path(subTreePath).get(parsed2);
  visitor.accept = function (node, state, path) {
    path = path || [];
    const node2 = path.reduce((node, pathElem) => node[pathElem], parsed);
    node2.start = node.start;
    node2.end = node.end;
    if (addLocations) node2.loc = node.loc;
    return this['visit' + node.type](node, state, path);
  };

  visitor.accept(parsed2);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  BaseVisitor,
  withMozillaAstDo,
  printAst,
  compareAst,
  pathToNode,
  rematchAstWithSource
};
