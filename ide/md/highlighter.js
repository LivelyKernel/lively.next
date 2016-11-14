import { TextStyleAttribute } from "../../text/attribute.js";

export default class MarkdownStyler {

  style(morph, parsedMd) {

    if (!parsedMd) return;

    morph.defaultTextStyle = {
      fontColor: "#222",
      fontFamily: "Arial, sans-serif"
    }

    var defaultStyle = morph.defaultTextStyle;


    var state = {listDepth: 0},
        styles = [],
        pos = 0,
        remainingText = morph.textString;

    for (let token of parsedMd) {

      // var tokensToHighlight = [token];

      if (['list_start', 'list_end', 'list_item_end', 'list_item_start'].includes(token.type)) {
        if ('list_start' === token.type) state.listDepth++;
        if ('list_end' === token.type) state.listDepth--;
        continue;
      }

      if (!token.text) {
        console.warn("not handled md tokane", token)
        continue;
      }

      var startIndex = remainingText.indexOf(token.text),
          endIndex = startIndex + token.text.length;

      if (token.type === "heading") {
        startIndex = remainingText.indexOf("#");
        var after = remainingText.slice(endIndex);
        after = after.slice(0, after.indexOf("\n"));
        var endIndex2 = after.lastIndexOf("#");
        if (endIndex2 > -1) endIndex = endIndex + endIndex2 + 1;
      }
      
            
      // if (token.type === "paragraph") {
      //   var text = token.text, index = 0;
      //   var additionalTokens = [];
      //   while (text.includes("`")) {
      //     var tickIndex = text.indexOf("`");
      //     var inlineCode = this.parseInlinedCode(text.slice(tickIndex));
      //     
      //     if (ths.parseInlinedCode)
      //     var pre = text.slice(0, tickIndex);
      //     
      //   }
      // 
      //   if (additionalTokens.length)
      //     tokensToHighlight = additionalTokens;
      // }

      // console.log(startIndex, endIndex, remainingText.slice(startIndex, endIndex))

      styles.push(TextStyleAttribute.fromPositions(
        this.styleFor(token, defaultStyle),
        morph.indexToPosition(pos+startIndex),
        morph.indexToPosition(pos+endIndex)));
      pos += endIndex;
      remainingText = remainingText.slice(endIndex);
    }


    morph.setSortedTextAttributes([morph.defaultTextStyleAttribute].concat(styles))
  }

  parseInlinedCode(text) {
    if (!text[0] !== "`") return null;
    var end = 0;
    for (var i = 0; i < text.length; i++)
      if (text[i] === "\\") { i++; continue; }
      else if (text[i] === "`") return text.slice(0, i);
  }
  
  styleFor(token, {fontSize}) {
    var style = {};
    switch (token.type) {
      case 'code': style = {fontFamily: "monospace", fontColor: "#444"}; break
      case 'heading':
        switch (token.depth) {
          case 1: fontSize += 10; break;
          case 2: fontSize += 6; break;
          case 3: fontSize += 4; break;
          case 4: fontSize += 2; break;
        }
        style = {fontColor: "#2222CC", fontSize}
        break;

      case 'html': style = {fontFamily: "monospace", fontColor: "#888"}; break;
      case 'table':
      case 'hr':
      case 'blockquote_start':
      case 'blockquote_end':
      case 'table':
      case 'paragraph':
      case 'text':
      case 'space':
    }

    return style;
  }
}
