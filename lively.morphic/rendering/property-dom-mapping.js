/* eslint-disable no-use-before-define */
import { Color } from 'lively.graphics';
import { string, num } from 'lively.lang';
import { defaultAttributes } from './morphic-default';
import bowser from 'bowser';

const propsToDelete = [
  'padding-left',
  'padding-right',
  'margin-bottom',
  'margin-top',
  'margin',
  'gap',
  'background',
  'background-image',
  'clip-path',
  'place-content',
  'flex-flow', 'flex-grow', 'flex-shrink',
  'align-items', 'align-self',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  'justify-self',
  'display',
  'order',
  'overflow',
  'width', 'height',
  'top', 'left', 'right', 'bottom', 'position',
  'margin-left',
  'margin-right',
  'grid-template-rows',
  'grid-template-columns',
  'will-change',
  'filter',
  'backdrop-filter',
  'z-index'
];

/**
 * Actually applies styles as defined in an Object to a DOM node.
 * @param {Object} styleProps - The styles to apply.
 * @param {Node} node - The DOM node to which to apply `styleProps`.
 * @returns {Node} the DOM node with changed style properties.
 */
export function stylepropsToNode (styleProps, node) {
  const previousStyleProps = node._previousStyleProps || {};
  for (let prop of propsToDelete) {
    if (previousStyleProps[prop] === styleProps[prop]) continue;
    if (prop in styleProps) continue; // not need to reset what we are patching afterwards anyways
    node.style.removeProperty(prop);
  }
  for (let prop in styleProps) {
    if (previousStyleProps[prop] === styleProps[prop]) continue;
    node.style[prop] = styleProps[prop];
  }
  node._previousStyleProps = styleProps;
  return node;
}

/**
 * @see applyStylingToNode
 * @param {Morph} morph
 * @param {Node} node
 */
export function applyAttributesToNode (morph, node) {
  let attrs = defaultAttributes(morph);

  if (typeof morph.renderAttributes === 'function') {
    attrs = morph.renderAttributes(attrs);
  }
  for (let attr in attrs) {
    node.setAttribute(attr, attrs[attr]);
  }
}

/**
   * Helper method that maps the morphic property values to our responding custom CSS classes.
   * @param {String} lineWrapping - a lineWrapping morphic property value
   * @returns {String} A lively.next CSS class name
   */
export function lineWrappingToClass (lineWrapping) {
  switch (lineWrapping) {
    case true:
    case 'by-words': return 'wrap-by-words';
    case 'only-by-words': return 'only-wrap-by-words';
    case 'by-chars': return 'wrap-by-chars';
  }
  return 'no-wrapping';
}

export function styleProps (morph) {
  const style = {};
  addFill(morph, style);
  addTransform(morph, style);
  addTransformOrigin(morph, style);
  addDisplay(morph, style);
  addExtentStyle(morph, style);
  addBorder(morph, style);
  addBorderRadius(morph, style);
  addShadowStyle(morph, style);
  if (morph.grayscale) style.filter = `${style.filter || ''} grayscale(${100 * morph.grayscale}%)`;
  if (morph.blur) {
    if (!morph.blur.backdrop) style.filter = `${style.filter || ''} blur(${morph.blur.value || morph.blur}px)`;
    if (morph.blur.backdrop) {
      style['backdrop-filter'] = `${style['backdrop-filter'] || ''} blur(${morph.blur.value}px)`;
    }
  }
  if (morph.opacity != null) style.opacity = morph.opacity;
  if (morph.draggable && !morph.isWorld) style['touch-action'] = 'none';
  // on ios touch-action is an undocumented html attribute and can not be set via css
  return style;
}

export function canBePromotedToCompositionLayer (morph) {
  return (morph.renderOnGPU ||
         (morph.dropShadow && !morph.dropShadow.fast) || morph.grayscale > 0) &&
        !(morph.isLayoutable && morph.owner?.layout?.renderViaCSS);
}

export function addTransform (morph, style) {
  const { position, origin, scale, rotation, flipped, tilted, perspective, owner } = morph;
  let x = (position.x - origin.x - (morph._skipWrapping && owner ? owner.borderWidthLeft : 0));
  let y = (position.y - origin.y - (morph._skipWrapping && owner ? owner.borderWidthTop : 0));
  const promoteToCompositionLayer = canBePromotedToCompositionLayer(morph);
  x = morph.renderOnGPU ? x : num.roundTo(x, 0.01);
  y = morph.renderOnGPU ? y : num.roundTo(y, 0.01);
  if (promoteToCompositionLayer) {
    style['will-change'] = 'transform';
  }
  if ((owner && owner.isText && !owner.layout?.renderViaCSS) || promoteToCompositionLayer) {
    style.transform = (promoteToCompositionLayer ? `translate(${x}px, ${y}px)` : `translate(${x}px, ${y}px)`);
    style.top = owner?.layout?.renderViaCSS ? '0px' : '';
    style.left = owner?.layout?.renderViaCSS ? '0px' : '';
  } else {
    style.transform = '';
    style.top = `${y}px`;
    style.left = `${x}px`;
  }
  style.transform += ` rotate(${rotation.toFixed(3)}rad) scale(${scale.toFixed(5)},${scale.toFixed(5)})`;
  if (perspective) style.perspective = `${perspective}px`;
  if (flipped) style.transform += ` rotateY(${flipped * 180}deg)`;
  if (tilted) style.transform += ` rotateX(${tilted * 180}deg)`;
}

function addTransformOrigin (morph, style) {
  const { origin } = morph;
  if (origin) style['transform-origin'] = `${origin.x}px ${origin.y}px`;
}

