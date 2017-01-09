import { string, num, promise, fun } from "lively.lang";

var debug = false;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// communication channel
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
export class Channel {

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