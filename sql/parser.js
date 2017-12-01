(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.sqlparser = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

const Parser = require('./lib/parser');
const util = require('./lib/util');

module.exports = { Parser, util };

},{"./lib/parser":2,"./lib/util":4}],2:[function(require,module,exports){
'use strict';

const parseFn = require('./../pegjs-parser').parse;

class Parser {
    parse(sql) {
        return parseFn(sql);
    }
}

module.exports = Parser;

},{"./../pegjs-parser":9}],3:[function(require,module,exports){
'use strict';

const has = require('has');

const escapeMap = {
    '\0': '\\0',
    '\'': '\\\'',
    '"': '\\"',
    '\b': '\\b',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\x1a': '\\Z', // EOF
    '\\': '\\\\'
};

function escape(str) {
    const res = [];
    let char;

    for (let i = 0, l = str.length; i < l; ++i) {
        char = str[i];
        const escaped = escapeMap[char];
        if (escaped) char = escaped;
        res.push(char);
    }

    return res.join('');
}

function identifierToSql(ident) {
    return `"${ident}"`;
}

function literalToSQL(literal) {
    const { type } = literal;
    let { value } = literal;

    if (type === 'number') {
        /* nothing */
    } else if (type === 'string') value = '\'' + escape(value) + '\'';
    else if (type === 'bool') value = value ? 'TRUE' : 'FALSE';
    else if (type === 'null') value = 'NULL';
    else if (type === 'star') value = '*';
    else if (['time', 'date', 'timestamp'].includes(type)) value = `${type.toUpperCase()} '${value}'`;

    return !literal.parentheses ? value : '(' + value + ')';
}

let exprToSQLConvertFn = {};

function exprToSQL(expr) {
    return exprToSQLConvertFn[expr.type] ? exprToSQLConvertFn[expr.type](expr) : literalToSQL(expr);
}

function aggrToSQL(expr) {
    /** @type {Object} */
    const args = expr.args;
    let str = exprToSQL(args.expr);
    const fnName = expr.name;

    if (fnName === 'COUNT') {
        if (has(args, 'distinct') && args.distinct !== null) str = 'DISTINCT ' + str;
    }

    return fnName + '(' + str + ')';
}

function binaryToSQL(expr) {
    let operator = expr.operator;
    let rstr = exprToSQL(expr.right);

    if (Array.isArray(rstr)) {
        if (operator === '=') operator = 'IN';
        if (operator === '!=') operator = 'NOT IN';
        if (operator === 'BETWEEN') rstr = rstr[0] + ' AND ' + rstr[1];
        else rstr = '(' + rstr.join(', ') + ')';
    }

    const str = exprToSQL(expr.left) + ' ' + operator + ' ' + rstr;

    return !expr.parentheses ? str : '(' + str + ')';
}

function caseToSQL(expr) {
    const res = ['CASE'];
    const conditions = expr.args;

    if (expr.expr) res.push(exprToSQL(expr.expr));

    for (let i = 0, l = conditions.length; i < l; ++i) {
        res.push(conditions[i].type.toUpperCase()); // when/else
        if (conditions[i].cond) {
            res.push(exprToSQL(conditions[i].cond));
            res.push('THEN');
        }
        res.push(exprToSQL(conditions[i].result));
    }

    res.push('END');

    return res.join(' ');
}

function castToSQL(expr) {
    let str = 'CAST(';
    str += exprToSQL(expr.expr) + ' AS ';
    str += expr.target.dataType + (expr.target.length ? '(' + expr.target.length + ')' : '');
    str += ')';

    return str;
}

function columnRefToSQL(expr) {
    let str = expr.column !== '*' ? identifierToSql(expr.column) : '*';
    if (has(expr, 'table') && expr.table !== null) str = identifierToSql(expr.table) + '.' + str;
    return !expr.parentheses ? str : '(' + str + ')';
}

function getExprListSQL(exprList) {
    return exprList.map(exprToSQL);
}

function funcToSQL(expr) {
    const str = expr.name + '(' + exprToSQL(expr.args).join(', ') + ')';
    return !expr.parentheses ? str : '(' + str + ')';
}

/**
 * Stringify column expressions
 *
 * @param {Array} columns
 * @return {string}
 */
function columnsToSQL(columns) {
    return columns
        .map((column) => {
            let str = exprToSQL(column.expr);

            if (column.as !== null) {
                str += ' AS ';
                if (column.as.match(/^[a-z_][0-9a-z_]*$/i)) str += identifierToSql(column.as);
                else str += '\'' + column.as + '\'';
            }

            return str;
        })
        .join(', ');
}

/**
 * @param {Array} tables
 * @return {string}
 */
function tablesToSQL(tables) {
    const baseTable = tables[0];
    const clauses = [];
    if (baseTable.type === 'dual') return 'DUAL';
    let str = baseTable.table ? identifierToSql(baseTable.table) : exprToSQL(baseTable.expr);

    if (baseTable.db && baseTable.db !== null) str = baseTable.db + '.' + str;
    if (baseTable.as !== null) str += ' AS ' + identifierToSql(baseTable.as);

    clauses.push(str);

    for (let i = 1; i < tables.length; i++) {
        const joinExpr = tables[i];

        str = (joinExpr.join && joinExpr.join !== null) ? ' ' + joinExpr.join + ' ' : str = ', ';

        if (joinExpr.table) {
            if (joinExpr.db !== null) str += (joinExpr.db + '.');
            str += identifierToSql(joinExpr.table);
        } else {
            str += exprToSQL(joinExpr.expr);
        }

        if (joinExpr.as !== null) str += ' AS ' + identifierToSql(joinExpr.as);
        if (has(joinExpr, 'on') && joinExpr.on !== null) str += ' ON ' + exprToSQL(joinExpr.on);
        if (has(joinExpr, 'using')) str += ' USING (' + joinExpr.using.map(identifierToSql).join(', ') + ')';

        clauses.push(str);
    }

    return clauses.join('');
}

/**
 * @param {Object}          stmt
 * @param {?Array}          stmt.options
 * @param {?string}         stmt.distinct
 * @param {?Array|string}   stmt.columns
 * @param {?Array}          stmt.from
 * @param {?Object}         stmt.where
 * @param {?Array}          stmt.groupby
 * @param {?Object}         stmt.having
 * @param {?Array}          stmt.orderby
 * @param {?Array}          stmt.limit
 * @return {string}
 */
function selectToSQL(stmt) {
    const clauses = ['SELECT'];

    if (has(stmt, 'options') && Array.isArray(stmt.options)) clauses.push(stmt.options.join(' '));
    if (has(stmt, 'distinct') && stmt.distinct !== null) clauses.push(stmt.distinct);

    if (stmt.columns !== '*') clauses.push(columnsToSQL(stmt.columns));
    else clauses.push('*');

    // FROM + joins
    if (Array.isArray(stmt.from)) clauses.push('FROM', tablesToSQL(stmt.from));

    if (has(stmt, 'where') && stmt.where !== null) clauses.push('WHERE ' + exprToSQL(stmt.where));
    if (Array.isArray(stmt.groupby)) clauses.push('GROUP BY', getExprListSQL(stmt.groupby).join(', '));
    if (has(stmt, 'having') && stmt.having !== null) clauses.push('HAVING ' + exprToSQL(stmt.having));

    if (Array.isArray(stmt.orderby)) {
        const orderExpressions = stmt.orderby.map(expr => exprToSQL(expr.expr) + ' ' + expr.type);
        clauses.push('ORDER BY', orderExpressions.join(', '));
    }

    if (Array.isArray(stmt.limit)) clauses.push('LIMIT', stmt.limit.map(exprToSQL));

    return clauses.join(' ');
}

function unaryToSQL(expr) {
    const str = expr.operator + ' ' + exprToSQL(expr.expr);
    return !expr.parentheses ? str : '(' + str + ')';
}

function unionToSQL(stmt) {
    const res = [selectToSQL(stmt)];

    while (stmt._next) {
        res.push('UNION', selectToSQL(stmt._next));
        stmt = stmt._next;
    }

    return res.join(' ');
}

exprToSQLConvertFn = {
    aggr_func: aggrToSQL,
    binary_expr: binaryToSQL,
    case: caseToSQL,
    cast: castToSQL,
    column_ref: columnRefToSQL,
    expr_list: expr => getExprListSQL(expr.value),
    function: funcToSQL,
    select: (expr) => {
        let str = selectToSQL(expr);
        if (expr.parentheses) str = '(' + str + ')';
        return str;
    },
    unary_expr: unaryToSQL
};

module.exports = function toSQL(ast) {
    if (ast.type !== 'select') throw new Error('Only SELECT statements supported at the moment');
    return unionToSQL(ast);
};

},{"has":8}],4:[function(require,module,exports){
'use strict';

const { ImplementationError } = require('flora-errors');

const astToSQL = require('./sql');

/**
 * @param {(Array|boolean|string|number|null)} value
 * @return {Object}
 */
function createValueExpr(value) {
    let expr;
    const type = typeof value;

    if (Array.isArray(value)) expr = { type: 'expr_list', value: value.map(createValueExpr) };
    else if (type === 'boolean') expr = { type: 'bool', value };
    else if (type === 'string') expr = { type: 'string', value };
    else if (type === 'number') expr = { type: 'number', value };
    else if (value === null) expr = { type: 'null', value: null };
    else throw new ImplementationError('Cannot convert value "' + value + '" to SQL');

    return expr;
}

/**
 * @param operator
 * @param left
 * @param right
 * @return {Object}
 */
function createBinaryExpr(operator, left, right) {
    const expr = { operator, type: 'binary_expr' };

    expr.left = left && left.type ? expr.left = left : createValueExpr(left);

    if (operator === 'BETWEEN') {
        expr.right = {
            type: 'expr_list',
            value: [createValueExpr(right[0]), createValueExpr(right[1])]
        };
    } else {
        expr.right = right && right.type
        ? expr.right = right
        : expr.right = createValueExpr(right);
    }

    return expr;
}

/**
 * Replace param expressions
 *
 * @param {Object} ast      - AST object
 * @param {Object} data     - Keys = parameter names, values = parameter values
 * @return {Object}         - Newly created AST object
 */
function replaceParams(ast, data) {
    Object.keys(ast)
        .filter((key) => {
            const value = ast[key];
            return Array.isArray(value) || (typeof value === 'object' && value !== null);
        })
        .forEach((key) => {
            const expr = ast[key];

            if (!(typeof expr === 'object' && expr.type === 'param')) return replaceParams(expr, data);

            if (data[expr.value] === undefined) throw new Error(`no value for parameter :${expr.value} found`);
            ast[key] = createValueExpr(data[expr.value]);
            return null;
        });

    return ast;
}

module.exports = {
    createBinaryExpr,
    createValueExpr,
    replaceParams: (ast, params) => replaceParams(JSON.parse(JSON.stringify(ast)), params),
    astToSQL
};

},{"./sql":3,"flora-errors":5}],5:[function(require,module,exports){
'use strict';

const has = require('has');

class FloraError extends Error {
    constructor(message, ...args) {
        super(message, ...args);

        this.name = this.constructor.name;

        /**
         * @type {string}
         * @name FloraError#message
         * @readonly
         */
        this.message = message;

        /**
         * @type {number}
         * @name FloraError#httpStatusCode
         * @readonly
         */
        this.httpStatusCode = 500; // HTTP status for "other errors"

        Error.captureStackTrace(this, this.constructor);
    }
}

class RequestError extends FloraError {
    constructor(...args) {
        super(...args);
        this.httpStatusCode = 400;
    }
}

class AuthenticationError extends FloraError {
    constructor(...args) {
        super(...args);
        this.httpStatusCode = 401;
    }
}

class AuthorizationError extends FloraError {
    constructor(...args) {
        super(...args);
        this.httpStatusCode = 403;
    }
}

class NotFoundError extends FloraError {
    constructor(...args) {
        super(...args);
        this.httpStatusCode = 404;
    }
}

class ImplementationError extends FloraError {
    constructor(...args) {
        super(...args);
        this.httpStatusCode = 500;
    }
}

class DataError extends FloraError {
    constructor(...args) {
        super(...args);
        this.httpStatusCode = 500;
    }
}

class ConnectionError extends FloraError {
    constructor(...args) {
        super(...args);
        this.httpStatusCode = 503;
    }
}

/**
 * Converts an error object to a stringifyable object format for use
 * in Flora responses.
 *
 * @param {FloraError} err object
 * @param {Object=} options
 */
function format(err, options) {
    const error = { message: 'Internal Server Error' };

    options = options || {};

    if (err.httpStatusCode && err.httpStatusCode < 500) error.message = err.message;

    // TODO: code: err.code ??

    if (options.exposeErrors) {
        error.message = err.message;
        error.stack = err.stack.split(/\r?\n/);

        if (err.info) {
            Object.keys(err.info).forEach((key) => {
                if (!has(error, key) &&
                    has(err.info, key)) error[key] = err.info[key];
            });
        }
    }

    return error;
}

module.exports = {
    RequestError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ImplementationError,
    DataError,
    ConnectionError,
    FloraError,
    format
};

},{"has":8}],6:[function(require,module,exports){
'use strict';

/* eslint no-invalid-this: 1 */

var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
var slice = Array.prototype.slice;
var toStr = Object.prototype.toString;
var funcType = '[object Function]';

module.exports = function bind(that) {
    var target = this;
    if (typeof target !== 'function' || toStr.call(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
    }
    var args = slice.call(arguments, 1);

    var bound;
    var binder = function () {
        if (this instanceof bound) {
            var result = target.apply(
                this,
                args.concat(slice.call(arguments))
            );
            if (Object(result) === result) {
                return result;
            }
            return this;
        } else {
            return target.apply(
                that,
                args.concat(slice.call(arguments))
            );
        }
    };

    var boundLength = Math.max(0, target.length - args.length);
    var boundArgs = [];
    for (var i = 0; i < boundLength; i++) {
        boundArgs.push('$' + i);
    }

    bound = Function('binder', 'return function (' + boundArgs.join(',') + '){ return binder.apply(this,arguments); }')(binder);

    if (target.prototype) {
        var Empty = function Empty() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
    }

    return bound;
};

},{}],7:[function(require,module,exports){
'use strict';

var implementation = require('./implementation');

module.exports = Function.prototype.bind || implementation;

},{"./implementation":6}],8:[function(require,module,exports){
var bind = require('function-bind');

module.exports = bind.call(Function.call, Object.prototype.hasOwnProperty);

},{"function-bind":7}],9:[function(require,module,exports){
/*
 * Generated by PEG.js 0.10.0.
 *
 * http://pegjs.org/
 */

"use strict";

function peg$subclass(child, parent) {
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
}

function peg$SyntaxError(message, expected, found, location) {
  this.message  = message;
  this.expected = expected;
  this.found    = found;
  this.location = location;
  this.name     = "SyntaxError";

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, peg$SyntaxError);
  }
}

peg$subclass(peg$SyntaxError, Error);

peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return "\"" + literalEscape(expectation.text) + "\"";
        },

        "class": function(expectation) {
          var escapedParts = "",
              i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts += expectation.parts[i] instanceof Array
              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
              : classEscape(expectation.parts[i]);
          }

          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
        },

        any: function(expectation) {
          return "any character";
        },

        end: function(expectation) {
          return "end of input";
        },

        other: function(expectation) {
          return expectation.description;
        }
      };

  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }

  function literalEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g,  '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function classEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/-/g,  '\\-')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }

  function describeExpected(expected) {
    var descriptions = new Array(expected.length),
        i, j;

    for (i = 0; i < expected.length; i++) {
      descriptions[i] = describeExpectation(expected[i]);
    }

    descriptions.sort();

    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }

    switch (descriptions.length) {
      case 1:
        return descriptions[0];

      case 2:
        return descriptions[0] + " or " + descriptions[1];

      default:
        return descriptions.slice(0, -1).join(", ")
          + ", or "
          + descriptions[descriptions.length - 1];
    }
  }

  function describeFound(found) {
    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
  }

  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};

  var peg$FAILED = {},

      peg$startRuleFunctions = { start: peg$parsestart },
      peg$startRuleFunction  = peg$parsestart,

      peg$c0 = function(head, tail) {
            var cur = head;
            for (var i = 0; i < tail.length; i++) {
              cur._next = tail[i][3];
              cur = cur._next
            }
            return head;
          },
      peg$c1 = "(",
      peg$c2 = peg$literalExpectation("(", false),
      peg$c3 = ")",
      peg$c4 = peg$literalExpectation(")", false),
      peg$c5 = function(s) {
            return s[2];
          },
      peg$c6 = function(opts, d, c, f, w, g, h, o, l) {
            return {
              type: 'select',
              options: opts,
              distinct: d,
              columns: c,
              from: f,
              where: w,
              groupby: g,
              having: h,
              orderby: o,
              limit: l
            };
        },
      peg$c7 = function(head, tail) {
          var opts = [head];
          for (var i = 0, l = tail.length; i < l; ++i) {
            opts.push(tail[i][1]);
          }
          return opts;
        },
      peg$c8 = function(option) { return option; },
      peg$c9 = function() { return '*'; },
      peg$c10 = function(head, tail) {
            return createList(head, tail);
          },
      peg$c11 = function(tbl) {
            return {
              expr: {
                type: 'column_ref',
                table: tbl,
                column: '*'
              },
              as: null
            };
          },
      peg$c12 = function(e, alias) {
            return { expr: e, as: alias };
          },
      peg$c13 = function(i) { return i; },
      peg$c14 = function(l) { return l; },
      peg$c15 = function(head, tail) {
            tail.unshift(head);
            return tail;
          },
      peg$c16 = function(t) { return t; },
      peg$c17 = function(op, t, head, tail) {
            t.join = op;
            t.using = createList(head, tail);
            return t;
          },
      peg$c18 = function(op, t, expr) {
            t.join = op;
            t.on   = expr;
            return t;
          },
      peg$c19 = function(op, stmt, alias, expr) {
          stmt.parentheses = true;
          return {
            expr: stmt,
            as: alias,
            join: op,
            on: expr
          };
        },
      peg$c20 = function() {
            return {
              type: 'dual'
            };
        },
      peg$c21 = function(t, alias) {
            if (t.type === 'var') {
              t.as = alias;
              return t;
            } else {
              return {
                db: t.db,
                table: t.table,
                as: alias
              };
            }
          },
      peg$c22 = function(stmt, alias) {
            stmt.parentheses = true;
            return {
              expr: stmt,
              as: alias
            };
          },
      peg$c23 = function() { return 'LEFT JOIN'; },
      peg$c24 = function() { return 'INNER JOIN'; },
      peg$c25 = function(dt, tail) {
            var obj = { db: null, table: dt };
            if (tail !== null) {
              obj.db = dt;
              obj.table = tail[3];
            }
            return obj;
          },
      peg$c26 = function(v) {
            v.db = null;
            v.table = v.name;
            return v;
          },
      peg$c27 = function(e) { return e; },
      peg$c28 = function(e, d) {
          var obj = { expr: e, type: 'ASC' };
          if (d === 'DESC') obj.type = 'DESC';
          return obj;
        },
      peg$c29 = function(i1, tail) {
            var res = [i1];
            if (tail === null) res.unshift({ type: 'number', value: 0 });
            else res.push(tail[2]);
            return res;
          },
      peg$c30 = function(t, l, w) {
            return {
              type: 'update',
              db: t.db,
              table: t.table,
              set: l,
              where: w
            };
          },
      peg$c31 = "=",
      peg$c32 = peg$literalExpectation("=", false),
      peg$c33 = function(c, v) {
            return { column: c, value: v };
          },
      peg$c34 = function(ri, t, c, v) {
            return {
              type: ri,
              db: t.db,
              table: t.table,
              columns: c,
              values: v
            };
          },
      peg$c35 = function() { return 'insert'; },
      peg$c36 = function() { return 'replace'; },
      peg$c37 = function(l) {
            return l;
          },
      peg$c38 = function(head, tail) {
            var el = { type: 'expr_list' };
            el.value = createList(head, tail);
            return el;
          },
      peg$c39 = function(expr, condition_list, otherwise) {
            if (otherwise) condition_list.push(otherwise);
            return {
              type: 'case',
              expr: expr || null,
              args: condition_list
            };
          },
      peg$c40 = function(condition, result) {
          return {
            type: 'when',
            cond: condition,
            result: result
          };
        },
      peg$c41 = function(result) {
          return { type: 'else', result: result };
        },
      peg$c42 = function(head, tail) {
            return createBinaryExprChain(head, tail);
          },
      peg$c43 = "!",
      peg$c44 = peg$literalExpectation("!", false),
      peg$c45 = function(expr) {
            return createUnaryExpr('NOT', expr);
          },
      peg$c46 = function(left, rh) {
            if (rh === null) return left;
            else if (rh.type === 'arithmetic') return createBinaryExprChain(left, rh.tail);
            else return createBinaryExpr(rh.op, left, rh.right);
          },
      peg$c47 = function(op, stmt) {
          stmt.parentheses = true;
          return createUnaryExpr(op, stmt);
        },
      peg$c48 = function(nk) { return nk[0] + ' ' + nk[2]; },
      peg$c49 = function(l) {
            return { type: 'arithmetic', tail: l };
          },
      peg$c50 = ">=",
      peg$c51 = peg$literalExpectation(">=", false),
      peg$c52 = ">",
      peg$c53 = peg$literalExpectation(">", false),
      peg$c54 = "<=",
      peg$c55 = peg$literalExpectation("<=", false),
      peg$c56 = "<>",
      peg$c57 = peg$literalExpectation("<>", false),
      peg$c58 = "<",
      peg$c59 = peg$literalExpectation("<", false),
      peg$c60 = "!=",
      peg$c61 = peg$literalExpectation("!=", false),
      peg$c62 = function(right) {
            return { op: 'IS', right: right };
          },
      peg$c63 = function(right) {
            return { op: 'IS NOT', right: right };
        },
      peg$c64 = function(op, begin, end) {
            return {
              op: op,
              right: {
                type: 'expr_list',
                value: [begin, end]
              }
            };
          },
      peg$c65 = function(op, right) {
            return { op: op, right: right };
          },
      peg$c66 = function(op, l) {
            return { op: op, right: l };
          },
      peg$c67 = function(op, e) {
            return { op: op, right: e };
          },
      peg$c68 = "+",
      peg$c69 = peg$literalExpectation("+", false),
      peg$c70 = "-",
      peg$c71 = peg$literalExpectation("-", false),
      peg$c72 = function(head, tail) {
            return createBinaryExprChain(head, tail)
          },
      peg$c73 = "*",
      peg$c74 = peg$literalExpectation("*", false),
      peg$c75 = "/",
      peg$c76 = peg$literalExpectation("/", false),
      peg$c77 = "%",
      peg$c78 = peg$literalExpectation("%", false),
      peg$c79 = function(e) {
            e.parentheses = true;
            return e;
          },
      peg$c80 = function(tbl, col) {
            return {
              type: 'column_ref',
              table: tbl,
              column: col
            };
          },
      peg$c81 = function(col) {
            return {
              type: 'column_ref',
              table: null,
              column: col
            };
          },
      peg$c82 = function(name) { return reservedMap[name.toUpperCase()] === true; },
      peg$c83 = function(name) {
            return name;
          },
      peg$c84 = "\"",
      peg$c85 = peg$literalExpectation("\"", false),
      peg$c86 = /^[^"]/,
      peg$c87 = peg$classExpectation(["\""], true, false),
      peg$c88 = function(chars) { return chars.join(''); },
      peg$c89 = "'",
      peg$c90 = peg$literalExpectation("'", false),
      peg$c91 = /^[^']/,
      peg$c92 = peg$classExpectation(["'"], true, false),
      peg$c93 = "`",
      peg$c94 = peg$literalExpectation("`", false),
      peg$c95 = /^[^`]/,
      peg$c96 = peg$classExpectation(["`"], true, false),
      peg$c97 = function(name) { return name; },
      peg$c98 = function(start, parts) { return start + parts.join(''); },
      peg$c99 = /^[A-Za-z_]/,
      peg$c100 = peg$classExpectation([["A", "Z"], ["a", "z"], "_"], false, false),
      peg$c101 = /^[A-Za-z0-9_]/,
      peg$c102 = peg$classExpectation([["A", "Z"], ["a", "z"], ["0", "9"], "_"], false, false),
      peg$c103 = /^[A-Za-z0-9_:]/,
      peg$c104 = peg$classExpectation([["A", "Z"], ["a", "z"], ["0", "9"], "_", ":"], false, false),
      peg$c105 = ":",
      peg$c106 = peg$literalExpectation(":", false),
      peg$c107 = function(l) {
            return { type: 'param', value: l[1] };
          },
      peg$c108 = function(name, e) {
            return {
              type: 'aggr_func',
              name: name,
              args: {
                expr: e
              }
            };
          },
      peg$c109 = function(name, arg) {
            return {
              type: 'aggr_func',
              name: name,
              args: arg
            };
          },
      peg$c110 = function(e) { return { expr: e }; },
      peg$c111 = function(d, c) { return { distinct: d, expr: c }; },
      peg$c112 = function() { return { type: 'star', value: '*' }; },
      peg$c113 = function(name, l) {
            return {
              type: 'function',
              name: name,
              args: l ? l: { type: 'expr_list', value: [] }
            };
          },
      peg$c114 = function(e, t) {
          return {
            type: 'cast',
            expr: e,
            target: t
          };
        },
      peg$c115 = function(e, s, t) { /* MySQL cast to un-/signed integer */
          return {
            type: 'cast',
            expr: e,
            target: {
              dataType: s + (t ? ' ' + t: '')
            }
          };
        },
      peg$c116 = function() {
            return { type: 'null', value: null };
          },
      peg$c117 = function() {
            return { type: 'bool', value: true };
          },
      peg$c118 = function() {
            return { type: 'bool', value: false };
          },
      peg$c119 = function(ca) {
            return {
              type: 'string',
              value: ca[1].join('')
            };
          },
      peg$c120 = function(type, ca) {
            return {
              type: type.toLowerCase(),
              value: ca[1].join('')
            };
          },
      peg$c121 = /^[^'\\\0-\x1F\x7F]/,
      peg$c122 = peg$classExpectation(["'", "\\", ["\0", "\x1F"], "\x7F"], true, false),
      peg$c123 = "\\'",
      peg$c124 = peg$literalExpectation("\\'", false),
      peg$c125 = function() { return "'";  },
      peg$c126 = "\\\"",
      peg$c127 = peg$literalExpectation("\\\"", false),
      peg$c128 = function() { return '"';  },
      peg$c129 = "\\\\",
      peg$c130 = peg$literalExpectation("\\\\", false),
      peg$c131 = function() { return "\\"; },
      peg$c132 = "\\/",
      peg$c133 = peg$literalExpectation("\\/", false),
      peg$c134 = function() { return "/";  },
      peg$c135 = "\\b",
      peg$c136 = peg$literalExpectation("\\b", false),
      peg$c137 = function() { return "\b"; },
      peg$c138 = "\\f",
      peg$c139 = peg$literalExpectation("\\f", false),
      peg$c140 = function() { return "\f"; },
      peg$c141 = "\\n",
      peg$c142 = peg$literalExpectation("\\n", false),
      peg$c143 = function() { return "\n"; },
      peg$c144 = "\\r",
      peg$c145 = peg$literalExpectation("\\r", false),
      peg$c146 = function() { return "\r"; },
      peg$c147 = "\\t",
      peg$c148 = peg$literalExpectation("\\t", false),
      peg$c149 = function() { return "\t"; },
      peg$c150 = "\\u",
      peg$c151 = peg$literalExpectation("\\u", false),
      peg$c152 = function(h1, h2, h3, h4) {
            return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4));
          },
      peg$c153 = /^[\n\r]/,
      peg$c154 = peg$classExpectation(["\n", "\r"], false, false),
      peg$c155 = function(n) {
            return { type: 'number', value: n };
          },
      peg$c156 = function(int_, frac, exp) { return parseFloat(int_ + frac + exp); },
      peg$c157 = function(int_, frac) { return parseFloat(int_ + frac); },
      peg$c158 = function(int_, exp) { return parseFloat(int_ + exp); },
      peg$c159 = function(int_) { return parseFloat(int_); },
      peg$c160 = function(digit19, digits) { return digit19 + digits; },
      peg$c161 = function(op, digit19, digits) { return "-" + digit19 + digits; },
      peg$c162 = function(op, digit) { return "-" + digit; },
      peg$c163 = ".",
      peg$c164 = peg$literalExpectation(".", false),
      peg$c165 = function(digits) { return "." + digits; },
      peg$c166 = function(e, digits) { return e + digits; },
      peg$c167 = function(digits) { return digits.join(""); },
      peg$c168 = /^[0-9]/,
      peg$c169 = peg$classExpectation([["0", "9"]], false, false),
      peg$c170 = /^[1-9]/,
      peg$c171 = peg$classExpectation([["1", "9"]], false, false),
      peg$c172 = /^[0-9a-fA-F]/,
      peg$c173 = peg$classExpectation([["0", "9"], ["a", "f"], ["A", "F"]], false, false),
      peg$c174 = /^[eE]/,
      peg$c175 = peg$classExpectation(["e", "E"], false, false),
      peg$c176 = /^[+\-]/,
      peg$c177 = peg$classExpectation(["+", "-"], false, false),
      peg$c178 = function(e, sign) { return e + (sign !== null ? sign: ''); },
      peg$c179 = "null",
      peg$c180 = peg$literalExpectation("NULL", true),
      peg$c181 = "true",
      peg$c182 = peg$literalExpectation("TRUE", true),
      peg$c183 = "false",
      peg$c184 = peg$literalExpectation("FALSE", true),
      peg$c185 = "show",
      peg$c186 = peg$literalExpectation("SHOW", true),
      peg$c187 = "drop",
      peg$c188 = peg$literalExpectation("DROP", true),
      peg$c189 = "select",
      peg$c190 = peg$literalExpectation("SELECT", true),
      peg$c191 = "update",
      peg$c192 = peg$literalExpectation("UPDATE", true),
      peg$c193 = "create",
      peg$c194 = peg$literalExpectation("CREATE", true),
      peg$c195 = "delete",
      peg$c196 = peg$literalExpectation("DELETE", true),
      peg$c197 = "insert",
      peg$c198 = peg$literalExpectation("INSERT", true),
      peg$c199 = "replace",
      peg$c200 = peg$literalExpectation("REPLACE", true),
      peg$c201 = "explain",
      peg$c202 = peg$literalExpectation("EXPLAIN", true),
      peg$c203 = "into",
      peg$c204 = peg$literalExpectation("INTO", true),
      peg$c205 = "from",
      peg$c206 = peg$literalExpectation("FROM", true),
      peg$c207 = "set",
      peg$c208 = peg$literalExpectation("SET", true),
      peg$c209 = "as",
      peg$c210 = peg$literalExpectation("AS", true),
      peg$c211 = "table",
      peg$c212 = peg$literalExpectation("TABLE", true),
      peg$c213 = "on",
      peg$c214 = peg$literalExpectation("ON", true),
      peg$c215 = "left",
      peg$c216 = peg$literalExpectation("LEFT", true),
      peg$c217 = "inner",
      peg$c218 = peg$literalExpectation("INNER", true),
      peg$c219 = "join",
      peg$c220 = peg$literalExpectation("JOIN", true),
      peg$c221 = "union",
      peg$c222 = peg$literalExpectation("UNION", true),
      peg$c223 = "values",
      peg$c224 = peg$literalExpectation("VALUES", true),
      peg$c225 = "using",
      peg$c226 = peg$literalExpectation("USING", true),
      peg$c227 = "where",
      peg$c228 = peg$literalExpectation("WHERE", true),
      peg$c229 = "group",
      peg$c230 = peg$literalExpectation("GROUP", true),
      peg$c231 = "by",
      peg$c232 = peg$literalExpectation("BY", true),
      peg$c233 = "order",
      peg$c234 = peg$literalExpectation("ORDER", true),
      peg$c235 = "having",
      peg$c236 = peg$literalExpectation("HAVING", true),
      peg$c237 = "limit",
      peg$c238 = peg$literalExpectation("LIMIT", true),
      peg$c239 = "asc",
      peg$c240 = peg$literalExpectation("ASC", true),
      peg$c241 = function() { return 'ASC'; },
      peg$c242 = "desc",
      peg$c243 = peg$literalExpectation("DESC", true),
      peg$c244 = function() { return 'DESC'; },
      peg$c245 = "all",
      peg$c246 = peg$literalExpectation("ALL", true),
      peg$c247 = function() { return 'ALL'; },
      peg$c248 = "distinct",
      peg$c249 = peg$literalExpectation("DISTINCT", true),
      peg$c250 = function() { return 'DISTINCT';},
      peg$c251 = "between",
      peg$c252 = peg$literalExpectation("BETWEEN", true),
      peg$c253 = function() { return 'BETWEEN'; },
      peg$c254 = "in",
      peg$c255 = peg$literalExpectation("IN", true),
      peg$c256 = function() { return 'IN'; },
      peg$c257 = "is",
      peg$c258 = peg$literalExpectation("IS", true),
      peg$c259 = function() { return 'IS'; },
      peg$c260 = "like",
      peg$c261 = peg$literalExpectation("LIKE", true),
      peg$c262 = function() { return 'LIKE'; },
      peg$c263 = "exists",
      peg$c264 = peg$literalExpectation("EXISTS", true),
      peg$c265 = function() { return 'EXISTS'; },
      peg$c266 = "not",
      peg$c267 = peg$literalExpectation("NOT", true),
      peg$c268 = function() { return 'NOT'; },
      peg$c269 = "and",
      peg$c270 = peg$literalExpectation("AND", true),
      peg$c271 = function() { return 'AND'; },
      peg$c272 = "or",
      peg$c273 = peg$literalExpectation("OR", true),
      peg$c274 = function() { return 'OR'; },
      peg$c275 = "count",
      peg$c276 = peg$literalExpectation("COUNT", true),
      peg$c277 = function() { return 'COUNT'; },
      peg$c278 = "max",
      peg$c279 = peg$literalExpectation("MAX", true),
      peg$c280 = function() { return 'MAX'; },
      peg$c281 = "min",
      peg$c282 = peg$literalExpectation("MIN", true),
      peg$c283 = function() { return 'MIN'; },
      peg$c284 = "sum",
      peg$c285 = peg$literalExpectation("SUM", true),
      peg$c286 = function() { return 'SUM'; },
      peg$c287 = "avg",
      peg$c288 = peg$literalExpectation("AVG", true),
      peg$c289 = function() { return 'AVG'; },
      peg$c290 = "case",
      peg$c291 = peg$literalExpectation("CASE", true),
      peg$c292 = "when",
      peg$c293 = peg$literalExpectation("WHEN", true),
      peg$c294 = "then",
      peg$c295 = peg$literalExpectation("THEN", true),
      peg$c296 = "else",
      peg$c297 = peg$literalExpectation("ELSE", true),
      peg$c298 = "end",
      peg$c299 = peg$literalExpectation("END", true),
      peg$c300 = "cast",
      peg$c301 = peg$literalExpectation("CAST", true),
      peg$c302 = "char",
      peg$c303 = peg$literalExpectation("CHAR", true),
      peg$c304 = function() { return 'CHAR'; },
      peg$c305 = "varchar",
      peg$c306 = peg$literalExpectation("VARCHAR", true),
      peg$c307 = function() { return 'VARCHAR';},
      peg$c308 = "numeric",
      peg$c309 = peg$literalExpectation("NUMERIC", true),
      peg$c310 = function() { return 'NUMERIC'; },
      peg$c311 = "decimal",
      peg$c312 = peg$literalExpectation("DECIMAL", true),
      peg$c313 = function() { return 'DECIMAL'; },
      peg$c314 = "signed",
      peg$c315 = peg$literalExpectation("SIGNED", true),
      peg$c316 = function() { return 'SIGNED'; },
      peg$c317 = "unsigned",
      peg$c318 = peg$literalExpectation("UNSIGNED", true),
      peg$c319 = function() { return 'UNSIGNED'; },
      peg$c320 = "int",
      peg$c321 = peg$literalExpectation("INT", true),
      peg$c322 = function() { return 'INT'; },
      peg$c323 = "integer",
      peg$c324 = peg$literalExpectation("INTEGER", true),
      peg$c325 = function() { return 'INTEGER'; },
      peg$c326 = "smallint",
      peg$c327 = peg$literalExpectation("SMALLINT", true),
      peg$c328 = function() { return 'SMALLINT'; },
      peg$c329 = "date",
      peg$c330 = peg$literalExpectation("DATE", true),
      peg$c331 = function() { return 'DATE'; },
      peg$c332 = "time",
      peg$c333 = peg$literalExpectation("TIME", true),
      peg$c334 = function() { return 'TIME'; },
      peg$c335 = "timestamp",
      peg$c336 = peg$literalExpectation("TIMESTAMP", true),
      peg$c337 = function() { return 'TIMESTAMP'; },
      peg$c338 = "$",
      peg$c339 = peg$literalExpectation("$", false),
      peg$c340 = "return",
      peg$c341 = peg$literalExpectation("return", true),
      peg$c342 = ":=",
      peg$c343 = peg$literalExpectation(":=", false),
      peg$c344 = "DUAL",
      peg$c345 = peg$literalExpectation("DUAL", false),
      peg$c346 = "sql_calc_found_rows",
      peg$c347 = peg$literalExpectation("SQL_CALC_FOUND_ROWS", true),
      peg$c348 = "sql_cache",
      peg$c349 = peg$literalExpectation("SQL_CACHE", true),
      peg$c350 = "sql_no_cache",
      peg$c351 = peg$literalExpectation("SQL_NO_CACHE", true),
      peg$c352 = "sql_small_result",
      peg$c353 = peg$literalExpectation("SQL_SMALL_RESULT", true),
      peg$c354 = "sql_big_result",
      peg$c355 = peg$literalExpectation("SQL_BIG_RESULT", true),
      peg$c356 = "sql_buffer_result",
      peg$c357 = peg$literalExpectation("SQL_BUFFER_RESULT", true),
      peg$c358 = ",",
      peg$c359 = peg$literalExpectation(",", false),
      peg$c360 = "[",
      peg$c361 = peg$literalExpectation("[", false),
      peg$c362 = "]",
      peg$c363 = peg$literalExpectation("]", false),
      peg$c364 = "/*",
      peg$c365 = peg$literalExpectation("/*", false),
      peg$c366 = "*/",
      peg$c367 = peg$literalExpectation("*/", false),
      peg$c368 = "--",
      peg$c369 = peg$literalExpectation("--", false),
      peg$c370 = peg$anyExpectation(),
      peg$c371 = /^[ \t\n\r]/,
      peg$c372 = peg$classExpectation([" ", "\t", "\n", "\r"], false, false),
      peg$c373 = function() { varList = []; return true; },
      peg$c374 = function(s) {
            return { stmt: s, vars: varList };
          },
      peg$c375 = function(va, e) {
          return {
            type: 'assign',
            left: va,
            right: e
          };
        },
      peg$c376 = function(e) {
            return { type: 'return', expr: e };
          },
      peg$c377 = function(lt, op, rt, expr) {
            return {
              type: 'join',
              ltable: lt,
              rtable: rt,
              op: op,
              on: expr
            };
          },
      peg$c378 = function(name, l) {
            //compatible with original func_call
            return {
              type: 'function',
              name: name,
              args: {
                type: 'expr_list',
                value: l
              }
            };
          },
      peg$c379 = function(l) {
          return { type: 'array', value: l };
        },
      peg$c380 = function(name, m) {
          //push for analysis
          varList.push(name);
          return {
            type: 'var',
            name: name,
            members: m
          };
        },
      peg$c381 = function(l) {
          var s = [];
          for (var i = 0; i < l.length; i++) {
            s.push(l[i][1]);
          }
          return s;
        },
      peg$c382 = function(t, l) {
          return { dataType: t, length: parseInt(l.join(''), 10) };
        },
      peg$c383 = function(t) { return { dataType: t }; },

      peg$currPos          = 0,
      peg$savedPos         = 0,
      peg$posDetailsCache  = [{ line: 1, column: 1 }],
      peg$maxFailPos       = 0,
      peg$maxFailExpected  = [],
      peg$silentFails      = 0,

      peg$result;

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }

  function expected(description, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location
    );
  }

  function error(message, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildSimpleError(message, location);
  }

  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text: text, ignoreCase: ignoreCase };
  }

  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
  }

  function peg$anyExpectation() {
    return { type: "any" };
  }

  function peg$endExpectation() {
    return { type: "end" };
  }

  function peg$otherExpectation(description) {
    return { type: "other", description: description };
  }

  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos], p;

    if (details) {
      return details;
    } else {
      p = pos - 1;
      while (!peg$posDetailsCache[p]) {
        p--;
      }

      details = peg$posDetailsCache[p];
      details = {
        line:   details.line,
        column: details.column
      };

      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }

        p++;
      }

      peg$posDetailsCache[pos] = details;
      return details;
    }
  }

  function peg$computeLocation(startPos, endPos) {
    var startPosDetails = peg$computePosDetails(startPos),
        endPosDetails   = peg$computePosDetails(endPos);

    return {
      start: {
        offset: startPos,
        line:   startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line:   endPosDetails.line,
        column: endPosDetails.column
      }
    };
  }

  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) { return; }

    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }

    peg$maxFailExpected.push(expected);
  }

  function peg$buildSimpleError(message, location) {
    return new peg$SyntaxError(message, null, null, location);
  }

  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }

  function peg$parsestart() {
    var s0;

    s0 = peg$parseunion_stmt();
    if (s0 === peg$FAILED) {
      s0 = peg$parseupdate_stmt();
      if (s0 === peg$FAILED) {
        s0 = peg$parsereplace_insert_stmt();
        if (s0 === peg$FAILED) {
          s0 = peg$parseproc_stmts();
        }
      }
    }

    return s0;
  }

  function peg$parseunion_stmt() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseselect_stmt();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseKW_UNION();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseselect_stmt();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseKW_UNION();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseselect_stmt();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c0(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseselect_stmt() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$parseselect_stmt_nake();
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 40) {
        s2 = peg$c1;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c2); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse__();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseselect_stmt();
          if (s4 !== peg$FAILED) {
            s5 = peg$parse__();
            if (s5 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 41) {
                s6 = peg$c3;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c4); }
              }
              if (s6 !== peg$FAILED) {
                s2 = [s2, s3, s4, s5, s6];
                s1 = s2;
              } else {
                peg$currPos = s1;
                s1 = peg$FAILED;
              }
            } else {
              peg$currPos = s1;
              s1 = peg$FAILED;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$FAILED;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c5(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parseselect_stmt_nake() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19;

    s0 = peg$currPos;
    s1 = peg$parseKW_SELECT();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseoption_clause();
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseKW_DISTINCT();
            if (s5 === peg$FAILED) {
              s5 = null;
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parsecolumn_clause();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parsefrom_clause();
                    if (s9 === peg$FAILED) {
                      s9 = null;
                    }
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parse__();
                      if (s10 !== peg$FAILED) {
                        s11 = peg$parsewhere_clause();
                        if (s11 === peg$FAILED) {
                          s11 = null;
                        }
                        if (s11 !== peg$FAILED) {
                          s12 = peg$parse__();
                          if (s12 !== peg$FAILED) {
                            s13 = peg$parsegroup_by_clause();
                            if (s13 === peg$FAILED) {
                              s13 = null;
                            }
                            if (s13 !== peg$FAILED) {
                              s14 = peg$parse__();
                              if (s14 !== peg$FAILED) {
                                s15 = peg$parsehaving_clause();
                                if (s15 === peg$FAILED) {
                                  s15 = null;
                                }
                                if (s15 !== peg$FAILED) {
                                  s16 = peg$parse__();
                                  if (s16 !== peg$FAILED) {
                                    s17 = peg$parseorder_by_clause();
                                    if (s17 === peg$FAILED) {
                                      s17 = null;
                                    }
                                    if (s17 !== peg$FAILED) {
                                      s18 = peg$parse__();
                                      if (s18 !== peg$FAILED) {
                                        s19 = peg$parselimit_clause();
                                        if (s19 === peg$FAILED) {
                                          s19 = null;
                                        }
                                        if (s19 !== peg$FAILED) {
                                          peg$savedPos = s0;
                                          s1 = peg$c6(s3, s5, s7, s9, s11, s13, s15, s17, s19);
                                          s0 = s1;
                                        } else {
                                          peg$currPos = s0;
                                          s0 = peg$FAILED;
                                        }
                                      } else {
                                        peg$currPos = s0;
                                        s0 = peg$FAILED;
                                      }
                                    } else {
                                      peg$currPos = s0;
                                      s0 = peg$FAILED;
                                    }
                                  } else {
                                    peg$currPos = s0;
                                    s0 = peg$FAILED;
                                  }
                                } else {
                                  peg$currPos = s0;
                                  s0 = peg$FAILED;
                                }
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseoption_clause() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsequery_option();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parsequery_option();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parsequery_option();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c7(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsequery_option() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parseOPT_SQL_CALC_FOUND_ROWS();
    if (s1 === peg$FAILED) {
      s1 = peg$parseOPT_SQL_CACHE();
      if (s1 === peg$FAILED) {
        s1 = peg$parseOPT_SQL_NO_CACHE();
      }
      if (s1 === peg$FAILED) {
        s1 = peg$parseOPT_SQL_BIG_RESULT();
        if (s1 === peg$FAILED) {
          s1 = peg$parseOPT_SQL_SMALL_RESULT();
          if (s1 === peg$FAILED) {
            s1 = peg$parseOPT_SQL_BUFFER_RESULT();
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c8(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsecolumn_clause() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseKW_ALL();
    if (s1 === peg$FAILED) {
      s1 = peg$currPos;
      s2 = peg$parseSTAR();
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        peg$silentFails++;
        s4 = peg$parseident_start();
        peg$silentFails--;
        if (s4 === peg$FAILED) {
          s3 = void 0;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s2 = [s2, s3];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c9();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsecolumn_list_item();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsecolumn_list_item();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseCOMMA();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parsecolumn_list_item();
                if (s7 !== peg$FAILED) {
                  s4 = [s4, s5, s6, s7];
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c10(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsecolumn_list_item() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseident();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseDOT();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseSTAR();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c11(s1);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseexpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsealias_clause();
          if (s3 === peg$FAILED) {
            s3 = null;
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c12(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsealias_clause() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_AS();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseident();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c13(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsefrom_clause() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_FROM();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsetable_ref_list();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c14(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsetable_ref_list() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsetable_base();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parsetable_ref();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parsetable_ref();
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c15(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsetable_ref() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parse__();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseCOMMA();
      if (s2 !== peg$FAILED) {
        s3 = peg$parse__();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsetable_base();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c16(s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parse__();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsetable_join();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c16(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsetable_join() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15;

    s0 = peg$currPos;
    s1 = peg$parsejoin_op();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsetable_base();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseKW_USING();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseLPAREN();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parseident_name();
                    if (s9 !== peg$FAILED) {
                      s10 = [];
                      s11 = peg$currPos;
                      s12 = peg$parse__();
                      if (s12 !== peg$FAILED) {
                        s13 = peg$parseCOMMA();
                        if (s13 !== peg$FAILED) {
                          s14 = peg$parse__();
                          if (s14 !== peg$FAILED) {
                            s15 = peg$parseident_name();
                            if (s15 !== peg$FAILED) {
                              s12 = [s12, s13, s14, s15];
                              s11 = s12;
                            } else {
                              peg$currPos = s11;
                              s11 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s11;
                            s11 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s11;
                          s11 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s11;
                        s11 = peg$FAILED;
                      }
                      while (s11 !== peg$FAILED) {
                        s10.push(s11);
                        s11 = peg$currPos;
                        s12 = peg$parse__();
                        if (s12 !== peg$FAILED) {
                          s13 = peg$parseCOMMA();
                          if (s13 !== peg$FAILED) {
                            s14 = peg$parse__();
                            if (s14 !== peg$FAILED) {
                              s15 = peg$parseident_name();
                              if (s15 !== peg$FAILED) {
                                s12 = [s12, s13, s14, s15];
                                s11 = s12;
                              } else {
                                peg$currPos = s11;
                                s11 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s11;
                              s11 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s11;
                            s11 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s11;
                          s11 = peg$FAILED;
                        }
                      }
                      if (s10 !== peg$FAILED) {
                        s11 = peg$parse__();
                        if (s11 !== peg$FAILED) {
                          s12 = peg$parseRPAREN();
                          if (s12 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$c17(s1, s3, s9, s10);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsejoin_op();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsetable_base();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseon_clause();
              if (s5 === peg$FAILED) {
                s5 = null;
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c18(s1, s3, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parsejoin_op();
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseLPAREN();
            if (s3 !== peg$FAILED) {
              s4 = peg$parse__();
              if (s4 !== peg$FAILED) {
                s5 = peg$parseunion_stmt();
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse__();
                  if (s6 !== peg$FAILED) {
                    s7 = peg$parseRPAREN();
                    if (s7 !== peg$FAILED) {
                      s8 = peg$parse__();
                      if (s8 !== peg$FAILED) {
                        s9 = peg$parseKW_AS();
                        if (s9 === peg$FAILED) {
                          s9 = null;
                        }
                        if (s9 !== peg$FAILED) {
                          s10 = peg$parse__();
                          if (s10 !== peg$FAILED) {
                            s11 = peg$parseident();
                            if (s11 !== peg$FAILED) {
                              s12 = peg$parse__();
                              if (s12 !== peg$FAILED) {
                                s13 = peg$parseon_clause();
                                if (s13 === peg$FAILED) {
                                  s13 = null;
                                }
                                if (s13 !== peg$FAILED) {
                                  peg$savedPos = s0;
                                  s1 = peg$c19(s1, s5, s11, s13);
                                  s0 = s1;
                                } else {
                                  peg$currPos = s0;
                                  s0 = peg$FAILED;
                                }
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
    }

    return s0;
  }

  function peg$parsetable_base() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    s0 = peg$currPos;
    s1 = peg$parseKW_DUAL();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c20();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsetable_name();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseKW_AS();
          if (s3 === peg$FAILED) {
            s3 = null;
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseident();
              if (s5 === peg$FAILED) {
                s5 = null;
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c21(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseLPAREN();
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseunion_stmt();
            if (s3 !== peg$FAILED) {
              s4 = peg$parse__();
              if (s4 !== peg$FAILED) {
                s5 = peg$parseRPAREN();
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse__();
                  if (s6 !== peg$FAILED) {
                    s7 = peg$parseKW_AS();
                    if (s7 === peg$FAILED) {
                      s7 = null;
                    }
                    if (s7 !== peg$FAILED) {
                      s8 = peg$parse__();
                      if (s8 !== peg$FAILED) {
                        s9 = peg$parseident();
                        if (s9 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c22(s3, s9);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
    }

    return s0;
  }

  function peg$parsejoin_op() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_LEFT();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseKW_JOIN();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c23();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$parseKW_INNER();
      if (s2 !== peg$FAILED) {
        s3 = peg$parse__();
        if (s3 !== peg$FAILED) {
          s2 = [s2, s3];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseKW_JOIN();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c24();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsetable_name() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parseident();
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = peg$parse__();
      if (s3 !== peg$FAILED) {
        s4 = peg$parseDOT();
        if (s4 !== peg$FAILED) {
          s5 = peg$parse__();
          if (s5 !== peg$FAILED) {
            s6 = peg$parseident();
            if (s6 !== peg$FAILED) {
              s3 = [s3, s4, s5, s6];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c25(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsevar_decl();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c26(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parseon_clause() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_ON();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexpr();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c27(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsewhere_clause() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_WHERE();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexpr();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c27(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsegroup_by_clause() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseKW_GROUP();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseKW_BY();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsecolumn_ref_list();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c14(s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecolumn_ref_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsecolumn_ref();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseCOMMA();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parsecolumn_ref();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsecolumn_ref();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c10(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsehaving_clause() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_HAVING();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexpr();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c27(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseorder_by_clause() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseKW_ORDER();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseKW_BY();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseorder_by_list();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c14(s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseorder_by_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseorder_by_element();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseCOMMA();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseorder_by_element();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseorder_by_element();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c10(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseorder_by_element() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseexpr();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseKW_DESC();
        if (s3 === peg$FAILED) {
          s3 = peg$parseKW_ASC();
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c28(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenumber_or_param() {
    var s0;

    s0 = peg$parseliteral_numeric();
    if (s0 === peg$FAILED) {
      s0 = peg$parseparam();
    }

    return s0;
  }

  function peg$parselimit_clause() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    s1 = peg$parseKW_LIMIT();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenumber_or_param();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$currPos;
            s6 = peg$parseCOMMA();
            if (s6 !== peg$FAILED) {
              s7 = peg$parse__();
              if (s7 !== peg$FAILED) {
                s8 = peg$parsenumber_or_param();
                if (s8 !== peg$FAILED) {
                  s6 = [s6, s7, s8];
                  s5 = s6;
                } else {
                  peg$currPos = s5;
                  s5 = peg$FAILED;
                }
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
            if (s5 === peg$FAILED) {
              s5 = null;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c29(s3, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseupdate_stmt() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    s0 = peg$currPos;
    s1 = peg$parseKW_UPDATE();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsetable_name();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseKW_SET();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseset_list();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parsewhere_clause();
                    if (s9 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c30(s3, s7, s9);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseset_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseset_item();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseCOMMA();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseset_item();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseset_item();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c10(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseset_item() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsecolumn_name();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 61) {
          s3 = peg$c31;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c32); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseadditive_expr();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c33(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsereplace_insert_stmt() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13;

    s0 = peg$currPos;
    s1 = peg$parsereplace_insert();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseKW_INTO();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsetable_name();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseLPAREN();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parsecolumn_list();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parse__();
                      if (s10 !== peg$FAILED) {
                        s11 = peg$parseRPAREN();
                        if (s11 !== peg$FAILED) {
                          s12 = peg$parse__();
                          if (s12 !== peg$FAILED) {
                            s13 = peg$parsevalue_clause();
                            if (s13 !== peg$FAILED) {
                              peg$savedPos = s0;
                              s1 = peg$c34(s1, s5, s9, s13);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsereplace_insert() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parseKW_INSERT();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c35();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseKW_REPLACE();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c36();
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsevalue_clause() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_VALUES();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevalue_list();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c14(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsevalue_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsevalue_item();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseCOMMA();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parsevalue_item();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsevalue_item();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c10(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsevalue_item() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseLPAREN();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexpr_list();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseRPAREN();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c37(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseexpr_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseexpr();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseCOMMA();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseexpr();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseexpr();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c38(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecase_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

    s0 = peg$currPos;
    s1 = peg$parseKW_CASE();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexpr();
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$parsecase_when_then();
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                s6 = peg$parsecase_when_then();
              }
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parsecase_else();
                if (s7 === peg$FAILED) {
                  s7 = null;
                }
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parseKW_END();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parse__();
                      if (s10 !== peg$FAILED) {
                        s11 = peg$parseKW_CASE();
                        if (s11 === peg$FAILED) {
                          s11 = null;
                        }
                        if (s11 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c39(s3, s5, s7);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecase_when_then() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    s1 = peg$parseKW_WHEN();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexpr();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseKW_THEN();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseexpr();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c40(s3, s7);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecase_else() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_ELSE();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexpr();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c41(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseexpr() {
    var s0;

    s0 = peg$parseor_expr();
    if (s0 === peg$FAILED) {
      s0 = peg$parseselect_stmt();
    }

    return s0;
  }

  function peg$parseor_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseand_expr();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseKW_OR();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseand_expr();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseKW_OR();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseand_expr();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c42(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseand_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsenot_expr();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseKW_AND();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parsenot_expr();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseKW_AND();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsenot_expr();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c42(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenot_expr() {
    var s0, s1, s2, s3, s4;

    s0 = peg$parsecomparison_expr();
    if (s0 === peg$FAILED) {
      s0 = peg$parseexists_expr();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseKW_NOT();
        if (s1 === peg$FAILED) {
          s1 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 33) {
            s2 = peg$c43;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c44); }
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$currPos;
            peg$silentFails++;
            if (input.charCodeAt(peg$currPos) === 61) {
              s4 = peg$c31;
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c32); }
            }
            peg$silentFails--;
            if (s4 === peg$FAILED) {
              s3 = void 0;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
            if (s3 !== peg$FAILED) {
              s2 = [s2, s3];
              s1 = s2;
            } else {
              peg$currPos = s1;
              s1 = peg$FAILED;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$FAILED;
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__();
          if (s2 !== peg$FAILED) {
            s3 = peg$parsenot_expr();
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c45(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
    }

    return s0;
  }

  function peg$parsecomparison_expr() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseadditive_expr();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsecomparison_op_right();
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c46(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseexists_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseexists_op();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseLPAREN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseunion_stmt();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseRPAREN();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c47(s1, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseexists_op() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$parseKW_NOT();
    if (s2 !== peg$FAILED) {
      s3 = peg$parse__();
      if (s3 !== peg$FAILED) {
        s4 = peg$parseKW_EXISTS();
        if (s4 !== peg$FAILED) {
          s2 = [s2, s3, s4];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c48(s1);
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$parseKW_EXISTS();
    }

    return s0;
  }

  function peg$parsecomparison_op_right() {
    var s0;

    s0 = peg$parsearithmetic_op_right();
    if (s0 === peg$FAILED) {
      s0 = peg$parsein_op_right();
      if (s0 === peg$FAILED) {
        s0 = peg$parsebetween_op_right();
        if (s0 === peg$FAILED) {
          s0 = peg$parseis_op_right();
          if (s0 === peg$FAILED) {
            s0 = peg$parselike_op_right();
          }
        }
      }
    }

    return s0;
  }

  function peg$parsearithmetic_op_right() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$currPos;
    s3 = peg$parse__();
    if (s3 !== peg$FAILED) {
      s4 = peg$parsearithmetic_comparison_operator();
      if (s4 !== peg$FAILED) {
        s5 = peg$parse__();
        if (s5 !== peg$FAILED) {
          s6 = peg$parseadditive_expr();
          if (s6 !== peg$FAILED) {
            s3 = [s3, s4, s5, s6];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$currPos;
        s3 = peg$parse__();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsearithmetic_comparison_operator();
          if (s4 !== peg$FAILED) {
            s5 = peg$parse__();
            if (s5 !== peg$FAILED) {
              s6 = peg$parseadditive_expr();
              if (s6 !== peg$FAILED) {
                s3 = [s3, s4, s5, s6];
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c49(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsearithmetic_comparison_operator() {
    var s0;

    if (input.substr(peg$currPos, 2) === peg$c50) {
      s0 = peg$c50;
      peg$currPos += 2;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c51); }
    }
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 62) {
        s0 = peg$c52;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c53); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c54) {
          s0 = peg$c54;
          peg$currPos += 2;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c55); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c56) {
            s0 = peg$c56;
            peg$currPos += 2;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c57); }
          }
          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 60) {
              s0 = peg$c58;
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c59); }
            }
            if (s0 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 61) {
                s0 = peg$c31;
                peg$currPos++;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c32); }
              }
              if (s0 === peg$FAILED) {
                if (input.substr(peg$currPos, 2) === peg$c60) {
                  s0 = peg$c60;
                  peg$currPos += 2;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c61); }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseis_op_right() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parseKW_IS();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseadditive_expr();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c62(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$parseKW_IS();
      if (s2 !== peg$FAILED) {
        s3 = peg$parse__();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseKW_NOT();
          if (s4 !== peg$FAILED) {
            s2 = [s2, s3, s4];
            s1 = s2;
          } else {
            peg$currPos = s1;
            s1 = peg$FAILED;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseadditive_expr();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c63(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsebetween_op_right() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseKW_BETWEEN();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseadditive_expr();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseKW_AND();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseadditive_expr();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c64(s1, s3, s7);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parselike_op() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$parseKW_NOT();
    if (s2 !== peg$FAILED) {
      s3 = peg$parse__();
      if (s3 !== peg$FAILED) {
        s4 = peg$parseKW_LIKE();
        if (s4 !== peg$FAILED) {
          s2 = [s2, s3, s4];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c48(s1);
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$parseKW_LIKE();
    }

    return s0;
  }

  function peg$parsein_op() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$parseKW_NOT();
    if (s2 !== peg$FAILED) {
      s3 = peg$parse__();
      if (s3 !== peg$FAILED) {
        s4 = peg$parseKW_IN();
        if (s4 !== peg$FAILED) {
          s2 = [s2, s3, s4];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c48(s1);
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$parseKW_IN();
    }

    return s0;
  }

  function peg$parselike_op_right() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parselike_op();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsecomparison_expr();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c65(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsein_op_right() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsein_op();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseLPAREN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseexpr_list();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseRPAREN();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c66(s1, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsein_op();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsevar_decl();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c67(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parseadditive_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsemultiplicative_expr();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseadditive_operator();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parsemultiplicative_expr();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseadditive_operator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsemultiplicative_expr();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c42(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseadditive_operator() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 43) {
      s0 = peg$c68;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c69); }
    }
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 45) {
        s0 = peg$c70;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c71); }
      }
    }

    return s0;
  }

  function peg$parsemultiplicative_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseprimary();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parsemultiplicative_operator();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseprimary();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parsemultiplicative_operator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseprimary();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c72(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsemultiplicative_operator() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 42) {
      s0 = peg$c73;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c74); }
    }
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 47) {
        s0 = peg$c75;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c76); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 37) {
          s0 = peg$c77;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c78); }
        }
      }
    }

    return s0;
  }

  function peg$parseprimary() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$parseliteral();
    if (s0 === peg$FAILED) {
      s0 = peg$parsecast_expr();
      if (s0 === peg$FAILED) {
        s0 = peg$parseaggr_func();
        if (s0 === peg$FAILED) {
          s0 = peg$parsefunc_call();
          if (s0 === peg$FAILED) {
            s0 = peg$parsecase_expr();
            if (s0 === peg$FAILED) {
              s0 = peg$parsecolumn_ref();
              if (s0 === peg$FAILED) {
                s0 = peg$parseparam();
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$parseLPAREN();
                  if (s1 !== peg$FAILED) {
                    s2 = peg$parse__();
                    if (s2 !== peg$FAILED) {
                      s3 = peg$parseexpr();
                      if (s3 !== peg$FAILED) {
                        s4 = peg$parse__();
                        if (s4 !== peg$FAILED) {
                          s5 = peg$parseRPAREN();
                          if (s5 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$c79(s3);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                  if (s0 === peg$FAILED) {
                    s0 = peg$parsevar_decl();
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsecolumn_ref() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseident();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseDOT();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsecolumn();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c80(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsecolumn();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c81(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsecolumn_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsecolumn();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseCOMMA();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parsecolumn();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsecolumn();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c10(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseident() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parseident_name();
    if (s1 !== peg$FAILED) {
      peg$savedPos = peg$currPos;
      s2 = peg$c82(s1);
      if (s2) {
        s2 = peg$FAILED;
      } else {
        s2 = void 0;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c83(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsequoted_ident();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c83(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsequoted_ident() {
    var s0;

    s0 = peg$parsedouble_quoted_ident();
    if (s0 === peg$FAILED) {
      s0 = peg$parsesingle_quoted_ident();
      if (s0 === peg$FAILED) {
        s0 = peg$parsebackticks_quoted_ident();
      }
    }

    return s0;
  }

  function peg$parsedouble_quoted_ident() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c84;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c85); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c86.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c87); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c86.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c87); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 34) {
          s3 = peg$c84;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c85); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c88(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsesingle_quoted_ident() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 39) {
      s1 = peg$c89;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c90); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c91.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c92); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c91.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c92); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 39) {
          s3 = peg$c89;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c88(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsebackticks_quoted_ident() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 96) {
      s1 = peg$c93;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c94); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c95.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c96); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c95.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c96); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 96) {
          s3 = peg$c93;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c94); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c88(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecolumn() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parsecolumn_name();
    if (s1 !== peg$FAILED) {
      peg$savedPos = peg$currPos;
      s2 = peg$c82(s1);
      if (s2) {
        s2 = peg$FAILED;
      } else {
        s2 = void 0;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c97(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsequoted_ident();
    }

    return s0;
  }

  function peg$parsecolumn_name() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseident_start();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parsecolumn_part();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parsecolumn_part();
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c98(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseident_name() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseident_start();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseident_part();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parseident_part();
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c98(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseident_start() {
    var s0;

    if (peg$c99.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c100); }
    }

    return s0;
  }

  function peg$parseident_part() {
    var s0;

    if (peg$c101.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c102); }
    }

    return s0;
  }

  function peg$parsecolumn_part() {
    var s0;

    if (peg$c103.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c104); }
    }

    return s0;
  }

  function peg$parseparam() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 58) {
      s2 = peg$c105;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c106); }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parseident_name();
      if (s3 !== peg$FAILED) {
        s2 = [s2, s3];
        s1 = s2;
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c107(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parseaggr_func() {
    var s0;

    s0 = peg$parseaggr_fun_count();
    if (s0 === peg$FAILED) {
      s0 = peg$parseaggr_fun_smma();
    }

    return s0;
  }

  function peg$parseaggr_fun_smma() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseKW_SUM_MAX_MIN_AVG();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseLPAREN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseadditive_expr();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseRPAREN();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c108(s1, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_SUM_MAX_MIN_AVG() {
    var s0;

    s0 = peg$parseKW_SUM();
    if (s0 === peg$FAILED) {
      s0 = peg$parseKW_MAX();
      if (s0 === peg$FAILED) {
        s0 = peg$parseKW_MIN();
        if (s0 === peg$FAILED) {
          s0 = peg$parseKW_AVG();
        }
      }
    }

    return s0;
  }

  function peg$parseaggr_fun_count() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseKW_COUNT();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseLPAREN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsecount_arg();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseRPAREN();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c109(s1, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecount_arg() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsestar_expr();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c110(s1);
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseKW_DISTINCT();
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsecolumn_ref();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c111(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsestar_expr() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 42) {
      s1 = peg$c73;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c74); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c112();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsefunc_call() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseident();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseLPAREN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseexpr_list();
            if (s5 === peg$FAILED) {
              s5 = null;
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseRPAREN();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c113(s1, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecast_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13;

    s0 = peg$currPos;
    s1 = peg$parseKW_CAST();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseLPAREN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseexpr();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseKW_AS();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parsedata_type();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parse__();
                      if (s10 !== peg$FAILED) {
                        s11 = peg$parseRPAREN();
                        if (s11 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c114(s5, s9);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseKW_CAST();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseLPAREN();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseexpr();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse__();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseKW_AS();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse__();
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parsesignedness();
                      if (s9 !== peg$FAILED) {
                        s10 = peg$parse__();
                        if (s10 !== peg$FAILED) {
                          s11 = peg$parseKW_INTEGER();
                          if (s11 === peg$FAILED) {
                            s11 = null;
                          }
                          if (s11 !== peg$FAILED) {
                            s12 = peg$parse__();
                            if (s12 !== peg$FAILED) {
                              s13 = peg$parseRPAREN();
                              if (s13 !== peg$FAILED) {
                                peg$savedPos = s0;
                                s1 = peg$c115(s5, s9, s11);
                                s0 = s1;
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsesignedness() {
    var s0;

    s0 = peg$parseKW_SIGNED();
    if (s0 === peg$FAILED) {
      s0 = peg$parseKW_UNSIGNED();
    }

    return s0;
  }

  function peg$parseliteral() {
    var s0;

    s0 = peg$parseliteral_string();
    if (s0 === peg$FAILED) {
      s0 = peg$parseliteral_numeric();
      if (s0 === peg$FAILED) {
        s0 = peg$parseliteral_bool();
        if (s0 === peg$FAILED) {
          s0 = peg$parseliteral_null();
          if (s0 === peg$FAILED) {
            s0 = peg$parseliteral_datetime();
          }
        }
      }
    }

    return s0;
  }

  function peg$parseliteral_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseliteral();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseCOMMA();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseliteral();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseliteral();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c10(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseliteral_null() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parseKW_NULL();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c116();
    }
    s0 = s1;

    return s0;
  }

  function peg$parseliteral_bool() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parseKW_TRUE();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c117();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseKW_FALSE();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c118();
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parseliteral_string() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 39) {
      s2 = peg$c89;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c90); }
    }
    if (s2 !== peg$FAILED) {
      s3 = [];
      s4 = peg$parsesingle_char();
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        s4 = peg$parsesingle_char();
      }
      if (s3 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 39) {
          s4 = peg$c89;
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s4 !== peg$FAILED) {
          s2 = [s2, s3, s4];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c119(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parseliteral_datetime() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parseKW_TIME();
    if (s1 === peg$FAILED) {
      s1 = peg$parseKW_DATE();
      if (s1 === peg$FAILED) {
        s1 = peg$parseKW_TIMESTAMP();
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s4 = peg$c89;
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s4 !== peg$FAILED) {
          s5 = [];
          s6 = peg$parsesingle_char();
          while (s6 !== peg$FAILED) {
            s5.push(s6);
            s6 = peg$parsesingle_char();
          }
          if (s5 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s6 = peg$c89;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c90); }
            }
            if (s6 !== peg$FAILED) {
              s4 = [s4, s5, s6];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c120(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsesingle_char() {
    var s0;

    if (peg$c121.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c122); }
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseescape_char();
    }

    return s0;
  }

  function peg$parseescape_char() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c123) {
      s1 = peg$c123;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c124); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c125();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c126) {
        s1 = peg$c126;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c127); }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c128();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c129) {
          s1 = peg$c129;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c130); }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c131();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c132) {
            s1 = peg$c132;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c133); }
          }
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c134();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 2) === peg$c135) {
              s1 = peg$c135;
              peg$currPos += 2;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c136); }
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c137();
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 2) === peg$c138) {
                s1 = peg$c138;
                peg$currPos += 2;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c139); }
              }
              if (s1 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c140();
              }
              s0 = s1;
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 2) === peg$c141) {
                  s1 = peg$c141;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c142); }
                }
                if (s1 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c143();
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 2) === peg$c144) {
                    s1 = peg$c144;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c145); }
                  }
                  if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c146();
                  }
                  s0 = s1;
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.substr(peg$currPos, 2) === peg$c147) {
                      s1 = peg$c147;
                      peg$currPos += 2;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c148); }
                    }
                    if (s1 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c149();
                    }
                    s0 = s1;
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      if (input.substr(peg$currPos, 2) === peg$c150) {
                        s1 = peg$c150;
                        peg$currPos += 2;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c151); }
                      }
                      if (s1 !== peg$FAILED) {
                        s2 = peg$parsehexDigit();
                        if (s2 !== peg$FAILED) {
                          s3 = peg$parsehexDigit();
                          if (s3 !== peg$FAILED) {
                            s4 = peg$parsehexDigit();
                            if (s4 !== peg$FAILED) {
                              s5 = peg$parsehexDigit();
                              if (s5 !== peg$FAILED) {
                                peg$savedPos = s0;
                                s1 = peg$c152(s2, s3, s4, s5);
                                s0 = s1;
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseline_terminator() {
    var s0;

    if (peg$c153.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c154); }
    }

    return s0;
  }

  function peg$parseliteral_numeric() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parsenumber();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c155(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsenumber() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parseint();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsefrac();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexp();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c156(s1, s2, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseint();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsefrac();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse__();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c157(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseint();
        if (s1 !== peg$FAILED) {
          s2 = peg$parseexp();
          if (s2 !== peg$FAILED) {
            s3 = peg$parse__();
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c158(s1, s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parseint();
          if (s1 !== peg$FAILED) {
            s2 = peg$parse__();
            if (s2 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c159(s1);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
    }

    return s0;
  }

  function peg$parseint() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsedigit19();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsedigits();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c160(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsedigit();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 45) {
          s1 = peg$c70;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c71); }
        }
        if (s1 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 43) {
            s1 = peg$c68;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c69); }
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parsedigit19();
          if (s2 !== peg$FAILED) {
            s3 = peg$parsedigits();
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c161(s1, s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 45) {
            s1 = peg$c70;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c71); }
          }
          if (s1 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 43) {
              s1 = peg$c68;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c69); }
            }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parsedigit();
            if (s2 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c162(s1, s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
    }

    return s0;
  }

  function peg$parsefrac() {
    var s0, s1, s2;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 46) {
      s1 = peg$c163;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c164); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsedigits();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c165(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseexp() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parsee();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsedigits();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c166(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsedigits() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsedigit();
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsedigit();
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c167(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsedigit() {
    var s0;

    if (peg$c168.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c169); }
    }

    return s0;
  }

  function peg$parsedigit19() {
    var s0;

    if (peg$c170.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c171); }
    }

    return s0;
  }

  function peg$parsehexDigit() {
    var s0;

    if (peg$c172.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c173); }
    }

    return s0;
  }

  function peg$parsee() {
    var s0, s1, s2;

    s0 = peg$currPos;
    if (peg$c174.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c175); }
    }
    if (s1 !== peg$FAILED) {
      if (peg$c176.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c177); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c178(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_NULL() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c179) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c180); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_TRUE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c181) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c182); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_FALSE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c183) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c184); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_SHOW() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c185) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c186); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_DROP() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c187) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c188); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_SELECT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c189) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c190); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_UPDATE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c191) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c192); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_CREATE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c193) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c194); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_DELETE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c195) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c196); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_INSERT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c197) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c198); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_REPLACE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7).toLowerCase() === peg$c199) {
      s1 = input.substr(peg$currPos, 7);
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c200); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_EXPLAIN() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7).toLowerCase() === peg$c201) {
      s1 = input.substr(peg$currPos, 7);
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c202); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_INTO() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c203) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c204); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_FROM() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c205) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c206); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_SET() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c207) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c208); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_AS() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c209) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c210); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_TABLE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c211) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c212); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_ON() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c213) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c214); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_LEFT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c215) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c216); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_INNER() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c217) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c218); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_JOIN() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c219) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c220); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_UNION() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c221) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c222); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_VALUES() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c223) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c224); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_USING() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c225) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c226); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_WHERE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c227) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c228); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_GROUP() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c229) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c230); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_BY() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c231) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c232); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_ORDER() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c233) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c234); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_HAVING() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c235) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c236); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_LIMIT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c237) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c238); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_ASC() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c239) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c240); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c241();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_DESC() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c242) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c243); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c244();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_ALL() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c245) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c246); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c247();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_DISTINCT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 8).toLowerCase() === peg$c248) {
      s1 = input.substr(peg$currPos, 8);
      peg$currPos += 8;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c249); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c250();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_BETWEEN() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7).toLowerCase() === peg$c251) {
      s1 = input.substr(peg$currPos, 7);
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c252); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c253();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_IN() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c254) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c255); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c256();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_IS() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c257) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c258); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c259();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_LIKE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c260) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c261); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c262();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_EXISTS() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c263) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c264); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c265();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_NOT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c266) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c267); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c268();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_AND() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c269) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c270); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c271();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_OR() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c272) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c273); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c274();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_COUNT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c275) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c276); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c277();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_MAX() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c278) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c279); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c280();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_MIN() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c281) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c282); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c283();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_SUM() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c284) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c285); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c286();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_AVG() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c287) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c288); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c289();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_CASE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c290) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c291); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_WHEN() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c292) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c293); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_THEN() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c294) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c295); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_ELSE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c296) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c297); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_END() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c298) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c299); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_CAST() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c300) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c301); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_CHAR() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c302) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c303); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c304();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_VARCHAR() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7).toLowerCase() === peg$c305) {
      s1 = input.substr(peg$currPos, 7);
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c306); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c307();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_NUMERIC() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7).toLowerCase() === peg$c308) {
      s1 = input.substr(peg$currPos, 7);
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c309); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c310();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_DECIMAL() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7).toLowerCase() === peg$c311) {
      s1 = input.substr(peg$currPos, 7);
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c312); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c313();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_SIGNED() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c314) {
      s1 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c315); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c316();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_UNSIGNED() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 8).toLowerCase() === peg$c317) {
      s1 = input.substr(peg$currPos, 8);
      peg$currPos += 8;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c318); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c319();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_INT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c320) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c321); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c322();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_INTEGER() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7).toLowerCase() === peg$c323) {
      s1 = input.substr(peg$currPos, 7);
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c324); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c325();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_SMALLINT() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 8).toLowerCase() === peg$c326) {
      s1 = input.substr(peg$currPos, 8);
      peg$currPos += 8;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c327); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c328();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_DATE() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c329) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c330); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c331();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_TIME() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c332) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c333); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c334();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_TIMESTAMP() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 9).toLowerCase() === peg$c335) {
      s1 = input.substr(peg$currPos, 9);
      peg$currPos += 9;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c336); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseident_start();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c337();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseKW_VAR_PRE() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 36) {
      s0 = peg$c338;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c339); }
    }

    return s0;
  }

  function peg$parseKW_RETURN() {
    var s0;

    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c340) {
      s0 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c341); }
    }

    return s0;
  }

  function peg$parseKW_ASSIGN() {
    var s0;

    if (input.substr(peg$currPos, 2) === peg$c342) {
      s0 = peg$c342;
      peg$currPos += 2;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c343); }
    }

    return s0;
  }

  function peg$parseKW_DUAL() {
    var s0;

    if (input.substr(peg$currPos, 4) === peg$c344) {
      s0 = peg$c344;
      peg$currPos += 4;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c345); }
    }

    return s0;
  }

  function peg$parseOPT_SQL_CALC_FOUND_ROWS() {
    var s0;

    if (input.substr(peg$currPos, 19).toLowerCase() === peg$c346) {
      s0 = input.substr(peg$currPos, 19);
      peg$currPos += 19;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c347); }
    }

    return s0;
  }

  function peg$parseOPT_SQL_CACHE() {
    var s0;

    if (input.substr(peg$currPos, 9).toLowerCase() === peg$c348) {
      s0 = input.substr(peg$currPos, 9);
      peg$currPos += 9;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c349); }
    }

    return s0;
  }

  function peg$parseOPT_SQL_NO_CACHE() {
    var s0;

    if (input.substr(peg$currPos, 12).toLowerCase() === peg$c350) {
      s0 = input.substr(peg$currPos, 12);
      peg$currPos += 12;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c351); }
    }

    return s0;
  }

  function peg$parseOPT_SQL_SMALL_RESULT() {
    var s0;

    if (input.substr(peg$currPos, 16).toLowerCase() === peg$c352) {
      s0 = input.substr(peg$currPos, 16);
      peg$currPos += 16;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c353); }
    }

    return s0;
  }

  function peg$parseOPT_SQL_BIG_RESULT() {
    var s0;

    if (input.substr(peg$currPos, 14).toLowerCase() === peg$c354) {
      s0 = input.substr(peg$currPos, 14);
      peg$currPos += 14;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c355); }
    }

    return s0;
  }

  function peg$parseOPT_SQL_BUFFER_RESULT() {
    var s0;

    if (input.substr(peg$currPos, 17).toLowerCase() === peg$c356) {
      s0 = input.substr(peg$currPos, 17);
      peg$currPos += 17;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c357); }
    }

    return s0;
  }

  function peg$parseDOT() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 46) {
      s0 = peg$c163;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c164); }
    }

    return s0;
  }

  function peg$parseCOMMA() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 44) {
      s0 = peg$c358;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c359); }
    }

    return s0;
  }

  function peg$parseSTAR() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 42) {
      s0 = peg$c73;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c74); }
    }

    return s0;
  }

  function peg$parseLPAREN() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 40) {
      s0 = peg$c1;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c2); }
    }

    return s0;
  }

  function peg$parseRPAREN() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 41) {
      s0 = peg$c3;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c4); }
    }

    return s0;
  }

  function peg$parseLBRAKE() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 91) {
      s0 = peg$c360;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c361); }
    }

    return s0;
  }

  function peg$parseRBRAKE() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 93) {
      s0 = peg$c362;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c363); }
    }

    return s0;
  }

  function peg$parse__() {
    var s0, s1;

    s0 = [];
    s1 = peg$parsewhitespace();
    if (s1 === peg$FAILED) {
      s1 = peg$parsecomment();
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = peg$parsewhitespace();
      if (s1 === peg$FAILED) {
        s1 = peg$parsecomment();
      }
    }

    return s0;
  }

  function peg$parsecomment() {
    var s0;

    s0 = peg$parseblock_comment();
    if (s0 === peg$FAILED) {
      s0 = peg$parseline_comment();
    }

    return s0;
  }

  function peg$parseblock_comment() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c364) {
      s1 = peg$c364;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c365); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 2) === peg$c366) {
        s5 = peg$c366;
        peg$currPos += 2;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c367); }
      }
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parsechar();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        if (input.substr(peg$currPos, 2) === peg$c366) {
          s5 = peg$c366;
          peg$currPos += 2;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c367); }
        }
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parsechar();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c366) {
          s3 = peg$c366;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c367); }
        }
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseline_comment() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c368) {
      s1 = peg$c368;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c369); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      s5 = peg$parseEOL();
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parsechar();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        s5 = peg$parseEOL();
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parsechar();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsechar() {
    var s0;

    if (input.length > peg$currPos) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c370); }
    }

    return s0;
  }

  function peg$parsewhitespace() {
    var s0;

    if (peg$c371.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c372); }
    }

    return s0;
  }

  function peg$parseEOL() {
    var s0, s1;

    s0 = peg$parseEOF();
    if (s0 === peg$FAILED) {
      s0 = [];
      if (peg$c153.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c154); }
      }
      if (s1 !== peg$FAILED) {
        while (s1 !== peg$FAILED) {
          s0.push(s1);
          if (peg$c153.test(input.charAt(peg$currPos))) {
            s1 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c154); }
          }
        }
      } else {
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parseEOF() {
    var s0, s1;

    s0 = peg$currPos;
    peg$silentFails++;
    if (input.length > peg$currPos) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c370); }
    }
    peg$silentFails--;
    if (s1 === peg$FAILED) {
      s0 = void 0;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproc_stmts() {
    var s0, s1;

    s0 = [];
    s1 = peg$parseproc_stmt();
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = peg$parseproc_stmt();
    }

    return s0;
  }

  function peg$parseproc_stmt() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    peg$savedPos = peg$currPos;
    s1 = peg$c373();
    if (s1) {
      s1 = void 0;
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseassign_stmt();
        if (s3 === peg$FAILED) {
          s3 = peg$parsereturn_stmt();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c374(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseassign_stmt() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsevar_decl();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseKW_ASSIGN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseproc_expr();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c375(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsereturn_stmt() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_RETURN();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseproc_expr();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c376(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproc_expr() {
    var s0;

    s0 = peg$parseselect_stmt();
    if (s0 === peg$FAILED) {
      s0 = peg$parseproc_join();
      if (s0 === peg$FAILED) {
        s0 = peg$parseproc_additive_expr();
        if (s0 === peg$FAILED) {
          s0 = peg$parseproc_array();
        }
      }
    }

    return s0;
  }

  function peg$parseproc_additive_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseproc_multiplicative_expr();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseadditive_operator();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseproc_multiplicative_expr();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseadditive_operator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseproc_multiplicative_expr();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c42(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproc_multiplicative_expr() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseproc_primary();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parsemultiplicative_operator();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseproc_primary();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parsemultiplicative_operator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseproc_primary();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c42(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproc_join() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsevar_decl();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsejoin_op();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsevar_decl();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseon_clause();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c377(s1, s3, s5, s7);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproc_primary() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$parseliteral();
    if (s0 === peg$FAILED) {
      s0 = peg$parsevar_decl();
      if (s0 === peg$FAILED) {
        s0 = peg$parseproc_func_call();
        if (s0 === peg$FAILED) {
          s0 = peg$parseparam();
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            s1 = peg$parseLPAREN();
            if (s1 !== peg$FAILED) {
              s2 = peg$parse__();
              if (s2 !== peg$FAILED) {
                s3 = peg$parseproc_additive_expr();
                if (s3 !== peg$FAILED) {
                  s4 = peg$parse__();
                  if (s4 !== peg$FAILED) {
                    s5 = peg$parseRPAREN();
                    if (s5 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c79(s3);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseproc_func_call() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseident();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseLPAREN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseproc_primary_list();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseRPAREN();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c378(s1, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproc_primary_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseproc_primary();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseCOMMA();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseproc_primary();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseCOMMA();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseproc_primary();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c10(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproc_array() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseLBRAKE();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseproc_primary_list();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseRBRAKE();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c379(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsevar_decl() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseKW_VAR_PRE();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseident_name();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsemem_chain();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c380(s2, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsemem_chain() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 46) {
      s3 = peg$c163;
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c164); }
    }
    if (s3 !== peg$FAILED) {
      s4 = peg$parseident_name();
      if (s4 !== peg$FAILED) {
        s3 = [s3, s4];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s3 = peg$c163;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c164); }
      }
      if (s3 !== peg$FAILED) {
        s4 = peg$parseident_name();
        if (s4 !== peg$FAILED) {
          s3 = [s3, s4];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c381(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsedata_type() {
    var s0;

    s0 = peg$parsecharacter_string_type();
    if (s0 === peg$FAILED) {
      s0 = peg$parsenumeric_type();
      if (s0 === peg$FAILED) {
        s0 = peg$parsedatetime_type();
      }
    }

    return s0;
  }

  function peg$parsecharacter_string_type() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    s1 = peg$parseKW_CHAR();
    if (s1 === peg$FAILED) {
      s1 = peg$parseKW_VARCHAR();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseLPAREN();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = [];
            if (peg$c168.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c169); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c168.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c169); }
                }
              }
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseRPAREN();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c382(s1, s5);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseKW_CHAR();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c383(s1);
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseKW_VARCHAR();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c383(s1);
        }
        s0 = s1;
      }
    }

    return s0;
  }

  function peg$parsenumeric_type() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parseKW_NUMERIC();
    if (s1 === peg$FAILED) {
      s1 = peg$parseKW_DECIMAL();
      if (s1 === peg$FAILED) {
        s1 = peg$parseKW_INT();
        if (s1 === peg$FAILED) {
          s1 = peg$parseKW_INTEGER();
          if (s1 === peg$FAILED) {
            s1 = peg$parseKW_SMALLINT();
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c383(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsedatetime_type() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parseKW_DATE();
    if (s1 === peg$FAILED) {
      s1 = peg$parseKW_TIME();
      if (s1 === peg$FAILED) {
        s1 = peg$parseKW_TIMESTAMP();
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c383(s1);
    }
    s0 = s1;

    return s0;
  }


    var reservedMap = {
      'ALL': true,
      'AND': true,
      'AS': true,
      'ASC': true,

      'BETWEEN': true,
      'BY': true,

      'CASE': true,
      'CREATE': true,
      'CONTAINS': true,

      'DELETE': true,
      'DESC': true,
      'DISTINCT': true,
      'DROP': true,

      'ELSE': true,
      'END': true,
      'EXISTS': true,
      'EXPLAIN': true,

      'FALSE': true,
      'FROM': true,

      'GROUP': true,

      'HAVING': true,

      'IN': true,
      'INDEX': true,
      'INNER': true,
      'INSERT': true,
      'INTO': true,
      'IS': true,

      'JOIN': true,

      'LEFT': true,
      'LIKE': true,
      'LIMIT': true,

      'NOT': true,
      'NULL': true,

      'ON': true,
      'OR': true,
      'ORDER': true,

      'REPLACE': true,

      'SELECT': true,
      'SET': true,
      'SHOW': true,
      'STATUS': true, // reserved (MySQL)

      'TABLE': true,
      'THEN': true,
      'TRUE': true,
      'TYPE': true,   // reserved (MySQL)

      'UNION': true,
      'UPDATE': true,
      'USING': true,

      'VALUES': true,

      'WHEN': true,
      'WHERE': true
    };

    function createUnaryExpr(op, e) {
      return {
        type: 'unary_expr',
        operator: op,
        expr: e
      };
    }

    function createBinaryExpr(op, left, right) {
      return {
        type: 'binary_expr',
        operator: op,
        left: left,
        right: right
      };
    }

    function createList(head, tail) {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
        result.push(tail[i][3]);
      }
      return result;
    }

    function createBinaryExprChain(head, tail) {
      var result = head;
      for (var i = 0; i < tail.length; i++) {
        result = createBinaryExpr(tail[i][1], result, tail[i][3]);
      }
      return result;
    }

    var cmpPrefixMap = {
      '+': true,
      '-': true,
      '*': true,
      '/': true,
      '>': true,
      '<': true,
      '!': true,
      '=': true,

      //between
      'B': true,
      'b': true,
      //for is or in
      'I': true,
      'i': true,
      //for like
      'L': true,
      'l': true,
      //for not
      'N': true,
      'n': true
    };

    // used for dependency analysis
    var varList = [];


  peg$result = peg$startRuleFunction();

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }

    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length
        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}

module.exports = {
  SyntaxError: peg$SyntaxError,
  parse:       peg$parse
};

},{}]},{},[1])(1)
});
