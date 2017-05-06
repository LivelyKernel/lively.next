/*global System,process,global,require,module,__dirname*/
import { join as j } from "path";
import fs from "fs";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { buildStages } from "./dependencies.js";
import { x, npmFallbackEnv } from "./util.js";
import { findMatchingPackageSpec } from "./lookup.js";

const dir = typeof __dirname !== "undefined"
        ? __dirname
        : System.decanonicalize("flat-node-packages/").replace("file://", ""),
      helperBinDir = j(dir, "bin"),
      nodeCentralPackageBin = j(helperBinDir, "node");

const npmEnv = (() => {
  let cacheFile = j(tmpdir(), "npm-env.json"), env;
  if (fs.existsSync(cacheFile)) {
    let cached = JSON.parse(String(fs.readFileSync(cacheFile)))
    if (Date.now() - cached.time < 1000*60) return cached.env;
  }
  try {
    var dir = j(tmpdir(), "npm-test-env-project");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(j(dir, "package.json"), `{"scripts": {"print-env": "${process.env.npm_node_execpath || "node"} ./print-env.js"}}`);
    fs.writeFileSync(j(dir, "print-env.js"), `console.log(JSON.stringify(process.env))`);
    let PATH = process.env.PATH.split(":").filter(ea => ea !== helperBinDir).join(":")
    env = JSON.parse(String(execSync(`npm --silent run print-env`, {cwd: dir, env: Object.assign({}, process.env, {PATH})})));
    for (let key in env)
      if (!key.toLowerCase().startsWith("npm") || key.toLowerCase().startsWith("npm_package"))
        delete env[key];
  } catch (err) {
    console.warn(`Cannot figure out real npm env, ${err}`);
    env = {};
  } finally {
    try {
      fs.unlinkSync(j(dir, "package.json"));
      fs.unlinkSync(j(dir, "print-env.js"));
      fs.rmdirSync(dir);
    } catch (err) {}
  }
  fs.writeFileSync(cacheFile, JSON.stringify({time: Date.now(), env}));
  return env;
})();


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
    if (location.startsWith("file://"))
      location = location.replace(/^file:\/\//, "")
    if (!bin) return;
    if (linkState[location]) return;
    for (let linkName in bin) {
      let realFile = bin[linkName];
      try {
        // fs.existsSync follows links, so broken links won't be reported as existing
        fs.lstatSync(j(linkLocation, linkName));
        fs.unlinkSync(j(linkLocation, linkName));
      } catch (err) {}
      // console.log(`[fnp build] linking ${j(location, realFile)} => ${j(linkLocation, linkName)}`)
      fs.symlinkSync(j(location, realFile), j(linkLocation, linkName));
    }
    linkState[location] = true;
  });
  return linkLocation;
}

class BuildProcess {

  static for(packageSpec, packageMap) {
    let stages = buildStages(packageSpec, packageMap);
    return new this(stages, packageMap);
  }

  constructor(buildStages, packageMap) {
    this.buildStages = buildStages; // 2d list, package specs in sorted order
    this.packageMap = packageMap;
    this.builtPackages = [];
    this.binLinkState = {};
    this.binLinkLocation = "";
  }

  async run() {

    // let {buildStages, packageMap} = build
    let {buildStages, packageMap} = this,
        i = 1, n = buildStages.length;

    console.log(`[fnp] Running build stage ${i++}/${n}`)

    while (buildStages.length) {
      let stage = buildStages[0];
      if (!stage.length) {
        buildStages.shift();
        buildStages.length && console.log(`[fnp] Running build stage ${i++}/${n}`);
        continue;
      }
      let next = stage[0],
          [name, version] = next.split("@"),
          packageSpec = findMatchingPackageSpec(name, version, packageMap);
      if (!packageSpec) throw new Error(`[fnp build] package ${next} cannot be found in package map, skipping its build`);

      await this.build(packageSpec);
      stage.shift();
    }
  }

  hasBuiltScripts({config}) {
    return config.scripts && Object.keys(config.scripts).some(scriptName =>
      ["preinstall", "install", "postinstall"].includes(scriptName));
  }

  async build(packageSpec) {
    this.binLinkLocation = linkBins(this.builtPackages.concat([packageSpec]), this.binLinkState);
    let env = npmCreateEnvVars(packageSpec.config);

    if (this.hasBuiltScripts(packageSpec)) {
      console.log(`[fnp] ${packageSpec.config.name} build starting`);
      await this.runScript("preinstall",  packageSpec, env);
      await this.runScript("install",     packageSpec, env);
      await this.runScript("postinstall", packageSpec, env);
      console.log(`[fnp] ${packageSpec.config.name} build done`);
    } else {
      let {name, version} = packageSpec.config;
      console.log(`[fnp] no build scripts for ${name}@${version}`);
    }

    this.builtPackages.push(packageSpec);
  }

  async runScript(scriptName, {config, location, scripts}, env) {
    if (!scripts || !scripts[scriptName]) return false;
    console.log(`[fnp] build ${config.name}: running ${scriptName}`);
    
    env = Object.assign({},
      process.env,
      npmFallbackEnv,
      npmEnv,
      env,
      {
        npm_lifecycle_event: scriptName,
        npm_lifecycle_script: scripts[scriptName].split(" ")[0],
        PATH: `${this.binLinkLocation}:${helperBinDir}:${process.env.PATH}`
      });

    try {
      return await x(`/bin/sh -c '${scripts[scriptName]}'`, {
        verbose: true,
        cwd: location.replace(/^file:\/\//, ""),
        env
      });

    } catch (err) {
      console.error(`[build ${config.name}] error running ${scripts[scriptName]}:\n${err}`);
      if (err.stdout || err.stderr) {
        console.log("The command output:");
        console.log(err.stdout);
        console.log(err.stderr);
      }
      throw err;
    }
  }

}

export { BuildProcess };
