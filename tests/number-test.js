/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import {
  random,
  toDegrees,
  average,
  median,
  sort,
  toRadians,
  detent,
  parseLength,
  convertLength,
  between,
  humanReadableByteSize,
  roundTo
} from "../number.js";


describe('number', function() {

  it('random', function() {
    expect(random(10, 20)).within(10, 20);
  });

  it('averages', function() {
    expect(average([1,2,3,4,20])).to.equal(6);
  });

  it('median', function() {
    expect(median([1,2,3,4,20])).to.equal(3);
  });

  it('sorts', function() {
    expect(sort([5,2,-3,20,4])).to.eql([-3,2,4,5,20]);
  });

  it('betweens', function() {
    expect(between(0.12, 0.1, 0.13)).to.equal(true);
    expect(between(0.1, 0.1, 0.13)).to.equal(true);
    expect(between(0.999, 0.1, 0.13)).to.equal(false);
  });

  it('roundTo', function() {
    expect(roundTo(0.1111111, 0.01)).to.equal(0.11);
  });

  describe('conversion', function() {

    it('humanReadableByteSize', function() {
      expect(humanReadableByteSize(Math.pow(2, 10))).to.equal("1KB");
      expect(humanReadableByteSize(1000)).to.equal("0.98KB");
      expect(humanReadableByteSize(10)).to.equal("10B");
      expect(humanReadableByteSize(Math.pow(2, 21))).to.equal("2MB");
    });

    it('parseLength', function() {
      var eps = 0.01;
      expect(parseLength('2cm')).to.be.within(75.59-eps, 75.59+eps);
      expect(parseLength('20px', 'pt')).to.be.within(15-eps, 15+eps);
    });

    it('convertLength', function() {
      var eps = 0.01;
      expect(convertLength(2, 'cm', 'px')).to.be.within(75.59-eps, 75.59+eps);
      expect(convertLength(75.59, 'px', 'cm')).to.be.within(2-eps, 2+eps);
    });

  });

  describe('detent', function() {

    it('linearly distributes values between grid points', function() {
      expect(detent(0,    0.1, 0.5)).to.equal(0);
      expect(detent(0.08, 0.2, 0.5)).to.equal(0);
      expect(detent(0.1,  0.2, 0.5)).to.equal(0);
      expect(detent(0.11, 0.2, 0.5)).to.be.above(0);
      expect(detent(0.39, 0.2, 0.5)).to.be.within(0.391, 0.49);
      expect(detent(0.4,  0.2, 0.5)).to.equal(0.5);
      expect(detent(0.5,  0.2, 0.5)).to.equal(0.5);
      expect(detent(0.6,  0.2, 0.5)).to.equal(0.5);
      expect(detent(0.9,  0.2, 0.5)).to.equal(1);
    });

    it('snaps', function() {
      expect(detent(0,    0.1, 0.5, true)).to.equal(0);
      expect(detent(0.08, 0.2, 0.5, true)).to.equal(0);
      expect(detent(0.1,  0.2, 0.5, true)).to.equal(0.1);
      expect(detent(0.11, 0.2, 0.5, true)).to.equal(0.11);
      expect(detent(0.39, 0.2, 0.5, true)).to.equal(0.39);
    });

  });

  it('degrees -> radians', function() {
    expect(toRadians(180)).to.equal(Math.PI);
  });

  it('radians -> degrees', function() {
    expect(toDegrees(Math.PI / 2)).to.equal(90);
  });

});
