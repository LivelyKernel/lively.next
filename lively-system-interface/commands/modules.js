/* global URL */

import { obj, promise, arr } from 'lively.lang';
import { resource } from 'lively.resources';

export function isTestModule (source) {
  try {
    const isTest = source.match(/import.*['"]mocha(-es6)?['"]/) && source.match(/it\(['"]/);
    return isTest;
  } catch (err) { return false; }
}

export function shortModuleName (system, moduleId, itsPackage) {
  const packageAddress = itsPackage && itsPackage.address;
  const shortName = packageAddress && moduleId.indexOf(packageAddress) === 0
    ? moduleId.slice(packageAddress.length).replace(/^\//, '')
    : relative(moduleId);
  return shortName;

  function relative (name) {
    const conf = system.getConfig();
    if (conf && conf.constructor === Promise) return name;
    try {
      return String(new URL(name).relativePathFrom(new URL((system.getConfig()).baseURL)));
    } catch (e) {}
    return name;
  }
}

export async function interactivelyChangeModule (system, moduleName, newSource, options) {
  // options.write, options.eval, ..
  options = { targetModule: moduleName, ...options };
  moduleName = await system.normalize(moduleName);
  await system.moduleSourceChange(moduleName, newSource, options);
  return moduleName;
}

export async function interactivelyReloadModule (system, vmEditor, moduleName, reloadDeps = false, resetEnv = false) {
  vmEditor && vmEditor.setStatusMessage('Reloading ' + moduleName);
  try {
    await system.reloadModule(moduleName, { reloadDeps, resetEnv });
    vmEditor && await vmEditor.updateModuleList();
    vmEditor && vmEditor.setStatusMessage('Reloded ' + moduleName);
  } catch (err) {
    try {
      vmEditor && await vmEditor.updateEditorWithSourceOf(moduleName);
    } catch (e) {}
    vmEditor && vmEditor.showError(err); throw err;
  }
}

export async function interactivelyUnloadModule (system, vmEditor, moduleName) {
  await system.forgetModule(moduleName, { forgetEnv: true, forgetDeps: true });
  vmEditor && await vmEditor.updateModuleList();
}

export async function interactivelyRemoveModule (system, requester, moduleName) {
  // var moduleName = this.state.selection.name
  const fullname = await system.normalize(moduleName);
  const really = await requester.world().confirm(['Really remove file:\n', {}, fullname, { fontStyle: 'italic', fontWeight: 'bold' }, ' ?', {}], { requester, lineWrapping: false });
  if (!really) throw 'Canceled';
  await system.forgetModule(fullname);
  await system.resourceRemove(fullname);
  const p = await system.getPackageForModule(fullname);
  return p;
}

export async function addModule (system, moduleName) {
  const namesAndErrors = await _createAndLoadModules(system, [moduleName]);
  const errors = arr.compact(namesAndErrors.map(ea => ea.error));
  const hasError = !!errors.length;
  return hasError;
}

export async function interactivelyAddModule (system, requester, relatedPackageOrModuleName) {
  let root = new URL((await system.getConfig()).baseURL);
  const world = requester.world();

  if (relatedPackageOrModuleName) {
    var p = (await system.getPackage(relatedPackageOrModuleName)) ||
         (await system.getPackageForModule(relatedPackageOrModuleName));
    if (p) root = new URL(p.address);
  }

  let candidates = await _searchForExistingFiles(requester, String(root), p);

  if (candidates.includes('[create new module]')) {
    const fullname = await _askForModuleName(system, relatedPackageOrModuleName || String(root), world);
    candidates = [fullname];
  }

  return await _createAndLoadModules(system, candidates);
}

async function _askForModuleName (system, input, world) {
  var input = await world.prompt(
    'Enter module name',
    { input: input, historyId: 'lively.vm-editor-add-module-name' });
  if (!input) throw 'Canceled';
  const fullname = await system.normalize(input);
  const really = await world.confirm(['Create module \n', {}, fullname, { fontStyle: 'italic' }, ' ?', {}], { lineWrapping: false });
  if (!really) throw 'Canceled';
  return fullname;
}

async function _searchForExistingFiles (requester, rootURL, p) {
  if (String(rootURL).match(/^http/)) {
    return _searchForExistingFilesWeb(requester, rootURL, p);
  } else {
    return _searchForExistingFilesManually(requester, rootURL, p);
  }
}

async function _searchForExistingFilesManually (requester, rootURL, p) {
  const choice = await requester.world().multipleChoicePrompt(
    'Add Module', { requester, choices: ['Create New Module', 'Load Existing Module'] });
  if (choice === 'Create New Module') return '[create new module]';
  if (choice === 'Load Existing Module') {
    const result = await requester.world().prompt('URL of module?', {
      input: rootURL,
      requester,
      historyId: 'lively.vm._searchForExistingFilesManually.url-of-module'
    });
    if (result) return [result];
  }
  throw 'Canceled';
}

async function _searchForExistingFilesWeb (requester, rootURL, p) {
  const world = requester.world(); let loadingIndicator;

  function exclude (resource) {
    const name = resource.name();
    if (['.git', 'node_modules', '.optimized-loading-cache', '.module_cache'].includes(resource.name())) { return true; }
    if (p) {
      const modules = arr.pluck(p.modules, 'name');
      if (modules.includes(resource.url)) return true;
    }
    return false;
  }

  if (world) {
    loadingIndicator = world.showLoadingIndicatorFor(requester, 'Loading existing modules...');
  }

  const found = await (await resource(rootURL).dirList(5, { exclude })).map(ea => ea.url);
  const candidates = [{
    isListItem: true,
    string: '[create new module]',
    value: '[create new module]'
  }].concat(found
    .filter(ea => ea.endsWith('.js'))
    .map(name => {
      let shortName = name;
      shortName = p && name.indexOf(p.address) == 0
        ? p.name + name.slice(p.address.length)
        : name;
      return { isListItem: true, string: shortName, value: name };
    }));
  const answer = await Promise.resolve(loadingIndicator && loadingIndicator.remove()).then(() =>
    requester.world().filterableListPrompt('What module to load?', candidates, {
      filterLabel: 'filter: ',
      multiselect: true,
      requester,
      ...(requester ? { extent: requester.bounds().extent().withY(400).subXY(50, 0) } : {})
    }));

  if (!answer || answer.status === 'canceled' || !answer.selected.length) { throw 'Canceled'; }

  let result = answer.selected || answer;
  if (!Array.isArray(result)) result = [result];
  return result;
}

async function _createAndLoadModules (system, fullnames) {
  if (!Array.isArray(fullnames)) fullnames = [fullnames];
  const results = [];
  for (const fullname of fullnames) {
    await system.forgetModule(fullname, { forgetDeps: false, forgetEnv: false });
    // ensure file record is created to display file in graph even if load
    // error occurs:
    const res = await system.resourceEnsureExistance(fullname, '"format esm";\n');

    system;

    // if this is a test module, then load es6-mocha
    if (isTestModule(await res.read())) {
      if (!System.global.Mocha || !System.global.chai) {
        await System.import('mocha-es6');
        await promise.waitFor(() => !!System.global.Mocha && !!System.global.chai);
      }
    }

    try {
      await system.importModule(fullname);
      results.push({ name: fullname });
    } catch (err) {
      results.push({ name: fullname, error: err });
    }
  }
  return results;
}

function modulesInPackage_defaultExclude (res) {
  if (['.git', 'node_modules', '.optimized-loading-cache', '.module_cache'].includes(res.name())) {
    return true;
  }
  return false;
}

export async function modulesInPackage (system, packageName) {
  const p = await system.getPackage(packageName);
  if (!p || !p.address.match(/^http/)) {
    throw new Error(`Cannot load package ${packageName}`);
  }

  const res = resource(p.address); const found = [];
  for (const { url } of await res.dirList(5, { exclude: modulesInPackage_defaultExclude })) {
    if (url.match(/\.js$/) && system.isModuleLoaded(url, true/* isNormalized */)) { found.push(system.getModule(url)); }
  }
  return found;
}
