import { parse, escodegen } from 'lively.ast';
import { Continuation, asRewrittenClosure } from './stackReification.js';
import { Frame, Function as AcornFunction, Interpreter, Scope } from './interpreter.js';

const STATEMENT_TYPES = new Set([
  'EmptyStatement',
  'ExpressionStatement',
  'IfStatement',
  'LabeledStatement',
  'BreakStatement',
  'ContinueStatement',
  'WithStatement',
  'SwitchStatement',
  'ReturnStatement',
  'ThrowStatement',
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'DebuggerStatement',
  'VariableDeclaration',
  'FunctionDeclaration',
  'SwitchCase'
]);

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression'
]);

const PENDING_RESULT_EXPRESSION_TYPES = new Set([
  'CallExpression',
  'NewExpression'
]);

const Global = typeof globalThis !== 'undefined' ? globalThis : window;

export class InspectorInterpreterError extends Error {
  constructor (message, { frame } = {}) {
    super(message);
    this.name = 'InspectorInterpreterError';
    this.message = message;
    this.frame = frame;
  }
}

function sourceTextForFrame (frame) {
  return frame && frame.source && frame.source.sourceText || '';
}

function positionForFrame (frame) {
  const location = frame && frame.location || {};
  if (!Number.isFinite(location.lineNumber)) return null;
  return {
    line: location.lineNumber + 1,
    column: Number.isFinite(location.columnNumber) ? location.columnNumber : 0
  };
}

function comparePosition (a, b) {
  if (a.line !== b.line) return a.line - b.line;
  return a.column - b.column;
}

function containsPosition (node, position) {
  if (!node || !node.loc || !position) return false;
  return comparePosition(node.loc.start, position) <= 0 &&
    comparePosition(position, node.loc.end) <= 0;
}

function nodeSize (node) {
  return (node.end || 0) - (node.start || 0);
}

function functionNameOf (node, parent) {
  if (!node) return '';
  if (node.id && node.id.name) return node.id.name;
  if (parent && parent.type === 'VariableDeclarator' && parent.id && parent.id.name) return parent.id.name;
  if (parent && parent.type === 'Property') {
    if (parent.key && parent.key.name) return parent.key.name;
    if (parent.key && parent.key.value) return String(parent.key.value);
  }
  if (parent && parent.type === 'MethodDefinition') {
    if (parent.key && parent.key.name) return parent.key.name;
    if (parent.key && parent.key.value) return String(parent.key.value);
  }
  return '';
}

function visitAst (node, visitor, parent = null) {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  visitor(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'source') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(ea => visitAst(ea, visitor, node));
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      visitAst(value, visitor, node);
    }
  }
}

function parseFrameSource (frame) {
  const sourceText = sourceTextForFrame(frame);
  if (!sourceText) {
    throw new InspectorInterpreterError('Cannot interpret inspector frame without captured source text.', { frame });
  }
  try {
    const ast = parse(sourceText, {
      locations: true,
      addSource: true,
      addAstIndex: true,
      allowReturnOutsideFunction: true
    });
    normalizeForInterpreter(ast);
    return ast;
  } catch (err) {
    throw new InspectorInterpreterError('Cannot parse captured source for interpreter stepping: ' + (err.message || err), { frame });
  }
}

function normalizeForInterpreter (ast) {
  visitAst(ast, node => {
    if (node.type === 'VariableDeclaration' && node.kind !== 'var') node.kind = 'var';
    if (node.type === 'ArrowFunctionExpression') {
      node.type = 'FunctionExpression';
      node.id = null;
      node.expression = false;
      if (node.body && node.body.type !== 'BlockStatement') {
        node.body = {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: node.body,
            start: node.body.start,
            end: node.body.end,
            loc: node.body.loc,
            source: node.body.source,
            astIndex: node.body.astIndex
          }],
          start: node.body.start,
          end: node.body.end,
          loc: node.body.loc,
          source: node.body.source,
          astIndex: node.body.astIndex
        };
      }
    }
  });
  return ast;
}

