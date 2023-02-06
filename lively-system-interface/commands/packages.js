/* global URL */
import { arr } from 'lively.lang';
import { resource } from 'lively.resources';

export async function loadPackage (system, spec) {
  await system.importPackage(spec.address + '/');
  if (spec.main) await system.importModule(spec.main.toString());
  if (spec.test) {
    try {
      // FIXME: system should have an interface for test runs...!
      let mochaEs6 = await system.importPackage('mocha-es6');
      await mochaEs6.installSystemInstantiateHook();
      await system.importModule(spec.test.toString());
    } catch (e) {
      console.warn(`Cannot load test of new package: ${e}`); // eslint-disable-line no-console
    }
  }

  return system.getPackage(spec.address);
}

export async function interactivelyCreatePackage (system, requester) {
  let world = requester.world();
  let name = await world.prompt('Enter package name', {
    requester,
    input: '',
    historyId: 'lively.vm-editor-add-package-name',
    useLastInput: true
  });

  if (!name) throw 'Canceled';

  let guessedAddress;
  try {
    let res = resource(name);
    name = res.name();
    guessedAddress = res.url;
  } catch (e) {
    let baseURL = (await system.getConfig()).baseURL;
    let maybePackageDir = resource(baseURL).join(name).asDirectory().url;
    guessedAddress = (await system.normalize(maybePackageDir)).replace(/\/\.js$/, '/');
  }

  let loc = await world.prompt('Confirm or change package location', {
    requester,
    input: guessedAddress,
    historyId: 'lively.vm-editor-add-package-address'
  });

  if (!loc) throw 'Canceled';

  let url = resource(loc).asDirectory();
  let address = url.asFile().url;

  await system.removePackage(address);

  await system.resourceCreateFiles(address, {
    'index.js': "'format esm';\n",
    'package.json': `{\n  "name": "${name}",\n  "version": "0.1.0"\n}`,
    '.gitignore': 'node_modules/',
    'README.md': `# ${name}\n\nNo description for package ${name} yet.\n`,
    tests: {
      'test.js': `import { expect } from "mocha-es6";\ndescribe("${name}", () => {\n  it("works", () => {\n    expect(1 + 2).equals(3);\n  });\n});`
    }
  });

  return loadPackage(system, {
    name: name,
    address: address,
    configFile: url.join('package.json').url,
    main: url.join('index.js').url,
    test: url.join('tests/test.js').url,
    type: 'package'
  });
}

export async function interactivelyLoadPackage (system, requester, relatedPackageAddress = null) {
  // var vmEditor = that.owner;
  // var system = vmEditor.systemInterface()
  let relatedPackage;
  let spec = { name: '', address: '', type: 'package' };

  let config = await system.getConfig();
  if (relatedPackageAddress) {
    relatedPackage = await system.getPackage(relatedPackageAddress) ||
                      await system.getPackageForModule(relatedPackageAddress);
  }

  let packageCandidates = await resource(config.baseURL).dirList(2, {
    exclude: dir => {
      return dir.isFile() && !dir.name().endsWith('package.json');
    }
  });
  packageCandidates = packageCandidates.filter(dir => dir.name().endsWith('package.json')).map(f => f.parent());
  let [dir] = (await requester.world().filterableListPrompt('Select package directory', [{ isListItem: true, label: 'Enter custom package...', value: 'custom' }, ...packageCandidates.map(m => m.url)], {
    multiSelect: false
  })).selected;
  if (dir === 'custom') {
    dir = await requester.world().prompt('What is the package directory?', {
      requester,
      input: relatedPackage ? relatedPackage.address : config.baseURL,
      historyId: 'lively.vm-editor-package-load-history',
      useLastInput: false
    });
  }

  if (!dir) throw 'Canceled';

  // if (dir.indexOf(URL.root.protocol) === 0) {
  //   var relative = new URL(dir).relativePathFrom(URL.root);
  //   if (relative.include("..")) {
  //     throw new Error(`The package path ${relative} is not inside the Lively directory (${URL.root})`)
  //   }
  // }

  spec.address = dir.replace(/\/$/, '');
  spec.url = new URL(spec.address + '/');
  spec.configFile = resource(spec.url).join('package.json').url;

  try {
    JSON.parse(await system.moduleRead(spec.configFile)).name;
  } catch (e) {
    spec.name = String(spec.url).replace(/\/$/, '');
    system.resourceEnsureExistance(spec.configFile, `{\n  "name": "${spec.name}",\n  "version": "0.1.0"\n}`);
  }

  return loadPackage(system, spec);
}

