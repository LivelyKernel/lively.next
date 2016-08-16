/* global fetch */

import { mixins, promisify, gitHubRequest, bodec, codec, inflate } from "js-git-browser";
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

function serverRemote(pkg) {
  // PackageAddress -> { readRef, loadAs }
  return {
    async readRef(ref, callback) {
      try {
        const response = await fetch(`${pkg}/.git/refs/${ref}`),
              hash = await response.text();
        callback(null, hash.trim());
      } catch (err) { callback(err); }
    },
    async loadAs(type, hash, callback) {
      try {
        const path = `${pkg}/.git/objects/${hash.substr(0, 2)}/${hash.substr(2)}`,
              response = await fetch(path),
              buffer = await response.arrayBuffer(),
              binary = inflate(new Uint8Array(buffer)),
              raw = codec.deframe(binary);
        if (raw.type !== type) throw new TypeError("Type mismatch");
        const body = codec.decoders[raw.type](raw.body);
        callback(null, body);
      } catch (err) { callback(err); }
    }
  };
}

export default async function repository(pkg, withGitHub = false) {
  // PackageAddress, bool? -> Repository
  if (pkg in repoForPackage && (!withGitHub || repoForPackage[pkg].send)) {
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
    if (withGitHub) {
      mixins.github(remote, url, await getOrAskGitHubToken());
      mixins.readCombiner(remote);
      mixins.sync(repo, remote);
    }
    mixins.fallthrough(repo, serverRemote(pkg));
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

export async function gitHubBranches(pkg) {
  // PackageAddress -> Array<{name: BranchName, hash: Hash}>
  const url = await gitHubURL(pkg);
  if (!url) throw new Error("Could not determine GitHub URL");
  const req = gitHubRequest(url, await getOrAskGitHubToken());
  return new Promise((resolve, reject) => {
    req("GET", "/repos/:root/branches", (err, xhr, response) => {
      if (err) return reject(err);
      resolve(response.map(b => ({name: b.name, hash: b.commit.sha})));
    });
  });
}