function findEnclosingFunction (ast, frame) {
  const position = positionForFrame(frame);
  const functionName = frame && frame.functionName;
  const candidates = [];
  visitAst(ast, (node, parent) => {
    if (!FUNCTION_TYPES.has(node.type)) return;
    if (!containsPosition(node, position)) return;
    candidates.push({ node, parent, name: functionNameOf(node, parent) });
  });
  const named = functionName
    ? candidates.filter(candidate => candidate.name === functionName)
    : [];
  const choices = named.length ? named : candidates;
  choices.sort((a, b) => nodeSize(a.node) - nodeSize(b.node));
  return choices[0] && choices[0].node;
}

function findSmallestNodeAt (root, position, predicate = () => true) {
  const found = [];
  visitAst(root, node => {
    if (!predicate(node)) return;
    if (containsPosition(node, position)) found.push(node);
  });
  found.sort((a, b) => nodeSize(a) - nodeSize(b));
  return found[0] || null;
}

function findStoppedStatement (functionNode, position) {
  return findSmallestNodeAt(functionNode.body || functionNode, position, node =>
    STATEMENT_TYPES.has(node.type));
}

function findPendingResultExpression (functionNode, position) {
  return findSmallestNodeAt(functionNode.body || functionNode, position, node =>
    PENDING_RESULT_EXPRESSION_TYPES.has(node.type));
}

function scopeForInspectorFrame (frame) {
  if (frame && frame.getScope && !frame.scopes) {
    const scope = frame.getScope();
    return scope && scope.copy ? scope.copy() : scope;
  }
  const inspectorScopes = frame && frame.scopes ? frame.scopes() : [];
  let scope = new Scope(Global);
  for (let i = inspectorScopes.length - 1; i >= 0; i--) {
    const inspectorScope = inspectorScopes[i];
    scope = new Scope({ ...(inspectorScope.bindings || {}) }, scope);
  }
  return scope;
}

function locationFromNode (node, fallback = null) {
  if (!node || !node.loc) return fallback;
  return {
    scriptId: fallback && fallback.scriptId || '',
    lineNumber: node.loc.start.line - 1,
    columnNumber: node.loc.start.column
  };
}

function decorateInterpreterFrame (interpreterFrame, inspectorFrame) {
  const source = inspectorFrame && inspectorFrame.source || null;
  const fallbackLocation = inspectorFrame && inspectorFrame.location || null;
  Object.defineProperty(interpreterFrame, 'id', {
    configurable: true,
    get () { return inspectorFrame && inspectorFrame.id; }
  });
  Object.defineProperty(interpreterFrame, 'functionName', {
    configurable: true,
    get () { return this.func && this.func.name() || inspectorFrame && inspectorFrame.functionName || ''; }
  });
  Object.defineProperty(interpreterFrame, 'source', {
    configurable: true,
    get () { return source; }
  });
  Object.defineProperty(interpreterFrame, 'location', {
    configurable: true,
    get () { return locationFromNode(this.getPC && this.getPC(), fallbackLocation); }
  });
  interpreterFrame.inspectorFrame = inspectorFrame;
  return interpreterFrame;
}

export function isInspectorRuntimeFrame (frame) {
  const source = frame && frame.source || {};
  const url = source.url || '';
  const sourceText = source.sourceText || '';
  return url.includes('/lively.context/lib/inspector-runtime.js') ||
    url.endsWith('/lively.context/lib/inspector-runtime.js') ||
    (frame && frame.functionName === 'halt' &&
      sourceText.includes('HALT_UNWIND_TAG') &&
      sourceText.includes('InspectorHaltUnwind'));
}

export function interpreterFramesForInspectorContinuation (continuation, { startFrame = null } = {}) {
  const frames = continuation && continuation.frames ? continuation.frames() : [];
  const firstRelevantIndex = frames.findIndex(frame => !isInspectorRuntimeFrame(frame));
  const firstIndex = firstRelevantIndex >= 0 ? firstRelevantIndex : 0;
  const startIndex = startFrame
    ? frames.findIndex(frame => frame.id === startFrame.id)
    : firstIndex;
  return frames.slice(startIndex >= 0 ? startIndex : firstIndex)
    .filter(frame => !isInspectorRuntimeFrame(frame));
}

