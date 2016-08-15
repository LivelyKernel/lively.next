/* global fetch */

import { mixins, promisify } from "js-git-browser";
import { getOrAskGitHubToken } from "./settings.js";

const repoForPackage = {};

async function gitHubURL(pkg) { // PackageAddress -> string?
  const packageConfig = `${pkg}/package.json`;
  try {
    const res = await fetch(packageConfig),
          conf = await res.json();
    if (!conf || !conf.repository) return null;
    const url = conf.repository.url || conf.repository,
          match = url.match(/github.com[:\/](.*?)(?:\.git)?$/);
    if (!match) return null;
    return match[1];
  } catch (e) {
    return null;
  }
}

export default async function repository(pkg) { // -> Repository
  if (pkg in repoForPackage) {
    return repoForPackage[pkg];
  }
  // local IndexedDB
  const repo = {};
  await new Promise((resolve, reject) => {
    mixins.indexed.init(err => err ? reject(err) : resolve());
  });
  mixins.indexed(repo, pkg);
  
  // GitHub fall through
  const url = await gitHubURL(pkg);
  if (url != null) {
    const remote = {};
    mixins.github(remote, url, await getOrAskGitHubToken());
    mixins.readCombiner(remote);
    mixins.sync(repo, remote);
    mixins.fallthrough(repo, remote);
  }
  
  // Other plugins
  mixins.createTree(repo);
  mixins.memCache(repo);
  mixins.readCombiner(repo);
  mixins.walkers(repo);
  mixins.formats(repo);
  promisify(repo);
  return repoForPackage[pkg] = repo;
}
