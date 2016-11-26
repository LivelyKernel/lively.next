import L2LClient from "lively.2lively/client.js";
import {
  runCommand as _runCommand,
  env as _env,
  defaultDirectory as _defaultDirectory
} from "lively.shell/client-command.js";


// FIXME put this in either config or have it provided by server
// var defaultConnection = {url: `${document.location.origin}/lively-socket.io`, namespace: "l2l"};
var defaultConnection = {url: `http://localhost:9010/lively-socket.io`, namespace: "l2l"};

// var cmd = runCommand("ls"); await cmd.whenDone(); cmd.output;
export function runCommand(commandString, opts = {}) {  
  return _runCommand(commandString, {l2lClient: L2LClient.ensure(defaultConnection), ...opts});
}

// await defaultDirectory()
export function defaultDirectory() { return _defaultDirectory(L2LClient.ensure(defaultConnection)); }

// await env()
export function env() { return _env(L2LClient.ensure(defaultConnection)); }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function readFile(path, options = {}) {
  options = options || {};
  var cmd = runCommand(`cat "${path}"`, options);
  return cmd.whenDone().then(() => cmd.output);
}

function writeFile(path, options, thenDo) {
  if (typeof options === "string") options = {content: options};
  options = options || {};
  options.content = options.content || '';
  if (this.PLATFORM !== 'win32') path = '"' + path + '"';
  var cmd = this.run('tee ' + path, {stdin: options.content, cwd: options.cwd});
  if (options.onEnd) lively.bindings.connect(cmd, 'end', options, 'onEnd');
  if (thenDo) lively.bindings.connect(cmd, 'end', {thenDo: thenDo}, 'thenDo');
  return cmd;
}

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
