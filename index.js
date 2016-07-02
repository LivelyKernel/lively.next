import { Interface } from "lively-system-interface";
import LocalGitSystem from "./src/system.js";

export const gitInterface = new Interface(new LocalGitSystem());