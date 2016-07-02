import * as modules from "lively.modules";
import { LocalCoreInterface } from "lively-system-interface/interfaces/local-system.js";
import { mixins, modes, promisify } from "js-git-browser";
import { currentChangeSet } from './changeset.js';

const repoForPackage = {};

async function gitURLForPackage(p) {
  const packageConfig = `${p.address}/package.json`;
  const conf = await System.import(packageConfig);
  if (!conf || !conf.repository) return null;
  const url = conf.repository.url || conf.repository,
        match = url.match(/github.com[:\/](.*?)(?:\.git)?$/);
  if (!match) throw new Error("URL is not GitHub repo: " + url);
  return match[1];
}

async function repositoryForPackage(pkg) {
  if (pkg.address in repoForPackage) {
    return repoForPackage[pkg.address];
  }
  const remote = {},
        repo = {},
        url = await gitURLForPackage(pkg),
        githubToken = "<secret>";
  
  mixins.github(remote, url, githubToken);
  mixins.readCombiner(remote);
  await new Promise((resolve, reject) => {
    mixins.indexed.init(err => err ? reject(err) : resolve());
  });
  mixins.indexed(repo, `git-${pkg.name}`);
  mixins.sync(repo, remote);
  mixins.fallthrough(repo, remote);
  mixins.createTree(repo);
  mixins.memCache(repo);
  mixins.readCombiner(repo);
  mixins.walkers(repo);
  mixins.formats(repo);
  promisify(repo);
  return repoForPackage[pkg.address] = repo;
}

async function currentTree(repo) {
  const cs = currentChangeSet(),
        branch = cs ? cs.name : "master",
        headHash = await repo.readRef(`refs/heads/${branch}`),
        commit = await repo.loadAs("commit", headHash);
  return commit.tree;
}

async function fileHashes(repo) {
  const tree = await currentTree(repo),
        treeStream = await repo.treeWalk(tree),
        files = {};
  let obj;
  while (obj = await treeStream.read()) {
    if (obj.mode !== modes.file) continue;
    files[obj.path] = obj.hash;
  }
  return files;
}

export default class LocalGitSystem extends LocalCoreInterface {

  resolve(url) {
    const m = this.getModule(url),
          p = m.package();
    if (!p || m.id.indexOf(p.address) !== 0) {
       throw new Error(`No package for ${url}`)
    }
    return [p, m.id.slice(p.address.length)];
  }

  async resourceExists(url) {
    const [pkg, path] = this.resolve(url),
          cs = currentChangeSet();
    if (cs && cs.changedFile(path)) return true;
    const repo = await repositoryForPackage(pkg),
          files = await fileHashes(repo);
    return !!files[path];
  }
  resourceEnsureExistance(url, optContent) {
    return Promise.resolve(0);
  }
  resourceMkdir(url) {
    return Promise.resolve(0);
  }
  async resourceRead(url) {
    const [pkg, path] = this.resolve(url),
          cs = currentChangeSet();
    if (cs && cs.changedFile(path)) return cs.getFileContent(path);
    const repo = await repositoryForPackage(pkg),
          files = await fileHashes(repo);
    if (!files[path]) throw new Error(`file not found ${path}`)
    return await repo.loadAs("text", files[path]);
  }
  resourceRemove(url) {
    return Promise.resolve(0);
  }
  resourceWrite(url, source) {
    return Promise.resolve(0);
  }
  resourceCreateFiles(baseDir, spec) {
    return Promise.resolve(0);
  }
}