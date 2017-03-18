/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { pt, Color } from "lively.graphics";
import { saveObjectToPartsbinFolder, loadObjectFromPartsbinFolder } from "../partsbin.js";
import { morph, World, MorphicEnv, inspect } from "lively.morphic";
import { resource } from "lively.resources";
import { arr } from "lively.lang";
import ObjectPackage, { addScript } from "lively.classes/object-classes.js";
import { createDOMEnvironment } from "../rendering/dom-helper.js";


let partsbinFolder = "local://morphic-partsbin-tests/", env, packagesToRemove;
let isNode = System.get("@system-env").node;

async function setup() {
  if (isNode) {
    env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
    env.setWorld(new World({name: "world", extent: pt(300,300)}));
  }
  packagesToRemove = [];
}

async function teardown() {
  isNode && MorphicEnv.popDefault().uninstall();
  await Promise.all(packagesToRemove.map(ea => ea.remove()));
  await resource(partsbinFolder).remove();
}

describe("partsbin", function () {

  this.timeout(6000);

  beforeEach(setup);
  afterEach(teardown);

  it("publishes part as file", async () => {
    var m = morph({name: "test-morph"}),
        {partName, url} = await saveObjectToPartsbinFolder(m, m.name, {partsbinFolder});
    expect(partName).equals(m.name);
    expect(url).equals(`${partsbinFolder}${m.name}.json`);
    let files = await resource(partsbinFolder).dirList();
    expect(arr.pluck(files, "url")).equals([url]);
  });

  it("loads a part", async () => {
    let p = ObjectPackage.withId("package-for-loads-a-part-test");
    packagesToRemove.push(p);

    var m = morph({name: "test-morph"}),
        _ = await p.adoptObject(m),
        _ = await addScript(m, () => 23, "foo"),
        {partName} = await saveObjectToPartsbinFolder(m, m.name, {partsbinFolder}),
        m2 = await loadObjectFromPartsbinFolder(partName, {partsbinFolder});
    expect(m2.foo()).equals(23);
    expect(m2.id).not.equals(m.id);
  });

  it("loads most recent part state from file", async () => {
    // publish version 1
    let p = ObjectPackage.withId("package-for-loads-a-part-test");
    packagesToRemove.push(p);

    var m = morph({name: "test-morph", fill: Color.red});
    await p.adoptObject(m);
    await addScript(m, () => 23, "foo");
    var {url} = await saveObjectToPartsbinFolder(m, m.name, {partsbinFolder}),
        version1 = await resource(url).read();

    // publish version 2
    m.fill = Color.yellow;
    await addScript(m, () => 24, "foo");
    await saveObjectToPartsbinFolder(m, m.name, {partsbinFolder});

    var m2 = await loadObjectFromPartsbinFolder(m.name, {partsbinFolder});
    expect(m2.fill).equals(Color.yellow);
    expect(m2.foo()).equals(24);

    // revert to version 1
    await resource(url).write(version1);
    var m3 = await loadObjectFromPartsbinFolder(m.name, {partsbinFolder});
    expect(m3.fill).equals(Color.red, "state not that of version 1");
    expect(m3.foo()).equals(23, "behavior not that of version 1");
  });

});