export function materializeInspectorFrame (frame, {
  skipStoppedStatement = false,
  restart = false
} = {}) {
  const ast = parseFrameSource(frame);
  const position = positionForFrame(frame);
  const functionNode = findEnclosingFunction(ast, frame) || ast;
  const stoppedStatement = findStoppedStatement(functionNode, position);
  const pcNode = restart
    ? null
    : (skipStoppedStatement && stoppedStatement
        ? stoppedStatement
        : findPendingResultExpression(functionNode, position) ||
          findSmallestNodeAt(functionNode, position) ||
          stoppedStatement ||
          functionNode);

  const scope = scopeForInspectorFrame(frame);
  const func = new AcornFunction(functionNode, scope);
  const interpreterFrame = Frame.create(func);
  interpreterFrame.setScope(scope);
  decorateInterpreterFrame(interpreterFrame, frame);
  interpreterFrame.setThis(frame.getThis ? frame.getThis() : undefined);
  if (functionNode.type !== 'Program' && frame.getArguments) {
    let args;
    try { args = frame.getArguments(); } catch (err) {}
    if (args !== undefined) interpreterFrame.setArguments(args);
  }
  if (pcNode) interpreterFrame.setPC(pcNode);
  if (skipStoppedStatement && stoppedStatement && stoppedStatement.astIndex !== undefined) {
    interpreterFrame.alreadyComputed[stoppedStatement.astIndex] = undefined;
  }
  return interpreterFrame;
}

export function materializeInspectorContinuation (continuation, {
  startFrame = null,
  restart = false
} = {}) {
  const frames = interpreterFramesForInspectorContinuation(continuation, { startFrame });
  if (!frames.length) {
    throw new InspectorInterpreterError('Cannot interpret inspector continuation without user frames.');
  }

  let parentFrame = null;
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = materializeInspectorFrame(frames[i], {
      skipStoppedStatement: i === 0 && !restart,
      restart: i === 0 && restart
    });
    frame.setParentFrame(parentFrame);
    parentFrame = frame;
  }
  return new Continuation(parentFrame);
}

export function asInterpreterContinuation (continuation, options = {}) {
  const currentFrame = continuation && continuation.currentFrame;
  if (currentFrame && currentFrame.getOriginalAst && currentFrame.getOriginalAst()) {
    return continuation;
  }
  return materializeInspectorContinuation(continuation, options);
}

function continuationFromStepResult (result, previous) {
  const unwind = result && result.isUnwindException
    ? result
    : result && result.unwindException;
  if (unwind) {
    const continuation = Continuation.fromUnwindException(unwind);
    continuation.onSuspend = previous && previous.onSuspend;
    return continuation;
  }
  return result;
}

export function stepInspectorContinuation (continuation, {
  action = 'stepOver',
  startFrame = null
} = {}) {
  let interpreterContinuation = asInterpreterContinuation(continuation);
  while (startFrame && interpreterContinuation.currentFrame !== startFrame) {
    if (!interpreterContinuation.frames().includes(startFrame)) throw new InspectorInterpreterError('Selected frame is no longer suspended.');
    const previous = interpreterContinuation.currentFrame;
    const result = stepOutInspectorContinuation(interpreterContinuation);
    if (!result || !result.isContinuation || result.currentFrame === previous) return result;
    interpreterContinuation = result;
  }
  const interpreter = new Interpreter({captureErrors: true});
  const frame = interpreterContinuation.currentFrame;
  const result = action === 'stepInto'
    ? interpreter.stepToNextCallOrStatement(frame)
    : interpreter.stepToNextStatement(frame);
  const next = continuationFromStepResult(result, interpreterContinuation);
  if (next?.reason === 'yield' && frame.generator) {
    frame.generator.state = 'yield';
    const caller = returnFromInspectorFrame(interpreterContinuation, {value: next.error.value, done: false}, {startFrame: frame, iteratorResult: true});
    frame.setParentFrame(null);
    return caller;
  }
  if (!next || !next.isContinuation) return returnFromInspectorFrame(interpreterContinuation, next, {startFrame: frame});
  if (next && next.reason === 'bindings') return next.settleBindings().then(stopped => stepInspectorContinuation(stopped, {action}));
  return next && next.reason === 'await'
    ? next.settleAwait().then(stopped => stopped.reason === 'exception' ? stopped : stepInspectorContinuation(stopped, {action}))
    : next;
}

