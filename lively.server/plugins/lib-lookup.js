/*global System*/
import fs from "fs";
import path, { join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
let Generator;
const jspmAvailabilityCache = new Map();
const JSPM_AVAILABILITY_TTL = 60 * 1000;

// Deps that cannot be resolved via jspm.io CDN:
// - native binary packages (platform-specific compiled addons)
// - packages specified as git refs instead of registry versions
// - wildcard version specs
function isUnresolvableOnCDN ([name, version]) {
  if (version === '*' || version.startsWith('workspace:') || version.startsWith('link:') || version.startsWith('file:') || version.includes('/')) return true; // wildcard or github ref
  if (/^@rollup\/rollup-/.test(name)) return true;
  if (/^@swc\/core(-|$)/.test(name)) return true;
  if (name === '@jspm/generator') return true;
  if (name === '@buxlabs/amd-to-es6') return true; // Used only by the Node freezer resolver.
  if (name === 'nw') return true;
  if (name === 'puppeteer' || name === 'puppeteer-core') return true;
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

function createGenerator (inputMap, providers, baseUrl) {
  return new Generator({
    env: ["browser", "module", "import"],
    baseUrl,
    mapUrl: baseUrl && new URL(".cachedImportMap.json", baseUrl),
    defaultProvider: 'jspm.io',
    inputMap,
    ...(Object.keys(providers).length ? { providers } : {})
  });
}

function moduleUrlsIn (value, urls = new Set()) {
  if (typeof value === 'string') {
    if (value.startsWith('https://ga.jspm.io/npm:') && !value.endsWith('/')) urls.add(value);
  } else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) moduleUrlsIn(nested, urls);
  }
  return urls;
}

async function isUnavailableOnJspm (url, fetchModule, availabilityCache) {
  let cached = availabilityCache.get(url);
  if (!cached || Date.now() - cached.checkedAt > JSPM_AVAILABILITY_TTL) {
    cached = {
      checkedAt: Date.now(),
      result: (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await fetchModule(url, { method: 'HEAD' });
            if (response.status < 500) return response.status === 404 || response.status === 410;
          } catch {}
        }
        return false;
      })()
    };
    availabilityCache.set(url, cached);
  }
  return await cached.result;
}

export async function findUnavailableJspmPackages (
  importMap,
  fetchModule = fetch,
  availabilityCache = jspmAvailabilityCache
) {
  const urls = [...moduleUrlsIn(importMap)];
  const unavailable = new Set();
  let next = 0;

  async function checkNext () {
    while (next < urls.length) {
      const url = urls[next++];
      if (!await isUnavailableOnJspm(url, fetchModule, availabilityCache)) continue;
      const failingPackage = extractFailingPackage(url);
      if (failingPackage) unavailable.add(failingPackage.name);
    }
  }

  await Promise.all(Array.from({ length: Math.min(20, urls.length) }, checkNext));
  return [...unavailable].sort();
}

function esmShPackagesIn (value, packageNames = new Set()) {
  if (typeof value === 'string') {
    const match = value.match(/^https:\/\/esm\.sh\/(?:v\d+\/)?\*?((?:@[^/@]+\/)?[^/@]+)@/);
    if (match) packageNames.add(match[1]);
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      esmShPackagesIn(key, packageNames);
      esmShPackagesIn(nested, packageNames);
    }
  }
  return packageNames;
}

function fileURLPath (url) {
  try { return path.resolve(fileURLToPath(url)); } catch (err) { return null; }
}

function clientRelativeFileURL (url) {
  if (typeof url !== 'string' || !url.startsWith('file:')) return url;

  const baseURL = System.baseURL.endsWith('/') ? System.baseURL : System.baseURL + '/';
  const basePath = fileURLPath(baseURL);
  const urlPath = fileURLPath(url);
  if (!basePath || !urlPath) return url;

  let relative = path.relative(basePath, urlPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return url;

  relative = relative.replace(/\\/g, '/');
  if (!relative) return '';
  if (url.endsWith('/') && !relative.endsWith('/')) relative += '/';
  return relative;
}

function clientRelativePackageRegistryJSON (value) {
  if (typeof value === 'string') return clientRelativeFileURL(value);
  if (Array.isArray(value)) return value.map(clientRelativePackageRegistryJSON);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      clientRelativeFileURL(key),
      clientRelativePackageRegistryJSON(entry)
    ]));
  }
  return value;
}

