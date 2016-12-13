import {arr, obj, properties} from "lively.lang";

export class StyleRules {

   /*
      Rules define how style properties of morphs within a certain
      submorph hierarchy are to be set.
      Rules are able to identify morphs either via their name or their
      morphClasses property.
      Rules are applied to a morph (including its submorphs) 
      once a style rule is assigned to it.
      Rules will also be refreshed upon a morph in case 
      its name or morphClasses property is changed.
      Rules can be nested, where the rule closest to a respective morph
      will override the property values of any other rules that affect that morph.
   */
   
   constructor(rules) {
      this.rules = rules;
   }

   applyToAll(root) {
      const removedLayouts = {};
      root.withAllSubmorphsDo(m => { removedLayouts[m.id] = m.layout; m.layout = null });
      root.withAllSubmorphsDo(m => this.enforceRulesOn(m));
      root.withAllSubmorphsDo(m => {
         (m.layout = removedLayouts[m.id]) || this.applyLayout(m);
      });
      
   }

   onMorphChange(morph, {selector, args, prop}) {
    if (selector == "addMorphAt") {
        this.applyToAll(args[0]);
    } else if (prop == "name" || prop == "morphClasses") {
        this.enforceRulesOn(morph);
        this.applyLayout(morph);
    }
  }

  getShadowedProps(morph) {
     var props  = {}, curr = morph;
     while (curr && curr.styleRules != this) {
         if (curr.styleRules) props = {...props, ...curr.styleRules.getStyleProps(morph)}
         curr = curr.owner;
     }
     return ["layout", ...Object.keys(props)];
  }

  getStyleProps(morph) {
    if (this.rules[morph.name]) {
          return this.rules[morph.name]; // name overrides morphClasses
    } else if (morph.morphClasses) {
          return obj.merge(arr.compact(morph.morphClasses.map(c => this.rules[c])));
    }
    return {}
  }

   enforceRulesOn(morph) {
     var styleProps = this.getStyleProps(morph), 
         shadowedProps = this.getShadowedProps(morph);
     styleProps && this.applyToMorph(morph, obj.dissoc(styleProps, shadowedProps));
   }

   applyLayout(morph) {
      const layout = this.getStyleProps(morph).layout;
      if (layout) morph.layout = layout;
   }

   applyToMorph(morph, styleProps) {
     return Object.assign(morph, styleProps);
   }
   
}
