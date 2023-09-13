import { promise, events } from 'lively.lang';

let _commands;
_commands = _commands || [];

export default class CommandInterface {
  static get commands () {
    return _commands; // command interface is not reload safe
  }

  static findCommand (pid) {
    return this.commands.find(ea => ea.pid === pid);
  }

  constructor () {
    this._stdout = '';
    this._stderr = '';
    this.exitCode = undefined;
    this.commandString = '';
    this.process = null;
    this._whenDone = promise.deferred();
    this._whenStarted = promise.deferred();
    this.startTime = 0;
    this.lastSignal = null;
    events.makeEmitter(this);
  }

  get isShellCommand () { return true; }

  get status () {
    if (!this.process) return 'not started';
    if (this.exitCode === undefined) return `running, pid ${this.pid}`;
    return `exited ${this.exitCode}, pid ${this.pid}`;
  }

  get pid () {
    return this.process ? this.process.pid : null;
  }

  get output () {
    return this.stdout + (this.stderr ? '\n' + this.stderr : '');
  }

  get stdout () { return this._stdout; }
  get stderr () { return this._stderr; }

  isRunning () {
    return this.process && this.exitCode === undefined;
  }

  isDone () {
    return this.exitCode !== undefined;
  }

  whenStarted () {
    return this._whenStarted.promise;
  }

  whenDone () {
    return this._whenDone.promise;
  }

  spawn (cmdInstructions = { command: null, env: {}, cwd: null, stdin: null }) {
    throw new Error('not yet implemented');
  }

  kill (signal = 'KILL') {
    this.lastSignal = signal;
  }

  toString () {
    return `${this.constructor.name}(${this.commandString}, ${this.status})`;
  }
}
