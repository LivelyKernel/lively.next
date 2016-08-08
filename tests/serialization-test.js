/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { module } from "lively.modules";
import { createChangeSet, localChangeSets, setCurrentChangeSet } from "../src/changeset.js";
import { fileA, createPackage, deletePackage, initChangeSet } from "./helpers.js";

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
    await deletePackage();
  });

  it("and deserialize", async () => {
    await module(fileA).changeSource("export const x = 2;\n");
    const obj = await cs.toObject();
    await cs.delete();
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql("export const x = 1;\n");
    const cs2 = await createChangeSet("test");
    await cs2.fromObject(obj);
    await setCurrentChangeSet("test");
    const changedSrc2 = await module(fileA).source();
    expect(changedSrc2).to.be.eql("export const x = 2;\n");
    await cs2.delete();
  });
  
});
