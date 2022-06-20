/* global beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
// import { classToFunctionTransform } from "node_modules/lively.ast/lib/class-to-function-transform.js"
import { classToFunctionTransform } from '../class-to-function-transform.js';

import {
  initializeClass
} from '../runtime.js';

import {
  initializeSymbol,
  instanceRestorerSymbol,
  superclassSymbol
} from '../util.js';

import { runEval } from 'lively.vm/lib/eval.js';

let tfmOpts, varRecorder;

async function evalClass (classSource) {
  let result = await runEval(
    lively.ast.stringify(classToFunctionTransform(classSource, tfmOpts)),
    { topLevelVarRecorder: varRecorder });
  if (result.isError) throw result.value;
  return result.value;
}

// lively.ast.stringifyclassToFunctionTransform("class Foo2 extends Foo { get x() { return super.x + 1 }\n set x(v) { super.x = v } }", tfmOpts)

describe('create or extend classes', function () {
  beforeEach(() => {
    varRecorder = { initializeClass };
    tfmOpts = {
      classHolder: { type: 'Identifier', name: '__lvVarRecorder' },
      functionNode: { type: 'Identifier', name: 'initializeClass' }
    };
  });

  it('uses known symbols', async () => {
    expect(superclassSymbol).equals(Symbol.for('lively-instance-superclass'));
    expect(instanceRestorerSymbol).equals(Symbol.for('lively-instance-restorer'));
    expect(initializeSymbol).equals(Symbol.for('lively-instance-initialize'));
  });

  it('produces new class', async function () {
    let Foo = await evalClass('class Foo {m() { return 23 }}');
    expect(Foo.name).equals('Foo');
    expect(new Foo().m()).equals(23);
  });

  it('class declaration is stored in classHolder by default', async function () {
    let Foo = await evalClass('class Foo {m() { return 23 }}');
    expect(Foo.name).equals('Foo');
    expect(varRecorder).to.have.property('Foo').equals(Foo);
  });

  it('class expression is not stored in classHolder by default', async function () {
    let Foo = await evalClass('var x = class Foo {m() { return 23 }}');
    expect(Foo.name).equals('Foo');
    expect(varRecorder).to.not.have.property('Foo');
    expect(varRecorder).to.have.property('x');
  });

  it('is initialized with arguments from constructor call', async function () {
    let Foo = await evalClass('class Foo {constructor(a, b) { this.x = a + b; }}');
    expect(new Foo(2, 3).x).equals(5);
  });

  it('accepts getter and setter', async function () {
    let Foo = await evalClass('class Foo {get x() { return this._x; } set x(v) { this._x = v; }}');
    let foo = new Foo();
    foo.x = 23;
    expect(foo.x).equals(23);
    expect(foo._x).equals(23);
  });

  it('same name does not mean same class', async function () {
    let Foo1 = await evalClass('var _ = class Foo {}');
    let Foo2 = await evalClass('var _ = class Foo {}');
    expect(Foo1).to.not.equal(Foo2);
  });

  it('inherits', async function () {
    let Foo = await evalClass('class Foo { m(a) { return this.x + 23 + a } n() { return 123 } }');
    let Foo2 = await evalClass('class Foo2 extends Foo { m(a) { return 2 + super.m(a); } }');
    let foo = new Foo2();
    foo.x = 1;
    expect(foo.m(1)).equals(27);
    expect(foo.n()).equals(123);
    expect(Foo2[superclassSymbol]).equals(Foo);
  });

  it('works with super accessors', async () => {
    let Foo = await evalClass('class Foo { get x() { return this._x } set x(v) { this._x = v }}');
    let Foo2 = await evalClass('class Foo2 extends Foo { get x() { return super.x + 1 }\n set x(v) { super.x = v } }');
    let foo = new Foo2();
    foo.x = 23;
    expect(foo.x).equals(24);
  });

  it('super in initialize', async function () {
    let Foo = await evalClass('class Foo { constructor(a, b) { this.x = a + b; } }');
    let Foo2 = await evalClass('class Foo2 extends Foo { constructor(a, b) { super(a,b); this.y = a; } }');
    expect(new Foo2(2, 3).x).equals(5);
    expect(new Foo2(2, 3).y).equals(2);
  });

  it('inheriting class side', async function () {
    let Foo = await evalClass('class Foo { static foo() { return 23; }  static bar() { return 99; } }');
    let Foo2 = await evalClass('class Foo2 extends Foo { static foo() { return super.foo() + 1; }}');
    expect(Foo2.bar()).equals(99, 'class method of superclass not reachable');
    expect(Foo2.foo()).equals(24, 'method not correctly overriden on class side');
  });

  it('modifying the superclass affects the subclass and its instances', async function () {
    await evalClass('class Foo {}');
    let Foo2 = await evalClass('class Foo2 extends Foo {}');
    let foo = new Foo2();
    await evalClass('class Foo { m() { return 23; } }');
    expect(foo.m()).equals(23);
  });

  it('changing the superclass will change instances', async function () {
    let Foo = await evalClass('class Foo {m() { return 23 } }');
    let Foo2 = await evalClass('class Foo2 extends Object {}');
    let foo = new Foo2();
    expect(foo).to.not.have.property('m');
    expect(foo).instanceOf(Foo2);
    expect(foo).not.instanceOf(Foo);
    await evalClass('class Foo2 extends Foo {}');

    // Changing the superclass currently means changing the prototype, the
    // thing that instances have in  common with their class. When that's replaced
    // the instances are orphaned. That's not a feature but to change that we
    // would have to a) add another prototype indirection or b) track all
    // instances. Neither option seems to be worthwhile...
    expect(foo).instanceOf(Foo2);
    expect(foo).instanceOf(Foo);
    expect(foo).to.have.property('m');
    let anotherFoo = new Foo2();
    expect(anotherFoo).to.have.property('m');
    expect(anotherFoo.constructor).to.equal(foo.constructor);
  });

  it('works with anonymous classes', async () => {
    let X = varRecorder.X = await evalClass('var _ = class { m() { return 23; }}');
    let Y = await evalClass('var _ = class extends X { m() { return super.m() + 1; }}');
    expect(new X().m()).equals(23);
    expect(new Y().m()).equals(24);
  });

  it('method can be overridden', async () => {
    let Foo = await evalClass('class Foo {m() { return 23 } }');
    let foo = new Foo();
    foo.m = () => 24;
    expect(foo.m()).equals(24);
  });

  it('overridden instance methods can be removed', async function () {
    await evalClass('class Foo { m() { return 23; } }');
    const Foo2 = await evalClass('class Foo2 extends Foo { m() { return 42; } }');
    const foo = new Foo2();
    expect(foo.m()).equals(42);
    await evalClass('class Foo2 extends Foo { }');
    expect(foo.m()).equals(23);
  });

  it('class methods can be removed', async function () {
    const Foo = await evalClass('class Foo { static m() { return 23; } }');
    expect(Foo.m()).equals(23);
    await evalClass('class Foo { }');
    expect(Foo.m).to.be.undefined;
  });

  describe('compat with conventional class function', () => {
    it('constructor of base class is used', async () => {
      varRecorder.A = function A (x) { this.y = x + 1; };
      let B = await evalClass('class B extends A {m() { return 23 } }');
      let b = new B(3);
      expect(b.y).equals(4, 'constructor not called');
    });

    it('constructor of base class is used when using own constructor + calling super', async () => {
      varRecorder.A = function A (x) { this.y = x + 1; };
      let B = await evalClass('class B extends A {constructor(x) { super(x); this.z = this.y + 1; } }');
      let b = new B(3);
      expect(b.y).equals(4, 'super constructor not called');
      expect(b.z).equals(5, 'constructor issue');
    });
  });

  describe('with modules', () => {
    beforeEach(() => {
      tfmOpts.currentModuleAccessor = {
        object: { name: '__lvVarRecorder', type: 'Identifier' },
        property: { name: 'module', type: 'Identifier' },
        type: 'MemberExpression'
      };
    });

    it('adds module meta data', async () => {
      varRecorder.module = { package () { return { name: 'foo' }; }, pathInPackage () { return 'bar'; } };
      let Foo = await evalClass('class Foo {}');
      expect(Foo[Symbol.for('lively-module-meta')]).containSubset(
        { package: { name: 'foo', version: undefined }, pathInPackage: 'bar' });
    });

    it('adds observer for superclass', async () => {
      let callback = null;
      varRecorder.module = {
        package () { return { name: 'foo' }; },
        pathInPackage () { return 'bar'; },
        subscribeToToplevelDefinitionChanges: (func) => callback = func,
        unsubscribeFromToplevelDefinitionChanges: (func) => {}
      };
      let Foo = await evalClass('var Bar; class Foo extends Bar {}');
      let Bar = await evalClass('class Bar {m() { return 23; }}');
      callback('Bar', Bar);
      expect(Foo[Symbol.for('lively-instance-superclass')]).equals(Bar);
      expect(new Foo().m()).equals(23);
    });
  });
});
