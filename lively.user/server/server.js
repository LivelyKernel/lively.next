global.Headers = {};
import { promise } from "lively.lang";
import * as http from "http";
import { handleRequest } from "./http-handler.js";


export async function start(opts = {}) {
  // opts = {hostname, port, userdb}
  opts = {...opts};
  var server = LivelyAuthServer.ensure(opts);
  await server.whenStarted();
  return server;
}

export default class LivelyAuthServer {

  static canonicalizeOptions(opts) {
    return {
      hostname: "localhost",
      port: 9021,
      debug: true,
      ...opts
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // server instance storage
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  static get servers() {
    return this._servers || (this._servers = new Map());
  }

  static _key(opts) {
    var {hostname, port} = this.canonicalizeOptions(opts);
    return `${hostname}:${port}`;
  }

  static _register(server) { this.servers.set(this._key(server), server); }
  static _unregister(server) { this.servers.delete(this._key(server)); }

  static find(opts) { return this.servers.get(this._key(opts)); }
  static ensure(opts) { return this.find(opts) || new this(opts).start(); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  constructor(opts) {
    opts = this.constructor.canonicalizeOptions(opts);
    this.hostname = opts.hostname;
    this.port = opts.port;
    this.debug = opts.debug;
    this.options = opts;

    // state = "not started", "listening", "starting", "closed"
    this._state = "not started";
    this._requestFn = null;
  }

  isListening() { return this._state === "listening"; }

  isClosed() { return this._state !== "starting" && this._state !== "listening"; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lifetime
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  whenStarted(timeout = 1000) {
    return promise.waitFor(timeout, () => this.isListening()).then(() => this);
  }

  whenClosed(timeout = 1000, callback) {
    if (!callback && typeof timeout === "function") {
      callback = timeout;
      timeout = 1000;
    }
    return promise.waitFor(timeout, () => this.isClosed()).then(() => {
      if (typeof callback === "function") callback();
      return true;
    });

  }

  start() {
    if (this._state === "starting") { console.log(`${this} already starting`); return this; }
    if (this.isListening()) return this;

    this.constructor._register(this);

    this._state = "starting";

    var {debug, hostname, port} = this,
    server = http.createServer();

    this.server = server;

    this._requestFn = (req, res) => this.handleRequest(req, res);
    server.on("request", this._requestFn);

    server.listen(port, hostname, () => {
      this._state = "listening";
      this.debug && console.log(`[lively.auth/server] ${this} listening`);
    });

    server.once("close", () => {
      this._state = "closed";
      this.debug && console.log(`[lively.auth/server] ${this} closed`);
    });

    return this
  }

  async close(serverState = {}) {
    if (this.isClosed()) return this;

    debug && console.log(`[lively.auth/server] initialize shutdown of ${this}`);

    var {debug, server} = this;
    server.close();
    server.removeListener("request", this._requestFn);

    this.whenClosed(() => this.constructor._unregister(this)).catch((err) => {});

    return this;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // http handling
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async handleRequest(req, res) {
    let next = () => this.defaultHandleRequest(req, res);
    try {
      cors(req, res);
      await handleRequest(this, req, res, next);
    } catch (err) {
      var msg = `Error handling request:\n${err.stack}`;
      console.error(msg);
      res.writeHead(500);
      res.end(msg);      
    }
  }

  defaultHandleRequest(req, res) {
    if (req.url === "/") {
      res.writeHead(200);
      res.end("hello friend");
    } else {
      res.writeHead(404);
      res.end('{"error":"nothing to see here, move along"}');
    }
  }

  toString() {
    var {_state, hostname, port} = this;
    return `LivelyAuthServer(${hostname}:${port} ${_state})`;
  }

}

function cors(req, res) {
  var allowOrigin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Depth, Cookie, Set-Cookie, Accept, Access-Control-Allow-Credentials, Origin, Content-Type, Request-Id , X-Api-Version, X-Request-Id, Authorization");
  res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS, PROPFIND, REPORT, MKCOL');
  res.setHeader("Access-Control-Expose-Headers", "Date, Etag, Set-Cookie");
}
