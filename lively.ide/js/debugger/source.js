import { resource } from 'lively.resources';
import { Path, obj } from 'lively.lang';
import { parse, query, escodegen, withMozillaAstDo } from 'lively.ast';
import { RuntimeSourceDescriptor } from 'lively.classes/source-descriptors.js';
import { withSuperclasses, objMetaSymbol } from 'lively.classes/util.js';

// Keep the suspended source until Apply Saved Method installs a new frame function.
const sourceContexts = new WeakMap();

function comparableBody (body) {
  const ast = obj.deepCopy(body);
  // Recorder capture expands {value} to {value: value} without changing AST paths.
  withMozillaAstDo(ast, null, (next, node) => {
    if (node.type === 'Property' && node.value.type === 'Identifier') node.shorthand = false;
    next();
  });
  return escodegen.generate(ast);
}

function sourceContextForFrame (frame) {
  const func = frame && frame.func;
  if (!func) return null;
  if (sourceContexts.has(func)) return sourceContexts.get(func);
  const original = func.originalFunction;
  let owner = original && Object.prototype.hasOwnProperty.call(original, objMetaSymbol) ? original : null;
  let memberName, memberKind, isStatic;
  if (!owner && original && frame.getThis) {
    const receiver = frame.getThis();
    isStatic = typeof receiver === 'function';
    const classes = withSuperclasses(isStatic ? receiver : receiver && receiver.constructor);
    for (const klass of classes) {
      const descriptors = Object.getOwnPropertyDescriptors(isStatic ? klass : klass.prototype || {});
      for (const [name, descriptor] of Object.entries(descriptors)) {
        for (const kind of ['value', 'get', 'set']) {
          const value = descriptor[kind];
          if (value !== original && (!value || value.originalFunction !== original)) continue;
          owner = klass; memberName = name; memberKind = kind;
        }
      }
      if (owner) break;
    }
  }
  let context = null;
  if (owner && Object.prototype.hasOwnProperty.call(owner, objMetaSymbol)) {
    const descriptor = RuntimeSourceDescriptor.for(owner);
    const source = descriptor.moduleSource;
    const moduleAst = parse(source, { locations: true });
    let ast = query.nodesAtIndex(moduleAst, descriptor.sourceLocation.start)
      .find(node => node.start === descriptor.sourceLocation.start && /^(Class|Function)/.test(node.type));
    if (ast && memberName) {
      const member = ast.body.body.find(node =>
        (node.key.name || node.key.value) === memberName && !!node.static === isStatic &&
        (memberKind === 'value' ? node.kind === 'method' : node.kind === memberKind));
      ast = member && member.value;
    }
    if (ast && ast.body && ast.body.type === 'BlockStatement') {
      context = {source, ast, url: descriptor.module.id, moduleName: descriptor.module.shortName(), name: memberName ? owner.name + '.' + memberName : original.displayName || original.name};
    }
  }
  // Nested interpreter functions retain their AST identity in the caller.
  if (!context && frame.getParentFrame) {
    for (let parent = frame.getParentFrame(); parent; parent = parent.getParentFrame()) {
      const parentContext = sourceContextForFrame(parent);
      if (!parentContext) continue;
      const ast = parentContext.nodes.get(frame.getOriginalAst().astIndex);
      if (ast && ast.body && comparableBody(ast.body) === comparableBody(frame.getOriginalAst().body)) {
        context = {...parentContext, ast, name: original && (original.displayName || original.name) || func.name()};
        break;
      }
    }
  }
  if (context) {
    const recordedAst = frame.getOriginalAst();
    context.nodes = new Map();
    // Compiler transformations can change the body; never guess a source position.
    if (comparableBody(recordedAst.body) === comparableBody(context.ast.body)) {
      withMozillaAstDo(recordedAst, null, (next, node, state, path) => {
        if (Number.isFinite(node.astIndex)) {
          const sourceNode = Path(path).get(context.ast);
          if (sourceNode) context.nodes.set(node.astIndex, sourceNode);
        }
        next();
      });
    }
  }
  sourceContexts.set(func, context);
  return context;
}

function sourceNodeForFrame (frame, node) {
  const context = sourceContextForFrame(frame);
  if (!context || !node) return null;
  return context.nodes.get(node.astIndex) || null;
}

export function sourceNameForFrame (frame) {
  const context = sourceContextForFrame(frame);
  const original = frame && frame.func && frame.func.originalFunction;
  return context && context.name || frame && frame.functionName || original && (original.displayName || original.name) || frame && frame.func && frame.func.name() || '<anonymous>';
}

