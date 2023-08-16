import { resource } from "lively.resources";
import LivelyServer from "lively.server";
import { path } from "path";
const { BrowserWindow } = System._nodeRequire('electron');


var logWindow;
var originalConsoleMethods = originalConsoleMethods || {};

export function openLogWindow(url) {

  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.show();
    return logWindow;
  }

  logWindow = new BrowserWindow({width: 800, height: 600})
  
  let server = LivelyServer.servers.values().next().value
  
  // win.loadURL(`http://${server.hostname}:${server.port}/lively.app/logger.html`)
  logWindow.loadURL(url);
  
  let stdoutHandler = data => logWindow.webContents.send("message", {type: "stdout", content: String(data)});
  let stderrHandler = data => logWindow.webContents.send("message", {type: "stderr", content: String(data)});
  process.stdout.on("data", stdoutHandler)
  process.stderr.on("data", stderrHandler)
  
  
  let consoleWraps = ["log", "warn", "error"];
  originalConsoleMethods = originalConsoleMethods || {};
  consoleWraps.forEach(selector => {
    if (!originalConsoleMethods[selector])
      originalConsoleMethods[selector] = console[selector];
    console[selector] = function(/*args*/) {
      let content = lively.lang.string.format(...arguments);
      logWindow.webContents.send("message", {type: selector, content});
      return originalConsoleMethods[selector](...arguments);
    }
  });
}
