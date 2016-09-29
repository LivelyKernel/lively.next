import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class TomorrowNightTheme extends Theme {
  background() { // -> Color
    return Color.rgbHex("#0a0a0a");
  }
  style(token) { // Token -> Style
    switch (token) {
      case Token.keyword:  return { fontColor: Color.rgbHex("#c397d8") };
      case Token.constant: return { fontColor: Color.rgbHex("#e78c45") };
      case Token.global:   return { fontColor: Color.rgbHex("#7aa6da") };
      //case Token.id:     return { fontColor: Color.rgb(49, 132, 149) };
      case Token.dynamic:  return { fontColor: Color.rgbHex("#d54e53") };
      case Token.numeric:  return { fontColor: Color.rgbHex("#e78c45") };
      case Token.string:   return { fontColor: Color.rgbHex("#b9ca4a") };
      case Token.comment:  return { fontColor: Color.rgbHex("#969896") };
      case Token.regex:    return { fontColor: Color.rgbHex("#d54e53") };
      case Token.context:  return { fontColor: Color.rgbHex("#454545") };
      case Token.error:    return { backgroundColor: Color.rgbHex("#641d1d") };
      default:             return { fontColor: Color.rgbHex("#dedede") };
    }
  }
}
