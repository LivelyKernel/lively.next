import { arr } from 'lively.lang';
import {
  acorn,
  loose,
  walk,
  addAstIndex, findNodesIncluding,
  custom
} from './acorn-extension.js';

import { AllNodesVisitor } from './visitors.js';

export {
  walk,
  parse,
  parseFunction,
  fuzzyParse,
  addSource
};

custom.addSource = addSource;

function addSource (parsed, source) {
  if (typeof parsed === 'string') {
    source = parsed;
    parsed = parse(parsed);
  }
  source && AllNodesVisitor.run(parsed, (node, state, path) =>
    !node.source && (node.source = source.slice(node.start, node.end)));
  return parsed;
}

function nodesAt (pos, ast) {
  ast = typeof ast === 'string' ? this.parse(ast) : ast;
  return findNodesIncluding(ast, pos);
}

function parseFunction (source, options = {}) {
  const src = '(' + source + ')';
  const offset = -1;
  const parsed = parse(src, options);

  AllNodesVisitor.run(parsed, (node, state, path) => {
    if (node._positionFixed) return;
    node._positionFixed = true;
    if (node.start || node.start === 0) {
      node.start += offset;
      node.end += offset;
    }
    if (options.addSource && (!node.source)) {
      node.source = source.slice(node.start, node.end);
    }
  });

  return parsed.body[0].expression;
}

function fuzzyParse (source, options) {
  // options: verbose, addSource, type
  options = options || {};
  options.ecmaVersion = options.ecmaVersion || 11;
  options.sourceType = options.sourceType || 'module';
  options.plugins = options.plugins || {};
  const comments = [];
  if (options.withComments) {
    options.onComment = (isBlock, text) => comments.push({
      isBlock, text
    });
  }
  options.plugins.jsx = options.plugins.hasOwnProperty('jsx')
    ? options.plugins.jsx
    : true;
  options.plugins.asyncawait = options.plugins.hasOwnProperty('asyncawait')
    ? options.plugins.asyncawait
    : { inAsyncFunction: true };
  options.plugins.objectSpread = options.plugins.hasOwnProperty('objectSpread')
    ? options.plugins.objectSpread
    : true;

  let ast, safeSource, err;
  if (options.type === 'LabeledStatement') { safeSource = '$={' + source + '}'; }
  try {
    // we only parse to find errors
    ast = parse(safeSource || source, options);
    if (safeSource) ast = null; // we parsed only for finding errors
    else if (options.addSource) addSource(ast, source);
  } catch (e) { err = e; }
  if (err && err.raisedAt !== undefined) {
    if (safeSource) { // fix error pos
      err.pos -= 3; err.raisedAt -= 3; err.loc.column -= 3;
    }
    let parseErrorSource = '';
    parseErrorSource += source.slice(err.raisedAt - 20, err.raisedAt);
    parseErrorSource += '<-error->';
    parseErrorSource += source.slice(err.raisedAt, err.raisedAt + 20);
    options.verbose && console.log('parse error: ' + parseErrorSource);
    err.parseErrorSource = parseErrorSource;
  } else if (err && options.verbose) {
    console.log('' + err + err.stack);
  }
  if (!ast) {
    ast = loose.parse(source, options);
    if (options.addSource) addSource(ast, source);
    ast.isFuzzy = true;
    ast.parseError = err;
  }
  if (options.withComments) ast.comments = comments;
  return ast;
}

