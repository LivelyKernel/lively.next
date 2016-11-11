import { string, promise } from "lively.lang";

function nyi(msg) { throw new Error(`Not yet implemented: ${msg}`); }

export default class L2LConnection {

  constructor(ns) {
    this.id = string.newUUID();
    this.debug = true;
    this.actions = {};
  }

  isOnline() { nyi("isOnline"); }
  open() { nyi("isOnline"); }
  close() { nyi("close"); }
  remove() { nyi("remove"); }

  whenOnline() {
    return promise.waitFor(() => this.isOnline()).then(() => this);
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
      throw new Error(`Timout sending message ${msg.action}`);
    return answer;
  }

  sendTo(target, action, data, ackFn) {
    return this.send({target, action, data}, ackFn)
  }

  sendToAndWait(target, action, data) {
    return this.sendAndWait({target, action, data});
  }

  ensureMessageProps(msg) {
    var {target, action, messageId, data, sender} = msg;
    if (!action) throw new Error(`Trying to send a message without specifying action!`);
    if (!target) throw new Error(`Trying to send message ${action} without specifying target!`);
    if (!messageId) msg.messageId = string.newUUID();
    if (!sender) msg.sender = this.id;
    return msg;
  }


  installEventToMessageTranslator(socket) {
    var l2lConnection = this;

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
      msg = msg === lastArg ? null : msg;

      if (!msg || !msg.data) {
        console.warn(`${this} received non-conformant message`, msg);
        return;
      }

      try {
        if (typeof l2lConnection.actions[eventName] === "function") {
          if (typeof ackFn === "function") {
            var answerFn = answerData => ackFn({
              action: msg.action + "-response",
              inResponseTo: msg.messageId,
              target: msg.sender,
              data: answerData,
              sender: l2lConnection.id
            })
          }
          l2lConnection.actions[eventName].call(l2lConnection, l2lConnection, msg, answerFn, socket);

        } else {
          if (!Object.keys(socket._events).includes(eventName))
            console.warn(`WARNING [${l2lConnection}] Unhandled message: ${eventName}`);
        }

      } catch (e) {
        console.error(`Error when handling ${eventName}: ${e.stack || e}`);
        // if (typeof ackFn === "function")
          // ackFn({action: "messageError", data: {selector: eventName}})
      }
    });

  }
}
