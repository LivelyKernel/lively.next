import { resource } from "lively.resources";
import ObjectDB from "../objectdb.js";

function createDummyObject() {
  return {name: "some dummy object", foo: {bar: 23}};
}

export async function fillDB1() {
  let snapshotLocation = resource("local://lively-morphic-objectdb-test/snapshots/"),
      author1 = {name: "test-user-1"},
      author2 = {name: "test-user-2"},
      objectDB,
      part1, commit5, commit4, commit3, commit2, world2, commit1, world1;

  objectDB = ObjectDB.named("lively-morphic-objectdb-test", {snapshotLocation});
  world1 = Object.assign(createDummyObject(), {name: "objectdb test world"});
  world2 = Object.assign(createDummyObject(), {name: "another objectdb test world"});
  part1 = Object.assign(createDummyObject(), {name: "a part"});
  commit1 = await objectDB.snapshotObject("world", world1.name, world1, {}, {author: author1});
  commit2 = await objectDB.snapshotObject("world", world2.name, world2, {}, {author: author1});
  commit3 = await objectDB.snapshotObject("world", world2.name, Object.assign(world2, {x: 23}), {}, {author: author1});
  commit4 = await objectDB.snapshotObject("world", world2.name, Object.assign(world2, {x: 42}), {}, {author: author1});
  commit5 = await objectDB.snapshotObject("part", part1.name, part1, {}, {author: author1, metadata: {something: "hello world"}});

  return {
    part1, world1, world2,
    commit1, commit5, commit4, commit3, commit2,
    author1, author2,
    objectDB, snapshotLocation
  };
}

export async function fillDB2() {
  let snapshotLocation = resource("local://lively-morphic-objectdb-test/snapshots/"),
      author1 = {name: "test-user-1"}, author2 = {name: "test-user-2"},
      objectDB,
      part1, commit5, commit4, commit3, commit2, world2, commit1, world1;

  objectDB = ObjectDB.named("lively-morphic-objectdb-test", {snapshotLocation});
  world1 = Object.assign(createDummyObject(), {name: "objectdb test world"});
  world2 = Object.assign(createDummyObject(), {name: "other objectdb test world"});
  commit1 = await objectDB.snapshotObject("world", world1.name, world1, {}, {author: author1});
  commit2 = await objectDB.snapshotObject("world", world1.name, Object.assign(world1, {x: 23}), {}, {author: author1});
  commit3 = await objectDB.snapshotObject("world", world1.name, Object.assign(world1, {x: 42}), {}, {author: author1});
  commit4 = await objectDB.snapshotObject("world", world2.name, world2, {}, {author: author1});
  
  return {
    world1, world2,
    commit1, commit4, commit3, commit2,
    author1, author2,
    objectDB, snapshotLocation
  };
}
