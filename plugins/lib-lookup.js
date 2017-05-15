import LivelyServer from "../server.js";
import fs from "fs";
import { basename, join } from "path";
import { resource } from "lively.resources";

export default class LibLookupPlugin {

  constructor() {
    this._fsRootDir = null;
  }

  setOptions({route} = {}) {}

  get pluginId() { return "lib-lookup"; }

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

  async handleRequest(req, res, next) {
    let {libPath, fsRootDir} = this, {url: path} = req;
    if (!path.startsWith(libPath) || path === libPath) return next();

    path = decodeURIComponent(path);
    let [_, _2, fullPackageName, ...rest] = path.split("/");
    console.log(fullPackageName)
    let [packageName, version] = fullPackageName.split("@"),
        fullLibPath = join(fsRootDir, libPath);

// fs.existsSync(join(fullLibPath, fullPackageName))

    if (fs.existsSync(join(fullLibPath, fullPackageName))) return next();

    let registry = System.get("@lively-env").packageRegistry;
    if (!registry) return next();

    let pkg = registry.lookup(packageName, version)
    if (!pkg) return next();

    let pkgURL = resource(pkg.url).path();
    let index = pkgURL.indexOf(fullLibPath)
    if (index !== 0) return next();
    
    let newPath = join(libPath, pkgURL.slice(fullLibPath.length), ...rest);
    req.url = newPath;
    console.log("!!!!!", newPath)

    // next();

    res.writeHead(301,  {location: newPath});
    res.end();

// let s = LivelyServer.servers.values().next().value

  }

}