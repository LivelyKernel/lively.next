/*global SVG, System*/
import {obj, properties, arr, string} from "lively.lang";
import {LinearGradient, pt, RadialGradient, rect} from "lively.graphics";
import {styleProps, addPathAttributes, addSvgAttributes} from "./property-dom-mapping.js";
import "web-animations-js";
import "svgjs";
import "svg.easing.js";
import "svg.pathmorphing.js";
// move to lively.lang
function pad(array, n, getPadElement = arr.last) {
   return [...array, ...(new Array(Math.max(n - array.length, 0)).fill(getPadElement(array)))]
}

/*rms 27.11.17: Taken from https://css-tricks.com/snippets/sass/easing-map-get-function/ */

export const easings = {
  inQuad:      'cubic-bezier(0.550,  0.085, 0.680, 0.530)',
  inCubic:     'cubic-bezier(0.550,  0.055, 0.675, 0.190)',
  inQuart:     'cubic-bezier(0.895,  0.030, 0.685, 0.220)',
  inQuint:     'cubic-bezier(0.755,  0.050, 0.855, 0.060)',
  inSine:      'cubic-bezier(0.470,  0.000, 0.745, 0.715)',
  inExpo:      'cubic-bezier(0.950,  0.050, 0.795, 0.035)',
  inCirc:      'cubic-bezier(0.600,  0.040, 0.980, 0.335)',
  inBack:      'cubic-bezier(0.600, -0.280, 0.735, 0.045)',
  outQuad:     'cubic-bezier(0.250,  0.460, 0.450, 0.940)',
  outCubic:    'cubic-bezier(0.215,  0.610, 0.355, 1.000)',
  outQuart:    'cubic-bezier(0.165,  0.840, 0.440, 1.000)',
  outQuint:    'cubic-bezier(0.230,  1.000, 0.320, 1.000)',
  outSine:     'cubic-bezier(0.390,  0.575, 0.565, 1.000)',
  outExpo:     'cubic-bezier(0.190,  1.000, 0.220, 1.000)',
  outCirc:     'cubic-bezier(0.075,  0.820, 0.165, 1.000)',
  outBack:     'cubic-bezier(0.175,  0.885, 0.320, 1.275)',
  inOutQuad:  'cubic-bezier(0.455,  0.030, 0.515, 0.955)',
  inOutCubic: 'cubic-bezier(0.645,  0.045, 0.355, 1.000)',
  inOutQuart: 'cubic-bezier(0.770,  0.000, 0.175, 1.000)',
  inOutQint: 'cubic-bezier(0.860,  0.000, 0.070, 1.000)',
  inOutSine:  'cubic-bezier(0.445,  0.050, 0.550, 0.950)',
  inOutExpo:  'cubic-bezier(1.000,  0.000, 0.000, 1.000)',
  inOutCirc:  'cubic-bezier(0.785,  0.135, 0.150, 0.860)',
  inOutBack:  'cubic-bezier(0.680, -0.550, 0.265, 1.550)'
}

function convertToSvgEasing(easing) {
  for (let k in easings) {
    if (easings[k] !== easing) continue;
    if (k.includes('inOut')) return k.replace('inOut', '').toLowerCase() + 'InOut';
    if (k.includes('out')) return k.replace('out', '').toLowerCase() + 'Out';
    if (k.includes('in')) return k.replace('in', '').toLowerCase() + 'In';
  }
}

export class AnimationQueue {
  constructor(morph) {
    this.morph = morph;
    this.animations = [];
  }

  maskedProps(type) {
    const l = this.animations.length;
    return l > 0 ? obj.merge(this.animations.map(a => a.getAnimationProps(type)[0])) : {};
  }

  get animationsActive() {
    return true;
  }

  registerAnimation(config) {
    const anim = new PropertyAnimation(this, this.morph, config);
    return this.morph.withMetaDo({animation: anim}, () => {
      if (!this.animations.find(a => a.equals(anim)) && anim.affectsMorph) {
        let mergeable;
        if (mergeable = this.animations.find(a => a.canMerge(anim))) {
          mergeable.mergeWith(anim);
          return mergeable;
        } else {
          anim.assignProps();
          this.animations.push(anim);
          return anim; 
        }
      }
    });
  }

  startAnimationsFor(node) {
    for (let i = 0; i < this.animations.length; i++) {
      let anim = this.animations[i];
      anim.start(node);
    }
  }
  startSvgAnimationsFor(svgNode, type) {
    this.animations.forEach(anim => anim.startSvg(svgNode, type));
  }

  removeAnimation(animation) {
    arr.remove(this.animations, animation);
  }
}

export class PropertyAnimation {
  constructor(queue, morph, config) {
    this.queue = queue;
    this.morph = morph;
    this.config = this.convertGradients(this.convertBounds(config));
    this.needsAnimation = {svg: morph.isSvgMorph, path: morph.isPath, polygon: morph.isPolygon};
    this.capturedProperties = obj.select(this.morph, this.propsToCapture);
  }

