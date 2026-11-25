/* global beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';

import { printAst } from '../lib/mozilla-ast-visitor-interface.js';
import { parse, parseFunction } from '../lib/parser.js';
import * as query from '../lib/query.js';

describe('parse', function () {
  it('JavaScript code', () =>
    expect(parse('1 + 2'))
      .nested.property('body[0].type')
      .equals('ExpressionStatement'));

  describe('with source', () => {
    const source = 'import { x } from "a"; export { x } from "b"; export class Counter { increment () { return 1; } }';

    it('keeps the module specifiers of imports and exports', () => {
      const [imported, reexported, exported] = parse(source, { addSource: true }).body;
      expect(imported.source.value).equals('a');
      expect(reexported.source.value).equals('b');
      expect(exported.source).equals(null, 'an export without "from" has no module specifier');
      expect(exported.declaration.source).equals('class Counter { increment () { return 1; } }');
    });

    it('answers the exporting module of a declaration export', () => {
      const parsed = parse(source, { addSource: true });
      expect(query.exports(query.scopes(parsed)).map(({ exported, fromModule }) => [exported, fromModule]))
        .deep.equals([['x', 'b'], ['Counter', null]]);
    });
  });

  describe('async / await', () => {
    it('parses nested awaits', () => {
      let src = 'await (await foo()).bar()';
      let parsed = parse(src);
      let expected = ':Program(0-25)\n' +
                     '\\-.body[0]:ExpressionStatement(0-25)\n' +
                     '  \\-.body[0].expression:AwaitExpression(0-25)\n' +
                     '    \\-.body[0].expression.argument:CallExpression(6-25)\n' +
                     '      \\-.body[0].expression.argument.callee:MemberExpression(6-23)\n' +
                     '        |-.body[0].expression.argument.callee.object:AwaitExpression(7-18)\n' +
                     '        | \\-.body[0].expression.argument.callee.object.argument:CallExpression(13-18)\n' +
                     '        |   \\-.body[0].expression.argument.callee.object.argument.callee:Identifier(13-16)\n' +
                     '        \\-.body[0].expression.argument.callee.property:Identifier(20-23)';
      expect(printAst(parsed, { printPositions: true })).to.equal(expected);
    });
  });

  describe('parseFunction', () => {
    it('anonmyous function', () => {
      expect(parseFunction('function(x) { return x + 1; }').type).equals('FunctionExpression');
    });

    it('named function', () => {
      expect(parseFunction('function foo(x) { return x + 1; }')).containSubset({ type: 'FunctionExpression', id: { name: 'foo' } });
    });

    it('arrow function', () => {
      expect(parseFunction('(x) => { return x + 1; }')).containSubset({ type: 'ArrowFunctionExpression' });
    });

    it('short function', () => {
      expect(parseFunction('x => x + 1')).containSubset({ type: 'ArrowFunctionExpression' });
    });
  });
});
