/* global xit */
/* global beforeEach, afterEach, describe, it, global, self */

import { expect } from 'mocha-es6';

let isNodejs = System.get('@system-env').node;
const GLOBAL = typeof window !== 'undefined'
  ? window
  : typeof global !== 'undefined'
    ? global
    : typeof self !== 'undefined'
      ? self
      : this;

import { chain, uninstallGlobals, installGlobals, noConflict } from '../index.js';

describe('usage', function () {
  describe('chaining', function () {
    function add1 (x) { return x + 1; }

    describe('for collections', function () {
      it('provides lively.lang array methods', function () {
        expect(chain(['a', 'b', 'c'])
          .map(add1)
          .invoke('toUpperCase')
          .value()).to.eql(['A1', 'B1', 'C1']);
      });
    });

    describe('for objects', function () {
      it('provides lively.lang methods', function () {
        expect(chain({ foo: 123 })
          .keys()
          .map(add1)
          .value()).to.eql(['foo1']);
      });
    });

    describe('for strings', function () {
      it('provides lively.lang methods', function () {
        expect(chain('%s %s')
          .format(1, 2)
          .value()).to.equal('1 2');
      });
    });

    describe('for numbers', function () {
      it('provides lively.lang methods', function () {
        expect(chain(Math.pow(2, 12))
          .humanReadableByteSize().value()).to.equal('4KB');
      });
    });

    describe('for dates', function () {
      it('provides lively.lang methods', function () {
        expect(chain(new Date('Wed Oct 22 2014 23:43:50 GMT-0700 (PDT)'))
          .format('yy-dd HH:MM', true)
          .value()).to.equal('14-23 06:43');
      });
    });

    describe('for functions', function () {
      it('provides lively.lang methods', function () {
        expect(chain(function (a, b) { return a + b; })
          .curry(3)
          .value()(4)).to.equal(7);
      });
    });
  });

  describe('noConflict', function () {
    let lv;
    beforeEach(function () { lv = lively; });

    afterEach(function () {
      if (isNodejs) lively = lv;
      else window.lively = lv;
    });

    xit('removes lively.lang object but returns reference', function () {
      let ref = noConflict();
      expect(typeof GLOBAL.lively).to.equal('undefined');
      expect(ref).to.be.equal(lv.lang);
    });
  });

  describe('install globally', function () {
    it('adds methods to global objects', function () {
      installGlobals();
      try {
        let d = new Date('Thu Oct 23 2014 10:29:55 GMT-0700 (PDT)');
        expect(d.format('yyyy')).to.equal('2014');
        expect(('foo bar').startsWith('foo')).to.be.true;
      } finally { uninstallGlobals(); }
    });

    it('install aliases to global objects', function () {
      installGlobals();
      try {
        expect([1, 2, 3, 4, 5].select(function (n) { return n % 2 === 0; })).to.eql([2, 4]);
      } finally { uninstallGlobals(); }
    });

    xit('creates new global objects', function () {
      installGlobals();
      expect(typeof String).to.equal('object');
      expect(String.format('%s %s', 1, 2)).to.equal('1 2');
      uninstallGlobals();
    });

    xit('can be uninstalled from globals', function () {
      installGlobals();
      expect(typeof String).to.equal('object');
      uninstallGlobals();
      expect(typeof String).to.equal('undefined');
    });
  });
});
