/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Range } from "../../text2/range.js";
import { TextAttribute } from "../../text2/style.js";
import { Color } from "lively.graphics";
import { expect } from "mocha-es6";


describe("TextAttribute", () => {

  var style_a = { fontColor: Color.red, fontStyle: "italic" },
      style_b = { fontColor: Color.blue, fontWeight: "bold" },
      style_ab = { fontColor: Color.blue,
                   fontStyle: "italic", fontWeight: "bold" };

  describe("merge", () => {

    it("bordered", () => {
      var a = TextAttribute.create(style_a, 0, 0, 1, 4),
          b = TextAttribute.create(style_b, 1, 4, 1, 5);
      expect(a.merge(b)).deep.equals({a: [a], b: [b]});
    });

    it("bordered reverse", () => {
      var a = TextAttribute.create(style_a, 1, 4, 1, 5),
          b = TextAttribute.create(style_b, 0, 0, 1, 4);
      expect(a.merge(b)).deep.equals({a: [a], b: [b]});
    });

    it("overlapping", () => {
      var a = TextAttribute.create(style_a, 0, 0, 1, 4),
          b = TextAttribute.create(style_b, 1, 2, 1, 5),
          test = a.merge(b);

      expect(test).property("a").property("length").equals(2);
      expect(test).property("b").property("length").equals(1);

      expect(test).property("a").property(0).property("data").deep.equals(style_a);
      expect(test).property("a").property(1).property("data").deep.equals(style_ab);
      expect(test).property("b").property(0).property("data").deep.equals(style_b);

      expect(test).property("a").property(0).property("range").stringEquals("Range(0/0 -> 1/2)");
      expect(test).property("a").property(1).property("range").stringEquals("Range(1/2 -> 1/4)");
      expect(test).property("b").property(0).property("range").stringEquals("Range(1/4 -> 1/5)");
    });

    it("overlapping reverse", () => {
      var a = TextAttribute.create(style_a, 1, 2, 1, 5),
          b = TextAttribute.create(style_b, 0, 0, 1, 4),
          test = a.merge(b);

      expect(test).property("a").property("length").equals(2);
      expect(test).property("b").property("length").equals(1);

      expect(test).property("a").property(0).property("data").deep.equals(style_a);
      expect(test).property("a").property(1).property("data").deep.equals(style_ab);
      expect(test).property("b").property(0).property("data").deep.equals(style_b);

      expect(test).property("a").property(0).property("range").stringEquals("Range(1/4 -> 1/5)");
      expect(test).property("a").property(1).property("range").stringEquals("Range(1/2 -> 1/4)");
      expect(test).property("b").property(0).property("range").stringEquals("Range(0/0 -> 1/2)");
    });

    it("nested", () => {
      var a = TextAttribute.create(style_a, 0, 0, 1, 4),
          b = TextAttribute.create(style_b, 0, 2, 1, 2),
          test = a.merge(b);

      expect(test).property("a").property("length").equals(3);
      expect(test).property("b").property("length").equals(0);

      expect(test).property("a").property(0).property("data").deep.equals(style_a);
      expect(test).property("a").property(1).property("data").deep.equals(style_a);
      expect(test).property("a").property(2).property("data").deep.equals(style_ab);

      expect(test).property("a").property(0).property("range").stringEquals("Range(0/0 -> 0/2)");
      expect(test).property("a").property(1).property("range").stringEquals("Range(1/2 -> 1/4)");
      expect(test).property("a").property(2).property("range").stringEquals("Range(0/2 -> 1/2)");
    });

    it("nested reverse", () => {
      var a = TextAttribute.create(style_a, 0, 2, 1, 2),
          b = TextAttribute.create(style_b, 0, 0, 1, 4),
          test = a.merge(b);

      expect(test).property("a").property("length").equals(1);
      expect(test).property("b").property("length").equals(2);

      expect(test).property("a").property(0).property("data").deep.equals(style_ab);
      expect(test).property("b").property(0).property("data").deep.equals(style_b);
      expect(test).property("b").property(1).property("data").deep.equals(style_b);

      expect(test).property("a").property(0).property("range").stringEquals("Range(0/2 -> 1/2)");
      expect(test).property("b").property(0).property("range").stringEquals("Range(0/0 -> 0/2)");
      expect(test).property("b").property(1).property("range").stringEquals("Range(1/2 -> 1/4)");
    });

    it("non-overlapping", () => {
        var a = TextAttribute.create(style_a, 1, 2, 1, 5),
            b = TextAttribute.create(style_b, 1, 6, 1, 8);
        expect(a.merge(b)).deep.equals({a: [a], b: [b]});
    });

    it("non-overlapping reverse", () => {
        var a = TextAttribute.create(style_a, 1, 6, 1, 8),
            b = TextAttribute.create(style_b, 1, 2, 1, 5);
        expect(a.merge(b)).deep.equals({a: [a], b: [b]});
    });

  });


  describe("mergeInto", () => {

    var style_c = { fontColor: Color.green, fontSize: 12 },
        style_ac = { fontColor: Color.green, fontSize: 12,
                    fontStyle: "italic" },
        style_ca = { fontColor: Color.red, fontSize: 12,
                     fontStyle: "italic" },
        style_cb = { fontColor: Color.red,
                    fontStyle: "italic", fontWeight: "bold" },
        style_abc = { fontColor: Color.green, fontSize: 12,
                      fontStyle: "italic", fontWeight: "bold" },
        style_cba = { fontColor: Color.red, fontSize: 12,
                      fontStyle: "italic", fontWeight: "bold" },

        a = TextAttribute.create(style_a, 0, 0, 1, 4),
        b = TextAttribute.create(style_b, 0, 2, 0, 10),
        c = TextAttribute.create(style_c, 0, 8, 1, 2),
        test;

    it("mergeInto a, b, c", () => {
      test = Range.sort(
              TextAttribute.mergeInto(
                  TextAttribute.mergeInto(
                    TextAttribute.mergeInto([], a), b), c));

      expect(test).property("length").equals(5);

      expect(test).property(0).property("data").deep.equals(style_a);
      expect(test).property(1).property("data").deep.equals(style_ab);
      expect(test).property(2).property("data").deep.equals(style_abc);
      expect(test).property(3).property("data").deep.equals(style_ac);
      expect(test).property(4).property("data").deep.equals(style_a);

      expect(test).property(0).property("range").stringEquals("Range(0/0 -> 0/2)");
      expect(test).property(1).property("range").stringEquals("Range(0/2 -> 0/8)");
      expect(test).property(2).property("range").stringEquals("Range(0/8 -> 0/10)");
      expect(test).property(3).property("range").stringEquals("Range(0/10 -> 1/2)");
      expect(test).property(4).property("range").stringEquals("Range(1/2 -> 1/4)");
    });

    it("mergeInto c, b, a", () => {
      test = Range.sort(
              TextAttribute.mergeInto(
                  TextAttribute.mergeInto(
                    TextAttribute.mergeInto([], c), b), a));

      expect(test).property("length").equals(5);

      expect(test).property(0).property("data").deep.equals(style_a);
      expect(test).property(1).property("data").deep.equals(style_cb);
      expect(test).property(2).property("data").deep.equals(style_cba);
      expect(test).property(3).property("data").deep.equals(style_ca);
      expect(test).property(4).property("data").deep.equals(style_a);

      expect(test).property(0).property("range").stringEquals("Range(0/0 -> 0/2)");
      expect(test).property(1).property("range").stringEquals("Range(0/2 -> 0/8)");
      expect(test).property(2).property("range").stringEquals("Range(0/8 -> 0/10)");
      expect(test).property(3).property("range").stringEquals("Range(0/10 -> 1/2)");
      expect(test).property(4).property("range").stringEquals("Range(1/2 -> 1/4)");
    });

  });

});
