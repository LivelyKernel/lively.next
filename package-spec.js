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

    try {
      let infoF = j(packageDir, lvInfoFileName);
      if (fs.existsSync(infoF)) {
        let { branch, gitURL, versionInFileName } = JSON.parse(String(fs.readFileSync(infoF)))
        Object.assign(this, {branch, gitURL, versionInFileName});
      }
    } catch (err) {}

    return true;
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




// function pathForNameAndVersion(nameAndVersion, destinationDir) {
//   // pathForNameAndVersion("foo-bar@1.2.3", "file:///x/y")
//   // pathForNameAndVersion("foo-bar@foo/bar", "file:///x/y")
//   // pathForNameAndVersion("foo-bar@git+https://github.com/foo/bar#master", "file:///x/y")
//
//   let [name, version] = nameAndVersion.split("@"),
//       gitSpec = gitSpecFromVersion(version);
//
//   // "git clone -b my-branch git@github.com:user/myproject.git"
//   if (gitSpec) {
//     let location = j(destinationDir, `${name}@${gitSpec.versionInFileName}`);
//     return Object.assign({}, gitSpec, {location, name, version: gitSpec.gitURL});
//   }
//
//   return {location: j(destinationDir, nameAndVersion), name, version}
// }
//

//
// export {
//   lvInfoFileName,
//   readPackageSpec,
//   gitSpecFromVersion,
//   pathForNameAndVersion,
// }
