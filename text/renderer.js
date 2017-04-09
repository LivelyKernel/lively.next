import { fun, arr, obj } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";
import { h } from "../node_modules/virtual-dom/dist/virtual-dom.js";
import { defaultAttributes, defaultStyle } from "../rendering/morphic-default.js";
import { addOrChangeCSSDeclaration } from "../rendering/dom-helper.js";
import { inspect, show } from "lively.morphic";

let cssInstalled = false;

function installCSS(domEnv) {
  cssInstalled = true;
  addOrChangeCSSDeclaration("new-text-css", `
  
    /* markers */

    .newtext-marker-layer {
      position: absolute;
    }

    /* selection / cursor */

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
    }

    /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-*/
    /* text layer / content */

    .newtext-text-layer {
      z-index: 3;
    }

    .newtext-before-filler {}

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

    .newtext-text-layer .line {
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
      position: relative;
      overflow: visible;
      -webkit-tap-highlight-color: transparent;
      -webkit-font-variant-ligatures: contextual;
      font-variant-ligatures: contextual;
    }

    /* -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-*/
    /* debug styling */

    .debug-info {
      position: absolute;
      outline: 1px solid green;
      pointerEvents: none;
      zIndex: 4;
      textAlign: center;
      fontFamily: monospace;
      color: green;
      backgroundColor: white;
      fontSize: small;
      verticalAlign: baseline;
    }

    .debug-line" {
      position: absolute;
      outline: 1px solid red;
      pointerEvents: none;
      zIndex: 4,
      textAlign: right;
      fontFamily: monospace;
      color: red;
      fontSize: small;
      verticalAlign: baseline;
    }

    .debug-char {
      position: absolute;
      outline: 1px solid orange;
      pointerEvents: none;
      zIndex: 3
    }

  `, domEnv.document);
}

// installCSS({document});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

let nextTick = (function(window, prefixes, i, p, fnc, to) {
    while (!fnc && i < prefixes.length) {
        fnc = window[prefixes[i++] + 'equestAnimationFrame'];
    }
    return (fnc && fnc.bind(window)) || window.setImmediate || function(fnc) {window.setTimeout(fnc, 0);};
})(typeof window !== 'undefined' ? window : global, 'r webkitR mozR msR oR'.split(' '), 0);



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Render hook to update layout / size of text document lines once those are
// rendered and DOM measuring can be used
function AfterTextRenderHook(morph) {
  this.morph = morph;
  this.called = false;
  this.needsRerender = false;
}

AfterTextRenderHook.prototype.updateLineHeightOfNode = function(morph, docLine, lineNode) {
  if (docLine.height === 0 || docLine.hasEstimatedHeight) {
    let {height: nodeHeight} = lineNode.getBoundingClientRect();
    if (docLine.height !== nodeHeight) {
      // console.log(`[${line.row}] ${nodeHeight} vs ${line.height}`)
      docLine.changeHeight(nodeHeight, false);
      morph.textLayout.resetLineCharBoundsCacheOfLine(docLine);
      // force re-render in case text layout / line heights changed
      this.needsRerender = true;
    }
    return nodeHeight;
  }
  return docLine.height;
}

AfterTextRenderHook.prototype.updateLineHeightOfLines = function(textlayerNode) {
  // figure out what lines are displayed in the text layer node and map those
  // back to document lines.  Those are then updated via lineNode.getBoundingClientRect

  let {morph} = this,
      {textLayout, viewState} = morph

  viewState.dom_nodes = [];
  viewState.dom_nodeFirstRow = 0;

  viewState.textWidth = textlayerNode.scrollWidth;
  let lineNode;
  for (let i = 0; i < textlayerNode.childNodes.length; i++) {
    if (textlayerNode.childNodes[i].className === "line") {
      lineNode = textlayerNode.childNodes[i]; break;
    }
  }
  let firstLineNode = lineNode,
      lastLineNode = lineNode;

  if (!lineNode) return;

  let row = Number(lineNode.dataset.row);
  if (typeof row !== "number" || isNaN(row)) return;
  viewState.dom_nodeFirstRow = row;

  let actualTextHeight = 0,
      line = morph.document.getLine(row);

  while (lineNode) {
    lastLineNode = lineNode;
    viewState.dom_nodes.push(lineNode);
    if (line) {
      actualTextHeight = actualTextHeight + this.updateLineHeightOfNode(morph, line, lineNode);
      line = line.nextLine();
    }
    lineNode = lineNode.nextSibling;
  }

  if (this.needsRerender) morph.makeDirty();
  else morph._dirty = false;
}

AfterTextRenderHook.prototype.hook = function(node, propName, prevValue) {
  if (!node || !node.parentNode) return;
  this.called = true;
  // the childNodes = line nodes of node are updated after the hook was called,
  // so delay...
  nextTick(() => this.updateLineHeightOfLines(node));
}



export default class Renderer {

  constructor(domEnv) {
    if (!cssInstalled) installCSS(domEnv);
    this.domEnv = domEnv;
  }

