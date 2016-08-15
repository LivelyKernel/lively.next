import { module, installHook, removeHook, isHookInstalled } from "lively.modules";

import { createChangeSet, localChangeSets, targetChangeSet, deactivateAll, notify } from "./src/changeset.js";
import commit, { packageHead } from "./src/commit.js";


function resolve(path) { // Path -> [PackageAddress, RelPath]
  const mod = module(path),
        pkg = mod.package().address;
  return [pkg, mod.pathInPackage().replace(/^\.\//, '')];
}

export async function activeCommit(pkg) { // PackageAddress -> Commit
  const cs = await localChangeSets();
  for (let i = cs.length - 1; i >= 0; i--) {
    if (cs[i].isActive()) {
      const branch = cs[i].getBranch(pkg);
      if (branch) return branch.head();
    }
  }
  return packageHead(pkg);
}

function resourceFromChangeSet(proceed, url) {
  return {
    async read() {
      const [pkg, path] = resolve(url);
      if (pkg == "no group") return proceed(url).read();
      const commit = await activeCommit(pkg);
      return commit.getFileContent(path);
    },
    async write(content) {
      const [pkg, path] = resolve(url);
      if (pkg == "no group") return proceed(url).read();
      const cs = await targetChangeSet();
      if (cs) {
        const branch = await cs.getOrCreateBranch(pkg);
        return branch.setFileContent(path, content);
      }
      return proceed(url).write(content);
    }
  };
}

export function install() {
  if (!isHookInstalled("resource", resourceFromChangeSet)) {
    installHook("resource", resourceFromChangeSet);
  }
}

export function uninstall() {
  removeHook("resource", resourceFromChangeSet);
}

export { createChangeSet, localChangeSets, commit, deactivateAll, notify };
