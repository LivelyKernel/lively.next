/*global describe, it, beforeEach, afterEach*/
import { expect } from "mocha-es6";

import { connect, noUpdate, callWhenPathNotNull, disconnectAll, disconnect, signal } from "lively.bindings";

describe("connect", () => {

  it("attribute to attribute connection", function() {
    var obj1 = {}, obj2 = {};
    connect(obj1, 'x', obj2, 'y');
    obj1.x = 2;
    expect(obj2.y).equals(2, 'connection not working');
  });

  it("attribute to method connection", function() {
    var obj1 = {x: 4},
        obj2 = {xchanged(newVal) { obj2.value = newVal }};
    connect(obj1, 'x', obj2, 'xchanged');
    obj1.x = 2;
    expect(obj2.value).equals(2, 'connection not working');
  });

  it("simple connection", function() {
    var obj1 = {x: 4},
        obj2 = {xchanged(newVal) { obj2.value = newVal }};
    connect(obj1, 'x', obj2, 'xchanged');
    obj1.x = 2;
    expect(obj2.value).equals(2, 'connection not working');
  });

  it("multiple connections", function() {
    var obj1 = {x: 4},
        obj2 = {xchanged(newVal) { obj2.value = newVal }},
        obj3 = {xchangedAgain(newVal) { obj3.value = newVal }};
    connect(obj1, 'x', obj2, 'xchanged');
    connect(obj1, 'x', obj3, 'xchangedAgain');
    obj1.x = 2;
    expect(obj2.value).equals(2, 'connection not working obj2');
    expect(obj3.value).equals(2, 'connection not working obj3');
  });

  it("remove connections", function() {
    var obj1 = {x: 4},
      obj2 = {xchanged: function(newVal) { obj2.value = newVal }},
      obj3 = {xchangedAgain: function(newVal) { obj3.value = newVal }};
    connect(obj1, 'x', obj2, 'xchanged');
    connect(obj1, 'x', obj3, 'xchangedAgain');
    disconnect(obj1, 'x', obj2, 'xchanged');
    obj1.x = 2;
    expect(obj2.value).equals(undefined, 'obj2 not disconnected');
    expect(obj3.value).equals(2, 'obj3 wrongly disconnected');
    disconnect(obj1, 'x', obj3, 'xchangedAgain');
    obj1.x = 3;
    expect(obj3.value).equals(2, 'obj3 not disconnected');
    expect().assert(!obj1.__lookupSetter__('x'), 'disconnect cleanup failure');
    expect(obj1.x).equals(3, 'disconnect cleanup failure 2');
    expect().assert(!obj1.$$x, 'disconnect cleanup failure 3');
    expect().assert(!obj1.doNotSerialize, 'disconnect cleanup failure doNotSerialize');
  });

  it("bidirectional connect", function() {
    var obj1 = {update: function(newVal) { obj1.value = newVal }};
    var obj2 = {update: function(newVal) { obj2.value = newVal }};

    connect(obj1, 'value', obj2, 'update');
    connect(obj2, 'value', obj1, 'update');

    obj1.value = 3;
    expect(3).equals(obj1.value, 'obj1 not updated');
    expect(3).equals(obj2.value, 'obj2 not updated');
  });

  it("connect when already connected", function() {
    var obj1 = {};
    var obj2 = {};
    connect(obj1, 'value', obj2, 'value');
    connect(obj1, 'value', obj2, 'value');
    expect(1).equals(obj1.attributeConnections.length, 'multiple connections added');
    obj1.value = 3;
    expect(3).equals(obj2.value, 'obj2 not updated');
  });

  it("disconnect does not remove attribute", function () {
    var obj1 = {};
    var obj2 = {};
    var c = connect(obj1, 'value', obj2, 'value');
    obj1.value = 2;
    c.disconnect();
    expect(2).equals(obj1.value);
    expect(2).equals(obj2.value);
  });

  it("is similar connection", function () {
    var c1, c2, obj1 = {}, obj2 = {}, obj3 = {};
    c1 = connect(obj1, 'value', obj2, 'value'); c2 = connect(obj1, 'value', obj2, 'value');
    expect().assert(c1.isSimilarConnection(c2), '1');
    c1 = connect(obj1, 'value', obj2, 'value', {converter: function(v) { return v + 1 }});
    c2 = connect(obj1, 'value', obj2, 'value', {converter: function(v) { return v + 2 }});
    expect().assert(c1.isSimilarConnection(c2), '2');
    // ----------------------
    c1 = connect(obj1, 'value1', obj2, 'value'); c2 = connect(obj1, 'value', obj2, 'value');
    expect().assert(!c1.isSimilarConnection(c2), '3');
    c1 = connect(obj1, 'value', obj2, 'value'); c2 = connect(obj1, 'value', obj3, 'value');
    expect().assert(!c1.isSimilarConnection(c2), '4');
  });

  it("einweg connection", function () {
    var obj1 = {}, obj2 = {};
    connect(obj1, 'value', obj2, 'value', {converter: val => val + 1, removeAfterUpdate: true});
    obj1.value = 2
    expect(3).equals(obj2.value);
    expect().assert(!obj1.attributeConnections || obj1.attributeConnections.length == 0, 'connection not removed!');
  });


  it("multiple connects with removal", function() {
    var obj = {},
      c1 = connect(obj, 'a', obj, 'b', { removeAfterUpdate: true }),
      c2 = connect(obj, 'a', obj, 'c', { removeAfterUpdate: true });
    obj.a = 123;
    expect(obj.b).equals(123, "first connection was not triggered");
    expect(obj.c).equals(123, "second connection was not triggered");
  });


  it("connecting nonexistent property does not assign new property", function() {
    var obj = {m: function() {}};
    connect(obj, 'x', obj, 'm');
    expect().assert(!obj.hasOwnProperty('$$x'), 'connecting assigns non-existent property value');
  });


  it("disconnect all", function() {
    var obj = {};
    connect(obj, 'x', obj, 'y');
    connect(obj, 'x', obj, 'z');
    disconnectAll(obj);
    expect().assert(!obj.attributeConnections, 'attributeConnections not removed');
  });



  it("dual update", function() {
    // no proceed, no remove
    var obj1 = {};
    var obj2 = {};
    var obj3 = {};
    var c1 = connect(obj1, "x", obj2, "x");
    var c2 = connect(obj1, "x", obj3, "x");
    obj1.x = 3;

    expect(obj2.x).equals(3, "obj2 update broken");
    expect(obj3.x).equals(3, "obj3 update broken");
  });


  it("target and prop name missing keeps connection intact", function() {
    var obj1 = {x: null}, obj2 = {x: null},
      c = connect(obj1, 'x', obj2, 'x');
    expect().assert(!c.isActive, 'conenction is active 1')
    obj1.x = 3;
    expect(3).equals(obj2.x, 'connected attribute not set correctly');
    expect().assert(!c.isActive, 'conenction is active 2')
    c.targetObj = null;
    obj1.x = 7;
    expect(3).equals(obj2.x, 'connected attribute updated although target not set');
    expect().assert(!c.isActive, 'conenction is active 3')
  });

  it("connect and disconnect when source has agetter and setter", function() {
    var getCount = 0,
      setCount = 0,
      obj1 = {
        get foo() { getCount++; return this._foo },
        set foo(v) { setCount++; this._foo = v }
      },
      obj2 = {bar: 9};
    // First just see if the getter setter is working
    obj1.foo = 3;
    expect(3).equals(obj1.foo);
    expect(1).equals(getCount, 'getter strange ' + getCount);
    expect(1).equals(setCount, 'setter strange ' + setCount);

    connect(obj1, 'foo', obj2, 'bar');
    obj1.foo = 4;
    expect(4).equals(obj1.foo, 'foo not updated');
    expect(4).equals(obj2.bar, 'bar not updated');
    // 3 because 1x get for oldValue when setting new value
    expect(3).equals(getCount, 'getter strange after simple connect ' + getCount);
    expect(2).equals(setCount, 'setter strange after simple connect ' + setCount);
  });

  it("multiple connects should return identical connection", function() {
    var obj = {},
      c1 = connect(obj, 'foo', obj, 'barr'),
      c2 = connect(obj, 'foo', obj, 'barr');
    expect(c1).equals(c2, 'connections not identical');
  });


  it("connection receives old value", function() {
    var obj1 = {x: 4};
    var obj2 = {xchanged: function(newVal, oldVal) {
      obj2.value = newVal;
      obj2.old = oldVal;
    }};
    connect(obj1, 'x', obj2, 'xchanged');
    obj1.x = 2;
    expect(obj2.value).equals(2, 'connection not working');
    expect(obj2.old).equals(4, 'old value not provided');
  });


  it("force attribute connection", function() {
    var obj = {m: function() { return 3 }, x: 2};
    connect(obj, 'm', obj, 'x', {forceAttributeConnection: true});
    obj.m();
    expect(2).equals(obj.x);
    obj.m = function() { return 4 }
    expect(obj.m).equals(obj.x);
  });



});

