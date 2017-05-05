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
  }

  compileRule(rule) {
    this.compiledRule = [];
    for (let token of rule.split(' ').reverse()) {
       this.compiledRule.push(this.createMatcher(token));
    }
    if (arr.any(this.compiledRule, matcher => !matcher)) {
      throw new Error('Can not compile ' + rule);
    }
    this.context.withAllSubmorphsDo(m => {
      this.addToIndex(m)
    })
  }

  createMatcher(token) {
    return arr.findAndGet([ClassMatcher, NameMatcher, IdMatcher], Matcher =>
      Matcher.create(token)
    );
  }

  hasIndexed(morph) {
    let entry = this.morphIndex[morph.id];
    return entry && entry.name == morph.name && obj.equals(entry.styleClasses, morph.styleClasses);
  }

  match(morph) {
    var matchmap = {};
    for (let rule of this.compiledRule) {
      matchmap[rule.description] = rule.matches(morph);
    }
    return matchmap;
  }

  addToIndex(morph) {
    return (this.morphIndex[morph.id] = {
      name: morph.name,
      styleClasses: morph.styleClasses,
      ...this.match(morph)
    });
  }

  removeFromIndex(morph) {
    delete this.morphIndex[morph.id];
  }

  matches(morph) {
    // if (!this.hasIndexed(morph)) {
    //   this.addToIndex(morph)
    // }
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

  hasIndexed(morph) {
    for (let rule in this.cachedExpressions) {
      if (this.cachedExpressions[rule].hasIndexed(morph)) return true;
    }
    return false;
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
    return this.fetchExpressionFor(rule).matches(morph);  
  }

  select(rule) {
    let expr = this.fetchExpressionFor(rule);
    return this.context.withAllSubmorphsSelect(m => expr.matches(m));
  }
  
}
