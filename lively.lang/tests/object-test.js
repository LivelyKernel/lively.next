/* global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout,System */

import { expect } from 'mocha-es6';
import { isObject, newKeyIn, sortKeysWithBeforeAndAfterConstraints, select, extend, inspect, equals, keys, isRegExp, isFunction, extract, isEmpty, deepCopy, inherit, values, merge, clone, isBoolean, dissoc, isString, isElement, isArray, deepMerge, isNumber, isUndefined, typeStringOf, safeToString, isMutableType, shortPrintStringOf, mergePropertyInHierarchy } from '../object.js';
import * as properties from '../properties.js';
import Path from '../Path.js';

let isNodejs = System.get('@system-env').node;
let GLOBAL = System.global;

describe('object', function () {
  let obj1 = {
    foo: 23,
    bar: [2, { x: "'test'" }],
    get baz () { return '--baz getter--'; },
    method: function (arg1, arg2) { return arg1 + arg2; }
  };

  let obj2 = {
    foo: 24,
    zork: 'test',
    method2: function (arg) { return arg + 1; }
  };

  obj1.__proto__ = obj2;

  describe('type testing', function () {
    it('isElement', function () {
      if (typeof document === 'undefined') return;
      let el = document.createElement('div');
      expect(isElement(el)).to.equal(true);
      expect(isElement({})).to.equal(false);
    });

    it('isArray', function () {
      expect(isArray([1, 2, 3])).to.equal(true);
      expect(isArray([])).to.equal(true);
      expect(isArray({})).to.equal(false);
    });

    it('isFunction', function () {
      expect(isFunction(function () {})).to.equal(true);
      expect(isFunction({})).to.equal(false);
    });

    it('isBoolean', function () {
      expect(isBoolean(false)).to.equal(true);
      expect(isBoolean({})).to.equal(false);
    });

    it('isString', function () {
      expect(isString('bla bla')).to.equal(true);
      expect(isString({})).to.equal(false);
    });

    it('isNumber', function () {
      expect(isNumber(23)).to.equal(true);
      expect(isNumber({})).to.equal(false);
    });

    it('isUndefined', function () {
      expect(isUndefined(undefined)).to.equal(true);
      expect(isUndefined(null)).to.equal(false);
      expect(isUndefined('')).to.equal(false);
      expect(isUndefined({})).to.equal(false);
    });

    it('isRegExp', function () {
      expect(isRegExp(/fooo/)).to.equal(true);
      expect(isRegExp({})).to.equal(false);
      expect(isRegExp(function () {})).to.equal(false);
    });

    it('isObject', function () {
      expect(isObject({})).to.equal(true);
      expect(isObject('foo')).to.equal(false);
      expect(isObject(/123/)).to.equal(true);
      expect(isObject([])).to.equal(true);
      expect(isObject(function () {})).to.equal(false);
    });

    it('isEmpty', function () {
      expect(isEmpty({})).to.equal(true);
      expect(isEmpty({ fOO: 23 })).to.equal(false);
      expect(isEmpty(Object.create(obj1))).to.equal(true);
    });
  });

  describe('equality', function () {
    it('compares structures of objects while ignoring functions completely', function () {
      let a = { foo: { bar: { baz: 23, n: function () { return 23; } } } };
      let b = { foo: { bar: { baz: 23, m: function () { return 24; } } } };
      let c = { foo: { bar: { baz: 24, m: function () { return 25; } } } };
      expect(equals(a, a)).to.equal(true);
      expect(equals(a, b)).to.equal(true);
      expect(equals(a, c)).to.equal(false);
      expect(equals(b, c)).to.equal(false);
      expect(equals(c, c)).to.equal(true);
      expect(equals(GLOBAL, GLOBAL)).to.equal(true);
    });

    it('works with arrays', function () {
      let a = { foo: [{ bar: 23 }] };
      let b = { foo: [{ bar: 23 }] };
      let c = { foo: [{ bar: 24 }] };
      expect(equals(a, a)).to.equal(true);
      expect(equals(a, b)).to.equal(true);
      expect(equals(a, c)).to.equal(false);
      expect(equals(b, c)).to.equal(false);
      expect(equals(c, c)).to.equal(true);
    });

    it('works with objects nested in arrays', function () {
      expect(equals([{}], [{}])).to.equal(true);
    });

    it('null equality', function () {
      expect(equals(0, null)).equals(false, '0 and null');
      expect(equals({ foo: 0 }, { foo: null })).equals(false, '{ foo: 0 }, { foo: null }');
    });
  });

  describe('accessing', function () {
    it('enumerates keys', function () {
      expect(keys(obj1)).to.eql(['foo', 'bar', 'baz', 'method']);
    });

    it('enumerates values', function () {
      expect(values(obj1)).to.eql([obj1.foo, obj1.bar, obj1.baz, obj1.method]);
    });
  });

  describe('extend', function () {
    it('adds and overwrites properties', function () {
      let o = { baz: 99, bar: 66 };
      let extended = extend(o, { foo: 23, bar: { x: 3 } });
      expect(extended).to.equal(o, 'identity issue');
      expect(extended).to.eql({ baz: 99, foo: 23, bar: { x: 3 } });
    });

    it('is getter/setter aware', function () {
      let o = extend({}, {
        get foo () { return this._foo; },
        set foo (v) { return this._foo = v + 1; }
      });
      o.foo = 3;
      expect(o.foo).to.equal(4);
    });

    it('sets display name', function () {
      let o = extend({}, { foo: function () { return 'bar'; } });
      expect(o.foo.displayName).to.equal('foo');
    });

    it('does not override existing function names', function () {
      let o = extend({}, { foo: function myFoo () { return 'bar'; } });
      expect(o.foo.name).to.equal('myFoo');
      expect(o.foo).to.have.property('displayName');
      expect(o.foo.displayName).to.equal('foo');
    });

    it('sets categories', function () {
      let dest = {};
      extend(dest,
        'cat1', {
          m1: function () { return 3; },
          m2: function () { return 4; }
        },
        'cat2', {
          foo: 33
        });
      expect(dest.categories).to.eql({ cat1: ['m1', 'm2'], cat2: ['foo'] });
    });
  });

  describe('extract', function () {
    it('it creates a new object from a list of properties', function () {
      let obj1 = { foo: 23, bar: { x: 24 } };
      let obj2 = extract(obj1, ['foo', 'bar', 'baz']);
      expect(obj1).to.not.equal(obj2);
      expect(obj1).to.eql(obj2);
      expect(obj2).to.not.have.property('baz');
    });

    it('it can map properties', function () {
      let obj1 = { foo: 23, bar: { x: 24 } };
      let obj2 = extract(obj1, ['foo', 'baz'],
        function (k, val) { return val + 1; });
      expect(obj2).to.eql({ foo: 24 });
    });
  });

  describe('inspect', function () {
    it('prints object representation', function () {
      expect(inspect(obj1)).to.equal(
        '{\n' +
         '  bar: [2, {\n' +
         "      x: \"'test'\"\n" +
         '    }],\n' +
         '  baz: "--baz getter--",\n' +
         '  foo: 23,\n' +
         '  method: function method(arg1,arg2) {/*...*/}\n' +
         '}');
    });

    it('observes maxDepth when printing', function () {
      expect(inspect(obj1, { maxDepth: 1 })).to.equal(
        '{\n' +
         '  bar: [/*...*/],\n' +
         '  baz: "--baz getter--",\n' +
         '  foo: 23,\n' +
         '  method: function method(arg1,arg2) {/*...*/}\n' +
         '}');
    });

    it('uses custom printer', function () {
      function customPrinter (val, ignore) { return typeof val === 'number' ? val + 1 : ignore; }
      expect(inspect(obj1, { maxDepth: 1, customPrinter: customPrinter })).equal(
        '{\n' +
         '  bar: [/*...*/],\n' +
         '  baz: "--baz getter--",\n' +
         '  foo: 24,\n' +
         '  method: function method(arg1,arg2) {/*...*/}\n' +
         '}');
    });
  });

  describe('merge', function () {
    it('merges objects', function () {
      let obj1 = { foo: 23, bar: [2, { x: "'test'" }] };
      let obj2 = { foo: 24, zork: 'test' };
      let merged = merge(obj1, obj2);
      expect(merged.foo).to.equal(24);
      expect(obj1.foo).to.equal(23);
      expect(obj2.foo).to.equal(24);
      expect(merged).to.have.property('bar');
      expect(merged).to.have.property('zork');
    });

    it('merges arrays', function () {
      expect(merge([1, 2], [6, 7])).to.eql([1, 2, 6, 7]);
    });

    it('merges hierarchies', function () {
      let obj1 = { foo: { a: 23, b: 4 } };
      let obj2 = { foo: { a: 24, c: 5 } };
      obj1.__proto__ = obj2;
      let merged = mergePropertyInHierarchy(obj1, 'foo');
      expect(merged).to.eql({ a: 23, b: 4, c: 5 });
    });
  });

  describe('deep merge', function () {
    it('combines objects', function () {
      expect(deepMerge({ a: 23, b: { x: 2 } },
        { a: 24, b: { y: 3 } }))
        .to.eql({ a: 24, b: { x: 2, y: 3 } });
    });

    it('combines arrays', function () {
      expect(deepMerge([{ a: 23 }, { b: { x: 2 } }],
        [{ a: 24 }, { b: { y: 3 } }, { c: 3 }]))
        .to.eql([{ a: 24 }, { b: { x: 2, y: 3 } }, { c: 3 }]);
    });

    it('identical', function () {
      expect(deepMerge({ a: [1, 2, 3], c: 3 }, { a: [1, 2, 3], c: 3 }))
        .to.eql({ a: [1, 2, 3], c: 3 });
    });

    it('merges non obj props left to right', function () {
      expect(
        deepMerge(
          { a: [{}, 2, 3], b: 3, c: {} },
          { a: [1, {}, 3], b: {}, c: 4 }))
        .to.deep.equal(
          { a: [1, {}, 3], b: {}, c: 4 });
    });

    it('doesnt merge array and obj', function () {
      expect(deepMerge({ a: [1, 2, 3] }, { a: { 0: 'x', 1: 'y' } }))
        .to.eql({ a: { 0: 'x', 1: 'y' } });
    });

    it('cannot deal with circular refs', function () {
      let obj1 = {}; let obj2 = {};
      obj1.ref = obj2; obj2.ref = obj1;
      expect(function () { deepMerge(obj1, obj2); }).throws();
    });
  });

  describe('select keys', function () {
    it('does what it says', function () {
      expect(select({ a: 1, b: 2, c: 3 }, ['a', 'b'])).eql({ a: 1, b: 2 });
    });
  });

  describe('dissoc', function () {
    it('does what it says', function () {
      let o = { a: 1, b: 2, c: 3 }; let result = dissoc(o, ['a', 'c']);
      expect(o).eql({ a: 1, b: 2, c: 3 });
      expect(result).eql({ b: 2 });
    });

    it('deals with getters / setters', function () {
      let o = { a: 1, get b () { return 23; }, get c () { return 24; } };
      let result = dissoc(o, ['a', 'c']);
      expect(result.__lookupGetter__('b')).to.be.a('function');
    });
  });

  describe('inherit', function () {
    it('inherits', function () {
      let obj1 = { baz: 25 };
      let obj2 = inherit(obj1);
      expect(obj2.hasOwnProperty('baz')).to.equal(false);
      expect(obj2.baz).to.equal(25);
      obj2.baz = 26;
      expect(obj2.hasOwnProperty('baz')).to.equal(true);
      expect(obj2.baz).to.equal(26);
    });
  });

  describe('cloning and copying', function () {
    it('clones objects', function () {
      let cloned = clone(obj1);
      expect(cloned).to.not.equal(obj1);
      cloned.foo = 24;
      cloned.oink = '!';
      expect(cloned.foo).to.equal(24);
      expect(obj1.foo).to.equal(23);
      expect(cloned.oink).to.equal('!');
      expect(obj1).to.not.have.property('oink');
    });

    it('clones arrays', function () {
      let arr1 = [1, 2, 3]; let arr2 = clone(arr1);
      arr1.push(4);
      arr2.push(5);
      expect(arr1).to.eql([1, 2, 3, 4]);
      expect(arr2).to.eql([1, 2, 3, 5]);
    });

    it('can deep copy', function () {
      let o = { a: 3, b: { c: [{}], d: undefined }, e: null, f: function () {}, g: 'string' };
      let copy = deepCopy(o);
      expect(o).to.eql(copy);
      expect(copy).to.eql(o);
      expect(o).to.not.equal(copy);
      expect(o.b).to.not.equal(copy.b);
      expect(o.b.c).to.not.equal(copy.b.c);
      expect(o.b.c[0]).to.not.equal(copy.b.c[0]);
    });
  });

  describe('stringify types', function () {
    it('typeStringOf', function () {
      expect(typeStringOf('some string')).to.equal('String');
      expect(typeStringOf(0)).to.equal('Number');
      expect(typeStringOf(null)).to.equal('null');
      expect(typeStringOf(undefined)).to.equal('undefined');
      expect(typeStringOf([])).to.equal('Array');
      expect(typeStringOf({ a: 2 })).to.equal('Object');
      // expect(obj.typeStringOf(new lively.morphic.Morph())).to.equal('Morph');
    });

    it('shortPrintStringOf', function () {
      expect(shortPrintStringOf([1, 2])).to.equal('[...]', 'filled arrays should be displayed as [...]');
      expect(shortPrintStringOf([])).to.equal('[]', 'empty arrays should be displayed as []');
      expect(shortPrintStringOf(0)).to.equal('0', 'numbers should be displayed as values');
      // expect(obj.shortPrintStringOf(new lively.morphic.Morph())).to.equal( 'Morph', 'short typestring of a morph is still Morph');
    });

    it('isMutableType', function () {
      expect(isMutableType([1, 2])).to.equal(true, 'arrays are mutable');
      expect(isMutableType({})).to.equal(true, 'empty objects are mutable');
      // expect(obj.isMutableType(new lively.morphic.Morph()).to.equal(true), 'complex objects are mutable');
      expect(isMutableType(2)).to.equal(false, 'numbers are immutable');
    });

    it('safeToString', function () {
      expect(safeToString(null)).to.equal('null');
      expect(safeToString(undefined)).to.equal('undefined');
      expect(safeToString(2)).to.equal('2');
    });
  });

  describe('sortKeysWithBeforeAndAfterConstraints', () => {
    it('works', () =>
      expect(
        sortKeysWithBeforeAndAfterConstraints({
          foo: {},
          bar: {
            after: ['foo'],
            before: ['baz']
          },
          baz: { after: ['foo'] }
        }))
        .equals(['foo', 'bar', 'baz']));

    it('throws error on cycle', () =>
      expect(() =>
        sortKeysWithBeforeAndAfterConstraints({
          foo: {},
          bar: { after: ['foo'], before: ['baz'] },
          baz: { before: ['foo'] }
        })).throws());
  });

  describe('newKeyIn', () => {
    it('works', () => {
      let obj = { foo: 'b a r' };
      expect(newKeyIn(obj, 'foo')).equals('foo-1');
    });
  });
});

