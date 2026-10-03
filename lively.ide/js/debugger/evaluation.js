function own (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function bindingsForScope (scope) {
  if (!scope) return {};
  const bindings = scope.bindings;
  return bindings || {};
}

export function scopeLookupProxy (scopes = [], fallback = globalThis) {
  const findScope = key => scopes.find(scope => own(bindingsForScope(scope), key));
  return new Proxy(Object.create(null), {
    has (target, key) {
      if (key === Symbol.unscopables) return false;
      return !!findScope(key) || key in fallback;
    },

    get (target, key) {
      if (key === Symbol.unscopables) return undefined;
      const scope = findScope(key);
      return scope ? scope.lookup ? scope.lookup(key) : bindingsForScope(scope)[key] : fallback[key];
    },

    set (target, key, value) {
      const scope = findScope(key);
      if (scope && scope.setBinding) scope.setBinding(key, value);
      else if (scope) bindingsForScope(scope)[key] = value;
      else fallback[key] = value;
      return true;
    }
  });
}

function evaluatorForSource (source) {
  try {
    return Function('__scope__', `with (__scope__) { return (${source}); }`);
  } catch (err) {
    return Function('__scope__', `with (__scope__) { ${source} }`);
  }
}

export function evaluateInDebuggerScopes (source, scopes = [], fallback = globalThis) {
  const proxy = scopeLookupProxy(scopes, fallback);
  const receiverScope = scopes.find(scope => own(bindingsForScope(scope), 'this'));
  const receiver = receiverScope ? bindingsForScope(receiverScope).this : fallback;
  const workspace = scopes.find(scope => scope.type === 'workspace');
  if (workspace) {
    const bindings = bindingsForScope(workspace);
    const transformed = evalCodeTransform(String(source || ''), {
      topLevelVarRecorder: bindings, varRecorderName: '__debuggerWorkspace__', transformES6Classes: false
    });
    return Function('__scope__', '__debuggerWorkspace__',
      'with (__scope__) { return eval(' + JSON.stringify(transformed) + '); }').call(receiver, proxy, bindings);
  }
  return evaluatorForSource(String(source || '')).call(receiver, proxy);
}
import { evalCodeTransform } from 'lively.vm/lib/eval-support.js';
