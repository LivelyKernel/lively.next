/*global declare, it, describe, beforeEach, afterEach, before, after,xit,xdescribe*/
import { expect } from "mocha-es6";
import ObjectDB, { ObjectDBInterface } from "../objectdb.js";
import { obj, arr, promise } from "lively.lang";
import { resource } from "lively.resources";

function createDummyObject() {
  return {name: "some dummy object", foo: {bar: 23}};
}

// function createDummyObject() {
//   let root = {name: "some dummy object"};
//   let obj1 = {name: "obj1"};
//   let obj2 = {name: "obj2"};
//   let obj3 = {name: "obj3"};
//   root.children = [obj1, obj2];
//   obj1.parent = root;
//   obj2.parent = root;
//   obj1.friend = obj2;
//   obj2.friend = obj3;
//   return root;
// }

async function fillDB1() {
  world1 = Object.assign(createDummyObject(), {name: "objectdb test world"});
  world2 = Object.assign(createDummyObject(), {name: "another objectdb test world"});
  part1 = Object.assign(createDummyObject(), {name: "a part"});
  commit1 = await objectDB.snapshotObject("world", world1.name, world1, {}, {user: user1});
  commit2 = await objectDB.snapshotObject("world", world2.name, world2, {}, {user: user1});
  commit3 = await objectDB.snapshotObject("world", world2.name, Object.assign(world2, {x: 23}), {}, {user: user1});
  commit4 = await objectDB.snapshotObject("world", world2.name, Object.assign(world2, {x: 42}), {}, {user: user1});
  commit5 = await objectDB.snapshotObject("part", part1.name, part1, {}, {user: user1, metadata: {something: "hello world"}});
}

async function fillDB2() {
  objectDB = ObjectDB.named("lively-morphic-objectdb-test", {snapshotLocation});
  world1 = Object.assign(createDummyObject(), {name: "objectdb test world"});
  world2 = Object.assign(createDummyObject(), {name: "other objectdb test world"});
  commit1 = await objectDB.snapshotObject("world", world1.name, world1, {}, {user: user1});
  commit2 = await objectDB.snapshotObject("world", world1.name, Object.assign(world1, {x: 23}), {}, {user: user1});
  commit3 = await objectDB.snapshotObject("world", world1.name, Object.assign(world1, {x: 42}), {}, {user: user1});
  commit4 = await objectDB.snapshotObject("world", world2.name, world2, {}, {user: user1});
}

let snapshotLocation = resource("local://lively-morphic-objectdb-test/snapshots/"),
    user1 = {name: "test-user-1"},
    user2 = {name: "test-user-2"},
    dbName = "lively-morphic-objectdb-test",
    objectDB;

let part1, commit5, commit4, commit3, commit2, world2, commit1, world1;

