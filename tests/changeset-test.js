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
  });
});