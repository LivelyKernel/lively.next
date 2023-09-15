/* global Map,System,process */
import { promise, fun, obj, events, num } from 'lively.lang';
import L2LConnection from './interface.js';
import { defaultActions, defaultClientActions } from './default-actions.js';

const isNode = typeof System !== 'undefined'
  ? System.get('@system-env').node
  : typeof process !== 'undefined' && process.env;

// FIXME!!
// import ioClient from "socket.io-client";
import _ioClient from 'socket.io-client';
import { resource } from 'lively.resources';
let ioClient;
if (isNode) {
  const require = System._nodeRequire('module')._load;
  ioClient = require('socket.io-client');
} else {
  ioClient = _ioClient;
}

const urlHelper = {
  isRoot: url => urlHelper.path(url) === '/',

  root: url =>
    urlHelper.isRoot(url)
      ? url
      : url.slice(0, -urlHelper.path(url).length) + '/',

  path: (function () {
    const protocolRe = /^[a-z0-9-_\.]+:/;
    const slashslashRe = /^\/\/[^\/]+/;
    return url => {
      const path = url.replace(protocolRe, '').replace(slashslashRe, '');
      return path === '' ? '/' : path;
    };
  })(),

  join: (url, path) => {
    if (url.endsWith('/')) url = url.slice(0, -1);
    if (path.startsWith('/')) path = path.slice(1);
    return url + '/' + path;
  }
};

function determineLocation () {
  if (typeof document !== 'undefined' && document.location) { return System.baseURL || document.location.origin; }

  if (isNode) { return System._nodeRequire('os').hostname(); }

  return System.baseURL;
}

let _clients;
_clients = _clients || new Map();

