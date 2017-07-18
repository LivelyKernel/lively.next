/*global System*/
import { ObjectDB } from "lively.storage";
import { loadMorphFromSnapshot, createMorphSnapshot } from "./serialization.js";
import { resource } from "lively.resources";

let snapshotLocation = resource(System.normalizeSync("lively.morphic/objectdb/snapshots/"));

export default class MorphicDB extends ObjectDB {

  static get default() {
    return this.named("default-morphic-db", {snapshotLocation});
  }

  async snapshotObject(type, name, object, snapshotOptions, commitSpec, ref, expectedPrevVersion) {    
    snapshotOptions = snapshotOptions || {};
    snapshotOptions.serializeFn = createMorphSnapshot;
    return super.snapshotObject(
      type, name, object, snapshotOptions,
      commitSpec, ref, expectedPrevVersion);
  }

  async loadObject(type, name, loadOptions, commitIdOrCommit, ref) {
    loadOptions = loadOptions || {}
    loadOptions.deserializeFn = loadMorphFromSnapshot;
    return super.loadObject(type, name, loadOptions, commitIdOrCommit, ref);
  }

}
