import { join,read } from "./helpers.js";
import { Package } from "./package.js";

var packageSpecFile = System.decanonicalize("lively.installer/packages-config.json");

async function readPackageSpec() {
  return JSON.parse(System.get("@system-env").browser ?
    await (await fetch(packageSpecFile)).text() :
    await read(packageSpecFile));
}

async function printSummaryFor(p, packages) {
  var report = `Package ${p.name} at ${p.directory}`
  if (!await p.exists()) return report + " does not exist"

  var deps = p.findDependenciesIn(packages);
  report += "\n  => dependencies:";
  if (!deps.length) report += " none";
  else report += "\n    " + deps.map(ea => ea.name).join("\n    ")
  
  var r = p.repo();

  report += "\n  => git status:\n";
  var branch = await r.currentBranch();
  if (!branch) report += "    not on a branch\n"
  else report += `    on branch ${branch}\n`;
  
  report += `    local changes? ${(await r.hasLocalChanges()) ? "yes" : "no"}\n`;
  report += `    remote changes? ${(await r.hasRemoteChanges(p.config.branch)) ? "yes" : "no"}\n`;
  
  return report;
}

async function summaryForPackages(packages) {
  var summaries = await Promise.all(packages.map(ea => printSummaryFor(ea, packages)));
  return summaries.join("\n")
}

export async function openPackageSummary(baseDir) {
  // openPackageSummary("/Users/robert/Lively/lively-dev-2")
  try {
    var i = await lively.ide.withLoadingIndicatorDo("computing summary...");
    var packages = await Promise.all((await readPackageSpec()).map(spec =>
      new Package(join(baseDir, spec.name), spec).readConfig()))
    var summary = await summaryForPackages(packages);
    
    return $world.addCodeEditor({
      title: "package status summary",
      textMode: "text",
      content: summary,
      extent: pt(600, 800)
    }).getWindow().comeForward();

  } finally { i.remove(); }
  
}
