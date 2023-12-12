/* global it, describe, beforeEach, afterEach */
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { MorphicEnv, Morph } from '../index.js';
import { morph } from '../index.js';
import { expect } from 'mocha-es6';
import { pt, Color } from 'lively.graphics';
import * as moduleManager from 'lively.modules';
import { serializeMorph, createMorphSnapshot, deserializeMorph, loadMorphFromSnapshot } from '../serialization.js';
import { arr } from 'lively.lang';
import ObjectPackage from 'lively.classes/object-classes.js';

let world;
function createDummyWorld () {
  return world = morph({
    type: 'world',
    name: 'world',
    extent: pt(300, 300),
    submorphs: [{
      name: 'submorph1',
      extent: pt(100, 100),
      position: pt(10, 10),
      fill: Color.red,
      submorphs: [{ name: 'submorph2', extent: pt(20, 20), position: pt(5, 10), fill: Color.green }]
    }]
  });
}

let env;
async function setup () {
  env = new MorphicEnv(await createDOMEnvironment());
  MorphicEnv.pushDefault(env);
  await env.setWorld(createDummyWorld());
}

function teardown () { MorphicEnv.popDefault().uninstall(); }

class OnLoadTestMorph extends Morph { onLoad () { this.onLoadCalled = true; }}

describe('morph serialization', function () {
  this.timeout(5000);

  beforeEach(setup);
  afterEach(teardown);

  it('serialize single morph', () => {
    let m = morph({ fill: Color.red, position: pt(10, 20) });
    let copy = deserializeMorph(serializeMorph(m));
    expect(copy).instanceOf(m.constructor);
    expect(copy.id).equals(m.id);
    expect(copy).not.equal(m);
    expect(copy.position).equals(m.position);
    expect(copy.fill).equals(m.fill);
    expect(copy.extent).equals(m.extent);
  });

  it('uses onLoad function', () => {
    let m = new OnLoadTestMorph();
    expect(m.onLoadCalled).equals(true, 'onLoad not called on construction');
    m.onLoadCalled = false;
    expect(m.copy().onLoadCalled).equals(true, 'onLoad not called on deserialization');
  });

  describe('object packages', () => {
    let objPackages = [];

    afterEach(async () => {
      await Promise.all(objPackages.map(ea => ea.remove()));
      objPackages.length = 0;
    });

    it('gets snapshotted', async () => {
      let p1 = ObjectPackage.withId('MorphA');
      let p2 = ObjectPackage.withId('MorphB');

      objPackages.push(p1, p2);

      let c1 = await p1.ensureObjectClass(Morph);
      let c2 = await p2.ensureObjectClass(Morph);
      await p1.objectModule.systemModule.changeSource(`
        import { Morph } from "lively.morphic";
        export default class MorphA extends Morph {
          static get properties() { return {foo: {}}; }
        }`);

      let m1 = new c1();
      m1.foo = new c2();

      let snap = await createMorphSnapshot(m1, { addPreview: false, moduleManager });
      expect(snap.packages['local://lively-object-modules/']).to.have.keys('MorphA', 'MorphB');
    });

    describe('dealing with versions', () => {
      let snap1, snap2, snap3, p1, obj, c1;

      beforeEach(async () => {
        p1 = ObjectPackage.withId('MorphA');

        objPackages.push(p1);

        c1 = await p1.ensureObjectClass(Morph), obj = new c1();

        snap1 = await createMorphSnapshot(obj, { addPreview: false, moduleManager });

        await p1.objectModule.systemModule.changeSource(`
          import { Morph } from "lively.morphic";
          export default class MorphA extends Morph {m() { return 23; }}`);
        var config = await p1.resource('package.json').readJson();
        p1.systemPackage.updateConfig({ ...config, version: '0.2.0' });

        snap2 = await createMorphSnapshot(obj, { addPreview: false, moduleManager });

        await p1.objectModule.systemModule.changeSource(`
          import { Morph } from "lively.morphic";
          export default class MorphA extends Morph {m() { return 24; }}`);
        var config = await p1.resource('package.json').readJson();
        p1.systemPackage.updateConfig({ ...config, version: '0.3.0' });

        snap3 = await createMorphSnapshot(obj, { addPreview: false, moduleManager });
      });

      it('newer package versions get not overridden', async () => {
        expect(obj.m()).equals(24);
        let obj2 = await loadMorphFromSnapshot(snap2, { moduleManager });
        expect(obj.m()).equals(24);
        expect(obj2.m()).equals(24);

        await p1.objectModule.systemModule.changeSource(`
          import { Morph } from "lively.morphic";
          export default class MorphA extends Morph {m() { return 25; }}`);
        let obj3 = await loadMorphFromSnapshot(snap2, { moduleManager });

        expect(obj.m()).equals(25);
        expect(obj3.m()).equals(25);
      });
    });
  });
});
