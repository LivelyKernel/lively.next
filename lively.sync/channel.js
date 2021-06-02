import { string, num, promise, fun } from 'lively.lang';
import L2LClient from 'lively.2lively/client.js';
import { newUUID } from 'lively.lang/string.js';
import { ExpressionSerializer } from 'lively.serializer2';

let debug = false;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// communication channel
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
export class Channel {
  static for (senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB) {
    if (typeof senderRecvrB === 'string') {
      return new L2LChannel(senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB);
    }
    return new this(senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB);
  }

  constructor (senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB) {
    if (!senderRecvrA) throw new Error('no sender / receiver a!');
    if (!senderRecvrB) throw new Error('no sender / receiver b!');
    if (typeof senderRecvrA[onReceivedMethodA] !== 'function') throw new Error(`sender a has no receive method ${onReceivedMethodA}!`);
    if (typeof senderRecvrB !== 'string' && typeof senderRecvrB[onReceivedMethodB] !== 'function') { throw new Error(`sender b has no receive method ${onReceivedMethodB}!`); }

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
    this._watchdogProcess = null;
    this.goOnline();
  }

  toString () {
    return `<channel ${this.senderRecvrA}.${this.onReceivedMethodA} – ${this.senderRecvrB}.${this.onReceivedMethodB}>`;
  }

  isOnline () { return this.online; }
  goOffline () { this.online = false; }
  goOnline () { this.online = true; this.watchdogProcess(); }

  watchdogProcess () {
    if (!this.isOnline() || this._watchdogProcess) return;

    this._watchdogProcess = setTimeout(() => {
      this._watchdogProcess = null;
      if (this.queueAtoB.length) this.send([], this.senderRecvrA);
      else if (this.queueBtoA.length) this.send([], this.senderRecvrB);
      else return;
    }, 800 + num.random(50));
  }

  isEmpty () {
    return !this.queueBtoA.length && !this.queueAtoB.length;
  }

  waitForDelivery () {
    return Promise.all([
      this.queueAtoB.length ? this.send([], this.senderRecvrA) : Promise.resolve(),
      this.queueBtoA.length ? this.send([], this.senderRecvrB) : Promise.resolve()]);
  }

  componentsForSender (sender) {
    if (sender !== this.senderRecvrA && sender !== this.senderRecvrB) { throw new Error(`send called with sender unknown to channel: ${sender}`); }
    return {
      recvr: this.senderRecvrA === sender ? this.senderRecvrB : this.senderRecvrA,
      queue: this.senderRecvrA === sender ? this.queueAtoB : this.queueBtoA,
      delay: this.senderRecvrA === sender ? this.delayAtoB : this.delayBtoA,
      method: this.senderRecvrA === sender ? this.onReceivedMethodB : this.onReceivedMethodA,
      descr: this.senderRecvrA === sender ? 'AtoB' : 'BtoA'
    };
  }

  send (content, sender) {
    let { recvr, queue, descr } = this.componentsForSender(sender);

    if (debug) {
      let msgs = (Array.isArray(content) ? content : [content]);
      let string = `[lively.sync] sending ${sender} -> ${recvr}: `;
      if (!msgs.length) string += ' no messages';
      // else if (msgs.length === 1) string += msgs[0];
      string += msgs.map(ea => ea.change.prop || ea.change.selector).join(',');
      console.log(string);
    }

    queue.push(...(Array.isArray(content) ? content : [content]));

    return this.deliver(sender);
  }

  deliver (sender) {
    let { recvr, method, queue, delay, descr } = this.componentsForSender(sender);

    this.watchdogProcess();

    // try again later via watchdogProcess
    if (!this.isOnline()) return Promise.resolve();

    Promise.resolve().then(() => {
      if (!delay) {
        let outgoing = queue.slice(); queue.length = 0;
        try { recvr[method](outgoing, sender, this); } catch (e) { console.error(`Error in ${method} of ${recvr}: ${e.stack || e}`); }
      } else {
        fun.throttleNamed(`${this.id}-${descr}`, delay * 1000, () => {
          let outgoing = queue.slice(); queue.length = 0;
          try { recvr[method](outgoing, sender, this); } catch (e) { console.error(`Error in ${method} of ${recvr}: ${e.stack || e}`); }
        })();
      }
    });

    return promise.waitFor(() => queue.length === 0);
  }
}

