import { Token, Highlighter } from "../highlighting.js";

export default class DiffHighlighter extends Highlighter {
  reset() {
    this.state = "start";
  }
  process() { // -> Token
    const c = this.next();
    switch (this.state) {
      case "start":
        if (c === "+") {
          this.state = "added";
          return Token.default;
        }
        if (c === "-") {
          this.state = "removed";
          return Token.string;
        }
        this.state = "unchanged";
        return Token.context;

      case "added":
        if (c === '\n') {
          this.state = "start";
        }
        return Token.default;

      case "removed":
        if (c === '\n') {
          this.state = "start";
        }
        return Token.string;
        
      case "unchanged":
        if (c === '\n') {
          this.state = "start";
        }
        return Token.context;

    }
    return Token.default;
  }
}
