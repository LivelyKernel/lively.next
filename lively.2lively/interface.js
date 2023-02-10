import { string, promise, fun } from 'lively.lang';

let debugMessageOrder = false;

export default class L2LConnection {
  constructor (ns) {
    this.id = string.newUUID();
    this.actions = {};
    this.options = { ackTimeout: 3500, debug: false };
    this._incomingOrderNumberingBySenders = new Map();
    this._outgoingOrderNumberingByTargets = new Map();
    this._outOfOrderCacheBySenders = new Map();
  }

  isOnline () { fun.notYetImplemented('isOnline', true); }
  open () { fun.notYetImplemented('open, true'); }
  close () { fun.notYetImplemented('close', true); }
  remove () { fun.notYetImplemented('remove', true); }

  get debug () { return this.options.debug; }
  set debug (bool) { this.options.debug = bool; }

  whenOnline (timeout) {
    return promise.waitFor(timeout, () => this.isOnline())
      .then(() => this)
      .catch(err =>
        Promise.reject(/timeout/i.test(String(err))
          ? new Error(`Timeout in ${this}.whenOnline`)
          : err));
  }

  onError (err) {
    if (this.debug) console.log(`[${this}] error: ${err}`);
  }

  removeService (selector) {
    delete this.actions[selector];
  }

  removeServices (selectors) {
    selectors.forEach(ea => this.removeService(ea));
  }

  addService (selector, handlerFn) {
    this.actions[selector] = handlerFn;
  }

  addServices (services) {
    Object.keys(services).forEach(selector =>
      this.addService(selector, services[selector]));
  }

