import { mixins, promisify } from "js-git-browser";
import { gitHubToken, gitHubURL } from "./github-integration.js";

const repoForPackage = {};

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
    mixins.github(remote, url, await gitHubToken());
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
