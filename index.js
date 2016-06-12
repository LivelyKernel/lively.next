import * as modules from "lively.modules";
import { arr, obj } from "lively.lang";
import { resource } from "lively.resources";

// getPackages()
// getPackageForModule("http://localhost:9001/packages/lively-system-interface/index.js")

export function getPackages() {
  return obj.values(modules.getPackages());
}

export function getModules() {
  return arr.flatmap(getPackages(), ea => ea.modules);
}

export function getModule(name) {
  getModules().find(ea => ea.name === name);
}

export function getPackage(name) {
  name = resource(name).asFile().url
  return getPackages().find(ea => ea.address === name || ea.name === name);
}

export function getPackageForModule(name) {
  // name = "http://localhost:9001/lively.resources/package.json"
  // this.getPackageForModule("http://localhost:9001/lively.resources/package.json")
  var p = getPackages().find(ea => ea.modules.some(mod => mod.name === name));
  if (p) return p;

  return arr.sortBy(
            getPackages().filter(ea => name.indexOf(ea.address) === 0),
            ea => ea.address.length);
}

export function parseJsonLikeObj(source) {
  try {
    var obj = eval(`(${lively.ast.transform.wrapInFunction(`var _; _ = (${source})`)})()`);
  } catch (e) { return JSON.parse(source); }
  return typeof obj !== "object" ? null : obj
}

export function systemConfChange(source) {
  var jso = parseJsonLikeObj(source),
      exceptions = ["baseURL"];
  exceptions.forEach(ea => delete jso[ea]);
  Object.keys(jso).forEach(k => modules.System[k] = jso[k]);
  modules.System.config(jso);
}

export {
  shortModuleName,
  moduleChange,
  vmReload,
  unload,
  interactivelyRemoveModule,
  interactivelyAddModule
} from "./module-commands.js";

export {
  loadPackage,
  interactivelyCreatePackage,
  interactivelyLoadPackage,
  interactivelyReloadPackage,
  interactivelyUnloadPackage,
  interactivelyRemovePackage,
  packageConfChange,
  showExportsAndImportsOf
} from "./package-commands.js";
