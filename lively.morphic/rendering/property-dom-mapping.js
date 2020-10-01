import config from "../config.js";
import { pt, Color } from "lively.graphics";
import { arr, num, string } from "lively.lang";
import bowser from 'bowser';
// addPathAttributes
// addStyleProps
// addSvgAttributes

export function styleProps(morph) {
  let style = {};
  addFill(morph, style);
  addTransform(morph, style);
  addTransformOrigin(morph, style);
  addDisplay(morph, style);
  addExtentStyle(morph, style);
  addBorder(morph, style);
  addBorderRadius(morph, style);
  addShadowStyle(morph, style);
  if (morph.grayscale) style.filter = `${style.filter || ''} grayscale(${100 * morph.grayscale}%)`;
  if (morph.blur) style.filter = `${style.filter || ''} blur(${morph.blur}px)`;
  if (morph.opacity != null) style.opacity = morph.opacity;
  if (morph.draggable && !morph.isWorld) style['touch-action'] = 'none';
  // on ios touch-action is an undocumented html attribute and can not be set via css
  return style;
}

export function addTransform(morph, style) {
  let {position, origin, scale, rotation, flipped, tilted, perspective} = morph,
      idx = morph.__stackIdx__ || 0,
      x = Math.round(position.x - origin.x),
      y = Math.round(position.y - origin.y),
      promoteToCompositionLayer = morph.renderOnGPU || (morph.dropShadow && !morph.dropShadow.fast) || morph.grayscale > 0;
  if ((morph.owner && morph.owner.isText) || promoteToCompositionLayer) {
    style.transform = (promoteToCompositionLayer ? `translate3d(${x}px, ${y}px, ${idx}px)` : `translate(${x}px, ${y}px)`);
  } else {
    style.transform = '';
    style.top = `${y}px`;
    style.left = `${x}px`;
  }
  style.transform += ` rotate(${rotation.toFixed(2)}rad) scale(${scale.toFixed(5)},${scale.toFixed(5)})`;
  if (perspective) style.perspective = `${perspective}px`;
  if (flipped) style.transform += ` rotateY(${flipped * 180}deg)`;
  if (tilted) style.transform += ` rotateX(${tilted * 180}deg)`;
}

function addTransformOrigin(morph, style) {
  let {origin} = morph;
  if (origin) style.transformOrigin = `${origin.x}px ${origin.y}px`;
}

function addDisplay(morph, style) {
  let {visible} = morph
  if (visible != null) style.display = visible ? "" : "none";
}

function addBorderRadius(morph, style) {
  let {borderRadiusLeft, borderRadiusRight, borderRadiusBottom, borderRadiusTop} = morph;
  style.borderRadius = `${borderRadiusTop}px ${borderRadiusTop}px ${borderRadiusBottom}px ${borderRadiusBottom}px / ${borderRadiusLeft}px ${borderRadiusRight}px ${borderRadiusRight}px ${borderRadiusLeft}px`;
}

function addBorder(morph, style) {
  let {borderWidthLeft, borderColorLeft, borderStyleLeft,
       borderWidthRight, borderColorRight, borderStyleRight, borderColor,
       borderWidthBottom, borderColorBottom, borderStyleBottom,
       borderWidthTop, borderColorTop, borderStyleTop} = morph;
  let t = (s) => bowser.safari ? string.camelize(s) : s;
    style[t("border-left-style")] =   `${borderStyleLeft}`;
    style[t("border-right-style")] =  `${borderStyleRight}`;
    style[t("border-bottom-style")] = `${borderStyleBottom}`;
    style[t("border-top-style")] =    `${borderStyleTop}`;
    style[t("border-left-width")] =   `${borderWidthLeft}px`;
    style[t("border-right-width")] =  `${borderWidthRight}px`;
    style[t("border-bottom-width")] = `${borderWidthBottom}px`;
    style[t("border-top-width")] =    `${borderWidthTop}px`;
    style[t("border-top-color")] =    borderColorTop ? borderColorTop.toString() : "transparent";
    style[t("border-right-color")] =  borderColorRight ? borderColorRight.toString() : "transparent";
    style[t("border-bottom-color")] = borderColorBottom ? borderColorBottom.toString() : "transparent";
    style[t("border-left-color")] =   borderColorLeft ? borderColorLeft.toString() : "transparent";
    if (borderColor && borderColor.isGradient) style["border-image"] = borderColor.toString()

}

