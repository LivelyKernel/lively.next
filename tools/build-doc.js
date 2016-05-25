/*global require*/

var docComments = require("doc-comments"),
    path = require("path");

var projectPath = path.join(__dirname, ".."),
    files = ["index.js"];

module.exports = new Promise((resolve, reject) =>
  docComments({
      projectPath: projectPath,
      files: files,
      intoFiles: false,
      dryRun: false,
      alias: {"index.js": "main interface"}
    },
    (err, markup, fileData) =>
      err ? reject(err) : resolve()));
