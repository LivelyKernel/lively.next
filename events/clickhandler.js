import { arr } from "lively.lang";


var clickBindings = [
  {numClicks: 1, command: (morph, evt) => morph.onMouseMove(evt)},
  {numClicks: 2, command: "select word"},
  {numClicks: 3, command: "select line"}];


export class ClickHandler {

  static withDefaultBindings() {
    var handler = new this;
    clickBindings.forEach(({numClicks, command}) => handler.bind(numClicks, command));
    return handler;
  }

  constructor() {
    this.clickBindings = {};
    this._maxBinding = null;
  }

  bind(numClicks, command) {
    if (!command) delete this.clickBindings[numClicks];
    else this.clickBindings[numClicks] = command;
    this._maxBinding = null;
  }

  getBinding(numClicks) {
    return this.clickBindings[numClicks];
  }

  get maxBinding() {
    if (!this._maxBinding) {
      let { clickBindings } = this,
          bindings = Object.keys(clickBindings);
      this._maxBinding = arr.max(bindings, numClicks => parseInt(numClicks));
    }
    return this._maxBinding;
  }

  normalizeClickCount(numClicks) {
    var { maxBinding } = this;
    return ((numClicks - 1) % maxBinding) + 1;
  }

  handle(morph, evt) {
    var normalizedClickCount = this.normalizeClickCount(evt.state.clicks),
        command = this.getBinding(normalizedClickCount);
    if (command) {
      if (typeof(command) === "function") command(morph, evt);
      else morph.commandHandler.exec(command, morph, [], evt);
    }
  }
}
