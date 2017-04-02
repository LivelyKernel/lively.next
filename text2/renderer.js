import { fun, arr, obj } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";
import { h } from "../node_modules/virtual-dom/dist/virtual-dom.js";
import { defaultAttributes, defaultStyle } from "../rendering/morphic-default.js";
import { addOrChangeCSSDeclaration } from "../rendering/dom-helper.js";
import { DOMTextMeasure } from "./measuring.js";
import { inspect, show } from "lively.morphic";

let cssInstalled = false;

function installCSS(document) {
  cssInstalled = true;
  addOrChangeCSSDeclaration("new-text-css", `
    .newtext-scroller {
        overflow-anchor: none;˜ /*annoying chrome*/
        -moz-box-sizing: content-box;
        box-sizing: content-box;
        overflow: auto !important;
        height: 100%;
        outline: none;
        position: relative;
    }

    .newtext-wrap {}

    .newtext-wrap .line>span {
      word-wrap: break-word;
      white-space: wrap;
      /*word-break: break-all;*/
      word-break: normal;
    }

    .newtext .line>span {
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

export default class Renderer {

  constructor() {
    if (!cssInstalled) installCSS();
  }

  render(morph, renderer) {
    return h("div",
      {...defaultAttributes(morph, renderer), style: defaultStyle(morph)},
      [renderer.renderSubmorphs(morph), this.renderTextStuff(morph, renderer)]);
  }

  renderTextStuff(morph, renderer) {
    // let renderer = this.env.renderer;
    // this.estimateLineHeights(this.lineData.lines)

    let {
          height: scrollHeight,
          scroll: {x: scrollLeft, y: scrollTop},
          document,
        } = morph,
        lines = document.lines;

    if (morph.viewState._textLayoutStale) {
      let {defaultTextStyle, width: textWidth, lineWrapping} = morph;
      this.estimateLineHeights(morph.viewState, document, defaultTextStyle, textWidth, lineWrapping, true/*force*/);
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

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    let scrollerAttrs = {
      scrollLeft, scrollTop,
      onscroll: evt => {
        // let dirty = this._dirty;
        let {scrollLeft, scrollTop} = evt.target;
        // this.setProperty("textScroll", pt(scrollLeft, scrollTop));
        // this._dirty = dirty;
        // show("scroll")
        morph.textScroll = pt(scrollLeft, scrollTop);
        morph.makeDirty()
      }
    }

    // this.padding = Rectangle.inset(10);

    let padding = morph.padding || Rectangle.inset(0),
        leftP = padding.left(),
        rightP = padding.right(),
        topP = padding.top(),
        bottomP = padding.bottom();

    let textAttrs = {
      style: {
        height: textHeight + "px",
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
    function AfterTextRenderHook() {}
    AfterTextRenderHook.prototype.hook = (node, propName, prevValue) => {
      if (!node || !node.parentNode) return;

      let dirty = morph._dirty;
      // if (dirty)
      //   console.log(this.env.changeManager.changesFor(this).slice(-20));

      // let {scrollLeft, scrollTop} = node.parentNode;
      // this.setProperty("textScroll", pt(scrollLeft, scrollTop));
      // this._dirty = dirty;

      // let node = this.env.renderer.getNodeForMorph(this).querySelector(".newtext-wrap");
      // let lineNode = node.childNodes[1];
      let lineNode = node.querySelector(".line");

      if (!lineNode) return;
      let row = Number(lineNode.dataset.row);
      if (typeof row !== "number" || isNaN(row)) return;
      try {
        while (lineNode) {
          let line = lines[row++];
          if (line && (line.height === 0 || line.hasEstimatedHeight)) {
          // if (line) {
            let {height} = lineNode.getBoundingClientRect();
            line.changeHeight(height, false);
          }
          lineNode = lineNode.nextSibling;
        }
      } catch (err) { $world.logError(err); }
      morph.viewState._textLayoutStale = false;
    }
    textAttrs["after-text-render-hook"] = new AfterTextRenderHook();

    // show(firstVisibleRow + "- " + lastVisibleRow)
    let visibleLines = lines.slice(firstVisibleRow, lastVisibleRow);

    let renderedLines = visibleLines.map((ea, i) =>
       h(`div.line#line`, {dataset: {row: ea.row}}, h("span", ea.text || h("br"))));

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // let renderedLines = [
    //   h(`div.line#line`, {dataset: {row: visibleLines[0].row}}, [
    //     h("span", [
    //       h("span", visibleLines[0].text.slice(0,10)),
    //       h("div", {style: {display: "inline-block", width: "100px", height: "30px", backgroundColor: "red"}}),
    //       h("span", visibleLines[0].text.slice(10)),
    //     ])
    //   ])
    //   
    // ]
    // renderedLines.push(...visibleLines.slice(1).map((ea, i) =>
    //    h(`div.line#line`, {dataset: {row: ea.row}}, h("span", ea.text || h("br")))));
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


    if ($world.get("text-debugger")) {
      fun.throttleNamed(morph.id +"-debug", 300, () => {
        let {
          firstVisibleRow, lastVisibleRow,
          heightBefore,
          scrollBottom,
          scrollTop,
          scrollHeight,
          textHeight,
        } = viewState;

        $world.get("text-debugger").textString = `${new Date()}
firstVisibleRow: ${firstVisibleRow}
lastVisibleRow: ${lastVisibleRow}
textHeight: ${textHeight}
scrollHeight: ${scrollHeight}
scrollTop: ${scrollTop}
scrollBottom: ${scrollBottom}
heightBefore: ${heightBefore}
${false ? obj.inspect(morph.env.changeManager.changesFor(morph).slice(-1), {maxDepth: 2}) : ""}
${lines.map(l => `${l.row}: ${l.height}${l.hasEstimatedHeight ? "?" : ""}`).join(", ")}`;
      })();
    }

    renderedLines.unshift(h("div.newtext-before-filler", {style: {width: "20px", backgroundColor: "red", height: heightBefore + "px"}}));

// visibleLines[0].charBounds
    return h("div.newtext.newtext-scroller",
             scrollerAttrs,
             h("div.newtext.newtext-wrap", textAttrs,
               [...this.renderDebugLayer(visibleLines, scrollTop), ...renderedLines]));
  }

  renderDebugLayer(visibleLines, startY) {
    let debugHighlights = [],
        textWidth = 0;

    for (let row = 0; row < visibleLines.length; row++) {
      let {height, charBounds} = visibleLines[row];
      if (!charBounds) continue;;

      for (let col = 0; col < charBounds.length; col++) {
        let {x, y, width, height} = charBounds[col];
        y += startY;
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

  estimateLineHeights(viewState, document, defaultStyle, textWidth, wraps, force = false) {
    // this.reset()
    // this.estimateLineHeights(this.lineData.lines);
    //
    // let chars = arr.range(64, 125).map(ea => String.fromCharCode(ea))
    // while(chars.length < 300) chars.push(...chars)
    // let lines = arr.range(0, 1000).map(_ => ({height: 0, text: arr.shuffle(chars).slice(0, num.random(0, 300)).join("")}))
    // lines.forEach(ea => ea.height=0)
    // this.estimateLineHeights(lines);
    // let t = Date.now(); this.estimateLineHeights(lines); Date.now()-t;
    // this.content = lines.map(ea => ea.text).join("\n")

    let domTextMeasure = viewState.domTextMeasure || (viewState.domTextMeasure = DOMTextMeasure.initDefault().reset()),
        lines = document.lines;

// inspect({viewState, document, defaultStyle, textWidth, wraps, force})

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!force && line.height > 0) continue;
      let props = line.props,
          styles = [];

      // find all styles that apply to line
      if (!props) styles.push(defaultStyle);
      else for (let j = 0; j < props.length; j++)
        styles.push({...defaultStyle, ...props[j]});

      // measure default char widths and heights
      let charWidthN = 0, charWidthSum = 0, charHeight = 0;
      for (let h = 0; h < styles.length; h++) {
        let {width, height} = domTextMeasure.defaultCharExtent(styles[h]);
        charHeight = Math.max(height, charHeight);
        if (wraps) { charWidthSum += width; charWidthN++; }
      }

      let estimatedHeight = charHeight;
      if (wraps) {
        let charWidth = (charWidthSum/charWidthN),
            charsPerline = Math.max(3, textWidth / charWidth);
        estimatedHeight = (Math.ceil(line.text.length / charsPerline) || 1) * charHeight;
      }
      line.changeHeight(estimatedHeight, true);
    }
  }

}
