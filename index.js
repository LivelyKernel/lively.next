import { Interface } from "lively-system-interface";
import LocalGitSystem from "./src/system.js";
import { createChangeSet, localChangeSets, setCurrentChangeSet } from "./src/changeset.js";

export const gitInterface = new Interface(new LocalGitSystem());
export { createChangeSet, localChangeSets, setCurrentChangeSet };