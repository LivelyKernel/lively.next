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
  if (name === 'puppeteer' || name === 'puppeteer-core') return true;
  return false;
}

/**
 * Extract the failing transitive package name + version from a jspm generator
 * error message when the package version itself is missing from the CDN.
 * Do not treat subpath/export failures as missing packages; globally pinning a
 * nearby version can break packages that intentionally use another major.
 *
 * Patterns we look for:
 *   "Unable to fetch https://ga.jspm.io/npm:<pkg>@<ver>/package.json"
 *   "Package <pkg>@<ver> not found on ..."
 */
function extractFailingPackage (errMsg) {
  const cdnMatch = errMsg.match(/ga\.jspm\.io\/npm:(@?[^@]+)@([^/]+)\/package\.json/);
  if (cdnMatch) return { name: cdnMatch[1], version: cdnMatch[2] };
  const pkgMatch = errMsg.match(/Package\s+(@?[^\s@]+)@(\S+)/);
  if (pkgMatch) return { name: pkgMatch[1], version: pkgMatch[2] };
  return null;
}

function extractBuildFailingPackage (errMsg) {
  const buildMatch = errMsg.match(/JSPM encountered an error building (@?[^\s@]+)@([^:]+):/);
  if (buildMatch) return { name: buildMatch[1], version: buildMatch[2] };
  return null;
}

function extractPackageConfigFailingPackage (errMsg) {
  const configMatch = errMsg.match(/reading package config for https:\/\/ga\.jspm\.io\/npm:(@?[^@]+)@([^/]+)\//);
  if (configMatch) return { name: configMatch[1], version: configMatch[2] };
  return null;
}

function isExactVersionSpec (version) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
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

  const failingSemver = parseStableSemver(failingVersion);
  if (!failingSemver) return null;

  const candidates = versions
    .map(ver => ({ ver, semver: parseStableSemver(ver) }))
    .filter(({ semver }) =>
      semver &&
      semver.major === failingSemver.major &&
      compareStableSemver(semver, failingSemver) < 0)
    .sort((a, b) => compareStableSemver(b.semver, a.semver))
    .slice(0, 40)
    .map(({ ver }) => ver);

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

function parseStableSemver (version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareStableSemver (a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

function createGenerator (inputMap, resolutions) {
  return new Generator({
    env: ["browser", "module", "import"],
    defaultProvider: 'jspm.io',
    inputMap,
    ...(Object.keys(resolutions).length ? { resolutions } : {})
  });
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientInstallError (errMsg) {
  return /Invalid status code (408|429|5\d\d)|Bad Gateway|Gateway Timeout|Service Unavailable/i.test(errMsg);
}

async function retryInstall (generator, depSpec, firstErr) {
  let err = firstErr;
  const transient = isTransientInstallError(firstErr.message || String(firstErr));
  const attempts = transient ? 4 : 2;

  for (let attempt = 2; attempt <= attempts; attempt++) {
    const errMsg = err.message || String(err);
    const waitMs = transient ? Math.min(1000 * Math.pow(2, attempt - 2), 5000) : 0;
    console.warn(`\x1b[33m       [!] Import map: attempt ${attempt - 1} failed for ${depSpec}: ${errMsg}, retrying${waitMs ? ` in ${waitMs / 1000}s` : ''}...\x1b[0m`);
    if (waitMs) await delay(waitMs);
    try {
      await generator.install(depSpec);
      return true;
    } catch (retryErr) {
      err = retryErr;
    }
  }

  console.warn('\x1b[33m       [!] Import map: failed to resolve ' + depSpec + ': ' + (err.message || err) + '\x1b[0m');
  return false;
}

function addMarkdownItEntitiesCompat (inputMap, deps) {
  const markdownItDep = deps.find(([dep]) => dep === 'markdown-it');
  if (!markdownItDep) return inputMap;

  const version = markdownItDep[1];
  if (!/^\d+\.\d+\.\d+$/.test(version)) return inputMap;

  inputMap ||= {};
  inputMap.scopes ||= {};

  // markdown-it 12 imports a legacy entities JSON subpath. Newer entities
  // versions expose ESM paths for other packages, so keep this override scoped.
  const scope = `https://ga.jspm.io/npm:markdown-it@${version}/`;
  inputMap.scopes[scope] ||= {};
  inputMap.scopes[scope]['entities/lib/maps/entities.json'] ||= 'https://ga.jspm.io/npm:entities@2.1.0/lib/maps/entities.json.js';

  return inputMap;
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
      const failingPkg =
        extractFailingPackage(errMsg) ||
        extractBuildFailingPackage(errMsg) ||
        (!isExactVersionSpec(dep[1]) && extractPackageConfigFailingPackage(errMsg));
      if (failingPkg && !resolutions[failingPkg.name]) {
        console.warn(`\x1b[33m       [!] Import map: ${depSpec} failed — transitive dep ${failingPkg.name}@${failingPkg.version} is not usable on CDN, searching for available version...\x1b[0m`);
        const goodVersion = await findAvailableCDNVersion(failingPkg.name, failingPkg.version);
        if (goodVersion) {
          console.log(`\x1b[32m       [✓] Found ${failingPkg.name}@${goodVersion} on CDN, pinning via resolutions\x1b[0m`);
          resolutions[failingPkg.name] = goodVersion;
          needsRestart = true;
          continue; // don't mark as failed — will be retried in second pass
        } else {
          console.warn(`\x1b[33m       [!] Import map: no available CDN version found for ${failingPkg.name}\x1b[0m`);
        }
      } else if (failingPkg) {
        needsRestart = true;
        continue;
      } else if (await retryInstall(generator, depSpec, firstErr)) {
        delete failed[depName];
        continue;
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
        if (await retryInstall(generator, depSpec, err)) delete failed[depName];
        else failed[depName] = true;
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
  const deps = Object.entries(pkg.config.dependencies || {}).filter(([dep]) => !dep.match(/lively(\.|-)/));
  const cachedImportMap = resource(pkg.url).join('.cachedImportMap.json');
  if (await cachedImportMap.exists()) {
    inputMap = JSON.parse((await cachedImportMap.read()).replace(/esm:\/\//g, 'https://')); // replace esm to make generator install again
  }
  inputMap = addMarkdownItEntitiesCompat(inputMap, deps);
  const resolutions = {};
  let generator = createGenerator(inputMap, resolutions);
  const failed = inputMap?._failed || {};
  generator = await installDeps(
    generator,
    deps,
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
