/*global System,process,global*/

import { join as j } from "path";
import fs from "fs";
import { tmpdir } from "os";
import semver from "./semver.min.js"
import { getInstalledPackages, installPackage, getInstalledPackage } from "./package-download.js";
import { depGraph, buildStages } from "./dependencies.js";
import { x, npmFallbackEnv } from "./util.js";
import { execSync } from "child_process";

const helperBinDir = System.decanonicalize("npm-helper/bin").replace(/file:\/\//, ""),
      nodeCentralPackageBin = j(helperBinDir, "node");

const npmEnv = (() => {
  try {
    let dir = j(tmpdir(), "npm-test-env-project");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(j(dir, "package.json"), `{"scripts": {"print-env": "${nodeCentralPackageBin} ./print-env.js"}}`);
    fs.writeFileSync(j(dir, "print-env.js"), `console.log(JSON.stringify(process.env))`);
    let env = JSON.parse(execSync(`npm --silent run print-env`, {cwd: dir}))
    for (let key in env)
      if (!key.toLowerCase().startsWith("npm") || key.toLowerCase().startsWith("npm_package"))
        delete env[key];
    return env;
  } catch (err) {
    console.warn(`Cannot figure out real npm env`);
    return {};
  } finally {
    try {
      fs.unlinkSync(j(dir, "package.json"));
      fs.unlinkSync(j(dir, "print-env.js"));
      fs.rmdirSync(dir);
    } catch (err) {}
  }
})();

  // npm_execpath: '/Users/robert/.nvm/versions/node/v7.7.4/lib/node_modules/npm/bin/npm-cli.js',
// String(execSync("which node")).trim()



function npmCreateEnvVars(configObj, env = {}, path = "npm_package") {
  if (Array.isArray(configObj))
    configObj.forEach((ea, i) => add(i, configObj[i]));
  else
    Object.keys(configObj).forEach(name => add(name, configObj[name]));
  return env;

  function add(key, val) {
    key = String(key).replace(/[-\.]/g, "_");
    if (typeof val === "object") npmCreateEnvVars(val, env, path + "_" + key);
    else env[path + "_" + key] = String(val);
  }

  return env;
}

function linkBins(packageSpecs, linkState = {}) {
  let linkLocation = j(tmpdir(), "npm-helper-bin-dir");
  if (!fs.existsSync(linkLocation)) fs.mkdirSync(linkLocation);
  packageSpecs.forEach(({bin, location}) => {
    if (!bin) return;
    if (linkState[location]) return;
    for (let linkName in bin) {
      let realFile = bin[linkName];
      if (fs.existsSync(j(linkLocation, linkName))) 
        fs.unlinkSync(j(linkLocation, linkName));
      fs.symlinkSync(j(location, realFile), j(linkLocation, linkName));
    }
    linkState[location] = true;
  });
  return linkLocation;
}

class BuildProcess {

  constructor(buildStages, packageDir) {
    this.buildStages = buildStages; // 2d list, package specs in sorted order
    this.packageDir = packageDir;
    this.builtPackages = [];
    this.binLinkState = {};
    this.binLinkLocation = "";
  }

  async run() {
    let {buildStages, packageDir} = this,
        i = 1, n = buildStages.length;
    console.log(`Running build stage ${i}/${n}`)
  
    while (buildStages.length) {
      let stage = buildStages[0];
      if (!stage.length) { buildStages.shift(); continue; }
      let next = stage[0],
          packageSpec = getInstalledPackage(...[...next.split("@"), packageDir]);
      if (!packageSpec) throw new Error(`package ${next} cannot be found (in ${packageDir})`);
      console.log(`Running build for ${next}`);
      await this.build(packageSpec);
      stage.shift();
    }
  }

  async build(packageSpec) {
    this.binLinkLocation = linkBins([...this.builtPackages, packageSpec], this.binLinkState);
    let env = npmCreateEnvVars(packageSpec.config);

    console.log(`[build ${packageSpec.config.name}]`);
    await this.runScript("preinstall",  packageSpec, env);
    await this.runScript("install",     packageSpec, env);
    await this.runScript("postinstall", packageSpec, env);

    this.builtPackages.push(packageSpec);
  }

  async runScript(scriptName, {config, location, scripts}, env) {
    if (!scripts || !scripts[scriptName]) return false;
    console.log(`[build ${config.name}] running ${scriptName}`);
    let PATH = `${this.binLinkLocation}:${helperBinDir}:${process.env.PATH}`;
    env = {
      ...process.env,
      ...npmFallbackEnv,
      ...npmEnv,
      ...env,
      npm_lifecycle_event: scriptName,
      npm_lifecycle_script: scripts[scriptName].split(" ")[0],
      PATH
    };

global.context = {scriptName, config, location, scripts, env};

    try {
      return await x(`/bin/sh -c '${scripts[scriptName]}'`, {verbose: true, cwd: location, env});
    } catch (err) {
      console.error(`[build ${config.name}] error running ${scripts[scriptName]}:`);
      console.error(err);
      throw err;
    }
  }

}


// await installPackage("lively.user", packageDir)
// await installPackage("pouchdb", packageDir)
// process.env.CENTRAL_NODE_PACKAGE_DIR = "/Users/robert/.central-node-packages"
// let packageDir = process.env.CENTRAL_NODE_PACKAGE_DIR
// let packages = getInstalledPackages(packageDir)
// let p = getInstalledPackage("pouchdb", null, packageDir)
// let p = await getInstalledPackage("lively.user", undefined, packageDir);

// let stages = buildStages(`${p.config.name}@${p.config.version}`, packageDir)
// let build = new BuildProcess(stages, packageDir);
// await build.run()


// context.env
// await x(`/bin/sh -c 'env'`, {cwd: context.location, env: context.env});