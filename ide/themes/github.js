import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class GithubTheme extends Theme {

  background() { return Color.white; }

  style(token) {

    switch (token) {
      // case Token.id:     return { fontColor: Color.rgbHex("#795da3") };
      // case Token.function:     return { fontColor: Color.rgbHex("#795da3") };
      // case Token.namespace:     return { fontColor: Color.rgbHex("#795da3") };
      // case Token.selector:     return { fontColor: Color.rgbHex("#795da3") };
      // case Token.variable:     return { fontColor: Color.rgbHex("#795da3") };

      case Token.keyword:  return { fontColor: Color.rgbHex("#a71d5d") };

      case Token.boolean:
      case Token.constant: return { fontColor: Color.rgb(88, 92, 246) };
      case Token.global:   return { fontColor: Color.rgbHex('#795da3') };

      case Token.dynamic:  return { fontColor: Color.rgb(237,106,67) };
      case Token.property:     return { fontColor: Color.rgbHex("#795da3") };
      case Token.context:  return { fontColor: Color.rgbHex("#bfbfbf") };

      case Token.number:
      case Token.numeric:  return { fontColor: Color.rgbHex("#0086b3") };
      case Token.symbol:
      case Token.string:   return { fontColor: Color.rgbHex("#183691") };
      case Token.regex:    return { fontColor: Color.rgbHex("#009926") };
      case Token.operator:  return { fontColor: Color.rgbHex("#0066a3") };

      case Token.doctype:
      case Token.comment:  return { fontColor: Color.rgbHex("#969896") };

      case Token.error:    return { backgroundColor: Color.rgbHex("#ff4c4c") };

      case Token.inserted:    return { backgroundColor: Color.rgbHex("#6cff6c") };
      case Token.deleted:    return { backgroundColor: Color.rgbHex("#ff6c6c") };

      case Token.url:    return { textDecoration: "underline", fontColor: Color.rgbHex("#2c2cff") };
      case Token.important:    return { fontStyle: "italic", fontColor: Color.orange };
      case Token.bold:    return { fontWeight: "bold" };

      default:             return { fontColor: Color.rgbHex("#333") };
    }
  }
}
