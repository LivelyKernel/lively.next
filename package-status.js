"format esm";

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

  report += "\n  => git status:\n";
  var branch = await p.repo.currentBranch();
  if (!branch) report += "    not on a branch\n"
  else report += `    on branch ${branch}\n`;
  
  report += `    local changes? ${(await p.repo.hasLocalChanges()) ? "yes" : "no"}\n`;
  report += `    remote changes? ${(await p.repo.hasRemoteChanges(p.config.branch)) ? "yes" : "no"}\n`;
  
  return report;
}

async function summaryForPackages(packages) {
  var summaries = await Promise.all(packages.map(ea => printSummaryFor(ea, packages)));
  return summaries.join("\n")
}