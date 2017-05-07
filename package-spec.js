/*global require, module*/
import semver from "./deps/semver.min.js";
import { basename, join as j } from "path";
import fs from "fs";

const lvInfoFileName = ".lv-npm-helper-info.json";

// PackageSpec.fromDir("/Users/robert/Lively/lively-dev2/lively.server")


class PackageSpec {

  static fromDir(packageDir) {
    let spec = new this(packageDir)
    return spec.read() ? spec : null;
  }

  constructor(location) {
    this.location = location;
    this.isDevPackage = false;
    this.config = {};

    this.hasBindingGyp = false;
    this.scripts = null;
    this.bin = null;

    this.branch = null;
    this.gitURL = null;
    this.versionInFileName = null;
  }

  get name() { return this.config.name || ""; }
  get version() { return this.config.version || ""; }

  read() {
    let packageDir = this.location;

    if (!fs.statSync(packageDir).isDirectory() || !fs.existsSync(j(packageDir, "package.json")))
      return false;

    let hasBindingGyp = fs.existsSync(j(packageDir, "binding.gyp")),
        config = JSON.parse(String(fs.readFileSync(j(packageDir, "package.json")))),
        scripts, bin;

    if (config.bin) {
      bin = typeof config.bin === "string"
        ? {[config.name]: config.bin}
        : Object.assign({}, config.bin);
    }

    if (config.scripts || hasBindingGyp) {
      scripts = Object.assign({}, config.scripts);
      if (hasBindingGyp && !scripts.install)
        scripts.install = "node-gyp rebuild";
    }

    Object.assign(this, {
      location: packageDir,
      hasBindingGyp,
      scripts,
      bin,
      config
    });

    let info = this.readLvInfo();
    if (info) {
      let {branch, gitURL, versionInFileName} = info;
      Object.assign(this, {branch, gitURL, versionInFileName});
    }
    return true;
  }

  readLvInfo() {
    try {
      let infoF = j(this.location, lvInfoFileName);
      if (fs.existsSync(infoF)) {
        return JSON.parse(String(fs.readFileSync(infoF)));
      }
    } catch (err) {}
    return null;
  }

  writeLvInfo(spec) {
    fs.writeFileSync(j(this.location, lvInfoFileName), JSON.stringify(spec));
  }

  changeLvInfo(changeFn) {
    this.writeLvInfo(changeFn(this.readLvInfo()));
  }

  matches(pName, versionRange, gitSpec) {
    // does this package spec match the package pName@versionRange?

    let {name, version, isDevPackage} = this;

    if (name !== pName) return false;

    if (!versionRange || isDevPackage) return true;

    if (gitSpec && (gitSpec.versionInFileName === version
      || this.versionInFileName === gitSpec.versionInFileName)) {
       return true
    }

    if (semver.parse(version || "") && semver.satisfies(version, versionRange))
      return true;

    return false;
  }

}

export {
  PackageSpec
}
