import { Color } from 'lively.graphics';
import { string, Path } from 'lively.lang';
import bowser from 'bowser';
// addPathAttributes
// addStyleProps
// addSvgAttributes

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
  if (morph.blur) style.filter = `${style.filter || ''} blur(${morph.blur}px)`;
  if (morph.opacity != null) style.opacity = morph.opacity;
  if (morph.draggable && !morph.isWorld) style['touch-action'] = 'none';
  // on ios touch-action is an undocumented html attribute and can not be set via css
  return style;
}

export function canBePromotedToCompositionLayer (morph) {
  return (morph.renderOnGPU || (morph.dropShadow && !morph.dropShadow.fast) || morph.grayscale > 0) && !Path('owner.layout.renderViaCSS').get(morph);
}

export function addTransform (morph, style) {
  const { position, origin, scale, rotation, flipped, tilted, perspective, owner } = morph;
  let x = (position.x - origin.x - (morph._skipWrapping && owner ? owner.borderWidthLeft : 0));
  let y = (position.y - origin.y - (morph._skipWrapping && owner ? owner.borderWidthTop : 0));
  const promoteToCompositionLayer = canBePromotedToCompositionLayer(morph);
  x = morph.renderOnGPU ? x : Math.round(x);
  y = morph.renderOnGPU ? y : Math.round(y);
  if (promoteToCompositionLayer) {
    style.willChange = 'transform';
  }
  if ((owner && owner.isText && !Path('layout.renderViaCSS').get(owner)) || promoteToCompositionLayer) {
    style.transform = (promoteToCompositionLayer ? `translate(${x}px, ${y}px)` : `translate(${x}px, ${y}px)`);
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

function addTransformOrigin (morph, style) {
  const { origin } = morph;
  if (origin) style.transformOrigin = `${origin.x}px ${origin.y}px`;
}

function addDisplay (morph, style) {
  const { visible } = morph;
  if (visible != null) style.display = visible ? '' : 'none';
}

function addBorderRadius (morph, style) {
  const { borderRadiusTopLeft, borderRadiusTopRight, borderRadiusBottomRight, borderRadiusBottomLeft } = morph;
  style.borderRadius = `${borderRadiusTopLeft}px ${borderRadiusTopRight}px ${borderRadiusBottomRight}px ${borderRadiusBottomLeft}px`;
}

function addBorder (morph, style) {
  const {
    borderWidthLeft, borderColorLeft, borderStyleLeft,
    borderWidthRight, borderColorRight, borderStyleRight, borderColor,
    borderWidthBottom, borderColorBottom, borderStyleBottom,
    borderWidthTop, borderColorTop, borderStyleTop
  } = morph;
  const t = (s) => bowser.safari ? string.camelize(s) : s;
  style[t('border-left-style')] = `${borderStyleLeft}`;
  style[t('border-right-style')] = `${borderStyleRight}`;
  style[t('border-bottom-style')] = `${borderStyleBottom}`;
  style[t('border-top-style')] = `${borderStyleTop}`;
  style[t('border-left-width')] = `${borderWidthLeft}px`;
  style[t('border-right-width')] = `${borderWidthRight}px`;
  style[t('border-bottom-width')] = `${borderWidthBottom}px`;
  style[t('border-top-width')] = `${borderWidthTop}px`;
  style[t('border-top-color')] = borderColorTop ? borderColorTop.toString() : 'transparent';
  style[t('border-right-color')] = borderColorRight ? borderColorRight.toString() : 'transparent';
  style[t('border-bottom-color')] = borderColorBottom ? borderColorBottom.toString() : 'transparent';
  style[t('border-left-color')] = borderColorLeft ? borderColorLeft.toString() : 'transparent';
  if (borderColor && borderColor.isGradient) style['border-image'] = borderColor.toString();
}

function addFill (morph, style) {
  const { fill } = morph;
  if (!fill) {
    style.background = Color.transparent.toString();
    return;
  }
  if (fill.isGradient) style.backgroundImage = fill.toString();
  else style.background = fill.toString();
}

function addExtentStyle (morph, style) {
  const { extent } = morph;
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
    style.boxShadow = dropShadow ? dropShadow.toCss() : 'none';
  } else {
    style.boxShadow = '';
    style.filter = dropShadow ? dropShadow.toFilterCss() : '';
  }
}

export function addSvgAttributes (morph, style) {
  const { width, height, borderWidth } = morph;
  style.width = width || 1;
  style.height = height || 1;
  style.viewBox = [0, 0, width || 1, height || 1].join(' ');
  return style;
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
    const { isSmooth, controlPoints: { previous: p, next: n } } = vertex;
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
    ? fill.isGradient ? 'url(#gradient-fill' + id + ')' : fill.toString()
    : 'transparent';
  style.stroke = borderColor.valueOf().isGradient
    ? 'url(#gradient-borderColor' + id + ')'
    : borderColor.valueOf().toString();
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
