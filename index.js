import semver from "./semver.min.js"
import { resource } from "lively.resources";
import { packageDownload } from "./download.js";
import { readPackageSpec, gitSpecFromVersion } from "./lookup.js";

export async function installPackage(pNameAndVersion, destinationDir) {
  // tries to retrieve a package specified by name or name@versionRange (like
  // foo@^1.2) from packageDirs.

  if (typeof destinationDir === "string" && destinationDir.startsWith("/"))
    destinationDir = "file://" + destinationDir;

  destinationDir = resource(destinationDir);
  await destinationDir.ensureExistance();

  let queue = [pNameAndVersion.split("@")],
      packages = [];

  while (queue.length) {
    let [name, version] = queue.shift(),
        installed = await getInstalledPackage(name, version, destinationDir)
                 || await packageDownload(version ? name + "@" + version : name, destinationDir);
    if (!installed)
      throw new Error(`cannot install package ${name}@${version}!`)
    packages.push(installed);
    let {config} = installed,
        deps = config.dependencies || {};
    for (let name in deps)
      if (!await getInstalledPackage(name, config.dependencies[name], destinationDir))
        queue.push([name, config.dependencies[name]]);
    // console.log(queue)
  }
  return packages;
}

export async function getInstalledPackages(packageInstallDir) {
  if (typeof packageInstallDir === "string" && packageInstallDir.startsWith("/"))
    packageInstallDir = "file://" + packageInstallDir;
  return Promise.all((await resource(packageInstallDir).dirList(1))
                        .map(ea => readPackageSpec(ea)));
}

export async function getInstalledPackage(pName, versionRange, packageInstallDir, installedPackages) {
  if (typeof packageInstallDir === "string" && packageInstallDir.startsWith("/"))
      packageInstallDir = "file://" + packageInstallDir;
  packageInstallDir = resource(packageInstallDir);

  if (!installedPackages) installedPackages = await packageInstallDir.dirList(1);
  let gitSpec = gitSpecFromVersion(versionRange || "");

  let existing;
  for (let p of installedPackages) {
    let [name, version] = p.name().split("@");
    if (name !== pName) continue;
    if (!versionRange || (gitSpec && gitSpec.inFileName === version)) {
      existing = p;
      break;
    }

    if (!semver.parse(version || "")) {
      try {
        version = (await p.join("package.json").readJson()).version;
      } catch (err) {}
    }
    if (semver.satisfies(version, versionRange)) {
      existing = p; break;
    }
  }

  return existing ? readPackageSpec(existing) : null;
}


/*
DIR=/Users/robert/Lively/lively-dev2/npm-helper/bin
export PATH=$DIR:$PATH
export CENTRAL_NODE_PACKAGE_DIR="/Users/robert/.central-node-packages";
node -r "lively.resources/dist/lively.resources.js" -e "lively.resources.resource('file://'+__dirname).dirList().then(files => console.log(files.map(ea => ea.path())))"
*/

// await installPackage("pouchdb", packageDir)
// await installPackage("lively.resources", packageDir)
// await installPackage("lively.user@LivelyKernel/lively.user#master", packageDir)
// await installPackage("pouchdb", packageDir)

// process.env.CENTRAL_NODE_PACKAGE_DIR = "/Users/robert/.central-node-packages"
// let packageDir = process.env.CENTRAL_NODE_PACKAGE_DIR
// let packages = getInstalledPackages(packageDir)
// let p = await getInstalledPackage("pouchdb", null, packageDir)
// let p = await getInstalledPackage("lively.resources", undefined, packageDir);
// let p = await getInstalledPackage("lively.user", undefined, packageDir);

// await depGraph(p, packageDir)
// let stages = await buildStages(p, packageDir)
// let build = new BuildProcess(stages, packageDir);
// await build.run()


// context.env
// await x(`/bin/sh -c 'env'`, {cwd: context.location, env: context.env});