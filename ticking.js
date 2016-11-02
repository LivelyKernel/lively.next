class Script {

  constructor() {
    this.suspended = false;
    this.stopped = true;
    this.tickTime = null;
    this.type = null;
    this.currentTimeout = null;
  }

  get isScript() { return true }
  get global() { return System.global; }

  execute() { throw new Error('subclass responsibility') }

  tick() {
    try {
      this.execute()
    } catch(e) {
      console.error('Error executing script ' + this + ': ' + e + '\n' + e.stack);
      return;
    }
    if (!this.stopped) this.startTicking(this.tickTime);
  }

  startTicking(ms) {
    this.stopped = false;
    this.tickTime = ms;
    this.type = typeof ms === "number" ? "setTimeout" : "requestAnimationFrame";
    this.currentTimeout = this.type === "setTimeout" ?
      this.global.setTimeout(this.tick.bind(this), ms) :
      this.global.requestAnimationFrame(this.tick.bind(this))
  }

  stop() {
    var sel = this.type === "setTimeout" ? "clearTimeout" : "cancelAnimationFrame";
    this.global[sel](this.currentTimeout);
  }

  resume(ms = this.tickTime) {
    if (!this.suspended) return;
    this.suspended = false;
    this.startTicking(this.tickTime = ms);
  }

  suspend() {
    this.stop();
    this.suspended = true;
  }

}

class TargetScript extends Script {

  constructor(target, selector, args) {
    super();
    this.target = target;
    this.selector = selector;
    this.args = args || [];
  }

  execute() {
    typeof this.target[this.selector] === 'function'
 && this.target[this.selector].apply(this.target, this.args);
  }

  equals(other) {
    return other.isScript
        && this.target == other.target
        && this.selector == other.selector;
  }

  toString() {
    return `Script(${this.target}>>${this.selector}(${this.args.join(',')}))`;
  }
}

class FunctionScript extends Script {

  constructor(callback) {
    super();
    this.callback = callback;
  }

  execute() { this.callback() }

  equals(other) { return other.isScript && this.callback == other.callback }

  toString() {
    return `Script(${this.callback.toString().replace(/\n/g, "").slice(0, 40) + "..."})`;
  }
}

export { Script, TargetScript, FunctionScript }
