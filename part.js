/*global System*/
import { resource, createFiles } from 'lively.resources';
import { requiredModulesOfSnapshot, serialize } from "lively.serializer2";
import { serializeMorph, deserializeMorph } from "lively.morphic/serialization.js";
import { arr } from "lively.lang";
import { module } from "lively.modules/index.js";
import Bundle from "./bundle.js";
import FreezerPackage from "./package.js";
import { loadPart, loadObjectFromPartsbinFolder } from "lively.morphic/partsbin.js";
import { runEval } from "lively.vm";
import { callService, ProgressMonitor } from "lively.ide/service-worker.js";
import { LoadingIndicator } from "lively.components";
import { allPlugins, LeakDetectorPlugin, plugins } from "lively.serializer2/plugins.js";

export async function interactivelyFreezePart(part, opts) {
  var li = LoadingIndicator.open("Freezing target...", {center: $world.visibleBounds().center()}),
      leakDetector = new LeakDetectorPlugin(),
      snap = serialize(part, {plugins: [...allPlugins, leakDetector]});
  if (leakDetector.memoryLeaks) {
    // We discovered that the follwing objects are solely referenced via attribute connections
    // and nowhere else in the part. In most cases this is a strong indication for unintended
    // references to morphs, which leads to an unnessecary bloat of the serialized part.
    // Would you like to remove these connections alongside the referenced morphs?
    var connectsToDisconnect;
    li.remove();
    while (leakDetector.memoryLeaks && !(connectsToDisconnect && connectsToDisconnect.length == 0)) {
      connectsToDisconnect = (await $world.editListPrompt(
       ["Possible Memory Leaks Detected:",  {fontWeight: 'bold'}," Disconnect objects? "], 
        leakDetector.memoryLeaks.map(leak => ({
          string: leak.conn.toString(), value: leak, isListItem: true
        })))).selections;
      arr.invoke(connectsToDisconnect.map(c => c.conn), 'disconnect');
      snap = serialize(part, {plugins: [...allPlugins, leakDetector = new LeakDetectorPlugin()]}); 
    }
    li.openInWorld();
  }
  let progressMonitor = new ProgressMonitor({
       handlers: [(stepName, progress) => {
         li.label = stepName;
         li.progress = progress;
       }]
      }),
      {file, warnings} = await callService('freezeSnapshot', {
        snapshot: JSON.stringify(snap),
        progress: progressMonitor
      });
  if (warnings.absoluteURLDetected) {
    // We discovered that the following morphs reference resources via an absolute path.
    // This can be problematic when the frozen part will be deployed on a different host
    // where the resource URL may look different. We advise you to replace these references by
    // relative paths. Also keep in mind that these files are not part of the generated bundle.
  }
  if (warnings.resolvedLoads) {
      // The part you are trying to freeze contains code that dynamically loads
      // other parts at runtime. Do you want these to be included into the frozen bundle as well?
      // Note: Including the remaining parts state will increase the total bundle size by X MB.
      // [list for selective inclustion/exclusion of referenced parts]
  }
  if (warnings.unresolvedLoads) {
    // The part you are trying to freeze contains dynamic loads of other objects at runtime, which
    // can not be resolved by static analysis.
    // [show source code locations of questionable loads]
    // Be advised that this code will likely fail in the frozen version of your part if the refernced parts
    // are not included into the bundle. If you know beforehand which parts are going to be loaded,
    // you can add them to the list here to incorporate them into the frozen part bundle.
  }
  li.remove();
  return file;
}

export class FreezerPart {

  static async fromSnapshot(snap) {
    return await new this().freezeSnapshot(snap);
  }

  static async fromMorph(morph) {
    return this.fromSnapshot(serializeMorph(morph));
  }

  static async fromPath(path) {
    return this.fromMorph(deserializeMorph(await resource(path).read()))
  }

  static async fromPart(nameOrCommit, options = {}) {
    return this.fromMorph(await loadPart(nameOrCommit, options));
  }

  get runtimeGlobal() {
    return 'lively.FreezerRuntime';
  }

  async getRequiredModulesFromSnapshot(snap, name, includeDynamicParts=false) {
    var imports = requiredModulesOfSnapshot(snap), 
        dynamicParts = [], partData = {[name]: snap};
    for (let m of imports) {
       let dynamicPartLoads = (await lively.modules.module(m).source()).match(/loadObjectFromPartsbinFolder\(\S*\)/);
       if (dynamicPartLoads) {
         // try to resolve them
         for (let call of dynamicPartLoads) {
           let dynamicPart;
           try {
             dynamicPart = (await runEval(`await ` + call, {
                             wrapInStartEndCall: true,
                             transpiler: source => "(async function() {" + source + "})()",
                             topLevelVarRecorder: {loadObjectFromPartsbinFolder}})).value;
           } catch(e) {
             let unresolved;
             if (unresolved = this.warnings.unresolvedLoads) {
               unresolved.set(m, dynamicPartLoads);
             } else {
               this.warnings.unresolvedLoads = new Map([[m, dynamicPartLoads]]);
             }
           }
           if (dynamicPart) {
             let dynamicPartName = dynamicPart.constructor.name + '/index.js';
             if (includeDynamicParts) {
               arr.pushIfNotIncluded(dynamicParts, dynamicPartName);
               partData[dynamicPart.constructor.name] = serialize(dynamicPart);  
             } else {
               let resolved;
               if (resolved = this.warnings.resolvedLoads) {
                 resolved.add(dynamicPartName);
               } else {
                 this.warnings.resolvedLoads = new Set([dynamicPartName]);
               }
             }
           }
         }
       }
    }
    return [[...imports, ...dynamicParts], partData]
  }

