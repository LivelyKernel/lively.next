System.registerDynamic("lively.ast/node_modules/acorn/dist/walk.js", [], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  (function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = f();
    } else if (typeof define === "function" && define.amd) {
      define([], f);
    } else {
      var g;
      if (typeof window !== "undefined") {
        g = window;
      } else if (typeof global !== "undefined") {
        g = global;
      } else if (typeof self !== "undefined") {
        g = self;
      } else {
        g = this;
      }
      (g.acorn || (g.acorn = {})).walk = f();
    }
  })(function() {
    var define,
        module,
        exports;
    return (function e(t, n, r) {
      function s(o, u) {
        if (!n[o]) {
          if (!t[o]) {
            var a = typeof $__require == "function" && $__require;
            if (!u && a)
              return a(o, !0);
            if (i)
              return i(o, !0);
            var f = new Error("Cannot find module '" + o + "'");
            throw f.code = "MODULE_NOT_FOUND", f;
          }
          var l = n[o] = {exports: {}};
          t[o][0].call(l.exports, function(e) {
            var n = t[o][1][e];
            return s(n ? n : e);
          }, l, l.exports, e, t, n, r);
        }
        return n[o].exports;
      }
      var i = typeof $__require == "function" && $__require;
      for (var o = 0; o < r.length; o++)
        s(r[o]);
      return s;
    })({1: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.simple = simple;
        exports.ancestor = ancestor;
        exports.recursive = recursive;
        exports.findNodeAt = findNodeAt;
        exports.findNodeAround = findNodeAround;
        exports.findNodeAfter = findNodeAfter;
        exports.findNodeBefore = findNodeBefore;
        exports.make = make;
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        function simple(node, visitors, base, state, override) {
          if (!base)
            base = exports.base;
          (function c(node, st, override) {
            var type = override || node.type,
                found = visitors[type];
            base[type](node, st, c);
            if (found)
              found(node, st);
          })(node, state, override);
        }
        function ancestor(node, visitors, base, state) {
          if (!base)
            base = exports.base;
          if (!state)
            state = [];
          (function c(node, st, override) {
            var type = override || node.type,
                found = visitors[type];
            if (node != st[st.length - 1]) {
              st = st.slice();
              st.push(node);
            }
            base[type](node, st, c);
            if (found)
              found(node, st);
          })(node, state);
        }
        function recursive(node, state, funcs, base, override) {
          var visitor = funcs ? exports.make(funcs, base) : base;
          (function c(node, st, override) {
            visitor[override || node.type](node, st, c);
          })(node, state, override);
        }
        function makeTest(test) {
          if (typeof test == "string")
            return function(type) {
              return type == test;
            };
          else if (!test)
            return function() {
              return true;
            };
          else
            return test;
        }
        var Found = function Found(node, state) {
          _classCallCheck(this, Found);
          this.node = node;
          this.state = state;
        };
        ;
        function findNodeAt(node, start, end, test, base, state) {
          test = makeTest(test);
          if (!base)
            base = exports.base;
          try {
            ;
            (function c(node, st, override) {
              var type = override || node.type;
              if ((start == null || node.start <= start) && (end == null || node.end >= end))
                base[type](node, st, c);
              if ((start == null || node.start == start) && (end == null || node.end == end) && test(type, node))
                throw new Found(node, st);
            })(node, state);
          } catch (e) {
            if (e instanceof Found)
              return e;
            throw e;
          }
        }
        function findNodeAround(node, pos, test, base, state) {
          test = makeTest(test);
          if (!base)
            base = exports.base;
          try {
            ;
            (function c(node, st, override) {
              var type = override || node.type;
              if (node.start > pos || node.end < pos)
                return;
              base[type](node, st, c);
              if (test(type, node))
                throw new Found(node, st);
            })(node, state);
          } catch (e) {
            if (e instanceof Found)
              return e;
            throw e;
          }
        }
        function findNodeAfter(node, pos, test, base, state) {
          test = makeTest(test);
          if (!base)
            base = exports.base;
          try {
            ;
            (function c(node, st, override) {
              if (node.end < pos)
                return;
              var type = override || node.type;
              if (node.start >= pos && test(type, node))
                throw new Found(node, st);
              base[type](node, st, c);
            })(node, state);
          } catch (e) {
            if (e instanceof Found)
              return e;
            throw e;
          }
        }
        function findNodeBefore(node, pos, test, base, state) {
          test = makeTest(test);
          if (!base)
            base = exports.base;
          var max = undefined;
          (function c(node, st, override) {
            if (node.start > pos)
              return;
            var type = override || node.type;
            if (node.end <= pos && (!max || max.node.end < node.end) && test(type, node))
              max = new Found(node, st);
            base[type](node, st, c);
          })(node, state);
          return max;
        }
        function make(funcs, base) {
          if (!base)
            base = exports.base;
          var visitor = {};
          for (var type in base)
            visitor[type] = base[type];
          for (var type in funcs)
            visitor[type] = funcs[type];
          return visitor;
        }
        function skipThrough(node, st, c) {
          c(node, st);
        }
        function ignore(_node, _st, _c) {}
        var base = {};
        exports.base = base;
        base.Program = base.BlockStatement = function(node, st, c) {
          for (var i = 0; i < node.body.length; ++i) {
            c(node.body[i], st, "Statement");
          }
        };
        base.Statement = skipThrough;
        base.EmptyStatement = ignore;
        base.ExpressionStatement = base.ParenthesizedExpression = function(node, st, c) {
          return c(node.expression, st, "Expression");
        };
        base.IfStatement = function(node, st, c) {
          c(node.test, st, "Expression");
          c(node.consequent, st, "Statement");
          if (node.alternate)
            c(node.alternate, st, "Statement");
        };
        base.LabeledStatement = function(node, st, c) {
          return c(node.body, st, "Statement");
        };
        base.BreakStatement = base.ContinueStatement = ignore;
        base.WithStatement = function(node, st, c) {
          c(node.object, st, "Expression");
          c(node.body, st, "Statement");
        };
        base.SwitchStatement = function(node, st, c) {
          c(node.discriminant, st, "Expression");
          for (var i = 0; i < node.cases.length; ++i) {
            var cs = node.cases[i];
            if (cs.test)
              c(cs.test, st, "Expression");
            for (var j = 0; j < cs.consequent.length; ++j) {
              c(cs.consequent[j], st, "Statement");
            }
          }
        };
        base.ReturnStatement = base.YieldExpression = function(node, st, c) {
          if (node.argument)
            c(node.argument, st, "Expression");
        };
        base.ThrowStatement = base.SpreadElement = function(node, st, c) {
          return c(node.argument, st, "Expression");
        };
        base.TryStatement = function(node, st, c) {
          c(node.block, st, "Statement");
          if (node.handler) {
            c(node.handler.param, st, "Pattern");
            c(node.handler.body, st, "ScopeBody");
          }
          if (node.finalizer)
            c(node.finalizer, st, "Statement");
        };
        base.WhileStatement = base.DoWhileStatement = function(node, st, c) {
          c(node.test, st, "Expression");
          c(node.body, st, "Statement");
        };
        base.ForStatement = function(node, st, c) {
          if (node.init)
            c(node.init, st, "ForInit");
          if (node.test)
            c(node.test, st, "Expression");
          if (node.update)
            c(node.update, st, "Expression");
          c(node.body, st, "Statement");
        };
        base.ForInStatement = base.ForOfStatement = function(node, st, c) {
          c(node.left, st, "ForInit");
          c(node.right, st, "Expression");
          c(node.body, st, "Statement");
        };
        base.ForInit = function(node, st, c) {
          if (node.type == "VariableDeclaration")
            c(node, st);
          else
            c(node, st, "Expression");
        };
        base.DebuggerStatement = ignore;
        base.FunctionDeclaration = function(node, st, c) {
          return c(node, st, "Function");
        };
        base.VariableDeclaration = function(node, st, c) {
          for (var i = 0; i < node.declarations.length; ++i) {
            c(node.declarations[i], st);
          }
        };
        base.VariableDeclarator = function(node, st, c) {
          c(node.id, st, "Pattern");
          if (node.init)
            c(node.init, st, "Expression");
        };
        base.Function = function(node, st, c) {
          if (node.id)
            c(node.id, st, "Pattern");
          for (var i = 0; i < node.params.length; i++) {
            c(node.params[i], st, "Pattern");
          }
          c(node.body, st, node.expression ? "ScopeExpression" : "ScopeBody");
        };
        base.ScopeBody = function(node, st, c) {
          return c(node, st, "Statement");
        };
        base.ScopeExpression = function(node, st, c) {
          return c(node, st, "Expression");
        };
        base.Pattern = function(node, st, c) {
          if (node.type == "Identifier")
            c(node, st, "VariablePattern");
          else if (node.type == "MemberExpression")
            c(node, st, "MemberPattern");
          else
            c(node, st);
        };
        base.VariablePattern = ignore;
        base.MemberPattern = skipThrough;
        base.RestElement = function(node, st, c) {
          return c(node.argument, st, "Pattern");
        };
        base.ArrayPattern = function(node, st, c) {
          for (var i = 0; i < node.elements.length; ++i) {
            var elt = node.elements[i];
            if (elt)
              c(elt, st, "Pattern");
          }
        };
        base.ObjectPattern = function(node, st, c) {
          for (var i = 0; i < node.properties.length; ++i) {
            c(node.properties[i].value, st, "Pattern");
          }
        };
        base.Expression = skipThrough;
        base.ThisExpression = base.Super = base.MetaProperty = ignore;
        base.ArrayExpression = function(node, st, c) {
          for (var i = 0; i < node.elements.length; ++i) {
            var elt = node.elements[i];
            if (elt)
              c(elt, st, "Expression");
          }
        };
        base.ObjectExpression = function(node, st, c) {
          for (var i = 0; i < node.properties.length; ++i) {
            c(node.properties[i], st);
          }
        };
        base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
        base.SequenceExpression = base.TemplateLiteral = function(node, st, c) {
          for (var i = 0; i < node.expressions.length; ++i) {
            c(node.expressions[i], st, "Expression");
          }
        };
        base.UnaryExpression = base.UpdateExpression = function(node, st, c) {
          c(node.argument, st, "Expression");
        };
        base.BinaryExpression = base.LogicalExpression = function(node, st, c) {
          c(node.left, st, "Expression");
          c(node.right, st, "Expression");
        };
        base.AssignmentExpression = base.AssignmentPattern = function(node, st, c) {
          c(node.left, st, "Pattern");
          c(node.right, st, "Expression");
        };
        base.ConditionalExpression = function(node, st, c) {
          c(node.test, st, "Expression");
          c(node.consequent, st, "Expression");
          c(node.alternate, st, "Expression");
        };
        base.NewExpression = base.CallExpression = function(node, st, c) {
          c(node.callee, st, "Expression");
          if (node.arguments)
            for (var i = 0; i < node.arguments.length; ++i) {
              c(node.arguments[i], st, "Expression");
            }
        };
        base.MemberExpression = function(node, st, c) {
          c(node.object, st, "Expression");
          if (node.computed)
            c(node.property, st, "Expression");
        };
        base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function(node, st, c) {
          if (node.declaration)
            c(node.declaration, st, node.type == "ExportNamedDeclaration" || node.declaration.id ? "Statement" : "Expression");
          if (node.source)
            c(node.source, st, "Expression");
        };
        base.ExportAllDeclaration = function(node, st, c) {
          c(node.source, st, "Expression");
        };
        base.ImportDeclaration = function(node, st, c) {
          for (var i = 0; i < node.specifiers.length; i++) {
            c(node.specifiers[i], st);
          }
          c(node.source, st, "Expression");
        };
        base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.Literal = ignore;
        base.TaggedTemplateExpression = function(node, st, c) {
          c(node.tag, st, "Expression");
          c(node.quasi, st);
        };
        base.ClassDeclaration = base.ClassExpression = function(node, st, c) {
          return c(node, st, "Class");
        };
        base.Class = function(node, st, c) {
          if (node.id)
            c(node.id, st, "Pattern");
          if (node.superClass)
            c(node.superClass, st, "Expression");
          for (var i = 0; i < node.body.body.length; i++) {
            c(node.body.body[i], st);
          }
        };
        base.MethodDefinition = base.Property = function(node, st, c) {
          if (node.computed)
            c(node.key, st, "Expression");
          c(node.value, st, "Expression");
        };
        base.ComprehensionExpression = function(node, st, c) {
          for (var i = 0; i < node.blocks.length; i++) {
            c(node.blocks[i].right, st, "Expression");
          }
          c(node.body, st, "Expression");
        };
      }, {}]}, {}, [1])(1);
  });
  return module.exports;
});

