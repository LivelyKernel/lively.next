/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Range } from "../../text2/range.js";
import { expect } from "mocha-es6";


describe("range", () => {

  describe("merge", () => {

    it("bordered", () =>
      expect(Range.create(0,0, 1, 4).merge(Range.create(1, 4, 1, 5)))
        .stringEquals("Range(0/0 -> 1/5)"));

    it("bordered reverse", () =>
      expect(Range.create(1, 4, 1, 5).merge(Range.create(0,3, 1, 4)))
        .stringEquals("Range(0/3 -> 1/5)"));

    it("overlapping ", () =>
      expect(Range.create(0,0, 1, 4).merge(Range.create(1, 2, 1, 5)))
        .stringEquals("Range(0/0 -> 1/5)"));

    it("overlapping reverse", () =>
      expect(Range.create(1, 2, 1, 5).merge(Range.create(0,3, 1, 4)))
        .stringEquals("Range(0/3 -> 1/5)"));

    it("non overlapping", () =>
      expect(Range.create(1, 2, 1, 5).merge(Range.create(1, 6, 1, 8)))
        .stringEquals("Range(1/2 -> 1/5)"));

  });

  describe("without", () => {

    it("overlapping", () =>
      expect(Range.create(0,0, 1, 4).without(Range.create(1, 2, 1, 5)))
        .stringEquals("Range(0/0 -> 1/2)"));

    it("non-overlapping 1", () =>
      expect(Range.create(0,0, 1, 1).without(Range.create(1, 2, 1, 5)))
        .stringEquals("Range(0/0 -> 1/1)"));

    it("non-overlapping 2", () =>
      expect(Range.create(1, 2, 1, 5).without(Range.create(0,0, 1, 1)))
        .stringEquals("Range(1/2 -> 1/5)"));

  });

  describe("intersect", () => {

    it("bordered", () =>
      expect(Range.create(0,0, 1,4).intersect(Range.create(1,4, 1,5)))
        .stringEquals("Range(1/4 -> 1/4)"));

    it("bordered reverse", () =>
      expect(Range.create(1,4, 1,5).intersect(Range.create(0,3, 1,4)))
        .stringEquals("Range(1/4 -> 1/4)"));

    it("overlapping ", () =>
      expect(Range.create(0,0, 1,4).intersect(Range.create(1,2, 1,5)))
        .stringEquals("Range(1/2 -> 1/4)"));

    it("overlapping reverse", () =>
      expect(Range.create(1,2, 1,5).intersect(Range.create(0,3, 1,4)))
        .stringEquals("Range(1/2 -> 1/4)"));

    it("enclosing", () =>
      expect(Range.create(0,0, 1,4).intersect(Range.create(0,2, 1,2)))
        .stringEquals("Range(0/2 -> 1/2)"));

    it("enclosing reverse", () =>
      expect(Range.create(0,2, 1,2).intersect(Range.create(0,0, 1,4)))
        .stringEquals("Range(0/2 -> 1/2)"));

    it("non-overlapping", () =>
      expect(Range.create(1,2, 1,5).intersect(Range.create(1,6, 1,8)))
        .stringEquals("Range(1/5 -> 1/5)"));

    it("non-overlapping reverse", () =>
      expect(Range.create(1,6, 1,8).intersect(Range.create(1,2, 1,5)))
        .stringEquals("Range(1/5 -> 1/5)"));

  });

  describe("subtract", () => {

    it("bordered", () =>
      expect(Range.create(0,0, 1,4).subtract(Range.create(1,4, 1,5)))
        .deep.equals([Range.create(0,0, 1,4)]));

    it("bordered reverse", () =>
      expect(Range.create(1,4, 1,5).subtract(Range.create(0,0, 1,4)))
        .deep.equals([Range.create(1,4, 1,5)]));

    it("overlapping ", () =>
      expect(Range.create(0,0, 1,4).subtract(Range.create(1,2, 1,5)))
        .deep.equals([Range.create(0,0, 1,2)]));

    it("overlapping reverse", () =>
      expect(Range.create(1,2, 1,5).subtract(Range.create(0,0, 1,4)))
        .deep.equals([Range.create(1,4, 1,5)]));

    it("enclosing", () =>
      expect(Range.create(0,0, 1,4).subtract(Range.create(0,2, 1,2)))
        .deep.equals([Range.create(0,0, 0,2), Range.create(1,2, 1,4)]));

    it("enclosing reverse", () =>
      expect(Range.create(0,2, 1,2).subtract(Range.create(0,0, 1,4)))
        .deep.equals([Range.create(0,2, 0,2)]));

    it("non-overlapping", () =>
      expect(Range.create(1,2, 1,5).subtract(Range.create(1,6, 1,8)))
        .deep.equals([Range.create(1,2, 1,5)]));

    it("non-overlapping reverse", () =>
      expect(Range.create(1,6, 1,8).subtract(Range.create(1,2, 1,5)))
        .deep.equals([Range.create(1,6, 1,8)]));

  });
});
