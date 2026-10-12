// Run from NW.js's background page, after building with
// LIVELY_APP_FUNCTION_SCOPES=1. Do not attach a second DevTools inspector.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { captureFunctionBindings } = require('../desktop/function-scopes.cjs');

module.exports = async function verifyFunctionScopes (nw, reportFile) {
  const report = { nw: process.versions.nw, v8: process.versions.v8, pid: process.pid, steps: [] };
  const mark = step => { report.steps.push(step); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); };
  try {
    let renderer;
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      renderer = await new Promise(resolve => nw.Window.getAll(windows => {
        report.windows = windows.map(win => ({ url: win.window.location.href,
          project: win.window.$world?.openedProject?.fullName,
          error: String(win.window.__loadError__ || '') }));
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        resolve(windows.find(win => win.window.$world?.openedProject)?.window);
      }));
      if (renderer) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(renderer, 'Open a local project before running the experiment');
    const context = await renderer.eval("System.import('lively.context/lib/stackReification.js')");
    const ast = await renderer.eval("System.import('lively.ast')");
    const sample = renderer.eval(`(() => {
      let step = '1'; const marker = { count: 0 };
      return { marker, read: function() { return step; },
        fn: function increment() { var amount = step; debugger; marker.count += amount; return marker.count; } };
    })()`);
    const names = [...new Set(ast.query.findGlobalVarRefs('(' + String(sample.fn) + ')').map(ref => ref.name))];
    report.missingNames = names;
    assert.deepEqual(names.sort(), ['marker', 'step']);
    mark('identified missing retained bindings with lively.ast');
    const values = await captureFunctionBindings(sample.fn, names);
    assert.equal(values.marker, sample.marker);
    values.marker.count = 2;
    assert.equal(sample.marker.count, 2);
    values.step = 7;
    assert.equal(sample.read(), '1');
    values.step = '1';
    const session = new (require('node:inspector').Session)();
    const post = (method, params = {}) => new Promise((resolve, reject) => {
      session.post(method, params, (error, value) => error ? reject(error) : resolve(value));
    });
    global.__livelyNwScopeWriteProbe = sample.fn;
    try {
      session.connect();
      await post('Runtime.enable');
      const fn = (await post('Runtime.evaluate', { expression: 'global.__livelyNwScopeWriteProbe' })).result;
      const properties = await post('Runtime.getProperties', { objectId: fn.objectId, ownProperties: true });
      const scopes = properties.internalProperties.find(property => property.name === '[[Scopes]]').value;
      const list = await post('Runtime.getProperties', { objectId: scopes.objectId, ownProperties: true });
      const closure = list.result.find(property => property.name === '0').value;
      const changed = await post('Runtime.callFunctionOn', {
        objectId: closure.objectId, functionDeclaration: 'function(){this.object.step=7;return this.object.step;}', returnByValue: true
      });
      assert(!changed.exceptionDetails);
      assert.equal(changed.result.value, 7);
      assert.equal(sample.read(), '1');
      report.scopeSnapshotAssignmentChangesOriginalBinding = false;
    } finally { session.disconnect(); delete global.__livelyNwScopeWriteProbe; }
    report.objectIdentity = true;
    report.objectMutation = sample.marker.count;
    report.bindingMapAssignmentChangesOriginalBinding = false;
    mark('recovered live objects and primitive values without native pauses');
    const continuation = context.run(sample.fn, null, [], values);
    assert(continuation.isContinuation);
    assert.equal(continuation.currentFrame.lookup('marker'), sample.marker);
    assert.equal(continuation.currentFrame.lookup('amount'), '1');
    let ticks = 0;
    await new Promise(resolve => renderer.setTimeout(() => { ticks++; resolve(); }, 30));
    assert.equal(ticks, 1);
    report.worldTimerWhileSuspended = true;
    continuation.currentFrame.getScope().set('amount', 1);
    report.resumed = continuation.resume();
    assert.equal(report.resumed, 3);
    renderer.$world.setStatusMessage('Function scopes: identity and nonpausing resume passed');
    report.ok = true;
    mark('original continuation resumed with repaired local and retained object');
  } catch (error) {
    report.error = String(error);
    report.stack = error.stack;
    mark('failed');
  }
  return report;
};
