import markdownIt from "https://cdnjs.cloudflare.com/ajax/libs/markdown-it/8.4.0/markdown-it.js";

import { pt } from "lively.graphics";
import { string, fun, obj, arr } from "lively.lang";
import { loadPart } from "lively.morphic/partsbin.js";
import { addOrChangeLinkedCSS } from "lively.morphic/rendering/dom-helper.js";
import { HTMLMorph } from "lively.morphic";

export function scrollHTMLMorphToMdLine(line, htmlMorph) {
  
}

export default class MDCompiler {

  compileToHTML(src, options = {}) {    
    let md = markdownIt(options).use(externalizeLinksPlugin).use(addSourceLineMappingPlugin),
        html = md.render(src);
    if (options.addMarkdownBodyDiv)
      html = `<div class="markdown-body" style="margin: 5px">\n${html}\n</div>`
    return html;
  }

  compileMorphToHTMLAndOpen(mdText, options = {}) {
    let markdownOptions = {
      ...mdText.markdownOptions,
      externalizeLinks: {},
      addSourceLineMapping: true,
      addMarkdownBodyDiv: options.hasOwnProperty("addMarkdownBodyDiv") ?
                            options.addMarkdownBodyDiv : true
    }
    return mdText._htmlMorph = this.compileToHTMLAndOpen(
    mdText.textString, {markdownOptions, ...options, htmlMorph: mdText._htmlMorph});
  }

  compileToHTMLAndOpen(src, options) {
    options = {
      extent: pt(500,800),
      title: "markdown rendering",
      htmlOutputName: "MarkdownRendering",
      htmlMorph: null,
      ...options
    };

    let htmlMorph = options.htmlMorph || (options.htmlOutputName && $world.get(options.htmlOutputName));
    if (!htmlMorph) {
      htmlMorph = new HTMLMorph({extent: options.extent, name: options.htmlOutputName, clipMode: "auto"});
      htmlMorph.clipMode = "auto";
    }
    if (!htmlMorph.world()) {
      if (htmlMorph.getWindow()) $world.addMorph(htmlMorph.getWindow().activate());
      else htmlMorph.openInWindow(options).activate();
    }

    htmlMorph.html = this.compileToHTML(src, options.markdownOptions);
    addOrChangeLinkedCSS("github-markdown", "/lively.ide/md/github-markdown.css");

    return htmlMorph;
  }

