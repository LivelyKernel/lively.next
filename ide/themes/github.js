import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class GithubTheme extends Theme {
  background() {
    return Color.white;
  }
  style(token) {
    switch (token) {
      case Token.keyword: return { fontColor: Color.rgbHex("#a71d5d"), fontWeight: "bold" };
      case Token.constant: return { fontColor: Color.rgb(88, 92, 246), fontWeight: "bold" };
      case Token.global: return { fontColor: Color.rgbHex('#795da3'), fontWeight: "bold" };
      //case Token.id: return { fontColor: Color.rgbHex("#795da3"), fontWeight: "bold" };
      case Token.dynamic: return { fontColor: Color.rgb(237,106,67), fontWeight: "bold" };
      case Token.numeric: return { fontColor: Color.rgbHex("#0086b3"), fontWeight: "bold" };
      case Token.string: return { fontColor: Color.rgbHex("#183691"), fontWeight: "bold" };
      case Token.comment: return { fontColor: Color.rgbHex("#969896"), fontWeight: "bold" };
      case Token.regex: return { fontColor: Color.rgbHex("#009926"), fontWeight: "bold" };
      case Token.error: return { backgroundColor: Color.rgbHex("#ff4c4c"), fontWeight: "bold" };
      default: return { fontColor: Color.rgbHex("#333"), fontWeight: "bold" };
    }
  }
}
