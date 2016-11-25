// publishNewVersion().then(newVersion => show(newVersion)).catch(show.curry("%s"))

import { defaultDirectory, runCommand } from "lively.morphic/ide/shell/shell-interface.js";
import Terminal from "lively.morphic/ide/shell/terminal.js";
import { resource } from "lively.resources";
import { World } from "lively.morphic";

var $$world = World.defaultWorld();

export default interactivelyPublishNewPackageVersion;

async function interactivelyPublishNewPackageVersion() {

  var semver = lively.modules.semver;

  var dir = await $$world.prompt("Enter the package directory",
    {input: defaultDirectory(), historyId: "pusblish-new-package-dir-history", useLastInput: true});

  if (!dir) throw new Error("canceled");

  var {config, configText} = await readConfig(dir);

  if (!await confirmPublish(config)) throw new Error("canceled");

  var newVersion = await $$world.prompt(`The current version is ${config.version}. Please enter the new version number:`, {input: semver.inc(config.version, "patch")});

  if (!newVersion) throw new Error("canceled");

  await addNewVersionToConfig(dir, configText, config.version, newVersion);

  await publishToNPM(dir);

  if (await commitChanges(dir)) { await gitTag(dir, newVersion); await gitPush(dir); }

  return newVersion;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

async function confirmPublish(config) {
  var answer = await $$world.confirm(`Do you want to publish a new version of ${config.name}?`);
  return answer === true || answer === 0;
}

async function readConfig(dir) {
  var output = await resource(dir).join("package.json").read();
  return {config: JSON.parse(output), configText: output};
}

async function addNewVersionToConfig(dir, configText, oldVersion, newVersion) {
  var newConfigText = configText.replace(`"version": "${oldVersion}"`, `"version": "${newVersion}"`);
  await resource(dir).join("package.json").write(newConfigText);
}

async function commitChanges(dir) {
  var {exitCode, output} = await runCommand("git s", {cwd: dir}).whenDone();
  var localChanges = output.match(/not a git repo/i) ? null : output.trim();

  if (!localChanges) return false;

  var changes = lively.lang.string.lines(localChanges);
  if (changes.length > 10) changes = changes.slice(0,10).concat(["..."]);
  var shouldCommit = await $$world.confirm("Local changes exist. Commit them all?\n" + changes.join("\n"));
  if (shouldCommit) {
    var {exitCode, output} = await runCommand("git ci -a", {cwd: dir}).whenDone();
    if (exitCode) throw new Error("Commit canceled");
  } else throw new Error("Local changes exist");
  return true;
}

async function gitTag(dir, tagName) {
  var {exitCode, output} = await runCommand(`git tag "${tagName}"`, {cwd: dir}).whenDone();
  if (exitCode) throw new Error(`git tag failed ${output}`);
}

async function gitPush(dir) {
  var {exitCode, output} = await runCommand("git remote -v | grep origin | head -n 1", {cwd: dir}).whenDone();
  if (exitCode) throw new Error(`git remote -v failed ${output}`);

  var repo = output.split(/[\t\s]/)[1];
  var {exitCode, output} = await runCommand("git branch | grep '*'", {cwd: dir}).whenDone();
  if (exitCode) throw new Error(`git branch failed ${output}`);

  var branch = output.trim().replace(/^\*\s*/, ""),
      push = await $$world.confirm(`Push branch ${branch} to ${repo}?\n`);
  if (push) {
    var runner = await Terminal.runCommand(`git push origin ${branch} && git push --tags`, {cwd: dir});
    var {output, exitCode} = await runner.targetMorph.command.whenDone();
    if (exitCode) throw new Error("git push failed");

    runner.close();
  }
}

async function publishToNPM(dir) {
  var answer = await $$world.confirm(`Publish to npm?`, ["yes", "no"]);
  answer = answer === true || answer === 0;
  if (!answer) return;

  var runner = await Terminal.runCommand("npm publish", {cwd: dir}),
      {output, exitCode} = await runner.targetMorph.command.whenDone();

  if (exitCode) throw new Error("npm publish failed");

  await lively.lang.promise.delay(1000);
  runner.close();
}
