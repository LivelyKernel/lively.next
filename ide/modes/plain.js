import { Token, Highlighter } from "../highlighting.js";

export default class PlainHighlighter extends Highlighter {
  reset() {
    // noop
  }
  process() { // -> Token
    return Token.default;
  }
}
