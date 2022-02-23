import L2LClient from 'lively.2lively/client.js';
import {
  runCommand as _runCommand,
  env as _env,
  defaultDirectory as _defaultDirectory
} from 'lively.shell/client-command.js';
import { string } from 'lively.lang';

// FIXME put this in either config or have it provided by server
// var defaultConnection = {url: `${document.location.origin}/lively-socket.io`, namespace: "l2l"};

const defaultConnection = { url: `${document.location.origin}/lively-socket.io`, namespace: 'l2l' };

// var cmd = runCommand("ls"); await cmd.whenDone(); cmd.output;
export function runCommand (commandString, opts = {}) {
  return _runCommand(commandString, { l2lClient: L2LClient.ensure(defaultConnection), ...opts });
}

// await defaultDirectory()
export async function defaultDirectory () { return await _defaultDirectory(L2LClient.ensure(defaultConnection)); }

// await env()
export function env () { return _env(L2LClient.ensure(defaultConnection)); }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function readFile (path, options = {}) {
  options = options || {};
  const cmd = runCommand(`cat "${path}"`, options);
  return cmd.whenDone().then(() => cmd.output);
}

function writeFile (path, options, thenDo) {
  if (typeof options === 'string') options = { content: options };
  options = options || {};
  options.content = options.content || '';
  if (this.PLATFORM !== 'win32') path = '"' + path + '"';
  const cmd = this.run('tee ' + path, { stdin: options.content, cwd: options.cwd });
  if (options.onEnd) lively.bindings.connect(cmd, 'end', options, 'onEnd');
  if (thenDo) lively.bindings.connect(cmd, 'end', { thenDo: thenDo }, 'thenDo');
  return cmd;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function parseCommand (cmd) {
  // parseCommand('grep o -')
  const result = []; let word = ''; let state = 'normal';
  function add () {
    if (word.length > 0) result.push(word); word = '';
  }
  for (var i = 0, c; c = cmd[i]; i++) {
    if (state === 'normal' && /\s/.test(c)) { add(); continue; }
    if (c === '"' || c === "'") {
      if (state === 'normal') { state = c; continue; }
      if (state === c) { state = 'normal'; continue; }
    }
    if (c === '\\' && state === cmd[i + 1]) { i++; c = cmd[i]; }
    word += c;
  }
  add();
  return result;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const defaultGrepExclusions = [
  '.svn',
  '.git',
  'node_modules',
  'dist',
  '.module_cache',
  'lively.next-node_modules'
];

export function doGrep (queryString, path, options = {}) {
  let {
    exclusions,
    fileTypes = [], // allow all,
    sizeLimit = '+1M',
    charsBefore = 80,
    charsAfter = 80
  } = options;

  if (!exclusions) exclusions = defaultGrepExclusions;

  const fullPath = path;
  const excludes = exclusions.length ? '-iname ' + exclusions.map(JSON.stringify).join(' -o -iname ') : '';
  const sizeExclude = sizeLimit ? '-size ' + sizeLimit : '';
  var prune = [excludes, sizeExclude].filter(Boolean).join(' -o ');
  var prune = prune ? `\\( ${prune} \\) -prune -o` : '';
  var allowedFileNames = fileTypes.length ? '-iname ' + fileTypes.map(JSON.stringify).join(' -o -iname ') : '';
  var allowedFileNames = allowedFileNames ? `-a \\( ${allowedFileNames} \\)` : '';
  var baseCmd = 'find %s %s -type f %s -a -print0 | xargs -0 grep -IinH -o ".\\{0,%s\\}%s.\\{0,%s\\}" ';
  const platform = 'mac'; // FIXME
  var baseCmd = platform !== 'win32' ? baseCmd.replace(/([\(\);])/g, '\\$1') : baseCmd;
  const cmdString = string.format(baseCmd, fullPath, prune, allowedFileNames, charsBefore, queryString, charsAfter);
  const cmd = runCommand(cmdString);

  cmd.whenDone().then(({ exitCode, stdout, stderr }) => {
    if (exitCode && exitCode !== 1) return;
    cmd.results = stdout.split('\n')
      // .map((line) => line.replace(/\/\//g, '/'));
      .map(line => {
        const reMatch = line.match(/(.*):([0-9]+):(.*)/);
        if (!reMatch) return null;
        const [_, filename, lineno, match] = reMatch;
        return { filename, lineno: Number(lineno) - 1, match };
      }).filter(Boolean);
  });

  return cmd;
}
