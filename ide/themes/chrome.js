import { Color } from "lively.graphics";

import { Token, Theme } from "../highlighting.js";

export default class ChromeTheme extends Theme {
  background() { // -> Color
    return Color.white;
  }
  style(token) { // Token -> Style
    switch (token) {
      case Token.numeric: return { fontColor: "#cc0000" };
      default: return { fontColor: "#000000" };
    }
  }
}
