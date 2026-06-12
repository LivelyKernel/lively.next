// CDP-backed inspector capture service for the NW.js desktop app.
//
// CDP is only used while V8 is paused. Actual values are stored by executing
// small functions in the renderer so the debugger UI can later inspect them
// in-process through lively.context's registry.

const http = require('http');
const https = require('https');

const DEFAULT_CDP_PORT = 9222;
const DEFAULT_TARGET_TIMEOUT = 30000;
const DEFAULT_TARGET_INTERVAL = 250;
const HALT_UNWIND_TAG = 'lively.context.inspector.halt';

function noop () {}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jsonForExpression (value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function fetchJsonWithHttp (url) {
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${url} returned HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`${url} timed out`));
    });
  });
}

async function defaultFetchJson (url) {
  if (typeof fetch === 'function') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.json();
  }
  return fetchJsonWithHttp(url);
}

function pageTarget (targets) {
  return (targets || []).find(target =>
    target.type === 'page' &&
    target.webSocketDebuggerUrl &&
    !String(target.url || '').startsWith('devtools://'));
}

function bindingNamesFromProperties (properties) {
  return (properties || [])
    .filter(prop =>
      prop &&
      prop.name &&
      prop.name !== '__proto__' &&
      prop.value &&
      !prop.get &&
      !prop.set)
    .map(prop => prop.name);
}

function sourceForFrame (frame) {
  const location = frame.location || {};
  return {
    url: frame.url || '',
    scriptId: location.scriptId || ''
  };
}

function locationForFrame (frame) {
  const location = frame.location || {};
  return {
    scriptId: location.scriptId || '',
    lineNumber: location.lineNumber,
    columnNumber: location.columnNumber
  };
}

function remoteObjectLabel (remoteObject) {
  if (!remoteObject) return '';
  return remoteObject.description || remoteObject.value || remoteObject.type || '';
}

const RENDERER_HELPERS = `
function livelyInspectorRegistryForCapture(payload) {
  const Global = typeof globalThis !== 'undefined' ? globalThis : window;
  let env = null;
  if (Global.System && typeof Global.System.get === 'function') {
    try { env = Global.System.get('@lively-env'); } catch (err) {}
  }
  if (!env) env = Global.__livelyEnv;
  const registry = env && env.debuggerContexts;
  if (!registry) throw new Error('lively.context inspector runtime is not installed');
  if (!registry.hasContext(payload.captureId)) {
    registry.createContext({
      id: payload.captureId,
      reason: payload.reason,
      metadata: payload.metadata || {}
    });
  }
  return registry;
}

function livelyInspectorFrameSpec(payload) {
  return {
    frameId: payload.frameId,
    functionName: payload.functionName || '',
    source: payload.source || null,
    location: payload.location || null
  };
}
`;

const STORE_FRAME_FUNCTION = `function livelyInspectorStoreFrame(payload) {
  ${RENDERER_HELPERS}
  const registry = livelyInspectorRegistryForCapture(payload);
  const frame = livelyInspectorFrameSpec(payload);
  if (payload.storeThis) frame.thisValue = this;
  else if (payload.hasThisByValue) frame.thisValue = payload.thisValue;
  registry.storeFrame(payload.captureId, frame);
  return { contextId: payload.captureId, frameId: payload.frameId };
}`;

const STORE_SCOPE_FUNCTION = `function livelyInspectorStoreScope(payload) {
  ${RENDERER_HELPERS}
  const registry = livelyInspectorRegistryForCapture(payload);
  const context = registry.getContext(payload.captureId);
  if (!context.frames[payload.frameId]) registry.storeFrame(payload.captureId, livelyInspectorFrameSpec(payload));
  const bindings = {};
  for (const name of payload.bindingNames || []) {
    try { bindings[name] = this[name]; } catch (err) {}
  }
  registry.storeScope(payload.captureId, payload.frameId, {
    scopeId: payload.scopeId,
    type: payload.type || 'local',
    name: payload.name || '',
    bindings
  });
  return { contextId: payload.captureId, frameId: payload.frameId, scopeId: payload.scopeId };
}`;