  renderMorph(morph, renderer) {

    var cursorWidth = morph.fontSize <= 11 ? 2 : 3,
        selectionLayer = [];

    // Make sure all lines have a height, at least estimated
    // FIXME that's pretty expensive as it hits all lines but actually only
    // those that have no height attached need to be updated... This can be
    // probably solved better by immediately re-computing an estimated height on
    // line changes... or in height getter...
    morph.textLayout.estimateLineHeights(morph, false);

    if (morph.inMultiSelectMode()) {
      let sels = morph.selection.selections, i = 0;
      for (; i < sels.length-1; i++)
        selectionLayer.push(...this.renderSelectionLayer(morph, sels[i], true/*diminished*/, 2))
      selectionLayer.push(...this.renderSelectionLayer(morph, sels[i], false/*diminished*/, 4))
    } else selectionLayer = this.renderSelectionLayer(morph, morph.selection, false, cursorWidth);

    let textLayer = this.renderTextLayer(morph, renderer),
        markerLayer = this.renderMarkerLayer(morph, renderer);

    return h("div", {
        ...defaultAttributes(morph, renderer),
        style: {
          ...defaultStyle(morph),
          cursor: morph.nativeCursor === "auto" ?
            (morph.readOnly ? "default" : "text") :
            morph.nativeCursor
        }
      }, [
        renderer.renderSubmorphs(morph),
        ...selectionLayer, markerLayer,
        textLayer
      ]
    );
  }


  renderTextLayer(morph, renderer) {
    // this method renders the text content = lines

    let {
          height,
          scroll,
          padding,
          document: doc
        } = morph,
        leftP = padding.left(),
        rightP = padding.right(),
        topP = padding.top(),
        bottomP = padding.bottom(),
        scrollTop = scroll.y,
        scrollHeight = height,
        scrollBottom = scrollTop + scrollHeight,
        textHeight = doc.height;

    let {
      line: startLine,
      offset: startOffset,
      y: heightBefore,
      row: startRow
    } = doc.findLineByVerticalOffset(Math.max(0, scrollTop - topP))
     || doc.getLine(0) || {startRow: 0, heightBefore: 0, startOffset: 0};

    let {
      line: endLine,
      offset: endLineOffset,
      y: endY,
      row: endRow
    } = doc.findLineByVerticalOffset(Math.min(doc.height, (scrollTop - topP) + scrollHeight))
     || doc.getLine(doc.rowCount-1) || {endRow: 0, endLineOffset: 0, endY: 0};

    let firstVisibleRow = startRow,
        firstFullyVisibleRow = startOffset === 0 ? startRow : startRow + 1,
        lastVisibleRow = endRow + 1,
        lastFullyVisibleRow = !endLine || endLineOffset === endLine.height ? endRow : endRow-1;

    textHeight = doc.height;


    // 3. assemble attributes of node

    // start with lineWrapping
    let textLayerClasses = "";

    switch (morph.lineWrapping) {
      case true:
      case "by-words":      textLayerClasses = textLayerClasses + ".wrap-by-words"; break;
      case "only-by-words": textLayerClasses = textLayerClasses + ".only-wrap-by-words"; break;
      case "by-chars":      textLayerClasses = textLayerClasses + ".wrap-by-chars"; break;
      case false:           textLayerClasses = textLayerClasses + ".no-wrapping"; break;
    }

    // ...and now other attribues
    let textAttrs = {
      style: {
        height:        Math.max(textHeight, morph.height) + "px",
        fontFamily:    morph.fontFamily,
        fontSize:      morph.fontSize + "px",
        textAlign:     morph.textAlign,
        color:         morph.fontColor,
        paddingLeft:   leftP + "px",
        paddingRight:  rightP + "px",
        paddingTop:    topP + "px",
        paddingBottom: bottomP + "px"
      }
    };



    // 4. install hook so we can update text layout from real DOM once it is rendered
    let hook = new AfterTextRenderHook(morph);
    textAttrs["after-text-render-hook"] = hook;
    nextTick(() => {
      // The hook only gets called on prop changes of textlayer node. We
      // actually want to always trigger in order to update the lines, so run
      // delayed
      if (hook.called) return;
      let node = renderer.getNodeForMorph(morph),
          textlayerNode = node && node.querySelector(".newtext-text-layer");
      textlayerNode && hook.hook(textlayerNode);
    })



    // 5. render text / lines via virtual-dom nodes

    let visibleLines = [],
        renderedLines = [];

    // spacer to push visible lines into the scrolled area
    renderedLines.push(h("div.newtext-before-filler", {style: {height: heightBefore + "px"}}));

    let line = startLine, i = startRow;
    while (line) {
      visibleLines.push(line);
      renderedLines.push(this.renderLine(h, morph, line, i++));
      if (line === endLine) break;
      line = line.nextLine();
    }

    Object.assign(morph.viewState, {
      scrollTop, scrollHeight, scrollBottom,
      heightBefore, textHeight,
      firstVisibleRow, lastVisibleRow,
      firstFullyVisibleRow, lastFullyVisibleRow,
      visibleLines
    });

    return h("div.newtext-text-layer" + textLayerClasses,
             textAttrs, [
             ...morph.debug ? this.renderDebugLayer(morph) : [],
             ...renderedLines
           ]);
  }

