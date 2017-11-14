import { arr, obj } from "lively.lang";
import { isURL } from "../url-helpers.js";
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
      packages: {
        [packageURL]: {
          ...sysConfig,
          meta: {"package.json": {format: "json"}, ...sysConfig.meta},
          configured: true
        }
      }
    });
    // configured flag so SystemJS doesn't try to load a potentially
    // non-existing package.json
    System.packages[packageURL].configured = true;

    let packageInSystem = System.getConfig().packages[packageURL] || {};
    if (!packageInSystem.map) packageInSystem.map = {};

    if (sysConfig) {
      if (livelyConfig && livelyConfig.main) main = livelyConfig.main;
      else if (sysConfig.main) main = sysConfig.main;
      this.applySystemJSConfig(sysConfig);
    }

    if (!main.match(/\.[^\/\.]+/)) main += ".js";
    packageInSystem.main = main;

    // System.packages doesn't allow us to store our own properties
    pkg.version = version;
    pkg.config = config;
    pkg._name = name;
    pkg.mergeWithConfig(packageInSystem);

    return livelyConfig ? this.applyLivelyConfig(livelyConfig) : {subPackages: []};
  }

  applySystemJSConfig(sysConfig) {
    let {System} = this;
    // System.debug && console.log("[lively.modules package configuration] applying SystemJS config of %s", pkg);
    if (sysConfig.packageConfigPaths)
      System.packageConfigPaths = arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths));
    if (sysConfig.packages) // packages is normaly not support locally in a package.json
      System.config({packages: sysConfig.packages});
    if (sysConfig.globalmap)
      System.config({map: sysConfig.globalmap});
    if (sysConfig.babelOptions)
      System.config({babelOptions: sysConfig.babelOptions});
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively config
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  applyLivelyConfig(livelyConfig) {
    // configures System object from lively config JSON object.
    // - adds System.package entry for package
    // - installs hook from {hooks: [{name, source}]}
    // - merges livelyConfig.packageMap into System.package[pkg.url].map
    //   entries in packageMap are specifically meant to be sub-packages!
    // Will return a {subPackages: [packageURL,...]} object

    this.applyLivelyConfigMeta(livelyConfig);
    this.applyLivelyConfigHooks(livelyConfig);
    this.applyLivelyConfigBundles(livelyConfig);
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

}
