import { string, promise } from "lively.lang";

function nyi(msg) { throw new Error(`Not yet implemented: ${msg}`); }

var debugMessageOrder = true;

export default class L2LConnection {

  constructor(ns) {
    this.id = string.newUUID();
    this.debug = true;
    this.actions = {};
    this._incomingOrderNumberingBySenders = new Map();
    this._outgoingOrderNumberingByTargets = new Map();
    this._outOfOrderCacheBySenders = new Map();
  }

  isOnline() { nyi("isOnline"); }
  open() { nyi("isOnline"); }
  close() { nyi("close"); }
  remove() { nyi("remove"); }

  whenOnline(timeout) {
    return promise.waitFor(timeout, () => this.isOnline())
      .then(() => this)
      .catch(err =>
        Promise.reject(/timeout/i.test(String(err)) ?
          new Error(`Timeout in ${this}.whenOnline`) : err))
  }

  onError(err) {
    if (this.debug) console.log(`[${this}] error: ${err}`);
  }

  addService(selector, handlerFn) {
    this.actions[selector] = handlerFn;
  }

  addServices(services) {
    Object.keys(services).forEach(selector =>
      this.addService(selector, services[selector]));
  }

  send(msg, ackFn) { nyi("send"); }

  async sendAndWait(msg) {
    var timeout = {}, timeoutMs = 1000,
        answer = await Promise.race([
          promise.delay(timeoutMs, timeout),
          new Promise(resolve => this.send(msg, resolve))
        ]);
    if (answer === timeout)
      throw new Error(`Timout sending ${msg.action}`);
    return answer;
  }

  sendTo(target, action, data, ackFn) {
    return this.send({target, action, data}, ackFn)
  }

  sendToAndWait(target, action, data) {
    return this.sendAndWait({target, action, data});
  }

  prepareSend(msg, ackFn) {
    var {target, action, messageId, data, sender} = msg;
    if (!action) throw new Error(`Trying to send a message without specifying action!`);
    if (!target) throw new Error(`Trying to send message ${action} without specifying target!`);
    if (!messageId) msg.messageId = string.newUUID();
    if (!sender) msg.sender = this.id;
    var n = msg.n = this._outgoingOrderNumberingByTargets.get(target) || 0;
    this._outgoingOrderNumberingByTargets.set(target, n+1);

    if (typeof ackFn === "function") {
      var sender = this,
          expectedNextIncomingN = sender._incomingOrderNumberingBySenders.get(target) || 0,
          originalAckFn = ackFn;
      ackFn = function(msg) {
        // here we receive an ack, we count sender as one more received message
        // as it matters in the message ordering
        var incomingN = sender._incomingOrderNumberingBySenders.get(msg.sender) || 0;

        if (expectedNextIncomingN !== incomingN)
          console.error(`[MSG ORDER] [${sender}] expected ack to be message no ${expectedNextIncomingN} but it is ${incomingN}`);
        // console.assert(expectedNextIncomingN === incomingN,
          // `[MSG ORDER] [${sender}] expected ack to be message no ${expectedNextIncomingN} but it is ${incomingN}`);

        (sender.debug || debugMessageOrder) && console.log(`[MSG ORDER] ${sender} received ack for ${msg.action} as msg ${incomingN}`);

        try { originalAckFn.apply(null, arguments); } catch (err) {
          console.error(`Error in ack fn of ${sender}: ${err.stack}`);
        }
        sender._incomingOrderNumberingBySenders.set(msg.sender, incomingN+1);
        setTimeout(() => sender.invokeOutOfOrderMessages(msg.sender), 0);
      }    
    }

    (this.debug || debugMessageOrder) && console.log(`[MSG ORDER] ${this} sending ${n} (${msg.action}) to ${target}`);

    return [msg, ackFn];
  }

