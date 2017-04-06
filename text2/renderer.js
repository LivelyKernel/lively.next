import { fun, arr, obj } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";
import { h } from "../node_modules/virtual-dom/dist/virtual-dom.js";
import { defaultAttributes, defaultStyle } from "../rendering/morphic-default.js";
import { addOrChangeCSSDeclaration } from "../rendering/dom-helper.js";
import { inspect, show } from "lively.morphic";

let cssInstalled = false;

function installCSS(document) {
  cssInstalled = true;
  addOrChangeCSSDeclaration("new-text-css", `
    .newtext-scroller {
        overflow-anchor: none;˜ /*annoying chrome*/
        -moz-box-sizing: content-box;
        box-sizing: content-box;
        height: 100%;
        outline: none;
        position: relative;
    }

    .newtext-text-layer {
      z-index: 3;
    }

    .newtext-cursor {
      z-index: 5;
      pointer-events: none;
      position: absolute;
      background-color: black;
    }

    .newtext-cursor.diminished {
      background-color: gray;
    }

    .newtext-selection-layer {
      position: absolute;
      z-index: -1;
    }

    .newtext-text-layer {
      white-space: pre;
    }

    .newtext-text-layer.wrap-by-words {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }

    .newtext-text-layer.only-wrap-by-words {
      white-space: pre-wrap;
      overflow-wrap: break-all;
    }

    .newtext-text-layer.wrap-by-chars {
      white-space: pre-wrap;
      word-break: break-all;
    }

    .newtext-text-layer.no-wrapping {
    }

    .newtext-text-layer .line>span {
      -moz-border-radius: 0;
      -webkit-border-radius: 0;
      border-radius: 0;
      border-width: 0;
      background: transparent;
      font-family: inherit;
      font-size: inherit;
      margin: 0;
      word-wrap: normal;
      line-height: inherit;
      color: inherit;
      z-index: 2;
      position: relative;
      overflow: visible;
      -webkit-tap-highlight-color: transparent;
      -webkit-font-variant-ligatures: contextual;
      font-variant-ligatures: contextual;
    }
  `, document);
}

// installCSS();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function AfterTextRenderHook(morph, lines) {
  this.morph = morph;
  this.lines = lines;
}
AfterTextRenderHook.prototype.hook = function(node, propName, prevValue) {
  let {morph: {viewState}, lines} = this;

  viewState.dom_nodes = [];
  viewState.dom_nodeFirstRow = 0;

  if (!node || !node.parentNode) return;

  // let dirty = morph._dirty;
  // if (dirty)
  //   console.log(this.env.changeManager.changesFor(this).slice(-20));
  // let {scrollLeft, scrollTop} = node.parentNode;
  // this.setProperty("textScroll", pt(scrollLeft, scrollTop));
  // this._dirty = dirty;
  // let node = this.env.renderer.getNodeForMorph(this).querySelector(".newtext-text-layer");
  // let lineNode = node.childNodes[1];

  let lineNode = node.querySelector(".line");
  if (!lineNode) return;

  let row = Number(lineNode.dataset.row);
  if (typeof row !== "number" || isNaN(row)) return;
  viewState.dom_nodeFirstRow = row;

  try {
    while (lineNode) {
      viewState.dom_nodes.push(lineNode);
      let line = lines[row++];
      if (line && (line.height === 0 || line.hasEstimatedHeight)) {
        let {height} = lineNode.getBoundingClientRect();
        line.changeHeight(height, false, false);
      }
      lineNode = lineNode.nextSibling;
    }
  } catch (err) { console.error(err); }

  viewState._textLayoutStale = false;
}

export default class Renderer {

  constructor() {
    if (!cssInstalled) installCSS();
  }

  renderMorph(morph, renderer) {

    var cursorWidth = morph.fontSize <= 11 ? 2 : 3,
        selectionLayer = [];

    if (morph.inMultiSelectMode()) {
      let sels = morph.selection.selections, i = 0;
      for (; i < sels.length-1; i++)
        selectionLayer.push(...this.renderSelectionLayer(morph, sels[i], true/*diminished*/, 2))
      selectionLayer.push(...this.renderSelectionLayer(morph, sels[i], false/*diminished*/, 4))
    } else selectionLayer = this.renderSelectionLayer(morph, morph.selection, false, cursorWidth);


    return h("div", {
        ...defaultAttributes(morph, renderer),
        style: {
          ...defaultStyle(morph),
          cursor: morph.nativeCursor === "auto" ?
            (morph.readOnly ? "default" : "text") :
            morph.nativeCursor
        }
      },
      [renderer.renderSubmorphs(morph)]
        .concat(selectionLayer)
        .concat(this.renderTextLayer(morph, renderer))
        // .concat(morph.debug ? this.renderDebugLayer(textLayout, morph) : [])
        // .concat(this.renderMarkerLayer(textLayout, morph))
        // .concat(this.renderTextLayer(textLayout, morph))
    );
  }


