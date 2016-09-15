import { Token, Mode } from "../highlighting.js";

export default class PlainMode extends Mode {
  reset() {
    // noop
  }
  process() { // -> Token
    return Token.default;
  }
}
