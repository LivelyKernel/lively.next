import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class TomorrowNightTheme extends Theme {
  background() { // -> Color
    return Color.rgbHex("#1a1a1a");
  }
  style(token) { // Token -> Style
    switch (token) {
      case Token.keyword: return { fontColor: Color.rgbHex("#c397d8"), fontWeight: "bold" };
      case Token.constant: return { fontColor: Color.rgbHex("#e78c45"), fontWeight: "bold" };
      case Token.global: return { fontColor: Color.rgbHex("#7aa6da"), fontWeight: "bold" };
      //case Token.id: return { fontColor: Color.rgb(49, 132, 149), fontWeight: "bold" };
      case Token.dynamic: return { fontColor: Color.rgbHex("#d54e53"), fontWeight: "bold" };
      case Token.numeric: return { fontColor: Color.rgbHex("#e78c45"), fontWeight: "bold" };
      case Token.string: return { fontColor: Color.rgbHex("#b9ca4a"), fontWeight: "bold" };
      case Token.comment: return { fontColor: Color.rgbHex("#969896"), fontWeight: "bold" };
      case Token.regex: return { fontColor: Color.rgbHex("#d54e53"), fontWeight: "bold" };
      case Token.error: return { backgroundColor: Color.rgbHex("#641d1d"), fontWeight: "bold" };
      default: return { fontColor: Color.rgbHex("#dedede"), fontWeight: "bold" };
    }
  }
}
