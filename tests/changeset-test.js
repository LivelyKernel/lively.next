/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { createChangeSet, localChangeSets, setCurrentChangeSet } from "../src/changeset.js";
import { gitInterface } from "../index.js";
import { pkgDir, fileA, createPackage, removePackage, vmEditorMock, initMaster, initChangeSet, changeFile } from "./helpers.js";

describe("basics", () => {

  beforeEach(async () => {
    await createPackage();
    setCurrentChangeSet(null);
  });

  afterEach(async () => {
    const local = await localChangeSets();
    const toDelete = local.filter(c => c.name.match(/^test/));
    await Promise.all(toDelete.map(c => c.delete()));
    await removePackage();
  });

  it("supports creating new, empty changesets", async () => {
    const cs = await createChangeSet("test");
    expect(await localChangeSets()).to.include(cs);
    await cs.delete();
    expect(await localChangeSets()).to.not.include(cs);
  });
  
  it("writes changes to file if there is no active changeset", async () => {
    const cs = await createChangeSet("test");
    await changeFile("export const x = 2;\n");
    expect(await cs.fileExists(fileA)).to.be.null;
    const changedSrc = await gitInterface.moduleRead(fileA);
    expect(changedSrc).to.be.eql("export const x = 2;\n");
    expect(cs.branches).to.have.length(0);
    await cs.delete();
    const changedSrc2 = await gitInterface.moduleRead(fileA);
    expect(changedSrc2).to.be.eql(changedSrc);
  });
  
  it("writes changes to new changeset", async () => {
    const cs = await initChangeSet();
    await changeFile("export const x = 2;\n");
    expect(await cs.fileExists(fileA)).to.be.true;
    const changedSrc = await gitInterface.moduleRead(fileA);
    expect(changedSrc).to.be.eql("export const x = 2;\n");
    expect(cs.branches).to.have.length(1);
    const changedFiles = await cs.branches[0].changedFiles();
    expect(Object.keys(changedFiles)).to.be.deep.eql(["/a.js"]);
    await cs.delete();
    const changedSrc2 = await gitInterface.moduleRead(fileA);
    expect(changedSrc2).to.be.eql("export const x = 1;\n");
  });
  
  it("restore changes from changeset", async () => {
    const cs = await initChangeSet();
    await changeFile("export const x = 2;\n");
    setCurrentChangeSet(null);
    
    const changedSrc = await gitInterface.moduleRead(fileA);
    expect(changedSrc).to.be.eql("export const x = 1;\n");
    setCurrentChangeSet("test");
    const changedSrc2 = await gitInterface.moduleRead(fileA);
    expect(changedSrc2).to.be.eql("export const x = 2;\n");
    await cs.delete();
  });
  
  it("writes multiple changes to same changeset", async () => {
    const cs = await initChangeSet();
    await changeFile("export const x = 2;\n");
    await changeFile("export const x = 3;\n");
    const changedSrc = await gitInterface.moduleRead(fileA);
    expect(changedSrc).to.be.eql("export const x = 3;\n");
    await cs.delete();
    const changedSrc2 = await gitInterface.moduleRead(fileA);
    expect(changedSrc2).to.be.eql("export const x = 1;\n");
  });
});
