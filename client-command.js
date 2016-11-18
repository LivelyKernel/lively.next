import CommandInterface from "./command-interface.js";
import { promise, arr } from "lively.lang";
import { signal } from "lively.bindings";

var debug = true;

export default class ClientCommand extends CommandInterface {

  static installLively2LivelyServices(l2lClient) {
    Object.keys(L2LServices).forEach(name =>
      l2lClient.addService(name,
        async (tracker, msg, ackFn) => L2LServices[name](tracker, msg, ackFn)))
  }

  constructor(l2lClient) {
    super();
    this.debug = debug;
    this.l2lClient = l2lClient;
  }

  async spawn(cmdInstructions = {command: null, env: {}, cwd: null, stdin: null}) {  
  
    this.debug && console.log(`${this} spawning ${cmdInstructions.command}`);
    this.debug && this.whenStarted().then(() => console.log(`${this} started`));
    this.debug && this.whenDone().then(() => console.log(`${this} exited`));

    arr.pushIfNotIncluded(this.constructor.commands, this);

    var con = this.l2lClient
    var {data: {status, error, pid}} = await con.sendToAndWait(
                                        con.trackerId, "lively.shell.spawn", cmdInstructions);
    if (error) {
      debug && console.error(`[${this}] error at start: ${error}`);
      this.process = {error};
      this.exitCode = 1;
      signal(this, "error", error);
      throw new Error(error);
    }

    this.process = {pid};
    debug && console.log(`[${this}] got pid ${pid}`);

    this._whenStarted.resolve();

    return this;
  }

  async kill(signal = "KILL") {
    if (!this.isRunning()) return;
    debug && console.log(`${this} requesting kill`)
    var {pid, l2lClient} = this,
        {data: {status, error}} = await l2lClient.sendToAndWait(
                                    l2lClient.trackerId, "lively.shell.kill", {pid});
    debug && console.log(`${this} kill send: ${error || status}`);
    if (error) throw new Error(error);
    return this.whenDone();
  }

  onOutput({stdout, stderr}) {
    if (stdout) {
      this.stdout += stdout;
      signal(this, "stdout", stdout);
      this.emit("stdout", stdout);
    }
    if (stderr) {
      this.stderr += stderr;
      signal(this, "stderr", stderr);
      this.emit("stderr", stderr);
    }
  }

  onClose(code) {
console.log("onClose| removing " + this)
    arr.remove(this.constructor.commands, this);
    this.exitCode = code;
    this.emit('close', code);
    signal(this, 'close', code);
    this._whenDone.resolve(this);
  }
  
  onError(err) {
console.log("onError| removing " + this)

    arr.remove(this.constructor.commands, this);
    this.stderr += err.stack;
    this.exitCode = 1;
    this.emit('error', err.stack);
    signal(this, 'error', err.stack);
    this._whenDone.reject(err);
  }
}


var L2LServices = {

  async "lively.shell.onOutput": (client, {data: {pid, stdout, stderr}}, ackFn, sender) => {
    debug && console.log(`[lively.shell] client received lively.shell.onOutput for command ${pid}`);
    try {
      var cmd = await promise.waitFor(1000, () => ClientCommand.findCommand(pid))
    } catch (e) {
      console.warn(`[lively.shell] received output for command ${pid} but it isn't registered!'`)
      return;
    }
    cmd.onOutput({stdout, stderr})
  },

  async "lively.shell.onExit": (client, {data: {pid, code, error}}, ackFn, sender) => {
    debug && console.log(`[lively.shell] client received lively.shell.onExit for command ${pid}`);

    try {
      var cmd = await promise.waitFor(1000, () => ClientCommand.findCommand(pid))
    } catch (e) {
      console.warn(`[lively.shell] received exit message for command ${pid} but it isn't registered!'`)
      return;
    }

    if (error) {
      if (typeof error === "string")
        error = new Error(error)
      cmd.onError(error)
    } else cmd.onClose(code);

  }

}