System.registerDynamic('lively.ast/package.json', [], false, function(require, exports, module) {
return {
  "name": "lively.ast",
  "version": "0.6.0",
  "description": "Parsing JS code into ASTs and tools to query and transform these trees.",
  "main": "index.js",
  "scripts": {
    "test": "./node_modules/mocha-es6/bin/mocha-es6.js tests/*-test.js",
    "build": "node -e \"require('./build.js')();\""
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/LivelyKernel/lively.ast.git"
  },
  "keywords": [
    "LivelyWeb",
    "parser",
    "parsing",
    "estree",
    "ast",
    "lively"
  ],
  "author": "Robert Krahn",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/LivelyKernel/lively.ast/issues"
  },
  "homepage": "https://github.com/LivelyKernel/lively.ast",
  "dependencies": {
    "acorn": "^2.7.0",
    "escodegen": "^1.8.0",
    "lively.lang": "^0.5.17"
  },
  "devDependencies": {
    "babel-core": "^5.8.35",
    "estree-to-js": "^0.1.0",
    "mocha-es6": "^0.1.4",
    "mocha-phantomjs-core": "^1.3.0",
    "systemjs": "^0.19.23",
    "systemjs-builder": "^0.15.10"
  },
  "systemjs": {
    "main": "index.js",
    "map": {
      "lively.ast": ".",
      "escodegen": "./dist/escodegen.browser.js",
      "util": {
        "node": "@node/util",
        "~node": "@empty"
      },
      "child_process": {
        "node": "@node/child_process",
        "~node": "@empty"
      }
    },
    "meta": {
      "dist/escodegen.browser.js": {
        "format": "global"
      }
    }
  },
  "lively": {
    "packageMap": {
      "lively.lang": "./node_modules/lively.lang",
      "acorn": "./node_modules/acorn"
    }
  }
}
});