  get propsToCapture() {
    return ["fill", "origin"];
  }

  asPromise() {
    return new Promise((resolve, reject) => {
      this.resolvePromise = () => {
        this.onFinish(this);
        if (this.subAnimations) {
          this.subAnimations.then(resolve);
        } else {
          resolve(this.morph);
        }
      };
    });
  }

  finish() {
    if (this.config.scale) {
      // when we have been performing a scale animation,
      // there is a possibility that some of the text morphs
      // inside the submorph hierarchy have been measureing their
      // line heights incorrectly
      this.morph.whenRendered().then(() => 
          this.morph.withAllSubmorphsDo(m => m.isText && m.invalidateTextLayout(true, true)));
    }
    this.queue.removeAnimation(this);
    this.resolvePromise ? this.resolvePromise() : this.onFinish();
  }

  convertGradients(config) {
    if (this.morph.isSvgMorph && config.fill) {
      this.morph.fill = config.fill;
      return obj.dissoc(config, ["fill"]);
    }
    if (config.fill && config.fill.isGradient && this.morph.fill.isGradient) {
      var fillBefore = this.morph.fill,
          fillAfter = config.fill,
          d = config.duration || 1000;
      if (fillBefore.type == "linearGradient" && fillAfter.type == "radialGradient") {
        this.subAnimation = (async () => {
          await this.morph.animate({
            fill: new LinearGradient({...fillBefore, vector: rect(0, 0, 0, 1)}),
            duration: d / 2,
            easing: easings.inQuad
          });
          this.morph.fill = new RadialGradient({
            stops: fillBefore.stops,
            focus: pt(0.5, 0),
            bounds: rect(0, 0, this.morph.width * 100, this.morph.height * 2)
          });
          await this.morph.animate({
            fill: fillAfter,
            duration: d / 2,
            easing: easings.outQuad
          });
          return this.morph;
        })();
        return obj.dissoc(config, ["fill"]);
      }
      if (fillBefore.type == "radialGradient" && fillAfter.type == "linearGradient") {
        this.subAnimations = (async () => {
          await this.morph.animate({
            fill: new RadialGradient({
              stops: fillBefore.stops,
              focus: pt(0.5, 0),
              bounds: rect(0, 0, this.morph.width * 100, this.morph.height * 2)
            }),
            duration: d / 2,
            easing: easings.inQuad
          });
          this.morph.fill = new LinearGradient({...fillBefore, vector: rect(0, 0, 0, 1)});
          await this.morph.animate({
            fill: fillAfter,
            duration: d / 2,
            easing: easings.outQuad
          });
          return this.morph;
        })();
        return obj.dissoc(config, ["fill"]);
      }
    }
    return config;
  }

  convertBounds(config) {
    var {bounds, origin, rotation, scale, layout, fill} = config,
        origin = origin || this.morph.origin,
        rotation = rotation || this.morph.rotation,
        scale = scale || this.morph.scale;
    if (bounds) {
      return {
        ...obj.dissoc(config, ["bounds"]),
        origin,
        rotation,
        scale,
        position: bounds.topLeft().addPt(origin),
        extent: bounds.extent()
      };
    } else {
      return config;
    }
  }

  equals(animation) {
    return obj.equals(this.animatedProps, animation.animatedProps);
  }

  canMerge(animation) {
    return this.easing == animation.easing && this.duration == animation.duration;
  }

  mergeWith(animation) {
    Object.assign(this.morph, animation.animatedProps);
    Object.assign(this.config, animation.config);
    this.afterProps = this.gatherAnimationProps();
  }

  get affectsMorph() {
    return properties.any(
      this.animatedProps,
      (animatedProps, prop) => !obj.equals(animatedProps[prop], this.morph[prop])
    );
  }

  get animatedProps() {
    return obj.dissoc(this.config, ["easing", "onFinish", "duration"]);
  }

  get easing() {
    return this.config.easing || easings.inOutQuad;
  }
  get onFinish() {
    return this.config.onFinish || (() => {});
  }
  setonFinish(cb) {
    this.config.onFinish = cb;
  }
  get duration() {
    return this.config.duration || 1000;
  }

  getChangedProps(before, after) {
    const unchangedProps = [];
    for (var prop in before) {
      if (obj.equals(after[prop], before[prop])) {
        unchangedProps.push(prop);
      }
    }
    return [obj.dissoc(before, unchangedProps), obj.dissoc(after, unchangedProps)];
  }

