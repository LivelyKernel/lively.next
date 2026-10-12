import { stackCaptureMode, enableDebugSupport, disableDebugSupport, debugSupportEnabled, Continuation } from './stackReification.js';
import { getCurrentASTRegistry } from './rewriter.js';
import { withDebugModule } from './exception.js';

// A native caller is the boundary of a captured computation. If it suspends,
// return a promise so awaiters receive the eventual result, not a continuation.
export function installModuleDebugger (System, { open } = {}) {
  const env = System.get('@lively-env');
  if (env.moduleDebugger) {
    if (open) env.moduleDebugger.open = open;
    return env.moduleDebugger;
  }
  let preparing = false;
  const runtime = env.moduleDebugger = System['__lively.modules__moduleDebugger'] = {
    open: open || (async (continuation, callbacks) => {
      const debuggerModule = 'lively.ide/js/debugger/ui.cp.js';
      const { openForContinuation } = await System.import(debuggerModule);
      return openForContinuation(continuation, System.global.$world, callbacks);
    }),
    deliver (result) {
      if (!result?.isContinuation) return result;
      // A debugger statement enables stops automatically; exception stops need
      // an explicitly enabled module anywhere in the captured computation.
      if (result.reason === 'exception' && !result.frames().some(frame => frame.getScope().debugModule()?._debuggingEnabled)) throw result.exception;
      let complete;
      const promise = new Promise(resolve => { complete = resolve; });
      Promise.resolve(runtime.open(result, { onComplete: complete, onCancel: () => complete(undefined) }))
        .catch(error => { complete(undefined); console.error('Could not open Lively debugger', error); });
      return promise;
    },
    capture (error) {
      const unwind = error && (error.isUnwindException ? error : error.unwindException);
      if (!unwind) throw error;
      const continuation = Continuation.fromUnwindException(unwind);
      return ['await', 'bindings'].includes(continuation.reason)
        ? continuation.resume().then(result => runtime.deliver(result)) : runtime.deliver(continuation);
    },
    wrapFunction (func, module) {
      if (func[Symbol.for('lively-debug-interception')]) return func;
      let rewritten, registry;
      const prepare = () => {
        const currentRegistry = getCurrentASTRegistry();
        if (rewritten && registry === currentRegistry) return rewritten;
        preparing = true;
        try {
          rewritten = func.isInterpretableFunction || func.livelyDebuggingEnabled ? func : stackCaptureMode(func, null, currentRegistry);
          registry = currentRegistry;
          return rewritten;
        }
        finally { preparing = false; }
      };
      const call = (receiver, args, newTarget) => {
        if (preparing || !module.debuggingEnabled) return newTarget ? Reflect.construct(func, args, newTarget) : Reflect.apply(func, receiver, args);
        const compiled = prepare();
        const invoke = () => withDebugModule(module, () => {
          try {
            const result = newTarget ? Reflect.construct(compiled, args, newTarget) : Reflect.apply(compiled, receiver, args);
            if (result?.isManagedGenerator) result.debuggerRuntime = runtime;
            return result;
          } catch (error) {
            const unwind = error && (error.isUnwindException ? error : error.unwindException);
            if (newTarget && unwind) {
              const info = unwind.frameInfo.find(info => getCurrentASTRegistry()[info[4]]?.[info[5]] === compiled._cachedAst);
              if (info) info.newTarget = newTarget;
            }
            throw error;
          }
        });
        if (debugSupportEnabled()) return invoke();
        enableDebugSupport();
        try { return invoke(); }
        catch (error) { return runtime.capture(error); }
        finally { disableDebugSupport(); }
      };
      return new Proxy(func, {
        get (target, key, receiver) {
          if (key === Symbol.for('lively-debug-interception')) return true;
          if (key === 'toString') return target.toString.bind(target);
          if (!preparing && module.debuggingEnabled && ['livelyDebuggingEnabled', '_cachedAst', '_cachedScopeObject'].includes(key)) return prepare()[key];
          return Reflect.get(target, key, receiver);
        },
        apply (target, receiver, args) {
          return call(receiver, args);
        },
        construct (target, args, newTarget) { return call(undefined, args, newTarget); }
      });
    }
  };
  return runtime;
}
