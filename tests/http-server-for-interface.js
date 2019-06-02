import { string, promise } from "lively.lang";
import { exec as node_exec } from "child_process";
import * as fs from "fs";

const isNode = System.get("@system-env").node;

function writeFile(fn, content) {
  if (isNode) {
    fs.writeFileSync(fn, content);
    return Promise.resolve(); 
  } else {
    return lively.shell.writeFile(fn, content);
  }
}

function exec(cmdString, opts) {
  opts = Object.assign({cwd: undefined}, opts)

  var cmd;
  if (isNode) {
    var proc, exit, stdout = "", stderr = "", deferred = promise.deferred();
    proc = node_exec(cmdString, {cwd: opts.cwd}, (_exit) => { exit = _exit; });
    proc.stdout.on("data", (d) => stdout += d);
    proc.stderr.on("data", (d) => stderr += d);
    var rawCmd = {
      get process() { return proc },
      get code() { return exit },
      get output() { return stdout + "\n" + stderr },
      get stdout() { return stdout },
      isRunning() { return typeof exit === "undefined" },
      kill(sig = "SIGKILL") {
        proc.kill(sig);
        return new Promise((resolve, reject) => !this.isRunning());
      }
    }
    cmd = deferred.promise;
    cmd.__defineGetter__("process", rawCmd.__lookupGetter__("process"));
    cmd.__defineGetter__("code",    rawCmd.__lookupGetter__("code"));
    cmd.__defineGetter__("output",  rawCmd.__lookupGetter__("output"));
    cmd.__defineGetter__("stdout",  rawCmd.__lookupGetter__("stdout"));
    cmd.__defineGetter__("stdout",  rawCmd.__lookupGetter__("stdout"));
    cmd.isRunning = rawCmd.isRunning.bind(rawCmd);
    cmd.kill = rawCmd.kill.bind(rawCmd);
    promise.waitFor(() => !cmd.isRunning()).then(() => deferred.resolve(rawCmd))
  } else {
    cmd = lively.shell.run(cmdString, {cwd: opts.cwd});
  }
  return cmd;
}

var serverCode = `
require("systemjs");
require("lively.modules");
require("lively.vm");
var http = require("http");

process.on('uncaughtException', function(err) { console.error(err); });

Promise.resolve()
  .then(() => new Promise((resolve, reject) =>
    http.createServer(function(req, res) {
      cors(req, res, () => {
        evalHandler("__PATH__")(req, res, () => {
          res.writeHead(404, {'Content-Type': 'text/plain'});
          res.end('not supported: ' + req.url);
        });
      })
    }).listen(__PORT__, resolve)))
  .then(() => console.log("lively.system running at http://localhost:__PORT____PATH__"))
  .then(() => lively.modules.importPackage("__SYSTEMINTERFACE_PATH__"))
  .then((system) => { global.livelySystem = system; console.log("lively-system-interface imported"); })
  .catch(err => console.error("Error starting server: " + err.stack || err));


function evalHandler(route) {
  return function postHandler(req, res, next) {
    if (route !== req.url || req.method !== "POST") return next();
    var data = '';
    req.on('data', d => data += d.toString());
    req.on('end', () => {
      Promise.resolve().then(() => {
        var result = eval(data);
        if (!(result instanceof Promise)) {
          console.error("unexpected eval result:" + result)
          throw new Error("unexpected eval result:" + result);
        }
        return result;
      })
      .then(evalResult => JSON.stringify(evalResult))
      .then(stringifiedEvalResult => {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(stringifiedEvalResult);
      })
      .catch(err => {
        console.error("eval error: " + err);
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({isError: true, value: String(err.stack || err)}));
      });
    });
  }

}

function cors(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS, PROPFIND, REPORT, MKCOL');
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Depth, Cookie, Set-Cookie, Accept, Access-Control-Allow-Credentials, Origin, Content-Type, Request-Id , X-Api-Version, X-Request-Id, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Date, Etag, Set-Cookie");
  next();
}`

export async function startServer(path = "/lively", port = 3011, timeout = 30*1000/*ms*/) {
  // 1. prepare server file
  var WORKSPACE_LK = (isNode ? process.env.WORKSPACE_LK : lively.shell.WORKSPACE_LK) || ".",
      fn = string.joinPath(WORKSPACE_LK, ".lively.next-eval-server-for-test.js"),
      systemInterfacePath = WORKSPACE_LK !== "." ? "node_modules/lively-system-interface" : ".",
      serverCodePatched = serverCode
                            .replace(/__PORT__/g, port)
                            .replace(/__PATH__/g, path)
                            .replace(/__SYSTEMINTERFACE_PATH__/g, systemInterfacePath);
  await writeFile(fn, serverCodePatched);
  
  // 2. start server process and wait until lively-system-interface is ready
  var cmd = exec(`node ${fn}`, {cwd: WORKSPACE_LK}),
      start = Date.now(), outputSeen = "";
  return new Promise(function waitForServerStart(resolve, reject) {

    if (cmd.output !== outputSeen) { // for debugging
      console.log(cmd.output.slice(outputSeen.length));
      outputSeen = cmd.output;
    }

    if (!cmd.isRunning()) reject(new Error(`server crashed: ${cmd.output}`));
    else if (string.include(cmd.output, "lively-system-interface imported")) resolve({server: cmd});
    else if (Date.now() - start > timeout) reject(new Error(`server start timout`))
    else setTimeout(() => waitForServerStart(resolve, reject), 10);
  });
}
