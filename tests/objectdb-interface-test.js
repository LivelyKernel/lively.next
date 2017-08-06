/*global declare, it, describe, beforeEach, afterEach, before, after,xit,xdescribe*/
import { expect } from "mocha-es6";
import ObjectDB from "../objectdb.js";
import { fillDB2, fillDB1 } from "./test-helper.js";
import { promise, arr } from "lively.lang";
import { ObjectDBInterface } from "lively.storage";


let world1, world2, part1,
    commit1, commit5, commit4, commit3, commit2,
    user1, user2,
    objectDB, snapshotLocation, dbName;


describe("interface test", function() {

  this.timeout(30*1000);

  before(async () => {
    ({
      world1, world2, part1,
      commit1, commit4, commit5, commit3, commit2,
      user1, user2,
      objectDB, snapshotLocation
    } = await fillDB1());
    dbName = objectDB.name;
  });

  after(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
  });

  describe("commit retrieval", () => {

    it("get list of all latest commits", async () => {
      let expected = [commit5, commit1, commit4].map(ea => ea._id),
          commits = await ObjectDBInterface.fetchCommits({db: dbName});
      expect(arr.intersect(commits.map(ea => ea._id), expected))
        .to.have.length(commits.length, "not all commits found");
    });

    it("get list of all latest commits by type", async () => {
      // versionDB = objectDB.__versionDB;
      // await versionDB.getAll({startkey: "world/\u0000", endkey: "world/\uffff"})

      let expected = [commit1, commit4].map(ea => ea._id),
          commits = await ObjectDBInterface.fetchCommits({db: dbName, type: "world"});
      expect(arr.intersect(commits.map(ea => ea._id), expected))
        .to.have.length(commits.length, "not all commits found");
    });

    it("get by types + names", async () => {
      let expected = [commit4].map(ea => ea._id),
          commits = await ObjectDBInterface.fetchCommits({db: dbName, typesAndNames: [{type: "world", name: world2.name}]});
      expect(arr.intersect(commits.map(ea => ea._id), expected))
        .to.have.length(commits.length, "not all commits found");
    });

    it("get by type name", async () => {
      let expected = [commit4].map(ea => ea._id),
          commits = await ObjectDBInterface.fetchCommits({db: dbName, typesAndNames: [{type: "world", name: world2.name}]});
      expect(arr.intersect(commits.map(ea => ea._id), expected))
        .to.have.length(commits.length, "not all commits found");
    });

    it("filter out known", async () => {
      let expected = [commit1, commit5].map(ea => ea._id),
          commits = await ObjectDBInterface.fetchCommits({db: dbName, knownCommitIds: {[commit4._id]: true}});
      expect(arr.intersect(commits.map(ea => ea._id), expected))
        .to.have.length(commits.length, "not all commits found");
    });

    it("commit log", async () => {
      let expected = [commit3, commit4].map(ea => ea._id),
          commitIds = await ObjectDBInterface.fetchLog({db: dbName, ref: "HEAD", commit: commit4._id, limit: 2});
      expect(arr.intersect(commitIds, expected))
        .to.have.length(commitIds.length, "not all commits found 1");
      let expected2 = [commit2, commit4].map(ea => ea._id),
          commits = await ObjectDBInterface.fetchLog({db: dbName, ref: "HEAD", type: "world", name: world2.name, includeCommits: true, knownCommitIds: {[commit3._id]: true}});
      expect(arr.intersect(commits.map(ea => ea._id), expected2))
        .to.have.length(commits.length, "not all commits found 2");
    });

  });

  describe("fetching snapshots", () => {

    it("does it", async () => {
      let snapshot1 = await ObjectDBInterface.fetchSnapshot({db: dbName, ref: "HEAD", type: "world", name: world2.name});
      expect(snapshot1).deep.equals({foo: {bar: 23}, x: 42, name: "another objectdb test world"});
      let snapshot2 = await ObjectDBInterface.fetchSnapshot({db: dbName, commit: commit3._id});
      expect(snapshot2).deep.equals({foo: {bar: 23}, x: 23, name: "another objectdb test world"});
    });

  });

  describe("committing snapshots", () => {

    it("commits", async () => {
      let snapshot = {foo: {bar: 23}, x: 99, name: "another objectdb test world"}
      try {
        await ObjectDBInterface.commit({db: dbName, type: "world", name: world2.name, expectedParentCommit: commit3._id, commitSpec: {user: user1}, snapshot});
        expect().assert(false, "allowing to cmmit with wrong prev commit");
      } catch (err) {}

      let committed = await ObjectDBInterface.commit({db: dbName, type: "world", name: world2.name, expectedParentCommit: commit4._id, commitSpec: {user: user1}, snapshot});
    });

  });

});
