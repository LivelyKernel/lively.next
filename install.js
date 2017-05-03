const { resource } = (typeof lively !== "undefined" && lively.resources) || require("./deps/lively.resources.js");

function installMissingPackageDependencies(
  packageDir,
  packageConfig,
  destinationDir,
  depFields = ["dependencies"],
  lookupDirs = [destinationDir]
) {

}
