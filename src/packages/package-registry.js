import { semver } from "../../index.js";
import { arr, obj, promise } from "lively.lang";
import { getPackage } from "../packages.js";
import { resource } from "lively.resources";
import { isURL } from "../url-helpers.js";

const urlStartRe = /^[a-z\.-_\+]+:/i
function isAbsolute(path) {
  return (
    path.startsWith("/") ||
    path.startsWith("http:") ||
    path.startsWith("https:") ||
    path.startsWith("file:") ||
    path.match(urlStartRe));
}

function ensureResource(path) {
  return path.isResource ? path : resource(path);
}

export class PackageRegistry {

  static ofSystem(System) {
    let registry = System.get("@lively-env").packageRegistry;
    if (!registry) {
      registry = System["__lively.modules__packageRegistry"] = new this(System);
    }
    return registry;
  }

  static forDirectory(System, dir) {
    return new this(System, {packageBaseDirs: [ensureResource(dir)]});
  }

  static fromJSON(System, jso) {
    return new this(System).fromJSON(jso);
  }

  constructor(System, opts = {}) {
    this.System = System;
    this.packageBaseDirs = opts.packageBaseDirs || [];
    this.devPackageDirs = opts.devPackageDirs || [];
    this.individualPackageDirs = opts.individualPackageDirs || [];
    this._readyPromise = null;
    this.packageMap = {};
  }

  toJSON() {
    let {
          System,
          packageMap,
          individualPackageDirs,
          devPackageDirs,
          packageBaseDirs
        } = this,
        packageMapJso = {};

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
      individualPackageDirs: individualPackageDirs.map(serializeURL),
      devPackageDirs: devPackageDirs.map(serializeURL),
      packageBaseDirs: packageBaseDirs.map(serializeURL)
    }

    function serializeURL({url}) {
      return !url.startsWith(System.baseURL) ? url :
        url.slice(System.baseURL.length).replace(/^\//, "");
    }
  }

  fromJSON(jso) {
    let packageMap = {}, {System} = this, base = resource(System.baseURL);
    for (let pName in jso.packageMap) {
      let spec = jso.packageMap[pName];
      packageMap[pName] = {};
      packageMap[pName].latest = spec.latest;
      packageMap[pName].versions = {};
      for (let version in spec.versions) {
        let pkgSpec = spec.versions[version],
            url = pkgSpec.url;
        if (!isAbsolute(url)) url = base.join(url).url;
        let pkg = getPackage(System, url);
        pkg.fromJSON(pkgSpec);
        packageMap[pName].versions[version] = pkg;
      }
    }

    this.packageMap = packageMap;
    this.individualPackageDirs = jso.individualPackageDirs.map(deserializeURL);
    this.devPackageDirs = jso.devPackageDirs.map(deserializeURL);
    this.packageBaseDirs = jso.packageBaseDirs.map(deserializeURL);
    return this;
    
    function deserializeURL(url) {
      return isURL(url) ? resource(url) :
        resource(System.baseURL).join(url);
    }
  }

  whenReady() { return this._readyPromise || Promise.resolve(); }

  isReady() { return !this._readyPromise; }

  withPackagesDo(doFn) {
    for (let pName in this.packageMap) {
      let versions = this.packageMap[pName].versions;
      for (let versionName in versions)
        doFn(versions[versionName])
    }
  }

  findPackage(matchFn) {
    for (let pName in this.packageMap) {
      let versions = this.packageMap[pName].versions;
      for (let versionName in versions) {
        let pkg = versions[versionName]
        if (matchFn(pkg)) return pkg;
      }
    }
    return null;
  }

  filterPackages(matchFn) {
    let result = [];
    this.withPackagesDo((pkg) =>
      matchFn(pkg) && result.push(pkg));
    return result
  }

  allPackages() {
    let result = [];
    for (let pName in this.packageMap) {
      let versions = this.packageMap[pName].versions;
      for (let versionName in versions)
        result.push(versions[versionName]);
    }
    return result;
  }

  sortPackagesByVersion(pkgs) {
    return pkgs.sort((a, b) => semver.compare(a.version, b.version, true));
  }

  matches(pkg, pName, versionRange) {
    // does this package match the package pName@versionRange?

    let {name, version} = pkg;

    if (name !== pName) return false;

    if (!versionRange) return true;

    // if (gitSpec && (gitSpec.versionInFileName === version
    //   || this.versionInFileName === gitSpec.versionInFileName)) {
    //    return true
    // }

    if (semver.parse(version || "") && semver.satisfies(version, versionRange, true))
      return true;

    return false;
  }

