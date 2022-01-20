/* global describe, it */

import { expect } from 'mocha-es6';

import { arr } from 'lively.lang';
import {
  replace, _compareNodesForReplacement, replaceNodes, replaceNode,
  oneDeclaratorPerVarDecl,
  returnLastStatement,
  wrapInFunction,
  wrapInStartEndCall
} from '../lib/transform.js';
import objectSpreadTransform from '../lib/object-spread-transform.js';
import * as nodes from '../lib/nodes.js';
import { parse } from '../lib/parser.js';
import stringify from '../lib/stringify.js';

describe('ast.transform', function () {
  describe('helper', function () {
    it('replaceNode', function () {
      let source = 'var x = 3,\n' +
                 '    y = x + x;\n' +
                 'y + 2;\n';
      let parsed = parse(source);
      let target = parsed.body[0].declarations[0].init;
      let hist = replaceNode(target,
        () => ({ type: 'Literal', value: 'foo' }),
        { changes: [], source: source });
      let expected = {
        changes: [{ type: 'del', pos: 8, length: 1 },
          { type: 'add', pos: 8, string: '"foo"' }],
        source: source.replace('3', '"foo"')
      };
      expect(hist).deep.equals(expected);
    });

    it('replaceNodesInformsAboutChangedNodes', function () {
      let source = 'var x = 3;\n'; let parsed = parse(source);

      let replacement1 = { type: 'Literal', value: 23 };
      let replacement2 = { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'zzz' }, init: { type: 'Literal', value: 24 } };
      let wasChanged1; let wasChanged2;

      let hist = replaceNodes([
        { target: parsed.body[0].declarations[0].init, replacementFunc: function (node, source, wasChanged) { wasChanged1 = wasChanged; return replacement1; } },
        { target: parsed.body[0].declarations[0], replacementFunc: function (node, source, wasChanged) { wasChanged2 = wasChanged; return replacement2; } }],
      { changes: [], source: source });

      expect(!wasChanged1).equals(true, 'wasChanged1');
      expect(wasChanged2).equals(true, 'wasChanged2');

      expect(hist.source).deep.equals('var zzz = 24;\n');
    });

    it('sortNodesForReplace', function () {
      let source = 'var x = 3,\n' +
                 '    y = x + x;\n' +
                 'y + 2;\n';
      let parsed = parse(source);
      let result = [
        parsed.body[0],
        parsed.body[0].declarations[1].init.right,
        parsed.body[0].declarations[1].init.left,
        parsed.body[1]].sort(_compareNodesForReplacement);
      let expected = [
        parsed.body[0].declarations[1].init.left,
        parsed.body[0].declarations[1].init.right,
        parsed.body[0],
        parsed.body[1]];
      expect(result).deep.equals(expected, arr.pluck(expected, 'type') + ' !== ' + arr.pluck(result, 'type'));
    });

    it('replaceNestedNodes', function () {
      let source = 'var x = 3,\n' +
           '    y = x + x;\n' +
           'y + 2;\n';
      let parsed = parse(source);
      let replaceSource1, replaceSource2;
      let hist = replaceNodes([
        { target: parsed.body[0], replacementFunc: function (n, source) { replaceSource1 = source; return { type: 'Literal', value: 'foo' }; } },
        { target: parsed.body[0].declarations[1].init.right, replacementFunc: function (n, source) { replaceSource2 = source; return { type: 'Literal', value: 'bar' }; } }],
      { changes: [], source: source });

      let expected = {
        changes: [{ type: 'del', pos: 23, length: 1 },
          { type: 'add', pos: 23, string: '"bar"' },
          { type: 'del', pos: 0, length: 29 },
          { type: 'add', pos: 0, string: '"foo"' }],
        source: '"foo"\ny + 2;\n'
      };

      expect(hist).deep.equals(expected);

      expect(replaceSource1).equals(source.split(';')[0].replace('x + x', 'x + "bar"') + ';');
      expect(replaceSource2).equals('x');
    });

    it('replaceNestedAndSubsequentNodes', function () {
      let source = 'var x = 3,\n' +
           '    y = x + x;\n' +
           'y + 2;\n';
      let parsed = parse(source);
      let hist = replaceNodes([
        { target: parsed.body[0], replacementFunc: function (node, source) { return { type: 'Literal', value: 'foo' }; } },
        { target: parsed.body[0].declarations[1].init.right, replacementFunc: function () { return { type: 'Literal', value: 'bar' }; } }],
      { changes: [], source: source });

      let expected = {
        changes: [{ type: 'del', pos: 23, length: 1 },
          { type: 'add', pos: 23, string: '"bar"' },
          { type: 'del', pos: 0, length: 29 },
          { type: 'add', pos: 0, string: '"foo"' }],
        source: '"foo"\ny + 2;\n'
      };

      expect(hist).deep.equals(expected);
    });
  });

  // interface tests
  describe('interface', function () {
    describe('replacement', function () {
      it('manual', function () {
        let code = 'var x = 3 + foo();';
        let parsed = parse(code);
        let toReplace = parsed.body[0].declarations[0].init.left;
        let replacement = function () { return { type: 'Literal', value: 'baz' }; };
        let result = replace(parsed, toReplace, replacement);
        let transformedString = result.source;
        let expected = 'var x = "baz" + foo();';

        expect(transformedString).equals(expected);

        expect(result.changes).deep.equals([{ length: 1, pos: 8, type: 'del' }, { pos: 8, string: '"baz"', type: 'add' }]);
      });

      it('replaceNodeKeepsSourceFormatting', function () {
        let code = 'var x = 3\n+ foo();';
        let parsed = parse(code, { addSource: true });
        let toReplace = parsed.body[0].declarations[0].init.left;
        let replacement = function () { return { type: 'Literal', value: 'baz' }; };
        let result = replace(parsed, toReplace, replacement);
        let expected = 'var x = "baz"\n+ foo();';

        expect(result.source).equals(expected);
      });

      it('replaceNodeWithMany', function () {
        let code = 'var x = 3, y = 2;';
        let parsed = parse(code);
        let toReplace = parsed.body[0];
        let replacement1 = parse('Global.x = 3').body[0];
        let replacement2 = parse('Global.y = 2').body[0];
        let replacement = function () { return [replacement1, replacement2]; };
        let result = replace(parsed, toReplace, replacement);
        let expected = 'Global.x = 3;\nGlobal.y = 2;';

        expect(result.source).equals(expected);
      });

      it('replaceNodeWithManyKeepsSource', function () {
        let code = '/*bla\nbla*/\n  var x = 3,\n      y = 2;';
        let parsed = parse(code, {});
        let toReplace = parsed.body[0];
        let replacement = function () {
          return [parse('Global.x = 3').body[0],
            parse('Global.y = 2').body[0]];
        };
        let result = replace(code, toReplace, replacement);
        let expected = '/*bla\nbla*/\n  Global.x = 3;\n  Global.y = 2;';

        expect(result.source).equals(expected);
      });
    });

    describe('simplify var decls', function () {
      it('one var declarator per declaration', function () {
        let code = '/*test*/var x = 3, y = 2; function foo() { var z = 1, u = 0; }';
        let result = oneDeclaratorPerVarDecl(code);
        let expected = '/*test*/var x = 3;\nvar y = 2; function foo() { var z = 1;\n var u = 0; }';
        expect(result.source).equals(expected);

        code = 'var x = 3, y = (function() { var y = 3, z = 2; })(); ';
        result = oneDeclaratorPerVarDecl(code);
        expected = 'var x = 3;\nvar y = function () {\n    var y = 3;\n    var z = 2;\n}(); ';
        expect(result.source.replace(/\s/g, '')).equals(expected.replace(/\s/g, ''));
      });
    });
  });

  describe('return last statement', () => {
    it('transforms last statement into return', () =>
      expect(returnLastStatement('var z = foo + bar; baz.foo(z, 3)'))
        .equals('var z = foo + bar;\nreturn baz.foo(z, 3);'));

    it('ignores non-value statements', () =>
      expect(returnLastStatement('var x = 3; while(x > 0) foo(x--)'))
        .equals('var x = 3; while(x > 0) foo(x--)'));
  });

  describe('wrapInFunction', () => {
    it('wraps statements into a function', () =>
      expect(wrapInFunction('var z = foo + bar; baz.foo(z, 3);'))
        .equals('function() {\nvar z = foo + bar;\nreturn baz.foo(z, 3);\n}'));

    it('returns ast', () =>
      expect(stringify(wrapInFunction('3 + 4;', { asAST: true, id: 'foo' })))
        .equals('function foo() {\n  return 3 + 4;\n}'));
  });

  describe('wrapInStartEndCall', () => {
    it('calls with last expression', () =>
      expect(stringify(wrapInStartEndCall('var y = x + 23; y'))).to.equal(
        'try {\n' +
      '  __start_execution();\n' +
      '  var y = x + 23;\n' +
      '  __end_execution(null, y);\n' +
      '} catch (err) {\n' +
      '  __end_execution(err, undefined);\n' +
      '}'));

    it('allows customization of calls', () =>
      expect(stringify(wrapInStartEndCall('var y = x + 23; y', {
        startFuncNode: nodes.member('foo', 'start'),
        endFuncNode: nodes.member('foo', 'end')
      }))).to.equal(
        'try {\n' +
      '  foo.start();\n' +
      '  var y = x + 23;\n' +
      '  foo.end(null, y);\n' +
      '} catch (err) {\n' +
      '  foo.end(err, undefined);\n' +
      '}'));

    it('passes last var decl into function', () =>
      expect(stringify(wrapInStartEndCall('var x = 2, y = x + 23;', {
        startFuncNode: nodes.member('foo', 'start'),
        endFuncNode: nodes.member('foo', 'end')
      }))).to.equal(
        'try {\n' +
      '  foo.start();\n' +
      '  var x = 2, y = x + 23;\n' +
      '  foo.end(null, y);\n' +
      '} catch (err) {\n' +
      '  foo.end(err, undefined);\n' +
      '}'));

    it('passes function statement into call', () =>
      expect(stringify(wrapInStartEndCall('function x() {}', {
        startFuncNode: nodes.member('foo', 'start'),
        endFuncNode: nodes.member('foo', 'end')
      }))).to.equal(
        'function x() {\n}\n' +
      'try {\n' +
      '  foo.start();\n' +
      '  foo.end(null, x);\n' +
      '} catch (err) {\n' +
      '  foo.end(err, undefined);\n' +
      '}'));
  });
});

describe('object spread transform', () => {
  it('transforms into assign', () =>
    expect(stringify(objectSpreadTransform(parse('var x = {y, ...z}')))).to.equal(
      'var x = Object.assign({ y: y }, z);'));

  it('transforms into assign nested', () =>
    expect(stringify(objectSpreadTransform(parse('var x = {y, a: {...z}}')))).to.equal(
      'var x = {\n  y: y,\n  a: Object.assign({}, z)\n};'));
});
