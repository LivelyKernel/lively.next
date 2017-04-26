import { arr, obj } from "lively.lang";
import { isFunction, isObject } from "lively.lang/object.js";
import { Sizzle } from './sizzle.js';

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

  /* If the style sheet is created with a name, 
     the name will be used as an identifier to
     track down all the instances that the
     Style Sheet is being used in the system.
     Updates to the style sheet will then
     ensure that the rules are being updated
     everywhere the style sheet with that name 
     has been used */

  constructor(rules) {
    this.rules = rules;
  }

  applyToAll(root, morph) {
    const sizzle = new Sizzle();
    this.removedLayouts = [];
    this._styledMorphs = this._styledMorphs || [];
    root.withAllSubmorphsDo(m => {
      if (m.layout) {
        this.removedLayouts.push([m, m.layout]);
        m.layout = null;
      }
    });
    for (let rule in this.rules) {
      arr.flatten(sizzle.select(rule, root))
         .filter(m => !this._styledMorphs.includes(m.id))
         .forEach(m => {
            this.applyToMorph(m, this.rules[rule], true); 
            this._styledMorphs.push(m.id);
          });
    }
    this.removedLayouts.forEach(([m, l]) => {m.layout = l});
  }

  onMorphChange(morph, change, root) {
    const {selector, args, prop, prevValue, value} = change;
    if (selector == "addMorphAt") {
        // further apply rules to the submorph hierarcht of the morph
        // find a way to sizzle the morph
      //args[0].withAllSubmorphsDo(m => this.enforceRulesOn(m, root));
      this.applyToAll(root, args[0]);
    } else if (prop == "name" || prop == "styleClasses") {
      if (prevValue == value) return;
      this.enforceRulesOn(morph, root);
    }
  }

  getStyleProps(morph) {
    var props = {}, sizzle = new Sizzle(), 
        owners = [morph, ...morph.ownerChain()];
    for (let rule in this.rules) {
      if (morph == sizzle.select(rule, owners)[0]) {
        props = {...props, ...this.rules[rule]};
      }
    }
    return props;
  }

  enforceRulesBetween(morph, root) {
    var props = {}, curr = morph;
    while (curr && curr != root) {
      curr.applyStyleSheets();
      curr = curr.owner;
    }
  }

  enforceRulesOn(morph, root) {
    var styleProps = this.getStyleProps(morph);
    styleProps && this.applyToMorph(morph, styleProps);
    this.enforceRulesBetween(morph, root) 
  }

  applyToMorph(morph, styleProps, skipLayouts=false) {
    let {properties} = morph.propertiesAndPropertySettings(),
        sortedKeys = arr.intersect(obj.sortKeysWithBeforeAndAfterConstraints(properties), 
                                   Object.keys(styleProps));
    for (let prop of sortedKeys) {
      if (skipLayouts && prop == 'layout' && styleProps[prop]) {  
        this.removedLayouts.push([morph, styleProps[prop]]);
      } else {
        morph[prop] = styleProps[prop];
      }
    }
    return morph;
  }
}
