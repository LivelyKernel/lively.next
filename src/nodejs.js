import { resource } from "lively.resources";

function ensureParent(currentModule, name, parent) {
  if (parent) return parent;

  let {id, System} = currentModule,
      idForNode = id.startsWith("file://") ? id.replace("file://", "") : id,
      module = System._nodeRequire("module");

  parent = module.Module._cache[id];
  if (parent) return parent;
  parent = {id: idForNode, filename: idForNode, paths: []};
  let p = currentModule.package();
  if (p) parent.paths.push(resource(p.url).join("node_modules/").path());
  return parent;
}

function relative(module, name) {
  return resource(module.id).parent().join(name).url.replace("file://", "");
}

export function _require(currentModule, name, parent) {
  parent = ensureParent(currentModule, name);
  let {System} = currentModule,
      module = System._nodeRequire("module");
  if (name.startsWith(".")) name = relative(currentModule, name);
  return module._load(name, parent);
}

export function _resolve(currentModule, name, parent) {
  parent = ensureParent(currentModule, name);
  let {System} = currentModule,
      module = System._nodeRequire("module");
  if (name.startsWith(".")) name = relative(currentModule, name);
  return module._resolveFilename(name, parent);
}
