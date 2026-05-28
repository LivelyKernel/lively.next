import {
  sort as _semverSort,
  gt as _semverGt,
  compare as _semverCompare,
  valid as _semverValid,
  validRange as _semverValidRange,
  satisfies as _semverSatisfies
} from 'semver';
import { arr, obj, promise } from 'lively.lang';
import { Package } from './package.js';
import { resource } from 'lively.resources';
import { isURL } from '../url-helpers.js';
import { classHolder } from '../cycle-breaker.js';

function loadedSystemModule (requireName, expectedProperty) {
  const System = globalThis.System;
  if (!System) return null;
  const encodedName = requireName.replace('/', '__SLASH__');
  const candidates = Object.keys(System.loads || {}).filter(key =>
    key.includes(requireName) || key.includes(encodedName));
  for (const key of candidates) {
    const value = System.loads[key]?.exports || System.get?.(key, false);
    if (typeof value?.[expectedProperty] === 'function') return value;
  }
  return null;
}

function isNodeSystem (System = globalThis.System) {
  try {
    const env = System?.get?.('@system-env');
    if (env) return !!env.node && !env.browser && !env.nw;
  } catch (_) {}
  return typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    !!process.versions?.node;
}

function cjsDefault (module, expectedProperty, requireName) {
  let value = module;
  while (value && typeof value === 'object' && typeof value[expectedProperty] !== 'function' && 'default' in value) {
    value = value.default;
  }
  if (typeof value?.[expectedProperty] !== 'function' && requireName) {
    value = loadedSystemModule(requireName, expectedProperty) || value;
  }
  if (typeof value?.[expectedProperty] !== 'function' && requireName && isNodeSystem() && globalThis.System?._nodeRequire) {
    value = globalThis.System._nodeRequire(requireName);
    while (value && typeof value === 'object' && typeof value[expectedProperty] !== 'function' && 'default' in value) {
      value = value.default;
    }
  }
  return value;
}

const _semver = {
  sort: _semverSort,
  gt: _semverGt,
  compare: _semverCompare,
  valid: _semverValid,
  validRange: _semverValidRange,
  satisfies: _semverSatisfies
};
const semver = cjsDefault(_semver, 'validRange', 'semver');
const urlStartRe = /^[a-z\.-_\+]+:/i;

function normalizedVersion (version) {
  if (version == null) return null;
  return semver.valid(String(version), true);
}

function compareVersions (a, b) {
  const validA = normalizedVersion(a);
  const validB = normalizedVersion(b);
  if (validA && validB) return semver.compare(validA, validB, true);
  if (validA) return 1;
  if (validB) return -1;
  return String(a || '').localeCompare(String(b || ''));
}

function sortVersions (versions) {
  return versions.slice().sort(compareVersions);
}

function isAbsolute (path) {
  return (
    path.startsWith('/') ||
    path.startsWith('http:') ||
    path.startsWith('https:') ||
    path.startsWith('file:') ||
    path.match(urlStartRe));
}

function ensureResource (path) {
  return path.isResource ? path : resource(path);
}