  changeHeadingDepthAt(editor, pos, delta) {
    var cursor = editor.cursorPosition,
        src = editor.textString,
        headings = this.parseHeadings(src, editor.markdownOptions),
        h = this.headingOfLine(headings, pos.row),
        sub = this.rangeOfHeading(src, headings, h),
        changes = this.headingsDepthChanges(src, headings, h, h.depth + delta);
    editor.applyChanges(changes, cursor, true);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  parse(editor, options) {
    // markdownSrcOrLines=that.textString
    let md = markdownIt(options).use(externalizeLinksPlugin),
        parsed = md.parse(editor.textString);
    return parsed;
  }

  parseHeadings(markdownSrcOrLines, options) {
    // markdownSrcOrLines=that.textString
    let md = markdownIt(options).use(externalizeLinksPlugin),
        parsed = md.parse(markdownSrcOrLines),
        lines = markdownSrcOrLines.split("\n"),
        headings = parsed.filter(ea => ea.type === "heading_open");

    return headings.map((heading, i) => {
      let {map: [line], level} = heading;
      return {line, depth: level+1, string: lines[line].trim()}
    });
  }

  ownerHeadings(headings, heading) {
    if (heading.depth <= 1) return [];
    var before = headings.slice(0, headings.indexOf(heading));
    if (!before.length) return [];
    var owner = before.reverse().find(ea => ea.depth < heading.depth);
    return this.ownerHeadings(headings, owner).concat([owner]);
  }

  withSiblings(markdownSrcOrLines, headings, heading) {
    if (heading.depth === 1) return headings.filter(ea => ea.depth === 1);
    var owners = this.ownerHeadings(headings, heading),
        sub = this.rangeOfHeading(markdownSrcOrLines, headings, arr.last(owners));
    return sub.subheadings.filter(ea => ea.depth === heading.depth);
  }

  siblingsBefore(markdownSrcOrLines, headings, heading) {
    var sibs = this.withSiblings(markdownSrcOrLines, headings, heading);
    return sibs.slice(0, sibs.indexOf(heading));
  }

  siblingsAfter(markdownSrcOrLines, headings, heading) {
    var sibs = this.withSiblings(markdownSrcOrLines, headings, heading);
    return sibs.slice(sibs.indexOf(heading) + 1);
  }

  headingOfLine(headings, line) {
    // find last heading at or above line
    var found;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].line > line) break;
      found = headings[i];
    }
    return found;
  }

  rangeOfHeading(markdownSrcOrLines, headings, heading) {
    // return the entire text range of the content at and below heading
    var md = this,
        lines = Array.isArray(markdownSrcOrLines) ?
          markdownSrcOrLines : string.lines(markdownSrcOrLines),
        start = headings.find(ea => heading && ea.line === heading.line),
        startIndex = headings.indexOf(start),
        end = headings.slice(startIndex+1).find(ea => ea.depth <= heading.depth),
        subheadings = headings.slice(
          headings.indexOf(start),
          end ? headings.indexOf(end) : headings.length);
    return {
      range: {
        start: {row: start.line, column: 0},
        end: end ?
          {row: end.line-1, column: lines[end.line-1].length} :
          {row: lines.length-1, column: lines[lines.length-1].length}
      },
      subheadings: subheadings
    }
  }

  headingsDepthChanges(markdownSrcOrLines, headings, heading, newDepth) {
    var lines = Array.isArray(markdownSrcOrLines) ?
          markdownSrcOrLines : string.lines(markdownSrcOrLines),
        subheadings = this.rangeOfHeading(lines, headings, heading),
        depth = heading.depth,
        delta = newDepth - depth,
        newHeadings = subheadings.subheadings.map(h => ({
          ...h,
          depth: h.depth + delta,
          lineString: string.times("#", h.depth + delta) + " " + h.string
        })),
        changes = arr.flatmap(newHeadings, h => [
          ["remove", {row: h.line, column: 0}, {row: h.line, column: lines[h.line].length}],
          ["insert", {row: h.line, column: 0}, h.lineString],
        ]);
    return changes;
  }
}

var mdCompiler = new MDCompiler();
export { mdCompiler }



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME

function externalizeLinksPlugin(md, options = {}) {
  options = {...md.options, ...options}
  if (!options.externalizeLinks) return;

  let {
    internalDomains = [],
    internalTarget = "_blank",
    externalTarget = "_blank",
    internalRel = "",
    externalRel = ""
  } = options.externalizeLinks;

  function externalLinks(state) {
    function applyFilterToTokenHierarchy(token) {
      if (token.children) token.children.map(applyFilterToTokenHierarchy);

      if (token.type === "link_open") {
        let href = token.attrGet("href");
        let internal = isInternalLink(href);
        let target = internal ? internalTarget : externalTarget;
        if (target !== "_self") token.attrSet("target", target);

        let rel = internal ? internalRel : externalRel;
        if (rel) {
          let existingRel = token.attrGet("rel") || "";
          if (existingRel !== "") rel = existingRel + " " + rel;
          token.attrSet("rel", rel);
        }
      }
    }

    state.tokens.map(applyFilterToTokenHierarchy);
  }

  function isInternalLink(href) {
    let domain = getDomain(href);
    return domain === null || internalDomains.indexOf(domain) !== -1;
  }

  function getDomain(href) {
    let domain = href.split("//")[1];
    if (domain) {
      domain = domain.split("/")[0].toLowerCase();
      return domain || null;
    }
    return null;
  }

  md.core.ruler.push("external_links", externalLinks);
}

function addSourceLineMappingPlugin(md, options = {}) {
  options = {...md.options, ...options}
  if (!options.addSourceLineMapping) return;

  function injectLineNumbers(tokens, idx, options, env, slf) {
    var mdLine, htmlLine;
    if (tokens[idx].map && tokens[idx].level === 0) {
      var [mdLine, htmlLine] = tokens[idx].map;
      tokens[idx].attrJoin('class', 'line');
      tokens[idx].attrSet('data-mdline', String(mdLine));
      tokens[idx].attrSet('data-htmlline', String(htmlLine));
    }
    return slf.renderToken(tokens, idx, options, env, slf);
  }

  md.renderer.rules.paragraph_open = md.renderer.rules.heading_open = injectLineNumbers;
}

