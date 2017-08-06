/*global declare, it, describe, beforeEach, afterEach, before, after,xit,xdescribe*/
import { expect } from "mocha-es6";
import ObjectDB from "../objectdb.js";
import { fillDB2 } from "./test-helper.js";
import { promise, arr } from "lively.lang";
import { ObjectDBInterface } from "lively.storage";


let world1, world2,
    commit1, commit5, commit4, commit3, commit2,
    user1, user2,
    objectDB, snapshotLocation;


describe("deletions in ObjectDB", function() {

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
        expect(arr.pluck(await ObjectDBInterface.fetchCommits({db: objectDB.name}), "name"))
          .equals(["other objectdb test world"])
        expect(arr.pluck(await ObjectDBInterface.fetchCommits({db: objectDB.name, includeDeleted: true}), "name"))
          .equals(["objectdb test world", "other objectdb test world"])
      });

    });

  });

});