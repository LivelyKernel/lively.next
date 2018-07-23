/*global System*/
import { resource, createFiles } from 'lively.resources';
import { requiredModulesOfSnapshot, removeUnreachableObjects, serialize } from "lively.serializer2";
import { serializeMorph, loadPackagesAndModulesOfSnapshot, deserializeMorph } from "lively.morphic/serialization.js";
import { arr } from "lively.lang";
import { module } from "lively.modules/index.js";
import Bundle from "./bundle.js";
import FreezerPackage from "./package.js";
import { loadPart, SnapshotEditor, loadObjectFromPartsbinFolder } from "lively.morphic/partsbin.js";
import { runEval } from "lively.vm";
import { callService, ProgressMonitor } from "lively.ide/service-worker.js";
import { LoadingIndicator } from "lively.components";
import { allPlugins, LeakDetectorPlugin, plugins } from "lively.serializer2/plugins.js";
import { config, MorphicDB } from "lively.morphic";
import { SnapshotInspector } from "lively.serializer2/debugging.js";

export async function interactivelyFreezePart(part, opts) {
  var li = LoadingIndicator.open("Freezing target...", {center: $world.visibleBounds().center()}),
      leakDetector = new LeakDetectorPlugin(),
      snap = serialize(part, {plugins: [...allPlugins, leakDetector]}); // do not serialize ad hoc, fetch from db
  if (opts.checkForLeaks && leakDetector.memoryLeaks) {
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
      args = {
        snapshot: JSON.stringify(snap),
        progress: progressMonitor
      },
      {file, warnings} = config.ide.workerEnabled ? 
                  await callService('freezeSnapshot', args) : 
                  await freezeSnapshot(args, opts);
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

export async function freezeSnapshot({snapshot, progress}, opts) {
  // remove the metadata props
  const snap = JSON.parse(snapshot);
  Object.values(snap.snapshot).forEach(m => delete m.props.metadata);
  removeUnreachableObjects([snap.id], snap.snapshot);
  SnapshotInspector.forSnapshot(snap).openSummary();
  return await (await FreezerPart.fromSnapshot(snap, opts)).standalone({
      progress, includeRuntime: opts.includeRuntime
  });
}

export class FreezerPart {

  static async fromSnapshot(snap, opts) {
    return await new this().freezeSnapshot(snap, opts);
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
    var imports = requiredModulesOfSnapshot(snap), // do this after the replacement of calls
        dynamicPartImports = [];
    for (let m of imports) {
       const partsBinLoadCalls = /loadObjectFromPartsbinFolder\((\S*)\)/g,
             partModuleSource = (await lively.modules.module(m).source()),
             dynamicPartLoads = [];
       let callSite;
       while (callSite = partsBinLoadCalls.exec(partModuleSource)) {
         dynamicPartLoads.push(callSite[1].slice(1, -1));
       } 
         // try to resolve them
       for (let partName of dynamicPartLoads) {
         let dynamicPart = await MorphicDB.default.fetchSnapshot('part', partName);
         if (dynamicPart) {
           if (includeDynamicParts) {
             // load the packages of the part, if they are not loaded
             await loadPackagesAndModulesOfSnapshot(dynamicPart);
             dynamicPartImports.push(...(await this.getRequiredModulesFromSnapshot(dynamicPart, partName)));
           } else {
             let resolved;
             if (resolved = this.warnings.resolvedLoads) {
               resolved.add(partName);
             } else {
               this.warnings.resolvedLoads = new Set([partName]);
             }
           }
         }
       }
    }
    return arr.uniq([...imports, ...dynamicPartImports])
  }

  async computePackageMapForSnapshotAndImports(snap, imports, name) {
    let corePackages = ['lively.lang', 'lively.modules', 'lively.components', 'bowser',
                        'lively.serializer2', 'lively.ast', 'lively.vm', 'lively.storage',
                        'lively.resources', 'lively.bindings', 'lively.notifications', 
                        'lively.graphics', 'lively.classes', 'lively.source-transform', 'lively.morphic'],
        globalpackages = {"lively.lang": "lively.lang",
                         "lively.modules": "lively.modules",
                         "lively.ast": 'lively.ast',
                         "lively.vm": "lively.vm",
                         "lively.serializer2": "lively.serializer2",
                         "lively.graphics": "lively.graphics",
                         "lively.resources": "lively.resources",
                         "lively.notifications": "lively.notifications",
                         "lively.bindings": "lively.bindings",
                         "lively.classes": "lively.classes",
                         "lively.storage": 'lively.storage',
                         "lively.source-transform": "lively.sourceTransform",
                         "lively.morphic": "lively.morphic",
                         "bowser": "bowser"},
        localDir = resource("local://frozen-parts/"), // is this really nessecary ..?
        // the problem is, that deserialization bypasses the module bounds and accesses the recorder.
        // we need to check at compile time, for which module the deserialization assumes a properly initialized
        // recorder, or we will have some unexpected crashes at runtime, when the freezer runtime will
        // attempt to replace some of the submodules by the standalone package.
        root = arr.uniq(imports.map(path => `import "${path}"`)).join('\n')
                    + `\nimport { World, MorphicEnv, loadMorphFromSnapshot} from "lively.morphic";
                       import { resource } from 'lively.resources';
                       import { promise } from 'lively.lang';
                       import {pt} from "lively.graphics";
                       if (!MorphicEnv.default().world) {
                          let world = window.$world = window.$$world = new World({
                            name: "world", extent: pt(window.innerWidth, window.innerHeight)
                          });
                          MorphicEnv.default().setWorld(world);
                       }
                       export async function renderFrozenPart() {
                          let obj = (await loadMorphFromSnapshot(window.lively.partData["${name}"], 
                                                      {onDeserializationStart: false, 
                                                       migrations: []}));
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

  async freezeSnapshot(snap, {includeDynamicParts = false} = {}) {
    this.warnings = {};
    let frozenPartPackageName = "frozen-" + snap.snapshot[snap.id]["lively.serializer-class-info"].className,
        imports = await this.getRequiredModulesFromSnapshot(snap, frozenPartPackageName, includeDynamicParts),
        packageMap = await this.computePackageMapForSnapshotAndImports(snap, imports, frozenPartPackageName);
    this.entryModule = frozenPartPackageName;
    this.bundle = new Bundle(packageMap);
    this.partData = {
      [frozenPartPackageName]: snap
    };
    return this;
  }

  async standalone(opts = {}) {
    let runtime = '',
        body = await this.bundle.standalone({
      livelyTranspilation: true,
      clearExcludedModules: true,
      addRuntime: true,
      isExecutable: true,
      entryModule: this.entryModule + '/index.js',
      ...opts
    });

    // body = body.replace(/__lvVarRecorder\.loadObjectFromPartsbinFolder\(\S*\)/g, (load) => {
    //   return 'lively.FreezerRuntime' + load.replace('__lvVarRecorder', '');
    // });

    if (opts.includeRuntime) {
      runtime = await resource(System.baseURL + 'lively.freezer/runtime-deps.js').read();
    }
    
    return {
     warnings: this.warnings,
     file: runtime +
           `\nlively.partData = ${ JSON.stringify(this.partData) };\n\n` +
           body + 
           `${this.runtimeGlobal}.get(System.decanonicalize("${this.entryModule + '/index.js'}")).exports.renderFrozenPart()`
    }
  }
}