export default class L2LClient extends L2LConnection {
  static clientKey (origin, path, namespace) {
    origin = origin.replace(/\/$/, '');
    path = path.replace(/^\//, '');
    namespace = namespace.replace(/^\//, '');
    return `${origin}-${path}-${namespace}`;
  }

  static get clients () {
    return _clients;
  }

  static forLivelyInBrowser (info) {
    const hasInfo = !!info;
    info = { type: 'lively.morphic browser', ...info };

    const def = this.default();

    if (!def) {
      return L2LClient.ensure({
        url: resource(determineLocation()).join('/lively-socket.io').url,
        namespace: 'l2l',
        info
      });
    }

    if (hasInfo && !obj.equals(def.info, info) && def.isRegistered()) {
      def.info = info;
      def.unregister().then(() => def.register())
        .catch(err => console.error('l2l re-register on info change errored: ' + err));
    }

    return def;
  }

  static default () {
    // FIXME
    const key = L2LClient.clients.keys().next().value;
    return L2LClient.clients.get(key);
  }

  static create (options = {}) {
    const {
      debug = false,
      url,
      namespace,
      autoOpen = true,
      info = {}
    } = options;

    if (!url) throw new Error('L2LClient needs server url!');

    const origin = urlHelper.root(url).replace(/\/+$/, '');
    const path = urlHelper.path(url);
    const client = new this(origin, path, namespace || '', info);

    if (autoOpen) client.register();
    client.debug = debug;
    return client;
  }

  static ensure (options = {}) {
    // url specifies hostname + port + io path
    // namespace is io namespace
    const { url, namespace } = options;

    if (!url) throw new Error('L2LClient needs server url!');

    const origin = urlHelper.root(url).replace(/\/+$/, '');
    const path = urlHelper.path(url);
    const key = L2LClient.clientKey(origin, path, namespace || '');
    let client = L2LClient.clients.get(key);

    if (!client) {
      L2LClient.clients.set(key,
        client = L2LClient.create({ ...options, url, namespace }));
    }

    return client;
  }

  constructor (origin, path, namespace, info) {
    super();
    events.makeEmitter(this);
    this.info = info;
    this.origin = origin;
    this.path = path;
    this.namespace = namespace.replace(/^\/?/, '/');
    this.trackerId = null;
    this._socketioClient = null;

    // not socket.io already does auto reconnect when network fails but if the
    // socket.io server disconnects a socket, it won't retry by itself. We want
    // that behavior for l2l, however
    this._reconnectState = {
      closed: false,
      autoReconnect: true,
      isReconnecting: false,
      isReconnectingViaSocketio: false,
      registerAttempt: 0,
      registerProcess: null,
      isOpening: false
    };

    Object.keys(defaultActions).forEach(name =>
      this.addService(name, defaultActions[name]));

    Object.keys(defaultClientActions).forEach(name =>
      this.addService(name, defaultClientActions[name]));
  }

  get socket () { return this._socketioClient; }

  get socketId () { return this.socket ? this.socket.id : null; }

  isOnline () {
    return this.socket && this.socket.connected;
  }

  isRegistered () { return this.isOnline() && !!this.trackerId; }

  async open () {
    if (this.isOnline()) return this;

    if (this._reconnectState.isOpening) return this;

    await this.close();

    this._reconnectState.closed = false;

    const url = urlHelper.join(this.origin, this.namespace);
    const opts = { path: this.path, transports: ['websocket', 'polling'] };
    const socket = this._socketioClient = ioClient(url, opts);

    if (this.debug) console.log(`[${this}] connecting`);

    socket.on('error', (err) => {
      this._reconnectState.isOpening = false;
      this.debug && console.log(`[${this}] errored: ${err}`);
    });
    socket.on('close', (reason) => this.debug && console.log(`[${this}] closed: ${reason}`));
    socket.on('reconnect_failed', () => this.debug && console.log(`[${this}] could not reconnect`));
    socket.on('reconnect_error', (err) => this.debug && console.log(`[${this}] reconnect error ${err}`));

    socket.on('connect', () => {
      this.debug && console.log(`[${this}] connected`);
      this.emit('connected', this);
      this._reconnectState.isOpening = false;
      this._reconnectState.isReconnecting = false;
      this._reconnectState.isReconnectingViaSocketio = false;
    });

    socket.on('disconnect', () => {
      this._reconnectState.isOpening = false;

      this.debug && console.log(`[${this}] disconnected`);
      this.emit('disconnected', this);

      if (!this.trackerId) {
        this.debug && console.log(`[${this}] disconnect: don't have a tracker id, won't try reconnect`);
        this.trackerId = 'tracker';
        return;
      }

      if (this.trackerId !== 'tracker') {
        // for maintaining seq nos.
        this.renameTarget(this.trackerId, 'tracker');
        this.trackerId = null;
      }

      if (this._reconnectState.closed) {
        this.debug && console.log(`[${this}] won't reconnect b/c client is marked as closed`);
        return;
      }

      if (!this._reconnectState.autoReconnect) {
        this.debug && console.log(`[${this}] won't reconnect b/c client has reconnection disabled`);
        return;
      }

      this._reconnectState.isReconnecting = true;

      setTimeout(() => {
        // if socket.io isn't auto reconnecting we are doing it manually

        if (this._reconnectState.closed) {
          this.debug && console.log(`[${this}] won't reconnect b/c client is marked as closed 2`);
          return;
        }
        if (this._reconnectState.isReconnectingViaSocketio) {
          this.debug && console.log(`[${this}] won't reconnect again, client already reconnecting`);
          return;
        }

        this.debug && console.log(`[${this}] initiating reconnection to tracker`);
        this.register();
      }, 20);
    });

    socket.on('reconnecting', () => {
      this.debug && console.log(`[${this}] reconnecting`, this._reconnectState);
      this.emit('reconnecting', this);
      if (this._reconnectState.closed) {
        this._reconnectState.isReconnecting = false;
        this._reconnectState.isReconnectingViaSocketio = false;
        socket.close();
        this.close();
      } else {
        this._reconnectState.isReconnecting = true;
        this._reconnectState.isReconnectingViaSocketio = true;
      }
    });

    socket.on('reconnect', () => {
      this.debug && console.log(`[${this}] reconnected`);
      this._reconnectState.isReconnecting = false;
      this._reconnectState.isReconnectingViaSocketio = false;
      this.register();
      if (this.onReconnect && typeof (this.onReconnect) === 'function') {
        this.onReconnect();
      }
    });

    this.installEventToMessageTranslator(socket);

    this._reconnectState.isOpening = true;

    return new Promise((resolve, reject) => {
      socket.once('error', reject);
      socket.once('connect', resolve);
    }).then(() => this);
  }

  async onReconnect () {
    const dateString = new Date().toTimeString();
    console.log(`Reconnected at ${dateString}`);
  }

  async close () {
    this._reconnectState.closed = true;

    const socket = this.socket;
    // this._socketioClient = null;

    if (socket) {
      socket.removeAllListeners('reconnect');
      socket.removeAllListeners('reconnecting');
      socket.removeAllListeners('disconnect');
      socket.removeAllListeners('connect');
      socket.removeAllListeners('reconnect_error');
      socket.removeAllListeners('reconnect_failed');
      socket.removeAllListeners('close');
      socket.removeAllListeners('error');
      socket.close();
    }

    this.debug && console.log(`[${this}] closing...`);

    if (this.isRegistered()) await this.unregister();
    if (!this.isOnline() && !this.socket) {
      if (this.debug) {
        const reason = !this.isOnline() ? 'not online' : 'no socket';
        this.debug && console.log(`[${this}] cannot close: ${reason}`);
      }
      return this;
    }

    if (socket && !socket.connected) {
      this.debug && console.log(`[${this}] socket not connected, considering client closed`);
      return this;
    }

    return Promise.race([
      promise.delay(2000).then(() => socket.removeAllListeners('disconnect')),
      new Promise(resolve => socket.once('disconnect', resolve))
    ]).then(() => {
      this.debug && console.log(`[${this}] closed`);
      return this;
    });
  }

  remove () {
    const { origin, path, namespace } = this;
    const key = this.constructor.clientKey(origin, path, namespace);
    this.constructor.clients.delete(key);
    return this.close();
  }

  async register () {
    if (this.isRegistered()) return;

    if (this._reconnectState.closed) {
      this.debug && console.log(`[${this}] not registering this b/c closed`);
      this._reconnectState.registerAttempt = 0;
      return;
    }

    if (this._reconnectState.registerProcess) {
      this.debug && console.log(`[${this}] not registering this b/c register process exists`);
      return;
    }

    try {
      if (!this.isOnline()) { await this.open(); }

      this.debug && console.log(`[${this}] register`);

      const answer = await this.sendToAndWait('tracker', 'register', {
        userName: 'unknown',
        type: 'l2l ' + (isNode ? 'node' : 'browser'),
        location: determineLocation(),
        ...this.info
      });

      if (!answer.data) {
        const err = new Error('Register answer is empty!');
        this.emit('error', err);
        throw err;
      }

      if (answer.data.isError) {
        const err = new Error(answer.data.error);
        this.emit('error', err);
        throw err;
      }

      this._reconnectState.registerAttempt = 0;
      const { data: { trackerId, messageNumber } } = answer;
      this.trackerId = trackerId;
      this._incomingOrderNumberingBySenders.set(trackerId, messageNumber || 0);
      this.emit('registered', { trackerId });
      if (this.onReconnect && typeof (this.onReconnect) === 'function') {
        this.onReconnect();
      }
    } catch (e) {
      console.error(`Error in register request of ${this}: ${e}`);
      const attempt = this._reconnectState.registerAttempt++;
      const timeout = num.backoff(attempt, 4/* base */, 5 * 60 * 1000/* max */);
      this._reconnectState.registerProcess = setTimeout(() => {
        this._reconnectState.registerProcess = null;
        this.register();
      }, timeout);
    }
  }

  async unregister () {
    if (!this.isRegistered()) return;
    this.debug && console.log(`[${this}] unregister`);
    const trackerId = this.trackerId;
    try { await this.sendToAndWait(this.trackerId, 'unregister', {}); } catch (e) {}
    this.renameTarget(trackerId, 'tracker');
    this.trackerId = null;
    this.emit('unregistered', this);
  }

  whenRegistered (timeout) {
    return promise.waitFor(timeout, () => this.isRegistered())
      .catch(err =>
        Promise.reject(/timeout/i.test(String(err))
          ? new Error(`Timeout in ${this}.whenRegistered`)
          : err));
  }

  send (msg, ackFn) {
    [msg, ackFn] = this.prepareSend(msg, ackFn);
    this.whenOnline().then(() => {
      const socket = this.socket;
      const { action, target } = msg;
      if (!socket) throw new Error(`Trying to send message ${action} to ${target} but cannot find a connection to it!`);
      typeof ackFn === 'function'
        ? socket.emit(action, msg, ackFn)
        : socket.emit(action, msg);
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // broadcasting
  joinRoom (room) {
    return this.whenOnline().then(() =>
      this.sendToAndWait(this.trackerId, '[broadcast] join room', { room }));
  }

  leaveRoom (room) {
    return this.whenOnline().then(() =>
      this.sendToAndWait(this.trackerId, '[broadcast] leave room', { room }));
  }

  broadcast (room, action, data, isSystemBroadcast = false, isMultiServerBroadcast = false) {
    const broadcast = { action, room, broadcast: data };
    if (isSystemBroadcast) { broadcast.isSystemBroadcast = true; }
    if (isMultiServerBroadcast) { broadcast.isMultiServerBroadcast = true; }
    return this.whenOnline().then(() =>
      this.sendToAndWait(this.trackerId, '[broadcast] send', broadcast));
  }

  async listRoomMembers (room) {
    const { data } = await this.sendToAndWait(this.trackerId, '[broadcast] list room members', { room });
    return data;
  }

  async joinedRooms () {
    const { data } = await this.sendToAndWait(this.trackerId, '[broadcast] my rooms', {});
    return data;
  }

  async listRooms () {
    const { data } = await this.sendToAndWait(this.trackerId, '[broadcast] all rooms', {});
    return data;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // user network related
  async listPeers (force = false) {
    const { _peersCached } = this;
    const t = Date.now();
    const timeout = 1000;

    if (!force && _peersCached && t - _peersCached.timestamp < timeout) { return this._peersCached.sessions; }

    if (!this.isOnline()) return [];

    const { data } = await this.sendToAndWait(this.trackerId, 'getClients', {});
    const sessions = data.map(([id, record]) => {
      let { userRealm, userToken, l2lUserToken, location, type, world } = record.info || {};
      const peer = { ...obj.dissoc(record, ['info']), id, world, location, type };
      userToken = userToken || l2lUserToken;
      if (userToken && userToken !== 'null') {
        peer.userToken = userToken;
        peer.userRealm = userRealm;
      }
      return peer;
    });

    this._peersCached = { timestamp: t, sessions };
    return sessions;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging

  toString () {
    const { origin, path, namespace, id } = this;
    const state = !this.isOnline()
      ? 'disconnected'
      : !this.isRegistered() ? 'unregistered' : 'registered';
    const shortId = (id || '').slice(0, 5);
    return `L2LClient(${shortId} ${origin}${path} - ${namespace} ${state})`;
  }
}
