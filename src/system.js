import { LocalCoreInterface } from "lively-system-interface/interfaces/local-system.js";
import { isHookInstalled, installHook, removeHook } from "lively.modules";
import { currentChangeSet } from './changeset.js';

async function fetch_from_changeset(proceed, load) {
  const cs = currentChangeSet(),
        content = cs && await cs.getFileContent(load.name);
  return content === null ? proceed(load) : content;
}

export default class LocalGitSystem extends LocalCoreInterface {

  installFetch() {
    if (!isHookInstalled("fetch", "fetch_from_changeset")) {
      installHook("fetch", fetch_from_changeset);
    }
  }

  async resourceExists(url) {
    const cs = currentChangeSet(),
          exists = cs && await cs.fileExists(url);
    return exists === null ? super(url) : exists;
  }

  async resourceEnsureExistance(url, optContent = "") {
    const cs = currentChangeSet();
    if (!cs) return super.resourceEnsureExistance(url, optContent);
    const exists = await this.resourceExists(url);
    if (!exists) await this.resourceWrite(url, optContent);
  }

  resourceMkdir(url) {
    return Promise.resolve(0);
  }

  async resourceRead(url) {
    const cs = currentChangeSet(),
          content = cs && await cs.getFileContent(url);
    return content === null ? super.resourceRead(url) : content;
  }

  resourceRemove(url) {
    return Promise.resolve(0);
  }

  async resourceWrite(url, src) {
    const cs = currentChangeSet();
    return cs === null ? super.resourceWrite(url, src) : cs.setFileContent(url, src);
  }

  resourceCreateFiles(baseDir, spec) {
    return Promise.resolve(0);
  }
}
