/* global it, describe, beforeEach, afterEach */
import { morph, MorphicEnv } from '../index.js';
import { GroupChange } from '../changes.js';
import { expect } from 'mocha-es6';
import { pt, Color } from 'lively.graphics';
import { PropertyAnimation } from '../rendering/animations.js';

let env;

describe('changes', function () {
  this.timeout(5000);

  beforeEach(() => env = MorphicEnv.pushDefault(new MorphicEnv()));
  afterEach(() => MorphicEnv.popDefault().uninstall());

  it('records property modifications as changes', () => {
    let m = morph({ extent: pt(10, 20), fill: Color.red });
    // Hm... make this one??? For creation...?
    expect(m._rev).equals(m.env.changeManager.revision);
    expect(m.changes).containSubset([{ prop: 'extent' }, { prop: 'fill' }]);
  });

  it('onChange and onSubmorphChange handlers', () => {
    let m1 = morph({ submorphs: [{ fill: Color.green }] });
    let m2 = m1.submorphs[0];
    let m1Changes = []; let m1SubmorphChanges = [];
    let m2Changes = []; let m2SubmorphChanges = [];
    m1.onChange = (change) => m1Changes.push(change);
    m1.onSubmorphChange = (change, morph) => m1SubmorphChanges.push({ change, morph });
    m2.onChange = (change) => m2Changes.push(change);
    m2.onSubmorphChange = (change, morph) => m2SubmorphChanges.push({ change, morph });

    m2.fill = Color.yellow;

    expect(m1Changes).equals([]);
    expect(m1SubmorphChanges).deep.property('[0].change').containSubset({ prop: 'fill', value: Color.yellow });
    expect(m1SubmorphChanges).deep.property('[0].morph', m2);
    expect(m2Changes).containSubset([{ prop: 'fill', value: Color.yellow }]);
    expect(m2SubmorphChanges).equals([]);
  });

  describe('grouping', () => {
    it('while', () => {
      let m = morph(); let change = new GroupChange(m); let i = m.changes.length;
      m.groupChangesWhile(change, () => { m.fill = Color.blue; m.moveBy(pt(1, 2)); });
      m.fill = Color.red;
      expect(m.changes.slice(i, -1)).equals([change], 'inner changes are recorded globally');
      expect(change.changes).containSubset([{ prop: 'fill' }, { prop: 'position' }]);
    });

    it('while nested', () => {
      let m = morph(); let change1 = new GroupChange(m); let change2 = new GroupChange(m); let i = m.changes.length;
      m.groupChangesWhile(change1, () => {
        m.fill = Color.blue;
        m.groupChangesWhile(change2, () => m.moveBy(pt(1, 2)));
      });
      expect(m.changes.slice(i)).equals([change1], 'inner changes are recorded globally');
      expect(change1.changes).containSubset([{ prop: 'fill' }, {}]);
      expect(change1.changes[1]).equals(change2);
      expect(change2.changes).containSubset([{ prop: 'position' }]);
    });

    it('with recording sync', () => {
      let m = morph(); let change = new GroupChange(m);
      let changes = m.recordChangesWhile(() =>
        m.groupChangesWhile(change, () => m.fill = Color.blue));
      expect(changes).equals([change]);
    });

    it('with recording async', () => {
      let m = morph(); let change = new GroupChange(m);
      m.recordChangesStart();
      m.groupChangesWhile(change, () => m.fill = Color.blue);
      let changes = m.recordChangesStop();
      expect(changes).equals([change]);
    });
  });

  describe('recording', () => {
    it('while', () => {
      let m = morph();
      let changes = m.recordChangesWhile(() => { m.fill = Color.blue; m.moveBy(pt(1, 2)); });
      expect(changes).containSubset([{ prop: 'fill' }, { prop: 'position' }]);
      expect(m.changes.slice(-2)).equals(changes);
    });

    describe('listener process', () => {
      it('add / remove', () => {
        let changes = [];
        let onChange = change => changes.push(change);
        let m1 = morph(); let m2 = m1.addMorph({});
        env.changeManager.addChangeListener(onChange);
        m1.fill = Color.red;
        m2.addMorph({});
        env.changeManager.removeChangeListener(onChange);
        m2.fill = Color.green;
        expect(changes).containSubset([{ prop: 'fill' }, { selector: 'addMorphAt' }]);
      });

      it('record async', () => {
        let m = morph({ extent: pt(10, 20), fill: Color.red });
        m.recordChangesStart();
        m.fill = Color.red;
        m.rotation += .1;
        let changes = m.recordChangesStop();
        m.rotation += .1;
        expect(changes).containSubset([{ prop: 'fill' }, { prop: 'rotation' }]);
        expect(env.changeManager).not.haveOwnProperty('attributeConnections');
        expect(env.changeManager.changeRecorders).deep.equals({});
      });

      it('record async nested', () => {
        let m = morph({ extent: pt(10, 20), fill: Color.red });
        m.recordChangesStart();
        m.fill = Color.red;
        m.recordChangesStart();
        m.rotation += .1;
        let changes1 = m.recordChangesStop();
        m.rotation += .1;
        let changes2 = m.recordChangesStop();

        expect(changes1).containSubset([{ prop: 'rotation' }]);
        expect(changes2).containSubset([{ prop: 'fill' }, { prop: 'rotation' }, { prop: 'rotation' }]);
        expect(env.changeManager).not.haveOwnProperty('attributeConnections');
        expect(env.changeManager.changeRecorders).deep.equals({});
      });

      it('record async overlap', () => {
        let m = morph({ extent: pt(10, 20), fill: Color.red });
        let { id: id1 } = m.recordChangesStart();
        m.fill = Color.red;
        let { id: id2 } = m.recordChangesStart();
        m.rotation += .1;
        let changes1 = m.recordChangesStop(id1);
        m.rotation += .1;
        let changes2 = m.recordChangesStop(id2);

        expect(changes1).containSubset([{ prop: 'fill' }, { prop: 'rotation' }]);
        expect(changes2).containSubset([{ prop: 'rotation' }]);
        expect(env.changeManager).not.haveOwnProperty('attributeConnections');
        expect(env.changeManager.changeRecorders).deep.equals({});
      });

      it('record sync then async', () => {
        let m = morph({ extent: pt(10, 20), fill: Color.red });

        let changes1 = m.recordChangesWhile(() => {
          m.fill = Color.blue;
          m.recordChangesStart();
          m.addMorph({ fill: Color.green });
        });
        m.rotation += .1;
        let changes2 = m.recordChangesStop();

        expect(changes1).containSubset([
          { prop: 'fill' },
          { prop: 'fill' },
          { selector: 'addMorphAt' }]);

        expect(changes2).containSubset([{ prop: 'rotation' }]);

        expect(env.changeManager).not.haveOwnProperty('attributeConnections');
        expect(env.changeManager.changeRecorders).deep.equals({});
      });
    });
  });
  
  describe('animations', () => {
    it('enques a new animation when setting prop animated', () => {
      let m = morph({ extent: pt(10, 20), fill: Color.red });
      let q = m._animationQueue;
      q.registerAnimation({ fill: Color.green, extent: pt(50, 50), easing: 'easInOut', onFinish: () => m.remove() });
      expect(q.animations[0].animatedProps).deep.equals({ fill: Color.green, extent: pt(50, 50) });
    });
    
    it('does not enqueue the same prop animation more than once', () => {
      let m = morph({ extent: pt(10, 20), fill: Color.red });
      let q = m._animationQueue;
      let a1 = { fill: Color.green, extent: pt(50, 50), easing: 'easeInOut', onFinish: () => m.remove() };
      let a2 = { fill: Color.green, extent: pt(50, 50) };
      q.registerAnimation(a1);
      q.registerAnimation(a2);
      expect(q.animations.length).equals(1);
      expect(new PropertyAnimation(null, m, a1).equals(new PropertyAnimation(null, m, a2))).to.be.true;
    });
    
    it('does not enqueue animations that have no effect', () => {
      let m = morph({ extent: pt(10, 20), fill: Color.red });
      let q = m._animationQueue;
      let a = { extent: pt(10, 20), easing: 'easeInOut', onFinish: () => m.remove() };
      let anim = new PropertyAnimation(null, m, a);
      expect(anim.animatedProps).deep.equals({ extent: pt(10, 20) });
      expect(anim.affectsMorph).to.be.false;
      q.registerAnimation(a);
      expect(q.animations.length).equals(0);
    });

    it('merges animations that have the same duration', () => {
      let m = morph({ extent: pt(10, 20), fill: Color.red });
      let q = m._animationQueue;
      let config1 = { extent: pt(40, 40), duration: 200 };
      let config2 = { position: pt(50, 50), duration: 200 };
      q.registerAnimation(config1);
      q.registerAnimation(config2);
      expect(q.animations.length).equals(1);
      expect(q.animations[0].animatedProps).deep.equals({ extent: pt(40, 40), position: pt(50, 50) });
    });
  });
});
