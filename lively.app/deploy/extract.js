/*global System,module,require*/

let req = typeof System !== "undefined" ? System._nodeRequire : require;
let tar = typeof System !== "undefined" ? req("lively.app/tar/index.js") : req("../tar/index.js");
let { join, sep } = req("path");
let fs = req("fs");

module.exports = extract;

// if (require.main && require.main.filename === __filename) extract();

async function extract(targetDir, archive) {
  // let targetDir = join(process.env.HOME, ".lively");  
  // archive

  function readFromAppInfo(files) {
    return new Promise((resolve, reject) => {
      let result = {};
  
      fs.createReadStream(archive).pipe(new tar.Parse({
        filter: path => files.some(fn => path.endsWith(fn)),
        onwarn: msg => console.warn(msg),
        onentry: entry => {
          result[entry.header.path] = "";
          entry.on("error", err => result[entry.header.path] = err);
          entry.on("data", data => result[entry.header.path] += data);
        }
      }))
        .on("end", () => resolve(result))
        .on("error", err => reject(err));
    });
  
  }
  
  // (await readFromAppInfo(["lively.app/start-server.js"]))["lively.app/start-server.js"]
  // let appInfo = JSON.parse((await readFromAppInfo(["app-info.json"]))["app-info.json"]);
  targetDir.split("/").filter(Boolean)
    .reduce((paths, ea) => [...paths, paths.length ? join(paths[paths.length-1], ea) : sep + ea], [])
    .forEach(path => fs.existsSync(path) || fs.mkdirSync(path));

  console.log(`Extracting ${archive} to ${targetDir}`)

  await tar.extract({
    // newer: true,
    filter: (path, entry) => !path.includes("lively.app/node_modules"),
    cwd: targetDir,
    file: archive,
    onwarn: (msg, data) => console.warn(msg, data)
  });

  console.log(`Extracting archive done`);
}
