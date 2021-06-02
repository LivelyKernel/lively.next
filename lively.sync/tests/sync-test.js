/* global declare, it, describe, beforeEach, afterEach,xit */

import { expect } from 'mocha-es6';
import { morph } from 'lively.morphic';
import { promise, obj, tree } from 'lively.lang';
import { pt, Color, Rectangle } from 'lively.graphics';
import { disconnect, disconnectAll, connect } from 'lively.bindings';
import { buildTestWorld, destroyTestWorld } from './helper.js';
import { Client } from '../client.js';
import { Master } from '../master.js';

// System.decanonicalize("mocha-es6", "http://localhost:9011/lively.sync/tests/sync-test.js")
// var env1, env2, env3,
//     client1, client2, master;

let state;

async function setup (nClients) {
  if (!state) state = {};
  if (state.running) teardown();

  let masterEnv = state.masterEnv = await buildTestWorld({ type: 'world', name: 'world', extent: pt(300, 300) }, pt(0, 0));
  let master = state.master = new Master(masterEnv.world);
  state.masterWorld = masterEnv.world;

  for (let i = 0; i < nClients; i++) {
    let env = state[`env${i + 1}`] = await buildTestWorld(masterEnv.world.exportToJSON(), pt(0, 300 * (i + 1)), true);
    let client = state[`client${i + 1}`] = new Client(env.world, `client${i + 1}`);
    client.connectToMaster(master);
    state[`world${i + 1}`] = env.world;
    connect(env.changeManager, 'changeRecorded', client, 'newChange');
  }
  state.running = true;
}

function teardown () {
  let s = state;
  if (!s) return;
  s.running = false;

  destroyTestWorld(s.masterEnv);

  Object.keys(s).forEach(name => {
    if (name.match(/^env/)) {
      let env = s[name];
      disconnectAll(env.changeManager);
      try {
        destroyTestWorld(env);
      } catch (e) { console.error(e); }
    } else if (name.match(/^client/)) {
      let client = s[name];
      client.disconnectFromMaster();
      client.receive = function () {};
    }
  });
}

describe('messaging between master and client', () => {
  beforeEach(async () => setup(1));
  afterEach(async () => teardown());

  it('single op', async () => {
    let { world1, masterWorld, client1, master } = state;
    world1.fill = Color.green;
    await promise.delay(30);
    expect(master.history).to.have.length(1);
    expect(client1.history).to.have.length(1);
    expect(client1.buffer).to.have.length(0);
    expect(masterWorld.fill).equals(Color.green);
  });

  it('version numbers', async () => {
    let { world1, masterWorld, client1, master } = state;
    world1.fill = Color.green;
    world1.fill = Color.red;
    await client1.synced();
    expect(master.history).to.have.length(2);
    expect(client1.history).to.have.length(2);
    expect(master.history).containSubset([{ version: 0 }, { version: 1 }]);
    expect(client1.history).containSubset([{ version: 0 }, { version: 1 }]);
  });
});

