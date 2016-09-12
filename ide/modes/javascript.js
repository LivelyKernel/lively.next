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
  checkWord(type, str) {
    const found = words[type].find(w => str.startsWith(w));
    if (found) {
      this.state = type;
      this.left = found.length - 1;
      return true;
    }
    return false;
  }
  process(str) { // string -> Token
    switch (this.state) {
      case "templateint": // template interpolation
        if (str[0] == "}" && this.level == 1) {
          this.state = "template";
          return Token.default;
        }
        if (str[0] == "`") {
          this.state = "template2";
          return Token.string;
        }
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
        if (str[0] == "{") {
          this.level++;
        }
        if (str[0] == "}") {
          this.level--;
        }
        if (str.startsWith("/*")) {
          this.state = "comment";
          return Token.comment;
        }
        if (str.startsWith("//")) {
          this.state = "linecomment";
          return Token.comment;
        }
        if (this.checkWord("keyword", str)) {
          return Token.keyword;
        }
        if (this.checkWord("constant", str)) {
          return Token.constant;
        }
        if (this.checkWord("global", str)) {
          return Token.global;
        }
        if (this.checkWord("dynamic", str)) {
          return Token.dynamic;
        }
        if (/[0-9a-zA-Z_\$]/.test(str[0])) { //TODO unicode
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

      case "template":
        if (this.skipNext) {
          this.skipNext = false;
        } else if (str[0] == "\\") {
          this.skipNext = true;
        } else if (str[0] == '`') {
          this.state = "default"; 
        } else if (str.startsWith("${")) {
          this.level = 0;
          this.state = "templateint";
          return Token.default;
        }
        return Token.string;
        
      case "template2": // template-within-a-template
        if (this.skipNext) {
          this.skipNext = false;
        } else if (str[0] == "\\") {
          this.skipNext = true;
        } else if (str[0] == '`') {
          this.state = "templateint"; 
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
        if (/[0-9a-zA-Z_\$]/.test(str[0])) { //TODO unicode
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
        
      case "constant":
        if (--this.left === 0) {
          this.state = "default";
          return Token.constant;
        }
        return Token.constant;

      case "global":
        if (--this.left === 0) {
          this.state = "default";
          return Token.global;
        }
        return Token.global;
      
      case "dynamic":
        if (--this.left === 0) {
          this.state = "default";
          return Token.dynamic;
        }
        return Token.dynamic;
    }
    return Token.default;
  }
}