  coversDirectory(dir) {
    let {packageBaseDirs, devPackageDirs, individualPackageDirs} = this;

    if (individualPackageDirs.some(ea => ea.equals(dir))) return "individualPackageDirs";
    if (devPackageDirs.some(ea => ea.equals(dir))) return "devPackageDirs";
    let parent = dir.parent();
    if (packageBaseDirs.some(ea => ea.equals(parent))) {
      return this.allPackages().find(pkg =>
        ensureResource(pkg.url).equals(dir)) ?
          "packageCollectionDirs" : "maybe packageCollectionDirs";
    }
    return null;
  }

  lookup(pkgName, versionRange) {
    // Query the package map if it has a package name@version
    // Compatibility is either a semver match or if package comes from a git
    // repo then if the git commit matches.  Additionally dev packages are
    // supported.  If a dev package with `name` is found it always matches

    // let gitSpec = gitSpecFromVersion(versionRange || "");
    // return this.findPackage((key, pkg) => pkg.matches(name, versionRange, gitSpec));
    // let gitSpec = gitSpecFromVersion(versionRange || "");
    let pkgData = this.packageMap[pkgName];
    if (!pkgData) return null;
    if (!versionRange || versionRange === "latest")
      return pkgData.versions[pkgData.latest];
    if (!semver.parse(versionRange))
      throw new Error(`PackageRegistry>>lookup of ${pkgName}: Invalid version - ${versionRange}`);
    let pkgs = obj.values(pkgData.versions).filter(pkg =>
      this.matches(pkg, pkgName, versionRange));
    if (pkgs.length <= 1) return pkgs[0];
    return arr.last(this.sortPackagesByVersion(pkgs));
  }

  findPackageDependency(basePkg, name, version) {
    // name@version is dependency of basePkg
    if (!version) version = basePkg.dependencies[name] || basePkg.devDependencies[name];
    if (!semver.parse(version)) version = null;
    return this.lookup(name, version);
  }

  findPackageWithURL(url) {
    // url === pkg.url
    if (!url.endsWith("/")) url = url.replace(/\/+$/, "");
    return this.findPackage(ea => ea.url === url);
  }

  findPackageHavingURL(url) {
    // does url identify a resource inside pkg, maybe pkg.url === url?
    let penaltySoFar = Infinity, found = null;
    this.withPackagesDo(pkg => {
      let pkgURL = pkg.url; if (pkgURL.endsWith("/")) pkgURL.slice(0, -1);
      if (url.indexOf(pkg.url) !== 0) return;
      let penalty = url.slice(pkgURL.length).length;
      if (penalty >= penaltySoFar) return;
      penaltySoFar = penalty;
      found = pkg;
    });
    return found;
  }

  findPackageForPath(pathRequest, optParentPkg) {
    if (isAbsolute(pathRequest))
      return this.findPackageHavingURL(pathRequest);

    if (pathRequest.startsWith(".")) return null; // relative

    // ry to figure out package name and maybe version
    let [pkgName] = pathRequest.split("/");
    if (!pkgName) return null;
    let atIndex = pkgName.indexOf("@"), version;
    if (atIndex > -1) {
      version = pkgName.slice(atIndex+1);
      pkgName = pkgName.slice(0, atIndex);
    }
    if (!version && optParentPkg)
      return this.findPackageDependency(optParentPkg, pkgName)

    return this.lookup(pkgName, version)
  }

