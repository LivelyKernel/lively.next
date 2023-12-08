import { module, installHook, removeHook, isHookInstalled } from 'lively.modules';

import changeSet, { localChangeSets, targetBranchWrite } from './src/changeset.js';
import branch, { localBranches, localBranchesOf } from './src/branch.js';
import commit, { activeCommit } from './src/commit.js';
import { getAuthor, setAuthor, setGitHubToken } from './src/settings.js';
import { gitHubBranches } from './src/repo.js';

function resolve (path) { // Path -> [PackageAddress, RelPath]
  const mod = module(path);
  const pkg = mod.package();
  if (!pkg) return ['no group', path];
  return [pkg.address, mod.pathInPackage()];
}

function resourceFromChangeSet (proceed, url) {
  return {
    isResource: true,
    ext () {
      return proceed(url).ext();
    },
    read () {
      const [pkg, path] = resolve(url);
      if (pkg == 'no group') return proceed(url).read();
      const c = activeCommit(pkg);
      return c ? c.getFileContent(path) : proceed(url).read();
    },
    async write (content) {
      const [pkg, path] = resolve(url);
      if (pkg == 'no group') return proceed(url).write(content);
      let branch = await targetBranchWrite(pkg);
      if (!branch) {
        const c = activeCommit(pkg);
        const local = await localBranchesOf(pkg);
        for (let l of local) {
          const head = await l.head();
          if (head.hash === c.hash) { branch = l; break; }
        }
      }
      if (!branch) return proceed(url).write(content);
      const newC = await branch.setFileContent(path, content);
      newC.setActive();
    }
  };
}

export function install () {
  if (!isHookInstalled('resource', resourceFromChangeSet)) {
    installHook('resource', resourceFromChangeSet);
  }
}

export function uninstall () {
  removeHook('resource', resourceFromChangeSet);
}

export { changeSet, branch, commit, localBranches, localBranchesOf, localChangeSets, getAuthor, setAuthor, setGitHubToken, gitHubBranches };
