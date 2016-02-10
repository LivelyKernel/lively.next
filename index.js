/*global process, global, require, exports*/

var lang = require("lively.lang");
var acorn = exports.acorn = require("acorn/dist/acorn");
acorn.walk = require("acorn/dist/walk");
acorn.parse_dammit = require("acorn/dist/acorn_loose");
exports.escodegen = require("escodegen");

lang.obj.extend(
  exports,
  {
    parse: parse,
    parseFunction: parseFunction,
    parseLikeOMeta: parseLikeOMeta,
    fuzzyParse: fuzzyParse,
    nodesAt: nodesAt,
  },
  require("./lib/acorn-extension"),
  require("./lib/mozilla-ast-visitors"),
  require("./lib/mozilla-ast-visitor-interface"),
  require("./lib/query"),
  require("./lib/transform"),
  require("./lib/comments"),
  require("./lib/code-categorizer"));


function parse(source, options) {
  // proxy function to acorn.parse.
  // Note that we will implement useful functionality on top of the pure
  // acorn interface and make it available here (such as more convenient
  // comment parsing). For using the pure acorn interface use the acorn
  // global.
  // See https://github.com/marijnh/acorn for full acorn doc and parse options.
  // options: {
  //   addSource: BOOL, -- add source property to each node
  //   addAstIndex: BOOL, -- each node gets an index  number
  //   withComments: BOOL, -- adds comment objects to Program/BlockStatements:
  //              {isBlock: BOOL, text: STRING, node: NODE,
  //               start: INTEGER, end: INTEGER, line: INTEGER, column: INTEGER}
  //   ecmaVersion: 3|5|6,
  //   allowReturnOutsideFunction: BOOL, -- Default is false
  //   locations: BOOL -- Default is false
  // }

  options = options || {};
  options.ecmaVersion = options.ecmaVersion || 6;
  options.sourceType = options.sourceType || "module";
  options.plugins = options.plugins || {};
  if (options.plugins.hasOwnProperty("jsx")) options.plugins.jsx = options.plugins.jsx;
  if (options.withComments) {
    // record comments
    delete options.withComments;
    var comments = [];
    options.onComment = function(isBlock, text, start, end, line, column) {
      comments.push({
        isBlock: isBlock,
        text: text, node: null,
        start: start, end: end,
        line: line, column: column
      });
    };
  }

  var ast = options.addSource ?
    acorn.walk.addSource(source, options) : // FIXME
    acorn.parse(source, options);

  if (options.addAstIndex && !ast.hasOwnProperty('astIndex')) acorn.walk.addAstIndex(ast);

  if (ast && comments) attachCommentsToAST({ast: ast, comments: comments, nodesWithComments: []});

  return ast;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function attachCommentsToAST(commentData) {
    // for each comment: assign the comment to a block-level AST node
    commentData = mergeComments(assignCommentsToBlockNodes(commentData));
    ast.allComments = commentData.comments;
  }

  function assignCommentsToBlockNodes(commentData) {
    comments.forEach(function(comment) {
      var node = lang.arr.detect(
        nodesAt(comment.start, ast).reverse(),
        function(node) { return node.type === 'BlockStatement' || node.type === 'Program'; });
      if (!node) node = ast;
      if (!node.comments) node.comments = [];
      node.comments.push(comment);
      commentData.nodesWithComments.push(node);
    });
    return commentData;
  }

  function mergeComments(commentData) {
    // coalesce non-block comments (multiple following lines of "// ...") into one comment.
    // This only happens if line comments aren't seperated by newlines
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

        // if the comments are seperated by a statement, don't merge
        var last = coalesceData.lastComment;
        var nodeInbetween = lang.arr.detect(blockNode.body, function(node) { return node.start >= last.end && node.end <= comment.start; });
        if (nodeInbetween) {
          coalesceData.lastComment = comment;
          return coalesceData;
        }

        // if the comments are seperated by a newline, don't merge
        var codeInBetween = source.slice(last.end, comment.start);
        if (/[\n\r][\n\r]+/.test(codeInBetween)) {
          coalesceData.lastComment = comment;
          return coalesceData;
        }

        // merge comments into one
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
  if (options.plugins.hasOwnProperty("jsx")) options.plugins.jsx = options.plugins.jsx;

  var src = '(' + source + ')',
    ast = acorn.parse(src);
  /*if (options.addSource) */acorn.walk.addSource(ast, src);
  return ast.body[0].expression;
}

function parseLikeOMeta(src, rule) {
  // only an approximation, _like_ OMeta
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
    src = '({' + src + '})'; // to make it valid
    ast = parse(src);
    ast = ast.children[0].properties[0];
    ast.setParent(undefined);
    break;
  case 'categoryFragment':
  case 'traitFragment':
    src = '[' + src + ']'; // to make it valid
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
  // options: verbose, addSource, type
  options = options || {};
  options.ecmaVersion = options.ecmaVersion || 6;
  options.sourceType = options.sourceType || "module";
  options.plugins = options.plugins || {};
  if (options.plugins.hasOwnProperty("jsx")) options.plugins.jsx = options.plugins.jsx;

  var ast, safeSource, err;
  if (options.type === 'LabeledStatement') { safeSource = '$={' + source + '}'; }
  try {
    // we only parse to find errors
    ast = parse(safeSource || source, options);
    if (safeSource) ast = null; // we parsed only for finding errors
    else if (options.addSource) acorn.walk.addSource(ast, source);
  } catch (e) { err = e; }
  if (err && err.raisedAt !== undefined) {
    if (safeSource) { // fix error pos
      err.pos -= 3; err.raisedAt -= 3; err.loc.column -= 3; }
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
    if (options.addSource) acorn.walk.addSource(ast, source);
    ast.isFuzzy = true;
    ast.parseError = err;
  }
  return ast;
}

function nodesAt(pos, ast) {
  ast = typeof ast === 'string' ? this.parse(ast) : ast;
  return acorn.walk.findNodesIncluding(ast, pos);
}
