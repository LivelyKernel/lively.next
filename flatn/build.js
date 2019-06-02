/*global System,process,global,require,module,__dirname*/
import { join as j } from "path";
import fs from "fs";
import { tmpdir } from "./util.js";
import { execSync } from "child_process";
import { buildStages } from "./dependencies.js";
import { x, npmFallbackEnv } from "./util.js";

const dir = typeof __dirname !== "undefined"
  ? __dirname
  : System.decanonicalize("flatn/").replace("file://", ""),
  helperBinDir = j(dir, "bin"),
  nodeCentralPackageBin = j(helperBinDir, "node");

let _npmEnv;
function npmEnv() {
  return _npmEnv || (_npmEnv = (() => {
    let cacheFile = j(tmpdir(), "npm-env.json"), env = {};
    if (fs.existsSync(cacheFile)) {
      let cached = JSON.parse(String(fs.readFileSync(cacheFile)))
      if (Date.now() - cached.time < 1000 * 60) return cached.env;
    }
    try {
      var dir = j(tmpdir(), "npm-test-env-project");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      fs.writeFileSync(j(dir, "package.json"), `{"scripts": {"print-env": "${process.env.npm_node_execpath || "node"} ./print-env.js"}}`);
      fs.writeFileSync(j(dir, "print-env.js"), `console.log(JSON.stringify(process.env))`);
      let PATH = process.env.PATH.split(":").filter(ea => ea !== helperBinDir).join(":")
      Object.keys(process.env).forEach(ea => {
        if (ea.toLowerCase().startsWith("npm_config_"))
          env[ea] = process.env[ea];
      });
      env = Object.assign({},
        JSON.parse(String(execSync(`npm --silent run print-env`, { cwd: dir, env: Object.assign({}, process.env, { PATH }) }))),
        env);
      for (let key in env)
        if (!key.toLowerCase().startsWith("npm") || key.toLowerCase().startsWith("npm_package"))
          delete env[key];
    } catch (err) {
      console.warn(`Cannot figure out real npm env, ${err}`);
      env = {};
    } finally {
      try {
        if (fs.existsSync(j(dir, "package.json")))
          fs.unlinkSync(j(dir, "package.json"));
        fs.unlinkSync(j(dir, "print-env.js"));
        fs.rmdirSync(dir);
      } catch (err) { }
    }
    fs.writeFileSync(cacheFile, JSON.stringify({ time: Date.now(), env }));
    return env;
  })());
}

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

function linkBins(packageSpecs, linkState = {}, verbose = false) {
  let linkLocation = j(tmpdir(), "npm-helper-bin-dir");
  if (!fs.existsSync(linkLocation)) fs.mkdirSync(linkLocation);
  packageSpecs.forEach(({ bin, location }) => {
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
      } catch (err) { }
      verbose && console.log(`[flatn build] linking ${j(location, realFile)} => ${j(linkLocation, linkName)}`)
      fs.symlinkSync(j(location, realFile), j(linkLocation, linkName));
    }
    linkState[location] = true;
  });
  return linkLocation;
}

class BuildProcess {

  static for(packageSpec, packageMap, dependencyFields, forceBuild = false) {
    let stages = buildStages(packageSpec, packageMap, dependencyFields);
    return new this(stages, packageMap, forceBuild);
  }

  constructor(buildStages, packageMap, forceBuild, verbose = false) {
    this.buildStages = buildStages; // 2d list, package specs in sorted order
    this.packageMap = packageMap;
    this.builtPackages = [];
    this.binLinkState = {};
    this.binLinkLocation = "";
    this.forceBuild = forceBuild;
    this.verbose = verbose;
  }

  async run() {

    // let {buildStages, packageMap} = build
    let { buildStages, packageMap } = this,
      i = 1, n = buildStages.length;

    this.verbose && console.log(`[flatn] Running build stage ${i++}/${n}`)

    while (buildStages.length) {
      let stage = buildStages[0];
      if (!stage.length) {
        buildStages.shift();
        this.verbose && buildStages.length && console.log(`[flatn] Running build stage ${i++}/${n}`);
        continue;
      }

      let next = stage[0],
        atIndex = next.lastIndexOf("@");
      if (atIndex === -1) atIndex = next.length;
      let name = next.slice(0, atIndex),
        version = next.slice(atIndex + 1),
        packageSpec = packageMap.lookup(name, version);
      if (!packageSpec) throw new Error(`[flatn build] package ${next} cannot be found in package map, skipping its build`);

      await this.build(packageSpec);
      stage.shift();
    }
  }

  normalizeScripts({ scripts, location }) {
    if (!scripts || !scripts.install) {
      let hasBindingGyp = fs.existsSync(j(location, "binding.gyp"));
      if (hasBindingGyp) {
        scripts = Object.assign({ install: "node-gyp rebuild" }, scripts)
      }
    }
    return scripts;
  }

  hasBuiltScripts(scripts) {
    return scripts && Object.keys(scripts).some(scriptName =>
      ["prepare", "preinstall", "install", "postinstall"].includes(scriptName));
  }

  async build(packageSpec) {
    this.binLinkLocation = linkBins(
      this.builtPackages.concat([packageSpec]),
      this.binLinkState,
      this.verbose);

    let env = npmCreateEnvVars(await packageSpec.readConfig());
    let needsBuilt =
      this.forceBuild || packageSpec.isDevPackage || !(packageSpec.readLvInfo() || {}).build;

    if (needsBuilt) {
      let scripts = this.normalizeScripts(packageSpec);
      if (this.hasBuiltScripts(scripts)) {
        console.log(`[flatn] ${packageSpec.name} build starting`);
        await this.runScript(scripts, "preinstall", packageSpec, env);
        await this.runScript(scripts, "install", packageSpec, env);
        await this.runScript(scripts, "postinstall", packageSpec, env);
        await packageSpec.changeLvInfo(info => Object.assign({}, info, { build: true }));
        console.log(`[flatn] ${packageSpec.name} build done`);
      }
    }

    this.builtPackages.push(packageSpec);
  }

  async runScript(scripts, scriptName, { name, location }, env) {
    if (!scripts || !scripts[scriptName]) return false;
    this.verbose && console.log(`[flatn] build ${name}: running ${scriptName}`);

    let pathParts = process.env.PATH.split(":");
    pathParts.unshift(helperBinDir);
    pathParts.unshift(this.binLinkLocation);

    env = Object.assign({},
      process.env,
      npmFallbackEnv,
      npmEnv(),
      env,
      {
        npm_lifecycle_event: scriptName,
        npm_lifecycle_script: scripts[scriptName].split(" ")[0],
        PATH: pathParts.join(":")
      });

    try {
      return await x(`/bin/sh -c '${scripts[scriptName]}'`, {
        verbose: true,
        cwd: location.replace(/^file:\/\//, ""),
        env
      });

    } catch (err) {
      console.error(`[build ${name}] error running ${scripts[scriptName]}:\n${err}`);
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