const STORE_EXCEPTION_FUNCTION = `function livelyInspectorStoreException(payload) {
  ${RENDERER_HELPERS}
  const registry = livelyInspectorRegistryForCapture(payload);
  registry.storeException(payload.captureId, this, payload.frameId);
  return { contextId: payload.captureId, exception: true };
}`;

const STORE_FRAME_BY_VALUE_FUNCTION = `function livelyInspectorStoreFrameByValue(payload) {
  ${RENDERER_HELPERS}
  const registry = livelyInspectorRegistryForCapture(payload);
  const frame = livelyInspectorFrameSpec(payload);
  if (payload.hasThisByValue) frame.thisValue = payload.thisValue;
  registry.storeFrame(payload.captureId, frame);
  return { contextId: payload.captureId, frameId: payload.frameId };
}`;

const CONSUME_ARMED_HALT_EXPRESSION = `(() => {
  const debuggerBridge = globalThis.livelyDesktop && globalThis.livelyDesktop.debugger;
  if (!debuggerBridge || typeof debuggerBridge.consumeArmedHalt !== 'function') return null;
  return debuggerBridge.consumeArmedHalt();
})()`;

const IS_HALT_UNWIND_FUNCTION = `function livelyInspectorIsHaltUnwind() {
  return !!this && (this.isLivelyInspectorHaltUnwind || this.tag === '${HALT_UNWIND_TAG}');
}`;

const ENSURE_INSPECTOR_RUNTIME_EXPRESSION = `(() => {
  const Global = typeof globalThis !== 'undefined' ? globalThis : window;
  if (Global.__LIVELY_INSPECTOR_CAPTURE_RUNTIME__) return true;

  const install = mod => {
    if (mod && typeof mod.installInspectorRuntime === 'function') {
      mod.installInspectorRuntime();
      return true;
    }
    return false;
  };

  if (Global.System && typeof Global.System.import === 'function') {
    return Global.System.import('lively.context').then(install);
  }

  const modules = Global.lively && Global.lively.modules;
  if (modules && typeof modules.importPackage === 'function') {
    return modules.importPackage('lively.context').then(install);
  }

  return false;
})()`;

function serviceAttachedExpression (attached) {
  return `(() => {
    const desktop = globalThis.livelyDesktop || (globalThis.livelyDesktop = {});
    const debuggerBridge = desktop.debugger || (desktop.debugger = {});
    debuggerBridge.inspectorServiceAttached = ${attached ? 'true' : 'false'};
    if (typeof debuggerBridge.setServiceAttached === 'function') {
      return debuggerBridge.setServiceAttached(${attached ? 'true' : 'false'});
    }
    debuggerBridge.isAvailable = function () {
      return !!debuggerBridge.inspectorServiceAttached;
    };
    return debuggerBridge.inspectorServiceAttached;
  })()`;
}

const BREAKPOINT_TRAP_EXPRESSION = `(() => {
  const desktop = globalThis.livelyDesktop || (globalThis.livelyDesktop = {});
  const debuggerBridge = desktop.debugger || (desktop.debugger = {});
  if (typeof debuggerBridge.breakpointTrap !== 'function') {
    debuggerBridge.breakpointTrap = function livelyInspectorBreakpointTrap() {
      return true;
    };
  }
  return debuggerBridge.breakpointTrap;
})()`;

const STORE_ARGUMENTS_FUNCTION = `(payload => {
  ${RENDERER_HELPERS}
  const registry = livelyInspectorRegistryForCapture(payload);
  let args = [];
  try {
    if (typeof arguments !== 'undefined') args = Array.prototype.slice.call(arguments);
  } catch (err) {}
  registry.storeFrame(payload.captureId, {
    frameId: payload.frameId,
    arguments: args
  });
  return { contextId: payload.captureId, frameId: payload.frameId, arguments: true };
})`;

class CDPClient {
  constructor (url, { WebSocketImpl = globalThis.WebSocket } = {}) {
    if (!WebSocketImpl) throw new Error('No WebSocket implementation available for CDP');
    this.url = url;
    this.WebSocketImpl = WebSocketImpl;
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandler = null;
    this.ws = null;
  }

