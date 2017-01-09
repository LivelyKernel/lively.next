import { num, arr, string, obj, promise, fun } from "lively.lang";
import { morph } from "lively.morphic";
import { ValueChange, MethodCallChange } from "lively.morphic/changes.js";

var i = val => obj.inspect(val, {maxDepth: 2}),
    assert = (bool, msgFn) => { if (!bool) throw new Error(msgFn()); },
    debug = false;


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// change (de)serialization
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function deserializeChangeProp(change, name, val, objectMap, syncController) {
  if (!val || val.isMorph) return val;

  if (typeof val === "string" && objectMap.has(val)) {
    console.warn(`deserializeChange: Found prop [${name}] that is a morph id but is not specified as one!`);
    return objectMap.get(val);
  }

  if (val.type === "lively-sync-morph-ref") {
    var resolved = objectMap.get(val.id);
    assert(resolved, () => `Cannot deserialize change ${i(change)}[${name}], cannot find ref ${val.id} (property ${name})`);
    return resolved;
  }

  if (val.type === "lively-sync-morph-spec") {
    var resolved = objectMap.get(val.spec._id)
    if (!resolved) {
      resolved = morph({_env: syncController.morphicEnv, ...val.spec}, {restore: true});
      objectMap.set(val.spec._id, resolved);
    }
    assert(resolved, () => `Cannot deserialize change ${i(change)}[${name}], cannot create morph from spec ${val.spec}`);
    return resolved;
  }

  return val;
}

function deserializeChange(change, objectMap, syncController) {
  var deserializedChange,
      target = change.target ?
        deserializeChangeProp(change, "target", change.target, objectMap, syncController) : null;

  if (change.type === "setter") {
    var value = deserializeChangeProp(change, "value", change.value, objectMap, syncController);
    deserializedChange = new ValueChange(target, change.prop, value, change.meta);

  } else if (change.type === "method-call") {
    var args = change.args.map((arg, i) => deserializeChangeProp(change, `args[${i}]`, arg, objectMap, syncController));
    deserializedChange = new MethodCallChange(target, change.selector, args, null, change.meta);

  } else {
    assert(false, () => `Unknown change type ${change.type}, ${i(change)}`);
  }

  return deserializedChange;
}


function serializeChangeProp(change, name, val, objectMap, opts = {forceMorphId: false}) {
  if (!val) return val;

  if (val.isMorph) {
    if (!objectMap.has(val.id))
      objectMap.set(val.id, val);
    return opts.forceMorphId ?
      {type: "lively-sync-morph-ref", id: val.id} :
      {type: "lively-sync-morph-spec", spec: val.exportToJSON()};
  }

  return val;
}

function serializeChange(change, objectMap) {
  var serializedChange = obj.clone(change);
  serializedChange.type = change.type; // FIXME since change.type is a getter...

  if (change.target)
    serializedChange.target = serializeChangeProp(change, "target", change.target, objectMap, {forceMorphId: true});

  if (change.owner)
    serializedChange.owner = serializeChangeProp(change, "owner", change.owner, objectMap, {forceMorphId: true});

  if (change.type === "setter") {
    serializedChange.value = serializeChangeProp(change, "value", change.value, objectMap);
  } else if (change.type === "method-call") {
    serializedChange.args = change.args.map((arg,i) => serializeChangeProp(change, `arg[${i}]`, arg, objectMap));
  } else {
    assert(false, () => `Unknown change type ${change.type}, ${i(change)}`);
  }

  return serializedChange;
}

function applyChange(change, syncController) {
  var {world, objects} = syncController.state,
      deserializedChange = deserializeChange(change, objects, syncController),
      {type, args} = deserializedChange;

  // FIXME...! Adding unknown morphs to local registry...
  if (type === "method-call") {
    args
      .filter(ea => ea && ea.isMorph && !objects.has(ea))
      .forEach(m => objects.set(m.id, m));
  }

  deserializedChange.target.applyChange(deserializedChange);
}


function isEqualRef(objA, objB) {
  if (!objA || !objB) return false;
  if (objA === objB) return true;
  if (objA.type === "lively-sync-morph-ref" && objB.type === "lively-sync-morph-ref"
   && objA.id === objB.id) return true;
  if (objA.type === "lively-sync-morph-spec" && objB.type === "lively-sync-morph-spec"
   && objA._id === objB._id) return true;
  return false;
}

