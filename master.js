import { arr, string, obj } from "lively.lang";
import { morphicDefaultTransform, transformOp_1_to_n } from "./transform.js";
import { printOps } from "./debugging.js";
import { applyChange } from "./changes.js";

var i = val => obj.inspect(val, {maxDepth: 2});

export function fnStringsToFunctions(fnStrings) {
  return fnStrings.map(ea => eval(`(${ea})`));
}


export class MasterState {

  constructor(world, master) {
    this.error = null;
    this.world = world;
    this.objects = new Map();
    world.withAllSubmorphsDo(ea => this.objects.set(ea.id, ea));
    this.history = [];
    this.connections = [];
    this.locked = false;
    this.transformFunctions = [morphicDefaultTransform];
    this.metaMessageCallbacks = {};
  }

}


export class Master {

  constructor(world) {
    this.state = new MasterState(world);
  }

  toString() {
    return `<sync master hist:${this.history.length}>`
  }

  get error() { return this.state.error }

  get history() { return this.state.history; }
  printHist() { return printOps(this.state.history); }

  get morphicEnv() { return this.state.world.env; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // connections
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  addConnection(c) { return arr.pushIfNotIncluded(this.state.connections, c); }
  removeConnection(c) { return arr.remove(this.state.connections, c); }
  get connections() { return this.state.connections; }
  connectionFor(client) { return this.connections.find(c => c.opChannel && c.opChannel.senderRecvrA === client); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // meta communication
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  sendMeta(connection, msg) {
    if (!connection || !connection.metaChannel)
      throw new Error(`${this}: No (meta) connection when sending meta message ${i(msg)}`);
    return connection.metaChannel.send(msg, this);
  }

  sendMetaAndWait(connection, msg) {
    return new Promise((resolve, reject) => {
      msg.id = msg.id || string.newUUID();
      this.state.metaMessageCallbacks[msg.id] = answer =>
        answer.error ? reject(new Error(answer.error)) : resolve(answer);
      this.sendMeta(connection, msg);
    });
  }

  receiveMetaMsgsFromClient(msgs, client, metaChannel) {
    for (let msg of msgs) {

      if (msg.inResponseTo) {
        var cb = this.state.metaMessageCallbacks[msg.inResponseTo];
        if (typeof cb === "function") cb(msg);
        return;
      }

      switch (msg.request) {
        case "history-since-or-snapshot":
          this.handleHistorySinceOrSnapshotMessage(msg, metaChannel);
          break;

        case "lock": case "unlock":
          this.handleLockAndUnlockRequest(msg, metaChannel);
          break;

        case "change-transforms":
          this.handleChangeTransformRequest(msg, metaChannel);
          break;

        default:
          console.error(`master received meta message ${i(msg)} but don't know what to do with it!`);
      }
    }
  }

  handleHistorySinceOrSnapshotMessage(msg, metaChannel) {
    var answer = {
      inResponseTo: msg.id,
      type: "history",
      history: this.historySince(msg.since)
    };
    metaChannel.send(answer, this);
  }

  async handleLockAndUnlockRequest(msg, metaChannel) {
    var err, lock = msg.request === "lock";

    console.log("lock" ? "locking..." : "unlocking");

    // only one lock at a time
    if (lock && this.state.locked) {
      var answer = {
        inResponseTo: msg.id,
        type: msg.request + "-result",
        error: "Already locked"
      };
      metaChannel.send(answer, this);
      return;
    }

    if (lock) this.state.locked = true;

    // forward to all clients...
    try {
      await Promise.all(this.connections.map(c =>
          this.sendMetaAndWait(c, Object.assign({}, msg, {id: null}))))
    } catch (e) {
      err = e;
      console.error(`Error locking / unlocking all clients in master: ${err}`);
    }

    var answer = {inResponseTo: msg.id, type: msg.request + "-result", error: err ? String(err.stack || err) : null, locked: lock};
    metaChannel.send(answer, this);

    if (!lock) this.state.locked = false;
  }

  async handleChangeTransformRequest(msg, metaChannel) {
    var err;
    if (!this.state.locked) {
      err = "system is not locked, changing transforms is not safe";
    } else {
      // changin in master + forward to all clients...
      try {
        this.state.transformFunctions = fnStringsToFunctions(msg.transformFunctions);
        await Promise.all(this.connections.map(c =>
            this.sendMetaAndWait(c, Object.assign({}, msg, {id: null}))))
      } catch (e) { err = e; }
    }

    var answer;
    if (err) {
      console.error(`error in change-transforms handler: ${e}`)
      answer = {inResponseTo: msg.id, error: `error in change-transforms handler: ${e}`};
    } else {
      answer = {inResponseTo: msg.id, type: "change-transforms-result", status: "OK"};
    }
    return metaChannel.send(answer, this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // operation-related communication
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  receiveOpsFromClient(ops, client, connection) {
    // ops to be expected to contigous operations, i.e. ops[n].id === ops[n+1].parent
    if (!ops.length) return;

    var opsForTransform = this.findOpsForTransform(ops[0]),
        transformed = ops.map(op => this.transform(op, opsForTransform).transformedOp);

    transformed.forEach(op => {
      this.state.history.push(op);
      this.apply(op);
    });
    this.broadcast(transformed, client);
  }

  broadcast(ops, sender) {
    if (this.error) {
      console.error(`sync master ecountered error, refusing to broadcast ${this.error}`);
      return;
    }

    var sourceCon = this.connectionFor(sender),
        priorityCons = arr.without(this.connections, sourceCon);

    priorityCons.forEach(ea => ea.opChannel.send(ops, this));
    if (sourceCon) sourceCon.opChannel.send(ops, this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ops / transforms
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  findOpsForTransform(childOp) {
    // childOp is expected to be an operation that is directly based on an
    // operation of the servers history; find operations that were added since
    // childOp's parent and transform childOp against them
    // return this.historySince(childOp.parent);
    return this.historySince(childOp.version);
  }

  historySince(requiredVersion) {
    return arr.takeWhile(
          this.state.history.slice().reverse(),
          (ea) => ea.version >= requiredVersion).reverse();
  }

  apply(op) {
    // ...to local state
    try {
      applyChange(op.change, this)
    } catch (e) {
      console.log(`sync master apply error: ${e}`);
      this.state.error = e;
      throw e;
    }

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transform fn related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  transform(op, againstOps) {
    return transformOp_1_to_n(op, againstOps, this.state.transformFunctions, this);
  }

}
