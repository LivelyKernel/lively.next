import { resource } from "lively.resources";

function ensureParent(currentModule, name, parent) {
  if (parent) return parent;
  let {id, System} = currentModule,
      module = System._nodeRequire("module");
  if (id.startsWith("file://")) id = id.replace("file://", "");
  parent = module.Module._cache[id];
  if (parent) return parent;
  parent = {id: id, paths: []};
  let p = currentModule.package();
  if (p) {
    parent.paths.push(resource(p.url).join("node_modules/").path());
  }
  return parent;
}

export function _require(currentModule, name, parent) {
  parent = ensureParent(currentModule, name);
  let {System} = currentModule,
      module = System._nodeRequire("module");
  return module._load(name, parent);
}

export function _resolve(currentModule, name, parent) {
  parent = ensureParent(currentModule, name);
  let {System} = currentModule,
      module = System._nodeRequire("module");
  return module._resolveFilename(name, parent);
}