  async computePackageMapForSnapshotAndImports(snap, imports, name) {
    let corePackages = ['lively.lang', 'lively.modules', 'lively.components', 
                        'lively.serializer2', 'lively.ast', 'lively.vm', 'lively.storage',
                        'lively.resources', 'lively.bindings', 'lively.notifications', 
                        'lively.graphics', 'lively.classes', 'lively.source-transform'],
        globalpackages = {"lively.lang": "lively.lang",
                         "lively.modules": "lively.modules",
                         "lively.ast": 'lively.ast',
                         "lively.vm": "lively.vm",
                         "lively.serializer2": "lively.serializer2",
                         //"lively.graphics": "lively.graphics",
                         "lively.resources": "lively.resources",
                         "lively.notifications": "lively.notifications",
                         "lively.bindings": "lively.bindings",
                         "lively.classes": "lively.classes",
                          "lively.storage": 'lively.storage',
                         "lively.source-transform": "lively.sourceTransform"},
        localDir = resource("local://frozen-parts/"), // is this really nessecary ..?
        root = arr.uniq(imports.map(path => `import "${path}"`)).join('\n')
                    + `\nimport {World, MorphicEnv} from "lively.morphic";
                       import { resource } from 'lively.resources';
                       import { promise } from 'lively.lang';
                       import { loadMorphFromSnapshot } from "lively.morphic/serialization.js";
                       import {pt} from "lively.graphics";
                       if (!MorphicEnv.default().world) {
                          let world = window.$world = window.$$world = new World({
                            name: "world", extent: pt(window.innerWidth, window.innerHeight)
                          });
                          MorphicEnv.default().setWorld(world);
                       }
                       export async function renderFrozenPart() {
                          let obj = (await loadMorphFromSnapshot(window.lively.partData["${name}"], 
                                                      {onDeserializationStart: false}));
                          window.$world.height = obj.height;
                          obj.openInWorld();
                          obj.top = 0;
                       }`;

    await createFiles(localDir, {
      [name]: {
        "package.json": `{"name": "${name}", "version": "${snap.requiredVersion}"}`,
        "index.js": root
      }
    });

    let packages = {
      [name]: {path: localDir.join(name + "/").url} // custom root package
    };

    var modPath, pkg;
    
    for (modPath of [...imports, ...corePackages]) {
      pkg = module(modPath).package();
      if (pkg) packages[pkg.name] = {path: pkg.url, standaloneGlobal: globalpackages[pkg.name] || false };
    }

    return await FreezerPackage.buildPackageMap(packages)
  }

  async freezeSnapshot(snap, {includeDynamic = false} = {}) {
    this.warnings = {};
    let frozenPartPackageName = "frozen-" + snap.snapshot[snap.id]["lively.serializer-class-info"].className,
        [imports, partData] = await this.getRequiredModulesFromSnapshot(snap, frozenPartPackageName, includeDynamic),
        packageMap = await this.computePackageMapForSnapshotAndImports(snap, imports, frozenPartPackageName);

    this.entryModule = frozenPartPackageName;
    this.bundle = new Bundle(packageMap);
    this.partData = partData;
    return this;
  }

  async dependencyScripts() {
    // fixme: try to minift this stuff to save space
    var res = '', sources = [
     "lively.next-node_modules/babel-standalone/babel.js",
     "lively.next-node_modules/systemjs/dist/system.src.js",
     "lively.modules/dist/lively.modules.min.js",
     "lively.graphics/dist/lively.graphics.js",
     "lively.bindings/dist/lively.bindings.js",
     "lively.serializer2/dist/lively.serializer2.js",
     "lively.storage/dist/lively.storage_with-pouch.js"].map(
       url => resource(System.baseURL + url).read());
    for (let source of sources) {
      res += await source + '\n';
    }
    return res;
  }

  async standalone(opts = {}) {
    return {
     warnings: this.warnings,
     file: await resource(System.baseURL + 'lively.freezer/runtime-dependencies.js').read() +
           `\nlively.partData = ${JSON.stringify(this.partData)};\n\n` +
           await this.bundle.standalone({
              livelyTranspilation: true,
              clearExcludedModules: true,
              addRuntime: true,
              isExecutable: true,
              entryModule: this.entryModule + '/index.js',
              ...opts
            }) + `${this.runtimeGlobal}.get(System.decanonicalize("${this.entryModule + '/index.js'}")).exports.renderFrozenPart()`
    }
  }
}