/* global beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';

import { string } from 'lively.lang';
import { classToFunctionTransform } from '../class-to-function-transform.js';
import { member } from 'lively.ast/lib/nodes.js';
import { parse } from 'lively.ast/lib/parser.js';
import stringify from 'lively.ast/lib/stringify.js';

function classTemplate (className, superClassName, methodString, classMethodString, classHolder, moduleMeta, useClassHolder = true, start, end) {
  if (methodString.includes('\n')) methodString = string.indent(methodString, '  ', 2).replace(/^\s+/, '');
  if (classMethodString.includes('\n')) classMethodString = string.indent(classMethodString, '  ', 2).replace(/^\s+/, '');

  if (!className) useClassHolder = false;

  let classFunctionHeader = className ? `function ${className}` : 'function ';
  if (useClassHolder) { classFunctionHeader = `__lively_classholder__.hasOwnProperty("${className}") && typeof __lively_classholder__.${className} === "function" ? __lively_classholder__.${className} : __lively_classholder__.${className} = ${classFunctionHeader}`; }

  return `function (superclass) {
  var __lively_classholder__ = ${classHolder};
  var __lively_class__ = ${classFunctionHeader}(__first_arg__) {
    if (__first_arg__ && __first_arg__[Symbol.for("lively-instance-restorer")]) {
    } else {
      return this[Symbol.for("lively-instance-initialize")].apply(this, arguments);
    }
  };
  if (Object.isFrozen(__lively_classholder__)) {
    return __lively_class__;
  }
  return initializeClass(__lively_class__, superclass, ${methodString}, ${classMethodString}, ${ useClassHolder ? '__lively_classholder__' : 'null'}, ${moduleMeta}, {
    start: ${start},
    end: ${end}
  });
}(${superClassName});`;
}

function classTemplateDecl (className, superClassName, methodString, classMethodString, classHolder, moduleMeta, start, end) {
  return `var ${className} = ${classTemplate(className, superClassName, methodString, classMethodString, classHolder, moduleMeta, true, start, end)}`;
}

let opts = {
  classHolder: { type: 'Identifier', name: '_rec' },
  functionNode: { type: 'Identifier', name: 'initializeClass' },
  addDeclarations: false,
  addClassNameGetter: false
};

describe('class transform', () => {
  it('is translated into class initializer function', () =>
    expect(stringify(classToFunctionTransform('class Foo {}', opts))).to.equal(
      classTemplateDecl('Foo', 'undefined', 'undefined', 'undefined', '_rec', 'undefined', 0, 12)));

  it('with class expressions', () =>
    expect(stringify(classToFunctionTransform('var x = class Foo {}', opts))).to.equal(
        `var x = ${classTemplate('Foo', 'undefined', 'undefined', 'undefined', '_rec', 'undefined', false, 8, 20)}`));

  it('with anonymous class expressions', () =>
    expect(stringify(classToFunctionTransform('var x = class {}', opts))).to.equal(
        `var x = ${classTemplate(undefined, 'undefined', 'undefined', 'undefined', '_rec', 'undefined', undefined, 8, 16)}`));

  it('with methods', () =>
    expect(stringify(classToFunctionTransform('class Foo {m() { return 23; }}', opts))).to.equal(
      classTemplateDecl('Foo', undefined, `[{
  key: "m",
  value: function Foo_m_() {
    return 23;
  }
}]`, 'undefined', '_rec', 'undefined', 0, 30)));

  it('with class side methods', () =>
    expect(stringify(classToFunctionTransform('class Foo {static m() { return 23; }}', opts))).to.equal(
      classTemplateDecl('Foo', undefined, 'undefined', `[{
  key: "m",
  value: function Foo_m_() {
    return 23;
  }
}]`, '_rec', 'undefined', 0, 37)));

  it('with class side methods inheritance + super call', () =>
    expect(stringify(classToFunctionTransform('class Foo2 extends Foo {static m() { return super.m() + 1; }}', opts))).to.equal(
      classTemplateDecl('Foo2', 'Foo', 'undefined', `[{
  key: "m",
  value: function Foo2_m_() {
    return initializeClass._get(Object.getPrototypeOf(__lively_class__), "m", this).call(this) + 1;
  }
}]`, '_rec', 'undefined', 0, 61)));

  it('with superclass', () =>
    expect(stringify(classToFunctionTransform('class Foo extends Bar {}', opts))).to.equal(
      classTemplateDecl('Foo', 'Bar', 'undefined', 'undefined', '_rec', 'undefined', 0, 24)));

  it('with supercall', () =>
    expect(stringify(classToFunctionTransform('class Foo extends Bar {m() { super.m(a, b, c); }}', opts))).to.equal(
      classTemplateDecl('Foo', 'Bar', `[{
  key: "m",
  value: function Foo_m_() {
    initializeClass._get(Object.getPrototypeOf(__lively_class__.prototype), "m", this).call(this, a, b, c);
  }
}]`, 'undefined', '_rec', 'undefined', 0, 49)
    ));

  it('with supercall of computed prop', () =>
    expect(stringify(classToFunctionTransform('class Foo extends Bar {m() { super["f-o-o"](a, b, c); }}', opts))).to.equal(
      classTemplateDecl('Foo', 'Bar', `[{
  key: "m",
  value: function Foo_m_() {
    initializeClass._get(Object.getPrototypeOf(__lively_class__.prototype), "f-o-o", this).call(this, a, b, c);
  }
}]`, 'undefined', '_rec', 'undefined', 0, 56)
    ));

  it('super getter', () =>
    expect(stringify(classToFunctionTransform('class Foo extends Bar { get x() { return super.x; }}', opts))).to.equal(
      classTemplateDecl('Foo', 'Bar', `[{
  key: "x",
  get: function get() {
    return initializeClass._get(Object.getPrototypeOf(__lively_class__.prototype), "x", this);
  }
}]`, 'undefined', '_rec', 'undefined', 0, 52)
    ));

  it('with supercall and arguments usage', () =>
    expect(stringify(classToFunctionTransform('class Foo extends Bar {m() { super.m(a, arguments[0], c); }}', opts))).to.equal(
      classTemplateDecl('Foo', 'Bar', `[{
  key: "m",
  value: function Foo_m_() {
    initializeClass._get(Object.getPrototypeOf(__lively_class__.prototype), "m", this).call(this, a, arguments[0], c);
  }
}]`, 'undefined', '_rec', 'undefined', 0, 60)));

  it('constructor is converted to initialize', () =>
    expect(stringify(classToFunctionTransform('class Foo {constructor(arg) { this.x = arg; }}', opts))).to.equal(
      classTemplateDecl('Foo', 'undefined', `[{
  key: Symbol.for("lively-instance-initialize"),
  value: function Foo_initialize_(arg) {
    this.x = arg;
  }
}]`, 'undefined', '_rec', 'undefined', 0, 46)));

  it('super call in constructor is converted to initialize call', () =>
    expect(stringify(classToFunctionTransform('class Foo extends Object { constructor(arg) { super(arg, 23); } }', opts))).to.equal(
      classTemplateDecl('Foo', 'Object', `[{
  key: Symbol.for("lively-instance-initialize"),
  value: function Foo_initialize_(arg) {
    var _this;
    _this = initializeClass._get(Object.getPrototypeOf(__lively_class__.prototype), Symbol.for("lively-instance-initialize"), this).call(this, arg, 23);
    return _this;
  }
}]`, 'undefined', '_rec', 'undefined', 0, 65)));

  it('with export default', () =>
    expect(stringify(classToFunctionTransform('export default class Foo {}', opts))).to.equal(
        `var Foo = ${classTemplate('Foo', 'undefined', 'undefined', 'undefined', '_rec', 'undefined', true, 15, 27)}\nexport default Foo;`));

  it('with export class', () =>
    expect(stringify(classToFunctionTransform('export class Foo {}', opts))).to.equal(
        `export var Foo = ${classTemplate('Foo', 'undefined', 'undefined', 'undefined', '_rec', 'undefined', true, 7, 19)}`));

  it('adds current module accessor', () =>
    expect(
      stringify(classToFunctionTransform('class Foo {}', Object.assign({}, opts, { currentModuleAccessor: member('foo', 'bar') }))))
      .to.equal(
          `var Foo = ${classTemplate('Foo', 'undefined', 'undefined', 'undefined', '_rec', 'foo.bar', true, 0, 12)}`));

  it('add superclass ref when module accessor available and superclass in toplevel scope', () => {
    expect(
      stringify(classToFunctionTransform('var Bar; class Foo extends Bar {}', Object.assign({}, opts, { currentModuleAccessor: member('foo', 'bar') }))))
      .to.equal(`var Bar;
${classTemplateDecl('Foo', `{
  referencedAs: "Bar",
  value: Bar
}`, 'undefined', 'undefined', '_rec', 'foo.bar', 9, 33)}`);
  });

  it('doesnt add superclass ref when not in toplevel scope', () => {
    expect(
      stringify(
        classToFunctionTransform(
          'function zork() { var Bar; class Foo extends Bar {} };',
          Object.assign({}, opts, { currentModuleAccessor: member('foo', 'bar') }))))
      .to.equal(`function zork() {
  var Bar;
${string.indent(classTemplateDecl('Foo', 'Bar', 'undefined', 'undefined', '{}', 'foo.bar', 27, 51), '  ', 1)}
}
;`);
  });
});
