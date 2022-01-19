/* global it, describe, beforeEach, afterEach, System */
import { expect } from 'mocha-es6';
import { pt, Color } from 'lively.graphics';
import { loadPart, savePart } from '../partsbin.js';
import { morph, World, MorphicEnv } from 'lively.morphic';
import { resource } from 'lively.resources';

import ObjectPackage, { addScript } from 'lively.classes/object-classes.js';
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { MorphicDB } from '../morphicdb/index.js';

let publishOpts = { addPreview: !System.get('@system-env').node };
let env; let packagesToRemove;
let isNode = System.get('@system-env').node;
let testDB;

async function setup () {
  if (isNode) {
    env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
    env.setWorld(new World({ name: 'world', extent: pt(300, 300) }));
  }
  packagesToRemove = [];
  
  testDB = MorphicDB.named('lively.morphic/objectdb/partsbin-test-db', {
    snapshotLocation: 'lively.morphic/objectdb/partsbin-test-db/snapshots/',
    serverURL: System.baseURL + 'objectdb/'
  });
  publishOpts.morphicDB = testDB;
}

async function teardown () {
  isNode && MorphicEnv.popDefault().uninstall();
  await Promise.all(packagesToRemove.map(ea => ea.remove()));
  await testDB.destroyDB();
  await resource(System.decanonicalize(testDB.snapshotLocation)).parent().remove();
}

describe('partsbin', function () {
  this.timeout(6000);

  beforeEach(setup);
  afterEach(teardown);

  it('publishes part in db', async () => {
    let m = morph({ name: 'test-morph' });
    let commit = await savePart(m, m.name, publishOpts, { author: { name: 'foo-user' } });
    expect(commit.name).equals(m.name);
  });

  it('loads a part', async () => {
    let p = ObjectPackage.withId('package-for-loads-a-part-test');
    packagesToRemove.push(p);

    let m = morph({ name: 'test-morph' });
    await p.adoptObject(m);
    await addScript(m, () => 23, 'foo');

    let { name: partName } = await savePart(m, m.name, publishOpts, { author: { name: 'foo-user' } });
    let m2 = await loadPart(partName, { morphicDB: testDB });
    expect(m2.foo()).equals(23);
    expect(m2.id).not.equals(m.id);

    expect(await testDB.latestCommits('part', /* includeDeleted = */true))
      .containSubset([{ name: partName }]);
  });

  it('loads most recent part state from file', async () => {
    // publish version 1
    let p = ObjectPackage.withId('package-for-loads-a-part-test');
    packagesToRemove.push(p);

    let m = morph({ name: 'test-morph', fill: Color.red });
    await p.adoptObject(m);
    await addScript(m, () => 23, 'foo');
    let commit = await savePart(m, m.name, publishOpts, { author: { name: 'foo-user' } });

    // publish version 2
    m.fill = Color.yellow;
    await addScript(m, () => 24, 'foo');
    await savePart(m, m.name, publishOpts, { author: { name: 'foo-user' } });

    let m2 = await loadPart(m.name, { morphicDB: testDB });
    expect(m2.fill).equals(Color.yellow);
    expect(m2.foo()).equals(24);

    // revert to version 1
    await savePart(await testDB.load(commit), m.name, publishOpts, { author: { name: 'foo-user' } });
    let m3 = await loadPart(m.name, { morphicDB: testDB });
    expect(m3.fill).equals(Color.red, 'state not that of version 1');
    expect(m3.foo()).equals(24, 'behavior did not remain at the most recent version');
  });
});
