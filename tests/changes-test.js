/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { morph } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color } from "lively.graphics";
import { num, arr } from "lively.lang";

describe("morph change recording", () => {

  it("records property modifications as changes", () => {
    var m = morph({extent: pt(10,20), fill: Color.red});
    expect(m._rev).equals(1);
    // expect(m.changes).equals(2);
  });

  it("tag changes", () => {
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

});
