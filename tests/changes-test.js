/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { morph, MorphicEnv } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color } from "lively.graphics";
import { num, arr } from "lively.lang";

describe("morph change recording", () => {

  it("records property modifications as changes", () => {
    var m = morph({extent: pt(10,20), fill: Color.red});
    // Hm... make this one??? For creation...?
    expect(m._rev).equals(m.env.changeRecorder.revision);
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

});


describe("tagging", () => {

  beforeEach(() => {
    
    // MorphicEnv.reset();
// MorphicEnv.popDefault()
// var env = MorphicEnv.default()
// env.changeRecorder.activeTags
// env.changeRecorder.taggings
  });

  it("tag changes sync", () => {
    var m = morph({extent: pt(10,20), fill: Color.red}),
        idx1 = m.changes.length, idx2, idx3;

    m.tagChangesWhile(['test-change'], () => {
      m.fill = Color.blue;
      idx2 = m.changes.length;
      m.tagChangesWhile(['test-change-2'], () =>
        m.addMorph({fill: Color.green}));
    });

    idx3 = m.changes.length;
    m.moveBy(pt(1,2));

    expect(arr.uniq(arr.flatten(m.changes.slice(idx1, idx2).map(c => c.tags))))
      .equals(["test-change"], "tags of initial morph")

    expect(arr.uniq(arr.flatten(m.changes.slice(idx2, idx3).map(c => c.tags))))
      .equals(["test-change", "test-change-2"], "tags of initial morph 2")

    expect(arr.uniq(arr.flatten(m.changes.slice(idx3).map(c => c.tags))))
      .equals([], "tags of initial morph 3")

    expect(arr.uniq(arr.flatten(m.submorphs[0].changes.map(c => c.tags))))
      .equals(["test-change", "test-change-2"], "tags of submorph")

    expect(MorphicEnv.default().changeRecorder.activeTags).equals([]);
    expect(MorphicEnv.default().changeRecorder.taggings).deep.equals({});
  });

  it("tag changes async", () => {
    var m = morph({extent: pt(10,20), fill: Color.red});
    m.tagChangesStart(["test"]);
    m.fill = Color.red;
    m.rotation += .1;
    var changes = m.tagChangesEnd();
    m.rotation += .1;
    expect(changes).containSubset([{prop: "fill", tags: ["test"]}, {prop: "rotation", tags: ["test"]}]);
    expect(m.changes.last().tags).equals([]);
    expect(MorphicEnv.default().changeRecorder.activeTags).equals([]);
    expect(MorphicEnv.default().changeRecorder.taggings).deep.equals({});
  });

  it("tag changes async nested", () => {
    var m = morph({extent: pt(10,20), fill: Color.red});
    m.tagChangesStart(["test"]);
    m.fill = Color.red;
    m.tagChangesStart(["test-2"]);
    m.rotation += .1;
    var changes1 = m.tagChangesEnd();
    m.rotation += .1;
    var changes2 = m.tagChangesEnd();

    expect(changes1).containSubset([{prop: "rotation", tags: ["test-2"]}]);
    expect(changes2).containSubset([{prop: "fill", tags: ["test"]}, {prop: "rotation", tags: ["test", "test-2"]}, {prop: "rotation", tags: ["test"]}]);
    expect(MorphicEnv.default().changeRecorder.activeTags).equals([]);
    expect(MorphicEnv.default().changeRecorder.taggings).deep.equals({});
  });

  it("tag changes async overlap", () => {
    var m = morph({extent: pt(10,20), fill: Color.red});
    var id1 = m.tagChangesStart(["test"]);
    m.fill = Color.red;
    var id2 = m.tagChangesStart(["test-2"]);
    m.rotation += .1;
    var changes1 = m.tagChangesEnd(id1);
    m.rotation += .1;
    var changes2 = m.tagChangesEnd(id2);

    expect(changes1).containSubset([{prop: "fill", tags: ["test"]}, {prop: "rotation", tags: ["test", "test-2"]}]);
    expect(changes2).containSubset([{prop: "rotation", tags: ["test-2"]}]);
    expect(MorphicEnv.default().changeRecorder.activeTags).equals([]);
    expect(MorphicEnv.default().changeRecorder.taggings).deep.equals({});
  });

  it("tag changes async overlap with same tag", () => {
    var m = morph({extent: pt(10,20), fill: Color.red});
    var id1 = m.tagChangesStart(["test"]);
    m.fill = Color.red;
    var id2 = m.tagChangesStart(["test"]);
    m.rotation += .1;
    var changes1 = m.tagChangesEnd(id1);
    m.rotation += .1;
    var changes2 = m.tagChangesEnd(id2);

    expect(changes1).containSubset([{prop: "fill", tags: ["test"]}, {prop: "rotation", tags: ["test"]}]);
    expect(changes2).containSubset([{prop: "rotation", tags: ["test"]}]);
    expect(MorphicEnv.default().changeRecorder.activeTags).equals([]);
    expect(MorphicEnv.default().changeRecorder.taggings).deep.equals({});
  });

  it("tag changes sync then async", () => {
    var m = morph({extent: pt(10,20), fill: Color.red});

    var changes1 = m.tagChangesWhile(['test-1'], () => {
      m.fill = Color.blue;
      m.tagChangesStart(["test-2"]);
      m.addMorph({fill: Color.green});
    });
    m.rotation += .1;
    var changes2 = m.tagChangesEnd();

    expect(changes1).containSubset([
      {prop: "fill", tags: ["test-1"]},
      {prop: "fill", tags: ["test-1", "test-2"]},
      {prop: "submorphs", tags: ["test-1", "test-2"]}]);

    expect(changes2).containSubset([{prop: "rotation", tags: ["test-2"]}]);

    expect(MorphicEnv.default().changeRecorder.activeTags).equals([]);
    expect(MorphicEnv.default().changeRecorder.taggings).deep.equals({});
  });

});

describe("undo", () => {

  it("records changes for undo", () => {
    var m1 = morph({submorphs: [{fill: Color.green}]});
    m1.undoStart("test");
    m1.fill = Color.green;
    m1.submorphs[0].position = pt(10,10);
    m1.undoStop("test");
    expect(m1.env.undoManager.undos).containSubset([{changes: [{prop: "fill"}, {prop: "position"}]}]);
  });

});