describe("ObjectDB", function() {

  this.timeout(30*1000);

  before(() => {
    objectDB = ObjectDB.named(dbName, {snapshotLocation});
  });

  after(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
  });

  it("querying objects of empty DB", async () => {
    let objects = await objectDB.objects();
    expect(objects).deep.equals({});
  });


  describe("querying object data", () => {

    before(fillDB1);

    it("knows objects", async () => {
      expect(await objectDB.objects("part")).equals(["a part"])
      expect(await objectDB.objects("world")).equals(["another objectdb test world", "objectdb test world"])
      expect(await objectDB.objects()).deep.equals({
        "part": ["a part"],
        "world": ["another objectdb test world","objectdb test world"]
      });
    });

    it("commits contains basics", () => {
      expect(commit1).containSubset({
        author: {name: user1.name},
        description: "no description",
        message: "",
        name: "objectdb test world", tags: []
      });
      expect(commit1).to.have.property("timestamp").approximately(Date.now(), 5000);
      expect(commit1).to.have.property("preview");
      // expect(commit1.preview).matches(/^data:/);
      expect(commit1).to.have.property("content").to.be.a("string");
    });

    it("saves snapshot into resource", async () => {
      let hash = commit1.content,
          res = snapshotLocation.join(`${hash.slice(0,2)}/${hash.slice(2)}.json`),
          snap = await res.readJson();
      expect(objectDB.snapshotResourceFor(commit1).url).equals(res.url);
      expect(snap.foo.bar).equals(23);
    });

    it("full object stats", async () => {
      let fullStats = await objectDB.objectStats();
      expect(fullStats).deep.equals({
        part: {
          "a part": {
            count: 1,
            newest: commit5.timestamp,
            oldest: commit5.timestamp
          }
        },
        world: {
          "another objectdb test world": {
            count: 3,
            newest: commit4.timestamp,
            oldest: commit2.timestamp
          },
          "objectdb test world": {
            count: 1,
            newest: commit1.timestamp,
            oldest: commit1.timestamp
          }
        }
      });
    });

    it("type object stats", async () => {
      let typeStats = await objectDB.objectStats("world")
      expect(typeStats).deep.equals({
        "another objectdb test world": {
          count: 3,
          newest: commit4.timestamp,
          oldest: commit2.timestamp
        },
        "objectdb test world": {
          count: 1,
          newest: commit1.timestamp,
          oldest: commit1.timestamp
        }
      });

    });


    it("specific object stats", async () => {
      let worldStats = await objectDB.objectStats("world", world2.name);
      expect(worldStats).deep.equals({
        count: 3,
        newest: commit4.timestamp,
        oldest: commit2.timestamp
      });
    });

    it("stores metadata", async () => {
      let commit = await objectDB.getLatestCommit("part", "a part")
      expect(commit).containSubset({metadata: {something: "hello world"}});
    });

    describe("versions", () => {

      it("gets versions", async () => {
        let log = await objectDB._log("world", commit2.name);
        expect(log).equals([commit4._id, commit3._id, commit2._id], "log");

        let graph = await objectDB.versionGraph("world", commit2.name);
        expect(graph).containSubset({
          _id: "world/another objectdb test world",
          refs: {HEAD: commit4._id},
          history: {
            [commit2._id]: [],
            [commit3._id]: [commit2._id],
            [commit4._id]: [commit3._id]
          }
        }, "graph");
      });

    });

  });

});


describe("loading objects", function() {

  this.timeout(30*1000);

  before(fillDB2);

  after(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
    await promise.delay(500);
  });

  it("load latest", async () => {
    let world1Copy = await objectDB.loadObject("world", world1.name);
    expect(world1Copy.x).equals(42);
  });

  it("load from commit", async () => {
    let world1Copy = await objectDB.loadObject("world", world1.name, {}, commit2);
    expect(world1Copy.x).equals(23);
  });

});


