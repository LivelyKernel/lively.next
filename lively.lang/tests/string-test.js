/* global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout */

import { expect } from 'mocha-es6';
import {
  lineNumberToIndexesComputer,
  stringMatch,
  indent,
  minIndent,
  joinPath,
  printTree,
  reMatches,
  paragraphs,
  tableize,
  format,
  md5,
  changeIndent,
  applyChange,
  lineIndexComputer
} from '../string.js';

describe('string', function () {
  it('tableize', function () {
    expect([['a', 'b', 'c'], ['d', 'e', 'f']]).to.eql(tableize('a b c\nd e f'));
    expect([['a', 1, 'c'], ['d', 2, 'f']]).to.eql(tableize('a 1 c\nd 2 f'));
    expect([['Date'], [new Date('06/11/2013')]]).to.eql(tableize('Date\n06/11/2013'));
  });

  describe('line index computations', () => {
    it('lineLookupByIndex', function () {
      let s = 'test\n123\nfo\nbarbaz\nzork\n';
      let lookupFunc = lineIndexComputer(s);
      expect(0).to.equal(lookupFunc(0), 'char pos: 0');
      expect(0).to.equal(lookupFunc(1), 'char pos: 1');
      expect(0).to.equal(lookupFunc(4), 'char pos: 4');
      expect(1).to.equal(lookupFunc(5), 'char pos: 5');
      expect(1).to.equal(lookupFunc(7), 'char pos: 7');
      expect(1).to.equal(lookupFunc(8), 'char pos: 8');
      expect(2).to.equal(lookupFunc(9), 'char pos: 9');
      expect(4).to.equal(lookupFunc(23), 'char pos: 2');
      expect(5).to.equal(lookupFunc(24), 'char pos: 2');
      expect(-1).to.equal(lookupFunc(99), 'char pos: 9');
    });

    it('newlines are correctly indexed', () => {
      expect(lineIndexComputer('\n\nTest')(1)).to.equal(1);
    });
  });

  it('finds index range for line', function () {
    let s = 'test\n123\nfo\nbarbaz\nzork\n';
    let lookupFunc = lineNumberToIndexesComputer(s);
    expect(lookupFunc(1)).to.eql([5, 9]);
  });

  it('findParagraphs', function () {
    let tests = [
      { string: 'foo', expected: ['foo'] },
      { string: 'foo\nbar', expected: ['foo\nbar'] },
      { string: 'foo\n\nbar', expected: ['foo', 'bar'] },
      { string: 'foo\n\n\n\nbar', expected: ['foo', 'bar'] },
      { string: 'a\n\n\n\nb\nc', expected: ['a', '\n\n', 'b\nc'], options: { keepEmptyLines: true } }
    ];
    tests.forEach(function (test) {
      expect(test.expected).to.eql(paragraphs(test.string, test.options));
    });
  });

  it('printTree', function () {
    var tree = tree = {
      string: 'root',
      children: [{
        string: 'a',
        children: [{
          string: 'b',
          children: [{ string: 'c' }, { string: 'd' }]
        }]
      }, {
        string: 'e',
        children: [{
          string: 'f',
          children: [{ string: 'g' }, { string: 'h' }]
        }]
      }]
    };
    let expected = 'root\n' +
                 '|---a\n' +
                 '|   \\---b\n' +
                 '|       |---c\n' +
                 '|       \\---d\n' +
                 '\\---e\n' +
                 '    \\---f\n' +
                 '        |---g\n' +
                 '        \\---h';
    let actual = printTree(tree,
      function (n) { return n.string; },
      function (n) { return n.children; }, '    ');
    expect(expected).to.equal(actual);
  });

  it('stringMatch', function () {
    let sucesses = [
      { string: 'foo bar', pattern: 'foo bar' },
      { string: 'foo   bar', pattern: 'foo bar', normalizeWhiteSpace: true },
      { string: 'foo bar', pattern: 'foo __/bar/__' },
      { string: 'foo bar 123 baz', pattern: 'foo bar __/[0-9]+/__ baz' },
      { string: '  foo\n   123\n bla', pattern: 'foo\n __/[0-9]+/__\n     bla', ignoreIndent: true }];
    sucesses.forEach(function (ea) {
      let match = stringMatch(
        ea.string, ea.pattern,
        { normalizeWhiteSpace: ea.normalizeWhiteSpace, ignoreIndent: ea.ignoreIndent });
      if (!match.matched) {
        expect().fail('stringMatch not matching:\n' + ea.string +
        '\nwith:\n' + ea.pattern +
        '\nbecause:\n ' + JSON.stringify(match));
      }
    });

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    let failures = [
      { string: 'foo bar 12x baz', pattern: 'foo bar __/[0-9]+/__ baz' }];
    failures.forEach(function (ea) {
      let match = stringMatch(
        ea.string, ea.pattern,
        { normalizeWhiteSpace: ea.normalizeWhiteSpace });
      if (match.matched) {
        expect().fail(
          'stringMatch unexpectedly matched:\n' + ea.string +
        '\nwith:\n' + ea.pattern +
        '\nbecause:\n ' + JSON.stringify(match));
      }
    });
  });

  describe('indentation', () => {
    it('indent', function () {
      expect(indent('hello\n world', '  ', 2)).equal('    hello\n     world');
    });

    it('minIndent', function () {
      expect(minIndent('hello\n world', '  ')).equal(0);
      expect(minIndent(' hello\n world', '  ')).equal(0);
      expect(minIndent('  hello\n world', '  ')).equal(0);
      expect(minIndent('  hello\n  world', '  ')).equal(1);
      expect(minIndent('   hello\n  world', '  ')).equal(1);
      expect(minIndent('    hello\n  world', '  ')).equal(1);
      expect(minIndent('    hello\n    world', '  ')).equal(2);
      expect(minIndent('      hello\n      world', '  ')).equal(3);
    });

    it('changeIndent', function () {
      expect(changeIndent('hello\n world', '  ', 2)).equal('    hello\n     world');
      expect(changeIndent('  hello\n world', '  ', 2)).equal('      hello\n     world');
      expect(changeIndent('  hello\n  world', '  ', 2)).equal('    hello\n    world');
      expect(changeIndent('  hello\n  world', '  ', 1)).equal('  hello\n  world');
      expect(changeIndent('  hello\n  world', '  ', 0)).equal('hello\nworld');
      expect(changeIndent('  hello\n world', '  ', 0)).equal('  hello\n world');
    });
  });

  it('reMatches', function () {
    let s = 'abc def abc xyz';
    let expected = [{ start: 4, end: 11, match: 'def abc' }];
    expect(expected).to.eql(reMatches(s, /def\s[^\s]+/));
  });

  it('formats', function () {
    expect('foo bar').to.eql(format('foo %s', 'bar'));
  });

  describe('md5', function () {
    it('encodes', function () {
      // test suite from RFC 1321
      let testData = [
        {
          input: '',
          expected: 'd41d8cd98f00b204e9800998ecf8427e'
        },
        {
          input: 'a',
          expected: '0cc175b9c0f1b6a831c399e269772661'
        },
        {
          input: 'abc',
          expected: '900150983cd24fb0d6963f7d28e17f72'
        },
        {
          input: 'message digest',
          expected: 'f96b697d7cb7938d525a2f31aaf161d0'
        },
        {
          input: 'abcdefghijklmnopqrstuvwxyz',
          expected: 'c3fcd3d76192e4007dfb496cca67e13b'
        },
        {
          input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
          expected: 'd174ab98d277d9f5a5611c2c9f419d9f'
        },
        {
          input: '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
          expected: '57edf4a22be3c955ac49da2e2107b67a'
        }
      ];
      testData.forEach(function (data, i) {
        expect(data.expected).to.equal(md5(data.input));
      });
    });
  });

  describe('join paths', function () {
    it('adds slash if necessary', function () {
      expect(joinPath('foo', 'bar')).to.equal('foo/bar');
      expect(joinPath('foo', 'bar', 'baz')).to.equal('foo/bar/baz');
      expect(joinPath('foo', 'bar', '/baz')).to.equal('foo/bar/baz');
      expect(joinPath('foo', 'bar/', '/baz')).to.equal('foo/bar/baz');
      expect(joinPath('/foo/', '/bar/', '/baz/')).to.equal('/foo/bar/baz/');
      expect(joinPath('file:///foo/bar', '/baz/')).to.equal('file:///foo/bar/baz/');
    });

    it('normalizes slashes', function () {
      expect(joinPath('foo//', '///bar')).to.equal('foo/bar');
    });
  });

  describe('insertion and removal change', function () {
    let baseString = 'hello\n  world';

    it('inserts line', function () {
      expect(applyChange(baseString, { action: 'insert', start: 3, lines: ['3 + 4'] }))
        .equal('hel3 + 4lo\n  world');
    });

    it('inserts lines', function () {
      expect(applyChange(baseString, { action: 'insert', start: 3, lines: ['3 + 4', ' oioioi'] }))
        .equal('hel3 + 4\n oioioilo\n  world');
    });

    it('remove lines', function () {
      expect(applyChange(baseString, { action: 'remove', start: 3, end: 9 }))
        .equal('helorld');
    });
  });
});
