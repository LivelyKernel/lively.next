import { obj, arr, string, promise } from "lively.lang";
import { morphicDefaultTransform, transformOp_1_to_n, composeOps } from "./transform.js";
import { printOps, printOp } from "./debugging.js";
import { Channel } from "./channel.js";
import { serializeChange, applyChange } from "./changes.js";

var i = val => obj.inspect(val, {maxDepth: 2});

export function fnStringsToFunctions(fnStrings) {
  return fnStrings.map(ea => eval(`(${ea})`));
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// client
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
export class ClientState {

  constructor(world) {
    this.name = "some client"
    this.error = null;
    this.world = world;
    this.objects = new Map();
    world.withAllSubmorphsDo(ea => this.objects.set(ea.id, ea));
    this.history = [];
    this.pending = [];
    this.buffer = [];
    this.isApplyingChange = false;
    this.connection = {opChannel: null, metaChannel: null};
    this.metaMessageCallbacks = {};
    this.transformFunctions = [morphicDefaultTransform];
  }

}

export class Client {

  constructor(world, name = "some client") {
    this.state = new ClientState(world);
    this.state.name = name;
  }

  toString() {
    return `<sync ${this.state.name} hist:${this.history.length} buf:${this.buffer.length}>`
  }

  get error() { return this.state.error }

  get history() { return this.state.history; }
  get buffer() { return this.state.buffer; }
  printHist() { return printOps(this.history); }
  printBuffer() { return printOps(this.buffer); }

  get morphicEnv() { return this.state.world.env; }

  get master() {
    var opChannel = this.state.connection.opChannel;
    return opChannel ? opChannel.senderRecvrB : null;
  }

  send(op) {
    if (!this.hasConnection())
      throw new Error(`Cannot send, not connected!`)
    return this.state.connection.opChannel.send(op, this);
  }

  sendMeta(msg) {
    if (!this.hasConnection())
      throw new Error(`Cannot send, not connected!`)
    return this.state.connection.metaChannel.send(msg, this);
  }

  sendMetaAndWait(msg) {
    return new Promise((resolve, reject) => {
      if (!this.hasConnection())
        return reject(new Error(`Cannot send, not connected!`));
      msg.id = msg.id || string.newUUID();
      this.state.metaMessageCallbacks[msg.id] =
        answer => answer.error ? reject(new Error(answer.error)) : resolve(answer);
      this.sendMeta(msg);
    });
  }

  disconnectFromMaster() {
    var con = this.state.connection, {opChannel, metaChannel} = con;
    if (!opChannel && !metaChannel) return;
    opChannel && opChannel.goOffline();
    metaChannel && metaChannel.goOffline();
    var master = (opChannel || metaChannel).senderRecvrB;
    master.removeConnection(con);
    con.metaChannel = null;
    con.opChannel = null;
  }

  connectToMaster(master) {
    this.disconnectFromMaster();
    var con = this.state.connection;
    con.opChannel = new Channel(this, "receiveOpsFromMaster", master, "receiveOpsFromClient")
    con.metaChannel = new Channel(this, "receiveMetaMsgsFromMaster", master, "receiveMetaMsgsFromClient")
    master.addConnection(con);
  }

  hasConnection() {
    var {opChannel, metaChannel} = this.state.connection;
    return !!opChannel && !!metaChannel;
  }

  isOnline() {
    var {opChannel, metaChannel} = this.state.connection;
    return this.hasConnection() && opChannel.isOnline() && metaChannel.isOnline();
  }

  goOffline() {
    var {opChannel, metaChannel} = this.state.connection;
    opChannel.goOffline();
    metaChannel.goOffline();
  }

  goOnline() {
    var {opChannel, metaChannel} = this.state.connection;
    opChannel.goOnline();
    metaChannel.goOnline();
  }

  goOfflineWithOpChannel() {
    var {opChannel} = this.state.connection;
    opChannel.goOffline();
  }

  goOnlineWithOpChannel() {
    var {opChannel} = this.state.connection;
    opChannel.goOnline();
  }

  set delay(d) {
    var {opChannel} = this.state.connection;
    if (opChannel) {
      opChannel.delayAtoB = d;
      opChannel.delayBtoA = d;
    }
  }

  get delay() {
    var {opChannel} = this.state.connection;
    return opChannel ? opChannel.delayAtoB : 0
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // "locking" – meta operation sent to everyone to prevent
  // changes while some other operation happens
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  lockEveryone() {
    return this.sendMetaAndWait({
      request: "lock",
      requester: this.state.name
    });
  }

  unlockEveryone() {
    return this.sendMetaAndWait({
      request: "unlock",
      requester: this.state.name
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // synced testing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  isSynced() {
    var {opChannel, metaChannel} = this.state.connection;
    return this.buffer.length === 0
        && (!opChannel || opChannel.isEmpty())
        && (!metaChannel || metaChannel.isEmpty());
  }

  synced() {
    return promise.waitFor(() =>
      this.isSynced()).then(() => this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // processing changes from local world, creating new op
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  newChange(change) {
    if (this.state.isApplyingChange) return;

    if (this.error) {
      console.error(`sync client ecountered error, refusing to accept new change, ${this.error}`);
      return;
    }

    var parent = arr.last(this.buffer) || arr.last(this.history);
    return this.newOperation({
      parent: parent ? parent.id : null,
      version: parent ? parent.version + 1 : 0,
      id: string.newUUID(),
      creator: this.state.name,
      change: serializeChange(change, this.state.objects),
      toString: function() { return printOp(this); }
    });
  }

  newOperation(op) {
    this.buffer.push(op);
    this.composeOpsInBuffer();
    return this.sendOperationIfPossible();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // sending and receiving ops
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  sendOperationIfPossible() {
    if (this.error) {
      var msg = `sync client ecountered error, refusing to send to master, ${this.error}`;
      console.error(msg);
      return Promise.reject(new Error(msg));
    }

    var {buffer,pending} = this.state;
    if (pending.length || !buffer.length) return Promise.resolve();
    this.state.pending.push(buffer[0]);

    return this.send(buffer[0]);
  }

  async syncWithMaster() {
    // this.state.pending = [];
    // this.state.buffer = [];

    try {
      var lastOp = arr.last(this.history),
          answer = await this.sendMetaAndWait({
            request: "history-since-or-snapshot",
            // since: lastOp ? lastOp.id : null
            since: lastOp ? lastOp.version : 0
          });

      if (answer.type === "history") {
        return this.receiveOpsFromMaster(answer.history);
      }

      if (answer.type === "snapshot") {
        throw new Error(`${this}: syncing from snapshot not yet implemented`);
      }

    } catch (e) {
      this.state.error = e;
      console.error(`Cannot sync ${this} with master: ${e}`);
      return Promise.reject(e);
    }
  }

  receiveMetaMsgsFromMaster(msgs, master, metaChannel) {
    for (let msg of msgs) {
      try {

        if (msg.inResponseTo) {
          var cb = this.state.metaMessageCallbacks[msg.inResponseTo];
          if (typeof cb === "function") return cb(msg);

        } else if (msg.request === "lock" || msg.request === "unlock") {
          var lock = msg.request === "lock"
          if (lock) this.goOfflineWithOpChannel();
          else this.goOnlineWithOpChannel();
          var answer = {inResponseTo: msg.id, type: "lock-result", locked: lock};
          return metaChannel.send(answer, this);

        } else if (msg.request === "change-transforms") {
          try {
            this.state.transformFunctions = fnStringsToFunctions(msg.transformFunctions);
            var answer = {inResponseTo: msg.id, type: "change-transforms-result", status: "OK"};
            metaChannel.send(answer, this);
          } catch (e) {
            console.error(`error in change-transforms handler: ${e}`)
            var answer = {inResponseTo: msg.id, error: `error in change-transforms handler: ${e}`};
            metaChannel.send(answer, this);
          }
          return;
        }

      } catch (e) {
        console.error(`${this}: Error when processing message: ${i(msg)}: ${e}`)
      }

      console.error(`${this} got meta message but don't know what do to with it! ${i(msg)}}`)
    }
  }

  receiveOpsFromMaster(ops) {

    for (let op of ops) {

      if (this.state.pending.length && op.id === this.state.pending[0].id) {
        // it is a ack, i.e. that the operation or an equivalent (having the
        // same id) was send by this client. We received it b/c the server
        // applied it and broadcasted it subsequently. For this client this
        // means we can remove the op from pending
        this.state.pending.shift();
        var ackIndex = this.state.buffer.findIndex(ea => ea.id === op.id)+1;
        var opsTilAck = this.state.buffer.slice(0, ackIndex);
        this.state.buffer = this.state.buffer.slice(ackIndex);
        this.state.history = this.state.history.concat(opsTilAck);
        // console.log(`${this} got ACK ${op}, pending ${pending}`)

      } else if (this.state.history.some(pastOp => pastOp.id === op.id)) {
        console.warn(`${this}: op ${op} already received!`);
      } else {

        // we got a new op from the server, transform it via the bridge /
        // buffer and apply it locally.
        var {transformedOp, transformedAgainstOps} = this.transform(op, this.state.buffer);
        // console.log(`${this} got ${op} => ${transformedOp}`)
        this.state.buffer = transformedAgainstOps;
        this.state.history.push(transformedOp);
        this.apply(transformedOp);

      }
    }

    // try sending unsend ops in buffer
    this.sendOperationIfPossible();
  }

  apply(op) {

    // guard that protects from sending out changes that are created from
    // applying received operations
    this.state.isApplyingChange = true;
    try {
      applyChange(op.change, this)
    } catch (e) {
      console.log(`sync client apply error: ${e}`);
      this.state.error = e;
      throw e;
    } finally {
      this.state.isApplyingChange = false;
    }

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transform functions
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  getTransforms() { return this.state.transformFunctions; }
  setTransforms(tfms) {
    this.state.transformFunctions = tfms;
    return this.syncTransforms();
  }

  addTransform(tfmFn) {
    arr.pushIfNotIncluded(this.state.transformFunctions, tfmFn);
    return this.syncTransforms();
  }
  removeTransform(tfmFn) {
    arr.remove(this.state.transformFunctions, tfmFn);
    return this.syncTransforms();
  }

  async syncTransforms() {
    await this.lockEveryone();
    try {
      await this.sendMetaAndWait({
        request: "change-transforms",
        requester: this.state.name,
        transformFunctions:this.state.transformFunctions.map(String)
      });
    } finally {
      await this.unlockEveryone();
    }
  }

  transform(op, againstOps) {
    return transformOp_1_to_n(op, againstOps, this.state.transformFunctions, this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // composition
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  composeOpsInBuffer() {
    // pair-wise try to compose operations in buffer that aren't send yet.
    var {pending, buffer} = this.state;

    // we can only compose operations that aren't yet being send, i.e. those that arent in pending;
    var onlyLocalIndex = 0;
    if (pending.length) { // pending can't be composed
      var last = arr.last(pending);
      onlyLocalIndex = buffer.findIndex(op => last === op) + 1;
    }

    var keep = buffer.slice(0,onlyLocalIndex),
        maybeCompose = buffer.slice(onlyLocalIndex);

    this.state.buffer = keep.concat(composeOps(maybeCompose));
  }

}
