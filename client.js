/*global Map*/
import { promise, string } from "lively.lang";
import { resource } from "lively.resources";
import ioClient from "socket.io-client";
import L2LConnection from "./interface.js";

export default class Client extends L2LConnection {

  static clientKey(origin, path, namespace) {
    origin = origin.replace(/\/$/, "");
    path = path.replace(/^\//, "");
    namespace = namespace.replace(/^\//, "");
    return `${origin}-${path}-${namespace}`
  }

  static open(serverURL, opts = {namespace: null}) {
    if (!this._clients) this._clients = new Map();

    var res = resource(serverURL),
        origin = res.root().url.replace(/\/+$/, ""),
        path = res.path(),
        namespace = opts.namespace || "l2l",
        key = this.clientKey(origin, path, namespace),
        client = this._clients.get(key);
    if (client) return client;
    client = new this(origin, path, namespace);
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
  }

  get socket() { return this._socketioClient; }

  get socketId() { return this.socket ? `${this.namespace}#${this.socket.id}` : null; }

  isOnline() {
    return this.socket && this.socket.connected;
  }

  isRegistered() { return !!this.trackerId; }

  async open() {
    if (this.isOnline()) return;

    await this.close();

    var url = resource(this.origin).join(this.namespace).url,
        socket = this._socketioClient = ioClient(url, {path: this.path});

    if (this.debug) console.log(`[${this}] connecting`);

    socket.on("error",            (err) =>    console.log(`[${this}] errored: ${err}`))
    socket.on("close",            (reason) => console.log(`[${this}] closed: ${reason}`))
    socket.on("connect",          () =>       console.log(`[${this}] connected`))
    socket.on("disconnect",       () =>       console.log(`[${this}] disconnected`))
    socket.on("reconnect",        () =>       console.log(`[${this}] reconnected`))
    socket.on("reconnecting",     () =>       console.log(`[${this}] reconnecting`))
    socket.on("reconnect_failed", () =>       console.log(`[${this}] could not reconnect`))
    socket.on("reconnect_error",  (err) =>    console.log(`[${this}] reconnect error ${err}`))

    this.installEventToMessageTranslator(socket);

    return new Promise((resolve, reject) => {
      socket.once("error", reject);
      socket.once("connect", resolve);
    });
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
      var {data: {trackerId}} = await this.sendToAndWait("tracker", "register", {});
      this.trackerId = trackerId;
    } catch (e) {
      this.unregister();
      throw new Error(`Error in register request of ${this}: ${e}`);
    }
  }

  async unregister() {
    if (!this.isRegistered()) return;
    this.debug && console.log(`[${this}] unregister`);
    try { await this.sendToAndWait(this.trackerId, "unregister", {}); } catch (e) {}
    this.trackerId = null;
  }

  send(msg, ackFn) {
    msg = this.ensureMessageProps(msg);
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