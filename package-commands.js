/*global System*/

import { getPackage, getPackageForModule, parseJsonLikeObj } from "./index.js";

import * as modules from "lively.modules";

import { resource, createFiles } from "lively.resources";

// createPackageWithVmEditor($morph("lively.vm-editor").targetMorph);

export async function loadPackage(vmEditor, packageSpec) {
  await modules.importPackage(packageSpec.address);
  if (packageSpec.main) await modules.System.import(packageSpec.main.toString());
  if (packageSpec.test) await modules.System.import(packageSpec.test.toString());
  await vmEditor.updateModuleList();
  await vmEditor.uiSelect(packageSpec);
  vmEditor.focus();
}

export async function interactivelyCreatePackage(vmEditor) {
  var name = await $world.prompt("Enter package name", {input: "", historyId: "lively.vm-editor-add-package-name", useLastInput: true});
  if (!name) throw "Canceled";

  var guessedAddress = modules.System.normalizeSync(
    resource(modules.System.baseURL).join(name).asDirectory().url).replace(/\/\.js$/, "/");

  if (guessedAddress.endsWith(".js"))
    guessedAddress = resource(guessedAddress).parent().url;

  var loc = await $world.prompt("Confirm or change package location", {input: guessedAddress, historyId: "lively.vm-editor-add-package-address"});
  
  if (!loc) throw "Canceled";

  var url = resource(loc).asDirectory(),
      address = url.asFile().url

  await modules.removePackage(address);

  await createFiles(address, {
    "index.js": "'format esm';\n",
    "package.json": `{\n  "name": "${name}",\n  "version": "0.1.0"\n}`,
    ".gitignore": "node_modules/",
    "README.md": `#${name}\n\nNo description for ${name} yet.\n`,
    "tests": {
      "test.js": `import { expect } from "mocha-es6";\ndescribe("${name}", () => {\n  it("works", () => {\n    expect(1 + 2).equals(3);\n  });\n});`
    }
  });

  return loadPackage(vmEditor, {
    name: name,
    address: address,
    url: url,
    configFile: url.join("package.json").url,
    main: url.join("index.js").url,
    test: url.join("tests/test.js").url,
    type: "package"
  });

}

export async function interactivelyLoadPackage(vmEditor) {

  var spec = {name: "", address: "", type: "package"}

  var candidate = await new Promise((resolve, reject) => {
    lively.ide.CommandLineSearch.interactivelyChooseFileSystemItem(
      'choose package directory: ',
      lively.shell.WORKSPACE_LK,
      files => files.filterByKey('isDirectory'),
      "lively.vm-load-package-chooser",
      [resolve]);
  })

  var path = candidate.path,
      asURL = new URL("file://" + path),
      base = new URL("file://" + lively.shell.WORKSPACE_LK),
      relative = asURL.relativePathFrom(base);

  if (relative.include("..")) {
    throw new Error(`The package path ${relative} is not inside the Lively directory (${lively.shell.WORKSPACE_LK})`)
  }

  var address = URL.root.withFilename(relative);
  spec.address = address.toString().replace(/\/$/, "");
  spec.url = new URL(spec.address + "/");

  // get the package name
  try {
    var {output} = await lively.shell.cat(
          lively.lang.string.joinPath(path, "package.json"))
    JSON.parse(output).name
  } catch (e) {
    spec.name = asURL.filename().replace(/\/$/, "");
  }

  var config = resource(spec.address).join("package.json");
  config.ensureExistance(`{\n  "name": "${spec.name}",\n  "version": "0.1.0"\n}`);
  spec.configFile = config.url;

  return loadPackage(vmEditor, spec);
}

export async function interactivelyReloadPackage(vmEditor, packageURL) {
  var name = resource(await System.normalize(packageURL)).asFile().url;
  var p = getPackage(name) || getPackageForModule(name);
  if (!p) throw new Error("Cannot find package for " + name);

  await modules.reloadPackage(name);
  await vmEditor.updateModuleList();
  return await vmEditor.uiSelect(name, false);
}

export async function interactivelyUnloadPackage(vmEditor, packageURL) {
  var p = getPackage(packageURL);
  var really = await $world.confirm(`Unload package ${p.name}??`);
  if (!really) throw "Canceled";
  modules.removePackage(packageURL)
  await vmEditor.updateModuleList()
  await vmEditor.uiSelect(null);
}

export async function interactivelyRemovePackage(vmEditor, packageURL) {
  var p = getPackage(packageURL);
  modules.removePackage(packageURL)
  var really = await $world.confirm(`Also remove directory ${p.name} including ${p.modules.length} modules?`);
  if (really) {
    var really2 = await $world.confirm(`REALLY *remove* directory ${p.name}? No undo possible...`);
    if (really2) await resource(p.address).remove();
  }
  await vmEditor.updateModuleList()
  await vmEditor.uiSelect(null);
}

export async function packageConfChange(vmEditor, source, confFile) {

  var S = modules.System;
  var config = parseJsonLikeObj(source);
  await resource(confFile).write(JSON.stringify(config, null, 2));

  var p = getPackageForModule(confFile);
  S.set(confFile, S.newModule(config));
  if (p && config.systemjs) S.packages[p.address] = config.systemjs;
  if (p && config.systemjs) S.config({packages: {[p.address]: config.systemjs}})
  if (p) lively.modules.applyPackageConfig(config, p.address);
}

// showExportsAndImportsOf("http://localhost:9001/packages/lively-system-interface/")
export async function showExportsAndImportsOf(packageAddress) {
  var p = getPackage(packageAddress);

  if (!p)
    throw new Error("Cannot find package " + packageAddress)

  var reports = [];
  for (let mod of p.modules) {
    if (!mod.name.match(/\.js$/)) continue;
    
    var importsExports = await lively.modules.importsAndExportsOf(mod.name);
    var report = `${mod.name}`;
        
    if (!importsExports.imports.length && !importsExports.exports.length)
      return report += "\n  does not import / export anything";

    if (importsExports.imports.length) {
      report += "\n  imports:\n"
      report += importsExports.imports
        .groupByKey("fromModule").mapGroups((from, imports) =>
          `from ${from}: `
            + imports.map(ea =>
              !ea.local && !ea.imported ?
                "nothing imported" :
                (!ea.imported || ea.imported === ea.local) ?
                  ea.local :
                  `${ea.imported} as ${ea.local}`).join(", "))
        .toArray().join("\n")
        .split("\n").map(ea => ea = "    " + ea).join("\n");
    }

    if (importsExports.exports.length) {
      report += "\n  exports:\n";
      report += importsExports.exports
        .map(ea =>
          !ea.local ?
            `${ea.exported} from ${ea.fromModule}` :
            !ea.local || ea.local === ea.exported ?
              ea.exported :
              `${ea.local} as ${ea.exported}`)
        .join(", ")
        .split("\n").map(ea => ea = "    " + ea).join("\n");
    }

    reports.push(report);
  }

  $world.addCodeEditor({
    title: "imports and exports of " + packageAddress,
    content: reports.join("\n\n"),
    textMode: "text",
    extent: pt(700, 700)
  }).getWindow().comeForward();
}
