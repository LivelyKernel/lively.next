import { arr, tree, obj } from "lively.lang";
import { Color, pt, rect, LinearGradient } from "lively.graphics";
import { connect, once, signal, disconnect } from "lively.bindings";
import { easings } from "./rendering/animations.js";
import { Sizzle, SizzleVisitor, SizzleExpression } from "./sizzle.js";
import { ShadowObject, CustomLayout, Button, Text, Icon, HorizontalLayout, morph, Morph, config} from "./index.js";

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

  toggleRule(rule) {
    this.rules[rule]._deactivated = !this.rules[rule]._deactivated;
    this.context.requestStyling();
  }

  applicableRules() {
    let ar = {};
    for (let rule in this.rules) {
      ar[rule] = [this, rule];
    }
    return ar;
  }

  applyRule(rule, morph) {
    var props = {}, rule = this.rules[rule];
    if (rule._deactivated) return;
    props = obj.dissoc(rule, ['_deactivated']);
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
    let prevValues = obj.select(morph, obj.keys(rule))
    Object.assign(morph, props);
    return prevValues;
  }
}
