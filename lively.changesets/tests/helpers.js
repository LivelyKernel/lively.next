/* global System */
import jsGit from 'js-git-browser';
const { mixins, modes, promisify } = jsGit;
import { registerPackage, removePackage } from 'lively.modules';
import { removeDir, createFiles } from 'lively.modules/tests/helpers.js';

import changeSet from '../src/changeset.js';
import { initBranches, localBranchesOf } from '../src/branch.js';
import { string } from 'lively.lang';

async function repoForPackage (pkg) {
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

export async function initMaster (pkg, withChange = false) {
  const repo = await repoForPackage(pkg);
  const author = { name: 'John Doe', email: 'john@example.org', date: new Date() };
  const message = 'initial commit';
  const changes = [{
    path: 'a.js',
    mode: modes.file,
    content: 'export const x = 1;\n'
  }];
  const tree = await repo.createTree(changes);
  const commitHash = await repo.saveAs('commit', { tree, author, committer: author, message });
  await repo.updateRef('refs/heads/master', commitHash);
  if (withChange) {
    changes[0].content = 'export const x = 2;\n';
    const tree2 = await repo.createTree(changes);
    const commitHash2 = await repo.saveAs('commit', { tree: tree2, author, committer: author, message, parents: [commitHash] });
    await repo.updateRef('refs/heads/test', commitHash2);
  }
}

export const pkgDir = System.decanonicalize('lively.changesets/tests/temp/');
export const pkgFiles = {
  'a.js': 'export const x = 1;\n',
  'package.json': JSON.stringify({
    name: 'temp',
    main: 'a.js'
  })
};
export const fileA = string.joinPath(pkgDir, '/a.js');
export const vmEditorMock = { updateModuleList: () => 0 };

export async function initTestBranches (withChange = false) {
  await initMaster(pkgDir, withChange);
  await initBranches(); // have to reset branches
  return localBranchesOf(pkgDir);
}

export async function initTestChangeSet (withChange = false) {
  await initMaster(pkgDir, withChange);
  await initBranches(); // have to reset branches
  return changeSet('test');
}

export async function createPackage () {
  await createFiles(pkgDir, pkgFiles);
  return registerPackage(pkgDir);
}

export async function deletePackage () {
  await removePackage(pkgDir);
  await removeDir(pkgDir);
  const db = await new Promise((resolve, reject) => {
    const req = window.indexedDB.open('tedit', 1);
    req.onsuccess = evt => resolve(evt.target.result);
    req.onerror = err => reject(err);
  });
  return new Promise((resolve, reject) => {
    const trans = db.transaction(['refs'], 'readwrite');
    const store = trans.objectStore('refs');
    const req = store.delete(`${pkgDir}/refs/heads/master`);
    req.onsuccess = evt => resolve(evt.target.result);
    req.onerror = evt => reject(new Error(evt.value));
  });
}