function addDisplay (morph, style) {
  const { visible } = morph;
  if (visible != null) style.display = visible ? '' : 'none';
}

function addBorderRadius (morph, style) {
  const { borderRadiusTopLeft, borderRadiusTopRight, borderRadiusBottomRight, borderRadiusBottomLeft } = morph;
  style['border-radius'] = `${borderRadiusTopLeft}px ${borderRadiusTopRight}px ${borderRadiusBottomRight}px ${borderRadiusBottomLeft}px`;
}

function addBorder (morph, style) {
  const {
    borderWidthLeft, borderColorLeft, borderStyleLeft,
    borderWidthRight, borderColorRight, borderStyleRight, borderColor,
    borderWidthBottom, borderColorBottom, borderStyleBottom,
    borderWidthTop, borderColorTop, borderStyleTop
  } = morph;
  style['border-left-style'] = `${borderStyleLeft}`;
  style['border-right-style'] = `${borderStyleRight}`;
  style['border-bottom-style'] = `${borderStyleBottom}`;
  style['border-top-style'] = `${borderStyleTop}`;
  style['border-left-width'] = `${borderWidthLeft}px`;
  style['border-right-width'] = `${borderWidthRight}px`;
  style['border-bottom-width'] = `${borderWidthBottom}px`;
  style['border-top-width'] = `${borderWidthTop}px`;
  style['border-top-color'] = borderColorTop ? borderColorTop.toP3ColorString() : 'transparent';
  style['border-right-color'] = borderColorRight ? borderColorRight.toP3ColorString() : 'transparent';
  style['border-bottom-color'] = borderColorBottom ? borderColorBottom.toP3ColorString() : 'transparent';
  style['border-left-color'] = borderColorLeft ? borderColorLeft.toP3ColorString() : 'transparent';
  if (borderColor && borderColor.isGradient) style['border-image'] = borderColor.toP3ColorString()();
}

function addFill (morph, style) {
  const { fill } = morph;
  if (!fill) {
    style.background = Color.transparent.toP3ColorString();
    return;
  }
  if (fill.isGradient) {
    // we need to set the background color to something
    // that does not interfere with the opaque fill.
    style.background = Color.transparent.toP3ColorString();
    style['background-image'] = fill.toP3ColorString();
  } else style.background = fill.toP3ColorString();
}

function addExtentStyle (morph, style) {
  const { extent, isWorld, resizePolicy } = morph;
  if (isWorld && resizePolicy === 'elastic') {
    style.width = '100%';
    style.height = '100%';
    return;
  }
  style.width = extent.x + 'px';
  style.height = extent.y + 'px';
}

function shadowCss (morph) {
  return morph.dropShadow ? morph.dropShadow.toFilterCss() : '';
}

function addShadowStyle (morph, style) {
  if (morph.isPath || morph.isImage) { style.filter = shadowCss(morph); return; }

  const { dropShadow } = morph;
  if ((dropShadow && dropShadow.fast) || (dropShadow && dropShadow.inset)) {
    style['box-shadow'] = dropShadow ? dropShadow.toCss() : 'none';
  } else {
    style['box-shadow'] = '';
    style.filter = dropShadow ? dropShadow.toFilterCss() : '';
  }
}

export function getSvgVertices (vertices) {
  let X, Y, lastV;
  let d = '';

  if (vertices.length > 0) {
    lastV = vertices[0];
    const { x, y } = lastV.position;
    X = x; Y = y;
    d = d + `M ${X} ${Y} `;
  }

  for (let i = 1; i < vertices.length - 1; i++) {
    const vertex = vertices[i];
    const { x, y } = vertex.position;
    const { isSmooth, controlPoints: { previous: p } } = vertex;
    d = isSmooth
      ? d + `C ${X + lastV.controlPoints.next.x} ${Y + lastV.controlPoints.next.y} ${x + p.x} ${y + p.y} ${x} ${y} `
      : d + `L ${x} ${y} `;
    lastV = vertex;
    X = x; Y = y;
  }

  if (vertices.length > 0) {
    const { x, y } = vertices[vertices.length - 1].position;
    const { isSmooth, controlPoints: { previous: p } } = vertices[vertices.length - 1];
    d = isSmooth
      ? d + `C ${X + lastV.controlPoints.next.x} ${Y + lastV.controlPoints.next.y} ${x + p.x} ${y + p.y} ${x} ${y}`
      : d + `L ${x} ${y}`;
  }
  return d;
}

export function addPathAttributes (morph, style) {
  const { id, vertices, fill, borderColor, borderWidth } = morph;

  if (vertices.length) {
    style.d = getSvgVertices(vertices);
  }

  addSvgBorderStyle(morph, style);
  style['stroke-width'] = borderWidth.valueOf();
  style.fill = fill
    ? fill.isGradient ? 'url(#gradient-fill' + id + ')' : fill.toP3ColorString()
    : 'transparent';
  style.stroke = borderColor.valueOf().isGradient
    ? 'url(#gradient-borderColor' + id + ')'
    : borderColor.valueOf().toP3ColorString();
  return style;
}

function addSvgBorderStyle (morph, style) {
  const bs = morph.borderStyle.valueOf();
  if (bs === 'dashed') {
    const bw = morph.borderWidth.valueOf();
    style['stroke-dasharray'] = bw * 1.61 + ' ' + bw;
  } else if (bs === 'dotted') {
    const bw = morph.borderWidth.valueOf();
    style['stroke-dasharray'] = '1 ' + bw * 2;
    style['stroke-linecap'] = 'round';
    style['stroke-linejoin'] = 'round';
  }
  return style;
}
