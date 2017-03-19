/*global it, describe, beforeEach, afterEach*/

import { expect } from "mocha-es6";
import Database from "lively.storage";

let db;

describe("lively.storage", () => {

  beforeEach(() => db = new Database("lively.storage-test"));
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