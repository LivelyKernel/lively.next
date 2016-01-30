/*global process, require, global*/

var callsite = require("callsite");
var path = require("path");

function resolveFileName(file) {
  if (path.isAbsolute(file)) {
    try {
      return require.resolve(file);
    } catch (e) { return file; }
  }

  var frames = callsite(), frame;
  for (var i = 2; i < frames.length; i++) {
    frame = frames[i];
    var frameFile = frame.getFileName();
    if (!frameFile) continue;
    var dir = path.dirname(frameFile);
    var full = path.join(dir, file);
    try { return require.resolve(full); } catch (e) {}
  }

  try {
    return require.resolve(path.join(process.cwd(), file));
  } catch (e) {}

  return file; 
}

module.exports = {
  resolveFileName: resolveFileName
}