  async ping (target) {
    let t = Date.now();
    let { data: { timestamp: t2 } } = await this.sendToAndWait(target, 'l2l-ping', { timestamp: t });
    let t3 = Date.now();
    return {
      to: t2 - t,
      from: t3 - t2,
      roundtrip: t3 - t
    };
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // sending stuff

  send (msg, ackFn) { fun.notYetImplemented('send', true); }

  async sendAndWait (msg) {
    // timeout actually dealt with on receiver side, see
    // installEventToMessageTranslator, this here is just to notice of things
    // really go wrong
    // FIXME: set timeoutMs to receiver timeout time!

    let sendP = new Promise((resolve, reject) => this.send(msg, resolve));
    let timeout = {};
    let timeoutMs = this.options.ackTimeout + 400;

    if ('ackTimeout' in msg) {
      if (!msg.ackTimeout || msg.ackTimeout < 0) timeoutMs = null;
      else timeoutMs = msg.ackTimeout + 400;
    }

    let answer;
    if (timeoutMs) answer = await Promise.race([promise.delay(timeoutMs, timeout), sendP]);
    else answer = await sendP;

    if (answer === timeout) { throw new Error(`Timeout sending ${msg.action}`); }

    return answer;
  }

  sendTo (target, action, data, ackFn) {
    return this.send({ target, action, data }, ackFn);
  }

  sendToAndWait (target, action, data, opts) {
    return this.sendAndWait({ target, action, data, ...opts });
  }

  prepareSend (msg, ackFn) {
    var { target, action, messageId, data, sender } = msg;
    if (!action) throw new Error('Trying to send a message without specifying action!');
    if (!target) throw new Error(`Trying to send message ${action} without specifying target!`);
    if (!messageId) msg.messageId = string.newUUID();
    if (!sender) msg.sender = this.id;
    let n = msg.n = this._outgoingOrderNumberingByTargets.get(target) || 0;
    this._outgoingOrderNumberingByTargets.set(target, n + 1);

    if (typeof ackFn === 'function') {
      var sender = this;
      let originalAckFn = ackFn;
      ackFn = function (msg) {
        // here we receive an ack, we count sender as one more received message
        // as it matters in the message ordering
        let incomingN = sender._incomingOrderNumberingBySenders.get(msg.sender) || 0;

        (sender.debug && debugMessageOrder) && console.log(`[MSG ORDER] ${sender} received ack for ${msg.action} as msg ${incomingN}`);

        try { originalAckFn.apply(null, arguments); } catch (err) {
          console.error(`Error in ack fn of ${sender}: ${err.stack}`);
        }
        sender._incomingOrderNumberingBySenders.set(msg.sender, incomingN + 1);
        setTimeout(() => sender.invokeOutOfOrderMessages(msg.sender), 0);
      };
    }

    (this.debug && debugMessageOrder) && console.log(`[MSG ORDER] ${this} sending ${n} (${msg.action}) to ${target}`);

    return [msg, ackFn];
  }

  prepareAnswerMessage (forMsg, answerData) {
    return {
      action: forMsg.action + '-response',
      inResponseTo: forMsg.messageId,
      target: forMsg.sender,
      data: answerData,
      sender: this.id
    };
  }

  installEventToMessageTranslator (socket) {
    let self = this;

    let onevent = socket.onevent;
    socket.onevent = function (packet) {
      let args = packet.data || [];
      onevent.call(this, packet); // original invocation
      packet.data = ['*'].concat(args);
      onevent.call(this, packet); // also invoke with *
    };

    socket.on('*', function (eventName, msg) {
      if (eventName && typeof eventName === 'object' && eventName.action) {
        msg = eventName;
        eventName = msg.action;
      }
      let lastArg = arguments[arguments.length - 1];
      let ackFn = typeof lastArg === 'function' ? lastArg : null;
      msg = msg === ackFn ? null : msg;

      if (!msg || !msg.data || (typeof msg.n !== 'number' && !msg.broadcast) || !msg.sender) {
        console.warn(`${self} received non-conformant message ${eventName}:`, arguments);
        typeof ackFn === 'function' && ackFn({ data: { error: 'invalid l2l message' } });
        return;
      }

      self.receive(msg, socket, ackFn);
    });
  }

  receive (msg, socket, ackFn) {
    this.dispatchL2LMessageToSelf(msg, socket, ackFn);
  }

  dispatchL2LMessageToSelf (msg, socket, ackFn) {
    let selector = msg.action;

    // for broadcasted messages order isn't enforced...
    if (msg.broadcast) {
      this.safeInvokeServiceHandler(selector, msg, ackFn, socket);
      return;
    }

    // do he message ordering dance....
    try {
      let expectedN = this._incomingOrderNumberingBySenders.get(msg.sender) || 0;
      let ignoreN = selector === 'register' || 'unregister';

      if (!ignoreN && msg.n < expectedN) {
        console.error(`[MSG ORDER] [${this}] received message no. ${msg.n} but expected >= ${expectedN}, dropping ${selector}`);
        return;
      }

      if (!ignoreN && msg.n > expectedN) {
        if (this.debug && debugMessageOrder) { console.log(`[MSG ORDER] [${this}] storing out of order message ${selector} (${msg.n}) for later invocation`); }
        let cache = this._outOfOrderCacheBySenders.get(msg.sender);
        if (!cache) { cache = []; this._outOfOrderCacheBySenders.set(msg.sender, cache); }
        cache.push([selector, msg, ackFn, socket]);
        return;
      }

      this.safeInvokeServiceHandler(selector, msg, ackFn, socket);

      setTimeout(() => this.invokeOutOfOrderMessages(msg.sender), 0);
    } catch (e) {
      console.error(`Error message ordering when handling ${selector}: ${e.stack || e}`);
      if (typeof ackFn === 'function') {
        ackFn(this.prepareAnswerMessage(msg,
          { isError: true, error: String(e.stack || e) }));
      }
    }
  }

  invokeOutOfOrderMessages (sender) {
    let outOfOrderMessages = this._outOfOrderCacheBySenders.get(sender);
    if (!outOfOrderMessages || !outOfOrderMessages.length) return;
    let expectedN = this._incomingOrderNumberingBySenders.get(sender) || 0;
    let invocationArgsI = outOfOrderMessages.findIndex(([_, { n }]) => n === expectedN);
    if (invocationArgsI === -1) return;
    outOfOrderMessages.splice(invocationArgsI, 1);
    let invocationArgs = outOfOrderMessages[invocationArgsI];
    this.invokeServiceHandler.apply(this, invocationArgs);
  }

  renameTarget (oldId, newId) {
    if (oldId === newId) return;
    let msgN = this._outgoingOrderNumberingByTargets.get(oldId);
    this._outgoingOrderNumberingByTargets.delete(oldId);
    this._outgoingOrderNumberingByTargets.set(newId, msgN);
  }

  safeInvokeServiceHandler (selector, msg, ackFn, socket) {
    try {
      if (typeof this.actions[selector] === 'function') {
        this.invokeServiceHandler(selector, msg, ackFn, socket);
      } else {
        if (!socket._events || !Object.keys(socket._events).includes(selector)) {
          console.warn(`WARNING [${this}] Unhandled message: ${selector}`);
          if (typeof ackFn === 'function') {
            ackFn(this.prepareAnswerMessage(msg,
              { isError: true, error: 'message not understood: ' + selector }));
          }
        }
      }
    } catch (e) {
      console.error(`Error when handling ${selector}: ${e.stack || e}`);
      if (typeof ackFn === 'function') {
        ackFn(this.prepareAnswerMessage(msg,
          { isError: true, error: String(e.stack || e) }));
      }
    }
  }

  invokeServiceHandler (selector, msg, ackFn, socket) {
    if (this.debug && debugMessageOrder) { console.log(`[MSG ORDER] ${this} received ${msg.n} (${msg.action}) from ${msg.sender}`); }

    this._incomingOrderNumberingBySenders.set(msg.sender, msg.n + 1);

    if (typeof ackFn === 'function') {
      // in case we send back an ack, other messages send between now and ackFn
      // invocation should be received "later" then the ack
      let ackCalled = false;
      let ackTimedout = false;
      let timeoutMs = 'ackTimeout' in msg ? msg.ackTimeout : this.options.ackTimeout;
      let ackN = this._outgoingOrderNumberingByTargets.get(msg.sender) || 0;

      this._outgoingOrderNumberingByTargets.set(msg.sender, ackN + 1);

      var answerFn = answerData => {
        if (ackTimedout) {
          console.warn(`[${this}] ackFn for ${msg.action} called after it timed out, dropping answer!`);
          return;
        }

        if (ackCalled) {
          console.warn(`[${this}] ack function called repeatedly when handling ${msg.action}`);
          return;
        }
        ackCalled = true;

        ackFn(this.prepareAnswerMessage(msg, answerData));

        if (this.debug && debugMessageOrder) { console.log(`[MSG ORDER] ${this} sending ${ackN} (ack for ${msg.action})`); }
      };

      timeoutMs && setTimeout(() => {
        if (ackCalled) return;
        answerFn({
          isError: true,
          error: `Timeout error: ${this} did not send answer for ${msg.action} after ${timeoutMs}ms`
        });
        ackTimedout = true;
      }, timeoutMs);
    }

    try {
      this.actions[selector].call(this, this, msg, answerFn, socket);
    } catch (e) {
      console.error(`[${this}] Error handling ${selector}: ${e.stack || e}`);
      answerFn && answerFn({ error: e.stack });
    }
  }
}
