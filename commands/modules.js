import { obj } from "lively.lang";

export function shortModuleName(system, moduleId, itsPackage) {
  var packageAddress = itsPackage && itsPackage.address,
      shortName = packageAddress && moduleId.indexOf(packageAddress) === 0 ?
              moduleId.slice(packageAddress.length).replace(/^\//, "") :
              relative(moduleId);
  return shortName;

  function relative(name) {
    try {
      return String(new URL(name).relativePathFrom(new URL(system.getConfig().baseURL)))
    } catch (e) {}
    return name;
  }
}

export async function interactivelyChangeModule(system, vmEditor, moduleName, newSource, options) {
  // options.write, options.eval, ..
  options = obj.merge({targetModule: moduleName}, options);
  moduleName = await system.normalize(moduleName);
  await system.moduleWrite(moduleName, newSource);
  await system.moduleSourceChange(moduleName, newSource, options);
  await vmEditor.updateModuleList();
  return moduleName;
}

export async function interactivelyReloadModule(system, vmEditor, moduleName) {
  vmEditor.setStatusMessage("Reloading " + moduleName);
  try {
    await system.reloadModule(moduleName, {reloadDeps: true, resetEnv: true});
    await vmEditor.updateModuleList();
    vmEditor.setStatusMessage("Reloded " + moduleName)
  } catch (err) {
    try {
      await vmEditor.updateEditorWithSourceOf(moduleName);
    } catch (e) {}
    vmEditor.showError(err); throw err;
  }
}

export async function interactivelyUnloadModule(system, vmEditor, moduleName) {
  await system.forgetModule(moduleName, {forgetEnv: true, forgetDeps: true});
  await vmEditor.updateModuleList();
}


export async function interactivelyRemoveModule(system, vmEditor, moduleName) {
  // var moduleName = this.state.selection.name
  var fullname = await system.normalize(moduleName),
      really = await $world.confirm(`Remove file ${fullname}?`)
  if (!really) throw "Canceled";
  await system.forgetModule(moduleName);
  await vmEditor.updateModuleList()
  await system.resourceRemove(fullname);
  var p = await system.getPackageForModule(fullname);
  await vmEditor.uiSelect(p ? p.address : null);
}

export async function interactivelyAddModule(system, vmEditor, relatedPackageOrModule) {

  var root = new URL(system.getConfig().baseURL);
  if (relatedPackageOrModule) {
    var p = (await system.getPackage(relatedPackageOrModule)) || (await system.getPackageForModule(relatedPackageOrModule))
    root = new URL(p.address);
  }

  var candidates = await _searchForExistingFiles(vmEditor, root, p);

  if (candidates.include("[create new module]")) {
    var fullname = await _askForModuleName(system, String(root))
    candidates = [fullname];
  }

  var namesAndErrors = await _createAndLoadModules(system, candidates),
      errors = namesAndErrors.map(ea => ea.error).compact(),
      hasError = !!errors.length;

  await vmEditor.updateModuleList();
  await vmEditor.uiSelect(namesAndErrors.first().name);
  vmEditor.focus();
  if (hasError) throw errors[0];
}

async function _askForModuleName(system, input) {
  var input = await $world.prompt(
    "Enter module name",
    {input: input, historyId: "lively.vm-editor-add-module-name"});
  if (!input) throw "Canceled";
  var fullname = await system.normalize(input),
      really = await $world.confirm("Create module " + fullname + "?");
  if (!really) throw "Canceled";
  return fullname;
}

async function _searchForExistingFiles(vmEditor, rootURL, p) {
  function exclude(webR) {
    var url = webR.getURL();
    if ([".git/", "node_modules/", ".optimized-loading-cache/"].include(url.filename()))
      return true;
    if (p) {
      var modules = p.modules.pluck("name");
      if (modules.include(String(url))) return true;
    }
    return false;
  }

  var found = await _recursiveFileListWeb(rootURL.asWebResource(), exclude, 0, 2),
      candidates = [{
        isListItem: true,
        string: "[create new module]",
        value: "[create new module]"}
      ].concat(found
        .filter(ea => ea.endsWith(".js") || ea.endsWith(".sl"))
        .map(ea => ({isListItem: true, string: ea, value: ea}))),
      answer = await $world.filterableListPrompt("What module to load?", {
        filterLabel: "filter: ",
        list: candidates,
        multiselect: true,
        extent: pt(vmEditor.width(), 400)
      });

  if (answer.status === "canceled" || !answer.selected.length)
    throw "Canceled";

  return answer.selected;
}

async function _createAndLoadModules(system, fullnames) {
  if (!Array.isArray(fullnames)) fullnames = [fullnames];
  var results = [];
  for (let fullname of fullnames) {
    await system.forgetModule(fullname, {forgetDeps: false, forgetEnv: false});
    // ensure file record is created to display file in graph even if load
    // error occurs:
    await system.importModule(fullname).catch(err => "...");
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

function _recursiveFileListWeb(webR, exclude, depth, maxDepth) {
  if (!depth) depth = 0;
  if (!maxDepth) maxDepth = 3;

  return new Promise((resolve, reject) => {

    if (depth > maxDepth || (exclude && exclude(webR))) return resolve([]);

    webR.beAsync().getSubElements(1).whenDone((_, status) => {
      if (!status.isSuccess()) reject(new Error(String(status)));

      var dirs = webR.subCollections.filter(ea => !exclude(ea)),
          docs = webR.subDocuments.filter(ea => !exclude(ea))
      Promise.all(
        dirs.concat(docs).invoke("getURL").invoke("toString")
          .concat(dirs.map(ea => _recursiveFileListWeb(ea, exclude, depth+1, maxDepth))))
        .then(results => results.flatten()).then(resolve);
    });
  });
}
