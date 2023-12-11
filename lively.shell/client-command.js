import CommandInterface from './command-interface.js';
import { promise, arr, obj } from 'lively.lang';
import { signal } from 'lively.bindings';

let debug = false;

let _commands;
_commands = _commands || [];

export default class ClientCommand extends CommandInterface {
  static installLively2LivelyServices (l2lClient) {
    Object.keys(L2LServices).forEach(name => // eslint-disable-line no-use-before-define
      l2lClient.addService(name,
        async (tracker, msg, ackFn) => L2LServices[name](tracker, msg, ackFn))); // eslint-disable-line no-use-before-define
  }

  static get commands () {
    return _commands;
  }

  constructor (l2lClient) {
    super();
    this.debug = debug;
    this.l2lClient = l2lClient;
  }

  envForCommand (opts) {
    // here we set environment variables for the command to be run. the stuff
    // below is to support the bin/command2lively.js script and related scripts
    // like askpass support
    let { id, origin, path, namespace } = this.l2lClient;
    let { env, owner } = opts || {};
    env = env || {};
    if (owner) env.LIVELY_COMMAND_OWNER = owner;
    return {
      // L2L_ASKPASS_AUTH_HEADER:
      ASKPASS_SESSIONID: id,
      L2L_EDITOR_SESSIONID: id,
      L2L_SESSIONTRACKER_SERVER: origin,
      L2L_SESSIONTRACKER_PATH: path,
      L2L_SESSIONTRACKER_NS: namespace,
      ...env
    };
  }

  async spawn (cmdInstructions = { command: null, env: {}, cwd: null, stdin: null }) {
    let { l2lClient } = this;
    let { command, env, cwd, stdin } = cmdInstructions;

    this.startTime = new Date();

    env = this.envForCommand(cmdInstructions);

    this.debug && console.log(`${this} spawning ${command}`);
    this.debug && this.whenStarted().then(() => console.log(`${this} started`));
    this.debug && this.whenDone().then(() => console.log(`${this} exited`));

    arr.pushIfNotIncluded(this.constructor.commands, this);

    this.commandString = Array.isArray(command) ? command.join('') : command;

    let error, pid;
    if (!l2lClient.isOnline()) error = 'L2L not connected';
    else {
      ({ data: { error, pid } } = await l2lClient.sendToAndWait(l2lClient.trackerId,
        'lively.shell.spawn', { command, env, cwd, stdin }, {
          ackTimeout: 30 * 1000
        }));
    }

    if (error) {
      debug && console.error(`[${this}] error at start: ${error}`);
      this.process = { error };
      this.exitCode = 1;
      signal(this, 'error', error);
      this._whenDone.reject(error);
      return;
    }

    this.process = { pid };
    debug && console.log(`[${this}] got pid ${pid}`);
    signal(this, 'pid', pid);

    this._whenStarted.resolve();

    return this;
  }

  async writeToStdin (content) {
    if (!this.isRunning()) return;
    let { l2lClient, pid } = this;
    await l2lClient.sendToAndWait(l2lClient.trackerId,
      'lively.shell.writeToStdin', { pid, stdin: String(content) });
  }

  async kill (signal = 'KILL') {
    if (!this.isRunning()) return;
    debug && console.log(`${this} signaling ${signal}`);
    this.lastSignal = signal;
    let { pid, l2lClient } = this;
    let { data: { status, error } } = await l2lClient.sendToAndWait(
      l2lClient.trackerId, 'lively.shell.kill', { pid });
    debug && console.log(`${this} kill send: ${error || status}`);
    if (error) throw new Error(error);
    return this.whenDone();
  }

  onOutput ({ stdout, stderr }) {
    if (stdout) {
      this._stdout += stdout;
      signal(this, 'stdout', stdout);
      this.emit('stdout', stdout);
    }
    if (stderr) {
      this._stderr += stderr;
      signal(this, 'stderr', stderr);
      this.emit('stderr', stderr);
    }
  }

  onClose (code) {
    arr.remove(this.constructor.commands, this);
    this.exitCode = code;
    this.emit('close', code);
    signal(this, 'close', code);
    this._whenDone.resolve(this);
  }

  onError (err) {
    arr.remove(this.constructor.commands, this);
    this._stderr += err.stack;
    this.exitCode = 1;
    this.emit('error', err.stack);
    signal(this, 'error', err.stack);
    this._whenDone.reject(err);
  }
}

export function runCommand (commandString, opts = {}) {
  let { l2lClient } = opts;

  if (!l2lClient) { throw new Error('lively.shell client side runCommand needs opts.l2lClient!'); }

  ClientCommand.installLively2LivelyServices(l2lClient);
  let cmd = new ClientCommand(l2lClient);
  cmd.spawn({ command: commandString, ...obj.dissoc(opts, ['l2lClient']) });
  return cmd;
}

let dirCache = {};
export function defaultDirectory (l2lClient) {
  if (dirCache[l2lClient.trackerId]) return dirCache[l2lClient.trackerId];
  return l2lClient.whenRegistered().then(async () => {
    let { data: { defaultDirectory } } = await l2lClient.sendToAndWait(l2lClient.trackerId, 'lively.shell.info', {});
    return dirCache[l2lClient.trackerId] = defaultDirectory;
  });
}

// await serverEnv()
export async function env (l2lClient) {
  let { data: { env } } = await l2lClient.sendToAndWait(l2lClient.trackerId, 'lively.shell.env', {});
  return env;
}

export function readFile (path, options = {}) {
  options = options || {};
  let cmd = runCommand(`cat "${path}"`, options);
  return cmd.whenDone().then(() => {
    if (cmd.exitCode) throw new Error(`Read ${path} failed: ${cmd.stderr}`);
    return cmd.output;
  });
}

export function writeFile (path, content, options) {
  if (!options && content && content.content) {
    options = content;
    content = options.content;
  }
  content = content || '';
  let cmd = runCommand(`tee "${path}"`, { stdin: content, ...options });
  return cmd.whenDone().then(() => {
    if (cmd.exitCode) throw new Error(`Write ${path} failed: ${cmd.stderr}`);
    return cmd;
  });
}

let cmd;
const L2LServices = {

  'lively.shell.onOutput': async (client, { data: { pid, stdout, stderr } }, ackFn, sender) => {
    debug && console.log(`[lively.shell] client received lively.shell.onOutput for command ${pid}`);
    try {
      cmd = await promise.waitFor(1000, () => ClientCommand.findCommand(pid));
    } catch (e) {
      console.warn(`[lively.shell] received output for command ${pid} but it isn't registered!'`);
      return;
    }
    cmd.onOutput({ stdout, stderr });
  },

  'lively.shell.onExit': async (client, { data: { pid, code, error } }, ackFn, sender) => {
    debug && console.log(`[lively.shell] client received lively.shell.onExit for command ${pid}`);

    try {
      cmd = await promise.waitFor(1000, () => ClientCommand.findCommand(pid));
    } catch (e) {
      console.warn(`[lively.shell] received exit message for command ${pid} but it isn't registered!'`);
      return;
    }

    if (error) {
      if (typeof error === 'string') { error = new Error(error); }
      cmd.onError(error);
    } else cmd.onClose(code);
  }

};
