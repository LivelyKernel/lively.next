import {diff, patch, create} from "virtual-dom";
import bowser from "bowser";
import { num, obj, arr, properties, promise } from "lively.lang";
import { Transform, Color, pt } from "lively.graphics";
import { Morph } from '../index.js';

class StyleMapper {

  getTransform({position, origin, scale, rotation}) {
    return {transform: `translateX(${position.x - origin.x}px) translateY(${position.y - origin.y}px) rotate(${num.toDegrees(rotation)}deg) scale(${scale},${scale})`}
  }

  getTransformOrigin({origin}) {
    return origin && {transformOrigin: `${origin.x}px ${origin.y}px`};
  }

  getDisplay({visible}) {
    return (visible != null) && {display: visible ? "inline" : "none"};
  }

  getBorderRadius({borderRadiusLeft, borderRadiusRight, borderRadiusBottom, borderRadiusTop}) {
    return {borderRadius: `${borderRadiusTop}px ${borderRadiusTop}px ${borderRadiusBottom}px ${borderRadiusBottom}px / ${borderRadiusLeft}px ${borderRadiusRight}px ${borderRadiusRight}px ${borderRadiusLeft}px`};
  }

  getBorder({borderWidthLeft, borderColorLeft, borderStyleLeft,
             borderWidthRight, borderColorRight, borderStyleRight,
             borderWidthBottom, borderColorBottom, borderStyleBottom,
             borderWidthTop, borderColorTop, borderStyleTop}) {
    return {
      "border-left":   `${borderWidthLeft}px   ${borderStyleLeft}   ${borderColorLeft ? borderColorLeft.toString() : "transparent"}`,
      "border-right":  `${borderWidthRight}px  ${borderStyleRight}  ${borderColorRight ? borderColorRight.toString() : "transparent"}`,
      "border-bottom": `${borderWidthBottom}px ${borderStyleBottom} ${borderColorBottom ? borderColorBottom.toString() : "transparent"}`,
      "border-top":    `${borderWidthTop}px    ${borderStyleTop}    ${borderColorTop ? borderColorTop.toString() : "transparent"}`
    }
  }

  getFill({fill}) {
    return fill && {background: fill.toString()}
  }

  getExtentStyle({width, height, extent}) {
    if(width && height) return {width: width + 'px', height: height + 'px'};
    if(extent) return {width: extent.x + 'px', height: extent.y + 'px'};
    return null;
  }

  getShadowStyle(morph) {
    if (morph.isSvgMorph || morph.isImage) return {filter: shadowCss(morph)}
    return {boxShadow: morph.dropShadow ?
                    "0px 2px 6px #333" :
                    "none"}
  }

