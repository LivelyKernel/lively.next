import vdom from "virtual-dom";

var {h, diff, patch, create} = vdom;

function shadowCss(morph) {
  var x = 1,
      y = 1,
      r = morph.rotation;
  r = (r + (2 * Math.PI)) % (2 * Math.PI);
  if (2*Math.PI > r && r > 1.5*Math.PI) {
    x = 1 - (((2*Math.PI - r)/(Math.PI/2)) * 2);
    y = 1;
  } else if (1.5*Math.PI > r && r > Math.PI) {
    x = -1;
    y = 1 - (((1.5*Math.PI - r)/(Math.PI/2)) * 2);
  } else if (Math.PI > r && r > (Math.PI/2)) {
    x = 1 + (((Math.PI/2 - r)/(Math.PI/2)) * 2);
    y = -1
  } else if (Math.PI/2 > r && r > 0) {
    y = 1 - ((r/(Math.PI/2)) * 2);
  }
  return `drop-shadow(${5 * x}px ${5 * y}px 5px rgba(0, 0, 0, 0.36))`
}

export function renderMorph(morph, renderer) {

  if (!morph.needsRerender()) {
    var rendered = renderer.renderMap.get(morph);
    if (rendered) return rendered;
  }

  morph.aboutToRender();

  var {
    visible,
    position: {x,y},
    extent: {x: width, y: height},
    origin: {x: originX, y: originY},
    fill, borderWidth, borderColor, borderRadius: br,
    clipMode,
    reactsToPointer
  } = morph;

  var shapedStyle = Object.assign(

    {
      transform: morph.getTransform().toCSSTransformString(),
      transformOrigin: `${originX}px ${originY}px `,
      position: "absolute",
      visibility: visible ? "visible" : "hidden",
      width: width + 'px', height: height + 'px',
      backgroundColor: fill ? fill.toString() : "",
      border: `${borderWidth}px ${borderColor ? borderColor.toString() : "transparent"} solid`,
      borderRadius: `${br.top()}px ${br.top()}px ${br.bottom()}px ${br.bottom()}px / ${br.left()}px ${br.right()}px ${br.right()}px ${br.left()}px`,
      overflow: clipMode,
      "pointer-events": reactsToPointer ? "auto" : "none"
    },

    morph.dropShadow ? {
      WebkitFilter: shadowCss(morph)
      // WebkitTransition: "-webkit-filter 0.5s"
    } : null,

    morph.shape().style
  );

  var attributes = Object.assign(
    morph.shape(), {
      id: morph.id,
      className: morph.styleClasses.join(" "),
      draggable: false,
      style: shapedStyle
   });

  var tree = h(
    morph._nodeType, attributes,
    morph.submorphs.map(m => m.render(renderer)));

  renderer.renderMap.set(morph, tree);
  return tree;

}

export function renderRootMorph(world, renderer) {
  if (!world.needsRerender()) return;

  var tree = renderer.renderMap.get(world) || world.render(renderer),
      domNode = renderer.domNode || (renderer.domNode = create(tree, renderer.domEnvironment)),
      newTree = world.render(renderer),
      patches = diff(tree, newTree);

  if (!domNode.parentNode) {
    renderer.rootNode.appendChild(domNode);
    renderer.ensureDefaultCSS();
  }

  patch(domNode, patches);
}
