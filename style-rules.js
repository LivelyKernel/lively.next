import { arr, obj } from "lively.lang";

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


export class StyleRules {

  constructor(rules) {
    this.rules = rules;
  }

  applyToAll(root, morph) {
    const removedLayouts = {};
    root.withAllSubmorphsDo(m => {
      removedLayouts[m.id] = m.layout;
      m.layout = null;
    });
    (morph || root).withAllSubmorphsDo(m => this.enforceRulesOn(m));
    root.withAllSubmorphsDo(m => {
      (m.layout = removedLayouts[m.id]) || this.applyLayout(m);
    });
  }

  onMorphChange(morph, change) {
    const {selector, args, prop, prevValue, value} = change;
    if (selector == "addMorphAt") {
      this.applyToAll(morph, args[0]);
    } else if (prop == "name" || prop == "styleClasses") {
      if (prevValue == value)
        return;
      this.enforceRulesOn(morph);
      this.applyLayout(morph);
    }
  }

  getShadowedProps(morph) {
    var props = {}, curr = morph;
    while (curr && curr.styleRules != this) {
      if (curr.styleRules)
        props = {...props, ...curr.styleRules.getStyleProps(morph)};
      curr = curr.owner;
    }
    return ["layout", ...Object.keys(props)];
  }

  getStyleProps(morph) {
    if (this.rules[morph.name]) {
      return this.rules[morph.name]; // name takes precedence over styleClasses
    } else if (morph.styleClasses) {
      return obj.merge(arr.compact(morph.styleClasses.map(c => this.rules[c])));
    }
    return {};
  }

  enforceRulesOn(morph) {
    var styleProps = this.getStyleProps(morph),
      shadowedProps = this.getShadowedProps(morph);
    styleProps &&
      this.applyToMorph(morph, obj.dissoc(styleProps, shadowedProps));
  }

  applyLayout(morph) {
    const layout = this.getStyleProps(morph).layout;
    if (layout)
      morph.layout = layout;
  }

  applyToMorph(morph, styleProps) {
    let {properties} = morph.propertiesAndPropertySettings(),
        sortedKeys = arr.intersect(obj.sortKeysWithBeforeAndAfterConstraints(properties), 
                                   Object.keys(styleProps));
    for (let prop of sortedKeys) {
      morph[prop] = styleProps[prop];
    }
    return morph;
  }
}