System.register('lively.ast/index.js', [
    './lib/mozilla-ast-visitor-interface.js',
    './lib/parser.js',
    './lib/acorn-extension.js',
    './lib/stringify.js',
    './lib/query.js',
    './lib/transform.js',
    './lib/capturing.js',
    './lib/comments.js',
    './lib/code-categorizer.js'
], function (_export) {
    'use strict';
    var withMozillaAstDo, printAst, compareAst, pathToNode, rematchAstWithSource, parse, parseFunction, parseLikeOMeta, fuzzyParse, acorn, stringify, escodegen, query, transform, capturing, comments, categorizer;
    return {
        setters: [
            function (_libMozillaAstVisitorInterfaceJs) {
                withMozillaAstDo = _libMozillaAstVisitorInterfaceJs.withMozillaAstDo;
                printAst = _libMozillaAstVisitorInterfaceJs.printAst;
                compareAst = _libMozillaAstVisitorInterfaceJs.compareAst;
                pathToNode = _libMozillaAstVisitorInterfaceJs.pathToNode;
                rematchAstWithSource = _libMozillaAstVisitorInterfaceJs.rematchAstWithSource;
            },
            function (_libParserJs) {
                parse = _libParserJs.parse;
                parseFunction = _libParserJs.parseFunction;
                parseLikeOMeta = _libParserJs.parseLikeOMeta;
                fuzzyParse = _libParserJs.fuzzyParse;
            },
            function (_libAcornExtensionJs) {
                acorn = _libAcornExtensionJs.acorn;
            },
            function (_libStringifyJs) {
                stringify = _libStringifyJs['default'];
                escodegen = _libStringifyJs.escodegen;
            },
            function (_libQueryJs) {
                query = _libQueryJs;
            },
            function (_libTransformJs) {
                transform = _libTransformJs;
            },
            function (_libCapturingJs) {
                capturing = _libCapturingJs;
            },
            function (_libCommentsJs) {
                comments = _libCommentsJs;
            },
            function (_libCodeCategorizerJs) {
                categorizer = _libCodeCategorizerJs;
            }
        ],
        execute: function () {
            _export('withMozillaAstDo', withMozillaAstDo);
            _export('printAst', printAst);
            _export('compareAst', compareAst);
            _export('pathToNode', pathToNode);
            _export('rematchAstWithSource', rematchAstWithSource);
            _export('parse', parse);
            _export('parseFunction', parseFunction);
            _export('parseLikeOMeta', parseLikeOMeta);
            _export('fuzzyParse', fuzzyParse);
            _export('escodegen', escodegen);
            _export('acorn', acorn);
            _export('query', query);
            _export('transform', transform);
            _export('capturing', capturing);
            _export('comments', comments);
            _export('categorizer', categorizer);
            _export('stringify', stringify);
        }
    };
})
System.register('lively.ast/lib/mozilla-ast-visitor-interface.js', [
    'lively.lang',
    './mozilla-ast-visitors.js',
    './stringify.js',
    './acorn-extension.js',
    './parser.js'
], function (_export) {
    'use strict';
    var string, Path, BaseVisitor, PrinterVisitor, ComparisonVisitor, stringify, acorn, parse, methods, withMozillaAstDo, printAst, compareAst, pathToNode, rematchAstWithSource;
    return {
        setters: [
            function (_livelyLang) {
                string = _livelyLang.string;
                Path = _livelyLang.Path;
            },
            function (_mozillaAstVisitorsJs) {
                BaseVisitor = _mozillaAstVisitorsJs.BaseVisitor;
                PrinterVisitor = _mozillaAstVisitorsJs.PrinterVisitor;
                ComparisonVisitor = _mozillaAstVisitorsJs.ComparisonVisitor;
            },
            function (_stringifyJs) {
                stringify = _stringifyJs['default'];
            },
            function (_acornExtensionJs) {
                acorn = _acornExtensionJs.acorn;
            },
            function (_parserJs) {
                parse = _parserJs.parse;
            }
        ],
        execute: function () {
            methods = {
                withMozillaAstDo: function withMozillaAstDo(parsed, state, func) {
                    var vis = new BaseVisitor(), origAccept = vis.accept;
                    vis.accept = function (node, depth, st, path) {
                        var next = function next() {
                            origAccept.call(vis, node, depth, st, path);
                        };
                        return func(next, node, st, depth, path);
                    };
                    return vis.accept(parsed, 0, state, []);
                },
                printAst: function printAst(astOrSource, options) {
                    options = options || {};
                    var printSource = options.printSource || false, printPositions = options.printPositions || false, printIndex = options.printIndex || false, source, parsed, tree = [];
                    if (typeof astOrSource === 'string') {
                        source = astOrSource;
                        parsed = parse(astOrSource);
                    } else {
                        parsed = astOrSource;
                        source = options.source || parsed.source;
                    }
                    if (printSource && !parsed.source) {
                        if (!source) {
                            source = stringify(parsed);
                            parsed = parse(source);
                        }
                        acorn.walk.addSource(parsed, source);
                    }
                    function printFunc(ea) {
                        var string = ea.path + ':' + ea.node.type, additional = [];
                        if (printIndex) {
                            additional.push(ea.index);
                        }
                        if (printPositions) {
                            additional.push(ea.node.start + '-' + ea.node.end);
                        }
                        if (printSource) {
                            var src = ea.node.source || source.slice(ea.node.start, ea.node.end), printed = string.print.print(src.truncate(60).replace(/\n/g, '').replace(/\s+/g, ' '));
                            additional.push(printed);
                        }
                        if (additional.length) {
                            string += '(' + additional.join(',') + ')';
                        }
                        return string;
                    }
                    new PrinterVisitor().accept(parsed, { index: 0 }, tree, []);
                    return string.printTree(tree[0], printFunc, function (ea) {
                        return ea.children;
                    }, '  ');
                },
                compareAst: function compareAst(node1, node2) {
                    if (!node1 || !node2)
                        throw new Error('node' + (node1 ? '1' : '2') + ' not defined');
                    var state = {
                        completePath: [],
                        comparisons: { errors: [] }
                    };
                    new ComparisonVisitor().accept(node1, node2, state, []);
                    return !state.comparisons.errors.length ? null : state.comparisons.errors.pluck('msg');
                },
                pathToNode: function pathToNode(parsed, index, options) {
                    options = options || {};
                    if (!parsed.astIndex)
                        acorn.walk.addAstIndex(parsed);
                    var vis = new BaseVisitor(), found = null;
                    (vis.accept = function (node, pathToHere, state, path) {
                        if (found)
                            return;
                        var fullPath = pathToHere.concat(path);
                        if (node.astIndex === index) {
                            var pathString = fullPath.map(function (ea) {
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
                rematchAstWithSource: function rematchAstWithSource(parsed, source, addLocations, subTreePath) {
                    addLocations = !!addLocations;
                    var parsed2 = parse(source, addLocations ? { locations: true } : undefined), visitor = new BaseVisitor();
                    if (subTreePath)
                        parsed2 = Path(subTreePath).get(parsed2);
                    visitor.accept = function (node, depth, state, path) {
                        path = path || [];
                        var node2 = path.reduce(function (node, pathElem) {
                            return node[pathElem];
                        }, parsed);
                        node2.start = node.start;
                        node2.end = node.end;
                        if (addLocations)
                            node2.loc = node.loc;
                        return this['visit' + node.type](node, depth, state, path);
                    };
                    visitor.accept(parsed2);
                }
            };
            withMozillaAstDo = methods.withMozillaAstDo;
            printAst = methods.printAst;
            compareAst = methods.compareAst;
            pathToNode = methods.pathToNode;
            rematchAstWithSource = methods.rematchAstWithSource;
            _export('withMozillaAstDo', withMozillaAstDo);
            _export('printAst', printAst);
            _export('compareAst', compareAst);
            _export('pathToNode', pathToNode);
            _export('rematchAstWithSource', rematchAstWithSource);
        }
    };
})
System.register('lively.ast/lib/parser.js', [
    'lively.lang',
    './acorn-extension.js'
], function (_export) {
    'use strict';
    var arr, acorn, loose, walk;
    function parse(source, options) {
        options = options || {};
        options.ecmaVersion = options.ecmaVersion || 6;
        options.sourceType = options.sourceType || 'module';
        options.plugins = options.plugins || {};
        if (options.plugins.hasOwnProperty('jsx'))
            options.plugins.jsx = options.plugins.jsx;
        if (options.withComments) {
            delete options.withComments;
            var comments = [];
            options.onComment = function (isBlock, text, start, end, line, column) {
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
        var ast = options.addSource ? walk.addSource(source, options) : acorn.parse(source, options);
        if (options.addAstIndex && !ast.hasOwnProperty('astIndex'))
            walk.addAstIndex(ast);
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
            comments.forEach(function (comment) {
                var node = arr.detect(nodesAt(comment.start, ast).reverse(), function (node) {
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
            commentData.nodesWithComments.forEach(function (blockNode) {
                arr.clone(blockNode.comments).reduce(function (coalesceData, comment) {
                    if (comment.isBlock) {
                        coalesceData.lastComment = null;
                        return coalesceData;
                    }
                    if (!coalesceData.lastComment) {
                        coalesceData.lastComment = comment;
                        return coalesceData;
                    }
                    var last = coalesceData.lastComment;
                    var nodeInbetween = arr.detect(blockNode.body, function (node) {
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
                    last.text += '\n' + comment.text;
                    last.end = comment.end;
                    arr.remove(blockNode.comments, comment);
                    arr.remove(commentData.comments, comment);
                    return coalesceData;
                }, { lastComment: null });
            });
            return commentData;
        }
    }
    function parseFunction(source, options) {
        options = options || {};
        options.ecmaVersion = 6;
        options.sourceType = options.sourceType || 'module';
        options.plugins = options.plugins || {};
        if (options.plugins.hasOwnProperty('jsx'))
            options.plugins.jsx = options.plugins.jsx;
        var src = '(' + source + ')', ast = acorn.parse(src);
        walk.addSource(ast, src);
        return ast.body[0].expression;
    }
    function parseLikeOMeta(src, rule) {
        var self = this;
        function parse(source) {
            return walk.toLKObjects(self.parse(source));
        }
        var ast;
        switch (rule) {
        case 'expr':
        case 'stmt':
        case 'functionDef':
            ast = parse(src);
            if (ast.isSequence && ast.children.length == 1) {
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
        options.sourceType = options.sourceType || 'module';
        options.plugins = options.plugins || {};
        if (options.plugins.hasOwnProperty('jsx'))
            options.plugins.jsx = options.plugins.jsx;
        var ast, safeSource, err;
        if (options.type === 'LabeledStatement') {
            safeSource = '$={' + source + '}';
        }
        try {
            ast = parse(safeSource || source, options);
            if (safeSource)
                ast = null;
            else if (options.addSource)
                walk.addSource(ast, source);
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
            ast = loose.parse_dammit(source, options);
            if (options.addSource)
                walk.addSource(ast, source);
            ast.isFuzzy = true;
            ast.parseError = err;
        }
        return ast;
    }
    function nodesAt(pos, ast) {
        ast = typeof ast === 'string' ? this.parse(ast) : ast;
        return walk.findNodesIncluding(ast, pos);
    }
    return {
        setters: [
            function (_livelyLang) {
                arr = _livelyLang.arr;
            },
            function (_acornExtensionJs) {
                acorn = _acornExtensionJs.acorn;
                loose = _acornExtensionJs.loose;
                walk = _acornExtensionJs.walk;
            }
        ],
        execute: function () {
            _export('parse', parse);
            _export('parseFunction', parseFunction);
            _export('parseLikeOMeta', parseLikeOMeta);
            _export('fuzzyParse', fuzzyParse);
        }
    };
})
System.register('lively.ast/lib/acorn-extension.js', [
    'lively.lang',
    'acorn/src/index.js',
    'acorn/src/walk/index.js',
    'acorn/src/loose/index.js',
    './mozilla-ast-visitor-interface.js'
], function (_export) {
    'use strict';
    var obj, arr, string, Path, acorn_module, walk_module, loose_module, withMozillaAstDo, walk, loose, acorn;
    return {
        setters: [
            function (_livelyLang) {
                obj = _livelyLang.obj;
                arr = _livelyLang.arr;
                string = _livelyLang.string;
                Path = _livelyLang.Path;
            },
            function (_acornSrcIndexJs) {
                acorn_module = _acornSrcIndexJs;
            },
            function (_acornSrcWalkIndexJs) {
                walk_module = _acornSrcWalkIndexJs;
            },
            function (_acornSrcLooseIndexJs) {
                loose_module = _acornSrcLooseIndexJs;
            },
            function (_mozillaAstVisitorInterfaceJs) {
                withMozillaAstDo = _mozillaAstVisitorInterfaceJs.withMozillaAstDo;
            }
        ],
        execute: function () {
            walk = obj.extend({}, walk_module);
            loose = obj.extend({}, loose_module);
            acorn = obj.merge({
                walk: walk,
                loose: loose
            }, acorn_module);
            _export('acorn', acorn);
            _export('walk', walk);
            _export('loose', loose);
            walk.forEachNode = function (parsed, func, state, options) {
                options = options || {};
                var traversal = options.traversal || 'preorder';
                var visitors = obj.clone(options.visitors ? options.visitors : walk.visitors.withMemberExpression);
                var iterator = traversal === 'preorder' ? function (orig, type, node, depth, cont) {
                    func(node, state, depth, type);
                    return orig(node, depth + 1, cont);
                } : function (orig, type, node, depth, cont) {
                    var result = orig(node, depth + 1, cont);
                    func(node, state, depth, type);
                    return result;
                };
                Object.keys(visitors).forEach(function (type) {
                    var orig = visitors[type];
                    visitors[type] = function (node, depth, cont) {
                        return iterator(orig, type, node, depth, cont);
                    };
                });
                walk.recursive(parsed, 0, null, visitors);
                return parsed;
            };
            walk.matchNodes = function (parsed, visitor, state, options) {
                function visit(node, state, depth, type) {
                    if (visitor[node.type])
                        visitor[node.type](node, state, depth, type);
                }
                return walk.forEachNode(parsed, visit, state, options);
            };
            walk.findNodesIncluding = function (parsed, pos, test, base) {
                var nodes = [];
                base = base || obj.clone(walk.visitors.withMemberExpression);
                Object.keys(base).forEach(function (name) {
                    var orig = base[name];
                    base[name] = function (node, state, cont) {
                        arr.pushIfNotIncluded(nodes, node);
                        return orig(node, state, cont);
                    };
                });
                base['Property'] = function (node, st, c) {
                    arr.pushIfNotIncluded(nodes, node);
                    c(node.key, st, 'Expression');
                    c(node.value, st, 'Expression');
                };
                base['LabeledStatement'] = function (node, st, c) {
                    node.label && c(node.label, st, 'Expression');
                    c(node.body, st, 'Statement');
                };
                walk.findNodeAround(parsed, pos, test, base);
                return nodes;
            };
            walk.addSource = function (parsed, source, completeSrc, forceNewSource) {
                var options = options || {};
                options.ecmaVersion = options.ecmaVersion || 6;
                options.sourceType = options.sourceType || 'module';
                options.plugins = options.plugins || {};
                if (options.plugins.hasOwnProperty('jsx'))
                    options.plugins.jsx = options.plugins.jsx;
                source = typeof parsed === 'string' ? parsed : source;
                parsed = typeof parsed === 'string' ? acorn.parse(parsed, options) : parsed;
                completeSrc = !!completeSrc;
                return walk.forEachNode(parsed, function (node) {
                    if (node.source && !forceNewSource)
                        return;
                    node.source = completeSrc ? source : source.slice(node.start, node.end);
                });
            };
            walk.inspect = function (parsed, source) {
                var options = options || {};
                options.ecmaVersion = options.ecmaVersion || 6;
                options.sourceType = options.sourceType || 'module';
                options.plugins = options.plugins || {};
                if (options.plugins.hasOwnProperty('jsx'))
                    options.plugins.jsx = options.plugins.jsx;
                source = typeof parsed === 'string' ? parsed : null;
                parsed = typeof parsed === 'string' ? acorn.parse(parsed) : parsed;
                source && walk.addSource(parsed, source);
                return obj.inspect(parsed);
            };
            walk.withParentInfo = function (parsed, iterator, options) {
                options = options || {};
                function makeScope(parentScope) {
                    var scope = {
                        id: string.newUUID(),
                        parentScope: parentScope,
                        containingScopes: []
                    };
                    parentScope && parentScope.containingScopes.push(scope);
                    return scope;
                }
                var visitors = walk.make({
                    Function: function Function(node, st, c) {
                        if (st && st.scope)
                            st.scope = makeScope(st.scope);
                        c(node.body, st, 'ScopeBody');
                    },
                    VariableDeclarator: function VariableDeclarator(node, st, c) {
                        node.init && c(node.init, st, 'Expression');
                    },
                    VariableDeclaration: function VariableDeclaration(node, st, c) {
                        for (var i = 0; i < node.declarations.length; ++i) {
                            var decl = node.declarations[i];
                            if (decl)
                                c(decl, st, 'VariableDeclarator');
                        }
                    },
                    ObjectExpression: function ObjectExpression(node, st, c) {
                        for (var i = 0; i < node.properties.length; ++i) {
                            var prop = node.properties[i];
                            c(prop.key, st, 'Expression');
                            c(prop.value, st, 'Expression');
                        }
                    },
                    MemberExpression: function MemberExpression(node, st, c) {
                        c(node.object, st, 'Expression');
                        c(node.property, st, 'Expression');
                    }
                }, walk.base);
                var lastActiveProp, getters = [];
                walk.forEachNode(parsed, function (node) {
                    arr.withoutAll(Object.keys(node), [
                        'end',
                        'start',
                        'type',
                        'source',
                        'raw'
                    ]).forEach(function (propName) {
                        if (node.__lookupGetter__(propName))
                            return;
                        var val = node[propName];
                        node.__defineGetter__(propName, function () {
                            lastActiveProp = propName;
                            return val;
                        });
                        getters.push([
                            node,
                            propName,
                            node[propName]
                        ]);
                    });
                }, null, { visitors: visitors });
                var result = [];
                Object.keys(visitors).forEach(function (type) {
                    var orig = visitors[type];
                    visitors[type] = function (node, state, cont) {
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
                walk.recursive(parsed, {
                    scope: makeScope(),
                    parent: null,
                    propertyInParent: '',
                    depth: 0
                }, null, visitors);
                getters.forEach(function (nodeNameVal) {
                    delete nodeNameVal[0][nodeNameVal[1]];
                    nodeNameVal[0][nodeNameVal[1]] = nodeNameVal[2];
                });
                return result;
            };
            walk.toLKObjects = function (parsed) {
                if (!!!parsed.type)
                    throw new Error('Given AST is not an Acorn AST.');
                function newUndefined(start, end) {
                    start = start || -1;
                    end = end || -1;
                    return new Variable([
                        start,
                        end
                    ], 'undefined');
                }
                var visitors = {
                    Program: function Program(n, c) {
                        return new Sequence([
                            n.start,
                            n.end
                        ], n.body.map(c));
                    },
                    FunctionDeclaration: function FunctionDeclaration(n, c) {
                        var args = n.params.map(function (param) {
                            return new Variable([
                                param.start,
                                param.end
                            ], param.name);
                        });
                        var fn = new Function([
                            n.id.end,
                            n.end
                        ], c(n.body), args);
                        return new VarDeclaration([
                            n.start,
                            n.end
                        ], n.id.name, fn);
                    },
                    BlockStatement: function BlockStatement(n, c) {
                        var children = n.body.map(c);
                        return new Sequence([
                            n.start + 1,
                            n.end
                        ], children);
                    },
                    ExpressionStatement: function ExpressionStatement(n, c) {
                        return c(n.expression);
                    },
                    CallExpression: function CallExpression(n, c) {
                        if (n.callee.type == 'MemberExpression' && n.type != 'NewExpression') {
                            var property;
                            var r = n.callee.object;
                            if (n.callee.computed) {
                                property = c(n.callee.property);
                            } else {
                                property = new String([
                                    n.callee.property.start,
                                    n.callee.property.end
                                ], n.callee.property.name);
                            }
                            return new Send([
                                n.start,
                                n.end
                            ], property, c(r), n.arguments.map(c));
                        } else {
                            return new Call([
                                n.start,
                                n.end
                            ], c(n.callee), n.arguments.map(c));
                        }
                    },
                    MemberExpression: function MemberExpression(n, c) {
                        var slotName;
                        if (n.computed) {
                            slotName = c(n.property);
                        } else {
                            slotName = new String([
                                n.property.start,
                                n.property.end
                            ], n.property.name);
                        }
                        return new GetSlot([
                            n.start,
                            n.end
                        ], slotName, c(n.object));
                    },
                    NewExpression: function NewExpression(n, c) {
                        return new New([
                            n.start,
                            n.end
                        ], this.CallExpression(n, c));
                    },
                    VariableDeclaration: function VariableDeclaration(n, c) {
                        var start = n.declarations[0] ? n.declarations[0].start - 1 : n.start;
                        return new Sequence([
                            start,
                            n.end
                        ], n.declarations.map(c));
                    },
                    VariableDeclarator: function VariableDeclarator(n, c) {
                        var value = n.init ? c(n.init) : newUndefined(n.start - 1, n.start - 1);
                        return new VarDeclaration([
                            n.start - 1,
                            n.end
                        ], n.id.name, value);
                    },
                    FunctionExpression: function FunctionExpression(n, c) {
                        var args = n.params.map(function (param) {
                            return new Variable([
                                param.start,
                                param.end
                            ], param.name);
                        });
                        return new Function([
                            n.start,
                            n.end
                        ], c(n.body), args);
                    },
                    IfStatement: function IfStatement(n, c) {
                        return new If([
                            n.start,
                            n.end
                        ], c(n.test), c(n.consequent), n.alternate ? c(n.alternate) : newUndefined(n.consequent.end, n.consequent.end));
                    },
                    ConditionalExpression: function ConditionalExpression(n, c) {
                        return new Cond([
                            n.start,
                            n.end
                        ], c(n.test), c(n.consequent), c(n.alternate));
                    },
                    SwitchStatement: function SwitchStatement(n, c) {
                        return new Switch([
                            n.start,
                            n.end
                        ], c(n.discriminant), n.cases.map(c));
                    },
                    SwitchCase: function SwitchCase(n, c) {
                        var start = n.consequent.length > 0 ? n.consequent[0].start : n.end;
                        var end = n.consequent.length > 0 ? n.consequent[n.consequent.length - 1].end : n.end;
                        var seq = new Sequence([
                            start,
                            end
                        ], n.consequent.map(c));
                        if (n.test != null) {
                            return new Case([
                                n.start,
                                n.end
                            ], c(n.test), seq);
                        } else {
                            return new Default([
                                n.start,
                                n.end
                            ], seq);
                        }
                    },
                    BreakStatement: function BreakStatement(n, c) {
                        var label;
                        if (n.label == null) {
                            label = new Label([
                                n.end,
                                n.end
                            ], '');
                        } else {
                            label = new Label([
                                n.label.start,
                                n.label.end
                            ], n.label.name);
                        }
                        return new Break([
                            n.start,
                            n.end
                        ], label);
                    },
                    ContinueStatement: function ContinueStatement(n, c) {
                        var label;
                        if (n.label == null) {
                            label = new Label([
                                n.end,
                                n.end
                            ], '');
                        } else {
                            label = new Label([
                                n.label.start,
                                n.label.end
                            ], n.label.name);
                        }
                        return new Continue([
                            n.start,
                            n.end
                        ], label);
                    },
                    TryStatement: function TryStatement(n, c) {
                        var errVar, catchSeq;
                        if (n.handler) {
                            catchSeq = c(n.handler.body);
                            errVar = c(n.handler.param);
                        } else {
                            catchSeq = newUndefined(n.block.end + 1, n.block.end + 1);
                            errVar = newUndefined(n.block.end + 1, n.block.end + 1);
                        }
                        var finallySeq = n.finalizer ? c(n.finalizer) : newUndefined(n.end, n.end);
                        return new TryCatchFinally([
                            n.start,
                            n.end
                        ], c(n.block), errVar, catchSeq, finallySeq);
                    },
                    ThrowStatement: function ThrowStatement(n, c) {
                        return new Throw([
                            n.start,
                            n.end
                        ], c(n.argument));
                    },
                    ForStatement: function ForStatement(n, c) {
                        var init = n.init ? c(n.init) : newUndefined(4, 4);
                        var cond = n.test ? c(n.test) : newUndefined(init.pos[1] + 1, init.pos[1] + 1);
                        var upd = n.update ? c(n.update) : newUndefined(cond.pos[1] + 1, cond.pos[1] + 1);
                        return new For([
                            n.start,
                            n.end
                        ], init, cond, c(n.body), upd);
                    },
                    ForInStatement: function ForInStatement(n, c) {
                        var left = n.left.type == 'VariableDeclaration' ? c(n.left.declarations[0]) : c(n.left);
                        return new ForIn([
                            n.start,
                            n.end
                        ], left, c(n.right), c(n.body));
                    },
                    WhileStatement: function WhileStatement(n, c) {
                        return new While([
                            n.start,
                            n.end
                        ], c(n.test), c(n.body));
                    },
                    DoWhileStatement: function DoWhileStatement(n, c) {
                        return new DoWhile([
                            n.start,
                            n.end
                        ], c(n.body), c(n.test));
                    },
                    WithStatement: function WithStatement(n, c) {
                        return new With([
                            n.start,
                            n.end
                        ], c(n.object), c(n.body));
                    },
                    UnaryExpression: function UnaryExpression(n, c) {
                        return new UnaryOp([
                            n.start,
                            n.end
                        ], n.operator, c(n.argument));
                    },
                    BinaryExpression: function BinaryExpression(n, c) {
                        return new BinaryOp([
                            n.start,
                            n.end
                        ], n.operator, c(n.left), c(n.right));
                    },
                    AssignmentExpression: function AssignmentExpression(n, c) {
                        if (n.operator == '=') {
                            return new Set([
                                n.start,
                                n.end
                            ], c(n.left), c(n.right));
                        } else {
                            return new ModifyingSet([
                                n.start,
                                n.end
                            ], c(n.left), n.operator.substr(0, n.operator.length - 1), c(n.right));
                        }
                    },
                    UpdateExpression: function UpdateExpression(n, c) {
                        if (n.prefix) {
                            return new PreOp([
                                n.start,
                                n.end
                            ], n.operator, c(n.argument));
                        } else {
                            return new PostOp([
                                n.start,
                                n.end
                            ], n.operator, c(n.argument));
                        }
                    },
                    ReturnStatement: function ReturnStatement(n, c) {
                        return new Return([
                            n.start,
                            n.end
                        ], n.argument ? c(n.argument) : newUndefined(n.end, n.end));
                    },
                    Identifier: function Identifier(n, c) {
                        return new Variable([
                            n.start,
                            n.end
                        ], n.name);
                    },
                    Literal: function Literal(n, c) {
                        if (Object.isNumber(n.value)) {
                            return new Number([
                                n.start,
                                n.end
                            ], n.value);
                        } else if (Object.isBoolean(n.value)) {
                            return new Variable([
                                n.start,
                                n.end
                            ], n.value.toString());
                        } else if (typeof n.value === 'string') {
                            return new String([
                                n.start,
                                n.end
                            ], n.value);
                        } else if (Object.isRegExp(n.value)) {
                            var flags = n.raw.substr(n.raw.lastIndexOf('/') + 1);
                            return new Regex([
                                n.start,
                                n.end
                            ], n.value.source, flags);
                        } else if (n.value === null) {
                            return new Variable([
                                n.start,
                                n.end
                            ], 'null');
                        }
                        throw new Error('Case of Literal not handled!');
                    },
                    ObjectExpression: function ObjectExpression(n, c) {
                        var props = n.properties.map(function (prop) {
                            var propName = prop.key.type == 'Identifier' ? prop.key.name : prop.key.value;
                            if (prop.kind == 'init') {
                                return new ObjProperty([
                                    prop.key.start,
                                    prop.value.end
                                ], propName, c(prop.value));
                            } else if (prop.kind == 'get') {
                                return new ObjPropertyGet([
                                    prop.key.start,
                                    prop.value.end
                                ], propName, c(prop.value.body));
                            } else if (prop.kind == 'set') {
                                return new ObjPropertySet([
                                    prop.key.start,
                                    prop.value.end
                                ], propName, c(prop.value.body), c(prop.value.params[0]));
                            } else {
                                throw new Error('Case of ObjectExpression not handled!');
                            }
                        });
                        return new ObjectLiteral([
                            n.start,
                            n.end
                        ], props);
                    },
                    ArrayExpression: function ArrayExpression(n, c) {
                        return new ArrayLiteral([
                            n.start,
                            n.end
                        ], n.elements.map(c));
                    },
                    SequenceExpression: function SequenceExpression(n, c) {
                        return new Sequence([
                            n.start,
                            n.end
                        ], n.expressions.map(c));
                    },
                    EmptyStatement: function EmptyStatement(n, c) {
                        return newUndefined(n.start, n.end);
                    },
                    ThisExpression: function ThisExpression(n, c) {
                        return new This([
                            n.start,
                            n.end
                        ]);
                    },
                    DebuggerStatement: function DebuggerStatement(n, c) {
                        return new Debugger([
                            n.start,
                            n.end
                        ]);
                    },
                    LabeledStatement: function LabeledStatement(n, c) {
                        return new LabelDeclaration([
                            n.start,
                            n.end
                        ], n.label.name, c(n.body));
                    }
                };
                visitors.LogicalExpression = visitors.BinaryExpression;
                function c(node) {
                    return visitors[node.type](node, c);
                }
                return c(parsed);
            };
            walk.copy = function (ast, override) {
                var visitors = obj.extend({
                    Program: function Program(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'Program',
                            body: n.body.map(c),
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    FunctionDeclaration: function FunctionDeclaration(n, c) {
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
                    BlockStatement: function BlockStatement(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'BlockStatement',
                            body: n.body.map(c),
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    ExpressionStatement: function ExpressionStatement(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'ExpressionStatement',
                            expression: c(n.expression),
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    CallExpression: function CallExpression(n, c) {
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
                    MemberExpression: function MemberExpression(n, c) {
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
                    NewExpression: function NewExpression(n, c) {
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
                    VariableDeclaration: function VariableDeclaration(n, c) {
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
                    VariableDeclarator: function VariableDeclarator(n, c) {
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
                    FunctionExpression: function FunctionExpression(n, c) {
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
                    IfStatement: function IfStatement(n, c) {
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
                    ConditionalExpression: function ConditionalExpression(n, c) {
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
                    SwitchStatement: function SwitchStatement(n, c) {
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
                    SwitchCase: function SwitchCase(n, c) {
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
                    BreakStatement: function BreakStatement(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'BreakStatement',
                            label: n.label,
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    ContinueStatement: function ContinueStatement(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'ContinueStatement',
                            label: n.label,
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    TryStatement: function TryStatement(n, c) {
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
                    CatchClause: function CatchClause(n, c) {
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
                    ThrowStatement: function ThrowStatement(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'ThrowStatement',
                            argument: c(n.argument),
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    ForStatement: function ForStatement(n, c) {
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
                    ForInStatement: function ForInStatement(n, c) {
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
                    WhileStatement: function WhileStatement(n, c) {
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
                    DoWhileStatement: function DoWhileStatement(n, c) {
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
                    WithStatement: function WithStatement(n, c) {
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
                    UnaryExpression: function UnaryExpression(n, c) {
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
                    BinaryExpression: function BinaryExpression(n, c) {
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
                    LogicalExpression: function LogicalExpression(n, c) {
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
                    AssignmentExpression: function AssignmentExpression(n, c) {
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
                    UpdateExpression: function UpdateExpression(n, c) {
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
                    ReturnStatement: function ReturnStatement(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'ReturnStatement',
                            argument: c(n.argument),
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    Identifier: function Identifier(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'Identifier',
                            name: n.name,
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    Literal: function Literal(n, c) {
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
                    ObjectExpression: function ObjectExpression(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'ObjectExpression',
                            properties: n.properties.map(function (prop) {
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
                    ArrayExpression: function ArrayExpression(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'ArrayExpression',
                            elements: n.elements.map(c),
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    SequenceExpression: function SequenceExpression(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'SequenceExpression',
                            expressions: n.expressions.map(c),
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    EmptyStatement: function EmptyStatement(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'EmptyStatement',
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    ThisExpression: function ThisExpression(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'ThisExpression',
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    DebuggerStatement: function DebuggerStatement(n, c) {
                        return {
                            start: n.start,
                            end: n.end,
                            type: 'DebuggerStatement',
                            source: n.source,
                            astIndex: n.astIndex
                        };
                    },
                    LabeledStatement: function LabeledStatement(n, c) {
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
            walk.findSiblings = function (parsed, node, beforeOrAfter) {
                if (!node)
                    return [];
                var nodes = walk.findNodesIncluding(parsed, node.start), idx = nodes.indexOf(node), parents = nodes.slice(0, idx), parentWithBody = arr.detect(parents.reverse(), function (p) {
                        return Array.isArray(p.body);
                    }), siblingsWithNode = parentWithBody.body;
                if (!beforeOrAfter)
                    return arr.without(siblingsWithNode, node);
                var nodeIdxInSiblings = siblingsWithNode.indexOf(node);
                return beforeOrAfter === 'before' ? siblingsWithNode.slice(0, nodeIdxInSiblings) : siblingsWithNode.slice(nodeIdxInSiblings + 1);
            };
            walk.visitors = {
                stopAtFunctions: walk.make({
                    'Function': function Function() {
                    }
                }, walk.base),
                withMemberExpression: walk.make({
                    MemberExpression: function MemberExpression(node, st, c) {
                        c(node.object, st, 'Expression');
                        c(node.property, st, 'Expression');
                    }
                }, walk.base)
            };
            (function extendAcornWalk2() {
                walk.findNodeByAstIndex = function (parsed, astIndexToFind, addIndex) {
                    addIndex = addIndex == null ? true : !!addIndex;
                    if (!parsed.astIndex && addIndex)
                        walk.addAstIndex(parsed);
                    var found = null;
                    withMozillaAstDo(parsed, null, function (next, node, state) {
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
                walk.findStatementOfNode = function (options, parsed, target) {
                    if (!target) {
                        target = parsed;
                        parsed = options;
                        options = null;
                    }
                    if (!options)
                        options = {};
                    if (!parsed.astIndex)
                        walk.addAstIndex(parsed);
                    var found, targetReached = false;
                    var statements = [
                        'EmptyStatement',
                        'BlockStatement',
                        'ExpressionStatement',
                        'IfStatement',
                        'LabeledStatement',
                        'BreakStatement',
                        'ContinueStatement',
                        'WithStatement',
                        'SwitchStatement',
                        'ReturnStatement',
                        'ThrowStatement',
                        'TryStatement',
                        'WhileStatement',
                        'DoWhileStatement',
                        'ForStatement',
                        'ForInStatement',
                        'DebuggerStatement',
                        'FunctionDeclaration',
                        'VariableDeclaration',
                        'ClassDeclaration'
                    ];
                    withMozillaAstDo(parsed, {}, function (next, node, depth, state, path) {
                        if (targetReached || node.astIndex < target.astIndex)
                            return;
                        if (node === target || node.astIndex === target.astIndex) {
                            targetReached = true;
                            if (options.asPath)
                                found = path;
                            else {
                                var p = Path(path);
                                do {
                                    found = p.get(parsed);
                                    p = p.slice(0, p.size() - 1);
                                } while (statements.indexOf(found.type) == -1 && p.size() > 0);
                            }
                        }
                        !targetReached && next();
                    });
                    return found;
                };
                walk.addAstIndex = function (parsed) {
                    withMozillaAstDo(parsed, { index: 0 }, function (next, node, state) {
                        next();
                        node.astIndex = state.index++;
                    });
                    return parsed;
                };
            }());
        }
    };
})
System.register('lively.ast/lib/stringify.js', [
    'escodegen',
    '../generated/estree-visitor',
    'lively.lang'
], function (_export) {
    'use strict';
    var escodegen, Visitor, obj, es, FixParamsForEscodegenVisitor;
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
    var _get = function get(_x, _x2, _x3) {
        var _again = true;
        _function:
            while (_again) {
                var object = _x, property = _x2, receiver = _x3;
                _again = false;
                if (object === null)
                    object = Function.prototype;
                var desc = Object.getOwnPropertyDescriptor(object, property);
                if (desc === undefined) {
                    var parent = Object.getPrototypeOf(object);
                    if (parent === null) {
                        return undefined;
                    } else {
                        _x = parent;
                        _x2 = property;
                        _x3 = receiver;
                        _again = true;
                        desc = parent = undefined;
                        continue _function;
                    }
                } else if ('value' in desc) {
                    return desc.value;
                } else {
                    var getter = desc.get;
                    if (getter === undefined) {
                        return undefined;
                    }
                    return getter.call(receiver);
                }
            }
    };
    _export('default', stringify);
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    }
    function _inherits(subClass, superClass) {
        if (typeof superClass !== 'function' && superClass !== null) {
            throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass);
        }
        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass)
            Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }
    function stringify(node, opts) {
        return es.generate(fixParamDefaults(node), opts);
    }
    function fixParamDefaults(parsed) {
        parsed = obj.deepCopy(parsed);
        new FixParamsForEscodegenVisitor().accept(parsed, null, []);
        return parsed;
    }
    return {
        setters: [
            function (_escodegen) {
                escodegen = _escodegen;
            },
            function (_generatedEstreeVisitor) {
                Visitor = _generatedEstreeVisitor['default'];
            },
            function (_livelyLang) {
                obj = _livelyLang.obj;
            }
        ],
        execute: function () {
            es = escodegen.escodegen || escodegen;
            _export('escodegen', es);
            FixParamsForEscodegenVisitor = function (_Visitor) {
                _inherits(FixParamsForEscodegenVisitor, _Visitor);
                function FixParamsForEscodegenVisitor() {
                    _classCallCheck(this, FixParamsForEscodegenVisitor);
                    _get(Object.getPrototypeOf(FixParamsForEscodegenVisitor.prototype), 'constructor', this).apply(this, arguments);
                }
                _createClass(FixParamsForEscodegenVisitor, [
                    {
                        key: 'fixFunctionNode',
                        value: function fixFunctionNode(node) {
                            node.defaults = node.params.map(function (p, i) {
                                if (p.type === 'AssignmentPattern') {
                                    node.params[i] = p.left;
                                    return p.right;
                                }
                                return undefined;
                            });
                        }
                    },
                    {
                        key: 'visitFunction',
                        value: function visitFunction(node, state, path) {
                            this.fixFunctionNode(node);
                            return _get(Object.getPrototypeOf(FixParamsForEscodegenVisitor.prototype), 'visitFunction', this).call(this, node, state, path);
                        }
                    },
                    {
                        key: 'visitArrowFunctionExpression',
                        value: function visitArrowFunctionExpression(node, state, path) {
                            this.fixFunctionNode(node);
                            return _get(Object.getPrototypeOf(FixParamsForEscodegenVisitor.prototype), 'visitArrowFunctionExpression', this).call(this, node, state, path);
                        }
                    },
                    {
                        key: 'visitFunctionExpression',
                        value: function visitFunctionExpression(node, state, path) {
                            this.fixFunctionNode(node);
                            return _get(Object.getPrototypeOf(FixParamsForEscodegenVisitor.prototype), 'visitFunctionExpression', this).call(this, node, state, path);
                        }
                    },
                    {
                        key: 'visitFunctionDeclaration',
                        value: function visitFunctionDeclaration(node, state, path) {
                            this.fixFunctionNode(node);
                            return _get(Object.getPrototypeOf(FixParamsForEscodegenVisitor.prototype), 'visitFunctionDeclaration', this).call(this, node, state, path);
                        }
                    }
                ]);
                return FixParamsForEscodegenVisitor;
            }(Visitor);
        }
    };
})
System.register('lively.ast/lib/query.js', [
    'lively.lang',
    './mozilla-ast-visitors.js',
    './mozilla-ast-visitor-interface.js',
    './parser.js',
    './acorn-extension.js',
    './stringify.js'
], function (_export) {
    'use strict';
    var arr, chain, num, tree, ScopeVisitor, withMozillaAstDo, parse, acorn, stringify, helpers, knownGlobals;
    function scopes(parsed) {
        var vis = new ScopeVisitor(), scope = vis.newScope(parsed, null);
        vis.accept(parsed, 0, scope, []);
        return scope;
    }
    function nodesAtIndex(parsed, index) {
        return withMozillaAstDo(parsed, [], function (next, node, found) {
            if (node.start <= index && index <= node.end) {
                found.push(node);
                next();
            }
            return found;
        });
    }
    function scopesAtIndex(parsed, index) {
        return tree.filter(scopes(parsed), function (scope) {
            var n = scope.node;
            var start = n.start, end = n.end;
            if (n.type === 'FunctionDeclaration') {
                start = n.params.length ? n.params[0].start : n.body.start;
                end = n.body.end;
            }
            return start <= index && index <= end;
        }, function (s) {
            return s.subScopes;
        });
    }
    function scopeAtIndex(parsed, index) {
        return arr.last(scopesAtIndex(parsed, index));
    }
    function scopesAtPos(pos, parsed) {
        return nodesAt(pos, parsed).filter(function (node) {
            return node.type === 'Program' || node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression';
        });
    }
    function nodesInScopeOf(node) {
        return withMozillaAstDo(node, {
            root: node,
            result: []
        }, function (next, node, state) {
            state.result.push(node);
            if (node !== state.root && (node.type === 'Program' || node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'))
                return state;
            next();
            return state;
        }).result;
    }
    function _declaredVarNames(scope, useComments) {
        return (scope.node.id && scope.node.id.name ? [scope.node.id && scope.node.id.name] : []).concat(chain(scope.funcDecls).pluck('id').pluck('name').compact().value()).concat(arr.pluck(helpers.declIds(scope.params), 'name')).concat(arr.pluck(scope.catches, 'name')).concat(arr.pluck(helpers.varDeclIds(scope), 'name')).concat(chain(scope.classDecls).pluck('id').pluck('name').value()).concat(arr.pluck(scope.importDecls, 'name')).concat(!useComments ? [] : _findJsLintGlobalDeclarations(scope.node.type === 'Program' ? scope.node : scope.node.body));
    }
    function _findJsLintGlobalDeclarations(node) {
        if (!node || !node.comments)
            return [];
        return arr.flatten(node.comments.filter(function (ea) {
            return ea.text.trim().match(/^global/);
        }).map(function (ea) {
            return arr.invoke(ea.text.replace(/^\s*global\s*/, '').split(','), 'trim');
        }));
    }
    function topLevelDeclsAndRefs(parsed, options) {
        options = options || {};
        options.withComments = true;
        if (typeof parsed === 'string')
            parsed = parse(parsed, options);
        var scope = scopes(parsed), useComments = !!options.jslintGlobalComment, declared = _declaredVarNames(scope, useComments), refs = scope.refs.concat(arr.flatten(scope.subScopes.map(findUndeclaredReferences))), undeclared = chain(refs).pluck('name').withoutAll(declared).value();
        return {
            scope: scope,
            varDecls: scope.varDecls,
            funcDecls: scope.funcDecls,
            classDecls: scope.classDecls,
            declaredNames: declared,
            undeclaredNames: undeclared,
            refs: refs
        };
        function findUndeclaredReferences(scope) {
            var names = _declaredVarNames(scope, useComments);
            return scope.subScopes.map(findUndeclaredReferences).reduce(function (refs, ea) {
                return refs.concat(ea);
            }, scope.refs).filter(function (ref) {
                return names.indexOf(ref.name) === -1;
            });
        }
    }
    function findGlobalVarRefs(parsed, options) {
        var topLevel = topLevelDeclsAndRefs(parsed, options), noGlobals = topLevel.declaredNames.concat(knownGlobals);
        return topLevel.refs.filter(function (ea) {
            return noGlobals.indexOf(ea.name) === -1;
        });
    }
    function findNodesIncludingLines(parsed, code, lines, options) {
        if (!code && !parsed)
            throw new Error('Need at least ast or code');
        code = code ? code : stringify(parsed);
        parsed = parsed && parsed.loc ? parsed : parse(code, { locations: true });
        return withMozillaAstDo(parsed, [], function (next, node, found) {
            if (lines.every(function (line) {
                    return num.between(line, node.loc.start.line, node.loc.end.line);
                })) {
                arr.pushIfNotIncluded(found, node);
                next();
            }
            return found;
        });
    }
    function findReferencesAndDeclsInScope(scope, name) {
        return arr.flatten(tree.map(scope, function (scope) {
            return scope.refs.concat(varDeclIdsOf(scope)).filter(function (ref) {
                return ref.name === name;
            });
        }, function (s) {
            return s.subScopes.filter(function (subScope) {
                return varDeclIdsOf(subScope).every(function (id) {
                    return id.name !== name;
                });
            });
        }));
        function varDeclIdsOf(scope) {
            return scope.params.concat(arr.pluck(scope.funcDecls, 'id')).concat(helpers.varDeclIds(scope));
        }
    }
    function findDeclarationClosestToIndex(parsed, name, index) {
        function varDeclIdsOf(scope) {
            return scope.params.concat(arr.pluck(scope.funcDecls, 'id')).concat(helpers.varDeclIds(scope));
        }
        var found = null;
        arr.detect(scopesAtIndex(parsed, index).reverse(), function (scope) {
            var decls = varDeclIdsOf(scope), idx = arr.pluck(decls, 'name').indexOf(name);
            if (idx === -1)
                return false;
            found = decls[idx];
            return true;
        });
        return found;
    }
    function nodesAt(pos, ast) {
        ast = typeof ast === 'string' ? parse(ast) : ast;
        return acorn.walk.findNodesIncluding(ast, pos);
    }
    return {
        setters: [
            function (_livelyLang) {
                arr = _livelyLang.arr;
                chain = _livelyLang.chain;
                num = _livelyLang.num;
                tree = _livelyLang.tree;
            },
            function (_mozillaAstVisitorsJs) {
                ScopeVisitor = _mozillaAstVisitorsJs.ScopeVisitor;
            },
            function (_mozillaAstVisitorInterfaceJs) {
                withMozillaAstDo = _mozillaAstVisitorInterfaceJs.withMozillaAstDo;
            },
            function (_parserJs) {
                parse = _parserJs.parse;
            },
            function (_acornExtensionJs) {
                acorn = _acornExtensionJs.acorn;
            },
            function (_stringifyJs) {
                stringify = _stringifyJs['default'];
            }
        ],
        execute: function () {
            helpers = {
                declIds: function declIds(nodes) {
                    return arr.flatmap(nodes, function (ea) {
                        if (!ea)
                            return [];
                        if (ea.type === 'Identifier')
                            return [ea];
                        if (ea.type === 'RestElement')
                            return [ea.argument];
                        if (ea.type === 'AssignmentPattern')
                            return [ea.left];
                        if (ea.type === 'ObjectPattern')
                            return helpers.declIds(arr.pluck(ea.properties, 'value'));
                        if (ea.type === 'ArrayPattern')
                            return helpers.declIds(ea.elements);
                        return [];
                    });
                },
                varDeclIds: function varDeclIds(scope) {
                    return helpers.declIds(chain(scope.varDecls).pluck('declarations').flatten().pluck('id').value());
                },
                objPropertiesAsList: function objPropertiesAsList(objExpr, path, onlyLeafs) {
                    return arr.flatmap(objExpr.properties, function (prop) {
                        var key = prop.key.name;
                        var result = [];
                        var thisNode = {
                            key: path.concat([key]),
                            value: prop.value
                        };
                        switch (prop.value.type) {
                        case 'ArrayExpression':
                        case 'ArrayPattern':
                            if (!onlyLeafs)
                                result.push(thisNode);
                            result = result.concat(arr.flatmap(prop.value.elements, function (el, i) {
                                return objPropertiesAsList(el, path.concat([
                                    key,
                                    i
                                ]), onlyLeafs);
                            }));
                            break;
                        case 'ObjectExpression':
                        case 'ObjectPattern':
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
            knownGlobals = [
                'true',
                'false',
                'null',
                'undefined',
                'arguments',
                'Object',
                'Function',
                'String',
                'Array',
                'Date',
                'Boolean',
                'Number',
                'RegExp',
                'Error',
                'EvalError',
                'RangeError',
                'ReferenceError',
                'SyntaxError',
                'TypeError',
                'URIError',
                'Math',
                'NaN',
                'Infinity',
                'Intl',
                'JSON',
                'Promise',
                'parseFloat',
                'parseInt',
                'isNaN',
                'isFinite',
                'eval',
                'alert',
                'decodeURI',
                'decodeURIComponent',
                'encodeURI',
                'encodeURIComponent',
                'navigator',
                'window',
                'document',
                'console',
                'setTimeout',
                'clearTimeout',
                'setInterval',
                'clearInterval',
                'requestAnimationFrame',
                'cancelAnimationFrame',
                'Node',
                'HTMLCanvasElement',
                'Image',
                'Class',
                'Global',
                'Functions',
                'Objects',
                'Strings',
                'module',
                'lively',
                'pt',
                'rect',
                'rgb',
                '$super',
                '$morph',
                '$world',
                'show'
            ];
            _export('helpers', helpers);
            _export('knownGlobals', knownGlobals);
            _export('scopes', scopes);
            _export('nodesAtIndex', nodesAtIndex);
            _export('scopesAtIndex', scopesAtIndex);
            _export('scopeAtIndex', scopeAtIndex);
            _export('scopesAtPos', scopesAtPos);
            _export('nodesInScopeOf', nodesInScopeOf);
            _export('_declaredVarNames', _declaredVarNames);
            _export('_findJsLintGlobalDeclarations', _findJsLintGlobalDeclarations);
            _export('topLevelDeclsAndRefs', topLevelDeclsAndRefs);
            _export('findGlobalVarRefs', findGlobalVarRefs);
            _export('findNodesIncludingLines', findNodesIncludingLines);
            _export('findReferencesAndDeclsInScope', findReferencesAndDeclsInScope);
            _export('findDeclarationClosestToIndex', findDeclarationClosestToIndex);
            _export('nodesAt', nodesAt);
        }
    };
})
System.register('lively.ast/lib/transform.js', [
    'lively.lang',
    './query.js',
    './parser.js',
    './stringify.js'
], function (_export) {
    'use strict';
    var arr, string, chain, Path, query, parse, stringify, helper;
    function replace(astOrSource, targetNode, replacementFunc, options) {
        var parsed = typeof astOrSource === 'object' ? astOrSource : null, source = typeof astOrSource === 'string' ? astOrSource : parsed.source || helper._node2string(parsed), result = helper.replaceNode(targetNode, replacementFunc, source);
        return result;
    }
    function replaceTopLevelVarDeclAndUsageForCapturing(astOrSource, assignToObj, options) {
        var ignoreUndeclaredExcept = options && options.ignoreUndeclaredExcept || null;
        var whitelist = options && options.include || null;
        var blacklist = options && options.exclude || [];
        var recordDefRanges = options && options.recordDefRanges;
        var parsed = typeof astOrSource === 'object' ? astOrSource : parse(astOrSource), source = typeof astOrSource === 'string' ? astOrSource : parsed.source || helper._node2string(parsed), topLevel = query.topLevelDeclsAndRefs(parsed);
        if (ignoreUndeclaredExcept) {
            blacklist = arr.withoutAll(topLevel.undeclaredNames, ignoreUndeclaredExcept).concat(blacklist);
        }
        var scope = topLevel.scope;
        arr.pushAll(blacklist, arr.pluck(scope.catches, 'name'));
        var forLoopDecls = scope.varDecls.filter(function (decl, i) {
            var path = Path(scope.varDeclPaths[i]), parent = path.slice(0, -1).get(parsed);
            return parent.type === 'ForStatement' || parent.type === 'ForInStatement';
        });
        arr.pushAll(blacklist, chain(forLoopDecls).pluck('declarations').flatten().pluck('id').pluck('name').value());
        var result = helper.replaceNodes(topLevel.refs.filter(shouldRefBeCaptured).map(function (ref) {
            return {
                target: ref,
                replacementFunc: function replacementFunc(ref) {
                    return member(ref, assignToObj);
                }
            };
        }), source);
        result = helper.replaceNodes(arr.withoutAll(topLevel.varDecls, forLoopDecls).map(function (decl) {
            return {
                target: decl,
                replacementFunc: function replacementFunc(declNode, s, wasChanged) {
                    if (wasChanged) {
                        var scopes = query.scopes(parse(s, { addSource: true }));
                        declNode = scopes.varDecls[0];
                    }
                    return declNode.declarations.map(function (ea) {
                        var init = {
                            operator: '||',
                            type: 'LogicalExpression',
                            left: {
                                computed: true,
                                object: assignToObj,
                                property: {
                                    type: 'Literal',
                                    value: ea.id.name
                                },
                                type: 'MemberExpression'
                            },
                            right: {
                                name: 'undefined',
                                type: 'Identifier'
                            }
                        };
                        return shouldDeclBeCaptured(ea) ? assign(ea.id, ea.init || init) : varDecl(ea);
                    });
                }
            };
        }), result);
        if (topLevel.funcDecls.length) {
            var globalFuncs = topLevel.funcDecls.filter(shouldDeclBeCaptured).map(function (decl) {
                var funcId = {
                    type: 'Identifier',
                    name: decl.id.name
                };
                return helper._node2string(assign(funcId, funcId));
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
            result.defRanges = chain(scope.varDecls).pluck('declarations').flatten().value().concat(scope.funcDecls).reduce(function (defs, decl) {
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
                type: 'ExpressionStatement',
                expression: {
                    type: 'AssignmentExpression',
                    operator: '=',
                    right: value || {
                        type: 'Identifier',
                        name: 'undefined'
                    },
                    left: {
                        type: 'MemberExpression',
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
                kind: 'var',
                type: 'VariableDeclaration'
            };
        }
        function member(prop, obj) {
            return {
                type: 'MemberExpression',
                computed: false,
                object: obj,
                property: prop
            };
        }
    }
    function oneDeclaratorPerVarDecl(astOrSource) {
        var parsed = typeof astOrSource === 'object' ? astOrSource : parse(astOrSource), source = typeof astOrSource === 'string' ? astOrSource : parsed.source || helper._node2string(parsed), scope = query.scopes(parsed), varDecls = function findVarDecls(scope) {
                return arr.flatten(scope.varDecls.concat(scope.subScopes.map(findVarDecls)));
            }(scope);
        var targetsAndReplacements = varDecls.map(function (decl) {
            return {
                target: decl,
                replacementFunc: function replacementFunc(declNode, s, wasChanged) {
                    if (wasChanged) {
                        declNode = parse(s).body[0];
                    }
                    return declNode.declarations.map(function (ea) {
                        return {
                            type: 'VariableDeclaration',
                            kind: 'var',
                            declarations: [ea]
                        };
                    });
                }
            };
        });
        return helper.replaceNodes(targetsAndReplacements, source);
    }
    function oneDeclaratorForVarsInDestructoring(astOrSource) {
        var parsed = typeof astOrSource === 'object' ? astOrSource : parse(astOrSource), source = typeof astOrSource === 'string' ? astOrSource : parsed.source || helper._node2string(parsed), scope = query.scopes(parsed), varDecls = function findVarDecls(scope) {
                return arr.flatten(scope.varDecls.concat(scope.subScopes.map(findVarDecls)));
            }(scope);
        var targetsAndReplacements = varDecls.map(function (decl) {
            return {
                target: decl,
                replacementFunc: function replacementFunc(declNode, s, wasChanged) {
                    if (wasChanged) {
                        declNode = parse(s).body[0];
                    }
                    return arr.flatmap(declNode.declarations, function (declNode) {
                        var extractedId = {
                                type: 'Identifier',
                                name: '__temp'
                            }, extractedInit = {
                                type: 'VariableDeclaration',
                                kind: 'var',
                                declarations: [{
                                        type: 'VariableDeclarator',
                                        id: extractedId,
                                        init: declNode.init
                                    }]
                            };
                        var propDecls = arr.pluck(query.helpers.objPropertiesAsList(declNode.id, [], false), 'key').map(function (keyPath) {
                            return {
                                type: 'VariableDeclaration',
                                kind: 'var',
                                declarations: [{
                                        type: 'VariableDeclarator',
                                        kind: 'var',
                                        id: {
                                            type: 'Identifier',
                                            name: arr.last(keyPath)
                                        },
                                        init: helper.memberExpression([extractedId.name].concat(keyPath))
                                    }]
                            };
                        });
                        return [extractedInit].concat(propDecls);
                    });
                }
            };
        });
        return helper.replaceNodes(targetsAndReplacements, source);
    }
    function returnLastStatement(source, opts) {
        opts = opts || {};
        var parsed = parse(source, { ecmaVersion: 6 }), last = parsed.body.pop(), newLastsource = 'return ' + source.slice(last.start, last.end);
        if (!opts.asAST)
            return source.slice(0, last.start) + newLastsource;
        var newLast = parse(newLastsource, {
            allowReturnOutsideFunction: true,
            ecmaVersion: 6
        }).body.slice(-1)[0];
        parsed.body.push(newLast);
        parsed.end += 'return '.length;
        return parsed;
    }
    function wrapInFunction(code, opts) {
        opts = opts || {};
        var transformed = returnLastStatement(code, opts);
        return opts.asAST ? {
            type: 'Program',
            body: [{
                    type: 'ExpressionStatement',
                    expression: {
                        body: {
                            body: transformed.body,
                            type: 'BlockStatement'
                        },
                        params: [],
                        type: 'FunctionExpression'
                    }
                }]
        } : 'function() {\n' + transformed + '\n}';
    }
    return {
        setters: [
            function (_livelyLang) {
                arr = _livelyLang.arr;
                string = _livelyLang.string;
                chain = _livelyLang.chain;
                Path = _livelyLang.Path;
            },
            function (_queryJs) {
                query = _queryJs;
            },
            function (_parserJs) {
                parse = _parserJs.parse;
            },
            function (_stringifyJs) {
                stringify = _stringifyJs['default'];
            }
        ],
        execute: function () {
            helper = {
                _node2string: function _node2string(node) {
                    return node.source || stringify(node);
                },
                _findIndentAt: function _findIndentAt(s, pos) {
                    var bol = string.peekLeft(s, pos, /\s+$/), indent = typeof bol === 'number' ? s.slice(bol, pos) : '';
                    if (indent[0] === '\n')
                        indent = indent.slice(1);
                    return indent;
                },
                _applyChanges: function _applyChanges(changes, source) {
                    return changes.reduce(function (source, change) {
                        if (change.type === 'del') {
                            return source.slice(0, change.pos) + source.slice(change.pos + change.length);
                        } else if (change.type === 'add') {
                            return source.slice(0, change.pos) + change.string + source.slice(change.pos);
                        }
                        throw new Error('Uexpected change ' + Objects.inspect(change));
                    }, source);
                },
                _compareNodesForReplacement: function _compareNodesForReplacement(nodeA, nodeB) {
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
                memberExpression: function memberExpression(keys) {
                    var memberExpression = keys.slice(1).reduce(function (memberExpr, key) {
                        return {
                            computed: typeof key !== 'string',
                            object: memberExpr,
                            property: nodeForKey(key),
                            type: 'MemberExpression'
                        };
                    }, nodeForKey(keys[0]));
                    return memberExpression;
                    return {
                        type: 'ExpressionStatement',
                        expression: memberExpression
                    };
                    function nodeForKey(key) {
                        return typeof key === 'string' ? {
                            name: key,
                            type: 'Identifier'
                        } : {
                            raw: String(key),
                            type: 'Literal',
                            value: key
                        };
                    }
                },
                replaceNode: function replaceNode(target, replacementFunc, sourceOrChanges) {
                    var sourceChanges = typeof sourceOrChanges === 'object' ? sourceOrChanges : {
                            changes: [],
                            source: sourceOrChanges
                        }, insideChangedBefore = false, pos = sourceChanges.changes.reduce(function (pos, change) {
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
                    var source = sourceChanges.source, replacement = replacementFunc(target, source.slice(pos.start, pos.end), insideChangedBefore), replacementSource = Array.isArray(replacement) ? replacement.map(helper._node2string).join('\n' + helper._findIndentAt(source, pos.start)) : replacementSource = helper._node2string(replacement);
                    var changes = [
                        {
                            type: 'del',
                            pos: pos.start,
                            length: pos.end - pos.start
                        },
                        {
                            type: 'add',
                            pos: pos.start,
                            string: replacementSource
                        }
                    ];
                    return {
                        changes: sourceChanges.changes.concat(changes),
                        source: this._applyChanges(changes, source)
                    };
                },
                replaceNodes: function replaceNodes(targetAndReplacementFuncs, sourceOrChanges) {
                    return targetAndReplacementFuncs.sort(function (a, b) {
                        return helper._compareNodesForReplacement(a.target, b.target);
                    }).reduce(function (sourceChanges, ea) {
                        return helper.replaceNode(ea.target, ea.replacementFunc, sourceChanges);
                    }, typeof sourceOrChanges === 'object' ? sourceOrChanges : {
                        changes: [],
                        source: sourceOrChanges
                    });
                }
            };
            _export('helper', helper);
            _export('replace', replace);
            _export('replaceTopLevelVarDeclAndUsageForCapturing', replaceTopLevelVarDeclAndUsageForCapturing);
            _export('oneDeclaratorPerVarDecl', oneDeclaratorPerVarDecl);
            _export('oneDeclaratorForVarsInDestructoring', oneDeclaratorForVarsInDestructoring);
            _export('returnLastStatement', returnLastStatement);
            _export('wrapInFunction', wrapInFunction);
        }
    };
})
System.register('lively.ast/lib/capturing.js', [
    'lively.lang',
    './parser.js',
    './query.js',
    '../generated/estree-visitor',
    './stringify.js'
], function (_export) {
    'use strict';
    var obj, chain, arr, fun, Path, parse, query, Visitor, stringify;
    function rewriteToCaptureTopLevelVariables(astOrSource, assignToObj, options) {
        options = obj.merge({
            ignoreUndeclaredExcept: null,
            includeRefs: null,
            excludeRefs: options && options.exclude || [],
            includeDecls: null,
            excludeDecls: options && options.exclude || [],
            recordDefRanges: false,
            es6ExportFuncId: null,
            es6ImportFuncId: null,
            captureObj: assignToObj || {
                type: 'Identifier',
                name: '__rec'
            },
            moduleExportFunc: {
                name: options && options.es6ExportFuncId || '_moduleExport',
                type: 'Identifier'
            },
            moduleImportFunc: {
                name: options && options.es6ImportFuncId || '_moduleImport',
                type: 'Identifier'
            }
        }, options);
        var parsed = typeof astOrSource === 'object' ? astOrSource : parse(astOrSource), source = typeof astOrSource === 'string' ? astOrSource : parsed.source || stringify(parsed), rewritten = parsed;
        if (options.ignoreUndeclaredExcept) {
            var topLevel = query.topLevelDeclsAndRefs(parsed);
            options.excludeRefs = arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeRefs);
            options.excludeDecls = arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeDecls);
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
        rewritten = replaceClassDecls(rewritten, options);
        rewritten = insertCapturesForExportDeclarations(rewritten, options);
        rewritten = insertCapturesForImportDeclarations(rewritten, options);
        rewritten = insertDeclarationsForExports(rewritten, options);
        rewritten = putFunctionDeclsInFront(rewritten, options);
        return {
            ast: rewritten,
            source: stringify(rewritten),
            defRanges: defRanges
        };
    }
    function replace(parsed, replacer) {
        var v = new Visitor();
        v.accept = fun.wrap(v.accept, function (proceed, node, state, path) {
            return replacer(proceed(node, state, path), path);
        });
        return v.accept(parsed, null, []);
    }
    function replaceRefs(parsed, options) {
        var topLevel = query.topLevelDeclsAndRefs(parsed), refsToReplace = topLevel.refs.filter(function (ref) {
                return shouldRefBeCaptured(ref, options);
            });
        return replace(parsed, function (node, path) {
            return refsToReplace.indexOf(node) > -1 ? member(node, options.captureObj) : node;
        });
    }
    function replaceVarDecls(parsed, options) {
        var topLevel = query.topLevelDeclsAndRefs(parsed);
        return replace(parsed, function (node) {
            if (topLevel.varDecls.indexOf(node) === -1)
                return node;
            var decls = node.declarations.filter(function (decl) {
                return shouldDeclBeCaptured(decl, options);
            });
            if (!decls.length)
                return node;
            return node.declarations.map(function (ea) {
                var init = ea.init || {
                    operator: '||',
                    type: 'LogicalExpression',
                    left: {
                        computed: true,
                        object: options.captureObj,
                        property: {
                            type: 'Literal',
                            value: ea.id.name
                        },
                        type: 'MemberExpression'
                    },
                    right: {
                        name: 'undefined',
                        type: 'Identifier'
                    }
                };
                return shouldDeclBeCaptured(ea, options) ? assignExpr(options.captureObj, ea.id, init, false) : ea;
            });
        });
    }
    function replaceClassDecls(parsed, options) {
        var topLevel = query.topLevelDeclsAndRefs(parsed);
        if (!topLevel.classDecls.length)
            return parsed;
        parsed.body = parsed.body.reduce(function (stmts, stmt) {
            return stmts.concat(topLevel.classDecls.indexOf(stmt) === -1 ? [stmt] : [
                stmt,
                assignExpr(options.captureObj, stmt.id, stmt.id, false)
            ]);
        }, []);
        return parsed;
    }
    function additionalIgnoredDecls(parsed, options) {
        var topLevel = query.topLevelDeclsAndRefs(parsed), ignoreDecls = topLevel.scope.varDecls.reduce(function (result, decl, i) {
                var path = Path(topLevel.scope.varDeclPaths[i]), parent = path.slice(0, -1).get(parsed);
                if (parent.type === 'ForStatement' || parent.type === 'ForInStatement' || parent.type === 'ExportNamedDeclaration') {
                    result.push(decl);
                }
                return result;
            }, []);
        return [].concat(arr.pluck(topLevel.scope.catches, 'name')).concat(chain(ignoreDecls).pluck('declarations').flatten().pluck('id').pluck('name').value());
    }
    function additionalIgnoredRefs(parsed, options) {
        var topLevel = query.topLevelDeclsAndRefs(parsed), ignoreDecls = topLevel.scope.varDecls.reduce(function (result, decl, i) {
                var path = Path(topLevel.scope.varDeclPaths[i]), parent = path.slice(0, -1).get(parsed);
                if (parent.type === 'ForStatement' || parent.type === 'ForInStatement' || parent.type === 'ExportNamedDeclaration') {
                    result.push(decl);
                }
                return result;
            }, []), ignoredImportAndExportNames = parsed.body.reduce(function (ignored, stmt) {
                if (!options.es6ImportFuncId && stmt.type === 'ImportDeclaration')
                    return stmt.specifiers.reduce(function (ignored, specifier) {
                        return specifier.type === 'ImportSpecifier' ? ignored.concat([specifier.imported.name]) : ignored;
                    }, ignored);
                if (!options.es6ExportFuncId && (stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration') && stmt.specifiers)
                    return ignored.concat(stmt.specifiers.map(function (specifier) {
                        return specifier.local.name;
                    }));
                return ignored;
            }, []);
        return [].concat(arr.pluck(topLevel.scope.catches, 'name')).concat(ignoredImportAndExportNames).concat(chain(ignoreDecls).pluck('declarations').flatten().pluck('id').pluck('name').value());
    }
    function insertCapturesForExportDeclarations(parsed, options) {
        parsed.body = parsed.body.reduce(function (stmts, stmt) {
            if (stmt.type !== 'ExportNamedDeclaration' || !stmt.declaration)
                return stmts.concat([stmt]);
            var decls = stmt.declaration.declarations || [stmt.declaration];
            return stmts.concat([stmt]).concat(decls.map(function (decl) {
                return assignExpr(options.captureObj, decl.id, decl.id, false);
            }));
        }, []);
        return parsed;
    }
    function insertCapturesForImportDeclarations(parsed, options) {
        parsed.body = parsed.body.reduce(function (stmts, stmt) {
            return stmts.concat(stmt.type !== 'ImportDeclaration' || !stmt.specifiers.length ? [stmt] : [stmt].concat(stmt.specifiers.map(function (specifier) {
                return assignExpr(options.captureObj, specifier.local, specifier.local, false);
            })));
        }, []);
        return parsed;
    }
    function insertDeclarationsForExports(parsed, options) {
        var topLevel = query.topLevelDeclsAndRefs(parsed);
        parsed.body = parsed.body.reduce(function (stmts, stmt) {
            return stmts.concat(stmt.type !== 'ExportNamedDeclaration' || !stmt.specifiers.length ? [stmt] : stmt.specifiers.map(function (specifier) {
                return topLevel.declaredNames.indexOf(specifier.local.name) > -1 ? null : varDecl(parsed, {
                    type: 'VariableDeclarator',
                    id: specifier.local,
                    init: member(specifier.local, options.captureObj)
                });
            }).filter(Boolean).concat(stmt));
        }, []);
        return parsed;
    }
    function es6ModuleTransforms(parsed, options) {
        parsed.body = parsed.body.reduce(function (stmts, stmt) {
            var nodes;
            if (stmt.type === 'ExportNamedDeclaration') {
                if (stmt.source) {
                    var key = moduleId = stmt.source;
                    nodes = stmt.specifiers.map(function (specifier) {
                        return {
                            type: 'ExpressionStatement',
                            expression: exportFromImport({
                                type: 'Literal',
                                value: specifier.exported.name
                            }, {
                                type: 'Literal',
                                value: specifier.local.name
                            }, moduleId, options.moduleExportFunc, options.moduleImportFunc)
                        };
                    });
                } else if (stmt.declaration) {
                    var decls = stmt.declaration.declarations || [stmt.declaration];
                    nodes = [stmt.declaration].concat(decls.map(function (decl) {
                        return exportCallStmt(options.moduleExportFunc, decl.id.name, decl.id);
                    }));
                } else {
                    nodes = stmt.specifiers.map(function (specifier) {
                        return exportCallStmt(options.moduleExportFunc, specifier.exported.name, shouldDeclBeCaptured({ id: specifier.local }, options) ? member(specifier.local, options.captureObj) : specifier.local);
                    });
                }
            } else if (stmt.type === 'ExportDefaultDeclaration') {
                nodes = [exportCallStmt(options.moduleExportFunc, 'default', stmt.declaration)];
            } else if (stmt.type === 'ExportAllDeclaration') {
                var key = {
                        name: options.es6ExportFuncId + '__iterator__',
                        type: 'Identifier'
                    }, moduleId = stmt.source;
                nodes = [{
                        type: 'ForInStatement',
                        body: {
                            type: 'ExpressionStatement',
                            expression: exportFromImport(key, key, moduleId, options.moduleExportFunc, options.moduleImportFunc)
                        },
                        left: {
                            type: 'VariableDeclaration',
                            kind: 'var',
                            declarations: [{
                                    type: 'VariableDeclarator',
                                    id: key,
                                    init: null
                                }]
                        },
                        right: importCall(null, moduleId, options.moduleImportFunc)
                    }];
                options.excludeRefs.push(key.name);
                options.excludeDecls.push(key.name);
            } else if (stmt.type === 'ImportDeclaration') {
                nodes = stmt.specifiers.length ? stmt.specifiers.map(function (specifier) {
                    var local = specifier.local, imported = specifier.type === 'ImportSpecifier' && specifier.imported.name || specifier.type === 'ImportDefaultSpecifier' && 'default' || null;
                    return varDeclAndImportCall(parsed, local, imported || null, stmt.source, options.moduleImportFunc);
                }) : importCallStmt(null, stmt.source, options.moduleImportFunc);
            } else
                nodes = [stmt];
            return stmts.concat(nodes);
        }, []);
        return parsed;
    }
    function putFunctionDeclsInFront(parsed, options) {
        var topLevel = query.topLevelDeclsAndRefs(parsed);
        if (!topLevel.funcDecls.length)
            return parsed;
        var globalFuncs = topLevel.funcDecls.filter(function (ea) {
            return shouldDeclBeCaptured(ea, options);
        }).map(function (decl) {
            var funcId = {
                type: 'Identifier',
                name: decl.id.name
            };
            return assignExpr(options.captureObj, funcId, funcId, false);
        });
        parsed.body = globalFuncs.concat(parsed.body);
        return parsed;
    }
    function computeDefRanges(parsed, options) {
        var topLevel = query.topLevelDeclsAndRefs(parsed);
        return chain(topLevel.scope.varDecls).pluck('declarations').flatten().value().concat(topLevel.scope.funcDecls).reduce(function (defs, decl) {
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
            type: 'MemberExpression',
            computed: computed || false,
            object: obj,
            property: prop
        };
    }
    function varDecl(parsed, declarator) {
        var topLevel = query.topLevelDeclsAndRefs(parsed), name = declarator.id.name;
        return topLevel.declaredNames.indexOf(name) > -1 ? {
            type: 'ExpressionStatement',
            expression: {
                type: 'AssignmentExpression',
                operator: '=',
                right: declarator.init,
                left: declarator.id
            }
        } : {
            declarations: [declarator],
            kind: 'var',
            type: 'VariableDeclaration'
        };
    }
    function assignExpr(assignee, propId, value, computed) {
        return {
            type: 'ExpressionStatement',
            expression: {
                type: 'AssignmentExpression',
                operator: '=',
                right: value || {
                    type: 'Identifier',
                    name: 'undefined'
                },
                left: {
                    type: 'MemberExpression',
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
    function varDeclAndImportCall(parsed, localId, imported, moduleSource, moduleImportFunc) {
        return varDecl(parsed, {
            type: 'VariableDeclarator',
            id: localId,
            init: importCall(imported, moduleSource, moduleImportFunc)
        });
    }
    function importCall(imported, moduleSource, moduleImportFunc) {
        if (typeof imported === 'string')
            imported = {
                type: 'Literal',
                value: imported
            };
        return {
            arguments: [moduleSource].concat(imported || []),
            callee: moduleImportFunc,
            type: 'CallExpression'
        };
    }
    function importCallStmt(imported, moduleSource, moduleImportFunc) {
        return {
            type: 'ExpressionStatement',
            expression: importCall(imported, moduleSource, moduleImportFunc)
        };
    }
    function exportCall(exportFunc, local, exportedObj) {
        if (typeof local === 'string')
            local = {
                type: 'Literal',
                value: local
            };
        exportedObj = obj.deepCopy(exportedObj);
        return {
            arguments: [
                local,
                exportedObj
            ],
            callee: exportFunc,
            type: 'CallExpression'
        };
    }
    function exportCallStmt(exportFunc, local, exportedObj) {
        return {
            type: 'ExpressionStatement',
            expression: exportCall(exportFunc, local, exportedObj)
        };
    }
    return {
        setters: [
            function (_livelyLang) {
                obj = _livelyLang.obj;
                chain = _livelyLang.chain;
                arr = _livelyLang.arr;
                fun = _livelyLang.fun;
                Path = _livelyLang.Path;
            },
            function (_parserJs) {
                parse = _parserJs.parse;
            },
            function (_queryJs) {
                query = _queryJs;
            },
            function (_generatedEstreeVisitor) {
                Visitor = _generatedEstreeVisitor['default'];
            },
            function (_stringifyJs) {
                stringify = _stringifyJs['default'];
            }
        ],
        execute: function () {
            _export('rewriteToCaptureTopLevelVariables', rewriteToCaptureTopLevelVariables);
        }
    };
})
System.register('lively.ast/lib/comments.js', [
    'lively.lang',
    './mozilla-ast-visitor-interface.js',
    './parser.js',
    './acorn-extension.js',
    './stringify.js'
], function (_export) {
    'use strict';
    var obj, string, Path, chain, arr, withMozillaAstDo, parse, walk, stringify;
    function getCommentPrecedingNode(parsed, node) {
        var statementPath = walk.findStatementOfNode({ asPath: true }, parsed, node), blockPath = statementPath.slice(0, -2), block = Path(blockPath).get(parsed);
        return !block.comments || !block.comments.length ? null : chain(extractComments(parsed)).reversed().detect(function (ea) {
            return ea.followingNode === node;
        }).value();
    }
    function extractComments(astOrCode, optCode) {
        var parsed = typeof astOrCode === 'string' ? parse(astOrCode, { withComments: true }) : astOrCode, code = optCode ? optCode : typeof astOrCode === 'string' ? astOrCode : stringify(astOrCode), parsedComments = arr.sortBy(commentsWithPathsAndNodes(parsed), function (c) {
                return c.comment.start;
            });
        return parsedComments.map(function (c, i) {
            if (isInObjectMethod(c)) {
                return obj.merge([
                    c,
                    c.comment,
                    {
                        type: 'method',
                        comment: c.comment.text
                    },
                    methodAttributesOf(c)
                ]);
            }
            if (isInComputedMethod(c)) {
                return obj.merge([
                    c,
                    c.comment,
                    {
                        type: 'method',
                        comment: c.comment.text
                    },
                    computedMethodAttributesOf(c)
                ]);
            }
            if (isInFunctionStatement(c)) {
                return obj.merge([
                    c,
                    c.comment,
                    {
                        type: 'function',
                        comment: c.comment.text
                    },
                    functionAttributesOf(c)
                ]);
            }
            if (isInAssignedMethod(c)) {
                return obj.merge([
                    c,
                    c.comment,
                    {
                        type: 'method',
                        comment: c.comment.text
                    },
                    methodAttributesOfAssignment(c)
                ]);
            }
            var followingNode = followingNodeOf(c);
            if (!followingNode)
                return obj.merge([
                    c,
                    c.comment,
                    { followingNode: followingNode },
                    unknownComment(c)
                ]);
            var followingComment = parsedComments[i + 1];
            if (followingComment && followingComment.comment.start <= followingNode.start)
                return obj.merge([
                    c,
                    c.comment,
                    { followingNode: followingNode },
                    unknownComment(c)
                ]);
            if (isSingleObjVarDeclaration(followingNode)) {
                return obj.merge([
                    c,
                    c.comment,
                    { followingNode: followingNode },
                    {
                        type: 'object',
                        comment: c.comment.text
                    },
                    objAttributesOf(followingNode)
                ]);
            }
            if (isSingleVarDeclaration(followingNode)) {
                return obj.merge([
                    c,
                    c.comment,
                    { followingNode: followingNode },
                    {
                        type: 'var',
                        comment: c.comment.text
                    },
                    objAttributesOf(followingNode)
                ]);
            }
            return obj.merge([
                c,
                c.comment,
                { followingNode: followingNode },
                unknownComment(c)
            ]);
        });
        function commentsWithPathsAndNodes(parsed) {
            var comments = [];
            withMozillaAstDo(parsed, comments, function (next, node, comments, depth, path) {
                if (node.comments) {
                    arr.pushAll(comments, node.comments.map(function (comment) {
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
            return arr.detect(comment.node.body, function (node) {
                return node.start > comment.comment.end;
            });
        }
        function unknownComment(comment) {
            return {
                type: 'unknown',
                comment: comment.comment.text
            };
        }
        function isInFunctionStatement(comment) {
            var node = Path(comment.path.slice(0, -1)).get(parsed);
            return node && node.type === 'FunctionDeclaration';
        }
        function functionAttributesOf(comment) {
            var funcNode = Path(comment.path.slice(0, -1)).get(parsed), name = funcNode.id ? funcNode.id.name : '<error: no name for function>';
            return {
                name: name,
                args: arr.pluck(funcNode.params, 'name')
            };
        }
        function isInObjectMethod(comment) {
            return arr.equals(comment.path.slice(-2), [
                'value',
                'body'
            ]);
        }
        function isInAssignedMethod(comment) {
            return arr.equals(comment.path.slice(-2), [
                'right',
                'body'
            ]);
        }
        function methodAttributesOf(comment) {
            var methodNode = Path(comment.path.slice(0, -2)).get(parsed), name = methodNode.key ? methodNode.key.name : '<error: no name for method>';
            var p = comment.path.slice();
            var objectName = '<error: no object found for method>';
            while (p.length && arr.last(p) !== 'init')
                p.pop();
            if (p.length) {
                objectName = Path(p.slice(0, -1).concat([
                    'id',
                    'name'
                ])).get(parsed);
            }
            if (string.startsWith(objectName, '<error')) {
                p = comment.path.slice();
                while (p.length && arr.last(p) !== 'right')
                    p.pop();
                if (p.length) {
                    var assignNode = Path(p.slice(0, -1).concat(['left'])).get(parsed);
                    objectName = code.slice(assignNode.start, assignNode.end);
                }
            }
            if (string.startsWith(objectName, '<error')) {
                p = comment.path.slice();
                var callExpr = Path(p.slice(0, -6)).get(parsed), isCall = callExpr && callExpr.type === 'CallExpression', firstArg = isCall && callExpr.arguments[0];
                if (firstArg)
                    objectName = code.slice(firstArg.start, firstArg.end);
            }
            return {
                name: name,
                args: arr.pluck(methodNode.value.params, 'name'),
                objectName: objectName
            };
        }
        function methodAttributesOfAssignment(comment) {
            var node = Path(comment.path.slice(0, -1)).get(parsed);
            if (node.type !== 'FunctionExpression' && node.type !== 'FunctionDeclaration')
                return {};
            var statement = walk.findStatementOfNode(parsed, node);
            if (statement.type !== 'ExpressionStatement' || statement.expression.type !== 'AssignmentExpression')
                return {};
            var objName = code.slice(statement.expression.left.object.start, statement.expression.left.object.end);
            var methodName = code.slice(statement.expression.left.property.start, statement.expression.left.property.end);
            return {
                name: methodName,
                objectName: objName,
                args: arr.pluck(node.params, 'name')
            };
        }
        function isInComputedMethod(comment) {
            var path = comment.path.slice(-5);
            arr.removeAt(path, 1);
            return arr.equals(path, [
                'properties',
                'value',
                'callee',
                'body'
            ]);
        }
        function computedMethodAttributesOf(comment) {
            var name, args, pathToProp;
            pathToProp = comment.path.slice(0, -3);
            var propertyNode = Path(pathToProp).get(parsed);
            if (propertyNode && propertyNode.type === 'Property') {
                args = arr.pluck(propertyNode.value.callee.params, 'name');
                name = propertyNode.key ? propertyNode.key.name : '<error: no name for method>';
            }
            if (!name) {
                pathToProp = comment.path.slice(0, -2);
                propertyNode = Path(pathToProp).get(parsed);
                if (propertyNode && propertyNode.type === 'Property') {
                    args = arr.pluck(propertyNode.value.params, 'name');
                    name = propertyNode.key ? propertyNode.key.name : '<error: no name for method>';
                }
            }
            if (!name) {
                name = '<error: no name for method>';
                args = [];
                pathToProp = comment.path;
            }
            var p = arr.clone(pathToProp);
            var objectName = '<error: no object found for method>';
            while (p.length && arr.last(p) !== 'init')
                p.pop();
            if (p.length) {
                objectName = Path(p.slice(0, -1).concat([
                    'id',
                    'name'
                ])).get(parsed);
            }
            if (string.startsWith(objectName, '<error')) {
                var p = arr.clone(pathToProp);
                while (p.length && arr.last(p) !== 'right')
                    p.pop();
                if (p.length) {
                    var assignNode = Path(p.slice(0, -1).concat(['left'])).get(parsed);
                    objectName = code.slice(assignNode.start, assignNode.end);
                }
            }
            if (string.startsWith(objectName, '<error')) {
                var p = arr.clone(pathToProp);
                var callExpr = Path(p.slice(0, -4)).get(parsed), isCall = callExpr && callExpr.type === 'CallExpression', firstArg = isCall && callExpr.arguments[0];
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
            return isSingleVarDeclaration(node) && (node.declarations[0].init.type === 'ObjectExpression' || isObjectAssignment(node.declarations[0].init));
        }
        function isSingleVarDeclaration(node) {
            return node && node.type === 'VariableDeclaration' && node.declarations.length === 1;
        }
        function objAttributesOf(node) {
            return { name: node.declarations[0].id.name };
        }
        ;
        function isObjectAssignment(_x) {
            var _again = true;
            _function:
                while (_again) {
                    var node = _x;
                    _again = false;
                    if (node.type !== 'AssignmentExpression')
                        return false;
                    if (node.right.type === 'ObjectExpression')
                        return true;
                    if (node.right.type === 'AssignmentExpression') {
                        _x = node.right;
                        _again = true;
                        continue _function;
                    }
                    ;
                    return false;
                }
        }
    }
    return {
        setters: [
            function (_livelyLang) {
                obj = _livelyLang.obj;
                string = _livelyLang.string;
                Path = _livelyLang.Path;
                chain = _livelyLang.chain;
                arr = _livelyLang.arr;
            },
            function (_mozillaAstVisitorInterfaceJs) {
                withMozillaAstDo = _mozillaAstVisitorInterfaceJs.withMozillaAstDo;
            },
            function (_parserJs) {
                parse = _parserJs.parse;
            },
            function (_acornExtensionJs) {
                walk = _acornExtensionJs.walk;
            },
            function (_stringifyJs) {
                stringify = _stringifyJs['default'];
            }
        ],
        execute: function () {
            _export('getCommentPrecedingNode', getCommentPrecedingNode);
            _export('extractComments', extractComments);
        }
    };
})
System.register('lively.ast/lib/code-categorizer.js', [
    '../lib/parser.js',
    'lively.lang'
], function (_export) {
    'use strict';
    var parse, arr, Path, string, obj;
    function findDecls(parsed, options) {
        options = options || obj.merge({ hideOneLiners: false }, options);
        if (typeof parsed === 'string')
            parsed = parse(parsed, { addSource: true });
        var topLevelNodes = parsed.type === 'Program' ? parsed.body : parsed.body.body, defs = arr.flatmap(topLevelNodes, function (n) {
                return moduleDef(n, options) || functionWrapper(n, options) || varDefs(n) || funcDef(n) || classDef(n) || extendDef(n) || someObjectExpressionCall(n);
            });
        if (options.hideOneLiners && parsed.source) {
            defs = defs.reduce(function (defs, def) {
                if (def.parent && defs.indexOf(def.parent) > -1)
                    defs.push(def);
                else if ((def.node.source || '').indexOf('\n') > -1)
                    defs.push(def);
                return defs;
            }, []);
        }
        if (options.hideOneLiners && parsed.loc)
            defs = defs.filter(function (def) {
                return !def.node.loc || def.node.loc.start.line !== def.node.loc.end.line;
                parsed;
            });
        return defs;
    }
    function objectKeyValsAsDefs(objectExpression) {
        return objectExpression.properties.map(function (prop) {
            return {
                name: prop.key.name || prop.key.value,
                type: prop.value.type === 'FunctionExpression' ? 'method' : 'property',
                node: prop
            };
        });
    }
    function classDef(node) {
        if (Path('expression.callee.property.name').get(node) !== 'subclass')
            return null;
        var def = {
            type: 'lively-class-definition',
            name: Path('expression.arguments.0.value').get(node),
            node: node
        };
        var props = arr.flatmap(node.expression.arguments, function (argNode) {
            if (argNode.type !== 'ObjectExpression')
                return [];
            return objectKeyValsAsDefs(argNode).map(function (ea) {
                ea.type = 'lively-class-instance-' + ea.type;
                ea.parent = def;
                return ea;
            });
        });
        return [def].concat(props);
    }
    function extendDef(node) {
        if (Path('expression.callee.property.name').get(node) !== 'extend' || Path('expression.arguments.0.type').get(node) !== 'ObjectExpression')
            return null;
        var name = Path('expression.arguments.0.name').get(node);
        if (!name)
            return null;
        var def = {
            name: name,
            node: node,
            type: 'lively-extend-definition'
        };
        var props = (objectKeyValsAsDefs(Path('expression.arguments.1').get(node)) || []).map(function (d) {
            d.parent = def;
            return d;
        });
        return [def].concat(props);
    }
    function varDefs(node) {
        if (node.type !== 'VariableDeclaration')
            return null;
        return arr.flatmap(withVarDeclIds(node), function (ea) {
            return arr.flatmap(ea.ids, function (id) {
                var def = {
                    name: id.name,
                    node: ea.node,
                    type: 'var-decl'
                };
                if (!def.node.init)
                    return [def];
                var node = def.node.init;
                while (node.type === 'AssignmentExpression')
                    node = node.right;
                if (node.type === 'ObjectExpression') {
                    return [def].concat(objectKeyValsAsDefs(node).map(function (ea) {
                        ea.type = 'object-' + ea.type;
                        ea.parent = def;
                        return ea;
                    }));
                }
                var objDefs = someObjectExpressionCall(node);
                if (objDefs)
                    return [def].concat(objDefs.map(function (d) {
                        d.parent = def;
                        return d;
                    }));
                return [def];
            });
        });
    }
    function funcDef(node) {
        if (node.type !== 'FunctionStatement' && node.type !== 'FunctionDeclaration')
            return null;
        return [{
                name: node.id.name,
                node: node,
                type: 'function-decl'
            }];
    }
    function someObjectExpressionCall(node) {
        if (node.type === 'ExpressionStatement')
            node = node.expression;
        if (node.type !== 'CallExpression')
            return null;
        var objArg = node.arguments.detect(function (a) {
            return a.type === 'ObjectExpression';
        });
        if (!objArg)
            return null;
        return objectKeyValsAsDefs(objArg);
    }
    function moduleDef(node, options) {
        if (!isModuleDeclaration(node))
            return null;
        var decls = findDecls(Path('expression.arguments.0').get(node), options), parent = {
                node: node,
                name: Path('expression.callee.object.callee.object.arguments.0.value').get(node)
            };
        decls.forEach(function (decl) {
            return decl.parent = parent;
        });
        return decls;
    }
    function functionWrapper(node, options) {
        if (!isFunctionWrapper(node))
            return null;
        var decls;
        var argFunc = Path('expression.arguments.0').get(node);
        if (argFunc && argFunc.type === 'FunctionExpression' && string.lines(argFunc.source || '').length > 5) {
            decls = findDecls(argFunc, options);
        } else {
            decls = findDecls(Path('expression.callee').get(node), options);
        }
        var parent = {
            node: node,
            name: Path('expression.callee.id.name').get(node)
        };
        decls.forEach(function (decl) {
            return decl.parent || (decl.parent = parent);
        });
        return decls;
    }
    function isModuleDeclaration(node) {
        return Path('expression.callee.object.callee.object.callee.name').get(node) === 'module' && Path('expression.callee.property.name').get(node) === 'toRun';
    }
    function isFunctionWrapper(node) {
        return Path('expression.type').get(node) === 'CallExpression' && Path('expression.callee.type').get(node) === 'FunctionExpression';
    }
    function declIds(idNodes) {
        return arr.flatmap(idNodes, function (ea) {
            if (!ea)
                return [];
            if (ea.type === 'Identifier')
                return [ea];
            if (ea.type === 'RestElement')
                return [ea.argument];
            if (ea.type === 'ObjectPattern')
                return declIds(arr.pluck(ea.properties, 'value'));
            if (ea.type === 'ArrayPattern')
                return declIds(ea.elements);
            return [];
        });
    }
    function withVarDeclIds(varNode) {
        return varNode.declarations.map(function (declNode) {
            if (!declNode.source && declNode.init)
                declNode.source = declNode.id.name + ' = ' + declNode.init.source;
            return {
                node: declNode,
                ids: declIds([declNode.id])
            };
        });
    }
    return {
        setters: [
            function (_libParserJs) {
                parse = _libParserJs.parse;
            },
            function (_livelyLang) {
                arr = _livelyLang.arr;
                Path = _livelyLang.Path;
                string = _livelyLang.string;
                obj = _livelyLang.obj;
            }
        ],
        execute: function () {
            _export('findDecls', findDecls);
        }
    };
})
System.register('lively.ast/lib/mozilla-ast-visitors.js', ['lively.lang'], function (_export) {
    'use strict';
    var obj;
    function BaseVisitor() {
    }
    function PrinterVisitor() {
    }
    function ComparisonVisitor() {
    }
    function ScopeVisitor() {
    }
    return {
        setters: [function (_livelyLang) {
                obj = _livelyLang.obj;
            }],
        execute: function () {
            obj.extend(BaseVisitor.prototype, 'visiting', {
                accept: function accept(node, depth, state, path) {
                    path = path || [];
                    return this['visit' + node.type](node, depth, state, path);
                },
                visitProgram: function visitProgram(node, depth, state, path) {
                    var retVal;
                    node.body.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'body',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitFunction: function visitFunction(node, depth, state, path) {
                    var retVal;
                    if (node.id) {
                        retVal = this.accept(node.id, depth, state, path.concat(['id']));
                    }
                    node.params.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'params',
                            i
                        ]));
                    }, this);
                    if (node.defaults) {
                        node.defaults.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'defaults',
                                i
                            ]));
                        }, this);
                    }
                    if (node.rest) {
                        retVal = this.accept(node.rest, depth, state, path.concat(['rest']));
                    }
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    if (node.generator) {
                    }
                    if (node.expression) {
                    }
                    return retVal;
                },
                visitStatement: function visitStatement(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitEmptyStatement: function visitEmptyStatement(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitBlockStatement: function visitBlockStatement(node, depth, state, path) {
                    var retVal;
                    node.body.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'body',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitExpressionStatement: function visitExpressionStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.expression, depth, state, path.concat(['expression']));
                    return retVal;
                },
                visitIfStatement: function visitIfStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.test, depth, state, path.concat(['test']));
                    retVal = this.accept(node.consequent, depth, state, path.concat(['consequent']));
                    if (node.alternate) {
                        retVal = this.accept(node.alternate, depth, state, path.concat(['alternate']));
                    }
                    return retVal;
                },
                visitLabeledStatement: function visitLabeledStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.label, depth, state, path.concat(['label']));
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitBreakStatement: function visitBreakStatement(node, depth, state, path) {
                    var retVal;
                    if (node.label) {
                        retVal = this.accept(node.label, depth, state, path.concat(['label']));
                    }
                    return retVal;
                },
                visitContinueStatement: function visitContinueStatement(node, depth, state, path) {
                    var retVal;
                    if (node.label) {
                        retVal = this.accept(node.label, depth, state, path.concat(['label']));
                    }
                    return retVal;
                },
                visitWithStatement: function visitWithStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.object, depth, state, path.concat(['object']));
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitSwitchStatement: function visitSwitchStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.discriminant, depth, state, path.concat(['discriminant']));
                    node.cases.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'cases',
                            i
                        ]));
                    }, this);
                    if (node.lexical) {
                    }
                    return retVal;
                },
                visitReturnStatement: function visitReturnStatement(node, depth, state, path) {
                    var retVal;
                    if (node.argument) {
                        retVal = this.accept(node.argument, depth, state, path.concat(['argument']));
                    }
                    return retVal;
                },
                visitThrowStatement: function visitThrowStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.argument, depth, state, path.concat(['argument']));
                    return retVal;
                },
                visitTryStatement: function visitTryStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.block, depth, state, path.concat(['block']));
                    if (node.handler) {
                        retVal = this.accept(node.handler, depth, state, path.concat(['handler']));
                    }
                    if (node.guardedHandlers) {
                        node.guardedHandlers.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'guardedHandlers',
                                i
                            ]));
                        }, this);
                    }
                    if (node.finalizer) {
                        retVal = this.accept(node.finalizer, depth, state, path.concat(['finalizer']));
                    }
                    return retVal;
                },
                visitWhileStatement: function visitWhileStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.test, depth, state, path.concat(['test']));
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitDoWhileStatement: function visitDoWhileStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    retVal = this.accept(node.test, depth, state, path.concat(['test']));
                    return retVal;
                },
                visitForStatement: function visitForStatement(node, depth, state, path) {
                    var retVal;
                    if (node.init) {
                        retVal = this.accept(node.init, depth, state, path.concat(['init']));
                    }
                    if (node.test) {
                        retVal = this.accept(node.test, depth, state, path.concat(['test']));
                    }
                    if (node.update) {
                        retVal = this.accept(node.update, depth, state, path.concat(['update']));
                    }
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitForInStatement: function visitForInStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.left, depth, state, path.concat(['left']));
                    retVal = this.accept(node.right, depth, state, path.concat(['right']));
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    if (node.each) {
                    }
                    return retVal;
                },
                visitForOfStatement: function visitForOfStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.left, depth, state, path.concat(['left']));
                    retVal = this.accept(node.right, depth, state, path.concat(['right']));
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitLetStatement: function visitLetStatement(node, depth, state, path) {
                    var retVal;
                    node.head.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'head',
                            i
                        ]));
                    }, this);
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitDebuggerStatement: function visitDebuggerStatement(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitDeclaration: function visitDeclaration(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitFunctionDeclaration: function visitFunctionDeclaration(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.id, depth, state, path.concat(['id']));
                    node.params.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'params',
                            i
                        ]));
                    }, this);
                    if (node.defaults) {
                        node.defaults.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'defaults',
                                i
                            ]));
                        }, this);
                    }
                    if (node.rest) {
                        retVal = this.accept(node.rest, depth, state, path.concat(['rest']));
                    }
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    if (node.generator) {
                    }
                    if (node.expression) {
                    }
                    return retVal;
                },
                visitVariableDeclaration: function visitVariableDeclaration(node, depth, state, path) {
                    var retVal;
                    node.declarations.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'declarations',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitVariableDeclarator: function visitVariableDeclarator(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.id, depth, state, path.concat(['id']));
                    if (node.init) {
                        retVal = this.accept(node.init, depth, state, path.concat(['init']));
                    }
                    return retVal;
                },
                visitExpression: function visitExpression(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitThisExpression: function visitThisExpression(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitArrayExpression: function visitArrayExpression(node, depth, state, path) {
                    var retVal;
                    node.elements.forEach(function (ea, i) {
                        if (ea) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'elements',
                                i
                            ]));
                        }
                    }, this);
                    return retVal;
                },
                visitObjectExpression: function visitObjectExpression(node, depth, state, path) {
                    var retVal;
                    node.properties.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'properties',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitProperty: function visitProperty(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.key, depth, state, path.concat(['key']));
                    retVal = this.accept(node.value, depth, state, path.concat(['value']));
                    return retVal;
                },
                visitFunctionExpression: function visitFunctionExpression(node, depth, state, path) {
                    var retVal;
                    if (node.id) {
                        retVal = this.accept(node.id, depth, state, path.concat(['id']));
                    }
                    node.params.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'params',
                            i
                        ]));
                    }, this);
                    if (node.defaults) {
                        node.defaults.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'defaults',
                                i
                            ]));
                        }, this);
                    }
                    if (node.rest) {
                        retVal = this.accept(node.rest, depth, state, path.concat(['rest']));
                    }
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    if (node.generator) {
                    }
                    if (node.expression) {
                    }
                    return retVal;
                },
                visitArrowExpression: function visitArrowExpression(node, depth, state, path) {
                    var retVal;
                    node.params.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'params',
                            i
                        ]));
                    }, this);
                    if (node.defaults) {
                        node.defaults.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'defaults',
                                i
                            ]));
                        }, this);
                    }
                    if (node.rest) {
                        retVal = this.accept(node.rest, depth, state, path.concat(['rest']));
                    }
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    if (node.generator) {
                    }
                    if (node.expression) {
                    }
                    return retVal;
                },
                visitArrowFunctionExpression: function visitArrowFunctionExpression(node, depth, state, path) {
                    var retVal;
                    node.params.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'params',
                            i
                        ]));
                    }, this);
                    if (node.defaults) {
                        node.defaults.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'defaults',
                                i
                            ]));
                        }, this);
                    }
                    if (node.rest) {
                        retVal = this.accept(node.rest, depth, state, path.concat(['rest']));
                    }
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    if (node.generator) {
                    }
                    if (node.expression) {
                    }
                    return retVal;
                },
                visitSequenceExpression: function visitSequenceExpression(node, depth, state, path) {
                    var retVal;
                    node.expressions.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'expressions',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitUnaryExpression: function visitUnaryExpression(node, depth, state, path) {
                    var retVal;
                    if (node.prefix) {
                    }
                    retVal = this.accept(node.argument, depth, state, path.concat(['argument']));
                    return retVal;
                },
                visitBinaryExpression: function visitBinaryExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.left, depth, state, path.concat(['left']));
                    retVal = this.accept(node.right, depth, state, path.concat(['right']));
                    return retVal;
                },
                visitAssignmentExpression: function visitAssignmentExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.left, depth, state, path.concat(['left']));
                    retVal = this.accept(node.right, depth, state, path.concat(['right']));
                    return retVal;
                },
                visitUpdateExpression: function visitUpdateExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.argument, depth, state, path.concat(['argument']));
                    if (node.prefix) {
                    }
                    return retVal;
                },
                visitLogicalExpression: function visitLogicalExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.left, depth, state, path.concat(['left']));
                    retVal = this.accept(node.right, depth, state, path.concat(['right']));
                    return retVal;
                },
                visitConditionalExpression: function visitConditionalExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.test, depth, state, path.concat(['test']));
                    retVal = this.accept(node.alternate, depth, state, path.concat(['alternate']));
                    retVal = this.accept(node.consequent, depth, state, path.concat(['consequent']));
                    return retVal;
                },
                visitNewExpression: function visitNewExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.callee, depth, state, path.concat(['callee']));
                    node.arguments.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'arguments',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitCallExpression: function visitCallExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.callee, depth, state, path.concat(['callee']));
                    node.arguments.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'arguments',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitMemberExpression: function visitMemberExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.object, depth, state, path.concat(['object']));
                    retVal = this.accept(node.property, depth, state, path.concat(['property']));
                    if (node.computed) {
                    }
                    return retVal;
                },
                visitYieldExpression: function visitYieldExpression(node, depth, state, path) {
                    var retVal;
                    if (node.argument) {
                        retVal = this.accept(node.argument, depth, state, path.concat(['argument']));
                    }
                    return retVal;
                },
                visitComprehensionExpression: function visitComprehensionExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    node.blocks.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'blocks',
                            i
                        ]));
                    }, this);
                    if (node.filter) {
                        retVal = this.accept(node.filter, depth, state, path.concat(['filter']));
                    }
                    return retVal;
                },
                visitGeneratorExpression: function visitGeneratorExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    node.blocks.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'blocks',
                            i
                        ]));
                    }, this);
                    if (node.filter) {
                        retVal = this.accept(node.filter, depth, state, path.concat(['filter']));
                    }
                    return retVal;
                },
                visitLetExpression: function visitLetExpression(node, depth, state, path) {
                    var retVal;
                    node.head.forEach(function (ea, i) {
                        if (ea) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'head',
                                i
                            ]));
                        }
                    }, this);
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitPattern: function visitPattern(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitObjectPattern: function visitObjectPattern(node, depth, state, path) {
                    var retVal;
                    node.properties.forEach(function (ea, i) {
                        retVal = this.accept(ea.key, depth, state, path.concat([
                            'properties',
                            i,
                            'key'
                        ]));
                        retVal = this.accept(ea.value, depth, state, path.concat([
                            'properties',
                            i,
                            'value'
                        ]));
                    }, this);
                    return retVal;
                },
                visitArrayPattern: function visitArrayPattern(node, depth, state, path) {
                    var retVal;
                    node.elements.forEach(function (ea, i) {
                        if (ea) {
                            retVal = this.accept(ea, depth, state, path.concat([
                                'elements',
                                i
                            ]));
                        }
                    }, this);
                    return retVal;
                },
                visitRestElement: function visitRestElement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.argument, depth, state, path.concat(['argument']));
                    return retVal;
                },
                visitSwitchCase: function visitSwitchCase(node, depth, state, path) {
                    var retVal;
                    if (node.test) {
                        retVal = this.accept(node.test, depth, state, path.concat(['test']));
                    }
                    node.consequent.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'consequent',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitCatchClause: function visitCatchClause(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.param, depth, state, path.concat(['param']));
                    if (node.guard) {
                        retVal = this.accept(node.guard, depth, state, path.concat(['guard']));
                    }
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitComprehensionBlock: function visitComprehensionBlock(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.left, depth, state, path.concat(['left']));
                    retVal = this.accept(node.right, depth, state, path.concat(['right']));
                    if (node.each) {
                    }
                    return retVal;
                },
                visitComprehensionIf: function visitComprehensionIf(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.test, depth, state, path.concat(['test']));
                    return retVal;
                },
                visitIdentifier: function visitIdentifier(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitLiteral: function visitLiteral(node, depth, state, path) {
                    var retVal;
                    if (node.value) {
                    }
                    return retVal;
                },
                visitClassDeclaration: function visitClassDeclaration(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.id, depth, state, path.concat(['id']));
                    if (node.superClass) {
                        retVal = this.accept(node.superClass, depth, state, path.concat(['superClass']));
                    }
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitClassExpression: function visitClassExpression(node, depth, scope, path) {
                    scope.classDecls.push(node);
                    var retVal;
                    if (node.superClass) {
                        this.accept(node.superClass, depth, scope, path.concat(['superClass']));
                    }
                    retVal = this.accept(node.body, depth, scope, path.concat(['body']));
                    return retVal;
                },
                visitClassBody: function visitClassBody(node, depth, state, path) {
                    var retVal;
                    node.body.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'body',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitSuper: function visitSuper(node, depth, state, path) {
                    var retVal;
                    if (node['loc']) {
                        retVal = this.accept(node['loc'], depth, state, path.concat(['loc']));
                    }
                    return retVal;
                },
                visitMethodDefinition: function visitMethodDefinition(node, depth, state, path) {
                    var retVal;
                    if (node['static']) {
                    }
                    if (node.computed) {
                    }
                    retVal = this.accept(node.key, depth, state, path.concat(['key']));
                    retVal = this.accept(node.value, depth, state, path.concat(['value']));
                    return retVal;
                },
                visitImportDeclaration: function visitImportDeclaration(node, depth, state, path) {
                    var retVal;
                    node.specifiers.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'specifiers',
                            i
                        ]));
                    }, this);
                    if (node.source)
                        retVal = this.accept(node.source, depth, state, path.concat(['source']));
                    return retVal;
                },
                visitImportSpecifier: function visitImportSpecifier(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.local, depth, state, path.concat(['local']));
                    retVal = this.accept(node.imported, depth, state, path.concat(['imported']));
                    var retVal;
                },
                visitImportDefaultSpecifier: function visitImportDefaultSpecifier(node, depth, state, path) {
                    return this.accept(node.local, depth, state, path.concat(['local']));
                },
                visitImportNamespaceSpecifier: function visitImportNamespaceSpecifier(node, depth, state, path) {
                    return this.accept(node.local, depth, state, path.concat(['local']));
                },
                visitExportNamedDeclaration: function visitExportNamedDeclaration(node, depth, state, path) {
                    var retVal;
                    if (node.declaration)
                        retVal = this.accept(node.declaration, depth, state, path.concat(['declaration']));
                    node.specifiers.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'specifiers',
                            i
                        ]));
                    }, this);
                    if (node.source)
                        retVal = this.accept(node.source, depth, state, path.concat(['source']));
                    return retVal;
                },
                visitExportDefaultDeclaration: function visitExportDefaultDeclaration(node, depth, state, path) {
                    return this.accept(node.declaration, depth, state, path.concat(['declaration']));
                },
                visitExportAllDeclaration: function visitExportAllDeclaration(node, depth, state, path) {
                    return this.accept(node.source, depth, state, path.concat(['source']));
                },
                visitExportSpecifier: function visitExportSpecifier(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.local, depth, state, path.concat(['local']));
                    retVal = this.accept(node.exported, depth, state, path.concat(['exported']));
                    var retVal;
                },
                visitJSXIdentifier: function visitJSXIdentifier(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitJSXMemberExpression: function visitJSXMemberExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.object, depth, state, path.concat(['object']));
                    retVal = this.accept(node.property, depth, state, path.concat(['property']));
                    return retVal;
                },
                visitJSXNamespacedName: function visitJSXNamespacedName(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.namespace, depth, state, path.concat(['namespace']));
                    retVal = this.accept(node.name, depth, state, path.concat(['name']));
                    return retVal;
                },
                visitJSXEmptyExpression: function visitJSXEmptyExpression(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitJSXBoundaryElement: function visitJSXBoundaryElement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.name, depth, state, path.concat(['name']));
                    return retVal;
                },
                visitJSXOpeningElement: function visitJSXOpeningElement(node, depth, state, path) {
                    var retVal;
                    node.attributes.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'attributes',
                            i
                        ]));
                    }, this);
                    if (node.selfClosing) {
                    }
                    return retVal;
                },
                visitJSXClosingElement: function visitJSXClosingElement(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitJSXAttribute: function visitJSXAttribute(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.name, depth, state, path.concat(['name']));
                    if (node.value) {
                        retVal = this.accept(node.value, depth, state, path.concat(['value']));
                    }
                    return retVal;
                },
                visitSpreadElement: function visitSpreadElement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.argument, depth, state, path.concat(['argument']));
                    return retVal;
                },
                visitJSXSpreadAttribute: function visitJSXSpreadAttribute(node, depth, state, path) {
                    var retVal;
                    return retVal;
                },
                visitJSXElement: function visitJSXElement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.openingElement, depth, state, path.concat(['openingElement']));
                    node.children.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'children',
                            i
                        ]));
                    }, this);
                    if (node.closingElement) {
                        retVal = this.accept(node.closingElement, depth, state, path.concat(['closingElement']));
                    }
                    return retVal;
                },
                visitTemplateLiteral: function visitTemplateLiteral(node, depth, state, path) {
                    var retVal;
                    node.quasis.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'quasis',
                            i
                        ]));
                    }, this);
                    node.expressions.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, state, path.concat([
                            'expressions',
                            i
                        ]));
                    }, this);
                    return retVal;
                },
                visitTaggedTemplateExpression: function visitTaggedTemplateExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.tag, depth, state, path.concat(['tag']));
                    retVal = this.accept(node.quasi, depth, state, path.concat(['quasi']));
                    return retVal;
                },
                visitTemplateElement: function visitTemplateElement(node, depth, state, path) {
                }
            });
            PrinterVisitor.prototype = Object.create(BaseVisitor.prototype, {
                constructor: {
                    value: PrinterVisitor,
                    enumerable: false,
                    writable: true,
                    configurable: true
                }
            });
            obj.extend(PrinterVisitor.prototype, {
                accept: function accept(node, state, tree, path) {
                    var pathString = path.map(function (ea) {
                        return typeof ea === 'string' ? '.' + ea : '[' + ea + ']';
                    }).join('');
                    var myChildren = [];
                    BaseVisitor.prototype.accept.call(this, node, state, myChildren, path);
                    tree.push({
                        node: node,
                        path: pathString,
                        index: state.index++,
                        children: myChildren
                    });
                }
            });
            ;
            ComparisonVisitor.prototype = Object.create(BaseVisitor.prototype, {
                constructor: {
                    value: ComparisonVisitor,
                    enumerable: false,
                    writable: true,
                    configurable: true
                }
            });
            obj.extend(ComparisonVisitor.prototype, 'comparison', {
                recordNotEqual: function recordNotEqual(node1, node2, state, msg) {
                    state.comparisons.errors.push({
                        node1: node1,
                        node2: node2,
                        path: state.completePath,
                        msg: msg
                    });
                },
                compareType: function compareType(node1, node2, state) {
                    return this.compareField('type', node1, node2, state);
                },
                compareField: function compareField(field, node1, node2, state) {
                    node2 = lively.PropertyPath(state.completePath.join('.')).get(node2);
                    if (node1 && node2 && node1[field] === node2[field])
                        return true;
                    if (node1 && node1[field] === '*' || node2 && node2[field] === '*')
                        return true;
                    var fullPath = state.completePath.join('.') + '.' + field, msg;
                    if (!node1)
                        msg = 'node1 on ' + fullPath + ' not defined';
                    else if (!node2)
                        msg = 'node2 not defined but node1 (' + fullPath + ') is: ' + node1[field];
                    else
                        msg = fullPath + ' is not equal: ' + node1[field] + ' vs. ' + node2[field];
                    this.recordNotEqual(node1, node2, state, msg);
                    return false;
                }
            }, 'visiting', {
                accept: function accept(node1, node2, state, path) {
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
                visitFunction: function visitFunction(node1, node2, state, path) {
                    if (node1.generator) {
                        this.compareField('generator', node1, node2, state);
                    }
                    if (node1.expression) {
                        this.compareField('expression', node1, node2, state);
                    }
                    BaseVisitor.prototype.visitFunction.call(this, node1, node2, state, path);
                },
                visitSwitchStatement: function visitSwitchStatement(node1, node2, state, path) {
                    if (node1.lexical) {
                        this.compareField('lexical', node1, node2, state);
                    }
                    BaseVisitor.prototype.visitSwitchStatement.call(this, node1, node2, state, path);
                },
                visitForInStatement: function visitForInStatement(node1, node2, state, path) {
                    if (node1.each) {
                        this.compareField('each', node1, node2, state);
                    }
                    BaseVisitor.prototype.visitForInStatement.call(this, node1, node2, state, path);
                },
                visitFunctionDeclaration: function visitFunctionDeclaration(node1, node2, state, path) {
                    if (node1.generator) {
                        this.compareField('generator', node1, node2, state);
                    }
                    if (node1.expression) {
                        this.compareField('expression', node1, node2, state);
                    }
                    BaseVisitor.prototype.visitFunctionDeclaration.call(this, node1, node2, state, path);
                },
                visitVariableDeclaration: function visitVariableDeclaration(node1, node2, state, path) {
                    this.compareField('kind', node1, node2, state);
                    BaseVisitor.prototype.visitVariableDeclaration.call(this, node1, node2, state, path);
                },
                visitUnaryExpression: function visitUnaryExpression(node1, node2, state, path) {
                    this.compareField('operator', node1, node2, state);
                    if (node1.prefix) {
                        this.compareField('prefix', node1, node2, state);
                    }
                    BaseVisitor.prototype.visitUnaryExpression.call(this, node1, node2, state, path);
                },
                visitBinaryExpression: function visitBinaryExpression(node1, node2, state, path) {
                    this.compareField('operator', node1, node2, state);
                    BaseVisitor.prototype.visitBinaryExpression.call(this, node1, node2, state, path);
                },
                visitAssignmentExpression: function visitAssignmentExpression(node1, node2, state, path) {
                    this.compareField('operator', node1, node2, state);
                    BaseVisitor.prototype.visitAssignmentExpression.call(this, node1, node2, state, path);
                },
                visitUpdateExpression: function visitUpdateExpression(node1, node2, state, path) {
                    this.compareField('operator', node1, node2, state);
                    if (node1.prefix) {
                        this.compareField('prefix', node1, node2, state);
                    }
                    BaseVisitor.prototype.visitUpdateExpression.call(this, node1, node2, state, path);
                },
                visitLogicalExpression: function visitLogicalExpression(node1, node2, state, path) {
                    this.compareField('operator', node1, node2, state);
                    BaseVisitor.prototype.visitLogicalExpression.call(this, node1, node2, state, path);
                },
                visitMemberExpression: function visitMemberExpression(node1, node2, state, path) {
                    if (node1.computed) {
                        this.compareField('computed', node1, node2, state);
                    }
                    BaseVisitor.prototype.visitMemberExpression.call(this, node1, node2, state, path);
                },
                visitComprehensionBlock: function visitComprehensionBlock(node1, node2, state, path) {
                    if (node1.each) {
                        this.compareField('each', node1, node2, state);
                    }
                    BaseVisitor.prototype.visitComprehensionBlock.call(this, node1, node2, state, path);
                },
                visitIdentifier: function visitIdentifier(node1, node2, state, path) {
                    this.compareField('name', node1, node2, state);
                    BaseVisitor.prototype.visitIdentifier.call(this, node1, node2, state, path);
                },
                visitLiteral: function visitLiteral(node1, node2, state, path) {
                    this.compareField('value', node1, node2, state);
                    BaseVisitor.prototype.visitLiteral.call(this, node1, node2, state, path);
                },
                visitClassDeclaration: function visitClassDeclaration(node1, node2, state, path) {
                    this.compareField('id', node1, node2, state);
                    if (node1.superClass) {
                        this.compareField('superClass', node1, node2, state);
                    }
                    this.compareField('body', node1, node2, state);
                    BaseVisitor.prototype.visitClassDeclaration.call(this, node1, node2, state, path);
                },
                visitClassBody: function visitClassBody(node1, node2, state, path) {
                    this.compareField('body', node1, node2, state);
                    BaseVisitor.prototype.visitClassBody.call(this, node1, node2, state, path);
                },
                visitMethodDefinition: function visitMethodDefinition(node1, node2, state, path) {
                    this.compareField('static', node1, node2, state);
                    this.compareField('computed', node1, node2, state);
                    this.compareField('kind', node1, node2, state);
                    this.compareField('key', node1, node2, state);
                    this.compareField('value', node1, node2, state);
                    BaseVisitor.prototype.visitMethodDefinition.call(this, node1, node2, state, path);
                }
            });
            ;
            ScopeVisitor.prototype = Object.create(BaseVisitor.prototype, {
                constructor: {
                    value: ScopeVisitor,
                    enumerable: false,
                    writable: true,
                    configurable: true
                }
            });
            obj.extend(ScopeVisitor.prototype, 'scope specific', {
                newScope: function newScope(scopeNode, parentScope) {
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
                }
            }, 'visiting', {
                accept: function accept(node, depth, scope, path) {
                    path = path || [];
                    if (!this['visit' + node.type])
                        throw new Error('No AST visit handler for type ' + node.type);
                    return this['visit' + node.type](node, depth, scope, path);
                },
                visitVariableDeclaration: function visitVariableDeclaration(node, depth, scope, path) {
                    scope.varDecls.push(node);
                    scope.varDeclPaths.push(path);
                    return BaseVisitor.prototype.visitVariableDeclaration.call(this, node, depth, scope, path);
                },
                visitVariableDeclarator: function visitVariableDeclarator(node, depth, scope, path) {
                    var retVal;
                    if (node.init) {
                        retVal = this.accept(node.init, depth, scope, path.concat(['init']));
                    }
                    return retVal;
                },
                visitFunction: function visitFunction(node, depth, scope, path) {
                    var newScope = this.newScope(node, scope);
                    newScope.params = Array.prototype.slice.call(node.params);
                    return newScope;
                },
                visitFunctionDeclaration: function visitFunctionDeclaration(node, depth, scope, path) {
                    scope.funcDecls.push(node);
                    var newScope = this.visitFunction(node, depth, scope, path);
                    var retVal;
                    if (node.defaults) {
                        node.defaults.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, newScope, path.concat([
                                'defaults',
                                i
                            ]));
                        }, this);
                    }
                    if (node.rest) {
                        retVal = this.accept(node.rest, depth, newScope, path.concat(['rest']));
                    }
                    retVal = this.accept(node.body, depth, newScope, path.concat(['body']));
                    return retVal;
                },
                visitFunctionExpression: function visitFunctionExpression(node, depth, scope, path) {
                    var newScope = this.visitFunction(node, depth, scope, path);
                    var retVal;
                    if (node.defaults) {
                        node.defaults.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, newScope, path.concat([
                                'defaults',
                                i
                            ]));
                        }, this);
                    }
                    if (node.rest) {
                        retVal = this.accept(node.rest, depth, newScope, path.concat(['rest']));
                    }
                    retVal = this.accept(node.body, depth, newScope, path.concat(['body']));
                    return retVal;
                },
                visitArrowFunctionExpression: function visitArrowFunctionExpression(node, depth, scope, path) {
                    var newScope = this.visitFunction(node, depth, scope, path);
                    var retVal;
                    if (node.defaults) {
                        node.defaults.forEach(function (ea, i) {
                            retVal = this.accept(ea, depth, newScope, path.concat([
                                'defaults',
                                i
                            ]));
                        }, this);
                    }
                    if (node.rest) {
                        retVal = this.accept(node.rest, depth, newScope, path.concat(['rest']));
                    }
                    retVal = this.accept(node.body, depth, newScope, path.concat(['body']));
                    if (node.generator) {
                    }
                    if (node.expression) {
                    }
                    return retVal;
                },
                visitIdentifier: function visitIdentifier(node, depth, scope, path) {
                    scope.refs.push(node);
                    return BaseVisitor.prototype.visitIdentifier.call(this, node, depth, scope, path);
                },
                visitMemberExpression: function visitMemberExpression(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.object, depth, state, path.concat(['object']));
                    if (node.computed) {
                        retVal = this.accept(node.property, depth, state, path.concat(['property']));
                    }
                    return retVal;
                },
                visitProperty: function visitProperty(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.value, depth, state, path.concat(['value']));
                    return retVal;
                },
                visitTryStatement: function visitTryStatement(node, depth, scope, path) {
                    var retVal;
                    retVal = this.accept(node.block, depth, scope, path.concat(['block']));
                    if (node.handler) {
                        retVal = this.accept(node.handler, depth, scope, path.concat(['handler']));
                        scope.catches.push(node.handler.param);
                    }
                    node.guardedHandlers && node.guardedHandlers.forEach(function (ea, i) {
                        retVal = this.accept(ea, depth, scope, path.concat([
                            'guardedHandlers',
                            i
                        ]));
                    }, this);
                    if (node.finalizer) {
                        retVal = this.accept(node.finalizer, depth, scope, path.concat(['finalizer']));
                    }
                    return retVal;
                },
                visitLabeledStatement: function visitLabeledStatement(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.body, depth, state, path.concat(['body']));
                    return retVal;
                },
                visitClassDeclaration: function visitClassDeclaration(node, depth, scope, path) {
                    scope.classDecls.push(node);
                    var retVal;
                    if (node.superClass) {
                        this.accept(node.superClass, depth, scope, path.concat(['superClass']));
                    }
                    retVal = this.accept(node.body, depth, scope, path.concat(['body']));
                    return retVal;
                },
                visitMethodDefinition: function visitMethodDefinition(node, depth, scope, path) {
                    var retVal;
                    retVal = this.accept(node.value, depth, scope, path.concat(['value']));
                    return retVal;
                },
                visitBreakStatement: function visitBreakStatement(node, depth, scope, path) {
                    return null;
                },
                visitContinueStatement: function visitContinueStatement(node, depth, scope, path) {
                    return null;
                },
                visitImportSpecifier: function visitImportSpecifier(node, depth, scope, path) {
                    scope.importDecls.push(node.local);
                    var retVal;
                    retVal = this.accept(node.imported, depth, scope, path.concat(['imported']));
                    var retVal;
                },
                visitImportDefaultSpecifier: function visitImportDefaultSpecifier(node, depth, scope, path) {
                    scope.importDecls.push(node.local);
                    return undefined;
                },
                visitImportNamespaceSpecifier: function visitImportNamespaceSpecifier(node, depth, scope, path) {
                    scope.importDecls.push(node.local);
                    return undefined;
                },
                visitExportSpecifier: function visitExportSpecifier(node, depth, state, path) {
                    var retVal;
                    retVal = this.accept(node.local, depth, state, path.concat(['local']));
                    var retVal;
                },
                visitExportNamedDeclaration: function visitExportNamedDeclaration(node, depth, scope, path) {
                    scope.exportDecls.push(node);
                    return BaseVisitor.prototype.visitExportNamedDeclaration.call(this, node, depth, scope, path);
                },
                visitExportDefaultDeclaration: function visitExportDefaultDeclaration(node, depth, scope, path) {
                    scope.exportDecls.push(node);
                    return BaseVisitor.prototype.visitExportDefaultDeclaration.call(this, node, depth, scope, path);
                },
                visitExportAllDeclaration: function visitExportAllDeclaration(node, depth, scope, path) {
                    scope.exportDecls.push(node);
                    return BaseVisitor.prototype.visitExportAllDeclaration.call(this, node, depth, scope, path);
                }
            });
            _export('BaseVisitor', BaseVisitor);
            _export('PrinterVisitor', PrinterVisitor);
            _export('ComparisonVisitor', ComparisonVisitor);
            _export('ScopeVisitor', ScopeVisitor);
        }
    };
})
System.registerDynamic('lively.ast/dist/escodegen.browser.js', [], false, function(require, exports, module) {
var _retrieveGlobal = System.get("@@global-helpers").prepareGlobal(module.id, null, null);
(function() {
// Generated by CommonJS Everywhere 0.9.7
(function (global) {
  function require(file, parentModule) {
    if ({}.hasOwnProperty.call(require.cache, file))
      return require.cache[file];
    var resolved = require.resolve(file);
    if (!resolved)
      throw new Error('Failed to resolve module ' + file);
    var module$ = {
        id: file,
        require: require,
        filename: file,
        exports: {},
        loaded: false,
        parent: parentModule,
        children: []
      };
    if (parentModule)
      parentModule.children.push(module$);
    var dirname = file.slice(0, file.lastIndexOf('/') + 1);
    require.cache[file] = module$.exports;
    resolved.call(module$.exports, module$, module$.exports, dirname, file);
    module$.loaded = true;
    return require.cache[file] = module$.exports;
  }
  require.modules = {};
  require.cache = {};
  require.resolve = function (file) {
    return {}.hasOwnProperty.call(require.modules, file) ? require.modules[file] : void 0;
  };
  require.define = function (file, fn) {
    require.modules[file] = fn;
  };
  var process = function () {
      var cwd = '/';
      return {
        title: 'browser',
        version: 'v4.1.1',
        browser: true,
        env: {},
        argv: [],
        nextTick: global.setImmediate || function (fn) {
          setTimeout(fn, 0);
        },
        cwd: function () {
          return cwd;
        },
        chdir: function (dir) {
          cwd = dir;
        }
      };
    }();
  require.define('/tools/entry-point.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      global.escodegen = require('/escodegen.js', module);
      escodegen.browser = true;
    }());
  });
  require.define('/escodegen.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      var Syntax, Precedence, BinaryPrecedence, SourceNode, estraverse, esutils, isArray, base, indent, json, renumber, hexadecimal, quotes, escapeless, newline, space, parentheses, semicolons, safeConcatenation, directive, extra, parse, sourceMap, sourceCode, preserveBlankLines, FORMAT_MINIFY, FORMAT_DEFAULTS;
      estraverse = require('/node_modules/estraverse/estraverse.js', module);
      esutils = require('/node_modules/esutils/lib/utils.js', module);
      Syntax = estraverse.Syntax;
      function isExpression(node) {
        return CodeGenerator.Expression.hasOwnProperty(node.type);
      }
      function isStatement(node) {
        return CodeGenerator.Statement.hasOwnProperty(node.type);
      }
      Precedence = {
        Sequence: 0,
        Yield: 1,
        Await: 1,
        Assignment: 1,
        Conditional: 2,
        ArrowFunction: 2,
        LogicalOR: 3,
        LogicalAND: 4,
        BitwiseOR: 5,
        BitwiseXOR: 6,
        BitwiseAND: 7,
        Equality: 8,
        Relational: 9,
        BitwiseSHIFT: 10,
        Additive: 11,
        Multiplicative: 12,
        Unary: 13,
        Postfix: 14,
        Call: 15,
        New: 16,
        TaggedTemplate: 17,
        Member: 18,
        Primary: 19
      };
      BinaryPrecedence = {
        '||': Precedence.LogicalOR,
        '&&': Precedence.LogicalAND,
        '|': Precedence.BitwiseOR,
        '^': Precedence.BitwiseXOR,
        '&': Precedence.BitwiseAND,
        '==': Precedence.Equality,
        '!=': Precedence.Equality,
        '===': Precedence.Equality,
        '!==': Precedence.Equality,
        'is': Precedence.Equality,
        'isnt': Precedence.Equality,
        '<': Precedence.Relational,
        '>': Precedence.Relational,
        '<=': Precedence.Relational,
        '>=': Precedence.Relational,
        'in': Precedence.Relational,
        'instanceof': Precedence.Relational,
        '<<': Precedence.BitwiseSHIFT,
        '>>': Precedence.BitwiseSHIFT,
        '>>>': Precedence.BitwiseSHIFT,
        '+': Precedence.Additive,
        '-': Precedence.Additive,
        '*': Precedence.Multiplicative,
        '%': Precedence.Multiplicative,
        '/': Precedence.Multiplicative
      };
      var F_ALLOW_IN = 1, F_ALLOW_CALL = 1 << 1, F_ALLOW_UNPARATH_NEW = 1 << 2, F_FUNC_BODY = 1 << 3, F_DIRECTIVE_CTX = 1 << 4, F_SEMICOLON_OPT = 1 << 5;
      var E_FTT = F_ALLOW_CALL | F_ALLOW_UNPARATH_NEW, E_TTF = F_ALLOW_IN | F_ALLOW_CALL, E_TTT = F_ALLOW_IN | F_ALLOW_CALL | F_ALLOW_UNPARATH_NEW, E_TFF = F_ALLOW_IN, E_FFT = F_ALLOW_UNPARATH_NEW, E_TFT = F_ALLOW_IN | F_ALLOW_UNPARATH_NEW;
      var S_TFFF = F_ALLOW_IN, S_TFFT = F_ALLOW_IN | F_SEMICOLON_OPT, S_FFFF = 0, S_TFTF = F_ALLOW_IN | F_DIRECTIVE_CTX, S_TTFF = F_ALLOW_IN | F_FUNC_BODY;
      function getDefaultOptions() {
        return {
          indent: null,
          base: null,
          parse: null,
          comment: false,
          format: {
            indent: {
              style: '    ',
              base: 0,
              adjustMultilineComment: false
            },
            newline: '\n',
            space: ' ',
            json: false,
            renumber: false,
            hexadecimal: false,
            quotes: 'single',
            escapeless: false,
            compact: false,
            parentheses: true,
            semicolons: true,
            safeConcatenation: false,
            preserveBlankLines: false
          },
          moz: {
            comprehensionExpressionStartsWithAssignment: false,
            starlessGenerator: false
          },
          sourceMap: null,
          sourceMapRoot: null,
          sourceMapWithCode: false,
          directive: false,
          raw: true,
          verbatim: null,
          sourceCode: null
        };
      }
      function stringRepeat(str, num) {
        var result = '';
        for (num |= 0; num > 0; num >>>= 1, str += str) {
          if (num & 1) {
            result += str;
          }
        }
        return result;
      }
      isArray = Array.isArray;
      if (!isArray) {
        isArray = function isArray(array) {
          return Object.prototype.toString.call(array) === '[object Array]';
        };
      }
      function hasLineTerminator(str) {
        return /[\r\n]/g.test(str);
      }
      function endsWithLineTerminator(str) {
        var len = str.length;
        return len && esutils.code.isLineTerminator(str.charCodeAt(len - 1));
      }
      function merge(target, override) {
        var key;
        for (key in override) {
          if (override.hasOwnProperty(key)) {
            target[key] = override[key];
          }
        }
        return target;
      }
      function updateDeeply(target, override) {
        var key, val;
        function isHashObject(target) {
          return typeof target === 'object' && target instanceof Object && !(target instanceof RegExp);
        }
        for (key in override) {
          if (override.hasOwnProperty(key)) {
            val = override[key];
            if (isHashObject(val)) {
              if (isHashObject(target[key])) {
                updateDeeply(target[key], val);
              } else {
                target[key] = updateDeeply({}, val);
              }
            } else {
              target[key] = val;
            }
          }
        }
        return target;
      }
      function generateNumber(value) {
        var result, point, temp, exponent, pos;
        if (value !== value) {
          throw new Error('Numeric literal whose value is NaN');
        }
        if (value < 0 || value === 0 && 1 / value < 0) {
          throw new Error('Numeric literal whose value is negative');
        }
        if (value === 1 / 0) {
          return json ? 'null' : renumber ? '1e400' : '1e+400';
        }
        result = '' + value;
        if (!renumber || result.length < 3) {
          return result;
        }
        point = result.indexOf('.');
        if (!json && result.charCodeAt(0) === 48 && point === 1) {
          point = 0;
          result = result.slice(1);
        }
        temp = result;
        result = result.replace('e+', 'e');
        exponent = 0;
        if ((pos = temp.indexOf('e')) > 0) {
          exponent = +temp.slice(pos + 1);
          temp = temp.slice(0, pos);
        }
        if (point >= 0) {
          exponent -= temp.length - point - 1;
          temp = +(temp.slice(0, point) + temp.slice(point + 1)) + '';
        }
        pos = 0;
        while (temp.charCodeAt(temp.length + pos - 1) === 48) {
          --pos;
        }
        if (pos !== 0) {
          exponent -= pos;
          temp = temp.slice(0, pos);
        }
        if (exponent !== 0) {
          temp += 'e' + exponent;
        }
        if ((temp.length < result.length || hexadecimal && value > 1e12 && Math.floor(value) === value && (temp = '0x' + value.toString(16)).length < result.length) && +temp === value) {
          result = temp;
        }
        return result;
      }
      function escapeRegExpCharacter(ch, previousIsBackslash) {
        if ((ch & ~1) === 8232) {
          return (previousIsBackslash ? 'u' : '\\u') + (ch === 8232 ? '2028' : '2029');
        } else if (ch === 10 || ch === 13) {
          return (previousIsBackslash ? '' : '\\') + (ch === 10 ? 'n' : 'r');
        }
        return String.fromCharCode(ch);
      }
      function generateRegExp(reg) {
        var match, result, flags, i, iz, ch, characterInBrack, previousIsBackslash;
        result = reg.toString();
        if (reg.source) {
          match = result.match(/\/([^\/]*)$/);
          if (!match) {
            return result;
          }
          flags = match[1];
          result = '';
          characterInBrack = false;
          previousIsBackslash = false;
          for (i = 0, iz = reg.source.length; i < iz; ++i) {
            ch = reg.source.charCodeAt(i);
            if (!previousIsBackslash) {
              if (characterInBrack) {
                if (ch === 93) {
                  characterInBrack = false;
                }
              } else {
                if (ch === 47) {
                  result += '\\';
                } else if (ch === 91) {
                  characterInBrack = true;
                }
              }
              result += escapeRegExpCharacter(ch, previousIsBackslash);
              previousIsBackslash = ch === 92;
            } else {
              result += escapeRegExpCharacter(ch, previousIsBackslash);
              previousIsBackslash = false;
            }
          }
          return '/' + result + '/' + flags;
        }
        return result;
      }
      function escapeAllowedCharacter(code, next) {
        var hex;
        if (code === 8) {
          return '\\b';
        }
        if (code === 12) {
          return '\\f';
        }
        if (code === 9) {
          return '\\t';
        }
        hex = code.toString(16).toUpperCase();
        if (json || code > 255) {
          return '\\u' + '0000'.slice(hex.length) + hex;
        } else if (code === 0 && !esutils.code.isDecimalDigit(next)) {
          return '\\0';
        } else if (code === 11) {
          return '\\x0B';
        } else {
          return '\\x' + '00'.slice(hex.length) + hex;
        }
      }
      function escapeDisallowedCharacter(code) {
        if (code === 92) {
          return '\\\\';
        }
        if (code === 10) {
          return '\\n';
        }
        if (code === 13) {
          return '\\r';
        }
        if (code === 8232) {
          return '\\u2028';
        }
        if (code === 8233) {
          return '\\u2029';
        }
        throw new Error('Incorrectly classified character');
      }
      function escapeDirective(str) {
        var i, iz, code, quote;
        quote = quotes === 'double' ? '"' : "'";
        for (i = 0, iz = str.length; i < iz; ++i) {
          code = str.charCodeAt(i);
          if (code === 39) {
            quote = '"';
            break;
          } else if (code === 34) {
            quote = "'";
            break;
          } else if (code === 92) {
            ++i;
          }
        }
        return quote + str + quote;
      }
      function escapeString(str) {
        var result = '', i, len, code, singleQuotes = 0, doubleQuotes = 0, single, quote;
        for (i = 0, len = str.length; i < len; ++i) {
          code = str.charCodeAt(i);
          if (code === 39) {
            ++singleQuotes;
          } else if (code === 34) {
            ++doubleQuotes;
          } else if (code === 47 && json) {
            result += '\\';
          } else if (esutils.code.isLineTerminator(code) || code === 92) {
            result += escapeDisallowedCharacter(code);
            continue;
          } else if (!esutils.code.isIdentifierPartES5(code) && (json && code < 32 || !json && !escapeless && (code < 32 || code > 126))) {
            result += escapeAllowedCharacter(code, str.charCodeAt(i + 1));
            continue;
          }
          result += String.fromCharCode(code);
        }
        single = !(quotes === 'double' || quotes === 'auto' && doubleQuotes < singleQuotes);
        quote = single ? "'" : '"';
        if (!(single ? singleQuotes : doubleQuotes)) {
          return quote + result + quote;
        }
        str = result;
        result = quote;
        for (i = 0, len = str.length; i < len; ++i) {
          code = str.charCodeAt(i);
          if (code === 39 && single || code === 34 && !single) {
            result += '\\';
          }
          result += String.fromCharCode(code);
        }
        return result + quote;
      }
      function flattenToString(arr) {
        var i, iz, elem, result = '';
        for (i = 0, iz = arr.length; i < iz; ++i) {
          elem = arr[i];
          result += isArray(elem) ? flattenToString(elem) : elem;
        }
        return result;
      }
      function toSourceNodeWhenNeeded(generated, node) {
        if (!sourceMap) {
          if (isArray(generated)) {
            return flattenToString(generated);
          } else {
            return generated;
          }
        }
        if (node == null) {
          if (generated instanceof SourceNode) {
            return generated;
          } else {
            node = {};
          }
        }
        if (node.loc == null) {
          return new SourceNode(null, null, sourceMap, generated, node.name || null);
        }
        return new SourceNode(node.loc.start.line, node.loc.start.column, sourceMap === true ? node.loc.source || null : sourceMap, generated, node.name || null);
      }
      function noEmptySpace() {
        return space ? space : ' ';
      }
      function join(left, right) {
        var leftSource, rightSource, leftCharCode, rightCharCode;
        leftSource = toSourceNodeWhenNeeded(left).toString();
        if (leftSource.length === 0) {
          return [right];
        }
        rightSource = toSourceNodeWhenNeeded(right).toString();
        if (rightSource.length === 0) {
          return [left];
        }
        leftCharCode = leftSource.charCodeAt(leftSource.length - 1);
        rightCharCode = rightSource.charCodeAt(0);
        if ((leftCharCode === 43 || leftCharCode === 45) && leftCharCode === rightCharCode || esutils.code.isIdentifierPartES5(leftCharCode) && esutils.code.isIdentifierPartES5(rightCharCode) || leftCharCode === 47 && rightCharCode === 105) {
          return [
            left,
            noEmptySpace(),
            right
          ];
        } else if (esutils.code.isWhiteSpace(leftCharCode) || esutils.code.isLineTerminator(leftCharCode) || esutils.code.isWhiteSpace(rightCharCode) || esutils.code.isLineTerminator(rightCharCode)) {
          return [
            left,
            right
          ];
        }
        return [
          left,
          space,
          right
        ];
      }
      function addIndent(stmt) {
        return [
          base,
          stmt
        ];
      }
      function withIndent(fn) {
        var previousBase;
        previousBase = base;
        base += indent;
        fn(base);
        base = previousBase;
      }
      function calculateSpaces(str) {
        var i;
        for (i = str.length - 1; i >= 0; --i) {
          if (esutils.code.isLineTerminator(str.charCodeAt(i))) {
            break;
          }
        }
        return str.length - 1 - i;
      }
      function adjustMultilineComment(value, specialBase) {
        var array, i, len, line, j, spaces, previousBase, sn;
        array = value.split(/\r\n|[\r\n]/);
        spaces = Number.MAX_VALUE;
        for (i = 1, len = array.length; i < len; ++i) {
          line = array[i];
          j = 0;
          while (j < line.length && esutils.code.isWhiteSpace(line.charCodeAt(j))) {
            ++j;
          }
          if (spaces > j) {
            spaces = j;
          }
        }
        if (typeof specialBase !== 'undefined') {
          previousBase = base;
          if (array[1][spaces] === '*') {
            specialBase += ' ';
          }
          base = specialBase;
        } else {
          if (spaces & 1) {
            --spaces;
          }
          previousBase = base;
        }
        for (i = 1, len = array.length; i < len; ++i) {
          sn = toSourceNodeWhenNeeded(addIndent(array[i].slice(spaces)));
          array[i] = sourceMap ? sn.join('') : sn;
        }
        base = previousBase;
        return array.join('\n');
      }
      function generateComment(comment, specialBase) {
        if (comment.type === 'Line') {
          if (endsWithLineTerminator(comment.value)) {
            return '//' + comment.value;
          } else {
            var result = '//' + comment.value;
            if (!preserveBlankLines) {
              result += '\n';
            }
            return result;
          }
        }
        if (extra.format.indent.adjustMultilineComment && /[\n\r]/.test(comment.value)) {
          return adjustMultilineComment('/*' + comment.value + '*/', specialBase);
        }
        return '/*' + comment.value + '*/';
      }
      function addComments(stmt, result) {
        var i, len, comment, save, tailingToStatement, specialBase, fragment, extRange, range, prevRange, prefix, infix, suffix, count;
        if (stmt.leadingComments && stmt.leadingComments.length > 0) {
          save = result;
          if (preserveBlankLines) {
            comment = stmt.leadingComments[0];
            result = [];
            extRange = comment.extendedRange;
            range = comment.range;
            prefix = sourceCode.substring(extRange[0], range[0]);
            count = (prefix.match(/\n/g) || []).length;
            if (count > 0) {
              result.push(stringRepeat('\n', count));
              result.push(addIndent(generateComment(comment)));
            } else {
              result.push(prefix);
              result.push(generateComment(comment));
            }
            prevRange = range;
            for (i = 1, len = stmt.leadingComments.length; i < len; i++) {
              comment = stmt.leadingComments[i];
              range = comment.range;
              infix = sourceCode.substring(prevRange[1], range[0]);
              count = (infix.match(/\n/g) || []).length;
              result.push(stringRepeat('\n', count));
              result.push(addIndent(generateComment(comment)));
              prevRange = range;
            }
            suffix = sourceCode.substring(range[1], extRange[1]);
            count = (suffix.match(/\n/g) || []).length;
            result.push(stringRepeat('\n', count));
          } else {
            comment = stmt.leadingComments[0];
            result = [];
            if (safeConcatenation && stmt.type === Syntax.Program && stmt.body.length === 0) {
              result.push('\n');
            }
            result.push(generateComment(comment));
            if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
              result.push('\n');
            }
            for (i = 1, len = stmt.leadingComments.length; i < len; ++i) {
              comment = stmt.leadingComments[i];
              fragment = [generateComment(comment)];
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                fragment.push('\n');
              }
              result.push(addIndent(fragment));
            }
          }
          result.push(addIndent(save));
        }
        if (stmt.trailingComments) {
          if (preserveBlankLines) {
            comment = stmt.trailingComments[0];
            extRange = comment.extendedRange;
            range = comment.range;
            prefix = sourceCode.substring(extRange[0], range[0]);
            count = (prefix.match(/\n/g) || []).length;
            if (count > 0) {
              result.push(stringRepeat('\n', count));
              result.push(addIndent(generateComment(comment)));
            } else {
              result.push(prefix);
              result.push(generateComment(comment));
            }
          } else {
            tailingToStatement = !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString());
            specialBase = stringRepeat(' ', calculateSpaces(toSourceNodeWhenNeeded([
              base,
              result,
              indent
            ]).toString()));
            for (i = 0, len = stmt.trailingComments.length; i < len; ++i) {
              comment = stmt.trailingComments[i];
              if (tailingToStatement) {
                if (i === 0) {
                  result = [
                    result,
                    indent
                  ];
                } else {
                  result = [
                    result,
                    specialBase
                  ];
                }
                result.push(generateComment(comment, specialBase));
              } else {
                result = [
                  result,
                  addIndent(generateComment(comment))
                ];
              }
              if (i !== len - 1 && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
                result = [
                  result,
                  '\n'
                ];
              }
            }
          }
        }
        return result;
      }
      function generateBlankLines(start, end, result) {
        var j, newlineCount = 0;
        for (j = start; j < end; j++) {
          if (sourceCode[j] === '\n') {
            newlineCount++;
          }
        }
        for (j = 1; j < newlineCount; j++) {
          result.push(newline);
        }
      }
      function parenthesize(text, current, should) {
        if (current < should) {
          return [
            '(',
            text,
            ')'
          ];
        }
        return text;
      }
      function generateVerbatimString(string) {
        var i, iz, result;
        result = string.split(/\r\n|\n/);
        for (i = 1, iz = result.length; i < iz; i++) {
          result[i] = newline + base + result[i];
        }
        return result;
      }
      function generateVerbatim(expr, precedence) {
        var verbatim, result, prec;
        verbatim = expr[extra.verbatim];
        if (typeof verbatim === 'string') {
          result = parenthesize(generateVerbatimString(verbatim), Precedence.Sequence, precedence);
        } else {
          result = generateVerbatimString(verbatim.content);
          prec = verbatim.precedence != null ? verbatim.precedence : Precedence.Sequence;
          result = parenthesize(result, prec, precedence);
        }
        return toSourceNodeWhenNeeded(result, expr);
      }
      function CodeGenerator() {
      }
      CodeGenerator.prototype.maybeBlock = function (stmt, flags) {
        var result, noLeadingComment, that = this;
        noLeadingComment = !extra.comment || !stmt.leadingComments;
        if (stmt.type === Syntax.BlockStatement && noLeadingComment) {
          return [
            space,
            this.generateStatement(stmt, flags)
          ];
        }
        if (stmt.type === Syntax.EmptyStatement && noLeadingComment) {
          return ';';
        }
        withIndent(function () {
          result = [
            newline,
            addIndent(that.generateStatement(stmt, flags))
          ];
        });
        return result;
      };
      CodeGenerator.prototype.maybeBlockSuffix = function (stmt, result) {
        var ends = endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString());
        if (stmt.type === Syntax.BlockStatement && (!extra.comment || !stmt.leadingComments) && !ends) {
          return [
            result,
            space
          ];
        }
        if (ends) {
          return [
            result,
            base
          ];
        }
        return [
          result,
          newline,
          base
        ];
      };
      function generateIdentifier(node) {
        return toSourceNodeWhenNeeded(node.name, node);
      }
      function generateAsyncPrefix(node, spaceRequired) {
        return node.async ? 'async' + (spaceRequired ? noEmptySpace() : space) : '';
      }
      function generateStarSuffix(node) {
        var isGenerator = node.generator && !extra.moz.starlessGenerator;
        return isGenerator ? '*' + space : '';
      }
      function generateMethodPrefix(prop) {
        var func = prop.value;
        if (func.async) {
          return generateAsyncPrefix(func, !prop.computed);
        } else {
          return generateStarSuffix(func) ? '*' : '';
        }
      }
      CodeGenerator.prototype.generatePattern = function (node, precedence, flags) {
        if (node.type === Syntax.Identifier) {
          return generateIdentifier(node);
        }
        return this.generateExpression(node, precedence, flags);
      };
      CodeGenerator.prototype.generateFunctionParams = function (node) {
        var i, iz, result, hasDefault;
        hasDefault = false;
        if (node.type === Syntax.ArrowFunctionExpression && !node.rest && (!node.defaults || node.defaults.length === 0) && node.params.length === 1 && node.params[0].type === Syntax.Identifier) {
          result = [
            generateAsyncPrefix(node, true),
            generateIdentifier(node.params[0])
          ];
        } else {
          result = node.type === Syntax.ArrowFunctionExpression ? [generateAsyncPrefix(node, false)] : [];
          result.push('(');
          if (node.defaults) {
            hasDefault = true;
          }
          for (i = 0, iz = node.params.length; i < iz; ++i) {
            if (hasDefault && node.defaults[i]) {
              result.push(this.generateAssignment(node.params[i], node.defaults[i], '=', Precedence.Assignment, E_TTT));
            } else {
              result.push(this.generatePattern(node.params[i], Precedence.Assignment, E_TTT));
            }
            if (i + 1 < iz) {
              result.push(',' + space);
            }
          }
          if (node.rest) {
            if (node.params.length) {
              result.push(',' + space);
            }
            result.push('...');
            result.push(generateIdentifier(node.rest));
          }
          result.push(')');
        }
        return result;
      };
      CodeGenerator.prototype.generateFunctionBody = function (node) {
        var result, expr;
        result = this.generateFunctionParams(node);
        if (node.type === Syntax.ArrowFunctionExpression) {
          result.push(space);
          result.push('=>');
        }
        if (node.expression) {
          result.push(space);
          expr = this.generateExpression(node.body, Precedence.Assignment, E_TTT);
          if (expr.toString().charAt(0) === '{') {
            expr = [
              '(',
              expr,
              ')'
            ];
          }
          result.push(expr);
        } else {
          result.push(this.maybeBlock(node.body, S_TTFF));
        }
        return result;
      };
      CodeGenerator.prototype.generateIterationForStatement = function (operator, stmt, flags) {
        var result = ['for' + space + '('], that = this;
        withIndent(function () {
          if (stmt.left.type === Syntax.VariableDeclaration) {
            withIndent(function () {
              result.push(stmt.left.kind + noEmptySpace());
              result.push(that.generateStatement(stmt.left.declarations[0], S_FFFF));
            });
          } else {
            result.push(that.generateExpression(stmt.left, Precedence.Call, E_TTT));
          }
          result = join(result, operator);
          result = [
            join(result, that.generateExpression(stmt.right, Precedence.Sequence, E_TTT)),
            ')'
          ];
        });
        result.push(this.maybeBlock(stmt.body, flags));
        return result;
      };
      CodeGenerator.prototype.generatePropertyKey = function (expr, computed) {
        var result = [];
        if (computed) {
          result.push('[');
        }
        result.push(this.generateExpression(expr, Precedence.Sequence, E_TTT));
        if (computed) {
          result.push(']');
        }
        return result;
      };
      CodeGenerator.prototype.generateAssignment = function (left, right, operator, precedence, flags) {
        if (Precedence.Assignment < precedence) {
          flags |= F_ALLOW_IN;
        }
        return parenthesize([
          this.generateExpression(left, Precedence.Call, flags),
          space + operator + space,
          this.generateExpression(right, Precedence.Assignment, flags)
        ], Precedence.Assignment, precedence);
      };
      CodeGenerator.prototype.semicolon = function (flags) {
        if (!semicolons && flags & F_SEMICOLON_OPT) {
          return '';
        }
        return ';';
      };
      CodeGenerator.Statement = {
        BlockStatement: function (stmt, flags) {
          var range, content, result = [
              '{',
              newline
            ], that = this;
          withIndent(function () {
            if (stmt.body.length === 0 && preserveBlankLines) {
              range = stmt.range;
              if (range[1] - range[0] > 2) {
                content = sourceCode.substring(range[0] + 1, range[1] - 1);
                if (content[0] === '\n') {
                  result = ['{'];
                }
                result.push(content);
              }
            }
            var i, iz, fragment, bodyFlags;
            bodyFlags = S_TFFF;
            if (flags & F_FUNC_BODY) {
              bodyFlags |= F_DIRECTIVE_CTX;
            }
            for (i = 0, iz = stmt.body.length; i < iz; ++i) {
              if (preserveBlankLines) {
                if (i === 0) {
                  if (stmt.body[0].leadingComments) {
                    range = stmt.body[0].leadingComments[0].extendedRange;
                    content = sourceCode.substring(range[0], range[1]);
                    if (content[0] === '\n') {
                      result = ['{'];
                    }
                  }
                  if (!stmt.body[0].leadingComments) {
                    generateBlankLines(stmt.range[0], stmt.body[0].range[0], result);
                  }
                }
                if (i > 0) {
                  if (!stmt.body[i - 1].trailingComments && !stmt.body[i].leadingComments) {
                    generateBlankLines(stmt.body[i - 1].range[1], stmt.body[i].range[0], result);
                  }
                }
              }
              if (i === iz - 1) {
                bodyFlags |= F_SEMICOLON_OPT;
              }
              if (stmt.body[i].leadingComments && preserveBlankLines) {
                fragment = that.generateStatement(stmt.body[i], bodyFlags);
              } else {
                fragment = addIndent(that.generateStatement(stmt.body[i], bodyFlags));
              }
              result.push(fragment);
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                if (preserveBlankLines && i < iz - 1) {
                  if (!stmt.body[i + 1].leadingComments) {
                    result.push(newline);
                  }
                } else {
                  result.push(newline);
                }
              }
              if (preserveBlankLines) {
                if (i === iz - 1) {
                  if (!stmt.body[i].trailingComments) {
                    generateBlankLines(stmt.body[i].range[1], stmt.range[1], result);
                  }
                }
              }
            }
          });
          result.push(addIndent('}'));
          return result;
        },
        BreakStatement: function (stmt, flags) {
          if (stmt.label) {
            return 'break ' + stmt.label.name + this.semicolon(flags);
          }
          return 'break' + this.semicolon(flags);
        },
        ContinueStatement: function (stmt, flags) {
          if (stmt.label) {
            return 'continue ' + stmt.label.name + this.semicolon(flags);
          }
          return 'continue' + this.semicolon(flags);
        },
        ClassBody: function (stmt, flags) {
          var result = [
              '{',
              newline
            ], that = this;
          withIndent(function (indent) {
            var i, iz;
            for (i = 0, iz = stmt.body.length; i < iz; ++i) {
              result.push(indent);
              result.push(that.generateExpression(stmt.body[i], Precedence.Sequence, E_TTT));
              if (i + 1 < iz) {
                result.push(newline);
              }
            }
          });
          if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(base);
          result.push('}');
          return result;
        },
        ClassDeclaration: function (stmt, flags) {
          var result, fragment;
          result = ['class ' + stmt.id.name];
          if (stmt.superClass) {
            fragment = join('extends', this.generateExpression(stmt.superClass, Precedence.Assignment, E_TTT));
            result = join(result, fragment);
          }
          result.push(space);
          result.push(this.generateStatement(stmt.body, S_TFFT));
          return result;
        },
        DirectiveStatement: function (stmt, flags) {
          if (extra.raw && stmt.raw) {
            return stmt.raw + this.semicolon(flags);
          }
          return escapeDirective(stmt.directive) + this.semicolon(flags);
        },
        DoWhileStatement: function (stmt, flags) {
          var result = join('do', this.maybeBlock(stmt.body, S_TFFF));
          result = this.maybeBlockSuffix(stmt.body, result);
          return join(result, [
            'while' + space + '(',
            this.generateExpression(stmt.test, Precedence.Sequence, E_TTT),
            ')' + this.semicolon(flags)
          ]);
        },
        CatchClause: function (stmt, flags) {
          var result, that = this;
          withIndent(function () {
            var guard;
            result = [
              'catch' + space + '(',
              that.generateExpression(stmt.param, Precedence.Sequence, E_TTT),
              ')'
            ];
            if (stmt.guard) {
              guard = that.generateExpression(stmt.guard, Precedence.Sequence, E_TTT);
              result.splice(2, 0, ' if ', guard);
            }
          });
          result.push(this.maybeBlock(stmt.body, S_TFFF));
          return result;
        },
        DebuggerStatement: function (stmt, flags) {
          return 'debugger' + this.semicolon(flags);
        },
        EmptyStatement: function (stmt, flags) {
          return ';';
        },
        ExportDefaultDeclaration: function (stmt, flags) {
          var result = ['export'], bodyFlags;
          bodyFlags = flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF;
          result = join(result, 'default');
          if (isStatement(stmt.declaration)) {
            result = join(result, this.generateStatement(stmt.declaration, bodyFlags));
          } else {
            result = join(result, this.generateExpression(stmt.declaration, Precedence.Assignment, E_TTT) + this.semicolon(flags));
          }
          return result;
        },
        ExportNamedDeclaration: function (stmt, flags) {
          var result = ['export'], bodyFlags, that = this;
          bodyFlags = flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF;
          if (stmt.declaration) {
            return join(result, this.generateStatement(stmt.declaration, bodyFlags));
          }
          if (stmt.specifiers) {
            if (stmt.specifiers.length === 0) {
              result = join(result, '{' + space + '}');
            } else if (stmt.specifiers[0].type === Syntax.ExportBatchSpecifier) {
              result = join(result, this.generateExpression(stmt.specifiers[0], Precedence.Sequence, E_TTT));
            } else {
              result = join(result, '{');
              withIndent(function (indent) {
                var i, iz;
                result.push(newline);
                for (i = 0, iz = stmt.specifiers.length; i < iz; ++i) {
                  result.push(indent);
                  result.push(that.generateExpression(stmt.specifiers[i], Precedence.Sequence, E_TTT));
                  if (i + 1 < iz) {
                    result.push(',' + newline);
                  }
                }
              });
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
                result.push(newline);
              }
              result.push(base + '}');
            }
            if (stmt.source) {
              result = join(result, [
                'from' + space,
                this.generateExpression(stmt.source, Precedence.Sequence, E_TTT),
                this.semicolon(flags)
              ]);
            } else {
              result.push(this.semicolon(flags));
            }
          }
          return result;
        },
        ExportAllDeclaration: function (stmt, flags) {
          return [
            'export' + space,
            '*' + space,
            'from' + space,
            this.generateExpression(stmt.source, Precedence.Sequence, E_TTT),
            this.semicolon(flags)
          ];
        },
        ExpressionStatement: function (stmt, flags) {
          var result, fragment;
          function isClassPrefixed(fragment) {
            var code;
            if (fragment.slice(0, 5) !== 'class') {
              return false;
            }
            code = fragment.charCodeAt(5);
            return code === 123 || esutils.code.isWhiteSpace(code) || esutils.code.isLineTerminator(code);
          }
          function isFunctionPrefixed(fragment) {
            var code;
            if (fragment.slice(0, 8) !== 'function') {
              return false;
            }
            code = fragment.charCodeAt(8);
            return code === 40 || esutils.code.isWhiteSpace(code) || code === 42 || esutils.code.isLineTerminator(code);
          }
          function isAsyncPrefixed(fragment) {
            var code, i, iz;
            if (fragment.slice(0, 5) !== 'async') {
              return false;
            }
            if (!esutils.code.isWhiteSpace(fragment.charCodeAt(5))) {
              return false;
            }
            for (i = 6, iz = fragment.length; i < iz; ++i) {
              if (!esutils.code.isWhiteSpace(fragment.charCodeAt(i))) {
                break;
              }
            }
            if (i === iz) {
              return false;
            }
            if (fragment.slice(i, i + 8) !== 'function') {
              return false;
            }
            code = fragment.charCodeAt(i + 8);
            return code === 40 || esutils.code.isWhiteSpace(code) || code === 42 || esutils.code.isLineTerminator(code);
          }
          result = [this.generateExpression(stmt.expression, Precedence.Sequence, E_TTT)];
          fragment = toSourceNodeWhenNeeded(result).toString();
          if (fragment.charCodeAt(0) === 123 || isClassPrefixed(fragment) || isFunctionPrefixed(fragment) || isAsyncPrefixed(fragment) || directive && flags & F_DIRECTIVE_CTX && stmt.expression.type === Syntax.Literal && typeof stmt.expression.value === 'string') {
            result = [
              '(',
              result,
              ')' + this.semicolon(flags)
            ];
          } else {
            result.push(this.semicolon(flags));
          }
          return result;
        },
        ImportDeclaration: function (stmt, flags) {
          var result, cursor, that = this;
          if (stmt.specifiers.length === 0) {
            return [
              'import',
              space,
              this.generateExpression(stmt.source, Precedence.Sequence, E_TTT),
              this.semicolon(flags)
            ];
          }
          result = ['import'];
          cursor = 0;
          if (stmt.specifiers[cursor].type === Syntax.ImportDefaultSpecifier) {
            result = join(result, [this.generateExpression(stmt.specifiers[cursor], Precedence.Sequence, E_TTT)]);
            ++cursor;
          }
          if (stmt.specifiers[cursor]) {
            if (cursor !== 0) {
              result.push(',');
            }
            if (stmt.specifiers[cursor].type === Syntax.ImportNamespaceSpecifier) {
              result = join(result, [
                space,
                this.generateExpression(stmt.specifiers[cursor], Precedence.Sequence, E_TTT)
              ]);
            } else {
              result.push(space + '{');
              if (stmt.specifiers.length - cursor === 1) {
                result.push(space);
                result.push(this.generateExpression(stmt.specifiers[cursor], Precedence.Sequence, E_TTT));
                result.push(space + '}' + space);
              } else {
                withIndent(function (indent) {
                  var i, iz;
                  result.push(newline);
                  for (i = cursor, iz = stmt.specifiers.length; i < iz; ++i) {
                    result.push(indent);
                    result.push(that.generateExpression(stmt.specifiers[i], Precedence.Sequence, E_TTT));
                    if (i + 1 < iz) {
                      result.push(',' + newline);
                    }
                  }
                });
                if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
                  result.push(newline);
                }
                result.push(base + '}' + space);
              }
            }
          }
          result = join(result, [
            'from' + space,
            this.generateExpression(stmt.source, Precedence.Sequence, E_TTT),
            this.semicolon(flags)
          ]);
          return result;
        },
        VariableDeclarator: function (stmt, flags) {
          var itemFlags = flags & F_ALLOW_IN ? E_TTT : E_FTT;
          if (stmt.init) {
            return [
              this.generateExpression(stmt.id, Precedence.Assignment, itemFlags),
              space,
              '=',
              space,
              this.generateExpression(stmt.init, Precedence.Assignment, itemFlags)
            ];
          }
          return this.generatePattern(stmt.id, Precedence.Assignment, itemFlags);
        },
        VariableDeclaration: function (stmt, flags) {
          var result, i, iz, node, bodyFlags, that = this;
          result = [stmt.kind];
          bodyFlags = flags & F_ALLOW_IN ? S_TFFF : S_FFFF;
          function block() {
            node = stmt.declarations[0];
            if (extra.comment && node.leadingComments) {
              result.push('\n');
              result.push(addIndent(that.generateStatement(node, bodyFlags)));
            } else {
              result.push(noEmptySpace());
              result.push(that.generateStatement(node, bodyFlags));
            }
            for (i = 1, iz = stmt.declarations.length; i < iz; ++i) {
              node = stmt.declarations[i];
              if (extra.comment && node.leadingComments) {
                result.push(',' + newline);
                result.push(addIndent(that.generateStatement(node, bodyFlags)));
              } else {
                result.push(',' + space);
                result.push(that.generateStatement(node, bodyFlags));
              }
            }
          }
          if (stmt.declarations.length > 1) {
            withIndent(block);
          } else {
            block();
          }
          result.push(this.semicolon(flags));
          return result;
        },
        ThrowStatement: function (stmt, flags) {
          return [
            join('throw', this.generateExpression(stmt.argument, Precedence.Sequence, E_TTT)),
            this.semicolon(flags)
          ];
        },
        TryStatement: function (stmt, flags) {
          var result, i, iz, guardedHandlers;
          result = [
            'try',
            this.maybeBlock(stmt.block, S_TFFF)
          ];
          result = this.maybeBlockSuffix(stmt.block, result);
          if (stmt.handlers) {
            for (i = 0, iz = stmt.handlers.length; i < iz; ++i) {
              result = join(result, this.generateStatement(stmt.handlers[i], S_TFFF));
              if (stmt.finalizer || i + 1 !== iz) {
                result = this.maybeBlockSuffix(stmt.handlers[i].body, result);
              }
            }
          } else {
            guardedHandlers = stmt.guardedHandlers || [];
            for (i = 0, iz = guardedHandlers.length; i < iz; ++i) {
              result = join(result, this.generateStatement(guardedHandlers[i], S_TFFF));
              if (stmt.finalizer || i + 1 !== iz) {
                result = this.maybeBlockSuffix(guardedHandlers[i].body, result);
              }
            }
            if (stmt.handler) {
              if (isArray(stmt.handler)) {
                for (i = 0, iz = stmt.handler.length; i < iz; ++i) {
                  result = join(result, this.generateStatement(stmt.handler[i], S_TFFF));
                  if (stmt.finalizer || i + 1 !== iz) {
                    result = this.maybeBlockSuffix(stmt.handler[i].body, result);
                  }
                }
              } else {
                result = join(result, this.generateStatement(stmt.handler, S_TFFF));
                if (stmt.finalizer) {
                  result = this.maybeBlockSuffix(stmt.handler.body, result);
                }
              }
            }
          }
          if (stmt.finalizer) {
            result = join(result, [
              'finally',
              this.maybeBlock(stmt.finalizer, S_TFFF)
            ]);
          }
          return result;
        },
        SwitchStatement: function (stmt, flags) {
          var result, fragment, i, iz, bodyFlags, that = this;
          withIndent(function () {
            result = [
              'switch' + space + '(',
              that.generateExpression(stmt.discriminant, Precedence.Sequence, E_TTT),
              ')' + space + '{' + newline
            ];
          });
          if (stmt.cases) {
            bodyFlags = S_TFFF;
            for (i = 0, iz = stmt.cases.length; i < iz; ++i) {
              if (i === iz - 1) {
                bodyFlags |= F_SEMICOLON_OPT;
              }
              fragment = addIndent(this.generateStatement(stmt.cases[i], bodyFlags));
              result.push(fragment);
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                result.push(newline);
              }
            }
          }
          result.push(addIndent('}'));
          return result;
        },
        SwitchCase: function (stmt, flags) {
          var result, fragment, i, iz, bodyFlags, that = this;
          withIndent(function () {
            if (stmt.test) {
              result = [
                join('case', that.generateExpression(stmt.test, Precedence.Sequence, E_TTT)),
                ':'
              ];
            } else {
              result = ['default:'];
            }
            i = 0;
            iz = stmt.consequent.length;
            if (iz && stmt.consequent[0].type === Syntax.BlockStatement) {
              fragment = that.maybeBlock(stmt.consequent[0], S_TFFF);
              result.push(fragment);
              i = 1;
            }
            if (i !== iz && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
              result.push(newline);
            }
            bodyFlags = S_TFFF;
            for (; i < iz; ++i) {
              if (i === iz - 1 && flags & F_SEMICOLON_OPT) {
                bodyFlags |= F_SEMICOLON_OPT;
              }
              fragment = addIndent(that.generateStatement(stmt.consequent[i], bodyFlags));
              result.push(fragment);
              if (i + 1 !== iz && !endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                result.push(newline);
              }
            }
          });
          return result;
        },
        IfStatement: function (stmt, flags) {
          var result, bodyFlags, semicolonOptional, that = this;
          withIndent(function () {
            result = [
              'if' + space + '(',
              that.generateExpression(stmt.test, Precedence.Sequence, E_TTT),
              ')'
            ];
          });
          semicolonOptional = flags & F_SEMICOLON_OPT;
          bodyFlags = S_TFFF;
          if (semicolonOptional) {
            bodyFlags |= F_SEMICOLON_OPT;
          }
          if (stmt.alternate) {
            result.push(this.maybeBlock(stmt.consequent, S_TFFF));
            result = this.maybeBlockSuffix(stmt.consequent, result);
            if (stmt.alternate.type === Syntax.IfStatement) {
              result = join(result, [
                'else ',
                this.generateStatement(stmt.alternate, bodyFlags)
              ]);
            } else {
              result = join(result, join('else', this.maybeBlock(stmt.alternate, bodyFlags)));
            }
          } else {
            result.push(this.maybeBlock(stmt.consequent, bodyFlags));
          }
          return result;
        },
        ForStatement: function (stmt, flags) {
          var result, that = this;
          withIndent(function () {
            result = ['for' + space + '('];
            if (stmt.init) {
              if (stmt.init.type === Syntax.VariableDeclaration) {
                result.push(that.generateStatement(stmt.init, S_FFFF));
              } else {
                result.push(that.generateExpression(stmt.init, Precedence.Sequence, E_FTT));
                result.push(';');
              }
            } else {
              result.push(';');
            }
            if (stmt.test) {
              result.push(space);
              result.push(that.generateExpression(stmt.test, Precedence.Sequence, E_TTT));
              result.push(';');
            } else {
              result.push(';');
            }
            if (stmt.update) {
              result.push(space);
              result.push(that.generateExpression(stmt.update, Precedence.Sequence, E_TTT));
              result.push(')');
            } else {
              result.push(')');
            }
          });
          result.push(this.maybeBlock(stmt.body, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF));
          return result;
        },
        ForInStatement: function (stmt, flags) {
          return this.generateIterationForStatement('in', stmt, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF);
        },
        ForOfStatement: function (stmt, flags) {
          return this.generateIterationForStatement('of', stmt, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF);
        },
        LabeledStatement: function (stmt, flags) {
          return [
            stmt.label.name + ':',
            this.maybeBlock(stmt.body, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF)
          ];
        },
        Program: function (stmt, flags) {
          var result, fragment, i, iz, bodyFlags;
          iz = stmt.body.length;
          result = [safeConcatenation && iz > 0 ? '\n' : ''];
          bodyFlags = S_TFTF;
          for (i = 0; i < iz; ++i) {
            if (!safeConcatenation && i === iz - 1) {
              bodyFlags |= F_SEMICOLON_OPT;
            }
            if (preserveBlankLines) {
              if (i === 0) {
                if (!stmt.body[0].leadingComments) {
                  generateBlankLines(stmt.range[0], stmt.body[i].range[0], result);
                }
              }
              if (i > 0) {
                if (!stmt.body[i - 1].trailingComments && !stmt.body[i].leadingComments) {
                  generateBlankLines(stmt.body[i - 1].range[1], stmt.body[i].range[0], result);
                }
              }
            }
            fragment = addIndent(this.generateStatement(stmt.body[i], bodyFlags));
            result.push(fragment);
            if (i + 1 < iz && !endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
              if (preserveBlankLines) {
                if (!stmt.body[i + 1].leadingComments) {
                  result.push(newline);
                }
              } else {
                result.push(newline);
              }
            }
            if (preserveBlankLines) {
              if (i === iz - 1) {
                if (!stmt.body[i].trailingComments) {
                  generateBlankLines(stmt.body[i].range[1], stmt.range[1], result);
                }
              }
            }
          }
          return result;
        },
        FunctionDeclaration: function (stmt, flags) {
          return [
            generateAsyncPrefix(stmt, true),
            'function',
            generateStarSuffix(stmt) || noEmptySpace(),
            stmt.id ? generateIdentifier(stmt.id) : '',
            this.generateFunctionBody(stmt)
          ];
        },
        ReturnStatement: function (stmt, flags) {
          if (stmt.argument) {
            return [
              join('return', this.generateExpression(stmt.argument, Precedence.Sequence, E_TTT)),
              this.semicolon(flags)
            ];
          }
          return ['return' + this.semicolon(flags)];
        },
        WhileStatement: function (stmt, flags) {
          var result, that = this;
          withIndent(function () {
            result = [
              'while' + space + '(',
              that.generateExpression(stmt.test, Precedence.Sequence, E_TTT),
              ')'
            ];
          });
          result.push(this.maybeBlock(stmt.body, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF));
          return result;
        },
        WithStatement: function (stmt, flags) {
          var result, that = this;
          withIndent(function () {
            result = [
              'with' + space + '(',
              that.generateExpression(stmt.object, Precedence.Sequence, E_TTT),
              ')'
            ];
          });
          result.push(this.maybeBlock(stmt.body, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF));
          return result;
        }
      };
      merge(CodeGenerator.prototype, CodeGenerator.Statement);
      CodeGenerator.Expression = {
        SequenceExpression: function (expr, precedence, flags) {
          var result, i, iz;
          if (Precedence.Sequence < precedence) {
            flags |= F_ALLOW_IN;
          }
          result = [];
          for (i = 0, iz = expr.expressions.length; i < iz; ++i) {
            result.push(this.generateExpression(expr.expressions[i], Precedence.Assignment, flags));
            if (i + 1 < iz) {
              result.push(',' + space);
            }
          }
          return parenthesize(result, Precedence.Sequence, precedence);
        },
        AssignmentExpression: function (expr, precedence, flags) {
          return this.generateAssignment(expr.left, expr.right, expr.operator, precedence, flags);
        },
        ArrowFunctionExpression: function (expr, precedence, flags) {
          return parenthesize(this.generateFunctionBody(expr), Precedence.ArrowFunction, precedence);
        },
        ConditionalExpression: function (expr, precedence, flags) {
          if (Precedence.Conditional < precedence) {
            flags |= F_ALLOW_IN;
          }
          return parenthesize([
            this.generateExpression(expr.test, Precedence.LogicalOR, flags),
            space + '?' + space,
            this.generateExpression(expr.consequent, Precedence.Assignment, flags),
            space + ':' + space,
            this.generateExpression(expr.alternate, Precedence.Assignment, flags)
          ], Precedence.Conditional, precedence);
        },
        LogicalExpression: function (expr, precedence, flags) {
          return this.BinaryExpression(expr, precedence, flags);
        },
        BinaryExpression: function (expr, precedence, flags) {
          var result, currentPrecedence, fragment, leftSource;
          currentPrecedence = BinaryPrecedence[expr.operator];
          if (currentPrecedence < precedence) {
            flags |= F_ALLOW_IN;
          }
          fragment = this.generateExpression(expr.left, currentPrecedence, flags);
          leftSource = fragment.toString();
          if (leftSource.charCodeAt(leftSource.length - 1) === 47 && esutils.code.isIdentifierPartES5(expr.operator.charCodeAt(0))) {
            result = [
              fragment,
              noEmptySpace(),
              expr.operator
            ];
          } else {
            result = join(fragment, expr.operator);
          }
          fragment = this.generateExpression(expr.right, currentPrecedence + 1, flags);
          if (expr.operator === '/' && fragment.toString().charAt(0) === '/' || expr.operator.slice(-1) === '<' && fragment.toString().slice(0, 3) === '!--') {
            result.push(noEmptySpace());
            result.push(fragment);
          } else {
            result = join(result, fragment);
          }
          if (expr.operator === 'in' && !(flags & F_ALLOW_IN)) {
            return [
              '(',
              result,
              ')'
            ];
          }
          return parenthesize(result, currentPrecedence, precedence);
        },
        CallExpression: function (expr, precedence, flags) {
          var result, i, iz;
          result = [this.generateExpression(expr.callee, Precedence.Call, E_TTF)];
          result.push('(');
          for (i = 0, iz = expr['arguments'].length; i < iz; ++i) {
            result.push(this.generateExpression(expr['arguments'][i], Precedence.Assignment, E_TTT));
            if (i + 1 < iz) {
              result.push(',' + space);
            }
          }
          result.push(')');
          if (!(flags & F_ALLOW_CALL)) {
            return [
              '(',
              result,
              ')'
            ];
          }
          return parenthesize(result, Precedence.Call, precedence);
        },
        NewExpression: function (expr, precedence, flags) {
          var result, length, i, iz, itemFlags;
          length = expr['arguments'].length;
          itemFlags = flags & F_ALLOW_UNPARATH_NEW && !parentheses && length === 0 ? E_TFT : E_TFF;
          result = join('new', this.generateExpression(expr.callee, Precedence.New, itemFlags));
          if (!(flags & F_ALLOW_UNPARATH_NEW) || parentheses || length > 0) {
            result.push('(');
            for (i = 0, iz = length; i < iz; ++i) {
              result.push(this.generateExpression(expr['arguments'][i], Precedence.Assignment, E_TTT));
              if (i + 1 < iz) {
                result.push(',' + space);
              }
            }
            result.push(')');
          }
          return parenthesize(result, Precedence.New, precedence);
        },
        MemberExpression: function (expr, precedence, flags) {
          var result, fragment;
          result = [this.generateExpression(expr.object, Precedence.Call, flags & F_ALLOW_CALL ? E_TTF : E_TFF)];
          if (expr.computed) {
            result.push('[');
            result.push(this.generateExpression(expr.property, Precedence.Sequence, flags & F_ALLOW_CALL ? E_TTT : E_TFT));
            result.push(']');
          } else {
            if (expr.object.type === Syntax.Literal && typeof expr.object.value === 'number') {
              fragment = toSourceNodeWhenNeeded(result).toString();
              if (fragment.indexOf('.') < 0 && !/[eExX]/.test(fragment) && esutils.code.isDecimalDigit(fragment.charCodeAt(fragment.length - 1)) && !(fragment.length >= 2 && fragment.charCodeAt(0) === 48)) {
                result.push('.');
              }
            }
            result.push('.');
            result.push(generateIdentifier(expr.property));
          }
          return parenthesize(result, Precedence.Member, precedence);
        },
        MetaProperty: function (expr, precedence, flags) {
          var result;
          result = [];
          result.push(expr.meta);
          result.push('.');
          result.push(expr.property);
          return parenthesize(result, Precedence.Member, precedence);
        },
        UnaryExpression: function (expr, precedence, flags) {
          var result, fragment, rightCharCode, leftSource, leftCharCode;
          fragment = this.generateExpression(expr.argument, Precedence.Unary, E_TTT);
          if (space === '') {
            result = join(expr.operator, fragment);
          } else {
            result = [expr.operator];
            if (expr.operator.length > 2) {
              result = join(result, fragment);
            } else {
              leftSource = toSourceNodeWhenNeeded(result).toString();
              leftCharCode = leftSource.charCodeAt(leftSource.length - 1);
              rightCharCode = fragment.toString().charCodeAt(0);
              if ((leftCharCode === 43 || leftCharCode === 45) && leftCharCode === rightCharCode || esutils.code.isIdentifierPartES5(leftCharCode) && esutils.code.isIdentifierPartES5(rightCharCode)) {
                result.push(noEmptySpace());
                result.push(fragment);
              } else {
                result.push(fragment);
              }
            }
          }
          return parenthesize(result, Precedence.Unary, precedence);
        },
        YieldExpression: function (expr, precedence, flags) {
          var result;
          if (expr.delegate) {
            result = 'yield*';
          } else {
            result = 'yield';
          }
          if (expr.argument) {
            result = join(result, this.generateExpression(expr.argument, Precedence.Yield, E_TTT));
          }
          return parenthesize(result, Precedence.Yield, precedence);
        },
        AwaitExpression: function (expr, precedence, flags) {
          var result = join(expr.all ? 'await*' : 'await', this.generateExpression(expr.argument, Precedence.Await, E_TTT));
          return parenthesize(result, Precedence.Await, precedence);
        },
        UpdateExpression: function (expr, precedence, flags) {
          if (expr.prefix) {
            return parenthesize([
              expr.operator,
              this.generateExpression(expr.argument, Precedence.Unary, E_TTT)
            ], Precedence.Unary, precedence);
          }
          return parenthesize([
            this.generateExpression(expr.argument, Precedence.Postfix, E_TTT),
            expr.operator
          ], Precedence.Postfix, precedence);
        },
        FunctionExpression: function (expr, precedence, flags) {
          var result = [
              generateAsyncPrefix(expr, true),
              'function'
            ];
          if (expr.id) {
            result.push(generateStarSuffix(expr) || noEmptySpace());
            result.push(generateIdentifier(expr.id));
          } else {
            result.push(generateStarSuffix(expr) || space);
          }
          result.push(this.generateFunctionBody(expr));
          return result;
        },
        ArrayPattern: function (expr, precedence, flags) {
          return this.ArrayExpression(expr, precedence, flags, true);
        },
        ArrayExpression: function (expr, precedence, flags, isPattern) {
          var result, multiline, that = this;
          if (!expr.elements.length) {
            return '[]';
          }
          multiline = isPattern ? false : expr.elements.length > 1;
          result = [
            '[',
            multiline ? newline : ''
          ];
          withIndent(function (indent) {
            var i, iz;
            for (i = 0, iz = expr.elements.length; i < iz; ++i) {
              if (!expr.elements[i]) {
                if (multiline) {
                  result.push(indent);
                }
                if (i + 1 === iz) {
                  result.push(',');
                }
              } else {
                result.push(multiline ? indent : '');
                result.push(that.generateExpression(expr.elements[i], Precedence.Assignment, E_TTT));
              }
              if (i + 1 < iz) {
                result.push(',' + (multiline ? newline : space));
              }
            }
          });
          if (multiline && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(multiline ? base : '');
          result.push(']');
          return result;
        },
        RestElement: function (expr, precedence, flags) {
          return '...' + this.generatePattern(expr.argument);
        },
        ClassExpression: function (expr, precedence, flags) {
          var result, fragment;
          result = ['class'];
          if (expr.id) {
            result = join(result, this.generateExpression(expr.id, Precedence.Sequence, E_TTT));
          }
          if (expr.superClass) {
            fragment = join('extends', this.generateExpression(expr.superClass, Precedence.Assignment, E_TTT));
            result = join(result, fragment);
          }
          result.push(space);
          result.push(this.generateStatement(expr.body, S_TFFT));
          return result;
        },
        MethodDefinition: function (expr, precedence, flags) {
          var result, fragment;
          if (expr['static']) {
            result = ['static' + space];
          } else {
            result = [];
          }
          if (expr.kind === 'get' || expr.kind === 'set') {
            fragment = [
              join(expr.kind, this.generatePropertyKey(expr.key, expr.computed)),
              this.generateFunctionBody(expr.value)
            ];
          } else {
            fragment = [
              generateMethodPrefix(expr),
              this.generatePropertyKey(expr.key, expr.computed),
              this.generateFunctionBody(expr.value)
            ];
          }
          return join(result, fragment);
        },
        Property: function (expr, precedence, flags) {
          if (expr.kind === 'get' || expr.kind === 'set') {
            return [
              expr.kind,
              noEmptySpace(),
              this.generatePropertyKey(expr.key, expr.computed),
              this.generateFunctionBody(expr.value)
            ];
          }
          if (expr.shorthand) {
            return this.generatePropertyKey(expr.key, expr.computed);
          }
          if (expr.method) {
            return [
              generateMethodPrefix(expr),
              this.generatePropertyKey(expr.key, expr.computed),
              this.generateFunctionBody(expr.value)
            ];
          }
          return [
            this.generatePropertyKey(expr.key, expr.computed),
            ':' + space,
            this.generateExpression(expr.value, Precedence.Assignment, E_TTT)
          ];
        },
        ObjectExpression: function (expr, precedence, flags) {
          var multiline, result, fragment, that = this;
          if (!expr.properties.length) {
            return '{}';
          }
          multiline = expr.properties.length > 1;
          withIndent(function () {
            fragment = that.generateExpression(expr.properties[0], Precedence.Sequence, E_TTT);
          });
          if (!multiline) {
            if (!hasLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
              return [
                '{',
                space,
                fragment,
                space,
                '}'
              ];
            }
          }
          withIndent(function (indent) {
            var i, iz;
            result = [
              '{',
              newline,
              indent,
              fragment
            ];
            if (multiline) {
              result.push(',' + newline);
              for (i = 1, iz = expr.properties.length; i < iz; ++i) {
                result.push(indent);
                result.push(that.generateExpression(expr.properties[i], Precedence.Sequence, E_TTT));
                if (i + 1 < iz) {
                  result.push(',' + newline);
                }
              }
            }
          });
          if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(base);
          result.push('}');
          return result;
        },
        AssignmentPattern: function (expr, precedence, flags) {
          return this.generateAssignment(expr.left, expr.right, expr.operator, precedence, flags);
        },
        ObjectPattern: function (expr, precedence, flags) {
          var result, i, iz, multiline, property, that = this;
          if (!expr.properties.length) {
            return '{}';
          }
          multiline = false;
          if (expr.properties.length === 1) {
            property = expr.properties[0];
            if (property.value.type !== Syntax.Identifier) {
              multiline = true;
            }
          } else {
            for (i = 0, iz = expr.properties.length; i < iz; ++i) {
              property = expr.properties[i];
              if (!property.shorthand) {
                multiline = true;
                break;
              }
            }
          }
          result = [
            '{',
            multiline ? newline : ''
          ];
          withIndent(function (indent) {
            var i, iz;
            for (i = 0, iz = expr.properties.length; i < iz; ++i) {
              result.push(multiline ? indent : '');
              result.push(that.generateExpression(expr.properties[i], Precedence.Sequence, E_TTT));
              if (i + 1 < iz) {
                result.push(',' + (multiline ? newline : space));
              }
            }
          });
          if (multiline && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(multiline ? base : '');
          result.push('}');
          return result;
        },
        ThisExpression: function (expr, precedence, flags) {
          return 'this';
        },
        Super: function (expr, precedence, flags) {
          return 'super';
        },
        Identifier: function (expr, precedence, flags) {
          return generateIdentifier(expr);
        },
        ImportDefaultSpecifier: function (expr, precedence, flags) {
          return generateIdentifier(expr.id || expr.local);
        },
        ImportNamespaceSpecifier: function (expr, precedence, flags) {
          var result = ['*'];
          var id = expr.id || expr.local;
          if (id) {
            result.push(space + 'as' + noEmptySpace() + generateIdentifier(id));
          }
          return result;
        },
        ImportSpecifier: function (expr, precedence, flags) {
          var imported = expr.imported;
          var result = [imported.name];
          var local = expr.local;
          if (local && local.name !== imported.name) {
            result.push(noEmptySpace() + 'as' + noEmptySpace() + generateIdentifier(local));
          }
          return result;
        },
        ExportSpecifier: function (expr, precedence, flags) {
          var local = expr.local;
          var result = [local.name];
          var exported = expr.exported;
          if (exported && exported.name !== local.name) {
            result.push(noEmptySpace() + 'as' + noEmptySpace() + generateIdentifier(exported));
          }
          return result;
        },
        Literal: function (expr, precedence, flags) {
          var raw;
          if (expr.hasOwnProperty('raw') && parse && extra.raw) {
            try {
              raw = parse(expr.raw).body[0].expression;
              if (raw.type === Syntax.Literal) {
                if (raw.value === expr.value) {
                  return expr.raw;
                }
              }
            } catch (e) {
            }
          }
          if (expr.value === null) {
            return 'null';
          }
          if (typeof expr.value === 'string') {
            return escapeString(expr.value);
          }
          if (typeof expr.value === 'number') {
            return generateNumber(expr.value);
          }
          if (typeof expr.value === 'boolean') {
            return expr.value ? 'true' : 'false';
          }
          return generateRegExp(expr.value);
        },
        GeneratorExpression: function (expr, precedence, flags) {
          return this.ComprehensionExpression(expr, precedence, flags);
        },
        ComprehensionExpression: function (expr, precedence, flags) {
          var result, i, iz, fragment, that = this;
          result = expr.type === Syntax.GeneratorExpression ? ['('] : ['['];
          if (extra.moz.comprehensionExpressionStartsWithAssignment) {
            fragment = this.generateExpression(expr.body, Precedence.Assignment, E_TTT);
            result.push(fragment);
          }
          if (expr.blocks) {
            withIndent(function () {
              for (i = 0, iz = expr.blocks.length; i < iz; ++i) {
                fragment = that.generateExpression(expr.blocks[i], Precedence.Sequence, E_TTT);
                if (i > 0 || extra.moz.comprehensionExpressionStartsWithAssignment) {
                  result = join(result, fragment);
                } else {
                  result.push(fragment);
                }
              }
            });
          }
          if (expr.filter) {
            result = join(result, 'if' + space);
            fragment = this.generateExpression(expr.filter, Precedence.Sequence, E_TTT);
            result = join(result, [
              '(',
              fragment,
              ')'
            ]);
          }
          if (!extra.moz.comprehensionExpressionStartsWithAssignment) {
            fragment = this.generateExpression(expr.body, Precedence.Assignment, E_TTT);
            result = join(result, fragment);
          }
          result.push(expr.type === Syntax.GeneratorExpression ? ')' : ']');
          return result;
        },
        ComprehensionBlock: function (expr, precedence, flags) {
          var fragment;
          if (expr.left.type === Syntax.VariableDeclaration) {
            fragment = [
              expr.left.kind,
              noEmptySpace(),
              this.generateStatement(expr.left.declarations[0], S_FFFF)
            ];
          } else {
            fragment = this.generateExpression(expr.left, Precedence.Call, E_TTT);
          }
          fragment = join(fragment, expr.of ? 'of' : 'in');
          fragment = join(fragment, this.generateExpression(expr.right, Precedence.Sequence, E_TTT));
          return [
            'for' + space + '(',
            fragment,
            ')'
          ];
        },
        SpreadElement: function (expr, precedence, flags) {
          return [
            '...',
            this.generateExpression(expr.argument, Precedence.Assignment, E_TTT)
          ];
        },
        TaggedTemplateExpression: function (expr, precedence, flags) {
          var itemFlags = E_TTF;
          if (!(flags & F_ALLOW_CALL)) {
            itemFlags = E_TFF;
          }
          var result = [
              this.generateExpression(expr.tag, Precedence.Call, itemFlags),
              this.generateExpression(expr.quasi, Precedence.Primary, E_FFT)
            ];
          return parenthesize(result, Precedence.TaggedTemplate, precedence);
        },
        TemplateElement: function (expr, precedence, flags) {
          return expr.value.raw;
        },
        TemplateLiteral: function (expr, precedence, flags) {
          var result, i, iz;
          result = ['`'];
          for (i = 0, iz = expr.quasis.length; i < iz; ++i) {
            result.push(this.generateExpression(expr.quasis[i], Precedence.Primary, E_TTT));
            if (i + 1 < iz) {
              result.push('${' + space);
              result.push(this.generateExpression(expr.expressions[i], Precedence.Sequence, E_TTT));
              result.push(space + '}');
            }
          }
          result.push('`');
          return result;
        },
        ModuleSpecifier: function (expr, precedence, flags) {
          return this.Literal(expr, precedence, flags);
        }
      };
      merge(CodeGenerator.prototype, CodeGenerator.Expression);
      CodeGenerator.prototype.generateExpression = function (expr, precedence, flags) {
        var result, type;
        type = expr.type || Syntax.Property;
        if (extra.verbatim && expr.hasOwnProperty(extra.verbatim)) {
          return generateVerbatim(expr, precedence);
        }
        result = this[type](expr, precedence, flags);
        if (extra.comment) {
          result = addComments(expr, result);
        }
        return toSourceNodeWhenNeeded(result, expr);
      };
      CodeGenerator.prototype.generateStatement = function (stmt, flags) {
        var result, fragment;
        result = this[stmt.type](stmt, flags);
        if (extra.comment) {
          result = addComments(stmt, result);
        }
        fragment = toSourceNodeWhenNeeded(result).toString();
        if (stmt.type === Syntax.Program && !safeConcatenation && newline === '' && fragment.charAt(fragment.length - 1) === '\n') {
          result = sourceMap ? toSourceNodeWhenNeeded(result).replaceRight(/\s+$/, '') : fragment.replace(/\s+$/, '');
        }
        return toSourceNodeWhenNeeded(result, stmt);
      };
      function generateInternal(node) {
        var codegen;
        codegen = new CodeGenerator;
        if (isStatement(node)) {
          return codegen.generateStatement(node, S_TFFF);
        }
        if (isExpression(node)) {
          return codegen.generateExpression(node, Precedence.Sequence, E_TTT);
        }
        throw new Error('Unknown node type: ' + node.type);
      }
      function generate(node, options) {
        var defaultOptions = getDefaultOptions(), result, pair;
        if (options != null) {
          if (typeof options.indent === 'string') {
            defaultOptions.format.indent.style = options.indent;
          }
          if (typeof options.base === 'number') {
            defaultOptions.format.indent.base = options.base;
          }
          options = updateDeeply(defaultOptions, options);
          indent = options.format.indent.style;
          if (typeof options.base === 'string') {
            base = options.base;
          } else {
            base = stringRepeat(indent, options.format.indent.base);
          }
        } else {
          options = defaultOptions;
          indent = options.format.indent.style;
          base = stringRepeat(indent, options.format.indent.base);
        }
        json = options.format.json;
        renumber = options.format.renumber;
        hexadecimal = json ? false : options.format.hexadecimal;
        quotes = json ? 'double' : options.format.quotes;
        escapeless = options.format.escapeless;
        newline = options.format.newline;
        space = options.format.space;
        if (options.format.compact) {
          newline = space = indent = base = '';
        }
        parentheses = options.format.parentheses;
        semicolons = options.format.semicolons;
        safeConcatenation = options.format.safeConcatenation;
        directive = options.directive;
        parse = json ? null : options.parse;
        sourceMap = options.sourceMap;
        sourceCode = options.sourceCode;
        preserveBlankLines = options.format.preserveBlankLines && sourceCode !== null;
        extra = options;
        if (sourceMap) {
          if (!exports.browser) {
            SourceNode = require('/node_modules/source-map/lib/source-map.js', module).SourceNode;
          } else {
            SourceNode = global.sourceMap.SourceNode;
          }
        }
        result = generateInternal(node);
        if (!sourceMap) {
          pair = {
            code: result.toString(),
            map: null
          };
          return options.sourceMapWithCode ? pair : pair.code;
        }
        pair = result.toStringWithSourceMap({
          file: options.file,
          sourceRoot: options.sourceMapRoot
        });
        if (options.sourceContent) {
          pair.map.setSourceContent(options.sourceMap, options.sourceContent);
        }
        if (options.sourceMapWithCode) {
          return pair;
        }
        return pair.map.toString();
      }
      FORMAT_MINIFY = {
        indent: {
          style: '',
          base: 0
        },
        renumber: true,
        hexadecimal: true,
        quotes: 'auto',
        escapeless: true,
        compact: true,
        parentheses: false,
        semicolons: false
      };
      FORMAT_DEFAULTS = getDefaultOptions().format;
      exports.version = require('/package.json', module).version;
      exports.generate = generate;
      exports.attachComments = estraverse.attachComments;
      exports.Precedence = updateDeeply({}, Precedence);
      exports.browser = false;
      exports.FORMAT_MINIFY = FORMAT_MINIFY;
      exports.FORMAT_DEFAULTS = FORMAT_DEFAULTS;
    }());
  });
  require.define('/package.json', function (module, exports, __dirname, __filename) {
    module.exports = {
      'name': 'escodegen',
      'description': 'ECMAScript code generator',
      'homepage': 'http://github.com/estools/escodegen',
      'main': 'escodegen.js',
      'bin': {
        'esgenerate': './bin/esgenerate.js',
        'escodegen': './bin/escodegen.js'
      },
      'files': [
        'LICENSE.BSD',
        'LICENSE.source-map',
        'README.md',
        'bin',
        'escodegen.js',
        'package.json'
      ],
      'version': '1.8.0',
      'engines': { 'node': '>=0.12.0' },
      'maintainers': [{
          'name': 'Yusuke Suzuki',
          'email': 'utatane.tea@gmail.com',
          'web': 'http://github.com/Constellation'
        }],
      'repository': {
        'type': 'git',
        'url': 'http://github.com/estools/escodegen.git'
      },
      'dependencies': {
        'estraverse': '^1.9.1',
        'esutils': '^2.0.2',
        'esprima': '^2.7.1',
        'optionator': '^0.8.1'
      },
      'optionalDependencies': { 'source-map': '~0.2.0' },
      'devDependencies': {
        'acorn-6to5': '^0.11.1-25',
        'bluebird': '^2.3.11',
        'bower-registry-client': '^0.2.1',
        'chai': '^1.10.0',
        'commonjs-everywhere': '^0.9.7',
        'gulp': '^3.8.10',
        'gulp-eslint': '^0.2.0',
        'gulp-mocha': '^2.0.0',
        'semver': '^5.1.0'
      },
      'license': 'BSD-2-Clause',
      'scripts': {
        'test': 'gulp travis',
        'unit-test': 'gulp test',
        'lint': 'gulp lint',
        'release': 'node tools/release.js',
        'build-min': './node_modules/.bin/cjsify -ma path: tools/entry-point.js > escodegen.browser.min.js',
        'build': './node_modules/.bin/cjsify -a path: tools/entry-point.js > escodegen.browser.js'
      }
    };
  });
  require.define('/node_modules/source-map/lib/source-map.js', function (module, exports, __dirname, __filename) {
    exports.SourceMapGenerator = require('/node_modules/source-map/lib/source-map/source-map-generator.js', module).SourceMapGenerator;
    exports.SourceMapConsumer = require('/node_modules/source-map/lib/source-map/source-map-consumer.js', module).SourceMapConsumer;
    exports.SourceNode = require('/node_modules/source-map/lib/source-map/source-node.js', module).SourceNode;
  });
  require.define('/node_modules/source-map/lib/source-map/source-node.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var SourceMapGenerator = require('/node_modules/source-map/lib/source-map/source-map-generator.js', module).SourceMapGenerator;
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      var REGEX_NEWLINE = /(\r?\n)/;
      var NEWLINE_CODE = 10;
      var isSourceNode = '$$$isSourceNode$$$';
      function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
        this.children = [];
        this.sourceContents = {};
        this.line = aLine == null ? null : aLine;
        this.column = aColumn == null ? null : aColumn;
        this.source = aSource == null ? null : aSource;
        this.name = aName == null ? null : aName;
        this[isSourceNode] = true;
        if (aChunks != null)
          this.add(aChunks);
      }
      SourceNode.fromStringWithSourceMap = function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
        var node = new SourceNode;
        var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
        var shiftNextLine = function () {
          var lineContents = remainingLines.shift();
          var newLine = remainingLines.shift() || '';
          return lineContents + newLine;
        };
        var lastGeneratedLine = 1, lastGeneratedColumn = 0;
        var lastMapping = null;
        aSourceMapConsumer.eachMapping(function (mapping) {
          if (lastMapping !== null) {
            if (lastGeneratedLine < mapping.generatedLine) {
              var code = '';
              addMappingWithCode(lastMapping, shiftNextLine());
              lastGeneratedLine++;
              lastGeneratedColumn = 0;
            } else {
              var nextLine = remainingLines[0];
              var code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
              remainingLines[0] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
              lastGeneratedColumn = mapping.generatedColumn;
              addMappingWithCode(lastMapping, code);
              lastMapping = mapping;
              return;
            }
          }
          while (lastGeneratedLine < mapping.generatedLine) {
            node.add(shiftNextLine());
            lastGeneratedLine++;
          }
          if (lastGeneratedColumn < mapping.generatedColumn) {
            var nextLine = remainingLines[0];
            node.add(nextLine.substr(0, mapping.generatedColumn));
            remainingLines[0] = nextLine.substr(mapping.generatedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
          }
          lastMapping = mapping;
        }, this);
        if (remainingLines.length > 0) {
          if (lastMapping) {
            addMappingWithCode(lastMapping, shiftNextLine());
          }
          node.add(remainingLines.join(''));
        }
        aSourceMapConsumer.sources.forEach(function (sourceFile) {
          var content = aSourceMapConsumer.sourceContentFor(sourceFile);
          if (content != null) {
            if (aRelativePath != null) {
              sourceFile = util.join(aRelativePath, sourceFile);
            }
            node.setSourceContent(sourceFile, content);
          }
        });
        return node;
        function addMappingWithCode(mapping, code) {
          if (mapping === null || mapping.source === undefined) {
            node.add(code);
          } else {
            var source = aRelativePath ? util.join(aRelativePath, mapping.source) : mapping.source;
            node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, source, code, mapping.name));
          }
        }
      };
      SourceNode.prototype.add = function SourceNode_add(aChunk) {
        if (Array.isArray(aChunk)) {
          aChunk.forEach(function (chunk) {
            this.add(chunk);
          }, this);
        } else if (aChunk[isSourceNode] || typeof aChunk === 'string') {
          if (aChunk) {
            this.children.push(aChunk);
          }
        } else {
          throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got ' + aChunk);
        }
        return this;
      };
      SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
        if (Array.isArray(aChunk)) {
          for (var i = aChunk.length - 1; i >= 0; i--) {
            this.prepend(aChunk[i]);
          }
        } else if (aChunk[isSourceNode] || typeof aChunk === 'string') {
          this.children.unshift(aChunk);
        } else {
          throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got ' + aChunk);
        }
        return this;
      };
      SourceNode.prototype.walk = function SourceNode_walk(aFn) {
        var chunk;
        for (var i = 0, len = this.children.length; i < len; i++) {
          chunk = this.children[i];
          if (chunk[isSourceNode]) {
            chunk.walk(aFn);
          } else {
            if (chunk !== '') {
              aFn(chunk, {
                source: this.source,
                line: this.line,
                column: this.column,
                name: this.name
              });
            }
          }
        }
      };
      SourceNode.prototype.join = function SourceNode_join(aSep) {
        var newChildren;
        var i;
        var len = this.children.length;
        if (len > 0) {
          newChildren = [];
          for (i = 0; i < len - 1; i++) {
            newChildren.push(this.children[i]);
            newChildren.push(aSep);
          }
          newChildren.push(this.children[i]);
          this.children = newChildren;
        }
        return this;
      };
      SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
        var lastChild = this.children[this.children.length - 1];
        if (lastChild[isSourceNode]) {
          lastChild.replaceRight(aPattern, aReplacement);
        } else if (typeof lastChild === 'string') {
          this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
        } else {
          this.children.push(''.replace(aPattern, aReplacement));
        }
        return this;
      };
      SourceNode.prototype.setSourceContent = function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
        this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
      };
      SourceNode.prototype.walkSourceContents = function SourceNode_walkSourceContents(aFn) {
        for (var i = 0, len = this.children.length; i < len; i++) {
          if (this.children[i][isSourceNode]) {
            this.children[i].walkSourceContents(aFn);
          }
        }
        var sources = Object.keys(this.sourceContents);
        for (var i = 0, len = sources.length; i < len; i++) {
          aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
        }
      };
      SourceNode.prototype.toString = function SourceNode_toString() {
        var str = '';
        this.walk(function (chunk) {
          str += chunk;
        });
        return str;
      };
      SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
        var generated = {
            code: '',
            line: 1,
            column: 0
          };
        var map = new SourceMapGenerator(aArgs);
        var sourceMappingActive = false;
        var lastOriginalSource = null;
        var lastOriginalLine = null;
        var lastOriginalColumn = null;
        var lastOriginalName = null;
        this.walk(function (chunk, original) {
          generated.code += chunk;
          if (original.source !== null && original.line !== null && original.column !== null) {
            if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) {
              map.addMapping({
                source: original.source,
                original: {
                  line: original.line,
                  column: original.column
                },
                generated: {
                  line: generated.line,
                  column: generated.column
                },
                name: original.name
              });
            }
            lastOriginalSource = original.source;
            lastOriginalLine = original.line;
            lastOriginalColumn = original.column;
            lastOriginalName = original.name;
            sourceMappingActive = true;
          } else if (sourceMappingActive) {
            map.addMapping({
              generated: {
                line: generated.line,
                column: generated.column
              }
            });
            lastOriginalSource = null;
            sourceMappingActive = false;
          }
          for (var idx = 0, length = chunk.length; idx < length; idx++) {
            if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
              generated.line++;
              generated.column = 0;
              if (idx + 1 === length) {
                lastOriginalSource = null;
                sourceMappingActive = false;
              } else if (sourceMappingActive) {
                map.addMapping({
                  source: original.source,
                  original: {
                    line: original.line,
                    column: original.column
                  },
                  generated: {
                    line: generated.line,
                    column: generated.column
                  },
                  name: original.name
                });
              }
            } else {
              generated.column++;
            }
          }
        });
        this.walkSourceContents(function (sourceFile, sourceContent) {
          map.setSourceContent(sourceFile, sourceContent);
        });
        return {
          code: generated.code,
          map: map
        };
      };
      exports.SourceNode = SourceNode;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/util.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      function getArg(aArgs, aName, aDefaultValue) {
        if (aName in aArgs) {
          return aArgs[aName];
        } else if (arguments.length === 3) {
          return aDefaultValue;
        } else {
          throw new Error('"' + aName + '" is a required argument.');
        }
      }
      exports.getArg = getArg;
      var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
      var dataUrlRegexp = /^data:.+\,.+$/;
      function urlParse(aUrl) {
        var match = aUrl.match(urlRegexp);
        if (!match) {
          return null;
        }
        return {
          scheme: match[1],
          auth: match[2],
          host: match[3],
          port: match[4],
          path: match[5]
        };
      }
      exports.urlParse = urlParse;
      function urlGenerate(aParsedUrl) {
        var url = '';
        if (aParsedUrl.scheme) {
          url += aParsedUrl.scheme + ':';
        }
        url += '//';
        if (aParsedUrl.auth) {
          url += aParsedUrl.auth + '@';
        }
        if (aParsedUrl.host) {
          url += aParsedUrl.host;
        }
        if (aParsedUrl.port) {
          url += ':' + aParsedUrl.port;
        }
        if (aParsedUrl.path) {
          url += aParsedUrl.path;
        }
        return url;
      }
      exports.urlGenerate = urlGenerate;
      function normalize(aPath) {
        var path = aPath;
        var url = urlParse(aPath);
        if (url) {
          if (!url.path) {
            return aPath;
          }
          path = url.path;
        }
        var isAbsolute = path.charAt(0) === '/';
        var parts = path.split(/\/+/);
        for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
          part = parts[i];
          if (part === '.') {
            parts.splice(i, 1);
          } else if (part === '..') {
            up++;
          } else if (up > 0) {
            if (part === '') {
              parts.splice(i + 1, up);
              up = 0;
            } else {
              parts.splice(i, 2);
              up--;
            }
          }
        }
        path = parts.join('/');
        if (path === '') {
          path = isAbsolute ? '/' : '.';
        }
        if (url) {
          url.path = path;
          return urlGenerate(url);
        }
        return path;
      }
      exports.normalize = normalize;
      function join(aRoot, aPath) {
        if (aRoot === '') {
          aRoot = '.';
        }
        if (aPath === '') {
          aPath = '.';
        }
        var aPathUrl = urlParse(aPath);
        var aRootUrl = urlParse(aRoot);
        if (aRootUrl) {
          aRoot = aRootUrl.path || '/';
        }
        if (aPathUrl && !aPathUrl.scheme) {
          if (aRootUrl) {
            aPathUrl.scheme = aRootUrl.scheme;
          }
          return urlGenerate(aPathUrl);
        }
        if (aPathUrl || aPath.match(dataUrlRegexp)) {
          return aPath;
        }
        if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
          aRootUrl.host = aPath;
          return urlGenerate(aRootUrl);
        }
        var joined = aPath.charAt(0) === '/' ? aPath : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);
        if (aRootUrl) {
          aRootUrl.path = joined;
          return urlGenerate(aRootUrl);
        }
        return joined;
      }
      exports.join = join;
      function relative(aRoot, aPath) {
        if (aRoot === '') {
          aRoot = '.';
        }
        aRoot = aRoot.replace(/\/$/, '');
        var url = urlParse(aRoot);
        if (aPath.charAt(0) == '/' && url && url.path == '/') {
          return aPath.slice(1);
        }
        return aPath.indexOf(aRoot + '/') === 0 ? aPath.substr(aRoot.length + 1) : aPath;
      }
      exports.relative = relative;
      function toSetString(aStr) {
        return '$' + aStr;
      }
      exports.toSetString = toSetString;
      function fromSetString(aStr) {
        return aStr.substr(1);
      }
      exports.fromSetString = fromSetString;
      function strcmp(aStr1, aStr2) {
        var s1 = aStr1 || '';
        var s2 = aStr2 || '';
        return (s1 > s2) - (s1 < s2);
      }
      function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
        var cmp;
        cmp = strcmp(mappingA.source, mappingB.source);
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.originalLine - mappingB.originalLine;
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.originalColumn - mappingB.originalColumn;
        if (cmp || onlyCompareOriginal) {
          return cmp;
        }
        cmp = strcmp(mappingA.name, mappingB.name);
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.generatedLine - mappingB.generatedLine;
        if (cmp) {
          return cmp;
        }
        return mappingA.generatedColumn - mappingB.generatedColumn;
      }
      ;
      exports.compareByOriginalPositions = compareByOriginalPositions;
      function compareByGeneratedPositions(mappingA, mappingB, onlyCompareGenerated) {
        var cmp;
        cmp = mappingA.generatedLine - mappingB.generatedLine;
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.generatedColumn - mappingB.generatedColumn;
        if (cmp || onlyCompareGenerated) {
          return cmp;
        }
        cmp = strcmp(mappingA.source, mappingB.source);
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.originalLine - mappingB.originalLine;
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.originalColumn - mappingB.originalColumn;
        if (cmp) {
          return cmp;
        }
        return strcmp(mappingA.name, mappingB.name);
      }
      ;
      exports.compareByGeneratedPositions = compareByGeneratedPositions;
    });
  });
  require.define('/node_modules/source-map/node_modules/amdefine/amdefine.js', function (module, exports, __dirname, __filename) {
    'use strict';
    function amdefine(module, requireFn) {
      'use strict';
      var defineCache = {}, loaderCache = {}, alreadyCalled = false, path = require('path', module), makeRequire, stringRequire;
      function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i += 1) {
          part = ary[i];
          if (part === '.') {
            ary.splice(i, 1);
            i -= 1;
          } else if (part === '..') {
            if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
              break;
            } else if (i > 0) {
              ary.splice(i - 1, 2);
              i -= 2;
            }
          }
        }
      }
      function normalize(name, baseName) {
        var baseParts;
        if (name && name.charAt(0) === '.') {
          if (baseName) {
            baseParts = baseName.split('/');
            baseParts = baseParts.slice(0, baseParts.length - 1);
            baseParts = baseParts.concat(name.split('/'));
            trimDots(baseParts);
            name = baseParts.join('/');
          }
        }
        return name;
      }
      function makeNormalize(relName) {
        return function (name) {
          return normalize(name, relName);
        };
      }
      function makeLoad(id) {
        function load(value) {
          loaderCache[id] = value;
        }
        load.fromText = function (id, text) {
          throw new Error('amdefine does not implement load.fromText');
        };
        return load;
      }
      makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
          if (typeof deps === 'string') {
            return stringRequire(systemRequire, exports, module, deps, relId);
          } else {
            deps = deps.map(function (depName) {
              return stringRequire(systemRequire, exports, module, depName, relId);
            });
            if (callback) {
              process.nextTick(function () {
                callback.apply(null, deps);
              });
            }
          }
        }
        amdRequire.toUrl = function (filePath) {
          if (filePath.indexOf('.') === 0) {
            return normalize(filePath, path.dirname(module.filename));
          } else {
            return filePath;
          }
        };
        return amdRequire;
      };
      requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
      };
      function runFactory(id, deps, factory) {
        var r, e, m, result;
        if (id) {
          e = loaderCache[id] = {};
          m = {
            id: id,
            uri: __filename,
            exports: e
          };
          r = makeRequire(requireFn, e, m, id);
        } else {
          if (alreadyCalled) {
            throw new Error('amdefine with no module ID cannot be called more than once per file.');
          }
          alreadyCalled = true;
          e = module.exports;
          m = module;
          r = makeRequire(requireFn, e, m, module.id);
        }
        if (deps) {
          deps = deps.map(function (depName) {
            return r(depName);
          });
        }
        if (typeof factory === 'function') {
          result = factory.apply(m.exports, deps);
        } else {
          result = factory;
        }
        if (result !== undefined) {
          m.exports = result;
          if (id) {
            loaderCache[id] = m.exports;
          }
        }
      }
      stringRequire = function (systemRequire, exports, module, id, relId) {
        var index = id.indexOf('!'), originalId = id, prefix, plugin;
        if (index === -1) {
          id = normalize(id, relId);
          if (id === 'require') {
            return makeRequire(systemRequire, exports, module, relId);
          } else if (id === 'exports') {
            return exports;
          } else if (id === 'module') {
            return module;
          } else if (loaderCache.hasOwnProperty(id)) {
            return loaderCache[id];
          } else if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
          } else {
            if (systemRequire) {
              return systemRequire(originalId);
            } else {
              throw new Error('No module with ID: ' + id);
            }
          }
        } else {
          prefix = id.substring(0, index);
          id = id.substring(index + 1, id.length);
          plugin = stringRequire(systemRequire, exports, module, prefix, relId);
          if (plugin.normalize) {
            id = plugin.normalize(id, makeNormalize(relId));
          } else {
            id = normalize(id, relId);
          }
          if (loaderCache[id]) {
            return loaderCache[id];
          } else {
            plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});
            return loaderCache[id];
          }
        }
      };
      function define(id, deps, factory) {
        if (Array.isArray(id)) {
          factory = deps;
          deps = id;
          id = undefined;
        } else if (typeof id !== 'string') {
          factory = id;
          id = deps = undefined;
        }
        if (deps && !Array.isArray(deps)) {
          factory = deps;
          deps = undefined;
        }
        if (!deps) {
          deps = [
            'require',
            'exports',
            'module'
          ];
        }
        if (id) {
          defineCache[id] = [
            id,
            deps,
            factory
          ];
        } else {
          runFactory(id, deps, factory);
        }
      }
      define.require = function (id) {
        if (loaderCache[id]) {
          return loaderCache[id];
        }
        if (defineCache[id]) {
          runFactory.apply(null, defineCache[id]);
          return loaderCache[id];
        }
      };
      define.amd = {};
      return define;
    }
    module.exports = amdefine;
  });
  require.define('/node_modules/source-map/lib/source-map/source-map-generator.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var base64VLQ = require('/node_modules/source-map/lib/source-map/base64-vlq.js', module);
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      var ArraySet = require('/node_modules/source-map/lib/source-map/array-set.js', module).ArraySet;
      var MappingList = require('/node_modules/source-map/lib/source-map/mapping-list.js', module).MappingList;
      function SourceMapGenerator(aArgs) {
        if (!aArgs) {
          aArgs = {};
        }
        this._file = util.getArg(aArgs, 'file', null);
        this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
        this._skipValidation = util.getArg(aArgs, 'skipValidation', false);
        this._sources = new ArraySet;
        this._names = new ArraySet;
        this._mappings = new MappingList;
        this._sourcesContents = null;
      }
      SourceMapGenerator.prototype._version = 3;
      SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
        var sourceRoot = aSourceMapConsumer.sourceRoot;
        var generator = new SourceMapGenerator({
            file: aSourceMapConsumer.file,
            sourceRoot: sourceRoot
          });
        aSourceMapConsumer.eachMapping(function (mapping) {
          var newMapping = {
              generated: {
                line: mapping.generatedLine,
                column: mapping.generatedColumn
              }
            };
          if (mapping.source != null) {
            newMapping.source = mapping.source;
            if (sourceRoot != null) {
              newMapping.source = util.relative(sourceRoot, newMapping.source);
            }
            newMapping.original = {
              line: mapping.originalLine,
              column: mapping.originalColumn
            };
            if (mapping.name != null) {
              newMapping.name = mapping.name;
            }
          }
          generator.addMapping(newMapping);
        });
        aSourceMapConsumer.sources.forEach(function (sourceFile) {
          var content = aSourceMapConsumer.sourceContentFor(sourceFile);
          if (content != null) {
            generator.setSourceContent(sourceFile, content);
          }
        });
        return generator;
      };
      SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
        var generated = util.getArg(aArgs, 'generated');
        var original = util.getArg(aArgs, 'original', null);
        var source = util.getArg(aArgs, 'source', null);
        var name = util.getArg(aArgs, 'name', null);
        if (!this._skipValidation) {
          this._validateMapping(generated, original, source, name);
        }
        if (source != null && !this._sources.has(source)) {
          this._sources.add(source);
        }
        if (name != null && !this._names.has(name)) {
          this._names.add(name);
        }
        this._mappings.add({
          generatedLine: generated.line,
          generatedColumn: generated.column,
          originalLine: original != null && original.line,
          originalColumn: original != null && original.column,
          source: source,
          name: name
        });
      };
      SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
        var source = aSourceFile;
        if (this._sourceRoot != null) {
          source = util.relative(this._sourceRoot, source);
        }
        if (aSourceContent != null) {
          if (!this._sourcesContents) {
            this._sourcesContents = {};
          }
          this._sourcesContents[util.toSetString(source)] = aSourceContent;
        } else if (this._sourcesContents) {
          delete this._sourcesContents[util.toSetString(source)];
          if (Object.keys(this._sourcesContents).length === 0) {
            this._sourcesContents = null;
          }
        }
      };
      SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
        var sourceFile = aSourceFile;
        if (aSourceFile == null) {
          if (aSourceMapConsumer.file == null) {
            throw new Error('SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' + 'or the source map\'s "file" property. Both were omitted.');
          }
          sourceFile = aSourceMapConsumer.file;
        }
        var sourceRoot = this._sourceRoot;
        if (sourceRoot != null) {
          sourceFile = util.relative(sourceRoot, sourceFile);
        }
        var newSources = new ArraySet;
        var newNames = new ArraySet;
        this._mappings.unsortedForEach(function (mapping) {
          if (mapping.source === sourceFile && mapping.originalLine != null) {
            var original = aSourceMapConsumer.originalPositionFor({
                line: mapping.originalLine,
                column: mapping.originalColumn
              });
            if (original.source != null) {
              mapping.source = original.source;
              if (aSourceMapPath != null) {
                mapping.source = util.join(aSourceMapPath, mapping.source);
              }
              if (sourceRoot != null) {
                mapping.source = util.relative(sourceRoot, mapping.source);
              }
              mapping.originalLine = original.line;
              mapping.originalColumn = original.column;
              if (original.name != null) {
                mapping.name = original.name;
              }
            }
          }
          var source = mapping.source;
          if (source != null && !newSources.has(source)) {
            newSources.add(source);
          }
          var name = mapping.name;
          if (name != null && !newNames.has(name)) {
            newNames.add(name);
          }
        }, this);
        this._sources = newSources;
        this._names = newNames;
        aSourceMapConsumer.sources.forEach(function (sourceFile) {
          var content = aSourceMapConsumer.sourceContentFor(sourceFile);
          if (content != null) {
            if (aSourceMapPath != null) {
              sourceFile = util.join(aSourceMapPath, sourceFile);
            }
            if (sourceRoot != null) {
              sourceFile = util.relative(sourceRoot, sourceFile);
            }
            this.setSourceContent(sourceFile, content);
          }
        }, this);
      };
      SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
        if (aGenerated && 'line' in aGenerated && 'column' in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
          return;
        } else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated && aOriginal && 'line' in aOriginal && 'column' in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
          return;
        } else {
          throw new Error('Invalid mapping: ' + JSON.stringify({
            generated: aGenerated,
            source: aSource,
            original: aOriginal,
            name: aName
          }));
        }
      };
      SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
        var previousGeneratedColumn = 0;
        var previousGeneratedLine = 1;
        var previousOriginalColumn = 0;
        var previousOriginalLine = 0;
        var previousName = 0;
        var previousSource = 0;
        var result = '';
        var mapping;
        var mappings = this._mappings.toArray();
        for (var i = 0, len = mappings.length; i < len; i++) {
          mapping = mappings[i];
          if (mapping.generatedLine !== previousGeneratedLine) {
            previousGeneratedColumn = 0;
            while (mapping.generatedLine !== previousGeneratedLine) {
              result += ';';
              previousGeneratedLine++;
            }
          } else {
            if (i > 0) {
              if (!util.compareByGeneratedPositions(mapping, mappings[i - 1])) {
                continue;
              }
              result += ',';
            }
          }
          result += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
          previousGeneratedColumn = mapping.generatedColumn;
          if (mapping.source != null) {
            result += base64VLQ.encode(this._sources.indexOf(mapping.source) - previousSource);
            previousSource = this._sources.indexOf(mapping.source);
            result += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
            previousOriginalLine = mapping.originalLine - 1;
            result += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
            previousOriginalColumn = mapping.originalColumn;
            if (mapping.name != null) {
              result += base64VLQ.encode(this._names.indexOf(mapping.name) - previousName);
              previousName = this._names.indexOf(mapping.name);
            }
          }
        }
        return result;
      };
      SourceMapGenerator.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
        return aSources.map(function (source) {
          if (!this._sourcesContents) {
            return null;
          }
          if (aSourceRoot != null) {
            source = util.relative(aSourceRoot, source);
          }
          var key = util.toSetString(source);
          return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
        }, this);
      };
      SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
        var map = {
            version: this._version,
            sources: this._sources.toArray(),
            names: this._names.toArray(),
            mappings: this._serializeMappings()
          };
        if (this._file != null) {
          map.file = this._file;
        }
        if (this._sourceRoot != null) {
          map.sourceRoot = this._sourceRoot;
        }
        if (this._sourcesContents) {
          map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
        }
        return map;
      };
      SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
        return JSON.stringify(this);
      };
      exports.SourceMapGenerator = SourceMapGenerator;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/mapping-list.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      function generatedPositionAfter(mappingA, mappingB) {
        var lineA = mappingA.generatedLine;
        var lineB = mappingB.generatedLine;
        var columnA = mappingA.generatedColumn;
        var columnB = mappingB.generatedColumn;
        return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositions(mappingA, mappingB) <= 0;
      }
      function MappingList() {
        this._array = [];
        this._sorted = true;
        this._last = {
          generatedLine: -1,
          generatedColumn: 0
        };
      }
      MappingList.prototype.unsortedForEach = function MappingList_forEach(aCallback, aThisArg) {
        this._array.forEach(aCallback, aThisArg);
      };
      MappingList.prototype.add = function MappingList_add(aMapping) {
        var mapping;
        if (generatedPositionAfter(this._last, aMapping)) {
          this._last = aMapping;
          this._array.push(aMapping);
        } else {
          this._sorted = false;
          this._array.push(aMapping);
        }
      };
      MappingList.prototype.toArray = function MappingList_toArray() {
        if (!this._sorted) {
          this._array.sort(util.compareByGeneratedPositions);
          this._sorted = true;
        }
        return this._array;
      };
      exports.MappingList = MappingList;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/array-set.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      function ArraySet() {
        this._array = [];
        this._set = {};
      }
      ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
        var set = new ArraySet;
        for (var i = 0, len = aArray.length; i < len; i++) {
          set.add(aArray[i], aAllowDuplicates);
        }
        return set;
      };
      ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
        var isDuplicate = this.has(aStr);
        var idx = this._array.length;
        if (!isDuplicate || aAllowDuplicates) {
          this._array.push(aStr);
        }
        if (!isDuplicate) {
          this._set[util.toSetString(aStr)] = idx;
        }
      };
      ArraySet.prototype.has = function ArraySet_has(aStr) {
        return Object.prototype.hasOwnProperty.call(this._set, util.toSetString(aStr));
      };
      ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
        if (this.has(aStr)) {
          return this._set[util.toSetString(aStr)];
        }
        throw new Error('"' + aStr + '" is not in the set.');
      };
      ArraySet.prototype.at = function ArraySet_at(aIdx) {
        if (aIdx >= 0 && aIdx < this._array.length) {
          return this._array[aIdx];
        }
        throw new Error('No element indexed by ' + aIdx);
      };
      ArraySet.prototype.toArray = function ArraySet_toArray() {
        return this._array.slice();
      };
      exports.ArraySet = ArraySet;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/base64-vlq.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var base64 = require('/node_modules/source-map/lib/source-map/base64.js', module);
      var VLQ_BASE_SHIFT = 5;
      var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
      var VLQ_BASE_MASK = VLQ_BASE - 1;
      var VLQ_CONTINUATION_BIT = VLQ_BASE;
      function toVLQSigned(aValue) {
        return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
      }
      function fromVLQSigned(aValue) {
        var isNegative = (aValue & 1) === 1;
        var shifted = aValue >> 1;
        return isNegative ? -shifted : shifted;
      }
      exports.encode = function base64VLQ_encode(aValue) {
        var encoded = '';
        var digit;
        var vlq = toVLQSigned(aValue);
        do {
          digit = vlq & VLQ_BASE_MASK;
          vlq >>>= VLQ_BASE_SHIFT;
          if (vlq > 0) {
            digit |= VLQ_CONTINUATION_BIT;
          }
          encoded += base64.encode(digit);
        } while (vlq > 0);
        return encoded;
      };
      exports.decode = function base64VLQ_decode(aStr, aOutParam) {
        var i = 0;
        var strLen = aStr.length;
        var result = 0;
        var shift = 0;
        var continuation, digit;
        do {
          if (i >= strLen) {
            throw new Error('Expected more digits in base 64 VLQ value.');
          }
          digit = base64.decode(aStr.charAt(i++));
          continuation = !!(digit & VLQ_CONTINUATION_BIT);
          digit &= VLQ_BASE_MASK;
          result = result + (digit << shift);
          shift += VLQ_BASE_SHIFT;
        } while (continuation);
        aOutParam.value = fromVLQSigned(result);
        aOutParam.rest = aStr.slice(i);
      };
    });
  });
  require.define('/node_modules/source-map/lib/source-map/base64.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var charToIntMap = {};
      var intToCharMap = {};
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function (ch, index) {
        charToIntMap[ch] = index;
        intToCharMap[index] = ch;
      });
      exports.encode = function base64_encode(aNumber) {
        if (aNumber in intToCharMap) {
          return intToCharMap[aNumber];
        }
        throw new TypeError('Must be between 0 and 63: ' + aNumber);
      };
      exports.decode = function base64_decode(aChar) {
        if (aChar in charToIntMap) {
          return charToIntMap[aChar];
        }
        throw new TypeError('Not a valid base 64 digit: ' + aChar);
      };
    });
  });
  require.define('/node_modules/source-map/lib/source-map/source-map-consumer.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      function SourceMapConsumer(aSourceMap) {
        var sourceMap = aSourceMap;
        if (typeof aSourceMap === 'string') {
          sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
        }
        if (sourceMap.sections != null) {
          var indexedSourceMapConsumer = require('/node_modules/source-map/lib/source-map/indexed-source-map-consumer.js', module);
          return new indexedSourceMapConsumer.IndexedSourceMapConsumer(sourceMap);
        } else {
          var basicSourceMapConsumer = require('/node_modules/source-map/lib/source-map/basic-source-map-consumer.js', module);
          return new basicSourceMapConsumer.BasicSourceMapConsumer(sourceMap);
        }
      }
      SourceMapConsumer.fromSourceMap = function (aSourceMap) {
        var basicSourceMapConsumer = require('/node_modules/source-map/lib/source-map/basic-source-map-consumer.js', module);
        return basicSourceMapConsumer.BasicSourceMapConsumer.fromSourceMap(aSourceMap);
      };
      SourceMapConsumer.prototype._version = 3;
      SourceMapConsumer.prototype.__generatedMappings = null;
      Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
        get: function () {
          if (!this.__generatedMappings) {
            this.__generatedMappings = [];
            this.__originalMappings = [];
            this._parseMappings(this._mappings, this.sourceRoot);
          }
          return this.__generatedMappings;
        }
      });
      SourceMapConsumer.prototype.__originalMappings = null;
      Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
        get: function () {
          if (!this.__originalMappings) {
            this.__generatedMappings = [];
            this.__originalMappings = [];
            this._parseMappings(this._mappings, this.sourceRoot);
          }
          return this.__originalMappings;
        }
      });
      SourceMapConsumer.prototype._nextCharIsMappingSeparator = function SourceMapConsumer_nextCharIsMappingSeparator(aStr) {
        var c = aStr.charAt(0);
        return c === ';' || c === ',';
      };
      SourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
        throw new Error('Subclasses must implement _parseMappings');
      };
      SourceMapConsumer.GENERATED_ORDER = 1;
      SourceMapConsumer.ORIGINAL_ORDER = 2;
      SourceMapConsumer.prototype.eachMapping = function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
        var context = aContext || null;
        var order = aOrder || SourceMapConsumer.GENERATED_ORDER;
        var mappings;
        switch (order) {
        case SourceMapConsumer.GENERATED_ORDER:
          mappings = this._generatedMappings;
          break;
        case SourceMapConsumer.ORIGINAL_ORDER:
          mappings = this._originalMappings;
          break;
        default:
          throw new Error('Unknown order of iteration.');
        }
        var sourceRoot = this.sourceRoot;
        mappings.map(function (mapping) {
          var source = mapping.source;
          if (source != null && sourceRoot != null) {
            source = util.join(sourceRoot, source);
          }
          return {
            source: source,
            generatedLine: mapping.generatedLine,
            generatedColumn: mapping.generatedColumn,
            originalLine: mapping.originalLine,
            originalColumn: mapping.originalColumn,
            name: mapping.name
          };
        }).forEach(aCallback, context);
      };
      SourceMapConsumer.prototype.allGeneratedPositionsFor = function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
        var needle = {
            source: util.getArg(aArgs, 'source'),
            originalLine: util.getArg(aArgs, 'line'),
            originalColumn: Infinity
          };
        if (this.sourceRoot != null) {
          needle.source = util.relative(this.sourceRoot, needle.source);
        }
        var mappings = [];
        var index = this._findMapping(needle, this._originalMappings, 'originalLine', 'originalColumn', util.compareByOriginalPositions);
        if (index >= 0) {
          var mapping = this._originalMappings[index];
          while (mapping && mapping.originalLine === needle.originalLine) {
            mappings.push({
              line: util.getArg(mapping, 'generatedLine', null),
              column: util.getArg(mapping, 'generatedColumn', null),
              lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
            });
            mapping = this._originalMappings[--index];
          }
        }
        return mappings.reverse();
      };
      exports.SourceMapConsumer = SourceMapConsumer;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/basic-source-map-consumer.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      var binarySearch = require('/node_modules/source-map/lib/source-map/binary-search.js', module);
      var ArraySet = require('/node_modules/source-map/lib/source-map/array-set.js', module).ArraySet;
      var base64VLQ = require('/node_modules/source-map/lib/source-map/base64-vlq.js', module);
      var SourceMapConsumer = require('/node_modules/source-map/lib/source-map/source-map-consumer.js', module).SourceMapConsumer;
      function BasicSourceMapConsumer(aSourceMap) {
        var sourceMap = aSourceMap;
        if (typeof aSourceMap === 'string') {
          sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
        }
        var version = util.getArg(sourceMap, 'version');
        var sources = util.getArg(sourceMap, 'sources');
        var names = util.getArg(sourceMap, 'names', []);
        var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
        var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
        var mappings = util.getArg(sourceMap, 'mappings');
        var file = util.getArg(sourceMap, 'file', null);
        if (version != this._version) {
          throw new Error('Unsupported version: ' + version);
        }
        sources = sources.map(util.normalize);
        this._names = ArraySet.fromArray(names, true);
        this._sources = ArraySet.fromArray(sources, true);
        this.sourceRoot = sourceRoot;
        this.sourcesContent = sourcesContent;
        this._mappings = mappings;
        this.file = file;
      }
      BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
      BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;
      BasicSourceMapConsumer.fromSourceMap = function SourceMapConsumer_fromSourceMap(aSourceMap) {
        var smc = Object.create(BasicSourceMapConsumer.prototype);
        smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
        smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
        smc.sourceRoot = aSourceMap._sourceRoot;
        smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(), smc.sourceRoot);
        smc.file = aSourceMap._file;
        smc.__generatedMappings = aSourceMap._mappings.toArray().slice();
        smc.__originalMappings = aSourceMap._mappings.toArray().slice().sort(util.compareByOriginalPositions);
        return smc;
      };
      BasicSourceMapConsumer.prototype._version = 3;
      Object.defineProperty(BasicSourceMapConsumer.prototype, 'sources', {
        get: function () {
          return this._sources.toArray().map(function (s) {
            return this.sourceRoot != null ? util.join(this.sourceRoot, s) : s;
          }, this);
        }
      });
      BasicSourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
        var generatedLine = 1;
        var previousGeneratedColumn = 0;
        var previousOriginalLine = 0;
        var previousOriginalColumn = 0;
        var previousSource = 0;
        var previousName = 0;
        var str = aStr;
        var temp = {};
        var mapping;
        while (str.length > 0) {
          if (str.charAt(0) === ';') {
            generatedLine++;
            str = str.slice(1);
            previousGeneratedColumn = 0;
          } else if (str.charAt(0) === ',') {
            str = str.slice(1);
          } else {
            mapping = {};
            mapping.generatedLine = generatedLine;
            base64VLQ.decode(str, temp);
            mapping.generatedColumn = previousGeneratedColumn + temp.value;
            previousGeneratedColumn = mapping.generatedColumn;
            str = temp.rest;
            if (str.length > 0 && !this._nextCharIsMappingSeparator(str)) {
              base64VLQ.decode(str, temp);
              mapping.source = this._sources.at(previousSource + temp.value);
              previousSource += temp.value;
              str = temp.rest;
              if (str.length === 0 || this._nextCharIsMappingSeparator(str)) {
                throw new Error('Found a source, but no line and column');
              }
              base64VLQ.decode(str, temp);
              mapping.originalLine = previousOriginalLine + temp.value;
              previousOriginalLine = mapping.originalLine;
              mapping.originalLine += 1;
              str = temp.rest;
              if (str.length === 0 || this._nextCharIsMappingSeparator(str)) {
                throw new Error('Found a source and line, but no column');
              }
              base64VLQ.decode(str, temp);
              mapping.originalColumn = previousOriginalColumn + temp.value;
              previousOriginalColumn = mapping.originalColumn;
              str = temp.rest;
              if (str.length > 0 && !this._nextCharIsMappingSeparator(str)) {
                base64VLQ.decode(str, temp);
                mapping.name = this._names.at(previousName + temp.value);
                previousName += temp.value;
                str = temp.rest;
              }
            }
            this.__generatedMappings.push(mapping);
            if (typeof mapping.originalLine === 'number') {
              this.__originalMappings.push(mapping);
            }
          }
        }
        this.__generatedMappings.sort(util.compareByGeneratedPositions);
        this.__originalMappings.sort(util.compareByOriginalPositions);
      };
      BasicSourceMapConsumer.prototype._findMapping = function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName, aColumnName, aComparator) {
        if (aNeedle[aLineName] <= 0) {
          throw new TypeError('Line must be greater than or equal to 1, got ' + aNeedle[aLineName]);
        }
        if (aNeedle[aColumnName] < 0) {
          throw new TypeError('Column must be greater than or equal to 0, got ' + aNeedle[aColumnName]);
        }
        return binarySearch.search(aNeedle, aMappings, aComparator);
      };
      BasicSourceMapConsumer.prototype.computeColumnSpans = function SourceMapConsumer_computeColumnSpans() {
        for (var index = 0; index < this._generatedMappings.length; ++index) {
          var mapping = this._generatedMappings[index];
          if (index + 1 < this._generatedMappings.length) {
            var nextMapping = this._generatedMappings[index + 1];
            if (mapping.generatedLine === nextMapping.generatedLine) {
              mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
              continue;
            }
          }
          mapping.lastGeneratedColumn = Infinity;
        }
      };
      BasicSourceMapConsumer.prototype.originalPositionFor = function SourceMapConsumer_originalPositionFor(aArgs) {
        var needle = {
            generatedLine: util.getArg(aArgs, 'line'),
            generatedColumn: util.getArg(aArgs, 'column')
          };
        var index = this._findMapping(needle, this._generatedMappings, 'generatedLine', 'generatedColumn', util.compareByGeneratedPositions);
        if (index >= 0) {
          var mapping = this._generatedMappings[index];
          if (mapping.generatedLine === needle.generatedLine) {
            var source = util.getArg(mapping, 'source', null);
            if (source != null && this.sourceRoot != null) {
              source = util.join(this.sourceRoot, source);
            }
            return {
              source: source,
              line: util.getArg(mapping, 'originalLine', null),
              column: util.getArg(mapping, 'originalColumn', null),
              name: util.getArg(mapping, 'name', null)
            };
          }
        }
        return {
          source: null,
          line: null,
          column: null,
          name: null
        };
      };
      BasicSourceMapConsumer.prototype.sourceContentFor = function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
        if (!this.sourcesContent) {
          return null;
        }
        if (this.sourceRoot != null) {
          aSource = util.relative(this.sourceRoot, aSource);
        }
        if (this._sources.has(aSource)) {
          return this.sourcesContent[this._sources.indexOf(aSource)];
        }
        var url;
        if (this.sourceRoot != null && (url = util.urlParse(this.sourceRoot))) {
          var fileUriAbsPath = aSource.replace(/^file:\/\//, '');
          if (url.scheme == 'file' && this._sources.has(fileUriAbsPath)) {
            return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)];
          }
          if ((!url.path || url.path == '/') && this._sources.has('/' + aSource)) {
            return this.sourcesContent[this._sources.indexOf('/' + aSource)];
          }
        }
        if (nullOnMissing) {
          return null;
        } else {
          throw new Error('"' + aSource + '" is not in the SourceMap.');
        }
      };
      BasicSourceMapConsumer.prototype.generatedPositionFor = function SourceMapConsumer_generatedPositionFor(aArgs) {
        var needle = {
            source: util.getArg(aArgs, 'source'),
            originalLine: util.getArg(aArgs, 'line'),
            originalColumn: util.getArg(aArgs, 'column')
          };
        if (this.sourceRoot != null) {
          needle.source = util.relative(this.sourceRoot, needle.source);
        }
        var index = this._findMapping(needle, this._originalMappings, 'originalLine', 'originalColumn', util.compareByOriginalPositions);
        if (index >= 0) {
          var mapping = this._originalMappings[index];
          return {
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null),
            lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
          };
        }
        return {
          line: null,
          column: null,
          lastColumn: null
        };
      };
      exports.BasicSourceMapConsumer = BasicSourceMapConsumer;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/binary-search.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare) {
        var mid = Math.floor((aHigh - aLow) / 2) + aLow;
        var cmp = aCompare(aNeedle, aHaystack[mid], true);
        if (cmp === 0) {
          return mid;
        } else if (cmp > 0) {
          if (aHigh - mid > 1) {
            return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare);
          }
          return mid;
        } else {
          if (mid - aLow > 1) {
            return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare);
          }
          return aLow < 0 ? -1 : aLow;
        }
      }
      exports.search = function search(aNeedle, aHaystack, aCompare) {
        if (aHaystack.length === 0) {
          return -1;
        }
        return recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare);
      };
    });
  });
  require.define('/node_modules/source-map/lib/source-map/indexed-source-map-consumer.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      var binarySearch = require('/node_modules/source-map/lib/source-map/binary-search.js', module);
      var SourceMapConsumer = require('/node_modules/source-map/lib/source-map/source-map-consumer.js', module).SourceMapConsumer;
      var BasicSourceMapConsumer = require('/node_modules/source-map/lib/source-map/basic-source-map-consumer.js', module).BasicSourceMapConsumer;
      function IndexedSourceMapConsumer(aSourceMap) {
        var sourceMap = aSourceMap;
        if (typeof aSourceMap === 'string') {
          sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
        }
        var version = util.getArg(sourceMap, 'version');
        var sections = util.getArg(sourceMap, 'sections');
        if (version != this._version) {
          throw new Error('Unsupported version: ' + version);
        }
        var lastOffset = {
            line: -1,
            column: 0
          };
        this._sections = sections.map(function (s) {
          if (s.url) {
            throw new Error('Support for url field in sections not implemented.');
          }
          var offset = util.getArg(s, 'offset');
          var offsetLine = util.getArg(offset, 'line');
          var offsetColumn = util.getArg(offset, 'column');
          if (offsetLine < lastOffset.line || offsetLine === lastOffset.line && offsetColumn < lastOffset.column) {
            throw new Error('Section offsets must be ordered and non-overlapping.');
          }
          lastOffset = offset;
          return {
            generatedOffset: {
              generatedLine: offsetLine + 1,
              generatedColumn: offsetColumn + 1
            },
            consumer: new SourceMapConsumer(util.getArg(s, 'map'))
          };
        });
      }
      IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
      IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;
      IndexedSourceMapConsumer.prototype._version = 3;
      Object.defineProperty(IndexedSourceMapConsumer.prototype, 'sources', {
        get: function () {
          var sources = [];
          for (var i = 0; i < this._sections.length; i++) {
            for (var j = 0; j < this._sections[i].consumer.sources.length; j++) {
              sources.push(this._sections[i].consumer.sources[j]);
            }
          }
          ;
          return sources;
        }
      });
      IndexedSourceMapConsumer.prototype.originalPositionFor = function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
        var needle = {
            generatedLine: util.getArg(aArgs, 'line'),
            generatedColumn: util.getArg(aArgs, 'column')
          };
        var sectionIndex = binarySearch.search(needle, this._sections, function (needle, section) {
            var cmp = needle.generatedLine - section.generatedOffset.generatedLine;
            if (cmp) {
              return cmp;
            }
            return needle.generatedColumn - section.generatedOffset.generatedColumn;
          });
        var section = this._sections[sectionIndex];
        if (!section) {
          return {
            source: null,
            line: null,
            column: null,
            name: null
          };
        }
        return section.consumer.originalPositionFor({
          line: needle.generatedLine - (section.generatedOffset.generatedLine - 1),
          column: needle.generatedColumn - (section.generatedOffset.generatedLine === needle.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0)
        });
      };
      IndexedSourceMapConsumer.prototype.sourceContentFor = function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
        for (var i = 0; i < this._sections.length; i++) {
          var section = this._sections[i];
          var content = section.consumer.sourceContentFor(aSource, true);
          if (content) {
            return content;
          }
        }
        if (nullOnMissing) {
          return null;
        } else {
          throw new Error('"' + aSource + '" is not in the SourceMap.');
        }
      };
      IndexedSourceMapConsumer.prototype.generatedPositionFor = function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
        for (var i = 0; i < this._sections.length; i++) {
          var section = this._sections[i];
          if (section.consumer.sources.indexOf(util.getArg(aArgs, 'source')) === -1) {
            continue;
          }
          var generatedPosition = section.consumer.generatedPositionFor(aArgs);
          if (generatedPosition) {
            var ret = {
                line: generatedPosition.line + (section.generatedOffset.generatedLine - 1),
                column: generatedPosition.column + (section.generatedOffset.generatedLine === generatedPosition.line ? section.generatedOffset.generatedColumn - 1 : 0)
              };
            return ret;
          }
        }
        return {
          line: null,
          column: null
        };
      };
      IndexedSourceMapConsumer.prototype._parseMappings = function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        for (var i = 0; i < this._sections.length; i++) {
          var section = this._sections[i];
          var sectionMappings = section.consumer._generatedMappings;
          for (var j = 0; j < sectionMappings.length; j++) {
            var mapping = sectionMappings[i];
            var source = mapping.source;
            var sourceRoot = section.consumer.sourceRoot;
            if (source != null && sourceRoot != null) {
              source = util.join(sourceRoot, source);
            }
            var adjustedMapping = {
                source: source,
                generatedLine: mapping.generatedLine + (section.generatedOffset.generatedLine - 1),
                generatedColumn: mapping.column + (section.generatedOffset.generatedLine === mapping.generatedLine) ? section.generatedOffset.generatedColumn - 1 : 0,
                originalLine: mapping.originalLine,
                originalColumn: mapping.originalColumn,
                name: mapping.name
              };
            this.__generatedMappings.push(adjustedMapping);
            if (typeof adjustedMapping.originalLine === 'number') {
              this.__originalMappings.push(adjustedMapping);
            }
          }
          ;
        }
        ;
        this.__generatedMappings.sort(util.compareByGeneratedPositions);
        this.__originalMappings.sort(util.compareByOriginalPositions);
      };
      exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;
    });
  });
  require.define('/node_modules/esutils/lib/utils.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      exports.ast = require('/node_modules/esutils/lib/ast.js', module);
      exports.code = require('/node_modules/esutils/lib/code.js', module);
      exports.keyword = require('/node_modules/esutils/lib/keyword.js', module);
    }());
  });
  require.define('/node_modules/esutils/lib/keyword.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      var code = require('/node_modules/esutils/lib/code.js', module);
      function isStrictModeReservedWordES6(id) {
        switch (id) {
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'let':
          return true;
        default:
          return false;
        }
      }
      function isKeywordES5(id, strict) {
        if (!strict && id === 'yield') {
          return false;
        }
        return isKeywordES6(id, strict);
      }
      function isKeywordES6(id, strict) {
        if (strict && isStrictModeReservedWordES6(id)) {
          return true;
        }
        switch (id.length) {
        case 2:
          return id === 'if' || id === 'in' || id === 'do';
        case 3:
          return id === 'var' || id === 'for' || id === 'new' || id === 'try';
        case 4:
          return id === 'this' || id === 'else' || id === 'case' || id === 'void' || id === 'with' || id === 'enum';
        case 5:
          return id === 'while' || id === 'break' || id === 'catch' || id === 'throw' || id === 'const' || id === 'yield' || id === 'class' || id === 'super';
        case 6:
          return id === 'return' || id === 'typeof' || id === 'delete' || id === 'switch' || id === 'export' || id === 'import';
        case 7:
          return id === 'default' || id === 'finally' || id === 'extends';
        case 8:
          return id === 'function' || id === 'continue' || id === 'debugger';
        case 10:
          return id === 'instanceof';
        default:
          return false;
        }
      }
      function isReservedWordES5(id, strict) {
        return id === 'null' || id === 'true' || id === 'false' || isKeywordES5(id, strict);
      }
      function isReservedWordES6(id, strict) {
        return id === 'null' || id === 'true' || id === 'false' || isKeywordES6(id, strict);
      }
      function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
      }
      function isIdentifierNameES5(id) {
        var i, iz, ch;
        if (id.length === 0) {
          return false;
        }
        ch = id.charCodeAt(0);
        if (!code.isIdentifierStartES5(ch)) {
          return false;
        }
        for (i = 1, iz = id.length; i < iz; ++i) {
          ch = id.charCodeAt(i);
          if (!code.isIdentifierPartES5(ch)) {
            return false;
          }
        }
        return true;
      }
      function decodeUtf16(lead, trail) {
        return (lead - 55296) * 1024 + (trail - 56320) + 65536;
      }
      function isIdentifierNameES6(id) {
        var i, iz, ch, lowCh, check;
        if (id.length === 0) {
          return false;
        }
        check = code.isIdentifierStartES6;
        for (i = 0, iz = id.length; i < iz; ++i) {
          ch = id.charCodeAt(i);
          if (55296 <= ch && ch <= 56319) {
            ++i;
            if (i >= iz) {
              return false;
            }
            lowCh = id.charCodeAt(i);
            if (!(56320 <= lowCh && lowCh <= 57343)) {
              return false;
            }
            ch = decodeUtf16(ch, lowCh);
          }
          if (!check(ch)) {
            return false;
          }
          check = code.isIdentifierPartES6;
        }
        return true;
      }
      function isIdentifierES5(id, strict) {
        return isIdentifierNameES5(id) && !isReservedWordES5(id, strict);
      }
      function isIdentifierES6(id, strict) {
        return isIdentifierNameES6(id) && !isReservedWordES6(id, strict);
      }
      module.exports = {
        isKeywordES5: isKeywordES5,
        isKeywordES6: isKeywordES6,
        isReservedWordES5: isReservedWordES5,
        isReservedWordES6: isReservedWordES6,
        isRestrictedWord: isRestrictedWord,
        isIdentifierNameES5: isIdentifierNameES5,
        isIdentifierNameES6: isIdentifierNameES6,
        isIdentifierES5: isIdentifierES5,
        isIdentifierES6: isIdentifierES6
      };
    }());
  });
  require.define('/node_modules/esutils/lib/code.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      var ES6Regex, ES5Regex, NON_ASCII_WHITESPACES, IDENTIFIER_START, IDENTIFIER_PART, ch;
      ES5Regex = {
        NonAsciiIdentifierStart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/,
        NonAsciiIdentifierPart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/
      };
      ES6Regex = {
        NonAsciiIdentifierStart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDE00-\uDE11\uDE13-\uDE2B\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF5D-\uDF61]|\uD805[\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDE00-\uDE2F\uDE44\uDE80-\uDEAA]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF98]|\uD809[\uDC00-\uDC6E]|[\uD80C\uD840-\uD868\uD86A-\uD86C][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D]|\uD87E[\uDC00-\uDE1D]/,
        NonAsciiIdentifierPart: /[\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDD0-\uDDDA\uDE00-\uDE11\uDE13-\uDE37\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF01-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9]|\uD806[\uDCA0-\uDCE9\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF98]|\uD809[\uDC00-\uDC6E]|[\uD80C\uD840-\uD868\uD86A-\uD86C][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/
      };
      function isDecimalDigit(ch) {
        return 48 <= ch && ch <= 57;
      }
      function isHexDigit(ch) {
        return 48 <= ch && ch <= 57 || 97 <= ch && ch <= 102 || 65 <= ch && ch <= 70;
      }
      function isOctalDigit(ch) {
        return ch >= 48 && ch <= 55;
      }
      NON_ASCII_WHITESPACES = [
        5760,
        6158,
        8192,
        8193,
        8194,
        8195,
        8196,
        8197,
        8198,
        8199,
        8200,
        8201,
        8202,
        8239,
        8287,
        12288,
        65279
      ];
      function isWhiteSpace(ch) {
        return ch === 32 || ch === 9 || ch === 11 || ch === 12 || ch === 160 || ch >= 5760 && NON_ASCII_WHITESPACES.indexOf(ch) >= 0;
      }
      function isLineTerminator(ch) {
        return ch === 10 || ch === 13 || ch === 8232 || ch === 8233;
      }
      function fromCodePoint(cp) {
        if (cp <= 65535) {
          return String.fromCharCode(cp);
        }
        var cu1 = String.fromCharCode(Math.floor((cp - 65536) / 1024) + 55296);
        var cu2 = String.fromCharCode((cp - 65536) % 1024 + 56320);
        return cu1 + cu2;
      }
      IDENTIFIER_START = new Array(128);
      for (ch = 0; ch < 128; ++ch) {
        IDENTIFIER_START[ch] = ch >= 97 && ch <= 122 || ch >= 65 && ch <= 90 || ch === 36 || ch === 95;
      }
      IDENTIFIER_PART = new Array(128);
      for (ch = 0; ch < 128; ++ch) {
        IDENTIFIER_PART[ch] = ch >= 97 && ch <= 122 || ch >= 65 && ch <= 90 || ch >= 48 && ch <= 57 || ch === 36 || ch === 95;
      }
      function isIdentifierStartES5(ch) {
        return ch < 128 ? IDENTIFIER_START[ch] : ES5Regex.NonAsciiIdentifierStart.test(fromCodePoint(ch));
      }
      function isIdentifierPartES5(ch) {
        return ch < 128 ? IDENTIFIER_PART[ch] : ES5Regex.NonAsciiIdentifierPart.test(fromCodePoint(ch));
      }
      function isIdentifierStartES6(ch) {
        return ch < 128 ? IDENTIFIER_START[ch] : ES6Regex.NonAsciiIdentifierStart.test(fromCodePoint(ch));
      }
      function isIdentifierPartES6(ch) {
        return ch < 128 ? IDENTIFIER_PART[ch] : ES6Regex.NonAsciiIdentifierPart.test(fromCodePoint(ch));
      }
      module.exports = {
        isDecimalDigit: isDecimalDigit,
        isHexDigit: isHexDigit,
        isOctalDigit: isOctalDigit,
        isWhiteSpace: isWhiteSpace,
        isLineTerminator: isLineTerminator,
        isIdentifierStartES5: isIdentifierStartES5,
        isIdentifierPartES5: isIdentifierPartES5,
        isIdentifierStartES6: isIdentifierStartES6,
        isIdentifierPartES6: isIdentifierPartES6
      };
    }());
  });
  require.define('/node_modules/esutils/lib/ast.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      function isExpression(node) {
        if (node == null) {
          return false;
        }
        switch (node.type) {
        case 'ArrayExpression':
        case 'AssignmentExpression':
        case 'BinaryExpression':
        case 'CallExpression':
        case 'ConditionalExpression':
        case 'FunctionExpression':
        case 'Identifier':
        case 'Literal':
        case 'LogicalExpression':
        case 'MemberExpression':
        case 'NewExpression':
        case 'ObjectExpression':
        case 'SequenceExpression':
        case 'ThisExpression':
        case 'UnaryExpression':
        case 'UpdateExpression':
          return true;
        }
        return false;
      }
      function isIterationStatement(node) {
        if (node == null) {
          return false;
        }
        switch (node.type) {
        case 'DoWhileStatement':
        case 'ForInStatement':
        case 'ForStatement':
        case 'WhileStatement':
          return true;
        }
        return false;
      }
      function isStatement(node) {
        if (node == null) {
          return false;
        }
        switch (node.type) {
        case 'BlockStatement':
        case 'BreakStatement':
        case 'ContinueStatement':
        case 'DebuggerStatement':
        case 'DoWhileStatement':
        case 'EmptyStatement':
        case 'ExpressionStatement':
        case 'ForInStatement':
        case 'ForStatement':
        case 'IfStatement':
        case 'LabeledStatement':
        case 'ReturnStatement':
        case 'SwitchStatement':
        case 'ThrowStatement':
        case 'TryStatement':
        case 'VariableDeclaration':
        case 'WhileStatement':
        case 'WithStatement':
          return true;
        }
        return false;
      }
      function isSourceElement(node) {
        return isStatement(node) || node != null && node.type === 'FunctionDeclaration';
      }
      function trailingStatement(node) {
        switch (node.type) {
        case 'IfStatement':
          if (node.alternate != null) {
            return node.alternate;
          }
          return node.consequent;
        case 'LabeledStatement':
        case 'ForStatement':
        case 'ForInStatement':
        case 'WhileStatement':
        case 'WithStatement':
          return node.body;
        }
        return null;
      }
      function isProblematicIfStatement(node) {
        var current;
        if (node.type !== 'IfStatement') {
          return false;
        }
        if (node.alternate == null) {
          return false;
        }
        current = node.consequent;
        do {
          if (current.type === 'IfStatement') {
            if (current.alternate == null) {
              return true;
            }
          }
          current = trailingStatement(current);
        } while (current);
        return false;
      }
      module.exports = {
        isExpression: isExpression,
        isStatement: isStatement,
        isIterationStatement: isIterationStatement,
        isSourceElement: isSourceElement,
        isProblematicIfStatement: isProblematicIfStatement,
        trailingStatement: trailingStatement
      };
    }());
  });
  require.define('/node_modules/estraverse/estraverse.js', function (module, exports, __dirname, __filename) {
    (function (root, factory) {
      'use strict';
      if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
      } else if (typeof exports !== 'undefined') {
        factory(exports);
      } else {
        factory(root.estraverse = {});
      }
    }(this, function clone(exports) {
      'use strict';
      var Syntax, isArray, VisitorOption, VisitorKeys, objectCreate, objectKeys, BREAK, SKIP, REMOVE;
      function ignoreJSHintError() {
      }
      isArray = Array.isArray;
      if (!isArray) {
        isArray = function isArray(array) {
          return Object.prototype.toString.call(array) === '[object Array]';
        };
      }
      function deepCopy(obj) {
        var ret = {}, key, val;
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            val = obj[key];
            if (typeof val === 'object' && val !== null) {
              ret[key] = deepCopy(val);
            } else {
              ret[key] = val;
            }
          }
        }
        return ret;
      }
      function shallowCopy(obj) {
        var ret = {}, key;
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            ret[key] = obj[key];
          }
        }
        return ret;
      }
      ignoreJSHintError(shallowCopy);
      function upperBound(array, func) {
        var diff, len, i, current;
        len = array.length;
        i = 0;
        while (len) {
          diff = len >>> 1;
          current = i + diff;
          if (func(array[current])) {
            len = diff;
          } else {
            i = current + 1;
            len -= diff + 1;
          }
        }
        return i;
      }
      function lowerBound(array, func) {
        var diff, len, i, current;
        len = array.length;
        i = 0;
        while (len) {
          diff = len >>> 1;
          current = i + diff;
          if (func(array[current])) {
            i = current + 1;
            len -= diff + 1;
          } else {
            len = diff;
          }
        }
        return i;
      }
      ignoreJSHintError(lowerBound);
      objectCreate = Object.create || function () {
        function F() {
        }
        return function (o) {
          F.prototype = o;
          return new F;
        };
      }();
      objectKeys = Object.keys || function (o) {
        var keys = [], key;
        for (key in o) {
          keys.push(key);
        }
        return keys;
      };
      function extend(to, from) {
        var keys = objectKeys(from), key, i, len;
        for (i = 0, len = keys.length; i < len; i += 1) {
          key = keys[i];
          to[key] = from[key];
        }
        return to;
      }
      Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        ArrayPattern: 'ArrayPattern',
        ArrowFunctionExpression: 'ArrowFunctionExpression',
        AwaitExpression: 'AwaitExpression',
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ClassBody: 'ClassBody',
        ClassDeclaration: 'ClassDeclaration',
        ClassExpression: 'ClassExpression',
        ComprehensionBlock: 'ComprehensionBlock',
        ComprehensionExpression: 'ComprehensionExpression',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DebuggerStatement: 'DebuggerStatement',
        DirectiveStatement: 'DirectiveStatement',
        DoWhileStatement: 'DoWhileStatement',
        EmptyStatement: 'EmptyStatement',
        ExportBatchSpecifier: 'ExportBatchSpecifier',
        ExportDeclaration: 'ExportDeclaration',
        ExportSpecifier: 'ExportSpecifier',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        ForOfStatement: 'ForOfStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        GeneratorExpression: 'GeneratorExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        ImportDeclaration: 'ImportDeclaration',
        ImportDefaultSpecifier: 'ImportDefaultSpecifier',
        ImportNamespaceSpecifier: 'ImportNamespaceSpecifier',
        ImportSpecifier: 'ImportSpecifier',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        MethodDefinition: 'MethodDefinition',
        ModuleSpecifier: 'ModuleSpecifier',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        ObjectPattern: 'ObjectPattern',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SpreadElement: 'SpreadElement',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        TaggedTemplateExpression: 'TaggedTemplateExpression',
        TemplateElement: 'TemplateElement',
        TemplateLiteral: 'TemplateLiteral',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement',
        YieldExpression: 'YieldExpression'
      };
      VisitorKeys = {
        AssignmentExpression: [
          'left',
          'right'
        ],
        ArrayExpression: ['elements'],
        ArrayPattern: ['elements'],
        ArrowFunctionExpression: [
          'params',
          'defaults',
          'rest',
          'body'
        ],
        AwaitExpression: ['argument'],
        BlockStatement: ['body'],
        BinaryExpression: [
          'left',
          'right'
        ],
        BreakStatement: ['label'],
        CallExpression: [
          'callee',
          'arguments'
        ],
        CatchClause: [
          'param',
          'body'
        ],
        ClassBody: ['body'],
        ClassDeclaration: [
          'id',
          'body',
          'superClass'
        ],
        ClassExpression: [
          'id',
          'body',
          'superClass'
        ],
        ComprehensionBlock: [
          'left',
          'right'
        ],
        ComprehensionExpression: [
          'blocks',
          'filter',
          'body'
        ],
        ConditionalExpression: [
          'test',
          'consequent',
          'alternate'
        ],
        ContinueStatement: ['label'],
        DebuggerStatement: [],
        DirectiveStatement: [],
        DoWhileStatement: [
          'body',
          'test'
        ],
        EmptyStatement: [],
        ExportBatchSpecifier: [],
        ExportDeclaration: [
          'declaration',
          'specifiers',
          'source'
        ],
        ExportSpecifier: [
          'id',
          'name'
        ],
        ExpressionStatement: ['expression'],
        ForStatement: [
          'init',
          'test',
          'update',
          'body'
        ],
        ForInStatement: [
          'left',
          'right',
          'body'
        ],
        ForOfStatement: [
          'left',
          'right',
          'body'
        ],
        FunctionDeclaration: [
          'id',
          'params',
          'defaults',
          'rest',
          'body'
        ],
        FunctionExpression: [
          'id',
          'params',
          'defaults',
          'rest',
          'body'
        ],
        GeneratorExpression: [
          'blocks',
          'filter',
          'body'
        ],
        Identifier: [],
        IfStatement: [
          'test',
          'consequent',
          'alternate'
        ],
        ImportDeclaration: [
          'specifiers',
          'source'
        ],
        ImportDefaultSpecifier: ['id'],
        ImportNamespaceSpecifier: ['id'],
        ImportSpecifier: [
          'id',
          'name'
        ],
        Literal: [],
        LabeledStatement: [
          'label',
          'body'
        ],
        LogicalExpression: [
          'left',
          'right'
        ],
        MemberExpression: [
          'object',
          'property'
        ],
        MethodDefinition: [
          'key',
          'value'
        ],
        ModuleSpecifier: [],
        NewExpression: [
          'callee',
          'arguments'
        ],
        ObjectExpression: ['properties'],
        ObjectPattern: ['properties'],
        Program: ['body'],
        Property: [
          'key',
          'value'
        ],
        ReturnStatement: ['argument'],
        SequenceExpression: ['expressions'],
        SpreadElement: ['argument'],
        SwitchStatement: [
          'discriminant',
          'cases'
        ],
        SwitchCase: [
          'test',
          'consequent'
        ],
        TaggedTemplateExpression: [
          'tag',
          'quasi'
        ],
        TemplateElement: [],
        TemplateLiteral: [
          'quasis',
          'expressions'
        ],
        ThisExpression: [],
        ThrowStatement: ['argument'],
        TryStatement: [
          'block',
          'handlers',
          'handler',
          'guardedHandlers',
          'finalizer'
        ],
        UnaryExpression: ['argument'],
        UpdateExpression: ['argument'],
        VariableDeclaration: ['declarations'],
        VariableDeclarator: [
          'id',
          'init'
        ],
        WhileStatement: [
          'test',
          'body'
        ],
        WithStatement: [
          'object',
          'body'
        ],
        YieldExpression: ['argument']
      };
      BREAK = {};
      SKIP = {};
      REMOVE = {};
      VisitorOption = {
        Break: BREAK,
        Skip: SKIP,
        Remove: REMOVE
      };
      function Reference(parent, key) {
        this.parent = parent;
        this.key = key;
      }
      Reference.prototype.replace = function replace(node) {
        this.parent[this.key] = node;
      };
      Reference.prototype.remove = function remove() {
        if (isArray(this.parent)) {
          this.parent.splice(this.key, 1);
          return true;
        } else {
          this.replace(null);
          return false;
        }
      };
      function Element(node, path, wrap, ref) {
        this.node = node;
        this.path = path;
        this.wrap = wrap;
        this.ref = ref;
      }
      function Controller() {
      }
      Controller.prototype.path = function path() {
        var i, iz, j, jz, result, element;
        function addToPath(result, path) {
          if (isArray(path)) {
            for (j = 0, jz = path.length; j < jz; ++j) {
              result.push(path[j]);
            }
          } else {
            result.push(path);
          }
        }
        if (!this.__current.path) {
          return null;
        }
        result = [];
        for (i = 2, iz = this.__leavelist.length; i < iz; ++i) {
          element = this.__leavelist[i];
          addToPath(result, element.path);
        }
        addToPath(result, this.__current.path);
        return result;
      };
      Controller.prototype.type = function () {
        var node = this.current();
        return node.type || this.__current.wrap;
      };
      Controller.prototype.parents = function parents() {
        var i, iz, result;
        result = [];
        for (i = 1, iz = this.__leavelist.length; i < iz; ++i) {
          result.push(this.__leavelist[i].node);
        }
        return result;
      };
      Controller.prototype.current = function current() {
        return this.__current.node;
      };
      Controller.prototype.__execute = function __execute(callback, element) {
        var previous, result;
        result = undefined;
        previous = this.__current;
        this.__current = element;
        this.__state = null;
        if (callback) {
          result = callback.call(this, element.node, this.__leavelist[this.__leavelist.length - 1].node);
        }
        this.__current = previous;
        return result;
      };
      Controller.prototype.notify = function notify(flag) {
        this.__state = flag;
      };
      Controller.prototype.skip = function () {
        this.notify(SKIP);
      };
      Controller.prototype['break'] = function () {
        this.notify(BREAK);
      };
      Controller.prototype.remove = function () {
        this.notify(REMOVE);
      };
      Controller.prototype.__initialize = function (root, visitor) {
        this.visitor = visitor;
        this.root = root;
        this.__worklist = [];
        this.__leavelist = [];
        this.__current = null;
        this.__state = null;
        this.__fallback = visitor.fallback === 'iteration';
        this.__keys = VisitorKeys;
        if (visitor.keys) {
          this.__keys = extend(objectCreate(this.__keys), visitor.keys);
        }
      };
      function isNode(node) {
        if (node == null) {
          return false;
        }
        return typeof node === 'object' && typeof node.type === 'string';
      }
      function isProperty(nodeType, key) {
        return (nodeType === Syntax.ObjectExpression || nodeType === Syntax.ObjectPattern) && 'properties' === key;
      }
      Controller.prototype.traverse = function traverse(root, visitor) {
        var worklist, leavelist, element, node, nodeType, ret, key, current, current2, candidates, candidate, sentinel;
        this.__initialize(root, visitor);
        sentinel = {};
        worklist = this.__worklist;
        leavelist = this.__leavelist;
        worklist.push(new Element(root, null, null, null));
        leavelist.push(new Element(null, null, null, null));
        while (worklist.length) {
          element = worklist.pop();
          if (element === sentinel) {
            element = leavelist.pop();
            ret = this.__execute(visitor.leave, element);
            if (this.__state === BREAK || ret === BREAK) {
              return;
            }
            continue;
          }
          if (element.node) {
            ret = this.__execute(visitor.enter, element);
            if (this.__state === BREAK || ret === BREAK) {
              return;
            }
            worklist.push(sentinel);
            leavelist.push(element);
            if (this.__state === SKIP || ret === SKIP) {
              continue;
            }
            node = element.node;
            nodeType = element.wrap || node.type;
            candidates = this.__keys[nodeType];
            if (!candidates) {
              if (this.__fallback) {
                candidates = objectKeys(node);
              } else {
                throw new Error('Unknown node type ' + nodeType + '.');
              }
            }
            current = candidates.length;
            while ((current -= 1) >= 0) {
              key = candidates[current];
              candidate = node[key];
              if (!candidate) {
                continue;
              }
              if (isArray(candidate)) {
                current2 = candidate.length;
                while ((current2 -= 1) >= 0) {
                  if (!candidate[current2]) {
                    continue;
                  }
                  if (isProperty(nodeType, candidates[current])) {
                    element = new Element(candidate[current2], [
                      key,
                      current2
                    ], 'Property', null);
                  } else if (isNode(candidate[current2])) {
                    element = new Element(candidate[current2], [
                      key,
                      current2
                    ], null, null);
                  } else {
                    continue;
                  }
                  worklist.push(element);
                }
              } else if (isNode(candidate)) {
                worklist.push(new Element(candidate, key, null, null));
              }
            }
          }
        }
      };
      Controller.prototype.replace = function replace(root, visitor) {
        function removeElem(element) {
          var i, key, nextElem, parent;
          if (element.ref.remove()) {
            key = element.ref.key;
            parent = element.ref.parent;
            i = worklist.length;
            while (i--) {
              nextElem = worklist[i];
              if (nextElem.ref && nextElem.ref.parent === parent) {
                if (nextElem.ref.key < key) {
                  break;
                }
                --nextElem.ref.key;
              }
            }
          }
        }
        var worklist, leavelist, node, nodeType, target, element, current, current2, candidates, candidate, sentinel, outer, key;
        this.__initialize(root, visitor);
        sentinel = {};
        worklist = this.__worklist;
        leavelist = this.__leavelist;
        outer = { root: root };
        element = new Element(root, null, null, new Reference(outer, 'root'));
        worklist.push(element);
        leavelist.push(element);
        while (worklist.length) {
          element = worklist.pop();
          if (element === sentinel) {
            element = leavelist.pop();
            target = this.__execute(visitor.leave, element);
            if (target !== undefined && target !== BREAK && target !== SKIP && target !== REMOVE) {
              element.ref.replace(target);
            }
            if (this.__state === REMOVE || target === REMOVE) {
              removeElem(element);
            }
            if (this.__state === BREAK || target === BREAK) {
              return outer.root;
            }
            continue;
          }
          target = this.__execute(visitor.enter, element);
          if (target !== undefined && target !== BREAK && target !== SKIP && target !== REMOVE) {
            element.ref.replace(target);
            element.node = target;
          }
          if (this.__state === REMOVE || target === REMOVE) {
            removeElem(element);
            element.node = null;
          }
          if (this.__state === BREAK || target === BREAK) {
            return outer.root;
          }
          node = element.node;
          if (!node) {
            continue;
          }
          worklist.push(sentinel);
          leavelist.push(element);
          if (this.__state === SKIP || target === SKIP) {
            continue;
          }
          nodeType = element.wrap || node.type;
          candidates = this.__keys[nodeType];
          if (!candidates) {
            if (this.__fallback) {
              candidates = objectKeys(node);
            } else {
              throw new Error('Unknown node type ' + nodeType + '.');
            }
          }
          current = candidates.length;
          while ((current -= 1) >= 0) {
            key = candidates[current];
            candidate = node[key];
            if (!candidate) {
              continue;
            }
            if (isArray(candidate)) {
              current2 = candidate.length;
              while ((current2 -= 1) >= 0) {
                if (!candidate[current2]) {
                  continue;
                }
                if (isProperty(nodeType, candidates[current])) {
                  element = new Element(candidate[current2], [
                    key,
                    current2
                  ], 'Property', new Reference(candidate, current2));
                } else if (isNode(candidate[current2])) {
                  element = new Element(candidate[current2], [
                    key,
                    current2
                  ], null, new Reference(candidate, current2));
                } else {
                  continue;
                }
                worklist.push(element);
              }
            } else if (isNode(candidate)) {
              worklist.push(new Element(candidate, key, null, new Reference(node, key)));
            }
          }
        }
        return outer.root;
      };
      function traverse(root, visitor) {
        var controller = new Controller;
        return controller.traverse(root, visitor);
      }
      function replace(root, visitor) {
        var controller = new Controller;
        return controller.replace(root, visitor);
      }
      function extendCommentRange(comment, tokens) {
        var target;
        target = upperBound(tokens, function search(token) {
          return token.range[0] > comment.range[0];
        });
        comment.extendedRange = [
          comment.range[0],
          comment.range[1]
        ];
        if (target !== tokens.length) {
          comment.extendedRange[1] = tokens[target].range[0];
        }
        target -= 1;
        if (target >= 0) {
          comment.extendedRange[0] = tokens[target].range[1];
        }
        return comment;
      }
      function attachComments(tree, providedComments, tokens) {
        var comments = [], comment, len, i, cursor;
        if (!tree.range) {
          throw new Error('attachComments needs range information');
        }
        if (!tokens.length) {
          if (providedComments.length) {
            for (i = 0, len = providedComments.length; i < len; i += 1) {
              comment = deepCopy(providedComments[i]);
              comment.extendedRange = [
                0,
                tree.range[0]
              ];
              comments.push(comment);
            }
            tree.leadingComments = comments;
          }
          return tree;
        }
        for (i = 0, len = providedComments.length; i < len; i += 1) {
          comments.push(extendCommentRange(deepCopy(providedComments[i]), tokens));
        }
        cursor = 0;
        traverse(tree, {
          enter: function (node) {
            var comment;
            while (cursor < comments.length) {
              comment = comments[cursor];
              if (comment.extendedRange[1] > node.range[0]) {
                break;
              }
              if (comment.extendedRange[1] === node.range[0]) {
                if (!node.leadingComments) {
                  node.leadingComments = [];
                }
                node.leadingComments.push(comment);
                comments.splice(cursor, 1);
              } else {
                cursor += 1;
              }
            }
            if (cursor === comments.length) {
              return VisitorOption.Break;
            }
            if (comments[cursor].extendedRange[0] > node.range[1]) {
              return VisitorOption.Skip;
            }
          }
        });
        cursor = 0;
        traverse(tree, {
          leave: function (node) {
            var comment;
            while (cursor < comments.length) {
              comment = comments[cursor];
              if (node.range[1] < comment.extendedRange[0]) {
                break;
              }
              if (node.range[1] === comment.extendedRange[0]) {
                if (!node.trailingComments) {
                  node.trailingComments = [];
                }
                node.trailingComments.push(comment);
                comments.splice(cursor, 1);
              } else {
                cursor += 1;
              }
            }
            if (cursor === comments.length) {
              return VisitorOption.Break;
            }
            if (comments[cursor].extendedRange[0] > node.range[1]) {
              return VisitorOption.Skip;
            }
          }
        });
        return tree;
      }
      exports.version = '1.8.1-dev';
      exports.Syntax = Syntax;
      exports.traverse = traverse;
      exports.replace = replace;
      exports.attachComments = attachComments;
      exports.VisitorKeys = VisitorKeys;
      exports.VisitorOption = VisitorOption;
      exports.Controller = Controller;
      exports.cloneEnvironment = function () {
        return clone({});
      };
      return exports;
    }));
  });
  require('/tools/entry-point.js');
}.call(this, this));

})();
return _retrieveGlobal();
});