describe("converter", () => {

  it("converter", function() {
    var obj1 = {};
    var obj2 = {};
    connect(obj1, 'value', obj2, 'value', {converter: function(val) { return val + 1 }});
    obj1.value = 2;
    expect(3).equals(obj2.value);
  });

  xit("error when converter references environment", function() {
    var obj1 = {}, obj2 = {}, externalVal = 42, world = $world;
    connect(obj1, 'value', obj2, 'value',
        {converter: function(val) { return val + externalVal }});
    // mock worlds error displaying for this test's extent,
    // to not have errors displayed on test runs
    // try-catch directly around obj1.value does not work:
    // error does not happen on top of this frame
    var originalSetStatusMessage = world.setStatusMessage,
      numberOfErrorMessages = 0;
    try {
      world.setStatusMessage = function() { numberOfErrorMessages++; }
      obj1.value = 2;
    } catch (e) {
      world.setStatusMessage = originalSetStatusMessage;
      throw e;
    }
    // necessary when test wasn't successful - i.e. no errors
    world.setStatusMessage = originalSetStatusMessage;
    expect(1).equals(numberOfErrorMessages,
              'no error when using external val in converter');
  });

  it("new connection replaces old", function() {
    var obj1 = {};
    var obj2 = {};
    connect(obj1, 'value', obj2, 'value', {converter: function(val) { return val + 1}});
    connect(obj1, 'value', obj2, 'value', {converter: function(val) { return val + 2}});
    obj1.value = 2
    expect(4).equals(obj2.value);
    expect(1).equals(obj1.attributeConnections.length);
  });

  it("provide old value in converters", function () {
    var obj1 = {value: 10};
    var obj2 = {delta: null};
    connect(obj1, 'value', obj2, 'delta', {converter: function(newValue, oldValue) {
      return newValue - oldValue
    }})
    obj1.value = 15;
    expect(obj2.delta).equals(5)
  });

  it("pass closure values into converter and updater", function() {
    var obj = {}, z = 3;
    // connect(obj, "x", obj, "y", {converter: v => z + v, varMapping: {z}});
    connect(obj, "x", obj, "y", {converter: v => { return z + v}, varMapping: {z}});
    // connect(obj, "x", obj, "y", {converter: "v => z + v", varMapping: {z}});
    obj.x = 5;
    expect(8).equals(obj.y);
    connect(obj, "x", obj, "y", {updater: ($upd, v) => $upd(z + v), varMapping: {z}});
    // connect(obj, "x", obj, "y", {updater: "($upd, v) => $upd(z + v)", varMapping: {z}});
    obj.x = 7;
    expect(10).equals(obj.y);
  });

  it("source and target are bound", function() {
    var obj1 = {val: 10}, obj2 = {val: 20};
    // connect(obj1, 'x', obj2, 'y', {converter: v => (source.val + target.val) / v});
    connect(obj1, 'x', obj2, 'y', {converter: "v => (source.val + target.val) / v"});
    obj1.x = 10;
    expect(3).equals(obj2.y);
  });

  it("source and target are bound when eval in toplevel context", async function() {
    var m = lively.modules.module("local://lively.bindings-test/connect-in-toplevel");
    m.define("connect", connect);
    var {value, isError} = await lively.vm.runEval(`
      var obj1 = {val: 10}, obj2 = {val: 20};
      connect(obj1, 'x', obj2, 'y', {converter: v => (source.val + target.val) / v});
      [obj1, obj2];
    `, {targetModule: m.id});
    expect().assert(!isError, `eval isError! ${value}`);
    var [obj1, obj2] = value;
    obj1.x = 10;
    expect(3).equals(obj2.y);
  });

});

