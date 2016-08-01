/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { createChangeSet, localChangeSets, setCurrentChangeSet } from "../src/changeset.js";
import { gitInterface } from "../index.js";
import { pkgDir, fileA, createPackage, removePackage, vmEditorMock, initMaster, initChangeSet, changeFile } from "./helpers.js";

describe("serialize", () => {

  let cs;
  beforeEach(async () => {
    await createPackage();
    setCurrentChangeSet(null);
    cs = await initChangeSet();
  });

  afterEach(async () => {
    const local = await localChangeSets();
    const toDelete = local.filter(c => c.name.match(/^test/));
    await Promise.all(toDelete.map(c => c.delete()));
    await removePackage();
  });

  it("and deserialize", async () => {
    await changeFile("export const x = 2;\n");
    const obj = await cs.toObject();
    await cs.delete();
    const changedSrc = await gitInterface.moduleRead(fileA);
    expect(changedSrc).to.be.eql("export const x = 1;\n");
    const cs2 = await createChangeSet("test");
    await cs2.fromObject(obj);
    setCurrentChangeSet("test");
    const changedSrc2 = await gitInterface.moduleRead(fileA);
    expect(changedSrc2).to.be.eql("export const x = 2;\n");
    await cs2.delete();
  });
  
});
