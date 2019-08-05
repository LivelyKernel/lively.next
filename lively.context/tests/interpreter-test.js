"format esm";
/*global global, beforeEach, afterEach, after, describe, it, expect*/
import * as ast from 'lively.ast';
import { fun, obj, string } from "lively.lang";
import { expect } from 'mocha-es6';
import { isClass } from "lively.classes/util.js";
import { Interpreter } from "../lib/interpreter.js";

describe('interpretation', function() {
  var Global = typeof window !== "undefined" ? window : global;

  function parse(src, options) {
    return ast.parse(src, options);
  }

  function interpret(node, optMapping) {
    var interpreter = new Interpreter();
    return interpreter.run(node, optMapping);
  }

  function interpretWithContext(node, ctx, optMapping) {
    var interpreter = new Interpreter();
    return interpreter.runWithContext(node, ctx, optMapping);
  }

  it('runs an empty program', function() {
    var node = parse('');
    expect(interpret(node)).to.be.undefined;
  });

  it('interprets literals', function() {
    var node = parse('1');
    expect(interpret(node)).to.equal(1);
  });

  it('does arithmetic operations', function() {
    var node = parse('1 + 2');
    expect(interpret(node)).to.equal(3);
  });

  it('does logic operations', function() {
    var node = parse('false || true');
    expect(interpret(node)).to.equal(true);
  });

  it('looks up variables', function() {
    var node = parse('a + 1');
    expect(interpret(node, { a: 1 })).to.equal(2);
  });

  it('looks up member variables (properties)', function() {
    var node = parse('a.b + 2');
    expect(interpret(node, { a: { b: 1 } })).to.equal(3);
  });

  it('interprets then-branch of conditions', function() {
    var node = parse('if (true) 1; else 2;');
    expect(interpret(node)).to.equal(1);
  });

  it('interprets else-branch of conditions', function() {
    var node = parse('if (false) 1; else 2;');
    expect(interpret(node)).to.equal(2);
  });

  it('is fine with missing else-branch', function() {
    var node = parse('if (false) 1;');
    expect(interpret(node)).to.be.undefined;
  });

  it('invokes functions', function() {
    var node = parse('1; (function() { })();');
    expect(interpret(node)).to.be.undefined;
  });

  it('invokes functions and returns values', function() {
    var node = parse('(function() { return 1; })();');
    expect(interpret(node)).to.equal(1);
  });

  it('invokes functions with parameters', function() {
    var node = parse('(function(a) { return a + 1; })(2);');
    expect(interpret(node)).to.equal(3);
  });

  it('invokes functions with parameters that override outer scope variables', function() {
    var node = parse('var a = 1; (function(a) { return a + 1; })(2);');
    expect(interpret(node)).to.equal(3);
  });

  it('captures bound variables in closures', function() {
    var node = parse('var a = 6; (function(b) { return a / b; })(3);');
    expect(interpret(node)).to.equal(2);
  });

  it('captures closure variables', function() {
    var node = parse('var foo = function() { var a = 1; return function() { return a; } }; foo()();');
    expect(interpret(node)).to.equal(1);
  });

  it('does early returns', function() {
    var node = parse('(function() { return 1; 2; })();');
    expect(interpret(node)).to.equal(1);
  });

  it('does early returns from for-loop', function() {
    var node = parse('(function() { for (var i = 0; i < 10; i++) if (i == 5) return i; })();');
    expect(interpret(node)).to.equal(5);
  });

  it('does early returns from while-loop', function() {
    var node = parse('(function() { var i = 0; while (i < 10) { i++; if (i==5) return i; } })();');
    expect(interpret(node)).to.equal(5);
  });

  it('does early returns from do-while-loop', function() {
    var node = parse('(function() { var i = 0; do { i++; if (i==5) return i; } while (i < 10); })();');
    expect(interpret(node)).to.equal(5);
  });

  it('does early returns from for-in-loop', function() {
    var node = parse('(function() { for (var name in { a: 1, b: 2 }) { return name; } })();');
    expect(interpret(node)).to.equal('a');
  });

  it('does recursive calls', function() {
    var node = parse('function foo(n) { return n == 1 ? 1 : foo(n - 1); } foo(10);');
    expect(interpret(node)).to.equal(1);
  });

  it('does member calls', function() {
    var node = parse('var obj = { foo: function() { return 3; } }; obj.foo();');
    expect(interpret(node)).to.equal(3);
  });

  it('handles this in member calls', function() {
    var node = parse('var obj = { foo: function() { this.x = 3; } }; obj.foo(); obj.x;');
    expect(interpret(node)).to.equal(3);
  });

  it('handles this in function calls', function() {
    var node = parse('function foo() { return this; } foo.bind(4)();');
    expect(interpret(node)).to.equal(4);
  });

  it('handles this when bound using bind()', function() {
    var node = parse('var obj = { x: 1 }; function foo() { return this.x; } foo.bind(obj)();');
    expect(interpret(node)).to.equal(1);
  });

  it('handles this in dynamic execution through call', function() {
    var node = parse('var obj = { x: 1 }; function foo() { return this.x; } foo.call(obj);');
    expect(interpret(node)).to.equal(1);
  });

  it('handles modified variables', function() {
    var node = parse('var x = 1; x = 3; x;');
    expect(interpret(node)).to.equal(3);
  });

  it('handles modified member variables', function() {
    var node = parse('var x = { y: 1 }; x.y = 3; x.y;');
    expect(interpret(node)).to.equal(3);
  });

  it('handles creation of member variables', function() {
    var node = parse('var x = {}; x.y = 3; x.y;');
    expect(interpret(node)).to.equal(3);
  });

  it('handles dynamic scope', function() {
    var node = parse('var a = 1; ' +
      'function bar () { return a; } ' +
      'function foo() { var a = 2; return bar(); } ' +
      'foo();');
    expect(interpret(node)).to.equal(1);
  });

  it('handles for-loop', function() {
    var node = parse('var arr = []; for (var i = 0; i < 5; i++) arr[i] = i; arr;');
    expect(interpret(node)).to.eql([0, 1, 2, 3, 4]);
  });

  it('handles while-loop', function() {
    var node = parse('var i = 0; while (i < 3) i++; i;');
    expect(interpret(node)).to.equal(3);
  });

  it('handles while-loop and pre-/post-operators', function() {
    // actually a test for pre/post op
    var node = parse('var obj = { i: 0 }; while (obj.i < 3) { ++obj.i; }'),
       mapping = { obj: { i: 0 } };
    expect(interpret(node, mapping)).to.equal(3);
    expect(mapping).to.have.deep.property('obj.i', 3);

    node = parse('var obj = { i: 0 }; while (obj.i < 3) { obj.i++; }');
    mapping = { obj: { i: 0 } };
    expect(interpret(node, mapping)).to.equal(2);
    expect(mapping).to.have.deep.property('obj.i', 3);
  });

  it('handles do-while-loop', function() {
    var node = parse('var i = 0; do { ++i; } while (i == 0); i;');
    expect(interpret(node)).to.equal(1);
  });

  it('handles for-in-loop', function() {
    var node = parse('var obj = { a: 1, b: 2 }, result; ' +
        'for (result in obj); result;');
    expect(interpret(node)).to.equal('b');
  });

  it('handles for-in-loop with declarations', function() {
    var node = parse('var obj = { a: 1, b: 2 }, result; ' +
        'for (var name in obj) result = name; result;');
    expect(interpret(node)).to.equal('b');
  });

  it('handles for-in-loop with expressions', function() {
    var node = parse('var obj = { a: 1, b: 2 }, m = {}, result; ' +
        'for (m.a in obj) result = m; result.a;');
    expect(interpret(node)).to.equal('b');
  });

  it('executes modifying set operations', function() {
    var node  = parse('a += 2;'),
      mapping = { a: 3 };
    expect(interpret(node, mapping)).to.equal(5);
    expect(mapping.a).to.equal(5);
  });

  it('resolves unary operations', function() {
    var node = parse('var a = 4; -a');
    expect(interpret(node)).to.equal(-4);
  });

  it('resolves typeof operation', function() {
    var node = parse('var a = 4; typeof a');
    expect(interpret(node)).to.equal('number');
  });

  it('resolves typeof for undefined variables', function() {
    var node = parse('typeof a');
    expect(interpret(node)).to.equal('undefined');
  });

  it('executes break in for-loop', function() {
    var node = parse('for (var i = 0; i < 10; i++) { if (i == 2) break; } i;');
    expect(interpret(node)).to.equal(2);
  });

  it('executes break in while-loop', function() {
    var node = parse('var i = 0; while (i < 10) { if (i == 2) break; i++; } i;');
    expect(interpret(node)).to.equal(2);
  });

  it('executes break in do-while-loop', function() {
    var node = parse('var i = 0; do { if (i == 2) break; i++; } while (i < 10); i;');
    expect(interpret(node)).to.equal(2);
  });

  it('executes break in for-in-loop', function() {
    var node = parse('for (var name in { a: 1, b: 2 }) { if (name == "a") break; } name;');
    expect(interpret(node)).to.equal('a');
  });

  it('executes break in switch construct', function() {
    var node = parse('var a = 2; switch(a) { case 1: 1; case 2: 2; break; case 3: 3; }');
    expect(interpret(node)).to.equal(2);
  });

  it('executes basic switch', function() {
    var node = parse('switch (2) { case 1: a++; case 2: a++; case 3: a++; break; case 4: a++ } a;');
    expect(interpret(node, { a: 0 })).to.equal(2);
  });

  it('executes switch with default branch', function() {
    var node = parse('switch (3) { case 1: a = 1; case 2: a = 2; default: a = 3; } a;');
    expect(interpret(node, { a: 0 })).to.equal(3);
  });

  it('executes switch with default branch and fall-through', function() {
    var node = parse('switch (3) { case 1: a = 1; default: a = 3; case 2: a = 2; } a;');
    expect(interpret(node, { a: 0 })).to.equal(2);
  });

  it('executes switch without default', function() {
    var node = parse('switch (3) { case 1: a = 1; case 2: a = 2; } a;');
    expect(interpret(node, { a: 0 })).to.equal(0);
  });

  it('handles continue in for-loop', function() {
    var node = parse('for (var i = 0; i < 5; i++) { if (i > 2) continue; a = i; } a;');
    expect(interpret(node, { a: 0 })).to.equal(2);
  });

  it('handles continue in while-loop', function() {
    var node = parse('var i = 0; while (i < 5) { i++; if (i > 2) continue; a = i; } a;');
    expect(interpret(node, { a: 0 })).to.equal(2);
  });

  it('handles continue in do-while-loop', function() {
    var node = parse('var i = 0; do { i++; if (i > 2) continue; a = i; } while (i < 5); a;');
    expect(interpret(node, { a: 0 })).to.equal(2);
  });

  it('handles continue in for-in-loop', function() {
    var node = parse('for (var name in { a: 1, b: 2 }) { if (name != "a") continue; a = name; } a;');
    expect(interpret(node, { a: '' })).to.equal('a');
  });

  it('handles simple try and catch', function() {
    var node = parse('try { throw { a: 1 }; } catch(e) { e.a; }');
    expect(interpret(node)).to.equal(1);
  });

  it('handles try and catch with finally', function() {
    var node = parse('try { throw { a: 1 }; } catch(e) { e.a; } finally { 2; }');
    expect(interpret(node)).to.equal(2);
  });

  it('handles simple try without catch but with finally (no error)', function() {
    var node = parse('try { 1; } finally { 2; }');
    expect(interpret(node)).to.equal(2);
  });

  it('handles simple try without catch but with finally (with error)', function() {
    var node = parse('try { throw { a: 1 }; } finally { 2; }');
    expect(fun.curry(interpret, node)).to.throw({ a: 1 });
  });

  it('handles nested try and catch constructs', function() {
    var node = parse('try { ' +
          'try { throw 1; } finally { inner.finalizer = true; } ' +
        '} catch (e) { outer.catcher = true; } finally { outer.finalizer = true; }'),
        mapping = {
          inner: {},
          outer: {}
        };
    interpret(node, mapping);
    expect(mapping.outer.finalizer).to.be.true; // outer finalizer was called
    expect(mapping.outer.catcher).to.be.true; // outer catch was called
    expect(mapping.inner.finalizer).to.be.true; // inner finalizer was called
  });

  it('handles try and catch in nested functions', function() {
    var src = 'function m1() { for (var i = 0; i < 10; i++) if (i == 3) throw i; } ' +
              'function m2() { m1(); return 2 }; try { m2(); } catch(e) { e; }',
        node = parse(src);
    expect(interpret(node)).to.equal(3);
  });

  it('handles try and catch with late variable declaration', function() {
    var node = parse('try { throw 1; } catch (e) { var x = 1; }; x;'),
        mapping = {};
    expect(interpret(node, mapping)).to.equal(1);
    expect(mapping.x).to.equal(1);
  });

  it('handles try and catch with variable change in finally', function() {
    var node = parse('var a = 1; try { throw 3; } catch (e) { throw 4; } finally { a = 2; }'),
        mapping = {};

    expect(fun.curry(interpret, node, mapping)).to.throw(4);
    expect(mapping.a).to.equal(2);
  });

  it('executes new on simple function', function() {
    var node = parse('function m() { this.a = 2; } var obj = new m(); obj.a;');
    expect(interpret(node)).to.equal(2);
  });

  it('executes new with direct variable access', function() {
    var node = parse('function m() { this.a = 2; } new m().a;');
    expect(interpret(node)).to.equal(2);
  });

  it('executes new with prototypical inheritance', function() {
    var node = parse('function m() { this.a = 1; } m.prototype.b = 2; new m().b;');
    expect(interpret(node)).to.equal(2);
  });

  it('executes new with overridden prototypical value', function() {
    var node = parse('function m() { this.a = 1; } m.prototype.a = 2; new m(); m.prototype.a;');
    expect(interpret(node)).to.equal(2);
  });

  it('executes new with programmatically added prototypical value', function() {
    var node = parse('function m() {} m.prototype.a = 2; var obj = new m(); m.prototype.a = 1; obj.a;');
    expect(interpret(node)).to.equal(1);
  });

  it('executes new with function call in "initializer"', function() {
    var node = parse('function m() { this.a = (function() { return 1; })(); }; new m().a;');
    expect(interpret(node)).to.equal(1);
  });

  it('executes new with object return value in "initializer"', function() {
    var node = parse('function m() { return { a: 23 }; }; new m().a;');
    expect(interpret(node)).to.equal(23);
  });

  it('executes new with non-object return value in "initializer"', function() {
    var node = parse('function m() { this.a = 23; return 42 }; new m().a;');
    expect(interpret(node)).to.equal(23);
  });

  it('executes new with object as last value in "initializer"', function() {
    var node = parse('function m() { this.a = 23; ({ a: 42 }); } new m().a;');
    expect(interpret(node)).to.equal(23);
  });

  // xit('can instantiate class', function() {
  //   var className = 'Dummy_test26InstantiateClass';
  //   after(function() { delete Global.lively[className]; });
  //   var klass = lang.class.create('lively.' + className, { a: 1 }),
  //       src = string.format('var obj = new lively.%s(); obj.a;', className),
  //       node = parse(src);
  //   expect(interpret(node, { lively: lively })).to.equal(1);
  //   expect(isClass(Global.lively[className])).to.be.true;
  // });
  // 
  // xit('can instantiate class with constructor arguments', function() {
  //   var className = 'Dummy_test27ArgumentsOfConstructorAreUsed';
  //   after(function() { delete Global.lively[className]; });
  //   lang['class'].create('lively.' + className, { initialize: function(n) { this.n = n; } });
  //   var src = string.format('var obj = new lively.%s(1); obj.n;', className),
  //       node = parse(src);
  //   expect(interpret(node, { lively: lively })).to.equal(1);
  // });

  it('can access arguments variable', function() {
    var node = parse('function x() { return arguments[0]; } x(1);');
    expect(interpret(node)).to.equal(1);
  });

  it('can set arguments variable', function() {
    var node = parse(
          'function x() { arguments = [2]; return arguments[0]; } x(1);',
          {sourceType: 'script'} // neccessary to not have strict mode
        );
    expect(interpret(node)).to.equal(2);
  });

  it('can modify arguments variable', function() {
    var node = parse(
          'function x() { arguments[0] = 2; return arguments[0]; } x(1);',
          {sourceType: 'script'} // neccessary to not have strict mode
        );
    expect(interpret(node)).to.equal(2); // directly modifying arguments works

    node = parse(
      'function x(a) { arguments[0] = 2; return a; } x(1);',
      {sourceType: 'script'} // neccessary to not have strict mode
    );
    expect(interpret(node)).to.equal(2); // indirectly modifying arguments works

    node = parse(
      'function x(a) { var z = []; arguments = z; z[0] = 23; return a; } x(5)',
      {sourceType: 'script'} // neccessary to not have strict mode
    );
    expect(interpret(node)).to.equal(5); // actual arguments not changed via non-Argument obj

    // FIXME: this should work too! (non-strict)
    // node = parse(
    //   'function x(a) { a = 2; return arguments[0]; } x(1);',
    //   {sourceType: 'script'} // neccessary to not have strict mode
    // );
    // expect(interpret(node)).to.equal(2); // modifying named argument works
  });

  it('throws an error if arguments is used outside of a function', function() {
    var node = parse('arguments;');
    expect(fun.curry(interpret, node)).to.throw(Error);
  });

  it('can set and access global arguments variable', function() {
    var node = parse(
          'var arguments = 2; arguments;',
          {sourceType: 'script'} // neccessary to not have strict mode
        );
    expect(interpret(node)).to.equal(2);
  });

  it('can work with mixed arguments definitions', function() {
    var src = 'function foo() {\n'
            + '  var arguments = "hey";\n'
            + '  function bar() {\n'
            + '    arguments = undefined;\n'
            + '    return arguments;\n'
            + '  }\n'
            + '  return bar();\n'
            + '}\n'
            + 'foo();\n',
        node = parse(src, {sourceType: 'script'}); // neccessary to not have strict mode
    expect(interpret(node)).to.be.undefined;
  });

  it('can handle argument called arguments', function() {
    var node = parse(
      'function x(arguments) { return arguments; } x(1, 2, 3);',
      {sourceType: 'script'} // neccessary to not have strict mode
    );
    expect(interpret(node)).to.equal(1);
  });

  it('evaluates null to null', function() {
    var node = parse('null');
    expect(interpret(node)).to.be.null;
  });

  it('can test simple RegExps', function() {
    var node = parse('/aaa/.test("aaa")');
    expect(interpret(node)).to.be.true;
  });

  it('returns real function for a function', function() {
    var node = parse('function m() {} m;'),
        result = interpret(node);
    expect(obj.isFunction(result)).to.be.true;
  });

  it('can determine instanceof an object', function() {
    var node = parse('new String(123) instanceof String;');
    expect(interpret(node, Global)).to.be.true;
  });

  it('can run for-loop with multiple init and update expressions', function() {
    var node = parse('var i, j; for (i = 0, j = 1; i < 10; i++, j*=2) { }; [i, j]');
    expect(interpret(node)).to.eql([10, 1024]);
  });

  it('detect property in object (using in-statement)', function() {
    var node = parse('"a" in ({ a: 23 })');
    expect(interpret(node)).to.be.true;
  });

  it('execute while(true) with jumping out using return', function() {
    var node = parse('(function() { while(true) return 23; return 24; })()');
    expect(interpret(node)).to.equal(23);
  });

  it('will return value for if-statement', function() {
    var node = parse('if (2,3,4) 5;');
    expect(interpret(node)).to.equal(5);
  });

  it('can assign assign variables in outer scope', function() {
    var node = parse('(function() { var a = 2; (function() { a++; })(); return a; })();');
    expect(interpret(node)).to.equal(3);
  });

  it('can assign variables in scope accordingly', function() {
    var node = parse('(function() { var a = 2; (function() { var a = 3; })(); return a; })();');
    expect(interpret(node)).to.equal(2);
  });

  it('can assign variables that fall through', function() {
    var node = parse('(function() { var a = b = 1; })();'),
        mapping = { b: 0 };
    interpret(node, mapping);
    expect(mapping.b).to.equal(1);
  });

  it('execute alternative message send', function() {
    var node = parse('(function(){ var obj = { foo: function() { return 23; } }; return obj["foo"](); })();');
    expect(interpret(node)).to.equal(23);
  });

  it('handles different member access methods correctly (isComputed)', function() {
    var node = parse('var obj = { foo: 1, bar: 2 }, bar = "foo"; obj.bar;');
    expect(interpret(node)).to.equal(2);

    var node = parse('var obj = { foo: 1, bar: 2 }, bar = "foo"; obj[bar]');
    expect(interpret(node)).to.equal(1);
  });

  it('can call native constructors', function() {
    var node = parse('(function() { return typeof new Date(); })();');
    expect(interpret(node, Global)).to.equal('object');
  });

  it('can call native constructors with arguments', function() {
    var node = parse('(new RegExp("f[o]+")).exec("fooobar");');
    expect(interpret(node, Global)).to.be.an('array').to.contain('fooo');
  });

  it('cannot delete an existing variable from scope', function() {
    var node = parse('delete x;', {sourceType: 'script'}), // neccessary to not have strict mode
        mapping = { x: 1 };
    expect(interpret(node, mapping)).to.equal(false);
    expect(mapping.x).to.equal(1);
  });

  it('can delete a non-existing variable', function() {
    var node = parse('delete x;', {sourceType: 'script'}); // neccessary to not have strict mode
    expect(interpret(node)).to.equal(true);
  });

  it('can delete a property from an object', function() {
    var node = parse('delete x.a;'),
        mapping = { x: { a: 1 } };
    expect(interpret(node, mapping)).to.equal(true);
    expect(mapping).not.to.have.deep.property('x.a');
  });

  it('can delete a non-existing property from an object', function() {
    var node = parse('delete x.b;'),
        mapping = { x: { a: 1 } };
    expect(interpret(node, mapping)).to.equal(true);
    expect(mapping).not.to.have.deep.property('x.b');
  });

  it('can delete a deeply nested property from an object graph', function() {
    var node = parse('delete x.y.z;'),
        mapping = { x: { y: { z: 1 } } };
    expect(interpret(node, mapping)).to.equal(true);
    expect(mapping).not.to.have.deep.property('x.y.z');
  });

  it('cannot delete a property from a non-existing object', function() {
    var node = parse('delete x.y;');
    expect(fun.curry(interpret, node)).to.throw(Error);
  });

  it('can break loops using labels', function() {
    var node = parse('outer: for (i = 0; i < 3; i++) { for (j = 0; j < 3; j++) break outer; } i += 5;'),
        mapping = { i: 0, j: 0 };
    interpret(node, mapping);
    expect(mapping.i).to.equal(5); // labeled break did break outer for-loop
    expect(mapping.j).to.equal(0); // labeled break did break to outer for-loop
  });

  it('can continue loops using labels', function() {
    var node = parse('outer: for (i = 0; i < 3; i++) { for (j = 0; j < 3; j++) continue outer; } i += 5;'),
        mapping = { i: 0, j: 0 };
    interpret(node, mapping);
    expect(mapping.i).to.equal(8); // labeled continue did continue at outer for-loop
    expect(mapping.j).to.equal(0); // labeled continue did stop at inner for-loop
  });

  it('handles late variable declaration', function() {
    var node = parse('x; var x;');
    expect(interpret(node)).to.be.undefined; // should not raise an error
  });

  it('handles late function declaration', function() {
    var node = parse('var bar = foo(); function foo() { return 1; } bar;');
    expect(interpret(node)).to.equal(1);
  });

  it('interprets getter', function() {
    var node = parse('var obj = { get prop() { return 123; } }; obj.prop;');
    expect(interpret(node)).to.equal(123);
  });

  it('interprets setter', function() {
    var node = parse('var bar, obj = { set foo(val) { bar = val; } }; obj.foo = 123; bar;');
    expect(interpret(node)).to.equal(123);
  });

  it('handles with-statements', function() {
    var node = parse(
          'with({ a: 1 }) { a; }',
          {sourceType: 'script'} // neccessary to not have strict mode
        ),
        mapping = {};
    expect(interpret(node, mapping)).to.equal(1);
    expect(mapping).not.to.have.property('a');
  });

  it('handles with-statements with fall-through', function() {
    var node = parse(
          'var a = 1; with({ b: 2 }) { a; }',
          {sourceType: 'script'} // neccessary to not have strict mode
        );
    expect(interpret(node)).to.equal(1);
  });

  it('handles deletes in with-statements', function() {
    var node = parse(
          'var obj = { a: 1 }; with(obj) { delete obj.a; a; }',
          {sourceType: 'script'} // neccessary to not have strict mode
        );
    expect(fun.curry(interpret, node)).to.throw(Error);
  });

  it('handles (this) context', function() {
    var node = parse('this');
    expect(interpretWithContext(node, 42)).to.equal(42);
  });

  it('can read undefined variable from global scope', function() {
    var node = parse('a1b2c3;')
    expect(fun.curry(interpret, node, Global)).to.throw(Error); // undefined variable read threw an error
  });

  it('can add variable to global scope', function() {
    var node = parse('a1b2c3 = 123;')
    expect(interpret(node, Global)).to.equal(123);
    expect(123).to.equal(Global.a1b2c3); // global variable was set
    delete Global.a1b2c3;
  });

  it('throws UnwindException for debugger statements', function() {
    var node = parse('debugger; 123;');
    expect(fun.curry(interpret, node)).to.throw(/UNWIND.*Debugger/);
  });

  it('does not leak implementation for function names', function() {
    var src = 'function foo() {}\nfoo.name;',
        node = parse(src);
    expect(interpret(node)).to.equal('foo'); // right function name returned

    src = '(function() {}).name;',
    node = parse(src);
    expect(interpret(node)).to.equal(''); // function name for anonymous function is empty'
  });

  it('does not leak implementation for argument names', function() {
    var src = '(function foo(a, b, c) {}).argumentNames();',
        node = parse(src);
    expect(interpret(node)).to.eql(['a', 'b', 'c']); // right argument names returned
  });

  it('does not leak implementation for function source', function() {
    var fnStr = 'function foo(a, b, c) {}',
        src = '(' + fnStr + ').toString();',
        node = parse(src);
    ast.acorn.walk.addSource(node, src); // FIXME: this should not be necessary!
    expect(interpret(node)).to.eql(fnStr); // right function string/source was returned
  });

  it('handles overridden argument name by local variable definition', function() {
    var src = '(function(a) { var a; return a; })(123);',
        node = parse(src);
    expect(interpret(node)).to.equal(123); // variable declaration overwrote argument
  });

  it('errors when accessing property of an undefined variable', function() {
    var src = 'var foo; foo.bar',
        node = parse(src);
    expect(fun.curry(interpret, node)).to.throw(/undefined/); // FIXME: error messages are implementation dependent (use to be: /TypeError.*property.*bar.*undefined/)
  });

});
