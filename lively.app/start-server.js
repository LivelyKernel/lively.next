/*global require,process,__dirname,module*/

const path = require('path'),
      util = require('util'),
      fs = require("fs"),
     // { BrowserWindow, Menu, MenuItem, Tray, app, shell } = require("electron"),
      livelyDir = path.join(process.env.HOME, "repos/lively.next")
      //menuTrayIcon = "menubar/lively-icon";

var tray,
    logWindow,
    logStream = fs.createWriteStream(path.join(livelyDir, 'lively.app.log')),
    recentLogMessages = [],
    originalConsoleMethods = originalConsoleMethods || {},
    server;


module.exports.start = start;

async function start(baseDir) {
  try {
    //wrapConsole();
    // prepareApp();
    // if (app.isReady()) openLogWindow();
    // else app.on("ready", () => openLogWindow());
    // await new Promise(resolve => setTimeout(resolve, 200))
    return await startServer(baseDir);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

async function startServer(baseDir) {
  if (!baseDir) baseDir = path.resolve(path.join(__dirname, ".."));
  server = await require("lively.server")("localhost", 9012, baseDir);
  // createTrayMenu();
  return server;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// app / menu

// function prepareApp() {
//   // fix the $PATH on macOS
//   // fixPath();

//   if (process.platform === 'darwin') app.dock.hide();

//   if (app.isReady()) {
//     tray = new Tray(path.join(__dirname, `${menuTrayIcon}.png`));
//   } else {
//     app.on("ready", () => tray = new Tray(path.join(__dirname, `${menuTrayIcon}.png`)));
//   }

//   app.on('window-all-closed', () => console.log("all windows closed"));  
//   process.on('uncaughtException', console.error);
// }

// function createTrayMenu() {
//   const menu = new Menu();
  
//   server && menu.append(
//     new MenuItem({
//       label: "Open emtpy lively world",
//       click: () => shell.openExternal(`http://${server.hostname}${server.port ? `:${server.port}` : ""}/worlds/default`)
//     }));
//   server && menu.append(
//     new MenuItem({
//       label: "List lively worlds",
//       click: () => shell.openExternal(`http://${server.hostname}${server.port ? `:${server.port}` : ""}/worlds/`)
//     }));
//   menu.append(
//     new MenuItem({
//       label: "Open server log",
//       click: openLogWindow
//     }));
//   menu.append(
//     new MenuItem({
//       label: process.platform === "darwin" ? `Quit ${app.getName()}` : "Quit",
//       click: app.quit
//     }));

//   tray.setContextMenu(menu);

//   return menu;
// }


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// logging
function recordLogMessage(type, logArgs) {
  let content = util.format(...logArgs),
      logMsg = {type, content};

  logStream.write(content + "\n");

  recentLogMessages.push(logMsg);
  if (recentLogMessages.length > 100)
    recentLogMessages.splice(0, 25);

  if (logWindow && !logWindow.isDestroyed())
    logWindow.webContents.send("log", logMsg);
}

// function wrapConsole() {
//   let stdoutHandler = data => recordLogMessage("stdout", [String(data)]),
//       stderrHandler = data => recordLogMessage("stderr", [String(data)]),
//       consoleWraps = ["log", "warn", "error"];

//   process.stdout.on("data", stdoutHandler);
//   process.stderr.on("data", stderrHandler);
    
//   originalConsoleMethods = originalConsoleMethods || {};
//   consoleWraps.forEach(selector => {
//     if (!originalConsoleMethods[selector])
//       originalConsoleMethods[selector] = console[selector];
//     console[selector] = function(/*args*/) {
//       originalConsoleMethods[selector](...arguments);
//       recordLogMessage(selector, Array.from(arguments));
//     }
//   });
// }

function openLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.show();
    return logWindow;
  }
  logWindow = new BrowserWindow({width: 800, height: 600, show: false});
  logWindow.loadURL("file://" + __dirname + "/logger.html");
  logWindow.once('ready-to-show', () => {
    logWindow.show();
    logWindow.webContents.send("load-log", recentLogMessages);
  })
  return logWindow;
}
