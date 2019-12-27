import { obj, properties, string, arr } from "lively.lang";

export class SizzleExpression {

  static compile(rule, context) {
    return new this(rule, context);
  }

  constructor(rule, context) {
    this.matchStacks = {};
    this.context = context;
    this.compileRule(rule);
  }

  compileRule(rule) {
    this.compiledRule = [];
    for (let token of rule.split(' ')) {
       this.compiledRule.push(this.createMatcher(token));
    }
    if (arr.any(this.compiledRule, matcher => !matcher)) {
      //throw new Error('Can not compile ' + rule);
      this.compileError = true;
      return;
    }
  }

  createMatcher(token) {
    return arr.findAndGet([ClassMatcher, NameMatcher, IdMatcher], Matcher =>
      Matcher.create(token)
    );
  }

  reset() {
    this.active = false;
    this.matchStacks = {};
  }

  startMatching() { 
    this.animated = false;
    this.active = true;
  }

  matches(morph) {
    if (this.context == morph) this.startMatching();
    if (!this.active) return false;
    var {idx: matcherIdx, revoked, applied, animated } = (morph.owner && this.matchStacks[morph.owner.id]) || {idx: 0},
        match = this.compiledRule[matcherIdx].matches(morph); 
    if (match.applied || match.revoked) {
      match.revoked = match.revoked || revoked;
      match.applied = !match.revoked && (match.applied || applied);
      match.animated = match.animated || animated;
      if (matcherIdx < this.compiledRule.length - 1) {
        this.matchStacks[morph.id] = {idx: matcherIdx + 1, ...match};
      } else {
        this.matchStacks[morph.id] = {idx: matcherIdx, ...match}; // this is needed to prevent further matching of submorphs
        return match;
      }
    } else {
      this.matchStacks[morph.id] = {idx: matcherIdx, revoked, applied, animated };
      return false;
    }
  }

}

class Matcher {

  static get characterEncoding() { return "(?:\\\\.|[-\\w]|[^\\x00-\\xa0])+" }

  static create(token) {
    var match;
    if (match = this.appliesTo(token)) {
       return new this(token, match);
    }
  }

  constructor(description, token) {
    this.token = token;
    this.description = description;
  }

  static appliesTo(token) {
    return false;
  }

  matches(morph) {
    return false;
  }

}

class NameMatcher extends Matcher {

  static appliesTo(token) {
    var name;
    if (!this.re) this.re = new RegExp("^\\[name=['\"]?(" + this.characterEncoding + ")['\"]?\\]");
    name = this.re.exec(token);
    return name && name[1];
  }

  matches(morph) {
    // name changes are not tracked
    return {applied: morph.name == this.token, revoked: false, animated: false};
  }
  
}

class ClassMatcher extends Matcher {

  static appliesTo(token) {
    var match = true,
        classes = [];
    if (!this.re) this.re = new RegExp("^\\.(" + this.characterEncoding + ")"); 
    while(match) {
      match = this.re.exec(token);
      if(match) {
        classes.push(match[1]);
        token = token.replace(match[0], '');
      }
    }
    return string.empty(token) && classes.length > 0 ? classes : false;
  }

  matches(morph) {
    const { 
         removed, added, animation 
      } = morph._animatedStyleClasses || {removed: [], added: []},
      applied = arr.every(this.token, sc => morph.styleClasses.includes(sc)),
      revoked = !applied && arr.every(this.token, sc => [...morph.styleClasses, ...removed].includes(sc));
    // first test if classes match ignoring the added and removed
    // these are the "unchanged"
    return {
      applied,
      revoked,
      animated: animation
    }
  }

}

class IdMatcher extends Matcher {

  static appliesTo(token) {
    if (!this.re) this.re = new RegExp("^#(" + this.characterEncoding + ")");
    let id = this.re.exec(token);
    return id && id[1];
  }

  matches(morph) {
    // ids can not be revoked or animated
    return {applied: morph.id == this.token, revoked: false, animated: false};
  }
  
}

export class Sizzle {

  constructor(context) {
    this.context = context;
    this.cachedExpressions = {};
  }

  fetchExpressionFor(rule) {
    var expr = this.cachedExpressions[rule];
    if (!expr) {
      this.cachedExpressions[rule] = expr = SizzleExpression.compile(rule, this.context);
    }
    return expr;
  }

  matches(rule, morph) {
    return this.fetchExpressionFor(rule).matches(morph);  
  }

  select(rule) {
    let expr = this.fetchExpressionFor(rule);
    return this.context.withAllSubmorphsSelect(m => expr.matches(m));
  }
  
}

// sizzle visitor algorithm
// improve performance by matching expressions "on the go"
// while the morph tree is being traversed.
// this combines expression matching and transformation while avoiding
// redundant checks and recomputiation of intermediate results

export class SizzleVisitor {

  /* A sizzle visitor is an object that is bound to a given morph hierarchy
     (i.e. a context) and designed to efficiently match a set of sizzle expressions
     that is associated with different morphs in the hierarchy and allows to 
     immediately respond to a matching morph through a callback function.
     SizzleVisitor is designed to be called upon repeatedly to quickly
     check all morphs with their associated sizzle expressions whenever changes
     within the morph hierarchy are applied (i.e. changes to name, submorph, styleClasses) */

