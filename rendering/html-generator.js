import { tidyHtml } from "lively.ide/html/editor-plugin.js";
import { IFrameMorph, show } from "lively.morphic";
import { create as createNode } from "virtual-dom";
import { tree } from "lively.lang";

export function morphToNode(morph, renderer = morph.env.renderer) {
  let vNode = morph.render(renderer),
      node = createNode(vNode);
  node = callMorphHTMLTransforms(morph, node, []);
  return node;
}

function callMorphHTMLTransforms(morph, node, parents = []) {
  let morphNode = node.id === morph.id ? node : node.querySelector("#" + morph.id);

  // FIXME... in this case simply ignore???
  if (!morphNode)
    throw new Error(`Cannot find node for morph ${morph}`);

  morph.submorphs.forEach(ea => callMorphHTMLTransforms(ea, morphNode, parents.concat(morph)));

  morphNode.className += " " + morph.name.replace(/[\s|"]/g, "-");

  if (typeof morph.htmlExport_transformNode === "function") {
    let newNode = morph.htmlExport_transformNode(morphNode);

    if (newNode !== morphNode && morphNode.parentNode)
      morphNode.parentNode.replaceChild(newNode, morphNode);
    return newNode;
  }
  return morphNode;
}

export function morphicStyles() {
  let styleLinks = Array.from(document.querySelectorAll("link"))
        .map(ea => ea.outerHTML.replace(`href="${document.location.origin}`, `href="`)).join("\n"),
      styles = Array.from(document.querySelectorAll("style"))
        .map(ea => ea.outerHTML).join("\n")
        .replace(/[^\s]*user-select: none;/g, "");
  return `${styles}\n${styleLinks}`;
}

export async function generateHTMLForAll(morphs, dirResource, options) {
  try {
    for (let morph of morphs) {
      let name = morph.name;
      if (!name.endsWith(".html")) name += ".html";
      await generateHTML(morph, dirResource.join(name), options);
    }
    $world.setStatusMessage(`written files to ${dirResource.url}`);
  } catch (err) { $world.showError(err); }
}

export async function generateHTML(morph, htmlResource, options = {}) {
  if (htmlResource && !htmlResource.isResource) {
    options = htmlResource;
    htmlResource = null;
  }

  let {
        isFragment = false,
        addStyles = true,
        container: containerOpts,
        removeTargetFromLinks = true,
        addMetaTags,
        addScripts,
        appendHTML
      } = options,
      {width: containerWidth, height: containerHeight, id: containerId} = containerOpts || {},
      root = morphToNode(morph),
      htmlClassName = `html-${morph.name.replace(/[\s|"]/g, "-")}`;

  root.style.transform = "";

  if (removeTargetFromLinks) {
    tree.postwalk(root, (node) => {
      if (String(node.tagName).toLowerCase() !== "a") return;
      if (node.target === "_blank" && !node.getAttribute("href").startsWith("http"))
        node.setAttribute("target", "");
    }, n => n.childNodes);
  }

  let morphHtml = `<div class="exported-morph-container ${htmlClassName}"`
                + (containerId ? ` id="${containerId}" ` : '')
                + `    style="background-image: ${options.backgroundColor ?
                                   options.backgroundColor.toCSSString() : 'None'};
                              max-width: ${containerWidth || root.style.width};`
                + `           height: ${containerHeight || root.style.height};">`
                + `${root.outerHTML.replace(/position: absolute;/, "")}\n</div>`, html;

  if (isFragment) {
    html = addStyles ? morphicStyles() + morphHtml : morphHtml;

    if (appendHTML) html += appendHTML;

  } else {
    html = `<head><title>lively.next</title>
     <meta content="utf-8" http-equiv="encoding">
     <meta content="text/html;charset=utf-8" http-equiv="Content-Type">`;
    if (addMetaTags) {
      let metaTags = typeof addMetaTags === "function" ?
                      addMetaTags(morph, htmlResource, options) :
                      addMetaTags,
          tagMarkup = [];
      for (let spec of metaTags) {
        let markup = "<meta"
        for (let prop in spec) markup += ` ${prop}="${spec[prop]}"`;
        markup += ">";
        tagMarkup.push(markup);
      }
      html += "\n" + tagMarkup.join("\n")
    }
    if (addStyles) html += morphicStyles();
    if (addScripts) html += addScripts;
    html += `</head><body style="margin: 0; ">\n` + morphHtml + "\n";
    if (appendHTML) html += appendHTML + "\n";
    html += "</body>"
  }

  if (htmlResource) await htmlResource.write(html);

  // FIXME cleanup for HTML morphs... they "disappear"
  let htmlMorphs = [];
  htmlMorphs.push(...morph.withAllSubmorphsSelect(ea => ea.isHTMLMorph));
  htmlMorphs.forEach(ea => {
    let o = ea.owner, i = o.submorphs.indexOf(ea);
    ea.remove();
    setTimeout(() => o.addMorphAt(ea, i), 0)
  });
  
  return html;
}

function showPreview(html, iframeMorph, outputFile) {
  if (!iframeMorph || !iframeMorph.world()) {
    iframeMorph = this._iframeMorph = new IFrameMorph()
    iframeMorph.openInWindow({title: "rendered HTML"});
  }
  let url = outputFile && outputFile.url;
  if (url) { iframeMorph.loadURL(url); }
  else iframeMorph.displayHTML(html);
  return iframeMorph;
}
