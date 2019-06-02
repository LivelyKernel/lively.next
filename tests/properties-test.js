/*global beforeEach, afterEach, describe, it*/

import { expect, assert } from "mocha-es6";
import { initializeClass } from "../runtime.js";
import "../properties.js";
import { arr } from "lively.lang";
import { keys } from "lively.lang/object.js";

// FIXME ???
var m = lively.modules.module("lively.classes/properties.js")
var  {
  prepareClassForProperties,
  prepareInstanceForProperties,
  propertiesAndSettingsInHierarchyOf
} = m.recorder;

describe("properties", function() {

  describe("property access in class hierarchy", () => {

    var classA, classB;
    beforeEach(() => {
      classA = class ClassA {
        static get properties() {
          return {test: {defaultValue: 1}, test2: {defaultValue: 2}};
        }
      }
      classB = class ClassB extends classA {
        static get properties() {
          return {
            test: {initialize(val) { return val + 1; }},
            test2: {defaultValue: 3}
          };
        }
      }
    });
    
    it("merges properties of classes together", () => {
      var {properties} = propertiesAndSettingsInHierarchyOf(classB);
      expect(properties).containSubset({
        test: {defaultValue: 1},
        test2: {defaultValue: 3}
      })
    });
  });

  describe("static initialization", () => {

    var classA; beforeEach(() => classA = class ClassA {});

    it("of simple property", () => {
      var {propertySettings} = propertiesAndSettingsInHierarchyOf(classA);
      prepareClassForProperties(classA, {...propertySettings, valueStoreProperty: "_store"}, {test: {}});

      expect().assert(classA.prototype.__lookupGetter__("test"), "no test getter");
      expect().assert(classA.prototype.__lookupSetter__("test"), "no test setter");

      var obj = new classA();
      obj._store = {test: 23}
      expect(obj.test).equals(23);
      obj.test = 99;
      expect(obj._store.test).equals(99);
    });

    it("read only", () => {
      var {propertySettings} = propertiesAndSettingsInHierarchyOf(classA)
      prepareClassForProperties(classA, propertySettings, {test: {readOnly: true}});
      expect().assert(classA.prototype.__lookupGetter__("test"), "no test getter");
      expect().assert(!classA.prototype.__lookupSetter__("test"), "has test setter");
    });

    it("with custom getter / setter", () => {
      var x = 23;
      var {propertySettings} = propertiesAndSettingsInHierarchyOf(classA)
      prepareClassForProperties(classA, propertySettings, {test: {get: () => x, set: val => x = val}});

      var obj = new classA();
      expect(obj.test).equals(23);
      obj.test = 99;
      expect(x).equals(99);
    });

  });

  describe("instance initialization", () => {

    var classA; beforeEach(() => classA = class ClassA {});

    it("creates value store and sets default values", () => {
      var obj = new classA();
      prepareInstanceForProperties(obj, {valueStoreProperty: "_store"}, {test: {}});
      expect(obj).has.property("_store");
      expect(obj).has.deep.property("_store.test", undefined);
    })

    it("sets default values", () => {
      var obj = new classA();
      prepareInstanceForProperties(obj, {valueStoreProperty: "_store"}, {test: {defaultValue: 23}});
      expect(obj).has.deep.property("_store.test", 23);
    })

    it("sets default value with initializer for derived value", () => {
      var obj = new classA();
      var props = {
        a: {defaultValue: 0},
        b: {
          afer: ["a"],
          derived: true,
          defaultValue: 23,
          set(val) { this.a = val + 1; },
          get() { return this.a - 1; }
        }
      }
      var {propertySettings} = propertiesAndSettingsInHierarchyOf(classA)
      prepareClassForProperties(classA, propertySettings, props);
      prepareInstanceForProperties(obj, propertySettings, props);
      expect(obj).property("a", 24);
      expect(obj).property("b", 23);
      expect(obj._state).have.property("a");
      expect(obj._state).not.have.property("b");
    })

    it("sets default value of foldable property via setter", () => {
      var obj = new classA();
      var props = {
        f: {
          foldable: ['x', 'y', 'z'],
          defaultValue: 23,
          set(val) {
            this._f = arr.intersect(keys(val), ['x', 'y', 'z']).length == 3 ? val : {x: val, y: val, z: val};
          },          
          get() { return this._f }
        }
      }
      var {propertySettings} = propertiesAndSettingsInHierarchyOf(classA)
      prepareClassForProperties(classA, propertySettings, props);
      prepareInstanceForProperties(obj, propertySettings, props);
      expect(Array.from(obj.f)).equals(Array.from({x: 23, y: 23, z: 23}));
      expect(obj).have.property("_f");
      obj.f = {x: 20, y: 23, z: 23};
      expect(Array.from(obj.f)).equals(Array.from({x: 20, y: 23, z: 23}));
    })

    it("runs initialize", () => {
      var x = 3, obj = new classA();
      prepareInstanceForProperties(obj, {valueStoreProperty: "_store"}, {test: {initialize: () => x += 2}});
      expect(x).equals(5);
      expect(obj).has.deep.property("_store.test", undefined);
    });

    it("initialize uses values from outside", () => {
      var obj = new classA(),
          values = {test: 23};
      prepareInstanceForProperties(obj, {valueStoreProperty: "_store"}, {test: {}}, values);
      expect(obj.test).equals(23);
    });

    it("property dependencies observed by initialize", () => {
      var obj = new classA(), order = [];
      prepareInstanceForProperties(obj, {valueStoreProperty: "_store"}, {
        test: {after: ["test2"], initialize: () => order.push("test")},
        test2: {initialize: () => order.push("test2")},
      });
      expect(order).equals(["test2", "test"], 1);
      var obj = new classA(), order = [];
      prepareInstanceForProperties(obj, {valueStoreProperty: "_store"}, {
        test: {initialize: () => order.push("test")},
        test2: {after: ["test"], initialize: () => order.push("test2")},
      });
      expect(order).equals(["test", "test2"], 2);
    });

    it("property dependencies observed by value setters", () => {
      var obj = new classA(), order = [];
      var properties = {
        test: {after: ["test2"], set: val => order.push("test", val)},
        test2: {set: val => order.push("test2", val)},
      }
      var {propertySettings} = propertiesAndSettingsInHierarchyOf(classA)
      prepareClassForProperties(classA, propertySettings, properties);
      prepareInstanceForProperties(obj, propertySettings, properties, {test: 1, test2: 2});
      expect(order).equals(["test2", 2, "test", 1], 1);
    });

  });

  describe("property settings", () => {

    var classA; beforeEach(() => classA = class ClassA {});

    it("settings can designate default setter", () => {
      var obj = new classA(), recorded = [];
      var {propertySettings} = propertiesAndSettingsInHierarchyOf(classA)
      var propertySettings = {...propertySettings, defaultSetter(key, value) { recorded.push(key, value); }}
      var properties = {test: {}}
      prepareClassForProperties(classA, propertySettings, properties);
      prepareInstanceForProperties(obj, propertySettings, properties);
      obj.test = 99;
      expect(recorded).equals(["test", 99]);
    });

  });

  describe("are part of class creation", () => {

    it("static properties from class decl is used for initializing properties", async () => {
      class Foo {
        static get properties() { return {test: {defaultValue: 3}} }
      }
      expect().assert(Foo.prototype.__lookupGetter__("test"), "no getter");
      expect().assert(Foo.prototype.__lookupSetter__("test"), "no setter");
      var obj = new Foo().initializeProperties();
      expect(obj).property("test", 3);
    });

  });
});
