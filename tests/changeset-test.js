/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { module } from "lively.modules";

import { createChangeSet, localChangeSets, setCurrentChangeSet } from "../src/changeset.js";
import { pkgDir, fileA, createPackage, deletePackage, vmEditorMock, initMaster, initChangeSet } from "./helpers.js";

describe("basics", () => {

  beforeEach(async () => {
    await createPackage();
    await setCurrentChangeSet(null);
  });

  afterEach(async () => {
    module(fileA).unload();
    const local = await localChangeSets();
    const toDelete = local.filter(c => c.name.match(/^test/));
    await Promise.all(toDelete.map(c => c.delete()));
    await deletePackage();
    await setCurrentChangeSet(null);
  });

  it("supports creating new, empty changesets", async () => {
    const cs = await createChangeSet("test");
    expect(await localChangeSets()).to.include(cs);
    await cs.delete();
    expect(await localChangeSets()).to.not.include(cs);
  });

  it("writes changes to file if there is no active changeset", async () => {
    const cs = await createChangeSet("test");
    await module(fileA).changeSource("export const x = 2;\n");
    expect(await cs.fileExists(fileA)).to.be.null;
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql("export const x = 2;\n");
    expect(cs.branches).to.have.length(0);
    await cs.delete();
    const changedSrc2 = await module(fileA).source();
    expect(changedSrc2).to.be.eql(changedSrc);
  });

  it("writes changes to new changeset", async () => {
    const cs = await initChangeSet();
    await module(fileA).changeSource("export const x = 2;\n");
    expect(await cs.fileExists(fileA)).to.be.true;
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql("export const x = 2;\n");
    expect(cs.branches).to.have.length(1);
    const changedFiles = await cs.branches[0].changedFiles();
    expect(Object.keys(changedFiles)).to.be.deep.eql(["a.js"]);
    await cs.delete();
    const changedSrc2 = await module(fileA).source();
    expect(changedSrc2).to.be.eql("export const x = 1;\n");
  });

  it("restores changes from changeset", async () => {
    const cs = await initChangeSet();
    await module(fileA).changeSource("export const x = 2;\n");
    await setCurrentChangeSet(null);

    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql("export const x = 1;\n");
    await setCurrentChangeSet("test");
    const changedSrc2 = await module(fileA).source();
    expect(changedSrc2).to.be.eql("export const x = 2;\n");
  });

  it("writes multiple changes to same changeset", async () => {
    const cs = await initChangeSet();
    await module(fileA).changeSource("export const x = 2;\n");
    await module(fileA).changeSource("export const x = 3;\n");
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql("export const x = 3;\n");
    await cs.delete();
    const changedSrc2 = await module(fileA).source();
    expect(changedSrc2).to.be.eql("export const x = 1;\n");
  });

  it("loads module when switching changeset", async () => {
    const cs = await initChangeSet(),
          mod = await module(fileA);
    await module(fileA).changeSource("export const x = 2;\n");

    expect(await System.import(fileA)).to.containSubset({x: 2});
    expect(mod.env().recorder).to.containSubset({x: 2});

    await setCurrentChangeSet(null);
    expect(await System.import(fileA)).to.containSubset({x: 1});
    expect(mod.env().recorder).to.containSubset({x: 1});

    await setCurrentChangeSet("test");
    expect(await System.import(fileA)).to.containSubset({x: 2});
    expect(mod.env().recorder).to.containSubset({x: 2});
  });

  it("fetches unloaded modules from changeset", async () => {
    const mod = await module(fileA);
    console.log("isLoaded? ", mod.isLoaded());
    const cs = await initChangeSet(true);
    console.log("isLoaded? ", mod.isLoaded());
    expect(mod.isLoaded()).to.be.false;
    expect(await System.import(fileA)).to.containSubset({x: 2});
  });
});
