/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { removeDir, createFiles } from "lively.modules/tests/helpers.js";

import { createChangeSet, localChangeSets, currentChangeSet } from "../src/changeset.js";
import { gitInterface } from "../index.js";

const pkgDir = System.decanonicalize("lively.changesets/tests/temp/"),
      pkgFiles = {
        "a.js": "export const x = 1;",
        "package.json": '{"name": "temp", "main": "a.js"}'
      },
      fileA = pkgDir + "a.js",
      vmEditorMock = {updateModuleList: () => 0};

describe("basics", () => {

  let S;

  async function changeA(newSrc) {
    await gitInterface.interactivelyChangeModule(vmEditorMock, fileA, newSrc);
  }

  beforeEach(async () => {
    await createFiles(pkgDir, pkgFiles);
    await gitInterface.importPackage(pkgDir);
  });

  afterEach(async () => {
    await gitInterface.removePackage(pkgDir);
    await removeDir(pkgDir);
  });

  it("supports creating new, empty changesets", async () => {
    const cs = await createChangeSet("test");
    expect(await localChangeSets()).to.include(cs);
    await cs.delete();
    expect(await localChangeSets()).to.not.include(cs);
  });
  
  it("writes changes to file if there is no active changeset", async () => {
    //const cs = await createChangeSet("test");
    await changeA("export const x = 2;");
    //expect(await cs.fileExists(fileA)).to.be.null;
    const changedSrc = await gitInterface.moduleRead(fileA);
    expect(changedSrc).to.be.eql("export const x = 2;");
    //await cs.delete();
    //const changedSrc2 = await gitInterface.moduleRead(fileA);
    //expect(changedSrc2).to.be.eql(changedSrc);
  });
});
