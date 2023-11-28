/* global describe, it */
import { expect } from 'mocha-es6';
import { string, fun } from 'lively.lang';
import { stringify, parse, transform, nodes } from 'lively.ast';
import { rewriteToCaptureTopLevelVariables, rewriteToRegisterModuleToCaptureSetters } from '../capturing.js';
import { classToFunctionTransform } from 'lively.classes';
import { defaultClassToFunctionConverterName } from 'lively.vm';

function _testVarTfm (descr, options, code, expected, only) {
  if (typeof options === 'string') {
    only = expected;
    expected = code;
    code = options;
    options = {
      classToFunction: {
        classHolder: nodes.id('_rec'),
        functionNode: nodes.id('_createOrExtendClass'),
        transform: classToFunctionTransform
      }
    };
  }
  return (only ? it.only : it)(descr, () => {
    let result = stringify(
      fun.compose(rewriteToCaptureTopLevelVariables, transform.objectSpreadTransform)(
        parse(code), {
          name: '_rec',
          type: 'Identifier'
        }, options));
    expect(result).equals(expected);
  });
}

function testVarTfm (descr, options, code, expected) { return _testVarTfm(descr, options, code, expected, false); }
function only_testVarTfm (descr, options, code, expected) { return _testVarTfm(descr, options, code, expected, true); }

