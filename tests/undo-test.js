/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { defaultDOMEnv } from "../rendering/dom-helper.js";
import { morph, MorphicEnv } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color } from "lively.graphics";
import { num, arr } from "lively.lang";

var env;

describe("undo", () => {

  beforeEach(async () => env = await MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv())));
  afterEach(() =>  MorphicEnv.popDefault().uninstall());

  it("records changes for undo", () => {
    var m1 = morph({submorphs: [{fill: Color.green}]});
    m1.undoStart("test");
    m1.fill = Color.green;
    m1.submorphs[0].position = pt(10,10);
    m1.undoStop("test");
    expect(env.undoManager.undos).containSubset([{name: "test", changes: [{prop: "fill"}, {prop: "position"}]}]);
  });

  it("does undo and redo", () => {
    var m1 = morph({position: pt(3,4), submorphs: [{fill: Color.green}]});
    m1.undoStart("test");
    m1.submorphs[0].fill = Color.yellow;
    m1.position = pt(10,10);
    m1.undoStop("test");
    env.undoManager.undo();
    expect(m1.position).equals(pt(3,4));
    expect(m1.submorphs[0].fill).equals(Color.green);
    expect(env.undoManager.undos).to.have.length(0);
    expect(env.undoManager.redos).to.have.length(1);
    env.undoManager.redo();
    expect(m1.position).equals(pt(10,10));
    expect(m1.submorphs[0].fill).equals(Color.yellow);
    expect(env.undoManager.undos).to.have.length(1);
    expect(env.undoManager.redos).to.have.length(0);
  });

  it("redo removed on new undo", () => {
    var m1 = morph({position: pt(3,4)});
    m1.undoStart("test"); m1.position = pt(10,10); m1.undoStop("test");
    env.undoManager.undo();
    m1.undoStart("test"); m1.position = pt(20,20); m1.undoStop("test");
    expect(env.undoManager.undos).to.have.length(1);
    expect(env.undoManager.redos).to.have.length(0);
  });

  it("morph remove", () => {
    var m1 = morph({submorphs: [{}]}), m2 = m1.submorphs[0];
    m1.undoStart("test"); m2.remove(); m1.undoStop("test");
    env.undoManager.undo()
    expect(m1.submorphs).equals([m2]);
    expect(m2.owner).equals(m1);
  });

  it("only records changes of morph and its submorphs", () => {
    var m1 = morph(), m2 = m1.addMorph({}), m3 = morph();
    m1.undoStart("test");
    m1.fill = Color.blue;
    m2.fill = Color.green;
    m3.fill = Color.yellow;
    m1.undoStop("test");

    expect(arr.uniq(arr.flatmap(env.undoManager.undos, ({changes}) => arr.pluck(changes, "target"))))
      .equals([m1, m2])
  });

  it("can have multiple targets", () => {
    var m1 = morph(), m2 = m1.addMorph({}), m3 = morph();
    m1.undoStart("test").addTarget(m3);
    m1.fill = Color.blue;
    m2.fill = Color.green;
    m3.fill = Color.yellow;
    m1.undoStop("test");

    expect(arr.uniq(arr.flatmap(env.undoManager.undos, ({changes}) => arr.pluck(changes, "target"))))
      .equals([m1, m2, m3])
  });

});