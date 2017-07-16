/*global declare, it, describe, beforeEach, afterEach, before, after,xit,xdescribe*/
import { expect } from "mocha-es6";
import { morph } from "../index.js";
import { pt, Color } from "lively.graphics";
import { resource } from "lively.resources";
import { ClientUser } from "lively.user";
import { delay } from "lively.lang/promise.js";
import ObjectDB from "../object-db.js";

var world;
function createDummyWorld() {
  return world = morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: [{
        name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
        submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
      }]
  });
}

let snapshotLocation = resource("local://lively-morphic-objectdb-test/snapshots/"),
    user1 = ClientUser.named("lively-morphic-objectdb-test-user-1"),
    user2 = ClientUser.named("lively-morphic-objectdb-test-user-2"),
    objectDB;

let part1, commit5, commit4, commit3, commit2, world2, commit1, world1;

describe("ObjectDB", function() {

  this.timeout(30*1000);

  before(() => {
    objectDB = ObjectDB.named("lively-morphic-objectdb-test", {snapshotLocation});
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

    before(async () => {
      world1 = Object.assign(createDummyWorld(), {name: "objectdb test world"});
      world2 = Object.assign(createDummyWorld(), {name: "another objectdb test world"});
      commit1 = await objectDB.snapshotObject("world", world1, {}, {user: user1});
      commit2 = await objectDB.snapshotObject("world", world2, {}, {user: user1});
      commit3 = await objectDB.snapshotObject("world", Object.assign(world2, {fill: Color.red}), {}, {user: user1});
      commit4 = await objectDB.snapshotObject("world", Object.assign(world2, {fill: Color.green}), {}, {user: user1});
      commit5 = await objectDB.snapshotObject("part", part1 = morph({name: "a part"}), {}, {user: user1, metadata: {something: "hello world"}});
    });

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
      expect(commit1).to.have.property("preview").to.be.a("string");
      expect(commit1.preview).matches(/^data:/);
      expect(commit1).to.have.property("content").to.be.a("string");
    });

    it("saves snapshot into resource", async () => {
      let hash = commit1.content,
          res = snapshotLocation.join(`${hash.slice(0,2)}/${hash.slice(2)}.json`),
          snap = await res.readJson();
      expect(objectDB.snapshotResourceFor(commit1).url).equals(res.url);
      expect(snap).property("id", world1.id);
      expect(snap).property("snapshot");
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

  before(async () => {
    objectDB = ObjectDB.named("lively-morphic-objectdb-test", {snapshotLocation});
    world1 = Object.assign(createDummyWorld(), {name: "objectdb test world"});
    world2 = Object.assign(createDummyWorld(), {name: "other objectdb test world"});
    commit1 = await objectDB.snapshotObject("world", world1, {}, {user: user1});
    commit2 = await objectDB.snapshotObject("world", Object.assign(world1, {fill: Color.red}), {}, {user: user1});
    commit3 = await objectDB.snapshotObject("world", Object.assign(world1, {fill: Color.green}), {}, {user: user1});
    commit4 = await objectDB.snapshotObject("world", world2, {}, {user: user1});
  });

  after(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
    await delay(500);
  });

  it("load latest", async () => {
    let world1Copy = await objectDB.loadObject("world", world1.name);
    expect(world1Copy.isWorld).equals(true, "not a world");
    expect(world1Copy.fill).equals(Color.green);
  });

  it("load from commit", async () => {
    let world1Copy = await objectDB.loadObject("world", world1.name, {}, commit2);
    expect(world1Copy.isWorld).equals(true, "not a world");
    expect(world1Copy.fill).equals(Color.red);
  });

});


describe("deletions in ObjectDB", function() {

  this.timeout(30*1000);

  beforeEach(async () => {
    objectDB = ObjectDB.named("lively-morphic-objectdb-test", {snapshotLocation});
    world1 = Object.assign(createDummyWorld(), {name: "objectdb test world"});
    world2 = Object.assign(createDummyWorld(), {name: "other objectdb test world"});
    commit1 = await objectDB.snapshotObject("world", world1, {}, {user: user1});
    commit2 = await objectDB.snapshotObject("world", Object.assign(world1, {fill: Color.red}), {}, {user: user1});
    commit3 = await objectDB.snapshotObject("world", Object.assign(world1, {fill: Color.green}), {}, {user: user1});
    commit4 = await objectDB.snapshotObject("world", world2, {}, {user: user1});
  });

  afterEach(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
    await delay(1000);
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
      })

    });

  });

});
