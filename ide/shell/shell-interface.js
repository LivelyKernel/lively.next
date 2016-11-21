import L2LClient from "lively.2lively/client.js";
import {
  runCommand as _runCommand,
  env as _env,
  defaultDirectory as _defaultDirectory
} from "lively.shell/client-command.js";


// FIXME put this in either config or have it provided by server
var defaultConnection = {url: "http://localhost:9010/lively-socket.io", namespace: "l2l"};

// var cmd = runCommand("ls"); await cmd.whenDone(); cmd.stdout;
export function runCommand(commandString, opts = {}) {  
  return _runCommand(commandString, {l2lClient: L2LClient.ensure(defaultConnection), ...opts});
}

// await defaultDirectory()
export function defaultDirectory() { return _defaultDirectory(L2LClient.ensure(defaultConnection)); }

// await env()
export function env() { return _env(L2LClient.ensure(defaultConnection)); }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function parseCommand(cmd) {
  // parseCommand('grep o -')
  var result = [], word = '', state = 'normal';
  function add() {
    if (word.length > 0) result.push(word); word = '';
  }
  for (var i = 0, c; c = cmd[i]; i++) {
    if (state === 'normal' && /\s/.test(c)) { add(); continue; }
    if (c === "\"" || c === "'") {
        if (state === 'normal') { state = c; continue; }
        if (state === c) { state = 'normal'; continue; }
    }
    if (c === '\\' && state === cmd[i+1]) { i++; c = cmd[i]; }
    word += c;
  }
  add();
  return result;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


        // if (lively2LivelyShellAvailable) {
        //     var env = options;
        //     options.env = Object.extend(options.env || {}, {
        //         "L2L_ASKPASS_SSL_CA_FILE": lively.Config.askpassSSLcaFile || "",
        //         "L2L_ASKPASS_SSL_KEY_FILE": lively.Config.askpassSSLkeyFile || "",
        //         "L2L_ASKPASS_SSL_CERT_FILE": lively.Config.askpassSSLcertFile || "",
        //         "ASKPASS_SESSIONID": session.sessionId,
        //         "L2L_EDITOR_SESSIONID": session.sessionId,
        //         "EDITOR": "lively-as-editor.sh",
        //         "L2L_SESSIONTRACKER_URL": String(session.sessionTrackerURL.withFilename('connect'))
        //     });
        // }


    // readFile: function(path, options, thenDo) {
    //     if (typeof options === "function") { thenDo = options; options = null; }
    //     options = options || {};
    //     if (this.PLATFORM !== 'win32') path = '"' + path + '"';
    //     var cmd = this.run('cat ' + path, options);
    //     if (options.onInput) lively.bindings.connect(cmd, 'stdout', options, 'onInput');
    //     if (options.onEnd) lively.bindings.connect(cmd, 'end', options, 'onEnd');
    //     if (thenDo) lively.bindings.connect(cmd, 'end', {thenDo: thenDo}, 'thenDo');
    //     return cmd;
    // },
    // 
    // cat: function(path, options, thenDo) {
    //     // like readfile but with err, content callback isntead of cmd
    //     if (typeof options === "function") { thenDo = options; options = null; }
    //     return lively.ide.CommandLineInterface.readFile(path, options, function(cmd) {
    //       thenDo && thenDo(cmd.getCode() ? new Error(cmd.getStderr()) : null, cmd.getStdout()); });
    // },
    // 
    // writeFile: function(path, options, thenDo) {
    //     if (typeof options === "string") options = {content: options};
    //     options = options || {};
    //     options.content = options.content || '';
    //     if (this.PLATFORM !== 'win32') path = '"' + path + '"';
    //     var cmd = this.run('tee ' + path, {stdin: options.content, cwd: options.cwd});
    //     if (options.onEnd) lively.bindings.connect(cmd, 'end', options, 'onEnd');
    //     if (thenDo) lively.bindings.connect(cmd, 'end', {thenDo: thenDo}, 'thenDo');
    //     return cmd;
    // },
    // 
    // downloadFile: function(path, options, thenDo) {
    //     this.commandLineServerURL
    //         .withFilename("download-file")
    //         .withQuery({path: path})
    //         .asWebResource().beAsync()
    //         .get().whenDone(function(_, status) {
    //             thenDo && thenDo(status.isSuccess() ? null : status);
    //         });
    // },
    // 
    // rm: function(path, options, thenDo) {
    //   if (typeof options === "function") { thenDo = options; options = null; }
    //   options = options || {};
    //   return lively.ide.CommandLineInterface.run("rm -rf " + path, options, function(err, cmd) {
    //     (typeof thenDo === "function") && thenDo(cmd.getCode() ? cmd.resultString(true) : null); });
    // },
    // 
    // ls: function(path, thenDo) {
    //   return new Promise(function(resolve, reject) {
    //     lively.ide.CommandLineSearch.findFiles(
    //       "*",
    //       {rootDirectory: path, cwd: path, depth: 1},
    //       function(err, result) {
    //         err ? reject(err) : resolve(result);
    //         thenDo && thenDo(null, result);
    //       });
    //   })
    // },
    // 
    // diffIgnoringWhiteSpace: function(string1, string2, thenDo) {
    //     return lively.ide.CommandLineInterface.runAll([
    //         {command: 'mkdir -p diff-tmp/'},
    //         {writeFile: 'diff-tmp/a', content: string1},
    //         {writeFile: 'diff-tmp/b', content: string2},
    //         {name: 'diff', command: 'git diff -w --no-index --histogram diff-tmp/a diff-tmp/b'},
    //         {command: 'rm -rfd diff-tmp/'}
    //     ], function(err, result) { thenDo(result.diff.resultString(true)); });
    // },
    // 
    // diff: function(string1, string2, thenDo) {
    //     return lively.ide.CommandLineInterface.runAll([
    //         {command: 'mkdir -p diff-tmp/'},
    //         {writeFile: 'diff-tmp/a', content: string1},
    //         {writeFile: 'diff-tmp/b', content: string2},
    //         {name: 'diff', command: 'git diff --no-index --histogram diff-tmp/a diff-tmp/b'},
    //         {command: 'rm -rfd diff-tmp/'}
    //     ], function(err, result) { thenDo(result.diff.resultString(true)); });
    // },
    // 
    // // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // 
