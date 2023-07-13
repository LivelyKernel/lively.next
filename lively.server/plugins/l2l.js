import Tracker from "lively.2lively/tracker.js";
import L2LClient from "lively.2lively/client.js"
import { runCommand } from 'lively.shell/client-command.js';

export default class Lively2LivelyPlugin {

  constructor() {
    this.l2lNamespace = "l2l";
    this.l2lTracker = null
  }

  toString() { return `<${this.pluginId}>`; }

  setOptions({l2lNamespace, l2lTracker} = {}) {
    this.l2lNamespace = l2lNamespace;
    this.l2lTracker = l2lTracker;
  }

  get pluginId() { return "l2l" }

  get after() { return ["socketio"]; }

  setup(livelyServer) {
    if (this.l2lTracker)
      console.trace("l2l plugin setup multiple times")

    var {hostname, port} = livelyServer,
        {l2lNamespace} = this,
        io = livelyServer.findPlugin("socketio").io;

    this.l2lTracker = Tracker.ensure({namespace: l2lNamespace, io, hostname, port});

    this.l2lTracker.whenOnline(1000)
      .then(
        () => { livelyServer.debug && console.log(`[lively.server] started ${this.l2lTracker}`);
          let {hostname, port} = livelyServer

          const client = new L2LClient.ensure({
              url: `http://${hostname}:${port}/lively-socket.io`,
              namespace: "l2l",
              info: {
                type: 'git version checker'
              }
          });
          client.whenRegistered().then(
              async () => {
                const fetchCmd = 'git fetch';
                await runCommand(fetchCmd, {l2lClient: client}).whenDone();
                const hashCmd = 'git merge-base origin/main HEAD';
                const result = await runCommand(hashCmd, {l2lClient: client}).whenDone();
                const hash = result.stdout.trim();
                client.addService('check git version', (tracker, msg, ackFn, sender) => { ackFn(msg.data.payload === hash) })
              }
          );
      })
      .catch(err => console.error(`[lively.server] Error starting l2l tracker ${err.stack}`));
  }

  async close() {
    if (!this.l2lTracker) return;
    try {
      await this.l2lTracker.remove();
      console.log(`[lively.server] l2l tracker ${this.l2lTracker} stopped`);
    } catch (e) {
      console.error(`Error closing l2l tracker ${this.l2lTracker}: ${e.stack} (${this})`);
    } finally { this.l2lTracker = null; }
  }
}