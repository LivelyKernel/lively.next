import { PackageSpec } from "./package-spec.js";
import { basename, isAbsolute, normalize as normPath, join as j } from "path";
import fs from "fs";
import { gitSpecFromVersion } from "./util.js";

/*
lively.lang.fun.timeToRun(() => {
  let pm = PackageMap.build(["/Users/robert/Lively/lively-dev2/lively.next-node_modules"])
  pm.lookup("lively.morphic")
}, 100);
*/

class PackageMap {

  static empty() { return new this(); }

  static cache() { return this._cache || (this._cache = {}); }

  static keyFor(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    return `all: ${packageCollectionDirs} ea: ${individualPackageDirs} dev: ${devPackageDirs}`
  }

  static ensure(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    let key = this.keyFor(packageCollectionDirs, individualPackageDirs, devPackageDirs);
    return this.cache[key] || (this.cache[key] = this.build(
                                 packageCollectionDirs, individualPackageDirs, devPackageDirs));
  }

  static build(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    return new this().buildDependencyMap(
      packageCollectionDirs,
      individualPackageDirs,
      devPackageDirs);
  }

  constructor() {
    this.dependencyMap = {};
    this.byPackageNames = {};
    this.key = "";
    this.devPackageDirs = [];
    this.individualPackageDirs = [];
    this.packageCollectionDirs = [];
  }

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
    let {packageCollectionDirs, devPackageDirs, individualPackageDirs} = this;
    if (individualPackageDirs.includes(dir) || devPackageDirs.includes(dir))
      return true
    if (packageCollectionDirs.includes(basename(dir)))
      return true;
    return false;
  }

  addPackage(packageSpec, isDev = false) {
    // returns false if package already installed, true otherwise

    if (typeof packageSpec === "string")
      packageSpec = PackageSpec.fromDir(packageSpec);

    let {location, name, version} = packageSpec,
        {packageCollectionDirs, devPackageDirs, individualPackageDirs} = this;

    if (individualPackageDirs.includes(location) || devPackageDirs.includes(location)) {
      return false;
    } else if (packageCollectionDirs.includes(basename(location))) {
      if (this.allPackages().find(pkg => pkg.location === location))
        return false;
    } else {
      if (isDev) devPackageDirs = devPackageDirs.concat(location);
      else individualPackageDirs = individualPackageDirs.concat(location);
    }

    // FIXME key changes....
    this.buildDependencyMap(packageCollectionDirs, individualPackageDirs, devPackageDirs);
    return true;
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
        seen = {packageDirs: {}, collectionDirs: {}};

    // 1. find all the packages in collection dirs and separate package dirs;
    for (let p of this._discoverPackagesInCollectionDirs(packageCollectionDirs, seen)) {
      let {name, version} = p;
      pkgMap[`${name}@${version}`] = p;
      (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
    }

    for (let dir of individualPackageDirs)
      for (let p of this._discoverPackagesInPackageDir(dir, seen)) {
        let {name, version} = p;
        pkgMap[`${name}@${version}`] = p;
        (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
      }

    // 2. read dev packages, those shadow all normal dependencies with the same package name;

    for (let dir of devPackageDirs)
      for (let p of this._discoverPackagesInPackageDir(dir, seen)) {
        let {name, version} = p;
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
    return this.findPackage((key, pkg) => pkg.matches(name, versionRange, gitSpec));
  }
  
  _discoverPackagesInCollectionDirs(
    packageCollectionDirs,
    seen = {packageDirs: {}, collectionDirs: {}}
  ) {
    let found = [];
    for (let dir of packageCollectionDirs)
      if (fs.existsSync(dir))
        for (let packageDir of fs.readdirSync(dir))
          found.push(...this._discoverPackagesInPackageDir(j(dir, packageDir), seen));
    return found
  }
  
  _discoverPackagesInPackageDir(
    packageDir,
    seen = {packageDirs: {}, collectionDirs: {}}
  ) {
    let spec = fs.existsSync(packageDir) && PackageSpec.fromDir(packageDir);
    if (!spec) return [];
  
    let found = [spec],
        {location, config: {flatn_package_dirs}} = spec;
  
    if (flatn_package_dirs) {
      for (let dir of flatn_package_dirs) {
        if (!isAbsolute(dir)) dir = normPath(j(location, dir));
        if (seen.collectionDirs[dir]) continue;
        console.log(`[flatn] project ${location} specifies package dir ${dir}`);
        seen.collectionDirs[dir] = true;
        found.push(...this._discoverPackagesInCollectionDirs([dir], seen));
      }
    }
  
    return found;
  }

}


export {
  PackageMap
}
