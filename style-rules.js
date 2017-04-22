import { arr, obj } from "lively.lang";
import { isFunction, isObject } from "lively.lang/object.js";

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


export class StyleSheetRegistry {

  static getStyleSheet(name) {
    var ss;
    $world.withAllSubmorphsDetect(m => {
      ss = m.styleSheets && m.styleSheets.find(ss => ss.name == name);
      return ss;
    });
    return ss;
  }

  static getStyledMorphsFor(name) {
    return $world.withAllSubmorphsSelect(
      m => m.styleSheets && m.styleSheets.find(ss => ss.name == name)
    );
  }
  
}

export class StyleSheet {

  /* If the style sheet is created with a name, 
     the name will be used as an identifier to
     track down all the instances that the
     Style Sheet is being used in the system.
     Updates to the style sheet will then
     ensure that the rules are being updated
     everywhere the style sheet with that name 
     has been used */

  constructor(name, rules) {
    if (obj.isString(name)) this.name = name;
    if (obj.isObject(name)) this.rules = name; 
    // if rules are not propvided by the name is given, we will lookup the existing style
    if (this.name && !rules) this.rules = StyleSheetRegistry.getStyleSheet(this.name).rules;
    // if rules and name are given, we will ensure that these rules serve as the new 
    // standard for all style sheets in the world name that way
    if (rules && name) this.propagateRules(rules)
  }

  propagateRules(newRules) {
    //  currently slow, since we refrain from using an index
    this.rules = newRules;
    this.name && $world.withAllSubmorphsDo(
      m => {
        let ss = m.styleSheets && m.styleSheets.find(ss => ss.name == this.name);
        if (ss) ss.rules = newRules;
      }
    );
  }

  applyToAll(root, morph) {
    const removedLayouts = {};
    root.withAllSubmorphsDo(m => {
      removedLayouts[m.id] = m.layout;
      m.layout = null;
    });
    (morph || root).withAllSubmorphsDo(m => this.enforceRulesOn(m, root));
    root.withAllSubmorphsDo(m => {
      (m.layout = removedLayouts[m.id]) || this.applyLayout(m);
    });
  }

  onMorphChange(morph, change, root) {
    const {selector, args, prop, prevValue, value} = change;
    if (selector == "addMorphAt") {
      this.applyToAll(morph, args[0]);
    } else if (prop == "name" || prop == "styleClasses") {
      debugger;
      if (prevValue == value)
        return;
      this.enforceRulesOn(morph, root);
      this.applyLayout(morph);
    }
  }

  getShadowedProps(morph, root) {
    var props = {}, curr = morph;
    while (curr && curr != root) {
      if (curr.styleSheets)
        props = {...props, ...obj.merge(curr.styleSheets.map(r => r.getStyleProps(morph)))};
      curr = curr.owner;
    }
    return ["layout", ...Object.keys(props)];
  }

  getStyleProps(morph) {
    var props = {};
    if (morph.styleClasses) {
      props = obj.merge(arr.compact(morph.styleClasses.map(c => this.rules[c])));
    }

    if (this.rules[morph.name]) {
      props = {...props, ...this.rules[morph.name]};
    }
    return props;
  }

  enforceRulesOn(morph, root) {
    var styleProps = this.getStyleProps(morph),
      shadowedProps = this.getShadowedProps(morph, root);
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
