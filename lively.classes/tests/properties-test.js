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
      expect(obj).has.deep.property('_store.test', undefined);
    });

    it('sets default values', () => {
      let obj = new classA();
      prepareInstanceForProperties(obj, { valueStoreProperty: '_store' }, { test: { defaultValue: 23 } });
      expect(obj).has.deep.property('_store.test', 23);
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
      expect(obj).has.deep.property('_store.test', undefined);
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