function classTemplate (className, superClassName, methodString, classMethodString, classHolder, moduleMeta, useClassHolder = true, start, end, evalId) {
  if (methodString.includes('\n')) methodString = string.indent(methodString, '  ', 2).replace(/^\s+/, '');
  if (classMethodString.includes('\n')) classMethodString = string.indent(classMethodString, '  ', 2).replace(/^\s+/, '');

  if (!className) useClassHolder = false;

  let classFunctionHeader = className ? `function ${className}` : 'function ';
  if (useClassHolder) { classFunctionHeader = `__lively_classholder__.hasOwnProperty("${className}") && typeof __lively_classholder__.${className} === "function" ? __lively_classholder__.${className} : __lively_classholder__.${className} = ${classFunctionHeader}`; }

  let pos = '';
  if (start !== undefined && end !== undefined) {
    pos = `, {
    start: ${start},
    end: ${end}${evalId ? `,\n    evalId: ${evalId}` : ''}
  }`;
  }
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
  return _createOrExtendClass(__lively_class__, superclass, ${methodString}, ${classMethodString}, ${ useClassHolder ? '__lively_classholder__' : 'null'}, ${moduleMeta}${pos});
}(${superClassName})`;
}

function classTemplateDecl (className, superClassName, methodString, classMethodString, classHolder, moduleMeta, start, end, evalId) {
  return `var ${className} = ${classTemplate(className, superClassName, methodString, classMethodString, classHolder, moduleMeta, true, start, end, evalId)};`;
}

describe('ast.capturing', function () {
  testVarTfm('transformTopLevelVarDeclsForCapturing',
    'var y, z = foo + bar; baz.foo(z, 3)',
    '_rec.y = _rec.y || undefined;\n_rec.z = _rec.foo + _rec.bar;\n_rec.baz.foo(_rec.z, 3);');

  testVarTfm('transformTopLevelVarAndFuncDeclsForCapturing',
    'var z = 3, y = 4; function foo() { var x = 5; }',
    'function foo() {\n  var x = 5;\n}\n_rec.foo = foo;\n_rec.z = 3;\n_rec.y = 4;\nfoo;');

  testVarTfm('transformTopLevelVarDeclsAndVarUsageForCapturing',
    'var z = 3, y = 42, obj = {a: "123", b: function b(n) { return 23 + n; }};\n' +
           'function foo(y) { var x = 5 + y.b(z); }\n',
    'function foo(y) {\n  var x = 5 + y.b(_rec.z);\n}\n' +
           '_rec.foo = foo;\n' +
           '_rec.z = 3;\n' +
           '_rec.y = 42;\n' +
           '_rec.obj = {\n' +
           '  a: "123",\n' +
           '  b: function b(n) {\n' +
           '    return 23 + n;\n' +
           '  }\n' +
           '};\n' +
           'foo;');

  it("don't capture excludes / globals", function () {
    let code = 'var x = 2; y = 3; z = 4; baz(x, y, z)';
    let expected = 'foo.x = 2;\nfoo.y = 3;\nz = 4;\nbaz(foo.x, foo.y, z);';
    let recorder = { name: 'foo', type: 'Identifier' };
    let result = stringify(rewriteToCaptureTopLevelVariables(
      parse(code), recorder, { exclude: ['baz', 'z'] }));
    expect(result).equals(expected);
  });

  it('keep var decls when requested', function () {
    let code = 'var x = 2, y = 3; baz(x, y)';
    let expected = 'foo.x = 2;\n' +
                 'var x = foo.x;\n' +
                 'foo.y = 3;\n' +
                 'var y = foo.y;\n' +
                 'foo.baz(foo.x, foo.y);';
    let recorder = { name: 'foo', type: 'Identifier' };
    let result = stringify(rewriteToCaptureTopLevelVariables(
      parse(code), recorder, { keepTopLevelVarDecls: true }));
    expect(result).equals(expected);
  });

  describe('try-catch', () => {
    testVarTfm("isn't transformed",
      'try { throw {} } catch (e) { e }\n',
      'try {\n  throw {};\n} catch (e) {\n  e;\n}');
  });

  describe('for statement', function () {
    testVarTfm("standard for won't get rewritten",
      'for (var i = 0; i < 5; i ++) { i; }',
      'for (var i = 0; i < 5; i++) {\n  i;\n}');

    testVarTfm("for-in won't get rewritten",
      'for (var x in {}) { x; }',
      'for (var x in {}) {\n  x;\n}');

    testVarTfm("for-of won't get rewritten",
      'for (let x of foo) { x; }',
      'for (let x of _rec.foo) {\n  x;\n}');

    testVarTfm('for-of wont get rewritten 2',
      'for (let [x, y] of foo) { x + y; }',
      'for (let [x, y] of _rec.foo) {\n  x + y;\n}');
  });

  describe('labels', function () {
    testVarTfm('ignores continue',
      'loop1:\nfor (var i = 0; i < 3; i++) continue loop1;',
      'loop1:\n  for (var i = 0; i < 3; i++)\n    continue loop1;');

    testVarTfm('ignores break',
      'loop1:\nfor (var i = 0; i < 3; i++) break loop1;',
      'loop1:\n  for (var i = 0; i < 3; i++)\n    break loop1;');
  });

  describe('es6', () => {
    describe('let + const', () => {
      testVarTfm('captures let as var (...for now)',
        'let x = 23, y = x + 1;',
        '_rec.x = 23;\n_rec.y = _rec.x + 1;');

      testVarTfm('captures const as var (...for now)',
        'const x = 23, y = x + 1;',
        '_rec.x = 23;\n_rec.y = _rec.x + 1;');
    });

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    describe('enhanced object literals', () => {
      testVarTfm('captures shorthand properties',
        'var x = 23, y = {x};',
        '_rec.x = 23;\n_rec.y = { x: _rec.x };');
    });

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    describe('default args', () => {
      testVarTfm('captures default arg',
        'function x(arg = foo) {}',
        'function x(arg = _rec.foo) {\n}\n_rec.x = x;\nx;');
    });

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    describe('class', () => {
      describe('with class-to-func transform', () => {
        testVarTfm('normal def',
          'class Foo {\n  a() {\n  return 23;\n  }\n}',
          classTemplateDecl('Foo', 'undefined', '[{\n' +
           '  key: "a",\n' +
           '  value: function Foo_a_() {\n' +
           '    return 23;\n' +
           '  }\n' +
           '}]', '[{\n' +
           '  key: Symbol.for("__LivelyClassName__"),\n' +
           '  get: function get() {\n' +
           '    return "Foo";\n' +
           '  }\n' +
           '}]', '_rec', 'undefined', 0, 38));

        testVarTfm('exported def',
          'export class Foo {}',
                   `export ${classTemplateDecl('Foo', 'undefined', 'undefined', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', 7, 19)}\n_rec.Foo = Foo;`);

        testVarTfm('exported default def',
          'export default class Foo {}',
                   `${classTemplateDecl('Foo', 'undefined', 'undefined', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', 15, 27)}\nexport default Foo;`);

        testVarTfm('does not capture class expr',
          'var bar = class Foo {}',
                   `_rec.bar = ${classTemplate('Foo', 'undefined', 'undefined', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', false, 10, 22)};`);

        testVarTfm('captures var that has same name as class expr',
          'var Foo = class Foo {}; new Foo();',
                   `_rec.Foo = ${classTemplate('Foo', 'undefined', 'undefined', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', false, 10, 22)};\nnew _rec.Foo();`);
      });

      describe('without class-to-func transform', () => {
        let opts = { classToFunction: null };

        testVarTfm('class def',
          opts,
          'class Foo {\n  a() {\n  return 23;\n  }\n}',
          'class Foo {\n  a() {\n    return 23;\n  }\n}\n_rec.Foo = Foo;');

        testVarTfm('exported def',
          opts,
          'export class Foo {}',
          'export class Foo {\n}\n_rec.Foo = Foo;');

        testVarTfm('exported default def',
          opts,
          'export default class Foo {}',
          'export default class Foo {\n}\n_rec.Foo = Foo;');

        testVarTfm('does not capture class expr',
          opts,
          'var bar = class Foo {}',
          '_rec.bar = class Foo {\n};');

        testVarTfm('captures var that has same name as class expr',
          opts,
          'var Foo = class Foo {}; new Foo();',
          '_rec.Foo = class Foo {\n};\nnew _rec.Foo();');
      });
    });

    describe('template strings', () => {
      testVarTfm('ref inside',
        '`${foo}`',
        '`${ _rec.foo }`;');
    });

    describe('computed prop in object literal', () => {
      testVarTfm('is dereferenced via var recorder',
        'var x = {[x]: y};',
        '_rec.x = { [_rec.x]: _rec.y };');
    });

    describe('patterns', () => {
      testVarTfm('captures destructured obj var',
        'var {x} = {x: 3};',
        'var destructured_1 = { x: 3 };\n' +
               '_rec.x = destructured_1.x;');

      testVarTfm('captures destructured obj var with init',
        'var {x = 4} = {x: 3};',
        'var destructured_1 = { x: 3 };\n' +
               '_rec.x = destructured_1.x === undefined ? 4 : destructured_1.x;');

      testVarTfm('captures destructured obj var with list',
        'var {x: [y]} = foo, z = 23;',
        'var destructured_1 = _rec.foo;\n' +
               'var destructured_1$x = destructured_1.x;\n' +
               '_rec.y = destructured_1$x[0];\n' +
               '_rec.z = 23;');

      testVarTfm('captures destructured var with alias',
        'var {x: y} = foo;',
        'var destructured_1 = _rec.foo;\n' +
               '_rec.y = destructured_1.x;');

      testVarTfm('captures destructured deep',
        'var {x: {x: {x}}, y: {y: x}} = foo;',
        'var destructured_1 = _rec.foo;\n' +
               'var destructured_1$x = destructured_1.x;\n' +
               'var destructured_1$x$x = destructured_1$x.x;\n' +
               '_rec.x = destructured_1$x$x.x;\n' +
               'var destructured_1$y = destructured_1.y;\n' +
               '_rec.x = destructured_1$y.y;');

      testVarTfm('captures destructured list with spread',
        'var [a, b, ...rest] = foo;',
        'var destructured_1 = _rec.foo;\n' +
               '_rec.a = destructured_1[0];\n' +
               '_rec.b = destructured_1[1];\n' +
               '_rec.rest = destructured_1.slice(2);');

      testVarTfm('captures destructured list with obj',
        'var [{b}] = foo;',
        'var destructured_1 = _rec.foo;\n' +
               'var destructured_1$0 = destructured_1[0];\n' +
               '_rec.b = destructured_1$0.b;');

      testVarTfm('captures destructured list nested',
        'var [[b]] = foo;',
        'var destructured_1 = _rec.foo;\n' +
               'var destructured_1$0 = destructured_1[0];\n' +
               '_rec.b = destructured_1$0[0];');

      testVarTfm('captures destructured list with obj with default',
        'var [a = 3] = foo;',
        'var destructured_1 = _rec.foo;\n' +
               '_rec.a = destructured_1[0] === undefined ? 3 : destructured_1[0];');

      testVarTfm('captures destructured list with obj with nested default',
        'var [[a = 3]] = foo;',
        'var destructured_1 = _rec.foo;\n' +
               'var destructured_1$0 = destructured_1[0];\n' +
               '_rec.a = destructured_1$0[0] === undefined ? 3 : destructured_1$0[0];');

      testVarTfm('captures destructured list with obj deep',
        'var [{b: {c: [a]}}] = foo;',
        'var destructured_1 = _rec.foo;\n' +
               'var destructured_1$0 = destructured_1[0];\n' +
               'var destructured_1$0$b = destructured_1$0.b;\n' +
               'var destructured_1$0$b$c = destructured_1$0$b.c;\n' +
               '_rec.a = destructured_1$0$b$c[0];');

      testVarTfm('captures rest prop',
        'var {a, b, ...rest} = foo;',
        'var destructured_1 = _rec.foo;\n' +
               '_rec.a = destructured_1.a;\n' +
               '_rec.b = destructured_1.b;\n' +
               'var rest = {};\n' +
               '_rec.rest = rest;\n' +
               '(function () {\n' +
               '  for (var __key in destructured_1) {\n' +
               '    if (__key === "a")\n' +
               '      continue;\n' +
               '    if (__key === "b")\n' +
               '      continue;\n' +
               '    rest[__key] = destructured_1[__key];\n' +
               '  }\n' +
               '}());');
    });

    describe('async', () => {
      testVarTfm('function',
        'async function foo() { return 23 }',
        'async function foo() {\n  return 23;\n}\n_rec.foo = foo;\nfoo;');

      testVarTfm('await',
        'var x = await foo();',
        '_rec.x = await _rec.foo();');

      testVarTfm('exported function',
        'export async function foo() { return 23; }',
        'async function foo() {\n  return 23;\n}\n_rec.foo = foo;\nexport {\n  foo\n};');

      testVarTfm('exported default',
        'export default async function foo() { return 23; }',
        'async function foo() {\n  return 23;\n}\n_rec.foo = foo;\nfoo;\nexport default foo;');

      // testVarTfm("export default async function foo() { return 23; }",
      //           "_rec.foo = foo;\nexport default async function foo() {\n    return 23;\n}");
    });

    describe('import', () => {
      testVarTfm('default',
        'import x from "./some-es6-module.js";',
        'import x from "./some-es6-module.js";\n_rec.x = x;');

      testVarTfm('*',
        'import * as name from "module-name";',
        'import * as name from "module-name";\n_rec.name = name;');

      testVarTfm('member',
        'import { member } from "module-name";',
        'import { member } from "module-name";\n_rec.member = member;');

      testVarTfm('member with alias',
        'import { member as alias } from "module-name";',
        'import { member as alias } from "module-name";\n_rec.alias = alias;');

      testVarTfm('multiple members',
        'import { member1 , member2 } from "module-name";',
        'import {\n  member1,\n  member2\n} from "module-name";\n_rec.member1 = member1;\n_rec.member2 = member2;');

      testVarTfm('multiple members with alias',
        'import { member1 , member2 as alias} from "module-name";',
        'import {\n  member1,\n  member2 as alias\n} from "module-name";\n_rec.member1 = member1;\n_rec.alias = alias;');

      testVarTfm('default and member',
        'import defaultMember, { member } from "module-name";',
        'import defaultMember, { member } from "module-name";\n_rec.defaultMember = defaultMember;\n_rec.member = member;');

      testVarTfm('default and *',
        'import defaultMember, * as name from "module-name";',
        'import defaultMember, * as name from "module-name";\n_rec.defaultMember = defaultMember;\n_rec.name = name;');

      testVarTfm('without binding',
        'import "module-name";',
        'import "module-name";');
    });

    describe('manual import', () => {
      let opts = { es6ExportFuncId: '_moduleExport', es6ImportFuncId: '_moduleImport' };

      testVarTfm('default',
        opts,
        'import x from "./some-es6-module.js";',
        '_rec.x = _moduleImport("./some-es6-module.js", "default");');

      testVarTfm('default, declarationWrapper',
        Object.assign({}, opts, { declarationWrapper: { name: '_define', type: 'Identifier' } }),
        'import x from "./some-es6-module.js";',
        '_rec.x = _define("x", "var", _moduleImport("./some-es6-module.js", "default"), _rec);');

      testVarTfm('*',
        opts,
        'import * as name from "module-name";',
        '_rec.name = _moduleImport("module-name");');

      testVarTfm('member',
        opts,
        'import { member } from "module-name";',
        '_rec.member = _moduleImport("module-name", "member");');

      testVarTfm('member with alias',
        opts,
        'import { member as alias } from "module-name";',
        '_rec.alias = _moduleImport("module-name", "member");');

      testVarTfm('multiple members',
        opts,
        'import { member1 , member2 } from "module-name";',
        '_rec.member1 = _moduleImport("module-name", "member1");\n_rec.member2 = _moduleImport("module-name", "member2");');

      testVarTfm('multiple members with alias',
        opts,
        'import { member1 , member2 as alias} from "module-name";',
        '_rec.member1 = _moduleImport("module-name", "member1");\n_rec.alias = _moduleImport("module-name", "member2");');

      testVarTfm('default and member',
        opts,
        'import defaultMember, { member } from "module-name";',
        '_rec.defaultMember = _moduleImport("module-name", "default");\n_rec.member = _moduleImport("module-name", "member");');

      testVarTfm('default and *',
        opts,
        'import defaultMember, * as name from "module-name";',
        '_rec.defaultMember = _moduleImport("module-name", "default");\n_rec.name = _moduleImport("module-name");');

      testVarTfm('without binding',
        opts,
        'import "module-name";',
        '_moduleImport("module-name");');
    });

    describe('export', () => {
      testVarTfm('default named',
        'var x = {x: 23}; export default x;',
        '_rec.x = { x: 23 };\nvar x = _rec.x;\nexport default x;');

      testVarTfm('does not rewrite exports but adds capturing statement',
        'var a = 23;\n' +
               'export var x = a + 1, y = x + 2;' +
               'export default function f() {}\n',
        'function f() {\n}\n' +
               '_rec.f = f;\n' +
               '_rec.a = 23;\n' +
               'export var x = _rec.a + 1;\n' +
               '_rec.x = x;\n' +
               'export var y = _rec.x + 2;\n' +
               '_rec.y = y;\nexport default f;');

      testVarTfm('var',
        'var x = 23; export { x };',
        '_rec.x = 23;\nvar x = _rec.x;\nexport {\n  x\n};');

      testVarTfm('aliased var',
        'var x = 23; export { x as y };',
        '_rec.x = 23;\nvar x = _rec.x;\nexport {\n  x as y\n};');

      testVarTfm('const',
        'export const x = 23;',
        'export const x = 23;\n_rec.x = x;');

      testVarTfm('function decl',
        'export function x() {};',
        'function x() {\n}\n_rec.x = x;\nexport {\n  x\n};\n;');

      testVarTfm('default function decl',
        'export default function x() {};',
        'function x() {\n}\n_rec.x = x;\nexport default x;\n;');

      testVarTfm('class decl',
        'export class Foo {};',
                 `export ${classTemplateDecl('Foo', 'undefined', 'undefined', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', 7, 19)}\n_rec.Foo = Foo;\n;`);

      testVarTfm('default class decl',
        'export default class Foo {};',
                 `${classTemplateDecl('Foo', 'undefined', 'undefined', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', 15, 27)}\nexport default Foo;\n;`);

      testVarTfm('class decl without classToFunction',
        { classToFunction: null },
        'export class Foo {};',
        'export class Foo {\n}\n_rec.Foo = Foo;\n;');

      testVarTfm('default class decl without classToFunction',
        { classToFunction: null },
        'export default class Foo {};',
        'export default class Foo {\n}\n_rec.Foo = Foo;\n;');

      testVarTfm('export default expression',
        'export default foo(1, 2, 3);',
        'export default _rec.foo(1, 2, 3);');

      testVarTfm('re-export * import',
        'import * as completions from "./lib/completions.js";\n' +
               'export { completions }',
        'import * as completions from "./lib/completions.js";\n' +
               '_rec.completions = completions;\n' +
               'export {\n  completions\n};');

      testVarTfm('re-export named',
        'export { name1, name2 } from "foo";',
        'export {\n  name1,\n  name2\n} from "foo";');

      testVarTfm('export from named',
        'export { name1 as foo1, name2 as bar2 } from "foo";',
        'export {\n  name1 as foo1,\n  name2 as bar2\n} from "foo";');

      testVarTfm('export bug 1',
        'foo();\nexport function a() {}\nexport function b() {}',
        'function a() {\n}\n_rec.a = a;\nfunction b() {\n}\n_rec.b = b;\n_rec.foo();\nexport {\n  a\n};\nexport {\n  b\n};');

      testVarTfm('export bug 2',
        'export { a } from "./package-commands.js";\n' +
               'export function b() {}\n' +
               'export function c() {}\n',
        'function b() {\n}\n' +
               '_rec.b = b;\n' +
               'function c() {\n}\n' +
               '_rec.c = c;\n' +
               'export {\n  a\n} from "./package-commands.js";\n' +
               'export {\n  b\n};\n' +
               'export {\n  c\n};');
    });

    describe('export obj', () => {
      let opts = {
        es6ExportFuncId: '_moduleExport',
        es6ImportFuncId: '_moduleImport',
        classToFunction: {
          classHolder: nodes.id('_rec'),
          functionNode: nodes.id('_createOrExtendClass'),
          transform: classToFunctionTransform
        }
      };

      testVarTfm('func decl',
        opts,
        'export function foo(a) { return a + 3; };',
        'function foo(a) {\n  return a + 3;\n}\n_rec.foo = foo;\nfoo;\n_moduleExport("foo", _rec.foo);\n;');

      testVarTfm('default anonym func decl',
        opts,
        'export default function () {};',
        '_moduleExport("default", function () {\n});\n;');

      testVarTfm('default func* decl',
        opts,
        'export default function* () {};',
        '_moduleExport("default", function* () {\n});\n;');

      testVarTfm('default function',
        opts,
        'export default function foo() {};',
        'function foo() {\n}\n_rec.foo = foo;\nfoo;\n_moduleExport("default", _rec.foo);\n;');

      testVarTfm('default async func decl',
        opts,
        'export default async function foo() {};',
        'async function foo() {\n}\n_rec.foo = foo;\nfoo;\n_moduleExport("default", _rec.foo);\n;');

      testVarTfm('default class decl',
        opts,
        'export default class Foo {a() { return 23; }};',
        classTemplateDecl('Foo', 'undefined', '[{\n' +
                                                    '  key: "a",\n' +
                                                    '  value: function Foo_a_() {\n' +
                                                    '    return 23;\n' +
                                                    '  }\n' +
                                                    '}]', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', 15, 45) +
              '\n_moduleExport("default", _rec.Foo);\n;');

      testVarTfm('class decl, declarationWrapper',
        {
          ...opts,
          classToFunction: {
            classHolder: nodes.id('_rec'),
            functionNode: nodes.id('_createOrExtendClass'),
            declarationWrapper: { name: '_define', type: 'Identifier' },
            transform: classToFunctionTransform
          }
        },
        'export class Foo {a() { return 23; }};',
        'var Foo = _define("Foo", "class", ' +
                classTemplate('Foo', 'undefined', '[{\n' +
                                                  '  key: "a",\n' +
                                                  '  value: function Foo_a_() {\n' +
                                                  '    return 23;\n' +
                                                  '  }\n' +
                                                  '}]', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', 'undefined', 7, 37) +
                ', _rec, {\n' +
                '  start: 7,\n' +
                '  end: 37\n' +
                '});\n' +
                '_moduleExport("Foo", _rec.Foo);\n;'

      );

      testVarTfm('named',
        opts,
        'let name1, name2; export { name1, name2 };',
        '_rec.name1 = _rec.name1 || undefined;\n_rec.name2 = _rec.name2 || undefined;\n_moduleExport("name1", _rec.name1);\n_moduleExport("name2", _rec.name2);');

      testVarTfm('var decl, double',
        opts,
        'export var x = 34, y = x + 3;',
        'var x = _rec.x = 34;;\nvar y = _rec.y = _rec.x + 3;;\n_moduleExport("x", _rec.x);\n_moduleExport("y", _rec.y);');

      testVarTfm('let decl',
        opts,
        'export let x = 34;',
        'let x = _rec.x = 34;;\n_moduleExport("x", _rec.x);');

      testVarTfm('let decl, declarationWrapper',
        Object.assign({}, opts, { declarationWrapper: { name: '_define', type: 'Identifier' } }),
        'export let x = 34;',
        'let x = _rec.x = _rec._define("x", "let", x = 34, _rec);;\n_moduleExport("x", _rec.x);');

      testVarTfm('name aliased',
        opts,
        'let name1; export { name1 as default };',
        '_rec.name1 = _rec.name1 || undefined;\n_moduleExport("default", _rec.name1);');

      testVarTfm('* from',
        opts,
        'export * from "foo";',
        'for (var _moduleExport__iterator__ in _moduleImport("foo"))\n' +
              '  _moduleExport(_moduleExport__iterator__, _moduleImport("foo", _moduleExport__iterator__));');

      testVarTfm('named from',
        opts,
        'export { name1, name2 } from "foo"',
        '_moduleExport("name1", _moduleImport("foo", "name1"));\n_moduleExport("name2", _moduleImport("foo", "name2"));');

      testVarTfm('named from aliased',
        opts,
        'export { name1 as foo1, name2 as bar2 } from "foo";',
        '_moduleExport("foo1", _moduleImport("foo", "name1"));\n_moduleExport("bar2", _moduleImport("foo", "name2"));');
    });
  });
});