describe("deletions in ObjectDB", function() {

  this.timeout(30*1000);

  beforeEach(fillDB2);

  afterEach(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
    await promise.delay(1000);
  });

  describe("deletion of all versions", () => {

    it("commits removed", async () => {
      let deleted = await objectDB.delete("world", world1.name, true/*dry run*/);
      expect(deleted.history).containSubset({_id: "world/objectdb test world", deleted: true})
      expect(deleted.history._rev).match(/^3-/);
      expect(deleted.commits).to.have.length(3);
      expect(deleted.resources.map(ea => ea.name())).equals(deleted.commits.map(ea => ea.content.slice(2)+".json"));

      // dry run: not deleted yet;
      expect(await objectDB.objects("world")).equals(["objectdb test world", "other objectdb test world"]);

      await objectDB.delete("world", world1.name, false/*dry run*/);

      let fullStats = await objectDB.objectStats();
      expect(fullStats).deep.equals({
        world: {
          "other objectdb test world": {
            count: 1,
            newest: commit4.timestamp,
            oldest: commit4.timestamp
          }
        }
      });
      expect(await objectDB.objects("world")).equals(["other objectdb test world"]);
    });

    it("snapshots removed", async () => {
      let commits1Before = await objectDB.getCommits("world", world1.name),
          commits2Before = await objectDB.getCommits("world", world2.name),
          expectedBefore = commits1Before.concat(commits2Before).reduce((expected, ea) => {
            return {
              ...expected,
              [objectDB.snapshotLocation.join(ea.content.slice(0, 2) + "/" + ea.content.slice(2) + ".json").url]: true
            }
          }, {}),
          actualBefore = (await snapshotLocation.dirList("infinity", {exclude: ea => ea.isDirectory()}))
          .reduce((actual, ea) => ({...actual, [ea.url]: true}), {});
      expect(Object.keys(expectedBefore)).to.have.length(4);
      expect(actualBefore).deep.equals(expectedBefore);

      await objectDB.delete("world", world1.name, false/*dry run*/);

      let commits1After = await objectDB.getCommits("world", world1.name),
          commits2After = await objectDB.getCommits("world", world2.name),
          expectedAfter = commits1After.concat(commits2After).reduce((expected, ea) => {
            return {
              ...expected,
              [objectDB.snapshotLocation.join(ea.content.slice(0, 2) + "/" + ea.content.slice(2) + ".json").url]: true
            }
          }, {}),
          actualAfter = (await snapshotLocation.dirList("infinity", {exclude: ea => ea.isDirectory()}))
            .reduce((actual, ea) => ({...actual, [ea.url]: true}), {});
      expect(Object.keys(expectedAfter)).to.have.length(1);
      expect(actualAfter).deep.equals(expectedAfter);
    });

    it("version data removed", async () => {
      await objectDB.delete("world", world1.name, false/*dry run*/);
      let hist1 = await objectDB.versionGraph("world", world1.name);
      expect(hist1).equals(null);
      let hist2 = await objectDB.versionGraph("world", world2.name);
      expect(hist2).containSubset({refs: {}, history: {}});
    });

    describe("single commit", async () => {

      it("head", async () => {
        expect(await objectDB.getLatestCommit("world", world1.name)).containSubset(commit3);

        // let deletion = await objectDB.deleteCommit(commit3._id, true /*dry run*/);
         await objectDB.deleteCommit(commit3._id, false /*dry run*/);

        let stats = await objectDB.objectStats("world", world1.name);
        expect(stats).deep.equals({
          count: 2,
          oldest: commit1.timestamp,
          newest: commit2.timestamp,
        });

        expect(await objectDB.getLatestCommit("world", world1.name)).containSubset(commit2, "latest commit");

        expect(await objectDB.snapshotResourceFor(commit3).exists()).equals(false, "snapshot not deleted");
        expect(await objectDB.snapshotResourceFor(commit2).exists()).equals(true, "snapshot wrongly deleted");
      });

      it("all backwards", async () => {
        await objectDB.deleteCommit(commit3._id, false);
        await objectDB.deleteCommit(commit2._id, false);
        await objectDB.deleteCommit(commit1._id, false);
        let stats = await objectDB.objectStats();
        expect(stats).deep.equals({
          world: {"other objectdb test world": { count: 1, newest: commit4.timestamp, oldest: commit4.timestamp }}
        });
      });

    });

    describe("object", async () => {

      it("marks object as deleted", async () => {
        let commit = await objectDB.commit("world", world1.name, null, {user: user1, message: "deleted world1"})
        expect(commit).has.property("deleted", true);

        expect(await objectDB.getLatestCommit("world", world1.name)).equals(null);
        expect(await objectDB.getLatestCommit("world", world1.name, "HEAD", true)).not.equals(null);
        expect(arr.pluck(await ObjectDBInterface.fetchCommits({db: dbName}), "name"))
          .equals(["other objectdb test world"])
        expect(arr.pluck(await ObjectDBInterface.fetchCommits({db: dbName, includeDeleted: true}), "name"))
          .equals(["objectdb test world", "other objectdb test world"])
      });

    });

  });

});

let exportDir = resource("local://objectdb-export-text/test1/");
let snapshotLocation2 = resource("local://lively-morphic-objectdb-test/snapshots2/");
let objectDB2;

describe("export and import", function() {

  this.timeout(30*1000);

  beforeEach(fillDB2);

  afterEach(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
    await promise.delay(1000);
    await exportDir.remove()
  });


  it("exports to directory", async () => {
    await objectDB.exportToDir(exportDir, [{name: world1.name, type: "world"}], true/*copy res's*/);
    
    expect((await exportDir.dirList("infinity")).map(ea => ea.name())).equals([
      "index.json", "commits.json", "history.json",
      ...[commit1, commit2, commit3].map(ea => objectDB.snapshotResourceFor(ea).name())
    ]);

    expect(await exportDir.join("world/objectdb test world/index.json").readJson())
      .deep.equals({type: "world", name: "objectdb test world"});
  });

  describe("import", () => {

    beforeEach(async () => {
      objectDB2 = ObjectDB.named("lively-morphic-objectdb-test-2", {snapshotLocation: snapshotLocation2});
    });

    afterEach(async () => {
      await objectDB2.destroy();
      await snapshotLocation2.remove()
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


describe("interface test", function() {

  this.timeout(30*1000);

  before(async () => {    
    objectDB = ObjectDB.named(dbName, {snapshotLocation});
    await fillDB1();
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