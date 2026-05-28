import { resource } from 'lively.resources';

function fileURLToPathname (url) {
  const parsed = new URL(url);
  const pathname = parsed.pathname
    .replace(/%2f/ig, match => `%25${match.slice(1)}`)
    .replace(/%5c/ig, match => `%25${match.slice(1)}`);
  let decodedPath = decodeURIComponent(pathname);
  if (parsed.host) decodedPath = `//${parsed.host}${decodedPath}`;
  return decodedPath.replace(/^\/([a-z]:\/)/i, '$1').replace(/\\/g, '/');
}

function ensureParent (currentModule, name, parent) {
  if (parent) return parent;

  let { id, System } = currentModule;
  let idForNode = id.startsWith('file://') ? fileURLToPathname(id) : id;
  let module = System._nodeRequire('module');

  parent = module.Module._cache[id];
  if (parent) return parent;
  parent = { id: idForNode, filename: idForNode, paths: [] };
  let p = currentModule.package();
  if (p) parent.paths.push(resource(p.url).join('node_modules/').path());
  return parent;
}

function relative (module, name) {
  return fileURLToPathname(resource(module.id).parent().join(name).url);
}

export function _require (currentModule, name, parent) {
  parent = ensureParent(currentModule, name);
  let { System } = currentModule;
  let module = System._nodeRequire('module');
  if (name.startsWith('.')) name = relative(currentModule, name);
  return module._load(name, parent);
}

export function _resolve (currentModule, name, parent) {
  parent = ensureParent(currentModule, name);
  let { System } = currentModule;
  let module = System._nodeRequire('module');
  if (name.startsWith('.')) name = relative(currentModule, name);
  return module._resolveFilename(name, parent);
}
