/* global beforeEach, afterEach, describe, it */

import { expect, assert } from 'mocha-es6';
import { initializeClass } from '../runtime.js';
import '../properties.js';
import { arr } from 'lively.lang';
import { keys } from 'lively.lang/object.js';

// FIXME ???
let m = lively.modules.module('lively.classes/properties.js');
let {
  prepareClassForProperties,
  prepareInstanceForProperties,
  propertiesAndSettingsInHierarchyOf
} = m.recorder;

describe('properties', function () {
  describe('property access in class hierarchy', () => {
    let classA, classB;
    beforeEach(() => {
      classA = class ClassA {
        static get properties () {
          return { test: { defaultValue: 1 }, test2: { defaultValue: 2 } };
        }
      };
      classB = class ClassB extends classA {
        static get properties () {
          return {
            test: { initialize (val) { return val + 1; } },
            test2: { defaultValue: 3 }
          };
        }
      };
    });

    it('merges properties of classes together', () => {
      let { properties } = propertiesAndSettingsInHierarchyOf(classB);
      expect(properties).containSubset({
        test: { defaultValue: 1 },
        test2: { defaultValue: 3 }
      });
    });
  });

  describe('static initialization', () => {
    let classA; beforeEach(() => classA = class ClassA {});

    it('of simple property', () => {
      let { propertySettings } = propertiesAndSettingsInHierarchyOf(classA);
      prepareClassForProperties(classA, { ...propertySettings, valueStoreProperty: '_store' }, { test: {} });

      expect().assert(classA.prototype.__lookupGetter__('test'), 'no test getter');
      expect().assert(classA.prototype.__lookupSetter__('test'), 'no test setter');

      let obj = new classA();
      obj._store = { test: 23 };
      expect(obj.test).equals(23);
      obj.test = 99;
      expect(obj._store.test).equals(99);
    });

    it('read only', () => {
      let { propertySettings } = propertiesAndSettingsInHierarchyOf(classA);
      prepareClassForProperties(classA, propertySettings, { test: { readOnly: true } });
      expect().assert(classA.prototype.__lookupGetter__('test'), 'no test getter');
      expect().assert(!classA.prototype.__lookupSetter__('test'), 'has test setter');
    });

    it('with custom getter / setter', () => {
      let x = 23;
      let { propertySettings } = propertiesAndSettingsInHierarchyOf(classA);
      prepareClassForProperties(classA, propertySettings, { test: { get: () => x, set: val => x = val } });

      let obj = new classA();
      expect(obj.test).equals(23);
      obj.test = 99;
      expect(x).equals(99);
    });
  });

  describe('instance initialization', () => {
    let classA; beforeEach(() => classA = class ClassA {});

    it('creates value store and sets default values', () => {
      let obj = new classA();
      prepareInstanceForProperties(obj, { valueStoreProperty: '_store' }, { test: {} });
      expect(obj).has.property('_store');
      expect(obj).has.nested.property('_store.test', undefined);
    });

    it('sets default values', () => {
      let obj = new classA();
      prepareInstanceForProperties(obj, { valueStoreProperty: '_store' }, { test: { defaultValue: 23 } });
      expect(obj).has.nested.property('_store.test', 23);
    });

    it('sets default value with initializer for derived value', () => {
      let obj = new classA();
      let props = {
        a: { defaultValue: 0 },
        b: {
          afer: ['a'],
          derived: true,
          defaultValue: 23,
          set (val) { this.a = val + 1; },
          get () { return this.a - 1; }
        }
      };
      let { propertySettings } = propertiesAndSettingsInHierarchyOf(classA);
      prepareClassForProperties(classA, propertySettings, props);
      prepareInstanceForProperties(obj, propertySettings, props);
      expect(obj).property('a', 24);
      expect(obj).property('b', 23);
      expect(obj._state).have.property('a');
      expect(obj._state).not.have.property('b');
    });

    it('sets default value of foldable property via setter', () => {
      let obj = new classA();
      let props = {
        f: {
          foldable: ['x', 'y', 'z'],
          defaultValue: 23,
          set (val) {
            this._f = arr.intersect(keys(val), ['x', 'y', 'z']).length == 3 ? val : { x: val, y: val, z: val };
          },
          get () { return this._f; }
        }
      };
      let { propertySettings } = propertiesAndSettingsInHierarchyOf(classA);
      prepareClassForProperties(classA, propertySettings, props);
      prepareInstanceForProperties(obj, propertySettings, props);
      expect(Array.from(obj.f)).equals(Array.from({ x: 23, y: 23, z: 23 }));
      expect(obj).have.property('_f');
      obj.f = { x: 20, y: 23, z: 23 };
      expect(Array.from(obj.f)).equals(Array.from({ x: 20, y: 23, z: 23 }));
    });

    it('runs initialize', () => {
      let x = 3; let obj = new classA();
      prepareInstanceForProperties(obj, { valueStoreProperty: '_store' }, { test: { initialize: () => x += 2 } });
      expect(x).equals(5);
      expect(obj).has.nested.property('_store.test', undefined);
    });

    it('initialize uses values from outside', () => {
      let obj = new classA();
      let values = { test: 23 };
      prepareInstanceForProperties(obj, { valueStoreProperty: '_store' }, { test: {} }, values);
      expect(obj.test).equals(23);
    });

    it('property dependencies observed by initialize', () => {
      var obj = new classA(); var order = [];
      prepareInstanceForProperties(obj, { valueStoreProperty: '_store' }, {
        test: { after: ['test2'], initialize: () => order.push('test') },
        test2: { initialize: () => order.push('test2') }
      });
      expect(order).equals(['test2', 'test'], 1);
      var obj = new classA(); var order = [];
      prepareInstanceForProperties(obj, { valueStoreProperty: '_store' }, {
        test: { initialize: () => order.push('test') },
        test2: { after: ['test'], initialize: () => order.push('test2') }
      });
      expect(order).equals(['test', 'test2'], 2);
    });

    it('property dependencies observed by value setters', () => {
      let obj = new classA(); let order = [];
      let properties = {
        test: { after: ['test2'], set: val => order.push('test', val) },
        test2: { set: val => order.push('test2', val) }
      };
      let { propertySettings } = propertiesAndSettingsInHierarchyOf(classA);
      prepareClassForProperties(classA, propertySettings, properties);
      prepareInstanceForProperties(obj, propertySettings, properties, { test: 1, test2: 2 });
      expect(order).equals(['test2', 2, 'test', 1], 1);
    });
  });

  describe('numeric constraints', () => {
    const instance = (properties, values, settings = {}) => {
      class NumericProperties {}
      const { propertySettings } = propertiesAndSettingsInHierarchyOf(NumericProperties);
      Object.assign(propertySettings, settings);
      prepareClassForProperties(NumericProperties, propertySettings, properties);
      const obj = new NumericProperties();
      prepareInstanceForProperties(obj, propertySettings, properties, values);
      return obj;
    };

    it('clamps assignments, defaults and initialization values', () => {
      const props = { progress: { min: 0, max: 1, isFloat: true, defaultValue: -1 } };
      const obj = instance(props);
      expect(obj.progress).equals(0);
      obj.progress = -0.5;
      expect(obj.progress).equals(0);
      obj.progress = 1.5;
      expect(obj.progress).equals(1);
      obj.progress = 0.375;
      expect(obj.progress).equals(0.375);
      expect(instance(props, { progress: 2 }).progress).equals(1);
      class Defaults { static get properties () { return props; } }
      expect(new Defaults().defaultProperties.progress).equals(0);
    });

    it('rounds only explicitly integer properties within their bounds', () => {
      const obj = instance({
        count: { isFloat: false, min: 0.2, max: 3.8, defaultValue: 0 },
        fontSize: { min: 1, defaultValue: 12.5 }
      });
      expect(obj.count).equals(1);
      obj.count = 2.6;
      expect(obj.count).equals(3);
      obj.count = 5;
      expect(obj.count).equals(3);
      obj.fontSize = 13.25;
      expect(obj.fontSize).equals(13.25);
      expect(() => instance({ count: { min: 0.1, max: 0.9, isFloat: false, defaultValue: 0 } }))
        .throws(RangeError, 'Numeric property bounds contain no allowed values');
    });

    it('passes constrained values to custom and default setters', () => {
      const calls = [];
      const obj = instance({
        custom: { min: 0, set (value) { calls.push(['custom', this, value]); } },
        shared: { max: 1 }
      }, null, { defaultSetter (key, value) { calls.push([key, this, value]); } });
      obj.custom = -1;
      obj.shared = 2;
      expect(calls).equals([['custom', obj, 0], ['shared', obj, 1]]);
    });

    it('keeps custom validation and folded object values', () => {
      const obj = instance({
        scale: { min: 0, set (value) { if (typeof value !== 'number') throw new Error('invalid scale'); this._scale = value; } },
        border: { min: 0, foldable: ['left', 'right'], set (value) { this._border = value; }, get () { return this._border; } }
      });
      expect(() => { obj.scale = 'bad'; }).throws('invalid scale');
      const border = { left: 2, right: 3 };
      obj.border = border;
      expect(obj.border).equals(border);
      obj.border = -2;
      expect(obj.border).equals(0);
      obj.border = null;
      expect(obj.border).equals(null);
      obj.border = NaN;
      expect(Number.isNaN(obj.border)).equals(true);
    });

    it('keeps subclass bounds separate from superclass descriptors', () => {
      const descriptors = { progress: { min: 0, max: 10, defaultValue: 0 } };
      class Parent { static get properties () { return descriptors; } }
      class Child extends Parent { static get properties () { return { progress: { max: 1 } }; } }
      const child = new Child().initializeProperties();
      child.progress = 5;
      const parent = new Parent().initializeProperties();
      parent.progress = 5;
      expect(child.progress).equals(1);
      expect(parent.progress).equals(5);
      expect(descriptors.progress.max).equals(10);
    });

    it('keeps read-only properties and existing native accessors', () => {
      class NativeAccessors {
        set native (value) { this._native = value * 2; }
        get native () { return this._native; }
      }
      const { propertySettings } = propertiesAndSettingsInHierarchyOf(NativeAccessors);
      const props = { native: { max: 1 }, fixed: { readOnly: true, min: 0, defaultValue: 1 } };
      prepareClassForProperties(NativeAccessors, propertySettings, props);
      const obj = new NativeAccessors();
      prepareInstanceForProperties(obj, propertySettings, props);
      obj.native = 2;
      expect(obj.native).equals(4);
      expect(obj.fixed).equals(1);
      expect(NativeAccessors.prototype.__lookupSetter__('fixed')).equals(undefined);
    });
  });

  describe('property settings', () => {
    let classA; beforeEach(() => classA = class ClassA {});

    it('settings can designate default setter', () => {
      let obj = new classA(); let recorded = [];
      var { propertySettings } = propertiesAndSettingsInHierarchyOf(classA);
      var propertySettings = { ...propertySettings, defaultSetter (key, value) { recorded.push(key, value); } };
      let properties = { test: {} };
      prepareClassForProperties(classA, propertySettings, properties);
      prepareInstanceForProperties(obj, propertySettings, properties);
      obj.test = 99;
      expect(recorded).equals(['test', 99]);
    });
  });

  describe('are part of class creation', () => {
    it('static properties from class decl is used for initializing properties', async () => {
      class Foo {
        static get properties () { return { test: { defaultValue: 3 } }; }
      }
      expect().assert(Foo.prototype.__lookupGetter__('test'), 'no getter');
      expect().assert(Foo.prototype.__lookupSetter__('test'), 'no setter');
      let obj = new Foo().initializeProperties();
      expect(obj).property('test', 3);
    });
  });
});
