import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class ChromeTheme extends Theme {
  background() { return Color.white; }

  style(token) {
    switch (token) {
      // case Token.id:     return { fontColor: Color.rgbHex("#795da3") };
      // case Token.function:     return { fontColor: Color.rgbHex("#795da3") };
      // case Token.namespace:     return { fontColor: Color.rgbHex("#795da3") };
      // case Token.selector:     return { fontColor: Color.rgbHex("#795da3") };
      // case Token.variable:     return { fontColor: Color.rgbHex("#795da3") };

      case Token.keyword:  return { fontColor: Color.rgb(147, 15, 128) };

      case Token.boolean:
      case Token.constant: return { fontColor: Color.rgb(88, 92, 246) };

      case Token.global:
      case Token.property:
      case Token.dynamic:  return { fontColor: Color.rgb(49, 132, 149) };

      case Token.context:  return { fontColor: Color.rgb(191, 191, 191) };

      case Token.number:
      case Token.numeric:  return { fontColor: Color.rgb(0, 0, 205) };

      case Token.symbol:
      case Token.string:   return { fontColor: Color.rgbHex("#1a1aa6") };
      case Token.regex:    return { fontColor: Color.rgbHex("#1a1aa6") };
      case Token.operator:  return { fontColor: Color.rgbHex("#0066a3") };

      case Token.doctype:
      case Token.comment:  return { fontColor: Color.rgbHex("#236e24") };

      case Token.error:    return { backgroundColor: Color.rgbHex("#ff4c4c") };

      case Token["diff-file-header"]: return { fontColor: Color.white, fontWeight: "bold", backgroundColor: Color.rgba(136,136,136, .7) };
      case Token["diff-hunk-header"]:
      case Token.coord:    return { backgroundColor: Color.rgba(204,204,204, .4), fontWeight: "bold" };

      case Token.inserted:    return { backgroundColor: Color.rgba(108,255,108, .3) };
      case Token.deleted:    return { backgroundColor: Color.rgba(255,108,108, .3) };

      case Token.url:    return { textDecoration: "underline", fontColor: Color.rgbHex("#2c2cff") };
      case Token.important:    return { fontStyle: "italic", fontColor: Color.orange };
      case Token.bold:    return { fontWeight: "bold" };

      default:             return { fontColor: Color.rgbHex("#333") };
    }
  }
}
