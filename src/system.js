import { LocalCoreInterface } from "lively-system-interface/interfaces/local-system.js";
import { currentChangeSet } from './changeset.js';

function fetch_changeset(proceed, load) {
  if (load.name.match(/^lively:\/\//)) {
    load.metadata.format = "esm";
    var match = load.name.match(/lively:\/\/([^\/]+)\/(.*)$/),
        worldId = match[1], localObjectName = match[2];
    return (typeof $morph !== "undefined"
         && $morph(localObjectName)
         && $morph(localObjectName).textString)
        || `/*Could not locate ${load.name}*/`;
  }
  return proceed(load);
}

//if (!isHookInstalled(System, "fetch", "fetch_changeset")) {
//  installHook(System, "fetch", fetch_changeset);
//}

export default class LocalGitSystem extends LocalCoreInterface {

  async resourceExists(url) {
    const cs = await currentChangeSet(),
          exists = cs && cs.fileExists(url);
    return exists === null ? super(url) : exists;
  }
  
  resourceEnsureExistance(url, optContent) {
    return Promise.resolve(0);
  }
  
  resourceMkdir(url) {
    return Promise.resolve(0);
  }
  
  async resourceRead(url) {
    const cs = await currentChangeSet(),
          content = cs && cs.getFileContent(url);
    return content === null ? super(url) : content;
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
