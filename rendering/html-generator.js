import { tidyHtml } from "../ide/html/editor-plugin.js";
import { IFrameMorph } from "lively.morphic";
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
        .map(ea => ea.outerHTML).join("\n"),
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
  let {isFragment = false, addStyles = true} = options,
      root = morphToNode(morph),
      htmlClassName = `html-${morph.name.replace(/[\s|"]/g, "-")}`;

  root.style.transform = "";

  let html = isFragment
    ? `<div class="exported-morph-container ${htmlClassName}" 
            style="width: ${root.style.width}; height: ${root.style.height};">\n`
       + (addStyles ? morphicStyles() : "")
       + `\n${root.outerHTML}\n</div>`
    : `<head><title>lively.next</title><meta charset="UTF-8">`
       + (addStyles ? morphicStyles() : "") + `\n</head>`
       + `<body><div class="exported-morph-container ${htmlClassName}"
                     style="width: ${root.style.width}; height: ${root.style.height};">
          ${root.outerHTML}</div></body>`;

  html = await tidyHtml(html);
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
