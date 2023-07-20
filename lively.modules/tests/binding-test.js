/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { removeDir, createFiles } from './helpers.js';

import { getSystem } from '../src/system.js';
import module from '../src/module.js';
import { registerPackage } from '../src/packages/package.js';

let dir = System.decanonicalize('lively.modules/tests/');
let testProjectDir = dir + 'test-dir-imports-exports/';
let testProjectSpec = {
  'package.json': '{"name": "imports-exports-test-project", "main": "file2.js"}',
  'file1.js': 'var x = 1; var y = x;',

  'file2.js': 'export var x = 1;',
  'file3.js': "import { x } from './file2.js'; var y = x;",
  'file4.js': "import { x as xx } from './file2.js'; var y = xx;",

  'file5.js': "export { x } from './file2.js';",
  'file6.js': "import { x } from './file5.js'; var y = x;",

  'file7.js': "export { x as y } from './file2.js';",
  'file8.js': "import { y } from './file7.js'; var z = y;",

  'file9.js': 'var x = 1; export { x };',
  'file10.js': "import { x } from './file9.js'; var y = x;",

  'file11.js': 'export default 23;',
  'file12.js': "import x from './file11.js'; var y = x;",

  'file13.js': 'var x = 1; export default x;',
  'file14.js': "import y from './file13.js'; var z = y;",

  'file15.js': 'export default async function foo() {}',
  'file16.js': "import f from './file15.js'; f();",

  'file17.js': 'export function bar() {}',
  'file18.js': "import { bar } from './file17.js'; bar();",

  'file19.js': "import { x } from './file2.js'; export { x };",
  'file20.js': "import { x } from './file19.js'; var y = x;",

  'file21.js': "import { x } from 'imports-exports-test-project'; var y = x;",

  'file22.js': "import * as m from './file2.js'; var y = m.x;",
  'file23.js': "export * from './file2.js';",
  'file24.js': "import { x } from './file23.js'; var y = x;"
};

