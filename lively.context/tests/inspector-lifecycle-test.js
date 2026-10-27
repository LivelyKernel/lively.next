/* global describe, it */
import { expect } from 'mocha-es6';
import { InspectorRegistry, installInspectorRuntime } from '../lib/inspector-runtime.js';
import { prepareCapturedFunction } from '../lib/stackReification.js';

describe('inspector capture lifetime', () => {
  it('bounds retained contexts and releases their open markers', async () => {
    const env = {}, registry = env.debuggerContexts = new InspectorRegistry({maxContexts: 2});
    const runtime = installInspectorRuntime({env, autoOpen: true, openForContinuation() { return {}; }});
    for (const id of ['first', 'second', 'third']) {
      runtime.deliverCapture({captureId: id, frames: []});
      await runtime.lastOpenPromise;
    }
    expect(Object.keys(registry.contexts)).deep.equals(['second', 'third'], 'Only live bounded captures retain values');
    expect([...runtime.openedCaptureIds]).deep.equals(['second', 'third'], 'Eviction removes the capture marker');
    registry.continuationFor('third').release();
    expect([...runtime.openedCaptureIds]).deep.equals(['second'], 'Window release removes its capture marker');
  });
  it('captures functions when the desktop bridge has no debugger member', async () => {
    const old = globalThis.livelyDesktop;
    try {
      globalThis.livelyDesktop = {};
      let error;
      try { await prepareCapturedFunction(function missing() { return notCaptured; }, ['notCaptured']); }
      catch (caught) { error = caught; }
      expect(error?.message).includes('Missing closure bindings: notCaptured', 'Missing optional bridge reports the recovery advice');
    } finally { globalThis.livelyDesktop = old; }
  });
});