  // renderTextLayer(textLayouter, morph) {
  //   let lines = textLayouter.wrappedLines(morph),
  //       textWidth = 0, textHeight = 0,
  //       {padding, scroll, height} = morph,
  //       {y: visibleTop} = scroll.subPt(padding.topLeft()),
  //       visibleBottom = visibleTop + height,
  //       lastVisibleLineBottom = 0,
  //       row = 0,
  //       spacerBefore,
  //       renderedLines = [],
  //       spacerAfter,
  //       lineLeft = padding.left(),
  //       lineTop = padding.top();
  //
  //   for (;row < lines.length; row++) {
  //     let {width, height} = lines[row],
  //         newTextHeight = textHeight + height;
  //     if (newTextHeight >= visibleTop) break;
  //     textWidth = Math.max(width, textWidth);
  //     textHeight += height;
  //   }
  //
  //   textLayouter.firstVisibleLine = row;
  //   spacerBefore = h("div", {style: {height: textHeight+"px", width: textWidth+"px"}});
  //
  //   for (;row < lines.length; row++) {
  //     let {width, height} = lines[row],
  //         newTextHeight = textHeight + height;
  //
  //     renderedLines.push(this.renderLine(lines[row], lineLeft, lineTop));
  //
  //     textWidth = Math.max(width, textWidth);
  //     lineTop += height;
  //     textHeight += height;
  //
  //     if (textHeight >= visibleBottom) break;
  //   }
  //
  //   textLayouter.lastVisibleLine = row;
  //   lastVisibleLineBottom = textHeight;
  //
  //   for (;row < lines.length; row++) {
  //     let {width, height} = lines[row];
  //     textWidth = Math.max(width, textWidth);
  //     textHeight += height;
  //   }
  //
  //   spacerAfter = h("div", {style: {height: textHeight-lastVisibleLineBottom+"px", width: textWidth+"px"}});
  //
  //   return h('div.text-layer', {
  //     style: {
  //       whiteSpace: "pre",
  //       width: "100%",
  //       zIndex: 3, position: "absolute",
  //       // width: textWidth+"px",
  //       height: textHeight+"px",
  //       padding: `${padding.top()}px ${padding.right()}px ${padding.bottom()}px ${padding.left()}px`
  //     }
  //   }, [spacerBefore].concat(renderedLines).concat(spacerAfter));
  // }


