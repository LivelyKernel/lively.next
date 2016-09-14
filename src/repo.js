/* global fetch */

import { mixins, promisify, gitHubRequest, bodec, codec, inflate } from "js-git-browser";
import { getGitHubToken, getOrAskGitHubToken } from "./settings.js";

const repoForPackage = {};

async function gitHubURL(pkg) { // PackageAddress -> string?
  const packageConfig = `${pkg}/package.json`;
  try {
    const res = await fetch(packageConfig);
    if (res.status == 404) return null;
    const conf = await res.json();
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
        const response = await fetch(`${pkg}/.git/refs/${ref}`);
        if (response.status == 404) return callback(null, undefined);
        const hash = await response.text();
        callback(null, hash.trim());
      } catch (err) { callback(err); }
    },
    async loadAs(type, hash, callback) {
      try {
        const path = `${pkg}/.git/objects/${hash.substr(0, 2)}/${hash.substr(2)}`,
              response = await fetch(path);
        if (response.status == 404) return callback(null, undefined);
        const buffer = await response.arrayBuffer(),
              binary = inflate(new Uint8Array(buffer)),
              raw = codec.deframe(binary);
        if (raw.type !== type) throw new TypeError("Type mismatch");
        const body = codec.decoders[raw.type](raw.body);
        callback(null, body);
      } catch (err) { callback(err); }
    }
  };
}

function serverShellRemote(pkg) {
  // PackageAddress -> { readRef, loadAs }
  const cwd = lively.shell.WORKSPACE_LK + "/" + pkg.substr(System.baseURL.length);
  return {
    async readRef(ref, callback) {
      try {
        const response = await lively.shell.run(`git show-ref -s ${ref}`, {cwd});
        if (response.code !== 0) return callback(null, undefined);
        callback(null, response.stdout.trim());
      } catch (err) { callback(err); }
    },
    async loadAs(type, hash, callback) {
      try {
        const typeR = await lively.shell.run(`git cat-file -t ${hash}`, {cwd});
        if (typeR.code !== 0) return callback(null, undefined);
        const type = typeR.stdout.trim();
        const dataR = await lively.shell.run(`git cat-file ${type} ${hash} | base64`, {cwd});
        if (dataR.code !== 0) return callback(null, undefined);
        const bytes = bodec.fromBase64(dataR.stdout);
        callback(null, codec.decoders[type](bytes));
      } catch (err) { callback(err); }
    }
  };
}

export function enableGitHub() {
  if (getGitHubToken() !== "<secret>") return;
  repoForPackage = {};
  return getOrAskGitHubToken();
}

export default async function repository(pkg) {
  // PackageAddress, bool? -> Repository
  if (pkg in repoForPackage) {
    return repoForPackage[pkg];
  }
  // local IndexedDB
  const repo = {};
  await new Promise((resolve, reject) => {
    mixins.indexed.init(err => err ? reject(err) : resolve());
  });
  mixins.indexed(repo, pkg);

  // Server git repo
  mixins.fallthrough(repo, serverShellRemote(pkg));
  
  // GitHub fall through
  if (getGitHubToken() !== "<secret>") {
    const url = await gitHubURL(pkg);
    if (!url) {
      console.error("Could not determine GitHub URL");
    } else {
      const remote = {};
      mixins.github(remote, url, await getOrAskGitHubToken());
      mixins.readCombiner(remote);
      mixins.sync(repo, remote);
      mixins.fallthrough(repo, remote);
    }
  }
  
  // Other plugins
  mixins.createTree(repo);
  mixins.memCache(repo);
  mixins.walkers(repo);
  mixins.formats(repo);
  promisify(repo);
  return repoForPackage[pkg] = repo;
}

export async function gitHubBranches(pkg) {
  // PackageAddress -> Array<{name: BranchName, hash: Hash}>
  await enableGitHub();
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
