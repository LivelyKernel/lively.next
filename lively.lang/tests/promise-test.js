/* global afterEach, describe, it, setTimeout */

import { expect } from 'mocha-es6';
import { convertCallbackFun, parallel, waitFor, timeout, delayReject, delay, deferred, convertCallbackFunWithManyArgs, chain } from '../promise.js';

describe('promise', () => {
  describe('cb convertions', () => {
    it('resolves', () =>
      convertCallbackFun(function (a, b, thenDo) { thenDo(null, a + b); })(2, 3)
        .then(result => expect(result).to.equal(5)));

    it('rejects', () =>
      convertCallbackFun(function (a, b, thenDo) { thenDo(new Error('Foo'), a + b); })(2, 3)
        .then(result => expect().fail('should end in catch'))
        .catch(err => expect(err).to.match(/error.*foo/i)));

    it('rejects when cb throws', () =>
      convertCallbackFun(function (a, b, thenDo) { throw (new Error('Foo')); })(2, 3)
        .then(result => expect().fail('should end in catch'))
        .catch(err => expect(err).to.match(/error.*foo/i)));

    it('deals with n args', () =>
      convertCallbackFunWithManyArgs(function (a, b, thenDo) { thenDo(null, b, a); })(2, 3)
        .then(result => expect(result).to.eql([3, 2])));
  });

  describe('promise creation', () => {
    it('creates promise and resolve function', () => {
      let defed = deferred();
      setTimeout(defed.resolve, 100, 23);
      return defed.promise.then(val => expect(val).to.equal(23));
    });

    it('creates promise and reject function', () => {
      let defed = deferred();
      setTimeout(defed.reject, 100, new Error('Foo'));
      return defed.promise.catch(err => expect(err).to.match(/Foo/i));
    });
  });

  describe('chain', () => {
    it('runs promises consecutively', () => {
      let order = []; let prevResults = [];
      return chain([
        (prevResult, state) => { state.first = 1; order.push(1); prevResults.push(prevResult); return new Promise(resolve => setTimeout(() => resolve(1), 100)); },
        (prevResult, state) => { state.second = 2; order.push(2); prevResults.push(prevResult); return new Promise(resolve => setTimeout(() => resolve(2), 10)); },
        (prevResult, state) => { state.third = 3; order.push(3); prevResults.push(prevResult); return new Promise(resolve => setTimeout(() => resolve(state), 50)); }
      ]).then(result => {
        expect(order).to.eql([1, 2, 3]);
        expect(result).to.eql({ first: 1, second: 2, third: 3 });
        expect(prevResults).to.eql([undefined, 1, 2]);
      });
    });

    it('deals with errors in chain funcs', () =>
      chain([
        () => new Promise(resolve => setTimeout(() => resolve(1), 10)),
        () => { throw new Error('Foo'); }
      ]).catch(err => expect(err).to.match(/Foo/i)));

    it('deals with rejections', () =>
      chain([
        () => Promise.reject(new Error('Bar')),
        () => { throw new Error('Foo'); }
      ]).catch(err => expect(err).to.match(/Bar/i)));

    it('chain function results are coerced into promises', () =>
      chain([() => 23, (val) => 23 + 2])
        .then(results => expect(results).to.equal(25)));
  });

  describe('delay', () => {
    it('resolves later', () => {
      let start = new Date();
      return delay(300, 3).then(val => {
        expect(val).to.equal(3);
        expect(Date.now() - start).above(200);
      });
    });

    it('rejects later', () => {
      let start = new Date();
      return delayReject(300, new Error('Foo')).catch(err => {
        expect(err).to.match(/foo/i);
        expect(Date.now() - start).above(200);
      });
    });
  });

  describe('timeout', () => {
    it("takes a promise and let's it resolve when it's fast enough", () =>
      timeout(300, delay(100, 3))
        .then(val => expect(val).to.equal(3)));

    it("takes a promise and makes it timeout when it's not fast enough", () =>
      timeout(100, delay(300, 3))
        .catch(err => expect(err).to.match(/timed out/i)));

    it('with error', () =>
      timeout(100, new Promise((resolve, reject) => reject(new Error('foo'))))
        .catch(err => expect(err).to.match(/foo/i)));
  });

  describe('waitFor', () => {
    it('resolves with condition', () => {
      let startTime = Date.now(); let condition = false;
      setTimeout(() => condition = {}, 100);
      return waitFor(() => condition).then((val) => {
        expect(val).equal(condition);
        expect(Date.now() - startTime).above(80);
      });
    });

    it('times out', () => {
      let startTime = Date.now(); let condition = false;
      setTimeout(() => condition = {}, 1000);
      return waitFor(50, () => condition)
        .then(() => { throw new Error('then called'); })
        .catch((err) => {
          expect(err).to.match(/timeout/);
          expect(Date.now() - startTime).below(500);
        });
    });

    it('times out with value', () => {
      let startTime = Date.now(); let condition = false; let timeoutval = {};
      setTimeout(() => condition = {}, 1000);
      return waitFor(50, () => condition, timeoutval)
        .then(val => {
          expect(val).equals(timeoutval);
          expect(Date.now() - startTime).below(500);
        })
        .catch((err) => expect().assert(false, 'waitFor threw up'));
    });
  });

  describe('parallel', () => {
    let maxParallel = 0; let currentParallel = 0;
    let range = n => Array.from(Array(n)).map((_, i) => i);
    let spawn = val => new Promise(res => {
      maxParallel = Math.max(maxParallel, ++currentParallel);
      setTimeout(() => { --currentParallel; res(val); }, 10);
    });

    afterEach(() => { maxParallel = 0; currentParallel = 0; });

    it('runs without limit by default', async () => {
      let result = await parallel(range(10).map(n => () => spawn(n)));
      expect(result).equals(range(10));
      expect(maxParallel).equals(10);
      expect(currentParallel).equals(0);
    });

    it('with limit', async () => {
      let result = await parallel(range(10).map(n => () => spawn(n)), 3);
      expect(result).equals(range(10));
      expect(maxParallel).equals(3);
      expect(currentParallel).equals(0);
    });

    it('encounting error', async () => {
      let started = [false, false, false, false];
      try {
        await parallel([
          () => { started[0] = true; return delay(10); },
          () => { started[1] = true; return delay(10); },
          () => { started[2] = true; throw 'foo'; },
          () => { started[3] = true; return delay(10); }
        ], 2);
        expect().assert(false, '...');
      } catch (err) {
        expect(started).equals([true, true, true, false]);
      }
    });
  });
});
