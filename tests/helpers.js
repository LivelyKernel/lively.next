import { mixins, modes, promisify } from 'js-git-browser';

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
  return repo.updateRef("heads/master", commitHash);
}

export async function initChangeSet(pkg) {
  await initMaster(pkg);
  const cs = await createChangeSet("test");
  setCurrentChangeSet("test");
  return cs;
}