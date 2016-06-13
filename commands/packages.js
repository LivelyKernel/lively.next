import { parseJsonLikeObj } from "../helpers.js";
import { resource } from "lively.resources";

async function loadPackage(system, vmEditor, packageSpec) {
  await system.importPackage(packageSpec.address);
  if (packageSpec.main) await system.importModule(packageSpec.main.toString());
  if (packageSpec.test) await system.importModule(packageSpec.test.toString());
  await vmEditor.updateModuleList();
  await vmEditor.uiSelect(packageSpec);
  vmEditor.focus();
}

export async function interactivelyCreatePackage(system, vmEditor) {
  var name = await $world.prompt("Enter package name", {input: "", historyId: "lively.vm-editor-add-package-name", useLastInput: true});
  if (!name) throw "Canceled";

  var guessedAddress = (await system.normalize(
    resource(system.getConfig().baseURL).join(name).asDirectory().url)).replace(/\/\.js$/, "/");

  if (guessedAddress.endsWith(".js"))
    guessedAddress = resource(guessedAddress).parent().url;

  var loc = await $world.prompt("Confirm or change package location", {input: guessedAddress, historyId: "lively.vm-editor-add-package-address"});
  
  if (!loc) throw "Canceled";

  var url = resource(loc).asDirectory(),
      address = url.asFile().url

  await system.removePackage(address);

  await system.resourceCreateFiles(address, {
    "index.js": "'format esm';\n",
    "package.json": `{\n  "name": "${name}",\n  "version": "0.1.0"\n}`,
    ".gitignore": "node_modules/",
    "README.md": `# ${name}\n\nNo description for package ${name} yet.\n`,
    "tests": {
      "test.js": `import { expect } from "mocha-es6";\ndescribe("${name}", () => {\n  it("works", () => {\n    expect(1 + 2).equals(3);\n  });\n});`
    }
  });

  return loadPackage(system, vmEditor, {
    name: name,
    address: address,
    configFile: url.join("package.json").url,
    main: url.join("index.js").url,
    test: url.join("tests/test.js").url,
    type: "package"
  });

}

export async function interactivelyLoadPackage(system, vmEditor) {

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
    var {output} = await lively.shell.cat(path + "/package.json")
    JSON.parse(output).name
  } catch (e) {
    spec.name = asURL.filename().replace(/\/$/, "");
  }

  var config = resource(spec.address).join("package.json");
  system.resourceEnsureExistance(config.url, `{\n  "name": "${spec.name}",\n  "version": "0.1.0"\n}`);
  spec.configFile = config.url;

  return loadPackage(system, vmEditor, spec);
}

export async function interactivelyReloadPackage(system, vmEditor, packageURL) {
  var name = resource(await system.normalize(packageURL)).asFile().url;
  var p = system.getPackage(name) || system.getPackageForModule(name);
  if (!p) throw new Error("Cannot find package for " + name);

  await system.reloadPackage(name);
  await vmEditor.updateModuleList();
  return await vmEditor.uiSelect(name, false);
}

export async function interactivelyUnloadPackage(system, vmEditor, packageURL) {
  var p = system.getPackage(packageURL);
  var really = await $world.confirm(`Unload package ${p.name}??`);
  if (!really) throw "Canceled";
  await system.removePackage(packageURL);
  await vmEditor.updateModuleList();
  await vmEditor.uiSelect(null);
}

export async function interactivelyRemovePackage(system, vmEditor, packageURL) {
  var p = system.getPackage(packageURL);
  var really = await $world.confirm(`Really remove package ${p.name}??`);
  if (!really) throw "Cancelled";
  system.removePackage(packageURL);
  var really2 = await $world.confirm(`Also remove directory ${p.name} including ${p.modules.length} modules?`);
  if (really2) {
    var really3 = await $world.confirm(`REALLY *remove* directory ${p.name}? No undo possible...`);
    if (really3) await system.resourceRemove(p.address);
  }
  await vmEditor.updateModuleList()
  await vmEditor.uiSelect(null);
}

// showExportsAndImportsOf("http://localhost:9001/packages/lively-system-interface/")
export async function showExportsAndImportsOf(system, packageAddress) {
  var p = system.getPackage(packageAddress);

  if (!p)
    throw new Error("Cannot find package " + packageAddress)

  var reports = [];
  for (let mod of p.modules) {
    if (!mod.name.match(/\.js$/)) continue;
    
    var importsExports = await system.importsAndExportsOf(mod.name, await system.moduleRead(mod.name));
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