  resolvePath(path, parentIdOrPkg) {
    // takes a path like foo/index.js or ./foo/index.js and an optional
    // parentId or package like http://org/baz.js and tries to resolve the path

    if (isAbsolute(path)) return path;

    let parentPackage = (parentIdOrPkg && parentIdOrPkg.isPackage) || null;

    if (!parentPackage && parentIdOrPkg) {
      if (path.startsWith(".")) {
        let res = resource(parentIdOrPkg);
        if (!res.isDirectory()) res = res.parent();
        return res.join(path).withRelativePartsResolved().url;
      }
      parentPackage = this.findPackageHavingURL(parentIdOrPkg);
    }

    let p = this.findPackageForPath(path, parentPackage);
    if (!p) return null;

    let slashIndex = path.indexOf("/"),
        pathInPackage = slashIndex === -1 || slashIndex === path.length-1 ?
          "" : path.slice(slashIndex);

    return pathInPackage ? resource(p.url).join(pathInPackage).url : p.url;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // reading stuff in
  async update() {

    if (!this.isReady())
      return this.whenReady().then(() => this.update());

    let {System, packageMap} = this,
        deferred = promise.deferred();
    this._readyPromise = deferred.promise;

    this.packageBaseDirs = this.packageBaseDirs.map(ea => ea.asDirectory());
    this.individualPackageDirs = this.individualPackageDirs.map(ea => ea.asDirectory());
    this.devPackageDirs = this.devPackageDirs.map(ea => ea.asDirectory());

    try {

      for (let dir of this.packageBaseDirs)
        for (let dirWithVersions of await dir.dirList(1))
          for (let subDir of (await dirWithVersions.dirList(1)).filter(ea => ea.isDirectory()))
            await this._internalAddPackageDir(subDir, false);

      for (let dir of this.individualPackageDirs)
        await this._internalAddPackageDir(dir, false);


      for (let dir of this.devPackageDirs)
        await this._internalAddPackageDir(dir, false);

      this._updateLatestPackages();
      this._readyPromise = null;
      deferred.resolve();


    } catch (err) { this._readyPromise = null; deferred.reject(err); }

    return this;
  }

  async updatePackageFromPackageJson(pkg, updateLatestPackage = true) {
    // for name or version changes
    return this.updatePackageFromConfig(
      pkg,
      await ensureResource(pkg.url).join("package.json").readJson(),
      updateLatestPackage);
  }

  updatePackageFromConfig(pkg, config, updateLatestPackage = true) {
    // for name or version changes
    let {url: oldURL, name: oldName, version: oldVersion} = pkg,
        {name, version, dependencies, devDependencies, main, systemjs} = config;
    pkg.name = name;
    pkg.version = version;
    pkg.dependencies = dependencies || {};
    pkg.devDependencies = devDependencies || {};
    pkg.main = systemjs && systemjs.main || main || "index.js";
    pkg.systemjs = systemjs;
    return this.updatePackage(pkg, oldName, oldVersion, oldURL, updateLatestPackage)
  }

  updatePackage(pkg, oldName, oldVersion, oldURL, updateLatestPackage = true) {
    // for name or version changes

    if (
      (oldName    && pkg.name === oldName) ||
      (oldVersion && pkg.version !== oldVersion) ||
      (oldURL     && pkg.url !== oldURL)
    ) {
      this.removePackage({name: oldName, version: oldVersion, url: oldURL}, false);
    }

    let dir = ensureResource(pkg.url),
        known = this.coversDirectory(ensureResource(pkg.url));
    if (!known) this.individualPackageDirs.push(dir)

    let {name, version} = pkg,
        {packageMap} = this,
        packageEntry = packageMap[name] ||
          (packageMap[name] = {versions: {}, latest: null});
    packageEntry.versions[version] = pkg;

    if (updateLatestPackage) this._updateLatestPackages(pkg.name);
  }

  addPackageDir(dir, isDev = false) {
    dir = ensureResource(dir).asDirectory();
    let known = this.coversDirectory(dir);
    if (known && known !== "maybe packageCollectionDirs")
      return this.findPackageWithURL(dir);

    let prop = isDev ? "devPackageDirs" : "individualPackageDirs"
    this[prop] = arr.uniqBy(this[prop].concat(dir), (a,b) => a.equals(b));
    return this._internalAddPackageDir(dir, true);
  }

  removePackage(pkg, updateLatestPackage = true) {
    let {url, name, version} = pkg,
        dir = ensureResource(url),
        known = this.coversDirectory(dir);
    if (known === "devPackageDirs")
      this.devPackageDirs = this.devPackageDirs.filter(ea => !ea.equals(dir));
    else if (known === "individualPackageDirs")
      this.individualPackageDirs = this.individualPackageDirs.filter(ea => !ea.equals(dir));

    let {packageMap} = this;
    if (packageMap[name]) {
      delete packageMap[name].versions[version];
      if (Object.keys(packageMap[name].versions).length === 0)
        delete packageMap[name];
    }

    if (updateLatestPackage) this._updateLatestPackages(pkg.name);
  }

  async _internalAddPackageDir(dir, updateLatestPackage = false) {
    if (!dir.isDirectory()) return null;
    let {System, packageMap} = this;
    try {
      let config = await dir.join("package.json").readJson(),
          {name, version} = config,
          pkg = getPackage(System, dir.url);
      System.debug && console.log(`[lively.modules] package registry ${name}@${version} in ${dir.url}`);
      this.updatePackageFromConfig(pkg, config, updateLatestPackage);
      pkg.register2(config);
      return pkg;
    } catch (err) { return null; }
  }

  _updateLatestPackages(name) {
    let {packageMap} = this;
    if (name && packageMap[name]) {
      packageMap[name].latest = arr.last(semver.sort(
        Object.keys(packageMap[name].versions), true));
      return;
    }
    for (let eaName in packageMap)
      packageMap[eaName].latest = arr.last(semver.sort(
        Object.keys(packageMap[eaName].versions), true));
  }
}
