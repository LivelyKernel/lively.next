import {diff, patch, create} from "virtual-dom";
import "gsap";
import { num, obj, arr, properties, promise } from "lively.lang";
import { Color, pt, Point } from "lively.graphics";
import { config } from "../index.js";

export class ShadowObject {

    constructor(args) {
        if (obj.isBoolean(args)) args = config.defaultShadow;
        const {rotation, distance, blur, color, morph} = args;
        this.rotation = obj.isNumber(rotation) ? rotation : 45; // in degrees
        this.distance = obj.isNumber(distance) ? distance : 2;
        this.blur = obj.isNumber(blur) ? blur : 6;
        this.color = color || Color.gray.darker();
        this.morph = morph;
    }

    get distance() { return this._distance }
    get blur() { return this._blur }
    get rotation() { return this._rotation }
    get color() { return this._color }

    set distance(d) {
       this._distance = d;
       if (this.morph) this.morph.dropShadow = this;
    }

    set blur(b) {
       this._blur = b;
       if (this.morph) this.morph.dropShadow = this;
    }

    set rotation(r) {
       this._rotation = r;
       if (this.morph) this.morph.dropShadow = this;
    }

    set color(c) {
       this._color = c;
       if (this.morph) this.morph.dropShadow = this;
    }

    get isShadowObject() { return true; }
    
    toCss() {
       const {x, y} = Point.polar(this.distance, num.toRadians(this.rotation));
       return `${this.color.toString()} ${x}px ${y}px ${this.blur}px`
    }

    toFilterCss() {
       const {x, y} = Point.polar(this.distance, num.toRadians(this.rotation));
       return `drop-shadow(${x}px ${y}px ${this.blur}px ${this.color.toString()})`;
    }

}

class StyleMapper {

  static getTransform({position, origin, scale, rotation}) {
    return {
       transform: `translate3d(${(position.x - origin.x).toFixed(2)}px, ${(position.y - origin.y).toFixed(2)}px, 0px) rotate(${num.toDegrees(rotation).toFixed(2)}deg) scale(${scale.toFixed(2)},${scale.toFixed(2)})`}
  }

  static getTransformOrigin({origin}) {
    return origin && {transformOrigin: `${origin.x}px ${origin.y}px`};
  }

  static getDisplay({visible}) {
    return (visible != null) && {display: visible ? "inline" : "none"};
  }

  static getBorderRadius({borderRadiusLeft, borderRadiusRight, borderRadiusBottom, borderRadiusTop}) {
    return {borderRadius: `${borderRadiusTop}px ${borderRadiusTop}px ${borderRadiusBottom}px ${borderRadiusBottom}px / ${borderRadiusLeft}px ${borderRadiusRight}px ${borderRadiusRight}px ${borderRadiusLeft}px`};
  }

  static getBorder({borderWidthLeft, borderColorLeft, borderStyleLeft,
             borderWidthRight, borderColorRight, borderStyleRight, borderColor,
             borderWidthBottom, borderColorBottom, borderStyleBottom,
             borderWidthTop, borderColorTop, borderStyleTop}) {
    return {
      "border-left-style":   `${borderStyleLeft}`,
      "border-right-style":  `${borderStyleRight}`,
      "border-bottom-style": `${borderStyleBottom}`,
      "border-top-style":    `${borderStyleTop}`,
      "border-left-width":   `${borderWidthLeft}px`,
      "border-right-width":  `${borderWidthRight}px`,
      "border-bottom-width": `${borderWidthBottom}px`,
      "border-top-width":    `${borderWidthTop}px`,
      "border-top-color": borderColorTop ? borderColorTop.toString() : "transparent",
      "border-right-color": borderColorRight ? borderColorRight.toString() : "transparent",
      "border-bottom-color": borderColorBottom ? borderColorBottom.toString() : "transparent",
      "border-left-color": borderColorLeft ? borderColorLeft.toString() : "transparent",
      ...(borderColor && borderColor.isGradient) ? {"border-image": borderColor.toString()} : {}
    }
  }

  static getFill({fill}) {
    return fill && {background: fill.toString()}
  }

  static getExtentStyle({width, height, extent}) {
    if(width && height) return {width: width + 'px', height: height + 'px'};
    if(extent) return {width: extent.x + 'px', height: extent.y + 'px'};
    return null;
  }

