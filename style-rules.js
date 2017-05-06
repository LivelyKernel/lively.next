import { arr, obj } from "lively.lang";
import { isFunction, isObject } from "lively.lang/object.js";
import { Sizzle } from './sizzle.js';
import { pushIfNotIncluded } from "lively.lang/array.js";
import { ShadowObject } from "lively.morphic";

export class StyleSheet {

  constructor(rules) {
    this.rules = rules;
  }

  set context(morph) {
    this._context = morph;
    this.styledMorphs = [];
    this.sizzle = new Sizzle(morph);
    this.context.withAllSubmorphsDo(m => {
       m._styleSheetProps = null;
       m.makeDirty();
    });
  }

  get context() { return this._context }

  unwrapNestedProps(props) {
    ["borderRadius", "borderWidth", "borderColor"].forEach(p => {
      if (p in props) {
        ["Right", 'Left', 'Top', 'Bottom'].forEach(side => {
           props[p + side] = props[p];
        })
      }
    });
  }

  refreshMorphsFor(rule) {
    for (let morph of this.sizzle.select(rule)) {
       morph._styleSheetProps = null;
       morph._transform = null;
       morph.makeDirty();
    }
  }

  removeRule(rule) {
    delete this.rules[rule];
    this.refreshMorphsFor(rule);
  }

  setRule(rule, props) {
    this.rules[rule] = props;
    this.refreshMorphsFor(rule);
  }

  getStyleProps(morph) {
    var props = {}, rule;
    for (rule in this.rules) {
      if (this.sizzle.matches(rule, morph)) {
        props = {...props, ...this.rules[rule]};
      }
    }
    this.unwrapNestedProps(props)
    if ("layout" in props) {
      let layout = props.layout.copy();
      layout.container = morph;
      props.layout = layout;
    }
    if ("dropShadow" in props) {
      props.dropShadow = new ShadowObject(props.dropShadow);
      props.dropShadow.morph = morph;
    }
    props.layout && props.layout.scheduleApply();
    if (morph._cachedTextBounds) {
      morph._cachedTextBounds = null;
      if (morph.autoFit) morph._needsFit = true;
    }
    return props;
  }

}