export async function interactivelyReloadPackage (system, vmEditor, packageURL) {
  let name = resource(packageURL).asFile().url;
  let p = (await system.getPackage(name)) || (await system.getPackageForModule(name));
  if (!p) throw new Error('Cannot find package for ' + name);

  await system.reloadPackage(name);

  if (vmEditor) {
    await vmEditor.updateModuleList();
    return await vmEditor.uiSelect(name, false);
  }
}

export async function interactivelyUnloadPackage (system, vmEditor, packageURL, world) {
  let p = await system.getPackage(packageURL);
  let really = await (world || $world).confirm(`Unload package ${p.name}?`, { requester: vmEditor });
  if (!really) throw 'Canceled';
  await system.removePackage(packageURL);

  if (vmEditor) {
    await vmEditor.updateModuleList();
    await vmEditor.uiSelect(null);
  }
}

export async function interactivelyRemovePackage (system, requester, packageURL) {
  let world = requester.world();
  let p = await system.getPackage(packageURL);

  if (!p) {
    $world.inform(`No package "${packageURL}" found!`, { requester });
    return;
  }

  let really = await world.confirm(`Really remove package ${p.name}?`, { requester });

  if (!really) throw 'Canceled';

  system.removePackage(packageURL);

  let really2 = await world.confirm(
    `Also remove directory ${p.name} including ${p.modules.length} modules?`);
  if (really2) {
    let really3 = await world.confirm(
      `REALLY *remove* directory ${p.name}? No undo possible...`);
    if (really3) await system.resourceRemove(p.address);
  }
}

// showExportsAndImportsOf("http://localhost:9001/packages/lively-system-interface/")
export async function showExportsAndImportsOf (system, packageAddress, world = $world) {
  let p = await system.getPackage(packageAddress);
  let importsExports;

  if (!p) { throw new Error('Cannot find package ' + packageAddress); }

  let reports = [];
  for (let mod of p.modules) {
    if (!mod.name.match(/\.js$/)) continue;

    try {
      importsExports = await system.importsAndExportsOf(mod.name, await system.moduleRead(mod.name));
    } catch (e) {
      world.logError(new Error(`Error when getting imports/exports from module ${mod.name}:\n${e.stack}`));
      continue;
    }

    let report = `${mod.name}`;

    if (!importsExports.imports.length && !importsExports.exports.length) {
      report += '\n  does not import / export anything';
      continue;
    }

    if (importsExports.imports.length) {
      report += '\n  imports:\n';
      report += arr.groupByKey(importsExports.imports, 'fromModule')
        .mapGroups((from, imports) =>
          `from ${from}: ` +
            imports.map(ea =>
              !ea.local && !ea.imported
                ? 'nothing imported'
                : (!ea.imported || ea.imported === ea.local)
                    ? ea.local
                    : `${ea.imported} as ${ea.local}`).join(', '))
        .toArray().join('\n')
        .split('\n').map(ea => ea = '    ' + ea).join('\n');
    }

    if (importsExports.exports.length) {
      report += '\n  exports:\n';
      report += importsExports.exports
        .map(ea =>
          !ea.local
            ? `${ea.exported} from ${ea.fromModule}`
            : !ea.local || ea.local === ea.exported
                ? ea.exported
                : `${ea.local} as ${ea.exported}`)
        .join(', ')
        .split('\n').map(ea => ea = '    ' + ea).join('\n');
    }

    reports.push(report);
  }

  await world.execCommand('open text window', {
    title: 'imports and exports of ' + packageAddress,
    content: reports.join('\n\n')
  });
}