export function stepOutInspectorContinuation (continuation, {
  startFrame = null
} = {}) {
  const interpreterContinuation = asInterpreterContinuation(continuation);
  if (startFrame && startFrame !== interpreterContinuation.currentFrame) {
    const stopped = stepInspectorContinuation(interpreterContinuation, {startFrame});
    return stopped && stopped.isContinuation ? stepOutInspectorContinuation(stopped) : stopped;
  }
  const frame = interpreterContinuation.currentFrame;
  const parentFrame = frame && frame.getParentFrame && frame.getParentFrame();
  let result;
  try {
    const interpreter = new Interpreter({captureErrors: true});
    result = frame.generator ? frame.generator.resume(interpreter) : interpreter.runFromPC(frame);
  }
  catch (error) { result = continuationFromStepResult(error, interpreterContinuation); if (!result || !result.isContinuation) throw error; }
  result = continuationFromStepResult(result, interpreterContinuation);
  if (result && result.reason === 'await') return result.settleAwait().then(stopped =>
    stopped.reason === 'exception' ? stopped : stepOutInspectorContinuation(stopped));
  if (result && result.isContinuation) return result;
  if (!parentFrame) return result;
  const parentPC = parentFrame.getPC && parentFrame.getPC();
  if (parentPC && parentPC.astIndex !== undefined) {
    parentFrame.supplyCallResult(result);
  }
  return new Continuation(parentFrame);
}

export function restartInspectorFrame (continuation, { startFrame = null } = {}) {
  let interpreterContinuation;
  const frame = startFrame || continuation.currentFrame;
  if (frame && frame.getOriginalAst && frame.getOriginalAst()) {
    const original = frame.func.originalFunction;
    const current = savedMethodForFrame(frame);
    if (typeof current === 'function' && current !== original) {
      const ast = asRewrittenClosure(current).originalAst;
      frame.func = new AcornFunction(ast, frame.func.lexicalScope, current);
    }
    frame.reset();
    interpreterContinuation = new Continuation(frame);
  } else {
    interpreterContinuation = materializeInspectorContinuation(continuation, { startFrame, restart: true });
  }
  const result = new Interpreter({captureErrors: true}).stepToNextStatement(interpreterContinuation.currentFrame);
  return continuationFromStepResult(result);
}

function savedMethodForFrame (frame) {
  const original = frame.func.originalFunction || frame.func.asFunction();
  const name = original && (original.methodName || original.displayName || original.name);
  let owner = frame.getThis();
  while (owner && name) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, name);
    if (descriptor) return descriptor.value;
    owner = Object.getPrototypeOf(owner);
  }
  return original;
}

function astPaths (root) {
  const nodes = new Map();
  function visit (node, path) {
    if (!node || typeof node !== 'object' || !node.type) return;
    nodes.set(path, node);
    for (const key of Object.keys(node)) {
      if (key === 'loc') continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach((child, i) => visit(child, path + '/' + key + '/' + i));
      else if (value && value.type) visit(value, path + '/' + key);
    }
  }
  visit(root, '');
  return nodes;
}

