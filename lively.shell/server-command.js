/* global System, process, require */
import CommandInterface from './command-interface.js';
import { stripAnsiAttributes } from './ansi-color-parser.js';
import { promise, arr, string } from 'lively.lang';
import { signal } from 'lively.bindings';
import { format } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import proc from 'child_process';
import { fileURLToPath } from 'url';

let spawn, exec, isWindows, defaultEnv, windowsBash;
let askPassScript = '';
let editorScript = '';
let doKill;
let debug = false;

function fileURLToPathIfNeeded (urlOrPath) {
  return typeof urlOrPath === 'string' && urlOrPath.startsWith('file:')
    ? fileURLToPath(urlOrPath)
    : urlOrPath;
}

let LIVELY = typeof System !== 'undefined' ? fileURLToPathIfNeeded(System.baseURL) : process.cwd();

let binDir = typeof System !== 'undefined'
  ? fileURLToPathIfNeeded(System.decanonicalize('lively.shell/bin/'))
  : '';
if (typeof System === 'undefined') {
  const resolvedBinDir = import.meta.resolve('lively.shell/bin/');
  if (typeof resolvedBinDir === 'string') binDir = fileURLToPathIfNeeded(resolvedBinDir);
  else Promise.resolve(resolvedBinDir).then((res) => {
    binDir = fileURLToPathIfNeeded(res);
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function pathEnvValue (env) {
  const key = Object.keys(env || {}).find(key =>
    isWindows ? key.toLowerCase() === 'path' : key === 'PATH');
  return key ? env[key] : '';
}

function setPathEnvValue (env, value) {
  if (isWindows) {
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === 'path') delete env[key];
    }
    env.Path = value;
  } else {
    env.PATH = value;
  }
  return env;
}

function normalizedEnv (env) {
  const result = {};
  for (const key of Object.keys(env || {})) {
    if (isWindows && key.toLowerCase() === 'path') continue;
    if (env[key] !== undefined) result[key] = env[key];
  }
  setPathEnvValue(result, pathEnvValue(env));
  return result;
}

function normalizeCwd (cwd) {
  let normalized = String(cwd || process.cwd());
  if (!isWindows) return normalized;

  if (normalized.startsWith('file:')) {
    try { normalized = fileURLToPath(normalized); } catch (_) {}
  }
  normalized = normalized.replace(/^git\//, '');
  if (normalized.match(/^\/[a-z]:[\\/]/i)) normalized = normalized.slice(1);
  return normalized;
}

/*
 * determine the kill command at startup. if pkill is available then use that
 * to do a full process tree kill
 */
function defaultKill (pid, signal, thenDo) {
  // signal = "SIGKILL"|"SIGQUIT"|"SIGINT"|...
  debug && console.log('signal pid %s with', pid, signal);
  signal = signal.toUpperCase().replace(/^SIG/, '');
  exec('kill -s ' + signal + ' ' + pid, function (code, out, err) {
    debug && console.log('signal result: ', out, err);
    thenDo(code, out, err);
  });
}

function pkillKill (pid, signal, thenDo) {
  // signal = "SIGKILL"|"SIGQUIT"|"SIGINT"|...
  signal = signal.toUpperCase().replace(/^SIG/, '');
  // rk 2015-07-15: properly killing piped processes -- currently this only
  // works when making the spawned process a group leader
  let killCmd = format('pkill -%s -g $(ps opgid= "%s")', signal, pid);
  debug && console.log('signal pid %s with %s (%s)', pid, signal, killCmd);
  exec(killCmd, function (code, out, err) {
    debug && console.log('signal result: ', out, err);
    thenDo(code, out, err);
  });
}

let _commands;
_commands = _commands || [];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// var c = new Command();
// c.spawn({command: "ls"})

export default class ServerCommand extends CommandInterface {
  static installLively2LivelyServices (tracker) {
    Object.keys(L2LServices).forEach(name => // eslint-disable-line no-use-before-define
      tracker.addService(name,
        async (tracker, msg, ackFn) => L2LServices[name](tracker, msg, ackFn))); // eslint-disable-line no-use-before-define
  }

  static get commands () {
    return _commands;
  }

  constructor () {
    super();
    this.debug = debug;
  }

  envForCommand (opts = { env: {} }) {
    // here we set environment variables for the command to be run. the stuff
    // below is to support the bin/command2lively.js script and related scripts
    // like askpass support
    let env = { ...opts.env };
    if (env['ASKPASS_SESSIONID'] && askPassScript) { env['SUDO_ASKPASS'] = env['SSH_ASKPASS'] = env['GIT_ASKPASS'] = askPassScript; }
    env['EDITOR'] = editorScript;
    env['GIT_EDITOR'] = editorScript;
    return env;
  }

  spawn (cmdInstructions = { command: null, env: {}, cwd: null, stdin: null, stripAnsiAttributes: true }) {
    let cwd, stdin, command, args;
    let options = {
      env: null,
      cwd: null,
      stdin: null,
      stripAnsiAttributes: true,
      ...cmdInstructions
    };

    this.startTime = new Date();

    if (this.process) {
      throw new Error(`${this} already has process attached, wont spawn again!`);
    }

    ({ command, cwd, stdin } = options);
    const commandEnv = this.envForCommand(options);
    let env = { ...defaultEnv, ...commandEnv };
    if (isWindows) setPathEnvValue(env, pathEnvValue(commandEnv) || pathEnvValue(defaultEnv));
    cwd = normalizeCwd(cwd);

    command = Array.isArray(command) ? command.join(' ') : String(command);

    // hmm (variable) expansion seems not to work with spawn
    // as a quick hack do it manually here
    command = command.replace(
      /\$[a-zA-Z0-9_]+/g,
      match => env[match.slice(1, match.length)] || match);

    if (isWindows) {
      ([command, args] = windowsBash
        ? [windowsBash, ['-lc', command]]
        : ['cmd', ['/C', command]]);
    } else {
      command = `source ${binDir}/lively.profile; ${command}`;
      ([command, args] = ['/bin/bash', ['-c', command]]);
    }

    const commandLine = [command].concat(args).join(' ');
    let proc = spawn(command, args, { env, cwd, stdio: 'pipe', detached: true });

    if (this.debug) console.log('Running command: "%s" (%s)', commandLine, proc.pid);

    if (stdin) {
      this.debug && console.log('setting stdin to: %s', stdin);
      proc.stdin.end(stdin);
    }

    this.attachTo(proc, { ...options, commandLine, cwd, envPath: pathEnvValue(env) });

    return this;
  }

  attachTo (proc, options = { stripAnsiAttributes: true }) {
    this.process = proc;

    arr.pushIfNotIncluded(this.constructor.commands, this);

    promise.waitFor(() => proc.pid || this.exitCode !== undefined)
      .then(() => this._whenStarted.resolve());

    let { resolve, reject } = this._whenDone;

    proc.stdout.on('data', (data) => {
      this.debug && console.log('STDOUT: ' + data);
      let arg = String(data);
      if (options.stripAnsiAttributes) arg = stripAnsiAttributes(arg);
      this._stdout += arg;
      this.emit('stdout', arg);
      signal(this, 'stdout', arg);
    });

    proc.stderr.on('data', (data) => {
      this.debug && console.log('STDERR: ' + data);
      let arg = String(data);
      if (options.stripAnsiAttributes) arg = stripAnsiAttributes(arg);
      this._stderr += arg;
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
      const message = [
        err.stack || String(err),
        options.commandLine ? `Command: ${options.commandLine}` : null,
        options.cwd ? `Cwd: ${options.cwd}` : null,
        options.envPath ? `Path: ${options.envPath}` : null
      ].filter(Boolean).join('\n');
      this.debug && console.log('shell command errored ' + message);
      arr.remove(this.constructor.commands, this);
      this._stderr += message;
      this.emit('error', message);
      signal(this, 'error', message);
      this.exitCode = 1;
    });
  }

  writeToStdin (content) {
    if (!this.isRunning()) return;
    debug && console.log(`[${this}] writing to stdin ${string.truncate(String(content), 100)}`);
    this.process.stdin.write(content);
  }

  kill (signal = 'KILL') {
    if (!this.process || this.exitCode !== undefined) return Promise.resolve();
    debug && console.log(`[${this}] signaling ${signal}`);
    this.lastSignal = signal;
    return new Promise((resolve, reject) =>
      doKill(this.pid, signal, err => err ? reject(err) : resolve()));
  }
}

const L2LServices = {

  async 'lively.shell.spawn' (tracker, { sender, data }, ackFn) {
    let answer;
    try {
      let cmd = new ServerCommand().spawn(data);
      let pid = cmd.pid;

      cmd.on('stdout', stdout =>
        tracker.sendTo(sender, 'lively.shell.onOutput', { pid, stdout }));
      cmd.on('stderr', stderr =>
        tracker.sendTo(sender, 'lively.shell.onOutput', { pid, stderr }));

      cmd.on('close', code =>
        tracker.sendTo(sender, 'lively.shell.onExit', { pid, code }));
      cmd.on('error', err =>
        tracker.sendTo(sender, 'lively.shell.onExit', { pid, error: String(err.stack || err) }));

      await cmd.whenStarted();

      debug && console.log(`[lively.shell] ServerCommand started, ${cmd}`);

      answer = { status: 'started', pid };
    } catch (e) {
      debug && console.log(`[lively.shell] ServerCommand errored ${e}`);

      answer = { status: 'errored', error: e.stack };
    }

    typeof ackFn === 'function' && ackFn(answer);
  },

  async 'lively.shell.writeToStdin' (tracker, { sender, data: { pid, stdin } }, ackFn) {
    let answer, cmd;
    if (!pid) answer = { status: 'errored', error: 'No pid' };
    else if (!(cmd = ServerCommand.findCommand(pid))) {
      answer = { status: 'errored', error: 'Cannot find command with pid ' + pid };
    } else {
      try {
        await cmd.writeToStdin(stdin);
        answer = { status: 'OK' };
      } catch (e) {
        answer = { status: 'errored', error: e.stack || String(e) };
      }
    }
    typeof ackFn === 'function' && ackFn(answer);
  },

  async 'lively.shell.kill' (tracker, { sender, data: { pid, signal } }, ackFn) {
    let answer, cmd;
    if (!pid) answer = { status: 'errored', error: 'No pid' };
    else if (!(cmd = ServerCommand.findCommand(pid))) {
      answer = { status: 'errored', error: 'Cannot find command with pid ' + pid };
    } else {
      try {
        await cmd.kill(signal);
        answer = { status: 'signaled ' + signal || 'KILL' };
      } catch (e) {
        answer = { status: 'errored', error: e.stack || String(e) };
      }
    }
    typeof ackFn === 'function' && ackFn(answer);
  },

  async 'lively.shell.info' (tracker, _, ackFn) {
    ackFn({ defaultDirectory: process.cwd() });
  },

  async 'lively.shell.env' (tracker, _, ackFn) {
    ackFn({ env: process.env });
  }

};

try {
  spawn = proc.spawn;
  exec = proc.exec;

  isWindows = process.platform === 'win32';
  windowsBash = isWindows && process.env.LIVELY_WINDOWS_BASH && fs.existsSync(process.env.LIVELY_WINDOWS_BASH)
    ? process.env.LIVELY_WINDOWS_BASH
    : '';

  defaultEnv = {
    ...normalizedEnv(process.env),
    SHELL: windowsBash || '/bin/bash',
    PAGER: 'ul | cat -s',
    MANPAGER: 'ul | cat -s',
    TERM: 'xterm',
    LIVELY: LIVELY,
    ...(isWindows ? { HOME: process.env.HOME || process.env.USERPROFILE || os.homedir() } : {})
  };
  setPathEnvValue(defaultEnv, [binDir, pathEnvValue(defaultEnv)].filter(Boolean).join(path.delimiter));

  /*
   * ASKPASS support for tunneling sudo / ssh / git password requests back to the
   * browser session
   */
  (function setupAskpass () {
    askPassScript = path.join(binDir, 'askpass' + (isWindows ? '.win.sh' : '.sh'));
    if (!isWindows && fs.existsSync(askPassScript)) { try { fs.chmodSync(askPassScript, parseInt('0755', 8)); } catch (e) { console.error(e.stack); } }
  })();

  /*
   * EDITOR support
   */
  (function setupEditor () {
    editorScript = path.join(binDir, 'lively-as-editor.sh');
    if (!isWindows && fs.existsSync(editorScript)) { try { fs.chmodSync(editorScript, parseInt('0755', 8)); } catch (e) { console.error(e.stack); } }
  })();

  (function determineKillCommand () {
    doKill = defaultKill;
    exec('which pkill', function (code) { if (!code) doKill = pkillKill; });
  })();
} catch (err) {
  console.error('[lively.shell] failed to initialize server command support:', err && (err.stack || err));
}
