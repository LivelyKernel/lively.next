import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class ChromeTheme extends Theme {
  background() { // -> Color
    return Color.white;
  }
  style(token) { // Token -> Style
    switch (token) {
      case Token.keyword:  return { fontColor: Color.rgb(147, 15, 128) };
      case Token.constant: return { fontColor: Color.rgb(88, 92, 246) };
      case Token.global:
      case Token.dynamic:  return { fontColor: Color.rgb(49, 132, 149) };
      //case Token.id:     return { fontColor: Color.rgb(49, 132, 149) };
      case Token.numeric:  return { fontColor: Color.rgb(0, 0, 205) };
      case Token.string:   return { fontColor: Color.rgbHex("#1a1aa6") };
      case Token.comment:  return { fontColor: Color.rgbHex("#236e24") };
      case Token.regex:    return { fontColor: Color.rgbHex("#1a1aa6") };
      case Token.error:    return { backgroundColor: Color.rgbHex("#ff4c4c") };
      default:             return { fontColor: Color.rgbHex("#333") };
    }
  }
}