export async function installDeps (
  generator,
  deps,
  failed,
  providers,
  newGenerator = createGenerator,
  findUnavailablePackages = findUnavailableJspmPackages
) {
  const depNames = deps.map(([name]) => name);
  while (true) {
    let needsRestart = false;

    for (let dep of deps) {
      if (dep[0] == 'tar-fs' || isUnresolvableOnCDN(dep)) continue;
      const depName = dep[0];
      const depSpec = dep.join('@');
      try {
        await generator.install(depSpec);
        delete failed[depName];
      } catch (firstErr) {
        const errMsg = firstErr.message || String(firstErr);
        const failingPkg = extractFailingPackage(errMsg);
        if (failingPkg && !providers[failingPkg.name]) {
          console.warn(`\x1b[33m       [!] Import map: ${depSpec} failed — ${failingPkg.name}@${failingPkg.version} is unavailable from jspm.io; retrying the same version via esm.sh\x1b[0m`);
          providers[failingPkg.name] = 'esm.sh';
          needsRestart = true;
          break;
        }

        // Retry transient failures once before leaving the direct dependency unresolved.
        console.warn('\x1b[33m       [!] Import map: first attempt failed for ' + depSpec + ': ' + errMsg + ', retrying...\x1b[0m');
        try {
          await generator.install(depSpec);
          delete failed[depName];
          continue;
        } catch (retryErr) {
          console.warn('\x1b[33m       [!] Import map: failed to resolve ' + depSpec + ': ' + (retryErr.message || retryErr) + '\x1b[0m');
        }
        failed[depName] = true;
      }
    }

    if (!needsRestart) {
      const unavailablePackages = await findUnavailablePackages(generator.getMap());
      const newFallbacks = unavailablePackages.filter(name => !providers[name]);
      for (const name of newFallbacks) providers[name] = 'esm.sh';
      if (newFallbacks.length) {
        console.warn(`\x1b[33m       [!] Import map: ${newFallbacks.length} generated jspm.io package artifact(s) returned 404; retrying them via esm.sh\x1b[0m`);
        needsRestart = true;
      }
    }
    if (!needsRestart) break;
    console.log(`\x1b[36m       [↻] Restarting import map resolution with ${Object.keys(providers).length} esm.sh package fallback(s)...\x1b[0m`);
    // Existing locks still point at the failed provider. Rebuild the map so
    // the package-level provider overrides apply throughout the dependency graph.
    generator = newGenerator(false, providers);
    for (const key of Object.keys(failed)) delete failed[key];
  }

  for (const failedDep of Object.keys(failed)) {
    if (!depNames.includes(failedDep)) delete failed[failedDep];
  }
  const toUninstall = Object.keys(generator.map.imports).filter(name => !deps.some(([dependency]) => dependency === name));
  await generator.uninstall(toUninstall);
  return generator;
}

// Browser maps are generated cache data, independent of Bun's installed graph.
export async function generateImportMapForPackage (packageDir, { update = false } = {}) {
  const config = JSON.parse(await fs.promises.readFile(join(packageDir, 'package.json'), 'utf8'));
  const dependencies = Object.fromEntries(Object.entries(config.dependencies || {}).sort(([a], [b]) => a.localeCompare(b)));
  const cacheFile = join(packageDir, '.cachedImportMap.json');
  let cached;
  try { cached = JSON.parse(await fs.promises.readFile(cacheFile, 'utf8')); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  if (!update && cached && JSON.stringify(cached._dependencies) === JSON.stringify(dependencies) && Array.isArray(cached._modules)) {
    return cached;
  }
  if (!Generator) ({ Generator } = await import('@jspm/generator'));
  const providers = { ...cached?._providers };
  const failed = {};
  // Reuse previously selected URLs, except when refreshing or changing providers.
  let inputMap = false;
  if (!update && cached && !cached._resolutions && !cached._providers) {
    const { imports, scopes, integrity } = JSON.parse(JSON.stringify(cached).replace(/esm:\/\//g, 'https://'));
    inputMap = { imports, scopes, integrity };
  }
  const newGenerator = (inputMap, overrides) => createGenerator(inputMap, overrides, pathToFileURL(path.resolve(packageDir) + path.sep));
  let generator = newGenerator(inputMap, providers);
  generator = await installDeps(
    generator,
    Object.entries(dependencies).filter(([name]) => !name.match(/lively(\.|-)/)),
    failed,
    providers,
    newGenerator
  );
  if (Object.keys(failed).length) {
    throw new Error(`Cannot generate browser import map for ${config.name}: ${Object.keys(failed).join(', ')}`);
  }
  const { map: generatedMap, staticDeps, dynamicDeps } = await generator.extractMap(Object.keys(generator.map.imports), undefined, undefined, true);
  const usedEsmShPackages = esmShPackagesIn(generatedMap);
  for (const [name, provider] of Object.entries(providers)) {
    if (provider === 'esm.sh' && !usedEsmShPackages.has(name)) delete providers[name];
  }
  const importMap = JSON.parse(JSON.stringify(generatedMap).replace(/https:\/\//g, 'esm://'));
  importMap._dependencies = dependencies;
  importMap._modules = [...new Set([...staticDeps, ...dynamicDeps])].sort();
  if (Object.keys(providers).length) importMap._providers = providers;
  const temporary = `${cacheFile}.${process.pid}.tmp`;
  await fs.promises.writeFile(temporary, JSON.stringify(importMap, null, 2) + '\n');
  await fs.promises.rename(temporary, cacheFile);
  return importMap;
}

export async function generateImportMap (packageName, options) {
  const pkg = packageName && System.get('@lively-env').packageRegistry.lookup(packageName);
  if (!pkg) throw new Error(`Unknown package: ${packageName}`);
  return generateImportMapForPackage(fileURLToPath(pkg.url), options);
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

  get fsRootDir() {
    let {_fsRootDir} = this;
    if (!_fsRootDir) throw new Error("fsRootDir not set, was setup(livelyServer) called?")
    return _fsRootDir;
  }

  get packageRegistry() { return System.get("@lively-env").packageRegistry; }

  sendPackageRegistry(req, res) {
    let r = this.packageRegistry;
    res.writeHead(200,  {"Content-Type": "application/json"});
    res.end(JSON.stringify(clientRelativePackageRegistryJSON(r.toJSON())));
  }

  async sendImportmap (req, res) {
    const projectName = new URL(req.url, 'http://localhost').searchParams.get('projectName');
    try {
      const importMap = await generateImportMap(projectName);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(importMap));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  async handleRequest(req, res, next) {
    if (req.url === '/package-registry.json') return this.sendPackageRegistry(req, res);
    if (req.url.startsWith('/import-map.json')) return this.sendImportmap(req, res);
    return next();
  }
}
