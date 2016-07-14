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
    var Foo = createOrExtend("Foo", null, [
          {key: "m", value: function m() { return 23 }}
        ], undefined, {});
    expect(Foo.name).equals("Foo");
    expect(new Foo().m()).equals(23);
  });

  it("is not stored in classHolder by default", function() {
    var classHolder = {}
    var Foo = createOrExtend("Foo", null, [
          {key: "m", value: function m() { return 23 }}
        ], undefined, classHolder);
    expect(Foo.name).equals("Foo");
    expect(classHolder).to.not.have.property("Foo");
  });

  it("is initialized with arguments from constructor call", function() {
    var Foo = createOrExtend("Foo", null, [
          {key: initializeSymbol, value: function(a, b) { this.x = a + b; }}
        ], undefined, {});
    expect(new Foo(2,3).x).equals(5);
  });

  it("accepts getter and setter", function() {
    var Foo = createOrExtend("Foo", null, [{
        key: "x",
        get: function get() { return this._x },
        set: function set(v) { return this._x = v }
      }], undefined, {});
    var foo = new Foo();
    foo.x = 23;
    expect(foo.x).equals(23);
    expect(foo._x).equals(23);
  });

  it("same name does not mean same class", function() {
    var Foo1 = createOrExtend("Foo", null, undefined, undefined, {}),
        Foo2 = createOrExtend("Foo", null, undefined, undefined, {});
    expect(Foo1).to.not.equal(Foo2);
  });

  it("inherits", function() {
    var Foo = createOrExtend("Foo", null, [{key: "m", value: function m() { return this.x + 23 }},
           {key: "n", value: function n() { return 123 }}], undefined, {}),
        Foo2 = createOrExtend("Foo2", Foo, [{key: "m", value: function m() {
            return 2 + this.constructor[superclassSymbol].prototype.m.call(this); }}], undefined, {}),
        foo = new Foo2();
    foo.x = 1;
    expect(foo.m()).equals(26);
    expect(foo.n()).equals(123);
    expect(Foo2[superclassSymbol]).equals(Foo);
  });

  it("super in initialize", function() {
    var Foo = createOrExtend("Foo", null, [{key: initializeSymbol, value: function(a, b) { this.x = a + b; }}], undefined, {}),
        Foo2 = createOrExtend("Foo2", Foo, [{key: initializeSymbol, value: function(a, b) { this.constructor[superclassSymbol].prototype[initializeSymbol].call(this,a, b); this.y = a; }}], undefined, {})
    expect(new Foo2(2,3).x).equals(5);
    expect(new Foo2(2,3).y).equals(2);
  });

  it("modifying the superclass affects the subclass and its instances", function() {
    var Foo = createOrExtend("Foo", null, undefined, undefined, {}),
        Foo2 = createOrExtend("Foo2", Foo, undefined, undefined, {}),
        foo = new Foo2();
    createOrExtend("Foo", null, [{key: "m", value: function m() { return 23 }}], undefined, {Foo: Foo})
    expect(foo.m()).equals(23);
  });

  it("changing the superclass will leave existing instances stale", function() {
    var Foo = createOrExtend("Foo", null, [{key: "m", value: function m() { return 23 }}], undefined, {}),
        Foo2 = createOrExtend("Foo2", Object, undefined, undefined, {}),
        foo = new Foo2();
    expect(foo).to.not.have.property("m");
    createOrExtend("Foo2", Foo, undefined, undefined, {Foo2: Foo2});
    // Changing the superclass currently means changing the prototype, the
    // thing that instances have in  common with their class. When that's replaced
    // the instances are orphaned. That's not a feature but to change that we
    // would have to a) add another prototype indirection or b) track all
    // instances. Neither option seems to be worthwhile...
    expect(foo).to.not.have.property("m");
    var anotherFoo = new Foo2();
    expect(anotherFoo).to.have.property("m");
  });
  
  it("works with anonymous classes", () => {
    var X = createOrExtend(undefined, undefined, [{key: "m", value: function() { return 23; }}], undefined, {}),
        Y = createOrExtend(undefined, X, [{key: "m", value: function() { return super.m() + 1; }}], undefined, {});
    expect(new X().m()).equals(23);
    expect(new Y().m()).equals(24);
  });

  it("method can be overridden", () => {
    var Foo = createOrExtend("Foo", null, [
          {key: "m", value: function m() { return 23 }}
        ], undefined, {}),
        foo = new Foo();
    foo.m = () => 24;
    expect(foo.m()).equals(24);
  });

  describe("compat with conventional class function", () => {

    it("constructor of base class is used", () => {
      var A = function A(x) { this.y = x + 1 },
          B = createOrExtend("B", A, undefined, undefined, {}),
          b = new B(3);

      expect(b.y).equals(4, "constructor not called");
    });

    it("constructor of base class is used when using own constructor + calling super", () => {
      var A = function A(x) { this.y = x + 1 },
          B = createOrExtend("B", A, [{
            key: initializeSymbol, value: function(x) {
              this.constructor[superclassSymbol].prototype[initializeSymbol].call(this, x);
              this.z = this.y + 1;
            }}]),
          b = new B(3);
      expect(b.y).equals(4, "super constructor not called");
      expect(b.z).equals(5, "constructor issue");
    });
    
  });

});
