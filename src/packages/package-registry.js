import { semver } from "lively.modules";
import { arr, obj, promise } from "lively.lang";
import { Package } from "../packages.js";
import { resource } from "lively.resources";

const urlStartRe = /^[a-z\.-_\+]+:/i
function isAbsolute(path) {
  return (
    path.startsWith("/") ||
    path.startsWith("http:") ||
    path.startsWith("https:") ||
    path.startsWith("file:") ||
    path.match(urlStartRe));
}

function ensureresource(path) {
  return path.isResource ? path : resource(path);
}

export class PackageRegistry {

  static forDirectory(System, dir) {
    return new this(System, {packageBaseDirs: [ensureresource(dir)]});
  }

  constructor(System, opts = {}) {
    this.System = System;
    this.packageBaseDirs = opts.packageBaseDirs;
    this._readyPromise = null;
    this.packageMap = {};
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
    let pkgs = obj.values(pkgData.versions).filter(pkg =>
      this.matches(pkg, pkgName, versionRange));
    if (pkgs.length <= 1) return pkgs[0];
    return arr.last(this.sortPackagesByVersion(pkgs));
  }

  findPackageDependency(basePkg, name, version) {
    // name@version is dependency of basePkg
    if (!version) version = basePkg.dependencies[name] || basePkg.devDependencies[name];
    return this.lookup(name, version);
  }

  findPackageWithURL(url) {
    // url === pkg.url
    if (!url.endsWith("/")) url += "/";
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

    try {

      for (let dir of this.packageBaseDirs) {
        let subdDirs = await dir.dirList(1)
        for (let subDir of subdDirs) {
          if (!subDir.isDirectory()) continue;
          try {
            let config = await subDir.join("package.json").readJson(),
                {name, version, dependencies, devDependencies} = config,
                packageEntry =
                  packageMap[name] ||
                  (packageMap[name] = {versions: {}, latest: null});
            packageEntry.versions[version] = new Package(
              System, subDir.url, name, version, config);
          } catch (err) {}
        }
      }

      for (let pName in packageMap) {
        let packageEntry = packageMap[pName];
        // packageEntry.latest = arr.last(this.sortPackagesByVersion(
        //                         obj.values(packageEntry.versions)));
        packageEntry.latest = arr.last(semver.sort(Object.keys(packageEntry.versions), true));
      }

      this._readyPromise = null;
      deferred.resolve();

    } catch (err) { this._readyPromise = null; deferred.reject(err); }

    return this;
  }
}
