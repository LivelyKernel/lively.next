/*global System, process*/

import CommandInterface from "./command-interface.js"
import { stripAnsiAttributes } from "./ansi-color-parser.js"
import { promise, arr, string } from "lively.lang";
import { signal } from "lively.bindings";
import { spawn, exec } from "child_process";
import { inspect, format } from "util";
import fs from "fs";
import path from "path";

var debug = false;

var isWindows = process.platform !== 'linux'
             && process.platform !== 'darwin'
             && process.platform.include('win');


var binDir = System.decanonicalize("lively.shell/bin").replace(/^file:\/\//, "");

var defaultEnv = Object.assign(
  Object.create(process.env), {
    SHELL: '/bin/bash',
    PAGER:'ul | cat -s',
    MANPAGER:'ul | cat -s',
    TERM:"xterm",
    PATH: binDir + path.delimiter + process.env.PATH
  })


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/*
 * ASKPASS support for tunneling sudo / ssh / git password requests back to the
 * browser session
 */
var askPassScript = '';
;(function setupAskpass() {
  askPassScript = path.join(binDir, 'askpass' + (isWindows ? ".win.sh" : ".sh"));
  if (!isWindows)
    try { fs.chmodSync(askPassScript, parseInt("0755", 8)); }
    catch (e) { console.error(e.stack) };
})();

/*
 * EDITOR support
 */
var editorScript = '';
;(function setupEditor() {
  editorScript = path.join(binDir, "lively-as-editor.sh");
  if (!isWindows)
    try { fs.chmodSync(editorScript, parseInt("0755", 8)); }
    catch (e) { console.error(e.stack) };
})();


/*
 * determine the kill command at startup. if pkill is available then use that
 * to do a full process tree kill
 */
function defaultKill(pid, signal, thenDo) {
  // signal = "SIGKILL"|"SIGQUIT"|"SIGINT"|...
  debug && console.log('signal pid %s with', pid, signal);
  signal = signal.toUpperCase().replace(/^SIG/, '');
  exec('kill -s ' + signal + " " + pid, function(code, out, err) {
    debug && console.log('signal result: ', out, err);
    thenDo(code, out, err);
  });
}

function pkillKill(pid, signal, thenDo) {
  // signal = "SIGKILL"|"SIGQUIT"|"SIGINT"|...
  signal = signal.toUpperCase().replace(/^SIG/, '');
  // rk 2015-07-15: properly killing piped processes -- currently this only
  // works when making the spawned process a group leader
  var killCmd = format('pkill -%s -g $(ps opgid= "%s")', signal, pid);
  debug && console.log('signal pid %s with %s (%s)', pid, signal, killCmd);
  exec(killCmd, function(code, out, err) {
    debug && console.log('signal result: ', out, err);
    thenDo(code, out, err);
  });
}

var doKill = defaultKill;
(function determineKillCommand() {
  exec('which pkill', function(code) { if (!code) doKill = pkillKill; });
})();


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// var c = new Command();
// c.spawn({command: "ls"})

export default class ServerCommand extends CommandInterface {

  static installLively2LivelyServices(tracker) {
    Object.keys(L2LServices).forEach(name =>
      tracker.addService(name,
        async (tracker, msg, ackFn) => L2LServices[name](tracker, msg, ackFn)))
  }

  constructor() {
    super();
    this.debug = debug;
  }


  envForCommand(opts = {env: {}}) {
    // here we set environment variables for the command to be run. the stuff
    // below is to support the bin/command2lively.js script and related scripts
    // like askpass support
    var env = {...opts.env};
    if (env["ASKPASS_SESSIONID"] && askPassScript)
      env['SUDO_ASKPASS'] = env['SSH_ASKPASS'] = env['GIT_ASKPASS'] = askPassScript;
    return env
  }

  spawn(cmdInstructions = {command: null, env: {}, cwd: null, stdin: null, stripAnsiAttributes: true}) {
    var options = {
      env: null, cwd: null, stdin: null,
      stripAnsiAttributes: true,
      ...cmdInstructions
    }

    this.startTime = new Date();

    if (this.process) {
      throw new Error(`${this} already has process attached, won't spawn again!`);
    }

    var {command, cwd, stdin} = options,
        env = Object.assign(Object.create(defaultEnv), this.envForCommand(options));
    cwd = cwd || process.cwd();

    command = Array.isArray(command) ? command.join(" ") : String(command);

    // hmm (variable) expansion seems not to work with spawn
    // as a quick hack do it manually here
    command = command.replace(
      /\$[a-zA-Z0-9_]+/g,
      match => env[match.slice(1,match.length)] || match);

    if (!isWindows) command = `source ${binDir}/lively.profile; ${command}`

    var [command, args] = isWindows ?
      ["cmd", ["/C", command]] :
      ["/bin/bash", ["-c", command]]

console.log(env)
    var proc = spawn(command, args, {env, cwd, stdio: 'pipe', detached: true});

    if (this.debug) console.log('Running command: "%s" (%s)', [command].concat(args).join(' '), proc.pid);

    if (stdin) {
      this.debug && console.log('setting stdin to: %s', stdin);
      proc.stdin.end(stdin);
    }

    this.attachTo(proc, options);

    return this;
  }

  attachTo(proc, options = {stripAnsiAttributes: true}) {
    this.process = proc;

    arr.pushIfNotIncluded(this.constructor.commands, this);

    promise.waitFor(() => proc.pid || this.exitCode !== undefined)
      .then(() => this._whenStarted.resolve());

    var {resolve, reject} = this._whenDone;

    proc.stdout.on('data', (data) => {
      this.debug && console.log('STDOUT: ' + data);
      var arg = String(data);
      if (options.stripAnsiAttributes) arg = stripAnsiAttributes(arg);
      this.stdout += arg;
      this.emit('stdout', arg);
      signal(this, 'stdout', arg);
    });

    proc.stderr.on('data', (data) => {
      this.debug && console.log('STDERR: ' + data);
      var arg = String(data);
      if (options.stripAnsiAttributes) arg = stripAnsiAttributes(arg);
      this.stderr += arg;
      this.emit('stderr', arg);
      signal(this, 'stderr', arg);
    });

    proc.on('close', (code) => {
      this.debug && console.log('Shell command %s exited %s', proc.pid, code);
      arr.remove(this.constructor.commands, this);
      this.exitCode = code;
      this.emit('close', code);
      signal(this, 'close', code);
      resolve(this);
    });

    proc.on('error', (err) => {
      this.debug && console.log('shell command errored ' + err);
      arr.remove(this.constructor.commands, this);
      this.stderr += err.stack;
      this.emit('error', err.stack);
      signal(this, 'error', err.stack);
      this.exitCode = 1;
      reject(err);
    });
  }

  writeToStdin(content) {
    if (!this.isRunning()) return;
    debug && console.log(`[${this}] writing to stdin ${string.truncate(String(content), 100)}`);
    this.process.stdin.write(content);
  }

  kill(signal = "KILL") {
    if (!this.process || this.exitCode !== undefined) return Promise.resolve();
    debug && console.log(`[${this}] signaling ${signal}`);
    return new Promise((resolve, reject) =>
      doKill(this.pid, signal, err => err ? reject(err) : resolve()));
  }

}


var L2LServices = {

  async "lively.shell.spawn"(tracker, {sender, data}, ackFn) {
    var answer;
    try {
      var cmd = new ServerCommand().spawn(data),
          pid = cmd.pid;

      cmd.on("stdout", stdout =>
        tracker.sendTo(sender, "lively.shell.onOutput", {pid, stdout}));
      cmd.on("stderr", stderr =>
        tracker.sendTo(sender, "lively.shell.onOutput", {pid, stderr}));

      cmd.on("close", code =>
        tracker.sendTo(sender, "lively.shell.onExit", {pid, code}));
      cmd.on("error", err =>
        tracker.sendTo(sender, "lively.shell.onExit", {pid, error: String(err.stack || err)}));

      await cmd.whenStarted();

      debug && console.log(`[lively.shell] ServerCommand started, ${cmd}`)

      answer = {status: "started", pid};
    } catch (e) {
      debug && console.log(`[lively.shell] ServerCommand errored ${e}`)

      answer = {status: "errored", error: e.stack};
    }

    typeof ackFn === "function" && ackFn(answer);
  },

  async "lively.shell.writeToStdin"(tracker, {sender, data: {pid, stdin}}, ackFn) {
    var answer, cmd;
    if (!pid) answer = {status: "errored", error: "No pid"};
    else if (!(cmd = ServerCommand.findCommand(pid))) {
      answer = {status: "errored", error: "Cannot find command with pid " + pid};
    } else {
      try {
        await cmd.writeToStdin(stdin);
        answer = {status: "OK"}
      } catch (e) {
        answer = {status: "errored", error: e.stack || String(e)}
      }
    }
    typeof ackFn === "function" && ackFn(answer);
  },

  async "lively.shell.kill"(tracker, {sender, data: {pid, signal}}, ackFn) {
    var answer, cmd;
    if (!pid) answer = {status: "errored", error: "No pid"};
    else if (!(cmd = ServerCommand.findCommand(pid))) {
      answer = {status: "errored", error: "Cannot find command with pid " + pid};
    } else {
      try {
        await cmd.kill(signal);
        answer = {status: "signaled " + signal || "KILL"}
      } catch (e) {
        answer = {status: "errored", error: e.stack || String(e)}
      }
    }
    typeof ackFn === "function" && ackFn(answer);
  },

  async "lively.shell.info"(tracker, _, ackFn) {
    ackFn({defaultDirectory: process.cwd()});
  },

  async "lively.shell.env"(tracker, _, ackFn) {
    ackFn({env: process.env});
  }

}


// var L2LService = {
//
//   writeToShellCommand: function(sessionServer, connection, msg) {
//     // sends input (stdin) to running processes
//     function answer(data) {
//         connection.send({action: msg.action + 'Result',
//             inResponseTo: msg.messageId, data: data});
//     }
//     var pid = msg.data.pid, input = msg.data.input;
//     if (!pid) { answer({error: 'no pid'}); return; }
//     if (!input) { answer({error: 'no input'}); return; }
//     var cmd = findShellCommand(pid);
//     if (!cmd) { answer({error: 'command not found'}); return; }
//     if (!cmd.process) { answer({error: 'command not running'}); return; }
//     debug && console.log('writing to shell command %s: %s', pid, input);
//     cmd.process.stdin.write(input);
//     answer({message: 'OK'});
//   }
//
// }




//
// // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//
// /*
//  * Lively2Lively services
//  */

// var services = require("./LivelyServices").services;
// util._extend(services, shellServices);
//
// // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//
// module.exports = d.bind(function(route, app) {
//
//     app.get(route + 'download-file', function(req,res) {
//         // GET http://lively-web.org/nodejs/DownloadExampleServer/callmeanything.txt/this%20is%20the%20file%20content
//         // donwloads a file named callmeanything.txt with "this is the file content"
//         var p = req.query.path, resolvedPath = path.resolve(p);
//
//         var err = !p ? "no path query" :
//             (!fs.existsSync(resolvedPath) ? "no such file: " + resolvedPath : null);
//         if (err) { res.status(400).end(err); return; }
//
//         var name = path.basename(resolvedPath);
//
//         res.set("Content-Disposition", "attachment; filename='" + name + "';");
//         res.set("Content-Type", "application/octet-stream");
//
//         var stream = fs.createReadStream(resolvedPath).pipe(res);
//         stream.on('error', function() {
//             res.status(500).end("Error reading / sending " + resolvedPath);
//         });
//     });
//
//     app.get(route + "read-file", function(req, res) {
//       var q = require("url").parse(req.url, true).query;
//       var fn = q.fileName;
//       var mimeType = q.mimeType || "text/plain";
//       if (!fn || !fs.existsSync(fn) || !fs.statSync(fn).isFile()) {
//         res.status(400).end("cannot read " + fn);
//         return;
//       }
//
//       res.contentType(mimeType);
//       fs.createReadStream(fn).pipe(res);
//     });
//
//     app.get(route, function(req, res) {
//         res.json({platform: process.platform, cwd: dir});
//     });
//
//     app.delete(route, function(req, res) {
//         var pid = req.body && req.body.pid,
//             commandsToKill = pid ? shellCommands.filter(function(cmd) { return cmd.process && cmd.process.pid === pid; }) : shellCommands,
//             pids = [];
//         commandsToKill.forEach(function(cmd) {
//             if (!cmd.process) return;
//             var pid = cmd.process.pid;
//             pids.push(pid);
//             console.log('Killing CommandLineServer command process with pid ' + pid);
//             cmd.process && cmd.process.kill();
//         });
//         res.end(JSON.stringify({
//             message: !pids || !pids.length ?
//                 'no process were running' :
//                 'processes with pids ' + pids + ' killed'}));
//     });
//
//     app.post(route, function(req, res) {
//         var command = req.body && req.body.command,
//             stdin = req.body && req.body.stdin,
//             env = req.body && req.body.env,
//             dir = req.body && req.body.cwd,
//             isExec = req.body && req.body.isExec,
//             auth = req.headers.authorization;
//
//         if (!command) { res.status(400).end(); return; }
//
//         if (auth) {
//           env = env || {};
//           env.L2L_ASKPASS_AUTH_HEADER = auth; // needed in bin/commandline2lively.js
//         }
//
//         var cmd, cmdInstructions = {
//             command: command,
//             cwd: dir,
//             env: env,
//             isExec: isExec,
//             stdin: stdin
//         };
//
//         try {
//             cmd = runShellCommand(cmdInstructions);
//         } catch(e) {
//             var msg = 'Error invoking shell: ' + e + '\n' + e.stack;
//             console.error(msg);
//             res.status(500).json({error: msg}).end(); return;
//         }
//         if (!cmd || !cmd.process) {
//             res.status(400).json({error: 'Could not run ' + command}).end();
//             return;
//         }
//
//         // make it a streaming response:
//         res.removeHeader('Content-Length');
//         res.set({
//           'Content-Type': 'text/plain',
//           'Transfer-Encoding': 'chunked'
//         });
//
//         cmd.process.stdout.on('data', function (data) {
//             res.write(formattedResponseText('STDOUT', data));
//         });
//
//         cmd.process.stderr.on('data', function (data) {
//             res.write(formattedResponseText('STDERR', data));
//         });
//
//         cmd.process.on('close', function(code) {
//             res.write(formattedResponseText('CODE', cmd.lastExitCode));
//             res.end();
//         });
//     });
//
// });