describe("updater", () => {

  it("updater", function () {
    var obj1 = {x: null};
    var obj2 = {x: null};

    var c = connect(obj1, 'x', obj2, 'x',
      {updater: function($proceed, newValue, oldValue) { $proceed(newValue) }});
    obj1.x = 15;
    expect(obj2.x).equals(15, 'proceed called');
    c.disconnect();

    c = connect(obj1, 'x', obj2, 'x',
      {updater: function($proceed, newValue, oldValue) { }});
    obj1.x = 3;
    expect(obj2.x).equals(15, 'proceed not called');
    c.disconnect();
  });

  it("updater 2", function () {
    var obj1 = {x: 42},
        obj2 = {m(a, b) { obj2.a = a; obj2.b = b }},
        c = connect(obj1, 'x', obj2, 'm', {
          updater: ($upd, newValue, oldValue) => $upd(newValue, oldValue)});
    obj1.x = 15;
    expect(obj2.a).equals(15);
    expect(obj2.b).equals(42);
  });

  it("updater and converter", function () {
    var obj1 = {x: null};
    var obj2 = {x: null};
    var c = connect(obj1, 'x', obj2, 'x',
      {updater: function($proceed, newValue, oldValue) { $proceed(newValue) },
      converter: function(v) { return v + 1 }});
    obj1.x = 15;
    expect(obj2.x).equals(16);
  });

  it("no updater no converter", function () {
    var obj1 = {x: null};
    var obj2 = {x: null};
    var c = connect(obj1, 'x', obj2, 'x',
      {updater: function($proceed, newValue, oldValue) { this.getSourceObj().updaterWasCalled = true },
      converter: function(v) { this.getSourceObj().converterWasCalled = true; return v }});
    obj1.x = 3;
    expect().assert(obj1.updaterWasCalled, 'no updater called');
    expect().assert(!obj1.converterWasCalled, 'converter called');
  });

  it("remove after update only if updater proceeds", function() {
      // no proceed, no remove
    var obj1 = {};
    var obj2 = {};
    var c = connect(obj1, 'x', obj2, 'x',
      {updater: ($upd, val) => {}, removeAfterUpdate: true});
    obj1.x = 2
    expect(undefined).equals(obj2.x, 'a');
    expect(1).equals(obj1.attributeConnections.length, 'connection removed!');
    c.disconnect();

    // proceed triggered then remove
    var c = connect(obj1, 'x', obj2, 'y',
      {updater: ($upd, val) => $upd(val), removeAfterUpdate: true});
    obj1.x = 2
    expect(2).equals(obj2.y, 'b');
    expect().assert(!obj1.attributeConnections || obj1.attributeConnections.length == 0,
      'connection not removed!');
  });

});

