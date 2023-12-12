/* global it, xit, describe, beforeEach, afterEach */
import { morph } from '../index.js';
import { FunctionScript, TargetScript } from '../ticking.js';
import { expect } from 'mocha-es6';
import { pt, Color } from 'lively.graphics';
import { promise } from 'lively.lang';

let world, aMorph;
describe('ticking scripts', function () {
  this.timeout(10000);

  beforeEach(() => {
    world = morph({
      type: 'world',
      extent: pt(300, 300),
      submorphs: [
        { name: 'aMorph', extent: pt(100, 100), position: pt(10, 10), fill: Color.red }]
    });
    aMorph = world.get('aMorph');
  });

  afterEach(() => aMorph.stopStepping());

  // this test is useful and currently suceedings, but flaky in CI, probably due to the delay
  xit('morph startStepping', async () => {
    aMorph.startStepping(50, 'moveBy', pt(1, 1));
    await promise.delay(230);
    expect(aMorph.position.x).within(10 + 3, 10 + 5);
  });

  it('stop from within stepped script', async () => {
    aMorph.counter = 0;
    aMorph.step = function () {
      this.counter++;
      this.stopStepping();
    };
    aMorph.startStepping(10, 'step');
    await promise.delay(50);
    expect(aMorph.counter).equals(1);
    expect(aMorph.tickingScripts).equals([]);
  });

  it('morph stepping with arg', async function () {
    let arg = { callCount: 0 }; let context;
    aMorph.someFunction = function (arg) { arg.callCount++; context = this; };

    aMorph.startStepping(10, 'someFunction', arg);
    await promise.delay(20);
    expect(arg.callCount).within(1, 3, 'arg callCount');
    expect(context).equals(aMorph, 'this binding');
    let countWhenRemoved = arg.callCount;
    aMorph.remove();
    await promise.delay(20);
    expect(arg.callCount).equals(countWhenRemoved, 'morph.remove does not stop script');
  });

  it('scriptEquals', async function () {
    let cb = function () { return 23; };
    let script1 = new FunctionScript(cb);
    let script2 = new FunctionScript(cb);
    expect().assert(script1.equals(script1), 'identity not working');
    expect().assert(script1.equals(script2), 'FunctionScript equals');

    script1 = new TargetScript(this, 'foo', 33);
    script2 = new TargetScript(this, 'foo', 44);
    expect().assert(script1.equals(script1), 'identity not working Target');
    expect().assert(script1.equals(script2), 'TargetScript equals');
  });

  it('start stepping checks if script is there', async function () {
    aMorph.someFunction = function (arg) { return 33; };
    aMorph.startStepping(10, 'someFunction');
    aMorph.startStepping(20, 'someFunction');
    expect(1).equals(aMorph.tickingScripts.length, 'script added twice');
    expect(20).equals(aMorph.tickingScripts[0].tickTime, 'tickTime not OK');
  });

  describe('FunctionScript', () => {
    it('startAndStopTicking', async function () {
      let n = 0; let script = new FunctionScript(function () { n++; });
      script.startTicking(100);
      await promise.delay(400);
      script.stop();
      expect(n).within(2, 4, 'Script not run');
    });

    it('suspendAndContinue', async function () {
      let n = 0;
      let script = new FunctionScript(function () { n++; });
      script.startTicking(10);
      await promise.delay(15);
      expect(n).equals(1, 'Script not run once');
      script.suspend();
      await promise.delay(15);
      expect(n).equals(1, 'Script not suspended');
      // script.resume();
      // await promise.delay(15);
      script.stop();
      // expect(n).within(2, 3, 'Script not continued');
    });
  });
});
