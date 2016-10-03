import {diff, patch, create} from "virtual-dom";
import bowser from "bowser";
import { num, obj, arr, properties, promise } from "lively.lang";
import { Transform, Color, pt } from "lively.graphics";

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
    return (morph.isSvgMorph || morph.isImage) && {filter: shadowCss(morph)}
  }

  getBoxShadowStyle(morph) {
     return  {
         boxShadow: morph.dropShadow ? 
                    "0px 7px 35px 5px rgba(0,0,0,0.36)" :
                    "0px 0px  0px 0px rgba(0,0,0,0.36)"
     }
  }
  
  maskProps(morph) {
    // rk: What the heck is this?
    var {
      position, origin, scale, rotation,
      origin, visible, clipMode, isImage,
      fill, extent, opacity, dropShadow, isSvgMorph,
      borderWidthLeft, borderColorLeft, borderStyleLeft,
      borderWidthRight, borderColorRight, borderStyleRight,
      borderWidthBottom, borderColorBottom, borderStyleBottom,
      borderWidthTop, borderColorTop, borderStyleTop,
      borderRadiusLeft, borderRadiusRight, borderRadiusBottom, borderRadiusTop
    } = morph;
    
    return {
      position, origin, scale, rotation, opacity, dropShadow, isSvgMorph,
      origin, visible, clipMode, fill, extent, isImage, 
      borderWidthLeft, borderColorLeft, borderStyleLeft,
      borderWidthRight, borderColorRight, borderStyleRight,
      borderWidthBottom, borderColorBottom, borderStyleBottom,
      borderWidthTop, borderColorTop, borderStyleTop,
      borderRadiusLeft, borderRadiusRight, borderRadiusBottom, borderRadiusTop,
      ...morph._animationQueue.maskedProps
    }
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

  getShadowProps(morph) {
    const bw = morph.borderWidth || 0;
    return {
      "pointer-events": morph.reactsToPointer ? "auto" : "none",
      display: "inline",
      position: "absolute",
      transform: "translateZ(0)",
      width: morph.extent.x + "px",
      height: morph.extent.y + "px",
      ...(morph.clipMode == "hidden" &&
            {borderColor: "transparent",
             borderStyle: "solid",
             borderWidth: morph.borderWidth + "px",
             width: morph.extent.x - (2 * bw) + "px",
             height: morph.extent.y - (2 * bw) + "px",}),
      overflow: morph.clipMode,
      ...this.getBoxShadowStyle(morph),
      ...this.getBorderRadius(morph)};
  }

  getShadowPropsMasked(morph) {
     return this.getShadowProps(this.maskProps(morph));
  }
  
  getStylePropsMasked(morph) {
    return this.getStyleProps(this.maskProps(morph));
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
  
  get maskedProps() {
    return obj.merge(this.animations.map(a => a.maskedProps));
  }
  
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
  
  get easing() { return "cubic-bezier(.86,0,.07,1)" }
  get onFinish() { return this.config.onFinish || (() => {})}
  get duration() { return this.config.duration || 1000 }
  
  getAnimationProps() {
    var before = plainStyleMapper.getStylePropsMasked(this.morph),
        after = plainStyleMapper.getStyleProps(this.morph);
    for (var prop in before) {
      if (obj.equals(after[prop], before[prop])) {
         delete before[prop];
         delete after[prop];
      }
    }
    return [before, after];
  }
  
  assignProps() {
    for (var prop in this.changedProps) {
        this.morph[prop] = this.changedProps[prop];
    }
  }

  getShadowAnimationProps() {
     var before = plainStyleMapper.getShadowPropsMasked(this.morph),
         after = plainStyleMapper.getShadowProps(this.morph),
         needed = false;
     for (var prop in before) {
       if (!obj.equals(after[prop], before[prop])) needed = true;
     }
     return !(this.morph.isImage || this.morph.isSvgMorph) && needed && [before, after];
  }
  
  start(node) {
    if(node.animate && !this.active) {
      this.active = true;
      let shadowNode = getShadowNode(node),
          shadowAnimationProps = this.getShadowAnimationProps();
      if (shadowNode && shadowAnimationProps) {
         let anim = shadowNode.animate(shadowAnimationProps,
                           {easing: this.easing,
                            duration: this.duration});
         anim.onfinish = () => {
             this.finish();
             this.morph.makeDirty();
         }
      } else if (shadowAnimationProps) {
         // node is about to be mounted, so postpone animation for next frame
         this.active = false;
         this.morph.makeDirty();
         return;
      }
      let animationProps = this.getAnimationProps();
      if (animationProps) {
         let anim = node.animate(animationProps, 
                       {easing: this.easing,
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

export function shadowNodeStyle(morph) {
   return plainStyleMapper.getShadowProps(morph)
}

export function defaultStyle(morph) {

  const {
    opacity, clipMode, reactsToPointer,
    nativeCursor,     
  } = morph;

  return {
    ...plainStyleMapper.getStylePropsMasked(morph),
    position: "absolute",
    "pointer-events": reactsToPointer ? "auto" : "none",
    cursor: nativeCursor
  };
}

function getShadowNode(node) {
   return node.querySelector("#" + node.id + "-shadow");
}

// Sets the scroll later...
// See https://github.com/Matt-Esch/virtual-dom/issues/338 for why that is necessary.
// See https://github.com/Matt-Esch/virtual-dom/blob/dcb8a14e96a5f78619510071fd39a5df52d381b7/docs/hooks.md
// for why this has to be a function of prototype
function MorphAfterRenderHook(morph, renderer) { this.morph = morph; this.renderer = renderer; }
MorphAfterRenderHook.prototype.hook = function(node, propertyName, previousValue) {
  // 1. wait for node to be really rendered, i.e. it's in DOM
  // this.morph._dirty = false;
  this.renderer.requestAnimationFrame(() => {
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
  });
}
MorphAfterRenderHook.prototype.updateScroll = function(morph, node) {
  node = getShadowNode(node) || node;
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
    className: morph.styleClasses.join(" "),
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
            `drop-shadow(0px 5px 10px rgba(0, 0, 0, 0.4))` : 
            `drop-shadow(0px 0px 0px rgba(0, 0, 0, 0.4))`;
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
}