function addFill(morph, style) {
  let {fill} = morph;
  if (!fill) {
    style.background = Color.transparent.toString()
    return;
  }
  if (fill.isGradient) style.backgroundImage = fill.toString()
  else style.background = fill.toString();
}

function addExtentStyle(morph, style) {
  let {extent} = morph;
  style.width = extent.x + 'px';
  style.height = extent.y + 'px';
}

function shadowCss(morph) {
  return morph.dropShadow ? morph.dropShadow.toFilterCss() : ``;
}

function addShadowStyle(morph, style) {
  if (morph.isSvgMorph || morph.isImage) { style.filter = shadowCss(morph); return; }

  let {dropShadow} = morph
  if ((dropShadow && dropShadow.fast) || (dropShadow && dropShadow.inset)) {
    style.boxShadow = dropShadow ? dropShadow.toCss() : "none"
  } else {
    style.filter = dropShadow ? dropShadow.toFilterCss() : ""
  }
}

export function addSvgAttributes(morph, style) {
  let {width, height, borderWidth} = morph;
  style.width = width || 1;
  style.height = height || 1;
  style.viewBox = [0, 0, width || 1, height || 1].join(" ");
  return style;
}

export function getSvgVertices(vertices) {
  let X, Y, lastV;
  let d = '';

  if (vertices.length > 0) {
    lastV = vertices[0];
    let {x, y} = lastV.position;
    X = x; Y = y;
    d = d + `M ${X} ${Y} `
  }

  for (let i = 1; i < vertices.length-1; i++) {
    let vertex = vertices[i],
        {x, y} = vertex.position,
        {isSmooth, controlPoints: {previous: p, next: n}} = vertex;
    d = isSmooth ?
      d + `C ${X + lastV.controlPoints.next.x} ${Y + lastV.controlPoints.next.y} ${x + p.x} ${y + p.y} ${x} ${y} ` :
      d + `L ${x} ${y} `
    lastV = vertex;
    X = x; Y = y
  }

  if (vertices.length > 0) {
    let { x, y } = vertices[vertices.length-1].position;
    let {isSmooth, controlPoints: {previous: p}} = vertices[vertices.length-1];
    d = isSmooth ?
      d + `C ${X + lastV.controlPoints.next.x} ${Y + lastV.controlPoints.next.y} ${x+p.x} ${y+p.y} ${x} ${y}` :
      d + `L ${x} ${y}`;
  }
  return d;
}

export function addPathAttributes(morph, style) {
  let { id, vertices, fill, borderColor, borderWidth } = morph;

  if (vertices.length) {
    style.d = getSvgVertices(vertices)
  }

  addSvgBorderStyle(morph, style);
  style["stroke-width"] = borderWidth.valueOf();
  style.fill = fill ?
                fill.isGradient ? "url(#gradient-fill" + id + ")" : fill.toString() :
                "transparent";
  style.stroke = borderColor.valueOf().isGradient
                  ? "url(#gradient-borderColor" + id + ")"
                  : borderColor.valueOf().toString();
  return style;
}

function addSvgBorderStyle(morph, style) {
  const bs = morph.borderStyle.valueOf();
  if (bs === "dashed") {
    const bw = morph.borderWidth.valueOf();
    style["stroke-dasharray"] = bw * 1.61 + " " + bw;
  } else if (bs === "dotted") {
    const bw = morph.borderWidth.valueOf();
    style["stroke-dasharray"] = "1 " + bw * 2
    style["stroke-linecap"] = "round";
    style["stroke-linejoin"] = "round";
  }
  return style;
}
