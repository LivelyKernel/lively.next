/*global declare, it, describe, beforeEach, afterEach, before, after,xit,xdescribe*/
import { expect, chai } from "mocha-es6";
import ObjectDB from "../objectdb.js";
import { fillDB1 } from "./test-helper.js";
import { promise } from "lively.lang";

import { resource } from "lively.resources";
import { Database } from "lively.storage";


let world1, world2, part1,
    commit1, commit5, commit4, commit3, commit2,
    author1, author2,
    objectDB, objectDB2, snapshotLocation;

let replicationLocation = resource("local://lively-morphic-objectdb-test/replicated-objects/");
let snapshotLocation2 = resource("local://lively-morphic-objectdb-test/more-snapshots/");
let pouchDBForCommits, pouchDBForHist;



async function expectDBsHaveSameDocs(db1, db2) {
  let docs1 = (await db1.getAll()).filter(ea => !ea._id.startsWith("_")),
      docs2 = (await db2.getAll()).filter(ea => !ea._id.startsWith("_"))
  expect(docs1).deep.members(docs2);
}


describe("replication", function() {

  this.timeout(20*1000);

  beforeEach(async () => {
    ({
      part1, world1, world2,
      commit1, commit5, commit4, commit3, commit2,
      author1, author2,
      objectDB, snapshotLocation
    } = await fillDB1());

    objectDB2 = ObjectDB.named("lively-morphic-objectdb-test-for-replication",
      {snapshotLocation});
    pouchDBForCommits = Database.ensureDB("objectdb-test-replication-commits");
    pouchDBForHist = Database.ensureDB("objectdb-test-replication-hist");
  });

  afterEach(async () => {
    await objectDB.destroy();
    await objectDB2.destroy();
    await snapshotLocation.remove();
    await promise.delay(40);
    await replicationLocation.remove();
    pouchDBForCommits && await pouchDBForCommits.destroy()
    pouchDBForHist && await pouchDBForHist.destroy();
  });

  it("syncs everything", async () => {
    let replication = objectDB.replicateTo(pouchDBForCommits, pouchDBForHist, replicationLocation);
    await replication.waitForIt();

    await expectDBsHaveSameDocs(objectDB.__commitDB, pouchDBForCommits);
    await expectDBsHaveSameDocs(objectDB.__versionDB, pouchDBForHist);
    
    let root = objectDB.snapshotLocation,
        origPaths = (await root.dirList()).map(ea => ea.relativePathFrom(root)),
        replicatedPaths = (await replicationLocation.dirList()).map(ea => ea.relativePathFrom(replicationLocation));
    expect(origPaths).equals(replicatedPaths);
  });

  it("replicates filtered", async () => {
    let replication = objectDB.replicateTo(
      pouchDBForCommits, pouchDBForHist, replicationLocation, {typesAndNames: [{type: "world", name: world2.name}]});
    await replication.waitForIt();

    await expectDBsHaveSameDocs(objectDB.__commitDB, pouchDBForCommits);
    await expectDBsHaveSameDocs(objectDB.__versionDB, pouchDBForHist);

    let root = objectDB.snapshotLocation,
        origPaths = (await root.dirList()).map(ea => ea.relativePathFrom(root)),
        replicatedPaths = (await replicationLocation.dirList()).map(ea => ea.relativePathFrom(replicationLocation));
    expect(origPaths).equals(replicatedPaths);
  });

  it("replicates new changes", async () => {
    let rep1 = await objectDB.replicateTo(pouchDBForCommits, pouchDBForHist, replicationLocation).waitForIt(),
        commit = await objectDB.commit("world", world1.name, {snap: "shot!"}, {author: author1, message: "fooo"}),
        rep2 = await objectDB.replicateTo(pouchDBForCommits, pouchDBForHist, replicationLocation).waitForIt();

    await expectDBsHaveSameDocs(objectDB.__commitDB, pouchDBForCommits);
    await expectDBsHaveSameDocs(objectDB.__versionDB, pouchDBForHist);

    let root = objectDB.snapshotLocation,
        origPaths = (await root.dirList()).map(ea => ea.relativePathFrom(root)),
        replicatedPaths = (await replicationLocation.dirList()).map(ea => ea.relativePathFrom(replicationLocation));
    expect(origPaths).equals(replicatedPaths);
  });

  it("replicates from", async () => {
    await objectDB.replicateTo(pouchDBForCommits, pouchDBForHist, replicationLocation)
      .waitForIt();
    let rep = await objectDB2.replicateFrom(
      pouchDBForCommits, pouchDBForHist, replicationLocation).waitForIt();

    
    await expectDBsHaveSameDocs(objectDB.__commitDB, objectDB2.__commitDB);
    await expectDBsHaveSameDocs(objectDB.__versionDB, objectDB2.__versionDB);

    let root = objectDB2.snapshotLocation,
        origPaths = (await root.dirList()).map(ea => ea.relativePathFrom(root)),
        replicatedPaths = (await replicationLocation.dirList()).map(ea =>
                            ea.relativePathFrom(replicationLocation));
    expect(origPaths).equals(replicatedPaths);
  });

  describe("sync", () => {

    it("sync live", async () => {
      let sync1 = objectDB.sync(pouchDBForCommits, pouchDBForHist, replicationLocation, {live: true}),
          sync2 = objectDB2.sync(pouchDBForCommits, pouchDBForHist, replicationLocation, {live: true});

      await Promise.all([sync1.whenPaused(), sync2.whenPaused()]);
      let commit = await objectDB.commit("world", "foo", {snap: "shot!"}, {author: author1, message: "fooo"});
      await Promise.all([sync1.safeStop(), sync2.safeStop()]);

      expect(await objectDB.getCommit(commit._id))
        .deep.equals(await objectDB2.getCommit(commit._id));
      expect(await objectDB.snapshotResourceFor(commit).exists()).equals(true);
      expect(await objectDB2.snapshotResourceFor(commit).exists()).equals(true);
    });

    it("committed at same time", async () => {
      let sync1 = objectDB.sync(pouchDBForCommits, pouchDBForHist, replicationLocation, {live: true}),
          sync2 = objectDB2.sync(pouchDBForCommits, pouchDBForHist, replicationLocation, {live: true});

      await Promise.all([sync1.whenPaused(), sync2.whenPaused()]);
      let [commit1, commit2] = await Promise.all([
        objectDB.commit("world", "foo", {snap: "shotX!"}, {author: author1, message: "fooo"}),
        objectDB2.commit("world", "foo", {snap: "shotY!"}, {author: author1, message: "barr"})
      ]);
      await Promise.all([sync1.safeStop(), sync2.safeStop()]);

      expect(await objectDB.__versionDB.get("world/foo"))
        .deep.equals(await objectDB2.__versionDB.get("world/foo"))
    });

    it("conflict", async () => {
      await objectDB.commit("world", "foo", {snap: "shot;"}, {author: author1, message: "first"});
      await objectDB.sync(pouchDBForCommits, pouchDBForHist, replicationLocation).waitForIt();
      await objectDB2.sync(pouchDBForCommits, pouchDBForHist, replicationLocation).waitForIt();

      let [commit1, commit2] = await Promise.all([
        objectDB.commit("world", "foo", {snap: "shotX!"}, {author: author1, message: "second A"}),
        objectDB2.commit("world", "foo", {snap: "shotY!"}, {author: author1, message: "second B"})
      ]);

      let sync1 = objectDB.sync(pouchDBForCommits, pouchDBForHist, replicationLocation),
          sync2 = objectDB2.sync(pouchDBForCommits, pouchDBForHist, replicationLocation);

      await sync1.waitForIt(); await sync2.waitForIt();

      expect(sync1.conflicts).containSubset([{id: "world/foo"}]);
      expect(sync1.changes).equals([commit1._id])
    });

  });

});
