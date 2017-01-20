import { obj, arr, string } from "lively.lang";
import module from "lively.modules";
import { resource } from 'lively.resources';

const bundledPackages = [
   "lively.morphic",
]

export default class ModuleBundler {

  constructor() {
     this.combinedModules = {};
     this.moduleDeps = {}
  }

  get pluginId() { return "moduleBundler" }

  get after() { return ["cors"]; }

  async generateCombinedModule(name, depsToLocalFiles) {
     var combinedModule = this.combinedModules[name] || {};
     this.moduleDeps[name] = {...this.moduleDeps[name], ...depsToLocalFiles}; 
     for (var path in depsToLocalFiles) {
        var res = resource(depsToLocalFiles[path]);
        if (!await res.exists()) {
           console.log(path, "does not exist!"); continue;
        }
        combinedModule[path.slice(path.indexOf(name))] = await res.read() 
     }
     return combinedModule;
  }

  async handleRequest(req, res, next) {
    if (!req.url.startsWith("/combined/") || 
        (req.method !== "GET" && req.method !== "POST"))
      return next();

    var name = req.url.replace("/combined/", "").replace(".json", ""), data;
    try {
      if (name == "index") {
        data = {};
        for (var m in this.combinedModules) {
          this.combinedModules[m] = await this.generateCombinedModule(m, this.moduleDeps[m]);
          data[m] = String(string.hashCode(JSON.stringify(this.combinedModules[m])));
        }
      } else if (name.includes("create/") && req.method == "POST") {
        name = name.replace('create/', '');
        var depsToLocalFiles;
        req.on('data', d => {
          d = JSON.parse(d);
          depsToLocalFiles = obj.merge(
            d.deps.map(path => {
              path = path.replace(d.serverUri, "");
              return {[path]: System.baseURL.replace('lively.server/', '') + path}
            })
          );
        });
        req.on('end', async () => {
           this.combinedModules[name] = await this.generateCombinedModule(name, depsToLocalFiles);
           res.writeHead(200);
        })
      } else {
        if (this.combinedModules[name]) {
           data = this.combinedModules[name];
        } else {
           // the module was already loaded outside of lively.modules or something went wrong
           throw new Error("No combined bundle avilable!");
        }
      }
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify(data));
    } catch(err) {
      console.error("bundle error: " + err);
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({isError: true, value: String(err.stack || err)}));
    }
  }

}