export function interpreterLineForSourcePosition (frame, {row, column = 0}) {
  if (!sourceContextForFrame(frame)) return row + 1;
  const matches = [];
  const ast = frame.getOriginalAst();
  withMozillaAstDo(ast, null, (next, node) => {
    if (node !== ast && /Function/.test(node.type)) return;
    if (/Statement$/.test(node.type) || node.type === 'VariableDeclaration') {
      const sourceNode = sourceNodeForFrame(frame, node);
      if (sourceNode && sourceNode.loc.start.line === row + 1) matches.push({node, column: sourceNode.loc.start.column});
    }
    next();
  });
  matches.sort((a, b) => Math.abs(a.column - column) - Math.abs(b.column - column));
  if (!matches.length) throw new Error('No executable statement on this line in the selected function.');
  return matches[0].node.loc.start.line;
}

function locationForFrame (frame) {
  if (frame && frame.location) return frame.location;
  const pc = frame && frame.getPC && frame.getPC();
  const context = sourceContextForFrame(frame);
  const sourceNode = sourceNodeForFrame(frame, pc);
  if (context) return sourceNode ? {lineNumber: sourceNode.loc.start.line - 1, columnNumber: sourceNode.loc.start.column} : {};
  const ast = frame && frame.getOriginalAst && frame.getOriginalAst();
  const firstLine = ast && ast.loc && ast.loc.start.line || 1;
  return pc && pc.loc ? { lineNumber: pc.loc.start.line - firstLine, columnNumber: pc.loc.start.column } : {};
}

export const CURRENT_LINE_MARKER_ID = 'lively-debugger-current-line';

export function sourceSummary (frame) {
  if (!frame) return '';
  const source = frame.source || {};
  const location = locationForFrame(frame);
  const lines = [
    frame.functionName ? 'function ' + frame.functionName : '<anonymous frame>',
    source.url || source.scriptId || '(no source url)',
    Number.isFinite(location.lineNumber)
      ? 'line ' + (location.lineNumber + 1) + ', column ' + ((location.columnNumber || 0) + 1)
      : ''
  ].filter(Boolean);
  return lines.join('\n');
}

export function sourceUrlForFrame (frame) {
  const source = frame && frame.source || {};
  const context = sourceContextForFrame(frame);
  return context && context.url || source.url || (frame && frame.getOriginalAst && frame.getOriginalAst().sourceFile) || '';
}

export function moduleUrlForFrame (frame) {
  // Only a resolved module context contains the complete, editable module.
  const context = sourceContextForFrame(frame);
  return context && context.url || null;
}

export function isInspectorRuntimeFrame (frame) {
  const url = sourceUrlForFrame(frame);
  const sourceText = frame && frame.source && frame.source.sourceText || '';
  return url.includes('/lively.context/lib/inspector-runtime.js') ||
    url.endsWith('/lively.context/lib/inspector-runtime.js') ||
    (frame && frame.functionName === 'halt' &&
      sourceText.includes('HALT_UNWIND_TAG') &&
      sourceText.includes('InspectorHaltUnwind'));
}

export function initialFrameForContinuation (continuation, frames = continuation ? continuation.frames() : []) {
  if (!frames.length) return null;
  if (isInspectorRuntimeFrame(frames[0])) {
    return frames.find(frame => !isInspectorRuntimeFrame(frame)) || frames[0];
  }
  if ((continuation && continuation.reason) !== 'halt') return frames[0];
  return frames.find(frame => !isInspectorRuntimeFrame(frame)) || frames[0];
}

export function sourcePathForFrame (frame) {
  if (!frame) return '';
  const source = frame.source || {};
  const context = sourceContextForFrame(frame);
  return (context && context.moduleName || sourceUrlForFrame(frame) || source.scriptId || '(no source url)')
    .replace(/^https?:\/\/[^/]+\/?/i, '');
}

export function locationStringForFrame (frame) {
  if (!frame) return '';
  const location = locationForFrame(frame);
  const url = sourcePathForFrame(frame);
  if (!Number.isFinite(location.lineNumber)) return url;
  return url + ':' + (location.lineNumber + 1) + ':' + ((location.columnNumber || 0) + 1);
}

export function lineRangeForFrame (frame, sourceText = '') {
  const location = locationForFrame(frame);
  if (!Number.isFinite(location.lineNumber)) return null;
  const lines = String(sourceText || '').split('\n');
  if (!lines.length) return null;
  const row = Math.max(0, Math.min(location.lineNumber, lines.length - 1));
  return {
    start: { row, column: 0 },
    end: { row, column: lines[row].length }
  };
}

export async function readFrameSource (frame, read = url => resource(url).read()) {
  if (!frame) return '';
  const context = sourceContextForFrame(frame);
  if (context) return context.source;
  if (frame.func && frame.func.getSource) {
    const ast = frame.getOriginalAst && frame.getOriginalAst();
    return ast && ast.source || frame.func.getSource();
  }
  const capturedSource = frame.source && frame.source.sourceText;
  if (capturedSource) return String(capturedSource);
  const url = sourceUrlForFrame(frame);
  if (!url) return sourceSummary(frame);
  try {
    const source = await read(url);
    return source == null ? sourceSummary(frame) : String(source);
  } catch (err) {
    const message = err && err.message || String(err);
    return sourceSummary(frame) + '\n\nUnable to load source: ' + message;
  }
}
