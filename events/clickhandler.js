import { arr } from "lively.lang";


var clickBindings = [
  {numClicks: 1, command: {exec: (morph, evt) => morph.onMouseMove(evt)}},
  {numClicks: 2, command: "select word"},
  {numClicks: 3, command: "select line"}];


export class ClickHandler {

  static withDefaultBindings() {
    var handler = new this;
    clickBindings.forEach(({numClicks, command}) => handler.bind(numClicks, command));
    return handler;
  }

  constructor() {
    this.clickBindings = new Map();
    this._maxBinding = null;
  }

  bind(numClicks, command) {
    if (!command) this.clickBindings.delete(numClicks);
    else this.clickBindings.set(numClicks, command);
    this._maxBinding = null;
  }

  getBinding(numClicks) {
    return this.clickBindings.get(numClicks);
  }

  get maxBinding() {
    if (!this._maxBinding)
      for (let [numClicks, command] of this.clickBindings)
        this._maxBinding = Math.max(this._maxBinding || 0, numClicks);
    return this._maxBinding;
  }

  normalizeClickCount(numClicks) {
    var { maxBinding } = this;
    return ((numClicks - 1) % maxBinding) + 1;
  }

  handle(morph, evt) {
    var normalizedClickCount = this.normalizeClickCount(evt.state.clickCount),
        command = this.getBinding(normalizedClickCount);
    if (command) {
      this.execCommand(command, null, 1, evt);
    }
  }
}