describe('declarations', () => {
  function rewriteWithWrapper (code, opts = {
    classToFunction: {
      classHolder: nodes.id('_rec'),
      functionNode: nodes.id('_createOrExtendClass'),
      declarationWrapper: { name: '_define', type: 'Identifier' },
      transform: classToFunctionTransform
    }
  }) {
    return stringify(
      rewriteToCaptureTopLevelVariables(
        parse(code), { name: '_rec', type: 'Identifier' },
        { declarationWrapper: { name: '_define', type: 'Identifier' }, ...opts }));
  }

  it('wraps literals that are exported as defaults', () => {
    expect(rewriteWithWrapper('export default 32')).equals('_rec.$32 = 32;\nvar $32 = _rec.$32;\nexport default $32;');
  });

  it('can be wrapped in define call', () => {
    expect(rewriteWithWrapper('var x = 23;')).equals('_rec.x = _define("x", "var", 23, _rec);');
  });

  it('assignments are wrapped in define call', () => {
    expect(rewriteWithWrapper('x = 23;')).equals('_rec.x = _define("x", "assignment", 23, _rec);');
  });

  it('define call works for exports', () => {
    expect(rewriteWithWrapper('export var x = 23;'))
      .equals('export var x = 23;\n_rec.x = _define("x", "assignment", x, _rec);');

    expect(rewriteWithWrapper('export function foo() {};'))
      .equals('function foo() {\n}\n_rec.foo = _define(\"foo\", \"function\", foo, _rec);\nexport {\n  foo\n};\n;');

    expect(rewriteWithWrapper('export class Foo {}')).equals(`export var Foo = _define(\"Foo\", \"class\", ${classTemplate('Foo', 'undefined', 'undefined', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', 'undefined', 7, 19)}, _rec, {\n  start: 7,\n  end: 19\n});\n_rec.Foo = Foo;`);

    expect(rewriteWithWrapper('var x, y; x = 23; export { x, y };')).equals('_rec.x = _define("x", "var", _rec.x || undefined, _rec);\n_rec.y = _define("y", "var", _rec.y || undefined, _rec);\n_rec.x = _define("x", "assignment", 23, _rec);\nvar x = _rec.x;\nvar y = _rec.y;\nexport {\n  x,\n  y\n};');
  });

  it('wraps class decls', () => {
    expect(rewriteWithWrapper('class Foo {}')).equals(`var Foo = _define(\"Foo\", \"class\", ${classTemplate('Foo', 'undefined', 'undefined', '[{\n' +
                                                       '  key: Symbol.for("__LivelyClassName__"),\n' +
                                                       '  get: function get() {\n' +
                                                       '    return "Foo";\n' +
                                                       '  }\n' +
                                                       '}]', '_rec', 'undefined', 'undefined', 0, 12)}, _rec, {\n  start: 0,\n  end: 12\n});`);
  });

  it('wraps function decls', () => {
    expect(rewriteWithWrapper('function bar() {}'))
      .equals('function bar() {\n}\n_rec.bar = _define("bar", "function", bar, _rec);\nbar;');
  });

  it('wraps destructuring', () => {
    expect(rewriteWithWrapper('var [{x}, y] = foo')).equals(
`var destructured_1 = _rec.foo;
var destructured_1$0 = destructured_1[0];
_rec.x = _define(\"x\", \"var\", destructured_1$0.x, _rec);
_rec.y = _define(\"y\", \"var\", destructured_1[1], _rec);`);
  });

  it('evalId and sourceAccessorName', () => {
    expect(
      rewriteWithWrapper('function foo() {}', { evalId: 1, sourceAccessorName: '__source' }))
      .equals('function foo() {\n' +
              '}\n' +
              '_rec.foo = _define(\"foo\", \"function\", foo, _rec, {\n' +
              '  evalId: 1,\n' +
              '  moduleSource: __source\n' +
              '});\n' +
              'foo;');
  });
});

