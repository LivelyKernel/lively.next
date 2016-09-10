import { Token, Mode } from "../highlighting.js";

// type Token = "keyword" | "id" | "numeric" | "string" | "comment" | "default"

export default class PlainMode extends Mode {
  reset() {
    // noop
  }
  process(char) { // string -> Token
    return Token.default;
  }
}
