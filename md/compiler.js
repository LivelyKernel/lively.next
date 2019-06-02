import markdownIt from "https://cdnjs.cloudflare.com/ajax/libs/markdown-it/8.4.0/markdown-it.js";
import { string } from "lively.lang";

class MarkdownCompiler {

  compileToHTML(src, options = {}) {
    let {linkedCSS, markdownWrapperTemplate} = options;

    let md = markdownIt(options).use(externalizeLinksPlugin).use(addSourceLineMappingPlugin),
        html = md.render(src);

    if (markdownWrapperTemplate)
      html = string.format(markdownWrapperTemplate, html);

    if (linkedCSS) {
      for (let id in linkedCSS) {
        html = `<link type="text/css" rel="stylesheet" id="${id}" href="${linkedCSS[id]}">` + html;
      }
    }

    return html;
  }

  parse(editor, options) {
    let md = markdownIt(options).use(externalizeLinksPlugin),
        src = editor.textString,
        parsed = md.parse(editor.textString),
        lines = src.split("\n"),
        headings = parsed.filter(ea => ea.type === "heading_open").map((heading, i) => {
          let {map: [line], level} = heading;
          return {line, depth: level+1, string: lines[line].trim()}
        });
    return {parsed, headings};
  }

}

var mdCompiler = new MarkdownCompiler();
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
      tokens[idx].attrJoin('class', 'markdown-line-marker');
      tokens[idx].attrSet('data-mdline', String(mdLine));
      tokens[idx].attrSet('data-htmlline', String(htmlLine));
    }
    return slf.renderToken(tokens, idx, options, env, slf);
  }

  md.renderer.rules.paragraph_open = md.renderer.rules.heading_open = injectLineNumbers;
}

