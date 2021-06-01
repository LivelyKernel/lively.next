/* global System,global,Global,self,Node,ImageData */
import { obj, string } from 'lively.lang';

export function getGlobal () {
  if (typeof System !== 'undefined') return System.global;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof Global !== 'undefined') return Global;
  if (typeof self !== 'undefined') return self;
  return (function () { return this; })();
}

export function signatureOf (name, func) {
  let source = String(func);
  let match = source.match(/function\s*[a-zA-Z0-9_$]*\s*\(([^\)]*)\)/);
  let params = (match && match[1]) || '';
  return name + '(' + params + ')';
}

export function isClass (obj) {
  if (obj === obj ||
    obj === Array ||
    obj === Function ||
    obj === String ||
    obj === Boolean ||
    obj === Date ||
    obj === RegExp ||
    obj === Number ||
    obj === Promise) return true;
  return (obj instanceof Function) &&
      ((obj.superclass !== undefined) ||
       (obj._superclass !== undefined));
}

export function pluck (list, prop) { return list.map(function (ea) { return ea[prop]; }); }

let knownSymbols = (() =>
  Object.getOwnPropertyNames(Symbol)
    .filter(ea => typeof Symbol[ea] === 'symbol')
    .reduce((map, ea) => map.set(Symbol[ea], 'Symbol.' + ea), new Map()))();

let symMatcher = /^Symbol\((.*)\)$/;

export function printSymbol (sym) {
  if (Symbol.keyFor(sym)) return `Symbol.for("${Symbol.keyFor(sym)}")`;
  if (knownSymbols.get(sym)) return knownSymbols.get(sym);
  let matched = String(sym).match(symMatcher);
  return String(sym);
}

export function safeToString (value) {
  if (!value) return String(value);
  if (Array.isArray(value)) return `[${value.map(safeToString).join(',')}]`;
  if (typeof value === 'symbol') return printSymbol(value);
  try {
    return String(value);
  } catch (e) {
    throw new Error(`Cannot print object: ${e.stack}`);
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function printEvalResult (evalResult, options = {}) {
  let { value, isError, isPromise, promisedValue, promiseStatus } = evalResult;

  if (isError || value instanceof Error) {
    let err = value;
    let stringified = String(err);
    let stack = err.stack || '';
    if (stack && err.message !== err.stack) {
      stack = String(stack);
      let errInStackIdx = stack.indexOf(stringified);
      if (errInStackIdx === 0) { stack = stack.slice(stringified.length); }
      stringified += '\n' + stack;
    }
    return stringified;
  }

  if (isPromise) {
    let status = string.print(promiseStatus);
    let printed = promiseStatus === 'pending'
      ? undefined
      : printEvalResult({ value: promisedValue }, options);
    return `Promise({status: ${status}, ${(value === undefined ? '' : 'value: ' + printed)}})`;
  }

  if (value instanceof Promise) { return 'Promise({status: "unknown"})'; }

  if (options.inspect) { return printInspectEvalValue(value, options.inspectDepth || 2); }

  // options.asString
  return String(value);
}

export var printInspectEvalValue = (function () {
  let itSym = typeof Symbol !== 'undefined' && Symbol.iterator;
  let maxIterLength = 10;
  let maxStringLength = 100;
  let maxNumberOfKeys = 100;
  let maxNumberOfLines = 1000;

  return printInspect;

  function printInspect (object, maxDepth) {
    if (typeof maxDepth === 'object') { maxDepth = maxDepth.maxDepth || 2; }

    if (!object) return String(object);
    if (typeof object === 'string') {
      let mark = object.includes('\n') ? '`' : '"';
      object = object.split('\n').slice(0, maxNumberOfLines).join('\n');
      return mark + object + mark;
    }
    if (object instanceof Error) return object.stack || safeToString(object);
    if (!obj.isObject(object)) return safeToString(object);
    try {
      var inspected = obj.inspect(object, {
        customPrinter: inspectPrinter,
        maxNumberOfKeys,
        maxDepth,
        printFunctionSource: true
      });
    } catch (e) {}
    // return inspected;
    return inspected === '{}' ? safeToString(object) : inspected;
  }

  function printIterable (val, ignore) {
    let isIterable = typeof val !== 'string' &&
                  !Array.isArray(val) &&
                  itSym && typeof val[itSym] === 'function';
    if (!isIterable) return ignore;
    let hasEntries = typeof val.entries === 'function';
    let it = hasEntries ? val.entries() : val[itSym]();
    let values = [];
    let open = hasEntries ? '{' : '['; let close = hasEntries ? '}' : ']';
    let name = val.constructor && val.constructor.name || 'Iterable';
    for (var i = 0, next; i < maxIterLength; i++) {
      next = it.next();
      if (next.done) break;
      values.push(next.value);
    }
    let printed = values.map(ea => hasEntries
      ? `${String(ea[0])}: ${String(ea[1])}`
      : printInspect(ea, 2)).join(', ');
    return `${name}(${open}${printed}${close})`;
  }

  function inspectPrinter (val, ignore, continueInspectFn) {
    if (!val) return ignore;
    if (typeof val === 'symbol') return printSymbol(val);
    if (typeof val === 'string') return string.print(string.truncate(val, maxStringLength));
    if (val.isMorph) return safeToString(val);
    if (val instanceof Promise) return 'Promise()';
    if (typeof Node !== 'undefined' && val instanceof Node) return safeToString(val);
    if (typeof ImageData !== 'undefined' && val instanceof ImageData) return safeToString(val);
    let length = val.length || val.byteLength;
    if (length !== undefined && length > maxIterLength && val.slice) {
      let printed = typeof val === 'string' || val.byteLength
        ? safeToString(val.slice(0, maxIterLength))
        : val.slice(0, maxIterLength).map(continueInspectFn);
      return '[' + printed + ',...]';
    }
    let iterablePrinted = printIterable(val, ignore);
    if (iterablePrinted !== ignore) return iterablePrinted;
    return ignore;
  }
})();
