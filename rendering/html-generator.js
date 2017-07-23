import { tidyHtml } from "../ide/html/editor-plugin.js";
import { IFrameMorph, show } from "lively.morphic";
import { create as createNode } from "virtual-dom";

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
        .map(ea => ea.outerHTML.replace(`href="${document.origin}`, `href="`)).join("\n"),
      styles = Array.from(document.querySelectorAll("style"))
        .map(ea => ea.outerHTML).join("\n")
        .replace(/white-space: pre[^\;]*;/g, "")
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

  let {isFragment = false, addStyles = true, container: containerOpts, removeTargetFromLinks = true} = options,
      {width: containerWidth, height: containerHeight} = containerOpts || {},
      root = morphToNode(morph),
      htmlClassName = `html-${morph.name.replace(/[\s|"]/g, "-")}`;

  root.style.transform = "";

  let morphHtml = `<div class="exported-morph-container ${htmlClassName}"`
                + `    style="max-width: ${containerWidth || root.style.width};`
                + `           height: ${containerHeight || root.style.height};">`
                + `${root.outerHTML}\n</div>`, html;

  if (isFragment) {
    html = addStyles ? morphicStyles() + morphHtml : morphHtml;

  } else {    
    html = `<head><title>lively.next</title><meta charset="UTF-8">`;
    if (addStyles) html += morphicStyles();
    html += `</head><body>\n` + morphHtml + "</body>"
  }

  if (removeTargetFromLinks) {
    while (html.match(/(<a .*) target="_blank"/)) {
      html = html.replace(/(<a .*) target="_blank"/, "$1");
    }
  }

  html = await tidyHtml(html);
  if (htmlResource)
    await htmlResource.write(html);
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