function fnStringsToFunctions(fnStrings) {
  return fnStrings.map(ea => eval(`(${ea})`));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// debugging helpers

function printUUID(id) {
  if (typeof id !== "string") return String(id);
  if (/^[a-z]/i.test(id)) return id.slice(0, id.indexOf("_")+6);
  return id.slice(0, 5);
}

function printObj(obj) {
  if (!obj) return String(obj);
  if (typeof obj.serializeExpr === "function") return obj.serializeExpr();
  if (obj.type === "lively-sync-morph-spec") return `<spec for ${printUUID(obj.spec._id)}>`
  if (obj.type === "lively-sync-morph-ref") return `<ref for ${printUUID(obj.id)}>`
  return lively.lang.obj.inspect(obj, {maxDepth: 1}).replace(/\n/g, "").replace(/\s\s+/g, " ");
}

function printChange(change) {
  var {type, target, value, prop, selector, args} = change;
  switch (type) {
    case 'method-call':
      return `${printUUID(target.id)}.${selector}(${args.map(printObj).join(",")})`;
    case 'setter':
      return `${printUUID(target.id)}.${prop} = ${printObj(value)}`;
    default:
      "?????????"
  }
}

function printOp(op) {
  var {id, parent, change, creator, version} = op;
  return `${printUUID(id)} < ${printUUID(parent)} | ${version} | ${printChange(change)} | ${creator}`
}

function printOps(ops) { return ops.map(printOp).join("\n"); }





// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// transforming ops
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function nullTransform(op1, op2) {
  // does nothing
  return {op1, op2, handled: false};
}

function morphicDefaultTransform(op1, op2, syncer) {
  var c1 = op1.change, c2 = op2.change,
      {prop: prop1, type: type1, target: {id: target1}, owner: owner1, value: value1, selector: selector1, args: args1, creator: creator1} = c1,
      {prop: prop2, type: type2, target: {id: target2}, owner: owner2, value: value2, selector: selector2, args: args2, creator: creator2} = c2;

  if (target1 === target2) {

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // position
    if (prop1 === "position" && prop2 === "position"
     && type1 === "setter" && type2 === "setter"
    // && owner1.id === owner2.id
     ) {
       op1.change = op2.change = {...c1, value: value1.addPt(value2.subPt(value1).scaleBy(.5))}
       return {op1, op2, handled: true}
    }

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // addMorph...
  if (selector1 === "addMorphAt" && selector2 === "addMorphAt") {

    // ...same owner, different morphs => transform order
    if (target1 === target2 && args1[0].spec._id !== args2[0].spec._id) {
       var newArgs1 = [args1[0], op1.creator < op2.creator ? args1[1] : args2[1]+1],
           newArgs2 = [args2[0], op1.creator < op2.creator ? args1[1]+1 : args2[1]];
       op1.change = {...c1, args: newArgs1};
       op2.change = {...c2, args: newArgs2};
       return {op1, op2, handled: true};
    }

    // ...same morph, different owners => one wins
    else if (args1[0].spec._id === args2[0].spec._id) {
      if (op1.creator < op2.creator) op2.change = {...c1};
      else op1.change = {...c2};
      return {op1, op2, handled: true};
    }

    // inverse addMorph, m1 added to m2 vs. m2 added to m1
    else if (target1 === args2[0].spec._id && target2 === args1[0].spec._id) {
      if (op1.creator < op2.creator) op2.change = {...c1};
      else op1.change = {...c2};
      return {op1, op2, handled: true};
    }

  }

  return {op1, op2, handled: false};
}

function runTransforms(op1, op2, tfmFns, syncer) {
  op1 = obj.clone(op1),
  op2 = obj.clone(op2);
  for (let tfmFn of tfmFns) {
    try {
      var {op1, op2, handled} = tfmFn(op1, op2, syncer);
      if (debug && handled && op1.change.selector === "addMorphAt" && op2.change.selector === "addMorphAt") {
        var sel1 = op1.change.selector,
            sel2 = op2.change.selector
        console.log(`[${syncer}] xform ${sel1} x ${sel2}\n`
                  + `${op1}\n${op2}\n`
                  + `${syncer.state.objects.get(op1.change.target.id)}\n`
                  + `${syncer.state.objects.get(op1.change.args[0].spec._id)}`);
      }

      if (handled) break;
    } catch (e) {
      console.error(`Error while transforming ${op1} with ${op2}:\n ${e.stack || e}`);
    }
  }

  op1.parent = op2.id;
  op2.parent = op1.id;
  var v1 = op2.version + 1,
      v2 = op1.version + 1;
  op1.version = v1;
  op2.version = v2;

  return {op1, op2};
}

function transformOp_1_to_n(op, againstOps, transformFns = [], syncer) {
  // transform an op against other ops
  if (!againstOps.length)
    return {transformedOp: op, transformedAgainstOps: []}

  var op2 = op, transformedAgainstOps = [];
  for (let op1 of againstOps) {
    ({op1, op2} = runTransforms(op1, op2, transformFns, syncer));
    transformedAgainstOps.push(op1);
  }

  return {transformedOp: op2, transformedAgainstOps}
}



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// composing ops
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function composeOps(ops) {
  return ops.length <= 1 ?
    ops :
    ops.slice(0, -1).reduceRight((composed, op1) => {
      var [op2, ...rest] = composed;
      return composeOpPair(op1, op2).concat(rest);
    }, ops.slice(-1));
}

function composeOpPair(op1, op2) {
  // composing setters: Use the last change as it overrides everything before
  if (op1.change.prop === op2.change.prop
   && isEqualRef(op1.change.target, op2.change.target)
   && op1.change.type === "setter" && op2.change.type === "setter")
     return [op2]

  return [op1, op2];
}



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// communication channel
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
class Channel {

  constructor(senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB) {
    if (!senderRecvrA) throw new Error("no sender / receiver a!");
    if (!senderRecvrB) throw new Error("no sender / receiver b!");
    if (typeof senderRecvrA[onReceivedMethodA] !== "function") throw new Error(`sender a has no receive method ${onReceivedMethodA}!`);
    if (typeof senderRecvrB[onReceivedMethodB] !== "function") throw new Error(`sender b has no receive method ${onReceivedMethodB}!`);

    this.id = string.newUUID();
    this.senderRecvrA = senderRecvrA;
    this.onReceivedMethodA = onReceivedMethodA;
    this.onReceivedMethodB = onReceivedMethodB;
    this.senderRecvrB = senderRecvrB;
    this.queueAtoB = [];
    this.queueBtoA = [];
    this.delayAtoB = 0;
    this.delayBtoA = 0;
    this.online = false;
    this.lifetime = 100;
    this._watchdogProcess = null
    this.goOnline();
  }

  toString() {
    return `<channel ${this.senderRecvrA}.${this.onReceivedMethodA} – ${this.senderRecvrB}.${this.onReceivedMethodB}>`
  }

  isOnline() { return this.online; }
  goOffline() { this.online = false; }
  goOnline() { this.online = true; this.watchdogProcess(); }

  watchdogProcess() {
    if (!this.isOnline() || this._watchdogProcess) return;

    this._watchdogProcess = setTimeout(() => {
      this._watchdogProcess = null;
      if (this.queueAtoB.length) this.send([], this.senderRecvrA);
      else if (this.queueBtoA.length) this.send([], this.senderRecvrB);
      else return;
    }, 800 + num.random(50));
  }

  isEmpty() {
    return !this.queueBtoA.length && !this.queueAtoB.length;
  }

  waitForDelivery() {
    return Promise.all([
      this.queueAtoB.length ? this.send([], this.senderRecvrA) : Promise.resolve(),
      this.queueBtoA.length ? this.send([], this.senderRecvrB) : Promise.resolve()]);
  }

  componentsForSender(sender) {
    if (sender !== this.senderRecvrA && sender !== this.senderRecvrB)
      throw new Error(`send called with sender unknown to channel: ${sender}`);
    return {
      recvr: this.senderRecvrA === sender ? this.senderRecvrB : this.senderRecvrA,
      queue: this.senderRecvrA === sender ? this.queueAtoB : this.queueBtoA,
      delay: this.senderRecvrA === sender ? this.delayAtoB : this.delayBtoA,
      method: this.senderRecvrA === sender ? this.onReceivedMethodB : this.onReceivedMethodA,
      descr: this.senderRecvrA === sender ? "AtoB" : "BtoA"
    }
  }

  send(content, sender) {
    var { recvr, queue, delay, method, descr, } = this.componentsForSender(sender);

    if (debug) {
      var msgs = (Array.isArray(content) ? content : [content]);
      let string = `[lively.sync] sending ${sender} -> ${recvr}: `;
      if (!msgs.length) string += " no messages"
      // else if (msgs.length === 1) string += msgs[0];
      string += msgs.map(ea => ea.change.prop || ea.change.selector).join(",")
      console.log(string);
    }

    queue.push(...(Array.isArray(content) ? content : [content]));

    return this.deliver(sender);
  }

  deliver(sender) {

    var { recvr, method, queue, delay, descr } = this.componentsForSender(sender);

    this.watchdogProcess();

    // try again later via watchdogProcess
    if (!this.isOnline()) return Promise.resolve();

      Promise.resolve().then(() => {
        if (!delay) {
          var outgoing = queue.slice(); queue.length = 0;
          try { recvr[method](outgoing, sender, this); }
          catch (e) { console.error(`Error in ${method} of ${recvr}: ${e.stack || e}`); }
        } else {
          fun.throttleNamed(`${this.id}-${descr}`, delay*1000, () => {
            var outgoing = queue.slice(); queue.length = 0;
            try { recvr[method](outgoing, sender, this); }
            catch (e) { console.error(`Error in ${method} of ${recvr}: ${e.stack || e}`); }
          })();
        }
      });

    return promise.waitFor(() => queue.length === 0);
  }
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


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// master
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
