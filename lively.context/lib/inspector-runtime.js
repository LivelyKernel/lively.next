/*global System*/

const DEFAULT_ENV_KEY = '@lively-env';
const HALT_UNWIND_TAG = 'lively.context.inspector.halt';

let runtime;

function globalObject () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  return {};
}

function systemObject () {
  const Global = globalObject();
  if (Global.System) return Global.System;
  try {
    if (typeof System !== 'undefined') return System;
  } catch (err) {}
  return null;
}

function getLivelyEnv () {
  const Global = globalObject();
  const system = systemObject();
  let env;

  if (system && typeof system.get === 'function') {
    try { env = system.get(DEFAULT_ENV_KEY); } catch (err) {}
  }

  if (!env) env = Global.__livelyEnv || (Global.__livelyEnv = {});
  return env;
}

function own (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function installDesktopDebuggerBridge (runtime) {
  const Global = globalObject();
  const desktop = Global.livelyDesktop || (Global.livelyDesktop = {});
  const existing = desktop.debugger || {};

  desktop.debugger = {
    ...existing,
    isAvailable: existing.isAvailable || function () { return true; },
    deliverCapture: function (descriptor) {
      return runtime.deliverCapture(descriptor);
    }
  };

  return desktop.debugger;
}

function frameIdsFromContext (context) {
  return context.frameOrder.slice();
}

function importDebuggerUI () {
  const system = systemObject();
  if (system && typeof system.import === 'function') {
    return system.import('lively.ide/js/debugger/ui.cp.js');
  }
  return import('lively.ide/js/debugger/ui.cp.js');
}

function openContinuationForRuntime (runtime, continuation) {
  if (!runtime.autoOpen || !continuation) return Promise.resolve(null);
  if (runtime.openedCaptureIds.has(continuation.id)) return Promise.resolve(null);
  runtime.openedCaptureIds.add(continuation.id);

  const open = runtime.openForContinuation || (async continuation => {
    const mod = await importDebuggerUI();
    return mod.openForContinuation(continuation);
  });

  return Promise.resolve().then(() => open(continuation)).catch(err => {
    runtime.openedCaptureIds.delete(continuation.id);
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Could not open lively.context debugger', err);
    }
    return null;
  });
}

function installCaptureListener (runtime) {
  const Global = globalObject();
  Global.__LIVELY_INSPECTOR_CAPTURE_RUNTIME__ = runtime;
  if (Global.__LIVELY_INSPECTOR_CAPTURE_LISTENER__) {
    drainPendingCaptures(runtime);
    return;
  }
  runtime.captureListenerInstalled = true;
  Global.__LIVELY_INSPECTOR_CAPTURE_LISTENER__ = true;

  if (typeof Global.addEventListener === 'function') {
    Global.addEventListener('lively-desktop-debugger-capture', evt => {
      const activeRuntime = Global.__LIVELY_INSPECTOR_CAPTURE_RUNTIME__;
      if (activeRuntime && evt && evt.detail) activeRuntime.deliverCapture(evt.detail);
    });
  }

  drainPendingCaptures(runtime);
}

function installHaltUnwindSuppression () {
  const Global = globalObject();
  if (Global.__LIVELY_INSPECTOR_HALT_SUPPRESSION__) return;
  Global.__LIVELY_INSPECTOR_HALT_SUPPRESSION__ = true;

  if (typeof Global.addEventListener !== 'function') return;

  Global.addEventListener('error', evt => {
    if (evt && isInspectorHaltUnwind(evt.error) && typeof evt.preventDefault === 'function') {
      evt.preventDefault();
    }
  }, true);

  Global.addEventListener('unhandledrejection', evt => {
    if (evt && isInspectorHaltUnwind(evt.reason) && typeof evt.preventDefault === 'function') {
      evt.preventDefault();
    }
  }, true);
}

function drainPendingCaptures (runtime) {
  const Global = globalObject();
  const pending = Global.__LIVELY_PENDING_DEBUGGER_CAPTURES__;
  if (Array.isArray(pending) && pending.length) {
    pending.splice(0).forEach(descriptor => runtime.deliverCapture(descriptor));
  }
}

export class InspectorRegistry {
  constructor ({ bridge } = {}) {
    this.bridge = bridge || null;
    this.contexts = {};
    this.captureCount = 0;
    this.frameCount = 0;
    this.scopeCount = 0;
    this.refCount = 0;
  }

  createCaptureId () {
    this.captureCount++;
    return 'capture-' + this.captureCount;
  }

  createContext (options = {}) {
    const { id, captureId, reason = 'debugger', exception, frames = [], metadata = {} } = options;
    const contextId = id || captureId || this.createCaptureId();
    const context = {
      id: contextId,
      reason,
      metadata,
      frameOrder: [],
      frames: {},
      scopes: {},
      refs: {},
      exceptionRef: null,
      createdAt: Date.now()
    };

    this.contexts[contextId] = context;

    if (own(options, 'exception')) {
      context.exceptionRef = this.storeValue(contextId, exception, 'exception');
    }

    frames.forEach(frame => this.storeFrame(contextId, frame));
    return context;
  }