  getAnimationProps(type) {
    const [before, after] = this.getChangedProps(this.beforeProps[type], this.afterProps[type]),
          {fill: fillBefore} = this.capturedProperties,
          {fill: fillAfter} = this.morph;
    if (fillBefore && fillAfter) {
      if (fillBefore.isGradient && fillAfter.isGradient) {
        const numStops = Math.max(fillAfter.stops.length, fillBefore.stops.length),
              beforeStops = pad(fillBefore.stops, numStops),
              beforeGradient = new fillBefore.__proto__.constructor({
                ...fillBefore,
                vector: fillBefore.vector && fillBefore.vectorAsAngle() + 0.00001,
                stops: beforeStops
              }).toString(),
              afterStops = pad(fillAfter.stops, numStops),
              afterGradient = new fillAfter.__proto__.constructor({
                ...fillAfter,
                vector: fillAfter.vector && fillAfter.vectorAsAngle(),
                stops: afterStops
              }).toString();
        before.backgroundImage = beforeGradient;
        after.backgroundImage = afterGradient;
      }
      if (fillBefore.isColor && fillAfter.isGradient) {
        const gradientClass = fillAfter.__proto__.constructor,
              stops = fillAfter.stops,
              solidGradient = new gradientClass({
                ...fillAfter,
                vector: fillAfter.g && fillAfter.vectorAsAngle() + 0.00001,
                stops: stops.map(({offset}) => {
                  return {color: fillBefore, offset};
                })
              }).toString();
        delete before["background"];
        delete after["background"];
        before.backgroundImage = solidGradient;
      }
      if (fillBefore.isGradient && fillAfter.isColor) {
        const g = fillBefore,
              gradientClass = g.__proto__.constructor,
              stops = g.stops,
              originalGradient = new gradientClass({
                ...g,
                vector: g.vector && g.vectorAsAngle() + 0.001,
                stops: g.stops
              }).toString(),
              solidGradient = new gradientClass({
                ...g,
                vector: g.vector && g.vectorAsAngle(),
                stops: stops.map(({offset}) => {
                  return {color: fillAfter, offset};
                })
              }).toString();
        delete after["background"];
        delete before["background"];
        after.backgroundImage = solidGradient;
        before.backgroundImage = originalGradient;
      }
    }
    // ensure that before and after props both have the same keys
    for (let key of arr.union(obj.keys(before), obj.keys(after))) {
      if (!key in before) before[key] = after[key];
      if (!key in after) after[key] = before[key];
    }
    return [obj.isEmpty(before) ? false : before, obj.isEmpty(after) ? false : after];
  }

  gatherAnimationProps() {
    let {morph} = this,
        {isSvgMorph, isPath, isPolygon} = morph,
        props = {};
    props.css = styleProps(this.morph);
    if (isSvgMorph) props.svg = addSvgAttributes(morph, {});
    if (isPath) props.path = addPathAttributes(morph, {});
    if (isPolygon) props.polygon = addPathAttributes(morph, {});
    return props;
  }

  assignProps() {
    this.beforeProps = this.gatherAnimationProps();
    Object.assign(this.morph, this.animatedProps);
    this.afterProps = this.gatherAnimationProps();
  }

  startSvg(svgNode, type) {
    if (this.needsAnimation[type]) {
      this.needsAnimation[type] = false;
      const [before, after] = this.getAnimationProps(type);
      if (before && after) {
        var node = SVG.adopt(svgNode).animate(this.duration, convertToSvgEasing(this.easing));
        if (type == 'svg') {
            let clipPath = node.target().defs().children()[0].children()[0];
            if (clipPath) {
               let [_, clipProps] = this.getAnimationProps('path');
               clipProps.d && clipPath.animate(this.duration, convertToSvgEasing(this.easing)).plot(clipProps.d);
            }
        }
        for (let prop in after) {
          if (prop == "d") {
            node = node.plot(after.d);
            continue;
          }
          if (prop == "viewBox") {
            node = node.viewbox(...after.viewBox.split(" ").map(parseFloat));
            continue;
          }
          node = node.attr(prop, after[prop]);
        }
        node.afterAll(() => {
          this.finish();
          this.morph.makeDirty();
        });
      } else {
         this.finish();
      }
    }
  }

  start(node) {
    if (!this.active) {
      this.active = true;
      let [before, after] = this.getAnimationProps("css");
      this.tween(node, before, after);
      if (this.config.origin) {
        let b = this.capturedProperties.origin,
            a = this.config.origin;
        this.tween(
          node.childNodes[0],
          {
            transform: `translate3d(${b.x}px, ${b.y}px, 0px)`
          },
          {
            transform: `translate3d(${a.x}px, ${a.y}px, 0px)`
          }
        );
      }
    }
  }

  tween(node, before, after, remove = true) {
    let onComplete = () => {
      if (!remove) return;
      this.finish();
      this.morph.makeDirty();
    };
    if (before && after) {
      let camelBefore = {},
          camelAfter = {};
      for (let k in before) camelBefore[string.camelize(k)] = before[k];
      for (let k in after) camelAfter[string.camelize(k)] = after[k];
      let anim = node.animate([camelBefore, camelAfter], {
        duration: this.duration,
        easing: this.easing,
        fill: "forwards",
        composite: "replace"
      });
      anim.onfinish = () => {
        onComplete();
        setTimeout(() => anim.cancel(), 200);
      };
    } else {
      onComplete();
    }
  }
}
