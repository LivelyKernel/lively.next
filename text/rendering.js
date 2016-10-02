import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";
import { pt } from "lively.graphics";

export var defaultRenderer = {

  renderMorph(renderer, morph) {
    return renderMorph(renderer, morph);
  }

}

export function renderMorph(renderer, morph) {
  var textLayout = morph.textLayout;

  textLayout.updateFromMorphIfNecessary(morph);

  var cursorWidth = morph.fontSize <= 11 ? 2 : 3,
      selectionLayer = [];
  if (morph.inMultiSelectMode()) {
    var sels = morph.selection.selections, i = 0;
    for (; i < sels.length-1; i++)
      selectionLayer.push(...renderSelectionLayer(textLayout, morph, sels[i], true/*diminished*/, 2))
    selectionLayer.push(...renderSelectionLayer(textLayout, morph, sels[i], false/*diminished*/, 4))
  } else selectionLayer = renderSelectionLayer(textLayout, morph, morph.selection, false, cursorWidth);
  

  return h("div", {
      ...defaultAttributes(morph, renderer),
      style: {
        ...defaultStyle(morph),
        cursor: morph.nativeCursor === "auto" ?
          (morph.readOnly ? "default" : "text") :
          morph.nativeCursor
      }
    }, 
    selectionLayer
      .concat(morph.debug ? renderDebugLayer(textLayout, morph) : [])
      .concat(renderMarkerLayer(textLayout, morph))
      .concat(renderTextLayer(textLayout, morph))
      .concat(renderer.renderSubmorphs(morph)));
}

function renderSelectionLayer(textLayouter, morph, selection, diminished = false, cursorWidth = 2) {
  // FIXME just hacked together... needs cleanup!!!

  if (!selection) return [];

  var {start, end, lead, cursorVisible} = selection,
      start               = textLayouter.docToScreenPos(morph, start),
      end                 = textLayouter.docToScreenPos(morph, end),
      isReverse           = selection.isReverse(),
      {padding, document} = morph,
      lines               = textLayouter.wrappedLines(morph),
      paddingOffset       = padding.topLeft(),
      startPos            = textLayouter.pixelPositionForScreenPos(morph, start).addPt(paddingOffset),
      endPos              = textLayouter.pixelPositionForScreenPos(morph, end).addPt(paddingOffset),
      cursorPos           = isReverse ? startPos : endPos,
      defaultHeight       = null,
      endLineHeight       = end.row in lines ?
                              lines[end.row].height :
                              (defaultHeight = textLayouter.defaultCharSize(morph).height),
      leadLineHeight      = lead.row in lines ?
                              lines[lead.row].height :
                              defaultHeight || (defaultHeight = textLayouter.defaultCharSize(morph).height);

  // collapsed selection -> cursor
  if (selection.isEmpty())
    return [cursor(cursorPos, leadLineHeight, cursorVisible, diminished, cursorWidth)];

  // single line -> one rectangle
  if (start.row === end.row)
    return [
      selectionLayerPart(startPos, endPos.addXY(0, endLineHeight)),
      cursor(cursorPos, leadLineHeight, cursorVisible, diminished, cursorWidth)]

  let endPosLine1 = pt(morph.width, startPos.y + lines[start.row].height),
      startPosLine2 = pt(0, endPosLine1.y);

  // two lines -> two rectangles
  if (start.row+1 === end.row) {
    return [
      selectionLayerPart(startPos, endPosLine1),
      selectionLayerPart(startPosLine2, endPos.addXY(0, endLineHeight)),
      cursor(cursorPos, leadLineHeight, cursorVisible, diminished, cursorWidth)];
  }

  let endPosMiddle = pt(morph.width, endPos.y),
      startPosLast = pt(0, endPos.y);

  // 3+ lines -> three rectangles
  return [
    selectionLayerPart(startPos, endPosLine1),
    selectionLayerPart(startPosLine2, endPosMiddle),
    selectionLayerPart(startPosLast, endPos.addXY(0, endLineHeight)),
    cursor(cursorPos, leadLineHeight, cursorVisible, diminished, cursorWidth)];

}

function renderMarkerLayer(textLayouter, morph) {
  let markers = morph._markers, parts = [];
  if (!markers) return parts;

  for (let m of markers) {
    let {style, range: {start, end}} = m;

    // single line
    if (start.row === end.row) {
      parts.push(renderMarkerPart(textLayouter, morph, start, end, style));
      continue;
    }

    // multiple lines
    // first line
    parts.push(renderMarkerPart(textLayouter, morph, start, morph.lineRange(start.row).end, style));
    // lines in the middle
    for (var row = start.row+1; row <= end.row-1; row++) {
      let {start: lineStart, end: lineEnd} = morph.lineRange(row);
      parts.push(renderMarkerPart(textLayouter, morph, lineStart, lineEnd, style));
    }
    // last line
    parts.push(renderMarkerPart(textLayouter, morph, {row: end.row, column: 0}, end, style));
  }

  return parts;
}

