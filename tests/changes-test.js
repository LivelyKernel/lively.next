/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { defaultDOMEnv } from "../rendering/dom-helper.js";
import { morph, MorphicEnv } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color } from "lively.graphics";
import { num, arr } from "lively.lang";

var env;

describe("morph change recording", () => {

  beforeEach(async () => env = await MorphicEnv.pushDefault(new MorphicEnv(defaultDOMEnv())));
  afterEach(() =>  MorphicEnv.popDefault().uninstall());

  it("records property modifications as changes", () => {
    var m = morph({extent: pt(10,20), fill: Color.red});
    // Hm... make this one??? For creation...?
    expect(m._rev).equals(m.env.changeManager.revision);
    expect(m.changes).containSubset([{prop: "extent"}, {prop: "fill"}]);
  });

  it("onChange and onSubmorphChange handlers", () => {
    var m1 = morph({submorphs: [{fill: Color.green}]}),
        m2 = m1.submorphs[0],
        m1Changes = [], m1SubmorphChanges = [],
        m2Changes = [], m2SubmorphChanges = [];
    m1.onChange = (change) => m1Changes.push(change);
    m1.onSubmorphChange = (change, morph) => m1SubmorphChanges.push({change, morph});
    m2.onChange = (change) => m2Changes.push(change);
    m2.onSubmorphChange = (change, morph) => m2SubmorphChanges.push({change, morph});

    m2.fill = Color.yellow;

    expect(m1Changes).equals([]);
    expect(m1SubmorphChanges).deep.property("[0].change").containSubset({prop: "fill", value: Color.yellow});
    expect(m1SubmorphChanges).deep.property("[0].morph", m2);
    expect(m2Changes).containSubset([{prop: "fill", value: Color.yellow}]);
    expect(m2SubmorphChanges).equals([]);
  });

  it("changes while", () => {
    var m = morph(),
        changes = m.changesWhile(() => { m.fill = Color.blue; m.moveBy(pt(1,2)) });
    expect(changes).containSubset([{prop: "fill"}, {prop: "position"}]);
  });


  describe("change listener process", () => {

    it("add / remove", () => {
      var changes = [];
      var onChange = change => changes.push(change);
      var m1 = morph(), m2 = m1.addMorph({});
      env.changeManager.addChangeListener(onChange);
      m1.fill = Color.red;
      m2.addMorph({});
      env.changeManager.removeChangeListener(onChange);
      m2.fill = Color.green;
      expect(changes).containSubset([{prop: "fill"}, {prop: "submorphs"}]);
    });

    it("record async", () => {
      var m = morph({extent: pt(10,20), fill: Color.red});
      m.startRecordChanges();
      m.fill = Color.red;
      m.rotation += .1;
      var changes = m.stopRecordChanges();
      m.rotation += .1;
      expect(changes).containSubset([{prop: "fill"}, {prop: "rotation"}]);
      expect(MorphicEnv.default().changeManager.changeListeners).equals([]);
      expect(MorphicEnv.default().changeManager.changeRecorders).deep.equals({});
    });
  
    it("record async nested", () => {
      var m = morph({extent: pt(10,20), fill: Color.red});
      m.startRecordChanges();
      m.fill = Color.red;
      m.startRecordChanges();
      m.rotation += .1;
      var changes1 = m.stopRecordChanges();
      m.rotation += .1;
      var changes2 = m.stopRecordChanges();
  
      expect(changes1).containSubset([{prop: "rotation"}]);
      expect(changes2).containSubset([{prop: "fill"}, {prop: "rotation"}, {prop: "rotation"}]);
      expect(MorphicEnv.default().changeManager.changeListeners).equals([]);
      expect(MorphicEnv.default().changeManager.changeRecorders).deep.equals({});
    });
  
    it("record async overlap", () => {
      var m = morph({extent: pt(10,20), fill: Color.red});
      var {id: id1} = m.startRecordChanges();
      m.fill = Color.red;
      var {id: id2} = m.startRecordChanges();
      m.rotation += .1;
      var changes1 = m.stopRecordChanges(id1);
      m.rotation += .1;
      var changes2 = m.stopRecordChanges(id2);


      expect(changes1).containSubset([{prop: "fill"}, {prop: "rotation"}]);
      expect(changes2).containSubset([{prop: "rotation"}]);
      expect(MorphicEnv.default().changeManager.changeListeners).equals([]);
      expect(MorphicEnv.default().changeManager.changeRecorders).deep.equals({});
    });
  
    it("record sync then async", () => {
      var m = morph({extent: pt(10,20), fill: Color.red});
  
      var changes1 = m.changesWhile(() => {
        m.fill = Color.blue;
        m.startRecordChanges();
        m.addMorph({fill: Color.green});
      });
      m.rotation += .1;
      var changes2 = m.stopRecordChanges();
  
      expect(changes1).containSubset([
        {prop: "fill"},
        {prop: "fill"},
        {prop: "submorphs"}]);
  
      expect(changes2).containSubset([{prop: "rotation"}]);
  
      expect(MorphicEnv.default().changeManager.changeListeners).equals([]);
      expect(MorphicEnv.default().changeManager.changeRecorders).deep.equals({});
    });
  
  });

});
