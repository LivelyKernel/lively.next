/*global Map*/
import { promise, string } from "lively.lang";
import { resource } from "lively.resources";
import ioClient from "socket.io-client";
import L2LConnection from "./interface.js";
import { defaultActions, defaultClientActions } from "./default-actions.js";
// import L2LTracker from "lively.2lively/tracker.js";
// import LivelyServer from "lively.server";

export default class L2LClient extends L2LConnection {

  static clientKey(origin, path, namespace) {
    origin = origin.replace(/\/$/, "");
    path = path.replace(/^\//, "");    
    namespace = namespace.replace(/^\//, "");    
    return `${origin}-${path}-${namespace}`
  }

  static default() {
    // FIXME
    var key = L2LClient._clients.keys().next().value;
    return L2LClient._clients.get(key);
  }
  static forceNew(options){   
    var {hostname,port,io,namespace}  = {
      hostname: 'localhost',
      port: 9011,      
      namespace: '/l2l',
      ...options
    }
    var path = '/lively-socket.io'
    var origin = `http://${hostname}:${port}`,
    client = new this(origin,path,namespace);
    client.open();
    client.register();    
    return client;
  
  }
  static ensure(options = {url: null, namespace: null}) {
    // url specifies hostname + port + io path
    // namespace is io namespace

    var {url, namespace, autoOpen} = options;

    if (!url) throw new Error("L2LClient needs server url!")

    if (!this._clients) this._clients = new Map();

    var res = resource(url),
        origin = res.root().url.replace(/\/+$/, ""),
        path = res.path(),
        namespace = namespace ? namespace : "",
        key = this.clientKey(origin, path, namespace),
        client = this._clients.get(key);
    if (client) return client;

    client = new this(origin, path, namespace);
    if (autoOpen || autoOpen === undefined) { client.open(); client.register(); }

    this._clients.set(key, client);
    return client;
  }

  constructor(origin, path, namespace) {
    super();
    this.origin = origin;
    this.path = path;
    this.namespace = namespace.replace(/^\/?/, "/");
    this.trackerId = null;
    this._socketioClient = null;
    // not socket.io already does auto reconnect when network fails but if the
    // socket.io server disconnects a socket, it won't retry by itself. We want
    // that behavior for l2l, howver
    this._reconnectState = {
      autoReconnect: true,
      isReconnecting: false,
      isReconnectingViaSocketio: false
    };
    
    Object.keys(defaultActions).forEach(name =>
      this.addService(name, defaultActions[name]));

    Object.keys(defaultClientActions).forEach(name =>
      this.addService(name, defaultClientActions[name]));
  }

  get socket() { return this._socketioClient; }

  get socketId() { return this.socket ? `${this.namespace}#${this.socket.id}` : null; }

  isOnline() {
    return this.socket && this.socket.connected;
  }

  isRegistered() { return this.isOnline() && !!this.trackerId; }

  async open() {
    if (this.isOnline()) return this;

    await this.close();

    var url = resource(this.origin).join(this.namespace).url,
        // opts = {path: this.path, transports: ['websocket', 'polling']},
        opts = {path: this.path, transports: ['polling'], upgrade: false},
        socket = this._socketioClient = ioClient(url, opts);


    if (this.debug) console.log(`[${this}] connecting`);

    socket.on("error",            (err) =>    this.debug && console.log(`[${this}] errored: ${err}`))
    socket.on("close",            (reason) => this.debug && console.log(`[${this}] closed: ${reason}`))
    socket.on("reconnect_failed", () =>       this.debug && console.log(`[${this}] could not reconnect`))
    socket.on("reconnect_error",  (err) =>    this.debug && console.log(`[${this}] reconnect error ${err}`))

    socket.on("connect", () => {
      this.debug && console.log(`[${this}] connected`);
      this._reconnectState.isReconnecting = false;
      this._reconnectState.isReconnectingViaSocketio = false;
    })

    socket.on("disconnect", () => {
      this.debug && console.log(`[${this}] disconnected`)
      if (!this.trackerId) return;
      this.renameTarget(this.trackerId, "tracker");
      this.trackerId = null;

      if (this._reconnectState.autoReconnect) {
        this._reconnectState.isReconnecting = true;
        setTimeout(() => {
          // if socket.io isn't auto reconnecting we are doing it manually
          if (this._reconnectState.isReconnectingViaSocketio) return;
          this.open(); this.register();
        }, 500);
      }
    });

    socket.on("reconnecting", () => {
      this.debug && console.log(`[${this}] reconnecting`)
      this._reconnectState.isReconnecting = true;
      this._reconnectState.isReconnectingViaSocketio = true;
    });

    socket.on("reconnect", () => {
      this.debug && console.log(`[${this}] reconnected`);
      this._reconnectState.isReconnecting = false;
      this._reconnectState.isReconnectingViaSocketio = false;
      this.register();
    });

    this.installEventToMessageTranslator(socket);

    return new Promise((resolve, reject) => {
      socket.once("error", reject);
      socket.once("connect", resolve);
    }).then(() => this);
  }

  async close() {
    if (this.isRegistered()) await this.unregister();
    if (!this.isOnline() && !this.socket) return;
    var socket = this.socket;
    this._socketioClient = null;
    socket.close();
    if (!socket.connected) return;
    return Promise.race([
      promise.delay(500).then(() => socket.removeAllListeners("disconnect")),
      new Promise(resolve => socket.once("disconnect", resolve))
    ]);
  }

  remove() {
    if (this.constructor._clients) {
      var {origin, path, namespace} = this,
          key = this.constructor.clientKey(origin, path, namespace);
      this.constructor._clients.delete(key);
    }
    return this.close();
  }

  async register() {
    if (this.isRegistered()) return;

    this.debug && console.log(`[${this}] register`)

    try {
      var answer = await this.sendToAndWait("tracker", "register", {});
      if (!answer.data)
        throw new Error(`Register answer is empty!`);

      var {data: {trackerId, messageNumber}} = answer

      this.trackerId = trackerId;
      this._incomingOrderNumberingBySenders.set(trackerId, messageNumber || 0);
    } catch (e) {
      this.unregister();
      throw new Error(`Error in register request of ${this}: ${e}`);
    }
  }

  async unregister() {
    if (!this.isRegistered()) return;
    this.debug && console.log(`[${this}] unregister`);
    var trackerId = this.trackerId;
    try { await this.sendToAndWait(this.trackerId, "unregister", {}); } catch (e) {}
    this.renameTarget(trackerId, "tracker");
    this.trackerId = null;
  }

  whenRegistered(timeout) {
    return promise.waitFor(timeout, () => this.isRegistered())
            .catch(err =>
              Promise.reject(/timeout/i.test(String(err)) ?
                new Error(`Timeout in ${this}.whenRegistered`) : err))
  }

  send(msg, ackFn) {
    [msg, ackFn] = this.prepareSend(msg, ackFn);
    this.whenOnline().then(() => {
      var socket = this.socket,
          {action, target} = msg;
      if (!socket) throw new Error(`Trying to send message ${action} to ${target} but cannot find a connection to it!`);
      typeof ackFn === "function" ?
        socket.emit(action, msg, ackFn) :
        socket.emit(action, msg);
    });
  }

  toString() {
    var {origin, path, namespace, id} = this,
        state = !this.isOnline() ? "disconnected" :
          !this.isRegistered() ? "unregistered" : "registered",
        shortId = (id || "").slice(0,5);
    return `L2LClient(${shortId} ${origin}${path} - ${namespace} ${state})`;
  }

}