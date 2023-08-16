/*global System,module,require*/

let req = typeof System !== "undefined" ? System._nodeRequire : require;
let { execSync } = req("child_process");
let tar = typeof System !== "undefined" ? req("lively.app/tar/index.js") : req("../tar/index.js");
let { join, dirname, resolve } = req("path");
let fs = req("fs");
let packager = req('electron-packager')

/*

node deploy/build.js; rsync -avz --delete --exclude .module_cache --delete-excluded /Users/robert/Lively/lively-dev2/lively.app/build/lively-darwin-x64/lively.app/ /Applications/lively.app/

*/

function x(cmd, opts) { return execSync(cmd, Object.assign({cwd: livelyAppDir}, opts)); }

let livelyDir = resolve(join(__dirname, "../../")),
    livelyAppDir = resolve(join(__dirname, "../")),
    packages = JSON.parse(fs.readFileSync(join(livelyDir, "lively.installer/packages-config.json"))),
    version = JSON.parse(fs.readFileSync(join(livelyDir, "lively.app/package.json"))).version,
    electronVersion = JSON.parse(fs.readFileSync(join(livelyDir, "lively.app/node_modules/electron/package.json"))).version,
    preDir = join(livelyDir, "lively.app/build/pre"),
    archive = join(livelyDir, "lively.app/lively.next.tar.gz"),
    additionalFiles = [
      "app-info.json",
      "update.sh",
      "start.sh",
      "favicon.ico",
      "env.sh",
      "lively.next-node_modules/"
    ],
    archiveExcludes = [".git", ".module_cache", "lively.app/build", "lively.next.tar.gz"],
    filesToArchive = [
      ...packages.map(ea => ea.name + "/"),
      ...additionalFiles
    ],
    rsyncExcludes = [".module_cache"].map(ea => `--exclude ${ea}`).join(" "),
    copyLivelyPackages = true,
    copyDependencies = true,
    buildDependencies = true,
    copyHelpers = true,
    createTarArchive = true,
    createAppInfo = true,
    runElectronPackager = true,
    codeSign = true,
    zipApp = false/*deprecated*/;

async function build() {

  if (copyHelpers) {
    // copy helper files
    x(`mkdir -p ${preDir}`);
    for (let f of additionalFiles) {
      let from = join(livelyDir, f), to = join(preDir, f);
      if (!fs.existsSync(from) || fs.statSync(from).isDirectory()) continue;
      console.log(`  ${from} => ${to}`);
      x(`cp ${from} ${to}`);
    }
  }

  if (copyLivelyPackages) {
    // copy lively.next packages
    for (let p of packages) {
      let from = join(livelyDir, p.name),
          to = join(preDir, p.name);
      console.log(`  ${from} => ${to}`);
      x(`rsync -az --delete ${rsyncExcludes} --delete-excluded ${from}/ ${to}/`);
    }
    x(`rm -rf ${join(preDir, "lively.app/build")}`);

    // remove my custom worlds
    x("find . -iname '*.json' -type f -not -name default.json -print0 | xargs -0 rm", {cwd: join(preDir, "lively.morphic/worlds")});

    fs.writeFileSync(join(livelyDir, "lively.app/log.txt"), "");
  }

  if (copyDependencies) {
    let from = join(livelyDir, "lively.next-node_modules"),
        to = join(preDir, "lively.next-node_modules");
    console.log(`  ${from} => ${to}`);
    x(`rsync -az --delete ${rsyncExcludes} --delete-excluded ${from}/ ${to}/`);
    x("find . -name '.lv-npm-helper-info.json' -type f -print0 | xargs -0 rm", {cwd: join(preDir, "lively.next-node_modules")});
  }

  if (buildDependencies) {
    x(`export npm_config_target=1.6.10
       export npm_config_target_arch=x64
       export npm_config_disturl=https://atom.io/download/electron
       export npm_config_runtime=electron
       export npm_config_build_from_source=true
       ./update.sh`, {cwd: preDir,stdio: "inherit"});
  }


  if (createAppInfo) {

    let appInfo = {
      created: String(new Date()),
      version,
      files: filesToArchive,
      excludes: archiveExcludes,
      versions: packages.map(({name, branch}) => {
        return {
          name: name,
          sha: String(fs.readFileSync(join(livelyDir, name, ".git/refs/heads/" + (branch || "master"))))
        }
      })
    }

    fs.writeFileSync(join(preDir, "app-info.json"), JSON.stringify(appInfo, null, 2));

  }

  if (createTarArchive) {

    console.log(`Creating ${join(archive)}`);

    fs.existsSync(archive) && fs.unlinkSync(archive);
    await tar.create(
      {
        cwd: preDir,
        gzip: true,
        file: archive,
        filter: (path, stat) => !archiveExcludes.some(ea => path.includes(ea)),
        onwarn: (message, data) => console.warn(message, data)
      },
      filesToArchive);
  }

  if (runElectronPackager) {
    console.log(`Running electron-packager`);

    x(`rm -rf build/lively-darwin-x64/`);
    x("find . -name .module_cache -type d -print0 | xargs -0 rm -rf");

    // https://github.com/electron-userland/electron-packager
    let appPaths = await new Promise((resolve, reject) =>
      packager({
        dir: livelyAppDir,
        name: "lively",
        arch: "x64", /*ia32, x64, armv7l, all*/
        asar: false,
        electronVersion,
        icon: join(livelyAppDir, "lively-icon/lively.icns"),
        ignore: [/build/],
        out: join(livelyAppDir, "build"),
        overwrite: true,
        platform: "darwin", /*linux, win32, darwin, mas, all*/
        appBundleId: "web.lively.app",
        helperBundleId: "helper.web.lively.app",
        appCategoryType: "public.app-category.developer-tools",
        // osxSign: {identity: "Developer ID Application: Robert Krahn (BX6G5LDCXH)"},
      }, (err, appPaths) => err ? reject(err): resolve(appPaths)));

    // "pack:osx": "electron-packager . $npm_package_productName --out=dist/osx --platform=darwin --arch=x64 --icon=assets/build/osx/icon.icns && npm run codesign",
    // "pack:win32": "electron-packager . $npm_package_productName --out=dist/win --platform=win32 --arch=ia32",
    // "pack:win64": "electron-packager . $npm_package_productName --out=dist/win --platform=win32 --arch=x64 --version=0.36.2 app-version=1.0 --icon=assets/build/win/icon.ico",
    // "build": "npm run pack:osx && npm run pack:win32 && npm run pack:win64"
  }

  if (codeSign) {
    console.log("Code signing mac app");
    x(`mac/sign.sh "${version}"`, {cwd: livelyAppDir, stdio: "inherit"});
    // spctl --assess --verbose lively.app
  }

  if (zipApp) {
    let zipDir = join(livelyAppDir, "build/lively-darwin-x64"),
        zipFile = `lively.app.${version}.zip`
    x(`if [[ -f ${zipFile} ]]; then rm ${zipFile}; fi`, {cwd: zipDir});
    x(`zip -r ${zipFile} lively.app`, {cwd: zipDir, stdio: "inherit"});
    console.log(`Zipping successful: ${join(zipDir, zipFile)}`);
  }
}


module.exports = build;

if (require.main && require.main.filename === __filename)
  build().catch(err => { console.error(err.stack); process.exit(1); });