  async open () {
    this.ws = new this.WebSocketImpl(this.url);
    await new Promise((resolve, reject) => {
      const onOpen = () => resolve();
      const onError = event => reject(new Error(event && event.message || 'CDP websocket error'));
      this.ws.addEventListener('open', onOpen, { once: true });
      this.ws.addEventListener('error', onError, { once: true });
    });
    this.ws.addEventListener('message', event => this._onMessage(event.data));
  }

  onEvent (handler) {
    this.eventHandler = handler;
  }

  _onMessage (data) {
    const message = JSON.parse(typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || 'CDP error'));
      else resolve(message.result || {});
      return;
    }
    if (message.method && this.eventHandler) this.eventHandler(message.method, message.params || {});
  }

  send (method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close () {
    try { this.ws && this.ws.close(); } catch (_) {}
  }
}

class InspectorService {
  constructor ({
    cdpPort = DEFAULT_CDP_PORT,
    targetTimeout = DEFAULT_TARGET_TIMEOUT,
    targetInterval = DEFAULT_TARGET_INTERVAL,
    fetchJson = defaultFetchJson,
    createClient = null,
    client = null,
    WebSocketImpl = globalThis.WebSocket,
    log = noop
  } = {}) {
    this.cdpPort = cdpPort;
    this.targetTimeout = targetTimeout;
    this.targetInterval = targetInterval;
    this.fetchJson = fetchJson;
    this.createClient = createClient || (url => new CDPClient(url, { WebSocketImpl }));
    this.client = client;
    this.log = log;
    this.captureCount = 0;
    this.started = false;
    this.handlingPause = false;
    this.functionCallBreakpointId = null;
  }

  async start () {
    if (this.started) return this;
    if (!this.client) {
      const target = await this.waitForPageTarget();
      this.client = this.createClient(target.webSocketDebuggerUrl);
      await this.client.open();
    }
    if (typeof this.client.onEvent === 'function') {
      this.client.onEvent((method, params) => {
        if (method === 'Debugger.paused') this.handlePaused(params);
        if (method === 'Runtime.executionContextCreated' || method === 'Page.loadEventFired') {
          this.installBreakpointTrap().then(() =>
            this.markRendererServiceAttached(true)).catch(err => {
              this.log('inspector service status refresh failed: ' + (err.stack || err));
          });
        }
      });
    }
    await this.client.send('Runtime.enable');
    await this.client.send('Page.enable').catch(() => {});
    await this.client.send('Debugger.enable');
    await this.client.send('Debugger.setPauseOnExceptions', { state: 'uncaught' });
    this.started = true;
    await this.installBreakpointTrap();
    await this.markRendererServiceAttached(true);
    this.log('inspector service attached to renderer target');
    return this;
  }

  stop () {
    this.started = false;
    this.markRendererServiceAttached(false).catch(() => {});
    if (this.client && typeof this.client.close === 'function') this.client.close();
  }

  async markRendererServiceAttached (attached) {
    if (!this.client) return false;
    try {
      const result = await this.client.send('Runtime.evaluate', {
        expression: serviceAttachedExpression(attached),
        returnByValue: true,
        silent: true
      });
      return !!(result && result.result && result.result.value);
    } catch (err) {
      this.log('inspector service status update failed: ' + (err.stack || err));
      return false;
    }
  }

  async installBreakpointTrap () {
    if (!this.client) return null;
    if (this.functionCallBreakpointId) {
      try {
        await this.client.send('Debugger.removeBreakpoint', {
          breakpointId: this.functionCallBreakpointId
        });
      } catch (_) {}
      this.functionCallBreakpointId = null;
    }

    const trap = await this.client.send('Runtime.evaluate', {
      expression: BREAKPOINT_TRAP_EXPRESSION,
      returnByValue: false,
      silent: true
    });
    const objectId = trap && trap.result && trap.result.objectId;
    if (!objectId) throw new Error('Could not install inspector breakpoint trap');

    const breakpoint = await this.client.send('Debugger.setBreakpointOnFunctionCall', {
      objectId
    });
    this.functionCallBreakpointId = breakpoint && breakpoint.breakpointId || null;
    return this.functionCallBreakpointId;
  }