describe('syncing master with two clients', function () {
  // this.timeout(5*1000);
  this.timeout(1 * 1000);

  beforeEach(async () => setup(2));
  afterEach(async () => teardown());

  it('simple prop', async () => {
    let { world1, world2, masterWorld, client1 } = state;
    world1.fill = Color.green;
    await client1.synced();
    expect(masterWorld.fill).equals(Color.green);
    expect(world2.fill).equals(Color.green);
  });

  it('adding a morph', async () => {
    let { world1, world2, masterWorld, client1, client2, master } = state;
    world1.addMorph({ name: 'm1', position: pt(10, 10), extent: pt(50, 50), fill: Color.red });
    await client1.synced();

    // is morph state completely synced?
    // wont work if inspector is loaded
    // expect(masterWorld.exportToJSON()).deep.equals(world1.exportToJSON(), "masterWorld");
    // expect(world2.exportToJSON()).deep.equals(world1.exportToJSON(), "world2");

    // has morph an owner?
    expect(masterWorld.getSubmorphNamed('m1').owner).equals(masterWorld);
    expect(world2.getSubmorphNamed('m1').owner).equals(world2);

    // is history consistent?
    expect(client1.history).to.have.length(1);
    let expectedChange = {
      target: { type: 'lively-sync-morph-ref', id: world1.id },
      type: 'method-call',
      selector: 'addMorphAt',
      args: [{
        type: 'lively-sync-morph-spec',
        spec: obj.select(morph({ name: 'm1', position: pt(10, 10), extent: pt(50, 50) }).exportToJSON({ keepFunctions: false }), ['name', 'position', 'extent'])
      }, 0]
    };

    expect(client1.history[0].change).containSubset(expectedChange);
    expect(client2.history).to.have.length(1);
    expect(master.history[0].change).containSubset(expectedChange);
    expect(master.history).to.have.length(1);

    // are there different morphs in each world?
    let world1Morphs = world1.withAllSubmorphsDo(ea => ea);
    let world2Morphs = world2.withAllSubmorphsDo(ea => ea);
    let world3Morphs = masterWorld.withAllSubmorphsDo(ea => ea);
    world1Morphs.map((m, i) => {
      expect(m.id).equals(world2Morphs[i].id, `morphs ${m.name} (${i}) in world 1 and 2 have not the same id`);
      expect(m.id).equals(world3Morphs[i].id, `morphs ${m.name} (${i}) in world 1 and 3 have not the same id`);
      expect(world2Morphs[i].id).equals(world3Morphs[i].id, `morphs ${m.name} (${i}) in world 2 and 3 have not the same id`);
      expect(m).not.equals(world2Morphs[i], `morphs ${m.name} (${i}) in world 1 and 2 are identical`);
      expect(m).not.equals(world3Morphs[i], `morphs ${m.name} (${i}) in world 1 and 3 are identical`);
      expect(world2Morphs[i]).not.equals(world3Morphs[i], `morphs ${m.name} (${i}) in world 2 and 3 are identical`);
    });
  });

  it('adding a morph hierarchy', async () => {
    let { world1, world2, masterWorld, client1, client2, master } = state;
    let m = morph({
      name: 'm1',
      position: pt(10, 10),
      extent: pt(50, 50),
      fill: Color.red,
      submorphs: [{ name: 'm2', position: pt(10, 10), extent: pt(50, 50), fill: Color.orange }]
    });
    let spec = obj.select(
      morph({
        name: 'm1', position: pt(10, 10), extent: pt(50, 50)
      }).exportToJSON({ keepFunctions: false }),
      ['name', 'position', 'extent']);
    world1.addMorph(m);
    await client1.synced();

    // is morph state completely synced?
    // expect(masterWorld.exportToJSON()).deep.equals(world1.exportToJSON(), "masterWorld");
    // expect(world2.exportToJSON()).deep.equals(world1.exportToJSON(), "world2");

    // has morph an owner?
    expect(masterWorld.getSubmorphNamed('m1').owner).equals(masterWorld);
    expect(world2.getSubmorphNamed('m1').owner).equals(world2);

    // is history consistent?
    expect(client1.history).to.have.length(1);
    let expectedChange = {
      target: { type: 'lively-sync-morph-ref', id: world1.id },
      type: 'method-call',
      selector: 'addMorphAt',
      args: [{ type: 'lively-sync-morph-spec', spec }, 0]
    };

    expect(client1.history[0].change).containSubset(expectedChange);
    expect(client2.history).to.have.length(1);
    expect(master.history[0].change).containSubset(expectedChange);
    expect(master.history).to.have.length(1);

    // are there different morphs in each world?
    let world1Morphs = world1.withAllSubmorphsDo(ea => ea);
    let world2Morphs = world2.withAllSubmorphsDo(ea => ea);
    let world3Morphs = masterWorld.withAllSubmorphsDo(ea => ea);
    world1Morphs.map((m, i) => {
      expect(m.id).equals(world2Morphs[i].id, `morphs ${m.name} (${i}) in world 1 and 2 have not the same id`);
      expect(m.id).equals(world3Morphs[i].id, `morphs ${m.name} (${i}) in world 1 and 3 have not the same id`);
      expect(world2Morphs[i].id).equals(world3Morphs[i].id, `morphs ${m.name} (${i}) in world 2 and 3 have not the same id`);
      expect(m).not.equals(world2Morphs[i], `morphs ${m.name} (${i}) in world 1 and 2 are identical`);
      expect(m).not.equals(world3Morphs[i], `morphs ${m.name} (${i}) in world 1 and 3 are identical`);
      expect(world2Morphs[i]).not.equals(world3Morphs[i], `morphs ${m.name} (${i}) in world 2 and 3 are identical`);
      expect(master.state.objects.get(m.id)).not.be.undefined;
      expect(client1.state.objects.get(m.id)).not.be.undefined;
      expect(client2.state.objects.get(m.id)).not.be.undefined;
    });
  });

  it('if possible, changes are compacted', async () => {
    let { world1, world2, masterWorld, client1, master } = state;
    let m = world1.addMorph({ position: pt(10, 10), extent: pt(50, 50), fill: Color.red });
    expect().assert(m.env === world1.env, 'm has not the env of its world');
    m.moveBy(pt(1, 1)); m.moveBy(pt(1, 1)); m.moveBy(pt(2, 2));
    await client1.synced();
    expect(client1.history).to.have.length(2);
    expect(master.history).to.have.length(2);
    expect(master.history[0]).to.containSubset({ change: { type: 'method-call', selector: 'addMorphAt' } });
    expect(master.history[1]).to.containSubset({ change: { type: 'setter', prop: 'position', value: pt(14, 14) } });
  });

  it('sync image', async () => {
    let { world1, client1, env2 } = state;
    let m = world1.addMorph({ type: 'image', extent: pt(50, 50) });
    await client1.synced();
    // make sure it is rendered correctly
    expect(env2.renderer.getNodeForMorph(env2.world.submorphs[0])).deep.property('childNodes[0].tagName', 'IMG');
  });

  it('take client offline then online', async () => {
    let { world1, world2, masterWorld, client1, client2 } = state;
    world1.fill = Color.white;
    await client1.synced();
    expect(masterWorld.fill).equals(Color.white);

    client1.goOffline();
    world2.fill = Color.green;
    await client2.synced();
    expect(masterWorld.fill).equals(Color.green);
    expect(world1.fill).equals(Color.white);

    client1.goOnline();
    await client1.synced();
    expect(world1.fill).equals(Color.green);
  });

  it('re-connect client', async () => {
    let { world1, world2, masterWorld, client1, client2, master } = state;
    world1.fill = Color.yellow;
    await client1.synced();
    expect(masterWorld.fill).equals(Color.yellow);

    client1.disconnectFromMaster();
    world2.fill = Color.green;
    await client2.synced();
    expect(masterWorld.fill).equals(Color.green);
    expect(world1.fill).equals(Color.yellow);

    client1.connectToMaster(master);
    await client1.syncWithMaster();
    expect(world1.fill).equals(Color.green);
  });

  describe('locking', () => {
    it('all participants by one client', async () => {
      let { world1, world2, masterWorld, client1, client2, master } = state;
      world1.fill = Color.green;
      await client1.synced();

      await client1.lockEveryone();
      world2.fill = Color.red;
      await promise.delay(10);
      expect(world1.fill).equals(Color.green, 'client1 after lock');
      expect(masterWorld.fill).equals(Color.green, 'master after lock');

      await client1.unlockEveryone();
      await client2.synced();

      expect(masterWorld.fill).equals(Color.red);
      expect(world1.fill).equals(Color.red);
    });

    it('twice', async () => {
      let { world1, world2, masterWorld, client1, client2, master } = state;
      await client1.lockEveryone();
      try {
        await client2.lockEveryone();
      } catch (e) {
        expect(e).match(/already locked/i);
        return;
      }
      expect.fail(undefined, undefined, 'No error on second lock');
    });
  });

  describe('transforms', () => {
    describe('color conflict', () => {
      it('merge color', async () => {
        // setup(2)
        // teardown();

        let { world1, world2, masterWorld, client1, client2, master } = state;

        let tfm = (op1, op2) => {
          let v1 = op1.change.value;
          let v2 = op2.change.value;
          let resolvedValue = op1.creator < op2.creator ? v1 : v2;
          op1.change.value = resolvedValue;
          op2.change.value = resolvedValue;
          return { op1, op2 };
        };

        await client1.setTransforms([tfm]);

        // client1.state.transformFunctions = [tfm];
        // client2.state.transformFunctions = [tfm];
        // master.state.transformFunctions =  [tfm];

        world1.fill = Color.green;
        world2.fill = Color.blue;
        await client1.synced() && client2.synced();

        expect(masterWorld.fill).equals(Color.green, 'master');
        expect(world1.fill).equals(Color.green, 'client1');
        expect(world2.fill).equals(Color.green, 'client2');
      });
    });

    describe('position conflict', () => {
      it('resolved into geometric mean', async () => {
        let { world1, world2, masterWorld, client1, client2, master } = state;
        let m = world1.addMorph({ name: 'm1', position: pt(10, 10), extent: pt(50, 50), fill: Color.red });
        await client1.synced();
        world1.getSubmorphNamed('m1').position = pt(100, 100);
        world2.getSubmorphNamed('m1').position = pt(20, 20);
        world2.getSubmorphNamed('m1').position = pt(30, 30);
        await client1.synced() && client2.synced();
        expect(world2.getSubmorphNamed('m1').position).equals(world1.getSubmorphNamed('m1').position);
        expect(world2.getSubmorphNamed('m1').position).equals(pt(45, 45));

        function posTransform (op1, op2) {
          let c1 = op1.change; let c2 = op2.change;
          if (c1.prop === 'position' && c2.prop === 'position' &&
           c1.type === 'setter' && c2.type === 'setter' &&
           c1.target.id === c2.target.id &&
           c1.owner.id === c2.owner.id) {
            op1.change = op2.change = Object.assign({}, op1.change, { value: c1.value.addPt(c2.value.subPt(c1.value).scaleBy(0.5)) });
            return { op1, op2, handled: true };
          }
          return { op1, op2, handled: false };
        }
      });
    });

    describe('addMorph', () => {
      it('addMorphs into same owner, order fixed', async () => {
        let { world1, world2, client1, client2 } = state;
        let m1 = morph({ name: 'm1', position: pt(10, 10), extent: pt(50, 50), fill: Color.red });
        let m2 = morph({ name: 'm2', position: pt(20, 20), extent: pt(50, 50), fill: Color.green });
        world1.addMorph(m1);
        world2.addMorph(m2);
        await client1.synced() && client2.synced();
        expect(world1.submorphs.map(ea => ea.name)).equals(['m1', 'm2']);
        expect(world2.submorphs.map(ea => ea.name)).equals(['m1', 'm2']);
      });

      it('addMorphs of same morph, one creator wins', async () => {
        let { world1, world2, client1, client2 } = state;
        let m1 = world1.addMorph({ name: 'm1', position: pt(10, 10), extent: pt(50, 50), fill: Color.red });
        let m2 = world1.addMorph({ name: 'm2', position: pt(20, 20), extent: pt(50, 50), fill: Color.green });
        let m3 = world1.addMorph({ name: 'm3', position: pt(30, 30), extent: pt(50, 50), fill: Color.blue });
        await client1.synced();
        world1.getSubmorphNamed('m2').addMorph(world1.getSubmorphNamed('m1'));
        world2.getSubmorphNamed('m3').addMorph(world2.getSubmorphNamed('m1'));
        await client1.synced() && client2.synced();
        let tree1 = tree.mapTree(world1, (morph, names) => [morph.name, ...names], morph => morph.submorphs);
        let tree2 = tree.mapTree(world2, (morph, names) => [morph.name, ...names], morph => morph.submorphs);
        expect(tree1).deep.equals(['world', ['m2', ['m1']], ['m3']]);
        expect(tree2).deep.equals(['world', ['m2', ['m1']], ['m3']]);
      });

      xit('addMorph, inverse m1 <-> m2', async () => {
        let { world1, world2, client1, client2 } = state;
        let m1 = world1.addMorph({ name: 'm1', position: pt(10, 10), extent: pt(50, 50), fill: Color.red });
        let m2 = world1.addMorph({ name: 'm2', position: pt(20, 20), extent: pt(50, 50), fill: Color.green });
        await client1.synced() && client2.synced();

        // client2.goOffline();
        // client2.goOnline();

        world1.getSubmorphNamed('m1').addMorph(world1.getSubmorphNamed('m2'));
        world2.getSubmorphNamed('m2').addMorph(world2.getSubmorphNamed('m1'));

        await client1.synced() && client2.synced();
        let tree1 = tree.mapTree(world1, (morph, names) => [morph.name, ...names], morph => morph.submorphs);
        let tree2 = tree.mapTree(world2, (morph, names) => [morph.name, ...names], morph => morph.submorphs);
        expect(tree1).deep.equals(['world', ['m1', ['m2']]]);
        expect(tree2).deep.equals(['world', ['m1', ['m2']]]);
      });
    });
  });
});
