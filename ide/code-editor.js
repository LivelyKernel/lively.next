import { arr, obj } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";

import { morph, Morph, show } from "../index.js";
import { Text } from "../text/morph.js";
import { StyleRange } from "../text/style.js";

import { Token, Mode, Theme } from "./highlighting.js";

import JavaScriptMode from "./modes/javascript.js";
import PlainMode from "./modes/plain.js";
import ChromeTheme from "./themes/chrome.js";
import TomorrowNightTheme from "./themes/tomorrow-night.js";

const modes = {
  "plain": PlainMode,
  "javascript": JavaScriptMode
}; // {[string] -> Mode}

const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme
}; // {[string] -> Mode}

export default class CodeEditor extends Morph {
  constructor(props) {
    super({
      extent: props.extent || pt(400,300),
      submorphs: [morph({
         type: "text",
        extent: props.extent || pt(400,300),
         textString: props.textString || "",
         fixedWidth: true,
         fixedHeight: true,
         clipMode: "auto",
         padding: Rectangle.inset(4, 2, 4, 2),
         fontFamily: "Monaco, monospace"
      })],
      ...obj.dissoc(props, ["textString", "mode", "theme"])
    });
    this.mode = props.mode instanceof Mode ? props.mode : new (modes[props.mode || "plain"]);
    this.theme = props.theme instanceof Theme ? props.theme : new (themes[props.theme || "chrome"]);
    this.highlight();
  }
  
  highlight() {
    const txt = this.submorphs[0],
          z = { row: 0, column: 0 },
          tokens = [{token: Token.default, from: z, to: z}],
          mode = this.mode;
          
    function process(str, row, column) {
      const lastToken = tokens[tokens.length - 1];
      lastToken.to = {row, column};
      if (str.length === 0) return;
      const token = mode.process(str);
      if (token !== lastToken.token) {
        tokens.push({token, from: {row, column}, to: {row, column}});
      }
      return str[0] == "\n" ? process(str.substr(1), row + 1, 0)
                            : process(str.substr(1), row, column + 1);
    }
    mode.reset();
    process(txt.textString, 0, 0);
    // TODO reset style
    // add style
    tokens.forEach(({token, from, to}) => {
      const style = this.theme.style(token),
            sr = StyleRange.fromPositions(style, from, to);
      console.log(`${token} ${JSON.stringify(from)} ${JSON.stringify(to)}`);
      txt.addStyleRange(sr);
    });
  }

  resizeBy(delta) {
    super.resizeBy(delta);
    this.submorphs[0].resizeBy(delta);
  }

}
