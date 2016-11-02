/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { morph } from "../index.js";
import { FunctionScript, TargetScript } from "../ticking.js";
import { expect } from "mocha-es6";
import { pt, rect, Color, Rectangle, Transform } from "lively.graphics";
import { promise } from "lively.lang";


var world, aMorph;
describe("ticking scripts", function() {

  this.timeout(5000)

  before(() => {
    world = morph({type: "world", extent: pt(300,300), submorphs: [
      {name: "aMorph", extent: pt(100,100), position: pt(10,10), fill: Color.red}]});
    aMorph = world.get("aMorph");
  });


  it("morph startStepping", async () => {
    aMorph.startStepping(50, "moveBy", pt(1,1));
    await promise.delay(230);
    expect(aMorph.position.x).within(10+3, 10+5)
  });

  it("morph stepping with arg", async function() {
    var arg = {callCount: 0}, context;
    aMorph.someFunction = function(arg) { arg.callCount++; context = this };

    aMorph.startStepping(10, 'someFunction', arg);
    await promise.delay(20);
    expect(arg.callCount).within(1,3, "arg callCount")
    expect(context).equals(aMorph, "this binding")
    var countWhenRemoved = arg.callCount;
    aMorph.remove();
    await promise.delay(20);
    expect(arg.callCount).equals(countWhenRemoved, "morph.remove does not stop script")
  });

  it("scriptEquals", async function() {
    var cb = function() { return 23 },
        script1 = new FunctionScript(cb),
        script2 = new FunctionScript(cb);
    expect().assert(script1.equals(script1), 'identity not working');
    expect().assert(script1.equals(script2), 'FunctionScript equals');

    script1 = new TargetScript(this, 'foo', 33);
    script2 = new TargetScript(this, 'foo', 44);
    expect().assert(script1.equals(script1), 'identity not working Target');
    expect().assert(script1.equals(script2), 'TargetScript equals');
  });

  it("startSteppingChecksIfScriptIsThere", async function() {
    aMorph.someFunction = function(arg) { return 33 };
    aMorph.startStepping(10, 'someFunction');
    aMorph.startStepping(20, 'someFunction');
    expect(1).equals(aMorph.tickingScripts.length, 'script added twice');
    expect(20).equals(aMorph.tickingScripts[0].tickTime, 'tickTime not OK');
  });

  describe("FunctionScript", () => {

    it("startAndStopTicking", async function() {
      var n = 0, script = new FunctionScript(function() { script.stop(); n++; });
      script.startTicking(10);
      await promise.delay(40);
      expect(n).within(2, 4, 'Script not run');
    });

    it("suspendAndContinue", async function() {
      var n = 0,
          script = new FunctionScript(function() { n++; });
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
