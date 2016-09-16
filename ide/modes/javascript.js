import { Token, Mode } from "../highlighting.js";

const words = {
  keyword: ["typeof", "new", "catch", "function", "return", "catch", "switch", "var", "if", "in", "while", "do", "else", "case", "break", "class", "export", "import", "throw", "extends", "const", "let", "async", "await", "default"],
  constant: ["null", "undefined", "true", "false"],
  global: ["window", "alert", "console", "JSON", "Math", "fetch", "parseInt", "parseFloat", "String", "Number", "Array", "Object", "Function", "Date"],
  dynamic: ["this", "super"]
};

export default class JavaScriptMode extends Mode {
  reset() {
    this.state = "default";
    this.left = 0;
    this.skipNext = false;
    this.commentEnding = false;
    this.level = 0;
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
  backToDefault() {
    this.state = this.level >= 1 ? "templateint" : "default";
  }
  process() { // -> Token
    const c = this.next();
    switch (this.state) {
      case "templateint": // template interpolation
        if (c === "}" && this.level === 1) {
          this.level = 0;
          this.state = "template";
          return Token.default;
        }
        if (c === "`") {
          this.state = "template2";
          return Token.string;
        }
      case "default":
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
        if (c === "{") {
          this.level++;
        }
        if (c === "}") {
          this.level--;
        }
        if (this.checkChars("/*")) {
          this.state = "comment";
          return Token.comment;
        }
        if (this.checkChars("//")) {
          this.state = "linecomment";
          return Token.comment;
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
          this.backToDefault();
        }
        return Token.string;

      case "dstring":
        if (this.skipNext) {
          this.skipNext = false;
        } else if (c === "\\") {
          this.skipNext = true;
        } else if (c === '"') {
          this.backToDefault();
        }
        return Token.string;

      case "template":
        if (this.skipNext) {
          this.skipNext = false;
        } else if (c === "\\") {
          this.skipNext = true;
        } else if (c === '`') {
          this.backToDefault();
        } else if (this.checkChars("${")) {
          this.level = 0;
          this.state = "templateint";
          return Token.default;
        }
        return Token.string;
        
      case "template2": // template-within-a-template
        if (this.skipNext) {
          this.skipNext = false;
        } else if (c === "\\") {
          this.skipNext = true;
        } else if (c === '`') {
          this.state = "templateint"; 
        }
        return Token.string;
        
      case "comment":
        if (this.commentEnding) {
          this.backToDefault();
        } else if (this.checkChars("*/")) {
          this.commentEnding = true;
        }
        return Token.comment;
        
      case "linecomment":
        if (c === '\n') {
          this.backToDefault();
        }
        return Token.comment;

      case "id":
        if (/[0-9a-zA-Z_\$]/.test(c)) { //TODO unicode
          return Token.id;
        }
        this.backToDefault();
        return this.process();
        
      case "keyword":
        if (--this.left === 0) {
          this.backToDefault();
        }
        return Token.keyword;
        
      case "constant":
        if (--this.left === 0) {
          this.backToDefault();
        }
        return Token.constant;

      case "global":
        if (--this.left === 0) {
          this.backToDefault();
        }
        return Token.global;
      
      case "dynamic":
        if (--this.left === 0) {
          this.backToDefault();
        }
        return Token.dynamic;
    }
    return Token.default;
  }
}

/*
Profiling code:

import JavaScriptMode from "lively.morphic/ide/modes/javascript.js";
const mode = new JavaScriptMode(),
     src = await System.resource("lively.morphic/menus.js").read();
mode.reset();
const start = Date.now();
mode.highlight(src);
const timeMS = Date.now() - start;
timeMS
*/