export function applySavedInspectorMethod (continuation, {startFrame = null} = {}) {
  const interpreted = asInterpreterContinuation(continuation);
  const frame = startFrame || interpreted.currentFrame;
  if (!interpreted.frames().includes(frame)) throw new InspectorInterpreterError('Selected frame is no longer suspended.');
  const current = savedMethodForFrame(frame);
  if (!current || current === frame.func.originalFunction) return interpreted;
  const oldAst = frame.getOriginalAst(), newAst = asRewrittenClosure(current).originalAst;
  const oldNodes = astPaths(oldAst), newNodes = astPaths(newAst);
  const pcPath = [...oldNodes].find(([, node]) => node === frame.getPC())[0];
  const pc = newNodes.get(pcPath);
  const statement = frame.pcStatement || frame.getPC();
  const newStatementPath = [...oldNodes].find(([, node]) => node === statement)[0];
  const newStatement = newNodes.get(newStatementPath);
  const prefixUnchanged = [...oldNodes].every(([path, node]) => {
    if (node.start < oldAst.body.start || node.end > statement.start) return true;
    const replacement = newNodes.get(path);
    return replacement && node.type === replacement.type && escodegen.generate(node) === escodegen.generate(replacement);
  });
  if (!pc || !newStatement || !prefixUnchanged ||
      oldAst.params.map(p => escodegen.generate(p)).join() !== newAst.params.map(p => escodegen.generate(p)).join()) {
    throw new InspectorInterpreterError('Executed code or arguments changed. Restart Frame to apply this edit.');
  }
  const computed = {}, indices = new Map();
  for (const [path, oldNode] of oldNodes) {
    const newNode = newNodes.get(path);
    if (!newNode) continue;
    indices.set(oldNode.astIndex, newNode.astIndex);
    if (!frame.isAlreadyComputed(oldNode)) continue;
    if (oldNode.type !== newNode.type || escodegen.generate(oldNode) !== escodegen.generate(newNode)) {
      throw new InspectorInterpreterError('A computed expression changed. Restart Frame to apply this edit.');
    }
    computed[newNode.astIndex] = frame.alreadyComputed[oldNode.astIndex];
  }
  const remapKey = key => key.replace(/^(__forOf_|__delegate_|__yieldValue_|__finally_)(\d+)$/, (key, prefix, index) =>
    indices.has(Number(index)) ? prefix + indices.get(Number(index)) : key);
  for (const [key, value] of Object.entries(frame.alreadyComputed)) {
    if (!/^\d+$/.test(key)) computed[remapKey(key)] = value;
  }
  if (frame.pendingAwait) {
    frame.pendingAwait.astIndex = indices.get(frame.pendingAwait.astIndex);
    for (const key of ['iteratorKey', 'delegateKey', 'valueKey']) {
      if (frame.pendingAwait[key]) frame.pendingAwait[key] = remapKey(frame.pendingAwait[key]);
    }
  }
  for (const pending of [frame.pendingIterator, frame.pendingDelegate]) {
    if (pending) pending.key = remapKey(pending.key);
  }
  frame.func = new AcornFunction(newAst, frame.func.lexicalScope, current);
  frame.alreadyComputed = computed;
  frame.setPC(pc);
  for (let scope = frame.getScope(); scope; scope = scope.getParentScope()) {
    if (scope.lexicalNodeIndex !== undefined && indices.has(scope.lexicalNodeIndex)) scope.lexicalNodeIndex = indices.get(scope.lexicalNodeIndex);
  }
  return interpreted;
}

export function runToInspectorPosition (continuation, line, {startFrame = null} = {}) {
  const interpreted = asInterpreterContinuation(continuation);
  const frame = startFrame || interpreted.currentFrame;
  if (frame !== interpreted.currentFrame) throw new InspectorInterpreterError('Select the active frame to run to a source line.');
  const targets = new Set();
  function visit (node) {
    if (node !== frame.getOriginalAst() && FUNCTION_TYPES.has(node.type)) return;
    if (node.loc && node.loc.start.line === line && STATEMENT_TYPES.has(node.type)) targets.add(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(child => child && child.type && visit(child));
      else if (value && value.type) visit(value);
    }
  }
  visit(frame.getOriginalAst());
  if (!targets.size) throw new InspectorInterpreterError('No executable statement on this line.');
  const interpreter = new Interpreter({captureErrors: true});
  interpreter.shouldHaltAtNextStatement = node => targets.has(node);
  try { return returnFromInspectorFrame(interpreted, interpreter.runFromPC(frame), {startFrame: frame}); }
  catch (error) {
    const result = continuationFromStepResult(error, interpreted);
    if (result && result.reason === 'await') return result.settleAwait().then(stopped =>
      stopped.reason === 'exception' ? stopped : runToInspectorPosition(stopped, line));
    if (result && result.reason === 'bindings') return result.settleBindings().then(stopped =>
      runToInspectorPosition(stopped, line));
    if (result && result.isContinuation) return result;
    throw error;
  }
}

export function resumeInspectorContinuation (continuation, options = {}) {
  return asInterpreterContinuation(continuation).resume();
}

export function returnFromInspectorFrame (continuation, value, {startFrame = null, iteratorResult = false} = {}) {
  const interpreted = asInterpreterContinuation(continuation);
  const frame = startFrame || interpreted.currentFrame;
  if (!interpreted.frames().includes(frame)) throw new InspectorInterpreterError('Selected frame is no longer suspended.');
  value = frame.completeReturnValue(value);
  const parent = frame.getParentFrame();
  if (frame.generator && !iteratorResult) {
    frame.generator.state = 'done';
    value = {value, done: true};
  }
  if (!parent) return value;
  parent.supplyCallResult(value);
  if (frame.generator) frame.setParentFrame(null);
  return new Continuation(parent);
}
