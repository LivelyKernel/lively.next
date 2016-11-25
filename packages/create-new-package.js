export default interactivelyCreateNewLocalPackage;

import { defaultDirectory, runCommand } from "lively.morphic/ide/shell/shell-interface.js";
import Terminal from "lively.morphic/ide/shell/terminal.js";
import { resource } from "lively.resources";

async function interactivelyCreateNewLocalPackage() {
  var join = lively.lang.string.joinPath;

  // query dir + name
  var dir = await $$world.prompt("Enter the package directory",
    {input: defaultDirectory(), historyId: "create-new-package-dir-history", useLastInput: true});
  if (!dir) throw new Error("Canceled");
  
  var packageName = await $$world.prompt("Package name?", {input: dir.split(/[\/\\]/).slice(-1)[0]});
  if (!packageName) throw new Error("Canceled");
  
  // ensure dir
  var {exitCode, output} = await runCommand(`mkdir -p ${dir}`).whenDone();
  if (exitCode) throw new Error(`creating directory ${dir} failed:\n${output}`);
  
  // create package files
  await Promise.all([
    resource(join(dir, "package.json")).write(`{\n  "name": "${packageName}",\n  "version": "0.1.0"\n}`),
    resource(join(dir, ".gitignore")).write("node_modules\n"),
    resource(join(dir, "index.js")).write(`"format esm";\n`),
  ]).catch(err => { throw new Error(`could not create package files: ${err}`) })
  
  // git init
  var {exitCode, output} = await runCommand("git init && git add * && git commit -am 'initial'", {cwd: dir}).whenDone();
  if (exitCode) throw new Error(`Git init did not work:\n${output}`);
  
  var url = await $$world.prompt(`Enter the URL for ${packageName}, under which it accessible in the browser`, {input: document.location.origin + "/" + dir.split(/[\\\/]/).slice(-1)[0]})

  // import it
  return url ? lively.modules.importPackage(String(url)) : null;
}
