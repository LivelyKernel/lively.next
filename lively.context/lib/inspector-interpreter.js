import { parse } from 'lively.ast';
import { Continuation } from './stackReification.js';
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
  if (currentFrame && currentFrame.getOriginalAst && currentFrame.getOriginalAst()) return continuation;
  return materializeInspectorContinuation(continuation, options);
}

function continuationFromStepResult (result) {
  const unwind = result && result.isUnwindException
    ? result
    : result && result.unwindException;
  if (unwind) return Continuation.fromUnwindException(unwind);
  return result;
}

export function stepInspectorContinuation (continuation, {
  action = 'stepOver',
  startFrame = null
} = {}) {
  const interpreterContinuation = asInterpreterContinuation(continuation, { startFrame });
  const interpreter = new Interpreter();
  const frame = interpreterContinuation.currentFrame;
  const result = action === 'stepInto'
    ? interpreter.stepToNextCallOrStatement(frame)
    : interpreter.stepToNextStatement(frame);
  return continuationFromStepResult(result);
}

export function stepOutInspectorContinuation (continuation, {
  startFrame = null
} = {}) {
  const interpreterContinuation = asInterpreterContinuation(continuation, { startFrame });
  const frame = interpreterContinuation.currentFrame;
  const parentFrame = frame && frame.getParentFrame && frame.getParentFrame();
  const result = continuationFromStepResult(new Interpreter().runFromPC(frame));
  if (result && result.isContinuation) return result;
  if (!parentFrame) return result;
  const parentPC = parentFrame.getPC && parentFrame.getPC();
  if (parentPC && parentPC.astIndex !== undefined) {
    parentFrame.alreadyComputed[parentPC.astIndex] = result;
  }
  return new Continuation(parentFrame);
}

export function restartInspectorFrame (continuation, { startFrame = null } = {}) {
  const interpreterContinuation = materializeInspectorContinuation(continuation, {
    startFrame,
    restart: true
  });
  const result = new Interpreter().stepToNextStatement(interpreterContinuation.currentFrame);
  return continuationFromStepResult(result);
}

export function resumeInspectorContinuation (continuation, options = {}) {
  return asInterpreterContinuation(continuation, options).resume();
}
