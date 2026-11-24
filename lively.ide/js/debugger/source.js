import { Path, obj } from 'lively.lang';
import { parse, query, escodegen, withMozillaAstDo } from 'lively.ast';
import { RuntimeSourceDescriptor } from 'lively.classes/source-descriptors.js';
import { withSuperclasses, objMetaSymbol } from 'lively.classes/util.js';
import { module } from 'lively.modules';

export const CURRENT_LINE_MARKER_ID = 'lively-debugger-current-line';

// A frame keeps the source it was suspended in until Apply Saved Method or
// Restart Frame installs a new interpreted function.
const sourceContexts = new WeakMap();
const hasMeta = object => Object.prototype.hasOwnProperty.call(object, objMetaSymbol);

function comparableBody (body) {
  const ast = obj.deepCopy(body);
  // Recorder capture expands {value} to {value: value} without changing AST paths.
  withMozillaAstDo(ast, null, (next, node) => {
    if (node.type === 'Property' && node.value.type === 'Identifier') node.shorthand = false;
    next();
  });
  return escodegen.generate(ast);
}

/** The class member of the frame's receiver that `original` implements. */
function receiverMember (frame, original) {
  const receiver = frame.getThis(), isStatic = typeof receiver === 'function';
  for (const owner of withSuperclasses(isStatic ? receiver : receiver?.constructor)) {
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(isStatic ? owner : owner.prototype || {}))) {
      const kind = ['value', 'get', 'set'].find(kind => descriptor[kind] && (descriptor[kind] === original || descriptor[kind].originalFunction === original));
      if (kind) return { owner, name, kind, isStatic };
    }
  }
}

/** The module source and function AST of a runtime object with Lively source metadata, or of a member of its class. */
function moduleContext (owner, member) {
  const descriptor = RuntimeSourceDescriptor.for(owner);
  const source = descriptor.moduleSource, { start } = descriptor.sourceLocation;
  let ast = query.nodesAtIndex(parse(source, { locations: true }), start)
    .find(node => node.start === start && /^(Class|Function|ArrowFunction|MethodDefinition|Property)/.test(node.type));
  if (ast?.type === 'MethodDefinition' || ast?.type === 'Property') ast = ast.value;
  if (ast && member) {
    ast = ast.body.body.find(node => (node.key.name || node.key.value) === member.name && !!node.static === member.isStatic &&
      (member.kind === 'value' ? node.kind === 'method' : node.kind === member.kind))?.value;
  }
  return ast?.body && { source, ast, moduleName: descriptor.module.shortName(), name: member && owner.name + '.' + member.name };
}

/**
 * The module source of a frame's function and the map from the frame's AST
 * nodes to the nodes of that source. Functions without Lively source metadata,
 * and interpreted closures nested in them, have no context.
 */
function sourceContextForFrame (frame) {
  const func = frame?.func;
  if (!func) return null;
  if (sourceContexts.has(func)) return sourceContexts.get(func);
  const original = func.originalFunction || func.asFunction?.();
  // A saved world keeps the context on the function and resolves its module by name.
  let context = func.debuggerSource || original && hasMeta(original) && moduleContext(original);
  const member = !context && original && frame.getThis && receiverMember(frame, original);
  if (member && hasMeta(member.owner)) context = moduleContext(member.owner, member);
  // Nested interpreted functions share their AST nodes with the caller.
  for (let parent = frame.getParentFrame?.(); !context && parent; parent = parent.getParentFrame()) {
    const ast = sourceContextForFrame(parent)?.nodes.get(frame.getOriginalAst().astIndex);
    if (ast?.body && comparableBody(ast.body) === comparableBody(frame.getOriginalAst().body)) context = { ...sourceContextForFrame(parent), ast, name: undefined };
  }
  if (context) {
    const { source, ast, moduleName, name } = context, recorded = frame.getOriginalAst();
    func.debuggerSource = { source, ast, moduleName, name };
    context = { ...func.debuggerSource, url: module(moduleName).id, nodes: new Map() };
    // Compiler transformations can change the body; never guess a source position.
    if (comparableBody(recorded.body) === comparableBody(ast.body)) {
      withMozillaAstDo(recorded, null, (next, node, state, path) => {
        const sourceNode = Number.isFinite(node.astIndex) && Path(path).get(ast);
        if (sourceNode) context.nodes.set(node.astIndex, sourceNode);
        next();
      });
    }
  }
  sourceContexts.set(func, context || null);
  return context || null;
}

export function sourceNameForFrame (frame) {
  const original = frame.func.originalFunction, constructor = original?.[Symbol.for('lively-debug-constructor')];
  if (constructor) return String(constructor.name) + '.constructor';
  return String(sourceContextForFrame(frame)?.name || original && (original.displayName || original.name) || frame.func.name() || '<anonymous>');
}

/** The zero-based line and column of the frame's current node in its displayed source. */
export function locationForFrame (frame) {
  const pc = frame?.getPC?.(), context = sourceContextForFrame(frame);
  if (context) {
    const node = pc && context.nodes.get(pc.astIndex);
    return node ? { line: node.loc.start.line - 1, column: node.loc.start.column } : null;
  }
  const firstLine = frame?.getOriginalAst?.()?.loc?.start.line || 1;
  return pc?.loc ? { line: pc.loc.start.line - firstLine, column: pc.loc.start.column } : null;
}

export function lineRangeForFrame (frame, sourceText = '') {
  const location = locationForFrame(frame), lines = String(sourceText).split('\n');
  if (!location) return null;
  const row = Math.max(0, Math.min(location.line, lines.length - 1));
  return { start: { row, column: 0 }, end: { row, column: lines[row].length } };
}

/** The line in the frame's function AST of the statement nearest to a position in the displayed source. */
export function interpreterLineForSourcePosition (frame, { row, column = 0 }) {
  const context = sourceContextForFrame(frame), matches = [], ast = frame.getOriginalAst();
  if (!context) return row + 1;
  withMozillaAstDo(ast, null, (next, node) => {
    if (node !== ast && /Function/.test(node.type)) return;
    const sourceNode = (/Statement$/.test(node.type) || node.type === 'VariableDeclaration') && context.nodes.get(node.astIndex);
    if (sourceNode && sourceNode.loc.start.line === row + 1) matches.push({ node, column: sourceNode.loc.start.column });
    next();
  });
  if (!matches.length) throw new Error('No executable statement on this line in the selected function.');
  matches.sort((a, b) => Math.abs(a.column - column) - Math.abs(b.column - column));
  return matches[0].node.loc.start.line;
}

export function readFrameSource (frame) {
  if (!frame) return '';
  return sourceContextForFrame(frame)?.source || frame.getOriginalAst?.()?.source || frame.func.getSource();
}

export function sourceUrlForFrame (frame) {
  return sourceContextForFrame(frame)?.url || frame?.getOriginalAst?.()?.sourceFile || '';
}

/** Only a module context contains the complete, editable module. */
export function moduleUrlForFrame (frame) { return sourceContextForFrame(frame)?.url || null; }

export function sourcePathForFrame (frame) {
  if (!frame) return '';
  return (sourceContextForFrame(frame)?.moduleName || sourceUrlForFrame(frame) || '(no source url)').replace(/^https?:\/\/[^/]+\/?/i, '');
}
