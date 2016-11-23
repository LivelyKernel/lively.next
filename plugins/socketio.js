import { arr } from "lively.lang";
import socketio from "socket.io";

export default class SocketioPlugin {

  constructor(opts) {
    opts = {
      socketIOPath: '/lively-socket.io',
      ...opts
    }
    this.socketIOPath = opts.socketIOPath;
    this.io = null;
    this.httpHandler = null;
  }

  get name() { return "socketio"; }

  get after() { return ["cors"]; }

  setup({server}) {
    if (this.io)
      console.trace(`Called setup multiple times for SocketioPlugin?`);
      
    // we dance this little dance to ensure that our handlers are added before
    // the socket.io handler so we can inject cors headers. In newer nodes
    // emitter.prependListener can be used instead    
    var listeners1 = server.listeners("request").slice(),
        _ = this.io = socketio(server, {path: this.socketIOPath}),
        listeners2 = server.listeners("request"),
        listeners3 = arr.withoutAll(listeners2, listeners1);

   server.removeAllListeners("request")
   listeners1.forEach(ea => server.on("request", ea));
  }

  close() {
    if (!this.io) return;

    try {
      this.io.close();
      console.log(`[lively.server] socket.io stopped`);
    } catch (e) {
      console.error(`Error closing socket.io server: ${e.stack}`);
    } finally {
      this.io = null;
    }
  }

  handleRequest(req, res, next) {
    console.assert(this.io, "socket io plugin not setup but handleRequest called");
    if (req.url.startsWith(this.socketIOPath))
      this.io.engine.handleRequest(req, res);
    else next();
  }

}
