"format esm";
/*global describe, it, beforeEach*/
import { expect } from 'mocha-es6';
import {
  InspectorRegistry,
  InspectorContinuation,
  InspectorFrame,
  InspectorScope,
  halt,
  installInspectorRuntime,
  isInspectorHaltUnwind
} from '../lib/inspector-runtime.js';

describe('inspector runtime', function () {
  let registry;

  beforeEach(function () {
    registry = new InspectorRegistry();
  });

  function createContext (spec = {}) {
    return registry.createContext({
      id: 'capture-1',
      reason: 'halt',
      frames: [{
        frameId: 'frame-1',
        functionName: 'inner',
        thisValue: spec.thisValue,
        arguments: spec.arguments,
        scopes: spec.scopes || []
      }]
    });
  }

  it('stores and releases debug contexts', function () {
    createContext();
    expect(registry.hasContext('capture-1')).equals(true);
    expect(registry.releaseContext('capture-1')).equals(true);
    expect(registry.hasContext('capture-1')).equals(false);
  });

  it('preserves object identity for stored bindings, this, and arguments', function () {
    const object = { value: 23 };
    const thisValue = { receiver: true };
    const args = [object];
    createContext({
      thisValue,
      arguments: args,
      scopes: [{ bindings: { object } }]
    });

    const frame = registry.continuationFor('capture-1').currentFrame;
    expect(frame.lookup('object')).equals(object);
    expect(frame.getThis()).equals(thisValue);
    expect(frame.getArguments()).equals(args);
  });

  it('preserves shadowed names as separate scope records', function () {
    createContext({
      scopes: [
        { scopeId: 'local', type: 'local', bindings: { value: 'inner' } },
        { scopeId: 'closure', type: 'closure', bindings: { value: 'outer' } }
      ]
    });

    const frame = registry.continuationFor('capture-1').currentFrame;
    const scopes = frame.scopes();
    expect(scopes).to.have.length(2);
    expect(scopes[0].lookup('value')).equals('inner');
    expect(scopes[1].lookup('value')).equals('outer');
  });

  it('looks up bindings in scope-chain order', function () {
    createContext({
      scopes: [
        { type: 'local', bindings: { value: 'inner' } },
        { type: 'closure', bindings: { value: 'outer', other: 42 } }
      ]
    });

    const frame = registry.continuationFor('capture-1').currentFrame;
    expect(frame.lookup('value')).equals('inner');
    expect(frame.lookup('other')).equals(42);
    expect(frame.lookup('missing')).equals(undefined);
  });

  it('wraps continuations, frames, and scopes over registry ids', function () {
    createContext({
      scopes: [{ scopeId: 'scope-1', type: 'local', name: 'Local', bindings: { value: 3 } }]
    });

    const continuation = registry.continuationFor('capture-1');
    const frame = continuation.currentFrame;
    const scope = frame.scopes()[0];

    expect(continuation).to.be.instanceof(InspectorContinuation);
    expect(frame).to.be.instanceof(InspectorFrame);
    expect(scope).to.be.instanceof(InspectorScope);
    expect(continuation.reason).equals('halt');
    expect(frame.functionName).equals('inner');
    expect(scope.type).equals('local');
    expect(scope.name).equals('Local');
    expect(scope.bindingNames()).eql(['value']);
  });

  it('delivers capture descriptors as ids, not serialized values', function () {
    const object = { nested: { same: true } };
    const continuation = registry.deliverCapture({
      captureId: 'capture-2',
      reason: 'exception',
      exception: object,
      frames: [{
        frameId: 'frame-2',
        scopes: [{ scopeId: 'scope-2', bindings: { object } }]
      }]
    });

    expect(continuation.id).equals('capture-2');
    expect(continuation.exception).equals(object);
    expect(continuation.currentFrame.lookup('object')).equals(object);
    expect(registry.getContext('capture-2').frames['frame-2'].scopeRefs).eql(['scope-2']);
  });

  it('installs the registry under the lively env debuggerContexts slot', function () {
    const env = {};
    const runtime = installInspectorRuntime({ env });

    expect(env.debuggerContexts).equals(runtime.registry);
    expect(runtime.registry).to.be.instanceof(InspectorRegistry);
  });

  it('arms the bridge and throws a tagged halt unwind', function () {
    const calls = [];
    installInspectorRuntime({
      env: {},
      bridge: { armHalt: capture => calls.push(capture) }
    });

    try {
      halt('test halt');
    } catch (err) {
      expect(isInspectorHaltUnwind(err)).equals(true);
      expect(err.reason).equals('test halt');
      expect(calls).to.have.length(1);
      expect(calls[0].reason).equals('test halt');
      expect(calls[0].captureId).equals(err.captureId);
      return;
    }

    throw new Error('halt did not throw');
  });
});
