/*global global,System*/
import { obj } from "lively.lang";
import { pt } from "lively.graphics";
import { h } from "virtual-dom";
import { defaultAttributes, defaultStyle } from "../rendering/morphic-default.js";
import { addOrChangeCSSDeclaration } from "../rendering/dom-helper.js";
import { hyperscriptFnForDocument } from "../rendering/dom-helper.js";
import { objectReplacementChar } from "./document.js";
import config from "../config.js";

let cssInstalled = false;

var debug = !!config.onloadURLQuery["debug-text"];

function printViewState(textMorph) {

  let {
    viewState: {
      scrollTop, scrollHeight,
      heightBefore, textHeight,
      firstVisibleRow, lastVisibleRow,
      firstFullyVisibleRow, lastFullyVisibleRow,
      visibleLines
    },
    document: {lines}
  } = textMorph;

  console.log(`${textMorph} #${textMorph.id.slice(0,12)}
scroll: ${scrollTop} + ${scrollHeight}
lines: ${firstVisibleRow} - ${lastVisibleRow}
height: ${textHeight}, ${lines.length} lines`);
}

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

    .hidden-cursor .newtext-cursor {
      background-color: transparent !important;
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
      box-sizing: border-box;
      position: absolute;
      white-space: pre;
      z-index: 0;
      min-width: 100%;
    }

    .newtext-before-filler {}

    .newtext-text-layer.wrap-by-words {
      white-space: pre-wrap;
      overflow-wrap: break-word;
      max-width: 100%;
    }

    .newtext-text-layer.only-wrap-by-words {
      white-space: pre-wrap;
      overflow-wrap: break-all;
      max-width: 100%;
    }

    .newtext-text-layer.wrap-by-chars {
      white-space: pre-wrap;
      word-break: break-all;
      max-width: 100%;
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

    .line > .Morph {
      display: inline-block !important;
      vertical-align: top !important;
    }

    blockquote {
      margin: 0;
      -webkit-margin-start: 0;
      -webkit-margin-end: 0;
    }

    .newtext-text-layer blockquote {
      margin-left: 2em;
      margin-right: 2em;
      border-left: 2px lightgray solid;
      padding-left: 2%;
    }

    /* -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-*/
    /* debug styling */

    .debug-info {
      position: absolute;
      outline: 1px solid green;
      pointer-events: none;
      z-index: 4;
      text-align: center;
      font-family: monospace;
      color: green;
      background-color: white;
      font-size: small;
      vertical-align: baseline;
    }

    .debug-line {
      position: absolute;
      outline: 1px solid red;
      pointer-events: none;
      z-index: 4,
      text-align: right;
      font-family: monospace;
      font-size: small;
      vertical-align: baseline;
      color: red;
    }

    .debug-char {
      position: absolute;
      outline: 1px solid orange;
      pointer-events: none;
      z-index: 3
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
function AfterTextRenderHook() {}

AfterTextRenderHook.prototype.reset = function(morph) {
  this.morph = morph;
  this.called = false;
  this.needsRerender = false;
}

AfterTextRenderHook.prototype.updateLineHeightOfNode = function(morph, docLine, lineNode) {

  if (docLine.height === 0 || docLine.hasEstimatedExtent) {
    
    const tfm = morph.getGlobalTransform().inverse();
    tfm.e = tfm.f = 0;
    if (tfm.getScale() != 1 || tfm.getRotation() != 0) {
      lineNode.style.transform = tfm.toString()
    }
    const {height: nodeHeight, width: nodeWidth} = lineNode.getBoundingClientRect();
    lineNode.style.transform = '';
    if (nodeHeight && nodeWidth && (docLine.height !== nodeHeight || docLine.width !== nodeWidth)) {
      // console.log(`[${docLine.row}] ${nodeHeight} vs ${docLine.height}`)
      docLine.changeExtent(nodeWidth, nodeHeight, false);
      morph.textLayout.resetLineCharBoundsCacheOfLine(docLine);
      // force re-render in case text layout / line heights changed
      this.needsRerender = true;
      morph.viewState._needsFit = true;
    }
    return nodeHeight;
  }
  return docLine.height;
}

AfterTextRenderHook.prototype.updateExtentsOfLines = function(textlayerNode) {
  // figure out what lines are displayed in the text layer node and map those
  // back to document lines.  Those are then updated via lineNode.getBoundingClientRect

  let {morph} = this,
      {textLayout, viewState} = morph

  viewState.dom_nodes = [];
  viewState.dom_nodeFirstRow = 0;
  viewState.textWidth = textlayerNode.scrollWidth;
  
  let lineNodes = textlayerNode.children,
      i = 0, 
      firstLineNode;

  while (i < lineNodes.length && lineNodes[i].className != 'line') i++;
  
  if (i < lineNodes.length) {
    firstLineNode = lineNodes[i];
  } else {
    return;
  }

  let ds = firstLineNode.dataset,
      row = Number(ds ? ds.row : firstLineNode.getAttribute("data-row"));
  if (typeof row !== "number" || isNaN(row)) return;
  viewState.dom_nodeFirstRow = row;
  let actualTextHeight = 0,
      line = morph.document.getLine(row);

  for (; i < lineNodes.length; i++) {
    let node = lineNodes[i];
    viewState.dom_nodes.push(node);
    if (line) {
      actualTextHeight = actualTextHeight + this.updateLineHeightOfNode(morph, line, node);
      line = line.nextLine();
    }
  }

  if (this.needsRerender) {
    morph.fitIfNeeded();
    morph.makeDirty();
  } else morph._dirty = !!morph.submorphs.find(m => m.needsRerender());
}

AfterTextRenderHook.prototype.hook = function(node, propName, prevValue) {
  if (!node || !node.parentNode) return;
  let vs = this.morph.viewState;
  vs.text_layer_node = node;
  vs.fontmetric_text_layer_node = null;
  this.called = true;
  // the childNodes = line nodes of node are updated after the hook was called,
  // so delay...
  this.updateExtentsOfLines(node);
}



export default class TextRenderer {

  constructor(domEnv) {
    if (!domEnv) {
      console.warn(`Text renderer initialized without domEnv. Depending on what you want to do you might have bad luck...!`);
    } else if (!cssInstalled) installCSS(domEnv);
    this.domEnv = domEnv;
  }

  directRenderLineFn(morph) {
    let fn = morph.viewState._renderLineFn;
    if (!fn) {
      let h = hyperscriptFnForDocument(this.domEnv.document);
      fn = morph.viewState._renderLineFn = line => this.renderLine(h, null, morph, line);
    }
    return fn;
  }

  directRenderTextLayerFn(morph) {
    let fn = morph.viewState._renderTextLayerFn;
    if (!fn) {
      let h = hyperscriptFnForDocument(this.domEnv.document);
      fn = morph.viewState._renderTextLayerFn = additionalStyle =>
        this.renderJustTextLayerNode(h, morph, additionalStyle, []);
    }
    return fn;
  }

  renderMorph(morph, renderer) {
    var cursorWidth = morph.fontSize <= 12 ? 2 : 3,
        selectionLayer = [];
    
    let sel = morph.selection;
    if (morph.inMultiSelectMode()) {
      let sels = sel.selections, i = 0;
      for (; i < sels.length-1; i++)
        selectionLayer.push(...this.renderSelectionLayer(morph, sels[i], true/*diminished*/, 2))
      selectionLayer.push(...this.renderSelectionLayer(morph, sels[i], false/*diminished*/, 4))
    } else {
      selectionLayer = this.renderSelectionLayer(morph, sel, false, cursorWidth)
    };

    let textLayer = this.renderTextLayer(morph, renderer),
        textLayerForFontMeasure = this.renderJustTextLayerNode(h, morph, null, []),
        markerLayer = this.renderMarkerLayer(morph, renderer);

    textLayer.properties.className += " actual";
    textLayerForFontMeasure.properties.className += " font-measure";
    // textLayerForFontMeasure.properties.style.visibility = "hidden";

    let {embeddedMorphMap} = morph,
        submorphsNotInText = embeddedMorphMap
          ? morph.submorphs.filter(ea => !embeddedMorphMap.has(ea))
          : morph.submorphs;

    return h("div", {
        ...defaultAttributes(morph, renderer),
        style: {
          ...defaultStyle(morph),
          "-moz-user-select": "none",
          cursor: morph.nativeCursor === "auto" ?
            (morph.readOnly ? "default" : "text") :
            morph.nativeCursor
        }
      }, [
        ...selectionLayer, markerLayer,
        textLayerForFontMeasure,
        textLayer,
        renderer.renderSelectedSubmorphs(morph, submorphsNotInText)
      ]
    );
  }

  renderTextLayer(morph, renderer) {
    // this method renders the text content = lines

    let children = morph.debug ? [
      ...this.renderDebugLayer(morph),
      ...this.renderLines(h, renderer, morph)
    ] : this.renderLines(h, renderer, morph);


    let node = this.renderJustTextLayerNode(h, morph, null, children);

    // install hook so we can update text layout from real DOM once it is rendered
    let hook = morph.viewState.afterTextRenderHook
            || (morph.viewState.afterTextRenderHook = new AfterTextRenderHook());
    hook.reset(morph);
    node.properties["after-text-render-hook"] = hook;
    nextTick(() => {
      // The hook only gets called on prop changes of textlayer node. We
      // actually want to always trigger in order to update the lines, so run
      // delayed
      if (hook.called) return;
      let node = renderer.getNodeForMorph(morph),
          textlayerNode = node && node.querySelector(".actual.newtext-text-layer");
      textlayerNode && hook.hook(textlayerNode);
    })

    return node;
  }

  renderJustTextLayerNode(h, morph, additionalStyle, children) {
    // this method renders the text content = lines

    let {
          height,
          padding: {x: padLeft, y: padTop, width: padWidth, height: padHeight},
          lineWrapping,
          backgroundColor,
          fontColor,
          textAlign,
          fontSize,
          textDecoration,
          fontStyle,
          fontWeight,
          fontFamily,
          lineHeight,
          wordSpacing,
          letterSpacing,
          document: doc,
          tabWidth
        } = morph,
        padRight = padLeft + padWidth,
        padBottom = padTop + padHeight,
        textHeight = Math.max(morph.document.height, morph.height),
        textLayerClasses = "newtext-text-layer";

    // assemble attributes of node

    // start with lineWrapping

    switch (lineWrapping) {
      case true:
      case "by-words":      textLayerClasses = textLayerClasses + " wrap-by-words"; break;
      case "only-by-words": textLayerClasses = textLayerClasses + " only-wrap-by-words"; break;
      case "by-chars":      textLayerClasses = textLayerClasses + " wrap-by-chars"; break;
      case false:           textLayerClasses = textLayerClasses + " no-wrapping"; break;
    }

    // ...and now other attribues
    let style = {height: textHeight + "px"};
    if (padLeft > 0)     style.paddingLeft =     padLeft + "px";
    if (padRight > 0)    style.paddingRight =    padRight + "px";
    if (padTop > 0)      style.paddingTop =      padTop + "px";
    if (padBottom > 0)   style.paddingBottom =   padBottom + "px";
    if (letterSpacing)   style.letterSpacing =   letterSpacing;
    if (wordSpacing)     style.wordSpacing =     wordSpacing;
    if (lineHeight)      style.lineHeight =      lineHeight;
    if (fontFamily)      style.fontFamily =      fontFamily;
    if (fontWeight)      style.fontWeight =      fontWeight;
    if (fontStyle)       style.fontStyle =       fontStyle;
    if (textDecoration)  style.textDecoration =  textDecoration;
    if (fontSize)        style.fontSize =        fontSize + "px";
    if (textAlign)       style.textAlign =       textAlign;
    if (fontColor)       style.color =           String(fontColor);
    if (backgroundColor) style.backgroundColor = backgroundColor;
    if (tabWidth !== 8)  style.tabSize =         tabWidth;

    let textAttrs = {className: textLayerClasses, style};

    if (additionalStyle) {
      let {clipMode, height, width} = additionalStyle;
      if (typeof width === "number")
        style.width = width + "px";
      if (typeof height === "number")
        style.height = height + "px";
      if (clipMode)
        style.overflow = clipMode;
    }
    style.overflow = "hidden";

    return h("div", textAttrs, children);
  }

  renderLines(h, renderer, morph) {

    let {
          height,
          scroll,
          padding: {x: padLeft, y: padTop, width: padWidth, height: padHeight},
          document: doc,
          clipMode
        } = morph,
        node = renderer.getNodeForMorph(morph),
        padRight = padLeft + padWidth,
        padBottom = padTop + padHeight,
        scrollTop = scroll.y,
        scrollHeight = height,
        lastLineNo = doc.rowCount-1,
        textHeight = doc.height,
        clips = clipMode !== "visible",
        delta = scroll.y - ((node && node._lastScrollTop) || scroll.y),
        down = 0 < delta,
        up = 0 > delta,
        bufferSpace = 500,
        buffer = {top: (up || delta == 0) ? bufferSpace : 0, bottom: (down || delta == 0) ? bufferSpace : 0}; 
         // in order to avoid blank spaces we prerender nodes that arent yet visible

    if (node) node._lastScrollTop = scroll.y;
    
    let {
      line: startLine,
      offset: startOffset,
      y: heightBefore,
      row: startRow
    } = doc.findLineByVerticalOffset(clips ? Math.max(0, clips ? scrollTop - padTop - buffer.top : 0) : 0)
     || {row: 0, y: 0, offset: 0, line: doc.getLine(0)};

    let {
      line: endLine,
      offset: endLineOffset,
      row: endRow
    } = doc.findLineByVerticalOffset(clips ? Math.min(textHeight, (scrollTop - padTop + buffer.bottom) + scrollHeight) : textHeight)
     || {row: lastLineNo, offset: 0, y: 0, line: doc.getLine(lastLineNo)};

    let firstVisibleRow = clips ? startRow : 0,
        firstFullyVisibleRow = startOffset === 0 ? startRow : startRow + 1,
        lastVisibleRow = clips ? endRow + 1 : lastLineNo,
        lastFullyVisibleRow = !endLine || endLineOffset === endLine.height ? endRow : endRow-1;

    // render lines via virtual-dom

    let visibleLines = [],
        renderedLines = [];

    // spacer to push visible lines into the scrolled area
    renderedLines.push(h("div.newtext-before-filler", {style: {height: heightBefore + "px"}}));

    let line = startLine, i = startRow;
    while (line) {
      visibleLines.push(line);
      // renderedLines.push(line._rendered || (line._rendered = this.renderLine(h, morph, line)));
      renderedLines.push(this.renderLine(h, renderer, morph, line));
      i++;
      if (line === endLine) break;
      line = line.nextLine();
    }

    Object.assign(morph.viewState, {
      scrollTop, scrollHeight,
      scrollBottom: scrollTop + scrollHeight,
      heightBefore, textHeight,
      firstVisibleRow, lastVisibleRow,
      firstFullyVisibleRow, lastFullyVisibleRow,
      visibleLines
    });

    debug && printViewState(morph);

    return renderedLines;
  }

  renderLine(h, renderer, morph, line) {
    // Note: this function is being used in the font metric as well, with a
    // non-virtual-dom "h" function

    let { textAndAttributes } = line,
        renderedChunks = [],
        size = textAndAttributes.length,
        content, attr,
        fontSize, fontFamily, fontWeight, fontStyle, textDecoration, fontColor,
        backgroundColor, nativeCursor, textStyleClasses, link,
        tagname, nodeStyle, nodeAttrs, paddingRight, paddingLeft, paddingTop, paddingBottom,
        lineHeight, textAlign, wordSpacing, letterSpacing, quote, nested;

    if (size > 0) {
      for (let i = 0; i < size; i = i+2) {
        content = textAndAttributes[i] || "\u00a0";
        attr = textAndAttributes[i+1];

        if (typeof content !== "string") {
          renderedChunks.push(
            content.isMorph
              ? this.renderEmbeddedSubmorph(h, renderer, content, attr)
              : objectReplacementChar);
          continue;
        }

        if (!attr) { renderedChunks.push(content); continue; }

        fontSize =         attr.fontSize && (obj.isString(attr.fontSize) ? attr.fontSize : attr.fontSize + 'px');
        fontFamily =       attr.fontFamily;
        fontWeight =       attr.fontWeight;
        fontStyle =        attr.fontStyle;
        textDecoration =   attr.textDecoration;
        fontColor =        attr.fontColor;
        backgroundColor =  attr.backgroundColor;
        nativeCursor =     attr.nativeCursor;
        textStyleClasses = attr.textStyleClasses;
        link =             attr.link;
        lineHeight =       attr.lineHeight || lineHeight;
        textAlign =        attr.textAlign || textAlign;
        wordSpacing =      attr.wordSpacing || wordSpacing;
        letterSpacing =    attr.letterSpacing || letterSpacing;
        paddingRight =     attr.paddingRight;
        paddingLeft =      attr.paddingLeft;
        paddingTop =       attr.paddingTop;
        paddingBottom =    attr.paddingBottom;
        quote =            attr.quote || quote;

        tagname = "span";
        nodeStyle = {};
        nodeAttrs = {style: nodeStyle};

        if (link) {
          tagname = "a";
          nodeAttrs.href = link;
          nodeAttrs.target = "_blank";
        }

        if (fontSize) nodeStyle.fontSize               = fontSize;
        if (fontFamily) nodeStyle.fontFamily           = fontFamily;
        if (fontWeight) nodeStyle.fontWeight           = fontWeight;
        if (fontStyle) nodeStyle.fontStyle             = fontStyle;
        if (textDecoration) nodeStyle.textDecoration   = textDecoration;
        if (fontColor) nodeStyle.color                 = String(fontColor);
        if (backgroundColor) nodeStyle.backgroundColor = String(backgroundColor);
        if (nativeCursor) nodeStyle.cursor             = nativeCursor;
        if (paddingRight) nodeStyle.paddingRight       = paddingRight;
        if (paddingLeft)  nodeStyle.paddingLeft        = paddingLeft;
        if (paddingTop) nodeStyle.paddingTop           = paddingTop;
        if (paddingBottom) nodeStyle.paddingBottom     = paddingBottom;

        if (textStyleClasses && textStyleClasses.length)
          nodeAttrs.className = textStyleClasses.join(" ");

        renderedChunks.push(h(tagname, nodeAttrs, content));
      }

    } else renderedChunks.push(h("br"));

    var lineStyle = {};
    // var lineTag = quote ? "blockquote" : "div";
    var lineTag = "div";
    if (lineHeight) lineStyle.lineHeight = lineHeight;
    if (textAlign) lineStyle.textAlign = textAlign;
    if (letterSpacing) lineStyle.letterSpacing = letterSpacing;
    if (wordSpacing) lineStyle.wordSpacing = wordSpacing;

    let node = h(lineTag,
      {className: "line", key: line.row, style: lineStyle, dataset: {row: line.row}},
      renderedChunks);

    if (quote) {
      if (typeof quote !== "number") quote = 1;
      for (let i = quote; i--;) node = h("blockquote", {}, node);
    }

    return node;
  }

  renderEmbeddedSubmorph(h, renderer, morph, attr) {
    let rendered;
    attr = attr || {};
    if (renderer) {
      rendered = renderer.render(morph);
      rendered.properties.style.position = "relative";
      rendered.properties.style.transform = "";
      // fixme:  this addition screws up the bounds computation of the embedded submorph
      if (attr.paddingTop) rendered.properties.style.marginTop = attr.paddingTop;
      if (attr.paddingLeft) rendered.properties.style.marginLeft= attr.paddingLeft;
      if (attr.paddingRight) rendered.properties.style.marginRight = attr.paddingRight;
      if (attr.paddingBottom) rendered.properties.style.marginBottom = attr.paddingBottom;
      return rendered;
    }
    let {extent, styleClasses} = morph,
        width = extent.x + "px",
        height = extent.y + "px";
    return h("div", {className: styleClasses.join(" "), style: {width, height}}, []);
  }

  renderSelectionLayer(morph, selection, diminished = false, cursorWidth = 2) {
    // FIXME just hacked together... needs cleanup!!!

    if (!selection) return [];

    let {textLayout} = morph;

    var {start, end, lead, cursorVisible, selectionColor} = selection,

        isReverse           = selection.isReverse(),
        {document, cursorColor} = morph,
        startBounds         = textLayout.boundsFor(morph, start),
        maxBounds           = textLayout.computeMaxBoundsForLineSelection(morph, selection),
        endBounds           = textLayout.boundsFor(morph, end),
        startPos            = pt(startBounds.x, maxBounds.y),
        endPos              = pt(endBounds.x, endBounds.y),
        leadLineHeight      = startBounds.height,
        maxLineHeight       = maxBounds.height,
        endLineHeight       = endBounds.height,
        cursorPos           = isReverse ? pt(startBounds.x, startBounds.y) : endPos,
        cursorHeight        = isReverse ? leadLineHeight : endLineHeight;

    // collapsed selection -> cursor
    if (selection.isEmpty())
      return [this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth, cursorColor)];

    // single line -> one rectangle
    if (Math.abs((startBounds.y + leadLineHeight) - (endBounds.y + endLineHeight)) < 5) {
      return [
        this.selectionLayerPart(startPos, endPos.withY(maxBounds.y + maxLineHeight), selectionColor),
        this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth, cursorColor)
      ]
    }

    let endPosLine1 = pt(morph.width - morph.padding.right(), maxBounds.y + maxLineHeight),
        startPosLine2 = pt(morph.padding.left(), endPosLine1.y);

    // two lines -> two rectangles
    if (Math.abs((startBounds.y + leadLineHeight) - (endBounds.y)) < 5) {
      return [
        this.selectionLayerPart(startPos, endPosLine1, selectionColor),
        this.selectionLayerPart(startPosLine2, endPos.addXY(0, endLineHeight), selectionColor),
        this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth, cursorColor)];
    }

    let endPosMiddle = pt(morph.width - morph.padding.right(), endPos.y),
        startPosLast = pt(morph.padding.left(), endPos.y);

    // 3+ lines -> three rectangles
    return [
      this.selectionLayerPart(startPos, endPosLine1, selectionColor),
      this.selectionLayerPart(startPosLine2, endPosMiddle, selectionColor),
      this.selectionLayerPart(startPosLast, endPos.addXY(0, endLineHeight), selectionColor),
      this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth, cursorColor)];

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

  cursor(pos, height, visible, diminished, width, color) {
    return h('div', {
      className: "newtext-cursor" + (diminished ? " diminished" : ""),
      style: {
        left: pos.x-Math.ceil(width/2) + "px", top: pos.y + "px",
        width: width + "px", height: height + "px",
        display: visible ? "" : "none",
        background: color || "black"
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
        parts.push(this.renderMarkerPart(textLayout, morph, lineStart, lineEnd, style, true));
      }
      // last line
      parts.push(this.renderMarkerPart(textLayout, morph, {row: end.row, column: 0}, end, style));
    }

    return parts;
  }

  renderMarkerPart(textLayouter, morph, start, end, style, entireLine = false) {
    var startX = 0, endX = 0, y = 0, height = 0,
        {document: doc} = morph,
        line = doc.getLine(start.row)
    if (entireLine) {
      var {padding} = morph;
      startX = padding.left();
      y = padding.top() + doc.computeVerticalOffsetOf(start.row);
      endX = startX + line.width;
      height = line.height;
    } else {
      ({x: startX, y} = textLayouter.boundsFor(morph, start));
      ({x: endX, height} = textLayouter.boundsFor(morph, end));
    }
    height = Math.ceil(height);
    return h("div.newtext-marker-layer", {
      style: {
        ...style,
        left: startX + "px", top: y + "px",
        height: height + "px",
        width: endX - startX + "px"
      }
    });
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debug layer

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
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// DOM extraction from text morph

export function extractHTMLFromTextMorph(
  textMorph,
  textAndAttributes = textMorph.textAndAttributesInRange(textMorph.selection.range)
) {
  let text = new textMorph.constructor({
        ...textMorph.defaultTextStyle,
        width: textMorph.width,
        textAndAttributes: textAndAttributes
      }),
      render = text.textRenderer.directRenderTextLayerFn(text),
      renderLine = text.textRenderer.directRenderLineFn(text),
      textLayerNode = render();
  let style = System.global && System.global.getComputedStyle ? System.global.getComputedStyle(textLayerNode) : null;
  if (style) {
    textLayerNode.ownerDocument.body.appendChild(textLayerNode);
    textLayerNode.style.whiteSpace = style.whiteSpace;
    textLayerNode.style.overflowWrap = style.overflowWrap;
    textLayerNode.style.wordBreak = style.wordBreak;
    textLayerNode.style.minWidth = style.minWidth;
    textLayerNode.parentNode.removeChild(textLayerNode);
  }
  for (let line of text.document.lines)
    textLayerNode.appendChild(renderLine(line));
  return textLayerNode.outerHTML;
}
