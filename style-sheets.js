import { arr, obj } from "lively.lang";
import { rect } from "lively.graphics";
import { ShadowObject, morph } from "./index.js";
import { printNested, printTree, print } from "lively.lang/string.js";

// THE MODEL

export class StyleSheet {

  constructor(name, rules) {
    if (obj.isObject(name) && !rules) {
      rules = name;
      name = null;
    }
    this.rules = rules;
    for (let rule in rules) rules[rule] = this.unwrapFoldedProps(rules[rule]);
    this.name = name;
  }

  copy() {
    let copiedRules = {};
    for (let rule in this.rules) {
       copiedRules[rule] = {...this.rules[rule]};
    }
    return new StyleSheet(this.name, copiedRules)
  }

  get __only_serialize__() {
    return ['rules', 'context'];
  }

  set context(morph) {
    this._context = morph;
  }

  get context() { return this._context }

  unwrapFoldedProps(props) {
    ["borderRadius", "borderWidth", "borderColor", "borderStyle"].forEach(p => {
      if (p in props) {
        let v = props[p];
        if (!v) v = 0;
        props[p] = arr.intersect(obj.keys(v), ["top", "left", "bottom", "right"]).length == 4
          ? v : { top: v, bottom: v, right: v, left: v, valueOf: () => v };
      }
    });
    return props;
  }

  removeRule(rule) {
    delete this.rules[rule];
    this.context.requestStyling();
  }

  setRule(rule, props) {
    this.rules[rule] = this.unwrapFoldedProps(props);
    this.context.requestStyling();
  }

  toggleRule(rule, active) {
    this.rules[rule]._deactivated = !active;
    this.context.requestStyling();
  }

  applicableRules() {
    let ar = {};
    for (let rule in this.rules) {
      ar[rule] = {styleSheet: this, rule};
    }
    return ar;
  }

  //this.toJSExpr()

  toJSExpr() {
    const customPrinter = (v, ignore, continueInspectFn) => {
      if (v && v.isColor) {
        return v.toJSExpr();
      }
      if (v && v.isGradient) {
        return v.toJSExpr(); 
      }
      if (v && v.isPoint) {
        return v.toString();
      }
      if (v) {
        let { top, left, right, bottom } = v;
        if (arr.all([top, left, right, bottom], (a) => a && obj.equals(a, v.top))) {
          return continueInspectFn(v.top);
        }
      }
      if (v && obj.keys(v).includes("_rev"))
        return continueInspectFn(obj.dissoc(v, ['_rev', '_deactivated']));
      return ignore;
    }
    return `new StyleSheet(${obj.inspect(this.rules, {customPrinter, escapeKeys: true})})`
  }

  applyRule(rule, morph, anim) {
    var props = this.rules[rule];
    if (props._deactivated) return {};
    props = obj.dissoc(props, ['_deactivated']);
    return morph.withMetaDo({styleSheetChange: true}, () => {
      if ("layout" in props) {
        let layout = props.layout.copy();
        layout.container = morph;
        props.layout = layout;
      }
      if ("dropShadow" in props) {
        props.dropShadow = new ShadowObject(props.dropShadow);
        props.dropShadow.morph = morph;
      }
      if ("padding" in props) {
        props.padding = props.padding.isRect ?
          props.padding : rect(props.padding, props.padding);
      }
      let changedProps = obj.keys(props).filter(key => !obj.equals(morph[key], props[key])),
          newProps = obj.select(props, changedProps),
          {properties} = morph.propertiesAndPropertySettings(),
          prevValues = {};
      for (let key in props) {
         prevValues[key] = (properties[key] && properties[key].defaultValue) || morph[key];
      }
      if (anim) {
        morph.animate({
          ...newProps, duration: anim.duration, easing: anim.easing
        });
      } else {
        Object.assign(morph, newProps);
      }
      return prevValues;
    });
  }
}