System.registerDynamic("lively.ast/node_modules/acorn/dist/acorn.js", [], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  (function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = f();
    } else if (typeof define === "function" && define.amd) {
      define([], f);
    } else {
      var g;
      if (typeof window !== "undefined") {
        g = window;
      } else if (typeof global !== "undefined") {
        g = global;
      } else if (typeof self !== "undefined") {
        g = self;
      } else {
        g = this;
      }
      g.acorn = f();
    }
  })(function() {
    var define,
        module,
        exports;
    return (function e(t, n, r) {
      function s(o, u) {
        if (!n[o]) {
          if (!t[o]) {
            var a = typeof $__require == "function" && $__require;
            if (!u && a)
              return a(o, !0);
            if (i)
              return i(o, !0);
            var f = new Error("Cannot find module '" + o + "'");
            throw f.code = "MODULE_NOT_FOUND", f;
          }
          var l = n[o] = {exports: {}};
          t[o][0].call(l.exports, function(e) {
            var n = t[o][1][e];
            return s(n ? n : e);
          }, l, l.exports, e, t, n, r);
        }
        return n[o].exports;
      }
      var i = typeof $__require == "function" && $__require;
      for (var o = 0; o < r.length; o++)
        s(r[o]);
      return s;
    })({
      1: [function(_dereq_, module, exports) {
        "use strict";
        var _tokentype = _dereq_("./tokentype");
        var _state = _dereq_("./state");
        var pp = _state.Parser.prototype;
        pp.checkPropClash = function(prop, propHash) {
          if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand))
            return;
          var key = prop.key;
          var name = undefined;
          switch (key.type) {
            case "Identifier":
              name = key.name;
              break;
            case "Literal":
              name = String(key.value);
              break;
            default:
              return;
          }
          var kind = prop.kind;
          if (this.options.ecmaVersion >= 6) {
            if (name === "__proto__" && kind === "init") {
              if (propHash.proto)
                this.raise(key.start, "Redefinition of __proto__ property");
              propHash.proto = true;
            }
            return;
          }
          name = "$" + name;
          var other = propHash[name];
          if (other) {
            var isGetSet = kind !== "init";
            if ((this.strict || isGetSet) && other[kind] || !(isGetSet ^ other.init))
              this.raise(key.start, "Redefinition of property");
          } else {
            other = propHash[name] = {
              init: false,
              get: false,
              set: false
            };
          }
          other[kind] = true;
        };
        pp.parseExpression = function(noIn, refDestructuringErrors) {
          var startPos = this.start,
              startLoc = this.startLoc;
          var expr = this.parseMaybeAssign(noIn, refDestructuringErrors);
          if (this.type === _tokentype.types.comma) {
            var node = this.startNodeAt(startPos, startLoc);
            node.expressions = [expr];
            while (this.eat(_tokentype.types.comma))
              node.expressions.push(this.parseMaybeAssign(noIn, refDestructuringErrors));
            return this.finishNode(node, "SequenceExpression");
          }
          return expr;
        };
        pp.parseMaybeAssign = function(noIn, refDestructuringErrors, afterLeftParse) {
          if (this.type == _tokentype.types._yield && this.inGenerator)
            return this.parseYield();
          var validateDestructuring = false;
          if (!refDestructuringErrors) {
            refDestructuringErrors = {
              shorthandAssign: 0,
              trailingComma: 0
            };
            validateDestructuring = true;
          }
          var startPos = this.start,
              startLoc = this.startLoc;
          if (this.type == _tokentype.types.parenL || this.type == _tokentype.types.name)
            this.potentialArrowAt = this.start;
          var left = this.parseMaybeConditional(noIn, refDestructuringErrors);
          if (afterLeftParse)
            left = afterLeftParse.call(this, left, startPos, startLoc);
          if (this.type.isAssign) {
            if (validateDestructuring)
              this.checkPatternErrors(refDestructuringErrors, true);
            var node = this.startNodeAt(startPos, startLoc);
            node.operator = this.value;
            node.left = this.type === _tokentype.types.eq ? this.toAssignable(left) : left;
            refDestructuringErrors.shorthandAssign = 0;
            this.checkLVal(left);
            this.next();
            node.right = this.parseMaybeAssign(noIn);
            return this.finishNode(node, "AssignmentExpression");
          } else {
            if (validateDestructuring)
              this.checkExpressionErrors(refDestructuringErrors, true);
          }
          return left;
        };
        pp.parseMaybeConditional = function(noIn, refDestructuringErrors) {
          var startPos = this.start,
              startLoc = this.startLoc;
          var expr = this.parseExprOps(noIn, refDestructuringErrors);
          if (this.checkExpressionErrors(refDestructuringErrors))
            return expr;
          if (this.eat(_tokentype.types.question)) {
            var node = this.startNodeAt(startPos, startLoc);
            node.test = expr;
            node.consequent = this.parseMaybeAssign();
            this.expect(_tokentype.types.colon);
            node.alternate = this.parseMaybeAssign(noIn);
            return this.finishNode(node, "ConditionalExpression");
          }
          return expr;
        };
        pp.parseExprOps = function(noIn, refDestructuringErrors) {
          var startPos = this.start,
              startLoc = this.startLoc;
          var expr = this.parseMaybeUnary(refDestructuringErrors);
          if (this.checkExpressionErrors(refDestructuringErrors))
            return expr;
          return this.parseExprOp(expr, startPos, startLoc, -1, noIn);
        };
        pp.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, noIn) {
          var prec = this.type.binop;
          if (prec != null && (!noIn || this.type !== _tokentype.types._in)) {
            if (prec > minPrec) {
              var node = this.startNodeAt(leftStartPos, leftStartLoc);
              node.left = left;
              node.operator = this.value;
              var op = this.type;
              this.next();
              var startPos = this.start,
                  startLoc = this.startLoc;
              node.right = this.parseExprOp(this.parseMaybeUnary(), startPos, startLoc, prec, noIn);
              this.finishNode(node, op === _tokentype.types.logicalOR || op === _tokentype.types.logicalAND ? "LogicalExpression" : "BinaryExpression");
              return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
            }
          }
          return left;
        };
        pp.parseMaybeUnary = function(refDestructuringErrors) {
          if (this.type.prefix) {
            var node = this.startNode(),
                update = this.type === _tokentype.types.incDec;
            node.operator = this.value;
            node.prefix = true;
            this.next();
            node.argument = this.parseMaybeUnary();
            this.checkExpressionErrors(refDestructuringErrors, true);
            if (update)
              this.checkLVal(node.argument);
            else if (this.strict && node.operator === "delete" && node.argument.type === "Identifier")
              this.raise(node.start, "Deleting local variable in strict mode");
            return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
          }
          var startPos = this.start,
              startLoc = this.startLoc;
          var expr = this.parseExprSubscripts(refDestructuringErrors);
          if (this.checkExpressionErrors(refDestructuringErrors))
            return expr;
          while (this.type.postfix && !this.canInsertSemicolon()) {
            var node = this.startNodeAt(startPos, startLoc);
            node.operator = this.value;
            node.prefix = false;
            node.argument = expr;
            this.checkLVal(expr);
            this.next();
            expr = this.finishNode(node, "UpdateExpression");
          }
          return expr;
        };
        pp.parseExprSubscripts = function(refDestructuringErrors) {
          var startPos = this.start,
              startLoc = this.startLoc;
          var expr = this.parseExprAtom(refDestructuringErrors);
          var skipArrowSubscripts = expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")";
          if (this.checkExpressionErrors(refDestructuringErrors) || skipArrowSubscripts)
            return expr;
          return this.parseSubscripts(expr, startPos, startLoc);
        };
        pp.parseSubscripts = function(base, startPos, startLoc, noCalls) {
          for (; ; ) {
            if (this.eat(_tokentype.types.dot)) {
              var node = this.startNodeAt(startPos, startLoc);
              node.object = base;
              node.property = this.parseIdent(true);
              node.computed = false;
              base = this.finishNode(node, "MemberExpression");
            } else if (this.eat(_tokentype.types.bracketL)) {
              var node = this.startNodeAt(startPos, startLoc);
              node.object = base;
              node.property = this.parseExpression();
              node.computed = true;
              this.expect(_tokentype.types.bracketR);
              base = this.finishNode(node, "MemberExpression");
            } else if (!noCalls && this.eat(_tokentype.types.parenL)) {
              var node = this.startNodeAt(startPos, startLoc);
              node.callee = base;
              node.arguments = this.parseExprList(_tokentype.types.parenR, false);
              base = this.finishNode(node, "CallExpression");
            } else if (this.type === _tokentype.types.backQuote) {
              var node = this.startNodeAt(startPos, startLoc);
              node.tag = base;
              node.quasi = this.parseTemplate();
              base = this.finishNode(node, "TaggedTemplateExpression");
            } else {
              return base;
            }
          }
        };
        pp.parseExprAtom = function(refDestructuringErrors) {
          var node = undefined,
              canBeArrow = this.potentialArrowAt == this.start;
          switch (this.type) {
            case _tokentype.types._super:
              if (!this.inFunction)
                this.raise(this.start, "'super' outside of function or class");
            case _tokentype.types._this:
              var type = this.type === _tokentype.types._this ? "ThisExpression" : "Super";
              node = this.startNode();
              this.next();
              return this.finishNode(node, type);
            case _tokentype.types._yield:
              if (this.inGenerator)
                this.unexpected();
            case _tokentype.types.name:
              var startPos = this.start,
                  startLoc = this.startLoc;
              var id = this.parseIdent(this.type !== _tokentype.types.name);
              if (canBeArrow && !this.canInsertSemicolon() && this.eat(_tokentype.types.arrow))
                return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id]);
              return id;
            case _tokentype.types.regexp:
              var value = this.value;
              node = this.parseLiteral(value.value);
              node.regex = {
                pattern: value.pattern,
                flags: value.flags
              };
              return node;
            case _tokentype.types.num:
            case _tokentype.types.string:
              return this.parseLiteral(this.value);
            case _tokentype.types._null:
            case _tokentype.types._true:
            case _tokentype.types._false:
              node = this.startNode();
              node.value = this.type === _tokentype.types._null ? null : this.type === _tokentype.types._true;
              node.raw = this.type.keyword;
              this.next();
              return this.finishNode(node, "Literal");
            case _tokentype.types.parenL:
              return this.parseParenAndDistinguishExpression(canBeArrow);
            case _tokentype.types.bracketL:
              node = this.startNode();
              this.next();
              if (this.options.ecmaVersion >= 7 && this.type === _tokentype.types._for) {
                return this.parseComprehension(node, false);
              }
              node.elements = this.parseExprList(_tokentype.types.bracketR, true, true, refDestructuringErrors);
              return this.finishNode(node, "ArrayExpression");
            case _tokentype.types.braceL:
              return this.parseObj(false, refDestructuringErrors);
            case _tokentype.types._function:
              node = this.startNode();
              this.next();
              return this.parseFunction(node, false);
            case _tokentype.types._class:
              return this.parseClass(this.startNode(), false);
            case _tokentype.types._new:
              return this.parseNew();
            case _tokentype.types.backQuote:
              return this.parseTemplate();
            default:
              this.unexpected();
          }
        };
        pp.parseLiteral = function(value) {
          var node = this.startNode();
          node.value = value;
          node.raw = this.input.slice(this.start, this.end);
          this.next();
          return this.finishNode(node, "Literal");
        };
        pp.parseParenExpression = function() {
          this.expect(_tokentype.types.parenL);
          var val = this.parseExpression();
          this.expect(_tokentype.types.parenR);
          return val;
        };
        pp.parseParenAndDistinguishExpression = function(canBeArrow) {
          var startPos = this.start,
              startLoc = this.startLoc,
              val = undefined;
          if (this.options.ecmaVersion >= 6) {
            this.next();
            if (this.options.ecmaVersion >= 7 && this.type === _tokentype.types._for) {
              return this.parseComprehension(this.startNodeAt(startPos, startLoc), true);
            }
            var innerStartPos = this.start,
                innerStartLoc = this.startLoc;
            var exprList = [],
                first = true;
            var refDestructuringErrors = {
              shorthandAssign: 0,
              trailingComma: 0
            },
                spreadStart = undefined,
                innerParenStart = undefined;
            while (this.type !== _tokentype.types.parenR) {
              first ? first = false : this.expect(_tokentype.types.comma);
              if (this.type === _tokentype.types.ellipsis) {
                spreadStart = this.start;
                exprList.push(this.parseParenItem(this.parseRest()));
                break;
              } else {
                if (this.type === _tokentype.types.parenL && !innerParenStart) {
                  innerParenStart = this.start;
                }
                exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
              }
            }
            var innerEndPos = this.start,
                innerEndLoc = this.startLoc;
            this.expect(_tokentype.types.parenR);
            if (canBeArrow && !this.canInsertSemicolon() && this.eat(_tokentype.types.arrow)) {
              this.checkPatternErrors(refDestructuringErrors, true);
              if (innerParenStart)
                this.unexpected(innerParenStart);
              return this.parseParenArrowList(startPos, startLoc, exprList);
            }
            if (!exprList.length)
              this.unexpected(this.lastTokStart);
            if (spreadStart)
              this.unexpected(spreadStart);
            this.checkExpressionErrors(refDestructuringErrors, true);
            if (exprList.length > 1) {
              val = this.startNodeAt(innerStartPos, innerStartLoc);
              val.expressions = exprList;
              this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
            } else {
              val = exprList[0];
            }
          } else {
            val = this.parseParenExpression();
          }
          if (this.options.preserveParens) {
            var par = this.startNodeAt(startPos, startLoc);
            par.expression = val;
            return this.finishNode(par, "ParenthesizedExpression");
          } else {
            return val;
          }
        };
        pp.parseParenItem = function(item) {
          return item;
        };
        pp.parseParenArrowList = function(startPos, startLoc, exprList) {
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList);
        };
        var empty = [];
        pp.parseNew = function() {
          var node = this.startNode();
          var meta = this.parseIdent(true);
          if (this.options.ecmaVersion >= 6 && this.eat(_tokentype.types.dot)) {
            node.meta = meta;
            node.property = this.parseIdent(true);
            if (node.property.name !== "target")
              this.raise(node.property.start, "The only valid meta property for new is new.target");
            if (!this.inFunction)
              this.raise(node.start, "new.target can only be used in functions");
            return this.finishNode(node, "MetaProperty");
          }
          var startPos = this.start,
              startLoc = this.startLoc;
          node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
          if (this.eat(_tokentype.types.parenL))
            node.arguments = this.parseExprList(_tokentype.types.parenR, false);
          else
            node.arguments = empty;
          return this.finishNode(node, "NewExpression");
        };
        pp.parseTemplateElement = function() {
          var elem = this.startNode();
          elem.value = {
            raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, '\n'),
            cooked: this.value
          };
          this.next();
          elem.tail = this.type === _tokentype.types.backQuote;
          return this.finishNode(elem, "TemplateElement");
        };
        pp.parseTemplate = function() {
          var node = this.startNode();
          this.next();
          node.expressions = [];
          var curElt = this.parseTemplateElement();
          node.quasis = [curElt];
          while (!curElt.tail) {
            this.expect(_tokentype.types.dollarBraceL);
            node.expressions.push(this.parseExpression());
            this.expect(_tokentype.types.braceR);
            node.quasis.push(curElt = this.parseTemplateElement());
          }
          this.next();
          return this.finishNode(node, "TemplateLiteral");
        };
        pp.parseObj = function(isPattern, refDestructuringErrors) {
          var node = this.startNode(),
              first = true,
              propHash = {};
          node.properties = [];
          this.next();
          while (!this.eat(_tokentype.types.braceR)) {
            if (!first) {
              this.expect(_tokentype.types.comma);
              if (this.afterTrailingComma(_tokentype.types.braceR))
                break;
            } else
              first = false;
            var prop = this.startNode(),
                isGenerator = undefined,
                startPos = undefined,
                startLoc = undefined;
            if (this.options.ecmaVersion >= 6) {
              prop.method = false;
              prop.shorthand = false;
              if (isPattern || refDestructuringErrors) {
                startPos = this.start;
                startLoc = this.startLoc;
              }
              if (!isPattern)
                isGenerator = this.eat(_tokentype.types.star);
            }
            this.parsePropertyName(prop);
            this.parsePropertyValue(prop, isPattern, isGenerator, startPos, startLoc, refDestructuringErrors);
            this.checkPropClash(prop, propHash);
            node.properties.push(this.finishNode(prop, "Property"));
          }
          return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
        };
        pp.parsePropertyValue = function(prop, isPattern, isGenerator, startPos, startLoc, refDestructuringErrors) {
          if (this.eat(_tokentype.types.colon)) {
            prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
            prop.kind = "init";
          } else if (this.options.ecmaVersion >= 6 && this.type === _tokentype.types.parenL) {
            if (isPattern)
              this.unexpected();
            prop.kind = "init";
            prop.method = true;
            prop.value = this.parseMethod(isGenerator);
          } else if (this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type != _tokentype.types.comma && this.type != _tokentype.types.braceR)) {
            if (isGenerator || isPattern)
              this.unexpected();
            prop.kind = prop.key.name;
            this.parsePropertyName(prop);
            prop.value = this.parseMethod(false);
            var paramCount = prop.kind === "get" ? 0 : 1;
            if (prop.value.params.length !== paramCount) {
              var start = prop.value.start;
              if (prop.kind === "get")
                this.raise(start, "getter should have no params");
              else
                this.raise(start, "setter should have exactly one param");
            }
            if (prop.kind === "set" && prop.value.params[0].type === "RestElement")
              this.raise(prop.value.params[0].start, "Setter cannot use rest params");
          } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
            prop.kind = "init";
            if (isPattern) {
              if (this.keywords.test(prop.key.name) || (this.strict ? this.reservedWordsStrictBind : this.reservedWords).test(prop.key.name))
                this.raise(prop.key.start, "Binding " + prop.key.name);
              prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
            } else if (this.type === _tokentype.types.eq && refDestructuringErrors) {
              if (!refDestructuringErrors.shorthandAssign)
                refDestructuringErrors.shorthandAssign = this.start;
              prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
            } else {
              prop.value = prop.key;
            }
            prop.shorthand = true;
          } else
            this.unexpected();
        };
        pp.parsePropertyName = function(prop) {
          if (this.options.ecmaVersion >= 6) {
            if (this.eat(_tokentype.types.bracketL)) {
              prop.computed = true;
              prop.key = this.parseMaybeAssign();
              this.expect(_tokentype.types.bracketR);
              return prop.key;
            } else {
              prop.computed = false;
            }
          }
          return prop.key = this.type === _tokentype.types.num || this.type === _tokentype.types.string ? this.parseExprAtom() : this.parseIdent(true);
        };
        pp.initFunction = function(node) {
          node.id = null;
          if (this.options.ecmaVersion >= 6) {
            node.generator = false;
            node.expression = false;
          }
        };
        pp.parseMethod = function(isGenerator) {
          var node = this.startNode();
          this.initFunction(node);
          this.expect(_tokentype.types.parenL);
          node.params = this.parseBindingList(_tokentype.types.parenR, false, false);
          if (this.options.ecmaVersion >= 6)
            node.generator = isGenerator;
          this.parseFunctionBody(node, false);
          return this.finishNode(node, "FunctionExpression");
        };
        pp.parseArrowExpression = function(node, params) {
          this.initFunction(node);
          node.params = this.toAssignableList(params, true);
          this.parseFunctionBody(node, true);
          return this.finishNode(node, "ArrowFunctionExpression");
        };
        pp.parseFunctionBody = function(node, isArrowFunction) {
          var isExpression = isArrowFunction && this.type !== _tokentype.types.braceL;
          if (isExpression) {
            node.body = this.parseMaybeAssign();
            node.expression = true;
          } else {
            var oldInFunc = this.inFunction,
                oldInGen = this.inGenerator,
                oldLabels = this.labels;
            this.inFunction = true;
            this.inGenerator = node.generator;
            this.labels = [];
            node.body = this.parseBlock(true);
            node.expression = false;
            this.inFunction = oldInFunc;
            this.inGenerator = oldInGen;
            this.labels = oldLabels;
          }
          if (this.strict || !isExpression && node.body.body.length && this.isUseStrict(node.body.body[0])) {
            var oldStrict = this.strict;
            this.strict = true;
            if (node.id)
              this.checkLVal(node.id, true);
            this.checkParams(node);
            this.strict = oldStrict;
          } else if (isArrowFunction) {
            this.checkParams(node);
          }
        };
        pp.checkParams = function(node) {
          var nameHash = {};
          for (var i = 0; i < node.params.length; i++) {
            this.checkLVal(node.params[i], true, nameHash);
          }
        };
        pp.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
          var elts = [],
              first = true;
          while (!this.eat(close)) {
            if (!first) {
              this.expect(_tokentype.types.comma);
              if (this.type === close && refDestructuringErrors && !refDestructuringErrors.trailingComma) {
                refDestructuringErrors.trailingComma = this.lastTokStart;
              }
              if (allowTrailingComma && this.afterTrailingComma(close))
                break;
            } else
              first = false;
            var elt = undefined;
            if (allowEmpty && this.type === _tokentype.types.comma)
              elt = null;
            else if (this.type === _tokentype.types.ellipsis)
              elt = this.parseSpread(refDestructuringErrors);
            else
              elt = this.parseMaybeAssign(false, refDestructuringErrors);
            elts.push(elt);
          }
          return elts;
        };
        pp.parseIdent = function(liberal) {
          var node = this.startNode();
          if (liberal && this.options.allowReserved == "never")
            liberal = false;
          if (this.type === _tokentype.types.name) {
            if (!liberal && (this.strict ? this.reservedWordsStrict : this.reservedWords).test(this.value) && (this.options.ecmaVersion >= 6 || this.input.slice(this.start, this.end).indexOf("\\") == -1))
              this.raise(this.start, "The keyword '" + this.value + "' is reserved");
            node.name = this.value;
          } else if (liberal && this.type.keyword) {
            node.name = this.type.keyword;
          } else {
            this.unexpected();
          }
          this.next();
          return this.finishNode(node, "Identifier");
        };
        pp.parseYield = function() {
          var node = this.startNode();
          this.next();
          if (this.type == _tokentype.types.semi || this.canInsertSemicolon() || this.type != _tokentype.types.star && !this.type.startsExpr) {
            node.delegate = false;
            node.argument = null;
          } else {
            node.delegate = this.eat(_tokentype.types.star);
            node.argument = this.parseMaybeAssign();
          }
          return this.finishNode(node, "YieldExpression");
        };
        pp.parseComprehension = function(node, isGenerator) {
          node.blocks = [];
          while (this.type === _tokentype.types._for) {
            var block = this.startNode();
            this.next();
            this.expect(_tokentype.types.parenL);
            block.left = this.parseBindingAtom();
            this.checkLVal(block.left, true);
            this.expectContextual("of");
            block.right = this.parseExpression();
            this.expect(_tokentype.types.parenR);
            node.blocks.push(this.finishNode(block, "ComprehensionBlock"));
          }
          node.filter = this.eat(_tokentype.types._if) ? this.parseParenExpression() : null;
          node.body = this.parseExpression();
          this.expect(isGenerator ? _tokentype.types.parenR : _tokentype.types.bracketR);
          node.generator = isGenerator;
          return this.finishNode(node, "ComprehensionExpression");
        };
      }, {
        "./state": 10,
        "./tokentype": 14
      }],
      2: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.isIdentifierStart = isIdentifierStart;
        exports.isIdentifierChar = isIdentifierChar;
        var reservedWords = {
          3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
          5: "class enum extends super const export import",
          6: "enum",
          strict: "implements interface let package private protected public static yield",
          strictBind: "eval arguments"
        };
        exports.reservedWords = reservedWords;
        var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";
        var keywords = {
          5: ecma5AndLessKeywords,
          6: ecma5AndLessKeywords + " let const class extends export import yield super"
        };
        exports.keywords = keywords;
        var nonASCIIidentifierStartChars = "ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠ-ࢲऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ℘-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ゛-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞭꞰꞱꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭟꭤꭥꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ";
        var nonASCIIidentifierChars = "‌‍·̀-ͯ·҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࣤ-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ଁ-ଃ଼ା-ୄେୈୋ-୍ୖୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఃా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ഁ-ഃാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ංඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ູົຼ່-ໍ໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟፩-፱ᜒ-᜔ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠐-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏ᦰ-ᧀᧈᧉ᧐-᧚ᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭ᳲ-᳴᳸᳹᷀-᷵᷼-᷿‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯꘠-꘩꙯ꙴ-꙽ꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧꢀꢁꢴ-꣄꣐-꣙꣠-꣱꤀-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-︭︳︴﹍-﹏０-９＿";
        var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
        var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
        nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
        var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 17, 26, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 99, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 98, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 26, 45, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 955, 52, 76, 44, 33, 24, 27, 35, 42, 34, 4, 0, 13, 47, 15, 3, 22, 0, 38, 17, 2, 24, 133, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 32, 4, 287, 47, 21, 1, 2, 0, 185, 46, 82, 47, 21, 0, 60, 42, 502, 63, 32, 0, 449, 56, 1288, 920, 104, 110, 2962, 1070, 13266, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 881, 68, 12, 0, 67, 12, 16481, 1, 3071, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 4149, 196, 1340, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42710, 42, 4148, 12, 221, 16355, 541];
        var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 1306, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 52, 0, 13, 2, 49, 13, 16, 9, 83, 11, 168, 11, 6, 9, 8, 2, 57, 0, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 316, 19, 13, 9, 214, 6, 3, 8, 112, 16, 16, 9, 82, 12, 9, 9, 535, 9, 20855, 9, 135, 4, 60, 6, 26, 9, 1016, 45, 17, 3, 19723, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 4305, 6, 792618, 239];
        function isInAstralSet(code, set) {
          var pos = 0x10000;
          for (var i = 0; i < set.length; i += 2) {
            pos += set[i];
            if (pos > code)
              return false;
            pos += set[i + 1];
            if (pos >= code)
              return true;
          }
        }
        function isIdentifierStart(code, astral) {
          if (code < 65)
            return code === 36;
          if (code < 91)
            return true;
          if (code < 97)
            return code === 95;
          if (code < 123)
            return true;
          if (code <= 0xffff)
            return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
          if (astral === false)
            return false;
          return isInAstralSet(code, astralIdentifierStartCodes);
        }
        function isIdentifierChar(code, astral) {
          if (code < 48)
            return code === 36;
          if (code < 58)
            return true;
          if (code < 65)
            return false;
          if (code < 91)
            return true;
          if (code < 97)
            return code === 95;
          if (code < 123)
            return true;
          if (code <= 0xffff)
            return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
          if (astral === false)
            return false;
          return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
        }
      }, {}],
      3: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.parse = parse;
        exports.parseExpressionAt = parseExpressionAt;
        exports.tokenizer = tokenizer;
        var _state = _dereq_("./state");
        _dereq_("./parseutil");
        _dereq_("./statement");
        _dereq_("./lval");
        _dereq_("./expression");
        _dereq_("./location");
        exports.Parser = _state.Parser;
        exports.plugins = _state.plugins;
        var _options = _dereq_("./options");
        exports.defaultOptions = _options.defaultOptions;
        var _locutil = _dereq_("./locutil");
        exports.Position = _locutil.Position;
        exports.SourceLocation = _locutil.SourceLocation;
        exports.getLineInfo = _locutil.getLineInfo;
        var _node = _dereq_("./node");
        exports.Node = _node.Node;
        var _tokentype = _dereq_("./tokentype");
        exports.TokenType = _tokentype.TokenType;
        exports.tokTypes = _tokentype.types;
        var _tokencontext = _dereq_("./tokencontext");
        exports.TokContext = _tokencontext.TokContext;
        exports.tokContexts = _tokencontext.types;
        var _identifier = _dereq_("./identifier");
        exports.isIdentifierChar = _identifier.isIdentifierChar;
        exports.isIdentifierStart = _identifier.isIdentifierStart;
        var _tokenize = _dereq_("./tokenize");
        exports.Token = _tokenize.Token;
        var _whitespace = _dereq_("./whitespace");
        exports.isNewLine = _whitespace.isNewLine;
        exports.lineBreak = _whitespace.lineBreak;
        exports.lineBreakG = _whitespace.lineBreakG;
        var version = "2.7.0";
        exports.version = version;
        function parse(input, options) {
          return new _state.Parser(options, input).parse();
        }
        function parseExpressionAt(input, pos, options) {
          var p = new _state.Parser(options, input, pos);
          p.nextToken();
          return p.parseExpression();
        }
        function tokenizer(input, options) {
          return new _state.Parser(options, input);
        }
      }, {
        "./expression": 1,
        "./identifier": 2,
        "./location": 4,
        "./locutil": 5,
        "./lval": 6,
        "./node": 7,
        "./options": 8,
        "./parseutil": 9,
        "./state": 10,
        "./statement": 11,
        "./tokencontext": 12,
        "./tokenize": 13,
        "./tokentype": 14,
        "./whitespace": 16
      }],
      4: [function(_dereq_, module, exports) {
        "use strict";
        var _state = _dereq_("./state");
        var _locutil = _dereq_("./locutil");
        var pp = _state.Parser.prototype;
        pp.raise = function(pos, message) {
          var loc = _locutil.getLineInfo(this.input, pos);
          message += " (" + loc.line + ":" + loc.column + ")";
          var err = new SyntaxError(message);
          err.pos = pos;
          err.loc = loc;
          err.raisedAt = this.pos;
          throw err;
        };
        pp.curPosition = function() {
          if (this.options.locations) {
            return new _locutil.Position(this.curLine, this.pos - this.lineStart);
          }
        };
      }, {
        "./locutil": 5,
        "./state": 10
      }],
      5: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.getLineInfo = getLineInfo;
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        var _whitespace = _dereq_("./whitespace");
        var Position = (function() {
          function Position(line, col) {
            _classCallCheck(this, Position);
            this.line = line;
            this.column = col;
          }
          Position.prototype.offset = function offset(n) {
            return new Position(this.line, this.column + n);
          };
          return Position;
        })();
        exports.Position = Position;
        var SourceLocation = function SourceLocation(p, start, end) {
          _classCallCheck(this, SourceLocation);
          this.start = start;
          this.end = end;
          if (p.sourceFile !== null)
            this.source = p.sourceFile;
        };
        ;
        exports.SourceLocation = SourceLocation;
        function getLineInfo(input, offset) {
          for (var line = 1,
              cur = 0; ; ) {
            _whitespace.lineBreakG.lastIndex = cur;
            var match = _whitespace.lineBreakG.exec(input);
            if (match && match.index < offset) {
              ++line;
              cur = match.index + match[0].length;
            } else {
              return new Position(line, offset - cur);
            }
          }
        }
      }, {"./whitespace": 16}],
      6: [function(_dereq_, module, exports) {
        "use strict";
        var _tokentype = _dereq_("./tokentype");
        var _state = _dereq_("./state");
        var _util = _dereq_("./util");
        var pp = _state.Parser.prototype;
        pp.toAssignable = function(node, isBinding) {
          if (this.options.ecmaVersion >= 6 && node) {
            switch (node.type) {
              case "Identifier":
              case "ObjectPattern":
              case "ArrayPattern":
                break;
              case "ObjectExpression":
                node.type = "ObjectPattern";
                for (var i = 0; i < node.properties.length; i++) {
                  var prop = node.properties[i];
                  if (prop.kind !== "init")
                    this.raise(prop.key.start, "Object pattern can't contain getter or setter");
                  this.toAssignable(prop.value, isBinding);
                }
                break;
              case "ArrayExpression":
                node.type = "ArrayPattern";
                this.toAssignableList(node.elements, isBinding);
                break;
              case "AssignmentExpression":
                if (node.operator === "=") {
                  node.type = "AssignmentPattern";
                  delete node.operator;
                } else {
                  this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
                  break;
                }
              case "AssignmentPattern":
                if (node.right.type === "YieldExpression")
                  this.raise(node.right.start, "Yield expression cannot be a default value");
                break;
              case "ParenthesizedExpression":
                node.expression = this.toAssignable(node.expression, isBinding);
                break;
              case "MemberExpression":
                if (!isBinding)
                  break;
              default:
                this.raise(node.start, "Assigning to rvalue");
            }
          }
          return node;
        };
        pp.toAssignableList = function(exprList, isBinding) {
          var end = exprList.length;
          if (end) {
            var last = exprList[end - 1];
            if (last && last.type == "RestElement") {
              --end;
            } else if (last && last.type == "SpreadElement") {
              last.type = "RestElement";
              var arg = last.argument;
              this.toAssignable(arg, isBinding);
              if (arg.type !== "Identifier" && arg.type !== "MemberExpression" && arg.type !== "ArrayPattern")
                this.unexpected(arg.start);
              --end;
            }
            if (isBinding && last.type === "RestElement" && last.argument.type !== "Identifier")
              this.unexpected(last.argument.start);
          }
          for (var i = 0; i < end; i++) {
            var elt = exprList[i];
            if (elt)
              this.toAssignable(elt, isBinding);
          }
          return exprList;
        };
        pp.parseSpread = function(refDestructuringErrors) {
          var node = this.startNode();
          this.next();
          node.argument = this.parseMaybeAssign(refDestructuringErrors);
          return this.finishNode(node, "SpreadElement");
        };
        pp.parseRest = function(allowNonIdent) {
          var node = this.startNode();
          this.next();
          if (allowNonIdent)
            node.argument = this.type === _tokentype.types.name ? this.parseIdent() : this.unexpected();
          else
            node.argument = this.type === _tokentype.types.name || this.type === _tokentype.types.bracketL ? this.parseBindingAtom() : this.unexpected();
          return this.finishNode(node, "RestElement");
        };
        pp.parseBindingAtom = function() {
          if (this.options.ecmaVersion < 6)
            return this.parseIdent();
          switch (this.type) {
            case _tokentype.types.name:
              return this.parseIdent();
            case _tokentype.types.bracketL:
              var node = this.startNode();
              this.next();
              node.elements = this.parseBindingList(_tokentype.types.bracketR, true, true);
              return this.finishNode(node, "ArrayPattern");
            case _tokentype.types.braceL:
              return this.parseObj(true);
            default:
              this.unexpected();
          }
        };
        pp.parseBindingList = function(close, allowEmpty, allowTrailingComma, allowNonIdent) {
          var elts = [],
              first = true;
          while (!this.eat(close)) {
            if (first)
              first = false;
            else
              this.expect(_tokentype.types.comma);
            if (allowEmpty && this.type === _tokentype.types.comma) {
              elts.push(null);
            } else if (allowTrailingComma && this.afterTrailingComma(close)) {
              break;
            } else if (this.type === _tokentype.types.ellipsis) {
              var rest = this.parseRest(allowNonIdent);
              this.parseBindingListItem(rest);
              elts.push(rest);
              this.expect(close);
              break;
            } else {
              var elem = this.parseMaybeDefault(this.start, this.startLoc);
              this.parseBindingListItem(elem);
              elts.push(elem);
            }
          }
          return elts;
        };
        pp.parseBindingListItem = function(param) {
          return param;
        };
        pp.parseMaybeDefault = function(startPos, startLoc, left) {
          left = left || this.parseBindingAtom();
          if (this.options.ecmaVersion < 6 || !this.eat(_tokentype.types.eq))
            return left;
          var node = this.startNodeAt(startPos, startLoc);
          node.left = left;
          node.right = this.parseMaybeAssign();
          return this.finishNode(node, "AssignmentPattern");
        };
        pp.checkLVal = function(expr, isBinding, checkClashes) {
          switch (expr.type) {
            case "Identifier":
              if (this.strict && this.reservedWordsStrictBind.test(expr.name))
                this.raise(expr.start, (isBinding ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
              if (checkClashes) {
                if (_util.has(checkClashes, expr.name))
                  this.raise(expr.start, "Argument name clash");
                checkClashes[expr.name] = true;
              }
              break;
            case "MemberExpression":
              if (isBinding)
                this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " member expression");
              break;
            case "ObjectPattern":
              for (var i = 0; i < expr.properties.length; i++) {
                this.checkLVal(expr.properties[i].value, isBinding, checkClashes);
              }
              break;
            case "ArrayPattern":
              for (var i = 0; i < expr.elements.length; i++) {
                var elem = expr.elements[i];
                if (elem)
                  this.checkLVal(elem, isBinding, checkClashes);
              }
              break;
            case "AssignmentPattern":
              this.checkLVal(expr.left, isBinding, checkClashes);
              break;
            case "RestElement":
              this.checkLVal(expr.argument, isBinding, checkClashes);
              break;
            case "ParenthesizedExpression":
              this.checkLVal(expr.expression, isBinding, checkClashes);
              break;
            default:
              this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " rvalue");
          }
        };
      }, {
        "./state": 10,
        "./tokentype": 14,
        "./util": 15
      }],
      7: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        var _state = _dereq_("./state");
        var _locutil = _dereq_("./locutil");
        var Node = function Node(parser, pos, loc) {
          _classCallCheck(this, Node);
          this.type = "";
          this.start = pos;
          this.end = 0;
          if (parser.options.locations)
            this.loc = new _locutil.SourceLocation(parser, loc);
          if (parser.options.directSourceFile)
            this.sourceFile = parser.options.directSourceFile;
          if (parser.options.ranges)
            this.range = [pos, 0];
        };
        ;
        exports.Node = Node;
        var pp = _state.Parser.prototype;
        pp.startNode = function() {
          return new Node(this, this.start, this.startLoc);
        };
        pp.startNodeAt = function(pos, loc) {
          return new Node(this, pos, loc);
        };
        function finishNodeAt(node, type, pos, loc) {
          node.type = type;
          node.end = pos;
          if (this.options.locations)
            node.loc.end = loc;
          if (this.options.ranges)
            node.range[1] = pos;
          return node;
        }
        pp.finishNode = function(node, type) {
          return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
        };
        pp.finishNodeAt = function(node, type, pos, loc) {
          return finishNodeAt.call(this, node, type, pos, loc);
        };
      }, {
        "./locutil": 5,
        "./state": 10
      }],
      8: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.getOptions = getOptions;
        var _util = _dereq_("./util");
        var _locutil = _dereq_("./locutil");
        var defaultOptions = {
          ecmaVersion: 5,
          sourceType: "script",
          onInsertedSemicolon: null,
          onTrailingComma: null,
          allowReserved: null,
          allowReturnOutsideFunction: false,
          allowImportExportEverywhere: false,
          allowHashBang: false,
          locations: false,
          onToken: null,
          onComment: null,
          ranges: false,
          program: null,
          sourceFile: null,
          directSourceFile: null,
          preserveParens: false,
          plugins: {}
        };
        exports.defaultOptions = defaultOptions;
        function getOptions(opts) {
          var options = {};
          for (var opt in defaultOptions) {
            options[opt] = opts && _util.has(opts, opt) ? opts[opt] : defaultOptions[opt];
          }
          if (options.allowReserved == null)
            options.allowReserved = options.ecmaVersion < 5;
          if (_util.isArray(options.onToken)) {
            (function() {
              var tokens = options.onToken;
              options.onToken = function(token) {
                return tokens.push(token);
              };
            })();
          }
          if (_util.isArray(options.onComment))
            options.onComment = pushComment(options, options.onComment);
          return options;
        }
        function pushComment(options, array) {
          return function(block, text, start, end, startLoc, endLoc) {
            var comment = {
              type: block ? 'Block' : 'Line',
              value: text,
              start: start,
              end: end
            };
            if (options.locations)
              comment.loc = new _locutil.SourceLocation(this, startLoc, endLoc);
            if (options.ranges)
              comment.range = [start, end];
            array.push(comment);
          };
        }
      }, {
        "./locutil": 5,
        "./util": 15
      }],
      9: [function(_dereq_, module, exports) {
        "use strict";
        var _tokentype = _dereq_("./tokentype");
        var _state = _dereq_("./state");
        var _whitespace = _dereq_("./whitespace");
        var pp = _state.Parser.prototype;
        pp.isUseStrict = function(stmt) {
          return this.options.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && stmt.expression.raw.slice(1, -1) === "use strict";
        };
        pp.eat = function(type) {
          if (this.type === type) {
            this.next();
            return true;
          } else {
            return false;
          }
        };
        pp.isContextual = function(name) {
          return this.type === _tokentype.types.name && this.value === name;
        };
        pp.eatContextual = function(name) {
          return this.value === name && this.eat(_tokentype.types.name);
        };
        pp.expectContextual = function(name) {
          if (!this.eatContextual(name))
            this.unexpected();
        };
        pp.canInsertSemicolon = function() {
          return this.type === _tokentype.types.eof || this.type === _tokentype.types.braceR || _whitespace.lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
        };
        pp.insertSemicolon = function() {
          if (this.canInsertSemicolon()) {
            if (this.options.onInsertedSemicolon)
              this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
            return true;
          }
        };
        pp.semicolon = function() {
          if (!this.eat(_tokentype.types.semi) && !this.insertSemicolon())
            this.unexpected();
        };
        pp.afterTrailingComma = function(tokType) {
          if (this.type == tokType) {
            if (this.options.onTrailingComma)
              this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
            this.next();
            return true;
          }
        };
        pp.expect = function(type) {
          this.eat(type) || this.unexpected();
        };
        pp.unexpected = function(pos) {
          this.raise(pos != null ? pos : this.start, "Unexpected token");
        };
        pp.checkPatternErrors = function(refDestructuringErrors, andThrow) {
          var pos = refDestructuringErrors && refDestructuringErrors.trailingComma;
          if (!andThrow)
            return !!pos;
          if (pos)
            this.raise(pos, "Trailing comma is not permitted in destructuring patterns");
        };
        pp.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
          var pos = refDestructuringErrors && refDestructuringErrors.shorthandAssign;
          if (!andThrow)
            return !!pos;
          if (pos)
            this.raise(pos, "Shorthand property assignments are valid only in destructuring patterns");
        };
      }, {
        "./state": 10,
        "./tokentype": 14,
        "./whitespace": 16
      }],
      10: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        var _identifier = _dereq_("./identifier");
        var _tokentype = _dereq_("./tokentype");
        var _whitespace = _dereq_("./whitespace");
        var _options = _dereq_("./options");
        var plugins = {};
        exports.plugins = plugins;
        function keywordRegexp(words) {
          return new RegExp("^(" + words.replace(/ /g, "|") + ")$");
        }
        var Parser = (function() {
          function Parser(options, input, startPos) {
            _classCallCheck(this, Parser);
            this.options = options = _options.getOptions(options);
            this.sourceFile = options.sourceFile;
            this.keywords = keywordRegexp(_identifier.keywords[options.ecmaVersion >= 6 ? 6 : 5]);
            var reserved = options.allowReserved ? "" : _identifier.reservedWords[options.ecmaVersion] + (options.sourceType == "module" ? " await" : "");
            this.reservedWords = keywordRegexp(reserved);
            var reservedStrict = (reserved ? reserved + " " : "") + _identifier.reservedWords.strict;
            this.reservedWordsStrict = keywordRegexp(reservedStrict);
            this.reservedWordsStrictBind = keywordRegexp(reservedStrict + " " + _identifier.reservedWords.strictBind);
            this.input = String(input);
            this.containsEsc = false;
            this.loadPlugins(options.plugins);
            if (startPos) {
              this.pos = startPos;
              this.lineStart = Math.max(0, this.input.lastIndexOf("\n", startPos));
              this.curLine = this.input.slice(0, this.lineStart).split(_whitespace.lineBreak).length;
            } else {
              this.pos = this.lineStart = 0;
              this.curLine = 1;
            }
            this.type = _tokentype.types.eof;
            this.value = null;
            this.start = this.end = this.pos;
            this.startLoc = this.endLoc = this.curPosition();
            this.lastTokEndLoc = this.lastTokStartLoc = null;
            this.lastTokStart = this.lastTokEnd = this.pos;
            this.context = this.initialContext();
            this.exprAllowed = true;
            this.strict = this.inModule = options.sourceType === "module";
            this.potentialArrowAt = -1;
            this.inFunction = this.inGenerator = false;
            this.labels = [];
            if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === '#!')
              this.skipLineComment(2);
          }
          Parser.prototype.isKeyword = function isKeyword(word) {
            return this.keywords.test(word);
          };
          Parser.prototype.isReservedWord = function isReservedWord(word) {
            return this.reservedWords.test(word);
          };
          Parser.prototype.extend = function extend(name, f) {
            this[name] = f(this[name]);
          };
          Parser.prototype.loadPlugins = function loadPlugins(pluginConfigs) {
            for (var _name in pluginConfigs) {
              var plugin = plugins[_name];
              if (!plugin)
                throw new Error("Plugin '" + _name + "' not found");
              plugin(this, pluginConfigs[_name]);
            }
          };
          Parser.prototype.parse = function parse() {
            var node = this.options.program || this.startNode();
            this.nextToken();
            return this.parseTopLevel(node);
          };
          return Parser;
        })();
        exports.Parser = Parser;
      }, {
        "./identifier": 2,
        "./options": 8,
        "./tokentype": 14,
        "./whitespace": 16
      }],
      11: [function(_dereq_, module, exports) {
        "use strict";
        var _tokentype = _dereq_("./tokentype");
        var _state = _dereq_("./state");
        var _whitespace = _dereq_("./whitespace");
        var pp = _state.Parser.prototype;
        pp.parseTopLevel = function(node) {
          var first = true;
          if (!node.body)
            node.body = [];
          while (this.type !== _tokentype.types.eof) {
            var stmt = this.parseStatement(true, true);
            node.body.push(stmt);
            if (first) {
              if (this.isUseStrict(stmt))
                this.setStrict(true);
              first = false;
            }
          }
          this.next();
          if (this.options.ecmaVersion >= 6) {
            node.sourceType = this.options.sourceType;
          }
          return this.finishNode(node, "Program");
        };
        var loopLabel = {kind: "loop"},
            switchLabel = {kind: "switch"};
        pp.parseStatement = function(declaration, topLevel) {
          var starttype = this.type,
              node = this.startNode();
          switch (starttype) {
            case _tokentype.types._break:
            case _tokentype.types._continue:
              return this.parseBreakContinueStatement(node, starttype.keyword);
            case _tokentype.types._debugger:
              return this.parseDebuggerStatement(node);
            case _tokentype.types._do:
              return this.parseDoStatement(node);
            case _tokentype.types._for:
              return this.parseForStatement(node);
            case _tokentype.types._function:
              if (!declaration && this.options.ecmaVersion >= 6)
                this.unexpected();
              return this.parseFunctionStatement(node);
            case _tokentype.types._class:
              if (!declaration)
                this.unexpected();
              return this.parseClass(node, true);
            case _tokentype.types._if:
              return this.parseIfStatement(node);
            case _tokentype.types._return:
              return this.parseReturnStatement(node);
            case _tokentype.types._switch:
              return this.parseSwitchStatement(node);
            case _tokentype.types._throw:
              return this.parseThrowStatement(node);
            case _tokentype.types._try:
              return this.parseTryStatement(node);
            case _tokentype.types._let:
            case _tokentype.types._const:
              if (!declaration)
                this.unexpected();
            case _tokentype.types._var:
              return this.parseVarStatement(node, starttype);
            case _tokentype.types._while:
              return this.parseWhileStatement(node);
            case _tokentype.types._with:
              return this.parseWithStatement(node);
            case _tokentype.types.braceL:
              return this.parseBlock();
            case _tokentype.types.semi:
              return this.parseEmptyStatement(node);
            case _tokentype.types._export:
            case _tokentype.types._import:
              if (!this.options.allowImportExportEverywhere) {
                if (!topLevel)
                  this.raise(this.start, "'import' and 'export' may only appear at the top level");
                if (!this.inModule)
                  this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
              }
              return starttype === _tokentype.types._import ? this.parseImport(node) : this.parseExport(node);
            default:
              var maybeName = this.value,
                  expr = this.parseExpression();
              if (starttype === _tokentype.types.name && expr.type === "Identifier" && this.eat(_tokentype.types.colon))
                return this.parseLabeledStatement(node, maybeName, expr);
              else
                return this.parseExpressionStatement(node, expr);
          }
        };
        pp.parseBreakContinueStatement = function(node, keyword) {
          var isBreak = keyword == "break";
          this.next();
          if (this.eat(_tokentype.types.semi) || this.insertSemicolon())
            node.label = null;
          else if (this.type !== _tokentype.types.name)
            this.unexpected();
          else {
            node.label = this.parseIdent();
            this.semicolon();
          }
          for (var i = 0; i < this.labels.length; ++i) {
            var lab = this.labels[i];
            if (node.label == null || lab.name === node.label.name) {
              if (lab.kind != null && (isBreak || lab.kind === "loop"))
                break;
              if (node.label && isBreak)
                break;
            }
          }
          if (i === this.labels.length)
            this.raise(node.start, "Unsyntactic " + keyword);
          return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
        };
        pp.parseDebuggerStatement = function(node) {
          this.next();
          this.semicolon();
          return this.finishNode(node, "DebuggerStatement");
        };
        pp.parseDoStatement = function(node) {
          this.next();
          this.labels.push(loopLabel);
          node.body = this.parseStatement(false);
          this.labels.pop();
          this.expect(_tokentype.types._while);
          node.test = this.parseParenExpression();
          if (this.options.ecmaVersion >= 6)
            this.eat(_tokentype.types.semi);
          else
            this.semicolon();
          return this.finishNode(node, "DoWhileStatement");
        };
        pp.parseForStatement = function(node) {
          this.next();
          this.labels.push(loopLabel);
          this.expect(_tokentype.types.parenL);
          if (this.type === _tokentype.types.semi)
            return this.parseFor(node, null);
          if (this.type === _tokentype.types._var || this.type === _tokentype.types._let || this.type === _tokentype.types._const) {
            var _init = this.startNode(),
                varKind = this.type;
            this.next();
            this.parseVar(_init, true, varKind);
            this.finishNode(_init, "VariableDeclaration");
            if ((this.type === _tokentype.types._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && _init.declarations.length === 1 && !(varKind !== _tokentype.types._var && _init.declarations[0].init))
              return this.parseForIn(node, _init);
            return this.parseFor(node, _init);
          }
          var refDestructuringErrors = {
            shorthandAssign: 0,
            trailingComma: 0
          };
          var init = this.parseExpression(true, refDestructuringErrors);
          if (this.type === _tokentype.types._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) {
            this.checkPatternErrors(refDestructuringErrors, true);
            this.toAssignable(init);
            this.checkLVal(init);
            return this.parseForIn(node, init);
          } else {
            this.checkExpressionErrors(refDestructuringErrors, true);
          }
          return this.parseFor(node, init);
        };
        pp.parseFunctionStatement = function(node) {
          this.next();
          return this.parseFunction(node, true);
        };
        pp.parseIfStatement = function(node) {
          this.next();
          node.test = this.parseParenExpression();
          node.consequent = this.parseStatement(false);
          node.alternate = this.eat(_tokentype.types._else) ? this.parseStatement(false) : null;
          return this.finishNode(node, "IfStatement");
        };
        pp.parseReturnStatement = function(node) {
          if (!this.inFunction && !this.options.allowReturnOutsideFunction)
            this.raise(this.start, "'return' outside of function");
          this.next();
          if (this.eat(_tokentype.types.semi) || this.insertSemicolon())
            node.argument = null;
          else {
            node.argument = this.parseExpression();
            this.semicolon();
          }
          return this.finishNode(node, "ReturnStatement");
        };
        pp.parseSwitchStatement = function(node) {
          this.next();
          node.discriminant = this.parseParenExpression();
          node.cases = [];
          this.expect(_tokentype.types.braceL);
          this.labels.push(switchLabel);
          for (var cur,
              sawDefault = false; this.type != _tokentype.types.braceR; ) {
            if (this.type === _tokentype.types._case || this.type === _tokentype.types._default) {
              var isCase = this.type === _tokentype.types._case;
              if (cur)
                this.finishNode(cur, "SwitchCase");
              node.cases.push(cur = this.startNode());
              cur.consequent = [];
              this.next();
              if (isCase) {
                cur.test = this.parseExpression();
              } else {
                if (sawDefault)
                  this.raise(this.lastTokStart, "Multiple default clauses");
                sawDefault = true;
                cur.test = null;
              }
              this.expect(_tokentype.types.colon);
            } else {
              if (!cur)
                this.unexpected();
              cur.consequent.push(this.parseStatement(true));
            }
          }
          if (cur)
            this.finishNode(cur, "SwitchCase");
          this.next();
          this.labels.pop();
          return this.finishNode(node, "SwitchStatement");
        };
        pp.parseThrowStatement = function(node) {
          this.next();
          if (_whitespace.lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))
            this.raise(this.lastTokEnd, "Illegal newline after throw");
          node.argument = this.parseExpression();
          this.semicolon();
          return this.finishNode(node, "ThrowStatement");
        };
        var empty = [];
        pp.parseTryStatement = function(node) {
          this.next();
          node.block = this.parseBlock();
          node.handler = null;
          if (this.type === _tokentype.types._catch) {
            var clause = this.startNode();
            this.next();
            this.expect(_tokentype.types.parenL);
            clause.param = this.parseBindingAtom();
            this.checkLVal(clause.param, true);
            this.expect(_tokentype.types.parenR);
            clause.body = this.parseBlock();
            node.handler = this.finishNode(clause, "CatchClause");
          }
          node.finalizer = this.eat(_tokentype.types._finally) ? this.parseBlock() : null;
          if (!node.handler && !node.finalizer)
            this.raise(node.start, "Missing catch or finally clause");
          return this.finishNode(node, "TryStatement");
        };
        pp.parseVarStatement = function(node, kind) {
          this.next();
          this.parseVar(node, false, kind);
          this.semicolon();
          return this.finishNode(node, "VariableDeclaration");
        };
        pp.parseWhileStatement = function(node) {
          this.next();
          node.test = this.parseParenExpression();
          this.labels.push(loopLabel);
          node.body = this.parseStatement(false);
          this.labels.pop();
          return this.finishNode(node, "WhileStatement");
        };
        pp.parseWithStatement = function(node) {
          if (this.strict)
            this.raise(this.start, "'with' in strict mode");
          this.next();
          node.object = this.parseParenExpression();
          node.body = this.parseStatement(false);
          return this.finishNode(node, "WithStatement");
        };
        pp.parseEmptyStatement = function(node) {
          this.next();
          return this.finishNode(node, "EmptyStatement");
        };
        pp.parseLabeledStatement = function(node, maybeName, expr) {
          for (var i = 0; i < this.labels.length; ++i) {
            if (this.labels[i].name === maybeName)
              this.raise(expr.start, "Label '" + maybeName + "' is already declared");
          }
          var kind = this.type.isLoop ? "loop" : this.type === _tokentype.types._switch ? "switch" : null;
          for (var i = this.labels.length - 1; i >= 0; i--) {
            var label = this.labels[i];
            if (label.statementStart == node.start) {
              label.statementStart = this.start;
              label.kind = kind;
            } else
              break;
          }
          this.labels.push({
            name: maybeName,
            kind: kind,
            statementStart: this.start
          });
          node.body = this.parseStatement(true);
          this.labels.pop();
          node.label = expr;
          return this.finishNode(node, "LabeledStatement");
        };
        pp.parseExpressionStatement = function(node, expr) {
          node.expression = expr;
          this.semicolon();
          return this.finishNode(node, "ExpressionStatement");
        };
        pp.parseBlock = function(allowStrict) {
          var node = this.startNode(),
              first = true,
              oldStrict = undefined;
          node.body = [];
          this.expect(_tokentype.types.braceL);
          while (!this.eat(_tokentype.types.braceR)) {
            var stmt = this.parseStatement(true);
            node.body.push(stmt);
            if (first && allowStrict && this.isUseStrict(stmt)) {
              oldStrict = this.strict;
              this.setStrict(this.strict = true);
            }
            first = false;
          }
          if (oldStrict === false)
            this.setStrict(false);
          return this.finishNode(node, "BlockStatement");
        };
        pp.parseFor = function(node, init) {
          node.init = init;
          this.expect(_tokentype.types.semi);
          node.test = this.type === _tokentype.types.semi ? null : this.parseExpression();
          this.expect(_tokentype.types.semi);
          node.update = this.type === _tokentype.types.parenR ? null : this.parseExpression();
          this.expect(_tokentype.types.parenR);
          node.body = this.parseStatement(false);
          this.labels.pop();
          return this.finishNode(node, "ForStatement");
        };
        pp.parseForIn = function(node, init) {
          var type = this.type === _tokentype.types._in ? "ForInStatement" : "ForOfStatement";
          this.next();
          node.left = init;
          node.right = this.parseExpression();
          this.expect(_tokentype.types.parenR);
          node.body = this.parseStatement(false);
          this.labels.pop();
          return this.finishNode(node, type);
        };
        pp.parseVar = function(node, isFor, kind) {
          node.declarations = [];
          node.kind = kind.keyword;
          for (; ; ) {
            var decl = this.startNode();
            this.parseVarId(decl);
            if (this.eat(_tokentype.types.eq)) {
              decl.init = this.parseMaybeAssign(isFor);
            } else if (kind === _tokentype.types._const && !(this.type === _tokentype.types._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
              this.unexpected();
            } else if (decl.id.type != "Identifier" && !(isFor && (this.type === _tokentype.types._in || this.isContextual("of")))) {
              this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
            } else {
              decl.init = null;
            }
            node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
            if (!this.eat(_tokentype.types.comma))
              break;
          }
          return node;
        };
        pp.parseVarId = function(decl) {
          decl.id = this.parseBindingAtom();
          this.checkLVal(decl.id, true);
        };
        pp.parseFunction = function(node, isStatement, allowExpressionBody) {
          this.initFunction(node);
          if (this.options.ecmaVersion >= 6)
            node.generator = this.eat(_tokentype.types.star);
          if (isStatement || this.type === _tokentype.types.name)
            node.id = this.parseIdent();
          this.parseFunctionParams(node);
          this.parseFunctionBody(node, allowExpressionBody);
          return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
        };
        pp.parseFunctionParams = function(node) {
          this.expect(_tokentype.types.parenL);
          node.params = this.parseBindingList(_tokentype.types.parenR, false, false, true);
        };
        pp.parseClass = function(node, isStatement) {
          this.next();
          this.parseClassId(node, isStatement);
          this.parseClassSuper(node);
          var classBody = this.startNode();
          var hadConstructor = false;
          classBody.body = [];
          this.expect(_tokentype.types.braceL);
          while (!this.eat(_tokentype.types.braceR)) {
            if (this.eat(_tokentype.types.semi))
              continue;
            var method = this.startNode();
            var isGenerator = this.eat(_tokentype.types.star);
            var isMaybeStatic = this.type === _tokentype.types.name && this.value === "static";
            this.parsePropertyName(method);
            method["static"] = isMaybeStatic && this.type !== _tokentype.types.parenL;
            if (method["static"]) {
              if (isGenerator)
                this.unexpected();
              isGenerator = this.eat(_tokentype.types.star);
              this.parsePropertyName(method);
            }
            method.kind = "method";
            var isGetSet = false;
            if (!method.computed) {
              var key = method.key;
              if (!isGenerator && key.type === "Identifier" && this.type !== _tokentype.types.parenL && (key.name === "get" || key.name === "set")) {
                isGetSet = true;
                method.kind = key.name;
                key = this.parsePropertyName(method);
              }
              if (!method["static"] && (key.type === "Identifier" && key.name === "constructor" || key.type === "Literal" && key.value === "constructor")) {
                if (hadConstructor)
                  this.raise(key.start, "Duplicate constructor in the same class");
                if (isGetSet)
                  this.raise(key.start, "Constructor can't have get/set modifier");
                if (isGenerator)
                  this.raise(key.start, "Constructor can't be a generator");
                method.kind = "constructor";
                hadConstructor = true;
              }
            }
            this.parseClassMethod(classBody, method, isGenerator);
            if (isGetSet) {
              var paramCount = method.kind === "get" ? 0 : 1;
              if (method.value.params.length !== paramCount) {
                var start = method.value.start;
                if (method.kind === "get")
                  this.raise(start, "getter should have no params");
                else
                  this.raise(start, "setter should have exactly one param");
              }
              if (method.kind === "set" && method.value.params[0].type === "RestElement")
                this.raise(method.value.params[0].start, "Setter cannot use rest params");
            }
          }
          node.body = this.finishNode(classBody, "ClassBody");
          return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
        };
        pp.parseClassMethod = function(classBody, method, isGenerator) {
          method.value = this.parseMethod(isGenerator);
          classBody.body.push(this.finishNode(method, "MethodDefinition"));
        };
        pp.parseClassId = function(node, isStatement) {
          node.id = this.type === _tokentype.types.name ? this.parseIdent() : isStatement ? this.unexpected() : null;
        };
        pp.parseClassSuper = function(node) {
          node.superClass = this.eat(_tokentype.types._extends) ? this.parseExprSubscripts() : null;
        };
        pp.parseExport = function(node) {
          this.next();
          if (this.eat(_tokentype.types.star)) {
            this.expectContextual("from");
            node.source = this.type === _tokentype.types.string ? this.parseExprAtom() : this.unexpected();
            this.semicolon();
            return this.finishNode(node, "ExportAllDeclaration");
          }
          if (this.eat(_tokentype.types._default)) {
            var expr = this.parseMaybeAssign();
            var needsSemi = true;
            if (expr.type == "FunctionExpression" || expr.type == "ClassExpression") {
              needsSemi = false;
              if (expr.id) {
                expr.type = expr.type == "FunctionExpression" ? "FunctionDeclaration" : "ClassDeclaration";
              }
            }
            node.declaration = expr;
            if (needsSemi)
              this.semicolon();
            return this.finishNode(node, "ExportDefaultDeclaration");
          }
          if (this.shouldParseExportStatement()) {
            node.declaration = this.parseStatement(true);
            node.specifiers = [];
            node.source = null;
          } else {
            node.declaration = null;
            node.specifiers = this.parseExportSpecifiers();
            if (this.eatContextual("from")) {
              node.source = this.type === _tokentype.types.string ? this.parseExprAtom() : this.unexpected();
            } else {
              for (var i = 0; i < node.specifiers.length; i++) {
                if (this.keywords.test(node.specifiers[i].local.name) || this.reservedWords.test(node.specifiers[i].local.name)) {
                  this.unexpected(node.specifiers[i].local.start);
                }
              }
              node.source = null;
            }
            this.semicolon();
          }
          return this.finishNode(node, "ExportNamedDeclaration");
        };
        pp.shouldParseExportStatement = function() {
          return this.type.keyword;
        };
        pp.parseExportSpecifiers = function() {
          var nodes = [],
              first = true;
          this.expect(_tokentype.types.braceL);
          while (!this.eat(_tokentype.types.braceR)) {
            if (!first) {
              this.expect(_tokentype.types.comma);
              if (this.afterTrailingComma(_tokentype.types.braceR))
                break;
            } else
              first = false;
            var node = this.startNode();
            node.local = this.parseIdent(this.type === _tokentype.types._default);
            node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
            nodes.push(this.finishNode(node, "ExportSpecifier"));
          }
          return nodes;
        };
        pp.parseImport = function(node) {
          this.next();
          if (this.type === _tokentype.types.string) {
            node.specifiers = empty;
            node.source = this.parseExprAtom();
          } else {
            node.specifiers = this.parseImportSpecifiers();
            this.expectContextual("from");
            node.source = this.type === _tokentype.types.string ? this.parseExprAtom() : this.unexpected();
          }
          this.semicolon();
          return this.finishNode(node, "ImportDeclaration");
        };
        pp.parseImportSpecifiers = function() {
          var nodes = [],
              first = true;
          if (this.type === _tokentype.types.name) {
            var node = this.startNode();
            node.local = this.parseIdent();
            this.checkLVal(node.local, true);
            nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
            if (!this.eat(_tokentype.types.comma))
              return nodes;
          }
          if (this.type === _tokentype.types.star) {
            var node = this.startNode();
            this.next();
            this.expectContextual("as");
            node.local = this.parseIdent();
            this.checkLVal(node.local, true);
            nodes.push(this.finishNode(node, "ImportNamespaceSpecifier"));
            return nodes;
          }
          this.expect(_tokentype.types.braceL);
          while (!this.eat(_tokentype.types.braceR)) {
            if (!first) {
              this.expect(_tokentype.types.comma);
              if (this.afterTrailingComma(_tokentype.types.braceR))
                break;
            } else
              first = false;
            var node = this.startNode();
            node.imported = this.parseIdent(true);
            if (this.eatContextual("as")) {
              node.local = this.parseIdent();
            } else {
              node.local = node.imported;
              if (this.isKeyword(node.local.name))
                this.unexpected(node.local.start);
              if (this.reservedWordsStrict.test(node.local.name))
                this.raise(node.local.start, "The keyword '" + node.local.name + "' is reserved");
            }
            this.checkLVal(node.local, true);
            nodes.push(this.finishNode(node, "ImportSpecifier"));
          }
          return nodes;
        };
      }, {
        "./state": 10,
        "./tokentype": 14,
        "./whitespace": 16
      }],
      12: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        var _state = _dereq_("./state");
        var _tokentype = _dereq_("./tokentype");
        var _whitespace = _dereq_("./whitespace");
        var TokContext = function TokContext(token, isExpr, preserveSpace, override) {
          _classCallCheck(this, TokContext);
          this.token = token;
          this.isExpr = !!isExpr;
          this.preserveSpace = !!preserveSpace;
          this.override = override;
        };
        exports.TokContext = TokContext;
        var types = {
          b_stat: new TokContext("{", false),
          b_expr: new TokContext("{", true),
          b_tmpl: new TokContext("${", true),
          p_stat: new TokContext("(", false),
          p_expr: new TokContext("(", true),
          q_tmpl: new TokContext("`", true, true, function(p) {
            return p.readTmplToken();
          }),
          f_expr: new TokContext("function", true)
        };
        exports.types = types;
        var pp = _state.Parser.prototype;
        pp.initialContext = function() {
          return [types.b_stat];
        };
        pp.braceIsBlock = function(prevType) {
          if (prevType === _tokentype.types.colon) {
            var _parent = this.curContext();
            if (_parent === types.b_stat || _parent === types.b_expr)
              return !_parent.isExpr;
          }
          if (prevType === _tokentype.types._return)
            return _whitespace.lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
          if (prevType === _tokentype.types._else || prevType === _tokentype.types.semi || prevType === _tokentype.types.eof || prevType === _tokentype.types.parenR)
            return true;
          if (prevType == _tokentype.types.braceL)
            return this.curContext() === types.b_stat;
          return !this.exprAllowed;
        };
        pp.updateContext = function(prevType) {
          var update = undefined,
              type = this.type;
          if (type.keyword && prevType == _tokentype.types.dot)
            this.exprAllowed = false;
          else if (update = type.updateContext)
            update.call(this, prevType);
          else
            this.exprAllowed = type.beforeExpr;
        };
        _tokentype.types.parenR.updateContext = _tokentype.types.braceR.updateContext = function() {
          if (this.context.length == 1) {
            this.exprAllowed = true;
            return;
          }
          var out = this.context.pop();
          if (out === types.b_stat && this.curContext() === types.f_expr) {
            this.context.pop();
            this.exprAllowed = false;
          } else if (out === types.b_tmpl) {
            this.exprAllowed = true;
          } else {
            this.exprAllowed = !out.isExpr;
          }
        };
        _tokentype.types.braceL.updateContext = function(prevType) {
          this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
          this.exprAllowed = true;
        };
        _tokentype.types.dollarBraceL.updateContext = function() {
          this.context.push(types.b_tmpl);
          this.exprAllowed = true;
        };
        _tokentype.types.parenL.updateContext = function(prevType) {
          var statementParens = prevType === _tokentype.types._if || prevType === _tokentype.types._for || prevType === _tokentype.types._with || prevType === _tokentype.types._while;
          this.context.push(statementParens ? types.p_stat : types.p_expr);
          this.exprAllowed = true;
        };
        _tokentype.types.incDec.updateContext = function() {};
        _tokentype.types._function.updateContext = function() {
          if (this.curContext() !== types.b_stat)
            this.context.push(types.f_expr);
          this.exprAllowed = false;
        };
        _tokentype.types.backQuote.updateContext = function() {
          if (this.curContext() === types.q_tmpl)
            this.context.pop();
          else
            this.context.push(types.q_tmpl);
          this.exprAllowed = false;
        };
      }, {
        "./state": 10,
        "./tokentype": 14,
        "./whitespace": 16
      }],
      13: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        var _identifier = _dereq_("./identifier");
        var _tokentype = _dereq_("./tokentype");
        var _state = _dereq_("./state");
        var _locutil = _dereq_("./locutil");
        var _whitespace = _dereq_("./whitespace");
        var Token = function Token(p) {
          _classCallCheck(this, Token);
          this.type = p.type;
          this.value = p.value;
          this.start = p.start;
          this.end = p.end;
          if (p.options.locations)
            this.loc = new _locutil.SourceLocation(p, p.startLoc, p.endLoc);
          if (p.options.ranges)
            this.range = [p.start, p.end];
        };
        ;
        exports.Token = Token;
        var pp = _state.Parser.prototype;
        var isRhino = typeof Packages == "object" && Object.prototype.toString.call(Packages) == "[object JavaPackage]";
        pp.next = function() {
          if (this.options.onToken)
            this.options.onToken(new Token(this));
          this.lastTokEnd = this.end;
          this.lastTokStart = this.start;
          this.lastTokEndLoc = this.endLoc;
          this.lastTokStartLoc = this.startLoc;
          this.nextToken();
        };
        pp.getToken = function() {
          this.next();
          return new Token(this);
        };
        if (typeof Symbol !== "undefined")
          pp[Symbol.iterator] = function() {
            var self = this;
            return {next: function next() {
                var token = self.getToken();
                return {
                  done: token.type === _tokentype.types.eof,
                  value: token
                };
              }};
          };
        pp.setStrict = function(strict) {
          this.strict = strict;
          if (this.type !== _tokentype.types.num && this.type !== _tokentype.types.string)
            return;
          this.pos = this.start;
          if (this.options.locations) {
            while (this.pos < this.lineStart) {
              this.lineStart = this.input.lastIndexOf("\n", this.lineStart - 2) + 1;
              --this.curLine;
            }
          }
          this.nextToken();
        };
        pp.curContext = function() {
          return this.context[this.context.length - 1];
        };
        pp.nextToken = function() {
          var curContext = this.curContext();
          if (!curContext || !curContext.preserveSpace)
            this.skipSpace();
          this.start = this.pos;
          if (this.options.locations)
            this.startLoc = this.curPosition();
          if (this.pos >= this.input.length)
            return this.finishToken(_tokentype.types.eof);
          if (curContext.override)
            return curContext.override(this);
          else
            this.readToken(this.fullCharCodeAtPos());
        };
        pp.readToken = function(code) {
          if (_identifier.isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92)
            return this.readWord();
          return this.getTokenFromCode(code);
        };
        pp.fullCharCodeAtPos = function() {
          var code = this.input.charCodeAt(this.pos);
          if (code <= 0xd7ff || code >= 0xe000)
            return code;
          var next = this.input.charCodeAt(this.pos + 1);
          return (code << 10) + next - 0x35fdc00;
        };
        pp.skipBlockComment = function() {
          var startLoc = this.options.onComment && this.curPosition();
          var start = this.pos,
              end = this.input.indexOf("*/", this.pos += 2);
          if (end === -1)
            this.raise(this.pos - 2, "Unterminated comment");
          this.pos = end + 2;
          if (this.options.locations) {
            _whitespace.lineBreakG.lastIndex = start;
            var match = undefined;
            while ((match = _whitespace.lineBreakG.exec(this.input)) && match.index < this.pos) {
              ++this.curLine;
              this.lineStart = match.index + match[0].length;
            }
          }
          if (this.options.onComment)
            this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.curPosition());
        };
        pp.skipLineComment = function(startSkip) {
          var start = this.pos;
          var startLoc = this.options.onComment && this.curPosition();
          var ch = this.input.charCodeAt(this.pos += startSkip);
          while (this.pos < this.input.length && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
            ++this.pos;
            ch = this.input.charCodeAt(this.pos);
          }
          if (this.options.onComment)
            this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos, startLoc, this.curPosition());
        };
        pp.skipSpace = function() {
          loop: while (this.pos < this.input.length) {
            var ch = this.input.charCodeAt(this.pos);
            switch (ch) {
              case 32:
              case 160:
                ++this.pos;
                break;
              case 13:
                if (this.input.charCodeAt(this.pos + 1) === 10) {
                  ++this.pos;
                }
              case 10:
              case 8232:
              case 8233:
                ++this.pos;
                if (this.options.locations) {
                  ++this.curLine;
                  this.lineStart = this.pos;
                }
                break;
              case 47:
                switch (this.input.charCodeAt(this.pos + 1)) {
                  case 42:
                    this.skipBlockComment();
                    break;
                  case 47:
                    this.skipLineComment(2);
                    break;
                  default:
                    break loop;
                }
                break;
              default:
                if (ch > 8 && ch < 14 || ch >= 5760 && _whitespace.nonASCIIwhitespace.test(String.fromCharCode(ch))) {
                  ++this.pos;
                } else {
                  break loop;
                }
            }
          }
        };
        pp.finishToken = function(type, val) {
          this.end = this.pos;
          if (this.options.locations)
            this.endLoc = this.curPosition();
          var prevType = this.type;
          this.type = type;
          this.value = val;
          this.updateContext(prevType);
        };
        pp.readToken_dot = function() {
          var next = this.input.charCodeAt(this.pos + 1);
          if (next >= 48 && next <= 57)
            return this.readNumber(true);
          var next2 = this.input.charCodeAt(this.pos + 2);
          if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
            this.pos += 3;
            return this.finishToken(_tokentype.types.ellipsis);
          } else {
            ++this.pos;
            return this.finishToken(_tokentype.types.dot);
          }
        };
        pp.readToken_slash = function() {
          var next = this.input.charCodeAt(this.pos + 1);
          if (this.exprAllowed) {
            ++this.pos;
            return this.readRegexp();
          }
          if (next === 61)
            return this.finishOp(_tokentype.types.assign, 2);
          return this.finishOp(_tokentype.types.slash, 1);
        };
        pp.readToken_mult_modulo = function(code) {
          var next = this.input.charCodeAt(this.pos + 1);
          if (next === 61)
            return this.finishOp(_tokentype.types.assign, 2);
          return this.finishOp(code === 42 ? _tokentype.types.star : _tokentype.types.modulo, 1);
        };
        pp.readToken_pipe_amp = function(code) {
          var next = this.input.charCodeAt(this.pos + 1);
          if (next === code)
            return this.finishOp(code === 124 ? _tokentype.types.logicalOR : _tokentype.types.logicalAND, 2);
          if (next === 61)
            return this.finishOp(_tokentype.types.assign, 2);
          return this.finishOp(code === 124 ? _tokentype.types.bitwiseOR : _tokentype.types.bitwiseAND, 1);
        };
        pp.readToken_caret = function() {
          var next = this.input.charCodeAt(this.pos + 1);
          if (next === 61)
            return this.finishOp(_tokentype.types.assign, 2);
          return this.finishOp(_tokentype.types.bitwiseXOR, 1);
        };
        pp.readToken_plus_min = function(code) {
          var next = this.input.charCodeAt(this.pos + 1);
          if (next === code) {
            if (next == 45 && this.input.charCodeAt(this.pos + 2) == 62 && _whitespace.lineBreak.test(this.input.slice(this.lastTokEnd, this.pos))) {
              this.skipLineComment(3);
              this.skipSpace();
              return this.nextToken();
            }
            return this.finishOp(_tokentype.types.incDec, 2);
          }
          if (next === 61)
            return this.finishOp(_tokentype.types.assign, 2);
          return this.finishOp(_tokentype.types.plusMin, 1);
        };
        pp.readToken_lt_gt = function(code) {
          var next = this.input.charCodeAt(this.pos + 1);
          var size = 1;
          if (next === code) {
            size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
            if (this.input.charCodeAt(this.pos + size) === 61)
              return this.finishOp(_tokentype.types.assign, size + 1);
            return this.finishOp(_tokentype.types.bitShift, size);
          }
          if (next == 33 && code == 60 && this.input.charCodeAt(this.pos + 2) == 45 && this.input.charCodeAt(this.pos + 3) == 45) {
            if (this.inModule)
              this.unexpected();
            this.skipLineComment(4);
            this.skipSpace();
            return this.nextToken();
          }
          if (next === 61)
            size = this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2;
          return this.finishOp(_tokentype.types.relational, size);
        };
        pp.readToken_eq_excl = function(code) {
          var next = this.input.charCodeAt(this.pos + 1);
          if (next === 61)
            return this.finishOp(_tokentype.types.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
          if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
            this.pos += 2;
            return this.finishToken(_tokentype.types.arrow);
          }
          return this.finishOp(code === 61 ? _tokentype.types.eq : _tokentype.types.prefix, 1);
        };
        pp.getTokenFromCode = function(code) {
          switch (code) {
            case 46:
              return this.readToken_dot();
            case 40:
              ++this.pos;
              return this.finishToken(_tokentype.types.parenL);
            case 41:
              ++this.pos;
              return this.finishToken(_tokentype.types.parenR);
            case 59:
              ++this.pos;
              return this.finishToken(_tokentype.types.semi);
            case 44:
              ++this.pos;
              return this.finishToken(_tokentype.types.comma);
            case 91:
              ++this.pos;
              return this.finishToken(_tokentype.types.bracketL);
            case 93:
              ++this.pos;
              return this.finishToken(_tokentype.types.bracketR);
            case 123:
              ++this.pos;
              return this.finishToken(_tokentype.types.braceL);
            case 125:
              ++this.pos;
              return this.finishToken(_tokentype.types.braceR);
            case 58:
              ++this.pos;
              return this.finishToken(_tokentype.types.colon);
            case 63:
              ++this.pos;
              return this.finishToken(_tokentype.types.question);
            case 96:
              if (this.options.ecmaVersion < 6)
                break;
              ++this.pos;
              return this.finishToken(_tokentype.types.backQuote);
            case 48:
              var next = this.input.charCodeAt(this.pos + 1);
              if (next === 120 || next === 88)
                return this.readRadixNumber(16);
              if (this.options.ecmaVersion >= 6) {
                if (next === 111 || next === 79)
                  return this.readRadixNumber(8);
                if (next === 98 || next === 66)
                  return this.readRadixNumber(2);
              }
            case 49:
            case 50:
            case 51:
            case 52:
            case 53:
            case 54:
            case 55:
            case 56:
            case 57:
              return this.readNumber(false);
            case 34:
            case 39:
              return this.readString(code);
            case 47:
              return this.readToken_slash();
            case 37:
            case 42:
              return this.readToken_mult_modulo(code);
            case 124:
            case 38:
              return this.readToken_pipe_amp(code);
            case 94:
              return this.readToken_caret();
            case 43:
            case 45:
              return this.readToken_plus_min(code);
            case 60:
            case 62:
              return this.readToken_lt_gt(code);
            case 61:
            case 33:
              return this.readToken_eq_excl(code);
            case 126:
              return this.finishOp(_tokentype.types.prefix, 1);
          }
          this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
        };
        pp.finishOp = function(type, size) {
          var str = this.input.slice(this.pos, this.pos + size);
          this.pos += size;
          return this.finishToken(type, str);
        };
        function tryCreateRegexp(src, flags, throwErrorAt, parser) {
          try {
            return new RegExp(src, flags);
          } catch (e) {
            if (throwErrorAt !== undefined) {
              if (e instanceof SyntaxError)
                parser.raise(throwErrorAt, "Error parsing regular expression: " + e.message);
              throw e;
            }
          }
        }
        var regexpUnicodeSupport = !!tryCreateRegexp("￿", "u");
        pp.readRegexp = function() {
          var _this = this;
          var escaped = undefined,
              inClass = undefined,
              start = this.pos;
          for (; ; ) {
            if (this.pos >= this.input.length)
              this.raise(start, "Unterminated regular expression");
            var ch = this.input.charAt(this.pos);
            if (_whitespace.lineBreak.test(ch))
              this.raise(start, "Unterminated regular expression");
            if (!escaped) {
              if (ch === "[")
                inClass = true;
              else if (ch === "]" && inClass)
                inClass = false;
              else if (ch === "/" && !inClass)
                break;
              escaped = ch === "\\";
            } else
              escaped = false;
            ++this.pos;
          }
          var content = this.input.slice(start, this.pos);
          ++this.pos;
          var mods = this.readWord1();
          var tmp = content;
          if (mods) {
            var validFlags = /^[gim]*$/;
            if (this.options.ecmaVersion >= 6)
              validFlags = /^[gimuy]*$/;
            if (!validFlags.test(mods))
              this.raise(start, "Invalid regular expression flag");
            if (mods.indexOf('u') >= 0 && !regexpUnicodeSupport) {
              tmp = tmp.replace(/\\u\{([0-9a-fA-F]+)\}/g, function(_match, code, offset) {
                code = Number("0x" + code);
                if (code > 0x10FFFF)
                  _this.raise(start + offset + 3, "Code point out of bounds");
                return "x";
              });
              tmp = tmp.replace(/\\u([a-fA-F0-9]{4})|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x");
            }
          }
          var value = null;
          if (!isRhino) {
            tryCreateRegexp(tmp, undefined, start, this);
            value = tryCreateRegexp(content, mods);
          }
          return this.finishToken(_tokentype.types.regexp, {
            pattern: content,
            flags: mods,
            value: value
          });
        };
        pp.readInt = function(radix, len) {
          var start = this.pos,
              total = 0;
          for (var i = 0,
              e = len == null ? Infinity : len; i < e; ++i) {
            var code = this.input.charCodeAt(this.pos),
                val = undefined;
            if (code >= 97)
              val = code - 97 + 10;
            else if (code >= 65)
              val = code - 65 + 10;
            else if (code >= 48 && code <= 57)
              val = code - 48;
            else
              val = Infinity;
            if (val >= radix)
              break;
            ++this.pos;
            total = total * radix + val;
          }
          if (this.pos === start || len != null && this.pos - start !== len)
            return null;
          return total;
        };
        pp.readRadixNumber = function(radix) {
          this.pos += 2;
          var val = this.readInt(radix);
          if (val == null)
            this.raise(this.start + 2, "Expected number in radix " + radix);
          if (_identifier.isIdentifierStart(this.fullCharCodeAtPos()))
            this.raise(this.pos, "Identifier directly after number");
          return this.finishToken(_tokentype.types.num, val);
        };
        pp.readNumber = function(startsWithDot) {
          var start = this.pos,
              isFloat = false,
              octal = this.input.charCodeAt(this.pos) === 48;
          if (!startsWithDot && this.readInt(10) === null)
            this.raise(start, "Invalid number");
          var next = this.input.charCodeAt(this.pos);
          if (next === 46) {
            ++this.pos;
            this.readInt(10);
            isFloat = true;
            next = this.input.charCodeAt(this.pos);
          }
          if (next === 69 || next === 101) {
            next = this.input.charCodeAt(++this.pos);
            if (next === 43 || next === 45)
              ++this.pos;
            if (this.readInt(10) === null)
              this.raise(start, "Invalid number");
            isFloat = true;
          }
          if (_identifier.isIdentifierStart(this.fullCharCodeAtPos()))
            this.raise(this.pos, "Identifier directly after number");
          var str = this.input.slice(start, this.pos),
              val = undefined;
          if (isFloat)
            val = parseFloat(str);
          else if (!octal || str.length === 1)
            val = parseInt(str, 10);
          else if (/[89]/.test(str) || this.strict)
            this.raise(start, "Invalid number");
          else
            val = parseInt(str, 8);
          return this.finishToken(_tokentype.types.num, val);
        };
        pp.readCodePoint = function() {
          var ch = this.input.charCodeAt(this.pos),
              code = undefined;
          if (ch === 123) {
            if (this.options.ecmaVersion < 6)
              this.unexpected();
            var codePos = ++this.pos;
            code = this.readHexChar(this.input.indexOf('}', this.pos) - this.pos);
            ++this.pos;
            if (code > 0x10FFFF)
              this.raise(codePos, "Code point out of bounds");
          } else {
            code = this.readHexChar(4);
          }
          return code;
        };
        function codePointToString(code) {
          if (code <= 0xFFFF)
            return String.fromCharCode(code);
          code -= 0x10000;
          return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00);
        }
        pp.readString = function(quote) {
          var out = "",
              chunkStart = ++this.pos;
          for (; ; ) {
            if (this.pos >= this.input.length)
              this.raise(this.start, "Unterminated string constant");
            var ch = this.input.charCodeAt(this.pos);
            if (ch === quote)
              break;
            if (ch === 92) {
              out += this.input.slice(chunkStart, this.pos);
              out += this.readEscapedChar(false);
              chunkStart = this.pos;
            } else {
              if (_whitespace.isNewLine(ch))
                this.raise(this.start, "Unterminated string constant");
              ++this.pos;
            }
          }
          out += this.input.slice(chunkStart, this.pos++);
          return this.finishToken(_tokentype.types.string, out);
        };
        pp.readTmplToken = function() {
          var out = "",
              chunkStart = this.pos;
          for (; ; ) {
            if (this.pos >= this.input.length)
              this.raise(this.start, "Unterminated template");
            var ch = this.input.charCodeAt(this.pos);
            if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
              if (this.pos === this.start && this.type === _tokentype.types.template) {
                if (ch === 36) {
                  this.pos += 2;
                  return this.finishToken(_tokentype.types.dollarBraceL);
                } else {
                  ++this.pos;
                  return this.finishToken(_tokentype.types.backQuote);
                }
              }
              out += this.input.slice(chunkStart, this.pos);
              return this.finishToken(_tokentype.types.template, out);
            }
            if (ch === 92) {
              out += this.input.slice(chunkStart, this.pos);
              out += this.readEscapedChar(true);
              chunkStart = this.pos;
            } else if (_whitespace.isNewLine(ch)) {
              out += this.input.slice(chunkStart, this.pos);
              ++this.pos;
              switch (ch) {
                case 13:
                  if (this.input.charCodeAt(this.pos) === 10)
                    ++this.pos;
                case 10:
                  out += "\n";
                  break;
                default:
                  out += String.fromCharCode(ch);
                  break;
              }
              if (this.options.locations) {
                ++this.curLine;
                this.lineStart = this.pos;
              }
              chunkStart = this.pos;
            } else {
              ++this.pos;
            }
          }
        };
        pp.readEscapedChar = function(inTemplate) {
          var ch = this.input.charCodeAt(++this.pos);
          ++this.pos;
          switch (ch) {
            case 110:
              return "\n";
            case 114:
              return "\r";
            case 120:
              return String.fromCharCode(this.readHexChar(2));
            case 117:
              return codePointToString(this.readCodePoint());
            case 116:
              return "\t";
            case 98:
              return "\b";
            case 118:
              return "\u000b";
            case 102:
              return "\f";
            case 13:
              if (this.input.charCodeAt(this.pos) === 10)
                ++this.pos;
            case 10:
              if (this.options.locations) {
                this.lineStart = this.pos;
                ++this.curLine;
              }
              return "";
            default:
              if (ch >= 48 && ch <= 55) {
                var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
                var octal = parseInt(octalStr, 8);
                if (octal > 255) {
                  octalStr = octalStr.slice(0, -1);
                  octal = parseInt(octalStr, 8);
                }
                if (octalStr !== "0" && (this.strict || inTemplate)) {
                  this.raise(this.pos - 2, "Octal literal in strict mode");
                }
                this.pos += octalStr.length - 1;
                return String.fromCharCode(octal);
              }
              return String.fromCharCode(ch);
          }
        };
        pp.readHexChar = function(len) {
          var codePos = this.pos;
          var n = this.readInt(16, len);
          if (n === null)
            this.raise(codePos, "Bad character escape sequence");
          return n;
        };
        pp.readWord1 = function() {
          this.containsEsc = false;
          var word = "",
              first = true,
              chunkStart = this.pos;
          var astral = this.options.ecmaVersion >= 6;
          while (this.pos < this.input.length) {
            var ch = this.fullCharCodeAtPos();
            if (_identifier.isIdentifierChar(ch, astral)) {
              this.pos += ch <= 0xffff ? 1 : 2;
            } else if (ch === 92) {
              this.containsEsc = true;
              word += this.input.slice(chunkStart, this.pos);
              var escStart = this.pos;
              if (this.input.charCodeAt(++this.pos) != 117)
                this.raise(this.pos, "Expecting Unicode escape sequence \\uXXXX");
              ++this.pos;
              var esc = this.readCodePoint();
              if (!(first ? _identifier.isIdentifierStart : _identifier.isIdentifierChar)(esc, astral))
                this.raise(escStart, "Invalid Unicode escape");
              word += codePointToString(esc);
              chunkStart = this.pos;
            } else {
              break;
            }
            first = false;
          }
          return word + this.input.slice(chunkStart, this.pos);
        };
        pp.readWord = function() {
          var word = this.readWord1();
          var type = _tokentype.types.name;
          if ((this.options.ecmaVersion >= 6 || !this.containsEsc) && this.keywords.test(word))
            type = _tokentype.keywords[word];
          return this.finishToken(type, word);
        };
      }, {
        "./identifier": 2,
        "./locutil": 5,
        "./state": 10,
        "./tokentype": 14,
        "./whitespace": 16
      }],
      14: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        var TokenType = function TokenType(label) {
          var conf = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
          _classCallCheck(this, TokenType);
          this.label = label;
          this.keyword = conf.keyword;
          this.beforeExpr = !!conf.beforeExpr;
          this.startsExpr = !!conf.startsExpr;
          this.isLoop = !!conf.isLoop;
          this.isAssign = !!conf.isAssign;
          this.prefix = !!conf.prefix;
          this.postfix = !!conf.postfix;
          this.binop = conf.binop || null;
          this.updateContext = null;
        };
        exports.TokenType = TokenType;
        function binop(name, prec) {
          return new TokenType(name, {
            beforeExpr: true,
            binop: prec
          });
        }
        var beforeExpr = {beforeExpr: true},
            startsExpr = {startsExpr: true};
        var types = {
          num: new TokenType("num", startsExpr),
          regexp: new TokenType("regexp", startsExpr),
          string: new TokenType("string", startsExpr),
          name: new TokenType("name", startsExpr),
          eof: new TokenType("eof"),
          bracketL: new TokenType("[", {
            beforeExpr: true,
            startsExpr: true
          }),
          bracketR: new TokenType("]"),
          braceL: new TokenType("{", {
            beforeExpr: true,
            startsExpr: true
          }),
          braceR: new TokenType("}"),
          parenL: new TokenType("(", {
            beforeExpr: true,
            startsExpr: true
          }),
          parenR: new TokenType(")"),
          comma: new TokenType(",", beforeExpr),
          semi: new TokenType(";", beforeExpr),
          colon: new TokenType(":", beforeExpr),
          dot: new TokenType("."),
          question: new TokenType("?", beforeExpr),
          arrow: new TokenType("=>", beforeExpr),
          template: new TokenType("template"),
          ellipsis: new TokenType("...", beforeExpr),
          backQuote: new TokenType("`", startsExpr),
          dollarBraceL: new TokenType("${", {
            beforeExpr: true,
            startsExpr: true
          }),
          eq: new TokenType("=", {
            beforeExpr: true,
            isAssign: true
          }),
          assign: new TokenType("_=", {
            beforeExpr: true,
            isAssign: true
          }),
          incDec: new TokenType("++/--", {
            prefix: true,
            postfix: true,
            startsExpr: true
          }),
          prefix: new TokenType("prefix", {
            beforeExpr: true,
            prefix: true,
            startsExpr: true
          }),
          logicalOR: binop("||", 1),
          logicalAND: binop("&&", 2),
          bitwiseOR: binop("|", 3),
          bitwiseXOR: binop("^", 4),
          bitwiseAND: binop("&", 5),
          equality: binop("==/!=", 6),
          relational: binop("</>", 7),
          bitShift: binop("<</>>", 8),
          plusMin: new TokenType("+/-", {
            beforeExpr: true,
            binop: 9,
            prefix: true,
            startsExpr: true
          }),
          modulo: binop("%", 10),
          star: binop("*", 10),
          slash: binop("/", 10)
        };
        exports.types = types;
        var keywords = {};
        exports.keywords = keywords;
        function kw(name) {
          var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
          options.keyword = name;
          keywords[name] = types["_" + name] = new TokenType(name, options);
        }
        kw("break");
        kw("case", beforeExpr);
        kw("catch");
        kw("continue");
        kw("debugger");
        kw("default", beforeExpr);
        kw("do", {
          isLoop: true,
          beforeExpr: true
        });
        kw("else", beforeExpr);
        kw("finally");
        kw("for", {isLoop: true});
        kw("function", startsExpr);
        kw("if");
        kw("return", beforeExpr);
        kw("switch");
        kw("throw", beforeExpr);
        kw("try");
        kw("var");
        kw("let");
        kw("const");
        kw("while", {isLoop: true});
        kw("with");
        kw("new", {
          beforeExpr: true,
          startsExpr: true
        });
        kw("this", startsExpr);
        kw("super", startsExpr);
        kw("class");
        kw("extends", beforeExpr);
        kw("export");
        kw("import");
        kw("yield", {
          beforeExpr: true,
          startsExpr: true
        });
        kw("null", startsExpr);
        kw("true", startsExpr);
        kw("false", startsExpr);
        kw("in", {
          beforeExpr: true,
          binop: 7
        });
        kw("instanceof", {
          beforeExpr: true,
          binop: 7
        });
        kw("typeof", {
          beforeExpr: true,
          prefix: true,
          startsExpr: true
        });
        kw("void", {
          beforeExpr: true,
          prefix: true,
          startsExpr: true
        });
        kw("delete", {
          beforeExpr: true,
          prefix: true,
          startsExpr: true
        });
      }, {}],
      15: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.isArray = isArray;
        exports.has = has;
        function isArray(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        }
        function has(obj, propName) {
          return Object.prototype.hasOwnProperty.call(obj, propName);
        }
      }, {}],
      16: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.isNewLine = isNewLine;
        var lineBreak = /\r\n?|\n|\u2028|\u2029/;
        exports.lineBreak = lineBreak;
        var lineBreakG = new RegExp(lineBreak.source, "g");
        exports.lineBreakG = lineBreakG;
        function isNewLine(code) {
          return code === 10 || code === 13 || code === 0x2028 || code == 0x2029;
        }
        var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
        exports.nonASCIIwhitespace = nonASCIIwhitespace;
      }, {}]
    }, {}, [3])(3);
  });
  return module.exports;
});

