import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class GithubTheme extends Theme {
  background() {
    return Color.white;
  }
  style(token) {
    switch (token) {
      case Token.keyword:  return { fontColor: Color.rgbHex("#a71d5d") };
      case Token.constant: return { fontColor: Color.rgb(88, 92, 246) };
      case Token.global:   return { fontColor: Color.rgbHex('#795da3') };
      //case Token.id:     return { fontColor: Color.rgbHex("#795da3") };
      case Token.dynamic:  return { fontColor: Color.rgb(237,106,67) };
      case Token.numeric:  return { fontColor: Color.rgbHex("#0086b3") };
      case Token.string:   return { fontColor: Color.rgbHex("#183691") };
      case Token.comment:  return { fontColor: Color.rgbHex("#969896") };
      case Token.regex:    return { fontColor: Color.rgbHex("#009926") };
      case Token.context:  return { fontColor: Color.rgbHex("#bfbfbf") };
      case Token.error:    return { backgroundColor: Color.rgbHex("#ff4c4c") };
      default:             return { fontColor: Color.rgbHex("#333") };
    }
  }
}