  static getShadowStyle(morph) {
    if (morph.isSvgMorph || morph.isImage) return {filter: shadowCss(morph)}
    return {boxShadow: morph.dropShadow ?
                    morph.dropShadow.toCss():
                    "none"}
  }

  static getSvgAttributes({width, height, borderWidth}) {
     return {width: width || 1, height: height || 1, 
             viewBox: [0, 0, width || 1, height || 1].join(" ")};
  }

  static getPathAttributes(path, fill=false) {
     var vertices = path.vertices.map(({x,y,controlPoints}) => {
              return {controlPoints, ...path.origin.addXY(x, y)}
         }),
         {x: startX, y: startY, controlPoints: {next: {x: startNextX, y: startNextY}}} = arr.first(vertices),
           startNext = pt(startX + startNextX, startY + startNextY),
          {x: endX, y: endY, controlPoints: {previous: {x: endPrevX, y: endPrevY}}} = arr.last(vertices),
           endPrev = pt(endX + endPrevX, endY + endPrevY),
           interVertices = vertices.slice(1, -1);
     return {"stroke-width": path.borderWidth, ...this.getSvgBorderStyle(path), 
             fill: path.fill ? ((path.fill.isGradient) ? "url(#gradient-fill" + path.id + ")" : path.fill.toString()) 
                               : "transparent",
             "paint-order": "stroke", 
             stroke: (path.borderColor.isGradient ? "url(#gradient-borderColor" + path.id + ")" : path.borderColor.toString()),
              d: "M" + `${startX}, ${startY} ` + "C " + `${startNext.x}, ${startNext.y} ` + 
                  interVertices.map(({x,y, controlPoints: {previous: p, next: n}}) => {
                    return `${x + p.x},${y + p.y} ${x},${y} C ${x + n.x},${y + n.y}`
                  }).join(" ") + ` ${endPrev.x},${endPrev.y} ${endX},${endY}`
              }
  }

  static getSvgBorderStyle(svg) {
      const style = {
          solid: {},
          dashed: {"stroke-dasharray": svg.borderWidth * 1.61 + " " + svg.borderWidth},
          dotted: {"stroke-dasharray": "1 " + svg.borderWidth * 2,"stroke-linecap": "round", "stroke-linejoin": "round",}
      }
      return style[svg.borderStyle];
  }

  static getStyleProps(morph) {
    return {
      ...this.getFill(morph),
      ...this.getTransform(morph),
      ...this.getTransformOrigin(morph),
      ...this.getDisplay(morph),
      ...this.getExtentStyle(morph),
      ...this.getBorder(morph),
      ...this.getBorderRadius(morph),
      ...this.getShadowStyle(morph),
      ...(morph.opacity != null && {opacity: morph.opacity})
    }
  }

}

export class AnimationQueue {

  constructor(morph) {
    this.morph = morph;
    this.animations = [];
  }

  maskedProps(type) { 
     const l = this.animations.length;
     if (l > 0) {
        return obj.merge(this.animations.map(a => a.getAnimationProps(type)[0]));
     } else {
        return {}
     } 
  }

  get animationsActive() { return true }

  registerAnimation(config) {
    const anim = new PropertyAnimation(this, this.morph, config);
    return this.morph.withMetaDo({animation: anim}, () => {
      if (!this.animations.find(a => a.equals(anim)) && anim.affectsMorph) {
        anim.assignProps();
        this.animations.push(anim);
        return anim;
      }
    })
  }

  startAnimationsFor(node) { this.animations.forEach(anim => anim.start(node)); }
  startSvgAnimationsFor(svgNode, type) { this.animations.forEach(anim => anim.startSvg(svgNode, type)) }

  removeAnimation(animation) {
    arr.remove(this.animations, animation);
  }

}

export class PropertyAnimation {

  constructor(queue, morph, config) {
    this.queue = queue;
    this.morph = morph;
    this.config = this.convertBounds(config);
    this.needsAnimation = {svg: morph.isSvgMorph, path: morph.isPath, polygon: morph.isPolygon};
  }

  asPromise() {
     return new Promise((resolve, reject) => {
         this.resolvePromise = () => {
              this.onFinish(this);
              resolve(this.morph);             
         }
     })
  }

  finish() {
    this.queue.removeAnimation(this);
    this.resolvePromise ? this.resolvePromise() : this.onFinish();
  }

