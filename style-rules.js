import { arr, obj } from "lively.lang";
import { isFunction, isObject } from "lively.lang/object.js";
import { Sizzle } from './sizzle.js';
import { pushIfNotIncluded } from "lively.lang/array.js";
import { ShadowObject } from "lively.morphic";

/*

Rules define how style properties of morphs within a certain submorph
hierarchy are to be set. Rules are able to identify morphs either via
their name or their morphClasses property. Rules are applied to a morph
(including its submorphs) once a style rule is assigned to it. Rules will
also be refreshed upon a morph in case its name or morphClasses property
is changed. Rules can be nested, where the rule closest to a respective
morph will override the property values of any other rules that affect
that morph.

*/

export class StyleSheet {

  constructor(rules) {
    this.rules = rules;
    this.cachedProps = {};
  }

  set context(morph) {
    this._context = morph;
    this.styledMorphs = [];
    this.sizzle = new Sizzle(morph);
    this.refreshMorph(morph);
  }

  get context() { return this._context }

  refreshMorph(m) {
    m._styleSheetProps = null;
    m._styleSheets = arr.flatten(
      arr.compact(
        [m, ...m.ownerChain()].reverse().map(
          m =>
            m.styleSheets &&
            m.styleSheets.map(ss => {
              if (!ss.context) ss.context = m;
              return ss;
            })
        )
      )
    );
  }

  reset() { this.cachedProps = {} }

  addMorph(m) {
    this.sizzle.addToIndex(m);
    m.withAllSubmorphsDo(m => {
        this.refreshMorph(m); 
    });
  }

  removeMorph(m) {
    delete this.cachedProps[m.id]
    this.sizzle.removeFromIndex(m);
  }

  onMorphChange(morph, change, context) {
    if (!this.context) this.context = context;
    const {selector, args, prop, prevValue, value} = change;
    if (selector == "addMorphAt") {
      this.addMorph(args[0]);
      args[0].withAllSubmorphsDo(m => this.refreshMorph(m));
    } else if (selector == 'remove') {
      morph.withAllSubmorphsDo(m => this.removeMorph(m))
    } else if (prop == "name" || prop == "styleClasses") {
      morph.ownerChain().forEach(m =>  {
         m._styleSheetProps = null;
         delete this.cachedProps[m.id]
      })
      morph.withAllSubmorphsDo(m => {
        this.removeMorph(m); 
      });
      this.addMorph(morph);
    }
  }

  unwrapNestedProps(props) {
    ["borderRadius", "borderWidth", "borderColor"].forEach(p => {
      if (p in props) {
        ["Right", 'Left', 'Top', 'Bottom'].forEach(side => {
           props[p + side] = props[p];
        })
      }
    });
  }

  getStyleProps(morph) {
    var props;
    if (props = this.cachedProps[morph.id]) {
      return props;
    }
    props = {};
    for (let rule in this.rules) {
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
    this.cachedProps[morph.id] = props;
    props.layout && props.layout.apply();
    return props;
  }

}
