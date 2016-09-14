/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { module, getPackage } from "lively.modules";

import { localBranchesOf, localChangeSets } from "../src/changeset.js";
import { pkgDir, fileA, createPackage, deletePackage, initChangeSet } from "./helpers.js";

describe("basics", () => {
    
  beforeEach(async () => {
    await createPackage();
    await initChangeSet(true);
  });

  afterEach(async () => {
    module(fileA).unload();
    const local = await localChangeSets();
    const toDelete = local.filter(c => c.name.match(/^test/));
    await Promise.all(toDelete.map(c => c.delete()));
    await deletePackage();
  });

  it("exposes changeset branches", async () => {
    const branches = await localBranchesOf(pkgDir);
    expect(branches).to.have.length(2);
    expect(branches[0].name).to.be.eql("master");
    expect(branches[1].name).to.be.eql("test");
  });

});