export class L2LChannel extends Channel {
  constructor (...args) {
    super(...args);
    // now initialize a l2lClient connection to connect to the remote
    this.initL2LConnection();
  }

  async initL2LConnection () {
    let id = this.senderRecvrB;
    this.l2lClient = await L2LClient.default();
    await this.l2lClient.joinRoom(id);
    // start listening for incoming messages
    this.l2lClient.addService(this.onReceivedMethodA, (tracker, msg) =>
      this.send(msg.data, id));
  }

  serializeContent (content) {
    let exprSerializer = new ExpressionSerializer();
    content = (Array.isArray(content) ? content : [content]);
    content = content.map(o => {
      return JSON.stringify(o, (key, val) => {
        if (val.__serialize__) {
          try {
            val = exprSerializer.exprStringEncode(val.__serialize__());
          } catch (e) {
            console.log(`serializeChange: failed to serialize ${key} to serialized expression`);
          }
        }
      });
    });
    return content;
  }

  deserializeContent (stringifiedContent) {
    let exprSerializer = new ExpressionSerializer();
    let content = JSON.parse(stringifiedContent, (key, val) => {
      if (typeof val === 'string' && exprSerializer.isSerializedExpression(val)) {
        return exprSerializer.deserializeExpr(val);
      }
    });
    return content;
  }

  send (content, sender) {
    let { recvr, queue, descr } = this.componentsForSender(sender);

    if (debug) {
      let msgs = (Array.isArray(content) ? content : [content]);
      let string = `[lively.sync] sending ${sender} -> ${recvr}: `;
      if (!msgs.length) string += ' no messages';
      // else if (msgs.length === 1) string += msgs[0];
      string += msgs.map(ea => ea.change.prop || ea.change.selector).join(',');
      console.log(string);
    }

    content = this.serializeContent(content);

    queue.push(...content);

    return this.deliver(sender);
  }

  deliver (sender) {
    let { recvr, method, queue, delay, descr } = this.componentsForSender(sender);

    this.watchdogProcess();

    // try again later via watchdogProcess
    if (!this.isOnline()) return Promise.resolve();

    if (typeof recvr === 'string') {
      // then we need to invoke our client
      Promise.resolve().then(() => {
        if (!delay) {
          let outgoing = queue.slice(); queue.length = 0;
          try {
            this.l2lClient.broadcast(recvr, method, outgoing);
          } catch (e) { console.error(`Error in ${method} of ${recvr}: ${e.stack || e}`); }
        } else {
          fun.throttleNamed(`${this.id}-${descr}`, delay * 1000, () => {
            let outgoing = queue.slice(); queue.length = 0;
            try { this.l2lClient.broadcast(recvr, method, outgoing); } catch (e) { console.error(`Error in ${method} of ${recvr}: ${e.stack || e}`); }
          })();
        }
      });
    } else {
      Promise.resolve().then(() => {
        // incoming stuff for a l2l channel needs to always parse its arguments
        outgoing = this.deserializeContent(outgoing);
        if (!delay) {
          var outgoing = queue.slice(); queue.length = 0;
          try { recvr[method](outgoing, sender, this); } catch (e) { console.error(`Error in ${method} of ${recvr}: ${e.stack || e}`); }
        } else {
          fun.throttleNamed(`${this.id}-${descr}`, delay * 1000, () => {
            let outgoing = queue.slice(); queue.length = 0;
            try { recvr[method](outgoing, sender, this); } catch (e) { console.error(`Error in ${method} of ${recvr}: ${e.stack || e}`); }
          })();
        }
      });
    }

    return promise.waitFor(() => queue.length === 0);
  }
}

export class L2LCollaboration {
  static async for (master) {
    let id = newUUID();
    let collaboration = new this(master, id);
    collaboration.l2lClient = await L2LClient.forLivelyInBrowser({ type: 'lively.sync master' });
    collaboration.l2lClient.addService(
      'getInitialState', (tracker, msg, ackFn) => {
        return ackFn(master.state.world.exportToJSON({ keepFunctions: false }));
      });
    await collaboration.l2lClient.joinRoom(id);
    master.addConnection(collaboration);
    return id;
  }

  constructor (master, id) {
    this.opChannel = new L2LChannel(master, 'receiveOpsFromClient', id, 'receiveOpsFromMaster');
    this.metaChannel = new L2LChannel(master, 'receiveMetaMsgsFromClient', id, 'receiveMetaMsgsFromMaster');
  }
}