  convertBounds(config) {
    var {bounds, origin, rotation, scale, layout} = config,
         origin = origin || this.morph.origin,
         rotation = rotation || this.morph.rotation,
         scale = scale || this.morph.scale;
    if (bounds) {
      return {...obj.dissoc(config, ["bounds"]),
              origin, rotation, scale,
              position: bounds.topLeft().addPt(origin),
              extent: bounds.extent()};
    } else {
      return config
    }
  }

  equals(animation) {
    return obj.equals(this.changedProps, animation.changedProps);
  }

  get affectsMorph() {
    return properties.any(this.changedProps, (changedProps, prop) => !obj.equals(changedProps[prop], this.morph[prop]));
  }

  get changedProps() {
    return obj.dissoc(this.config, ["easing", "onFinish", "duration"]);
  }

  get easing() { return this.config.easing || "easeInOutQuint" }
  get onFinish() { return this.config.onFinish || (() => {})}
  set onFinish(cb) { this.config.onFinish = cb }
  get duration() { return this.config.duration || 1000 }


  getChangedProps(before, after) {
    const unchangedProps = [];
    for (var prop in before) {
      if (obj.equals(after[prop], before[prop])) {
         unchangedProps.push(prop);
      }
    }
    return [obj.dissoc(before, unchangedProps), 
            obj.dissoc(after, unchangedProps)];
  }

  getAnimationProps(type) {
    const [before, after] = this.getChangedProps(this.beforeProps[type], this.afterProps[type]);
    // FIXME: properly interpolate vertices if there are control points added removed....
    // if (before.d) {
    //     // var before_d = before.d.splitBy(" "), after_d = after.d.splitBy(" ");
    //     // repeat last element until points are of equal number
    // }
    // if (before.points) {
    //     // var before_points = before.points.splitBy(" "), after_points = after.points.splitBy(" ");
    //     // repeat last element until points are of equal number
    // }
     return [obj.isEmpty(before) ? false : before, obj.isEmpty(after) ? false : after]
  }

  gatherAnimationProps() {
     return {css: StyleMapper.getStyleProps(this.morph),
             svg: this.morph.isSvgMorph && StyleMapper.getSvgAttributes(this.morph),
             path: this.morph.isPath && StyleMapper.getPathAttributes(this.morph),
             polygon: this.morph.isPolygon && StyleMapper.getPathAttributes(this.morph)}
  }

  assignProps() {
    this.beforeProps = this.gatherAnimationProps();
    Object.assign(this.morph, this.changedProps);
    this.afterProps = this.gatherAnimationProps();
  }

  startSvg(svgNode, type) {
     if (this.needsAnimation[type]) {
       this.needsAnimation[type] = false;
       const [before, after] = this.getAnimationProps(type);
       this.tween(svgNode, {attr: before}, {attr: after});
     }
  }

  start(node) {
    if (!this.active) {
      this.active = true;
      let [before, after] = this.getAnimationProps("css");
      this.tween(node, before, after);
    }
  }

  tween(node, before, after) {
      const onComplete = () => {
         this.finish();
         this.morph.makeDirty();
      };
      if (TweenMax && before && after) {
        TweenMax.fromTo(node, this.duration / 1000, 
                   before,
                  {...after,
                   ease: this.easing,
                   overwrite: false,
                   onComplete});
      } else {
         onComplete();
      }
  }
}

export function defaultStyle(morph) {

  const {
    opacity, clipMode, reactsToPointer,
    nativeCursor,
  } = morph;

  return {
    ...StyleMapper.getStyleProps(morph),
    ...morph._animationQueue.maskedProps("css"),
    position: "absolute",
    overflow: clipMode,
    "pointer-events": reactsToPointer ? "auto" : "none",
    cursor: nativeCursor
  };
}