  renderDebugLayer(morph) {
    let vs = morph.viewState,
        debugHighlights = [],
        textWidth = 0,
        {heightBefore: rowY, firstVisibleRow, lastVisibleRow, visibleLines} = vs,
        {padding, scroll: {x: visibleLeft, y: visibleTop}} = morph,
        leftP = padding.left(),
        rightP = padding.right(),
        topP = padding.top(),
        bottomP = padding.bottom();

    debugHighlights.push(h("div.debug-info", {
      style: {
        left: (visibleLeft+leftP) + "px",
        top: visibleTop + "px",
        width: (morph.width-rightP)+"px",
      }
    }, h("span", `visible rows: ${firstVisibleRow} - ${lastVisibleRow}`)));

    for (let i = 0, row = firstVisibleRow; row < lastVisibleRow; i++, row++) {
      let line = visibleLines[i],
          charBounds = morph.textLayout.lineCharBoundsCache.get(line),
          {height} = line;

      debugHighlights.push(h("div.debug-line", {
        style: {
          left: (visibleLeft + leftP) + "px",
          top: (topP + rowY) + "px",
          width: (morph.width-rightP)+"px",
          height: height+"px",
        }
      }, h("span", String(row))));

      if (!charBounds) {
        rowY = rowY + height;
        continue;
      }

      for (let col = 0; col < charBounds.length; col++) {
        let {x, y, width, height} = charBounds[col];
        debugHighlights.push(h("div.debug-char", {
          style: {
            left: (leftP+x) +"px",
            top: (topP + rowY + y) + "px",
            width: width+"px",
            height: height+"px"
          }
        }))
      }

      rowY = rowY + height;
    }

    return debugHighlights
  }

  renderLine(h, morph, line, i) {
    // Note: this function is being used in the font metric as well, with a
    // non-virtual-dom "h" function

    // if (line._rendered)
    //   return line._rendered;

    let { textAndAttributes } = line,
        renderedChunks = [],
        size = textAndAttributes.length;

    if (size > 0) {
      for (let i = 0; i < size; i = i+2) {
        let text = textAndAttributes[i] || "\u00a0",
            attr = textAndAttributes[i+1];

        // FIXME!
        if (text.length > 1000) text = text.slice(0,1000);

        if (!attr) { renderedChunks.push(text); continue; }

        let {
          fontSize,
          fontFamily,
          fontWeight,
          fontStyle,
          textDecoration,
          fontColor,
          backgroundColor,
          nativeCursor,
          textStyleClasses,
          link
        } = attr;

        let tagname = "span", style = {}, attrs = {style};

        if (link) {
          tagname = "a";
          attrs.href = link;
          attrs.target = "_blank";
        }

        if (fontSize) style.fontSize               = fontSize + "px";
        if (fontFamily) style.fontFamily           = fontFamily;
        if (fontWeight) style.fontWeight           = fontWeight;
        if (fontStyle) style.fontStyle             = fontStyle;
        if (textDecoration) style.textDecoration   = textDecoration;
        if (fontColor) style.color                 = fontColor ? String(fontColor) : "";
        if (backgroundColor) style.backgroundColor = backgroundColor ? String(backgroundColor) : "";
        if (nativeCursor) attrs.style.cursor       = nativeCursor;

        if (textStyleClasses && textStyleClasses.length)
          attrs.className = textStyleClasses.join(" ");

        renderedChunks.push(h(tagname, attrs, text));
      }

    } else renderedChunks.push(h("br"));

    return line._rendered = h("div.line", {dataset: {row: line.row}}, renderedChunks);
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
        cursorHeight        = isReverse ? leadLineHeight : endLineHeight;

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


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // markers

  renderMarkerLayer(morph) {
    let {
          markers,
          textLayout,
          viewState: {firstVisibleRow, lastVisibleRow}
        } = morph,
        parts = [];

    if (!markers) return parts;

    for (let m of markers) {
      let {style, range: {start, end}} = m;

      if (end.row < firstVisibleRow || start.row > lastVisibleRow) continue;

      // single line
      if (start.row === end.row) {
        parts.push(this.renderMarkerPart(textLayout, morph, start, end, style));
        continue;
      }

      // multiple lines
      // first line
      parts.push(this.renderMarkerPart(textLayout, morph, start, morph.lineRange(start.row).end, style));
      // lines in the middle
      for (var row = start.row+1; row <= end.row-1; row++) {
        let {start: lineStart, end: lineEnd} = morph.lineRange(row);
        parts.push(this.renderMarkerPart(textLayout, morph, lineStart, lineEnd, style));
      }
      // last line
      parts.push(this.renderMarkerPart(textLayout, morph, {row: end.row, column: 0}, end, style));
    }

    return parts;
  }

  renderMarkerPart(textLayouter, morph, start, end, style) {
    var {x,y} = textLayouter.boundsFor(morph, start),
        {height, x: endX} = textLayouter.boundsFor(morph, end);
    return h("div.newtext-marker-layer", {
      style: {
        ...style,
        left: x + "px", top: y + "px",
        height: height + "px",
        width: endX-x + "px"
      }
    });
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
