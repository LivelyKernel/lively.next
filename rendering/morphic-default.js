import {diff, patch, create} from "virtual-dom";
import bowser from "bowser";
import { num, obj, arr, properties } from "lively.lang";
import { Transform, Color, pt } from "lively.graphics";
import Velocity from "velocity";

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
  
  getBorderRadius({borderRadius: br}) {
    return br && {borderRadius: `${br.top()}px ${br.top()}px ${br.bottom()}px ${br.bottom()}px / ${br.left()}px ${br.right()}px ${br.right()}px ${br.left()}px`};
  }
  
  getBorderStyle({clipMode, borderWidth, borderColor}) {
    return (clipMode == "hidden") ?
            borderWidth && {border: `${borderWidth}px solid ${borderColor ? borderColor.toString() : "transparent"}`} :
            borderWidth && {"box-shadow": `inset 0 0 0 ${borderWidth}px ${borderColor ? borderColor.toString() : "transparent"}`}
  }
  
  getFill({fill}) {
    return fill && {backgroundColor: fill.toString()}
  }
  
  getExtentStyle({width, height, extent}) {
    if(width && height) return {width: width + 'px', height: height + 'px'};
    if(extent) return {width: extent.x + 'px', height: extent.y + 'px'};
    return null;
  }
  
  getShadowStyle(morph) {
    return morph.dropShadow && {WebkitFilter: shadowCss(morph), filter: shadowCss(morph)}
  }
  
  maskProps(morph) {
    var {
      position, origin, scale, rotation,
      origin, visible, borderRadius,clipMode, borderWidth, borderColor,
      fill, extent, opacity, dropShadow, isSvgMorph
    } = morph;
    
    return {
      position, origin, scale, rotation, opacity, dropShadow, isSvgMorph,
      origin, visible, borderRadius,clipMode, borderWidth, borderColor,
      fill, extent, ...morph._animationQueue.maskedProps
    }
  }
  
  getStyleProps(morph) {
    return {
      ...this.getFill(morph),
      ...this.getTransform(morph),
      ...this.getTransformOrigin(morph),
      ...this.getDisplay(morph),
      ...this.getExtentStyle(morph),
      ...this.getBorderStyle(morph),
      ...this.getBorderRadius(morph),
      ...this.getShadowStyle(morph),
      ...(morph.opacity != null && {opacity: morph.opacity})
    }
  }
  
  getStylePropsMasked(morph) {
    return this.getStyleProps(this.maskProps(morph));
  }
}

class VelocityStyleMapper extends StyleMapper {
  
  getFill({fill, isSvgMorph}) {
    const [r,g,b,a] = (!isSvgMorph && fill && fill.toTuple8Bit()) || [];
    return fill && !isSvgMorph && {
            backgroundColorGreen: g,
            backgroundColorRed: r,
            backgroundColorBlue: b,
            backgroundColorAlpha: a}
  }
  
  getTransform({position, origin, rotation, scale}) {
    var   translateX, translateY, rotateZ, scaleX, scaleY, velocityProps = {};
    
    if (position) {
      origin = origin || pt(0,0);
      velocityProps.translateX = translateX = `${position.x - origin.x}px`;
      velocityProps.translateY = translateY = `${position.y - origin.y}px`;
    }
    
    if (rotation != null) {
      velocityProps.rotateZ = rotateZ = `${num.toDegrees(rotation)}deg`;
    }
    
    if (scale != null) {
      velocityProps.scaleX = scaleX = scale; 
      velocityProps.scaleY = scaleY = scale;
    }
    
    return velocityProps;
  }
  
}

// classes do not seem to inherit static members
// forcing us to create singletons
const plainStyleMapper = new StyleMapper(),
      velocityStyleMapper = new VelocityStyleMapper();

export class AnimationQueue {
  
  constructor(morph) {
    this.morph = morph;
    this.animations = [];
  }
  
  get maskedProps() {
    return obj.merge(this.animations.map(a => a.maskedProps));
  }
  
  get animationsActive() { return Velocity != undefined }
  
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
  
  get easing() { return this.config.easing || "easeInOutQuint" }
  get onFinish() { return this.config.onFinish || (() => {})}
  get duration() { return this.config.duration || 1000 }
  
  getAnimationProps() {
    const before = velocityStyleMapper.getStylePropsMasked(this.morph),
          after = velocityStyleMapper.getStyleProps(this.morph),
          res = {};
    for (var prop in before) {
      if (!obj.equals(after[prop], before[prop])) res[prop] = [after[prop], before[prop]];
    }
    return res;
  }
  
  assignProps() {
    for (var prop in this.changedProps) {
        this.morph[prop] = this.changedProps[prop];
    }
  }
  
  start(node) {
    if(Velocity && !this.active) {
      this.active = true;
      Velocity.animate(node, this.getAnimationProps(), 
                       {easing: this.easing,
                        duration: this.duration,
                        complete: () => {
                          this.finish();
                        }})
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
    ...plainStyleMapper.getStylePropsMasked(morph),
    position: "absolute",
    overflow: clipMode,
    "pointer-events": reactsToPointer ? "auto" : "none",
    cursor: nativeCursor
  };
}

// Sets the scroll later...
// See https://github.com/Matt-Esch/virtual-dom/blob/dcb8a14e96a5f78619510071fd39a5df52d381b7/docs/hooks.md
// for why this has to be a function of prototype
function ScrollHook(morph) { this.morph = morph; }
ScrollHook.prototype.hook = function(node, propertyName, previousValue) {
  if (!this.morph.isClip()) return;
  Promise.resolve().then(() => {
    const {x, y} = this.morph.scroll;
    node.scrollTop !== y && (node.scrollTop = y);
    node.scrollLeft !== x && (node.scrollLeft = x);
  });
}

function animationHook(morph) {
  const Animation = function() {};
  Animation.prototype.hook = (node) => {
    morph._animationQueue.startAnimationsFor(node);
  }
  return new Animation();
}

export function defaultAttributes(morph) {
  return {
    animation: animationHook(morph),
    key: morph.id,
    id: morph.id,
    className: morph.styleClasses.join(" "),
    draggable: false,

    // rk 2016-09-13: scroll issues: just setting the scroll on the DOM node
    // doesn't work b/c of https://github.com/Matt-Esch/virtual-dom/issues/338
    // check the pull request mentioned in the issue, once that's merged we
    // might be able to remove the hook
    // scrollLeft: morph.scroll.x, scrollTop: morph.scroll.y,
    "set-scroll-hook": new ScrollHook(morph)
  };
}

function shadowCss(morph) {
  var x = 1,
      y = 1,
      r = morph.rotation;
  r = (r + (2 * Math.PI)) % (2 * Math.PI);
  if (2*Math.PI >= r && r >= 1.5*Math.PI) {
    x = 1 - (((2*Math.PI - r)/(Math.PI/2)) * 2);
    y = 1;
  } else if (1.5*Math.PI >= r && r >= Math.PI) {
    x = -1;
    y = 1 - (((1.5*Math.PI - r)/(Math.PI/2)) * 2);
  } else if (Math.PI >= r && r >= (Math.PI/2)) {
    x = 1 + (((Math.PI/2 - r)/(Math.PI/2)) * 2);
    y = -1
  } else if (Math.PI/2 >= r && r >= 0) {
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
}
