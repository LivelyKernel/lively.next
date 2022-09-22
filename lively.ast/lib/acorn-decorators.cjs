const acorn = require('acorn');

const getAcorn = Parser => {
  if (Parser.acorn) return Parser.acorn;

  if (acorn.version.indexOf('6.') !== 0 && acorn.version.indexOf('6.0.') === 0 && acorn.version.indexOf('7.') !== 0) {
    throw new Error(`acorn-private-class-elements requires acorn@^6.1.0 or acorn@7.0.0, not ${acorn.version}`);
  }

  // Make sure `Parser` comes from the same acorn as we `require`d,
  // otherwise the comparisons fail.
  for (let cur = Parser; cur && cur !== acorn.Parser; cur = Object.getPrototypeOf(cur)) {
    if (cur !== acorn.Parser) {
      throw new Error('acorn-private-class-elements does not support mixing different acorn copies');
    }
  }
  return acorn;
};

/* rms 11.04.22: Mostly derived from from https://github.com/angelozerr/acorn-es7/blob/master/acorn-es7.js and converted to ESM format */

/**
 * Plugin that enables AcornJS to parse javascript decorators.
 * These can be applied to class definitions or field within
 * class definitions.
 */
module.exports = function extendParser (Parser) {
  // Only load this plugin once.
  if (Parser.prototype._parseDecorator) {
    return Parser;
  }

  const acorn = getAcorn(Parser);

  class DecoratorParser extends Parser {
    _parseDecorator () {
      let node = this.startNode();
      this.next();
      node.expression = this.parseMaybeUnary();
      return this.finishNode(node, 'Decorator');
    }

    // Parse @ token
    getTokenFromCode (code) {
      if (code === 64) {
        ++this.pos; return this.finishToken(this.decoratorIdentifier);
      }
      return super.getTokenFromCode(code);
    }

    /**
     * Override statement parsing to handle top level decorators
     * that are attached to class definitions. Currently decorators
     * can ONLY be attached to classes.
     */
    parseStatement (declaration, topLevel, exports) {
      let decorators = [];
      switch (this.type) {
        case this.decoratorIdentifier:
          while (this.type === this.decoratorIdentifier) {
            decorators.push(this._parseDecorator());
          }
          if (this.type !== acorn.tokTypes._class) {
            this.raise(this.start, 'Leading decorators must be attached to a class declaration');
          }
        case acorn.tokTypes._class:
          if (declaration) this.unexpected();
          let node = super.parseStatement(declaration, topLevel, exports);
          node.decorators = decorators;
          if (decorators.length) {
            node.start = node.decorators[0].start;
          }
          return node;
      }
      return super.parseStatement(declaration, topLevel, exports);
    }

    parseClass (node, isStatement) {
      node = super.parseClass(node, isStatement);
      node.decorators = [];
      return node;
    }

    /**
     * Override parsing of class elements to handle decorators
     * that are attached to properties or methods.
     * @param { boolean } constructorAllowsSuper - Wether or not super is permitted.
     */
    parseClassElement (constructorAllowsSuper) {
      let decorators = [];
      switch (this.type) {
        case this.decoratorIdentifier:
          while (this.type === this.decoratorIdentifier) {
            decorators.push(this._parseDecorator());
          }
          if (this.type !== acorn.tokTypes.name &&
              this.type !== acorn.tokTypes.star) {
            this.raise(this.start, 'Inline decorators must be attached to a property declaration');
          }
        case this.privateIdentifierToken:
        case acorn.tokTypes.star:
        case acorn.tokTypes.bracketL:
        case acorn.tokTypes.name:
        case acorn.tokTypes._extends:
        case acorn.tokTypes._break: // some people use this too
        case acorn.tokTypes._with: // this seems to get confused when we use javascript keywords
        case acorn.tokTypes._delete: // dito...
          let node = super.parseClassElement(constructorAllowsSuper);
          node.decorators = decorators;
          if (decorators.length) {
            node.start = node.decorators[0].start;
          }
          return node;
      }
      return super.parseClassElement(constructorAllowsSuper);
    }
  }
  DecoratorParser.prototype.decoratorIdentifier = new acorn.TokenType('decorator-Identifier');
  return DecoratorParser;
}