describe('binding', () => {
  let S, modules;
  beforeEach(async () => {
    S = getSystem('import-export-test');
    modules = Object.keys(testProjectSpec)
      .map(k => module(S, testProjectDir + k));
    await createFiles(testProjectDir, testProjectSpec);
  });
  afterEach(() => removeDir(testProjectDir));

  it('within module', async () => {
    const decls = await modules[1].bindingPathForRefAt(19);
    expect(decls).to.containSubset([{
      decl: {
        start: 4,
        end: 9,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file1.js' },
      id: { start: 4, end: 5, name: 'x' }
    }]);
  });

  it('to named declaration', async () => {
    const decls = await modules[3].bindingPathForRefAt(41);
    expect(decls).to.containSubset([{
      declModule: { id: testProjectDir + 'file3.js' },
      decl: {
        start: 0,
        end: 31,
        type: 'ImportDeclaration'
      },
      id: { start: 9, end: 10, name: 'x' }
    },
    {
      declModule: { id: testProjectDir + 'file2.js' },
      decl: {
        start: 11,
        end: 16,
        type: 'VariableDeclarator'
      },
      id: { start: 11, end: 12, name: 'x' }
    }
    ]);
  });

  it('to named declaration as', async () => {
    const decls = await modules[4].bindingPathForRefAt(47);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 37,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file4.js' },
      id: { start: 14, end: 16, name: 'xx' }
    }, {
      decl: {
        start: 11,
        end: 16,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file2.js' },
      id: { start: 11, end: 12, name: 'x' }
    }]);
  });

  it('to re-exported named declaration', async () => {
    const decls = await modules[6].bindingPathForRefAt(41);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 31,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file6.js' },
      id: { start: 9, end: 10, name: 'x' }
    },
    {
      decl: {
        start: 9,
        end: 10,
        type: 'ExportSpecifier'
      },
      declModule: { id: testProjectDir + 'file5.js' },
      id: { start: 9, end: 10, name: 'x' }
    },
    {
      decl: {
        start: 11,
        end: 16,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file2.js' },
      id: { start: 11, end: 12, name: 'x' }
    }
    ]);
  });

  it('to re-export named declaration as', async () => {
    const decls = await modules[8].bindingPathForRefAt(41);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 31,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file8.js' },
      id: { start: 9, end: 10, name: 'y' }
    }, {
      decl: {
        start: 9,
        end: 15,
        type: 'ExportSpecifier'
      },
      declModule: { id: testProjectDir + 'file7.js' },
      id: { start: 14, end: 15, name: 'y' }
    }, {
      decl: {
        start: 11,
        end: 16,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file2.js' },
      id: { start: 11, end: 12, name: 'x' }
    }]);
  });

  it('indirectly', async () => {
    const decls = await modules[20].bindingPathForRefAt(42);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 32,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file20.js' },
      id: { start: 9, end: 10, name: 'x' }
    }, {
      decl: {
        start: 0,
        end: 31,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file19.js' },
      id: { start: 9, end: 10, name: 'x' }
    }, {
      decl: {
        start: 11,
        end: 16,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file2.js' },
      id: { start: 11, end: 12, name: 'x' }
    }]);
  });

  it('to named id', async () => {
    const decls = await modules[10].bindingPathForRefAt(41);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 31,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file10.js' },
      id: { start: 9, end: 10, name: 'x' }
    }, {
      decl: {
        start: 4,
        end: 9,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file9.js' },
      id: { start: 4, end: 5, name: 'x' }
    }]);
  });

  it('to default expr', async () => {
    const decls = await modules[12].bindingPathForRefAt(38);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 28,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file12.js' },
      id: { start: 7, end: 8, name: 'x' }
    }, {
      decl: {
        start: 15,
        end: 17,
        type: 'Literal'
      },
      declModule: { id: testProjectDir + 'file11.js' },
      id: { start: 15, end: 17, value: 23 }
    }]);
  });

  it('to default id', async () => {
    const decls = await modules[14].bindingPathForRefAt(38);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 28,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file14.js' },
      id: { start: 7, end: 8, name: 'y' }
    }, {
      decl: {
        start: 4,
        end: 9,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file13.js' },
      id: { start: 4, end: 5, name: 'x' }
    }]);
  });

  it('to default function', async () => {
    const decls = await modules[16].bindingPathForRefAt(30);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 28,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file16.js' },
      id: { start: 7, end: 8, name: 'f' }
    }, {
      decl: {
        start: 15,
        end: 38,
        type: 'FunctionDeclaration'
      },
      declModule: { id: testProjectDir + 'file15.js' },
      id: { start: 30, end: 33, name: 'foo' }
    }]);
  });

  it('to named function', async () => {
    const decls = await modules[18].bindingPathForRefAt(36);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 34,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file18.js' },
      id: { start: 9, end: 12, name: 'bar' }
    }, {
      decl: {
        start: 7,
        end: 24,
        type: 'FunctionDeclaration'
      },
      declModule: { id: testProjectDir + 'file17.js' },
      id: { start: 16, end: 19, name: 'bar' }
    }]);
  });

  it('to named declaration from package', async () => {
    await registerPackage(S, testProjectDir);
    const decls = await modules[21].bindingPathForRefAt(59);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 49,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file21.js' },
      id: { start: 9, end: 10, name: 'x' }
    }, {
      decl: {
        start: 11,
        end: 16,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file2.js' },
      id: { start: 11, end: 12, name: 'x' }
    }]);
  });

  it('via namespace import', async () => {
    await registerPackage(S, testProjectDir);
    const decls = await modules[22].bindingPathForRefAt(43);
    expect(decls).to.containSubset([{
      decl: {
        start: 0,
        end: 32,
        type: 'ImportDeclaration'
      },
      declModule: { id: testProjectDir + 'file22.js' },
      id: { start: 12, end: 13, name: 'm' }
    }, {
      decl: {
        start: 11,
        end: 16,
        type: 'VariableDeclarator'
      },
      declModule: { id: testProjectDir + 'file2.js' },
      id: { start: 11, end: 12, name: 'x' }
    }]);
  });
});