  async waitForPageTarget () {
    const start = Date.now();
    let lastError;
    while (Date.now() - start < this.targetTimeout) {
      try {
        const targets = await this.fetchJson(`http://127.0.0.1:${this.cdpPort}/json/list`);
        const target = pageTarget(targets);
        if (target) return target;
      } catch (err) {
        lastError = err;
      }
      await sleep(this.targetInterval);
    }
    throw new Error('No NW.js page target found for inspector service' +
      (lastError ? ': ' + (lastError.message || lastError) : ''));
  }

  createCaptureId () {
    this.captureCount++;
    return 'desktop-capture-' + this.captureCount + '-' + Date.now().toString(36);
  }

  async handlePaused (params) {
    if (this.handlingPause) return;
    this.handlingPause = true;
    let descriptor = null;
    try {
      descriptor = await this.capturePaused(params);
    } catch (err) {
      this.log('inspector capture failed: ' + (err.stack || err));
    }

    try {
      await this.client.send('Debugger.resume');
    } catch (err) {
      this.log('inspector resume failed: ' + (err.stack || err));
    }

    if (descriptor) {
      try {
        await this.deliverCapture(descriptor);
      } catch (err) {
        this.log('inspector deliver failed: ' + (err.stack || err));
      }
    }
    this.handlingPause = false;
  }

  async capturePaused (params) {
    const callFrames = params.callFrames || [];
    if (!callFrames.length) return null;

    if (params.reason === 'exception' && params.data && params.data.objectId &&
        await this.isHaltUnwindException(params.data.objectId)) {
      return null;
    }

    const armed = await this.consumeArmedHalt(callFrames[0]);
    if (!armed && params.reason !== 'exception') return null;

    const captureId = armed && armed.captureId || this.createCaptureId();
    const reason = armed && armed.reason || (params.reason === 'exception' ? 'exception' : params.reason || 'debugger');
    const descriptor = {
      captureId,
      contextId: captureId,
      reason,
      pauseReason: params.reason || '',
      metadata: {
        capturedAt: new Date().toISOString(),
        hitBreakpoints: params.hitBreakpoints || []
      },
      frames: []
    };

    const exceptionObjectId = params.reason === 'exception' && params.data && params.data.objectId;
    await this.ensureInspectorRuntime();

    for (let i = 0; i < callFrames.length; i++) {
      const frame = callFrames[i];
      const frameId = 'frame-' + i;
      const framePayload = {
        captureId,
        reason,
        metadata: descriptor.metadata,
        frameId,
        functionName: frame.functionName || '',
        source: sourceForFrame(frame),
        location: locationForFrame(frame)
      };
      await this.storeFrame(frame, framePayload);
      await this.storeArguments(frame, framePayload);
      if (i === 0 && exceptionObjectId) {
        await this.storeException(captureId, exceptionObjectId, reason, descriptor.metadata);
      }

      const frameDescriptor = {
        frameId,
        functionName: framePayload.functionName,
        source: framePayload.source,
        location: framePayload.location,
        thisLabel: remoteObjectLabel(frame.this),
        scopes: []
      };

      const scopes = frame.scopeChain || [];
      for (let j = 0; j < scopes.length; j++) {
        const scope = scopes[j];
        const objectId = scope.object && scope.object.objectId;
        if (!objectId) continue;

        const properties = await this.client.send('Runtime.getProperties', {
          objectId,
          ownProperties: true,
          accessorPropertiesOnly: false,
          generatePreview: false
        });
        const bindingNames = bindingNamesFromProperties(properties.result);
        const scopeId = frameId + '-scope-' + j;

        await this.storeScope(objectId, {
          ...framePayload,
          scopeId,
          type: scope.type || 'local',
          name: scope.name || '',
          bindingNames
        });

        frameDescriptor.scopes.push({
          scopeId,
          type: scope.type || 'local',
          name: scope.name || '',
          bindingNames
        });
      }

      descriptor.frames.push(frameDescriptor);
    }

    return descriptor;
  }

