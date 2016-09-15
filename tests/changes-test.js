/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { defaultDOMEnv } from "../rendering/dom-helper.js";
import { morph, MorphicEnv } from "../index.js";
import { GroupChange } from "../changes.js";
import { expect } from "mocha-es6";
import { pt, Color } from "lively.graphics";
import { num, arr } from "lively.lang";
import { PropertyAnimation } from "../rendering/morphic-default.js";

var env;

describe("changes", function () {

  this.timeout(5000);

  beforeEach(() => env = MorphicEnv.pushDefault(new MorphicEnv()));
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


  describe("grouping", () => {

    it("while", () => {
      var m = morph(), change = new GroupChange(m), i = m.changes.length;
      m.groupChangesWhile(change, () => { m.fill = Color.blue; m.moveBy(pt(1,2)) });
      m.fill = Color.red
      expect(m.changes.slice(i, -1)).equals([change], "inner changes are recorded globally");
      expect(change.changes).containSubset([{prop: "fill"}, {prop: "position"}]);
    });

    it("while nested", () => {
      var m = morph(), change1 = new GroupChange(m), change2 = new GroupChange(m), i = m.changes.length;
      m.groupChangesWhile(change1, () => {
        m.fill = Color.blue;
        m.groupChangesWhile(change2, () => m.moveBy(pt(1,2)));
      });
      expect(m.changes.slice(i)).equals([change1], "inner changes are recorded globally");
      expect(change1.changes).containSubset([{prop: "fill"}, {}]);
      expect(change1.changes[1]).equals(change2);
      expect(change2.changes).containSubset([{prop: "position"}]);
    });

    it("with recording sync", () => {
      var m = morph(), change = new GroupChange(m),
          changes = m.recordChangesWhile(() =>
            m.groupChangesWhile(change, () => m.fill = Color.blue));
      expect(changes).equals([change]);
    });

    it("with recording async", () => {
      var m = morph(), change = new GroupChange(m);
      m.recordChangesStart();
      m.groupChangesWhile(change, () => m.fill = Color.blue);
      var changes = m.recordChangesStop();
      expect(changes).equals([change]);
    });

  });

  describe("recording", () => {

    it("while", () => {
      var m = morph(),
          changes = m.recordChangesWhile(() => { m.fill = Color.blue; m.moveBy(pt(1,2)) });
      expect(changes).containSubset([{prop: "fill"}, {prop: "position"}]);
      expect(m.changes.slice(-2)).equals(changes);
    });


    describe("listener process", () => {

      it("add / remove", () => {
        var changes = [];
        var onChange = change => changes.push(change);
        var m1 = morph(), m2 = m1.addMorph({});
        env.changeManager.addChangeListener(onChange);
        m1.fill = Color.red;
        m2.addMorph({});
        env.changeManager.removeChangeListener(onChange);
        m2.fill = Color.green;
        expect(changes).containSubset([{prop: "fill"}, {selector: "addMorphAt"}]);
      });

      it("record async", () => {
        var m = morph({extent: pt(10,20), fill: Color.red});
        m.recordChangesStart();
        m.fill = Color.red;
        m.rotation += .1;
        var changes = m.recordChangesStop();
        m.rotation += .1;
        expect(changes).containSubset([{prop: "fill"}, {prop: "rotation"}]);
        expect(env.changeManager.changeListeners).equals([]);
        expect(env.changeManager.changeRecorders).deep.equals({});
      });

      it("record async nested", () => {
        var m = morph({extent: pt(10,20), fill: Color.red});
        m.recordChangesStart();
        m.fill = Color.red;
        m.recordChangesStart();
        m.rotation += .1;
        var changes1 = m.recordChangesStop();
        m.rotation += .1;
        var changes2 = m.recordChangesStop();

        expect(changes1).containSubset([{prop: "rotation"}]);
        expect(changes2).containSubset([{prop: "fill"}, {prop: "rotation"}, {prop: "rotation"}]);
        expect(env.changeManager.changeListeners).equals([]);
        expect(env.changeManager.changeRecorders).deep.equals({});
      });

      it("record async overlap", () => {
        var m = morph({extent: pt(10,20), fill: Color.red});
        var {id: id1} = m.recordChangesStart();
        m.fill = Color.red;
        var {id: id2} = m.recordChangesStart();
        m.rotation += .1;
        var changes1 = m.recordChangesStop(id1);
        m.rotation += .1;
        var changes2 = m.recordChangesStop(id2);


        expect(changes1).containSubset([{prop: "fill"}, {prop: "rotation"}]);
        expect(changes2).containSubset([{prop: "rotation"}]);
        expect(env.changeManager.changeListeners).equals([]);
        expect(env.changeManager.changeRecorders).deep.equals({});
      });

      it("record sync then async", () => {
        var m = morph({extent: pt(10,20), fill: Color.red});

        var changes1 = m.recordChangesWhile(() => {
          m.fill = Color.blue;
          m.recordChangesStart();
          m.addMorph({fill: Color.green});
        });
        m.rotation += .1;
        var changes2 = m.recordChangesStop();

        expect(changes1).containSubset([
          {prop: "fill"},
          {prop: "fill"},
          {selector: "addMorphAt"}]);

        expect(changes2).containSubset([{prop: "rotation"}]);

        expect(env.changeManager.changeListeners).equals([]);
        expect(env.changeManager.changeRecorders).deep.equals({});
      });

    });
    
  });
  
  describe("animations", () => {
    
    it("enques a new animation when setting prop animated", () => {
      var m = morph({extent: pt(10,20), fill: Color.red}),
          q = m._animationQueue;
      m.animate({fill: Color.green, extent: pt(50,50), easing: "easInOut", onFinish: () => m.remove()});
      expect(q.animations[0].changedProps).deep.equals({fill: Color.green, extent: pt(50,50)});
    })
    
    it("does not enqueue the same prop animation more than once", () => {
      var m = morph({extent: pt(10,20), fill: Color.red}),
          q = m._animationQueue,
          a1 = {fill: Color.green, extent: pt(50,50), easing: "easeInOut", onFinish: () => m.remove()},
          a2 = {fill: Color.green, extent: pt(50,50)};
      m.animate(a1);
      m.animate(a2);
      expect(new PropertyAnimation(null, m, a1).equals(new PropertyAnimation(null, m, a2))).to.be.true;
      expect(q.animations.length).equals(1);
    })
    
    it("does not enqueue animations that have no effect", () => {
      var m = morph({extent: pt(10,20), fill: Color.red}),
          q = m._animationQueue,
          a = {extent: pt(10,20), easing: "easeInOut", onFinish: () => m.remove()},
          anim = new PropertyAnimation(null, m, a);
      expect(anim.changedProps).deep.equals({extent: pt(10,20)})
      expect(anim.affectsMorph).to.be.false;
      m.animate(a);
      expect(q.animations.length).equals(0);
    })
    
  })

});
