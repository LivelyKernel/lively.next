/*global URL*/
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

export async function interactivelyChangeModule(system, moduleName, newSource, options) {
  // options.write, options.eval, ..
  options = {targetModule: moduleName, ...options};
  moduleName = await system.normalize(moduleName);
  await system.moduleSourceChange(moduleName, newSource, options);
  return moduleName;
}

export async function interactivelyReloadModule(system, vmEditor, moduleName, reloadDeps = false, resetEnv = false) {
  vmEditor && vmEditor.setStatusMessage("Reloading " + moduleName);
  try {
    await system.reloadModule(moduleName, {reloadDeps, resetEnv});
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


export async function interactivelyRemoveModule(system, requester, moduleName) {
  // var moduleName = this.state.selection.name
  var fullname = await system.normalize(moduleName),
      really = await requester.world().confirm(`Remove file ${fullname}?`, {requester})
  if (!really) throw "Canceled";
  await system.forgetModule(fullname);
  await system.resourceRemove(fullname);
  var p = await system.getPackageForModule(fullname);
  return p;
}

export async function interactivelyAddModule(system, requester, relatedPackageOrModuleName) {

  var root = new URL((await system.getConfig()).baseURL);

  if (relatedPackageOrModuleName) {
    var p = (await system.getPackage(relatedPackageOrModuleName))
         || (await system.getPackageForModule(relatedPackageOrModuleName))
    if (p) root = new URL(p.address);
  }

  var candidates = await _searchForExistingFiles(requester, String(root), p);

  if (candidates.includes("[create new module]")) {
    var fullname = await _askForModuleName(system, relatedPackageOrModuleName || String(root), requester.world());
    candidates = [fullname];
  }

  var namesAndErrors = await _createAndLoadModules(system, candidates),
      errors = arr.compact(namesAndErrors.map(ea => ea.error)),
      hasError = !!errors.length;

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

async function _searchForExistingFiles(requester, rootURL, p) {
  if (String(rootURL).match(/^http/)) {
    return _searchForExistingFilesWeb(requester, rootURL, p)
  } else {
    return _searchForExistingFilesManually(requester, rootURL, p);
  }
}

async function _searchForExistingFilesManually(requester, rootURL, p) {
  var choice = await requester.world().multipleChoicePrompt(
    "Create new module or load an existing one?", {choices: ["create", "load"]})
  if (choice === "create") return "[create new module]";
  if (choice === "load") {
    var result = await requester.world().prompt("URL of module?", {
      input: rootURL,
      historyId: "lively.vm._searchForExistingFilesManually.url-of-module"
    });
    if (result) return [result];
  };
  throw "Canceled";;
}

async function _searchForExistingFilesWeb(requester, rootURL, p) {
  function exclude(resource) {
    var name = resource.name();
    if ([".git", "node_modules", ".optimized-loading-cache", ".module_cache"].includes(resource.name()))
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

      answer = await requester.world().filterableListPrompt("What module to load?", candidates, {
        filterLabel: "filter: ",
        multiselect: true,
        ...(requester ? {extent: requester.bounds().extent().withY(400)} : {})
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

function modulesInPackage_defaultExclude(res) {
  if ([".git", "node_modules", ".optimized-loading-cache", ".module_cache"].includes(res.name())) {
    return true;
  }
  return false;
}

export async function modulesInPackage(system, packageName) {
  const p = await system.getPackage(packageName);
  if (!p || !p.address.match(/^http/)) {
    throw new Error(`Cannot load package ${packageName}`);
  }

  const res = resource(p.address), found = [];
  for (let {url} of await res.dirList(5, {exclude: modulesInPackage_defaultExclude}))
    if (url.match(/\.js$/) && system.isModuleLoaded(url, true/*isNormalized*/))
      found.push(system.getModule(url))
  return found;
}