describe("signals", () => {

  it("doesn't signal on assignment", function() {
    var obj = {triggerCount: 0}, obj2 = {};

    connect(obj, 'foo', obj2, 'bar', {
      converter: function(val) {
      this.sourceObj.triggerCount++;
      return val;
      },
      signalOnAssignment: false
    });

    obj.foo = 23;
    expect(undefined).equals(obj2.bar, 'obj2 has value through connection');
    expect(0).equals(obj.triggerCount, 'triggered?');

    signal(obj, 'foo', 24);
    expect(24).equals(obj2.bar, 'manually signal not working');
    expect(1).equals(obj.triggerCount, 'trigger count after manual signal');
  });

});

describe("connection points", () => {
  
  it("converter", () => {
    var obj = {connections: {foo: {converter: x => x + 1}}}, obj2 = {};
    connect(obj, 'foo', obj2, 'bar');
    obj.foo = 23;
    expect(24).equals(obj2.bar);
  });

  it("doesn't signal on assignment", () => {
    var obj = {connections: {foo: {signalOnAssignment: false}}}, obj2 = {};
    connect(obj, 'foo', obj2, 'bar');
    obj.foo = 23;
    expect(obj2.bar).equals(undefined);
    expect("foo").not.has.property("$$foo")
    signal(obj, "foo", 23);
    expect(23).equals(obj2.bar);
  });

});


