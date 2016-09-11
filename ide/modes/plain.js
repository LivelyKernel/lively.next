import { Token, Mode } from "../highlighting.js";

export default class PlainMode extends Mode {
  reset() {
    // noop
  }
  process(char) { // string -> Token
    return Token.default;
  }
}
