import { exec } from "./shell-exec.js";
import { resource } from "lively.resources";

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

export function getPackageSpec() {
  return System.decanonicalize("lively.installer/packages-config.json");
}

export async function readPackageSpec(pkgSpec) {
  return await resource(pkgSpec).read();
}