System.registerDynamic("lively.ast/node_modules/acorn/package.json", [], false, function() {
  return {
    "main": "dist/acorn.js"
  };
});

System.registerDynamic("lively.ast/node_modules/acorn/dist/acorn_loose.js", ["./acorn"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  (function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = f();
    } else if (typeof define === "function" && define.amd) {
      define([], f);
    } else {
      var g;
      if (typeof window !== "undefined") {
        g = window;
      } else if (typeof global !== "undefined") {
        g = global;
      } else if (typeof self !== "undefined") {
        g = self;
      } else {
        g = this;
      }
      (g.acorn || (g.acorn = {})).loose = f();
    }
  })(function() {
    var define,
        module,
        exports;
    return (function e(t, n, r) {
      function s(o, u) {
        if (!n[o]) {
          if (!t[o]) {
            var a = typeof $__require == "function" && $__require;
            if (!u && a)
              return a(o, !0);
            if (i)
              return i(o, !0);
            var f = new Error("Cannot find module '" + o + "'");
            throw f.code = "MODULE_NOT_FOUND", f;
          }
          var l = n[o] = {exports: {}};
          t[o][0].call(l.exports, function(e) {
            var n = t[o][1][e];
            return s(n ? n : e);
          }, l, l.exports, e, t, n, r);
        }
        return n[o].exports;
      }
      var i = typeof $__require == "function" && $__require;
      for (var o = 0; o < r.length; o++)
        s(r[o]);
      return s;
    })({
      1: [function(_dereq_, module, exports) {
        "use strict";
        module.exports = typeof acorn != 'undefined' ? acorn : $__require('./acorn');
      }, {}],
      2: [function(_dereq_, module, exports) {
        "use strict";
        var _state = _dereq_("./state");
        var _parseutil = _dereq_("./parseutil");
        var _ = _dereq_("..");
        var lp = _state.LooseParser.prototype;
        lp.checkLVal = function(expr) {
          if (!expr)
            return expr;
          switch (expr.type) {
            case "Identifier":
            case "MemberExpression":
              return expr;
            case "ParenthesizedExpression":
              expr.expression = this.checkLVal(expr.expression);
              return expr;
            default:
              return this.dummyIdent();
          }
        };
        lp.parseExpression = function(noIn) {
          var start = this.storeCurrentPos();
          var expr = this.parseMaybeAssign(noIn);
          if (this.tok.type === _.tokTypes.comma) {
            var node = this.startNodeAt(start);
            node.expressions = [expr];
            while (this.eat(_.tokTypes.comma))
              node.expressions.push(this.parseMaybeAssign(noIn));
            return this.finishNode(node, "SequenceExpression");
          }
          return expr;
        };
        lp.parseParenExpression = function() {
          this.pushCx();
          this.expect(_.tokTypes.parenL);
          var val = this.parseExpression();
          this.popCx();
          this.expect(_.tokTypes.parenR);
          return val;
        };
        lp.parseMaybeAssign = function(noIn) {
          var start = this.storeCurrentPos();
          var left = this.parseMaybeConditional(noIn);
          if (this.tok.type.isAssign) {
            var node = this.startNodeAt(start);
            node.operator = this.tok.value;
            node.left = this.tok.type === _.tokTypes.eq ? this.toAssignable(left) : this.checkLVal(left);
            this.next();
            node.right = this.parseMaybeAssign(noIn);
            return this.finishNode(node, "AssignmentExpression");
          }
          return left;
        };
        lp.parseMaybeConditional = function(noIn) {
          var start = this.storeCurrentPos();
          var expr = this.parseExprOps(noIn);
          if (this.eat(_.tokTypes.question)) {
            var node = this.startNodeAt(start);
            node.test = expr;
            node.consequent = this.parseMaybeAssign();
            node.alternate = this.expect(_.tokTypes.colon) ? this.parseMaybeAssign(noIn) : this.dummyIdent();
            return this.finishNode(node, "ConditionalExpression");
          }
          return expr;
        };
        lp.parseExprOps = function(noIn) {
          var start = this.storeCurrentPos();
          var indent = this.curIndent,
              line = this.curLineStart;
          return this.parseExprOp(this.parseMaybeUnary(noIn), start, -1, noIn, indent, line);
        };
        lp.parseExprOp = function(left, start, minPrec, noIn, indent, line) {
          if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine())
            return left;
          var prec = this.tok.type.binop;
          if (prec != null && (!noIn || this.tok.type !== _.tokTypes._in)) {
            if (prec > minPrec) {
              var node = this.startNodeAt(start);
              node.left = left;
              node.operator = this.tok.value;
              this.next();
              if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine()) {
                node.right = this.dummyIdent();
              } else {
                var rightStart = this.storeCurrentPos();
                node.right = this.parseExprOp(this.parseMaybeUnary(noIn), rightStart, prec, noIn, indent, line);
              }
              this.finishNode(node, /&&|\|\|/.test(node.operator) ? "LogicalExpression" : "BinaryExpression");
              return this.parseExprOp(node, start, minPrec, noIn, indent, line);
            }
          }
          return left;
        };
        lp.parseMaybeUnary = function(noIn) {
          if (this.tok.type.prefix) {
            var node = this.startNode(),
                update = this.tok.type === _.tokTypes.incDec;
            node.operator = this.tok.value;
            node.prefix = true;
            this.next();
            node.argument = this.parseMaybeUnary(noIn);
            if (update)
              node.argument = this.checkLVal(node.argument);
            return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
          } else if (this.tok.type === _.tokTypes.ellipsis) {
            var node = this.startNode();
            this.next();
            node.argument = this.parseMaybeUnary(noIn);
            return this.finishNode(node, "SpreadElement");
          }
          var start = this.storeCurrentPos();
          var expr = this.parseExprSubscripts();
          while (this.tok.type.postfix && !this.canInsertSemicolon()) {
            var node = this.startNodeAt(start);
            node.operator = this.tok.value;
            node.prefix = false;
            node.argument = this.checkLVal(expr);
            this.next();
            expr = this.finishNode(node, "UpdateExpression");
          }
          return expr;
        };
        lp.parseExprSubscripts = function() {
          var start = this.storeCurrentPos();
          return this.parseSubscripts(this.parseExprAtom(), start, false, this.curIndent, this.curLineStart);
        };
        lp.parseSubscripts = function(base, start, noCalls, startIndent, line) {
          for (; ; ) {
            if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) {
              if (this.tok.type == _.tokTypes.dot && this.curIndent == startIndent)
                --startIndent;
              else
                return base;
            }
            if (this.eat(_.tokTypes.dot)) {
              var node = this.startNodeAt(start);
              node.object = base;
              if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine())
                node.property = this.dummyIdent();
              else
                node.property = this.parsePropertyAccessor() || this.dummyIdent();
              node.computed = false;
              base = this.finishNode(node, "MemberExpression");
            } else if (this.tok.type == _.tokTypes.bracketL) {
              this.pushCx();
              this.next();
              var node = this.startNodeAt(start);
              node.object = base;
              node.property = this.parseExpression();
              node.computed = true;
              this.popCx();
              this.expect(_.tokTypes.bracketR);
              base = this.finishNode(node, "MemberExpression");
            } else if (!noCalls && this.tok.type == _.tokTypes.parenL) {
              var node = this.startNodeAt(start);
              node.callee = base;
              node.arguments = this.parseExprList(_.tokTypes.parenR);
              base = this.finishNode(node, "CallExpression");
            } else if (this.tok.type == _.tokTypes.backQuote) {
              var node = this.startNodeAt(start);
              node.tag = base;
              node.quasi = this.parseTemplate();
              base = this.finishNode(node, "TaggedTemplateExpression");
            } else {
              return base;
            }
          }
        };
        lp.parseExprAtom = function() {
          var node = undefined;
          switch (this.tok.type) {
            case _.tokTypes._this:
            case _.tokTypes._super:
              var type = this.tok.type === _.tokTypes._this ? "ThisExpression" : "Super";
              node = this.startNode();
              this.next();
              return this.finishNode(node, type);
            case _.tokTypes.name:
              var start = this.storeCurrentPos();
              var id = this.parseIdent();
              return this.eat(_.tokTypes.arrow) ? this.parseArrowExpression(this.startNodeAt(start), [id]) : id;
            case _.tokTypes.regexp:
              node = this.startNode();
              var val = this.tok.value;
              node.regex = {
                pattern: val.pattern,
                flags: val.flags
              };
              node.value = val.value;
              node.raw = this.input.slice(this.tok.start, this.tok.end);
              this.next();
              return this.finishNode(node, "Literal");
            case _.tokTypes.num:
            case _.tokTypes.string:
              node = this.startNode();
              node.value = this.tok.value;
              node.raw = this.input.slice(this.tok.start, this.tok.end);
              this.next();
              return this.finishNode(node, "Literal");
            case _.tokTypes._null:
            case _.tokTypes._true:
            case _.tokTypes._false:
              node = this.startNode();
              node.value = this.tok.type === _.tokTypes._null ? null : this.tok.type === _.tokTypes._true;
              node.raw = this.tok.type.keyword;
              this.next();
              return this.finishNode(node, "Literal");
            case _.tokTypes.parenL:
              var parenStart = this.storeCurrentPos();
              this.next();
              var inner = this.parseExpression();
              this.expect(_.tokTypes.parenR);
              if (this.eat(_.tokTypes.arrow)) {
                return this.parseArrowExpression(this.startNodeAt(parenStart), inner.expressions || (_parseutil.isDummy(inner) ? [] : [inner]));
              }
              if (this.options.preserveParens) {
                var par = this.startNodeAt(parenStart);
                par.expression = inner;
                inner = this.finishNode(par, "ParenthesizedExpression");
              }
              return inner;
            case _.tokTypes.bracketL:
              node = this.startNode();
              node.elements = this.parseExprList(_.tokTypes.bracketR, true);
              return this.finishNode(node, "ArrayExpression");
            case _.tokTypes.braceL:
              return this.parseObj();
            case _.tokTypes._class:
              return this.parseClass();
            case _.tokTypes._function:
              node = this.startNode();
              this.next();
              return this.parseFunction(node, false);
            case _.tokTypes._new:
              return this.parseNew();
            case _.tokTypes._yield:
              node = this.startNode();
              this.next();
              if (this.semicolon() || this.canInsertSemicolon() || this.tok.type != _.tokTypes.star && !this.tok.type.startsExpr) {
                node.delegate = false;
                node.argument = null;
              } else {
                node.delegate = this.eat(_.tokTypes.star);
                node.argument = this.parseMaybeAssign();
              }
              return this.finishNode(node, "YieldExpression");
            case _.tokTypes.backQuote:
              return this.parseTemplate();
            default:
              return this.dummyIdent();
          }
        };
        lp.parseNew = function() {
          var node = this.startNode(),
              startIndent = this.curIndent,
              line = this.curLineStart;
          var meta = this.parseIdent(true);
          if (this.options.ecmaVersion >= 6 && this.eat(_.tokTypes.dot)) {
            node.meta = meta;
            node.property = this.parseIdent(true);
            return this.finishNode(node, "MetaProperty");
          }
          var start = this.storeCurrentPos();
          node.callee = this.parseSubscripts(this.parseExprAtom(), start, true, startIndent, line);
          if (this.tok.type == _.tokTypes.parenL) {
            node.arguments = this.parseExprList(_.tokTypes.parenR);
          } else {
            node.arguments = [];
          }
          return this.finishNode(node, "NewExpression");
        };
        lp.parseTemplateElement = function() {
          var elem = this.startNode();
          elem.value = {
            raw: this.input.slice(this.tok.start, this.tok.end).replace(/\r\n?/g, '\n'),
            cooked: this.tok.value
          };
          this.next();
          elem.tail = this.tok.type === _.tokTypes.backQuote;
          return this.finishNode(elem, "TemplateElement");
        };
        lp.parseTemplate = function() {
          var node = this.startNode();
          this.next();
          node.expressions = [];
          var curElt = this.parseTemplateElement();
          node.quasis = [curElt];
          while (!curElt.tail) {
            this.next();
            node.expressions.push(this.parseExpression());
            if (this.expect(_.tokTypes.braceR)) {
              curElt = this.parseTemplateElement();
            } else {
              curElt = this.startNode();
              curElt.value = {
                cooked: '',
                raw: ''
              };
              curElt.tail = true;
            }
            node.quasis.push(curElt);
          }
          this.expect(_.tokTypes.backQuote);
          return this.finishNode(node, "TemplateLiteral");
        };
        lp.parseObj = function() {
          var node = this.startNode();
          node.properties = [];
          this.pushCx();
          var indent = this.curIndent + 1,
              line = this.curLineStart;
          this.eat(_.tokTypes.braceL);
          if (this.curIndent + 1 < indent) {
            indent = this.curIndent;
            line = this.curLineStart;
          }
          while (!this.closes(_.tokTypes.braceR, indent, line)) {
            var prop = this.startNode(),
                isGenerator = undefined,
                start = undefined;
            if (this.options.ecmaVersion >= 6) {
              start = this.storeCurrentPos();
              prop.method = false;
              prop.shorthand = false;
              isGenerator = this.eat(_.tokTypes.star);
            }
            this.parsePropertyName(prop);
            if (_parseutil.isDummy(prop.key)) {
              if (_parseutil.isDummy(this.parseMaybeAssign()))
                this.next();
              this.eat(_.tokTypes.comma);
              continue;
            }
            if (this.eat(_.tokTypes.colon)) {
              prop.kind = "init";
              prop.value = this.parseMaybeAssign();
            } else if (this.options.ecmaVersion >= 6 && (this.tok.type === _.tokTypes.parenL || this.tok.type === _.tokTypes.braceL)) {
              prop.kind = "init";
              prop.method = true;
              prop.value = this.parseMethod(isGenerator);
            } else if (this.options.ecmaVersion >= 5 && prop.key.type === "Identifier" && !prop.computed && (prop.key.name === "get" || prop.key.name === "set") && (this.tok.type != _.tokTypes.comma && this.tok.type != _.tokTypes.braceR)) {
              prop.kind = prop.key.name;
              this.parsePropertyName(prop);
              prop.value = this.parseMethod(false);
            } else {
              prop.kind = "init";
              if (this.options.ecmaVersion >= 6) {
                if (this.eat(_.tokTypes.eq)) {
                  var assign = this.startNodeAt(start);
                  assign.operator = "=";
                  assign.left = prop.key;
                  assign.right = this.parseMaybeAssign();
                  prop.value = this.finishNode(assign, "AssignmentExpression");
                } else {
                  prop.value = prop.key;
                }
              } else {
                prop.value = this.dummyIdent();
              }
              prop.shorthand = true;
            }
            node.properties.push(this.finishNode(prop, "Property"));
            this.eat(_.tokTypes.comma);
          }
          this.popCx();
          if (!this.eat(_.tokTypes.braceR)) {
            this.last.end = this.tok.start;
            if (this.options.locations)
              this.last.loc.end = this.tok.loc.start;
          }
          return this.finishNode(node, "ObjectExpression");
        };
        lp.parsePropertyName = function(prop) {
          if (this.options.ecmaVersion >= 6) {
            if (this.eat(_.tokTypes.bracketL)) {
              prop.computed = true;
              prop.key = this.parseExpression();
              this.expect(_.tokTypes.bracketR);
              return;
            } else {
              prop.computed = false;
            }
          }
          var key = this.tok.type === _.tokTypes.num || this.tok.type === _.tokTypes.string ? this.parseExprAtom() : this.parseIdent();
          prop.key = key || this.dummyIdent();
        };
        lp.parsePropertyAccessor = function() {
          if (this.tok.type === _.tokTypes.name || this.tok.type.keyword)
            return this.parseIdent();
        };
        lp.parseIdent = function() {
          var name = this.tok.type === _.tokTypes.name ? this.tok.value : this.tok.type.keyword;
          if (!name)
            return this.dummyIdent();
          var node = this.startNode();
          this.next();
          node.name = name;
          return this.finishNode(node, "Identifier");
        };
        lp.initFunction = function(node) {
          node.id = null;
          node.params = [];
          if (this.options.ecmaVersion >= 6) {
            node.generator = false;
            node.expression = false;
          }
        };
        lp.toAssignable = function(node, binding) {
          if (!node || node.type == "Identifier" || node.type == "MemberExpression" && !binding) {} else if (node.type == "ParenthesizedExpression") {
            node.expression = this.toAssignable(node.expression, binding);
          } else if (this.options.ecmaVersion < 6) {
            return this.dummyIdent();
          } else if (node.type == "ObjectExpression") {
            node.type = "ObjectPattern";
            var props = node.properties;
            for (var i = 0; i < props.length; i++) {
              props[i].value = this.toAssignable(props[i].value, binding);
            }
          } else if (node.type == "ArrayExpression") {
            node.type = "ArrayPattern";
            this.toAssignableList(node.elements, binding);
          } else if (node.type == "SpreadElement") {
            node.type = "RestElement";
            node.argument = this.toAssignable(node.argument, binding);
          } else if (node.type == "AssignmentExpression") {
            node.type = "AssignmentPattern";
            delete node.operator;
          } else {
            return this.dummyIdent();
          }
          return node;
        };
        lp.toAssignableList = function(exprList, binding) {
          for (var i = 0; i < exprList.length; i++) {
            exprList[i] = this.toAssignable(exprList[i], binding);
          }
          return exprList;
        };
        lp.parseFunctionParams = function(params) {
          params = this.parseExprList(_.tokTypes.parenR);
          return this.toAssignableList(params, true);
        };
        lp.parseMethod = function(isGenerator) {
          var node = this.startNode();
          this.initFunction(node);
          node.params = this.parseFunctionParams();
          node.generator = isGenerator || false;
          node.expression = this.options.ecmaVersion >= 6 && this.tok.type !== _.tokTypes.braceL;
          node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
          return this.finishNode(node, "FunctionExpression");
        };
        lp.parseArrowExpression = function(node, params) {
          this.initFunction(node);
          node.params = this.toAssignableList(params, true);
          node.expression = this.tok.type !== _.tokTypes.braceL;
          node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
          return this.finishNode(node, "ArrowFunctionExpression");
        };
        lp.parseExprList = function(close, allowEmpty) {
          this.pushCx();
          var indent = this.curIndent,
              line = this.curLineStart,
              elts = [];
          this.next();
          while (!this.closes(close, indent + 1, line)) {
            if (this.eat(_.tokTypes.comma)) {
              elts.push(allowEmpty ? null : this.dummyIdent());
              continue;
            }
            var elt = this.parseMaybeAssign();
            if (_parseutil.isDummy(elt)) {
              if (this.closes(close, indent, line))
                break;
              this.next();
            } else {
              elts.push(elt);
            }
            this.eat(_.tokTypes.comma);
          }
          this.popCx();
          if (!this.eat(close)) {
            this.last.end = this.tok.start;
            if (this.options.locations)
              this.last.loc.end = this.tok.loc.start;
          }
          return elts;
        };
      }, {
        "..": 1,
        "./parseutil": 4,
        "./state": 5
      }],
      3: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.parse_dammit = parse_dammit;
        function _interopRequireWildcard(obj) {
          if (obj && obj.__esModule) {
            return obj;
          } else {
            var newObj = {};
            if (obj != null) {
              for (var key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key))
                  newObj[key] = obj[key];
              }
            }
            newObj["default"] = obj;
            return newObj;
          }
        }
        var _ = _dereq_("..");
        var acorn = _interopRequireWildcard(_);
        var _state = _dereq_("./state");
        _dereq_("./tokenize");
        _dereq_("./statement");
        _dereq_("./expression");
        exports.LooseParser = _state.LooseParser;
        exports.pluginsLoose = _state.pluginsLoose;
        acorn.defaultOptions.tabSize = 4;
        function parse_dammit(input, options) {
          var p = new _state.LooseParser(input, options);
          p.next();
          return p.parseTopLevel();
        }
        acorn.parse_dammit = parse_dammit;
        acorn.LooseParser = _state.LooseParser;
        acorn.pluginsLoose = _state.pluginsLoose;
      }, {
        "..": 1,
        "./expression": 2,
        "./state": 5,
        "./statement": 6,
        "./tokenize": 7
      }],
      4: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        exports.isDummy = isDummy;
        function isDummy(node) {
          return node.name == "✖";
        }
      }, {}],
      5: [function(_dereq_, module, exports) {
        "use strict";
        exports.__esModule = true;
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        var _ = _dereq_("..");
        var pluginsLoose = {};
        exports.pluginsLoose = pluginsLoose;
        var LooseParser = (function() {
          function LooseParser(input, options) {
            _classCallCheck(this, LooseParser);
            this.toks = _.tokenizer(input, options);
            this.options = this.toks.options;
            this.input = this.toks.input;
            this.tok = this.last = {
              type: _.tokTypes.eof,
              start: 0,
              end: 0
            };
            if (this.options.locations) {
              var here = this.toks.curPosition();
              this.tok.loc = new _.SourceLocation(this.toks, here, here);
            }
            this.ahead = [];
            this.context = [];
            this.curIndent = 0;
            this.curLineStart = 0;
            this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
            this.options.pluginsLoose = options.pluginsLoose || {};
            this.loadPlugins(this.options.pluginsLoose);
          }
          LooseParser.prototype.startNode = function startNode() {
            return new _.Node(this.toks, this.tok.start, this.options.locations ? this.tok.loc.start : null);
          };
          LooseParser.prototype.storeCurrentPos = function storeCurrentPos() {
            return this.options.locations ? [this.tok.start, this.tok.loc.start] : this.tok.start;
          };
          LooseParser.prototype.startNodeAt = function startNodeAt(pos) {
            if (this.options.locations) {
              return new _.Node(this.toks, pos[0], pos[1]);
            } else {
              return new _.Node(this.toks, pos);
            }
          };
          LooseParser.prototype.finishNode = function finishNode(node, type) {
            node.type = type;
            node.end = this.last.end;
            if (this.options.locations)
              node.loc.end = this.last.loc.end;
            if (this.options.ranges)
              node.range[1] = this.last.end;
            return node;
          };
          LooseParser.prototype.dummyNode = function dummyNode(type) {
            var dummy = this.startNode();
            dummy.type = type;
            dummy.end = dummy.start;
            if (this.options.locations)
              dummy.loc.end = dummy.loc.start;
            if (this.options.ranges)
              dummy.range[1] = dummy.start;
            this.last = {
              type: _.tokTypes.name,
              start: dummy.start,
              end: dummy.start,
              loc: dummy.loc
            };
            return dummy;
          };
          LooseParser.prototype.dummyIdent = function dummyIdent() {
            var dummy = this.dummyNode("Identifier");
            dummy.name = "✖";
            return dummy;
          };
          LooseParser.prototype.dummyString = function dummyString() {
            var dummy = this.dummyNode("Literal");
            dummy.value = dummy.raw = "✖";
            return dummy;
          };
          LooseParser.prototype.eat = function eat(type) {
            if (this.tok.type === type) {
              this.next();
              return true;
            } else {
              return false;
            }
          };
          LooseParser.prototype.isContextual = function isContextual(name) {
            return this.tok.type === _.tokTypes.name && this.tok.value === name;
          };
          LooseParser.prototype.eatContextual = function eatContextual(name) {
            return this.tok.value === name && this.eat(_.tokTypes.name);
          };
          LooseParser.prototype.canInsertSemicolon = function canInsertSemicolon() {
            return this.tok.type === _.tokTypes.eof || this.tok.type === _.tokTypes.braceR || _.lineBreak.test(this.input.slice(this.last.end, this.tok.start));
          };
          LooseParser.prototype.semicolon = function semicolon() {
            return this.eat(_.tokTypes.semi);
          };
          LooseParser.prototype.expect = function expect(type) {
            if (this.eat(type))
              return true;
            for (var i = 1; i <= 2; i++) {
              if (this.lookAhead(i).type == type) {
                for (var j = 0; j < i; j++) {
                  this.next();
                }
                return true;
              }
            }
          };
          LooseParser.prototype.pushCx = function pushCx() {
            this.context.push(this.curIndent);
          };
          LooseParser.prototype.popCx = function popCx() {
            this.curIndent = this.context.pop();
          };
          LooseParser.prototype.lineEnd = function lineEnd(pos) {
            while (pos < this.input.length && !_.isNewLine(this.input.charCodeAt(pos)))
              ++pos;
            return pos;
          };
          LooseParser.prototype.indentationAfter = function indentationAfter(pos) {
            for (var count = 0; ; ++pos) {
              var ch = this.input.charCodeAt(pos);
              if (ch === 32)
                ++count;
              else if (ch === 9)
                count += this.options.tabSize;
              else
                return count;
            }
          };
          LooseParser.prototype.closes = function closes(closeTok, indent, line, blockHeuristic) {
            if (this.tok.type === closeTok || this.tok.type === _.tokTypes.eof)
              return true;
            return line != this.curLineStart && this.curIndent < indent && this.tokenStartsLine() && (!blockHeuristic || this.nextLineStart >= this.input.length || this.indentationAfter(this.nextLineStart) < indent);
          };
          LooseParser.prototype.tokenStartsLine = function tokenStartsLine() {
            for (var p = this.tok.start - 1; p >= this.curLineStart; --p) {
              var ch = this.input.charCodeAt(p);
              if (ch !== 9 && ch !== 32)
                return false;
            }
            return true;
          };
          LooseParser.prototype.extend = function extend(name, f) {
            this[name] = f(this[name]);
          };
          LooseParser.prototype.loadPlugins = function loadPlugins(pluginConfigs) {
            for (var _name in pluginConfigs) {
              var plugin = pluginsLoose[_name];
              if (!plugin)
                throw new Error("Plugin '" + _name + "' not found");
              plugin(this, pluginConfigs[_name]);
            }
          };
          return LooseParser;
        })();
        exports.LooseParser = LooseParser;
      }, {"..": 1}],
      6: [function(_dereq_, module, exports) {
        "use strict";
        var _state = _dereq_("./state");
        var _parseutil = _dereq_("./parseutil");
        var _ = _dereq_("..");
        var lp = _state.LooseParser.prototype;
        lp.parseTopLevel = function() {
          var node = this.startNodeAt(this.options.locations ? [0, _.getLineInfo(this.input, 0)] : 0);
          node.body = [];
          while (this.tok.type !== _.tokTypes.eof)
            node.body.push(this.parseStatement());
          this.last = this.tok;
          if (this.options.ecmaVersion >= 6) {
            node.sourceType = this.options.sourceType;
          }
          return this.finishNode(node, "Program");
        };
        lp.parseStatement = function() {
          var starttype = this.tok.type,
              node = this.startNode();
          switch (starttype) {
            case _.tokTypes._break:
            case _.tokTypes._continue:
              this.next();
              var isBreak = starttype === _.tokTypes._break;
              if (this.semicolon() || this.canInsertSemicolon()) {
                node.label = null;
              } else {
                node.label = this.tok.type === _.tokTypes.name ? this.parseIdent() : null;
                this.semicolon();
              }
              return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
            case _.tokTypes._debugger:
              this.next();
              this.semicolon();
              return this.finishNode(node, "DebuggerStatement");
            case _.tokTypes._do:
              this.next();
              node.body = this.parseStatement();
              node.test = this.eat(_.tokTypes._while) ? this.parseParenExpression() : this.dummyIdent();
              this.semicolon();
              return this.finishNode(node, "DoWhileStatement");
            case _.tokTypes._for:
              this.next();
              this.pushCx();
              this.expect(_.tokTypes.parenL);
              if (this.tok.type === _.tokTypes.semi)
                return this.parseFor(node, null);
              if (this.tok.type === _.tokTypes._var || this.tok.type === _.tokTypes._let || this.tok.type === _.tokTypes._const) {
                var _init = this.parseVar(true);
                if (_init.declarations.length === 1 && (this.tok.type === _.tokTypes._in || this.isContextual("of"))) {
                  return this.parseForIn(node, _init);
                }
                return this.parseFor(node, _init);
              }
              var init = this.parseExpression(true);
              if (this.tok.type === _.tokTypes._in || this.isContextual("of"))
                return this.parseForIn(node, this.toAssignable(init));
              return this.parseFor(node, init);
            case _.tokTypes._function:
              this.next();
              return this.parseFunction(node, true);
            case _.tokTypes._if:
              this.next();
              node.test = this.parseParenExpression();
              node.consequent = this.parseStatement();
              node.alternate = this.eat(_.tokTypes._else) ? this.parseStatement() : null;
              return this.finishNode(node, "IfStatement");
            case _.tokTypes._return:
              this.next();
              if (this.eat(_.tokTypes.semi) || this.canInsertSemicolon())
                node.argument = null;
              else {
                node.argument = this.parseExpression();
                this.semicolon();
              }
              return this.finishNode(node, "ReturnStatement");
            case _.tokTypes._switch:
              var blockIndent = this.curIndent,
                  line = this.curLineStart;
              this.next();
              node.discriminant = this.parseParenExpression();
              node.cases = [];
              this.pushCx();
              this.expect(_.tokTypes.braceL);
              var cur = undefined;
              while (!this.closes(_.tokTypes.braceR, blockIndent, line, true)) {
                if (this.tok.type === _.tokTypes._case || this.tok.type === _.tokTypes._default) {
                  var isCase = this.tok.type === _.tokTypes._case;
                  if (cur)
                    this.finishNode(cur, "SwitchCase");
                  node.cases.push(cur = this.startNode());
                  cur.consequent = [];
                  this.next();
                  if (isCase)
                    cur.test = this.parseExpression();
                  else
                    cur.test = null;
                  this.expect(_.tokTypes.colon);
                } else {
                  if (!cur) {
                    node.cases.push(cur = this.startNode());
                    cur.consequent = [];
                    cur.test = null;
                  }
                  cur.consequent.push(this.parseStatement());
                }
              }
              if (cur)
                this.finishNode(cur, "SwitchCase");
              this.popCx();
              this.eat(_.tokTypes.braceR);
              return this.finishNode(node, "SwitchStatement");
            case _.tokTypes._throw:
              this.next();
              node.argument = this.parseExpression();
              this.semicolon();
              return this.finishNode(node, "ThrowStatement");
            case _.tokTypes._try:
              this.next();
              node.block = this.parseBlock();
              node.handler = null;
              if (this.tok.type === _.tokTypes._catch) {
                var clause = this.startNode();
                this.next();
                this.expect(_.tokTypes.parenL);
                clause.param = this.toAssignable(this.parseExprAtom(), true);
                this.expect(_.tokTypes.parenR);
                clause.body = this.parseBlock();
                node.handler = this.finishNode(clause, "CatchClause");
              }
              node.finalizer = this.eat(_.tokTypes._finally) ? this.parseBlock() : null;
              if (!node.handler && !node.finalizer)
                return node.block;
              return this.finishNode(node, "TryStatement");
            case _.tokTypes._var:
            case _.tokTypes._let:
            case _.tokTypes._const:
              return this.parseVar();
            case _.tokTypes._while:
              this.next();
              node.test = this.parseParenExpression();
              node.body = this.parseStatement();
              return this.finishNode(node, "WhileStatement");
            case _.tokTypes._with:
              this.next();
              node.object = this.parseParenExpression();
              node.body = this.parseStatement();
              return this.finishNode(node, "WithStatement");
            case _.tokTypes.braceL:
              return this.parseBlock();
            case _.tokTypes.semi:
              this.next();
              return this.finishNode(node, "EmptyStatement");
            case _.tokTypes._class:
              return this.parseClass(true);
            case _.tokTypes._import:
              return this.parseImport();
            case _.tokTypes._export:
              return this.parseExport();
            default:
              var expr = this.parseExpression();
              if (_parseutil.isDummy(expr)) {
                this.next();
                if (this.tok.type === _.tokTypes.eof)
                  return this.finishNode(node, "EmptyStatement");
                return this.parseStatement();
              } else if (starttype === _.tokTypes.name && expr.type === "Identifier" && this.eat(_.tokTypes.colon)) {
                node.body = this.parseStatement();
                node.label = expr;
                return this.finishNode(node, "LabeledStatement");
              } else {
                node.expression = expr;
                this.semicolon();
                return this.finishNode(node, "ExpressionStatement");
              }
          }
        };
        lp.parseBlock = function() {
          var node = this.startNode();
          this.pushCx();
          this.expect(_.tokTypes.braceL);
          var blockIndent = this.curIndent,
              line = this.curLineStart;
          node.body = [];
          while (!this.closes(_.tokTypes.braceR, blockIndent, line, true))
            node.body.push(this.parseStatement());
          this.popCx();
          this.eat(_.tokTypes.braceR);
          return this.finishNode(node, "BlockStatement");
        };
        lp.parseFor = function(node, init) {
          node.init = init;
          node.test = node.update = null;
          if (this.eat(_.tokTypes.semi) && this.tok.type !== _.tokTypes.semi)
            node.test = this.parseExpression();
          if (this.eat(_.tokTypes.semi) && this.tok.type !== _.tokTypes.parenR)
            node.update = this.parseExpression();
          this.popCx();
          this.expect(_.tokTypes.parenR);
          node.body = this.parseStatement();
          return this.finishNode(node, "ForStatement");
        };
        lp.parseForIn = function(node, init) {
          var type = this.tok.type === _.tokTypes._in ? "ForInStatement" : "ForOfStatement";
          this.next();
          node.left = init;
          node.right = this.parseExpression();
          this.popCx();
          this.expect(_.tokTypes.parenR);
          node.body = this.parseStatement();
          return this.finishNode(node, type);
        };
        lp.parseVar = function(noIn) {
          var node = this.startNode();
          node.kind = this.tok.type.keyword;
          this.next();
          node.declarations = [];
          do {
            var decl = this.startNode();
            decl.id = this.options.ecmaVersion >= 6 ? this.toAssignable(this.parseExprAtom(), true) : this.parseIdent();
            decl.init = this.eat(_.tokTypes.eq) ? this.parseMaybeAssign(noIn) : null;
            node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
          } while (this.eat(_.tokTypes.comma));
          if (!node.declarations.length) {
            var decl = this.startNode();
            decl.id = this.dummyIdent();
            node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
          }
          if (!noIn)
            this.semicolon();
          return this.finishNode(node, "VariableDeclaration");
        };
        lp.parseClass = function(isStatement) {
          var node = this.startNode();
          this.next();
          if (this.tok.type === _.tokTypes.name)
            node.id = this.parseIdent();
          else if (isStatement)
            node.id = this.dummyIdent();
          else
            node.id = null;
          node.superClass = this.eat(_.tokTypes._extends) ? this.parseExpression() : null;
          node.body = this.startNode();
          node.body.body = [];
          this.pushCx();
          var indent = this.curIndent + 1,
              line = this.curLineStart;
          this.eat(_.tokTypes.braceL);
          if (this.curIndent + 1 < indent) {
            indent = this.curIndent;
            line = this.curLineStart;
          }
          while (!this.closes(_.tokTypes.braceR, indent, line)) {
            if (this.semicolon())
              continue;
            var method = this.startNode(),
                isGenerator = undefined;
            if (this.options.ecmaVersion >= 6) {
              method["static"] = false;
              isGenerator = this.eat(_.tokTypes.star);
            }
            this.parsePropertyName(method);
            if (_parseutil.isDummy(method.key)) {
              if (_parseutil.isDummy(this.parseMaybeAssign()))
                this.next();
              this.eat(_.tokTypes.comma);
              continue;
            }
            if (method.key.type === "Identifier" && !method.computed && method.key.name === "static" && (this.tok.type != _.tokTypes.parenL && this.tok.type != _.tokTypes.braceL)) {
              method["static"] = true;
              isGenerator = this.eat(_.tokTypes.star);
              this.parsePropertyName(method);
            } else {
              method["static"] = false;
            }
            if (this.options.ecmaVersion >= 5 && method.key.type === "Identifier" && !method.computed && (method.key.name === "get" || method.key.name === "set") && this.tok.type !== _.tokTypes.parenL && this.tok.type !== _.tokTypes.braceL) {
              method.kind = method.key.name;
              this.parsePropertyName(method);
              method.value = this.parseMethod(false);
            } else {
              if (!method.computed && !method["static"] && !isGenerator && (method.key.type === "Identifier" && method.key.name === "constructor" || method.key.type === "Literal" && method.key.value === "constructor")) {
                method.kind = "constructor";
              } else {
                method.kind = "method";
              }
              method.value = this.parseMethod(isGenerator);
            }
            node.body.body.push(this.finishNode(method, "MethodDefinition"));
          }
          this.popCx();
          if (!this.eat(_.tokTypes.braceR)) {
            this.last.end = this.tok.start;
            if (this.options.locations)
              this.last.loc.end = this.tok.loc.start;
          }
          this.semicolon();
          this.finishNode(node.body, "ClassBody");
          return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
        };
        lp.parseFunction = function(node, isStatement) {
          this.initFunction(node);
          if (this.options.ecmaVersion >= 6) {
            node.generator = this.eat(_.tokTypes.star);
          }
          if (this.tok.type === _.tokTypes.name)
            node.id = this.parseIdent();
          else if (isStatement)
            node.id = this.dummyIdent();
          node.params = this.parseFunctionParams();
          node.body = this.parseBlock();
          return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
        };
        lp.parseExport = function() {
          var node = this.startNode();
          this.next();
          if (this.eat(_.tokTypes.star)) {
            node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
            return this.finishNode(node, "ExportAllDeclaration");
          }
          if (this.eat(_.tokTypes._default)) {
            var expr = this.parseMaybeAssign();
            if (expr.id) {
              switch (expr.type) {
                case "FunctionExpression":
                  expr.type = "FunctionDeclaration";
                  break;
                case "ClassExpression":
                  expr.type = "ClassDeclaration";
                  break;
              }
            }
            node.declaration = expr;
            this.semicolon();
            return this.finishNode(node, "ExportDefaultDeclaration");
          }
          if (this.tok.type.keyword) {
            node.declaration = this.parseStatement();
            node.specifiers = [];
            node.source = null;
          } else {
            node.declaration = null;
            node.specifiers = this.parseExportSpecifierList();
            node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
            this.semicolon();
          }
          return this.finishNode(node, "ExportNamedDeclaration");
        };
        lp.parseImport = function() {
          var node = this.startNode();
          this.next();
          if (this.tok.type === _.tokTypes.string) {
            node.specifiers = [];
            node.source = this.parseExprAtom();
            node.kind = '';
          } else {
            var elt = undefined;
            if (this.tok.type === _.tokTypes.name && this.tok.value !== "from") {
              elt = this.startNode();
              elt.local = this.parseIdent();
              this.finishNode(elt, "ImportDefaultSpecifier");
              this.eat(_.tokTypes.comma);
            }
            node.specifiers = this.parseImportSpecifierList();
            node.source = this.eatContextual("from") && this.tok.type == _.tokTypes.string ? this.parseExprAtom() : this.dummyString();
            if (elt)
              node.specifiers.unshift(elt);
          }
          this.semicolon();
          return this.finishNode(node, "ImportDeclaration");
        };
        lp.parseImportSpecifierList = function() {
          var elts = [];
          if (this.tok.type === _.tokTypes.star) {
            var elt = this.startNode();
            this.next();
            if (this.eatContextual("as"))
              elt.local = this.parseIdent();
            elts.push(this.finishNode(elt, "ImportNamespaceSpecifier"));
          } else {
            var indent = this.curIndent,
                line = this.curLineStart,
                continuedLine = this.nextLineStart;
            this.pushCx();
            this.eat(_.tokTypes.braceL);
            if (this.curLineStart > continuedLine)
              continuedLine = this.curLineStart;
            while (!this.closes(_.tokTypes.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
              var elt = this.startNode();
              if (this.eat(_.tokTypes.star)) {
                elt.local = this.eatContextual("as") ? this.parseIdent() : this.dummyIdent();
                this.finishNode(elt, "ImportNamespaceSpecifier");
              } else {
                if (this.isContextual("from"))
                  break;
                elt.imported = this.parseIdent();
                if (_parseutil.isDummy(elt.imported))
                  break;
                elt.local = this.eatContextual("as") ? this.parseIdent() : elt.imported;
                this.finishNode(elt, "ImportSpecifier");
              }
              elts.push(elt);
              this.eat(_.tokTypes.comma);
            }
            this.eat(_.tokTypes.braceR);
            this.popCx();
          }
          return elts;
        };
        lp.parseExportSpecifierList = function() {
          var elts = [];
          var indent = this.curIndent,
              line = this.curLineStart,
              continuedLine = this.nextLineStart;
          this.pushCx();
          this.eat(_.tokTypes.braceL);
          if (this.curLineStart > continuedLine)
            continuedLine = this.curLineStart;
          while (!this.closes(_.tokTypes.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
            if (this.isContextual("from"))
              break;
            var elt = this.startNode();
            elt.local = this.parseIdent();
            if (_parseutil.isDummy(elt.local))
              break;
            elt.exported = this.eatContextual("as") ? this.parseIdent() : elt.local;
            this.finishNode(elt, "ExportSpecifier");
            elts.push(elt);
            this.eat(_.tokTypes.comma);
          }
          this.eat(_.tokTypes.braceR);
          this.popCx();
          return elts;
        };
      }, {
        "..": 1,
        "./parseutil": 4,
        "./state": 5
      }],
      7: [function(_dereq_, module, exports) {
        "use strict";
        var _ = _dereq_("..");
        var _state = _dereq_("./state");
        var lp = _state.LooseParser.prototype;
        function isSpace(ch) {
          return ch < 14 && ch > 8 || ch === 32 || ch === 160 || _.isNewLine(ch);
        }
        lp.next = function() {
          this.last = this.tok;
          if (this.ahead.length)
            this.tok = this.ahead.shift();
          else
            this.tok = this.readToken();
          if (this.tok.start >= this.nextLineStart) {
            while (this.tok.start >= this.nextLineStart) {
              this.curLineStart = this.nextLineStart;
              this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
            }
            this.curIndent = this.indentationAfter(this.curLineStart);
          }
        };
        lp.readToken = function() {
          for (; ; ) {
            try {
              this.toks.next();
              if (this.toks.type === _.tokTypes.dot && this.input.substr(this.toks.end, 1) === "." && this.options.ecmaVersion >= 6) {
                this.toks.end++;
                this.toks.type = _.tokTypes.ellipsis;
              }
              return new _.Token(this.toks);
            } catch (e) {
              if (!(e instanceof SyntaxError))
                throw e;
              var msg = e.message,
                  pos = e.raisedAt,
                  replace = true;
              if (/unterminated/i.test(msg)) {
                pos = this.lineEnd(e.pos + 1);
                if (/string/.test(msg)) {
                  replace = {
                    start: e.pos,
                    end: pos,
                    type: _.tokTypes.string,
                    value: this.input.slice(e.pos + 1, pos)
                  };
                } else if (/regular expr/i.test(msg)) {
                  var re = this.input.slice(e.pos, pos);
                  try {
                    re = new RegExp(re);
                  } catch (e) {}
                  replace = {
                    start: e.pos,
                    end: pos,
                    type: _.tokTypes.regexp,
                    value: re
                  };
                } else if (/template/.test(msg)) {
                  replace = {
                    start: e.pos,
                    end: pos,
                    type: _.tokTypes.template,
                    value: this.input.slice(e.pos, pos)
                  };
                } else {
                  replace = false;
                }
              } else if (/invalid (unicode|regexp|number)|expecting unicode|octal literal|is reserved|directly after number|expected number in radix/i.test(msg)) {
                while (pos < this.input.length && !isSpace(this.input.charCodeAt(pos)))
                  ++pos;
              } else if (/character escape|expected hexadecimal/i.test(msg)) {
                while (pos < this.input.length) {
                  var ch = this.input.charCodeAt(pos++);
                  if (ch === 34 || ch === 39 || _.isNewLine(ch))
                    break;
                }
              } else if (/unexpected character/i.test(msg)) {
                pos++;
                replace = false;
              } else if (/regular expression/i.test(msg)) {
                replace = true;
              } else {
                throw e;
              }
              this.resetTo(pos);
              if (replace === true)
                replace = {
                  start: pos,
                  end: pos,
                  type: _.tokTypes.name,
                  value: "✖"
                };
              if (replace) {
                if (this.options.locations)
                  replace.loc = new _.SourceLocation(this.toks, _.getLineInfo(this.input, replace.start), _.getLineInfo(this.input, replace.end));
                return replace;
              }
            }
          }
        };
        lp.resetTo = function(pos) {
          this.toks.pos = pos;
          var ch = this.input.charAt(pos - 1);
          this.toks.exprAllowed = !ch || /[\[\{\(,;:?\/*=+\-~!|&%^<>]/.test(ch) || /[enwfd]/.test(ch) && /\b(keywords|case|else|return|throw|new|in|(instance|type)of|delete|void)$/.test(this.input.slice(pos - 10, pos));
          if (this.options.locations) {
            this.toks.curLine = 1;
            this.toks.lineStart = _.lineBreakG.lastIndex = 0;
            var match = undefined;
            while ((match = _.lineBreakG.exec(this.input)) && match.index < pos) {
              ++this.toks.curLine;
              this.toks.lineStart = match.index + match[0].length;
            }
          }
        };
        lp.lookAhead = function(n) {
          while (n > this.ahead.length)
            this.ahead.push(this.readToken());
          return this.ahead[n - 1];
        };
      }, {
        "..": 1,
        "./state": 5
      }]
    }, {}, [3])(3);
  });
  return module.exports;
});

System.registerDynamic("lively.ast/dist/escodegen.browser.js", [], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var escodegen = typeof process !== 'undefined' ? System._nodeRequire('escodegen') : window.escodegen;
  for (var name in escodegen)
    module.exports[name] = escodegen[name];
  return module.exports;
});

System.registerDynamic("lively.ast/lib/acorn-extension.js", ["lively.lang", "../index"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var lang = $__require('lively.lang');
  var ast = $__require('../index');
  var acorn = ast.acorn;
  acorn.walk.forEachNode = function(parsed, func, state, options) {
    options = options || {};
    var traversal = options.traversal || 'preorder';
    var visitors = lang.obj.clone(options.visitors ? options.visitors : acorn.walk.visitors.withMemberExpression);
    var iterator = traversal === 'preorder' ? function(orig, type, node, depth, cont) {
      func(node, state, depth, type);
      return orig(node, depth + 1, cont);
    } : function(orig, type, node, depth, cont) {
      var result = orig(node, depth + 1, cont);
      func(node, state, depth, type);
      return result;
    };
    Object.keys(visitors).forEach(function(type) {
      var orig = visitors[type];
      visitors[type] = function(node, depth, cont) {
        return iterator(orig, type, node, depth, cont);
      };
    });
    acorn.walk.recursive(parsed, 0, null, visitors);
    return parsed;
  };
  acorn.walk.matchNodes = function(parsed, visitor, state, options) {
    function visit(node, state, depth, type) {
      if (visitor[node.type])
        visitor[node.type](node, state, depth, type);
    }
    return acorn.walk.forEachNode(parsed, visit, state, options);
  };
  acorn.walk.findNodesIncluding = function(parsed, pos, test, base) {
    var nodes = [];
    base = base || lang.obj.clone(acorn.walk.visitors.withMemberExpression);
    Object.keys(base).forEach(function(name) {
      var orig = base[name];
      base[name] = function(node, state, cont) {
        lang.arr.pushIfNotIncluded(nodes, node);
        return orig(node, state, cont);
      };
    });
    base["Property"] = function(node, st, c) {
      lang.arr.pushIfNotIncluded(nodes, node);
      c(node.key, st, "Expression");
      c(node.value, st, "Expression");
    };
    base["LabeledStatement"] = function(node, st, c) {
      node.label && c(node.label, st, "Expression");
      c(node.body, st, "Statement");
    };
    acorn.walk.findNodeAround(parsed, pos, test, base);
    return nodes;
  };
  acorn.walk.addSource = function(parsed, source, completeSrc, forceNewSource) {
    var options = options || {};
    options.ecmaVersion = options.ecmaVersion || 6;
    options.sourceType = options.sourceType || "module";
    options.plugins = options.plugins || {};
    if (options.plugins.hasOwnProperty("jsx"))
      options.plugins.jsx = options.plugins.jsx;
    source = typeof parsed === 'string' ? parsed : source;
    parsed = typeof parsed === 'string' ? acorn.parse(parsed, options) : parsed;
    completeSrc = !!completeSrc;
    return acorn.walk.forEachNode(parsed, function(node) {
      if (node.source && !forceNewSource)
        return;
      node.source = completeSrc ? source : source.slice(node.start, node.end);
    });
  };
  acorn.walk.inspect = function(parsed, source) {
    var options = options || {};
    options.ecmaVersion = options.ecmaVersion || 6;
    options.sourceType = options.sourceType || "module";
    options.plugins = options.plugins || {};
    if (options.plugins.hasOwnProperty("jsx"))
      options.plugins.jsx = options.plugins.jsx;
    source = typeof parsed === 'string' ? parsed : null;
    parsed = typeof parsed === 'string' ? acorn.parse(parsed) : parsed;
    source && acorn.walk.addSource(parsed, source);
    return lang.obj.inspect(parsed);
  };
  acorn.walk.withParentInfo = function(parsed, iterator, options) {
    options = options || {};
    function makeScope(parentScope) {
      var scope = {
        id: lang.string.newUUID(),
        parentScope: parentScope,
        containingScopes: []
      };
      parentScope && parentScope.containingScopes.push(scope);
      return scope;
    }
    var visitors = acorn.walk.make({
      Function: function(node, st, c) {
        if (st && st.scope)
          st.scope = makeScope(st.scope);
        c(node.body, st, "ScopeBody");
      },
      VariableDeclarator: function(node, st, c) {
        node.init && c(node.init, st, 'Expression');
      },
      VariableDeclaration: function(node, st, c) {
        for (var i = 0; i < node.declarations.length; ++i) {
          var decl = node.declarations[i];
          if (decl)
            c(decl, st, "VariableDeclarator");
        }
      },
      ObjectExpression: function(node, st, c) {
        for (var i = 0; i < node.properties.length; ++i) {
          var prop = node.properties[i];
          c(prop.key, st, "Expression");
          c(prop.value, st, "Expression");
        }
      },
      MemberExpression: function(node, st, c) {
        c(node.object, st, "Expression");
        c(node.property, st, "Expression");
      }
    });
    var lastActiveProp,
        getters = [];
    acorn.walk.forEachNode(parsed, function(node) {
      lang.arr.withoutAll(Object.keys(node), ['end', 'start', 'type', 'source', 'raw']).forEach(function(propName) {
        if (node.__lookupGetter__(propName))
          return;
        var val = node[propName];
        node.__defineGetter__(propName, function() {
          lastActiveProp = propName;
          return val;
        });
        getters.push([node, propName, node[propName]]);
      });
    }, null, {visitors: visitors});
    var result = [];
    Object.keys(visitors).forEach(function(type) {
      var orig = visitors[type];
      visitors[type] = function(node, state, cont) {
        if (type === node.type || options.visitAllNodes) {
          result.push(iterator.call(null, node, {
            scope: state.scope,
            depth: state.depth,
            parent: state.parent,
            type: type,
            propertyInParent: lastActiveProp
          }));
          return orig(node, {
            scope: state.scope,
            parent: node,
            depth: state.depth + 1
          }, cont);
        } else {
          return orig(node, state, cont);
        }
      };
    });
    acorn.walk.recursive(parsed, {
      scope: makeScope(),
      parent: null,
      propertyInParent: '',
      depth: 0
    }, null, visitors);
    getters.forEach(function(nodeNameVal) {
      delete nodeNameVal[0][nodeNameVal[1]];
      nodeNameVal[0][nodeNameVal[1]] = nodeNameVal[2];
    });
    return result;
  };
  acorn.walk.toLKObjects = function(parsed) {
    if (!!!parsed.type)
      throw new Error('Given AST is not an Acorn AST.');
    function newUndefined(start, end) {
      start = start || -1;
      end = end || -1;
      return new ast.Variable([start, end], 'undefined');
    }
    var visitors = {
      Program: function(n, c) {
        return new ast.Sequence([n.start, n.end], n.body.map(c));
      },
      FunctionDeclaration: function(n, c) {
        var args = n.params.map(function(param) {
          return new ast.Variable([param.start, param.end], param.name);
        });
        var fn = new ast.Function([n.id.end, n.end], c(n.body), args);
        return new ast.VarDeclaration([n.start, n.end], n.id.name, fn);
      },
      BlockStatement: function(n, c) {
        var children = n.body.map(c);
        return new ast.Sequence([n.start + 1, n.end], children);
      },
      ExpressionStatement: function(n, c) {
        return c(n.expression);
      },
      CallExpression: function(n, c) {
        if ((n.callee.type == 'MemberExpression') && (n.type != 'NewExpression')) {
          var property;
          var r = n.callee.object;
          if (n.callee.computed) {
            property = c(n.callee.property);
          } else {
            property = new ast.String([n.callee.property.start, n.callee.property.end], n.callee.property.name);
          }
          return new ast.Send([n.start, n.end], property, c(r), n.arguments.map(c));
        } else {
          return new ast.Call([n.start, n.end], c(n.callee), n.arguments.map(c));
        }
      },
      MemberExpression: function(n, c) {
        var slotName;
        if (n.computed) {
          slotName = c(n.property);
        } else {
          slotName = new ast.String([n.property.start, n.property.end], n.property.name);
        }
        return new ast.GetSlot([n.start, n.end], slotName, c(n.object));
      },
      NewExpression: function(n, c) {
        return new ast.New([n.start, n.end], this.CallExpression(n, c));
      },
      VariableDeclaration: function(n, c) {
        var start = n.declarations[0] ? n.declarations[0].start - 1 : n.start;
        return new ast.Sequence([start, n.end], n.declarations.map(c));
      },
      VariableDeclarator: function(n, c) {
        var value = n.init ? c(n.init) : newUndefined(n.start - 1, n.start - 1);
        return new ast.VarDeclaration([n.start - 1, n.end], n.id.name, value);
      },
      FunctionExpression: function(n, c) {
        var args = n.params.map(function(param) {
          return new ast.Variable([param.start, param.end], param.name);
        });
        return new ast.Function([n.start, n.end], c(n.body), args);
      },
      IfStatement: function(n, c) {
        return new ast.If([n.start, n.end], c(n.test), c(n.consequent), n.alternate ? c(n.alternate) : newUndefined(n.consequent.end, n.consequent.end));
      },
      ConditionalExpression: function(n, c) {
        return new ast.Cond([n.start, n.end], c(n.test), c(n.consequent), c(n.alternate));
      },
      SwitchStatement: function(n, c) {
        return new ast.Switch([n.start, n.end], c(n.discriminant), n.cases.map(c));
      },
      SwitchCase: function(n, c) {
        var start = n.consequent.length > 0 ? n.consequent[0].start : n.end;
        var end = n.consequent.length > 0 ? n.consequent[n.consequent.length - 1].end : n.end;
        var seq = new ast.Sequence([start, end], n.consequent.map(c));
        if (n.test != null) {
          return new ast.Case([n.start, n.end], c(n.test), seq);
        } else {
          return new ast.Default([n.start, n.end], seq);
        }
      },
      BreakStatement: function(n, c) {
        var label;
        if (n.label == null) {
          label = new ast.Label([n.end, n.end], '');
        } else {
          label = new ast.Label([n.label.start, n.label.end], n.label.name);
        }
        return new ast.Break([n.start, n.end], label);
      },
      ContinueStatement: function(n, c) {
        var label;
        if (n.label == null) {
          label = new ast.Label([n.end, n.end], '');
        } else {
          label = new ast.Label([n.label.start, n.label.end], n.label.name);
        }
        return new ast.Continue([n.start, n.end], label);
      },
      TryStatement: function(n, c) {
        var errVar,
            catchSeq;
        if (n.handler) {
          catchSeq = c(n.handler.body);
          errVar = c(n.handler.param);
        } else {
          catchSeq = newUndefined(n.block.end + 1, n.block.end + 1);
          errVar = newUndefined(n.block.end + 1, n.block.end + 1);
        }
        var finallySeq = n.finalizer ? c(n.finalizer) : newUndefined(n.end, n.end);
        return new ast.TryCatchFinally([n.start, n.end], c(n.block), errVar, catchSeq, finallySeq);
      },
      ThrowStatement: function(n, c) {
        return new ast.Throw([n.start, n.end], c(n.argument));
      },
      ForStatement: function(n, c) {
        var init = n.init ? c(n.init) : newUndefined(4, 4);
        var cond = n.test ? c(n.test) : newUndefined(init.pos[1] + 1, init.pos[1] + 1);
        var upd = n.update ? c(n.update) : newUndefined(cond.pos[1] + 1, cond.pos[1] + 1);
        return new ast.For([n.start, n.end], init, cond, c(n.body), upd);
      },
      ForInStatement: function(n, c) {
        var left = n.left.type == 'VariableDeclaration' ? c(n.left.declarations[0]) : c(n.left);
        return new ast.ForIn([n.start, n.end], left, c(n.right), c(n.body));
      },
      WhileStatement: function(n, c) {
        return new ast.While([n.start, n.end], c(n.test), c(n.body));
      },
      DoWhileStatement: function(n, c) {
        return new ast.DoWhile([n.start, n.end], c(n.body), c(n.test));
      },
      WithStatement: function(n, c) {
        return new ast.With([n.start, n.end], c(n.object), c(n.body));
      },
      UnaryExpression: function(n, c) {
        return new ast.UnaryOp([n.start, n.end], n.operator, c(n.argument));
      },
      BinaryExpression: function(n, c) {
        return new ast.BinaryOp([n.start, n.end], n.operator, c(n.left), c(n.right));
      },
      AssignmentExpression: function(n, c) {
        if (n.operator == '=') {
          return new ast.Set([n.start, n.end], c(n.left), c(n.right));
        } else {
          return new ast.ModifyingSet([n.start, n.end], c(n.left), n.operator.substr(0, n.operator.length - 1), c(n.right));
        }
      },
      UpdateExpression: function(n, c) {
        if (n.prefix) {
          return new ast.PreOp([n.start, n.end], n.operator, c(n.argument));
        } else {
          return new ast.PostOp([n.start, n.end], n.operator, c(n.argument));
        }
      },
      ReturnStatement: function(n, c) {
        return new ast.Return([n.start, n.end], n.argument ? c(n.argument) : newUndefined(n.end, n.end));
      },
      Identifier: function(n, c) {
        return new ast.Variable([n.start, n.end], n.name);
      },
      Literal: function(n, c) {
        if (Object.isNumber(n.value)) {
          return new ast.Number([n.start, n.end], n.value);
        } else if (Object.isBoolean(n.value)) {
          return new ast.Variable([n.start, n.end], n.value.toString());
        } else if (typeof n.value === 'string') {
          return new ast.String([n.start, n.end], n.value);
        } else if (Object.isRegExp(n.value)) {
          var flags = n.raw.substr(n.raw.lastIndexOf('/') + 1);
          return new ast.Regex([n.start, n.end], n.value.source, flags);
        } else if (n.value === null) {
          return new ast.Variable([n.start, n.end], 'null');
        }
        throw new Error('Case of Literal not handled!');
      },
      ObjectExpression: function(n, c) {
        var props = n.properties.map(function(prop) {
          var propName = prop.key.type == 'Identifier' ? prop.key.name : prop.key.value;
          if (prop.kind == 'init') {
            return new ast.ObjProperty([prop.key.start, prop.value.end], propName, c(prop.value));
          } else if (prop.kind == 'get') {
            return new ast.ObjPropertyGet([prop.key.start, prop.value.end], propName, c(prop.value.body));
          } else if (prop.kind == 'set') {
            return new ast.ObjPropertySet([prop.key.start, prop.value.end], propName, c(prop.value.body), c(prop.value.params[0]));
          } else {
            throw new Error('Case of ObjectExpression not handled!');
          }
        });
        return new ast.ObjectLiteral([n.start, n.end], props);
      },
      ArrayExpression: function(n, c) {
        return new ast.ArrayLiteral([n.start, n.end], n.elements.map(c));
      },
      SequenceExpression: function(n, c) {
        return new ast.Sequence([n.start, n.end], n.expressions.map(c));
      },
      EmptyStatement: function(n, c) {
        return newUndefined(n.start, n.end);
      },
      ThisExpression: function(n, c) {
        return new ast.This([n.start, n.end]);
      },
      DebuggerStatement: function(n, c) {
        return new ast.Debugger([n.start, n.end]);
      },
      LabeledStatement: function(n, c) {
        return new ast.LabelDeclaration([n.start, n.end], n.label.name, c(n.body));
      }
    };
    visitors.LogicalExpression = visitors.BinaryExpression;
    function c(node) {
      return visitors[node.type](node, c);
    }
    return c(parsed);
  };
  acorn.walk.copy = function(ast, override) {
    var visitors = lang.obj.extend({
      Program: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'Program',
          body: n.body.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      FunctionDeclaration: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'FunctionDeclaration',
          id: c(n.id),
          params: n.params.map(c),
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      BlockStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'BlockStatement',
          body: n.body.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ExpressionStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ExpressionStatement',
          expression: c(n.expression),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      CallExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'CallExpression',
          callee: c(n.callee),
          arguments: n.arguments.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      MemberExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'MemberExpression',
          object: c(n.object),
          property: c(n.property),
          computed: n.computed,
          source: n.source,
          astIndex: n.astIndex
        };
      },
      NewExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'NewExpression',
          callee: c(n.callee),
          arguments: n.arguments.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      VariableDeclaration: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'VariableDeclaration',
          declarations: n.declarations.map(c),
          kind: n.kind,
          source: n.source,
          astIndex: n.astIndex
        };
      },
      VariableDeclarator: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'VariableDeclarator',
          id: c(n.id),
          init: c(n.init),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      FunctionExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'FunctionExpression',
          id: c(n.id),
          params: n.params.map(c),
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      IfStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'IfStatement',
          test: c(n.test),
          consequent: c(n.consequent),
          alternate: c(n.alternate),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ConditionalExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ConditionalExpression',
          test: c(n.test),
          consequent: c(n.consequent),
          alternate: c(n.alternate),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      SwitchStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'SwitchStatement',
          discriminant: c(n.discriminant),
          cases: n.cases.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      SwitchCase: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'SwitchCase',
          test: c(n.test),
          consequent: n.consequent.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      BreakStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'BreakStatement',
          label: n.label,
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ContinueStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ContinueStatement',
          label: n.label,
          source: n.source,
          astIndex: n.astIndex
        };
      },
      TryStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'TryStatement',
          block: c(n.block),
          handler: c(n.handler),
          finalizer: c(n.finalizer),
          guardedHandlers: n.guardedHandlers.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      CatchClause: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'CatchClause',
          param: c(n.param),
          guard: c(n.guard),
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ThrowStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ThrowStatement',
          argument: c(n.argument),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ForStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ForStatement',
          init: c(n.init),
          test: c(n.test),
          update: c(n.update),
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ForInStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ForInStatement',
          left: c(n.left),
          right: c(n.right),
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      WhileStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'WhileStatement',
          test: c(n.test),
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      DoWhileStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'DoWhileStatement',
          test: c(n.test),
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      WithStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'WithStatement',
          object: c(n.object),
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      UnaryExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'UnaryExpression',
          argument: c(n.argument),
          operator: n.operator,
          prefix: n.prefix,
          source: n.source,
          astIndex: n.astIndex
        };
      },
      BinaryExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'BinaryExpression',
          left: c(n.left),
          operator: n.operator,
          right: c(n.right),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      LogicalExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'LogicalExpression',
          left: c(n.left),
          operator: n.operator,
          right: c(n.right),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      AssignmentExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'AssignmentExpression',
          left: c(n.left),
          operator: n.operator,
          right: c(n.right),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      UpdateExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'UpdateExpression',
          argument: c(n.argument),
          operator: n.operator,
          prefix: n.prefix,
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ReturnStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ReturnStatement',
          argument: c(n.argument),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      Identifier: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'Identifier',
          name: n.name,
          source: n.source,
          astIndex: n.astIndex
        };
      },
      Literal: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'Literal',
          value: n.value,
          raw: n.raw,
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ObjectExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ObjectExpression',
          properties: n.properties.map(function(prop) {
            return {
              key: c(prop.key),
              value: c(prop.value),
              kind: prop.kind
            };
          }),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ArrayExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ArrayExpression',
          elements: n.elements.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      SequenceExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'SequenceExpression',
          expressions: n.expressions.map(c),
          source: n.source,
          astIndex: n.astIndex
        };
      },
      EmptyStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'EmptyStatement',
          source: n.source,
          astIndex: n.astIndex
        };
      },
      ThisExpression: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'ThisExpression',
          source: n.source,
          astIndex: n.astIndex
        };
      },
      DebuggerStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'DebuggerStatement',
          source: n.source,
          astIndex: n.astIndex
        };
      },
      LabeledStatement: function(n, c) {
        return {
          start: n.start,
          end: n.end,
          type: 'LabeledStatement',
          label: n.label,
          body: c(n.body),
          source: n.source,
          astIndex: n.astIndex
        };
      }
    }, override || {});
    function c(node) {
      if (node === null)
        return null;
      return visitors[node.type](node, c);
    }
    return c(ast);
  };
  acorn.walk.findSiblings = function(parsed, node, beforeOrAfter) {
    if (!node)
      return [];
    var nodes = acorn.walk.findNodesIncluding(parsed, node.start),
        idx = nodes.indexOf(node),
        parents = nodes.slice(0, idx),
        parentWithBody = lang.arr.detect(parents.reverse(), function(p) {
          return Array.isArray(p.body);
        }),
        siblingsWithNode = parentWithBody.body;
    if (!beforeOrAfter)
      return lang.arr.without(siblingsWithNode, node);
    var nodeIdxInSiblings = siblingsWithNode.indexOf(node);
    return beforeOrAfter === 'before' ? siblingsWithNode.slice(0, nodeIdxInSiblings) : siblingsWithNode.slice(nodeIdxInSiblings + 1);
  };
  acorn.walk.visitors = {
    stopAtFunctions: acorn.walk.make({'Function': function() {}}),
    withMemberExpression: acorn.walk.make({MemberExpression: function(node, st, c) {
        c(node.object, st, "Expression");
        c(node.property, st, "Expression");
      }})
  };
  ;
  (function extendAcornWalk2() {
    acorn.walk.findNodeByAstIndex = function(parsed, astIndexToFind, addIndex) {
      addIndex = addIndex == null ? true : !!addIndex;
      if (!parsed.astIndex && addIndex)
        acorn.walk.addAstIndex(parsed);
      var found = null;
      acorn.withMozillaAstDo(parsed, null, function(next, node, state) {
        if (found)
          return;
        var idx = node.astIndex;
        if (idx < astIndexToFind)
          return;
        if (node.astIndex === astIndexToFind) {
          found = node;
          return;
        }
        next();
      });
      return found;
    };
    acorn.walk.findStatementOfNode = function(options, parsed, target) {
      if (!target) {
        target = parsed;
        parsed = options;
        options = null;
      }
      if (!options)
        options = {};
      if (!parsed.astIndex)
        acorn.walk.addAstIndex(parsed);
      var found,
          targetReached = false;
      var statements = ['EmptyStatement', 'BlockStatement', 'ExpressionStatement', 'IfStatement', 'LabeledStatement', 'BreakStatement', 'ContinueStatement', 'WithStatement', 'SwitchStatement', 'ReturnStatement', 'ThrowStatement', 'TryStatement', 'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'DebuggerStatement', 'FunctionDeclaration', 'VariableDeclaration', 'ClassDeclaration'];
      acorn.withMozillaAstDo(parsed, {}, function(next, node, depth, state, path) {
        if (targetReached || node.astIndex < target.astIndex)
          return;
        if (node === target || node.astIndex === target.astIndex) {
          targetReached = true;
          if (options.asPath)
            found = path;
          else {
            var p = lang.Path(path);
            do {
              found = p.get(parsed);
              p = p.slice(0, p.size() - 1);
            } while ((statements.indexOf(found.type) == -1) && (p.size() > 0));
          }
        }
        !targetReached && next();
      });
      return found;
    };
    acorn.walk.addAstIndex = function(parsed) {
      acorn.withMozillaAstDo(parsed, {index: 0}, function(next, node, state) {
        next();
        node.astIndex = state.index++;
      });
      return parsed;
    };
  })();
  return module.exports;
});

System.registerDynamic("lively.ast/lib/mozilla-ast-visitors.js", ["lively.lang", "../index"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var lang = $__require('lively.lang');
  var ast = $__require('../index');
  exports.MozillaAST = {};
  exports.MozillaAST.BaseVisitor = lang.class.create(Object, "lively.ast.MozillaAST.BaseVisitor", "visiting", {
    accept: function(node, depth, state, path) {
      path = path || [];
      return this['visit' + node.type](node, depth, state, path);
    },
    visitProgram: function(node, depth, state, path) {
      var retVal;
      node.body.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["body", i]));
      }, this);
      return retVal;
    },
    visitFunction: function(node, depth, state, path) {
      var retVal;
      if (node.id) {
        retVal = this.accept(node.id, depth, state, path.concat(["id"]));
      }
      node.params.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["params", i]));
      }, this);
      if (node.defaults) {
        node.defaults.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
        }, this);
      }
      if (node.rest) {
        retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
      }
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      if (node.generator) {}
      if (node.expression) {}
      return retVal;
    },
    visitStatement: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitEmptyStatement: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitBlockStatement: function(node, depth, state, path) {
      var retVal;
      node.body.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["body", i]));
      }, this);
      return retVal;
    },
    visitExpressionStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.expression, depth, state, path.concat(["expression"]));
      return retVal;
    },
    visitIfStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.test, depth, state, path.concat(["test"]));
      retVal = this.accept(node.consequent, depth, state, path.concat(["consequent"]));
      if (node.alternate) {
        retVal = this.accept(node.alternate, depth, state, path.concat(["alternate"]));
      }
      return retVal;
    },
    visitLabeledStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.label, depth, state, path.concat(["label"]));
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitBreakStatement: function(node, depth, state, path) {
      var retVal;
      if (node.label) {
        retVal = this.accept(node.label, depth, state, path.concat(["label"]));
      }
      return retVal;
    },
    visitContinueStatement: function(node, depth, state, path) {
      var retVal;
      if (node.label) {
        retVal = this.accept(node.label, depth, state, path.concat(["label"]));
      }
      return retVal;
    },
    visitWithStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.object, depth, state, path.concat(["object"]));
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitSwitchStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.discriminant, depth, state, path.concat(["discriminant"]));
      node.cases.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["cases", i]));
      }, this);
      if (node.lexical) {}
      return retVal;
    },
    visitReturnStatement: function(node, depth, state, path) {
      var retVal;
      if (node.argument) {
        retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
      }
      return retVal;
    },
    visitThrowStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
      return retVal;
    },
    visitTryStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.block, depth, state, path.concat(["block"]));
      if (node.handler) {
        retVal = this.accept(node.handler, depth, state, path.concat(["handler"]));
      }
      if (node.guardedHandlers) {
        node.guardedHandlers.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, state, path.concat(["guardedHandlers", i]));
        }, this);
      }
      if (node.finalizer) {
        retVal = this.accept(node.finalizer, depth, state, path.concat(["finalizer"]));
      }
      return retVal;
    },
    visitWhileStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.test, depth, state, path.concat(["test"]));
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitDoWhileStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      retVal = this.accept(node.test, depth, state, path.concat(["test"]));
      return retVal;
    },
    visitForStatement: function(node, depth, state, path) {
      var retVal;
      if (node.init) {
        retVal = this.accept(node.init, depth, state, path.concat(["init"]));
      }
      if (node.test) {
        retVal = this.accept(node.test, depth, state, path.concat(["test"]));
      }
      if (node.update) {
        retVal = this.accept(node.update, depth, state, path.concat(["update"]));
      }
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitForInStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.left, depth, state, path.concat(["left"]));
      retVal = this.accept(node.right, depth, state, path.concat(["right"]));
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      if (node.each) {}
      return retVal;
    },
    visitForOfStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.left, depth, state, path.concat(["left"]));
      retVal = this.accept(node.right, depth, state, path.concat(["right"]));
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitLetStatement: function(node, depth, state, path) {
      var retVal;
      node.head.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["head", i]));
      }, this);
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitDebuggerStatement: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitDeclaration: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitFunctionDeclaration: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.id, depth, state, path.concat(["id"]));
      node.params.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["params", i]));
      }, this);
      if (node.defaults) {
        node.defaults.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
        }, this);
      }
      if (node.rest) {
        retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
      }
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      if (node.generator) {}
      if (node.expression) {}
      return retVal;
    },
    visitVariableDeclaration: function(node, depth, state, path) {
      var retVal;
      node.declarations.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["declarations", i]));
      }, this);
      return retVal;
    },
    visitVariableDeclarator: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.id, depth, state, path.concat(["id"]));
      if (node.init) {
        retVal = this.accept(node.init, depth, state, path.concat(["init"]));
      }
      return retVal;
    },
    visitExpression: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitThisExpression: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitArrayExpression: function(node, depth, state, path) {
      var retVal;
      node.elements.forEach(function(ea, i) {
        if (ea) {
          retVal = this.accept(ea, depth, state, path.concat(["elements", i]));
        }
      }, this);
      return retVal;
    },
    visitObjectExpression: function(node, depth, state, path) {
      var retVal;
      node.properties.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["properties", i]));
      }, this);
      return retVal;
    },
    visitProperty: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.key, depth, state, path.concat(["key"]));
      retVal = this.accept(node.value, depth, state, path.concat(["value"]));
      return retVal;
    },
    visitFunctionExpression: function(node, depth, state, path) {
      var retVal;
      if (node.id) {
        retVal = this.accept(node.id, depth, state, path.concat(["id"]));
      }
      node.params.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["params", i]));
      }, this);
      if (node.defaults) {
        node.defaults.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
        }, this);
      }
      if (node.rest) {
        retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
      }
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      if (node.generator) {}
      if (node.expression) {}
      return retVal;
    },
    visitArrowExpression: function(node, depth, state, path) {
      var retVal;
      node.params.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["params", i]));
      }, this);
      if (node.defaults) {
        node.defaults.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
        }, this);
      }
      if (node.rest) {
        retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
      }
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      if (node.generator) {}
      if (node.expression) {}
      return retVal;
    },
    visitArrowFunctionExpression: function(node, depth, state, path) {
      var retVal;
      node.params.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["params", i]));
      }, this);
      if (node.defaults) {
        node.defaults.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
        }, this);
      }
      if (node.rest) {
        retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
      }
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      if (node.generator) {}
      if (node.expression) {}
      return retVal;
    },
    visitSequenceExpression: function(node, depth, state, path) {
      var retVal;
      node.expressions.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["expressions", i]));
      }, this);
      return retVal;
    },
    visitUnaryExpression: function(node, depth, state, path) {
      var retVal;
      if (node.prefix) {}
      retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
      return retVal;
    },
    visitBinaryExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.left, depth, state, path.concat(["left"]));
      retVal = this.accept(node.right, depth, state, path.concat(["right"]));
      return retVal;
    },
    visitAssignmentExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.left, depth, state, path.concat(["left"]));
      retVal = this.accept(node.right, depth, state, path.concat(["right"]));
      return retVal;
    },
    visitUpdateExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
      if (node.prefix) {}
      return retVal;
    },
    visitLogicalExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.left, depth, state, path.concat(["left"]));
      retVal = this.accept(node.right, depth, state, path.concat(["right"]));
      return retVal;
    },
    visitConditionalExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.test, depth, state, path.concat(["test"]));
      retVal = this.accept(node.alternate, depth, state, path.concat(["alternate"]));
      retVal = this.accept(node.consequent, depth, state, path.concat(["consequent"]));
      return retVal;
    },
    visitNewExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.callee, depth, state, path.concat(["callee"]));
      node.arguments.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["arguments", i]));
      }, this);
      return retVal;
    },
    visitCallExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.callee, depth, state, path.concat(["callee"]));
      node.arguments.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["arguments", i]));
      }, this);
      return retVal;
    },
    visitMemberExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.object, depth, state, path.concat(["object"]));
      retVal = this.accept(node.property, depth, state, path.concat(["property"]));
      if (node.computed) {}
      return retVal;
    },
    visitYieldExpression: function(node, depth, state, path) {
      var retVal;
      if (node.argument) {
        retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
      }
      return retVal;
    },
    visitComprehensionExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      node.blocks.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["blocks", i]));
      }, this);
      if (node.filter) {
        retVal = this.accept(node.filter, depth, state, path.concat(["filter"]));
      }
      return retVal;
    },
    visitGeneratorExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      node.blocks.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["blocks", i]));
      }, this);
      if (node.filter) {
        retVal = this.accept(node.filter, depth, state, path.concat(["filter"]));
      }
      return retVal;
    },
    visitLetExpression: function(node, depth, state, path) {
      var retVal;
      node.head.forEach(function(ea, i) {
        if (ea) {
          retVal = this.accept(ea, depth, state, path.concat(["head", i]));
        }
      }, this);
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitPattern: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitObjectPattern: function(node, depth, state, path) {
      var retVal;
      node.properties.forEach(function(ea, i) {
        retVal = this.accept(ea.key, depth, state, path.concat(["properties", i, "key"]));
        retVal = this.accept(ea.value, depth, state, path.concat(["properties", i, "value"]));
      }, this);
      return retVal;
    },
    visitArrayPattern: function(node, depth, state, path) {
      var retVal;
      node.elements.forEach(function(ea, i) {
        if (ea) {
          retVal = this.accept(ea, depth, state, path.concat(["elements", i]));
        }
      }, this);
      return retVal;
    },
    visitRestElement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
      return retVal;
    },
    visitSwitchCase: function(node, depth, state, path) {
      var retVal;
      if (node.test) {
        retVal = this.accept(node.test, depth, state, path.concat(["test"]));
      }
      node.consequent.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["consequent", i]));
      }, this);
      return retVal;
    },
    visitCatchClause: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.param, depth, state, path.concat(["param"]));
      if (node.guard) {
        retVal = this.accept(node.guard, depth, state, path.concat(["guard"]));
      }
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitComprehensionBlock: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.left, depth, state, path.concat(["left"]));
      retVal = this.accept(node.right, depth, state, path.concat(["right"]));
      if (node.each) {}
      return retVal;
    },
    visitComprehensionIf: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.test, depth, state, path.concat(["test"]));
      return retVal;
    },
    visitIdentifier: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitLiteral: function(node, depth, state, path) {
      var retVal;
      if (node.value) {}
      return retVal;
    },
    visitClassDeclaration: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.id, depth, state, path.concat(["id"]));
      if (node.superClass) {
        retVal = this.accept(node.superClass, depth, state, path.concat(["superClass"]));
      }
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitClassExpression: function(node, depth, scope, path) {
      scope.classDecls.push(node);
      var retVal;
      if (node.superClass) {
        this.accept(node.superClass, depth, scope, path.concat(["superClass"]));
      }
      retVal = this.accept(node.body, depth, scope, path.concat(["body"]));
      return retVal;
    },
    visitClassBody: function(node, depth, state, path) {
      var retVal;
      node.body.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["body", i]));
      }, this);
      return retVal;
    },
    visitMethodDefinition: function(node, depth, state, path) {
      var retVal;
      if (node.static) {}
      if (node.computed) {}
      retVal = this.accept(node.key, depth, state, path.concat(["key"]));
      retVal = this.accept(node.value, depth, state, path.concat(["value"]));
      return retVal;
    },
    visitImportDeclaration: function(node, depth, state, path) {
      var retVal;
      node.specifiers.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["specifiers", i]));
      }, this);
      if (node.source)
        retVal = this.accept(node.source, depth, state, path.concat(["source"]));
      return retVal;
    },
    visitImportSpecifier: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.local, depth, state, path.concat(["local"]));
      retVal = this.accept(node.imported, depth, state, path.concat(["imported"]));
      var retVal;
    },
    visitImportDefaultSpecifier: function(node, depth, state, path) {
      return this.accept(node.local, depth, state, path.concat(["local"]));
    },
    visitImportNamespaceSpecifier: function(node, depth, state, path) {
      return this.accept(node.local, depth, state, path.concat(["local"]));
    },
    visitExportNamedDeclaration: function(node, depth, state, path) {
      var retVal;
      if (node.declaration)
        retVal = this.accept(node.declaration, depth, state, path.concat(["declaration"]));
      node.specifiers.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["specifiers", i]));
      }, this);
      if (node.source)
        retVal = this.accept(node.source, depth, state, path.concat(["source"]));
      return retVal;
    },
    visitExportDefaultDeclaration: function(node, depth, state, path) {
      return this.accept(node.declaration, depth, state, path.concat(["declaration"]));
    },
    visitExportAllDeclaration: function(node, depth, state, path) {
      return this.accept(node.source, depth, state, path.concat(["source"]));
    },
    visitExportSpecifier: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.local, depth, state, path.concat(["local"]));
      retVal = this.accept(node.exported, depth, state, path.concat(["exported"]));
      var retVal;
    },
    visitJSXIdentifier: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitJSXMemberExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.object, depth, state, path.concat(["object"]));
      retVal = this.accept(node.property, depth, state, path.concat(["property"]));
      return retVal;
    },
    visitJSXNamespacedName: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.namespace, depth, state, path.concat(["namespace"]));
      retVal = this.accept(node.name, depth, state, path.concat(["name"]));
      return retVal;
    },
    visitJSXEmptyExpression: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitJSXBoundaryElement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.name, depth, state, path.concat(["name"]));
      return retVal;
    },
    visitJSXOpeningElement: function(node, depth, state, path) {
      var retVal;
      node.attributes.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["attributes", i]));
      }, this);
      if (node.selfClosing) {}
      return retVal;
    },
    visitJSXClosingElement: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitJSXAttribute: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.name, depth, state, path.concat(["name"]));
      if (node.value) {
        retVal = this.accept(node.value, depth, state, path.concat(["value"]));
      }
      return retVal;
    },
    visitSpreadElement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
      return retVal;
    },
    visitJSXSpreadAttribute: function(node, depth, state, path) {
      var retVal;
      return retVal;
    },
    visitJSXElement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.openingElement, depth, state, path.concat(["openingElement"]));
      node.children.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["children", i]));
      }, this);
      if (node.closingElement) {
        retVal = this.accept(node.closingElement, depth, state, path.concat(["closingElement"]));
      }
      return retVal;
    },
    visitTemplateLiteral: function(node, depth, state, path) {
      var retVal;
      node.quasis.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["quasis", i]));
      }, this);
      node.expressions.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, state, path.concat(["expressions", i]));
      }, this);
      return retVal;
    },
    visitTaggedTemplateExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.tag, depth, state, path.concat(["tag"]));
      retVal = this.accept(node.quasi, depth, state, path.concat(["quasi"]));
      return retVal;
    },
    visitTemplateElement: function(node, depth, state, path) {}
  });
  exports.MozillaAST.PrinterVisitor = lang.class.create(exports.MozillaAST.BaseVisitor, 'lively.ast.PrinterVisitor', {accept: function($super, node, state, tree, path) {
      var pathString = path.map(function(ea) {
        return typeof ea === 'string' ? '.' + ea : '[' + ea + ']';
      }).join('');
      var myChildren = [];
      $super(node, state, myChildren, path);
      tree.push({
        node: node,
        path: pathString,
        index: state.index++,
        children: myChildren
      });
    }});
  exports.MozillaAST.ComparisonVisitor = lang.class.create(exports.MozillaAST.BaseVisitor, "lively.ast.ComparisonVisitor", "comparison", {
    recordNotEqual: function(node1, node2, state, msg) {
      state.comparisons.errors.push({
        node1: node1,
        node2: node2,
        path: state.completePath,
        msg: msg
      });
    },
    compareType: function(node1, node2, state) {
      return this.compareField('type', node1, node2, state);
    },
    compareField: function(field, node1, node2, state) {
      node2 = lively.PropertyPath(state.completePath.join('.')).get(node2);
      if (node1 && node2 && node1[field] === node2[field])
        return true;
      if ((node1 && node1[field] === '*') || (node2 && node2[field] === '*'))
        return true;
      var fullPath = state.completePath.join('.') + '.' + field,
          msg;
      if (!node1)
        msg = "node1 on " + fullPath + " not defined";
      else if (!node2)
        msg = 'node2 not defined but node1 (' + fullPath + ') is: ' + node1[field];
      else
        msg = fullPath + ' is not equal: ' + node1[field] + ' vs. ' + node2[field];
      this.recordNotEqual(node1, node2, state, msg);
      return false;
    }
  }, "visiting", {
    accept: function(node1, node2, state, path) {
      var patternNode = lively.PropertyPath(path.join('.')).get(node2);
      if (node1 === '*' || patternNode === '*')
        return;
      var nextState = {
        completePath: path,
        comparisons: state.comparisons
      };
      if (this.compareType(node1, node2, nextState))
        this['visit' + node1.type](node1, node2, nextState, path);
    },
    visitFunction: function($super, node1, node2, state, path) {
      if (node1.generator) {
        this.compareField("generator", node1, node2, state);
      }
      if (node1.expression) {
        this.compareField("expression", node1, node2, state);
      }
      $super(node1, node2, state, path);
    },
    visitSwitchStatement: function($super, node1, node2, state, path) {
      if (node1.lexical) {
        this.compareField("lexical", node1, node2, state);
      }
      $super(node1, node2, state, path);
    },
    visitForInStatement: function($super, node1, node2, state, path) {
      if (node1.each) {
        this.compareField("each", node1, node2, state);
      }
      $super(node1, node2, state, path);
    },
    visitFunctionDeclaration: function($super, node1, node2, state, path) {
      if (node1.generator) {
        this.compareField("generator", node1, node2, state);
      }
      if (node1.expression) {
        this.compareField("expression", node1, node2, state);
      }
      $super(node1, node2, state, path);
    },
    visitVariableDeclaration: function($super, node1, node2, state, path) {
      this.compareField("kind", node1, node2, state);
      $super(node1, node2, state, path);
    },
    visitUnaryExpression: function($super, node1, node2, state, path) {
      this.compareField("operator", node1, node2, state);
      if (node1.prefix) {
        this.compareField("prefix", node1, node2, state);
      }
      $super(node1, node2, state, path);
    },
    visitBinaryExpression: function($super, node1, node2, state, path) {
      this.compareField("operator", node1, node2, state);
      $super(node1, node2, state, path);
    },
    visitAssignmentExpression: function($super, node1, node2, state, path) {
      this.compareField("operator", node1, node2, state);
      $super(node1, node2, state, path);
    },
    visitUpdateExpression: function($super, node1, node2, state, path) {
      this.compareField("operator", node1, node2, state);
      if (node1.prefix) {
        this.compareField("prefix", node1, node2, state);
      }
      $super(node1, node2, state, path);
    },
    visitLogicalExpression: function($super, node1, node2, state, path) {
      this.compareField("operator", node1, node2, state);
      $super(node1, node2, state, path);
    },
    visitMemberExpression: function($super, node1, node2, state, path) {
      if (node1.computed) {
        this.compareField("computed", node1, node2, state);
      }
      $super(node1, node2, state, path);
    },
    visitComprehensionBlock: function($super, node1, node2, state, path) {
      if (node1.each) {
        this.compareField("each", node1, node2, state);
      }
      $super(node1, node2, state, path);
    },
    visitIdentifier: function($super, node1, node2, state, path) {
      this.compareField("name", node1, node2, state);
      $super(node1, node2, state, path);
    },
    visitLiteral: function($super, node1, node2, state, path) {
      this.compareField("value", node1, node2, state);
      $super(node1, node2, state, path);
    },
    visitClassDeclaration: function($super, node1, node2, state, path) {
      this.compareField("id", node1, node2, state);
      if (node1.superClass) {
        this.compareField("superClass", node1, node2, state);
      }
      this.compareField("body", node1, node2, state);
      $super(node1, node2, state, path);
    },
    visitClassBody: function($super, node1, node2, state, path) {
      this.compareField("body", node1, node2, state);
      $super(node1, node2, state, path);
    },
    visitMethodDefinition: function($super, node1, node2, state, path) {
      this.compareField("static", node1, node2, state);
      this.compareField("computed", node1, node2, state);
      this.compareField("kind", node1, node2, state);
      this.compareField("key", node1, node2, state);
      this.compareField("value", node1, node2, state);
      $super(node1, node2, state, path);
    }
  });
  exports.MozillaAST.ScopeVisitor = lang.class.create(exports.MozillaAST.BaseVisitor, "lively.ast.ScopeVisitor", 'scope specific', {newScope: function(scopeNode, parentScope) {
      var scope = {
        node: scopeNode,
        varDecls: [],
        varDeclPaths: [],
        funcDecls: [],
        classDecls: [],
        methodDecls: [],
        importDecls: [],
        exportDecls: [],
        refs: [],
        params: [],
        catches: [],
        subScopes: []
      };
      if (parentScope)
        parentScope.subScopes.push(scope);
      return scope;
    }}, 'visiting', {
    accept: function(node, depth, scope, path) {
      path = path || [];
      if (!this['visit' + node.type])
        throw new Error("No AST visit handler for type " + node.type);
      return this['visit' + node.type](node, depth, scope, path);
    },
    visitVariableDeclaration: function($super, node, depth, scope, path) {
      scope.varDecls.push(node);
      scope.varDeclPaths.push(path);
      return $super(node, depth, scope, path);
    },
    visitVariableDeclarator: function(node, depth, scope, path) {
      var retVal;
      if (node.init) {
        retVal = this.accept(node.init, depth, scope, path.concat(["init"]));
      }
      return retVal;
    },
    visitFunction: function(node, depth, scope, path) {
      var newScope = this.newScope(node, scope);
      newScope.params = Array.prototype.slice.call(node.params);
      return newScope;
    },
    visitFunctionDeclaration: function($super, node, depth, scope, path) {
      scope.funcDecls.push(node);
      var newScope = this.visitFunction(node, depth, scope, path);
      var retVal;
      if (node.defaults) {
        node.defaults.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, newScope, path.concat(["defaults", i]));
        }, this);
      }
      if (node.rest) {
        retVal = this.accept(node.rest, depth, newScope, path.concat(["rest"]));
      }
      retVal = this.accept(node.body, depth, newScope, path.concat(["body"]));
      return retVal;
    },
    visitFunctionExpression: function($super, node, depth, scope, path) {
      var newScope = this.visitFunction(node, depth, scope, path);
      var retVal;
      if (node.defaults) {
        node.defaults.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, newScope, path.concat(["defaults", i]));
        }, this);
      }
      if (node.rest) {
        retVal = this.accept(node.rest, depth, newScope, path.concat(["rest"]));
      }
      retVal = this.accept(node.body, depth, newScope, path.concat(["body"]));
      return retVal;
    },
    visitArrowFunctionExpression: function($super, node, depth, scope, path) {
      var newScope = this.visitFunction(node, depth, scope, path);
      var retVal;
      if (node.defaults) {
        node.defaults.forEach(function(ea, i) {
          retVal = this.accept(ea, depth, newScope, path.concat(["defaults", i]));
        }, this);
      }
      if (node.rest) {
        retVal = this.accept(node.rest, depth, newScope, path.concat(["rest"]));
      }
      retVal = this.accept(node.body, depth, newScope, path.concat(["body"]));
      if (node.generator) {}
      if (node.expression) {}
      return retVal;
    },
    visitIdentifier: function($super, node, depth, scope, path) {
      scope.refs.push(node);
      return $super(node, depth, scope, path);
    },
    visitMemberExpression: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.object, depth, state, path.concat(["object"]));
      if (node.computed) {
        retVal = this.accept(node.property, depth, state, path.concat(["property"]));
      }
      return retVal;
    },
    visitProperty: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.value, depth, state, path.concat(["value"]));
      return retVal;
    },
    visitTryStatement: function(node, depth, scope, path) {
      var retVal;
      retVal = this.accept(node.block, depth, scope, path.concat(["block"]));
      if (node.handler) {
        retVal = this.accept(node.handler, depth, scope, path.concat(["handler"]));
        scope.catches.push(node.handler.param);
      }
      node.guardedHandlers && node.guardedHandlers.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, scope, path.concat(["guardedHandlers", i]));
      }, this);
      if (node.finalizer) {
        retVal = this.accept(node.finalizer, depth, scope, path.concat(["finalizer"]));
      }
      return retVal;
    },
    visitLabeledStatement: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.body, depth, state, path.concat(["body"]));
      return retVal;
    },
    visitClassDeclaration: function(node, depth, scope, path) {
      scope.classDecls.push(node);
      var retVal;
      if (node.superClass) {
        this.accept(node.superClass, depth, scope, path.concat(["superClass"]));
      }
      retVal = this.accept(node.body, depth, scope, path.concat(["body"]));
      return retVal;
    },
    visitMethodDefinition: function(node, depth, scope, path) {
      var retVal;
      retVal = this.accept(node.value, depth, scope, path.concat(["value"]));
      return retVal;
    },
    visitBreakStatement: function(node, depth, scope, path) {
      return null;
    },
    visitContinueStatement: function(node, depth, scope, path) {
      return null;
    },
    visitImportSpecifier: function(node, depth, scope, path) {
      scope.importDecls.push(node.local);
      var retVal;
      retVal = this.accept(node.imported, depth, scope, path.concat(["imported"]));
      var retVal;
    },
    visitImportDefaultSpecifier: function(node, depth, scope, path) {
      scope.importDecls.push(node.local);
      return undefined;
    },
    visitImportNamespaceSpecifier: function(node, depth, scope, path) {
      scope.importDecls.push(node.local);
      return undefined;
    },
    visitExportSpecifier: function(node, depth, state, path) {
      var retVal;
      retVal = this.accept(node.local, depth, state, path.concat(["local"]));
      var retVal;
    },
    visitExportNamedDeclaration: function($super, node, depth, scope, path) {
      scope.exportDecls.push(node);
      return $super(node, depth, scope, path);
    },
    visitExportDefaultDeclaration: function($super, node, depth, scope, path) {
      scope.exportDecls.push(node);
      return $super(node, depth, scope, path);
    },
    visitExportAllDeclaration: function($super, node, depth, scope, path) {
      scope.exportDecls.push(node);
      return $super(node, depth, scope, path);
    }
  });
  return module.exports;
});

System.registerDynamic("lively.ast/lib/mozilla-ast-visitor-interface.js", ["lively.lang", "../index"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var lang = $__require('lively.lang');
  var ast = $__require('../index');
  var methods = {
    withMozillaAstDo: function(parsed, state, func) {
      var vis = new ast.MozillaAST.BaseVisitor(),
          origAccept = vis.accept;
      vis.accept = function(node, depth, st, path) {
        var next = function() {
          origAccept.call(vis, node, depth, st, path);
        };
        return func(next, node, st, depth, path);
      };
      return vis.accept(parsed, 0, state, []);
    },
    printAst: function(astOrSource, options) {
      options = options || {};
      var printSource = options.printSource || false,
          printPositions = options.printPositions || false,
          printIndex = options.printIndex || false,
          source,
          parsed,
          tree = [];
      if (typeof astOrSource === "string") {
        source = astOrSource;
        parsed = ast.acorn.parse(astOrSource);
      } else {
        parsed = astOrSource;
        source = options.source || parsed.source;
      }
      if (printSource && !parsed.source) {
        if (!source) {
          source = ast.escodegen.generate(parsed);
          parsed = ast.acorn.parse(source);
        }
        ast.acorn.walk.addSource(parsed, source);
      }
      function printFunc(ea) {
        var string = ea.path + ':' + ea.node.type,
            additional = [];
        if (printIndex) {
          additional.push(ea.index);
        }
        if (printPositions) {
          additional.push(ea.node.start + '-' + ea.node.end);
        }
        if (printSource) {
          var src = ea.node.source || source.slice(ea.node.start, ea.node.end),
              printed = lang.string.print.print(src.truncate(60).replace(/\n/g, '').replace(/\s+/g, ' '));
          additional.push(printed);
        }
        if (additional.length) {
          string += '(' + additional.join(',') + ')';
        }
        return string;
      }
      new ast.MozillaAST.PrinterVisitor().accept(parsed, {index: 0}, tree, []);
      return lang.string.printTree(tree[0], printFunc, function(ea) {
        return ea.children;
      }, '  ');
    },
    compareAst: function(node1, node2) {
      if (!node1 || !node2)
        throw new Error('node' + (node1 ? '1' : '2') + ' not defined');
      var state = {
        completePath: [],
        comparisons: {errors: []}
      };
      new ast.ComparisonVisitor().accept(node1, node2, state, []);
      return !state.comparisons.errors.length ? null : state.comparisons.errors.pluck('msg');
    },
    pathToNode: function(parsed, index, options) {
      options = options || {};
      if (!parsed.astIndex)
        ast.acorn.walk.addAstIndex(parsed);
      var vis = new ast.MozillaAST.BaseVisitor(),
          found = null;
      (vis.accept = function(node, pathToHere, state, path) {
        if (found)
          return;
        var fullPath = pathToHere.concat(path);
        if (node.astIndex === index) {
          var pathString = fullPath.map(function(ea) {
            return typeof ea === 'string' ? '.' + ea : '[' + ea + ']';
          }).join('');
          found = {
            pathString: pathString,
            path: fullPath,
            node: node
          };
        }
        return this['visit' + node.type](node, fullPath, state, path);
      }).call(vis, parsed, [], {}, []);
      return found;
    },
    rematchAstWithSource: function(parsed, source, addLocations, subTreePath) {
      addLocations = !!addLocations;
      var parsed2 = ast.parse(source, addLocations ? {locations: true} : undefined),
          visitor = new ast.MozillaAST.BaseVisitor();
      if (subTreePath)
        parsed2 = lang.Path(subTreePath).get(parsed2);
      visitor.accept = function(node, depth, state, path) {
        path = path || [];
        var node2 = path.reduce(function(node, pathElem) {
          return node[pathElem];
        }, parsed);
        node2.start = node.start;
        node2.end = node.end;
        if (addLocations)
          node2.loc = node.loc;
        return this['visit' + node.type](node, depth, state, path);
      };
      visitor.accept(parsed2);
    },
    stringify: function(parsed, options) {
      return ast.escodegen.generate(parsed, options);
    }
  };
  lang.obj.extend(ast, methods);
  lang.obj.extend(ast.acorn, methods);
  return module.exports;
});

System.registerDynamic("lively.ast/lib/query.js", ["lively.lang", "../index"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var lang = $__require('lively.lang');
  var arr = lang.arr,
      chain = lang.chain;
  var ast = $__require('../index');
  var acorn = ast.acorn;
  var helpers = {
    declIds: function(nodes) {
      return arr.flatmap(nodes, function(ea) {
        if (!ea)
          return [];
        if (ea.type === "Identifier")
          return [ea];
        if (ea.type === "RestElement")
          return [ea.argument];
        if (ea.type === "ObjectPattern")
          return helpers.declIds(arr.pluck(ea.properties, "value"));
        if (ea.type === "ArrayPattern")
          return helpers.declIds(ea.elements);
        return [];
      });
    },
    varDeclIds: function(scope) {
      return helpers.declIds(chain(scope.varDecls).pluck('declarations').flatten().pluck('id').value());
    },
    objPropertiesAsList: function objPropertiesAsList(objExpr, path, onlyLeafs) {
      return arr.flatmap(objExpr.properties, function(prop) {
        var key = prop.key.name;
        var result = [];
        var thisNode = {
          key: path.concat([key]),
          value: prop.value
        };
        switch (prop.value.type) {
          case "ArrayExpression":
          case "ArrayPattern":
            if (!onlyLeafs)
              result.push(thisNode);
            result = result.concat(arr.flatmap(prop.value.elements, function(el, i) {
              return objPropertiesAsList(el, path.concat([key, i]), onlyLeafs);
            }));
            break;
          case "ObjectExpression":
          case "ObjectPattern":
            if (!onlyLeafs)
              result.push(thisNode);
            result = result.concat(objPropertiesAsList(prop.value, path.concat([key]), onlyLeafs));
            break;
          default:
            result.push(thisNode);
        }
        return result;
      });
    }
  };
  exports.query = {
    helpers: helpers,
    knownGlobals: ["true", "false", "null", "undefined", "arguments", "Object", "Function", "String", "Array", "Date", "Boolean", "Number", "RegExp", "Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError", "Math", "NaN", "Infinity", "Intl", "JSON", "Promise", "parseFloat", "parseInt", "isNaN", "isFinite", "eval", "alert", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "navigator", "window", "document", "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "Node", "HTMLCanvasElement", "Image", "Class", "Global", "Functions", "Objects", "Strings", "module", "lively", "pt", "rect", "rgb", "$super", "$morph", "$world", "show"],
    scopes: function(parsed) {
      var vis = new ast.MozillaAST.ScopeVisitor();
      var scope = vis.newScope(parsed, null);
      vis.accept(parsed, 0, scope, []);
      return scope;
    },
    nodesAtIndex: function(parsed, index) {
      return acorn.withMozillaAstDo(parsed, [], function(next, node, found) {
        if (node.start <= index && index <= node.end) {
          found.push(node);
          next();
        }
        return found;
      });
    },
    scopesAtIndex: function(parsed, index) {
      return lang.tree.filter(ast.query.scopes(parsed), function(scope) {
        var n = scope.node;
        var start = n.start,
            end = n.end;
        if (n.type === 'FunctionDeclaration') {
          start = n.params.length ? n.params[0].start : n.body.start;
          end = n.body.end;
        }
        return start <= index && index <= end;
      }, function(s) {
        return s.subScopes;
      });
    },
    scopeAtIndex: function(parsed, index) {
      return arr.last(ast.query.scopesAtIndex(parsed, index));
    },
    scopesAtPos: function(pos, parsed) {
      return acorn.nodesAt(pos, parsed).filter(function(node) {
        return node.type === 'Program' || node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression';
      });
    },
    nodesInScopeOf: function(node) {
      return acorn.withMozillaAstDo(node, {
        root: node,
        result: []
      }, function(next, node, state) {
        state.result.push(node);
        if (node !== state.root && (node.type === 'Program' || node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'))
          return state;
        next();
        return state;
      }).result;
    },
    _declaredVarNames: function(scope, useComments) {
      return (scope.node.id && scope.node.id.name ? [scope.node.id && scope.node.id.name] : []).concat(chain(scope.funcDecls).pluck('id').pluck('name').compact().value()).concat(arr.pluck(helpers.declIds(scope.params), 'name')).concat(arr.pluck(scope.catches, 'name')).concat(arr.pluck(helpers.varDeclIds(scope), 'name')).concat(chain(scope.classDecls).pluck('id').pluck('name').value()).concat(arr.pluck(scope.importDecls, 'name')).concat(!useComments ? [] : ast.query._findJsLintGlobalDeclarations(scope.node.type === 'Program' ? scope.node : scope.node.body));
    },
    _findJsLintGlobalDeclarations: function(node) {
      if (!node || !node.comments)
        return [];
      return arr.flatten(node.comments.filter(function(ea) {
        return ea.text.trim().match(/^global/);
      }).map(function(ea) {
        return arr.invoke(ea.text.replace(/^\s*global\s*/, '').split(','), 'trim');
      }));
    },
    topLevelDeclsAndRefs: function(parsed, options) {
      options = options || {};
      options.withComments = true;
      if (typeof parsed === "string")
        parsed = ast.parse(parsed, options);
      var q = ast.query,
          scope = ast.query.scopes(parsed),
          useComments = !!options.jslintGlobalComment,
          declared = q._declaredVarNames(scope, useComments),
          refs = scope.refs.concat(arr.flatten(scope.subScopes.map(findUndeclaredReferences))),
          undeclared = chain(refs).pluck('name').withoutAll(declared).value();
      return {
        scope: scope,
        varDecls: scope.varDecls,
        funcDecls: scope.funcDecls,
        declaredNames: declared,
        undeclaredNames: undeclared,
        refs: refs
      };
      function findUndeclaredReferences(scope) {
        var names = q._declaredVarNames(scope, useComments);
        return scope.subScopes.map(findUndeclaredReferences).reduce(function(refs, ea) {
          return refs.concat(ea);
        }, scope.refs).filter(function(ref) {
          return names.indexOf(ref.name) === -1;
        });
      }
    },
    findGlobalVarRefs: function(parsed, options) {
      var q = ast.query,
          topLevel = q.topLevelDeclsAndRefs(parsed, options),
          noGlobals = topLevel.declaredNames.concat(q.knownGlobals);
      return topLevel.refs.filter(function(ea) {
        return noGlobals.indexOf(ea.name) === -1;
      });
    },
    findNodesIncludingLines: function(parsed, code, lines, options) {
      if (!code && !parsed)
        throw new Error("Need at least ast or code");
      code = code ? code : ast.acorn.stringify(parsed);
      parsed = parsed && parsed.loc ? parsed : ast.parse(code, {locations: true});
      return acorn.withMozillaAstDo(parsed, [], function(next, node, found) {
        if (lines.every(function(line) {
          return lang.num.between(line, node.loc.start.line, node.loc.end.line);
        })) {
          arr.pushIfNotIncluded(found, node);
          next();
        }
        return found;
      });
    },
    findReferencesAndDeclsInScope: function(scope, name) {
      return arr.flatten(lang.tree.map(scope, function(scope) {
        return scope.refs.concat(varDeclIdsOf(scope)).filter(function(ref) {
          return ref.name === name;
        });
      }, function(s) {
        return s.subScopes.filter(function(subScope) {
          return varDeclIdsOf(subScope).every(function(id) {
            return id.name !== name;
          });
        });
      }));
      function varDeclIdsOf(scope) {
        return scope.params.concat(arr.pluck(scope.funcDecls, 'id')).concat(helpers.varDeclIds(scope));
      }
    },
    findDeclarationClosestToIndex: function(parsed, name, index) {
      function varDeclIdsOf(scope) {
        return scope.params.concat(arr.pluck(scope.funcDecls, 'id')).concat(helpers.varDeclIds(scope));
      }
      var found = null;
      arr.detect(ast.query.scopesAtIndex(parsed, index).reverse(), function(scope) {
        var decls = varDeclIdsOf(scope),
            idx = arr.pluck(decls, 'name').indexOf(name);
        if (idx === -1)
          return false;
        found = decls[idx];
        return true;
      });
      return found;
    }
  };
  return module.exports;
});