  renderTextLayer(morph) {
    // this.estimateLineHeights(this.lineData.lines)

    let {
          height: scrollHeight,
          scroll: {x: scrollLeft, y: scrollTop},
          document: doc,
        } = morph,
        lines = doc.lines;

    if (morph.viewState._textLayoutStale) {
      morph.textLayout.estimateLineHeights(morph, true/*force*/);
      morph.viewState._textLayoutStale = false;
    }

    let scrollBottom = scrollTop + scrollHeight,
        textHeight = 0,
        y = 0,
        row = 0,
        firstVisibleRow = 0,
        lastVisibleRow = lines.length,
        heightBefore = 0;

    for (; row < lines.length; row++) {
      let lineHeight = lines[row].height;
      if (y + lineHeight > scrollTop) { firstVisibleRow = row; break; }
      y += lineHeight;
    }
    heightBefore = y;
    for (; row < lines.length; row++) {
      if (y > scrollBottom) { lastVisibleRow = row; break; }
      y += lines[row].height;
    }

    for (; row < lines.length; row++) {
      y += lines[row].height;
    }

    textHeight = y;

    Object.assign(morph.viewState, {
      scrollTop, scrollHeight, scrollBottom, textHeight,
      firstVisibleRow, lastVisibleRow, heightBefore
    });

    // firstVisibleRow = Math.max(0, firstVisibleRow-3);
    // lastVisibleRow = Math.min(lines.length-1, lastVisibleRow+3);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    let {padding, clipMode} = morph,
        leftP = padding.left(),
        rightP = padding.right(),
        topP = padding.top(),
        bottomP = padding.bottom(),
        textLayerClasses = "";

    switch (morph.lineWrapping) {
      case true:
      case "by-words":      textLayerClasses = textLayerClasses + ".wrap-by-words"; break;
      case "only-by-words": textLayerClasses = textLayerClasses + ".only-wrap-by-words"; break;
      case "by-chars":      textLayerClasses = textLayerClasses + ".wrap-by-chars"; break;
      case false:           textLayerClasses = textLayerClasses + ".no-wrapping"; break;
    }

    let textAttrs = {
      style: {
        height: Math.max(textHeight, morph.height) + "px",
        fontFamily: morph.fontFamily,
        fontSize: morph.fontSize + "px",
        textAlign: morph.textAlign,
        color: morph.fontColor,
        paddingLeft: leftP + "px",
        paddingRight: rightP + "px",
        paddingTop: topP + "px",
        paddingBottom: bottomP + "px"
      }
    };

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // to update text layout from real DOM:
    textAttrs["after-text-render-hook"] = new AfterTextRenderHook(morph, lines);

    let visibleLines = lines.slice(firstVisibleRow, lastVisibleRow),
        renderedLines = visibleLines.map((ea, i) => this.renderLine(morph, ea, i));

    // spacer to push visible lines into the scrolled area
    renderedLines.unshift(
      h("div.newtext-before-filler", {
        style: {
          width: "20px", backgroundColor: "red",
          height: heightBefore + "px"
        }
      }));

    let scrollerAttrs = {
      scrollLeft, scrollTop,
      style: {overflow: clipMode || ""},
      onscroll: evt => {
        let {scrollLeft, scrollTop} = evt.target;
        morph.textScroll = pt(scrollLeft, scrollTop);
        morph.makeDirty()
      }
    }

    return h("div.newtext-scroller",
             scrollerAttrs,
             h("div.newtext-text-layer" + textLayerClasses,
               textAttrs, [
               ...this.renderDebugLayer(morph, visibleLines, scrollTop),
               ...renderedLines
             ]));
  }

  renderDebugLayer(morph, visibleLines, startY) {
return [];
    let debugHighlights = [],
        textWidth = 0,
        rowY = startY;

    let padding = morph.padding || Rectangle.inset(0),
        leftP = padding.left(),
        rightP = padding.right(),
        topP = padding.top(),
        bottomP = padding.bottom();

    for (let row = 0; row < visibleLines.length; row++) {
      let {height, charBounds} = visibleLines[row];

      debugHighlights.push(h("div.debug-line", {
        style: {
          position: "absolute",
          left: leftP + "px",
          top: (topP + rowY) + "px",
          width: (morph.width-rightP)+"px",
          height: height+"px",
          outline: "1px solid red",
          pointerEvents: "none",
          zIndex: 4,
          textAlign: "right",
          fontFamily: "monospace",
          color: "red",
          fontSize: "small",
          verticalAlign: "baseline"
        }
      }, h("span", String(visibleLines[row].row))));

      if (!charBounds) {
        rowY += height;
        continue;
      }

      for (let col = 0; col < charBounds.length; col++) {
        let {x, y, width, height} = charBounds[col];
        debugHighlights.push(h("div.debug-char", {
          style: {
            position: "absolute",
            left: x+"px",
            top: y+"px",
            width: width+"px",
            height: height+"px",
            outline: "1px solid orange",
            pointerEvents: "none",
            zIndex: 3
          }
        }))
      }

      rowY += height;
      // currentLineHeight += height;
    }

    // debugHighlights.push(h("div", {
    //   style: {
    //     position: "absolute",
    //     left: padding.left()+"px",
    //     top: padding.top()+"px",
    //     width: textWidth+"px",
    //     height: textHeight+"px",
    //     outline: "1px solid red",
    //     pointerEvents: "none",
    //     zIndex: 3
    //   }
    // }));

    return debugHighlights
  }

  renderLine(morph, line, i) {
    // if (line._rendered)
    //   return line._rendered;

    let { textAndAttributes } = line,
        renderedChunks = [],
        nAttrs = textAndAttributes.length;
    if (nAttrs > 0) {
      for (let i = 0; i < nAttrs; i = i+2) {
        let text = textAndAttributes[i], attr = textAndAttributes[i+1];
        renderedChunks.push(this.renderChunk(morph, line, text, attr));
      }
    } else renderedChunks.push(h("br"));

    return line._rendered = h("div.line", {dataset: {row: line.row}}, renderedChunks);
  }

