import { runEval } from 'lively.vm';

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * Evaluate `source` with lively.vm in a chain of scopes, innermost first. Each
 * scope is `{bindings, setBinding?}`; `setBinding(name, value)` handles
 * assignments to its bindings. Free variables resolve through the chain, then
 * as globals. Declarations and assignments to unknown names are recorded in the
 * bindings of the scope of type 'workspace'. `this` and `arguments` are the first
 * such bindings.
 */
export function evaluateInDebuggerScopes (source, scopes = []) {
  const workspace = scopes.find(scope => scope.type === 'workspace')?.bindings || {};
  const find = key => scopes.find(scope => own(scope.bindings, key));
  const recorder = new Proxy(workspace, {
    ownKeys: () => [...new Set(scopes.flatMap(scope => Object.keys(scope.bindings)))],
    getOwnPropertyDescriptor: (target, key) => own(target, key)
      ? Reflect.getOwnPropertyDescriptor(target, key)
      : find(key) && { value: undefined, writable: true, enumerable: true, configurable: true },
    get: (target, key) => (find(key) || { bindings: target }).bindings[key],
    set (target, key, value) {
      const scope = find(key);
      if (scope?.setBinding) scope.setBinding(key, value);
      else (scope ? scope.bindings : target)[key] = value;
      return true;
    }
  });
  const receiver = find('this');
  const result = runEval(String(source || ''), {
    sync: true, topLevelVarRecorder: recorder, transformES6Classes: false,
    context: receiver ? receiver.bindings.this : globalThis,
    // lively.vm does not record `arguments`; this binding names the frame's arguments.
    header: find('arguments') ? 'let arguments = __lvVarRecorder.arguments;\n' : ''
  });
  if (result.isError) throw result.value;
  return result.value;
}
