/*global System*/
import fs from "fs";
import { join } from "path";
import { resource } from "lively.resources";
import { parseQuery } from "lively.resources";
import { arr, obj } from "lively.lang";
const Generator = System.get('@jspm_generator').default;

// Deps that cannot be resolved via jspm.io CDN:
// - native binary packages (platform-specific compiled addons)
// - packages specified as git refs instead of registry versions
// - wildcard version specs
function isUnresolvableOnCDN ([name, version]) {
  if (version === '*' || version.includes('/')) return true; // wildcard or github ref
  if (/^@rollup\/rollup-/.test(name)) return true;
  if (/^@swc\/core(-|$)/.test(name)) return true;
  if (name === '@jspm/generator') return true;
  return false;
}

/**
 * Extract the failing transitive package name + version from a jspm generator
 * error message.  Patterns we look for:
 *   "Unable to fetch https://ga.jspm.io/npm:<pkg>@<ver>/package.json"
 *   "Package <pkg>@<ver> not found on ..."
 */
function extractFailingPackage (errMsg) {
  const cdnMatch = errMsg.match(/ga\.jspm\.io\/npm:(@?[^@]+)@([^/]+)\//);
  if (cdnMatch) return { name: cdnMatch[1], version: cdnMatch[2] };
  const pkgMatch = errMsg.match(/Package\s+(@?[^\s@]+)@(\S+)/);
  if (pkgMatch) return { name: pkgMatch[1], version: pkgMatch[2] };
  return null;
}

/**
 * Given a package name and failing version, find a nearby version that
 * actually exists on the jspm.io CDN by walking backwards from the failing
 * version through the npm registry's version list.
 */
async function findAvailableCDNVersion (name, failingVersion) {
  let versions;
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}`, {
      headers: { Accept: 'application/vnd.npm.install-v1+json' }
    });
    if (!res.ok) return null;
    const meta = await res.json();
    versions = Object.keys(meta.versions || {});
  } catch { return null; }

  const failIdx = versions.indexOf(failingVersion);
  if (failIdx < 0) return null;
  // Try up to 20 versions before the failing one (most recent first)
  const candidates = versions.slice(Math.max(0, failIdx - 20), failIdx).reverse();

  for (const ver of candidates) {
    try {
      const probe = await fetch(
        `https://ga.jspm.io/npm:${name}@${ver}/package.json`,
        { method: 'HEAD' }
      );
      if (probe.ok) return ver;
    } catch { continue; }
  }
  return null;
}

function createGenerator (inputMap, resolutions) {
  return new Generator({
    env: ["browser", "module", "import"],
    defaultProvider: 'jspm.io',
    inputMap,
    ...(Object.keys(resolutions).length ? { resolutions } : {})
  });
}

async function installDeps (generator, deps, failed, resolutions, inputMap) {
  const depNames = deps.map(([name]) => name);
  let needsRestart = false;

  for (let dep of deps) {
    if (dep[0] == 'tar-fs' || isUnresolvableOnCDN(dep) || !!generator.map.imports[dep[0]]) continue;
    const depName = dep[0];
    const depSpec = dep.join('@');
    try {
      await generator.install(depSpec);
      delete failed[depName];
      continue;
    } catch (firstErr) {
      const errMsg = firstErr.message || String(firstErr);
      const failingPkg = extractFailingPackage(errMsg);
      if (failingPkg && !resolutions[failingPkg.name]) {
        console.warn(`\x1b[33m       [!] Import map: ${depSpec} failed — transitive dep ${failingPkg.name}@${failingPkg.version} not on CDN, searching for available version...\x1b[0m`);
        const goodVersion = await findAvailableCDNVersion(failingPkg.name, failingPkg.version);
        if (goodVersion) {
          console.log(`\x1b[32m       [✓] Found ${failingPkg.name}@${goodVersion} on CDN, pinning via resolutions\x1b[0m`);
          resolutions[failingPkg.name] = goodVersion;
          needsRestart = true;
          continue; // don't mark as failed — will be retried in second pass
        } else {
          console.warn(`\x1b[33m       [!] Import map: no available CDN version found for ${failingPkg.name}\x1b[0m`);
        }
      } else if (!failingPkg) {
        // Non-CDN-404 error — retry once
        console.warn('\x1b[33m       [!] Import map: first attempt failed for ' + depSpec + ': ' + errMsg + ', retrying...\x1b[0m');
        try {
          await generator.install(depSpec);
          delete failed[depName];
          continue;
        } catch (retryErr) {
          console.warn('\x1b[33m       [!] Import map: failed to resolve ' + depSpec + ': ' + (retryErr.message || retryErr) + '\x1b[0m');
        }
      }
      failed[depName] = true;
    }
  }

  // If we discovered new resolution pins, recreate the generator and
  // redo the entire install so all deps benefit from the pins.
  if (needsRestart) {
    console.log(`\x1b[36m       [↻] Restarting import map resolution with ${Object.keys(resolutions).length} pinned resolution(s)...\x1b[0m`);
    generator = createGenerator(inputMap, resolutions);
    for (const key of Object.keys(failed)) delete failed[key];
    for (let dep of deps) {
      if (dep[0] == 'tar-fs' || isUnresolvableOnCDN(dep) || !!generator.map.imports[dep[0]]) continue;
      const depName = dep[0];
      const depSpec = dep.join('@');
      try {
        await generator.install(depSpec);
        delete failed[depName];
      } catch (err) {
        console.warn('\x1b[33m       [!] Import map: failed to resolve ' + depSpec + ': ' + (err.message || err) + '\x1b[0m');
        failed[depName] = true;
      }
    }
  }

  for (const failedDep of Object.keys(failed)) {
    if (!depNames.includes(failedDep)) delete failed[failedDep];
  }
  const toUninstall = arr.withoutAll(Object.keys(generator.map.imports), deps.map(d => d[0]));
  await generator.uninstall(toUninstall);
  return generator;
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
  const resolutions = {};
  let generator = createGenerator(inputMap, resolutions);
  const failed = inputMap?._failed || {};
  generator = await installDeps(
    generator,
    Object.entries(pkg.config.dependencies || {}).filter(([dep]) => !dep.match(/lively(\.|-)/)),
    failed,
    resolutions,
    inputMap
  );
  const importMap = JSON.parse(JSON.stringify(generator.getMap()).replace(/https:\/\//g, 'esm://'))
  if (!obj.isEmpty(failed)) importMap._failed = failed;
  if (!obj.isEmpty(resolutions)) importMap._resolutions = resolutions;
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
