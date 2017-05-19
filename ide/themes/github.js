import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class GithubTheme extends Theme {

  background() { return Color.white; }

  style(token) {
    switch (token) {
      case "comment": return {fontStyle: "italic", fontColor: "#999988"}
      case "string": return {fontColor: "#334499"}
      case "variable-2": return {fontColor: "#121289"}
      
      case "keyword":  return { fontColor: "#a71d5d" };

      case "boolean":
      case "constant": return { fontColor: "rgb(88, 92, 246)" };
      case "global":   return { fontColor: '#795da3' };

      case "dynamic":  return { fontColor: "rgb(237,106,67)" };
      case "property":     return { fontColor: "#795da3" };
      case "context":  return { fontColor: "#bfbfbf" };

      case "number":
      case "numeric":  return { fontColor: "#0086b3" };
      case "symbol":
      case "regex":    return { fontColor: "#009926" };
      case "operator":  return { fontColor: "#0066a3" };

      case "doctype":
      case "comment":  return { fontColor: "#969896" };

      case "error":    return { backgroundColor: "#ff4c4c" };

      case "coord":    return { backgroundColor: "#cccccc" };
      case "inserted":    return { backgroundColor: "#6cff6c" };
      case "deleted":    return { backgroundColor: "#ff6c6c" };

      case "url":    return { textDecoration: "underline", fontColor: "#2c2cff" };
      case "important":    return { fontStyle: "italic", fontColor: Color.orange };
      case "bold":    return { fontWeight: "bold" };

      case "atom":
      default:             return { fontColor: "#333" };
    }
  }
}
