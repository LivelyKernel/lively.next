/*global System*/
import fs from "fs";
import { join } from "path";
import { resource } from "lively.resources";
import { parseQuery } from "lively.resources";
import { arr, obj } from "lively.lang";
const Generator = System.get('@jspm_generator').default;

async function installDeps(generator, deps, failed) {
  for (let dep of deps) {
    if (dep[0] == 'tar-fs' || !!generator.map.imports[dep[0]] || failed[dep[0]]) continue;
    try {
      await generator.install(dep.join('@'));
    } catch (err) {
      console.error('Failed to install ' + dep.join('@'));
      failed[dep[0]] = true;
    }
  }
  const toUninstall = arr.withoutAll(Object.keys(generator.map.imports), deps.map(d => d[0]));
  await generator.uninstall(toUninstall);
}

export async function generateImportMap (packageName) {
  let inputMap = false;
  const packageRegistry = System.get("@lively-env").packageRegistry;
  const pkg = packageName && packageRegistry.lookup(packageName);
  if (!pkg) return {};
  const cachedImportMap = resource(pkg.url).join('.cachedImportMap.json');
  if (await cachedImportMap.exists()) {
    inputMap = JSON.parse((await cachedImportMap.read()).replace(/esm:\/\//g, 'https://')); // replace esm to make generator install again
  }
  const generator = new Generator({
    env: ["browser"],
    defaultProvider: 'jspm.io', 
    inputMap
  });
  const failed = inputMap?._failed || {}; // collect the packages where we fail to generate import maps, likely due to incompatibility with the browser
  await installDeps(
    generator, 
    Object.entries(pkg.config.dependencies || {}).filter(([dep]) => !dep.startsWith('lively.')),
    failed
  );
  const importMap = JSON.parse(JSON.stringify(generator.getMap()).replace(/https:\/\//g, 'esm://'))
  if (!obj.isEmpty(failed)) importMap._failed = failed;
  if (!obj.isEmpty(importMap)) await cachedImportMap.writeJson(importMap);
  else if (inputMap) { await cachedImportMap.remove() }
  return importMap;
}

export default class LibLookupPlugin {

  constructor() {
    this._fsRootDir = null;
  }

  setOptions({route} = {}) {}

  get pluginId() { return "lib-lookup"; }

  toString() { return `<${this.pluginId}>`; }

  get before() { return ["jsdav"]; }

  setup(livelyServer) {
    this._fsRootDir = livelyServer.options.jsdav.rootDirectory;
  }

  async close() {}

  get libPath() { return "/lively.next-node_modules/"; }

  get fsRootDir() {
    let {_fsRootDir} = this;
    if (!_fsRootDir) throw new Error("fsRootDir not set, was setup(livelyServer) called?")
    return _fsRootDir;
  }

  get packageRegistry() { return System.get("@lively-env").packageRegistry; }

  sendPackageRegistry(req, res) {
    let r = this.packageRegistry;
    res.writeHead(200,  {"Content-Type": "application/json"});
    res.end(JSON.stringify(r.toJSON()));
  }

  async sendImportmap (req, res) {
    const { projectName } = parseQuery(req.url);
    res.writeHead(200,  {"Content-Type": "application/json"});
    res.end(JSON.stringify( await generateImportMap(projectName)));
  }

  async handleRequest(req, res, next) {
    let {libPath, fsRootDir} = this, {url: path} = req;

    if (path === "/package-registry.json") return this.sendPackageRegistry(req, res);
    if (path.startsWith("/import-map.json")) return await this.sendImportmap(req, res);

    if (!path.startsWith(libPath) || path === libPath) return next();
    if (fs.existsSync(join(fsRootDir, path))) return next();

    path = decodeURIComponent(path);
    
    try {
    let lookupPath = path.split("/").slice(2).join("/"),
        version = false, // for now disable
        fullLibPath = System._nodeRequire.resolve(lookupPath);

    if (version) {
      if (fs.existsSync(join(fullLibPath, packageName, version))) return next();
    } else {
      if (fs.existsSync(fullLibPath)) {
        if (fullLibPath.endsWith(path)) { return next(); }
        else {
          res.writeHead(301, { location: fullLibPath.replace(fsRootDir, '') });
          res.end();
          return;
        }
      }
    }

    } catch (err) { return next() } 
    

    let registry = this.packageRegistry;
    if (!registry) return next();

    let pkg = registry.lookup(packageName, version);
    if (!pkg) return next();

    let pkgURL = resource(pkg.url).path(),
        index = pkgURL.indexOf(fullLibPath)

    if (index !== 0) return next();
    
    let newPath = join(libPath, pkgURL.slice(fullLibPath.length), ...rest);
    req.url = newPath;

    if (fs.existsSync(join(fsRootDir, newPath)))
      res.writeHead(301,  {location: newPath});
    else
      res.writeHead(404);
    
    res.end();
  }

}