function renderTextLayer(textLayouter, morph) {
  let lines = textLayouter.wrappedLines(morph),
      textWidth = 0, textHeight = 0,
      {padding, scroll, height} = morph,
      {y: visibleTop} = scroll.subPt(padding.topLeft()),
      visibleBottom = visibleTop + height,
      lastVisibleLineBottom = 0,
      row = 0,
      spacerBefore,
      renderedLines = [],
      spacerAfter,
      lineLeft = padding.left(),
      lineTop = padding.top();

  for (;row < lines.length; row++) {
    let {width, height} = lines[row],
        newTextHeight = textHeight + height;
    if (newTextHeight >= visibleTop) break;
    textWidth = Math.max(width, textWidth);
    textHeight += height;
  }

  textLayouter.firstVisibleLine = row;
  spacerBefore = h("div", {style: {height: textHeight+"px", width: textWidth+"px"}});

  for (;row < lines.length; row++) {
    let {width, height} = lines[row],
        newTextHeight = textHeight + height;

    renderedLines.push(renderLine(lines[row], lineLeft, lineTop));

    textWidth = Math.max(width, textWidth);
    lineTop += height;
    textHeight += height;

    if (textHeight >= visibleBottom) break;
  }

  textLayouter.lastVisibleLine = row;
  lastVisibleLineBottom = textHeight;

  for (;row < lines.length; row++) {
    let {width, height} = lines[row];
    textWidth = Math.max(width, textWidth);
    textHeight += height;
  }

  spacerAfter = h("div", {style: {height: textHeight-lastVisibleLineBottom+"px", width: textWidth+"px"}});

  return h('div.text-layer', {
    style: {
      pointerEvents: "none", whiteSpace: "pre",
      width: textWidth+"px", height: textHeight+"px",
      padding: `${padding.top()}px ${padding.right()}px ${padding.bottom()}px ${padding.left()}px`
    }
  }, [spacerBefore].concat(renderedLines).concat(spacerAfter));
}

function renderDebugLayer(textLayouter, morph) {
  let lines = textLayouter.wrappedLines(morph),
      {y: visibleTop} = morph.scroll,
      visibleBottom = visibleTop + morph.height,
      {padding} = morph,
      debugHighlights = [],
      paddingLeft = padding.left(),
      paddingTop = padding.top(),
      textHeight = 0,
      textWidth = 0;

  for (let row = 0; row < lines.length; row++) {
    let {width, height, charBounds} = lines[row];
    for (let col = 0; col < charBounds.length; col++) {
      let {x, width, height} = charBounds[col],
              y = textHeight + paddingTop;
      x += paddingLeft;
      debugHighlights.push(h("div", {
        style: {
          position: "absolute",
          left: x+"px",
          top: y+"px",
          width: width+"px",
          height: height+"px",
          outline: "1px solid orange",
          pointerEvents: "none",
          zIndex: -2
        }
      }))
    }

    textHeight += height;
    textWidth = Math.max(textWidth, width);
    if (textHeight < visibleTop || textHeight > visibleBottom) continue;
  }

  debugHighlights.push(h("div", {
    style: {
      position: "absolute",
      left: padding.left()+"px",
      top: padding.top()+"px",
      width: textWidth+"px",
      height: textHeight+"px",
      outline: "1px solid red",
      pointerEvents: "none",
      zIndex: -2
    }
  }));

  return debugHighlights
}


function selectionLayerPart(startPos, endPos) {
  return h('div.selection-layer-part', {
    style: {
      pointerEvents: "none", position: "absolute",
      left: startPos.x + "px", top: startPos.y + "px",
      width: (endPos.x-startPos.x) + "px", height: (endPos.y-startPos.y)+"px",
      backgroundColor: "#bed8f7", zIndex: -3
    }
  })
}

function cursor(pos, height, visible, diminished, width) {
    return h('div.selection-layer-part', {
    style: {
      pointerEvents: "none", position: "absolute",
      left: pos.x-Math.ceil(width/2) + "px", top: pos.y + "px",
      width: width + "px", height: height + "px",
      backgroundColor: diminished ? "gray" : "black",
      zIndex: 1,
      display: visible ? "" : "none"
    }
  })
}

function renderMarkerPart(textLayouter, morph, start, end, style) {
  var padding = morph.padding,
      {x,y} = textLayouter.boundsFor(morph, start),
      {height, x: endX} = textLayouter.boundsFor(morph, end);
  return h("div.marker-layer-part", {
    style: {
      zIndex: -4,
      ...style,
      position: "absolute",
      left: padding.left()+x + "px", top: padding.top()+y + "px",
      height: height + "px",
      width: endX-x + "px"
    }
  });
}

function renderLine(textLayoutLine, lineLeft, lineTop) {
  if (textLayoutLine.rendered) return textLayoutLine.rendered;
  let { chunks, height, width } = textLayoutLine;
  height += "px";
  return textLayoutLine.rendered = h("div",
    {style: {height, lineHeight: height}},
   chunks.map(ea => renderChunk(ea)));
}

function renderChunk(textChunk) {
  if (textChunk.rendered) return textChunk.rendered;
  var {style, text, width, height} = textChunk,
      {fontSize, fontFamily, fontColor, backgroundColor,
       fontWeight, fontStyle, textDecoration,
       fixedCharacterSpacing} = style,
      textNodes = text ?
        (fixedCharacterSpacing ? text.split("").map(c => h("span", c)) : text) : h("br");
  backgroundColor = backgroundColor || "",
  fontColor = fontColor || "";

  return textChunk.rendered = h("span", {
    style: {
      fontSize: fontSize + "px",
      fontFamily,
      fontWeight,
      fontStyle,
      textDecoration,
      color: String(fontColor),
      backgroundColor: String(backgroundColor)
    }
  }, textNodes);
}
