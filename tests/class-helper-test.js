/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import {
  createOrExtend,
  initializeSymbol,
  instanceRestorerSymbol,
  superclassSymbol
} from "../lib/class-helpers.js";

describe("create or extend classes", function() {

  it("uses known symbols", () => {
    expect(superclassSymbol).equals(Symbol.for("lively-instance-superclass"));
    expect(instanceRestorerSymbol).equals(Symbol.for("lively-instance-restorer"));
    expect(initializeSymbol).equals(Symbol.for("lively-instance-initialize"));
  });

  it("produces new class", function() {
    var Foo = createOrExtend({}, null, "Foo", [
          {key: "m", value: function m() { return 23 }}
        ]);
    expect(Foo.name).equals("Foo");
    expect(new Foo().m()).equals(23);
  });

  it("is not stored in classHolder by default", function() {
    var classHolder = {}
    var Foo = createOrExtend(classHolder, null, "Foo", [
          {key: "m", value: function m() { return 23 }}
        ]);
    expect(Foo.name).equals("Foo");
    expect(classHolder).to.not.have.property("Foo");
  });

  it("is initialized with arguments from constructor call", function() {
    var Foo = createOrExtend({}, null, "Foo", [
          {key: initializeSymbol, value: function(a, b) { this.x = a + b; }}
        ]);
    expect(new Foo(2,3).x).equals(5);
  });

  it("accepts getter and setter", function() {
    var Foo = createOrExtend({}, null, "Foo",
      [{
        key: "x",
        get: function get() { return this._x },
        set: function set(v) { return this._x = v }
      }]);
    var foo = new Foo();
    foo.x = 23;
    expect(foo.x).equals(23);
    expect(foo._x).equals(23);
  });

  it("same name does not mean same class", function() {
    var Foo1 = createOrExtend({}, null, "Foo"),
        Foo2 = createOrExtend({}, null, "Foo");
    expect(Foo1).to.not.equal(Foo2);
  });

  it("inherits", function() {
    var Foo = createOrExtend({}, null, "Foo",
          [{key: "m", value: function m() { return this.x + 23 }},
           {key: "n", value: function n() { return 123 }}]),
        Foo2 = createOrExtend({}, Foo, "Foo2",
          [{key: "m", value: function m() {
            return 2 + this.constructor[superclassSymbol].prototype.m.call(this); }}]),
        foo = new Foo2();
    foo.x = 1;
    expect(foo.m()).equals(26);
    expect(foo.n()).equals(123);
    expect(Foo2[superclassSymbol]).equals(Foo);
  });

  it("super in initialize", function() {
    var Foo = createOrExtend({}, null, "Foo", [{key: initializeSymbol, value: function(a, b) { this.x = a + b; }}]),
        Foo2 = createOrExtend({}, Foo, "Foo2", [{key: initializeSymbol, value: function(a, b) { this.constructor[superclassSymbol].prototype[initializeSymbol].call(this,a, b); this.y = a; }}])
    expect(new Foo2(2,3).x).equals(5);
    expect(new Foo2(2,3).y).equals(2);
  });

});