  async consumeArmedHalt (topFrame) {
    if (!topFrame || !topFrame.callFrameId) return null;
    try {
      const result = await this.client.send('Debugger.evaluateOnCallFrame', {
        callFrameId: topFrame.callFrameId,
        expression: CONSUME_ARMED_HALT_EXPRESSION,
        returnByValue: true,
        silent: true
      });
      return result && result.result && result.result.value || null;
    } catch (err) {
      this.log('inspector halt arm lookup failed: ' + (err.stack || err));
      return null;
    }
  }

  async isHaltUnwindException (objectId) {
    try {
      const result = await this.client.send('Runtime.callFunctionOn', {
        objectId,
        functionDeclaration: IS_HALT_UNWIND_FUNCTION,
        returnByValue: true,
        silent: true
      });
      return !!(result && result.result && result.result.value);
    } catch (err) {
      this.log('inspector halt unwind check failed: ' + (err.stack || err));
      return false;
    }
  }

  async ensureInspectorRuntime () {
    try {
      const result = await this.client.send('Runtime.evaluate', {
        expression: ENSURE_INSPECTOR_RUNTIME_EXPRESSION,
        awaitPromise: true,
        returnByValue: true,
        silent: true
      });
      return !!(result && result.result && result.result.value);
    } catch (err) {
      this.log('inspector runtime install failed: ' + (err.stack || err));
      return false;
    }
  }

  async storeFrame (frame, payload) {
    const thisObject = frame && frame.this;
    if (thisObject && thisObject.objectId) {
      await this.client.send('Runtime.callFunctionOn', {
        objectId: thisObject.objectId,
        functionDeclaration: STORE_FRAME_FUNCTION,
        arguments: [{ value: { ...payload, storeThis: true } }],
        returnByValue: true,
        silent: true
      });
      return;
    }

    const hasThisByValue = thisObject && Object.prototype.hasOwnProperty.call(thisObject, 'value');
    await this.client.send('Debugger.evaluateOnCallFrame', {
      callFrameId: frame.callFrameId,
      expression: `(${STORE_FRAME_BY_VALUE_FUNCTION})(${jsonForExpression({
        ...payload,
        hasThisByValue,
        thisValue: hasThisByValue ? thisObject.value : undefined
      })})`,
      returnByValue: true,
      silent: true
    });
  }

  async storeArguments (frame, payload) {
    if (!frame || !frame.callFrameId) return;
    await this.client.send('Debugger.evaluateOnCallFrame', {
      callFrameId: frame.callFrameId,
      expression: `(${STORE_ARGUMENTS_FUNCTION})(${jsonForExpression(payload)})`,
      returnByValue: true,
      silent: true
    });
  }

  async storeScope (objectId, payload) {
    await this.client.send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: STORE_SCOPE_FUNCTION,
      arguments: [{ value: payload }],
      returnByValue: true,
      silent: true
    });
  }

  async storeException (captureId, objectId, reason, metadata) {
    await this.client.send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: STORE_EXCEPTION_FUNCTION,
      arguments: [{
        value: {
          captureId,
          reason,
          metadata,
          frameId: 'frame-0'
        }
      }],
      returnByValue: true,
      silent: true
    });
  }

  async deliverCapture (descriptor) {
    await this.client.send('Runtime.evaluate', {
      expression: `(() => {
        const descriptor = ${jsonForExpression(descriptor)};
        const debuggerBridge = globalThis.livelyDesktop && globalThis.livelyDesktop.debugger;
        if (debuggerBridge && typeof debuggerBridge.deliverCapture === 'function') {
          return debuggerBridge.deliverCapture(descriptor);
        }
        globalThis.__LIVELY_PENDING_DEBUGGER_CAPTURES__ =
          globalThis.__LIVELY_PENDING_DEBUGGER_CAPTURES__ || [];
        globalThis.__LIVELY_PENDING_DEBUGGER_CAPTURES__.push(descriptor);
        return false;
      })()`,
      returnByValue: true,
      silent: true
    });
  }
}

function createInspectorService (options) {
  return new InspectorService(options);
}

module.exports = {
  CDPClient,
  InspectorService,
  createInspectorService,
  bindingNamesFromProperties,
  pageTarget
};
