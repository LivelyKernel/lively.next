import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class ChromeTheme extends Theme {
  background() { return Color.white; }

  style(token) {
    switch (token) {
    
      case "keyword":     return {fontColor: "#708"}
      case "atom":        return {fontColor: "#219"}
      case "number":      return {fontColor: "#164"}
      case "def":         return {fontColor: "#00f"}
      case "variable":
      case "punctuation":
      case "property":
      case "operator":    return {fontColor: Color.rgbHex("#333")}
      case "variable-2":  return {fontColor: "#05a"}
      case "variable-3":  return {fontColor: "#085"}
      case "comment":     return {fontColor: "#a50"}
      case "string":      return {fontColor: "#a11"}
      case "string-2":    return {fontColor: "#f50"}
      case "meta":        return {fontColor: "#555"}
      case "qualifier":   return {fontColor: "#555"}
      case "builtin":     return {fontColor: "#30a"}
      case "bracket":     return {fontColor: "#997"}
      case "tag":         return {fontColor: "#170"}
      case "attribute":   return {fontColor: "#00c"}
      case "hr":          return {fontColor: "#999"}
      case "link":        return {fontColor: "#00c"}

      case "boolean":
      case "constant": return {fontColor:"rgb(88, 92, 246)"};

      case "global":
      case "dynamic":  return {fontColor:"rgb(49, 132, 149)"};

      case "context":  return {fontColor:"rgb(191, 191, 191)"};

      case "symbol":
      case "regex":    return {fontColor: "#1a1aa6"};

      case "doctype":  return {fontColor: "#236e24"};

      case "error":    return {backgroundColor: "#ff4c4c"};

      case "diff-file-header":
        return {
          fontColor: Color.white, fontWeight: "bold",
          backgroundColor: Color.rgba(136,136,136, .7)
        };

      case "diff-hunk-header":
      case "coord":
        return {backgroundColor: Color.rgba(204,204,204, .4), fontWeight: "bold"};

      case "inserted":  return {backgroundColor: "rgba(108,255,108, .3)"};
      case "deleted":   return {backgroundColor: "rgba(255,108,108, .3)"};

      case "url":       return {textDecoration: "underline", fontColor: "#2c2cff"};
      case "important": return {fontStyle: "italic", fontColor: "orange"};
      case "bold":      return {fontWeight: "bold"};

      default: return {fontColor: "#333"};
    }
  }
}
