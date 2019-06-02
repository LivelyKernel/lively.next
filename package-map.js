import fs from "fs";
import path from "path";
import { gitSpecFromVersion } from "./util.js";
import { resource } from "./deps/lively.resources.js";
import semver from "./deps/semver.min.js";

/*

lively.lang.fun.timeToRun(() => {
  let pm = PackageMap.build(["/Users/robert/Lively/lively-dev2/lively.next-node_modules"])
  pm.lookup("lively.morphic")
}, 100);

let dir = System.resource(System.baseURL).join("lively.next-node_modules/")
let pmap = AsyncPackageMap.build([dir]); await pmap.whenReady()

let dir = "/Users/robert/Lively/lively-dev2/lively.next-node_modules/"
let pmap = PackageMap.build([dir]);

let json = pmap.allPackages().reduce((map, spec) => {
  let {name,version} = spec;
  map[name + "@" + version] = spec;
  return map
}, {});


lively.lang.num.humanReadableByteSize(JSON.stringify(json).length)

await fs_dirList(pmap.lookup("react").location)
fs_dirList(pmap.lookup("react").location)

*/

function isAbsolute(path) {
  return path.startsWith("/") || path.match(/^[a-z\.-_\+]+:/i)
}

function ensureResource(x) {
  return x.isResource ? x : resource(x);
}

function parentDir(p) {
  if (p.isResource) return p.parent();
  return path.basename(p);
}

function equalLocation(a, b) {
  if (a.isResource) return a.equals(b);
  return a == b;
}

function join(a, b) {
  if (a.isResource) return a.join(b);
  return path.join(a, b);
}

function normalizePath(p) {
  if (p.isResource) return p.withRelativePartsResolved()
  return path.normalize(p);
}

function fs_isDirectory(location) {
  if (location.isResource) return location.isDirectory();
  return fs.statSync(location).isDirectory();
}

function fs_exists(location) {
  if (location.isResource) return location.exists();
  return fs.existsSync(location);
}

function fs_read(location) {
  if (location.isResource) return location.read();
  return fs.readFileSync(location);
}

function fs_write(location, content) {
  if (location.isResource) return location.write(content);
  return fs.writeFileSync(location, content);
}

function fs_readJson(location) {
  if (location.isResource) return location.exists().then(exists => exists ? location.readJson() : null);
  return fs.existsSync(location) ? JSON.parse(String(fs_read(location))) : null;
}

function fs_writeJson(location, jso) {
  if (location.isResource) return location.writeJson(jso);
  return fs_write(location, JSON.stringify(jso));
}

