/*global it, describe, beforeEach, afterEach*/

import { expect } from "mocha-es6";
import { Database } from "lively.storage";

let dbOpts = (function() {
  let opts = {adapter: "memory"};
  try {
    let db = new Database._PouchDB("adapter-tester")
    db.destroy();
    return {adapter: db.adapter};
  } catch (e) { return {adapter: "memory"}; }
})();
let db;

describe("database access", () => {

  beforeEach(() => db = Database.ensureDB("lively.storage-test", dbOpts));
  afterEach(async () => expect(await db.destroy()).deep.equals({ok: true}));

  it("is empty", async () => expect(await db.getAll()).equals([]));

  it("returns undefined on non-exisiting get", async () =>
    expect(await db.get("non exisiting")).equals(undefined));

  describe("update", () => {

    it("gets prev doc as arg and sets value", async () => {
      let seen = [];
      let up1 = await db.update("some-doc", oldDoc => { seen.push(oldDoc); return {x: 23}; });
      expect(up1).containSubset({_id: "some-doc", x: 23});
      expect(up1._rev).match(/^1-/);
      let up2 = await db.update("some-doc", oldDoc => { seen.push(oldDoc); return {y: 99}; });
      expect(up2).containSubset({_id: "some-doc", y: 99});
      expect(up2._rev).match(/^2-/);
      expect(seen).deep.equals([undefined, {"_id": "some-doc","_rev": up1._rev,"x": 23}]);
    });

  });

  describe("set", () => {

    it("ensures doc and re-sets doc", async () => {
      let doc1 = await db.set("some-doc", {x: 23});
      expect(doc1).containSubset({_id: "some-doc", x: 23});
      expect(doc1._rev).match(/^1-/);
      expect(await db.get("some-doc")).deep.equals(doc1);
      let doc2 = await db.set("some-doc", {y: 24});
      expect(doc2).to.not.have.property("x");
      expect(await db.get("some-doc")).deep.equals(doc2);
    });

    describe("all", () => {
      it("fills db", async () => {
        let doc1 = await db.set("foo", {x: 23});
        await db.setDocuments([{_id: "foo", x: 24}, {_id: "bar", y: 42}]);
        expect(await db.getAll()).length(2);
        expect(await db.getAll()).containSubset([{x: 24}, {y: 42}]);
      });
    });

  });
  
  describe("get all", () => {

    it("retrieves specified docs by id", async () => {
      let doc1 = await db.set("foo", {x: 23});
      await db.setDocuments([{_id: "foo", x: 24}, {_id: "bar", y: 42}]);
      let docs = await db.getDocuments([{id: "foo"}, {id: "xxx"}, {id: "bar"}]);
      expect(docs).length(2);
      expect(docs[0]._rev).match(/^2-/);
      expect(docs[1]).containSubset({y: 42});
    });

    it("retrieves specified docs by and rev", async () => {
      let doc1 = await db.set("foo", {x: 23}),
          doc2 = await db.set("foo", {x: 24}),
          docs = await db.getDocuments([{id: "foo", rev: doc1._rev}, {id: "foo", rev: doc2._rev}]);
      expect(docs).length(2);
      expect(docs[0]._rev).match(/^1-/);
      expect(docs[1]._rev).match(/^2-/);
      expect(docs[0]).containSubset({x: 23});
      expect(docs[1]).containSubset({x: 24});
    });

  });


  describe("mixin", () => {

    it("ensures doc", async () => {
      let doc = await db.mixin("some-doc", {x: 23});
      expect(doc).containSubset({_id: "some-doc", x: 23});
      let {_id: id, _rev: rev} = doc;
      expect(rev).match(/^1-/);
      expect(await db.docList()).deep.equals([{id, rev}]);
    });

    it("mixes properties into doc", async () => {
      await db.mixin("some-doc", {x: 23});
      await db.mixin("some-doc", {y: 24});
      let doc = await db.get("some-doc");
      expect(doc).containSubset({x: 23, y: 24});
      let {_id: id, _rev: rev} = doc;
      expect(rev).match(/^2-/);
      expect(await db.docList()).deep.equals([{id, rev}]);
    });

  });

  describe("remove", () => {

    it("removes doc by id", async () => {
      let doc = await db.set("some-doc", {x: 23});
      await db.remove("some-doc");
      expect(await db.getAll()).equals([]);
    });

    it("removes doc by id and rev", async () => {
      let doc = await db.set("some-doc", {x: 23});
      await db.remove("some-doc", doc._rev);
      expect(await db.getAll()).equals([]);
    });

    it("fails if rev is wrong", async () => {
      let doc1 = await db.set("some-doc", {x: 23});
      let doc2 = await db.set("some-doc", {x: 24});
      let err;
      try { await db.remove("some-doc", doc1._rev); } catch (e) { err = e; }
      expect().assert(err, "no error");
      expect(String(err)).match(/Document update conflict/i);
    });

    it("does not complain with non-existing doc", async () => {
      await db.set("some-doc", {x: 23});
      await db.remove("non-existing");
      expect(await db.getAll()).length(1);
    });

  });

  describe("revisions", () => {
  
    it("reads revision list", async () => {
      let doc1_1 = await db.set("some-doc-1", {x: 23}),
          doc2_1 = await db.set("some-doc-2", {a: "heelo"}),
          doc2_2 = await db.set("some-doc-2", {a: "world"}),
          doc1_2 = await db.set("some-doc-1", {x: 24});
      expect(await db.revList("some-doc-1")).equals([doc1_2, doc1_1].map(ea => ea._rev));
      expect(await db.revList("some-doc-2")).equals([doc2_2, doc2_1].map(ea => ea._rev));
    });

  });

});


