/*global Map*/
import { promise, string } from "lively.lang";
import { resource } from "lively.resources";
import ioClient from "socket.io-client";
import L2LConnection from "./interface.js";
import { defaultActions, defaultClientActions } from "./default-actions.js";
import { makeEmitter } from "lively.lang/events.js";
// import L2LTracker from "lively.2lively/tracker.js";
// import LivelyServer from "lively.server";

export default class L2LClient extends L2LConnection {

  static clientKey(origin, path, namespace) {
    origin = origin.replace(/\/$/, "");
    path = path.replace(/^\//, "");
    namespace = namespace.replace(/^\//, "");
    return `${origin}-${path}-${namespace}`
  }

  static get clients() {
    return this._clients || (this._clients = new Map())
  }

  static default() {
    // FIXME
    let key = L2LClient.clients.keys().next().value;
    return L2LClient.clients.get(key);
  }

  static ensure(options = {url: null, namespace: null}) {
    // url specifies hostname + port + io path
    // namespace is io namespace

    let {url, namespace, autoOpen = true} = options;

    if (!url) throw new Error("L2LClient needs server url!")

    let res = resource(url),
        origin = res.root().url.replace(/\/+$/, ""),
        path = res.path(),
        key = this.clientKey(origin, path, namespace || ""),
        client = this.clients.get(key);

    if (!client) {
      client = new this(origin, path, namespace || "");
      if (autoOpen) { client.open(); client.register(); }
      this.clients.set(key, client);
    }

    return client;
  }

  constructor(origin, path, namespace) {
    super();
    makeEmitter(this);
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
      this.emit("connected", this);
      this._reconnectState.isReconnecting = false;
      this._reconnectState.isReconnectingViaSocketio = false;
    })

    socket.on("disconnect", () => {
      this.debug && console.log(`[${this}] disconnected`)
      this.emit("disconnected", this);

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
    // this._socketioClient = null;
    socket.close();
    if (!socket.connected) return;
    return Promise.race([
      promise.delay(2000).then(() => socket.removeAllListeners("disconnect")),
      new Promise(resolve => socket.once("disconnect", resolve))
    ]);
  }

  remove() {
    var {origin, path, namespace} = this,
        key = this.constructor.clientKey(origin, path, namespace);
    this.constructor.clients.delete(key);
    return this.close();
  }

  async register() {
    if (this.isRegistered()) return;

    try {

      this.debug && console.log(`[${this}] register`)
      var answer = await this.sendToAndWait("tracker", "register", {});
      if (!answer.data) {
        let err = new Error(`Register answer is empty!`);
        this.emit("error", err);
        throw err;
      }

      var {data: {trackerId, messageNumber}} = answer;
      this.trackerId = trackerId;
      this._incomingOrderNumberingBySenders.set(trackerId, messageNumber || 0);
      this.emit("registered", {trackerId, user: this.user});

      // rk 2017-03-29: FIXME why do we need a second roundtrip????
      this.debug && console.log(`[${this}] requesting user info`)
      var response = await this.sendToAndWait(this.trackerId, 'userInfo', {});
      if (!response.data) {
        let err = new Error(`User answer is empty!`);
        this.emit("error", err);
        throw err;
      }

      this.user = response.data
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
    this.emit("unregistered", this);
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

  async authenticate(options){
    var response = await this.sendToAndWait(this.trackerId,'authenticateUser',options)
    if (!response.data)
      throw new Error(`User answer is empty!`);
    this.user = response.data
  }

  async validateToken(user){
    //Shorthand method for temporarily authenticating user tokens
    var response = await this.sendToAndWait(this.trackerId,'validate',user)
    if (!response.data)
      throw new Error(`Validation answer is empty!`);
    return response
  }

  toString() {
    var {origin, path, namespace, id} = this,
        state = !this.isOnline() ? "disconnected" :
          !this.isRegistered() ? "unregistered" : "registered",
        shortId = (id || "").slice(0,5);
    return `L2LClient(${shortId} ${origin}${path} - ${namespace} ${state})`;
  }

}