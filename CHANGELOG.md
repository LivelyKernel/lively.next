## 1.0.0

Initial release, features include:

- command line API (flatn list, install, env, node)
- nodejs runtime integration via env vars
- prgrammatic API:
  - read write env:
    - `packageDirsFromEnv()`
    - `setPackageDirsOfEnv(packageCollectionDirs, individualPackageDirs, devPackageDirs)`

  - Package map for resolving packages:
    - `buildPackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs)`
    - `ensurePackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs)`

  - package operations:
    - `buildPackage(
      packageSpecOrDir,
      packageMapOrDirs,
      dependencyFields = ["dependencies"],
      verbose = false,
      forceBuild = false
    )`
    - `installPackage(
      pNameAndVersion,
      destinationDir,
      packageMap,
      dependencyFields,
      isDev = false,
      verbose = false
    )`
    - `addDependencyToPackage(
      packageSpecOrDir,
      depNameAndRange,
      packageDepDir,
      packageMap,
      dependencyField,
      verbose = false
    )`