let db1, db2;
describe("database replication", () => {
  
  beforeEach(() => {
    db1 = Database.ensureDB("lively.storage-replication-test-1", dbOpts);
    db2 = Database.ensureDB("lively.storage-replication-test-2", dbOpts);
  });

  afterEach(async () => {
    expect(await db1.destroy()).deep.equals({ok: true})
    expect(await db2.destroy()).deep.equals({ok: true})
  });

  describe("conflicts", () => {

    let commit1, commit2;
    beforeEach(async () => {
      commit1 = await db1.set("doc", {foo: 23});
      commit2 = await db2.set("doc", {foo: 24});
      let r = await db1.replicateTo(db2);
      expect(r.status).equals("complete");
    });

    it("finds conflicts", async () => {
      expect(await db1.getConflicts()).equals([]);
      let conflicts = await db2.getConflicts();
      expect(conflicts).length(1);
      let expected = conflicts[0]._rev === commit1._rev ?
        {_conflicts: [commit2._rev],_id: "doc",_rev: commit1._rev} :
        {_conflicts: [commit1._rev],_id: "doc",_rev: commit2._rev};
      expect(conflicts).containSubset([expected])
    });

    it("resolves conflicts", async () => {
      let seen = [];
      let {foo: oldFoo} = await db2.get("doc");
      await db2.resolveConflicts("doc",
        (a, b) => { seen.push(a, b); return Object.assign({}, a, b, {foo: 99})});
      expect(await db2.getConflicts()).equals([]);
      let {_rev, foo} = await db2.get("doc");
      expect(_rev).match(/^2-/);
      expect(foo).equals(99);
      expect(seen[0].foo).equals(oldFoo);
      expect(seen[1].foo).equals(oldFoo === 23 ? 24 : 23);
    });

    it("cancels conflict resolving", async () => {
      let seen = [];
      await db2.resolveConflicts("doc", (a, b) => null);
      expect(await db2.getConflicts()).length(1);
    });

  });
  
});

let migrationDB;
describe("database migration", () => {
  
  beforeEach(() => {
    migrationDB = Database.ensureDB("lively.storage-migration-test", dbOpts);
  });

  afterEach(async () => {
    expect(await migrationDB.destroy()).deep.equals({ok: true})
  });


  beforeEach(async () => {
    await migrationDB.setDocuments([
      {oldField: "doc1"},
      {oldField: "doc2"}
    ]);
  });

  it("converts documents", async () => {
    let original = await migrationDB.getAll(),
        status = await migrationDB.migrate(doc => ({newField: doc.oldField})),
        migrated = await migrationDB.getAll();

    expect(status).deep.equals({migrated: 2, unchanged: 0});
    expect(migrated).length(2);
    expect(migrated[0]).property("_id", original[0]._id);
    expect(migrated[0]).property("newField", original[0].oldField);
    expect(migrated[0]).to.not.have.property("oldField");
    expect(migrated[1]).property("_id", original[1]._id);
    expect(migrated[1]).property("newField", original[1].oldField);
    expect(migrated[1]).to.not.have.property("oldField");
  });

  it("can keep docs unchanged", async () => {
    let original = await migrationDB.getAll(),
        status = await migrationDB.migrate((doc, i) =>
          i === 1 ? null : {newField: doc.oldField}),
        migrated = await migrationDB.getAll();

    expect(status).deep.equals({migrated: 1, unchanged: 1});
    expect(migrated).length(2);
    expect(migrated[0]).property("_id", original[0]._id);
    expect(migrated[0]).property("newField", original[0].oldField);
    expect(migrated[0]).to.not.have.property("oldField");
    expect(migrated[1]).property("_id", original[1]._id);
    expect(migrated[1]).property("oldField", original[1].oldField);
    expect(migrated[1]).to.not.have.property("newField");
  });

  it("cancels on error", async () => {
    let original = await migrationDB.getAll();
    try {
      await migrationDB.migrate((doc, i) => {
        if (i === 1) throw new Error("stop");
        doc.foo = 23;
        return doc;
      })
    } catch (err) {}
    expect(original).deep.equals(await migrationDB.getAll());
  });

});


describe("backup", () => {
  
  let origDB, backupDB
  beforeEach(() => {
    origDB = Database.ensureDB("lively.storage-backup-test", dbOpts);
  });

  afterEach(async () => {
    expect(await origDB.destroy()).deep.equals({ok: true})
    if (backupDB)
      expect(await backupDB.destroy()).deep.equals({ok: true})
  });

  it("creates backup db", async () => {
    origDB.setDocuments([{doc1: "foo"}, {doc2: "bar"}]);
    let docs = await origDB.getAll();
    backupDB = await origDB.backup();
    expect(backupDB).not.equals(origDB);
    expect(backupDB.name).equals(origDB.name + "_backup_1");
    expect(await origDB.getAll()).deep.equals(await backupDB.getAll());
  });

  it("dump", async () => {
    origDB.setDocuments([{doc1: "foo"}, {doc2: "bar"}]);
    let docs = await origDB.getAll(),
        dump = await origDB.dump();
    expect(dump).containSubset({header: {name: origDB.name}, docs});
    await origDB.destroy();
    backupDB = await Database.loadDump(dump);
    expect(backupDB.name).equals(origDB.name);
    expect(await backupDB.getAll()).deep.equals(docs);
  });

});
