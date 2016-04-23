System.registerDynamic('acorn/package.json', [], false, function(require, exports, module) {
return {
  "name": "acorn",
  "description": "ECMAScript parser",
  "homepage": "https://github.com/ternjs/acorn",
  "main": "dist/acorn.js",
  "version": "3.0.4",
  "engines": {
    "node": ">=0.4.0"
  },
  "maintainers": [
    {
      "name": "Marijn Haverbeke",
      "email": "marijnh@gmail.com",
      "web": "http://marijnhaverbeke.nl"
    },
    {
      "name": "Ingvar Stepanyan",
      "email": "me@rreverser.com",
      "web": "http://rreverser.com/"
    }
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/ternjs/acorn.git"
  },
  "license": "MIT",
  "scripts": {
    "prepublish": "node bin/build-acorn.js",
    "test": "node test/run.js"
  },
  "bin": {
    "acorn": "./bin/acorn"
  },
  "devDependencies": {
    "babel-core": "^5.6.15",
    "babelify": "^6.1.2",
    "browserify": "^10.2.4",
    "browserify-derequire": "^0.9.4",
    "unicode-8.0.0": "^0.1.5"
  }
}

});

System.register('acorn/src/index.js', [
    './state',
    './parseutil',
    './statement',
    './lval',
    './expression',
    './location',
    './options',
    './locutil',
    './node',
    './tokentype',
    './tokencontext',
    './identifier',
    './tokenize',
    './whitespace'
], function (_export) {
    'use strict';
    var Parser, version;
    _export('parse', parse);
    _export('parseExpressionAt', parseExpressionAt);
    _export('tokenizer', tokenizer);
    function parse(input, options) {
        return new Parser(options, input).parse();
    }
    function parseExpressionAt(input, pos, options) {
        var p = new Parser(options, input, pos);
        p.nextToken();
        return p.parseExpression();
    }
    function tokenizer(input, options) {
        return new Parser(options, input);
    }
    return {
        setters: [
            function (_state) {
                Parser = _state.Parser;
                _export('Parser', _state.Parser);
                _export('plugins', _state.plugins);
            },
            function (_parseutil) {
            },
            function (_statement) {
            },
            function (_lval) {
            },
            function (_expression) {
            },
            function (_location) {
            },
            function (_options) {
                _export('defaultOptions', _options.defaultOptions);
            },
            function (_locutil) {
                _export('Position', _locutil.Position);
                _export('SourceLocation', _locutil.SourceLocation);
                _export('getLineInfo', _locutil.getLineInfo);
            },
            function (_node) {
                _export('Node', _node.Node);
            },
            function (_tokentype) {
                _export('TokenType', _tokentype.TokenType);
                _export('tokTypes', _tokentype.types);
            },
            function (_tokencontext) {
                _export('TokContext', _tokencontext.TokContext);
                _export('tokContexts', _tokencontext.types);
            },
            function (_identifier) {
                _export('isIdentifierChar', _identifier.isIdentifierChar);
                _export('isIdentifierStart', _identifier.isIdentifierStart);
            },
            function (_tokenize) {
                _export('Token', _tokenize.Token);
            },
            function (_whitespace) {
                _export('isNewLine', _whitespace.isNewLine);
                _export('lineBreak', _whitespace.lineBreak);
                _export('lineBreakG', _whitespace.lineBreakG);
            }
        ],
        execute: function () {
            version = '3.0.4';
            _export('version', version);
        }
    };
})
System.register('acorn/src/walk/index.js', [], function (_export) {
    'use strict';
    var Found, base;
    _export('simple', simple);
    _export('ancestor', ancestor);
    _export('recursive', recursive);
    _export('findNodeAt', findNodeAt);
    _export('findNodeAround', findNodeAround);
    _export('findNodeAfter', findNodeAfter);
    _export('findNodeBefore', findNodeBefore);
    _export('make', make);
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    function simple(node, visitors, base, state, override) {
        if (!base)
            base = exports.base;
        (function c(node, st, override) {
            var type = override || node.type, found = visitors[type];
            base[type](node, st, c);
            if (found)
                found(node, st);
        }(node, state, override));
    }
    function ancestor(node, visitors, base, state) {
        if (!base)
            base = exports.base;
        if (!state)
            state = [];
        (function c(node, st, override) {
            var type = override || node.type, found = visitors[type];
            if (node != st[st.length - 1]) {
                st = st.slice();
                st.push(node);
            }
            base[type](node, st, c);
            if (found)
                found(node, st);
        }(node, state));
    }
    function recursive(node, state, funcs, base, override) {
        var visitor = funcs ? exports.make(funcs, base) : base;
        (function c(node, st, override) {
            visitor[override || node.type](node, st, c);
        }(node, state, override));
    }
    function makeTest(test) {
        if (typeof test == 'string')
            return function (type) {
                return type == test;
            };
        else if (!test)
            return function () {
                return true;
            };
        else
            return test;
    }
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
            }(node, state));
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
            }(node, state));
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
            }(node, state));
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
        }(node, state));
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
    function ignore(_node, _st, _c) {
    }
    return {
        setters: [],
        execute: function () {
            Found = function Found(node, state) {
                _classCallCheck(this, Found);
                this.node = node;
                this.state = state;
            };
            base = {};
            _export('base', base);
            base.Program = base.BlockStatement = function (node, st, c) {
                for (var i = 0; i < node.body.length; ++i) {
                    c(node.body[i], st, 'Statement');
                }
            };
            base.Statement = skipThrough;
            base.EmptyStatement = ignore;
            base.ExpressionStatement = base.ParenthesizedExpression = function (node, st, c) {
                return c(node.expression, st, 'Expression');
            };
            base.IfStatement = function (node, st, c) {
                c(node.test, st, 'Expression');
                c(node.consequent, st, 'Statement');
                if (node.alternate)
                    c(node.alternate, st, 'Statement');
            };
            base.LabeledStatement = function (node, st, c) {
                return c(node.body, st, 'Statement');
            };
            base.BreakStatement = base.ContinueStatement = ignore;
            base.WithStatement = function (node, st, c) {
                c(node.object, st, 'Expression');
                c(node.body, st, 'Statement');
            };
            base.SwitchStatement = function (node, st, c) {
                c(node.discriminant, st, 'Expression');
                for (var i = 0; i < node.cases.length; ++i) {
                    var cs = node.cases[i];
                    if (cs.test)
                        c(cs.test, st, 'Expression');
                    for (var j = 0; j < cs.consequent.length; ++j) {
                        c(cs.consequent[j], st, 'Statement');
                    }
                }
            };
            base.ReturnStatement = base.YieldExpression = function (node, st, c) {
                if (node.argument)
                    c(node.argument, st, 'Expression');
            };
            base.ThrowStatement = base.SpreadElement = function (node, st, c) {
                return c(node.argument, st, 'Expression');
            };
            base.TryStatement = function (node, st, c) {
                c(node.block, st, 'Statement');
                if (node.handler) {
                    c(node.handler.param, st, 'Pattern');
                    c(node.handler.body, st, 'ScopeBody');
                }
                if (node.finalizer)
                    c(node.finalizer, st, 'Statement');
            };
            base.WhileStatement = base.DoWhileStatement = function (node, st, c) {
                c(node.test, st, 'Expression');
                c(node.body, st, 'Statement');
            };
            base.ForStatement = function (node, st, c) {
                if (node.init)
                    c(node.init, st, 'ForInit');
                if (node.test)
                    c(node.test, st, 'Expression');
                if (node.update)
                    c(node.update, st, 'Expression');
                c(node.body, st, 'Statement');
            };
            base.ForInStatement = base.ForOfStatement = function (node, st, c) {
                c(node.left, st, 'ForInit');
                c(node.right, st, 'Expression');
                c(node.body, st, 'Statement');
            };
            base.ForInit = function (node, st, c) {
                if (node.type == 'VariableDeclaration')
                    c(node, st);
                else
                    c(node, st, 'Expression');
            };
            base.DebuggerStatement = ignore;
            base.FunctionDeclaration = function (node, st, c) {
                return c(node, st, 'Function');
            };
            base.VariableDeclaration = function (node, st, c) {
                for (var i = 0; i < node.declarations.length; ++i) {
                    c(node.declarations[i], st);
                }
            };
            base.VariableDeclarator = function (node, st, c) {
                c(node.id, st, 'Pattern');
                if (node.init)
                    c(node.init, st, 'Expression');
            };
            base.Function = function (node, st, c) {
                if (node.id)
                    c(node.id, st, 'Pattern');
                for (var i = 0; i < node.params.length; i++) {
                    c(node.params[i], st, 'Pattern');
                }
                c(node.body, st, node.expression ? 'ScopeExpression' : 'ScopeBody');
            };
            base.ScopeBody = function (node, st, c) {
                return c(node, st, 'Statement');
            };
            base.ScopeExpression = function (node, st, c) {
                return c(node, st, 'Expression');
            };
            base.Pattern = function (node, st, c) {
                if (node.type == 'Identifier')
                    c(node, st, 'VariablePattern');
                else if (node.type == 'MemberExpression')
                    c(node, st, 'MemberPattern');
                else
                    c(node, st);
            };
            base.VariablePattern = ignore;
            base.MemberPattern = skipThrough;
            base.RestElement = function (node, st, c) {
                return c(node.argument, st, 'Pattern');
            };
            base.ArrayPattern = function (node, st, c) {
                for (var i = 0; i < node.elements.length; ++i) {
                    var elt = node.elements[i];
                    if (elt)
                        c(elt, st, 'Pattern');
                }
            };
            base.ObjectPattern = function (node, st, c) {
                for (var i = 0; i < node.properties.length; ++i) {
                    c(node.properties[i].value, st, 'Pattern');
                }
            };
            base.Expression = skipThrough;
            base.ThisExpression = base.Super = base.MetaProperty = ignore;
            base.ArrayExpression = function (node, st, c) {
                for (var i = 0; i < node.elements.length; ++i) {
                    var elt = node.elements[i];
                    if (elt)
                        c(elt, st, 'Expression');
                }
            };
            base.ObjectExpression = function (node, st, c) {
                for (var i = 0; i < node.properties.length; ++i) {
                    c(node.properties[i], st);
                }
            };
            base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
            base.SequenceExpression = base.TemplateLiteral = function (node, st, c) {
                for (var i = 0; i < node.expressions.length; ++i) {
                    c(node.expressions[i], st, 'Expression');
                }
            };
            base.UnaryExpression = base.UpdateExpression = function (node, st, c) {
                c(node.argument, st, 'Expression');
            };
            base.BinaryExpression = base.LogicalExpression = function (node, st, c) {
                c(node.left, st, 'Expression');
                c(node.right, st, 'Expression');
            };
            base.AssignmentExpression = base.AssignmentPattern = function (node, st, c) {
                c(node.left, st, 'Pattern');
                c(node.right, st, 'Expression');
            };
            base.ConditionalExpression = function (node, st, c) {
                c(node.test, st, 'Expression');
                c(node.consequent, st, 'Expression');
                c(node.alternate, st, 'Expression');
            };
            base.NewExpression = base.CallExpression = function (node, st, c) {
                c(node.callee, st, 'Expression');
                if (node.arguments)
                    for (var i = 0; i < node.arguments.length; ++i) {
                        c(node.arguments[i], st, 'Expression');
                    }
            };
            base.MemberExpression = function (node, st, c) {
                c(node.object, st, 'Expression');
                if (node.computed)
                    c(node.property, st, 'Expression');
            };
            base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function (node, st, c) {
                if (node.declaration)
                    c(node.declaration, st, node.type == 'ExportNamedDeclaration' || node.declaration.id ? 'Statement' : 'Expression');
                if (node.source)
                    c(node.source, st, 'Expression');
            };
            base.ExportAllDeclaration = function (node, st, c) {
                c(node.source, st, 'Expression');
            };
            base.ImportDeclaration = function (node, st, c) {
                for (var i = 0; i < node.specifiers.length; i++) {
                    c(node.specifiers[i], st);
                }
                c(node.source, st, 'Expression');
            };
            base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.Literal = ignore;
            base.TaggedTemplateExpression = function (node, st, c) {
                c(node.tag, st, 'Expression');
                c(node.quasi, st);
            };
            base.ClassDeclaration = base.ClassExpression = function (node, st, c) {
                return c(node, st, 'Class');
            };
            base.Class = function (node, st, c) {
                if (node.id)
                    c(node.id, st, 'Pattern');
                if (node.superClass)
                    c(node.superClass, st, 'Expression');
                for (var i = 0; i < node.body.body.length; i++) {
                    c(node.body.body[i], st);
                }
            };
            base.MethodDefinition = base.Property = function (node, st, c) {
                if (node.computed)
                    c(node.key, st, 'Expression');
                c(node.value, st, 'Expression');
            };
        }
    };
})
System.register('acorn/src/loose/index.js', [
    '..',
    './state',
    './tokenize',
    './statement',
    './expression'
], function (_export) {
    'use strict';
    var acorn, LooseParser, pluginsLoose;
    _export('parse_dammit', parse_dammit);
    function parse_dammit(input, options) {
        var p = new LooseParser(input, options);
        p.next();
        return p.parseTopLevel();
    }
    return {
        setters: [
            function (_) {
                acorn = _;
            },
            function (_state) {
                LooseParser = _state.LooseParser;
                pluginsLoose = _state.pluginsLoose;
                _export('LooseParser', _state.LooseParser);
                _export('pluginsLoose', _state.pluginsLoose);
            },
            function (_tokenize) {
            },
            function (_statement) {
            },
            function (_expression) {
            }
        ],
        execute: function () {
            acorn.defaultOptions.tabSize = 4;
            acorn.parse_dammit = parse_dammit;
            acorn.LooseParser = LooseParser;
            acorn.pluginsLoose = pluginsLoose;
        }
    };
})
System.register('acorn/src/state.js', [
    './identifier',
    './tokentype',
    './whitespace',
    './options'
], function (_export) {
    'use strict';
    var reservedWords, keywords, tt, lineBreak, getOptions, plugins, Parser;
    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ('value' in descriptor)
                    descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }
        return function (Constructor, protoProps, staticProps) {
            if (protoProps)
                defineProperties(Constructor.prototype, protoProps);
            if (staticProps)
                defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    function keywordRegexp(words) {
        return new RegExp('^(' + words.replace(/ /g, '|') + ')$');
    }
    return {
        setters: [
            function (_identifier) {
                reservedWords = _identifier.reservedWords;
                keywords = _identifier.keywords;
            },
            function (_tokentype) {
                tt = _tokentype.types;
            },
            function (_whitespace) {
                lineBreak = _whitespace.lineBreak;
            },
            function (_options) {
                getOptions = _options.getOptions;
            }
        ],
        execute: function () {
            plugins = {};
            _export('plugins', plugins);
            Parser = function () {
                function Parser(options, input, startPos) {
                    _classCallCheck(this, Parser);
                    this.options = options = getOptions(options);
                    this.sourceFile = options.sourceFile;
                    this.keywords = keywordRegexp(keywords[options.ecmaVersion >= 6 ? 6 : 5]);
                    var reserved = options.allowReserved ? '' : reservedWords[options.ecmaVersion] + (options.sourceType == 'module' ? ' await' : '');
                    this.reservedWords = keywordRegexp(reserved);
                    var reservedStrict = (reserved ? reserved + ' ' : '') + reservedWords.strict;
                    this.reservedWordsStrict = keywordRegexp(reservedStrict);
                    this.reservedWordsStrictBind = keywordRegexp(reservedStrict + ' ' + reservedWords.strictBind);
                    this.input = String(input);
                    this.containsEsc = false;
                    this.loadPlugins(options.plugins);
                    if (startPos) {
                        this.pos = startPos;
                        this.lineStart = Math.max(0, this.input.lastIndexOf('\n', startPos));
                        this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
                    } else {
                        this.pos = this.lineStart = 0;
                        this.curLine = 1;
                    }
                    this.type = tt.eof;
                    this.value = null;
                    this.start = this.end = this.pos;
                    this.startLoc = this.endLoc = this.curPosition();
                    this.lastTokEndLoc = this.lastTokStartLoc = null;
                    this.lastTokStart = this.lastTokEnd = this.pos;
                    this.context = this.initialContext();
                    this.exprAllowed = true;
                    this.strict = this.inModule = options.sourceType === 'module';
                    this.potentialArrowAt = -1;
                    this.inFunction = this.inGenerator = false;
                    this.labels = [];
                    if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === '#!')
                        this.skipLineComment(2);
                }
                _createClass(Parser, [
                    {
                        key: 'isKeyword',
                        value: function isKeyword(word) {
                            return this.keywords.test(word);
                        }
                    },
                    {
                        key: 'isReservedWord',
                        value: function isReservedWord(word) {
                            return this.reservedWords.test(word);
                        }
                    },
                    {
                        key: 'extend',
                        value: function extend(name, f) {
                            this[name] = f(this[name]);
                        }
                    },
                    {
                        key: 'loadPlugins',
                        value: function loadPlugins(pluginConfigs) {
                            for (var _name in pluginConfigs) {
                                var plugin = plugins[_name];
                                if (!plugin)
                                    throw new Error('Plugin \'' + _name + '\' not found');
                                plugin(this, pluginConfigs[_name]);
                            }
                        }
                    },
                    {
                        key: 'parse',
                        value: function parse() {
                            var node = this.options.program || this.startNode();
                            this.nextToken();
                            return this.parseTopLevel(node);
                        }
                    }
                ]);
                return Parser;
            }();
            _export('Parser', Parser);
        }
    };
})
System.register('acorn/src/parseutil.js', [
    './tokentype',
    './state',
    './whitespace'
], function (_export) {
    'use strict';
    var tt, Parser, lineBreak, pp;
    return {
        setters: [
            function (_tokentype) {
                tt = _tokentype.types;
            },
            function (_state) {
                Parser = _state.Parser;
            },
            function (_whitespace) {
                lineBreak = _whitespace.lineBreak;
            }
        ],
        execute: function () {
            pp = Parser.prototype;
            pp.isUseStrict = function (stmt) {
                return this.options.ecmaVersion >= 5 && stmt.type === 'ExpressionStatement' && stmt.expression.type === 'Literal' && stmt.expression.raw.slice(1, -1) === 'use strict';
            };
            pp.eat = function (type) {
                if (this.type === type) {
                    this.next();
                    return true;
                } else {
                    return false;
                }
            };
            pp.isContextual = function (name) {
                return this.type === tt.name && this.value === name;
            };
            pp.eatContextual = function (name) {
                return this.value === name && this.eat(tt.name);
            };
            pp.expectContextual = function (name) {
                if (!this.eatContextual(name))
                    this.unexpected();
            };
            pp.canInsertSemicolon = function () {
                return this.type === tt.eof || this.type === tt.braceR || lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
            };
            pp.insertSemicolon = function () {
                if (this.canInsertSemicolon()) {
                    if (this.options.onInsertedSemicolon)
                        this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
                    return true;
                }
            };
            pp.semicolon = function () {
                if (!this.eat(tt.semi) && !this.insertSemicolon())
                    this.unexpected();
            };
            pp.afterTrailingComma = function (tokType) {
                if (this.type == tokType) {
                    if (this.options.onTrailingComma)
                        this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
                    this.next();
                    return true;
                }
            };
            pp.expect = function (type) {
                this.eat(type) || this.unexpected();
            };
            pp.unexpected = function (pos) {
                this.raise(pos != null ? pos : this.start, 'Unexpected token');
            };
            pp.checkPatternErrors = function (refDestructuringErrors, andThrow) {
                var pos = refDestructuringErrors && refDestructuringErrors.trailingComma;
                if (!andThrow)
                    return !!pos;
                if (pos)
                    this.raise(pos, 'Trailing comma is not permitted in destructuring patterns');
            };
            pp.checkExpressionErrors = function (refDestructuringErrors, andThrow) {
                var pos = refDestructuringErrors && refDestructuringErrors.shorthandAssign;
                if (!andThrow)
                    return !!pos;
                if (pos)
                    this.raise(pos, 'Shorthand property assignments are valid only in destructuring patterns');
            };
        }
    };
})
System.register('acorn/src/statement.js', [
    './tokentype',
    './state',
    './whitespace',
    './identifier'
], function (_export) {
    'use strict';
    var tt, Parser, lineBreak, skipWhiteSpace, isIdentifierStart, isIdentifierChar, pp, loopLabel, switchLabel, empty;
    return {
        setters: [
            function (_tokentype) {
                tt = _tokentype.types;
            },
            function (_state) {
                Parser = _state.Parser;
            },
            function (_whitespace) {
                lineBreak = _whitespace.lineBreak;
                skipWhiteSpace = _whitespace.skipWhiteSpace;
            },
            function (_identifier) {
                isIdentifierStart = _identifier.isIdentifierStart;
                isIdentifierChar = _identifier.isIdentifierChar;
            }
        ],
        execute: function () {
            pp = Parser.prototype;
            pp.parseTopLevel = function (node) {
                var first = true;
                if (!node.body)
                    node.body = [];
                while (this.type !== tt.eof) {
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
                return this.finishNode(node, 'Program');
            };
            loopLabel = { kind: 'loop' };
            switchLabel = { kind: 'switch' };
            pp.isLet = function () {
                if (this.type !== tt.name || this.options.ecmaVersion < 6 || this.value != 'let')
                    return false;
                skipWhiteSpace.lastIndex = this.pos;
                var skip = skipWhiteSpace.exec(this.input);
                var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
                if (nextCh === 91 || nextCh == 123)
                    return true;
                if (isIdentifierStart(nextCh, true)) {
                    for (var pos = next + 1; isIdentifierChar(this.input.charCodeAt(pos, true)); ++pos) {
                    }
                    var ident = this.input.slice(next, pos);
                    if (!this.isKeyword(ident))
                        return true;
                }
                return false;
            };
            pp.parseStatement = function (declaration, topLevel) {
                var starttype = this.type, node = this.startNode(), kind = undefined;
                if (this.isLet()) {
                    starttype = tt._var;
                    kind = 'let';
                }
                switch (starttype) {
                case tt._break:
                case tt._continue:
                    return this.parseBreakContinueStatement(node, starttype.keyword);
                case tt._debugger:
                    return this.parseDebuggerStatement(node);
                case tt._do:
                    return this.parseDoStatement(node);
                case tt._for:
                    return this.parseForStatement(node);
                case tt._function:
                    if (!declaration && this.options.ecmaVersion >= 6)
                        this.unexpected();
                    return this.parseFunctionStatement(node);
                case tt._class:
                    if (!declaration)
                        this.unexpected();
                    return this.parseClass(node, true);
                case tt._if:
                    return this.parseIfStatement(node);
                case tt._return:
                    return this.parseReturnStatement(node);
                case tt._switch:
                    return this.parseSwitchStatement(node);
                case tt._throw:
                    return this.parseThrowStatement(node);
                case tt._try:
                    return this.parseTryStatement(node);
                case tt._const:
                case tt._var:
                    kind = kind || this.value;
                    if (!declaration && kind != 'var')
                        this.unexpected();
                    return this.parseVarStatement(node, kind);
                case tt._while:
                    return this.parseWhileStatement(node);
                case tt._with:
                    return this.parseWithStatement(node);
                case tt.braceL:
                    return this.parseBlock();
                case tt.semi:
                    return this.parseEmptyStatement(node);
                case tt._export:
                case tt._import:
                    if (!this.options.allowImportExportEverywhere) {
                        if (!topLevel)
                            this.raise(this.start, '\'import\' and \'export\' may only appear at the top level');
                        if (!this.inModule)
                            this.raise(this.start, '\'import\' and \'export\' may appear only with \'sourceType: module\'');
                    }
                    return starttype === tt._import ? this.parseImport(node) : this.parseExport(node);
                default:
                    var maybeName = this.value, expr = this.parseExpression();
                    if (starttype === tt.name && expr.type === 'Identifier' && this.eat(tt.colon))
                        return this.parseLabeledStatement(node, maybeName, expr);
                    else
                        return this.parseExpressionStatement(node, expr);
                }
            };
            pp.parseBreakContinueStatement = function (node, keyword) {
                var isBreak = keyword == 'break';
                this.next();
                if (this.eat(tt.semi) || this.insertSemicolon())
                    node.label = null;
                else if (this.type !== tt.name)
                    this.unexpected();
                else {
                    node.label = this.parseIdent();
                    this.semicolon();
                }
                for (var i = 0; i < this.labels.length; ++i) {
                    var lab = this.labels[i];
                    if (node.label == null || lab.name === node.label.name) {
                        if (lab.kind != null && (isBreak || lab.kind === 'loop'))
                            break;
                        if (node.label && isBreak)
                            break;
                    }
                }
                if (i === this.labels.length)
                    this.raise(node.start, 'Unsyntactic ' + keyword);
                return this.finishNode(node, isBreak ? 'BreakStatement' : 'ContinueStatement');
            };
            pp.parseDebuggerStatement = function (node) {
                this.next();
                this.semicolon();
                return this.finishNode(node, 'DebuggerStatement');
            };
            pp.parseDoStatement = function (node) {
                this.next();
                this.labels.push(loopLabel);
                node.body = this.parseStatement(false);
                this.labels.pop();
                this.expect(tt._while);
                node.test = this.parseParenExpression();
                if (this.options.ecmaVersion >= 6)
                    this.eat(tt.semi);
                else
                    this.semicolon();
                return this.finishNode(node, 'DoWhileStatement');
            };
            pp.parseForStatement = function (node) {
                this.next();
                this.labels.push(loopLabel);
                this.expect(tt.parenL);
                if (this.type === tt.semi)
                    return this.parseFor(node, null);
                var isLet = this.isLet();
                if (this.type === tt._var || this.type === tt._const || isLet) {
                    var _init = this.startNode(), kind = isLet ? 'let' : this.value;
                    this.next();
                    this.parseVar(_init, true, kind);
                    this.finishNode(_init, 'VariableDeclaration');
                    if ((this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual('of')) && _init.declarations.length === 1 && !(kind !== 'var' && _init.declarations[0].init))
                        return this.parseForIn(node, _init);
                    return this.parseFor(node, _init);
                }
                var refDestructuringErrors = {
                    shorthandAssign: 0,
                    trailingComma: 0
                };
                var init = this.parseExpression(true, refDestructuringErrors);
                if (this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual('of')) {
                    this.checkPatternErrors(refDestructuringErrors, true);
                    this.toAssignable(init);
                    this.checkLVal(init);
                    return this.parseForIn(node, init);
                } else {
                    this.checkExpressionErrors(refDestructuringErrors, true);
                }
                return this.parseFor(node, init);
            };
            pp.parseFunctionStatement = function (node) {
                this.next();
                return this.parseFunction(node, true);
            };
            pp.parseIfStatement = function (node) {
                this.next();
                node.test = this.parseParenExpression();
                node.consequent = this.parseStatement(false);
                node.alternate = this.eat(tt._else) ? this.parseStatement(false) : null;
                return this.finishNode(node, 'IfStatement');
            };
            pp.parseReturnStatement = function (node) {
                if (!this.inFunction && !this.options.allowReturnOutsideFunction)
                    this.raise(this.start, '\'return\' outside of function');
                this.next();
                if (this.eat(tt.semi) || this.insertSemicolon())
                    node.argument = null;
                else {
                    node.argument = this.parseExpression();
                    this.semicolon();
                }
                return this.finishNode(node, 'ReturnStatement');
            };
            pp.parseSwitchStatement = function (node) {
                this.next();
                node.discriminant = this.parseParenExpression();
                node.cases = [];
                this.expect(tt.braceL);
                this.labels.push(switchLabel);
                for (var cur, sawDefault = false; this.type != tt.braceR;) {
                    if (this.type === tt._case || this.type === tt._default) {
                        var isCase = this.type === tt._case;
                        if (cur)
                            this.finishNode(cur, 'SwitchCase');
                        node.cases.push(cur = this.startNode());
                        cur.consequent = [];
                        this.next();
                        if (isCase) {
                            cur.test = this.parseExpression();
                        } else {
                            if (sawDefault)
                                this.raiseRecoverable(this.lastTokStart, 'Multiple default clauses');
                            sawDefault = true;
                            cur.test = null;
                        }
                        this.expect(tt.colon);
                    } else {
                        if (!cur)
                            this.unexpected();
                        cur.consequent.push(this.parseStatement(true));
                    }
                }
                if (cur)
                    this.finishNode(cur, 'SwitchCase');
                this.next();
                this.labels.pop();
                return this.finishNode(node, 'SwitchStatement');
            };
            pp.parseThrowStatement = function (node) {
                this.next();
                if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))
                    this.raise(this.lastTokEnd, 'Illegal newline after throw');
                node.argument = this.parseExpression();
                this.semicolon();
                return this.finishNode(node, 'ThrowStatement');
            };
            empty = [];
            pp.parseTryStatement = function (node) {
                this.next();
                node.block = this.parseBlock();
                node.handler = null;
                if (this.type === tt._catch) {
                    var clause = this.startNode();
                    this.next();
                    this.expect(tt.parenL);
                    clause.param = this.parseBindingAtom();
                    this.checkLVal(clause.param, true);
                    this.expect(tt.parenR);
                    clause.body = this.parseBlock();
                    node.handler = this.finishNode(clause, 'CatchClause');
                }
                node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;
                if (!node.handler && !node.finalizer)
                    this.raise(node.start, 'Missing catch or finally clause');
                return this.finishNode(node, 'TryStatement');
            };
            pp.parseVarStatement = function (node, kind) {
                this.next();
                this.parseVar(node, false, kind);
                this.semicolon();
                return this.finishNode(node, 'VariableDeclaration');
            };
            pp.parseWhileStatement = function (node) {
                this.next();
                node.test = this.parseParenExpression();
                this.labels.push(loopLabel);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, 'WhileStatement');
            };
            pp.parseWithStatement = function (node) {
                if (this.strict)
                    this.raise(this.start, '\'with\' in strict mode');
                this.next();
                node.object = this.parseParenExpression();
                node.body = this.parseStatement(false);
                return this.finishNode(node, 'WithStatement');
            };
            pp.parseEmptyStatement = function (node) {
                this.next();
                return this.finishNode(node, 'EmptyStatement');
            };
            pp.parseLabeledStatement = function (node, maybeName, expr) {
                for (var i = 0; i < this.labels.length; ++i) {
                    if (this.labels[i].name === maybeName)
                        this.raise(expr.start, 'Label \'' + maybeName + '\' is already declared');
                }
                var kind = this.type.isLoop ? 'loop' : this.type === tt._switch ? 'switch' : null;
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
                return this.finishNode(node, 'LabeledStatement');
            };
            pp.parseExpressionStatement = function (node, expr) {
                node.expression = expr;
                this.semicolon();
                return this.finishNode(node, 'ExpressionStatement');
            };
            pp.parseBlock = function (allowStrict) {
                var node = this.startNode(), first = true, oldStrict = undefined;
                node.body = [];
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
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
                return this.finishNode(node, 'BlockStatement');
            };
            pp.parseFor = function (node, init) {
                node.init = init;
                this.expect(tt.semi);
                node.test = this.type === tt.semi ? null : this.parseExpression();
                this.expect(tt.semi);
                node.update = this.type === tt.parenR ? null : this.parseExpression();
                this.expect(tt.parenR);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, 'ForStatement');
            };
            pp.parseForIn = function (node, init) {
                var type = this.type === tt._in ? 'ForInStatement' : 'ForOfStatement';
                this.next();
                node.left = init;
                node.right = this.parseExpression();
                this.expect(tt.parenR);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, type);
            };
            pp.parseVar = function (node, isFor, kind) {
                node.declarations = [];
                node.kind = kind;
                for (;;) {
                    var decl = this.startNode();
                    this.parseVarId(decl);
                    if (this.eat(tt.eq)) {
                        decl.init = this.parseMaybeAssign(isFor);
                    } else if (kind === 'const' && !(this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual('of'))) {
                        this.unexpected();
                    } else if (decl.id.type != 'Identifier' && !(isFor && (this.type === tt._in || this.isContextual('of')))) {
                        this.raise(this.lastTokEnd, 'Complex binding patterns require an initialization value');
                    } else {
                        decl.init = null;
                    }
                    node.declarations.push(this.finishNode(decl, 'VariableDeclarator'));
                    if (!this.eat(tt.comma))
                        break;
                }
                return node;
            };
            pp.parseVarId = function (decl) {
                decl.id = this.parseBindingAtom();
                this.checkLVal(decl.id, true);
            };
            pp.parseFunction = function (node, isStatement, allowExpressionBody) {
                this.initFunction(node);
                if (this.options.ecmaVersion >= 6)
                    node.generator = this.eat(tt.star);
                var oldInGen = this.inGenerator;
                this.inGenerator = node.generator;
                if (isStatement || this.type === tt.name)
                    node.id = this.parseIdent();
                this.parseFunctionParams(node);
                this.parseFunctionBody(node, allowExpressionBody);
                this.inGenerator = oldInGen;
                return this.finishNode(node, isStatement ? 'FunctionDeclaration' : 'FunctionExpression');
            };
            pp.parseFunctionParams = function (node) {
                this.expect(tt.parenL);
                node.params = this.parseBindingList(tt.parenR, false, false, true);
            };
            pp.parseClass = function (node, isStatement) {
                this.next();
                this.parseClassId(node, isStatement);
                this.parseClassSuper(node);
                var classBody = this.startNode();
                var hadConstructor = false;
                classBody.body = [];
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (this.eat(tt.semi))
                        continue;
                    var method = this.startNode();
                    var isGenerator = this.eat(tt.star);
                    var isMaybeStatic = this.type === tt.name && this.value === 'static';
                    this.parsePropertyName(method);
                    method['static'] = isMaybeStatic && this.type !== tt.parenL;
                    if (method['static']) {
                        if (isGenerator)
                            this.unexpected();
                        isGenerator = this.eat(tt.star);
                        this.parsePropertyName(method);
                    }
                    method.kind = 'method';
                    var isGetSet = false;
                    if (!method.computed) {
                        var key = method.key;
                        if (!isGenerator && key.type === 'Identifier' && this.type !== tt.parenL && (key.name === 'get' || key.name === 'set')) {
                            isGetSet = true;
                            method.kind = key.name;
                            key = this.parsePropertyName(method);
                        }
                        if (!method['static'] && (key.type === 'Identifier' && key.name === 'constructor' || key.type === 'Literal' && key.value === 'constructor')) {
                            if (hadConstructor)
                                this.raise(key.start, 'Duplicate constructor in the same class');
                            if (isGetSet)
                                this.raise(key.start, 'Constructor can\'t have get/set modifier');
                            if (isGenerator)
                                this.raise(key.start, 'Constructor can\'t be a generator');
                            method.kind = 'constructor';
                            hadConstructor = true;
                        }
                    }
                    this.parseClassMethod(classBody, method, isGenerator);
                    if (isGetSet) {
                        var paramCount = method.kind === 'get' ? 0 : 1;
                        if (method.value.params.length !== paramCount) {
                            var start = method.value.start;
                            if (method.kind === 'get')
                                this.raiseRecoverable(start, 'getter should have no params');
                            else
                                this.raiseRecoverable(start, 'setter should have exactly one param');
                        }
                        if (method.kind === 'set' && method.value.params[0].type === 'RestElement')
                            this.raise(method.value.params[0].start, 'Setter cannot use rest params');
                    }
                }
                node.body = this.finishNode(classBody, 'ClassBody');
                return this.finishNode(node, isStatement ? 'ClassDeclaration' : 'ClassExpression');
            };
            pp.parseClassMethod = function (classBody, method, isGenerator) {
                method.value = this.parseMethod(isGenerator);
                classBody.body.push(this.finishNode(method, 'MethodDefinition'));
            };
            pp.parseClassId = function (node, isStatement) {
                node.id = this.type === tt.name ? this.parseIdent() : isStatement ? this.unexpected() : null;
            };
            pp.parseClassSuper = function (node) {
                node.superClass = this.eat(tt._extends) ? this.parseExprSubscripts() : null;
            };
            pp.parseExport = function (node) {
                this.next();
                if (this.eat(tt.star)) {
                    this.expectContextual('from');
                    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
                    this.semicolon();
                    return this.finishNode(node, 'ExportAllDeclaration');
                }
                if (this.eat(tt._default)) {
                    var parens = this.type == tt.parenL;
                    var expr = this.parseMaybeAssign();
                    var needsSemi = true;
                    if (!parens && (expr.type == 'FunctionExpression' || expr.type == 'ClassExpression')) {
                        needsSemi = false;
                        if (expr.id) {
                            expr.type = expr.type == 'FunctionExpression' ? 'FunctionDeclaration' : 'ClassDeclaration';
                        }
                    }
                    node.declaration = expr;
                    if (needsSemi)
                        this.semicolon();
                    return this.finishNode(node, 'ExportDefaultDeclaration');
                }
                if (this.shouldParseExportStatement()) {
                    node.declaration = this.parseStatement(true);
                    node.specifiers = [];
                    node.source = null;
                } else {
                    node.declaration = null;
                    node.specifiers = this.parseExportSpecifiers();
                    if (this.eatContextual('from')) {
                        node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
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
                return this.finishNode(node, 'ExportNamedDeclaration');
            };
            pp.shouldParseExportStatement = function () {
                return this.type.keyword || this.isLet();
            };
            pp.parseExportSpecifiers = function () {
                var nodes = [], first = true;
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR))
                            break;
                    } else
                        first = false;
                    var node = this.startNode();
                    node.local = this.parseIdent(this.type === tt._default);
                    node.exported = this.eatContextual('as') ? this.parseIdent(true) : node.local;
                    nodes.push(this.finishNode(node, 'ExportSpecifier'));
                }
                return nodes;
            };
            pp.parseImport = function (node) {
                this.next();
                if (this.type === tt.string) {
                    node.specifiers = empty;
                    node.source = this.parseExprAtom();
                } else {
                    node.specifiers = this.parseImportSpecifiers();
                    this.expectContextual('from');
                    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
                }
                this.semicolon();
                return this.finishNode(node, 'ImportDeclaration');
            };
            pp.parseImportSpecifiers = function () {
                var nodes = [], first = true;
                if (this.type === tt.name) {
                    var node = this.startNode();
                    node.local = this.parseIdent();
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, 'ImportDefaultSpecifier'));
                    if (!this.eat(tt.comma))
                        return nodes;
                }
                if (this.type === tt.star) {
                    var node = this.startNode();
                    this.next();
                    this.expectContextual('as');
                    node.local = this.parseIdent();
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, 'ImportNamespaceSpecifier'));
                    return nodes;
                }
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR))
                            break;
                    } else
                        first = false;
                    var node = this.startNode();
                    node.imported = this.parseIdent(true);
                    if (this.eatContextual('as')) {
                        node.local = this.parseIdent();
                    } else {
                        node.local = node.imported;
                        if (this.isKeyword(node.local.name))
                            this.unexpected(node.local.start);
                        if (this.reservedWordsStrict.test(node.local.name))
                            this.raise(node.local.start, 'The keyword \'' + node.local.name + '\' is reserved');
                    }
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, 'ImportSpecifier'));
                }
                return nodes;
            };
        }
    };
})
System.register('acorn/src/lval.js', [
    './tokentype',
    './state',
    './util'
], function (_export) {
    'use strict';
    var tt, Parser, has, pp;
    return {
        setters: [
            function (_tokentype) {
                tt = _tokentype.types;
            },
            function (_state) {
                Parser = _state.Parser;
            },
            function (_util) {
                has = _util.has;
            }
        ],
        execute: function () {
            pp = Parser.prototype;
            pp.toAssignable = function (node, isBinding) {
                if (this.options.ecmaVersion >= 6 && node) {
                    switch (node.type) {
                    case 'Identifier':
                    case 'ObjectPattern':
                    case 'ArrayPattern':
                        break;
                    case 'ObjectExpression':
                        node.type = 'ObjectPattern';
                        for (var i = 0; i < node.properties.length; i++) {
                            var prop = node.properties[i];
                            if (prop.kind !== 'init')
                                this.raise(prop.key.start, 'Object pattern can\'t contain getter or setter');
                            this.toAssignable(prop.value, isBinding);
                        }
                        break;
                    case 'ArrayExpression':
                        node.type = 'ArrayPattern';
                        this.toAssignableList(node.elements, isBinding);
                        break;
                    case 'AssignmentExpression':
                        if (node.operator === '=') {
                            node.type = 'AssignmentPattern';
                            delete node.operator;
                        } else {
                            this.raise(node.left.end, 'Only \'=\' operator can be used for specifying default value.');
                            break;
                        }
                    case 'AssignmentPattern':
                        if (node.right.type === 'YieldExpression')
                            this.raise(node.right.start, 'Yield expression cannot be a default value');
                        break;
                    case 'ParenthesizedExpression':
                        node.expression = this.toAssignable(node.expression, isBinding);
                        break;
                    case 'MemberExpression':
                        if (!isBinding)
                            break;
                    default:
                        this.raise(node.start, 'Assigning to rvalue');
                    }
                }
                return node;
            };
            pp.toAssignableList = function (exprList, isBinding) {
                var end = exprList.length;
                if (end) {
                    var last = exprList[end - 1];
                    if (last && last.type == 'RestElement') {
                        --end;
                    } else if (last && last.type == 'SpreadElement') {
                        last.type = 'RestElement';
                        var arg = last.argument;
                        this.toAssignable(arg, isBinding);
                        if (arg.type !== 'Identifier' && arg.type !== 'MemberExpression' && arg.type !== 'ArrayPattern')
                            this.unexpected(arg.start);
                        --end;
                    }
                    if (isBinding && last.type === 'RestElement' && last.argument.type !== 'Identifier')
                        this.unexpected(last.argument.start);
                }
                for (var i = 0; i < end; i++) {
                    var elt = exprList[i];
                    if (elt)
                        this.toAssignable(elt, isBinding);
                }
                return exprList;
            };
            pp.parseSpread = function (refDestructuringErrors) {
                var node = this.startNode();
                this.next();
                node.argument = this.parseMaybeAssign(refDestructuringErrors);
                return this.finishNode(node, 'SpreadElement');
            };
            pp.parseRest = function (allowNonIdent) {
                var node = this.startNode();
                this.next();
                if (allowNonIdent)
                    node.argument = this.type === tt.name ? this.parseIdent() : this.unexpected();
                else
                    node.argument = this.type === tt.name || this.type === tt.bracketL ? this.parseBindingAtom() : this.unexpected();
                return this.finishNode(node, 'RestElement');
            };
            pp.parseBindingAtom = function () {
                if (this.options.ecmaVersion < 6)
                    return this.parseIdent();
                switch (this.type) {
                case tt.name:
                    return this.parseIdent();
                case tt.bracketL:
                    var node = this.startNode();
                    this.next();
                    node.elements = this.parseBindingList(tt.bracketR, true, true);
                    return this.finishNode(node, 'ArrayPattern');
                case tt.braceL:
                    return this.parseObj(true);
                default:
                    this.unexpected();
                }
            };
            pp.parseBindingList = function (close, allowEmpty, allowTrailingComma, allowNonIdent) {
                var elts = [], first = true;
                while (!this.eat(close)) {
                    if (first)
                        first = false;
                    else
                        this.expect(tt.comma);
                    if (allowEmpty && this.type === tt.comma) {
                        elts.push(null);
                    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
                        break;
                    } else if (this.type === tt.ellipsis) {
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
            pp.parseBindingListItem = function (param) {
                return param;
            };
            pp.parseMaybeDefault = function (startPos, startLoc, left) {
                left = left || this.parseBindingAtom();
                if (this.options.ecmaVersion < 6 || !this.eat(tt.eq))
                    return left;
                var node = this.startNodeAt(startPos, startLoc);
                node.left = left;
                node.right = this.parseMaybeAssign();
                return this.finishNode(node, 'AssignmentPattern');
            };
            pp.checkLVal = function (expr, isBinding, checkClashes) {
                switch (expr.type) {
                case 'Identifier':
                    if (this.strict && this.reservedWordsStrictBind.test(expr.name))
                        this.raiseRecoverable(expr.start, (isBinding ? 'Binding ' : 'Assigning to ') + expr.name + ' in strict mode');
                    if (checkClashes) {
                        if (has(checkClashes, expr.name))
                            this.raiseRecoverable(expr.start, 'Argument name clash');
                        checkClashes[expr.name] = true;
                    }
                    break;
                case 'MemberExpression':
                    if (isBinding)
                        this.raiseRecoverable(expr.start, (isBinding ? 'Binding' : 'Assigning to') + ' member expression');
                    break;
                case 'ObjectPattern':
                    for (var i = 0; i < expr.properties.length; i++) {
                        this.checkLVal(expr.properties[i].value, isBinding, checkClashes);
                    }
                    break;
                case 'ArrayPattern':
                    for (var i = 0; i < expr.elements.length; i++) {
                        var elem = expr.elements[i];
                        if (elem)
                            this.checkLVal(elem, isBinding, checkClashes);
                    }
                    break;
                case 'AssignmentPattern':
                    this.checkLVal(expr.left, isBinding, checkClashes);
                    break;
                case 'RestElement':
                    this.checkLVal(expr.argument, isBinding, checkClashes);
                    break;
                case 'ParenthesizedExpression':
                    this.checkLVal(expr.expression, isBinding, checkClashes);
                    break;
                default:
                    this.raise(expr.start, (isBinding ? 'Binding' : 'Assigning to') + ' rvalue');
                }
            };
        }
    };
})
System.register('acorn/src/expression.js', [
    './tokentype',
    './state'
], function (_export) {
    'use strict';
    var tt, Parser, pp, empty;
    return {
        setters: [
            function (_tokentype) {
                tt = _tokentype.types;
            },
            function (_state) {
                Parser = _state.Parser;
            }
        ],
        execute: function () {
            pp = Parser.prototype;
            pp.checkPropClash = function (prop, propHash) {
                if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand))
                    return;
                var key = prop.key;
                var name = undefined;
                switch (key.type) {
                case 'Identifier':
                    name = key.name;
                    break;
                case 'Literal':
                    name = String(key.value);
                    break;
                default:
                    return;
                }
                var kind = prop.kind;
                if (this.options.ecmaVersion >= 6) {
                    if (name === '__proto__' && kind === 'init') {
                        if (propHash.proto)
                            this.raiseRecoverable(key.start, 'Redefinition of __proto__ property');
                        propHash.proto = true;
                    }
                    return;
                }
                name = '$' + name;
                var other = propHash[name];
                if (other) {
                    var isGetSet = kind !== 'init';
                    if ((this.strict || isGetSet) && other[kind] || !(isGetSet ^ other.init))
                        this.raiseRecoverable(key.start, 'Redefinition of property');
                } else {
                    other = propHash[name] = {
                        init: false,
                        get: false,
                        set: false
                    };
                }
                other[kind] = true;
            };
            pp.parseExpression = function (noIn, refDestructuringErrors) {
                var startPos = this.start, startLoc = this.startLoc;
                var expr = this.parseMaybeAssign(noIn, refDestructuringErrors);
                if (this.type === tt.comma) {
                    var node = this.startNodeAt(startPos, startLoc);
                    node.expressions = [expr];
                    while (this.eat(tt.comma))
                        node.expressions.push(this.parseMaybeAssign(noIn, refDestructuringErrors));
                    return this.finishNode(node, 'SequenceExpression');
                }
                return expr;
            };
            pp.parseMaybeAssign = function (noIn, refDestructuringErrors, afterLeftParse) {
                if (this.inGenerator && this.isContextual('yield'))
                    return this.parseYield();
                var validateDestructuring = false;
                if (!refDestructuringErrors) {
                    refDestructuringErrors = {
                        shorthandAssign: 0,
                        trailingComma: 0
                    };
                    validateDestructuring = true;
                }
                var startPos = this.start, startLoc = this.startLoc;
                if (this.type == tt.parenL || this.type == tt.name)
                    this.potentialArrowAt = this.start;
                var left = this.parseMaybeConditional(noIn, refDestructuringErrors);
                if (afterLeftParse)
                    left = afterLeftParse.call(this, left, startPos, startLoc);
                if (this.type.isAssign) {
                    if (validateDestructuring)
                        this.checkPatternErrors(refDestructuringErrors, true);
                    var node = this.startNodeAt(startPos, startLoc);
                    node.operator = this.value;
                    node.left = this.type === tt.eq ? this.toAssignable(left) : left;
                    refDestructuringErrors.shorthandAssign = 0;
                    this.checkLVal(left);
                    this.next();
                    node.right = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, 'AssignmentExpression');
                } else {
                    if (validateDestructuring)
                        this.checkExpressionErrors(refDestructuringErrors, true);
                }
                return left;
            };
            pp.parseMaybeConditional = function (noIn, refDestructuringErrors) {
                var startPos = this.start, startLoc = this.startLoc;
                var expr = this.parseExprOps(noIn, refDestructuringErrors);
                if (this.checkExpressionErrors(refDestructuringErrors))
                    return expr;
                if (this.eat(tt.question)) {
                    var node = this.startNodeAt(startPos, startLoc);
                    node.test = expr;
                    node.consequent = this.parseMaybeAssign();
                    this.expect(tt.colon);
                    node.alternate = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, 'ConditionalExpression');
                }
                return expr;
            };
            pp.parseExprOps = function (noIn, refDestructuringErrors) {
                var startPos = this.start, startLoc = this.startLoc;
                var expr = this.parseMaybeUnary(refDestructuringErrors, false);
                if (this.checkExpressionErrors(refDestructuringErrors))
                    return expr;
                return this.parseExprOp(expr, startPos, startLoc, -1, noIn);
            };
            pp.parseExprOp = function (left, leftStartPos, leftStartLoc, minPrec, noIn) {
                var prec = this.type.binop;
                if (prec != null && (!noIn || this.type !== tt._in)) {
                    if (prec > minPrec) {
                        var logical = this.type === tt.logicalOR || this.type === tt.logicalAND;
                        var op = this.value;
                        this.next();
                        var startPos = this.start, startLoc = this.startLoc;
                        var right = this.parseExprOp(this.parseMaybeUnary(null, false), startPos, startLoc, prec, noIn);
                        var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical);
                        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
                    }
                }
                return left;
            };
            pp.buildBinary = function (startPos, startLoc, left, right, op, logical) {
                var node = this.startNodeAt(startPos, startLoc);
                node.left = left;
                node.operator = op;
                node.right = right;
                return this.finishNode(node, logical ? 'LogicalExpression' : 'BinaryExpression');
            };
            pp.parseMaybeUnary = function (refDestructuringErrors, sawUnary) {
                var startPos = this.start, startLoc = this.startLoc, expr = undefined;
                if (this.type.prefix) {
                    var node = this.startNode(), update = this.type === tt.incDec;
                    node.operator = this.value;
                    node.prefix = true;
                    this.next();
                    node.argument = this.parseMaybeUnary(null, true);
                    this.checkExpressionErrors(refDestructuringErrors, true);
                    if (update)
                        this.checkLVal(node.argument);
                    else if (this.strict && node.operator === 'delete' && node.argument.type === 'Identifier')
                        this.raiseRecoverable(node.start, 'Deleting local variable in strict mode');
                    else
                        sawUnary = true;
                    expr = this.finishNode(node, update ? 'UpdateExpression' : 'UnaryExpression');
                } else {
                    expr = this.parseExprSubscripts(refDestructuringErrors);
                    if (this.checkExpressionErrors(refDestructuringErrors))
                        return expr;
                    while (this.type.postfix && !this.canInsertSemicolon()) {
                        var node = this.startNodeAt(startPos, startLoc);
                        node.operator = this.value;
                        node.prefix = false;
                        node.argument = expr;
                        this.checkLVal(expr);
                        this.next();
                        expr = this.finishNode(node, 'UpdateExpression');
                    }
                }
                if (!sawUnary && this.eat(tt.starstar))
                    return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false), '**', false);
                else
                    return expr;
            };
            pp.parseExprSubscripts = function (refDestructuringErrors) {
                var startPos = this.start, startLoc = this.startLoc;
                var expr = this.parseExprAtom(refDestructuringErrors);
                var skipArrowSubscripts = expr.type === 'ArrowFunctionExpression' && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ')';
                if (this.checkExpressionErrors(refDestructuringErrors) || skipArrowSubscripts)
                    return expr;
                return this.parseSubscripts(expr, startPos, startLoc);
            };
            pp.parseSubscripts = function (base, startPos, startLoc, noCalls) {
                for (;;) {
                    if (this.eat(tt.dot)) {
                        var node = this.startNodeAt(startPos, startLoc);
                        node.object = base;
                        node.property = this.parseIdent(true);
                        node.computed = false;
                        base = this.finishNode(node, 'MemberExpression');
                    } else if (this.eat(tt.bracketL)) {
                        var node = this.startNodeAt(startPos, startLoc);
                        node.object = base;
                        node.property = this.parseExpression();
                        node.computed = true;
                        this.expect(tt.bracketR);
                        base = this.finishNode(node, 'MemberExpression');
                    } else if (!noCalls && this.eat(tt.parenL)) {
                        var node = this.startNodeAt(startPos, startLoc);
                        node.callee = base;
                        node.arguments = this.parseExprList(tt.parenR, false);
                        base = this.finishNode(node, 'CallExpression');
                    } else if (this.type === tt.backQuote) {
                        var node = this.startNodeAt(startPos, startLoc);
                        node.tag = base;
                        node.quasi = this.parseTemplate();
                        base = this.finishNode(node, 'TaggedTemplateExpression');
                    } else {
                        return base;
                    }
                }
            };
            pp.parseExprAtom = function (refDestructuringErrors) {
                var node = undefined, canBeArrow = this.potentialArrowAt == this.start;
                switch (this.type) {
                case tt._super:
                    if (!this.inFunction)
                        this.raise(this.start, '\'super\' outside of function or class');
                case tt._this:
                    var type = this.type === tt._this ? 'ThisExpression' : 'Super';
                    node = this.startNode();
                    this.next();
                    return this.finishNode(node, type);
                case tt.name:
                    var startPos = this.start, startLoc = this.startLoc;
                    var id = this.parseIdent(this.type !== tt.name);
                    if (canBeArrow && !this.canInsertSemicolon() && this.eat(tt.arrow))
                        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id]);
                    return id;
                case tt.regexp:
                    var value = this.value;
                    node = this.parseLiteral(value.value);
                    node.regex = {
                        pattern: value.pattern,
                        flags: value.flags
                    };
                    return node;
                case tt.num:
                case tt.string:
                    return this.parseLiteral(this.value);
                case tt._null:
                case tt._true:
                case tt._false:
                    node = this.startNode();
                    node.value = this.type === tt._null ? null : this.type === tt._true;
                    node.raw = this.type.keyword;
                    this.next();
                    return this.finishNode(node, 'Literal');
                case tt.parenL:
                    return this.parseParenAndDistinguishExpression(canBeArrow);
                case tt.bracketL:
                    node = this.startNode();
                    this.next();
                    node.elements = this.parseExprList(tt.bracketR, true, true, refDestructuringErrors);
                    return this.finishNode(node, 'ArrayExpression');
                case tt.braceL:
                    return this.parseObj(false, refDestructuringErrors);
                case tt._function:
                    node = this.startNode();
                    this.next();
                    return this.parseFunction(node, false);
                case tt._class:
                    return this.parseClass(this.startNode(), false);
                case tt._new:
                    return this.parseNew();
                case tt.backQuote:
                    return this.parseTemplate();
                default:
                    this.unexpected();
                }
            };
            pp.parseLiteral = function (value) {
                var node = this.startNode();
                node.value = value;
                node.raw = this.input.slice(this.start, this.end);
                this.next();
                return this.finishNode(node, 'Literal');
            };
            pp.parseParenExpression = function () {
                this.expect(tt.parenL);
                var val = this.parseExpression();
                this.expect(tt.parenR);
                return val;
            };
            pp.parseParenAndDistinguishExpression = function (canBeArrow) {
                var startPos = this.start, startLoc = this.startLoc, val = undefined;
                if (this.options.ecmaVersion >= 6) {
                    this.next();
                    var innerStartPos = this.start, innerStartLoc = this.startLoc;
                    var exprList = [], first = true;
                    var refDestructuringErrors = {
                            shorthandAssign: 0,
                            trailingComma: 0
                        }, spreadStart = undefined, innerParenStart = undefined;
                    while (this.type !== tt.parenR) {
                        first ? first = false : this.expect(tt.comma);
                        if (this.type === tt.ellipsis) {
                            spreadStart = this.start;
                            exprList.push(this.parseParenItem(this.parseRest()));
                            break;
                        } else {
                            if (this.type === tt.parenL && !innerParenStart) {
                                innerParenStart = this.start;
                            }
                            exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
                        }
                    }
                    var innerEndPos = this.start, innerEndLoc = this.startLoc;
                    this.expect(tt.parenR);
                    if (canBeArrow && !this.canInsertSemicolon() && this.eat(tt.arrow)) {
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
                        this.finishNodeAt(val, 'SequenceExpression', innerEndPos, innerEndLoc);
                    } else {
                        val = exprList[0];
                    }
                } else {
                    val = this.parseParenExpression();
                }
                if (this.options.preserveParens) {
                    var par = this.startNodeAt(startPos, startLoc);
                    par.expression = val;
                    return this.finishNode(par, 'ParenthesizedExpression');
                } else {
                    return val;
                }
            };
            pp.parseParenItem = function (item) {
                return item;
            };
            pp.parseParenArrowList = function (startPos, startLoc, exprList) {
                return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList);
            };
            empty = [];
            pp.parseNew = function () {
                var node = this.startNode();
                var meta = this.parseIdent(true);
                if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
                    node.meta = meta;
                    node.property = this.parseIdent(true);
                    if (node.property.name !== 'target')
                        this.raiseRecoverable(node.property.start, 'The only valid meta property for new is new.target');
                    if (!this.inFunction)
                        this.raiseRecoverable(node.start, 'new.target can only be used in functions');
                    return this.finishNode(node, 'MetaProperty');
                }
                var startPos = this.start, startLoc = this.startLoc;
                node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
                if (this.eat(tt.parenL))
                    node.arguments = this.parseExprList(tt.parenR, false);
                else
                    node.arguments = empty;
                return this.finishNode(node, 'NewExpression');
            };
            pp.parseTemplateElement = function () {
                var elem = this.startNode();
                elem.value = {
                    raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, '\n'),
                    cooked: this.value
                };
                this.next();
                elem.tail = this.type === tt.backQuote;
                return this.finishNode(elem, 'TemplateElement');
            };
            pp.parseTemplate = function () {
                var node = this.startNode();
                this.next();
                node.expressions = [];
                var curElt = this.parseTemplateElement();
                node.quasis = [curElt];
                while (!curElt.tail) {
                    this.expect(tt.dollarBraceL);
                    node.expressions.push(this.parseExpression());
                    this.expect(tt.braceR);
                    node.quasis.push(curElt = this.parseTemplateElement());
                }
                this.next();
                return this.finishNode(node, 'TemplateLiteral');
            };
            pp.parseObj = function (isPattern, refDestructuringErrors) {
                var node = this.startNode(), first = true, propHash = {};
                node.properties = [];
                this.next();
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR))
                            break;
                    } else
                        first = false;
                    var prop = this.startNode(), isGenerator = undefined, startPos = undefined, startLoc = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        prop.method = false;
                        prop.shorthand = false;
                        if (isPattern || refDestructuringErrors) {
                            startPos = this.start;
                            startLoc = this.startLoc;
                        }
                        if (!isPattern)
                            isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(prop);
                    this.parsePropertyValue(prop, isPattern, isGenerator, startPos, startLoc, refDestructuringErrors);
                    this.checkPropClash(prop, propHash);
                    node.properties.push(this.finishNode(prop, 'Property'));
                }
                return this.finishNode(node, isPattern ? 'ObjectPattern' : 'ObjectExpression');
            };
            pp.parsePropertyValue = function (prop, isPattern, isGenerator, startPos, startLoc, refDestructuringErrors) {
                if (this.eat(tt.colon)) {
                    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
                    prop.kind = 'init';
                } else if (this.options.ecmaVersion >= 6 && this.type === tt.parenL) {
                    if (isPattern)
                        this.unexpected();
                    prop.kind = 'init';
                    prop.method = true;
                    prop.value = this.parseMethod(isGenerator);
                } else if (this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === 'Identifier' && (prop.key.name === 'get' || prop.key.name === 'set') && (this.type != tt.comma && this.type != tt.braceR)) {
                    if (isGenerator || isPattern)
                        this.unexpected();
                    prop.kind = prop.key.name;
                    this.parsePropertyName(prop);
                    prop.value = this.parseMethod(false);
                    var paramCount = prop.kind === 'get' ? 0 : 1;
                    if (prop.value.params.length !== paramCount) {
                        var start = prop.value.start;
                        if (prop.kind === 'get')
                            this.raiseRecoverable(start, 'getter should have no params');
                        else
                            this.raiseRecoverable(start, 'setter should have exactly one param');
                    }
                    if (prop.kind === 'set' && prop.value.params[0].type === 'RestElement')
                        this.raiseRecoverable(prop.value.params[0].start, 'Setter cannot use rest params');
                } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === 'Identifier') {
                    prop.kind = 'init';
                    if (isPattern) {
                        if (this.keywords.test(prop.key.name) || (this.strict ? this.reservedWordsStrictBind : this.reservedWords).test(prop.key.name) || this.inGenerator && prop.key.name == 'yield')
                            this.raiseRecoverable(prop.key.start, 'Binding ' + prop.key.name);
                        prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
                    } else if (this.type === tt.eq && refDestructuringErrors) {
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
            pp.parsePropertyName = function (prop) {
                if (this.options.ecmaVersion >= 6) {
                    if (this.eat(tt.bracketL)) {
                        prop.computed = true;
                        prop.key = this.parseMaybeAssign();
                        this.expect(tt.bracketR);
                        return prop.key;
                    } else {
                        prop.computed = false;
                    }
                }
                return prop.key = this.type === tt.num || this.type === tt.string ? this.parseExprAtom() : this.parseIdent(true);
            };
            pp.initFunction = function (node) {
                node.id = null;
                if (this.options.ecmaVersion >= 6) {
                    node.generator = false;
                    node.expression = false;
                }
            };
            pp.parseMethod = function (isGenerator) {
                var node = this.startNode(), oldInGen = this.inGenerator;
                this.inGenerator = isGenerator;
                this.initFunction(node);
                this.expect(tt.parenL);
                node.params = this.parseBindingList(tt.parenR, false, false);
                if (this.options.ecmaVersion >= 6)
                    node.generator = isGenerator;
                this.parseFunctionBody(node, false);
                this.inGenerator = oldInGen;
                return this.finishNode(node, 'FunctionExpression');
            };
            pp.parseArrowExpression = function (node, params) {
                var oldInGen = this.inGenerator;
                this.inGenerator = false;
                this.initFunction(node);
                node.params = this.toAssignableList(params, true);
                this.parseFunctionBody(node, true);
                this.inGenerator = oldInGen;
                return this.finishNode(node, 'ArrowFunctionExpression');
            };
            pp.parseFunctionBody = function (node, isArrowFunction) {
                var isExpression = isArrowFunction && this.type !== tt.braceL;
                if (isExpression) {
                    node.body = this.parseMaybeAssign();
                    node.expression = true;
                } else {
                    var oldInFunc = this.inFunction, oldLabels = this.labels;
                    this.inFunction = true;
                    this.labels = [];
                    node.body = this.parseBlock(true);
                    node.expression = false;
                    this.inFunction = oldInFunc;
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
            pp.checkParams = function (node) {
                var nameHash = {};
                for (var i = 0; i < node.params.length; i++) {
                    this.checkLVal(node.params[i], true, nameHash);
                }
            };
            pp.parseExprList = function (close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
                var elts = [], first = true;
                while (!this.eat(close)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.type === close && refDestructuringErrors && !refDestructuringErrors.trailingComma) {
                            refDestructuringErrors.trailingComma = this.lastTokStart;
                        }
                        if (allowTrailingComma && this.afterTrailingComma(close))
                            break;
                    } else
                        first = false;
                    var elt = undefined;
                    if (allowEmpty && this.type === tt.comma)
                        elt = null;
                    else if (this.type === tt.ellipsis)
                        elt = this.parseSpread(refDestructuringErrors);
                    else
                        elt = this.parseMaybeAssign(false, refDestructuringErrors);
                    elts.push(elt);
                }
                return elts;
            };
            pp.parseIdent = function (liberal) {
                var node = this.startNode();
                if (liberal && this.options.allowReserved == 'never')
                    liberal = false;
                if (this.type === tt.name) {
                    if (!liberal && (this.strict ? this.reservedWordsStrict : this.reservedWords).test(this.value) && (this.options.ecmaVersion >= 6 || this.input.slice(this.start, this.end).indexOf('\\') == -1))
                        this.raiseRecoverable(this.start, 'The keyword \'' + this.value + '\' is reserved');
                    if (!liberal && this.inGenerator && this.value === 'yield')
                        this.raiseRecoverable(this.start, 'Can not use \'yield\' as identifier inside a generator');
                    node.name = this.value;
                } else if (liberal && this.type.keyword) {
                    node.name = this.type.keyword;
                } else {
                    this.unexpected();
                }
                this.next();
                return this.finishNode(node, 'Identifier');
            };
            pp.parseYield = function () {
                var node = this.startNode();
                this.next();
                if (this.type == tt.semi || this.canInsertSemicolon() || this.type != tt.star && !this.type.startsExpr) {
                    node.delegate = false;
                    node.argument = null;
                } else {
                    node.delegate = this.eat(tt.star);
                    node.argument = this.parseMaybeAssign();
                }
                return this.finishNode(node, 'YieldExpression');
            };
        }
    };
})
System.register('acorn/src/location.js', [
    './state',
    './locutil'
], function (_export) {
    'use strict';
    var Parser, Position, getLineInfo, pp;
    return {
        setters: [
            function (_state) {
                Parser = _state.Parser;
            },
            function (_locutil) {
                Position = _locutil.Position;
                getLineInfo = _locutil.getLineInfo;
            }
        ],
        execute: function () {
            pp = Parser.prototype;
            pp.raise = function (pos, message) {
                var loc = getLineInfo(this.input, pos);
                message += ' (' + loc.line + ':' + loc.column + ')';
                var err = new SyntaxError(message);
                err.pos = pos;
                err.loc = loc;
                err.raisedAt = this.pos;
                throw err;
            };
            pp.raiseRecoverable = pp.raise;
            pp.curPosition = function () {
                if (this.options.locations) {
                    return new Position(this.curLine, this.pos - this.lineStart);
                }
            };
        }
    };
})
System.register('acorn/src/options.js', [
    './util',
    './locutil'
], function (_export) {
    'use strict';
    var has, isArray, SourceLocation, defaultOptions;
    _export('getOptions', getOptions);
    function getOptions(opts) {
        var options = {};
        for (var opt in defaultOptions) {
            options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt];
        }
        if (options.allowReserved == null)
            options.allowReserved = options.ecmaVersion < 5;
        if (isArray(options.onToken)) {
            (function () {
                var tokens = options.onToken;
                options.onToken = function (token) {
                    return tokens.push(token);
                };
            }());
        }
        if (isArray(options.onComment))
            options.onComment = pushComment(options, options.onComment);
        return options;
    }
    function pushComment(options, array) {
        return function (block, text, start, end, startLoc, endLoc) {
            var comment = {
                type: block ? 'Block' : 'Line',
                value: text,
                start: start,
                end: end
            };
            if (options.locations)
                comment.loc = new SourceLocation(this, startLoc, endLoc);
            if (options.ranges)
                comment.range = [
                    start,
                    end
                ];
            array.push(comment);
        };
    }
    return {
        setters: [
            function (_util) {
                has = _util.has;
                isArray = _util.isArray;
            },
            function (_locutil) {
                SourceLocation = _locutil.SourceLocation;
            }
        ],
        execute: function () {
            defaultOptions = {
                ecmaVersion: 6,
                sourceType: 'script',
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
            _export('defaultOptions', defaultOptions);
        }
    };
})
System.register('acorn/src/locutil.js', ['./whitespace'], function (_export) {
    'use strict';
    var lineBreakG, Position, SourceLocation;
    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ('value' in descriptor)
                    descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }
        return function (Constructor, protoProps, staticProps) {
            if (protoProps)
                defineProperties(Constructor.prototype, protoProps);
            if (staticProps)
                defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();
    _export('getLineInfo', getLineInfo);
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    function getLineInfo(input, offset) {
        for (var line = 1, cur = 0;;) {
            lineBreakG.lastIndex = cur;
            var match = lineBreakG.exec(input);
            if (match && match.index < offset) {
                ++line;
                cur = match.index + match[0].length;
            } else {
                return new Position(line, offset - cur);
            }
        }
    }
    return {
        setters: [function (_whitespace) {
                lineBreakG = _whitespace.lineBreakG;
            }],
        execute: function () {
            Position = function () {
                function Position(line, col) {
                    _classCallCheck(this, Position);
                    this.line = line;
                    this.column = col;
                }
                _createClass(Position, [{
                        key: 'offset',
                        value: function offset(n) {
                            return new Position(this.line, this.column + n);
                        }
                    }]);
                return Position;
            }();
            _export('Position', Position);
            SourceLocation = function SourceLocation(p, start, end) {
                _classCallCheck(this, SourceLocation);
                this.start = start;
                this.end = end;
                if (p.sourceFile !== null)
                    this.source = p.sourceFile;
            };
            _export('SourceLocation', SourceLocation);
        }
    };
})
System.register('acorn/src/node.js', [
    './state',
    './locutil'
], function (_export) {
    'use strict';
    var Parser, SourceLocation, Node, pp;
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    function finishNodeAt(node, type, pos, loc) {
        node.type = type;
        node.end = pos;
        if (this.options.locations)
            node.loc.end = loc;
        if (this.options.ranges)
            node.range[1] = pos;
        return node;
    }
    return {
        setters: [
            function (_state) {
                Parser = _state.Parser;
            },
            function (_locutil) {
                SourceLocation = _locutil.SourceLocation;
            }
        ],
        execute: function () {
            Node = function Node(parser, pos, loc) {
                _classCallCheck(this, Node);
                this.type = '';
                this.start = pos;
                this.end = 0;
                if (parser.options.locations)
                    this.loc = new SourceLocation(parser, loc);
                if (parser.options.directSourceFile)
                    this.sourceFile = parser.options.directSourceFile;
                if (parser.options.ranges)
                    this.range = [
                        pos,
                        0
                    ];
            };
            _export('Node', Node);
            pp = Parser.prototype;
            pp.startNode = function () {
                return new Node(this, this.start, this.startLoc);
            };
            pp.startNodeAt = function (pos, loc) {
                return new Node(this, pos, loc);
            };
            pp.finishNode = function (node, type) {
                return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
            };
            pp.finishNodeAt = function (node, type, pos, loc) {
                return finishNodeAt.call(this, node, type, pos, loc);
            };
        }
    };
})
System.register('acorn/src/tokentype.js', [], function (_export) {
    'use strict';
    var TokenType, beforeExpr, startsExpr, types, keywords;
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    function binop(name, prec) {
        return new TokenType(name, {
            beforeExpr: true,
            binop: prec
        });
    }
    function kw(name) {
        var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
        options.keyword = name;
        keywords[name] = types['_' + name] = new TokenType(name, options);
    }
    return {
        setters: [],
        execute: function () {
            TokenType = function TokenType(label) {
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
            _export('TokenType', TokenType);
            beforeExpr = { beforeExpr: true };
            startsExpr = { startsExpr: true };
            types = {
                num: new TokenType('num', startsExpr),
                regexp: new TokenType('regexp', startsExpr),
                string: new TokenType('string', startsExpr),
                name: new TokenType('name', startsExpr),
                eof: new TokenType('eof'),
                bracketL: new TokenType('[', {
                    beforeExpr: true,
                    startsExpr: true
                }),
                bracketR: new TokenType(']'),
                braceL: new TokenType('{', {
                    beforeExpr: true,
                    startsExpr: true
                }),
                braceR: new TokenType('}'),
                parenL: new TokenType('(', {
                    beforeExpr: true,
                    startsExpr: true
                }),
                parenR: new TokenType(')'),
                comma: new TokenType(',', beforeExpr),
                semi: new TokenType(';', beforeExpr),
                colon: new TokenType(':', beforeExpr),
                dot: new TokenType('.'),
                question: new TokenType('?', beforeExpr),
                arrow: new TokenType('=>', beforeExpr),
                template: new TokenType('template'),
                ellipsis: new TokenType('...', beforeExpr),
                backQuote: new TokenType('`', startsExpr),
                dollarBraceL: new TokenType('${', {
                    beforeExpr: true,
                    startsExpr: true
                }),
                eq: new TokenType('=', {
                    beforeExpr: true,
                    isAssign: true
                }),
                assign: new TokenType('_=', {
                    beforeExpr: true,
                    isAssign: true
                }),
                incDec: new TokenType('++/--', {
                    prefix: true,
                    postfix: true,
                    startsExpr: true
                }),
                prefix: new TokenType('prefix', {
                    beforeExpr: true,
                    prefix: true,
                    startsExpr: true
                }),
                logicalOR: binop('||', 1),
                logicalAND: binop('&&', 2),
                bitwiseOR: binop('|', 3),
                bitwiseXOR: binop('^', 4),
                bitwiseAND: binop('&', 5),
                equality: binop('==/!=', 6),
                relational: binop('</>', 7),
                bitShift: binop('<</>>', 8),
                plusMin: new TokenType('+/-', {
                    beforeExpr: true,
                    binop: 9,
                    prefix: true,
                    startsExpr: true
                }),
                modulo: binop('%', 10),
                star: binop('*', 10),
                slash: binop('/', 10),
                starstar: new TokenType('**', { beforeExpr: true })
            };
            _export('types', types);
            keywords = {};
            _export('keywords', keywords);
            kw('break');
            kw('case', beforeExpr);
            kw('catch');
            kw('continue');
            kw('debugger');
            kw('default', beforeExpr);
            kw('do', {
                isLoop: true,
                beforeExpr: true
            });
            kw('else', beforeExpr);
            kw('finally');
            kw('for', { isLoop: true });
            kw('function', startsExpr);
            kw('if');
            kw('return', beforeExpr);
            kw('switch');
            kw('throw', beforeExpr);
            kw('try');
            kw('var');
            kw('const');
            kw('while', { isLoop: true });
            kw('with');
            kw('new', {
                beforeExpr: true,
                startsExpr: true
            });
            kw('this', startsExpr);
            kw('super', startsExpr);
            kw('class');
            kw('extends', beforeExpr);
            kw('export');
            kw('import');
            kw('null', startsExpr);
            kw('true', startsExpr);
            kw('false', startsExpr);
            kw('in', {
                beforeExpr: true,
                binop: 7
            });
            kw('instanceof', {
                beforeExpr: true,
                binop: 7
            });
            kw('typeof', {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });
            kw('void', {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });
            kw('delete', {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });
        }
    };
})
System.register('acorn/src/tokencontext.js', [
    './state',
    './tokentype',
    './whitespace'
], function (_export) {
    'use strict';
    var Parser, tt, lineBreak, TokContext, types, pp;
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    return {
        setters: [
            function (_state) {
                Parser = _state.Parser;
            },
            function (_tokentype) {
                tt = _tokentype.types;
            },
            function (_whitespace) {
                lineBreak = _whitespace.lineBreak;
            }
        ],
        execute: function () {
            TokContext = function TokContext(token, isExpr, preserveSpace, override) {
                _classCallCheck(this, TokContext);
                this.token = token;
                this.isExpr = !!isExpr;
                this.preserveSpace = !!preserveSpace;
                this.override = override;
            };
            _export('TokContext', TokContext);
            types = {
                b_stat: new TokContext('{', false),
                b_expr: new TokContext('{', true),
                b_tmpl: new TokContext('${', true),
                p_stat: new TokContext('(', false),
                p_expr: new TokContext('(', true),
                q_tmpl: new TokContext('`', true, true, function (p) {
                    return p.readTmplToken();
                }),
                f_expr: new TokContext('function', true)
            };
            _export('types', types);
            pp = Parser.prototype;
            pp.initialContext = function () {
                return [types.b_stat];
            };
            pp.braceIsBlock = function (prevType) {
                if (prevType === tt.colon) {
                    var _parent = this.curContext();
                    if (_parent === types.b_stat || _parent === types.b_expr)
                        return !_parent.isExpr;
                }
                if (prevType === tt._return)
                    return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
                if (prevType === tt._else || prevType === tt.semi || prevType === tt.eof || prevType === tt.parenR)
                    return true;
                if (prevType == tt.braceL)
                    return this.curContext() === types.b_stat;
                return !this.exprAllowed;
            };
            pp.updateContext = function (prevType) {
                var update = undefined, type = this.type;
                if (type.keyword && prevType == tt.dot)
                    this.exprAllowed = false;
                else if (update = type.updateContext)
                    update.call(this, prevType);
                else
                    this.exprAllowed = type.beforeExpr;
            };
            tt.parenR.updateContext = tt.braceR.updateContext = function () {
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
            tt.braceL.updateContext = function (prevType) {
                this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
                this.exprAllowed = true;
            };
            tt.dollarBraceL.updateContext = function () {
                this.context.push(types.b_tmpl);
                this.exprAllowed = true;
            };
            tt.parenL.updateContext = function (prevType) {
                var statementParens = prevType === tt._if || prevType === tt._for || prevType === tt._with || prevType === tt._while;
                this.context.push(statementParens ? types.p_stat : types.p_expr);
                this.exprAllowed = true;
            };
            tt.incDec.updateContext = function () {
            };
            tt._function.updateContext = function () {
                if (this.curContext() !== types.b_stat)
                    this.context.push(types.f_expr);
                this.exprAllowed = false;
            };
            tt.backQuote.updateContext = function () {
                if (this.curContext() === types.q_tmpl)
                    this.context.pop();
                else
                    this.context.push(types.q_tmpl);
                this.exprAllowed = false;
            };
        }
    };
})
System.register('acorn/src/identifier.js', [], function (_export) {
    'use strict';
    var reservedWords, ecma5AndLessKeywords, keywords, nonASCIIidentifierStartChars, nonASCIIidentifierChars, nonASCIIidentifierStart, nonASCIIidentifier, astralIdentifierStartCodes, astralIdentifierCodes;
    _export('isIdentifierStart', isIdentifierStart);
    _export('isIdentifierChar', isIdentifierChar);
    function isInAstralSet(code, set) {
        var pos = 65536;
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
        if (code <= 65535)
            return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
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
        if (code <= 65535)
            return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
        if (astral === false)
            return false;
        return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
    }
    return {
        setters: [],
        execute: function () {
            reservedWords = {
                3: 'abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile',
                5: 'class enum extends super const export import',
                6: 'enum',
                7: 'enum',
                strict: 'implements interface let package private protected public static yield',
                strictBind: 'eval arguments'
            };
            _export('reservedWords', reservedWords);
            ecma5AndLessKeywords = 'break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this';
            keywords = {
                5: ecma5AndLessKeywords,
                6: ecma5AndLessKeywords + ' const class extends export import super'
            };
            _export('keywords', keywords);
            nonASCIIidentifierStartChars = 'ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠ-\u08B4ऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡ\u0AF9ଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘ-\u0C5Aౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎ\u0D5F-ൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-\u13F5\u13F8-\u13FDᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ\u2118-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ\u309B-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-\u9FD5ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞭꞰ-\uA7B7ꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻ\uA8FDꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥ\uAB70-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ';
            nonASCIIidentifierChars = '‌‍\xB7̀-ͯ\u0387҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛\u08E3-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ଁ-ଃ଼ା-ୄେୈୋ-୍ୖୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఃా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ഁ-ഃാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ංඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ູົຼ່-ໍ໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟\u1369-\u1371ᜒ-᜔ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠐-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏᧐-\u19DAᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭ᳲ-᳴᳸᳹᷀-᷵᷼-᷿‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯꘠-꘩꙯ꙴ-꙽\uA69Eꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧꢀꢁꢴ-꣄꣐-꣙꣠-꣱꤀-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-\uFE2F︳︴﹍-﹏０-９＿';
            nonASCIIidentifierStart = new RegExp('[' + nonASCIIidentifierStartChars + ']');
            nonASCIIidentifier = new RegExp('[' + nonASCIIidentifierStartChars + nonASCIIidentifierChars + ']');
            nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
            astralIdentifierStartCodes = [
                0,
                11,
                2,
                25,
                2,
                18,
                2,
                1,
                2,
                14,
                3,
                13,
                35,
                122,
                70,
                52,
                268,
                28,
                4,
                48,
                48,
                31,
                17,
                26,
                6,
                37,
                11,
                29,
                3,
                35,
                5,
                7,
                2,
                4,
                43,
                157,
                99,
                39,
                9,
                51,
                157,
                310,
                10,
                21,
                11,
                7,
                153,
                5,
                3,
                0,
                2,
                43,
                2,
                1,
                4,
                0,
                3,
                22,
                11,
                22,
                10,
                30,
                66,
                18,
                2,
                1,
                11,
                21,
                11,
                25,
                71,
                55,
                7,
                1,
                65,
                0,
                16,
                3,
                2,
                2,
                2,
                26,
                45,
                28,
                4,
                28,
                36,
                7,
                2,
                27,
                28,
                53,
                11,
                21,
                11,
                18,
                14,
                17,
                111,
                72,
                56,
                50,
                14,
                50,
                785,
                52,
                76,
                44,
                33,
                24,
                27,
                35,
                42,
                34,
                4,
                0,
                13,
                47,
                15,
                3,
                22,
                0,
                2,
                0,
                36,
                17,
                2,
                24,
                85,
                6,
                2,
                0,
                2,
                3,
                2,
                14,
                2,
                9,
                8,
                46,
                39,
                7,
                3,
                1,
                3,
                21,
                2,
                6,
                2,
                1,
                2,
                4,
                4,
                0,
                19,
                0,
                13,
                4,
                287,
                47,
                21,
                1,
                2,
                0,
                185,
                46,
                42,
                3,
                37,
                47,
                21,
                0,
                60,
                42,
                86,
                25,
                391,
                63,
                32,
                0,
                449,
                56,
                1288,
                921,
                103,
                110,
                18,
                195,
                2749,
                1070,
                4050,
                582,
                8634,
                568,
                8,
                30,
                114,
                29,
                19,
                47,
                17,
                3,
                32,
                20,
                6,
                18,
                881,
                68,
                12,
                0,
                67,
                12,
                16481,
                1,
                3071,
                106,
                6,
                12,
                4,
                8,
                8,
                9,
                5991,
                84,
                2,
                70,
                2,
                1,
                3,
                0,
                3,
                1,
                3,
                3,
                2,
                11,
                2,
                0,
                2,
                6,
                2,
                64,
                2,
                3,
                3,
                7,
                2,
                6,
                2,
                27,
                2,
                3,
                2,
                4,
                2,
                0,
                4,
                6,
                2,
                339,
                3,
                24,
                2,
                24,
                2,
                30,
                2,
                24,
                2,
                30,
                2,
                24,
                2,
                30,
                2,
                24,
                2,
                30,
                2,
                24,
                2,
                7,
                4149,
                196,
                1340,
                3,
                2,
                26,
                2,
                1,
                2,
                0,
                3,
                0,
                2,
                9,
                2,
                3,
                2,
                0,
                2,
                0,
                7,
                0,
                5,
                0,
                2,
                0,
                2,
                0,
                2,
                2,
                2,
                1,
                2,
                0,
                3,
                0,
                2,
                0,
                2,
                0,
                2,
                0,
                2,
                0,
                2,
                1,
                2,
                0,
                3,
                3,
                2,
                6,
                2,
                3,
                2,
                3,
                2,
                0,
                2,
                9,
                2,
                16,
                6,
                2,
                2,
                4,
                2,
                16,
                4421,
                42710,
                42,
                4148,
                12,
                221,
                3,
                5761,
                10591,
                541
            ];
            astralIdentifierCodes = [
                509,
                0,
                227,
                0,
                150,
                4,
                294,
                9,
                1368,
                2,
                2,
                1,
                6,
                3,
                41,
                2,
                5,
                0,
                166,
                1,
                1306,
                2,
                54,
                14,
                32,
                9,
                16,
                3,
                46,
                10,
                54,
                9,
                7,
                2,
                37,
                13,
                2,
                9,
                52,
                0,
                13,
                2,
                49,
                13,
                10,
                2,
                4,
                9,
                83,
                11,
                168,
                11,
                6,
                9,
                7,
                3,
                57,
                0,
                2,
                6,
                3,
                1,
                3,
                2,
                10,
                0,
                11,
                1,
                3,
                6,
                4,
                4,
                316,
                19,
                13,
                9,
                214,
                6,
                3,
                8,
                28,
                1,
                83,
                16,
                16,
                9,
                82,
                12,
                9,
                9,
                84,
                14,
                5,
                9,
                423,
                9,
                20855,
                9,
                135,
                4,
                60,
                6,
                26,
                9,
                1016,
                45,
                17,
                3,
                19723,
                1,
                5319,
                4,
                4,
                5,
                9,
                7,
                3,
                6,
                31,
                3,
                149,
                2,
                1418,
                49,
                513,
                54,
                5,
                49,
                9,
                0,
                15,
                0,
                23,
                4,
                2,
                14,
                3617,
                6,
                792618,
                239
            ];
        }
    };
})
System.register('acorn/src/tokenize.js', [
    './identifier',
    './tokentype',
    './state',
    './locutil',
    './whitespace'
], function (_export) {
    'use strict';
    var isIdentifierStart, isIdentifierChar, tt, keywordTypes, Parser, SourceLocation, lineBreak, lineBreakG, isNewLine, nonASCIIwhitespace, Token, pp, isRhino, regexpUnicodeSupport;
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    function tryCreateRegexp(src, flags, throwErrorAt, parser) {
        try {
            return new RegExp(src, flags);
        } catch (e) {
            if (throwErrorAt !== undefined) {
                if (e instanceof SyntaxError)
                    parser.raise(throwErrorAt, 'Error parsing regular expression: ' + e.message);
                throw e;
            }
        }
    }
    function codePointToString(code) {
        if (code <= 65535)
            return String.fromCharCode(code);
        code -= 65536;
        return String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
    }
    return {
        setters: [
            function (_identifier) {
                isIdentifierStart = _identifier.isIdentifierStart;
                isIdentifierChar = _identifier.isIdentifierChar;
            },
            function (_tokentype) {
                tt = _tokentype.types;
                keywordTypes = _tokentype.keywords;
            },
            function (_state) {
                Parser = _state.Parser;
            },
            function (_locutil) {
                SourceLocation = _locutil.SourceLocation;
            },
            function (_whitespace) {
                lineBreak = _whitespace.lineBreak;
                lineBreakG = _whitespace.lineBreakG;
                isNewLine = _whitespace.isNewLine;
                nonASCIIwhitespace = _whitespace.nonASCIIwhitespace;
            }
        ],
        execute: function () {
            Token = function Token(p) {
                _classCallCheck(this, Token);
                this.type = p.type;
                this.value = p.value;
                this.start = p.start;
                this.end = p.end;
                if (p.options.locations)
                    this.loc = new SourceLocation(p, p.startLoc, p.endLoc);
                if (p.options.ranges)
                    this.range = [
                        p.start,
                        p.end
                    ];
            };
            _export('Token', Token);
            pp = Parser.prototype;
            isRhino = typeof Packages == 'object' && Object.prototype.toString.call(Packages) == '[object JavaPackage]';
            pp.next = function () {
                if (this.options.onToken)
                    this.options.onToken(new Token(this));
                this.lastTokEnd = this.end;
                this.lastTokStart = this.start;
                this.lastTokEndLoc = this.endLoc;
                this.lastTokStartLoc = this.startLoc;
                this.nextToken();
            };
            pp.getToken = function () {
                this.next();
                return new Token(this);
            };
            if (typeof Symbol !== 'undefined')
                pp[Symbol.iterator] = function () {
                    var self = this;
                    return {
                        next: function next() {
                            var token = self.getToken();
                            return {
                                done: token.type === tt.eof,
                                value: token
                            };
                        }
                    };
                };
            pp.setStrict = function (strict) {
                this.strict = strict;
                if (this.type !== tt.num && this.type !== tt.string)
                    return;
                this.pos = this.start;
                if (this.options.locations) {
                    while (this.pos < this.lineStart) {
                        this.lineStart = this.input.lastIndexOf('\n', this.lineStart - 2) + 1;
                        --this.curLine;
                    }
                }
                this.nextToken();
            };
            pp.curContext = function () {
                return this.context[this.context.length - 1];
            };
            pp.nextToken = function () {
                var curContext = this.curContext();
                if (!curContext || !curContext.preserveSpace)
                    this.skipSpace();
                this.start = this.pos;
                if (this.options.locations)
                    this.startLoc = this.curPosition();
                if (this.pos >= this.input.length)
                    return this.finishToken(tt.eof);
                if (curContext.override)
                    return curContext.override(this);
                else
                    this.readToken(this.fullCharCodeAtPos());
            };
            pp.readToken = function (code) {
                if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92)
                    return this.readWord();
                return this.getTokenFromCode(code);
            };
            pp.fullCharCodeAtPos = function () {
                var code = this.input.charCodeAt(this.pos);
                if (code <= 55295 || code >= 57344)
                    return code;
                var next = this.input.charCodeAt(this.pos + 1);
                return (code << 10) + next - 56613888;
            };
            pp.skipBlockComment = function () {
                var startLoc = this.options.onComment && this.curPosition();
                var start = this.pos, end = this.input.indexOf('*/', this.pos += 2);
                if (end === -1)
                    this.raise(this.pos - 2, 'Unterminated comment');
                this.pos = end + 2;
                if (this.options.locations) {
                    lineBreakG.lastIndex = start;
                    var match = undefined;
                    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
                        ++this.curLine;
                        this.lineStart = match.index + match[0].length;
                    }
                }
                if (this.options.onComment)
                    this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.curPosition());
            };
            pp.skipLineComment = function (startSkip) {
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
            pp.skipSpace = function () {
                loop:
                    while (this.pos < this.input.length) {
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
                            if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
                                ++this.pos;
                            } else {
                                break loop;
                            }
                        }
                    }
            };
            pp.finishToken = function (type, val) {
                this.end = this.pos;
                if (this.options.locations)
                    this.endLoc = this.curPosition();
                var prevType = this.type;
                this.type = type;
                this.value = val;
                this.updateContext(prevType);
            };
            pp.readToken_dot = function () {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next >= 48 && next <= 57)
                    return this.readNumber(true);
                var next2 = this.input.charCodeAt(this.pos + 2);
                if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
                    this.pos += 3;
                    return this.finishToken(tt.ellipsis);
                } else {
                    ++this.pos;
                    return this.finishToken(tt.dot);
                }
            };
            pp.readToken_slash = function () {
                var next = this.input.charCodeAt(this.pos + 1);
                if (this.exprAllowed) {
                    ++this.pos;
                    return this.readRegexp();
                }
                if (next === 61)
                    return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.slash, 1);
            };
            pp.readToken_mult_modulo_exp = function (code) {
                var next = this.input.charCodeAt(this.pos + 1);
                var size = 1;
                var tokentype = code === 42 ? tt.star : tt.modulo;
                if (this.options.ecmaVersion >= 7 && next === 42) {
                    ++size;
                    tokentype = tt.starstar;
                    next = this.input.charCodeAt(this.pos + 2);
                }
                if (next === 61)
                    return this.finishOp(tt.assign, size + 1);
                return this.finishOp(tokentype, size);
            };
            pp.readToken_pipe_amp = function (code) {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === code)
                    return this.finishOp(code === 124 ? tt.logicalOR : tt.logicalAND, 2);
                if (next === 61)
                    return this.finishOp(tt.assign, 2);
                return this.finishOp(code === 124 ? tt.bitwiseOR : tt.bitwiseAND, 1);
            };
            pp.readToken_caret = function () {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 61)
                    return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.bitwiseXOR, 1);
            };
            pp.readToken_plus_min = function (code) {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === code) {
                    if (next == 45 && this.input.charCodeAt(this.pos + 2) == 62 && lineBreak.test(this.input.slice(this.lastTokEnd, this.pos))) {
                        this.skipLineComment(3);
                        this.skipSpace();
                        return this.nextToken();
                    }
                    return this.finishOp(tt.incDec, 2);
                }
                if (next === 61)
                    return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.plusMin, 1);
            };
            pp.readToken_lt_gt = function (code) {
                var next = this.input.charCodeAt(this.pos + 1);
                var size = 1;
                if (next === code) {
                    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
                    if (this.input.charCodeAt(this.pos + size) === 61)
                        return this.finishOp(tt.assign, size + 1);
                    return this.finishOp(tt.bitShift, size);
                }
                if (next == 33 && code == 60 && this.input.charCodeAt(this.pos + 2) == 45 && this.input.charCodeAt(this.pos + 3) == 45) {
                    if (this.inModule)
                        this.unexpected();
                    this.skipLineComment(4);
                    this.skipSpace();
                    return this.nextToken();
                }
                if (next === 61)
                    size = 2;
                return this.finishOp(tt.relational, size);
            };
            pp.readToken_eq_excl = function (code) {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 61)
                    return this.finishOp(tt.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
                if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
                    this.pos += 2;
                    return this.finishToken(tt.arrow);
                }
                return this.finishOp(code === 61 ? tt.eq : tt.prefix, 1);
            };
            pp.getTokenFromCode = function (code) {
                switch (code) {
                case 46:
                    return this.readToken_dot();
                case 40:
                    ++this.pos;
                    return this.finishToken(tt.parenL);
                case 41:
                    ++this.pos;
                    return this.finishToken(tt.parenR);
                case 59:
                    ++this.pos;
                    return this.finishToken(tt.semi);
                case 44:
                    ++this.pos;
                    return this.finishToken(tt.comma);
                case 91:
                    ++this.pos;
                    return this.finishToken(tt.bracketL);
                case 93:
                    ++this.pos;
                    return this.finishToken(tt.bracketR);
                case 123:
                    ++this.pos;
                    return this.finishToken(tt.braceL);
                case 125:
                    ++this.pos;
                    return this.finishToken(tt.braceR);
                case 58:
                    ++this.pos;
                    return this.finishToken(tt.colon);
                case 63:
                    ++this.pos;
                    return this.finishToken(tt.question);
                case 96:
                    if (this.options.ecmaVersion < 6)
                        break;
                    ++this.pos;
                    return this.finishToken(tt.backQuote);
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
                    return this.readToken_mult_modulo_exp(code);
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
                    return this.finishOp(tt.prefix, 1);
                }
                this.raise(this.pos, 'Unexpected character \'' + codePointToString(code) + '\'');
            };
            pp.finishOp = function (type, size) {
                var str = this.input.slice(this.pos, this.pos + size);
                this.pos += size;
                return this.finishToken(type, str);
            };
            regexpUnicodeSupport = !!tryCreateRegexp('\uFFFF', 'u');
            pp.readRegexp = function () {
                var _this = this;
                var escaped = undefined, inClass = undefined, start = this.pos;
                for (;;) {
                    if (this.pos >= this.input.length)
                        this.raise(start, 'Unterminated regular expression');
                    var ch = this.input.charAt(this.pos);
                    if (lineBreak.test(ch))
                        this.raise(start, 'Unterminated regular expression');
                    if (!escaped) {
                        if (ch === '[')
                            inClass = true;
                        else if (ch === ']' && inClass)
                            inClass = false;
                        else if (ch === '/' && !inClass)
                            break;
                        escaped = ch === '\\';
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
                        this.raise(start, 'Invalid regular expression flag');
                    if (mods.indexOf('u') >= 0 && !regexpUnicodeSupport) {
                        tmp = tmp.replace(/\\u\{([0-9a-fA-F]+)\}/g, function (_match, code, offset) {
                            code = Number('0x' + code);
                            if (code > 1114111)
                                _this.raise(start + offset + 3, 'Code point out of bounds');
                            return 'x';
                        });
                        tmp = tmp.replace(/\\u([a-fA-F0-9]{4})|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 'x');
                    }
                }
                var value = null;
                if (!isRhino) {
                    tryCreateRegexp(tmp, undefined, start, this);
                    value = tryCreateRegexp(content, mods);
                }
                return this.finishToken(tt.regexp, {
                    pattern: content,
                    flags: mods,
                    value: value
                });
            };
            pp.readInt = function (radix, len) {
                var start = this.pos, total = 0;
                for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
                    var code = this.input.charCodeAt(this.pos), val = undefined;
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
            pp.readRadixNumber = function (radix) {
                this.pos += 2;
                var val = this.readInt(radix);
                if (val == null)
                    this.raise(this.start + 2, 'Expected number in radix ' + radix);
                if (isIdentifierStart(this.fullCharCodeAtPos()))
                    this.raise(this.pos, 'Identifier directly after number');
                return this.finishToken(tt.num, val);
            };
            pp.readNumber = function (startsWithDot) {
                var start = this.pos, isFloat = false, octal = this.input.charCodeAt(this.pos) === 48;
                if (!startsWithDot && this.readInt(10) === null)
                    this.raise(start, 'Invalid number');
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
                        this.raise(start, 'Invalid number');
                    isFloat = true;
                }
                if (isIdentifierStart(this.fullCharCodeAtPos()))
                    this.raise(this.pos, 'Identifier directly after number');
                var str = this.input.slice(start, this.pos), val = undefined;
                if (isFloat)
                    val = parseFloat(str);
                else if (!octal || str.length === 1)
                    val = parseInt(str, 10);
                else if (/[89]/.test(str) || this.strict)
                    this.raise(start, 'Invalid number');
                else
                    val = parseInt(str, 8);
                return this.finishToken(tt.num, val);
            };
            pp.readCodePoint = function () {
                var ch = this.input.charCodeAt(this.pos), code = undefined;
                if (ch === 123) {
                    if (this.options.ecmaVersion < 6)
                        this.unexpected();
                    var codePos = ++this.pos;
                    code = this.readHexChar(this.input.indexOf('}', this.pos) - this.pos);
                    ++this.pos;
                    if (code > 1114111)
                        this.raise(codePos, 'Code point out of bounds');
                } else {
                    code = this.readHexChar(4);
                }
                return code;
            };
            pp.readString = function (quote) {
                var out = '', chunkStart = ++this.pos;
                for (;;) {
                    if (this.pos >= this.input.length)
                        this.raise(this.start, 'Unterminated string constant');
                    var ch = this.input.charCodeAt(this.pos);
                    if (ch === quote)
                        break;
                    if (ch === 92) {
                        out += this.input.slice(chunkStart, this.pos);
                        out += this.readEscapedChar(false);
                        chunkStart = this.pos;
                    } else {
                        if (isNewLine(ch))
                            this.raise(this.start, 'Unterminated string constant');
                        ++this.pos;
                    }
                }
                out += this.input.slice(chunkStart, this.pos++);
                return this.finishToken(tt.string, out);
            };
            pp.readTmplToken = function () {
                var out = '', chunkStart = this.pos;
                for (;;) {
                    if (this.pos >= this.input.length)
                        this.raise(this.start, 'Unterminated template');
                    var ch = this.input.charCodeAt(this.pos);
                    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
                        if (this.pos === this.start && this.type === tt.template) {
                            if (ch === 36) {
                                this.pos += 2;
                                return this.finishToken(tt.dollarBraceL);
                            } else {
                                ++this.pos;
                                return this.finishToken(tt.backQuote);
                            }
                        }
                        out += this.input.slice(chunkStart, this.pos);
                        return this.finishToken(tt.template, out);
                    }
                    if (ch === 92) {
                        out += this.input.slice(chunkStart, this.pos);
                        out += this.readEscapedChar(true);
                        chunkStart = this.pos;
                    } else if (isNewLine(ch)) {
                        out += this.input.slice(chunkStart, this.pos);
                        ++this.pos;
                        switch (ch) {
                        case 13:
                            if (this.input.charCodeAt(this.pos) === 10)
                                ++this.pos;
                        case 10:
                            out += '\n';
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
            pp.readEscapedChar = function (inTemplate) {
                var ch = this.input.charCodeAt(++this.pos);
                ++this.pos;
                switch (ch) {
                case 110:
                    return '\n';
                case 114:
                    return '\r';
                case 120:
                    return String.fromCharCode(this.readHexChar(2));
                case 117:
                    return codePointToString(this.readCodePoint());
                case 116:
                    return '\t';
                case 98:
                    return '\b';
                case 118:
                    return '\x0B';
                case 102:
                    return '\f';
                case 13:
                    if (this.input.charCodeAt(this.pos) === 10)
                        ++this.pos;
                case 10:
                    if (this.options.locations) {
                        this.lineStart = this.pos;
                        ++this.curLine;
                    }
                    return '';
                default:
                    if (ch >= 48 && ch <= 55) {
                        var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
                        var octal = parseInt(octalStr, 8);
                        if (octal > 255) {
                            octalStr = octalStr.slice(0, -1);
                            octal = parseInt(octalStr, 8);
                        }
                        if (octalStr !== '0' && (this.strict || inTemplate)) {
                            this.raise(this.pos - 2, 'Octal literal in strict mode');
                        }
                        this.pos += octalStr.length - 1;
                        return String.fromCharCode(octal);
                    }
                    return String.fromCharCode(ch);
                }
            };
            pp.readHexChar = function (len) {
                var codePos = this.pos;
                var n = this.readInt(16, len);
                if (n === null)
                    this.raise(codePos, 'Bad character escape sequence');
                return n;
            };
            pp.readWord1 = function () {
                this.containsEsc = false;
                var word = '', first = true, chunkStart = this.pos;
                var astral = this.options.ecmaVersion >= 6;
                while (this.pos < this.input.length) {
                    var ch = this.fullCharCodeAtPos();
                    if (isIdentifierChar(ch, astral)) {
                        this.pos += ch <= 65535 ? 1 : 2;
                    } else if (ch === 92) {
                        this.containsEsc = true;
                        word += this.input.slice(chunkStart, this.pos);
                        var escStart = this.pos;
                        if (this.input.charCodeAt(++this.pos) != 117)
                            this.raise(this.pos, 'Expecting Unicode escape sequence \\uXXXX');
                        ++this.pos;
                        var esc = this.readCodePoint();
                        if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral))
                            this.raise(escStart, 'Invalid Unicode escape');
                        word += codePointToString(esc);
                        chunkStart = this.pos;
                    } else {
                        break;
                    }
                    first = false;
                }
                return word + this.input.slice(chunkStart, this.pos);
            };
            pp.readWord = function () {
                var word = this.readWord1();
                var type = tt.name;
                if ((this.options.ecmaVersion >= 6 || !this.containsEsc) && this.keywords.test(word))
                    type = keywordTypes[word];
                return this.finishToken(type, word);
            };
        }
    };
})
System.register('acorn/src/whitespace.js', [], function (_export) {
    'use strict';
    var lineBreak, lineBreakG, nonASCIIwhitespace, skipWhiteSpace;
    _export('isNewLine', isNewLine);
    function isNewLine(code) {
        return code === 10 || code === 13 || code === 8232 || code == 8233;
    }
    return {
        setters: [],
        execute: function () {
            lineBreak = /\r\n?|\n|\u2028|\u2029/;
            _export('lineBreak', lineBreak);
            lineBreakG = new RegExp(lineBreak.source, 'g');
            _export('lineBreakG', lineBreakG);
            nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
            _export('nonASCIIwhitespace', nonASCIIwhitespace);
            skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
            _export('skipWhiteSpace', skipWhiteSpace);
        }
    };
})
System.register('acorn/src/loose/state.js', ['..'], function (_export) {
    'use strict';
    var tokenizer, SourceLocation, tt, Node, lineBreak, isNewLine, pluginsLoose, LooseParser;
    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ('value' in descriptor)
                    descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }
        return function (Constructor, protoProps, staticProps) {
            if (protoProps)
                defineProperties(Constructor.prototype, protoProps);
            if (staticProps)
                defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    return {
        setters: [function (_) {
                tokenizer = _.tokenizer;
                SourceLocation = _.SourceLocation;
                tt = _.tokTypes;
                Node = _.Node;
                lineBreak = _.lineBreak;
                isNewLine = _.isNewLine;
            }],
        execute: function () {
            pluginsLoose = {};
            _export('pluginsLoose', pluginsLoose);
            LooseParser = function () {
                function LooseParser(input, options) {
                    _classCallCheck(this, LooseParser);
                    this.toks = tokenizer(input, options);
                    this.options = this.toks.options;
                    this.input = this.toks.input;
                    this.tok = this.last = {
                        type: tt.eof,
                        start: 0,
                        end: 0
                    };
                    if (this.options.locations) {
                        var here = this.toks.curPosition();
                        this.tok.loc = new SourceLocation(this.toks, here, here);
                    }
                    this.ahead = [];
                    this.context = [];
                    this.curIndent = 0;
                    this.curLineStart = 0;
                    this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
                    this.options.pluginsLoose = options.pluginsLoose || {};
                    this.loadPlugins(this.options.pluginsLoose);
                }
                _createClass(LooseParser, [
                    {
                        key: 'startNode',
                        value: function startNode() {
                            return new Node(this.toks, this.tok.start, this.options.locations ? this.tok.loc.start : null);
                        }
                    },
                    {
                        key: 'storeCurrentPos',
                        value: function storeCurrentPos() {
                            return this.options.locations ? [
                                this.tok.start,
                                this.tok.loc.start
                            ] : this.tok.start;
                        }
                    },
                    {
                        key: 'startNodeAt',
                        value: function startNodeAt(pos) {
                            if (this.options.locations) {
                                return new Node(this.toks, pos[0], pos[1]);
                            } else {
                                return new Node(this.toks, pos);
                            }
                        }
                    },
                    {
                        key: 'finishNode',
                        value: function finishNode(node, type) {
                            node.type = type;
                            node.end = this.last.end;
                            if (this.options.locations)
                                node.loc.end = this.last.loc.end;
                            if (this.options.ranges)
                                node.range[1] = this.last.end;
                            return node;
                        }
                    },
                    {
                        key: 'dummyNode',
                        value: function dummyNode(type) {
                            var dummy = this.startNode();
                            dummy.type = type;
                            dummy.end = dummy.start;
                            if (this.options.locations)
                                dummy.loc.end = dummy.loc.start;
                            if (this.options.ranges)
                                dummy.range[1] = dummy.start;
                            this.last = {
                                type: tt.name,
                                start: dummy.start,
                                end: dummy.start,
                                loc: dummy.loc
                            };
                            return dummy;
                        }
                    },
                    {
                        key: 'dummyIdent',
                        value: function dummyIdent() {
                            var dummy = this.dummyNode('Identifier');
                            dummy.name = '\u2716';
                            return dummy;
                        }
                    },
                    {
                        key: 'dummyString',
                        value: function dummyString() {
                            var dummy = this.dummyNode('Literal');
                            dummy.value = dummy.raw = '\u2716';
                            return dummy;
                        }
                    },
                    {
                        key: 'eat',
                        value: function eat(type) {
                            if (this.tok.type === type) {
                                this.next();
                                return true;
                            } else {
                                return false;
                            }
                        }
                    },
                    {
                        key: 'isContextual',
                        value: function isContextual(name) {
                            return this.tok.type === tt.name && this.tok.value === name;
                        }
                    },
                    {
                        key: 'eatContextual',
                        value: function eatContextual(name) {
                            return this.tok.value === name && this.eat(tt.name);
                        }
                    },
                    {
                        key: 'canInsertSemicolon',
                        value: function canInsertSemicolon() {
                            return this.tok.type === tt.eof || this.tok.type === tt.braceR || lineBreak.test(this.input.slice(this.last.end, this.tok.start));
                        }
                    },
                    {
                        key: 'semicolon',
                        value: function semicolon() {
                            return this.eat(tt.semi);
                        }
                    },
                    {
                        key: 'expect',
                        value: function expect(type) {
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
                        }
                    },
                    {
                        key: 'pushCx',
                        value: function pushCx() {
                            this.context.push(this.curIndent);
                        }
                    },
                    {
                        key: 'popCx',
                        value: function popCx() {
                            this.curIndent = this.context.pop();
                        }
                    },
                    {
                        key: 'lineEnd',
                        value: function lineEnd(pos) {
                            while (pos < this.input.length && !isNewLine(this.input.charCodeAt(pos)))
                                ++pos;
                            return pos;
                        }
                    },
                    {
                        key: 'indentationAfter',
                        value: function indentationAfter(pos) {
                            for (var count = 0;; ++pos) {
                                var ch = this.input.charCodeAt(pos);
                                if (ch === 32)
                                    ++count;
                                else if (ch === 9)
                                    count += this.options.tabSize;
                                else
                                    return count;
                            }
                        }
                    },
                    {
                        key: 'closes',
                        value: function closes(closeTok, indent, line, blockHeuristic) {
                            if (this.tok.type === closeTok || this.tok.type === tt.eof)
                                return true;
                            return line != this.curLineStart && this.curIndent < indent && this.tokenStartsLine() && (!blockHeuristic || this.nextLineStart >= this.input.length || this.indentationAfter(this.nextLineStart) < indent);
                        }
                    },
                    {
                        key: 'tokenStartsLine',
                        value: function tokenStartsLine() {
                            for (var p = this.tok.start - 1; p >= this.curLineStart; --p) {
                                var ch = this.input.charCodeAt(p);
                                if (ch !== 9 && ch !== 32)
                                    return false;
                            }
                            return true;
                        }
                    },
                    {
                        key: 'extend',
                        value: function extend(name, f) {
                            this[name] = f(this[name]);
                        }
                    },
                    {
                        key: 'loadPlugins',
                        value: function loadPlugins(pluginConfigs) {
                            for (var _name in pluginConfigs) {
                                var plugin = pluginsLoose[_name];
                                if (!plugin)
                                    throw new Error('Plugin \'' + _name + '\' not found');
                                plugin(this, pluginConfigs[_name]);
                            }
                        }
                    }
                ]);
                return LooseParser;
            }();
            _export('LooseParser', LooseParser);
        }
    };
})
System.register('acorn/src/loose/tokenize.js', [
    '..',
    './state'
], function (_export) {
    'use strict';
    var tt, Token, isNewLine, SourceLocation, getLineInfo, lineBreakG, LooseParser, lp;
    function isSpace(ch) {
        return ch < 14 && ch > 8 || ch === 32 || ch === 160 || isNewLine(ch);
    }
    return {
        setters: [
            function (_) {
                tt = _.tokTypes;
                Token = _.Token;
                isNewLine = _.isNewLine;
                SourceLocation = _.SourceLocation;
                getLineInfo = _.getLineInfo;
                lineBreakG = _.lineBreakG;
            },
            function (_state) {
                LooseParser = _state.LooseParser;
            }
        ],
        execute: function () {
            lp = LooseParser.prototype;
            lp.next = function () {
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
            lp.readToken = function () {
                for (;;) {
                    try {
                        this.toks.next();
                        if (this.toks.type === tt.dot && this.input.substr(this.toks.end, 1) === '.' && this.options.ecmaVersion >= 6) {
                            this.toks.end++;
                            this.toks.type = tt.ellipsis;
                        }
                        return new Token(this.toks);
                    } catch (e) {
                        if (!(e instanceof SyntaxError))
                            throw e;
                        var msg = e.message, pos = e.raisedAt, replace = true;
                        if (/unterminated/i.test(msg)) {
                            pos = this.lineEnd(e.pos + 1);
                            if (/string/.test(msg)) {
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.string,
                                    value: this.input.slice(e.pos + 1, pos)
                                };
                            } else if (/regular expr/i.test(msg)) {
                                var re = this.input.slice(e.pos, pos);
                                try {
                                    re = new RegExp(re);
                                } catch (e) {
                                }
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.regexp,
                                    value: re
                                };
                            } else if (/template/.test(msg)) {
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.template,
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
                                if (ch === 34 || ch === 39 || isNewLine(ch))
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
                                type: tt.name,
                                value: '\u2716'
                            };
                        if (replace) {
                            if (this.options.locations)
                                replace.loc = new SourceLocation(this.toks, getLineInfo(this.input, replace.start), getLineInfo(this.input, replace.end));
                            return replace;
                        }
                    }
                }
            };
            lp.resetTo = function (pos) {
                this.toks.pos = pos;
                var ch = this.input.charAt(pos - 1);
                this.toks.exprAllowed = !ch || /[\[\{\(,;:?\/*=+\-~!|&%^<>]/.test(ch) || /[enwfd]/.test(ch) && /\b(keywords|case|else|return|throw|new|in|(instance|type)of|delete|void)$/.test(this.input.slice(pos - 10, pos));
                if (this.options.locations) {
                    this.toks.curLine = 1;
                    this.toks.lineStart = lineBreakG.lastIndex = 0;
                    var match = undefined;
                    while ((match = lineBreakG.exec(this.input)) && match.index < pos) {
                        ++this.toks.curLine;
                        this.toks.lineStart = match.index + match[0].length;
                    }
                }
            };
            lp.lookAhead = function (n) {
                while (n > this.ahead.length)
                    this.ahead.push(this.readToken());
                return this.ahead[n - 1];
            };
        }
    };
})
System.register('acorn/src/loose/statement.js', [
    './state',
    './parseutil',
    '..'
], function (_export) {
    'use strict';
    var LooseParser, isDummy, getLineInfo, tt, lp;
    return {
        setters: [
            function (_state) {
                LooseParser = _state.LooseParser;
            },
            function (_parseutil) {
                isDummy = _parseutil.isDummy;
            },
            function (_) {
                getLineInfo = _.getLineInfo;
                tt = _.tokTypes;
            }
        ],
        execute: function () {
            lp = LooseParser.prototype;
            lp.parseTopLevel = function () {
                var node = this.startNodeAt(this.options.locations ? [
                    0,
                    getLineInfo(this.input, 0)
                ] : 0);
                node.body = [];
                while (this.tok.type !== tt.eof)
                    node.body.push(this.parseStatement());
                this.last = this.tok;
                if (this.options.ecmaVersion >= 6) {
                    node.sourceType = this.options.sourceType;
                }
                return this.finishNode(node, 'Program');
            };
            lp.parseStatement = function () {
                var starttype = this.tok.type, node = this.startNode(), kind = undefined;
                if (this.toks.isLet()) {
                    starttype = tt._var;
                    kind = 'let';
                }
                switch (starttype) {
                case tt._break:
                case tt._continue:
                    this.next();
                    var isBreak = starttype === tt._break;
                    if (this.semicolon() || this.canInsertSemicolon()) {
                        node.label = null;
                    } else {
                        node.label = this.tok.type === tt.name ? this.parseIdent() : null;
                        this.semicolon();
                    }
                    return this.finishNode(node, isBreak ? 'BreakStatement' : 'ContinueStatement');
                case tt._debugger:
                    this.next();
                    this.semicolon();
                    return this.finishNode(node, 'DebuggerStatement');
                case tt._do:
                    this.next();
                    node.body = this.parseStatement();
                    node.test = this.eat(tt._while) ? this.parseParenExpression() : this.dummyIdent();
                    this.semicolon();
                    return this.finishNode(node, 'DoWhileStatement');
                case tt._for:
                    this.next();
                    this.pushCx();
                    this.expect(tt.parenL);
                    if (this.tok.type === tt.semi)
                        return this.parseFor(node, null);
                    var isLet = this.toks.isLet();
                    if (isLet || this.tok.type === tt._var || this.tok.type === tt._const) {
                        var _init = this.parseVar(true, isLet ? 'let' : this.tok.value);
                        if (_init.declarations.length === 1 && (this.tok.type === tt._in || this.isContextual('of'))) {
                            return this.parseForIn(node, _init);
                        }
                        return this.parseFor(node, _init);
                    }
                    var init = this.parseExpression(true);
                    if (this.tok.type === tt._in || this.isContextual('of'))
                        return this.parseForIn(node, this.toAssignable(init));
                    return this.parseFor(node, init);
                case tt._function:
                    this.next();
                    return this.parseFunction(node, true);
                case tt._if:
                    this.next();
                    node.test = this.parseParenExpression();
                    node.consequent = this.parseStatement();
                    node.alternate = this.eat(tt._else) ? this.parseStatement() : null;
                    return this.finishNode(node, 'IfStatement');
                case tt._return:
                    this.next();
                    if (this.eat(tt.semi) || this.canInsertSemicolon())
                        node.argument = null;
                    else {
                        node.argument = this.parseExpression();
                        this.semicolon();
                    }
                    return this.finishNode(node, 'ReturnStatement');
                case tt._switch:
                    var blockIndent = this.curIndent, line = this.curLineStart;
                    this.next();
                    node.discriminant = this.parseParenExpression();
                    node.cases = [];
                    this.pushCx();
                    this.expect(tt.braceL);
                    var cur = undefined;
                    while (!this.closes(tt.braceR, blockIndent, line, true)) {
                        if (this.tok.type === tt._case || this.tok.type === tt._default) {
                            var isCase = this.tok.type === tt._case;
                            if (cur)
                                this.finishNode(cur, 'SwitchCase');
                            node.cases.push(cur = this.startNode());
                            cur.consequent = [];
                            this.next();
                            if (isCase)
                                cur.test = this.parseExpression();
                            else
                                cur.test = null;
                            this.expect(tt.colon);
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
                        this.finishNode(cur, 'SwitchCase');
                    this.popCx();
                    this.eat(tt.braceR);
                    return this.finishNode(node, 'SwitchStatement');
                case tt._throw:
                    this.next();
                    node.argument = this.parseExpression();
                    this.semicolon();
                    return this.finishNode(node, 'ThrowStatement');
                case tt._try:
                    this.next();
                    node.block = this.parseBlock();
                    node.handler = null;
                    if (this.tok.type === tt._catch) {
                        var clause = this.startNode();
                        this.next();
                        this.expect(tt.parenL);
                        clause.param = this.toAssignable(this.parseExprAtom(), true);
                        this.expect(tt.parenR);
                        clause.body = this.parseBlock();
                        node.handler = this.finishNode(clause, 'CatchClause');
                    }
                    node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;
                    if (!node.handler && !node.finalizer)
                        return node.block;
                    return this.finishNode(node, 'TryStatement');
                case tt._var:
                case tt._const:
                    return this.parseVar(false, kind || this.tok.value);
                case tt._while:
                    this.next();
                    node.test = this.parseParenExpression();
                    node.body = this.parseStatement();
                    return this.finishNode(node, 'WhileStatement');
                case tt._with:
                    this.next();
                    node.object = this.parseParenExpression();
                    node.body = this.parseStatement();
                    return this.finishNode(node, 'WithStatement');
                case tt.braceL:
                    return this.parseBlock();
                case tt.semi:
                    this.next();
                    return this.finishNode(node, 'EmptyStatement');
                case tt._class:
                    return this.parseClass(true);
                case tt._import:
                    return this.parseImport();
                case tt._export:
                    return this.parseExport();
                default:
                    var expr = this.parseExpression();
                    if (isDummy(expr)) {
                        this.next();
                        if (this.tok.type === tt.eof)
                            return this.finishNode(node, 'EmptyStatement');
                        return this.parseStatement();
                    } else if (starttype === tt.name && expr.type === 'Identifier' && this.eat(tt.colon)) {
                        node.body = this.parseStatement();
                        node.label = expr;
                        return this.finishNode(node, 'LabeledStatement');
                    } else {
                        node.expression = expr;
                        this.semicolon();
                        return this.finishNode(node, 'ExpressionStatement');
                    }
                }
            };
            lp.parseBlock = function () {
                var node = this.startNode();
                this.pushCx();
                this.expect(tt.braceL);
                var blockIndent = this.curIndent, line = this.curLineStart;
                node.body = [];
                while (!this.closes(tt.braceR, blockIndent, line, true))
                    node.body.push(this.parseStatement());
                this.popCx();
                this.eat(tt.braceR);
                return this.finishNode(node, 'BlockStatement');
            };
            lp.parseFor = function (node, init) {
                node.init = init;
                node.test = node.update = null;
                if (this.eat(tt.semi) && this.tok.type !== tt.semi)
                    node.test = this.parseExpression();
                if (this.eat(tt.semi) && this.tok.type !== tt.parenR)
                    node.update = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                node.body = this.parseStatement();
                return this.finishNode(node, 'ForStatement');
            };
            lp.parseForIn = function (node, init) {
                var type = this.tok.type === tt._in ? 'ForInStatement' : 'ForOfStatement';
                this.next();
                node.left = init;
                node.right = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                node.body = this.parseStatement();
                return this.finishNode(node, type);
            };
            lp.parseVar = function (noIn, kind) {
                var node = this.startNode();
                node.kind = kind;
                this.next();
                node.declarations = [];
                do {
                    var decl = this.startNode();
                    decl.id = this.options.ecmaVersion >= 6 ? this.toAssignable(this.parseExprAtom(), true) : this.parseIdent();
                    decl.init = this.eat(tt.eq) ? this.parseMaybeAssign(noIn) : null;
                    node.declarations.push(this.finishNode(decl, 'VariableDeclarator'));
                } while (this.eat(tt.comma));
                if (!node.declarations.length) {
                    var decl = this.startNode();
                    decl.id = this.dummyIdent();
                    node.declarations.push(this.finishNode(decl, 'VariableDeclarator'));
                }
                if (!noIn)
                    this.semicolon();
                return this.finishNode(node, 'VariableDeclaration');
            };
            lp.parseClass = function (isStatement) {
                var node = this.startNode();
                this.next();
                if (this.tok.type === tt.name)
                    node.id = this.parseIdent();
                else if (isStatement)
                    node.id = this.dummyIdent();
                else
                    node.id = null;
                node.superClass = this.eat(tt._extends) ? this.parseExpression() : null;
                node.body = this.startNode();
                node.body.body = [];
                this.pushCx();
                var indent = this.curIndent + 1, line = this.curLineStart;
                this.eat(tt.braceL);
                if (this.curIndent + 1 < indent) {
                    indent = this.curIndent;
                    line = this.curLineStart;
                }
                while (!this.closes(tt.braceR, indent, line)) {
                    if (this.semicolon())
                        continue;
                    var method = this.startNode(), isGenerator = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        method['static'] = false;
                        isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(method);
                    if (isDummy(method.key)) {
                        if (isDummy(this.parseMaybeAssign()))
                            this.next();
                        this.eat(tt.comma);
                        continue;
                    }
                    if (method.key.type === 'Identifier' && !method.computed && method.key.name === 'static' && (this.tok.type != tt.parenL && this.tok.type != tt.braceL)) {
                        method['static'] = true;
                        isGenerator = this.eat(tt.star);
                        this.parsePropertyName(method);
                    } else {
                        method['static'] = false;
                    }
                    if (this.options.ecmaVersion >= 5 && method.key.type === 'Identifier' && !method.computed && (method.key.name === 'get' || method.key.name === 'set') && this.tok.type !== tt.parenL && this.tok.type !== tt.braceL) {
                        method.kind = method.key.name;
                        this.parsePropertyName(method);
                        method.value = this.parseMethod(false);
                    } else {
                        if (!method.computed && !method['static'] && !isGenerator && (method.key.type === 'Identifier' && method.key.name === 'constructor' || method.key.type === 'Literal' && method.key.value === 'constructor')) {
                            method.kind = 'constructor';
                        } else {
                            method.kind = 'method';
                        }
                        method.value = this.parseMethod(isGenerator);
                    }
                    node.body.body.push(this.finishNode(method, 'MethodDefinition'));
                }
                this.popCx();
                if (!this.eat(tt.braceR)) {
                    this.last.end = this.tok.start;
                    if (this.options.locations)
                        this.last.loc.end = this.tok.loc.start;
                }
                this.semicolon();
                this.finishNode(node.body, 'ClassBody');
                return this.finishNode(node, isStatement ? 'ClassDeclaration' : 'ClassExpression');
            };
            lp.parseFunction = function (node, isStatement) {
                this.initFunction(node);
                if (this.options.ecmaVersion >= 6) {
                    node.generator = this.eat(tt.star);
                }
                if (this.tok.type === tt.name)
                    node.id = this.parseIdent();
                else if (isStatement)
                    node.id = this.dummyIdent();
                node.params = this.parseFunctionParams();
                node.body = this.parseBlock();
                return this.finishNode(node, isStatement ? 'FunctionDeclaration' : 'FunctionExpression');
            };
            lp.parseExport = function () {
                var node = this.startNode();
                this.next();
                if (this.eat(tt.star)) {
                    node.source = this.eatContextual('from') ? this.parseExprAtom() : null;
                    return this.finishNode(node, 'ExportAllDeclaration');
                }
                if (this.eat(tt._default)) {
                    var expr = this.parseMaybeAssign();
                    if (expr.id) {
                        switch (expr.type) {
                        case 'FunctionExpression':
                            expr.type = 'FunctionDeclaration';
                            break;
                        case 'ClassExpression':
                            expr.type = 'ClassDeclaration';
                            break;
                        }
                    }
                    node.declaration = expr;
                    this.semicolon();
                    return this.finishNode(node, 'ExportDefaultDeclaration');
                }
                if (this.tok.type.keyword || this.toks.isLet()) {
                    node.declaration = this.parseStatement();
                    node.specifiers = [];
                    node.source = null;
                } else {
                    node.declaration = null;
                    node.specifiers = this.parseExportSpecifierList();
                    node.source = this.eatContextual('from') ? this.parseExprAtom() : null;
                    this.semicolon();
                }
                return this.finishNode(node, 'ExportNamedDeclaration');
            };
            lp.parseImport = function () {
                var node = this.startNode();
                this.next();
                if (this.tok.type === tt.string) {
                    node.specifiers = [];
                    node.source = this.parseExprAtom();
                    node.kind = '';
                } else {
                    var elt = undefined;
                    if (this.tok.type === tt.name && this.tok.value !== 'from') {
                        elt = this.startNode();
                        elt.local = this.parseIdent();
                        this.finishNode(elt, 'ImportDefaultSpecifier');
                        this.eat(tt.comma);
                    }
                    node.specifiers = this.parseImportSpecifierList();
                    node.source = this.eatContextual('from') && this.tok.type == tt.string ? this.parseExprAtom() : this.dummyString();
                    if (elt)
                        node.specifiers.unshift(elt);
                }
                this.semicolon();
                return this.finishNode(node, 'ImportDeclaration');
            };
            lp.parseImportSpecifierList = function () {
                var elts = [];
                if (this.tok.type === tt.star) {
                    var elt = this.startNode();
                    this.next();
                    if (this.eatContextual('as'))
                        elt.local = this.parseIdent();
                    elts.push(this.finishNode(elt, 'ImportNamespaceSpecifier'));
                } else {
                    var indent = this.curIndent, line = this.curLineStart, continuedLine = this.nextLineStart;
                    this.pushCx();
                    this.eat(tt.braceL);
                    if (this.curLineStart > continuedLine)
                        continuedLine = this.curLineStart;
                    while (!this.closes(tt.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
                        var elt = this.startNode();
                        if (this.eat(tt.star)) {
                            elt.local = this.eatContextual('as') ? this.parseIdent() : this.dummyIdent();
                            this.finishNode(elt, 'ImportNamespaceSpecifier');
                        } else {
                            if (this.isContextual('from'))
                                break;
                            elt.imported = this.parseIdent();
                            if (isDummy(elt.imported))
                                break;
                            elt.local = this.eatContextual('as') ? this.parseIdent() : elt.imported;
                            this.finishNode(elt, 'ImportSpecifier');
                        }
                        elts.push(elt);
                        this.eat(tt.comma);
                    }
                    this.eat(tt.braceR);
                    this.popCx();
                }
                return elts;
            };
            lp.parseExportSpecifierList = function () {
                var elts = [];
                var indent = this.curIndent, line = this.curLineStart, continuedLine = this.nextLineStart;
                this.pushCx();
                this.eat(tt.braceL);
                if (this.curLineStart > continuedLine)
                    continuedLine = this.curLineStart;
                while (!this.closes(tt.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
                    if (this.isContextual('from'))
                        break;
                    var elt = this.startNode();
                    elt.local = this.parseIdent();
                    if (isDummy(elt.local))
                        break;
                    elt.exported = this.eatContextual('as') ? this.parseIdent() : elt.local;
                    this.finishNode(elt, 'ExportSpecifier');
                    elts.push(elt);
                    this.eat(tt.comma);
                }
                this.eat(tt.braceR);
                this.popCx();
                return elts;
            };
        }
    };
})
System.register('acorn/src/loose/expression.js', [
    './state',
    './parseutil',
    '..'
], function (_export) {
    'use strict';
    var LooseParser, isDummy, tt, lp;
    return {
        setters: [
            function (_state) {
                LooseParser = _state.LooseParser;
            },
            function (_parseutil) {
                isDummy = _parseutil.isDummy;
            },
            function (_) {
                tt = _.tokTypes;
            }
        ],
        execute: function () {
            lp = LooseParser.prototype;
            lp.checkLVal = function (expr) {
                if (!expr)
                    return expr;
                switch (expr.type) {
                case 'Identifier':
                case 'MemberExpression':
                    return expr;
                case 'ParenthesizedExpression':
                    expr.expression = this.checkLVal(expr.expression);
                    return expr;
                default:
                    return this.dummyIdent();
                }
            };
            lp.parseExpression = function (noIn) {
                var start = this.storeCurrentPos();
                var expr = this.parseMaybeAssign(noIn);
                if (this.tok.type === tt.comma) {
                    var node = this.startNodeAt(start);
                    node.expressions = [expr];
                    while (this.eat(tt.comma))
                        node.expressions.push(this.parseMaybeAssign(noIn));
                    return this.finishNode(node, 'SequenceExpression');
                }
                return expr;
            };
            lp.parseParenExpression = function () {
                this.pushCx();
                this.expect(tt.parenL);
                var val = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                return val;
            };
            lp.parseMaybeAssign = function (noIn) {
                if (this.toks.isContextual('yield')) {
                    var node = this.startNode();
                    this.next();
                    if (this.semicolon() || this.canInsertSemicolon() || this.tok.type != tt.star && !this.tok.type.startsExpr) {
                        node.delegate = false;
                        node.argument = null;
                    } else {
                        node.delegate = this.eat(tt.star);
                        node.argument = this.parseMaybeAssign();
                    }
                    return this.finishNode(node, 'YieldExpression');
                }
                var start = this.storeCurrentPos();
                var left = this.parseMaybeConditional(noIn);
                if (this.tok.type.isAssign) {
                    var node = this.startNodeAt(start);
                    node.operator = this.tok.value;
                    node.left = this.tok.type === tt.eq ? this.toAssignable(left) : this.checkLVal(left);
                    this.next();
                    node.right = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, 'AssignmentExpression');
                }
                return left;
            };
            lp.parseMaybeConditional = function (noIn) {
                var start = this.storeCurrentPos();
                var expr = this.parseExprOps(noIn);
                if (this.eat(tt.question)) {
                    var node = this.startNodeAt(start);
                    node.test = expr;
                    node.consequent = this.parseMaybeAssign();
                    node.alternate = this.expect(tt.colon) ? this.parseMaybeAssign(noIn) : this.dummyIdent();
                    return this.finishNode(node, 'ConditionalExpression');
                }
                return expr;
            };
            lp.parseExprOps = function (noIn) {
                var start = this.storeCurrentPos();
                var indent = this.curIndent, line = this.curLineStart;
                return this.parseExprOp(this.parseMaybeUnary(false), start, -1, noIn, indent, line);
            };
            lp.parseExprOp = function (left, start, minPrec, noIn, indent, line) {
                if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine())
                    return left;
                var prec = this.tok.type.binop;
                if (prec != null && (!noIn || this.tok.type !== tt._in)) {
                    if (prec > minPrec) {
                        var node = this.startNodeAt(start);
                        node.left = left;
                        node.operator = this.tok.value;
                        this.next();
                        if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine()) {
                            node.right = this.dummyIdent();
                        } else {
                            var rightStart = this.storeCurrentPos();
                            node.right = this.parseExprOp(this.parseMaybeUnary(false), rightStart, prec, noIn, indent, line);
                        }
                        this.finishNode(node, /&&|\|\|/.test(node.operator) ? 'LogicalExpression' : 'BinaryExpression');
                        return this.parseExprOp(node, start, minPrec, noIn, indent, line);
                    }
                }
                return left;
            };
            lp.parseMaybeUnary = function (sawUnary) {
                var start = this.storeCurrentPos(), expr = undefined;
                if (this.tok.type.prefix) {
                    var node = this.startNode(), update = this.tok.type === tt.incDec;
                    if (!update)
                        sawUnary = true;
                    node.operator = this.tok.value;
                    node.prefix = true;
                    this.next();
                    node.argument = this.parseMaybeUnary(true);
                    if (update)
                        node.argument = this.checkLVal(node.argument);
                    expr = this.finishNode(node, update ? 'UpdateExpression' : 'UnaryExpression');
                } else if (this.tok.type === tt.ellipsis) {
                    var node = this.startNode();
                    this.next();
                    node.argument = this.parseMaybeUnary(sawUnary);
                    expr = this.finishNode(node, 'SpreadElement');
                } else {
                    expr = this.parseExprSubscripts();
                    while (this.tok.type.postfix && !this.canInsertSemicolon()) {
                        var node = this.startNodeAt(start);
                        node.operator = this.tok.value;
                        node.prefix = false;
                        node.argument = this.checkLVal(expr);
                        this.next();
                        expr = this.finishNode(node, 'UpdateExpression');
                    }
                }
                if (!sawUnary && this.eat(tt.starstar)) {
                    var node = this.startNodeAt(start);
                    node.operator = '**';
                    node.left = expr;
                    node.right = this.parseMaybeUnary(false);
                    return this.finishNode(node, 'BinaryExpression');
                }
                return expr;
            };
            lp.parseExprSubscripts = function () {
                var start = this.storeCurrentPos();
                return this.parseSubscripts(this.parseExprAtom(), start, false, this.curIndent, this.curLineStart);
            };
            lp.parseSubscripts = function (base, start, noCalls, startIndent, line) {
                for (;;) {
                    if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) {
                        if (this.tok.type == tt.dot && this.curIndent == startIndent)
                            --startIndent;
                        else
                            return base;
                    }
                    if (this.eat(tt.dot)) {
                        var node = this.startNodeAt(start);
                        node.object = base;
                        if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine())
                            node.property = this.dummyIdent();
                        else
                            node.property = this.parsePropertyAccessor() || this.dummyIdent();
                        node.computed = false;
                        base = this.finishNode(node, 'MemberExpression');
                    } else if (this.tok.type == tt.bracketL) {
                        this.pushCx();
                        this.next();
                        var node = this.startNodeAt(start);
                        node.object = base;
                        node.property = this.parseExpression();
                        node.computed = true;
                        this.popCx();
                        this.expect(tt.bracketR);
                        base = this.finishNode(node, 'MemberExpression');
                    } else if (!noCalls && this.tok.type == tt.parenL) {
                        var node = this.startNodeAt(start);
                        node.callee = base;
                        node.arguments = this.parseExprList(tt.parenR);
                        base = this.finishNode(node, 'CallExpression');
                    } else if (this.tok.type == tt.backQuote) {
                        var node = this.startNodeAt(start);
                        node.tag = base;
                        node.quasi = this.parseTemplate();
                        base = this.finishNode(node, 'TaggedTemplateExpression');
                    } else {
                        return base;
                    }
                }
            };
            lp.parseExprAtom = function () {
                var node = undefined;
                switch (this.tok.type) {
                case tt._this:
                case tt._super:
                    var type = this.tok.type === tt._this ? 'ThisExpression' : 'Super';
                    node = this.startNode();
                    this.next();
                    return this.finishNode(node, type);
                case tt.name:
                    var start = this.storeCurrentPos();
                    var id = this.parseIdent();
                    return this.eat(tt.arrow) ? this.parseArrowExpression(this.startNodeAt(start), [id]) : id;
                case tt.regexp:
                    node = this.startNode();
                    var val = this.tok.value;
                    node.regex = {
                        pattern: val.pattern,
                        flags: val.flags
                    };
                    node.value = val.value;
                    node.raw = this.input.slice(this.tok.start, this.tok.end);
                    this.next();
                    return this.finishNode(node, 'Literal');
                case tt.num:
                case tt.string:
                    node = this.startNode();
                    node.value = this.tok.value;
                    node.raw = this.input.slice(this.tok.start, this.tok.end);
                    this.next();
                    return this.finishNode(node, 'Literal');
                case tt._null:
                case tt._true:
                case tt._false:
                    node = this.startNode();
                    node.value = this.tok.type === tt._null ? null : this.tok.type === tt._true;
                    node.raw = this.tok.type.keyword;
                    this.next();
                    return this.finishNode(node, 'Literal');
                case tt.parenL:
                    var parenStart = this.storeCurrentPos();
                    this.next();
                    var inner = this.parseExpression();
                    this.expect(tt.parenR);
                    if (this.eat(tt.arrow)) {
                        return this.parseArrowExpression(this.startNodeAt(parenStart), inner.expressions || (isDummy(inner) ? [] : [inner]));
                    }
                    if (this.options.preserveParens) {
                        var par = this.startNodeAt(parenStart);
                        par.expression = inner;
                        inner = this.finishNode(par, 'ParenthesizedExpression');
                    }
                    return inner;
                case tt.bracketL:
                    node = this.startNode();
                    node.elements = this.parseExprList(tt.bracketR, true);
                    return this.finishNode(node, 'ArrayExpression');
                case tt.braceL:
                    return this.parseObj();
                case tt._class:
                    return this.parseClass();
                case tt._function:
                    node = this.startNode();
                    this.next();
                    return this.parseFunction(node, false);
                case tt._new:
                    return this.parseNew();
                case tt.backQuote:
                    return this.parseTemplate();
                default:
                    return this.dummyIdent();
                }
            };
            lp.parseNew = function () {
                var node = this.startNode(), startIndent = this.curIndent, line = this.curLineStart;
                var meta = this.parseIdent(true);
                if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
                    node.meta = meta;
                    node.property = this.parseIdent(true);
                    return this.finishNode(node, 'MetaProperty');
                }
                var start = this.storeCurrentPos();
                node.callee = this.parseSubscripts(this.parseExprAtom(), start, true, startIndent, line);
                if (this.tok.type == tt.parenL) {
                    node.arguments = this.parseExprList(tt.parenR);
                } else {
                    node.arguments = [];
                }
                return this.finishNode(node, 'NewExpression');
            };
            lp.parseTemplateElement = function () {
                var elem = this.startNode();
                elem.value = {
                    raw: this.input.slice(this.tok.start, this.tok.end).replace(/\r\n?/g, '\n'),
                    cooked: this.tok.value
                };
                this.next();
                elem.tail = this.tok.type === tt.backQuote;
                return this.finishNode(elem, 'TemplateElement');
            };
            lp.parseTemplate = function () {
                var node = this.startNode();
                this.next();
                node.expressions = [];
                var curElt = this.parseTemplateElement();
                node.quasis = [curElt];
                while (!curElt.tail) {
                    this.next();
                    node.expressions.push(this.parseExpression());
                    if (this.expect(tt.braceR)) {
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
                this.expect(tt.backQuote);
                return this.finishNode(node, 'TemplateLiteral');
            };
            lp.parseObj = function () {
                var node = this.startNode();
                node.properties = [];
                this.pushCx();
                var indent = this.curIndent + 1, line = this.curLineStart;
                this.eat(tt.braceL);
                if (this.curIndent + 1 < indent) {
                    indent = this.curIndent;
                    line = this.curLineStart;
                }
                while (!this.closes(tt.braceR, indent, line)) {
                    var prop = this.startNode(), isGenerator = undefined, start = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        start = this.storeCurrentPos();
                        prop.method = false;
                        prop.shorthand = false;
                        isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(prop);
                    if (isDummy(prop.key)) {
                        if (isDummy(this.parseMaybeAssign()))
                            this.next();
                        this.eat(tt.comma);
                        continue;
                    }
                    if (this.eat(tt.colon)) {
                        prop.kind = 'init';
                        prop.value = this.parseMaybeAssign();
                    } else if (this.options.ecmaVersion >= 6 && (this.tok.type === tt.parenL || this.tok.type === tt.braceL)) {
                        prop.kind = 'init';
                        prop.method = true;
                        prop.value = this.parseMethod(isGenerator);
                    } else if (this.options.ecmaVersion >= 5 && prop.key.type === 'Identifier' && !prop.computed && (prop.key.name === 'get' || prop.key.name === 'set') && (this.tok.type != tt.comma && this.tok.type != tt.braceR)) {
                        prop.kind = prop.key.name;
                        this.parsePropertyName(prop);
                        prop.value = this.parseMethod(false);
                    } else {
                        prop.kind = 'init';
                        if (this.options.ecmaVersion >= 6) {
                            if (this.eat(tt.eq)) {
                                var assign = this.startNodeAt(start);
                                assign.operator = '=';
                                assign.left = prop.key;
                                assign.right = this.parseMaybeAssign();
                                prop.value = this.finishNode(assign, 'AssignmentExpression');
                            } else {
                                prop.value = prop.key;
                            }
                        } else {
                            prop.value = this.dummyIdent();
                        }
                        prop.shorthand = true;
                    }
                    node.properties.push(this.finishNode(prop, 'Property'));
                    this.eat(tt.comma);
                }
                this.popCx();
                if (!this.eat(tt.braceR)) {
                    this.last.end = this.tok.start;
                    if (this.options.locations)
                        this.last.loc.end = this.tok.loc.start;
                }
                return this.finishNode(node, 'ObjectExpression');
            };
            lp.parsePropertyName = function (prop) {
                if (this.options.ecmaVersion >= 6) {
                    if (this.eat(tt.bracketL)) {
                        prop.computed = true;
                        prop.key = this.parseExpression();
                        this.expect(tt.bracketR);
                        return;
                    } else {
                        prop.computed = false;
                    }
                }
                var key = this.tok.type === tt.num || this.tok.type === tt.string ? this.parseExprAtom() : this.parseIdent();
                prop.key = key || this.dummyIdent();
            };
            lp.parsePropertyAccessor = function () {
                if (this.tok.type === tt.name || this.tok.type.keyword)
                    return this.parseIdent();
            };
            lp.parseIdent = function () {
                var name = this.tok.type === tt.name ? this.tok.value : this.tok.type.keyword;
                if (!name)
                    return this.dummyIdent();
                var node = this.startNode();
                this.next();
                node.name = name;
                return this.finishNode(node, 'Identifier');
            };
            lp.initFunction = function (node) {
                node.id = null;
                node.params = [];
                if (this.options.ecmaVersion >= 6) {
                    node.generator = false;
                    node.expression = false;
                }
            };
            lp.toAssignable = function (node, binding) {
                if (!node || node.type == 'Identifier' || node.type == 'MemberExpression' && !binding) {
                } else if (node.type == 'ParenthesizedExpression') {
                    node.expression = this.toAssignable(node.expression, binding);
                } else if (this.options.ecmaVersion < 6) {
                    return this.dummyIdent();
                } else if (node.type == 'ObjectExpression') {
                    node.type = 'ObjectPattern';
                    var props = node.properties;
                    for (var i = 0; i < props.length; i++) {
                        props[i].value = this.toAssignable(props[i].value, binding);
                    }
                } else if (node.type == 'ArrayExpression') {
                    node.type = 'ArrayPattern';
                    this.toAssignableList(node.elements, binding);
                } else if (node.type == 'SpreadElement') {
                    node.type = 'RestElement';
                    node.argument = this.toAssignable(node.argument, binding);
                } else if (node.type == 'AssignmentExpression') {
                    node.type = 'AssignmentPattern';
                    delete node.operator;
                } else {
                    return this.dummyIdent();
                }
                return node;
            };
            lp.toAssignableList = function (exprList, binding) {
                for (var i = 0; i < exprList.length; i++) {
                    exprList[i] = this.toAssignable(exprList[i], binding);
                }
                return exprList;
            };
            lp.parseFunctionParams = function (params) {
                params = this.parseExprList(tt.parenR);
                return this.toAssignableList(params, true);
            };
            lp.parseMethod = function (isGenerator) {
                var node = this.startNode();
                this.initFunction(node);
                node.params = this.parseFunctionParams();
                node.generator = isGenerator || false;
                node.expression = this.options.ecmaVersion >= 6 && this.tok.type !== tt.braceL;
                node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
                return this.finishNode(node, 'FunctionExpression');
            };
            lp.parseArrowExpression = function (node, params) {
                this.initFunction(node);
                node.params = this.toAssignableList(params, true);
                node.expression = this.tok.type !== tt.braceL;
                node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
                return this.finishNode(node, 'ArrowFunctionExpression');
            };
            lp.parseExprList = function (close, allowEmpty) {
                this.pushCx();
                var indent = this.curIndent, line = this.curLineStart, elts = [];
                this.next();
                while (!this.closes(close, indent + 1, line)) {
                    if (this.eat(tt.comma)) {
                        elts.push(allowEmpty ? null : this.dummyIdent());
                        continue;
                    }
                    var elt = this.parseMaybeAssign();
                    if (isDummy(elt)) {
                        if (this.closes(close, indent, line))
                            break;
                        this.next();
                    } else {
                        elts.push(elt);
                    }
                    this.eat(tt.comma);
                }
                this.popCx();
                if (!this.eat(close)) {
                    this.last.end = this.tok.start;
                    if (this.options.locations)
                        this.last.loc.end = this.tok.loc.start;
                }
                return elts;
            };
        }
    };
})
System.register('acorn/src/util.js', [], function (_export) {
    'use strict';
    _export('isArray', isArray);
    _export('has', has);
    function isArray(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    }
    function has(obj, propName) {
        return Object.prototype.hasOwnProperty.call(obj, propName);
    }
    return {
        setters: [],
        execute: function () {
        }
    };
})
System.register('acorn/src/loose/parseutil.js', [], function (_export) {
    'use strict';
    _export('isDummy', isDummy);
    function isDummy(node) {
        return node.name == '\u2716';
    }
    return {
        setters: [],
        execute: function () {
        }
    };
})