  getStyleProps(morph) {
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

// classes do not seem to inherit static members
// forcing us to create singletons
const plainStyleMapper = new StyleMapper();

export class AnimationQueue {

  constructor(morph) {
    this.morph = morph;
    this.animations = [];
  }

  get animationsActive() { return true }

  registerAnimation(config) {
    const anim = new PropertyAnimation(this, this.morph, config);
    if (!this.animations.find(a => a.equals(anim)) && anim.affectsMorph) {
      anim.assignProps();
      this.animations.push(anim);
      return anim;
    }
  }

  startAnimationsFor(node) { this.animations.forEach(anim => anim.start(node)); }

  removeAnimation(animation) {
    arr.remove(this.animations, animation);
  }

}

export class PropertyAnimation {

  constructor(queue, morph, config) {
    this.queue = queue;
    this.morph = morph;
    this.config = this.convertBounds(config);
    // we assume that all of the visual morph properties are values,
    // meaning that we can safely consider them immutable for the
    // time they are witheld from being rendered
    this.maskedProps = obj.select(morph, properties.own(this.changedProps));
  }

  finish() {
    this.queue.removeAnimation(this);
    this.onFinish();
  }

  convertBounds(config) {
    var {bounds, origin, rotation, scale} = config,
         origin = origin || pt(0,0),
         rotation = rotation || 0,
         scale = scale || 1;
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

  get easing() { return this.config.easing || "cubic-bezier(.86,0,.07,1)" }
  get onFinish() { return this.config.onFinish || (() => {})}
  get duration() { return this.config.duration || 1000 }

  getAnimationProps() {
    for (var prop in this.beforeProps) {
      if (obj.equals(this.afterProps[prop], this.beforeProps[prop])) {
         delete this.beforeProps[prop];
         delete this.afterProps[prop];
      }
    }
    return [this.beforeProps, this.afterProps];
  }

  assignProps() {
    this.beforeProps = plainStyleMapper.getStyleProps(this.morph);
    for (var prop in this.changedProps) {
        this.morph[prop] = this.changedProps[prop];
    }
    this.afterProps = plainStyleMapper.getStyleProps(this.morph);
  }

  start(node) {
    if(node.animate && !this.active) {
      this.active = true;
      let animationProps = this.getAnimationProps();
      if (animationProps) {
         let anim = node.animate(animationProps,
                       {easing: this.easing,
                        fill: "none",
                        duration: this.duration});
         anim.onfinish = () => {
             this.finish();
             anim.cancel();
             this.morph.makeDirty();
         }
      }
    } else {
      this.onFinish();
    }
  }
}

export function defaultStyle(morph) {

  const {
    opacity, clipMode, reactsToPointer,
    nativeCursor,
  } = morph;

  return {
    ...plainStyleMapper.getStyleProps(morph),
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
      if (this.morph.isClip()) this.updateScroll(this.morph, node);
      // 3. Update scroll of DOM nodes of submorphs
      if (this.morph._submorphOrderChanged && this.morph.submorphs.length) {
        this.morph._submorphOrderChanged = false;
        this.updateScrollOfSubmorphs(this.morph, this.renderer);
      }
    }
    this.morph._rendering = false; // see morph.makeDirty();
  });
}
MorphAfterRenderHook.prototype.updateScroll = function(morph, node) {
  // interactiveScrollInProgress: see morph.onMouseWheel
  var { interactiveScrollInProgress } = morph.env.eventDispatcher.eventState.scroll;
  if (interactiveScrollInProgress)
    return interactiveScrollInProgress.then(() =>
      this.updateScroll(morph,node));

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

export function defaultAttributes(morph, renderer) {
  return {
    animation: new Animation(morph),
    key: morph.id,
    id: morph.id,
    className: morph.styleClasses.concat([morph.hideScrollbars ? "hiddenScrollbar" : null]).join(" "),
    draggable: false,

    // rk 2016-09-13: scroll issues: just setting the scroll on the DOM node
    // doesn't work b/c of https://github.com/Matt-Esch/virtual-dom/issues/338
    // check the pull request mentioned in the issue, once that's merged we
    // might be able to remove the hook
    // scrollLeft: morph.scroll.x, scrollTop: morph.scroll.y,
    "morph-after-render-hook": new MorphAfterRenderHook(morph, renderer)
  };
}

function shadowCss(morph) {
  return morph.dropShadow ?
            `drop-shadow(0px 5px 10px rgb(120, 120, 120))` :
            `drop-shadow(0px 0px 0px rgb(120, 120, 120))`;
}

export function renderRootMorph(world, renderer) {
  if (!world.needsRerender()) return;

  var tree = renderer.renderMap.get(world) || renderer.render(world),
      domNode = renderer.domNode || (renderer.domNode = create(tree, renderer.domEnvironment)),
      newTree = renderer.render(world),
      patches = diff(tree, newTree);

  if (!domNode.parentNode) {
    renderer.rootNode.appendChild(domNode);
    if (world.env.fontMetric)
      renderer.ensureDefaultCSS().then(() =>
        world.env.fontMetric.reset());
  }

  patch(domNode, patches);
}
