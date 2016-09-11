import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class ChromeTheme extends Theme {
  background() { // -> Color
    return Color.white;
  }
  style(token) { // Token -> Style
    switch (token) {
      case Token.keyword: return { fontColor: Color.rgb(147, 15, 128), fontWeight: "bold" };
      case Token.constant: return { fontColor: Color.rgb(88, 92, 246), fontWeight: "bold" };
      case Token.global: return { fontColor: Color.rgb(49, 132, 149), fontWeight: "bold" };
      //case Token.id: return { fontColor: Color.rgb(49, 132, 149), fontWeight: "bold" };
      case Token.numeric: return { fontColor: Color.rgb(0, 0, 205), fontWeight: "bold" };
      case Token.string: return { fontColor: Color.rgbHex("#1a1aa6"), fontWeight: "bold" };
      case Token.comment: return { fontColor: Color.rgbHex("#236e24"), fontWeight: "bold" };
      default: return { fontColor: Color.rgbHex("#333"), fontWeight: "bold" };
    }
  }
}