function acornParseAsyncAware (source, options) {
  const asyncSource = `async () => {\n${source}\n}`;
  const offset = 'async () => {\n'.length;

  if (options.onComment) {
    const orig = options.onComment;
    options.onComment = function (isBlock, text, start, end, line, column) {
      start -= offset;
      end -= offset;
      return orig.call(this, isBlock, text, start, end, line, column);
    };
  }

  let parsed = acorn.parse(asyncSource, options);
  if (parsed.loc) {
    var SourceLocation = parsed.loc.constructor;
  }

  parsed = { body: parsed.body[0].expression.body.body, sourceType: 'module', type: 'Program' };

  AllNodesVisitor.run(parsed, (node, state, path) => {
    if (node._positionFixed) return;
    node._positionFixed = true;
    if (node.start || node.start === 0) {
      node.start -= offset;
      node.end -= offset;
    }
    if (node.loc && SourceLocation) {
      const { start: { column: sc, line: sl }, end: { column: ec, line: el } } = node.loc;
      node.loc = new SourceLocation(options, { column: sc, line: sl - 1 }, { column: ec, line: el - 1 });
    }
    if (options.addSource && (!node.source)) {
      node.source = source.slice(node.start, node.end);
    }
  });

  parsed.start = parsed.body[0].start;
  parsed.end = arr.last(parsed.body).end;
  if (options.addSource) parsed.source = source;
  if (parsed.body[0].loc && SourceLocation) {
    parsed.loc = new SourceLocation(options, parsed.body[0].loc.start, arr.last(parsed.body).loc.end);
  }

  return parsed;
}

function parse (source, options) {
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
  options.ecmaVersion = options.ecmaVersion || 11;
  options.allowAwaitOutsideFunction = true;
  options.sourceType = options.sourceType || 'module';
  if (!options.hasOwnProperty('allowImportExportEverywhere')) { options.allowImportExportEverywhere = true; }
  options.plugins = options.plugins || {};
  options.plugins.jsx = options.plugins.hasOwnProperty('jsx')
    ? options.plugins.jsx
    : true;
  options.plugins.asyncawait = options.plugins.hasOwnProperty('asyncawait')
    ? options.plugins.asyncawait
    : { inAsyncFunction: true };
  options.plugins.objectSpread = options.plugins.hasOwnProperty('objectSpread')
    ? options.plugins.objectSpread
    : true;

  if (options.withComments) {
    // record comments
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

  try {
    var parsed = acorn.parse(source, options);
  } catch (err) {
    if (typeof SyntaxError !== 'undefined' && err instanceof SyntaxError && err.loc) {
      const lines = source.split('\n');
      const { message, loc: { line: row, column }, pos } = err;
      const line = lines[row - 1];
      const newMessage = `Syntax error at line ${row} column ${column} (index ${pos}) "${message}"\nsource: ${line.slice(0, column)}<--SyntaxError-->${line.slice(column)}`;
      const betterErr = new SyntaxError(newMessage);
      betterErr.loc = { line: row, column };
      betterErr.pos = pos;
      throw betterErr;
    } else throw err;
  }

  if (options.addSource) addSource(parsed, source);

  if (options.addAstIndex && !parsed.hasOwnProperty('astIndex')) addAstIndex(parsed);

  if (parsed && comments) attachCommentsToAST({ ast: parsed, comments: comments, nodesWithComments: [] });

  return parsed;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function attachCommentsToAST (commentData) {
    // for each comment: assign the comment to a block-level AST node
    commentData = mergeComments(assignCommentsToBlockNodes(commentData));
    parsed.allComments = commentData.comments;
  }

  function assignCommentsToBlockNodes (commentData) {
    comments.forEach(function (comment) {
      let node = nodesAt(comment.start, parsed).reverse().find(
        function (node) { return node.type === 'BlockStatement' || node.type === 'Program'; });
      if (!node) node = parsed;
      if (!node.comments) node.comments = [];
      node.comments.push(comment);
      commentData.nodesWithComments.push(node);
    });
    return commentData;
  }

  function mergeComments (commentData) {
    // coalesce non-block comments (multiple following lines of "// ...") into one comment.
    // This only happens if line comments aren't seperated by newlines
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

        // if the comments are seperated by a statement, don't merge
        const last = coalesceData.lastComment;
        const nodeInbetween = blockNode.body.find(function (node) { return node.start >= last.end && node.end <= comment.start; });
        if (nodeInbetween) {
          coalesceData.lastComment = comment;
          return coalesceData;
        }

        // if the comments are seperated by a newline, don't merge
        const codeInBetween = source.slice(last.end, comment.start);
        if (/[\n\r][\n\r]+/.test(codeInBetween)) {
          coalesceData.lastComment = comment;
          return coalesceData;
        }

        // merge comments into one
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
