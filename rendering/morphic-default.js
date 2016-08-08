import {diff, patch, create} from "virtual-dom";
import { num } from "lively.lang";
import { Transform } from "lively.graphics"

export function defaultStyle(morph) {
  const {
    visible,
    position: {x,y},
    extent: {x: width, y: height},
    origin, opacity, position, scale, rotation,
    fill, borderWidth, borderColor, borderRadius: br,
    clipMode, reactsToPointer, focusable,
    owner
  } = morph;
  
  return {
    position: "absolute",
    transform: `translate(${position.x - origin.x}px, ${position.y - origin.y}px) rotate(${num.toDegrees(rotation)}deg) scale(${scale},${scale})`,
    transformOrigin: `${origin.x}px ${origin.y}px`,
    opacity,
    display: visible ? "" : "none",
    width: width + 'px', height: height + 'px',
    background: fill ? fill.toString() : "",
    ...((clipMode == "hidden") ? 
          {border: `${borderWidth}px solid ${borderColor ? borderColor.toString() : "transparent"}`} :
          {"box-shadow": `inset 0 0 0 ${borderWidth}px ${borderColor ? borderColor.toString() : "transparent"}`}),
    borderRadius: `${br.top()}px ${br.top()}px ${br.bottom()}px ${br.bottom()}px / ${br.left()}px ${br.right()}px ${br.right()}px ${br.left()}px`,
    overflow: clipMode,
    "pointer-events": reactsToPointer ? "auto" : "none",
    cursor: morph.nativeCursor,
    ...(morph.dropShadow ? {
      WebkitFilter: shadowCss(morph)
    } : null)
  };
}

export function defaultAttributes(morph) {
  return {
    key: morph.id,
    id: morph.id,
    className: morph.styleClasses.join(" "),
    draggable: false,
    tabIndex: morph.focusable ? 1 : -1,
   };
}

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

export function renderRootMorph(world, renderer) {
  if (!world.needsRerender()) return;

  var tree = renderer.renderMap.get(world) || renderer.render(world),
      domNode = renderer.domNode || (renderer.domNode = create(tree, renderer.domEnvironment)),
      newTree = renderer.render(world),
      patches = diff(tree, newTree);

  if (!domNode.parentNode) {
    renderer.rootNode.appendChild(domNode);
    renderer.ensureDefaultCSS();
  }

  patch(domNode, patches);

  while (renderer.afterRenderCallTargets.length) {
    var morph = renderer.afterRenderCallTargets.shift(),
        node = renderer.domEnvironment.document.getElementById(morph.id);
    morph.onAfterRender(node);
  }
}