  constructor(rootMorph) {
    this.rootMorph = rootMorph;
    this.expressionCache = {};
  }

  deleteFromCache(morph) {
    morph.withAllSubmorphsDo(m => {
      delete this.expressionCache[m.id]
    })
  }

  retrieveExpressions(morph) {
    /*
         function, that is passed the current morph being visited as an argument,
         and which may return an hashmap of expressions (as strings) to values.
         The expressions are then taken by the visitor and used to check for matching
         morphs beginning at the currently visited morph. (see visitMorph() for details)
         The visitor performs automatic internalization of the expressions,
         and fetches the precompiled expressions when available to save memory and allocations.
    */
    throw Error('Not yet implemented!')
  }

  visitMorph(morph, matchingExpressions) {
    /*
         function, that is called on each morph being visited together with an array
         containing the matching expressions' value for that morph.
    */
    throw Error('Not yet implemented!')
  }

  getChildren(morph) {
    /* 
        function returning the next siblings to visit. This can be used to cut down the
        total amount of morphs getting visited.
    */
    throw Error('Not yet implemented!')
  }
  
  visit(morph) {

    if (!morph) {
      morph = this.rootMorph;
      this.morphExpressions = [];
      for (let id in this.expressionCache) {
        for (let expr in this.expressionCache[id]) {
          this.expressionCache[id][expr].reset()
        }
      }
    }

    let exprsToValues = this.retrieveExpressions(morph), 
        matchingValues = {apply: [], revoke: []};

    // add expressions to scope
    exprsToValues && this.morphExpressions.push([morph, exprsToValues]);

    // populate the matchingValues by checking what of
    // the morphExpressions inside the current scope apply
    for (let [rootMorph, exprsToValues] of this.morphExpressions) {
      let cache = this.expressionCache[rootMorph.id] || {};
      if (obj.isArray(exprsToValues)) {
        exprsToValues.forEach(ev => 
          this.matchExpressions(rootMorph, morph, ev, cache, matchingValues)
        );
      } else {
        this.matchExpressions(rootMorph, morph, exprsToValues, cache, matchingValues);
      }
      this.expressionCache[rootMorph.id] = cache;
    }

    this.getChildren(morph).forEach(m => {
      this.visit(m);
    });

    this.visitMorph(morph, matchingValues);

    // remove expressions from scope
    exprsToValues && this.morphExpressions.pop();
  }

  matchExpressions(rootMorph, morph, exprsToValues, exprCache, valueContainer) {
    for (let expr in exprsToValues) {
      let match, value, compiledExpr = exprCache[expr] || SizzleExpression.compile(expr, rootMorph);
      if (!compiledExpr.compileError) {
        // determine wether the expression matched due to a style class that has been animated
        match = compiledExpr.matches(morph) || {};
        if (match.applied) {
          valueContainer.apply.push(value = exprsToValues[expr]);
        }
        if (match.revoked) {
          valueContainer.revoke.push(value = exprsToValues[expr]);
        }
        if (match.animated) { value.animated = match.animated }
        // else we did not match before and dont match right now, so ignore
      }
      exprCache[expr] = compiledExpr;
    }
  }
}

export class StylingVisitor extends SizzleVisitor {

  constructor(args) {
    super(args);
    this.retainedProps = {};
  }

  retrieveExpressions(morph) {
    if (morph.styleSheets.length < 1) return false;
    return morph.styleSheets.map(ss => ss.applicableRules());
  }

  visitMorph(morph, styleSheetPatches) {
    if (!morph._wantsStyling) return;
    let retained = this.retainedProps[morph.id] || {},
        styledProps = {};
    var capturedPropValues;

    // the first time we start styling the morph, we capture all the styled properties
    morph.__appliedRules__ = [];
    for (let {styleSheet, rule, animated} of styleSheetPatches.apply) {
      // changed props and styledProps!
      morph.__appliedRules__.push([styleSheet, rule]);
      capturedPropValues = styleSheet.applyRule(rule, morph, animated)
      Object.assign(styledProps, capturedPropValues);
      retained = { ...capturedPropValues, ...retained };
    }
    // the rules that are no longer applied are reset back to the values
    // they were at when the style was applied initially, given that the current value
    // coincides with the rules value
    
    for (let {styleSheet, rule, animated} of styleSheetPatches.revoke) {
        let restored = obj.dissoc(obj.select(retained, obj.keys(styleSheet.rules[rule])), obj.keys(styledProps));
        if (animated) {
          morph.animate({
            ...restored, duration: animated.duration, easing: animated.easing
          });
        } else {
          Object.assign(morph, restored);
        }
        Object.assign(styledProps, restored);
    }
    // the remaining rules which used to be applied but no longer are and were not revoked via an animation
    const propsToRevert = obj.dissoc(retained, obj.keys(styledProps));
    Object.assign(morph, propsToRevert);
    retained = obj.dissoc(retained, obj.keys(propsToRevert));
    // once applied, a retained prop is removed, to not infer with the
    // custom setting of properties on morphs

    delete morph._animatedStyleClasses
    morph._styledProps = styledProps;
    this.retainedProps[morph.id] = retained;
    morph._wantsStyling = false;
  }

  getChildren(morph) {
    return morph.submorphs.filter(m => m.needsRerender());
  }
  
}
