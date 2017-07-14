import { obj, string, arr } from "lively.lang";
import { pushIfNotIncluded } from "lively.lang/array.js";

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

  match(morph) {
    var matchmap = {};
    for (let rule of this.compiledRule) {
      matchmap[rule.description] = rule.matches(morph);
    }
    return matchmap;
  }

  reset() {
    this.active = false;
    this.matchStacks = {};
  }

  startMatching() { 
    this.active = true;
  }

  seen(morph) {
    if (this.context == morph) this.startMatching();
    if (!this.active) return false; 
    var matcherIdx = (morph.owner && this.matchStacks[morph.owner.id]) || 0;
    if (this.compiledRule[matcherIdx].matches(morph)) {
      if (matcherIdx < this.compiledRule.length - 1) {
         this.matchStacks[morph.id] = matcherIdx + 1;
      } else {
        return true;
      }
    } else {
      this.matchStacks[morph.id] = matcherIdx;
      return false;
    }
  }

  matches(morph) {
    if (this.compileError) return false;
    let ownerChain = morph.ownerChain(),
        [firstMatcher, ...remainingMatchers] = this.compiledRule;
    // match leaf
    if (!firstMatcher.matches(morph)) return false;
    // ensure that other morphs in the hierarchy match the remainder of the rule
    var isMatch = true;
    for (let matcher of remainingMatchers) {
      isMatch = false;
      for (let idx in ownerChain) {
        if (matcher.matches(ownerChain[idx])) {
          ownerChain = arr.drop(ownerChain, idx + 1);
          isMatch = true;
          break;
        }
      }
      if (!isMatch) return false; // break up early
    }
    return isMatch;
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
    return morph.name == this.token;
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
    return arr.every(this.token, sc => morph.styleClasses.includes(sc));
  }

}

class IdMatcher extends Matcher {

  static appliesTo(token) {
    if (!this.re) this.re = new RegExp("^#(" + this.characterEncoding + ")");
    let id = this.re.exec(token);
    return id && id[1];
  }

  matches(morph) {
    return morph.id == this.token;
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
      this.ownerChain = [(morph = this.rootMorph)];
      this.morphExpressions = [];
      for (let id in this.expressionCache) {
        for (let expr in this.expressionCache[id]) {
          this.expressionCache[id][expr].reset()
        }
      }
    }

    let exprsToValues = this.retrieveExpressions(morph), 
        matchingValues = [];

    exprsToValues && this.morphExpressions.push([morph, exprsToValues]);

    for (let [context, exprsToValues] of this.morphExpressions) {
      let cache = this.expressionCache[context.id] || {};
      if (obj.isArray(exprsToValues)) {
        exprsToValues.forEach(ev => 
          this.matchExpressions(context, morph, ev, cache, matchingValues)
        );
      } else {
        this.matchExpressions(context, morph, exprsToValues, cache, matchingValues);
      }
      this.expressionCache[context.id] = cache;
    }

    this.visitMorph(morph, matchingValues);

    this.getChildren(morph).forEach(m => {
      this.ownerChain.push(m);
      this.visit(m);
      this.ownerChain.pop();
    });
    
    exprsToValues && this.morphExpressions.pop();
  }

  matchExpressions(ctx, morph, exprsToValues, exprCache, valueContainer) {
    for (let expr in exprsToValues) {
      let compiledExpr = exprCache[expr] || SizzleExpression.compile(expr, ctx);
      if (!compiledExpr.compileError) {
        if (compiledExpr.seen(morph)) valueContainer.push(exprsToValues[expr]);
      }
      exprCache[expr] = compiledExpr;
    }
  }
}

export class StylingVisitor extends SizzleVisitor {

  retrieveExpressions(morph) {
    if (morph.styleSheets.length < 1) return false;
    return morph.styleSheets.map(ss => ss.applicableRules());
  }

  visitMorph(morph, styleSheetsToApply) {
    if (!morph._wantsStyling) return;
    for (let [ss, rule] of styleSheetsToApply) {
      ss.applyRule(rule, morph);
    }
    morph._wantsStyling = false;
  }

  getChildren(morph) {
    return morph.submorphs.filter(m => {
      return m.needsRerender()
    });
  }
  
}
