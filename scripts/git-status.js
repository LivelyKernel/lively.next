import { Package } from "lively.installer/package.js";
import { resource } from "lively.resources";

async function report() {
  let installerDir = resource(System.decanonicalize("lively.installer/"));
  let baseDir = installerDir.join("..").withRelativePartsResolved()
  let config = await installerDir.join("packages-config.json").readJson()

  let packages = config.map(ea => new Package(baseDir.join(ea.name).url, ea))

  await Promise.all(packages.map(ea => ea.readConfig()));

  for (const ea of packages) {
    console.log(ea.name);
    var {pull, push} = await ea.repo.needsPullOrPush(ea.config.branch);
    ea.hasLocalChanges = await ea.repo.hasLocalChanges();
    ea.hasRemoteChanges = !!pull
    ea.hasLocalChangesToPush = !!push
    ea.gitBranch = await ea.repo.currentBranch()
  }

  let report = `The following packages have local changes, commit them before updating:\n`
      + `  ${packages.filter(ea => ea.hasLocalChanges).map(ea => ea.directory).join("\n  ")}`
      + `\nThe following packages have changes that can be uploaded:\n`
      + `  ${packages.filter(ea => ea.hasLocalChangesToPush).map(ea => `cd ${ea.directory}; git push origin ${ea.gitBranch}`).join("\n  ")}`
      + `\nThe following packages have updates, run the following commands to update:\n`
      + `  ${packages.filter(ea => ea.hasRemoteChanges).map(ea => `cd ${ea.directory}; git pull`).join("\n  ")}`;

  return report;
}

report()
  .then(r => console.log(r))
  .catch(err => console.error(err)).then(() => process.exit());
