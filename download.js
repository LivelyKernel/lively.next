const { tmpdir } = require("os");
const util = require("./util.js");
const { readPackageSpec, pathForNameAndVersion, lvInfoFileName } = require("./lookup.js");

const { resource } = (typeof lively !== "undefined" && lively.resources) || require("./deps/lively.resources.js");

module.exports = {
  packageDownload
}

async function packageDownload(packageNameAndRange, destinationDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*

  destinationDir = resource(destinationDir);

  if (!packageNameAndRange.includes("@")) {
    // any version
    packageNameAndRange += "@*";
  }

  // download package to tmp location
  let tmp = resource("file://" + tmpdir()).join("package_install_tmp/");
  await tmp.ensureExistance()

  let pathSpec = pathForNameAndVersion(packageNameAndRange, destinationDir),
      downloadDir = pathSpec.gitURL
        ? await packageDownloadViaGit(pathSpec, tmp)
        : await packageDownloadViaNpm(packageNameAndRange, tmp);


  let config = await downloadDir.join("package.json").readJson(), packageDir;

  if (pathSpec.gitURL) {
    packageDir = resource(pathSpec.location).asDirectory();
  } else {
    let dirName = config.name + "@" + config.version;
    packageDir = destinationDir.join(dirName).asDirectory();
    pathSpec = Object.assign({}, pathSpec, {location: packageDir});
  }

  await downloadDir.rename(packageDir);

  if (pathSpec.gitURL)
    await packageDir.join(lvInfoFileName).writeJson(pathSpec);

  return readPackageSpec(packageDir, config);
}


async function packageDownloadViaGit({gitURL: url, name, branch}, targetDir) {
  // packageNameAndRepo like "lively.modules@https://github.com/LivelyKernel/lively.modules"
  branch = branch || "master"
  url = url.replace(/#[^#]+$/, "");
  let dir = targetDir.join(name).asDirectory()
  await util.gitClone(url, dir, branch);
  return dir;
}

async function packageDownloadViaNpm(packageNameAndRange, targetDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*
  let {
    downloadedArchive,
    name, version
  } = await util.npmDownloadArchive(packageNameAndRange, targetDir);
  return util.untar(downloadedArchive, targetDir, name);
}