  renderChunk(morph, line, text, attr) {
    // FIXME!
    if (text.length > 1000) text = text.slice(0,1000);

    // FIXME**2!!
    // text = text.replace(/\t/g, " ");

    if (!attr) return text || h("br");

    let tagname = attr.link ? "a" : "span",
        style = {}, attrs = {style};

    if (attr.link) {
      attrs.href = attr.link;
      attrs.target = "_blank";
    }

    if (attr.fontSize) style.fontSize               = attr.fontSize + "px";
    if (attr.fontFamily) style.fontFamily           = attr.fontFamily;
    if (attr.fontWeight) style.fontWeight           = attr.fontWeight;
    if (attr.fontStyle) style.fontStyle             = attr.fontStyle;
    if (attr.textDecoration) style.textDecoration   = attr.textDecoration;
    if (attr.fontColor) style.color                 = attr.fontColor ? String(attr.fontColor) : "";
    if (attr.backgroundColor) style.backgroundColor = attr.backgroundColor ? String(attr.backgroundColor) : "";
    if (attr.nativeCursor) attrs.style.cursor       = attr.nativeCursor;

    if (attr.textStyleClasses && attr.textStyleClasses.length)
      attrs.className = attr.textStyleClasses.join(" ");

    return h(tagname, attrs, text);
  }

  renderSelectionLayer(morph, selection, diminished = false, cursorWidth = 2) {
    // FIXME just hacked together... needs cleanup!!!

    if (!selection) return [];

    let {textLayout} = morph;

    var {start, end, lead, cursorVisible, selectionColor} = selection,
        isReverse           = selection.isReverse(),
        {document}          = morph,
        startBounds         = textLayout.boundsFor(morph, start),
        endBounds           = textLayout.boundsFor(morph, end),
        startPos            = pt(startBounds.x, startBounds.y),
        endPos              = pt(endBounds.x, endBounds.y),
        leadLineHeight      = startBounds.height,
        endLineHeight       = endBounds.height,
        cursorPos           = isReverse ? startPos : endPos,
        cursorHeight        = isReverse ? leadLineHeight : endLineHeight,
        lines               = morph.document.lines;

    // collapsed selection -> cursor
    if (selection.isEmpty())
      return [this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth)];

    // single line -> one rectangle
    if (Math.abs(startPos.y - endPos.y) <= 3)
      return [
        this.selectionLayerPart(startPos, endPos.addXY(0, endLineHeight), selectionColor),
        this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth)]

    let endPosLine1 = pt(morph.width, startPos.y + leadLineHeight),
        startPosLine2 = pt(0, endPosLine1.y);

    // two lines -> two rectangles
    if (Math.abs(endBounds.y+endBounds.height - startBounds.y) / leadLineHeight <= 2) {
      return [
        this.selectionLayerPart(startPos, endPosLine1, selectionColor),
        this.selectionLayerPart(startPosLine2, endPos.addXY(0, endLineHeight), selectionColor),
        this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth)];
    }

    let endPosMiddle = pt(morph.width, endPos.y),
        startPosLast = pt(0, endPos.y);

    // 3+ lines -> three rectangles
    return [
      this.selectionLayerPart(startPos, endPosLine1, selectionColor),
      this.selectionLayerPart(startPosLine2, endPosMiddle, selectionColor),
      this.selectionLayerPart(startPosLast, endPos.addXY(0, endLineHeight), selectionColor),
      this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth)];

  }

  selectionLayerPart(startPos, endPos, selectionColor) {
    return h('div.newtext-selection-layer.selection-layer-part', {
      style: {
        left: startPos.x + "px", top: startPos.y + "px",
        width: (endPos.x-startPos.x) + "px",
        height: (endPos.y-startPos.y)+"px",
        backgroundColor: selectionColor
      }
    })
  }

  cursor(pos, height, visible, diminished, width) {
    return h('div.newtext-cursor' + (diminished ? ".diminished" : ""), {
      style: {
        left: pos.x-Math.ceil(width/2) + "px", top: pos.y + "px",
        width: width + "px", height: height + "px",
        display: visible ? "" : "none"
      }
    }/*, "\u00a0"*/);
  }
}



// defaultRenderer>>renderSelectionLayer
// defaultRenderer>>renderMarkerLayer
// defaultRenderer>>renderTextLayer
// defaultRenderer>>renderDebugLayer
// defaultRenderer>>selectionLayerPart
// defaultRenderer>>cursor
// defaultRenderer>>renderMarkerPart
// defaultRenderer>>renderLine
// defaultRenderer>>renderChunk