describe('System.register', () => {
  describe('setters', () => {
    let input =
`System.register(["foo:a.js", "http://zork/b.js"], function (_export, _context) {
"use strict";
var x, y, z, _rec;
return {
  setters: [
    function(foo_a_js) { x = foo_a_js.x },
    function (_zork_b_js) { y = _zork_b_js.default; z = _zork_b_js.z; }],
  execute: function () {
    _rec = System.get("@lively-env").moduleEnv("c.js").recorder;
    _rec.x = 23;
  }
};
});`;

    it('captures setters of registered module', () => {
      expect(stringify(
        rewriteToRegisterModuleToCaptureSetters(
          parse(input),
          { name: '_rec', type: 'Identifier' },
          { exclude: ['z'] })))
        .equals(`System.register([
  \"foo:a.js\",
  \"http://zork/b.js\"
], function (_export, _context) {
  \"use strict\";
  var x, y, z, _rec;
  _rec = System.get(\"@lively-env\").moduleEnv(\"c.js\").recorder;
  return {
    setters: [
      function (foo_a_js = {}) {
        _rec.x = x = foo_a_js.x;
      },
      function (_zork_b_js = {}) {
        _rec.y = y = _zork_b_js.default;
        z = _zork_b_js.z;
      }
    ],
    execute: function () {
      _rec.x = 23;
    }
  };
});`);
    });

    it('captures setters of registered module with declarationWrapper', () => {
      expect(stringify(
        rewriteToRegisterModuleToCaptureSetters(
          parse(input),
          { name: '_rec', type: 'Identifier' },
          { declarationWrapper: { name: '_define', type: 'Identifier' } })))
        .equals(`System.register([
  \"foo:a.js\",
  \"http://zork/b.js\"
], function (_export, _context) {
  \"use strict\";
  var x, y, z, _rec;
  _rec = System.get(\"@lively-env\").moduleEnv(\"c.js\").recorder;
  return {
    setters: [
      function (foo_a_js = {}) {
        _rec.x = _define(\"x\", \"var\", x = foo_a_js.x, _rec);
      },
      function (_zork_b_js = {}) {
        _rec.y = _define(\"y\", \"var\", y = _zork_b_js.default, _rec);
        _rec.z = _define(\"z\", \"var\", z = _zork_b_js.z, _rec);
      }
    ],
    execute: function () {
      _rec.x = 23;
    }
  };
});`);
    });
  });
});