describe("method connections", () => {


  it("disconnect during connection method invocation", function() {
    var gInvoked = false;
    var obj = {
      f: function() { disconnectAll(this); },
      g: function() { gInvoked = true; }
    };
    connect(obj, 'f', obj, 'g');
    obj.f();
    expect().assert(gInvoked);
  });


  it("connect during connection method invocation", function() {
    var gInvoked = false, hInvoked = false;
    var obj = {
      f: function() { connect(this, 'f', this, 'h'); },
      g: function() { gInvoked = true; },
      h: function() { hInvoked = true; }
    };
    connect(obj, 'f', obj, 'g');
    obj.f();
    expect().assert(gInvoked);
    expect().assert(!hInvoked);
  });
  
  it("connect two methods", function() {
    var obj1 = {m1: function(val) { return val + 1 }};
    var obj2 = {m2: function(val) { this.result = val + 2 }};
    connect(obj1, 'm1', obj2, 'm2');
    expect(obj1.m1(3)).equals(4, 'method result in connection wrong');
    expect(obj2.result).equals(5, 'target method invocation failed');
  });

  it("connect two methods with updater", function() {
    var obj1 = {m1: function(val) { return val + 1 }};
    var obj2 = {m2: function(val) { this.result = val + 2 }};
    connect(obj1, 'm1', obj2, 'm2', {
      updater: function($proceed, val) {
        return $proceed(val + 4)
      }});
    expect(obj1.m1(3)).equals(4, 'normal invocation not working');
    expect(obj2.result).equals(3 + 4 + 2, 'method connection not working');
  });

  it("connect two methods twice", function() {
    var obj1 = {m1: function(val) { return val + 1 }};
    var obj2 = {m2: function(val) { this.result = val + 2 }};
    connect(obj1, 'm1', obj2, 'm2');
    connect(obj1, 'm1', obj2, 'm2');
    expect().assert(typeof obj1.m1 === "function", 'wrapping failed');
    expect(obj1.m1(3)).equals(4, 'method result in connection wrong');
    expect(obj2.result).equals(5, 'target method invocation failed');
  });

  it("double connect two methods", function() {
    var obj1 = {m1: function(val) { return val + 1 }},
        obj2 = {m2: function(val) { this.result = val + 2 }},
        obj3 = {m3: function(val) { this.result = val + 3 }},
        m1 = obj1.m1,
        con1 = connect(obj1, 'm1', obj2, 'm2'),
        con2 = connect(obj1, 'm1', obj3, 'm3');

    expect(obj1.m1(3)).equals(4, 'normal invocation not working 1');
    expect(obj2.result).equals(3+2, 'normal invocation not working 1');
    expect(obj3.result).equals(3+3, 'normal invocation not working 1');

    con1.disconnect();
    expect(obj1.m1(3)).equals(4, 'normal invocaion not working 2');

    con2.disconnect();
    expect(obj1.m1(3)).equals(4, 'normal invocation not working 3');

    expect().assert(!obj1.attributeConnections, 'there are still connections left')

    expect(m1).equals(obj1.m1, 'original method was not restored after method connection');
  });

  it("transitive method connect", function() {
    var obj1 = {m1: function(val) { return val + 1 }},
        obj2 = {m2: function(val) { this.result = val + 2 }},
        obj3 = {m3: function(val) { this.result = val + 3 }},
        con1 = connect(obj1, 'm1', obj2, 'm2'),
        con2 = connect(obj2, 'm2', obj3, 'm3');

    expect(obj1.m1(3)).equals(4, 'normal invocation not working');
    expect(obj2.result).equals(3 + 2, 'normal invocation not working m2');
    expect(obj3.result).equals(3 + 3, 'normal invocation not working m3');

    con1.disconnect();
    expect(obj1.m1(4)).equals(5, 'one method connection not working after disconnect of con1');
    obj2.m2(1)
    expect(obj2.result).equals(3, 'remaining connection not working');

    con2.disconnect();
    obj2.m2(1);
    expect(obj2.result).equals(1 + 2, 'after con2 disconnect m2');
    expect(obj3.result).equals(1 + 3, 'after con2 disconnect m2');
    obj3.m3(4);
    expect(obj3.result).equals(4 + 3, 'after con2 disconnect m3');
  });

  it("connect method to arribute", function() {
    var obj1 = {m1: function(val) { return val + 1 }}, obj2 = {x: null};
    connect(obj1, 'm1', obj2, 'x');
    var r = obj1.m1(3);
    expect(3+1).equals(r, 'result not correct');
    expect(3).equals(obj2.x, 'connected attribute not set correctly');
  });


  xit("connect and disconnect scripts", function() {
    var obj = {m1: function() { return 1}.asScript(), m2: function() { return 2 }.asScript()};
    connect(obj, 'm1', obj, 'm2');
    expect().assert(2, obj.m1(), 'connect not working');
    disconnect(obj, 'm1', obj, 'm2');
    expect().assert(1, obj.m1(), 'disconnect not working 1');
    expect().assert(2, obj.m2(), 'disconnect not working 2');
  });



  xit("method connect uses original value", function() {
    var obj = {
      setX: function(value) { this.x = value },
      setY: function(value) { this.y = value; return 'ERROR' },
      setZ: function(value) { this.z = value },
    };
    connect(obj, 'setX', obj, 'setY');
    connect(obj, 'setX', obj, 'setZ');
    obj.setX('FOO');
    expect('FOO').equals(obj.y);
    expect('FOO').equals(obj.z);
  });

  xit("connect and then update method script", function() {
    var obj = {value: 0}, target1 = {}, target2 = {};

    (function update() { return this.value += 1; }).asScriptOf(obj);

    connect(obj, 'update', target1, 'value');
    connect(obj, 'update', target2, 'value');

    (function update() { return this.value += 1; }).asScriptOf(obj);

    obj.update();

    expect(1).equals(target1.value, 'target1');
    expect(1).equals(target2.value, 'target2');
  });

});