  releaseContext (contextId) {
    return delete this.contexts[contextId];
  }

  getContext (contextId) {
    return this.contexts[contextId];
  }

  hasContext (contextId) {
    return !!this.contexts[contextId];
  }

  storeValue (contextId, value, hint = 'value') {
    const context = this.getContext(contextId);
    if (!context) throw new Error('Cannot store value for unknown debug context ' + contextId);
    const refId = hint + '-' + (++this.refCount);
    context.refs[refId] = value;
    return refId;
  }

  resolveRef (contextId, refId) {
    const context = this.getContext(contextId);
    return context && context.refs[refId];
  }

  storeFrame (contextId, frameSpec = {}) {
    const context = this.getContext(contextId);
    if (!context) throw new Error('Cannot store frame for unknown debug context ' + contextId);

    const frameId = frameSpec.frameId || frameSpec.id || 'frame-' + (++this.frameCount);
    const frame = context.frames[frameId] || {
      frameId,
      contextId,
      index: context.frameOrder.length,
      thisRef: null,
      argumentsRef: null,
      exceptionRef: null,
      scopeRefs: []
    };

    frame.functionName = frameSpec.functionName || frameSpec.name || frame.functionName || '';
    frame.source = frameSpec.source || frame.source || null;
    frame.location = frameSpec.location || frame.location || null;

    if (own(frameSpec, 'thisValue')) frame.thisRef = this.storeValue(contextId, frameSpec.thisValue, 'this');
    else if (own(frameSpec, 'this')) frame.thisRef = this.storeValue(contextId, frameSpec.this, 'this');
    if (own(frameSpec, 'arguments')) frame.argumentsRef = this.storeValue(contextId, frameSpec.arguments, 'arguments');
    if (own(frameSpec, 'exception')) frame.exceptionRef = this.storeValue(contextId, frameSpec.exception, 'exception');

    context.frames[frameId] = frame;
    if (!context.frameOrder.includes(frameId)) context.frameOrder.push(frameId);

    (frameSpec.scopes || []).forEach(scope => {
      this.storeScope(contextId, frameId, scope);
    });

    return frame;
  }

  storeException (contextId, exception, frameId = null) {
    const context = this.getContext(contextId);
    if (!context) throw new Error('Cannot store exception for unknown debug context ' + contextId);
    const exceptionRef = this.storeValue(contextId, exception, 'exception');
    context.exceptionRef = exceptionRef;
    if (frameId && context.frames[frameId]) context.frames[frameId].exceptionRef = exceptionRef;
    return exceptionRef;
  }

  storeScope (contextId, frameId, scopeSpec = {}) {
    const context = this.getContext(contextId);
    if (!context) throw new Error('Cannot store scope for unknown debug context ' + contextId);
    const frame = context.frames[frameId];
    if (!frame) throw new Error('Cannot store scope for unknown frame ' + frameId);

    const scopeId = scopeSpec.scopeId || scopeSpec.id || 'scope-' + (++this.scopeCount);
    const bindings = {};
    const sourceBindings = scopeSpec.bindings || {};
    Object.keys(sourceBindings).forEach(name => {
      bindings[name] = sourceBindings[name];
    });

    context.scopes[scopeId] = {
      scopeId,
      frameId,
      contextId,
      type: scopeSpec.type || 'local',
      name: scopeSpec.name || '',
      bindings
    };

    if (!frame.scopeRefs.includes(scopeId)) frame.scopeRefs.push(scopeId);
    return scopeId;
  }

  continuationFor (descriptor) {
    if (!descriptor) throw new Error('Cannot create InspectorContinuation without a descriptor');
    const contextId = typeof descriptor === 'string'
      ? descriptor
      : descriptor.contextId || descriptor.id || descriptor.captureId;
    return new InspectorContinuation(this, { ...descriptor, contextId });
  }

  deliverCapture (descriptor) {
    if (!descriptor) throw new Error('Cannot deliver empty debugger capture');
    let contextId = descriptor.contextId || descriptor.id || descriptor.captureId;
    if (!contextId) {
      contextId = this.createContext(descriptor).id;
    } else if (!this.hasContext(contextId)) {
      this.createContext(descriptor);
    }
    return this.continuationFor({ ...descriptor, contextId });
  }
}

export class InspectorContinuation {
  constructor (registry, descriptor) {
    this.registry = registry;
    this.contextId = descriptor.contextId;
    this.descriptor = descriptor;
  }

  get id () { return this.contextId; }

  get reason () {
    const context = this.context;
    return context && context.reason;
  }

  get context () {
    return this.registry.getContext(this.contextId);
  }

  get currentFrame () {
    return this.frames()[0];
  }

