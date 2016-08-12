/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { subscribe, unsubscribe } from "lively.notifications";
import { module } from "lively.modules";

import { createChangeSet, localChangeSets, deactivateAll, notify } from "../src/changeset.js";
import { fileA, createPackage, deletePackage, initChangeSet } from "./helpers.js";

describe("notify", () => {
  
  let added, changed, activated, deactivated, deleted;
  
  function onAdd(msg) { added.push(msg); }
  function onChange(msg) { changed.push(msg); }
  function onActivate(msg) { activated.push(msg); }
  function onDeactivate(msg) { deactivated.push(msg); }
  function onDelete(msg) { deleted.push(msg); }
  
  beforeEach(async () => {
    await createPackage();
    await deactivateAll();
    added = [], changed = [], activated = [], deactivated = [], deleted = [];
    subscribe("lively.changesets/added", onAdd);
    subscribe("lively.changesets/changed", onChange);
    subscribe("lively.changesets/activated", onActivate);
    subscribe("lively.changesets/deactivated", onDeactivate);
    subscribe("lively.changesets/deleted", onDelete);
  });

  afterEach(async () => {
    const local = await localChangeSets();
    const toDelete = local.filter(c => c.name.match(/^test/));
    await Promise.all(toDelete.map(c => c.delete()));
    await deletePackage();
    unsubscribe("lively.changesets/added", onAdd);
    unsubscribe("lively.changesets/changed", onChange);
    unsubscribe("lively.changesets/switchedcurrent", onActivate);
    unsubscribe("lively.changesets/deleted", onDelete);
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
    await module(fileA).changeSource("export const x = 2;\n");
    expect(changed).to.deep.equal([]);
    await cs.delete();
  });
  
  it("of writes to changeset", async () => {
    const cs = await initChangeSet();
    expect(changed).to.deep.equal([]);
    await module(fileA).changeSource("export const x = 2;\n");
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

  it("when activating changesets", async () => {
    const cs = await createChangeSet("test"),
          cs2 = await createChangeSet("test2");
    expect(activated).to.deep.equal([]);
    await cs.activate();
    expect(activated).to.containSubset([
      {changeset: "test"}
    ]);
    await cs2.activate();
    expect(activated).to.containSubset([
      {changeset: "test"},
      {changeset: "test2"}
    ]);
  });
  
  it("when deactivating changesets", async () => {
    const cs = await createChangeSet("test");
    expect(deactivated).to.deep.equal([]);
    await cs.activate();
    await cs.deactivate();
    expect(deactivated).to.containSubset([
      {changeset: "test"}
    ]);
  });
});
