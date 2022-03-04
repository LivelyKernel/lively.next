/* global System,Map */
import domToImage from 'esm://cache/dom-to-image-more@2.8.0';

/*

  let fromPB = (name) => $world.execCommand("load object from PartsBin", {open: false, name}),
      img = (await fromPB("image")).openInWorldNearHand(),
      width = 200,
      height = 300,
      opts = {width, height, center: true};

  Object.assign(img, {width, height});

  let morph = Object.assign(await fromPB("ellipse"), {submorphs: [await fromPB("star")]});
  morph.submorphs[0].center = morph.innerBounds().center();
  let dataURI = await renderMorphToDataURI(morph, opts);

  img.imageUrl = dataURI;
  lively.lang.num.humanReadableByteSize(dataURI.length);

  img.remove()

*/

function fixNodejs (document, window) {
  // 2017-03-18 FIXME
  // The dom-to-image does not support nodejs or options for jsdom. For now we
  // install globals so that it works but it would be better to fix the lib...!

  const global = System.global;
  const globals = [
    'HTMLCanvasElement',
    'Element',
    'HTMLTextAreaElement',
    'HTMLInputElement',
    'SVGElement',
    'SVGRectElement',
    'XMLSerializer',
    'Blob',
    'Image',
    'XMLHttpRequest',
    'FileReader',
    'CSSRule',
    'HTMLImageElement'
  ];

  if (!window.XMLSerializer) {
    window.XMLSerializer = function XMLSerializer_hack () {};
    window.XMLSerializer.prototype.serializeToString = el => el.outerHTML;
  }

  if (global.window !== window) global.window = window;
  if (global.document !== document) global.document = document;
  for (const glob of globals) {
    if (!window[glob]) {
      console.log(`${glob} is not available!`);
      window[glob] = eval(`(function ${glob}() { throw new Error("${glob} not supported"); })`);
    }
    if (window[glob] == global[glob]) continue;
    global[glob] = window[glob];
  }
}

const typeMethodMap = {
  blob: 'toBlob',
  jpeg: 'toJpeg',
  pixeldata: 'toPixelData',
  png: 'toPng',
  svg: 'toSvg'
};

export async function renderMorphToDataURI (morph, opts = {}) {
  // Takes a morph and options like opts = {width: NUMBER, height: NUMBER,
  // center: BOOL}, then calls morph.renderPreview() which creates a DOM node
  // looking like the morph.  This node is then fed to dom-to-image where it is
  // rendered on a canvas and the rendering is returned as data URI

  // Nodes of HTML morphs are identity-based, ie the preview render will move
  // those to another parent.  To properly restore the HTML morphs, we move their
  // nodes back to their original parent
  const htmlMorphRestoreMap = new Map();
  morph.withAllSubmorphsDo(ea =>
    ea.isHTMLMorph && htmlMorphRestoreMap.set(
      ea, { domNode: ea.domNode, parentNode: ea.domNode.parentNode }));

  const actualRenderOnGPU = morph.renderOnGPU;
  morph.renderOnGPU = true; // needs to be promoted to own layer
  await morph.whenRendered();

  const { document, window } = morph.env.domEnv;
  const node = morph.renderPreview({ ...opts, asNode: true }); let dataURI;
  const wrapper = document.createElement('div');
  const canvas = document.createElement('div');
  const { width, height, type = 'svg' } = opts;

  if (System.get('@system-env').node) { fixNodejs(document, window); }

  // In order for dom-to-image to render the node we need to put it into the DOM.
  // To make sure the specified width and height into which the node is
  // scaled by renderPreview() does not appear to be stretched we also add a
  // "canvas" node as its parent that is of the required width / height.
  // Since creating the rendering does take a moment we add the canvas to a
  // "wrapper" node that is (almost) invisible - otherwise it would visibly pop
  // up

  try {
    wrapper.style.overflow = 'hidden';
    wrapper.style.width = '1px';
    wrapper.style.height = '1px';
    wrapper.style.position = 'absolute';

    document.body.appendChild(wrapper);
    wrapper.appendChild(canvas);
    canvas.appendChild(node);

    const domBounds = width && height ? null : node.getBoundingClientRect();
    if (!width) canvas.style.width = Math.ceil(domBounds.width + morph.borderWidth * 2) + 'px';
    if (!height) canvas.style.height = Math.ceil(domBounds.height + morph.borderWidth * 2) + 'px';

    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const method = typeMethodMap[type] || 'toSvg';
    const dataUrl = await domToImage[method](canvas, {
      style: {
        transform: 'scale(.7)',
        'transform-origin': 'center'
      }
    }); // returns data URI
    return dataUrl;
  } finally {
    morph.renderOnGPU = actualRenderOnGPU;
    wrapper.parentNode && wrapper.parentNode.removeChild(wrapper);

    for (const [htmlMorph, { domNode, parentNode }] of htmlMorphRestoreMap) {
      if (domNode && parentNode && domNode.parentNode !== parentNode) { parentNode.appendChild(domNode); }
    }
  }
}
