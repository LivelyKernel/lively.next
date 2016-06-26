import { readFileSync } from "fs";
import { exec } from "./shell-exec.js";

export function ensureDir(dir) {
  return exec(`node -e 'var fs = require("fs"); if (!fs.existsSync("${dir}")) fs.mkdirSync("${dir}");'`);
}

export async function read(path) {
  if (System.get("@system-env").node) {
    try {
      return String(readFileSync(path.replace(/file:\/\//, "")))
    } catch (e) { return ""; }
  } else {
    var {output, code} = await lively.shell.readFile(path);
    return code ? "" : output;
  }
}

export function join() {
  var args = Array.prototype.slice.call(arguments);
  return args.reduce(function (path, ea) {
      return typeof ea === 'string' ? path.replace(/\/*$/, '') + '/' + ea.replace(/^\/*/, '') : path;
  });
}

export function normalizeProjectSpec(spec) {
  return Object.assign({}, spec, {
    dir: spec.dir || join(spec.parentDir, spec.name)
  });
}