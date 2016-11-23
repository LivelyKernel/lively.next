import Tracker from "lively.2lively/tracker.js";

export default class Lively2LivelyPlugin {

  constructor(opts = {l2lNamespace: "l2l"}) {
    this.l2lNamespace = opts.l2lNamespace;
    this.l2lTracker = null
  }

  get name() { return "l2l" }

  get after() { return ["socketio"]; }

  setup(livelyServer) {
    if (this.l2lTracker)
      console.trace("l2l plugin setup multiple times")

    var {hostname, port} = livelyServer,
        {l2lNamespace} = this,
        io = livelyServer.findPlugin("socketio").io;

    this.l2lTracker = Tracker.ensure({namespace: l2lNamespace, io, hostname, port});

    this.l2lTracker.whenOnline(1000)
      .then(() => livelyServer.debug && console.log(`[lively.server] started ${this.l2lTracker}`))
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