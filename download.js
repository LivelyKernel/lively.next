/*global require, module*/
import { tmpdir } from "os";
import { gitClone, npmDownloadArchive, untar } from "./util.js";
import { readPackageSpec, pathForNameAndVersion, lvInfoFileName } from "./lookup.js";

import { resource } from "./deps/lively.resources.js"

export {
  packageDownload
}


function maybeFileResource(url) {
  if (typeof url === "string" && url.startsWith("/"))
      url = "file://" + url;
  return url.isResource ? url : resource(url);
}

async function packageDownload(packageNameAndRange, destinationDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*

  destinationDir = maybeFileResource(destinationDir);

  if (!packageNameAndRange.includes("@")) {
    // any version
    packageNameAndRange += "@*";
  }

  // download package to tmp location
  let tmp = resource("file://" + tmpdir()).join("package_install_tmp/");
  await tmp.ensureExistance()

  let pathSpec = pathForNameAndVersion(packageNameAndRange, destinationDir.path()),
      downloadDir = pathSpec.gitURL
        ? await packageDownloadViaGit(pathSpec, tmp)
        : await packageDownloadViaNpm(packageNameAndRange, tmp);


  let packageJSON = downloadDir.join("package.json"), config;
  if (await packageJSON.exists()) {
    config = await downloadDir.join("package.json").readJson();
  } else {
    // FIXME, doesn't really work for git downloads...
    let [name, version] = downloadDir.name().split("@");
    config = {name, version};
  }

  let packageDir;
  if (pathSpec.gitURL) {
    packageDir = maybeFileResource(pathSpec.location).asDirectory();
  } else {
    let dirName = config.name + "@" + config.version;
    packageDir = destinationDir.join(dirName).asDirectory();
    pathSpec = Object.assign({}, pathSpec, {location: packageDir});
  }

  await downloadDir.rename(packageDir);

  if (pathSpec.gitURL)
    await packageDir.join(lvInfoFileName).writeJson(pathSpec);

  return readPackageSpec(packageDir.path(), config);
}


async function packageDownloadViaGit({gitURL: url, name, branch}, targetDir) {
  // packageNameAndRepo like "lively.modules@https://github.com/LivelyKernel/lively.modules"
  branch = branch || "master"
  url = url.replace(/#[^#]+$/, "");
  let dir = targetDir.join(name).asDirectory()
  await gitClone(url, dir, branch);
  return dir;
}

async function packageDownloadViaNpm(packageNameAndRange, targetDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*
  let {
    downloadedArchive,
    name, version
  } = await npmDownloadArchive(packageNameAndRange, targetDir);
  return untar(downloadedArchive, targetDir, name);
}