System.registerDynamic('lively.ast/generated/estree-visitor.js', [], true, function(require, exports, module) {
// <<<<<<<<<<<<< BEGIN OF AUTO GENERATED CODE <<<<<<<<<<<<<
// Generated on 16-04-09 19:27 PDT
function Visitor() {}
Visitor.prototype.accept = function accept(node, state, path) {
  if (!node) throw new Error("Undefined AST node in Visitor.accept:\n  " + path.join(".") + "\n  " + node);
  if (!node.type) throw new Error("Strangee AST node without type in Visitor.accept:\n  " + path.join(".") + "\n  " + JSON.stringify(node));
  switch(node.type) {
    case "Node": return this.visitNode(node, state, path);
    case "SourceLocation": return this.visitSourceLocation(node, state, path);
    case "Position": return this.visitPosition(node, state, path);
    case "Program": return this.visitProgram(node, state, path);
    case "Function": return this.visitFunction(node, state, path);
    case "Statement": return this.visitStatement(node, state, path);
    case "SwitchCase": return this.visitSwitchCase(node, state, path);
    case "CatchClause": return this.visitCatchClause(node, state, path);
    case "VariableDeclarator": return this.visitVariableDeclarator(node, state, path);
    case "Expression": return this.visitExpression(node, state, path);
    case "Property": return this.visitProperty(node, state, path);
    case "Pattern": return this.visitPattern(node, state, path);
    case "Super": return this.visitSuper(node, state, path);
    case "SpreadElement": return this.visitSpreadElement(node, state, path);
    case "TemplateElement": return this.visitTemplateElement(node, state, path);
    case "Class": return this.visitClass(node, state, path);
    case "ClassBody": return this.visitClassBody(node, state, path);
    case "MethodDefinition": return this.visitMethodDefinition(node, state, path);
    case "ModuleDeclaration": return this.visitModuleDeclaration(node, state, path);
    case "ModuleSpecifier": return this.visitModuleSpecifier(node, state, path);
    case "Identifier": return this.visitIdentifier(node, state, path);
    case "Literal": return this.visitLiteral(node, state, path);
    case "ExpressionStatement": return this.visitExpressionStatement(node, state, path);
    case "BlockStatement": return this.visitBlockStatement(node, state, path);
    case "EmptyStatement": return this.visitEmptyStatement(node, state, path);
    case "DebuggerStatement": return this.visitDebuggerStatement(node, state, path);
    case "WithStatement": return this.visitWithStatement(node, state, path);
    case "ReturnStatement": return this.visitReturnStatement(node, state, path);
    case "LabeledStatement": return this.visitLabeledStatement(node, state, path);
    case "BreakStatement": return this.visitBreakStatement(node, state, path);
    case "ContinueStatement": return this.visitContinueStatement(node, state, path);
    case "IfStatement": return this.visitIfStatement(node, state, path);
    case "SwitchStatement": return this.visitSwitchStatement(node, state, path);
    case "ThrowStatement": return this.visitThrowStatement(node, state, path);
    case "TryStatement": return this.visitTryStatement(node, state, path);
    case "WhileStatement": return this.visitWhileStatement(node, state, path);
    case "DoWhileStatement": return this.visitDoWhileStatement(node, state, path);
    case "ForStatement": return this.visitForStatement(node, state, path);
    case "ForInStatement": return this.visitForInStatement(node, state, path);
    case "Declaration": return this.visitDeclaration(node, state, path);
    case "ThisExpression": return this.visitThisExpression(node, state, path);
    case "ArrayExpression": return this.visitArrayExpression(node, state, path);
    case "ObjectExpression": return this.visitObjectExpression(node, state, path);
    case "FunctionExpression": return this.visitFunctionExpression(node, state, path);
    case "UnaryExpression": return this.visitUnaryExpression(node, state, path);
    case "UpdateExpression": return this.visitUpdateExpression(node, state, path);
    case "BinaryExpression": return this.visitBinaryExpression(node, state, path);
    case "AssignmentExpression": return this.visitAssignmentExpression(node, state, path);
    case "LogicalExpression": return this.visitLogicalExpression(node, state, path);
    case "MemberExpression": return this.visitMemberExpression(node, state, path);
    case "ConditionalExpression": return this.visitConditionalExpression(node, state, path);
    case "CallExpression": return this.visitCallExpression(node, state, path);
    case "SequenceExpression": return this.visitSequenceExpression(node, state, path);
    case "ArrowFunctionExpression": return this.visitArrowFunctionExpression(node, state, path);
    case "YieldExpression": return this.visitYieldExpression(node, state, path);
    case "TemplateLiteral": return this.visitTemplateLiteral(node, state, path);
    case "TaggedTemplateExpression": return this.visitTaggedTemplateExpression(node, state, path);
    case "AssignmentProperty": return this.visitAssignmentProperty(node, state, path);
    case "ObjectPattern": return this.visitObjectPattern(node, state, path);
    case "ArrayPattern": return this.visitArrayPattern(node, state, path);
    case "RestElement": return this.visitRestElement(node, state, path);
    case "AssignmentPattern": return this.visitAssignmentPattern(node, state, path);
    case "ClassExpression": return this.visitClassExpression(node, state, path);
    case "MetaProperty": return this.visitMetaProperty(node, state, path);
    case "ImportDeclaration": return this.visitImportDeclaration(node, state, path);
    case "ImportSpecifier": return this.visitImportSpecifier(node, state, path);
    case "ImportDefaultSpecifier": return this.visitImportDefaultSpecifier(node, state, path);
    case "ImportNamespaceSpecifier": return this.visitImportNamespaceSpecifier(node, state, path);
    case "ExportNamedDeclaration": return this.visitExportNamedDeclaration(node, state, path);
    case "ExportSpecifier": return this.visitExportSpecifier(node, state, path);
    case "ExportDefaultDeclaration": return this.visitExportDefaultDeclaration(node, state, path);
    case "ExportAllDeclaration": return this.visitExportAllDeclaration(node, state, path);
    case "RegExpLiteral": return this.visitRegExpLiteral(node, state, path);
    case "FunctionDeclaration": return this.visitFunctionDeclaration(node, state, path);
    case "VariableDeclaration": return this.visitVariableDeclaration(node, state, path);
    case "NewExpression": return this.visitNewExpression(node, state, path);
    case "ForOfStatement": return this.visitForOfStatement(node, state, path);
    case "ClassDeclaration": return this.visitClassDeclaration(node, state, path);
  }
  throw new Error("No visit function in AST visitor Visitor for:\n  " + path.join(".") + "\n  " + JSON.stringify(node));
}
Visitor.prototype.visitNode = function visitNode(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitSourceLocation = function visitSourceLocation(node, state, path) {
  var visitor = this;
  // start is of types Position
  node["start"] = visitor.accept(node["start"], state, path.concat(["start"]));
  // end is of types Position
  node["end"] = visitor.accept(node["end"], state, path.concat(["end"]));
  return node;
}
Visitor.prototype.visitPosition = function visitPosition(node, state, path) {
  var visitor = this;
  return node;
}
Visitor.prototype.visitProgram = function visitProgram(node, state, path) {
  var visitor = this;
  // body is a list with types Statement, ModuleDeclaration
  node["body"] = node["body"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["body", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitFunction = function visitFunction(node, state, path) {
  var visitor = this;
  // id is of types Identifier
  if (node["id"]) {
    node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
  }
  // params is a list with types Pattern
  node["params"] = node["params"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["params", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // body is of types BlockStatement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitStatement = function visitStatement(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitSwitchCase = function visitSwitchCase(node, state, path) {
  var visitor = this;
  // test is of types Expression
  if (node["test"]) {
    node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
  }
  // consequent is a list with types Statement
  node["consequent"] = node["consequent"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["consequent", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitCatchClause = function visitCatchClause(node, state, path) {
  var visitor = this;
  // param is of types Pattern
  node["param"] = visitor.accept(node["param"], state, path.concat(["param"]));
  // body is of types BlockStatement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitVariableDeclarator = function visitVariableDeclarator(node, state, path) {
  var visitor = this;
  // id is of types Pattern
  node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
  // init is of types Expression
  if (node["init"]) {
    node["init"] = visitor.accept(node["init"], state, path.concat(["init"]));
  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitExpression = function visitExpression(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitProperty = function visitProperty(node, state, path) {
  var visitor = this;
  // key is of types Expression
  node["key"] = visitor.accept(node["key"], state, path.concat(["key"]));
  // value is of types Expression
  node["value"] = visitor.accept(node["value"], state, path.concat(["value"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitPattern = function visitPattern(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitSuper = function visitSuper(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitSpreadElement = function visitSpreadElement(node, state, path) {
  var visitor = this;
  // argument is of types Expression
  node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitTemplateElement = function visitTemplateElement(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitClass = function visitClass(node, state, path) {
  var visitor = this;
  // id is of types Identifier
  if (node["id"]) {
    node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
  }
  // superClass is of types Expression
  if (node["superClass"]) {
    node["superClass"] = visitor.accept(node["superClass"], state, path.concat(["superClass"]));
  }
  // body is of types ClassBody
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitClassBody = function visitClassBody(node, state, path) {
  var visitor = this;
  // body is a list with types MethodDefinition
  node["body"] = node["body"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["body", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitMethodDefinition = function visitMethodDefinition(node, state, path) {
  var visitor = this;
  // key is of types Expression
  node["key"] = visitor.accept(node["key"], state, path.concat(["key"]));
  // value is of types FunctionExpression
  node["value"] = visitor.accept(node["value"], state, path.concat(["value"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitModuleDeclaration = function visitModuleDeclaration(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitModuleSpecifier = function visitModuleSpecifier(node, state, path) {
  var visitor = this;
  // local is of types Identifier
  node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitIdentifier = function visitIdentifier(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitLiteral = function visitLiteral(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitExpressionStatement = function visitExpressionStatement(node, state, path) {
  var visitor = this;
  // expression is of types Expression
  node["expression"] = visitor.accept(node["expression"], state, path.concat(["expression"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitBlockStatement = function visitBlockStatement(node, state, path) {
  var visitor = this;
  // body is a list with types Statement
  node["body"] = node["body"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["body", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitEmptyStatement = function visitEmptyStatement(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitDebuggerStatement = function visitDebuggerStatement(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitWithStatement = function visitWithStatement(node, state, path) {
  var visitor = this;
  // object is of types Expression
  node["object"] = visitor.accept(node["object"], state, path.concat(["object"]));
  // body is of types Statement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitReturnStatement = function visitReturnStatement(node, state, path) {
  var visitor = this;
  // argument is of types Expression
  if (node["argument"]) {
    node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitLabeledStatement = function visitLabeledStatement(node, state, path) {
  var visitor = this;
  // label is of types Identifier
  node["label"] = visitor.accept(node["label"], state, path.concat(["label"]));
  // body is of types Statement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitBreakStatement = function visitBreakStatement(node, state, path) {
  var visitor = this;
  // label is of types Identifier
  if (node["label"]) {
    node["label"] = visitor.accept(node["label"], state, path.concat(["label"]));
  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitContinueStatement = function visitContinueStatement(node, state, path) {
  var visitor = this;
  // label is of types Identifier
  if (node["label"]) {
    node["label"] = visitor.accept(node["label"], state, path.concat(["label"]));
  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitIfStatement = function visitIfStatement(node, state, path) {
  var visitor = this;
  // test is of types Expression
  node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
  // consequent is of types Statement
  node["consequent"] = visitor.accept(node["consequent"], state, path.concat(["consequent"]));
  // alternate is of types Statement
  if (node["alternate"]) {
    node["alternate"] = visitor.accept(node["alternate"], state, path.concat(["alternate"]));
  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitSwitchStatement = function visitSwitchStatement(node, state, path) {
  var visitor = this;
  // discriminant is of types Expression
  node["discriminant"] = visitor.accept(node["discriminant"], state, path.concat(["discriminant"]));
  // cases is a list with types SwitchCase
  node["cases"] = node["cases"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["cases", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitThrowStatement = function visitThrowStatement(node, state, path) {
  var visitor = this;
  // argument is of types Expression
  node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitTryStatement = function visitTryStatement(node, state, path) {
  var visitor = this;
  // block is of types BlockStatement
  node["block"] = visitor.accept(node["block"], state, path.concat(["block"]));
  // handler is of types CatchClause
  if (node["handler"]) {
    node["handler"] = visitor.accept(node["handler"], state, path.concat(["handler"]));
  }
  // finalizer is of types BlockStatement
  if (node["finalizer"]) {
    node["finalizer"] = visitor.accept(node["finalizer"], state, path.concat(["finalizer"]));
  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitWhileStatement = function visitWhileStatement(node, state, path) {
  var visitor = this;
  // test is of types Expression
  node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
  // body is of types Statement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitDoWhileStatement = function visitDoWhileStatement(node, state, path) {
  var visitor = this;
  // body is of types Statement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // test is of types Expression
  node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitForStatement = function visitForStatement(node, state, path) {
  var visitor = this;
  // init is of types VariableDeclaration, Expression
  if (node["init"]) {
    node["init"] = visitor.accept(node["init"], state, path.concat(["init"]));
  }
  // test is of types Expression
  if (node["test"]) {
    node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
  }
  // update is of types Expression
  if (node["update"]) {
    node["update"] = visitor.accept(node["update"], state, path.concat(["update"]));
  }
  // body is of types Statement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitForInStatement = function visitForInStatement(node, state, path) {
  var visitor = this;
  // left is of types VariableDeclaration, Pattern
  node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
  // right is of types Expression
  node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
  // body is of types Statement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitDeclaration = function visitDeclaration(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitThisExpression = function visitThisExpression(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitArrayExpression = function visitArrayExpression(node, state, path) {
  var visitor = this;
  // elements is a list with types Expression, SpreadElement
  if (node["elements"]) {
    node["elements"] = node["elements"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["elements", i]));
      if (Array.isArray(result)) results.push.apply(results, result);
      else results.push(result);
      return results;
    }, []);  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitObjectExpression = function visitObjectExpression(node, state, path) {
  var visitor = this;
  // properties is a list with types Property
  node["properties"] = node["properties"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["properties", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitFunctionExpression = function visitFunctionExpression(node, state, path) {
  var visitor = this;
  // id is of types Identifier
  if (node["id"]) {
    node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
  }
  // params is a list with types Pattern
  node["params"] = node["params"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["params", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // body is of types BlockStatement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitUnaryExpression = function visitUnaryExpression(node, state, path) {
  var visitor = this;
  // argument is of types Expression
  node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitUpdateExpression = function visitUpdateExpression(node, state, path) {
  var visitor = this;
  // argument is of types Expression
  node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitBinaryExpression = function visitBinaryExpression(node, state, path) {
  var visitor = this;
  // left is of types Expression
  node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
  // right is of types Expression
  node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitAssignmentExpression = function visitAssignmentExpression(node, state, path) {
  var visitor = this;
  // left is of types Pattern
  node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
  // right is of types Expression
  node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitLogicalExpression = function visitLogicalExpression(node, state, path) {
  var visitor = this;
  // left is of types Expression
  node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
  // right is of types Expression
  node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitMemberExpression = function visitMemberExpression(node, state, path) {
  var visitor = this;
  // object is of types Expression, Super
  node["object"] = visitor.accept(node["object"], state, path.concat(["object"]));
  // property is of types Expression
  node["property"] = visitor.accept(node["property"], state, path.concat(["property"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitConditionalExpression = function visitConditionalExpression(node, state, path) {
  var visitor = this;
  // test is of types Expression
  node["test"] = visitor.accept(node["test"], state, path.concat(["test"]));
  // alternate is of types Expression
  node["alternate"] = visitor.accept(node["alternate"], state, path.concat(["alternate"]));
  // consequent is of types Expression
  node["consequent"] = visitor.accept(node["consequent"], state, path.concat(["consequent"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitCallExpression = function visitCallExpression(node, state, path) {
  var visitor = this;
  // callee is of types Expression, Super
  node["callee"] = visitor.accept(node["callee"], state, path.concat(["callee"]));
  // arguments is a list with types Expression, SpreadElement
  node["arguments"] = node["arguments"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["arguments", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitSequenceExpression = function visitSequenceExpression(node, state, path) {
  var visitor = this;
  // expressions is a list with types Expression
  node["expressions"] = node["expressions"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["expressions", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitArrowFunctionExpression = function visitArrowFunctionExpression(node, state, path) {
  var visitor = this;
  // body is of types BlockStatement, Expression
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // id is of types Identifier
  if (node["id"]) {
    node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
  }
  // params is a list with types Pattern
  node["params"] = node["params"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["params", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitYieldExpression = function visitYieldExpression(node, state, path) {
  var visitor = this;
  // argument is of types Expression
  if (node["argument"]) {
    node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitTemplateLiteral = function visitTemplateLiteral(node, state, path) {
  var visitor = this;
  // quasis is a list with types TemplateElement
  node["quasis"] = node["quasis"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["quasis", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // expressions is a list with types Expression
  node["expressions"] = node["expressions"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["expressions", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitTaggedTemplateExpression = function visitTaggedTemplateExpression(node, state, path) {
  var visitor = this;
  // tag is of types Expression
  node["tag"] = visitor.accept(node["tag"], state, path.concat(["tag"]));
  // quasi is of types TemplateLiteral
  node["quasi"] = visitor.accept(node["quasi"], state, path.concat(["quasi"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitAssignmentProperty = function visitAssignmentProperty(node, state, path) {
  var visitor = this;
  // value is of types Pattern, Expression
  node["value"] = visitor.accept(node["value"], state, path.concat(["value"]));
  // key is of types Expression
  node["key"] = visitor.accept(node["key"], state, path.concat(["key"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitObjectPattern = function visitObjectPattern(node, state, path) {
  var visitor = this;
  // properties is a list with types AssignmentProperty
  node["properties"] = node["properties"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["properties", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitArrayPattern = function visitArrayPattern(node, state, path) {
  var visitor = this;
  // elements is a list with types Pattern
  if (node["elements"]) {
    node["elements"] = node["elements"].reduce(function(results, ea, i) {
      var result = visitor.accept(ea, state, path.concat(["elements", i]));
      if (Array.isArray(result)) results.push.apply(results, result);
      else results.push(result);
      return results;
    }, []);  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitRestElement = function visitRestElement(node, state, path) {
  var visitor = this;
  // argument is of types Pattern
  node["argument"] = visitor.accept(node["argument"], state, path.concat(["argument"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitAssignmentPattern = function visitAssignmentPattern(node, state, path) {
  var visitor = this;
  // left is of types Pattern
  node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
  // right is of types Expression
  node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitClassExpression = function visitClassExpression(node, state, path) {
  var visitor = this;
  // id is of types Identifier
  if (node["id"]) {
    node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
  }
  // superClass is of types Expression
  if (node["superClass"]) {
    node["superClass"] = visitor.accept(node["superClass"], state, path.concat(["superClass"]));
  }
  // body is of types ClassBody
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitMetaProperty = function visitMetaProperty(node, state, path) {
  var visitor = this;
  // meta is of types Identifier
  node["meta"] = visitor.accept(node["meta"], state, path.concat(["meta"]));
  // property is of types Identifier
  node["property"] = visitor.accept(node["property"], state, path.concat(["property"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitImportDeclaration = function visitImportDeclaration(node, state, path) {
  var visitor = this;
  // specifiers is a list with types ImportSpecifier, ImportDefaultSpecifier, ImportNamespaceSpecifier
  node["specifiers"] = node["specifiers"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["specifiers", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // source is of types Literal
  node["source"] = visitor.accept(node["source"], state, path.concat(["source"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitImportSpecifier = function visitImportSpecifier(node, state, path) {
  var visitor = this;
  // imported is of types Identifier
  node["imported"] = visitor.accept(node["imported"], state, path.concat(["imported"]));
  // local is of types Identifier
  node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitImportDefaultSpecifier = function visitImportDefaultSpecifier(node, state, path) {
  var visitor = this;
  // local is of types Identifier
  node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitImportNamespaceSpecifier = function visitImportNamespaceSpecifier(node, state, path) {
  var visitor = this;
  // local is of types Identifier
  node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitExportNamedDeclaration = function visitExportNamedDeclaration(node, state, path) {
  var visitor = this;
  // declaration is of types Declaration
  if (node["declaration"]) {
    node["declaration"] = visitor.accept(node["declaration"], state, path.concat(["declaration"]));
  }
  // specifiers is a list with types ExportSpecifier
  node["specifiers"] = node["specifiers"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["specifiers", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // source is of types Literal
  if (node["source"]) {
    node["source"] = visitor.accept(node["source"], state, path.concat(["source"]));
  }
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitExportSpecifier = function visitExportSpecifier(node, state, path) {
  var visitor = this;
  // exported is of types Identifier
  node["exported"] = visitor.accept(node["exported"], state, path.concat(["exported"]));
  // local is of types Identifier
  node["local"] = visitor.accept(node["local"], state, path.concat(["local"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitExportDefaultDeclaration = function visitExportDefaultDeclaration(node, state, path) {
  var visitor = this;
  // declaration is of types Declaration, Expression
  node["declaration"] = visitor.accept(node["declaration"], state, path.concat(["declaration"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitExportAllDeclaration = function visitExportAllDeclaration(node, state, path) {
  var visitor = this;
  // source is of types Literal
  node["source"] = visitor.accept(node["source"], state, path.concat(["source"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitRegExpLiteral = function visitRegExpLiteral(node, state, path) {
  var visitor = this;
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitFunctionDeclaration = function visitFunctionDeclaration(node, state, path) {
  var visitor = this;
  // id is of types Identifier
  node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
  // params is a list with types Pattern
  node["params"] = node["params"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["params", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // body is of types BlockStatement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitVariableDeclaration = function visitVariableDeclaration(node, state, path) {
  var visitor = this;
  // declarations is a list with types VariableDeclarator
  node["declarations"] = node["declarations"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["declarations", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitNewExpression = function visitNewExpression(node, state, path) {
  var visitor = this;
  // callee is of types Expression, Super
  node["callee"] = visitor.accept(node["callee"], state, path.concat(["callee"]));
  // arguments is a list with types Expression, SpreadElement
  node["arguments"] = node["arguments"].reduce(function(results, ea, i) {
    var result = visitor.accept(ea, state, path.concat(["arguments", i]));
    if (Array.isArray(result)) results.push.apply(results, result);
    else results.push(result);
    return results;
  }, []);  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitForOfStatement = function visitForOfStatement(node, state, path) {
  var visitor = this;
  // left is of types VariableDeclaration, Pattern
  node["left"] = visitor.accept(node["left"], state, path.concat(["left"]));
  // right is of types Expression
  node["right"] = visitor.accept(node["right"], state, path.concat(["right"]));
  // body is of types Statement
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}
Visitor.prototype.visitClassDeclaration = function visitClassDeclaration(node, state, path) {
  var visitor = this;
  // id is of types Identifier
  node["id"] = visitor.accept(node["id"], state, path.concat(["id"]));
  // superClass is of types Expression
  if (node["superClass"]) {
    node["superClass"] = visitor.accept(node["superClass"], state, path.concat(["superClass"]));
  }
  // body is of types ClassBody
  node["body"] = visitor.accept(node["body"], state, path.concat(["body"]));
  // loc is of types SourceLocation
  if (node["loc"]) {
    node["loc"] = visitor.accept(node["loc"], state, path.concat(["loc"]));
  }
  return node;
}

// >>>>>>>>>>>>> END OF AUTO GENERATED CODE >>>>>>>>>>>>>

module.exports = Visitor;
});
