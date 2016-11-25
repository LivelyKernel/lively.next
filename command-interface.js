import { promise, events } from "lively.lang";

export default class CommandInterface {

  static get commands() {
    return this._commands || (this._commands = []);
  }

  static findCommand(pid) {
    return this.commands.find(ea => ea.pid === pid);
  }

  constructor() {
    this.commandString = "";
    this.process = null;
    this.stdout = "";
    this.stderr = "";
    this.exitCode = undefined;
    this._whenDone = promise.deferred();
    this._whenStarted = promise.deferred();
    this.startTime = 0;
    events.makeEmitter(this);
  }

  get isShellCommand() { return true; }

  get status() {
    if (!this.process) return "not started";
    if (this.exitCode === undefined) return `running, pid ${this.pid}`;
    return `exited ${this.exitCode}, pid ${this.pid}`;
  }

  get pid() {
    return this.process ? this.process.pid : null;
  }

  get output() {
    return this.stdout + (this.stderr ? "\n" + this.stderr : "");
  }

  isRunning() {
    return this.process && this.exitCode === undefined;
  }

  isDone() {
    return this.exitCode != undefined;
  }

  whenStarted() {
    return this._whenStarted.promise;
  }

  whenDone() {
    return this._whenDone.promise;
  }

  spawn(cmdInstructions = {command: null, env: {}, cwd: null, stdin: null}) {
    throw new Error("not yet implemented");
  }

  kill(signal = "KILL") {}

  toString() {
    return `${this.constructor.name}(${this.commandString}, ${this.status})`;
  }

}