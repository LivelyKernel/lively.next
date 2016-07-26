/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { createChangeSet, localChangeSets, currentChangeSet, setCurrentChangeSet, notify } from "../src/changeset.js";
import { gitInterface } from "../index.js";
import { pkgDir, fileA, createPackage, removePackage, vmEditorMock, initMaster, initChangeSet, changeFile } from "./helpers.js";

describe("notify", () => {
  
  let added, changed, current, deleted;
  
  function onAdd(msg) { added.push(msg); }
  function onChange(msg) { changed.push(msg); }
  function onCurrent(msg) { current.push(msg); }
  function onDelete(msg) { deleted.push(msg); }
  
  beforeEach(async () => {
    await createPackage();
    await setCurrentChangeSet(null);
    added = [], changed = [], current = [], deleted = [];
    notify.on("add", onAdd);
    notify.on("change", onChange);
    notify.on("current", onCurrent);
    notify.on("delete", onDelete);
  });

  afterEach(async () => {
    const local = await localChangeSets();
    const toDelete = local.filter(c => c.name.match(/^test/));
    await Promise.all(toDelete.map(c => c.delete()));
    await removePackage();
    notify.removeListener("add", onAdd);
    notify.removeListener("change", onChange);
    notify.removeListener("current", onCurrent);
    notify.removeListener("delete", onDelete);
  });

  it("of new changesets", async () => {
    expect(added).to.deep.equal([]);
    const cs = await createChangeSet("test");
    expect(added).to.containSubset([
      {changeset: "test"}
    ]);
    await cs.delete();
  });
  
  it("only if active changeset", async () => {
    const cs = await createChangeSet("test");
    expect(changed).to.deep.equal([]);
    await changeFile("export const x = 2;\n");
    expect(changed).to.deep.equal([]);
    await cs.delete();
  });
  
  it("of writes to changeset", async () => {
    const cs = await initChangeSet();
    expect(changed).to.deep.equal([]);
    await changeFile("export const x = 2;\n");
    expect(changed).to.containSubset([
      {changeset: "test"}
    ]);
    await cs.delete();
  });
  
  it("of changeset deletion", async () => {
    const cs = await createChangeSet("test");
    expect(deleted).to.deep.equal([]);
    await cs.delete();
    expect(deleted).to.containSubset([
      {changeset: "test"}
    ]);
  });

  it("when switching changesets", async () => {
    const cs = await createChangeSet("test"),
          cs2 = await createChangeSet("test2");
    expect(current).to.deep.equal([]);
    await setCurrentChangeSet("test");
    expect(current).to.containSubset([
      {changeset: "test"}
    ]);
    await setCurrentChangeSet("test2");
    expect(current).to.containSubset([
      {changeset: "test"},
      {changeset: "test2", before: "test"}
    ]);
  });
});
