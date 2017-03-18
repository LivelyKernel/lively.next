import { arr, obj } from "lively.lang";
import { isURL } from "../url-helpers.js";
import { normalizeInsidePackage, findPackageNamed } from "./internal.js";
import { install as installHook, isInstalled as isHookInstalled } from "../hooks.js";

export default class PackageConfiguration {

  constructor(pkg) {
    this.pkg = pkg;
  }

  get System() { return this.pkg.System; }
  get packageURL() { return this.pkg.url; }

  applyConfig(config) {
    // takes a config json object (typically read from a package.json file but
    // can be used standalone) and changes the System configuration to what it finds
    // in it.
    // In particular uses the "systemjs" section as described in https://github.com/systemjs/systemjs/blob/master/docs/config-api.md
    // and uses the "lively" section as described in `applyLivelyConfig`

    let {System, packageURL, pkg} = this;
    config = obj.deepMerge(pkg.config, config);

    let name                      = config.name || packageURL.split("/").slice(-1)[0],
        version                   = config.version,
        sysConfig                 = config.systemjs || {},
        livelyConfig              = config.lively,
        main                      = config.main || "index.js";

    System.config({
      map: {[name]: packageURL},
      packages: {[packageURL]: sysConfig}
    });

    let packageInSystem = System.getConfig().packages[packageURL] || {};
    if (!packageInSystem.map) packageInSystem.map = {};

    if (sysConfig) {
      if (livelyConfig && livelyConfig.main) main = livelyConfig.main;
      else if (sysConfig.main) main = sysConfig.main;
      this.applySystemJSConfig(sysConfig);
    }

    packageInSystem.referencedAs = packageInSystem.referencedAs || [];
    arr.pushIfNotIncluded(packageInSystem.referencedAs, name);

    if (!main.match(/\.[^\/\.]+/)) main += ".js";
    packageInSystem.main = main;

    // System.packages doesn't allow us to store our own properties
    pkg.version = version;
    pkg.config = config;
    pkg.mergeWithConfig(packageInSystem);

    return livelyConfig ? this.applyLivelyConfig(livelyConfig) : {subPackages: []};
  }

  applySystemJSConfig(sysConfig) {
    let {System} = this;
    // System.debug && console.log("[lively.modules package configuration] applying SystemJS config of %s", pkg);
    if (sysConfig.packageConfigPaths)
      System.packageConfigPaths = arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths));
    if (sysConfig.packages) // packages is normaly not support locally in a package.json
      System.config({packages: sysConfig.packages})
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively config
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  applyLivelyConfig(livelyConfig) {
    // configures System object from lively config JSON object.
    // - adds System.package entry for package
    // - adds name to System.package[pkg.url].referencedAs
    // - installs hook from {hooks: [{name, source}]}
    // - merges livelyConfig.packageMap into System.package[pkg.url].map
    //   entries in packageMap are specifically meant to be sub-packages!
    // Will return a {subPackages: [packageURL,...]} object

    this.applyLivelyConfigMeta(livelyConfig);
    this.applyLivelyConfigHooks(livelyConfig);
    this.applyLivelyConfigBundles(livelyConfig);
    return this.applyLivelyConfigPackageMap(livelyConfig);
  }

  applyLivelyConfigHooks(livelyConfig) {
    (livelyConfig.hooks || []).forEach(h => {
      try {
        var f = eval("(" + h.source + ")");
        if (!f.name || !isHookInstalled(this.System, h.target, f.name))
          installHook(this.System, h.target, f);
      } catch (e) {
        console.error("Error installing hook for %s: %s", this.packageURL, e, h);
      }
    });
  }

  applyLivelyConfigBundles(livelyConfig) {
    if (!livelyConfig.bundles) return Promise.resolve();
    var normalized = Object.keys(livelyConfig.bundles).reduce((bundles, name) => {
      var absName = this.packageURL + "/" + name,
          files = livelyConfig.bundles[name].map(f => this.System.decanonicalize(f, this.packageURL + "/"));
      bundles[absName] = files;
      return bundles;
    }, {});
    this.System.config({bundles: normalized});
    return Promise.resolve();
  }

  applyLivelyConfigMeta(livelyConfig) {
    if (!livelyConfig.meta) return;
    var pConf = this.System.getConfig().packages[this.packageURL] || {},
        c = {meta: {}, packages: {[this.packageURL]: pConf}};
    Object.keys(livelyConfig.meta).forEach(key => {
      var val = livelyConfig.meta[key];
      if (isURL(key)) {
        c.meta[key] = val;
      } else {
        if (!pConf.meta) pConf.meta = {};
        pConf.meta[key] = val;
      }
    });
    this.System.config(c);
  }

  applyLivelyConfigPackageMap(livelyConfig) {
    var subPackages = livelyConfig.packageMap ?
      Object.keys(livelyConfig.packageMap).map(name =>
        this.subpackageURLs(livelyConfig, name)) : [];
    return {subPackages};
  }

  subpackageURLs(livelyConfig, subPackageName) {
    // find out what other packages are dependencies of this.pkg

    let {System, packageURL, pkg} = this,
        preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ?
          livelyConfig.preferLoadedPackages : true,
        normalized = System.decanonicalize(subPackageName, packageURL);

    if (preferLoadedPackages) {
      let subpackageURL,
          existing = findPackageNamed(System, subPackageName);

      if (existing)                        subpackageURL = existing.url;
      else if (pkg.map[subPackageName])    subpackageURL = normalizeInsidePackage(System, pkg.map[subPackageName], packageURL);
      else if (System.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], packageURL);
      else if (System.get(normalized))     subpackageURL = System.decanonicalize(subPackageName, packageURL + "/");

      if (subpackageURL) {
        if (System.get(subpackageURL)) subpackageURL = subpackageURL.split("/").slice(0,-1).join("/"); // force to be dir
        System.debug && console.log("[lively.module package] Package %s required by %s already in system as %s", subPackageName, pkg, subpackageURL);
        return subpackageURL;
      }
    }

    pkg.addMapping(subPackageName, livelyConfig.packageMap[subPackageName])

    // lookup
    var subpackageURL = normalizeInsidePackage(System, livelyConfig.packageMap[subPackageName], pkg.url);
    System.debug && console.log("[lively.module package] Package %s required by %s NOT in system, will be loaded as %s", subPackageName, pkg, subpackageURL);

    return subpackageURL;
  }

}
