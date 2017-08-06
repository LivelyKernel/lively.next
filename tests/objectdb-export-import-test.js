/*global declare, it, describe, beforeEach, afterEach, before, after,xit,xdescribe*/
import { expect } from "mocha-es6";
import ObjectDB from "../objectdb.js";
import { fillDB2 } from "./test-helper.js";
import { promise, obj } from "lively.lang";

import { resource } from "lively.resources";


let world1, world2,
    commit1, commit5, commit4, commit3, commit2,
    user1, user2,
    objectDB2, objectDB, snapshotLocation,
    exportDir = resource("local://objectdb-export-text/test1/"),
    exportLocation = resource("local://lively-morphic-objectdb-test/snapshots2/");


describe("export and import", function() {

  this.timeout(30*1000);


  beforeEach(async () => {
    ({
      world1, world2,
      commit1, commit4, commit3, commit2,
      user1, user2,
      objectDB, snapshotLocation
    } = await fillDB2());
  });


  afterEach(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
    await promise.delay(100);
    await exportDir.remove()
  });


  it("exports to directory", async () => {
    await objectDB.exportToDir(exportDir,
      [{name: world1.name, type: "world"}], true/*copy res's*/);

    let dirList = await exportDir.dirList("infinity", {exclude: ea => ea.isDirectory()});
    expect(dirList.map(ea => ea.name())).equals([
      "index.json", "commits.json", "history.json",
      ...[commit1, commit2, commit3].map(ea => objectDB.snapshotResourceFor(ea).name())
    ]);

    expect(await exportDir.join("world/objectdb test world/index.json").readJson())
      .deep.equals({type: "world", name: "objectdb test world"});
  });

  describe("import", () => {

    beforeEach(async () => {
      objectDB2 = ObjectDB.named("lively-morphic-objectdb-test-2", {snapshotLocation: exportLocation});
    });

    afterEach(async () => {
      await objectDB2.destroy();
      await exportLocation.remove()
    })

    it("reads exports into new DB", async () => {
      await objectDB.exportToDir(exportDir, [{name: world1.name, type: "world"}], true/*copy res's*/);
      await objectDB2.objectStats()
      let importData = await objectDB2.importFromDir(exportDir, false, true);

      let fullStats = await objectDB2.objectStats();
      expect(fullStats).deep.equals({
        world: {
          "objectdb test world": {count: 3, newest: commit3.timestamp, oldest: commit1.timestamp}
        }
      });

      try {
        await objectDB2.importFromDir(exportDir, false, true);
        expect().assert(false, "overwrite not allowed");
      } catch (err) {}

      await objectDB2.importFromDir(exportDir, true, true);
      fullStats = await objectDB2.objectStats();
      expect(fullStats).deep.equals({world: {"objectdb test world": {count: 3, newest: commit3.timestamp, oldest: commit1.timestamp}}});

      let hist1 = await objectDB.versionGraph("world", "objectdb test world"),
          hist2 = await objectDB2.versionGraph("world", "objectdb test world")
      expect(hist1.ref).equals(hist2.ref)
      expect(hist1.history).deep.equals(hist2.history);

      let commits1 = await objectDB.getCommits("world", "objectdb test world"),
          commits2 = await objectDB2.getCommits("world", "objectdb test world");
      expect(commits1.map(ea => obj.dissoc(ea, ["_rev"])))
        .deep.equals(commits2.map(ea => obj.dissoc(ea, ["_rev"])));
    });

  });

});