System.registerDynamic("lively.ast/lib/transform.js", ["lively.lang", "../index"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var lang = $__require('lively.lang');
  var chain = lang.chain,
      arr = lang.arr,
      str = lang.string;
  var ast = $__require('../index');
  var acorn = ast.acorn;
  exports.transform = {
    helper: {
      _node2string: function(node) {
        return node.source || ast.stringify(node);
      },
      _findIndentAt: function(string, pos) {
        var bol = str.peekLeft(string, pos, /\s+$/),
            indent = typeof bol === 'number' ? string.slice(bol, pos) : '';
        if (indent[0] === '\n')
          indent = indent.slice(1);
        return indent;
      },
      _applyChanges: function(changes, source) {
        return changes.reduce(function(source, change) {
          if (change.type === 'del') {
            return source.slice(0, change.pos) + source.slice(change.pos + change.length);
          } else if (change.type === 'add') {
            return source.slice(0, change.pos) + change.string + source.slice(change.pos);
          }
          throw new Error('Uexpected change ' + Objects.inspect(change));
        }, source);
      },
      _compareNodesForReplacement: function(nodeA, nodeB) {
        if (nodeA.start === nodeB.start && nodeA.end === nodeB.end)
          return 0;
        if (nodeA.end <= nodeB.start)
          return -1;
        if (nodeA.start >= nodeB.end)
          return 1;
        if (nodeA.start <= nodeB.start && nodeA.end >= nodeB.end)
          return 1;
        if (nodeB.start <= nodeA.start && nodeB.end >= nodeA.end)
          return -1;
        throw new Error('Comparing nodes');
      },
      memberExpression: function(keys) {
        var memberExpression = keys.slice(1).reduce(function(memberExpr, key) {
          return {
            computed: typeof key !== "string",
            object: memberExpr,
            property: nodeForKey(key),
            type: "MemberExpression"
          };
        }, nodeForKey(keys[0]));
        return memberExpression;
        return {
          type: "ExpressionStatement",
          expression: memberExpression
        };
        function nodeForKey(key) {
          return typeof key === "string" ? {
            name: key,
            type: "Identifier"
          } : {
            raw: String(key),
            type: "Literal",
            value: key
          };
        }
      },
      replaceNode: function(target, replacementFunc, sourceOrChanges) {
        var sourceChanges = typeof sourceOrChanges === 'object' ? sourceOrChanges : {
          changes: [],
          source: sourceOrChanges
        },
            insideChangedBefore = false,
            pos = sourceChanges.changes.reduce(function(pos, change) {
              if (pos.end < change.pos)
                return pos;
              var isInFront = change.pos < pos.start;
              insideChangedBefore = insideChangedBefore || change.pos >= pos.start && change.pos <= pos.end;
              if (change.type === 'add')
                return {
                  start: isInFront ? pos.start + change.string.length : pos.start,
                  end: pos.end + change.string.length
                };
              if (change.type === 'del')
                return {
                  start: isInFront ? pos.start - change.length : pos.start,
                  end: pos.end - change.length
                };
              throw new Error('Cannot deal with change ' + Objects.inspect(change));
            }, {
              start: target.start,
              end: target.end
            });
        var helper = ast.transform.helper,
            source = sourceChanges.source,
            replacement = replacementFunc(target, source.slice(pos.start, pos.end), insideChangedBefore),
            replacementSource = Array.isArray(replacement) ? replacement.map(helper._node2string).join('\n' + helper._findIndentAt(source, pos.start)) : replacementSource = helper._node2string(replacement);
        var changes = [{
          type: 'del',
          pos: pos.start,
          length: pos.end - pos.start
        }, {
          type: 'add',
          pos: pos.start,
          string: replacementSource
        }];
        return {
          changes: sourceChanges.changes.concat(changes),
          source: this._applyChanges(changes, source)
        };
      },
      replaceNodes: function(targetAndReplacementFuncs, sourceOrChanges) {
        return targetAndReplacementFuncs.sort(function(a, b) {
          return ast.transform.helper._compareNodesForReplacement(a.target, b.target);
        }).reduce(function(sourceChanges, ea) {
          return ast.transform.helper.replaceNode(ea.target, ea.replacementFunc, sourceChanges);
        }, typeof sourceOrChanges === 'object' ? sourceOrChanges : {
          changes: [],
          source: sourceOrChanges
        });
      }
    },
    replace: function(astOrSource, targetNode, replacementFunc, options) {
      var parsed = typeof astOrSource === 'object' ? astOrSource : null,
          source = typeof astOrSource === 'string' ? astOrSource : (parsed.source || ast.stringify(parsed)),
          result = ast.transform.helper.replaceNode(targetNode, replacementFunc, source);
      return result;
    },
    replaceTopLevelVarDeclAndUsageForCapturing: function(astOrSource, assignToObj, options) {
      var ignoreUndeclaredExcept = (options && options.ignoreUndeclaredExcept) || null;
      var whitelist = (options && options.include) || null;
      var blacklist = (options && options.exclude) || [];
      var recordDefRanges = options && options.recordDefRanges;
      var parsed = typeof astOrSource === 'object' ? astOrSource : ast.parse(astOrSource),
          source = typeof astOrSource === 'string' ? astOrSource : (parsed.source || ast.stringify(parsed)),
          topLevel = ast.query.topLevelDeclsAndRefs(parsed);
      if (ignoreUndeclaredExcept) {
        blacklist = arr.withoutAll(topLevel.undeclaredNames, ignoreUndeclaredExcept).concat(blacklist);
      }
      var scope = topLevel.scope;
      arr.pushAll(blacklist, arr.pluck(scope.catches, "name"));
      var forLoopDecls = scope.varDecls.filter(function(decl, i) {
        var path = lang.Path(scope.varDeclPaths[i]),
            parent = path.slice(0, -1).get(parsed);
        return parent.type === "ForStatement" || parent.type === "ForInStatement";
      });
      arr.pushAll(blacklist, chain(forLoopDecls).pluck("declarations").flatten().pluck("id").pluck("name").value());
      var result = ast.transform.helper.replaceNodes(topLevel.refs.filter(shouldRefBeCaptured).map(function(ref) {
        return {
          target: ref,
          replacementFunc: function(ref) {
            return member(ref, assignToObj);
          }
        };
      }), source);
      result = ast.transform.helper.replaceNodes(arr.withoutAll(topLevel.varDecls, forLoopDecls).map(function(decl) {
        return {
          target: decl,
          replacementFunc: function(declNode, s, wasChanged) {
            if (wasChanged) {
              var scopes = ast.query.scopes(ast.parse(s, {addSource: true}));
              declNode = scopes.varDecls[0];
            }
            return declNode.declarations.map(function(ea) {
              var init = {
                operator: "||",
                type: "LogicalExpression",
                left: {
                  computed: true,
                  object: assignToObj,
                  property: {
                    type: "Literal",
                    value: ea.id.name
                  },
                  type: "MemberExpression"
                },
                right: {
                  name: "undefined",
                  type: "Identifier"
                }
              };
              return shouldDeclBeCaptured(ea) ? assign(ea.id, ea.init || init) : varDecl(ea);
            });
          }
        };
      }), result);
      if (topLevel.funcDecls.length) {
        var globalFuncs = topLevel.funcDecls.filter(shouldDeclBeCaptured).map(function(decl) {
          var funcId = {
            type: "Identifier",
            name: decl.id.name
          };
          return ast.stringify(assign(funcId, funcId));
        }).join('\n');
        var change = {
          type: 'add',
          pos: 0,
          string: globalFuncs
        };
        result = {
          source: globalFuncs + '\n' + result.source,
          changes: result.changes.concat([change])
        };
      }
      if (recordDefRanges)
        result.defRanges = chain(scope.varDecls).pluck("declarations").flatten().value().concat(scope.funcDecls).reduce(function(defs, decl) {
          if (!defs[decl.id.name])
            defs[decl.id.name] = [];
          defs[decl.id.name].push({
            type: decl.type,
            start: decl.start,
            end: decl.end
          });
          return defs;
        }, {});
      result.ast = parsed;
      return result;
      function shouldRefBeCaptured(ref) {
        return blacklist.indexOf(ref.name) === -1 && (!whitelist || whitelist.indexOf(ref.name) > -1);
      }
      function shouldDeclBeCaptured(decl) {
        return shouldRefBeCaptured(decl.id);
      }
      function assign(id, value) {
        return {
          type: "ExpressionStatement",
          expression: {
            type: "AssignmentExpression",
            operator: "=",
            right: value || {
              type: "Identifier",
              name: 'undefined'
            },
            left: {
              type: "MemberExpression",
              computed: false,
              object: assignToObj,
              property: id
            }
          }
        };
      }
      function varDecl(declarator) {
        return {
          declarations: [declarator],
          kind: "var",
          type: "VariableDeclaration"
        };
      }
      function member(prop, obj) {
        return {
          type: "MemberExpression",
          computed: false,
          object: obj,
          property: prop
        };
      }
    },
    oneDeclaratorPerVarDecl: function(astOrSource) {
      var parsed = typeof astOrSource === 'object' ? astOrSource : ast.parse(astOrSource),
          source = typeof astOrSource === 'string' ? astOrSource : (parsed.source || ast.stringify(parsed)),
          scope = ast.query.scopes(parsed),
          varDecls = (function findVarDecls(scope) {
            return arr.flatten(scope.varDecls.concat(scope.subScopes.map(findVarDecls)));
          })(scope);
      var targetsAndReplacements = varDecls.map(function(decl) {
        return {
          target: decl,
          replacementFunc: function(declNode, s, wasChanged) {
            if (wasChanged) {
              declNode = ast.parse(s).body[0];
            }
            return declNode.declarations.map(function(ea) {
              return {
                type: "VariableDeclaration",
                kind: "var",
                declarations: [ea]
              };
            });
          }
        };
      });
      return ast.transform.helper.replaceNodes(targetsAndReplacements, source);
    },
    oneDeclaratorForVarsInDestructoring: function(astOrSource) {
      var parsed = typeof astOrSource === 'object' ? astOrSource : ast.parse(astOrSource),
          source = typeof astOrSource === 'string' ? astOrSource : (parsed.source || ast.stringify(parsed)),
          scope = ast.query.scopes(parsed),
          varDecls = (function findVarDecls(scope) {
            return arr.flatten(scope.varDecls.concat(scope.subScopes.map(findVarDecls)));
          })(scope);
      var targetsAndReplacements = varDecls.map(function(decl) {
        return {
          target: decl,
          replacementFunc: function(declNode, s, wasChanged) {
            if (wasChanged) {
              declNode = ast.parse(s).body[0];
            }
            return arr.flatmap(declNode.declarations, function(declNode) {
              var extractedId = {
                type: "Identifier",
                name: "__temp"
              },
                  extractedInit = {
                    type: "VariableDeclaration",
                    kind: "var",
                    declarations: [{
                      type: "VariableDeclarator",
                      id: extractedId,
                      init: declNode.init
                    }]
                  };
              var propDecls = arr.pluck(ast.query.helpers.objPropertiesAsList(declNode.id, [], false), "key").map(function(keyPath) {
                return {
                  type: "VariableDeclaration",
                  kind: "var",
                  declarations: [{
                    type: "VariableDeclarator",
                    kind: "var",
                    id: {
                      type: "Identifier",
                      name: arr.last(keyPath)
                    },
                    init: ast.transform.helper.memberExpression([extractedId.name].concat(keyPath))
                  }]
                };
              });
              return [extractedInit].concat(propDecls);
            });
          }
        };
      });
      return ast.transform.helper.replaceNodes(targetsAndReplacements, source);
    },
    returnLastStatement: function(source, opts) {
      opts = opts || {};
      var parsed = ast.parse(source, {ecmaVersion: 6}),
          last = parsed.body.pop(),
          newLastsource = 'return ' + source.slice(last.start, last.end);
      if (!opts.asAST)
        return source.slice(0, last.start) + newLastsource;
      var newLast = ast.parse(newLastsource, {
        allowReturnOutsideFunction: true,
        ecmaVersion: 6
      }).body.slice(-1)[0];
      parsed.body.push(newLast);
      parsed.end += 'return '.length;
      return parsed;
    },
    wrapInFunction: function(code, opts) {
      opts = opts || {};
      var transformed = ast.transform.returnLastStatement(code, opts);
      return opts.asAST ? {
        type: "Program",
        body: [{
          type: "ExpressionStatement",
          expression: {
            body: {
              body: transformed.body,
              type: "BlockStatement"
            },
            params: [],
            type: "FunctionExpression"
          }
        }]
      } : "function() {\n" + transformed + "\n}";
    }
  };
  return module.exports;
});