describe('properties', function () {
  let obj;

  beforeEach(function () {
    let Foo = function () {
      this.a = 1;
      this.aa = 1;
      this.b = function () { return true; };
    };
    Foo.prototype.c = 2;
    Foo.prototype.cc = 2;
    Foo.prototype.d = function () { return true; };
    obj = new Foo();
  });

  it('can access all properties', function () {
    let expected, result;
    expected = ['a', 'c'];
    result = properties.all(obj, function (name, object) {
      return name.length == 1;
    });
    expect(expected).to.eql(result);
    expected = ['aa', 'cc'];
    result = properties.all(obj, function (name, object) {
      return name.length == 2;
    });
    expect(expected).to.eql(result);
  });

  it('can access own properties', function () {
    let expected = ['a', 'aa', 'b'];
    let result = properties.own(obj);
    expect(expected).to.eql(result);
  });

  it('allProperties again', function () {
    let expected, result;
    expected = ['a', 'b', 'c', 'd'];
    result = properties.allProperties(obj, function (object, name) {
      return name.length == 1;
    });
    expect(expected).to.eql(result);
    expected = ['aa', 'cc'];
    result = properties.allProperties(obj, function (object, name) {
      return name.length == 2;
    });
    expect(expected).to.eql(result);
  });
});

describe('Path', function () {
  it('parsePath', function () {
    expect([]).to.eql(Path(undefined).parts());
    expect([]).to.eql(Path('').parts());
    expect([]).to.eql(Path('.').parts());
    expect(['foo']).to.eql(Path('foo').parts());
    expect(['foo', 'bar']).to.eql(Path('foo.bar').parts());
  });

  it('pathAccesor', function () {
    let obj = { foo: { bar: 42 }, baz: { zork: { 'x y z z y': 23 } } };
    expect(obj).to.equal(Path('').get(obj));
    expect(42).to.equal(Path('foo.bar').get(obj));
    expect(obj.baz.zork).to.equal(Path('baz.zork').get(obj));
    expect(23).to.equal(Path('baz.zork.x y z z y').get(obj));
    expect(undefined).to.equal(Path('non.ex.is.tan.t').get(obj));
  });

  it('pathIncludes', function () {
    let base = Path('foo.bar');
    expect(base.isParentPathOf('foo.bar')).to.equal(true); // 'equal paths should be "parents"'
    expect(base.isParentPathOf(base)).to.equal(true); // 'equal paths should be "parents" 2'
    expect(base.isParentPathOf('foo.bar.baz')).to.equal(true); // 'foo.bar.baz'
    expect(base.isParentPathOf('foo.baz')).to.equal(false); // 'foo.baz'
    expect(base.isParentPathOf('.')).to.equal(false); // '.'
    expect(base.isParentPathOf('')).to.equal(false); // 'empty string'
    expect(base.isParentPathOf()).to.equal(false); // 'undefined'
  });

  it('relativePath', function () {
    let base = Path('foo.bar');
    expect([]).to.eql(base.relativePathTo('foo.bar').parts(), 'foo.bar');
    expect(['baz', 'zork']).to.eql(base.relativePathTo('foo.bar.baz.zork').parts(), 'foo.bar.baz.zork');
  });

  it('concat', function () {
    let p1 = Path('foo.bar'); let p2 = Path('baz.zork');
    expect('baz.zork.foo.bar').to.equal(String(p2.concat(p1)));
    expect('foo.bar.baz.zork').to.equal(String(p1.concat(p2)));
  });

  it('set', function () {
    let obj = { foo: [{}, { bar: {} }] }; let p = Path('foo.1.bar.baz');
    p.set(obj, 3);
    expect(3).to.equal(obj.foo[1].bar.baz);
  });

  it('ensure', function () {
    let obj = {}; let p = Path('foo.bar.baz');
    p.set(obj, 3, true);
    expect(3).to.equal(obj.foo.bar.baz);
  });

  it('splitter', function () {
    let obj = {}; let p = Path('foo/bar/baz', '/');
    p.set(obj, 3, true);
    expect(3).to.equal(obj.foo.bar.baz);
  });

  it('parentPathOf', function () {
    let pp = Path; let p1 = pp('a.b');
    expect(p1.isParentPathOf(p1)).to.equal(true);
    expect(pp('a').isParentPathOf(p1)).to.equal(true);
    expect(pp('').isParentPathOf(pp(''))).to.equal(true);
    expect(p1.isParentPathOf(pp('a'))).to.equal(false);
    expect(p1.isParentPathOf(pp('b.a'))).to.equal(false);
  });

  it('withParentAndKeyDo', function () {
    let p1 = Path('a.b.c');
    let o = { a: { b: { c: { foo: 23 } } } };
    p1.withParentAndKeyDo(o, false, function (parent, key) {
      expect(key).equal('c');
      expect(parent).eql({ c: { foo: 23 } });
    });
  });

  it('defineProperty', function () {
    let p1 = Path('a.b.c');
    let o = { a: { b: {} } };
    p1.defineProperty(o, { value: 37, writable: true, enumerable: false, configurable: true });
    expect(o.a.b.c).equal(37);
    expect(Object.keys(o.a.b)).eql([]);
  });

  it('overwrites string', function () {
    let obj = { foo: 'b a r' };
    let p = Path('foo.b a r.baz');
    p.set(obj, 3, true);
    expect(obj).to.eql({ foo: { 'b a r': { baz: 3 } } });
  });
});