  get exception () {
    const context = this.context;
    return context && context.exceptionRef
      ? this.registry.resolveRef(this.contextId, context.exceptionRef)
      : undefined;
  }

  frames () {
    const context = this.context;
    if (!context) return [];
    return frameIdsFromContext(context).map(frameId =>
      new InspectorFrame(this.registry, this.contextId, frameId));
  }

  release () {
    return this.registry.releaseContext(this.contextId);
  }

  close () {
    return this.release();
  }
}

export class InspectorFrame {
  constructor (registry, contextId, frameId) {
    this.registry = registry;
    this.contextId = contextId;
    this.frameId = frameId;
  }

  get id () { return this.frameId; }

  get record () {
    const context = this.registry.getContext(this.contextId);
    return context && context.frames[this.frameId];
  }

  get functionName () {
    const record = this.record;
    return record && record.functionName;
  }

  get source () {
    const record = this.record;
    return record && record.source;
  }

  get location () {
    const record = this.record;
    return record && record.location;
  }

  scopes () {
    const record = this.record;
    if (!record) return [];
    return record.scopeRefs.map(scopeId =>
      new InspectorScope(this.registry, this.contextId, scopeId));
  }

  lookup (name) {
    const scope = this.scopes().find(scope => scope.hasBinding(name));
    return scope ? scope.lookup(name) : undefined;
  }

  getThis () {
    const record = this.record;
    return record && record.thisRef
      ? this.registry.resolveRef(this.contextId, record.thisRef)
      : undefined;
  }

  getArguments () {
    const record = this.record;
    return record && record.argumentsRef
      ? this.registry.resolveRef(this.contextId, record.argumentsRef)
      : undefined;
  }

  getException () {
    const record = this.record;
    return record && record.exceptionRef
      ? this.registry.resolveRef(this.contextId, record.exceptionRef)
      : undefined;
  }
}

export class InspectorScope {
  constructor (registry, contextId, scopeId) {
    this.registry = registry;
    this.contextId = contextId;
    this.scopeId = scopeId;
  }

  get id () { return this.scopeId; }

  get record () {
    const context = this.registry.getContext(this.contextId);
    return context && context.scopes[this.scopeId];
  }

  get type () {
    const record = this.record;
    return record && record.type;
  }

  get name () {
    const record = this.record;
    return record && record.name;
  }

  bindingNames () {
    const record = this.record;
    return record ? Object.keys(record.bindings) : [];
  }

  hasBinding (name) {
    const record = this.record;
    return !!record && own(record.bindings, name);
  }

  lookup (name) {
    const record = this.record;
    return record && own(record.bindings, name)
      ? record.bindings[name]
      : undefined;
  }

  get bindings () {
    const record = this.record;
    return record && record.bindings;
  }
}

export class InspectorHaltUnwind {
  constructor (reason, captureId) {
    this.reason = reason;
    this.captureId = captureId;
    this.tag = HALT_UNWIND_TAG;
  }

  get isLivelyInspectorHaltUnwind () { return true; }

  toString () {
    return '[LivelyInspectorHalt ' + this.reason + ']';
  }
}

export function isInspectorHaltUnwind (err) {
  return !!err && (err.isLivelyInspectorHaltUnwind || err.tag === HALT_UNWIND_TAG);
}

export function installInspectorRuntime ({ bridge, env, autoOpen = true, openForContinuation = null } = {}) {
  const livelyEnv = env || getLivelyEnv();
  let registry = livelyEnv.debuggerContexts;

  if (!(registry instanceof InspectorRegistry)) {
    registry = new InspectorRegistry({ bridge });
    livelyEnv.debuggerContexts = registry;
  } else if (bridge) {
    registry.bridge = bridge;
  }

  runtime = {
    registry,
    bridge: bridge || registry.bridge || null,
    autoOpen,
    openForContinuation,
    openedCaptureIds: new Set(),
    captureListenerInstalled: false,
    deliverCapture (descriptor) {
      const continuation = registry.deliverCapture(descriptor);
      openContinuationForRuntime(this, continuation);
      return continuation;
    }
  };

  const desktopBridge = installDesktopDebuggerBridge(runtime);
  if (!runtime.bridge && desktopBridge && typeof desktopBridge.armHalt === 'function') {
    runtime.bridge = desktopBridge;
  }
  installCaptureListener(runtime);
  installHaltUnwindSuppression();

  return runtime;
}

export function getInspectorRuntime () {
  return runtime || installInspectorRuntime();
}

export function getInspectorRegistry () {
  return getInspectorRuntime().registry;
}

export function halt (reason = 'halt') {
  const runtime = getInspectorRuntime();
  const captureId = runtime.registry.createCaptureId();
  const bridge = runtime.bridge;

  if (bridge && typeof bridge.armHalt === 'function') {
    bridge.armHalt({ reason, captureId });
  }

  debugger;
  throw new InspectorHaltUnwind(reason, captureId);
}

export { HALT_UNWIND_TAG };
