/*global __dirname,System*/
import { resource } from "lively.resources";
import formidable from "formidable";
import path from "path";
import fs from "fs";
import { parseQuery } from "lively.resources";

export default class FileUploadPlugin {

  setOptions() {
    // lively.lang.num.humanReadableByteSize(2 ** 27)
    this.maxUpload = 2**27;
  }

  get pluginId() { return "file-upload" }

  toString() { return `<${this.pluginId}>`; }

  get after() { return ["cors"]; }
  get before() { return ["jsdav"]; }

  setup(livelyServer) {}
  async close() {}

  async handleRequest(req, res, next) {
    if (req.method.toUpperCase() !== "POST" || !req.url.startsWith("/upload"))
      return next();

    let query = parseQuery(req.url),
        uploadPath = query.uploadPath || "uploads/",
        form = new formidable.IncomingForm(),
        report = {status: "not started", uploadedFiles: []},
        uploadDir = resource(System.baseURL).join(uploadPath).asDirectory(),
        responseSend = false;
    await uploadDir.ensureExistance();
    form.uploadDir = uploadDir.path();
    form.keepExtensions = true;
    form.multiples = true;
    form.hash = "sha1";

    form.on('fileBegin', function(name, file) {
      let realPath = findUnusedFileName(path.join(form.uploadDir, file.name))
      file.path = realPath + ".inprogress";
      console.log(`Uploading ${file.name} (${file.type}) to ${file.path}`);
    });

    form.on('file', function(field, file) {
      let realPath = file.path.replace(/\.inprogress$/, "");
      try {
        if (fs.existsSync(file.path)) fs.renameSync(file.path, realPath);
        report.uploadedFiles.push({
          path: path.relative(resource(System.baseURL).path(), realPath),
          type: file.type,
          hash: file.hash
        });
      } catch (err) { console.error(`[file upload] error moving ${file.path} to ${realPath}: ${err}`); }
    });


    form.on('progress', function(bytesReceived, bytesExpected) {
      console.log("file upload progress: " + (bytesReceived / bytesExpected * 100).toFixed(0) + "%");
    });
    form.on('error', function(err) {
      console.error('Error uploading files:\n' + err.stack);
      if (!responseSend) {
        responseSend = true;
        res.writeHead(500);
        res.end(report.status + " " + String(err));
      }
    });
    form.on('aborted', function() {
      console.log("file upload aborted");
      report.status = "aborted";
      // if (!responseSend) {
      //   responseSend = true;
      //   res.writeHead(200, {"content-type": "application/json"});
      //   res.end(JSON.stringify(report));
      // }
    });
    form.on('end', function() {
      console.log("file upload done");
      if (!responseSend) {
        responseSend = true;
        res.writeHead(200, {"content-type": "application/json"});
        report.status = "done";
        res.end(JSON.stringify(report));
      }
    });

    form.parse(req, function(err, fields, files) {
      let fileList = files.file ? Array.isArray(files.file) ? files.file : [files.file] : [];
      console.log(`Uploading ${fileList.length} files.`);
      // res.writeHead(200, {'content-type': 'text/plain'});
      // res.write('received upload:\n\n');
    });

  }
}


var numberFileRe = /^(.*\/)?([^\.]+)(\.[^\/]+)?$/

function numberFileReplacer(match, path, baseName, ext) {
  // adds a -1, -2, ... to the filename before the extension
  var i = 1;
  var noMatch = baseName.match(/-([0-9]+)$/);
  if (noMatch) {
    baseName = baseName.slice(0, -noMatch[0].length);
    i = Number(noMatch[1]) + 1;
  }
  return (path || "") + baseName + "-" + i + (ext || "");
}


function findUnusedFileName(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  do {
    filePath = filePath.replace(numberFileRe, numberFileReplacer);
  } while (fs.existsSync(filePath));
  return filePath;
}
