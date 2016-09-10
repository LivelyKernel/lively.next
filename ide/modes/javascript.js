import { Token, Mode } from "../highlighting.js";

// type Token = "keyword" | "id" | "numeric" | "string" | "comment" | "default"

const keywords = ["typeof", "new", "true", "false", "catch", "function", "return", "null", "catch", "switch", "var", "if", "in", "while", "do", "else", "case", "break", "class", "export", "import", "throw", "extends", "this"];

export default class JavaScriptMode extends Mode {
  reset() {
    this.state = "default";
    this.left = 0;
    this.skipNext = false;
    this.commentEnding = false;
  }
  process(str) { // string -> Token
    switch (this.state) {
      case "default":
        if (/[0-9]/.test(str[0])) {
          return Token.numeric;
        }
        if (str[0] == "'") {
          this.state = "sstring";
          return Token.string;
        }
        if (str[0] == '"') {
          this.state = "dstring";
          return Token.string;
        }
        if (str[0] == "`") {
          this.state = "template";
          return Token.string;
        }
        if (/^\/\*/.test(str)) {
          this.state = "comment";
          return Token.comment;
        }
        if (/^\/\//.test(str)) {
          this.state = "linecomment";
          return Token.comment;
        }
        const kw = keywords.find(kw => str.startsWith(kw));
        if (kw) {
          this.state = "keyword";
          this.left = kw.length - 1;
          return Token.keyword;
        }
        if (/[0-9a-zA-Z_]/.test(str[0])) { //TODO unicode
          this.state = "id";
          return Token.id;
        }
        return Token.default;
        
      case "sstring":
        if (this.skipNext) {
          this.skipNext = false;
        } else if (str[0] == "\\") {
          this.skipNext = true;
        } else if (str[0] == "'") {
          this.state = "default"; 
        }
        return Token.string;

      case "dstring":
        if (this.skipNext) {
          this.skipNext = false;
        } else if (str[0] == "\\") {
          this.skipNext = true;
        } else if (str[0] == '"') {
          this.state = "default"; 
        }
        return Token.string;

      case "template": //TODO: interpolation
        if (this.skipNext) {
          this.skipNext = false;
        } else if (str[0] == "\\") {
          this.skipNext = true;
        } else if (str[0] == '`') {
          this.state = "default"; 
        }
        return Token.string;
        
      case "comment":
        if (this.commentEnding) {
          this.state = "default";
        } else if (/^\*\//.test(str)) {
          this.commentEnding = true;
        }
        return Token.comment;
        
      case "linecomment":
        if (str[0] == '\n') {
          this.state = "default";
        }
        return Token.comment;

      case "id":
        if (/[0-9a-zA-Z_]/.test(str[0])) { //TODO unicode
          return Token.id;
        }
        this.state = "default";
        return this.process(str);
        
      case "keyword":
        if (--this.left === 0) {
          this.state = "default";
          return Token.keyword;
        }
        return Token.keyword;
        
    }
    return Token.default;
  }
}
