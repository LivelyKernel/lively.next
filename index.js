import { createChangeSet, localChangeSets, currentChangeSet, setCurrentChangeSet, notify } from "./src/changeset.js";
import { installHook, removeHook, isHookInstalled } from "lively.modules";

function resourceFromChangeSet(proceed, url) {
  return {
    async read() {
      const cs = currentChangeSet(),
            content = cs && (await cs.getFileContent(url));
      return (content !== null) ? content : proceed(url).read();
    },
    write(source) {
      const cs = currentChangeSet();
      return cs ? cs.setFileContent(url, source) : proceed(url).write(source);
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

export { createChangeSet, localChangeSets, currentChangeSet, setCurrentChangeSet, notify };
