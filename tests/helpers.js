import { mixins, modes, promisify } from 'js-git-browser';

import { removeDir, createFiles } from "lively.modules/tests/helpers.js";

import { gitInterface } from "../index.js";
import { createChangeSet, setCurrentChangeSet } from "../src/changeset.js";

async function repoForPackage(pkg) {
  const repo = {};
  await new Promise((resolve, reject) => {
    mixins.indexed.init(err => err ? reject(err) : resolve());
  });
  mixins.indexed(repo, pkg);
  mixins.createTree(repo);
  mixins.memCache(repo);
  mixins.readCombiner(repo);
  mixins.walkers(repo);
  mixins.formats(repo);
  promisify(repo);
  return repo;
}

export async function initMaster(pkg) {
  const repo = await repoForPackage(pkg),
        author = {name: "John Doe", email: "john@example.org", date: new Date()},
        message = "initial commit",
        changes = [{
          path: "a.js",
          mode: modes.file,
          content: "export const x = 1;\n"}];
  const tree = await repo.createTree(changes),
        commitHash = await repo.saveAs("commit", {tree, author, message});
  return repo.updateRef("refs/heads/master", commitHash);
}

export const
  pkgDir = System.decanonicalize("lively.changesets/tests/temp"),
  pkgFiles = {
    "a.js": "export const x = 1;\n",
    "package.json": JSON.stringify({
      name: "temp",
      main: "a.js"
    })
  },
  fileA = pkgDir + "/a.js",
  vmEditorMock = {updateModuleList: () => 0};

export async function initChangeSet() {
  await initMaster(pkgDir);
  const cs = await createChangeSet("test");
  await setCurrentChangeSet("test");
  return cs;
}

export async function createPackage() {
  await createFiles(pkgDir, pkgFiles);
  return gitInterface.importPackage(pkgDir);
}

export async function changeFile(newSrc) {
  await gitInterface.interactivelyChangeModule(vmEditorMock, fileA, newSrc);
}

export async function removePackage() {
  await gitInterface.removePackage(pkgDir);
  await removeDir(pkgDir);
}