System.registerDynamic("lively.ast/generated/estree-visitor.js", [], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  function Visitor() {}
  Visitor.prototype.accept = function accept(node, state, path) {
    if (!node)
      throw new Error("Undefined AST node in Visitor.accept:\n  " + path.join(".") + "\n  " + node);
    if (!node.type)
      throw new Error("Strangee AST node without type in Visitor.accept:\n  " + path.join(".") + "\n  " + JSON.stringify(node));
    switch (node.type) {
      case "Node":
        return this.visitNode(node, state, path);
      case "SourceLocation":
        return this.visitSourceLocation(node, state, path);
      case "Position":
        return this.visitPosition(node, state, path);
      case "Program":
        return this.visitProgram(node, state, path);
      case "Function":
        return this.visitFunction(node, state, path);
      case "Statement":
        return this.visitStatement(node, state, path);
      case "SwitchCase":
        return this.visitSwitchCase(node, state, path);
      case "CatchClause":
        return this.visitCatchClause(node, state, path);
      case "VariableDeclarator":
        return this.visitVariableDeclarator(node, state, path);
      case "Expression":
        return this.visitExpression(node, state, path);
      case "Property":
        return this.visitProperty(node, state, path);
      case "Pattern":
        return this.visitPattern(node, state, path);
      case "Super":
        return this.visitSuper(node, state, path);
      case "SpreadElement":
        return this.visitSpreadElement(node, state, path);
      case "TemplateElement":
        return this.visitTemplateElement(node, state, path);
      case "Class":
        return this.visitClass(node, state, path);
      case "ClassBody":
        return this.visitClassBody(node, state, path);
      case "MethodDefinition":
        return this.visitMethodDefinition(node, state, path);
      case "ModuleDeclaration":
        return this.visitModuleDeclaration(node, state, path);
      case "ModuleSpecifier":
        return this.visitModuleSpecifier(node, state, path);
      case "Identifier":
        return this.visitIdentifier(node, state, path);
      case "Literal":
        return this.visitLiteral(node, state, path);
      case "ExpressionStatement":
        return this.visitExpressionStatement(node, state, path);
      case "BlockStatement":
        return this.visitBlockStatement(node, state, path);
      case "EmptyStatement":
        return this.visitEmptyStatement(node, state, path);
      case "DebuggerStatement":
        return this.visitDebuggerStatement(node, state, path);
      case "WithStatement":
        return this.visitWithStatement(node, state, path);
      case "ReturnStatement":
        return this.visitReturnStatement(node, state, path);
      case "LabeledStatement":
        return this.visitLabeledStatement(node, state, path);
      case "BreakStatement":
        return this.visitBreakStatement(node, state, path);
      case "ContinueStatement":
        return this.visitContinueStatement(node, state, path);
      case "IfStatement":
        return this.visitIfStatement(node, state, path);
      case "SwitchStatement":
        return this.visitSwitchStatement(node, state, path);
      case "ThrowStatement":
        return this.visitThrowStatement(node, state, path);
      case "TryStatement":
        return this.visitTryStatement(node, state, path);
      case "WhileStatement":
        return this.visitWhileStatement(node, state, path);
      case "DoWhileStatement":
        return this.visitDoWhileStatement(node, state, path);
      case "ForStatement":
        return this.visitForStatement(node, state, path);
      case "ForInStatement":
        return this.visitForInStatement(node, state, path);
      case "Declaration":
        return this.visitDeclaration(node, state, path);
      case "ThisExpression":
        return this.visitThisExpression(node, state, path);
      case "ArrayExpression":
        return this.visitArrayExpression(node, state, path);
      case "ObjectExpression":
        return this.visitObjectExpression(node, state, path);
      case "FunctionExpression":
        return this.visitFunctionExpression(node, state, path);
      case "UnaryExpression":
        return this.visitUnaryExpression(node, state, path);
      case "UpdateExpression":
        return this.visitUpdateExpression(node, state, path);
      case "BinaryExpression":
        return this.visitBinaryExpression(node, state, path);
      case "AssignmentExpression":
        return this.visitAssignmentExpression(node, state, path);
      case "LogicalExpression":
        return this.visitLogicalExpression(node, state, path);
      case "MemberExpression":
        return this.visitMemberExpression(node, state, path);
      case "ConditionalExpression":
        return this.visitConditionalExpression(node, state, path);
      case "CallExpression":
        return this.visitCallExpression(node, state, path);
      case "SequenceExpression":
        return this.visitSequenceExpression(node, state, path);
      case "ArrowFunctionExpression":
        return this.visitArrowFunctionExpression(node, state, path);
      case "YieldExpression":
        return this.visitYieldExpression(node, state, path);
      case "TemplateLiteral":
        return this.visitTemplateLiteral(node, state, path);
      case "TaggedTemplateExpression":
        return this.visitTaggedTemplateExpression(node, state, path);
      case "AssignmentProperty":
        return this.visitAssignmentProperty(node, state, path);
      case "ArrayPattern":
        return this.visitArrayPattern(node, state, path);
      case "RestElement":
        return this.visitRestElement(node, state, path);
      case "AssignmentPattern":
        return this.visitAssignmentPattern(node, state, path);
      case "ClassExpression":
        return this.visitClassExpression(node, state, path);
      case "MetaProperty":
        return this.visitMetaProperty(node, state, path);
      case "ImportDeclaration":
        return this.visitImportDeclaration(node, state, path);
      case "ImportSpecifier":
        return this.visitImportSpecifier(node, state, path);
      case "ImportDefaultSpecifier":
        return this.visitImportDefaultSpecifier(node, state, path);
      case "ImportNamespaceSpecifier":
        return this.visitImportNamespaceSpecifier(node, state, path);
      case "ExportNamedDeclaration":
        return this.visitExportNamedDeclaration(node, state, path);
      case "ExportSpecifier":
        return this.visitExportSpecifier(node, state, path);
      case "ExportDefaultDeclaration":
        return this.visitExportDefaultDeclaration(node, state, path);
      case "ExportAllDeclaration":
        return this.visitExportAllDeclaration(node, state, path);
      case "RegExpLiteral":
        return this.visitRegExpLiteral(node, state, path);
      case "FunctionDeclaration":
        return this.visitFunctionDeclaration(node, state, path);
      case "VariableDeclaration":
        return this.visitVariableDeclaration(node, state, path);
      case "NewExpression":
        return this.visitNewExpression(node, state, path);
      case "ForOfStatement":
        return this.visitForOfStatement(node, state, path);
      case "ClassDeclaration":
        return this.visitClassDeclaration(node, state, path);
    }
    throw new Error("No visit function in AST visitor Visitor for:\n  " + path.join(".") + "\n  " + JSON.stringify(node));
  };
  Visitor.prototype.visitNode = function visitNode(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitSourceLocation = function visitSourceLocation(node, state, path) {
    var visitor = this;
    node["start"] = visitor.accept(node["start"], state, path.concat(["start"]));
    node["end"] = visitor.accept(node["end"], state, path.concat(["end"]));
    return node;
  };
  Visitor.prototype.visitPosition = function visitPosition(node, state, path) {
    var visitor = this;
    return node;
  };
  Visitor.prototype.visitProgram = function visitProgram(node, state, path) {
    var visitor = this;
    node["body"] = node["body"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["body", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitFunction = function visitFunction(node, state, path) {
    var visitor = this;
    if (node["id"]) {
      node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
    }
    node["params"] = node["params"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["params", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitStatement = function visitStatement(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitSwitchCase = function visitSwitchCase(node, state, path) {
    var visitor = this;
    if (node["test"]) {
      node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
    }
    node["consequent"] = node["consequent"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["consequent", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitCatchClause = function visitCatchClause(node, state, path) {
    var visitor = this;
    node["param"] = visitor.accept(node["param"], state, path.concat(["param"]));
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitVariableDeclarator = function visitVariableDeclarator(node, state, path) {
    var visitor = this;
    node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
    if (node["init"]) {
      node["init"] = visitor.accept(node["init"], state, path.concat(["init"]));
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitExpression = function visitExpression(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitProperty = function visitProperty(node, state, path) {
    var visitor = this;
    node["key"] = visitor.accept(node["key"], state, path.concat(["key"]));
    node["value"] = visitor.accept(node["value"], state, path.concat(["value"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitPattern = function visitPattern(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitSuper = function visitSuper(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitSpreadElement = function visitSpreadElement(node, state, path) {
    var visitor = this;
    node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitTemplateElement = function visitTemplateElement(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitClass = function visitClass(node, state, path) {
    var visitor = this;
    if (node["id"]) {
      node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
    }
    if (node["superClass"]) {
      node["superClass"] = visitor.accept(node["superClass"], state, path.concat(["superClass"]));
    }
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitClassBody = function visitClassBody(node, state, path) {
    var visitor = this;
    node["body"] = node["body"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["body", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitMethodDefinition = function visitMethodDefinition(node, state, path) {
    var visitor = this;
    node["key"] = visitor.accept(node["key"], state, path.concat(["key"]));
    node["value"] = visitor.accept(node["value"], state, path.concat(["value"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitModuleDeclaration = function visitModuleDeclaration(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitModuleSpecifier = function visitModuleSpecifier(node, state, path) {
    var visitor = this;
    node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitIdentifier = function visitIdentifier(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitLiteral = function visitLiteral(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitExpressionStatement = function visitExpressionStatement(node, state, path) {
    var visitor = this;
    node["expression"] = visitor.accept(node["expression"], state, path.concat(["expression"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitBlockStatement = function visitBlockStatement(node, state, path) {
    var visitor = this;
    node["body"] = node["body"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["body", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitEmptyStatement = function visitEmptyStatement(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitDebuggerStatement = function visitDebuggerStatement(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitWithStatement = function visitWithStatement(node, state, path) {
    var visitor = this;
    node["object"] = visitor.accept(node["object"], state, path.concat(["object"]));
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitReturnStatement = function visitReturnStatement(node, state, path) {
    var visitor = this;
    if (node["argument"]) {
      node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitLabeledStatement = function visitLabeledStatement(node, state, path) {
    var visitor = this;
    node["label"] = visitor.accept(node["label"], state, path.concat(["label"]));
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitBreakStatement = function visitBreakStatement(node, state, path) {
    var visitor = this;
    if (node["label"]) {
      node["label"] = visitor.accept(node["label"], state, path.concat(["label"]));
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitContinueStatement = function visitContinueStatement(node, state, path) {
    var visitor = this;
    if (node["label"]) {
      node["label"] = visitor.accept(node["label"], state, path.concat(["label"]));
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitIfStatement = function visitIfStatement(node, state, path) {
    var visitor = this;
    node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
    node["consequent"] = visitor.accept(node["consequent"], state, path.concat(["consequent"]));
    if (node["alternate"]) {
      node["alternate"] = visitor.accept(node["alternate"], state, path.concat(["alternate"]));
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitSwitchStatement = function visitSwitchStatement(node, state, path) {
    var visitor = this;
    node["discriminant"] = visitor.accept(node["discriminant"], state, path.concat(["discriminant"]));
    node["cases"] = node["cases"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["cases", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitThrowStatement = function visitThrowStatement(node, state, path) {
    var visitor = this;
    node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitTryStatement = function visitTryStatement(node, state, path) {
    var visitor = this;
    node["block"] = visitor.accept(node["block"], state, path.concat(["block"]));
    if (node["handler"]) {
      node["handler"] = visitor.accept(node["handler"], state, path.concat(["handler"]));
    }
    if (node["finalizer"]) {
      node["finalizer"] = visitor.accept(node["finalizer"], state, path.concat(["finalizer"]));
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitWhileStatement = function visitWhileStatement(node, state, path) {
    var visitor = this;
    node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitDoWhileStatement = function visitDoWhileStatement(node, state, path) {
    var visitor = this;
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitForStatement = function visitForStatement(node, state, path) {
    var visitor = this;
    if (node["init"]) {
      node["init"] = visitor.accept(node["init"], state, path.concat(["init"]));
    }
    if (node["test"]) {
      node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
    }
    if (node["update"]) {
      node["update"] = visitor.accept(node["update"], state, path.concat(["update"]));
    }
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitForInStatement = function visitForInStatement(node, state, path) {
    var visitor = this;
    node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
    node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitDeclaration = function visitDeclaration(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitThisExpression = function visitThisExpression(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitArrayExpression = function visitArrayExpression(node, state, path) {
    var visitor = this;
    if (node["elements"]) {
      node["elements"] = node["elements"].reduce(function(results, ea, i) {
        var result = visitor.accept(ea, state, path.concat(["elements", i]));
        if (Array.isArray(result))
          results.push.apply(results, result);
        else
          results.push(result);
        return results;
      }, []);
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitObjectExpression = function visitObjectExpression(node, state, path) {
    var visitor = this;
    node["properties"] = node["properties"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["properties", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitFunctionExpression = function visitFunctionExpression(node, state, path) {
    var visitor = this;
    if (node["id"]) {
      node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
    }
    node["params"] = node["params"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["params", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitUnaryExpression = function visitUnaryExpression(node, state, path) {
    var visitor = this;
    node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitUpdateExpression = function visitUpdateExpression(node, state, path) {
    var visitor = this;
    node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitBinaryExpression = function visitBinaryExpression(node, state, path) {
    var visitor = this;
    node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
    node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitAssignmentExpression = function visitAssignmentExpression(node, state, path) {
    var visitor = this;
    node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
    node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitLogicalExpression = function visitLogicalExpression(node, state, path) {
    var visitor = this;
    node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
    node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitMemberExpression = function visitMemberExpression(node, state, path) {
    var visitor = this;
    node["object"] = visitor.accept(node["object"], state, path.concat(["object"]));
    node["property"] = visitor.accept(node["property"], state, path.concat(["property"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitConditionalExpression = function visitConditionalExpression(node, state, path) {
    var visitor = this;
    node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
    node["alternate"] = visitor.accept(node["alternate"], state, path.concat(["alternate"]));
    node["consequent"] = visitor.accept(node["consequent"], state, path.concat(["consequent"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitCallExpression = function visitCallExpression(node, state, path) {
    var visitor = this;
    node["callee"] = visitor.accept(node["callee"], state, path.concat(["callee"]));
    node["arguments"] = node["arguments"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["arguments", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitSequenceExpression = function visitSequenceExpression(node, state, path) {
    var visitor = this;
    node["expressions"] = node["expressions"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["expressions", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitArrowFunctionExpression = function visitArrowFunctionExpression(node, state, path) {
    var visitor = this;
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["id"]) {
      node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
    }
    node["params"] = node["params"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["params", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitYieldExpression = function visitYieldExpression(node, state, path) {
    var visitor = this;
    if (node["argument"]) {
      node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitTemplateLiteral = function visitTemplateLiteral(node, state, path) {
    var visitor = this;
    node["quasis"] = node["quasis"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["quasis", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    node["expressions"] = node["expressions"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["expressions", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitTaggedTemplateExpression = function visitTaggedTemplateExpression(node, state, path) {
    var visitor = this;
    node["tag"] = visitor.accept(node["tag"], state, path.concat(["tag"]));
    node["quasi"] = visitor.accept(node["quasi"], state, path.concat(["quasi"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitAssignmentProperty = function visitAssignmentProperty(node, state, path) {
    var visitor = this;
    node["value"] = visitor.accept(node["value"], state, path.concat(["value"]));
    node["key"] = visitor.accept(node["key"], state, path.concat(["key"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitArrayPattern = function visitArrayPattern(node, state, path) {
    var visitor = this;
    if (node["elements"]) {
      node["elements"] = node["elements"].reduce(function(results, ea, i) {
        var result = visitor.accept(ea, state, path.concat(["elements", i]));
        if (Array.isArray(result))
          results.push.apply(results, result);
        else
          results.push(result);
        return results;
      }, []);
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitRestElement = function visitRestElement(node, state, path) {
    var visitor = this;
    node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitAssignmentPattern = function visitAssignmentPattern(node, state, path) {
    var visitor = this;
    node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
    node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitClassExpression = function visitClassExpression(node, state, path) {
    var visitor = this;
    if (node["id"]) {
      node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
    }
    if (node["superClass"]) {
      node["superClass"] = visitor.accept(node["superClass"], state, path.concat(["superClass"]));
    }
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitMetaProperty = function visitMetaProperty(node, state, path) {
    var visitor = this;
    node["meta"] = visitor.accept(node["meta"], state, path.concat(["meta"]));
    node["property"] = visitor.accept(node["property"], state, path.concat(["property"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitImportDeclaration = function visitImportDeclaration(node, state, path) {
    var visitor = this;
    node["specifiers"] = node["specifiers"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["specifiers", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    node["source"] = visitor.accept(node["source"], state, path.concat(["source"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitImportSpecifier = function visitImportSpecifier(node, state, path) {
    var visitor = this;
    node["imported"] = visitor.accept(node["imported"], state, path.concat(["imported"]));
    node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitImportDefaultSpecifier = function visitImportDefaultSpecifier(node, state, path) {
    var visitor = this;
    node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitImportNamespaceSpecifier = function visitImportNamespaceSpecifier(node, state, path) {
    var visitor = this;
    node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitExportNamedDeclaration = function visitExportNamedDeclaration(node, state, path) {
    var visitor = this;
    if (node["declaration"]) {
      node["declaration"] = visitor.accept(node["declaration"], state, path.concat(["declaration"]));
    }
    node["specifiers"] = node["specifiers"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["specifiers", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["source"]) {
      node["source"] = visitor.accept(node["source"], state, path.concat(["source"]));
    }
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitExportSpecifier = function visitExportSpecifier(node, state, path) {
    var visitor = this;
    node["exported"] = visitor.accept(node["exported"], state, path.concat(["exported"]));
    node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitExportDefaultDeclaration = function visitExportDefaultDeclaration(node, state, path) {
    var visitor = this;
    node["declaration"] = visitor.accept(node["declaration"], state, path.concat(["declaration"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitExportAllDeclaration = function visitExportAllDeclaration(node, state, path) {
    var visitor = this;
    node["source"] = visitor.accept(node["source"], state, path.concat(["source"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitRegExpLiteral = function visitRegExpLiteral(node, state, path) {
    var visitor = this;
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitFunctionDeclaration = function visitFunctionDeclaration(node, state, path) {
    var visitor = this;
    node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
    node["params"] = node["params"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["params", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitVariableDeclaration = function visitVariableDeclaration(node, state, path) {
    var visitor = this;
    node["declarations"] = node["declarations"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["declarations", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitNewExpression = function visitNewExpression(node, state, path) {
    var visitor = this;
    node["callee"] = visitor.accept(node["callee"], state, path.concat(["callee"]));
    node["arguments"] = node["arguments"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["arguments", i]));
      if (Array.isArray(result))
        results.push.apply(results, result);
      else
        results.push(result);
      return results;
    }, []);
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitForOfStatement = function visitForOfStatement(node, state, path) {
    var visitor = this;
    node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
    node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  Visitor.prototype.visitClassDeclaration = function visitClassDeclaration(node, state, path) {
    var visitor = this;
    node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
    if (node["superClass"]) {
      node["superClass"] = visitor.accept(node["superClass"], state, path.concat(["superClass"]));
    }
    node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
    if (node["loc"]) {
      node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
    }
    return node;
  };
  module.exports = Visitor;
  return module.exports;
});

System.registerDynamic("lively.ast/lib/capturing.js", ["../index", "lively.lang", "../generated/estree-visitor"], true, function($__require, exports, module) {
  "use strict";
  ;
  var define,
      global = this,
      GLOBAL = this;
  var ast = $__require('../index');
  var lang = $__require('lively.lang');
  var Visitor = $__require('../generated/estree-visitor');
  exports.capturing = {rewriteToCaptureTopLevelVariables: rewriteToCaptureTopLevelVariables};
  function rewriteToCaptureTopLevelVariables(astOrSource, assignToObj, options) {
    options = lang.obj.merge({
      ignoreUndeclaredExcept: null,
      includeRefs: null,
      excludeRefs: options && options.exclude || [],
      includeDecls: null,
      excludeDecls: options && options.exclude || [],
      recordDefRanges: false,
      es6ExportFuncId: null,
      es6ImportFuncId: null,
      captureObj: assignToObj || {
        type: "Identifier",
        name: "__rec"
      },
      moduleExportFunc: {
        name: options && options.es6ExportFuncId || "_moduleExport",
        type: "Identifier"
      },
      moduleImportFunc: {
        name: options && options.es6ImportFuncId || "_moduleImport",
        type: "Identifier"
      }
    }, options);
    var parsed = typeof astOrSource === 'object' ? astOrSource : ast.parse(astOrSource),
        source = typeof astOrSource === 'string' ? astOrSource : parsed.source || ast.stringify(parsed),
        rewritten = parsed;
    if (options.ignoreUndeclaredExcept) {
      var topLevel = ast.query.topLevelDeclsAndRefs(parsed);
      options.excludeRefs = lang.arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeRefs);
      options.excludeDecls = lang.arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeDecls);
    }
    options.excludeRefs = options.excludeRefs.concat(options.captureObj.name);
    options.excludeDecls = options.excludeDecls.concat(options.captureObj.name);
    var defRanges = options.recordDefRanges ? computeDefRanges(rewritten, options) : null;
    options.excludeRefs = options.excludeRefs.concat(additionalIgnoredRefs(parsed, options));
    options.excludeDecls = options.excludeDecls.concat(additionalIgnoredDecls(parsed, options));
    if (options.es6ExportFuncId) {
      options.excludeRefs.push(options.es6ExportFuncId);
      options.excludeRefs.push(options.es6ImportFuncId);
      rewritten = es6ModuleTransforms(rewritten, options);
    }
    rewritten = replaceRefs(parsed, options);
    rewritten = replaceVarDecls(rewritten, options);
    rewritten = insertCapturesForExportDeclarations(rewritten, options);
    rewritten = insertCapturesForImportDeclarations(rewritten, options);
    rewritten = insertDeclarationsForExports(rewritten, options);
    rewritten = putFunctionDeclsInFront(rewritten, options);
    return {
      ast: rewritten,
      source: ast.stringify(rewritten),
      defRanges: defRanges
    };
  }
  function replace(parsed, replacer) {
    var v = new Visitor();
    v.visitVariableDeclaration;
    v.accept = lang.fun.wrap(v.accept, function(proceed, node, state, path) {
      return replacer(proceed(node, state, path));
    });
    return v.accept(parsed, null, []);
  }
  function replaceRefs(parsed, options) {
    var topLevel = ast.query.topLevelDeclsAndRefs(parsed),
        refsToReplace = topLevel.refs.filter(function(ref) {
          return shouldRefBeCaptured(ref, options);
        });
    return replace(parsed, function(node) {
      return refsToReplace.indexOf(node) > -1 ? member(node, options.captureObj) : node;
    });
  }
  function replaceVarDecls(parsed, options) {
    var topLevel = ast.query.topLevelDeclsAndRefs(parsed);
    return replace(parsed, function(node) {
      if (topLevel.varDecls.indexOf(node) === -1)
        return node;
      var decls = node.declarations.filter(function(decl) {
        return shouldDeclBeCaptured(decl, options);
      });
      if (!decls.length)
        return node;
      return node.declarations.map(function(ea) {
        var init = ea.init || {
          operator: "||",
          type: "LogicalExpression",
          left: {
            computed: true,
            object: options.captureObj,
            property: {
              type: "Literal",
              value: ea.id.name
            },
            type: "MemberExpression"
          },
          right: {
            name: "undefined",
            type: "Identifier"
          }
        };
        return shouldDeclBeCaptured(ea, options) ? assignExpr(options.captureObj, ea.id, init, false) : ea;
      });
    });
  }
  function additionalIgnoredDecls(parsed, options) {
    var topLevel = ast.query.topLevelDeclsAndRefs(parsed),
        ignoreDecls = topLevel.scope.varDecls.reduce(function(result, decl, i) {
          var path = lang.Path(topLevel.scope.varDeclPaths[i]),
              parent = path.slice(0, -1).get(parsed);
          if (parent.type === "ForStatement" || parent.type === "ForInStatement" || parent.type === "ExportNamedDeclaration") {
            result.push(decl);
          }
          return result;
        }, []);
    return [].concat(lang.arr.pluck(topLevel.scope.catches, "name")).concat(lang.chain(ignoreDecls).pluck("declarations").flatten().pluck("id").pluck("name").value());
  }
  function additionalIgnoredRefs(parsed, options) {
    var topLevel = ast.query.topLevelDeclsAndRefs(parsed),
        ignoreDecls = topLevel.scope.varDecls.reduce(function(result, decl, i) {
          var path = lang.Path(topLevel.scope.varDeclPaths[i]),
              parent = path.slice(0, -1).get(parsed);
          if (parent.type === "ForStatement" || parent.type === "ForInStatement" || parent.type === "ExportNamedDeclaration") {
            result.push(decl);
          }
          return result;
        }, []),
        ignoredImportAndExportNames = parsed.body.reduce(function(ignored, stmt) {
          if (!options.es6ImportFuncId && stmt.type === "ImportDeclaration")
            return stmt.specifiers.reduce(function(ignored, specifier) {
              return specifier.type === "ImportSpecifier" ? ignored.concat([specifier.imported.name]) : ignored;
            }, ignored);
          if (!options.es6ExportFuncId && (stmt.type === "ExportNamedDeclaration" || stmt.type === "ExportDefaultDeclaration") && stmt.specifiers)
            return ignored.concat(stmt.specifiers.map(function(specifier) {
              return specifier.local.name;
            }));
          return ignored;
        }, []);
    return [].concat(lang.arr.pluck(topLevel.scope.catches, "name")).concat(ignoredImportAndExportNames).concat(lang.chain(ignoreDecls).pluck("declarations").flatten().pluck("id").pluck("name").value());
  }
  function insertCapturesForExportDeclarations(parsed, options) {
    parsed.body = parsed.body.reduce(function(stmts, stmt) {
      return stmts.concat(stmt.type !== "ExportNamedDeclaration" || !stmt.declaration ? [stmt] : [stmt].concat(stmt.declaration.declarations.map(function(decl) {
        return assignExpr(options.captureObj, decl.id, decl.id, false);
      })));
    }, []);
    return parsed;
  }
  function insertCapturesForImportDeclarations(parsed, options) {
    parsed.body = parsed.body.reduce(function(stmts, stmt) {
      return stmts.concat(stmt.type !== "ImportDeclaration" || !stmt.specifiers.length ? [stmt] : [stmt].concat(stmt.specifiers.map(function(specifier) {
        return assignExpr(options.captureObj, specifier.local, specifier.local, false);
      })));
    }, []);
    return parsed;
  }
  function insertDeclarationsForExports(parsed, options) {
    parsed.body = parsed.body.reduce(function(stmts, stmt) {
      return stmts.concat(stmt.type !== "ExportNamedDeclaration" || !stmt.specifiers.length ? [stmt] : stmt.specifiers.map(function(specifier) {
        return varDecl({
          type: "VariableDeclarator",
          id: specifier.local,
          init: member(specifier.local, options.captureObj)
        });
      }).concat(stmt));
    }, []);
    return parsed;
  }
  function es6ModuleTransforms(parsed, options) {
    parsed.body = parsed.body.reduce(function(stmts, stmt) {
      var nodes;
      if (stmt.type === "ExportNamedDeclaration") {
        if (stmt.source) {
          var key = moduleId = stmt.source;
          nodes = stmt.specifiers.map(function(specifier) {
            return {
              type: "ExpressionStatement",
              expression: exportFromImport({
                type: "Literal",
                value: specifier.exported.name
              }, {
                type: "Literal",
                value: specifier.local.name
              }, moduleId, options.moduleExportFunc, options.moduleImportFunc)
            };
          });
        } else if (stmt.declaration) {
          nodes = [stmt.declaration].concat(stmt.declaration.declarations.map(function(decl) {
            return exportCallStmt(options.moduleExportFunc, decl.id.name, decl.id);
          }));
        } else {
          nodes = stmt.specifiers.map(function(specifier) {
            return exportCallStmt(options.moduleExportFunc, specifier.exported.name, shouldDeclBeCaptured({id: specifier.local}, options) ? member(specifier.local, options.captureObj) : specifier.local);
          });
        }
      } else if (stmt.type === "ExportDefaultDeclaration") {
        nodes = [exportCallStmt(options.moduleExportFunc, "default", stmt.declaration)];
      } else if (stmt.type === "ExportAllDeclaration") {
        var key = {
          name: options.es6ExportFuncId + "__iterator__",
          type: "Identifier"
        },
            moduleId = stmt.source;
        nodes = [{
          type: "ForInStatement",
          body: {
            type: "ExpressionStatement",
            expression: exportFromImport(key, key, moduleId, options.moduleExportFunc, options.moduleImportFunc)
          },
          left: {
            type: "VariableDeclaration",
            kind: "var",
            declarations: [{
              type: "VariableDeclarator",
              id: key,
              init: null
            }]
          },
          right: importCall(null, moduleId, options.moduleImportFunc)
        }];
        options.excludeRefs.push(key.name);
        options.excludeDecls.push(key.name);
      } else if (stmt.type === "ImportDeclaration") {
        nodes = stmt.specifiers.length ? stmt.specifiers.map(function(specifier) {
          var local = specifier.local,
              imported = specifier.type === "ImportSpecifier" && specifier.imported.name || specifier.type === "ImportDefaultSpecifier" && "default" || null;
          return varDeclAndImportCall(local, imported || null, stmt.source, options.moduleImportFunc);
        }) : importCallStmt(null, stmt.source, options.moduleImportFunc);
      } else
        nodes = [stmt];
      return stmts.concat(nodes);
    }, []);
    return parsed;
  }
  function putFunctionDeclsInFront(parsed, options) {
    var topLevel = ast.query.topLevelDeclsAndRefs(parsed);
    if (!topLevel.funcDecls.length)
      return parsed;
    var globalFuncs = topLevel.funcDecls.filter(function(ea) {
      return shouldDeclBeCaptured(ea, options);
    }).map(function(decl) {
      var funcId = {
        type: "Identifier",
        name: decl.id.name
      };
      return assignExpr(options.captureObj, funcId, funcId, false);
    });
    parsed.body = globalFuncs.concat(parsed.body);
    return parsed;
  }
  function computeDefRanges(parsed, options) {
    var topLevel = ast.query.topLevelDeclsAndRefs(parsed);
    return lang.chain(topLevel.scope.varDecls).pluck("declarations").flatten().value().concat(topLevel.scope.funcDecls).reduce(function(defs, decl) {
      if (!defs[decl.id.name])
        defs[decl.id.name] = [];
      defs[decl.id.name].push({
        type: decl.type,
        start: decl.start,
        end: decl.end
      });
      return defs;
    }, {});
  }
  function shouldDeclBeCaptured(decl, options) {
    return options.excludeDecls.indexOf(decl.id.name) === -1 && (!options.includeDecls || options.includeDecls.indexOf(decl.id.name) > -1);
  }
  function shouldRefBeCaptured(ref, options) {
    return options.excludeRefs.indexOf(ref.name) === -1 && (!options.includeRefs || options.includeRefs.indexOf(ref.name) > -1);
  }
  function member(prop, obj, computed) {
    return {
      type: "MemberExpression",
      computed: computed || false,
      object: obj,
      property: prop
    };
  }
  function varDecl(declarator) {
    return {
      declarations: [declarator],
      kind: "var",
      type: "VariableDeclaration"
    };
  }
  function assignExpr(assignee, propId, value, computed) {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        right: value || {
          type: "Identifier",
          name: 'undefined'
        },
        left: {
          type: "MemberExpression",
          computed: computed || false,
          object: assignee,
          property: propId
        }
      }
    };
  }
  function exportFromImport(keyLeft, keyRight, moduleId, moduleExportFunc, moduleImportFunc) {
    return exportCall(moduleExportFunc, keyLeft, importCall(keyRight, moduleId, moduleImportFunc));
  }
  function varDeclAndImportCall(localId, imported, moduleSource, moduleImportFunc) {
    return varDecl({
      type: "VariableDeclarator",
      id: localId,
      init: importCall(imported, moduleSource, moduleImportFunc)
    });
  }
  function importCall(imported, moduleSource, moduleImportFunc) {
    if (typeof imported === "string")
      imported = {
        type: "Literal",
        value: imported
      };
    return {
      arguments: [moduleSource].concat(imported || []),
      callee: moduleImportFunc,
      type: "CallExpression"
    };
  }
  function importCallStmt(imported, moduleSource, moduleImportFunc) {
    return {
      type: "ExpressionStatement",
      expression: importCall(imported, moduleSource, moduleImportFunc)
    };
  }
  function exportCall(exportFunc, local, exportedObj) {
    if (typeof local === "string")
      local = {
        type: "Literal",
        value: local
      };
    return {
      arguments: [local, exportedObj],
      callee: exportFunc,
      type: "CallExpression"
    };
  }
  function exportCallStmt(exportFunc, local, exportedObj) {
    return {
      type: "ExpressionStatement",
      expression: exportCall(exportFunc, local, exportedObj)
    };
  }
  return module.exports;
});

System.registerDynamic("lively.ast/lib/comments.js", ["lively.lang", "../index"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var lang = $__require('lively.lang');
  var arr = lang.arr,
      chain = lang.chain,
      obj = lang.obj,
      path = lang.Path,
      str = lang.string,
      ast = $__require('../index');
  exports.comments = {
    getCommentPrecedingNode: function(parsed, node) {
      var statementPath = ast.acorn.walk.findStatementOfNode({asPath: true}, parsed, node),
          blockPath = statementPath.slice(0, -2),
          block = path(blockPath).get(parsed);
      return !block.comments || !block.comments.length ? null : chain(ast.comments.extractComments(parsed)).reversed().detect(function(ea) {
        return ea.followingNode === node;
      }).value();
    },
    extractComments: function(astOrCode, optCode) {
      var parsed = typeof astOrCode === "string" ? ast.parse(astOrCode, {withComments: true}) : astOrCode,
          code = optCode ? optCode : (typeof astOrCode === "string" ? astOrCode : ast.stringify(astOrCode)),
          parsedComments = arr.sortBy(commentsWithPathsAndNodes(parsed), function(c) {
            return c.comment.start;
          });
      return parsedComments.map(function(c, i) {
        if (isInObjectMethod(c)) {
          return obj.merge([c, c.comment, {
            type: 'method',
            comment: c.comment.text
          }, methodAttributesOf(c)]);
        }
        if (isInComputedMethod(c)) {
          return obj.merge([c, c.comment, {
            type: 'method',
            comment: c.comment.text
          }, computedMethodAttributesOf(c)]);
        }
        if (isInFunctionStatement(c)) {
          return obj.merge([c, c.comment, {
            type: 'function',
            comment: c.comment.text
          }, functionAttributesOf(c)]);
        }
        if (isInAssignedMethod(c)) {
          return obj.merge([c, c.comment, {
            type: 'method',
            comment: c.comment.text
          }, methodAttributesOfAssignment(c)]);
        }
        var followingNode = followingNodeOf(c);
        if (!followingNode)
          return obj.merge([c, c.comment, {followingNode: followingNode}, unknownComment(c)]);
        var followingComment = parsedComments[i + 1];
        if (followingComment && followingComment.comment.start <= followingNode.start)
          return obj.merge([c, c.comment, {followingNode: followingNode}, unknownComment(c)]);
        if (isSingleObjVarDeclaration(followingNode)) {
          return obj.merge([c, c.comment, {followingNode: followingNode}, {
            type: 'object',
            comment: c.comment.text
          }, objAttributesOf(followingNode)]);
        }
        if (isSingleVarDeclaration(followingNode)) {
          return obj.merge([c, c.comment, {followingNode: followingNode}, {
            type: 'var',
            comment: c.comment.text
          }, objAttributesOf(followingNode)]);
        }
        return obj.merge([c, c.comment, {followingNode: followingNode}, unknownComment(c)]);
      });
      function commentsWithPathsAndNodes(parsed) {
        var comments = [];
        ast.acorn.withMozillaAstDo(parsed, comments, function(next, node, comments, depth, path) {
          if (node.comments) {
            arr.pushAll(comments, node.comments.map(function(comment) {
              return {
                path: path,
                comment: comment,
                node: node
              };
            }));
          }
          next();
        });
        return comments;
      }
      function followingNodeOf(comment) {
        return arr.detect(comment.node.body, function(node) {
          return node.start > comment.comment.end;
        });
      }
      function unknownComment(comment) {
        return {
          type: "unknown",
          comment: comment.comment.text
        };
      }
      function isInFunctionStatement(comment) {
        var node = path(comment.path.slice(0, -1)).get(parsed);
        return node && node.type === "FunctionDeclaration";
      }
      function functionAttributesOf(comment) {
        var funcNode = path(comment.path.slice(0, -1)).get(parsed),
            name = funcNode.id ? funcNode.id.name : "<error: no name for function>";
        return {
          name: name,
          args: arr.pluck(funcNode.params, "name")
        };
      }
      function isInObjectMethod(comment) {
        return arr.equals(comment.path.slice(-2), ["value", "body"]);
      }
      function isInAssignedMethod(comment) {
        return arr.equals(comment.path.slice(-2), ["right", "body"]);
      }
      function methodAttributesOf(comment) {
        var methodNode = path(comment.path.slice(0, -2)).get(parsed),
            name = methodNode.key ? methodNode.key.name : "<error: no name for method>";
        var p = comment.path.slice();
        var objectName = "<error: no object found for method>";
        while (p.length && arr.last(p) !== 'init')
          p.pop();
        if (p.length) {
          objectName = path(p.slice(0, -1).concat(["id", "name"])).get(parsed);
        }
        if (str.startsWith(objectName, "<error")) {
          p = comment.path.slice();
          while (p.length && arr.last(p) !== 'right')
            p.pop();
          if (p.length) {
            var assignNode = path(p.slice(0, -1).concat(["left"])).get(parsed);
            objectName = code.slice(assignNode.start, assignNode.end);
          }
        }
        if (str.startsWith(objectName, "<error")) {
          p = comment.path.slice();
          var callExpr = path(p.slice(0, -6)).get(parsed),
              isCall = callExpr && callExpr.type === "CallExpression",
              firstArg = isCall && callExpr.arguments[0];
          if (firstArg)
            objectName = code.slice(firstArg.start, firstArg.end);
        }
        return {
          name: name,
          args: arr.pluck(methodNode.value.params, "name"),
          objectName: objectName
        };
      }
      function methodAttributesOfAssignment(comment) {
        var node = path(comment.path.slice(0, -1)).get(parsed);
        if (node.type !== "FunctionExpression" && node.type !== "FunctionDeclaration")
          return {};
        var statement = ast.acorn.walk.findStatementOfNode(parsed, node);
        if (statement.type !== "ExpressionStatement" || statement.expression.type !== "AssignmentExpression")
          return {};
        var objName = code.slice(statement.expression.left.object.start, statement.expression.left.object.end);
        var methodName = code.slice(statement.expression.left.property.start, statement.expression.left.property.end);
        return {
          name: methodName,
          objectName: objName,
          args: arr.pluck(node.params, "name")
        };
      }
      function isInComputedMethod(comment) {
        var path = comment.path.slice(-5);
        arr.removeAt(path, 1);
        return arr.equals(path, ["properties", "value", "callee", "body"]);
      }
      function computedMethodAttributesOf(comment) {
        var name,
            args,
            pathToProp;
        pathToProp = comment.path.slice(0, -3);
        var propertyNode = path(pathToProp).get(parsed);
        if (propertyNode && propertyNode.type === "Property") {
          args = arr.pluck(propertyNode.value.callee.params, "name");
          name = propertyNode.key ? propertyNode.key.name : "<error: no name for method>";
        }
        if (!name) {
          pathToProp = comment.path.slice(0, -2);
          propertyNode = path(pathToProp).get(parsed);
          if (propertyNode && propertyNode.type === "Property") {
            args = arr.pluck(propertyNode.value.params, "name");
            name = propertyNode.key ? propertyNode.key.name : "<error: no name for method>";
          }
        }
        if (!name) {
          name = "<error: no name for method>";
          args = [];
          pathToProp = comment.path;
        }
        var p = arr.clone(pathToProp);
        var objectName = "<error: no object found for method>";
        while (p.length && arr.last(p) !== 'init')
          p.pop();
        if (p.length) {
          objectName = path(p.slice(0, -1).concat(["id", "name"])).get(parsed);
        }
        if (str.startsWith(objectName, "<error")) {
          var p = arr.clone(pathToProp);
          while (p.length && arr.last(p) !== 'right')
            p.pop();
          if (p.length) {
            var assignNode = path(p.slice(0, -1).concat(["left"])).get(parsed);
            objectName = code.slice(assignNode.start, assignNode.end);
          }
        }
        if (str.startsWith(objectName, "<error")) {
          var p = arr.clone(pathToProp);
          var callExpr = path(p.slice(0, -4)).get(parsed),
              isCall = callExpr && callExpr.type === "CallExpression",
              firstArg = isCall && callExpr.arguments[0];
          if (firstArg)
            objectName = code.slice(firstArg.start, firstArg.end);
        }
        return {
          name: name,
          args: args,
          objectName: objectName
        };
      }
      function isSingleObjVarDeclaration(node) {
        return isSingleVarDeclaration(node) && (node.declarations[0].init.type === "ObjectExpression" || isObjectAssignment(node.declarations[0].init));
      }
      function isSingleVarDeclaration(node) {
        return node && node.type === 'VariableDeclaration' && node.declarations.length === 1;
      }
      function objAttributesOf(node) {
        return {name: node.declarations[0].id.name};
      }
      ;
      function isObjectAssignment(node) {
        if (node.type !== "AssignmentExpression")
          return false;
        if (node.right.type === "ObjectExpression")
          return true;
        if (node.right.type === "AssignmentExpression")
          return isObjectAssignment(node.right);
        ;
        return false;
      }
    }
  };
  return module.exports;
});

System.registerDynamic("lively.ast/node_modules/lively.lang/index.js", [], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  module.exports = typeof process !== 'undefined' ? System._nodeRequire('lively.lang') : lively.lang;
  return module.exports;
});

System.registerDynamic("lively.ast/package.json", [], false, function() {
  return {
    "main": "index.js"
  };
});

System.registerDynamic("lively.ast/lib/code-categorizer.js", ["../index", "lively.lang"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var ast = $__require('../index'),
      lang = $__require('lively.lang'),
      arr = lang.arr,
      chain = lang.chain,
      obj = lang.obj,
      p = lang.Path,
      str = lang.string;
  function objectKeyValsAsDefs(objectExpression) {
    return objectExpression.properties.map(function(prop) {
      return {
        name: prop.key.name || prop.key.value,
        type: prop.value.type === "FunctionExpression" ? "method" : "property",
        node: prop
      };
    });
  }
  function classDef(node) {
    if (p("expression.callee.property.name").get(node) !== "subclass")
      return null;
    var def = {
      type: "lively-class-definition",
      name: p("expression.arguments.0.value").get(node),
      node: node
    };
    var props = arr.flatmap(node.expression.arguments, function(argNode) {
      if (argNode.type !== "ObjectExpression")
        return [];
      return objectKeyValsAsDefs(argNode).map(function(ea) {
        ea.type = "lively-class-instance-" + ea.type;
        ea.parent = def;
        return ea;
      });
    });
    return [def].concat(props);
  }
  function extendDef(node) {
    if (p("expression.callee.property.name").get(node) !== "extend" || p("expression.arguments.0.type").get(node) !== "ObjectExpression")
      return null;
    var name = p("expression.arguments.0.name").get(node);
    if (!name)
      return null;
    var def = {
      name: name,
      node: node,
      type: "lively-extend-definition"
    };
    var props = (objectKeyValsAsDefs(p("expression.arguments.1").get(node)) || []).map(function(d) {
      d.parent = def;
      return d;
    });
    return [def].concat(props);
  }
  function varDefs(node) {
    if (node.type !== "VariableDeclaration")
      return null;
    return arr.flatmap(withVarDeclIds(node), function(ea) {
      return arr.flatmap(ea.ids, function(id) {
        var def = {
          name: id.name,
          node: ea.node,
          type: "var-decl"
        };
        if (!def.node.init)
          return [def];
        var node = def.node.init;
        while (node.type === "AssignmentExpression")
          node = node.right;
        if (node.type === "ObjectExpression") {
          return [def].concat(objectKeyValsAsDefs(node).map(function(ea) {
            ea.type = "object-" + ea.type;
            ea.parent = def;
            return ea;
          }));
        }
        var objDefs = someObjectExpressionCall(node);
        if (objDefs)
          return [def].concat(objDefs.map(function(d) {
            d.parent = def;
            return d;
          }));
        return [def];
      });
    });
  }
  function funcDef(node) {
    if (node.type !== "FunctionStatement" && node.type !== "FunctionDeclaration")
      return null;
    return [{
      name: node.id.name,
      node: node,
      type: "function-decl"
    }];
  }
  function someObjectExpressionCall(node) {
    if (node.type === "ExpressionStatement")
      node = node.expression;
    if (node.type !== "CallExpression")
      return null;
    var objArg = node.arguments.detect(function(a) {
      return a.type === "ObjectExpression";
    });
    if (!objArg)
      return null;
    return objectKeyValsAsDefs(objArg);
  }
  function moduleDef(node, options) {
    if (!isModuleDeclaration(node))
      return null;
    var decls = findDecls(p("expression.arguments.0").get(node), options),
        parent = {
          node: node,
          name: p("expression.callee.object.callee.object.arguments.0.value").get(node)
        };
    decls.forEach(function(decl) {
      return decl.parent = parent;
    });
    return decls;
  }
  function functionWrapper(node, options) {
    if (!isFunctionWrapper(node))
      return null;
    var decls;
    var argFunc = p("expression.arguments.0").get(node);
    if (argFunc && argFunc.type === "FunctionExpression" && str.lines(argFunc.source || "").length > 5) {
      decls = findDecls(argFunc, options);
    } else {
      decls = findDecls(p("expression.callee").get(node), options);
    }
    var parent = {
      node: node,
      name: p("expression.callee.id.name").get(node)
    };
    decls.forEach(function(decl) {
      return decl.parent || (decl.parent = parent);
    });
    return decls;
  }
  function isModuleDeclaration(node) {
    return p("expression.callee.object.callee.object.callee.name").get(node) === "module" && p("expression.callee.property.name").get(node) === "toRun";
  }
  function isFunctionWrapper(node) {
    return p("expression.type").get(node) === "CallExpression" && p("expression.callee.type").get(node) === "FunctionExpression";
  }
  function declIds(idNodes) {
    return arr.flatmap(idNodes, function(ea) {
      if (!ea)
        return [];
      if (ea.type === "Identifier")
        return [ea];
      if (ea.type === "RestElement")
        return [ea.argument];
      if (ea.type === "ObjectPattern")
        return declIds(arr.pluck(ea.properties, "value"));
      if (ea.type === "ArrayPattern")
        return declIds(ea.elements);
      return [];
    });
  }
  function withVarDeclIds(varNode) {
    return varNode.declarations.map(function(declNode) {
      if (!declNode.source && declNode.init)
        declNode.source = declNode.id.name + " = " + declNode.init.source;
      return {
        node: declNode,
        ids: declIds([declNode.id])
      };
    });
  }
  function findDecls(parsed, options) {
    options = options || obj.merge({hideOneLiners: false}, options);
    if (typeof parsed === "string")
      parsed = ast.parse(parsed, {addSource: true});
    var topLevelNodes = parsed.type === "Program" ? parsed.body : parsed.body.body,
        defs = arr.flatmap(topLevelNodes, function(n) {
          return moduleDef(n, options) || functionWrapper(n, options) || varDefs(n) || funcDef(n) || classDef(n) || extendDef(n) || someObjectExpressionCall(n);
        });
    if (options.hideOneLiners && parsed.source) {
      defs = defs.reduce(function(defs, def) {
        if (def.parent && defs.indexOf(def.parent) > -1)
          defs.push(def);
        else if ((def.node.source || "").indexOf("\n") > -1)
          defs.push(def);
        return defs;
      }, []);
    }
    if (options.hideOneLiners && parsed.loc)
      defs = defs.filter(function(def) {
        return !def.node.loc || (def.node.loc.start.line !== def.node.loc.end.line);
        parsed;
      });
    return defs;
  }
  exports.codeCategorizer = {findDecls: findDecls};
  return module.exports;
});

System.registerDynamic("lively.ast/index.js", ["lively.lang", "acorn/dist/acorn", "acorn/dist/walk", "acorn/dist/acorn_loose", "escodegen", "./lib/acorn-extension", "./lib/mozilla-ast-visitors", "./lib/mozilla-ast-visitor-interface", "./lib/query", "./lib/transform", "./lib/capturing", "./lib/comments", "./lib/code-categorizer"], true, function($__require, exports, module) {
  ;
  var define,
      global = this,
      GLOBAL = this;
  var isNode = typeof $__require !== "undefined" && typeof exports !== "undefined";
  var lang = $__require('lively.lang');
  var acorn = exports.acorn = $__require('acorn/dist/acorn');
  acorn.walk = $__require('acorn/dist/walk');
  lang.obj.extend(acorn, $__require('acorn/dist/acorn_loose'));
  var GLOBAL = typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : (typeof Global !== "undefined" ? Global : global));
  exports.escodegen = GLOBAL.escodegen || $__require('escodegen');
  lang.obj.extend(exports, {
    parse: parse,
    parseFunction: parseFunction,
    parseLikeOMeta: parseLikeOMeta,
    fuzzyParse: fuzzyParse,
    nodesAt: nodesAt
  }, $__require('./lib/acorn-extension'), $__require('./lib/mozilla-ast-visitors'), $__require('./lib/mozilla-ast-visitor-interface'), $__require('./lib/query'), $__require('./lib/transform'), $__require('./lib/capturing'), $__require('./lib/comments'), $__require('./lib/code-categorizer'));
  function parse(source, options) {
    options = options || {};
    options.ecmaVersion = options.ecmaVersion || 6;
    options.sourceType = options.sourceType || "module";
    options.plugins = options.plugins || {};
    if (options.plugins.hasOwnProperty("jsx"))
      options.plugins.jsx = options.plugins.jsx;
    if (options.withComments) {
      delete options.withComments;
      var comments = [];
      options.onComment = function(isBlock, text, start, end, line, column) {
        comments.push({
          isBlock: isBlock,
          text: text,
          node: null,
          start: start,
          end: end,
          line: line,
          column: column
        });
      };
    }
    var ast = options.addSource ? acorn.walk.addSource(source, options) : acorn.parse(source, options);
    if (options.addAstIndex && !ast.hasOwnProperty('astIndex'))
      acorn.walk.addAstIndex(ast);
    if (ast && comments)
      attachCommentsToAST({
        ast: ast,
        comments: comments,
        nodesWithComments: []
      });
    return ast;
    function attachCommentsToAST(commentData) {
      commentData = mergeComments(assignCommentsToBlockNodes(commentData));
      ast.allComments = commentData.comments;
    }
    function assignCommentsToBlockNodes(commentData) {
      comments.forEach(function(comment) {
        var node = lang.arr.detect(nodesAt(comment.start, ast).reverse(), function(node) {
          return node.type === 'BlockStatement' || node.type === 'Program';
        });
        if (!node)
          node = ast;
        if (!node.comments)
          node.comments = [];
        node.comments.push(comment);
        commentData.nodesWithComments.push(node);
      });
      return commentData;
    }
    function mergeComments(commentData) {
      commentData.nodesWithComments.forEach(function(blockNode) {
        lang.arr.clone(blockNode.comments).reduce(function(coalesceData, comment) {
          if (comment.isBlock) {
            coalesceData.lastComment = null;
            return coalesceData;
          }
          if (!coalesceData.lastComment) {
            coalesceData.lastComment = comment;
            return coalesceData;
          }
          var last = coalesceData.lastComment;
          var nodeInbetween = lang.arr.detect(blockNode.body, function(node) {
            return node.start >= last.end && node.end <= comment.start;
          });
          if (nodeInbetween) {
            coalesceData.lastComment = comment;
            return coalesceData;
          }
          var codeInBetween = source.slice(last.end, comment.start);
          if (/[\n\r][\n\r]+/.test(codeInBetween)) {
            coalesceData.lastComment = comment;
            return coalesceData;
          }
          last.text += "\n" + comment.text;
          last.end = comment.end;
          lang.arr.remove(blockNode.comments, comment);
          lang.arr.remove(commentData.comments, comment);
          return coalesceData;
        }, {lastComment: null});
      });
      return commentData;
    }
  }
  function parseFunction(source, options) {
    options = options || {};
    options.ecmaVersion = 6;
    options.sourceType = options.sourceType || "module";
    options.plugins = options.plugins || {};
    if (options.plugins.hasOwnProperty("jsx"))
      options.plugins.jsx = options.plugins.jsx;
    var src = '(' + source + ')',
        ast = acorn.parse(src);
    acorn.walk.addSource(ast, src);
    return ast.body[0].expression;
  }
  function parseLikeOMeta(src, rule) {
    var self = this;
    function parse(source) {
      return acorn.walk.toLKObjects(self.parse(source));
    }
    var ast;
    switch (rule) {
      case 'expr':
      case 'stmt':
      case 'functionDef':
        ast = parse(src);
        if (ast.isSequence && (ast.children.length == 1)) {
          ast = ast.children[0];
          ast.setParent(undefined);
        }
        break;
      case 'memberFragment':
        src = '({' + src + '})';
        ast = parse(src);
        ast = ast.children[0].properties[0];
        ast.setParent(undefined);
        break;
      case 'categoryFragment':
      case 'traitFragment':
        src = '[' + src + ']';
        ast = parse(src);
        ast = ast.children[0];
        ast.setParent(undefined);
        break;
      default:
        ast = parse(src);
    }
    ast.source = src;
    return ast;
  }
  function fuzzyParse(source, options) {
    options = options || {};
    options.ecmaVersion = options.ecmaVersion || 6;
    options.sourceType = options.sourceType || "module";
    options.plugins = options.plugins || {};
    if (options.plugins.hasOwnProperty("jsx"))
      options.plugins.jsx = options.plugins.jsx;
    var ast,
        safeSource,
        err;
    if (options.type === 'LabeledStatement') {
      safeSource = '$={' + source + '}';
    }
    try {
      ast = parse(safeSource || source, options);
      if (safeSource)
        ast = null;
      else if (options.addSource)
        acorn.walk.addSource(ast, source);
    } catch (e) {
      err = e;
    }
    if (err && err.raisedAt !== undefined) {
      if (safeSource) {
        err.pos -= 3;
        err.raisedAt -= 3;
        err.loc.column -= 3;
      }
      var parseErrorSource = '';
      parseErrorSource += source.slice(err.raisedAt - 20, err.raisedAt);
      parseErrorSource += '<-error->';
      parseErrorSource += source.slice(err.raisedAt, err.raisedAt + 20);
      options.verbose && show('parse error: ' + parseErrorSource);
      err.parseErrorSource = parseErrorSource;
    } else if (err && options.verbose) {
      show('' + err + err.stack);
    }
    if (!ast) {
      ast = acorn.parse_dammit(source, options);
      if (options.addSource)
        acorn.walk.addSource(ast, source);
      ast.isFuzzy = true;
      ast.parseError = err;
    }
    return ast;
  }
  function nodesAt(pos, ast) {
    ast = typeof ast === 'string' ? this.parse(ast) : ast;
    return acorn.walk.findNodesIncluding(ast, pos);
  }
  return module.exports;
});