// Sets the scroll later...
// See https://github.com/Matt-Esch/virtual-dom/issues/338 for why that is necessary.
// See https://github.com/Matt-Esch/virtual-dom/blob/dcb8a14e96a5f78619510071fd39a5df52d381b7/docs/hooks.md
// for why this has to be a function of prototype
function MorphAfterRenderHook(morph, renderer) { this.morph = morph; this.renderer = renderer; }
MorphAfterRenderHook.prototype.hook = function(node, propertyName, previousValue) {
  // 1. wait for node to be really rendered, i.e. it's in DOM
  // this.morph._dirty = false;
  promise.waitFor(400, () => !!node.parentNode).catch(err => false).then(isInDOM => {
    if (isInDOM) {
      // 2. update scroll of morph itself
      // 3. Update scroll of DOM nodes of submorphs
      if (this.morph._submorphOrderChanged && this.morph.submorphs.length) {
        this.morph._submorphOrderChanged = false;
        this.updateScrollOfSubmorphs(this.morph, this.renderer);
      } else if (this.morph.isClip()) this.updateScroll(this.morph, node);
    }
    this.morph._rendering = false; // see morph.makeDirty();
  });
}
MorphAfterRenderHook.prototype.updateScroll = function(morph, node) {
  // interactiveScrollInProgress: see morph.onMouseWheel
  var { interactiveScrollInProgress } = morph.env.eventDispatcher.eventState.scroll;
  if (interactiveScrollInProgress)
    return interactiveScrollInProgress.then(() => this.updateScroll(morph,node));

  if (node) {
    const {x, y} = morph.scroll;
    node.scrollTop !== y && (node.scrollTop = y);
    node.scrollLeft !== x && (node.scrollLeft = x);
  }
}
MorphAfterRenderHook.prototype.updateScrollOfSubmorphs = function(morph, renderer) {
  morph.submorphs.forEach(m => {
    if (m.isClip())
      this.updateScroll(m, renderer.getNodeForMorph(m))
    this.updateScrollOfSubmorphs(m, renderer);
  });
}



// simple toplevel constructor, not a class and not wrapped for efficiency
function Animation(morph) { this.morph = morph; };
Animation.prototype.hook = function(node) {
  this.morph._animationQueue.startAnimationsFor(node);
}

export function SvgAnimation(morph, type) { this.morph = morph; this.type = type; };
SvgAnimation.prototype.hook = function(node) {
  this.morph._animationQueue.startSvgAnimationsFor(node, this.type);
}


export function defaultAttributes(morph, renderer) {
  return {
    animation: new Animation(morph),
    key: morph.id,
    id: morph.id,
    className: (morph.hideScrollbars ?
                morph.styleClasses.concat("hiddenScrollbar") :
                morph.styleClasses).join(" "),
    draggable: false,

    // rk 2016-09-13: scroll issues: just setting the scroll on the DOM node
    // doesn't work b/c of https://github.com/Matt-Esch/virtual-dom/issues/338
    // check the pull request mentioned in the issue, once that's merged we
    // might be able to remove the hook
    // scrollLeft: morph.scroll.x, scrollTop: morph.scroll.y,
    "morph-after-render-hook": new MorphAfterRenderHook(morph, renderer)
  };
}

export function svgAttributes(svg) {
  return {
    animation: new SvgAnimation(svg, "svg"),
    attributes: {
      ...StyleMapper.getSvgAttributes(svg),
      ...svg._animationQueue.maskedProps("svg")
    }
  };
}

export function pathAttributes(path) {
  return {
    animation: new SvgAnimation(path, "path"),
    attributes: {
      ...StyleMapper.getPathAttributes(path),
      ...path._animationQueue.maskedProps("path")
    }
  };
}

function shadowCss(morph) {
  return morph.dropShadow ?
            morph.dropShadow.toFilterCss() :
            `drop-shadow(0px 0px 0px rgb(120, 120, 120))`;
}

function initDOMState(renderer, world) {
  renderer.rootNode.appendChild(renderer.domNode);
  renderer.ensureDefaultCSS()
    .then(() => promise.delay(500))
    .then(() => world.env.fontMetric.reset())
    .then(() => world.withAllSubmorphsDo(ea => (ea.isText || ea.isLabel) && ea.forceRerender()))
    .catch(err => console.error());
}

export function renderMorph(morph, renderer = morph.env.renderer) {
  // helper that outputs a dom element for the morph, independent from the
  // morph being rendered as part of a world or not. The node returned *is not*
  // the DOM node that represents the morph as part of its world! It's a new node!
  return create(morph.render(renderer));
}

export function renderRootMorph(world, renderer) {
  if (!world.needsRerender()) return;

  var tree = renderer.renderMap.get(world) || renderer.render(world),
      domNode = renderer.domNode || (renderer.domNode = create(tree, renderer.domEnvironment)),
      newTree = renderer.render(world),
      patches = diff(tree, newTree);

  if (!domNode.parentNode) initDOMState(renderer, world);

  patch(domNode, patches);
}
