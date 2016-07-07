/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { createChangeSet, localChangeSets, currentChangeSet } from "../src/changeset.js";
import { gitInterface } from "../index.js";

describe("basics", () => {

  it("supports creating new, empty changesets", async () => {
    const cs = await createChangeSet("test");
    expect(await localChangeSets()).to.include(cs);
  });
});