function fs_dirList(location) {
  if (location.isResource) return location.dirList(1);
  return fs.readdirSync(location).map(ea => join(location, ea));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class PackageMap {

  static empty() { return new this(); }

  static get cache() { return this._cache || (this._cache = {}); }

  static keyFor(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    return `all: ${packageCollectionDirs} ea: ${individualPackageDirs} dev: ${devPackageDirs}`
  }

  static ensure(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    let key = this.keyFor(packageCollectionDirs, individualPackageDirs, devPackageDirs);
    return this.cache[key] || (this.cache[key] = this.build(
      packageCollectionDirs, individualPackageDirs, devPackageDirs));
  }

  static build(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    let map = new this();
    map.buildDependencyMap(
      packageCollectionDirs,
      individualPackageDirs,
      devPackageDirs);
    return map;
  }

  constructor() {
    this.dependencyMap = {};
    this.byPackageNames = {};
    this.key = "";
    this.devPackageDirs = [];
    this.individualPackageDirs = [];
    this.packageCollectionDirs = [];
    this._readyPromise = null;
  }

  whenReady() { return this._readyPromise || Promise.resolve(); }

  isReady() { return !this._readyPromise; }

  withPackagesDo(doFn) {
    let result = [];
    for (let key in this.dependencyMap)
      result.push(doFn(key, this.dependencyMap[key]))
    return result;
  }

  findPackage(matchFn) {
    for (let key in this.dependencyMap) {
      let pkg = this.dependencyMap[key]
      if (matchFn(key, pkg)) return pkg
    }
    return null;
  }

  allPackages() {
    let pkgs = [];
    for (let key in this.dependencyMap)
      pkgs.push(this.dependencyMap[key]);
    return pkgs;
  }

  coversDirectory(dir) {
    let { packageCollectionDirs, devPackageDirs, individualPackageDirs } = this;

    if (individualPackageDirs.some(ea => equalLocation(ea, dir))) return "individualPackageDirs";
    if (devPackageDirs.some(ea => equalLocation(ea, dir))) return "devPackageDirs";
    let parent = parentDir(dir);
    if (packageCollectionDirs.some(ea => equalLocation(ea, parent))) {
      return this.allPackages().find(pkg => equalLocation(pkg.location, parent)) ?
        "packageCollectionDirs" : "maybe packageCollectionDirs";
    }
    return null;
  }

  addPackage(packageSpec, isDev = false) {
    // returns false if package already installed, true otherwise

    let self = this;
    if (typeof packageSpec === "string")
      packageSpec = PackageSpec.fromDir(packageSpec);

    return packageSpec instanceof Promise ?
      packageSpec.then(resolvedPackageSpec => {
        packageSpec = resolvedPackageSpec;
        return isPackageSpecIncluded();
      }) : isPackageSpecIncluded();

    function isPackageSpecIncluded() {
      let { location, name, version } = packageSpec,
        { packageCollectionDirs, devPackageDirs, individualPackageDirs } = self,
        isCovered = self.coversDirectory(location);

      if (["devPackageDirs", "individualPackageDirs", "packageCollectionDirs"].includes(isCovered))
        return false;
      if (isDev) devPackageDirs = devPackageDirs.concat(location);
      else individualPackageDirs = individualPackageDirs.concat(location);

      // FIXME key changes....
      let build = self.buildDependencyMap(
        packageCollectionDirs,
        individualPackageDirs,
        devPackageDirs);
      return build instanceof Promise ? build.then(() => true) : true;
    }
  }

  buildDependencyMap(packageCollectionDirs, individualPackageDirs = [], devPackageDirs = []) {
    // looks up all the packages in can find in packageDirs and creates
    // packageSpecs for them.  If a package specifies more flatn_package_dirs in its
    // config then repeat the process until no more new package dirs are found.
    // Finally, combine all the packages found into a single map, like
    // {package-name@version: packageSpec, ...}.
    //
    // Merging of the results of the different package dirs happens so that dirs
    // specified first take precedence. I.e. if a dependency foo@1 is found via
    // packageDirs and then another package specifies a dir that leads to the
    // discovery of another foo@1, the first one ends up in tha packageDir

    let key = this.constructor.keyFor(
      packageCollectionDirs,
      individualPackageDirs,
      devPackageDirs
    );

    let pkgMap = {},
      byPackageNames = {},
      seen = { packageDirs: {}, collectionDirs: {} };

    // 1. find all the packages in collection dirs and separate package dirs;
    for (let p of this._discoverPackagesInCollectionDirs(packageCollectionDirs, seen)) {
      let { name, version } = p;
      pkgMap[`${name}@${version}`] = p;
      (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
    }

    for (let dir of individualPackageDirs)
      for (let p of this._discoverPackagesInPackageDir(dir, seen)) {
        let { name, version } = p;
        pkgMap[`${name}@${version}`] = p;
        (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
      }

    // 2. read dev packages, those shadow all normal dependencies with the same package name;

    for (let dir of devPackageDirs)
      for (let p of this._discoverPackagesInPackageDir(dir, seen)) {
        let { name, version } = p;
        pkgMap[`${name}`] = p;
        p.isDevPackage = true;
        let versionsOfPackage = byPackageNames[name] || (byPackageNames[name] = []);
        if (versionsOfPackage) for (let key of versionsOfPackage) delete pkgMap[key];
        versionsOfPackage.push(name);
      }

    this.dependencyMap = pkgMap;
    this.byPackageNames = byPackageNames;
    this.packageCollectionDirs = packageCollectionDirs;
    this.individualPackageDirs = individualPackageDirs;
    this.devPackageDirs = devPackageDirs;
    this.key = key;

    return this;
  }


  lookup(name, versionRange) {
    // Query the package map if it has a package name@version
    // Compatibility is either a semver match or if package comes from a git
    // repo then if the git commit matches.  Additionally dev packages are
    // supported.  If a dev package with `name` is found it always matches

    let gitSpec = gitSpecFromVersion(versionRange || "");
    if (!gitSpec && versionRange) {
      try {
        // parse stuff like "3001.0001.0000-dev-harmony-fb" into "3001.1.0-dev-harmony-fb"
        versionRange = new semver.Range(versionRange, true).toString();
      } catch (err) { }
    }
    return this.findPackage((key, pkg) => pkg.matches(name, versionRange, gitSpec));
  }

  _discoverPackagesInCollectionDirs(
    packageCollectionDirs,
    seen = { packageDirs: {}, collectionDirs: {} }
  ) {
    // package collection dir structure is like
    // packages
    // |-package-1
    // | |-0.1.0
    // | | \-package.json
    // | \-0.1.1
    // |   \-package.json
    // |-package-2
    // ...

    let found = [];
    for (let dir of packageCollectionDirs) {
      if (!fs_exists(dir)) continue;
      for (let packageDir of fs_dirList(dir)) {
        if (!fs_isDirectory(packageDir)) continue;
        for (let versionDir of fs_dirList(packageDir))
          found.push(...this._discoverPackagesInPackageDir(versionDir, seen));
      }
    }
    return found;
  }

  _discoverPackagesInPackageDir(
    packageDir,
    seen = { packageDirs: {}, collectionDirs: {} }
  ) {
    let spec = fs_exists(packageDir) && PackageSpec.fromDir(packageDir);
    if (!spec) return [];

    let found = [spec],
      { location, flatn_package_dirs } = spec;

    if (flatn_package_dirs) {
      for (let dir of flatn_package_dirs) {
        if (!isAbsolute(dir)) dir = normalizePath(join(location, dir));
        if (seen.collectionDirs[dir]) continue;
        console.log(`[flatn] project ${location} specifies package dir ${dir}`);
        seen.collectionDirs[dir] = true;
        found.push(...this._discoverPackagesInCollectionDirs([dir], seen));
      }
    }

    return found;
  }

}



class AsyncPackageMap extends PackageMap {

  whenReady() { return this._readyPromise || Promise.resolve(); }

  isReady() { return !this._readyPromise; }

  async buildDependencyMap(
    packageCollectionDirs,
    individualPackageDirs = [],
    devPackageDirs = []
  ) {
    // looks up all the packages in can find in packageDirs and creates
    // packageSpecs for them.  If a package specifies more flatn_package_dirs in its
    // config then repeat the process until no more new package dirs are found.
    // Finally, combine all the packages found into a single map, like
    // {package-name@version: packageSpec, ...}.
    //
    // Merging of the results of the different package dirs happens so that dirs
    // specified first take precedence. I.e. if a dependency foo@1 is found via
    // packageDirs and then another package specifies a dir that leads to the
    // discovery of another foo@1, the first one ends up in tha packageDir

    if (!this.isReady()) {
      return this.whenReady().then(() =>
        this.buildDependencyMap(
          packageCollectionDirs,
          individualPackageDirs,
          devPackageDirs));
    }

    let resolve, reject;
    this._readyPromise = new Promise((_resolve, _reject) => {
      resolve = _resolve; reject = _reject;
    });

    try {

      let key = this.constructor.keyFor(
        packageCollectionDirs,
        individualPackageDirs,
        devPackageDirs
      );

      let pkgMap = {},
        byPackageNames = {},
        seen = { packageDirs: {}, collectionDirs: {} };

      // 1. find all the packages in collection dirs and separate package dirs;
      for (let p of await this._discoverPackagesInCollectionDirs(packageCollectionDirs, seen)) {
        let { name, version } = p;
        pkgMap[`${name}@${version}`] = p;
        (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
      }

      for (let dir of individualPackageDirs)
        for (let p of await this._discoverPackagesInPackageDir(dir, seen)) {
          let { name, version } = p;
          pkgMap[`${name}@${version}`] = p;
          (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
        }

      // 2. read dev packages, those shadow all normal dependencies with the same package name;

      for (let dir of devPackageDirs)
        for (let p of await this._discoverPackagesInPackageDir(dir, seen)) {
          let { name, version } = p;
          pkgMap[`${name}`] = p;
          p.isDevPackage = true;
          let versionsOfPackage = byPackageNames[name] || (byPackageNames[name] = []);
          if (versionsOfPackage) for (let key of versionsOfPackage) delete pkgMap[key];
          versionsOfPackage.push(name);
        }

      this.dependencyMap = pkgMap;
      this.byPackageNames = byPackageNames;
      this.packageCollectionDirs = packageCollectionDirs;
      this.individualPackageDirs = individualPackageDirs;
      this.devPackageDirs = devPackageDirs;
      this.key = key;

      resolve();
    }
    catch (err) { reject(err); }
    finally { this._readyPromise = null; }

    return this;
  }

  async _discoverPackagesInCollectionDirs(
    packageCollectionDirs,
    seen = { packageDirs: {}, collectionDirs: {} }
  ) {
    let found = [];
    for (let dir of packageCollectionDirs) {
      if (!await dir.exists()) continue;
      for (let packageDir of await dir.dirList()) {
        if (!packageDir.isDirectory()) continue;
        for (let versionDir of await packageDir.dirList())
          found.push(...await this._discoverPackagesInPackageDir(versionDir, seen));
      }
    }
    return found;
  }

  async _discoverPackagesInPackageDir(
    packageDir,
    seen = { packageDirs: {}, collectionDirs: {} }
  ) {
    let spec = await packageDir.exists() && await PackageSpec.fromDir(packageDir);
    if (!spec) return [];
    let found = [spec],
      { location, flatn_package_dirs } = spec;

    location = ensureResource(location);

    if (flatn_package_dirs) {
      for (let dir of flatn_package_dirs) {
        if (isAbsolute(dir)) dir = ensureResource(dir);
        else dir = join(location, dir).withRelativePartsResolved();
        if (seen.collectionDirs[dir.url]) continue;
        console.log(`[flatn] project ${location.url} specifies package dir ${dir.url}`);
        seen.collectionDirs[dir.url] = true;
        found.push(...await this._discoverPackagesInCollectionDirs([dir], seen));
      }
    }

    return found;
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// PackageSpec => package representation for dependency resolution and build


const lvInfoFileName = ".lv-npm-helper-info.json";

class PackageSpec {

  static fromDir(packageDir) {
    let spec = new this(packageDir),
      read = spec.read();
    return read instanceof Promise
      ? read.then(read => (read ? spec : null))
      : read ? spec : null;
  }

  constructor(location) {
    this.location = location;
    this.isDevPackage = false;

    // from config
    this.scripts = null;
    this.bin = null;
    this.flatn_package_dirs = null;
    this.name = "";
    this.version = "";
    this.dependencies = {};
    this.devDependencies = {};

    // from git spec
    this.branch = null;
    this.gitURL = null;
    this.versionInFileName = null; // @https___github.com_foo_bar#zork
  }

  matches(pName, versionRange, gitSpec) {
    // does this package spec match the package pName@versionRange?
    let { name, version, isDevPackage } = this;

    if (name !== pName) return false;

    if (!versionRange || isDevPackage) return true;

    if (gitSpec && (gitSpec.versionInFileName === version
      || this.versionInFileName === gitSpec.versionInFileName)) {
      return true
    }

    if (semver.parse(version || "", true) && semver.satisfies(version, versionRange, true))
      return true;

    return false;
  }

  read() {
    let self = this,
      packageDir = this.location,
      configFile = join(packageDir, "package.json");

    if (!fs_isDirectory(packageDir)) return false;

    let hasConfig = fs_exists(configFile);

    return hasConfig instanceof Promise ? hasConfig.then(step2) : step2(hasConfig);

    function step2(hasConfig) {
      if (!hasConfig) return false;
      let config = fs_readJson(configFile);
      return config instanceof Promise ? config.then(step3) : step3(config);
    }

    function step3(config) {
      let {
        name, version, bin, scripts,
        dependencies, devDependencies,
        flatn_package_dirs
      } = config;

      if (bin) {
        // npm allows bin to just be a string, it is then mapped to the package name
        bin = typeof bin === "string" ? { [name]: bin } : Object.assign({}, bin);
      }

      Object.assign(self, {
        location: packageDir,
        name, version, bin, scripts,
        dependencies, devDependencies,
        flatn_package_dirs
      });

      let info = self.readLvInfo();
      return info instanceof Promise ? info.then(step4) : step4(info);
    }

    function step4(info) {
      if (info) {
        let { branch, gitURL, versionInFileName } = info;
        Object.assign(self, { branch, gitURL, versionInFileName });
      }
      return true;
    }
  }

  readConfig() {
    const config = fs_readJson(join(this.location, "package.json"));
    return config instanceof Promise ?
      config.then(ensureConfig) : ensureConfig(config);
    function ensureConfig(config) {
      if (config) return config;
      const { name, version } = this;
      return { name, version };
    }
  }

  readLvInfo() {
    let infoF = join(this.location, lvInfoFileName);
    try {
      let read = fs_readJson(infoF);
      return read instanceof Promise ?
        read.catch(err => null) : read;
    } catch (err) { }
    return null;
  }

  writeLvInfo(spec) {
    return fs_writeJson(join(this.location, lvInfoFileName), spec);
  }

  changeLvInfo(changeFn) {
    let read = this.readLvInfo();
    return read instanceof Promise ?
      read.then(read => this.writeLvInfo(changeFn(read))) :
      this.writeLvInfo(changeFn(read));
  }

}


export {
  PackageMap,
  AsyncPackageMap,
  PackageSpec
}
