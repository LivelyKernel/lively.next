import vdom from "virtual-dom";

var {h, diff, patch, create} = vdom;


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
    fill, borderWidth, borderColor, borderRadius: br,
    clipMode,
    reactsToPointer
  } = morph;

  var shapedStyle = Object.assign(

    {
      position: "absolute",
      visibility: visible ? "visible" : "hidden",
      left: x + 'px',
      top: y + 'px',
      width: width + 'px',
      height: height + 'px',
      backgroundColor: fill ? fill.toString() : "",
      border: `${borderWidth}px ${borderColor ? borderColor.toString() : "transparent"} solid`,
      borderRadius: `${br.top()}px ${br.top()}px ${br.bottom()}px ${br.bottom()}px / ${br.left()}px ${br.right()}px ${br.right()}px ${br.left()}px`,
      overflow: clipMode,
      "pointer-events": reactsToPointer ? "auto" : "none"
    },

    morph.dropShadow ? {
      WebkitFilter: "drop-shadow(5px 5px 5px rgba(0, 0, 0, 0.36))",
      WebkitTransition: "-webkit-filter 0.5s"
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
