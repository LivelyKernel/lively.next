import { obj, string, arr } from "lively.lang";
import { pushIfNotIncluded } from "lively.lang/array.js";

export class SizzleExpression {

  static compile(rule, context) {
    return new this(rule, context);
  }

  constructor(rule, context) {
    this.morphIndex = {};
    this.matchedMorphs = [];
    this.context = context;
    this.compileRule(rule);
    this.exec(this.context);
  }

  ensureContext(context) {
    if (context.id in this.morphIndex) return;
    this.morphIndex = {};
    this.exec(this.context);
  }

  compileRule(rule) {
    this.compiledRule = rule.split(' ').map(token => this.createMatcher(token));
    if (arr.any(this.compiledRule, matcher => !matcher)) {
      throw new Error('Can not compile ' + rule);
    }
  }

  createMatcher(token) {
    return arr.findAndGet([ClassMatcher, NameMatcher, IdMatcher], Matcher =>
      Matcher.create(token)
    );
  }

  exec(context, matchedMatchers=[]) {
    context.withAllSubmorphsDo(m => {
      if (!this.morphIndex[m.id]) this.morphIndex[m.id] = matchedMatchers;
      this.compiledRule.forEach(matcher => {
        if (matcher.matches(m)) pushIfNotIncluded(this.morphIndex[m.id], matcher);
        if (arr.equals(this.morphIndex[m.id], this.compiledRule) && arr.last(this.compiledRule).matches(m)) {
          pushIfNotIncluded(this.matchedMorphs, m);
        }
      });
    });
  }

  hasIndexed(morph) {
    return morph.id in this.morphIndex;
  }

  addToIndex(morph) {
    if (this.hasIndexed(morph)) return;
    let indexedParent = morph.ownerChain().find(m => m.id in this.morphIndex);
    if (!indexedParent) {
       return false // the morph appears to be in a different context
    }
    this.exec(morph, this.morphIndex[indexedParent.id]);
  }

  removeFromIndex(morph) {
    delete this.morphIndex[morph.id];
    arr.remove(this.matchedMorphs, morph);
  }

  matches(morph) {
    if (!this.hasIndexed(morph)) {
      this.addToIndex(morph)
    }
    return this.matchedMorphs.includes(morph);
  }

}

class Matcher {

  static get characterEncoding() { return "(?:\\\\.|[-\\w]|[^\\x00-\\xa0])+" }

  static create(token) {
    var match;
    if (match = this.appliesTo(token)) {
       return new this(match);
    }
  }

  constructor(token) {
    this.token = token;
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
    let name = new RegExp("^\\[name=['\"]?(" + this.characterEncoding + ")['\"]?\\]").exec(token);
    return name && name[1];
  }

  matches(morph) {
    return morph.name == this.token;
  }
  
}

class ClassMatcher extends Matcher {

  static appliesTo(token) {
    var re = new RegExp("^\\.(" + this.characterEncoding + ")"), 
        match = true,
        classes = [];
    while(match) {
      match = re.exec(token);
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
    let id = new RegExp("^#(" + this.characterEncoding + ")").exec(token);
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

  addToIndex(morph) {
    for (let rule in this.cachedExpressions) {
      this.cachedExpressions[rule].addToIndex(morph);
    }
  }

  removeFromIndex(morph) {
    for (let rule in this.cachedExpressions) {
      this.cachedExpressions[rule].removeFromIndex(morph);
    }
  }

  fetchExpressionFor(rule) {
    var expr = this.cachedExpressions[rule];
    if (!expr) {
      this.cachedExpressions[rule] = expr = SizzleExpression.compile(rule, this.context);
    }
    return expr;
  }

  matches(rule, morph) {
    this.fetchExpressionFor(rule).ensureContext(this.context);
    return this.fetchExpressionFor(rule).matches(morph);  
  }

  select(rule) {
    this.fetchExpressionFor(rule).ensureContext(this.context);
    return this.fetchExpressionFor(rule).matchedMorphs;
  }
  
}
