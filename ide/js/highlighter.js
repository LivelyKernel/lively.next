import { Token, Tokenizer } from "../highlighting.js";

const words = {
  keyword: ["typeof", "new", "catch", "function", "return", "catch", "switch", "var", "if", "in", "from", "while", "do", "else", "case", "break", "class", "export", "import", "throw", "extends", "const", "let", "async", "await", "default", "of", "for"],
  constant: ["null", "undefined", "true", "false"],
  global: ["window", "alert", "console", "JSON", "Math", "fetch", "parseInt", "parseFloat", "String", "Number", "Array", "Object", "Function", "Date", "$world"],
  dynamic: ["this", "super"]
};

export default class JavaScriptTokenizer extends Tokenizer {

  reset() {
    this.state = "default";
    this.left = 0;
    this.skipNext = false;
    this.commentEnding = false;
    this.levels = [0];
    this.rere = /\/[^\n \/]+\/[gimuy]*/g;
  }

  checkWord(type) {
    const found = words[type].find(w => this.checkChars(w));
    if (!found) return false;
    const cAfter = this.idx + found.length;
    if (this.str.length > cAfter && /[0-9a-zA-Z_\$]/.test(this.str[cAfter])) {
      return false; // char after kw (assumes keywords don't have a common prefix)
    }
    this.state = type;
    this.left = found.length - 1;
    return true;
  }

  process() { // -> Token
    const c = this.next();
    switch (this.state) {
      case "default":
        if (c === "{") {
          this.levels[this.levels.length - 1]++;
          return Token.default;
        }
        if (c === "}") {
          if (this.levels.length === 1 && this.levels[0] <= 0) {
            return Token.error;
          } else if (this.levels.length > 1 && this.levels[this.levels.length - 1] === 1) {
            this.levels.pop();
            this.state = "template";
          } else {
            this.levels[this.levels.length - 1]--;
          }
          return Token.default;
        }
        if (/[0-9]/.test(c)) {
          return Token.numeric;
        }
        if (c === "'") {
          this.state = "sstring";
          return Token.string;
        }
        if (c === '"') {
          this.state = "dstring";
          return Token.string;
        }
        if (c=== "`") {
          this.state = "template";
          return Token.string;
        }
        if (this.checkChars("/*")) {
          this.state = "comment";
          return Token.comment;
        }
        if (this.checkChars("//")) {
          this.state = "linecomment";
          return Token.comment;
        }
        if (c=== "/") {
          this.rere.lastIndex = this.idx;
          const m = this.rere.exec(this.str);
          if (m && m.index === this.idx) {
            this.state = "regex";
            this.left = m[0].length - 1;
            return Token.regex;
          }
        }
        if (this.checkWord("keyword")) {
          return Token.keyword;
        }
        if (this.checkWord("constant")) {
          return Token.constant;
        }
        if (this.checkWord("global")) {
          return Token.global;
        }
        if (this.checkWord("dynamic")) {
          return Token.dynamic;
        }
        if (/[0-9a-zA-Z_\$]/.test(c)) { //TODO unicode
          this.state = "id";
          return Token.id;
        }
        return Token.default;

      case "sstring":
        if (this.skipNext) {
          this.skipNext = false;
        } else if (c === "\\") {
          this.skipNext = true;
        } else if (c === "'") {
          this.state = "default";
        } else if (c === '\n') {
          this.state = "default";
          return Token.error;
        }
        return Token.string;

      case "dstring":
        if (this.skipNext) {
          this.skipNext = false;
        } else if (c === "\\") {
          this.skipNext = true;
        } else if (c === '"') {
          this.state = "default";
        } else if (c === '\n') {
          this.state = "default";
          return Token.error;
        }
        return Token.string;

      case "template":
        if (this.skipNext) {
          this.skipNext = false;
        } else if (c === "\\") {
          this.skipNext = true;
        } else if (c === '`') {
          this.state = "default";
        } else if (this.checkChars("${")) {
          this.levels.push(0);
          this.state = "default";
          return Token.default;
        }
        return Token.string;

      case "comment":
        if (this.commentEnding) {
          this.commentEnding = false;
          this.state = "default";
        } else if (this.checkChars("*/")) {
          this.commentEnding = true;
        }
        return Token.comment;

      case "linecomment":
        if (c === '\n') {
          this.state = "default";
        }
        return Token.comment;

      case "id":
        if (/[0-9a-zA-Z_\$]/.test(c)) { //TODO unicode
          return Token.id;
        }
        this.state = "default";
        return this.process();

      case "keyword":
        if (--this.left === 0) {
          this.state = "default";
        }
        return Token.keyword;

      case "constant":
        if (--this.left === 0) {
          this.state = "default";
        }
        return Token.constant;

      case "global":
        if (--this.left === 0) {
          this.state = "default";
        }
        return Token.global;

      case "dynamic":
        if (--this.left === 0) {
          this.state = "default";
        }
        return Token.dynamic;

      case "regex":
        if (--this.left === 0) {
          this.state = "default";
        }
        return Token.regex;

    }
    return Token.default;
  }

}

/*
Profiling code:

import JavaScriptMode from "lively.morphic/ide/modes/javascript-highlighter.js";
const mode = new JavaScriptMode(),
     src = await System.resource("https://dev.lively-web.org/node_modules/lively.morphic/morph.js").read();
const start = Date.now();
mode.highlight(src);
const timeMS = Date.now() - start;
timeMS
*/