describe("connection events", () => {

  it("call when path not null", function() {
    var obj = {onBaz: function(value) { this.baz = value }}
    callWhenPathNotNull(obj, ['foo', 'bar', 'baz'], obj, "onBaz");
    obj.foo = {};
    obj.foo.bar = {};
    obj.foo.bar.baz = 23;
    expect(23).equals(obj.baz);
  });


  it("on connect handler", function() {
    var obj1 = {value : 1};
    var obj2 = {stub : 2};
    obj1.onConnect = function(attributeName) {
      if (attributeName === "value") this.value = 33.3;
    };
    connect(obj1, "value", obj2, "stub");
    expect(obj1.value).equals(33.3, "onConnect hook is not working");
  });


  it("on disconnect handler", function() {
    var obj1 = {value : 1};
    var obj2 = {stub : 2};
    obj1.onDisconnect = function(attrName, targetObj, targetMethodName) {
      if (targetMethodName === "stub") {
        obj1.value = 33.3;
      }
    };
    connect(obj1, "value", obj2, "stub");
    disconnect(obj1, "value", obj2, "stub");
    expect(obj1.value).equals(33.3, "onDisconnect hook is not working");
  });


});

describe("no update", () => {

  it("dynamically disable update", function() {
    var obj = {};
    connect(obj, 'x', obj, 'y');
    obj.x = 5;
    expect(5).equals(obj.y, 'not updated 1');
    noUpdate({sourceObj: obj, sourceAttribute: 'x'}, function() { obj.x = 6; });
    expect(5).equals(obj.y, 'updated, but should not update');
    expect(function() {
      noUpdate({
        sourceObj: obj, sourceAttribute: 'x'}, function() { throw {} });
    }).throws();
    obj.x = 7;
    expect(7).equals(obj.y, 'not updated 2');
  });

  it("dynamically disable update for one connection", function() {
    var obj = {};
    connect(obj, 'x', obj, 'y');
    connect(obj, 'x', obj, 'z');
    noUpdate({
      sourceObj: obj, sourceAttribute: 'x',
      targetObj: obj, targetAttribute: 'z'
    }, function() { obj.x = 6; });
    expect(6).equals(obj.y, 'not updated y');
    expect(undefined).equals(obj.z, 'updated z but should not');
    obj.x = 7;
    expect(7).equals(obj.y, 'not updated y 2');
    expect(7).equals(obj.z, 'not updated z 2');
  });


  it("dynamically disable update for everything", function() {
    var obj = {}, updateRun = false;
    connect(obj, 'x', obj, 'y');
    connect(obj, 'x', obj, 'z');
    noUpdate(function() {
      noUpdate(function() {
        updateRun = true;
        obj.x = 5;
      });
      obj.x = 6;
    });
    expect().assert(updateRun, 'update not run');
    expect(undefined).equals(obj.y, 'y should not be updated');
    expect(undefined).equals(obj.z, 'updated z but should not');
    obj.x = 7;
    expect(7).equals(obj.y, 'not updated y 2');
    expect(7).equals(obj.z, 'not updated z 2');
  });


});