import { obj, arr } from "lively.lang";
import { resource } from "lively.resources";

export function shortModuleName(system, moduleId, itsPackage) {
  var packageAddress = itsPackage && itsPackage.address,
      shortName = packageAddress && moduleId.indexOf(packageAddress) === 0 ?
              moduleId.slice(packageAddress.length).replace(/^\//, "") :
              relative(moduleId);
  return shortName;

  function relative(name) {
    var conf = system.getConfig();
    if (conf && conf.constructor === Promise) return name;
    try {
      return String(new URL(name).relativePathFrom(new URL((system.getConfig()).baseURL)))
    } catch (e) {}
    return name;
  }
}

export async function interactivelyChangeModule(system, vmEditor, moduleName, newSource, options) {
  // options.write, options.eval, ..
  options = obj.merge({targetModule: moduleName}, options);
  moduleName = await system.normalize(moduleName);
  await system.moduleSourceChange(moduleName, newSource, options);
  if (vmEditor) await vmEditor.updateModuleList();
  return moduleName;
}

export async function interactivelyReloadModule(system, vmEditor, moduleName) {
  vmEditor && vmEditor.setStatusMessage("Reloading " + moduleName);
  try {
    await system.reloadModule(moduleName, {reloadDeps: true, resetEnv: true});
    vmEditor && await vmEditor.updateModuleList();
    vmEditor && vmEditor.setStatusMessage("Reloded " + moduleName)
  } catch (err) {
    try {
      vmEditor && await vmEditor.updateEditorWithSourceOf(moduleName);
    } catch (e) {}
    vmEditor && vmEditor.showError(err); throw err;
  }
}

export async function interactivelyUnloadModule(system, vmEditor, moduleName) {
  await system.forgetModule(moduleName, {forgetEnv: true, forgetDeps: true});
  vmEditor && await vmEditor.updateModuleList();
}


export async function interactivelyRemoveModule(system, vmEditor, moduleName, world = $world) {
  // var moduleName = this.state.selection.name
  var fullname = await system.normalize(moduleName),
      really = await world.confirm(`Remove file ${fullname}?`)
  if (!really) throw "Canceled";
  await system.forgetModule(moduleName);
  vmEditor && await vmEditor.updateModuleList()
  await system.resourceRemove(fullname);
  var p = await system.getPackageForModule(fullname);
  vmEditor && await vmEditor.uiSelect(p ? p.address : null);
}

export async function interactivelyAddModule(system, vmEditor, relatedPackageOrModule, world = $world) {

  var root = new URL((await system.getConfig()).baseURL);
  if (relatedPackageOrModule) {
    var p = (await system.getPackage(relatedPackageOrModule)) || (await system.getPackageForModule(relatedPackageOrModule))
    if (p) root = new URL(p.address);
  }

  var candidates = await _searchForExistingFiles(vmEditor, String(root), p, world);

  if (candidates.includes("[create new module]")) {
    var fullname = await _askForModuleName(system, String(root), world)
    candidates = [fullname];
  }

  var namesAndErrors = await _createAndLoadModules(system, candidates),
      errors = arr.compact(namesAndErrors.map(ea => ea.error)),
      hasError = !!errors.length;

  if (vmEditor) {
    await vmEditor.updateModuleList();
    await vmEditor.uiSelect(namesAndErrors.first().name);
    vmEditor.focus();
  }

  return namesAndErrors;
}

async function _askForModuleName(system, input, world) {
  var input = await world.prompt(
    "Enter module name",
    {input: input, historyId: "lively.vm-editor-add-module-name"});
  if (!input) throw "Canceled";
  var fullname = await system.normalize(input),
      really = await world.confirm("Create module " + fullname + "?");
  if (!really) throw "Canceled";
  return fullname;
}

async function _searchForExistingFiles(vmEditor, rootURL, p, world) {
  if (String(rootURL).match(/^http/)) {
    return _searchForExistingFilesWeb(vmEditor, rootURL, p, world)
  } else {
    return _searchForExistingFilesManually(vmEditor, rootURL, p, world);
  }
}

function _searchForExistingFilesManually(vmEditor, rootURL, p, world = $world) {
  return new Promise((resolve, reject) => {
    var m = lively.morphic.Menu.openAtHand(
      "Create new module or load an existing one?", [
      ["create", () => { m.triggered = true; resolve("[create new module]"); }],
      ["load", async () => {
        m.triggered = true;
        var result = await world.prompt("URL of module?", {input: rootURL, historyId: "lively.vm._searchForExistingFilesManually.url-of-module"})
        if (!result) reject("Canceled");
        else resolve([result]);
      }]]);
    m.reject = reject;
    m.addScript(function remove() {
      $super();
      (() => {
        if (!this.triggered) this.reject("Canceled");
      }).delay(.2);
    });
  })
}

async function _searchForExistingFilesWeb(vmEditor, rootURL, p, world = $world) {
  function exclude(resource) {
    var name = resource.name();
    if ([".git", "node_modules", ".optimized-loading-cache"].includes(resource.name()))
      return true;
    if (p) {
      var modules = arr.pluck(p.modules, "name");
      if (modules.includes(resource.url)) return true;
    }
    return false;
  }
  
  var found = await (await resource(rootURL).dirList(5, {exclude})).map(ea => ea.url),
      candidates = [{
        isListItem: true,
        string: "[create new module]",
        value: "[create new module]"}
      ].concat(found
        .filter(ea => ea.endsWith(".js"))
        .map(name => {
          var shortName = name;
          shortName = p && name.indexOf(p.address) == 0 ?
            p.name + name.slice(p.address.length) :
            name;
          return {isListItem: true, string: shortName, value: name};
        })),

      answer = await world.filterableListPrompt("What module to load?", candidates, {
        filterLabel: "filter: ",
        multiselect: true,
        ...(vmEditor ? {extent: pt(vmEditor.width(), 400)} : {})
      });

  if (!answer || answer.status === "canceled" || !answer.selected.length)
    throw "Canceled";

  var result = answer.selected || answer;
  if (!Array.isArray(result)) result = [result];
  return result;
}

async function _createAndLoadModules(system, fullnames) {
  if (!Array.isArray(fullnames)) fullnames = [fullnames];
  var results = [];
  for (let fullname of fullnames) {
    await system.forgetModule(fullname, {forgetDeps: false, forgetEnv: false});
    // ensure file record is created to display file in graph even if load
    // error occurs:
    await system.resourceEnsureExistance(fullname, '"format esm";\n');

    try {
      await system.importModule(fullname)
      results.push({name: fullname});
    } catch (err) {
      results.push({name: fullname, error: err});
    }
  }
  return results;
}

export async function modulesInPackage(system, packageName) {
  const p = await system.getPackage(packageName);
  if (!p || !p.address.match(/^http/)) {
    throw new Error(`Cannot load package ${packageName}`);
  }
  function exclude(res) {
    if ([".git", "node_modules", ".optimized-loading-cache"].includes(res.name())) {
      return true;
    }
    return false;
  }

  const res = resource(new URL(p.address)),
        found = (await res.dirList(5, {exclude})).map(ea => ea.url)
  return found.filter(f => f.match(/\.js$/))
              .map(m => system.getModule(m));
}