function packageLookupURL (url) {
  if (url.isResource) url = url.url;
  url = String(url).replace(/\\/g, '/');
  try { url = decodeURI(url); } catch (_) {}
  url = url
    .replace(/^file:\/\/localhost\//i, '/')
    .replace(/^file:\/\/\/([a-z]:\/)/i, (_, drivePath) => drivePath)
    .replace(/^file:\/\/\/?/i, '/')
    .replace(/^([a-z]):\//i, (_, drive) => `${drive.toLowerCase()}:/`);
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export class PackageRegistry {
  static ofSystem (System) {
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // We add a PackageRegistry to the System which basically serves as
    // "database" for all module / package related state.
    // This also makes it easy to completely replace the module / package state by
    // simply replacing the System instance
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    let registry = System.get('@lively-env').packageRegistry;
    if (!registry) {
      registry = System['__lively.modules__packageRegistry'] = new this(System);
    }
    return registry;
  }

  static forDirectory (System, dir) {
    return new this(System, { packageBaseDirs: [ensureResource(dir)] });
  }

  static fromJSON (System, jso) {
    return new this(System).fromJSON(jso);
  }

  constructor (System, opts = {}) {
    this.System = System;
    this.packageBaseDirs = opts.packageBaseDirs || [];
    this.devPackageDirs = opts.devPackageDirs || [];
    this.individualPackageDirs = opts.individualPackageDirs || [];
    this._readyPromise = null;
    this.packageMap = {};
    this.moduleUrlToPkg = new Map();
    this._byURL = null;
    this._byLookupURL = null;
  }

  get byURL () {
    if (!this._byURL) {
      this._byURL = {};
      for (let p of this.allPackages()) { this._byURL[p.url] = p; }
    }
    return this._byURL;
  }

  get byLookupURL () {
    if (!this._byLookupURL) {
      this._byLookupURL = {};
      for (let p of this.allPackages()) { this._byLookupURL[packageLookupURL(p.url)] = p; }
    }
    return this._byLookupURL;
  }

  resetByURL () {
    this._byURL = null;
    this._byLookupURL = null;
  }

  allPackageURLs () { return Object.keys(this.byURL); }

  toJSON () {
    let {
      System,
      packageMap,
      individualPackageDirs,
      devPackageDirs,
      packageBaseDirs
    } = this;
    let packageMapJso = {};

    for (let pName in packageMap) {
      let spec = packageMap[pName];
      packageMapJso[pName] = {};
      packageMapJso[pName].latest = spec.latest;
      packageMapJso[pName].versions = {};
      for (let version in spec.versions) {
        packageMapJso[pName].versions[version] = spec.versions[version].toJSON();
      }
    }

    return {
      packageMap: packageMapJso,
      individualPackageDirs: individualPackageDirs.map(serializeURL), // eslint-disable-line no-use-before-define
      devPackageDirs: devPackageDirs.map(serializeURL), // eslint-disable-line no-use-before-define
      packageBaseDirs: packageBaseDirs.map(serializeURL) // eslint-disable-line no-use-before-define
    };

    function serializeURL ({ url }) {
      return !url.startsWith(System.baseURL)
        ? url
        : url.slice(System.baseURL.length).replace(/^\//, '');
    }
  }

  fromJSON (jso) {
    let packageMap = {}; let { System } = this; let base = resource(System.baseURL);
    for (let pName in jso.packageMap) {
      let spec = jso.packageMap[pName];
      packageMap[pName] = {};
      packageMap[pName].latest = spec.latest;
      packageMap[pName].versions = {};
      for (let version in spec.versions) {
        let pkgSpec = spec.versions[version];
        let url = pkgSpec.url;
        if (!isAbsolute(url)) url = base.join(url).url;
        let pkg = Package.fromJSON(System, { ...pkgSpec, url });
        packageMap[pName].versions[version] = pkg;
      }
    }

    this.packageMap = packageMap;
    this.individualPackageDirs = jso.individualPackageDirs.map(deserializeURL); // eslint-disable-line no-use-before-define
    this.devPackageDirs = jso.devPackageDirs.map(deserializeURL); // eslint-disable-line no-use-before-define
    this.packageBaseDirs = jso.packageBaseDirs.map(deserializeURL); // eslint-disable-line no-use-before-define
    this.resetByURL();
    classHolder.ModulePackageMapping.forSystem(System).clearCache();

    return this;

    function deserializeURL (url) {
      return isURL(url)
        ? resource(url)
        : resource(System.baseURL).join(url);
    }
  }

  updateFromJSON (jso) {
    let { packageMap } = this;
    for (let pName in jso.packageMap) {
      let spec = jso.packageMap[pName];

      if (!packageMap[pName]) packageMap[pName] = {};

      if (packageMap[pName].latest) {
        if (compareVersions(spec.latest, packageMap[pName].latest) > 0) { packageMap[pName].latest = spec.latest; }
      } else packageMap[pName].latest = spec.latest;

      if (!packageMap[pName].versions) packageMap[pName].versions = {};

      let { System } = this; let base = resource(System.baseURL);
      for (let version in spec.versions) {
        let pkgSpec = spec.versions[version];
        let url = pkgSpec.url;
        if (!isAbsolute(url)) url = base.join(url).url;
        let pkg = new Package.fromJSON(System, { ...pkgSpec, url });
        packageMap[pName].versions[version] = pkg;
      }
    }

    this.resetByURL();
    classHolder.ModulePackageMapping.forSystem(System).clearCache();
    return this;
  }

  whenReady () { return this._readyPromise || Promise.resolve(); }

  isReady () { return !this._readyPromise; }

  withPackagesDo (doFn) {
    for (let pName in this.packageMap) {
      let versions = this.packageMap[pName].versions;
      for (let versionName in versions) { doFn(versions[versionName]); }
    }
  }

  findPackage (matchFn) {
    for (let pName in this.packageMap) {
      let versions = this.packageMap[pName].versions;
      for (let versionName in versions) {
        let pkg = versions[versionName];
        if (matchFn(pkg)) return pkg;
      }
    }
    return null;
  }

  filterPackages (matchFn) {
    let result = [];
    this.withPackagesDo((pkg) =>
      matchFn(pkg) && result.push(pkg));
    return result;
  }

  allPackages () {
    let result = [];
    for (let pName in this.packageMap) {
      let versions = this.packageMap[pName].versions;
      for (let versionName in versions) { result.push(versions[versionName]); }
    }
    return result;
  }

  sortPackagesByVersion (pkgs) {
    return pkgs.sort((a, b) => compareVersions(a.version, b.version));
  }

  matches (pkg, pName, versionRange) {
    // does this package match the package pName@versionRange?

    let { name, version } = pkg;

    if (name !== pName) return false;

    if (!versionRange) return true;

    // if (gitSpec && (gitSpec.versionInFileName === version
    //   || this.versionInFileName === gitSpec.versionInFileName)) {
    //    return true
    // }

    if (semver.validRange(version || '', true) && semver.satisfies(version, versionRange, true)) { return true; }

    return false;
  }

  coversDirectory (dir) {
    dir = ensureResource(dir).asDirectory();
    let { packageBaseDirs, devPackageDirs, individualPackageDirs } = this;

    if (individualPackageDirs.some(ea => ea.equals(dir))) return 'individualPackageDirs';
    if (devPackageDirs.some(ea => ea.equals(dir))) return 'devPackageDirs';
    let parent = dir.parent().parent();
    if (packageBaseDirs.some(ea => ea.equals(parent))) {
      return this.allPackages().find(pkg =>
        ensureResource(pkg.url).equals(dir))
        ? 'packageCollectionDirs'
        : 'maybe packageCollectionDirs';
    }
    return null;
  }

  lookup (pkgName, versionRange) {
    // Query the package map if it has a package name@version
    // Compatibility is either a semver match or if package comes from a git
    // repo then if the git commit matches.  Additionally dev packages are
    // supported.  If a dev package with `name` is found it always matches

    // let gitSpec = gitSpecFromVersion(versionRange || "");
    // return this.findPackage((key, pkg) => pkg.matches(name, versionRange, gitSpec));
    // let gitSpec = gitSpecFromVersion(versionRange || "");
    let pkgData = this.packageMap[pkgName];
    if (!pkgData) return null;
    if (!versionRange || versionRange === 'latest') { return pkgData.versions[pkgData.latest]; }

    if (!semver.validRange(versionRange, true)) { throw new Error(`PackageRegistry>>lookup of ${pkgName}: Invalid version - ${versionRange}`); }
    let pkgs = obj.values(pkgData.versions).filter(pkg =>
      this.matches(pkg, pkgName, versionRange));
    if (pkgs.length <= 1) return pkgs[0];
    return arr.last(this.sortPackagesByVersion(pkgs));
  }

  findPackageDependency (basePkg, name, version) {
    // name@version is dependency of basePkg
    if (!version) version = basePkg.dependencies[name] || basePkg.devDependencies[name];
    if (!semver.validRange(version, true)) version = null;
    return this.lookup(name, version);
  }

  findPackageWithURL (url) {
    let lookupURL = packageLookupURL(url);
    return this.byURL[lookupURL] || this.byLookupURL[lookupURL];
  }

  findPackageHavingURL (url) {
    // does url identify a resource inside pkg, maybe pkg.url === url?
    let originalURL = url.isResource ? url.url : url;
    let lookupURL = packageLookupURL(url);
    let penaltySoFar = Infinity; let found = null; let { byLookupURL } = this;
    for (let pkgURL in byLookupURL) {
      if (lookupURL.indexOf(pkgURL) !== 0) continue;
      let penalty = lookupURL.slice(pkgURL.length).length;
      if (penalty >= penaltySoFar) continue;
      penaltySoFar = penalty;
      found = byLookupURL[pkgURL];
    }
    if (!found) {
      if (this.moduleUrlToPkg.has(originalURL)) return this.moduleUrlToPkg.get(originalURL);
      if (this.moduleUrlToPkg.has(lookupURL)) return this.moduleUrlToPkg.get(lookupURL);
    }
    if (found) {
      this.moduleUrlToPkg.set(originalURL, found);
      this.moduleUrlToPkg.set(lookupURL, found);
    }
    return found;
  }

  findPackageForPath (pathRequest, optParentPkg) {
    if (isAbsolute(pathRequest)) { return this.findPackageHavingURL(pathRequest); }

    if (pathRequest.startsWith('.')) return null; // relative

    // ry to figure out package name and maybe version
    let [pkgName] = pathRequest.split('/');
    if (!pkgName) return null;
    let atIndex = pkgName.indexOf('@'); let version;
    if (atIndex > -1) {
      version = pkgName.slice(atIndex + 1);
      pkgName = pkgName.slice(0, atIndex);
    }
    if (!version && optParentPkg) { return this.findPackageDependency(optParentPkg, pkgName); }

    return this.lookup(pkgName, version);
  }

  resolvePath (path, parentIdOrPkg) {
    // takes a path like foo/index.js or ./foo/index.js and an optional
    // parentId or package like http://org/baz.js and tries to resolve the path

    if (isAbsolute(path)) return path;

    let parentPackage = (parentIdOrPkg && parentIdOrPkg.isPackage) || null;

    if (!parentPackage && parentIdOrPkg) {
      if (path.startsWith('.')) {
        let res = resource(parentIdOrPkg);
        if (!res.isDirectory()) res = res.parent();
        return res.join(path).withRelativePartsResolved().url;
      }
      parentPackage = this.findPackageHavingURL(parentIdOrPkg);
    }

    let p = this.findPackageForPath(path, parentPackage);
    if (!p) return null;

    let slashIndex = path.indexOf('/');
    let pathInPackage = slashIndex === -1 || slashIndex === path.length - 1
      ? ''
      : path.slice(slashIndex);

    return pathInPackage ? resource(p.url).join(pathInPackage).url : p.url;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // reading stuff in

  async update () {
    if (!this.isReady()) { return this.whenReady().then(() => this.update()); }

    let deferred = promise.deferred();
    this._readyPromise = deferred.promise;

    this.packageBaseDirs = this.packageBaseDirs.map(ea => ea.asDirectory());
    this.individualPackageDirs = this.individualPackageDirs.map(ea => ea.asDirectory());
    this.devPackageDirs = this.devPackageDirs.map(ea => ea.asDirectory());

    let discovered = {};

    try {
      for (let dir of this.packageBaseDirs) {
        for (let dirWithVersions of await dir.dirList(1)) {
          for (let subDir of (await dirWithVersions.dirList(1)).filter(ea => ea.isDirectory())) { discovered = await this._discoverPackagesIn(subDir, discovered, 'packageCollectionDirs'); }
        }
      }

      for (let dir of this.individualPackageDirs) { discovered = await this._discoverPackagesIn(dir, discovered, 'individualPackageDirs'); }

      for (let dir of this.devPackageDirs) { discovered = await this._discoverPackagesIn(dir, discovered, 'devPackageDirs'); }

      for (let url in discovered) {
        let { pkg, config, covered } = discovered[url];
        this.System.debug && console.log(`[PackageRegistry] Adding discovered package ${url} (from ${covered})`);
        this._addPackageWithConfig(pkg, config, url + '/', covered);
      }

      this._updateLatestPackages();
      deferred.resolve();
    } catch (err) { deferred.reject(err); } finally {
      this._readyPromise = null;
      this.resetByURL();
      classHolder.ModulePackageMapping.forSystem(this.System).clearCache();
    }

    return this;
  }

  async addPackageAt (url, preferedLocation = 'individualPackageDirs', existingPackageMap) {
    let urlString = url.isResource ? url.url : url;
    if (urlString.endsWith('/')) urlString.slice(0, -1);
    if (this.byURL[urlString]) { throw new Error(`package in ${urlString} already added to registry`); }

    let discovered = await this._discoverPackagesIn(ensureResource(url).asDirectory(), {}, undefined, existingPackageMap);
    for (let discoveredURL in discovered) {
      if (this.byURL[discoveredURL]) continue;
      let { pkg, config } = discovered[discoveredURL];
      let covered = this._addPackageDir(discoveredURL, preferedLocation, true/* uniqCheck */);
      this._addPackageWithConfig(pkg, config, discoveredURL + '/', covered);
    }

    this.resetByURL();
    classHolder.ModulePackageMapping.forSystem(this.System).clearCache();
    this._updateLatestPackages();

    return this.findPackageWithURL(url);
  }

  removePackage (pkg, updateLatestPackage = true) {
    let { url, name, version } = pkg;
    let dir = ensureResource(url);
    let known = this.coversDirectory(dir);
    if (known === 'devPackageDirs') { this.devPackageDirs = this.devPackageDirs.filter(ea => !ea.equals(dir)); } else if (known === 'individualPackageDirs') { this.individualPackageDirs = this.individualPackageDirs.filter(ea => !ea.equals(dir)); }

    let { packageMap } = this;
    if (packageMap[name]) {
      delete packageMap[name].versions[version];
      if (Object.keys(packageMap[name].versions).length === 0) { delete packageMap[name]; }
    }

    this.resetByURL();
    classHolder.ModulePackageMapping.forSystem(this.System).clearCache();
    if (updateLatestPackage) this._updateLatestPackages(pkg.name);
  }

  updateNameAndVersionOf (pkg, oldName, oldVersion, newName, newVersion) {
    let { packageMap } = this;
    if (!packageMap[oldName]) {
      console.warn(`[PackageRegistry>>updateNameAndVersionOf] ${oldName}@${oldVersion} not found in registry (${pkg.url})`);
    } else if (!packageMap[oldName].versions[oldVersion]) {
      console.warn(`[PackageRegistry>>updateNameAndVersionOf] No version entry ${oldVersion} of ${oldName} found in registry (${pkg.url})`);
    }
    this._addToPackageMap(pkg, newName, newVersion);
    if (packageMap[oldName] && packageMap[oldName].versions[oldVersion]) {
      delete packageMap[oldName].versions[oldVersion];
      if (Object.keys(packageMap[oldName].versions).length === 0) { delete packageMap[oldName]; }
    }
    this._updateLatestPackages(pkg.name);
  }
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  _updateLatestPackages (name) {
    let { packageMap } = this;
    if (name && packageMap[name]) {
      packageMap[name].latest = arr.last(sortVersions(
        Object.keys(packageMap[name].versions)));
      return;
    }
    for (let eaName in packageMap) {
      packageMap[eaName].latest = arr.last(sortVersions(
        Object.keys(packageMap[eaName].versions)));
    }
  }

  async _discoverPackagesIn (dir, discovered, covered, existingPackageMap = null) {
    if (!dir.isDirectory()) return discovered;
    let url = dir.asFile().url;
    if (discovered.hasOwnProperty(url)) return discovered;

    try {
      let pkg = (existingPackageMap && existingPackageMap[url]) ||
              new Package(this.System, url);
      let config = await pkg.tryToLoadPackageConfig();
      if (url.includes('local_projects')) {
        const forkInfoFile = resource(url).join('.livelyForkInformation');
        if ((await forkInfoFile.exists())) {
          const forkInfo = JSON.parse((await forkInfoFile.read()));
          config.name = forkInfo.owner + '--' + forkInfo.name;
          config.isFork = true;
        }
      }
      pkg.setConfig(config);
      discovered[url] = { pkg, config, covered };
      if (this.System.debug) {
        let { name, version } = config;
        console.log(`[lively.modules] package ${name}@${version} discovered in ${dir.url}`);
      }
      return discovered;
    } catch (err) { return discovered; }
  }

  _addToPackageMap (pkg, name, version, allowOverride = true) {
    if (!name) throw new Error('Cannot add package without name');
    // if (!version) throw new Error(`Cannot add package without version`);
    if (!version) version = '0.0.0';
    let { packageMap } = this;
    let packageEntry = packageMap[name] ||
          (packageMap[name] = { versions: {}, latest: null });
    let isOverride = packageEntry.versions[version];
    if (isOverride) {
      let msg = `Redefining version ${version} of package ${pkg.url}`;
      if (!allowOverride) throw new Error(msg + ' not allowed');
      // duplicate version entries are expected when bun + flatn both install packages
    }
    packageEntry.versions[version] = pkg;
  }

  _addPackageWithConfig (pkg, config, dir, covered = null) {
    if (!covered) {
      // if (oldLocation === "devPackageDirs") this.devPackageDirs.push(dir);
      this._addPackageDir(dir, 'individualPackageDirs'/* preferedLocation */, true/* uniqCheck */);
    }
    pkg.registerWithConfig(config);
    this._addToPackageMap(pkg, pkg.name, pkg.version);
    return pkg;
  }

  _addPackageDir (dir, preferedLocation = 'individualPackageDirs', uniqCheck = true) {
    dir = ensureResource(dir).asDirectory();

    if (preferedLocation === 'packageCollectionDirs' ||
    preferedLocation === 'maybe packageCollectionDirs') {
      let covers = this.coversDirectory(dir) || '';
      if (covers.includes('packageCollectionDirs')) { return 'packageCollectionDirs'; }
    }
    let prop = preferedLocation;
    let dirs = this[prop].concat(dir);
    this[prop] = uniqCheck ? arr.uniqBy(dirs, (a, b) => a.equals(b)) : dirs;
    return prop;
  }
}