  installEventToMessageTranslator(socket) {
    var self = this;

    var onevent = socket.onevent;
    socket.onevent = function (packet) {
      var args = packet.data || [];
      onevent.call(this, packet); // original invocation
      packet.data = ["*"].concat(args);
      onevent.call(this, packet); // also invoke with *
    }

    socket.on("*", function(eventName, msg) {
      var lastArg = arguments[arguments.length-1],
          ackFn = typeof lastArg === "function" ? lastArg : null;
      msg = msg === ackFn ? null : msg;

      if (!msg || !msg.data || typeof msg.n !== "number" || !msg.sender) {
        console.warn(`${self} received non-conformant message ${eventName}:`, arguments);
        return;
      }

      try {
        var expectedN = self._incomingOrderNumberingBySenders.get(msg.sender) || 0;

        if (msg.n < expectedN) {
          console.error(`[MSG ORDER] [${self}] received message no ${msg.n} but expected >= ${expectedN}, dropping ${eventName}`);
          return;
        }

        if (msg.n > expectedN) {
          (self.debug || debugMessageOrder) && console.log(`[MSG ORDER] [${self}] storing out of order message ${eventName} (${msg.n}) for later invocation`);
          var cache = self._outOfOrderCacheBySenders.get(msg.sender);
          if (!cache) { cache = []; self._outOfOrderCacheBySenders.set(msg.sender, cache); }
          cache.push([eventName, msg, ackFn, socket]);
          return;
        }

        if (typeof self.actions[eventName] === "function") {
          self.invokeServiceHandler(eventName, msg, ackFn, socket)
        } else {
          if (!Object.keys(socket._events).includes(eventName))
            console.warn(`WARNING [${self}] Unhandled message: ${eventName}`);
        }

        setTimeout(() => self.invokeOutOfOrderMessages(msg.sender), 0);
      } catch (e) {
        console.error(`Error when handling ${eventName}: ${e.stack || e}`);
        // if (typeof ackFn === "function")
          // ackFn({action: "messageError", data: {selector: eventName}})
      }
    });
  }

  invokeOutOfOrderMessages(sender) {
  try {
    var outOfOrderMessages = this._outOfOrderCacheBySenders.get(sender);
    if (!outOfOrderMessages || !outOfOrderMessages.length) return;
    var expectedN = this._incomingOrderNumberingBySenders.get(sender) || 0;
    var invocationArgsI = outOfOrderMessages.findIndex(([_, {n}]) => n === expectedN);
    if (invocationArgsI > -1) {
      outOfOrderMessages.splice(invocationArgsI, 1);
      var invocationArgs = outOfOrderMessages[invocationArgsI];
      this.invokeServiceHandler.apply(this, invocationArgs);
    }
  } catch (e) {
    console.error(e)
  }
  }

  renameTarget(oldId, newId) {
    if (oldId === newId) return;
    var msgN = this._outgoingOrderNumberingByTargets.get(oldId);
    this._outgoingOrderNumberingByTargets.delete(oldId);
    this._outgoingOrderNumberingByTargets.set(newId, msgN);
  }

  invokeServiceHandler(selector, msg, ackFn, socket) {
    (this.debug || debugMessageOrder) && console.log(`[MSG ORDER] ${this} received ${msg.n} (${msg.action}) from ${msg.sender}`)
    this._incomingOrderNumberingBySenders.set(msg.sender, msg.n + 1);

    if (typeof ackFn === "function") {
      // in case we send back an ack, other messages send between now and ackFn
      // invocation should be received "later" then the ack
      var ackN = this._outgoingOrderNumberingByTargets.get(msg.sender) || 0;
      this._outgoingOrderNumberingByTargets.set(msg.sender, ackN + 1);
      var answerFn = answerData => {
        ackFn({
          action: msg.action + "-response",
          inResponseTo: msg.messageId,
          target: msg.sender,
          data: answerData,
          sender: this.id
        });
      (this.debug || debugMessageOrder) && console.log(`[MSG ORDER] ${this} sending ${ackN} (ack for ${msg.action})`);
      };
    }
    try {
      this.actions[selector].call(this, this, msg, answerFn, socket);
    } catch (e) {
      console.error(`[${this}] Error handling ${selector}: ${e.stack || e}`);
      answerFn && answerFn({error: e.stack});
    }
  }
}
