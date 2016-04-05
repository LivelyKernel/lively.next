import { Path, arr } from "lively.lang";
import * as ast from "lively.ast";
import { writeFile, removeFile } from "../tests/helpers.js";
export { bundle }

function bundle(System, bundleFile, files) {
  return Promise.all(
    files.map(file =>
      System.normalize(file)
        .then(url =>
          (System.get(url)  ? Promise.resolve() : System.import(url))
            .then(() => createRegisterModuleFor(System, url))
            .then(source => ({url: url, source: source})))))
    .then(urlAndSources => {
      var source = arr.pluck(urlAndSources, "source").join('\n\n');
      return System.normalize(bundleFile).then(outFile => writeFile(outFile, source))
    });
}

function createRegisterModuleFor(System, url, formatOverride) {
  var load = System.loads && System.loads[url];
  if (!load) throw new Error(url + " not loaded / traced!");
  var format = formatOverride || load.metadata.format;
  if (format === "esm" || format === "es6") {
    return createRegisterModuleFromLoad(load);
  } else if (format === "cjs") {
    return createRegisterModuleForCommonJSModule(System, url, load.metadata.entry.executingRequire, load.deps);
  } else {
    throw new Error("Cannot create register module for " + url + " with format " + format);
  }
}

function createRegisterModuleFromLoad(load) {
  return new Promise((resolve, reject) => {
    var name = load.name;
  
    if (!load.source) return reject(new Error("No source for " + name));
    
    var parsed = ast.parse(load.source);
    
    if ("CallExpression" !== Path("body.0.expression.type").get(parsed))
      return reject(new Error("Load source is not a call Expression (" + name + ")"));
    if ("CallExpression" !== Path("body.0.expression.callee.body.body.0.expression.type").get(parsed))
      return reject(new Error("Load source body inner is not a System.register call expressions (" + name + ")"));
    if ("System"         !== Path("body.0.expression.callee.body.body.0.expression.callee.object.name").get(parsed))
      return reject(new Error("Not a call to System! (" + name + ")"));
    if ("register"       !== Path("body.0.expression.callee.body.body.0.expression.callee.property.name").get(parsed))
      return reject(new Error("Not a call to System.register! (" + name + ")"));
    
    var moduleName = Path("body.0.expression.arguments.0.value").get(parsed);
    
    if (!moduleName)
      return reject(new Error("Could not extract module name from " + name));
  
    var registerCall = Path("body.0.expression.callee.body.body.0.expression").get(parsed)
    registerCall["arguments"].unshift({type: "Literal", value: moduleName})
  
    resolve(ast.stringify(registerCall));
  });
}

function createRegisterModuleForCommonJSModule(System, url, executingRequire, deps) {
  // FIXME! deps...
  var load = {status: 'loading', address: url, name: url, linkSets: [], dependencies: [], metadata: {}},
      depsString = "[" + (deps.length ? "'" + deps.join("', '") + "'" : "") + "]";
  return System.fetch(load)
    .then(source => `System.registerDynamic('${url}', ${depsString}, ${!!executingRequire}, `
                  + `function(require, exports, module) {\n${source}\n});\n`)
}





function fooooo() {
// lvm = null
// lively.vm.es6.currentSystem().import("lively.modules").then(lvm => Global.lvm = lvm)
// lively.vm.es6.currentSystem().import("lively.modules/src/packages.js").then(lvmp => Global.lvmp = lvmp)
// lively.vm.es6.currentSystem().import("lively.modules/src/hooks.js").then(lvmh => Global.lvmh = lvmh)
// lively.vm.es6.currentSystem().import("lively.modules/src/system.js").then(lvms => Global.lvms = lvms)

function reset() {
  lvms.removeSystem("bundle-test");
  var S = lvms.getSystem("bundle-test");
  return S;
}

function register() {}

function load() {}

var bundleSystem = reset();

// write("test-dep.js", "export var y = 3;");
// write("foo.js", "import { y } from './test-dep.js'; debugger; export var x = 2 + y;");


var ast = lively.ast;
var lang = lively.lang;



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// bundleSystem.debug = true
// lvmp.registerPackage(bundleSystem, URL.root + "lively.ast-es6")
//   .then(_ => {
//     show(bundleSystem.packages)
//     show(bundleSystem.map)
//     return Promise.all([
//       bundleSystem.import("acorn"),
//       bundleSystem.import("acorn/dist/walk.js"),
//       bundleSystem.import("acorn/dist/acorn_loose.js")
//     ]).then(show.curry("%s")).catch(show.curry("%s"))
//   })
//   .catch(show.curry("%s"))

// Object.keys(bundleSystem.loads)

// var urls = [
//   "http://localhost:9001/lively.ast-es6/node_modules/acorn/dist/acorn.js",
//   "http://localhost:9001/lively.ast-es6/node_modules/acorn/dist/walk.js",
//   "http://localhost:9001/lively.ast-es6/node_modules/acorn/dist/acorn_loose.js"]

// Promise.all(urls.map(url => convertCJSToSystemRegister(bundleSystem, url, false, [])))
//   .then(sources => write("acorn-test-bundle.js", sources.join("\n\n")))


// function convertCJSToSystemRegister(System, url, executingRequire, deps) {
//   return lvms.sourceOf(System, url)
//     .then(source => `System.registerDynamic('${url}', [], ${!!executingRequire}, `
//                   + `function(require, exports, module) {\n${source}\n});\n`)
// }



// bundleSystem.import("lively.lang").then(show.curry("%s")).catch(show.curry("%s"))

// write("foo-bundle.js",
//   convertLoadSourceToRegisterModule(bundleSystem.loads["http://localhost:9001/foo.js"])
//   + "\n"
//   + convertLoadSourceToRegisterModule(bundleSystem.loads["http://localhost:9001/test-dep.js"]))

bundleSystem.config({
  bundles: {
    "foo-bundle.js": ["test-dep.js", "foo.js"]
  }
})


// bundleSystem.config({
//   bundles: {
//     "acorn-test-bundle.js": ["acorn.js", "acorn_loose.js", "walk.js"]
//   }
// })

// bundleSystem.register("test-dep.js", [], function($__export) {
//   "use strict";
//   return {
//     setters: [],
//     execute: function() { $__export("y", 2); }
//   }
// });

// bundleSystem.register("foo.js", ["./test-dep.js"], function($__export) {
//   "use strict";
//   var x = 23, y;
//   return {
//     setters: [function($__m) {
//       y = $__m.y;
//     }],
//     execute: function() {
//       $__export("x", x + y);
//     }
//   }
// });

// register().then(_ => load()).catch(show.curry("%s"))

// load().catch(show.curry("%s"))


// bundleSystem.import("walk.js")
//   .then(show)
//   .catch(this.showError.bind(this))


bundleSystem.loads["http://localhost:9001/foo-bundle.js"].source
bundleSystem.import("foo.js")
  .then(show)
  .catch(this.showError.bind(this))
  

}