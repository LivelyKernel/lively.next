/*global declare, it, describe, beforeEach, afterEach*/
import { expect } from "mocha-es6";

import { ImportInjector, cleanupUnusedImports, interactivelyInjectImportIntoText } from "lively.morphic/ide/js/import-helper.js";

import { Text } from 'lively.morphic';
import { JavaScriptEditorPlugin } from "lively.morphic/ide/js/editor-plugin.js";

// that.doitContext = new ImportInjector(S, m, src, importData)

describe("import helper - cleanup unused imports", () => {

  it("runs command on text", async () => {
    var ed = new Text({plugins: [new JavaScriptEditorPlugin()]}),
        dummyWorld = {confirm: () => true};

    ed.world = () => dummyWorld;
    ed.textString = `import { Text } from "lively.morphic";\nfooo;`;
    
    await cleanupUnusedImports(ed);
    expect(ed.textString).equals(`\nfooo;`, "1");

    ed.textString = `import Text, { Text, Morph } from "lively.morphic";\nMorph;`;
    await cleanupUnusedImports(ed);
    expect(ed.textString).equals(`import { Morph } from 'lively.morphic';\nMorph;`, "1");
  });

});


describe("import helper - injection command", () => {

  it("runs command on text and inserts code + imports object", async () => {
    // end-to-end test
    var ed = new Text({plugins: [new JavaScriptEditorPlugin()]}),
        targetModule = `lively://import-helper-test/${Date.now()}`,
        dummyWorld = {
          filterableListPrompt: (_, items) => {
            return {selected: [items.find(ea => ea.string.includes("class Morph from")).value]}
          }
        }

    ed.plugins[0].evalEnvironment.targetModule  = targetModule;
    ed.textString = `import { Text } from "lively.morphic";`;
    ed.world = () => dummyWorld;
    
    await interactivelyInjectImportIntoText(ed);

    expect(ed.textString)
      .equals(`import { Text, Morph } from "lively.morphic";`, "transformed code");
    expect(ed.selection.text).stringEquals(", Morph", "selection");
    expect((await ed.plugins[0].runEval("Morph")).value.name)
      .equals("Morph", "import not evaluated");
  });

});


describe("import helper - import injector", () => {

  var S = System
  var importData;
  var m, src, newSource, generated, from, to, standaloneImport;

  beforeEach(() => {
    importData = {
      exported: "xxx",
      moduleId: "http://foo/src/b.js",
      packageName: "test-package",
      packageURL: "http://foo/",
      pathInPackage: "src/b.js"
    }
  });

  it("injects new import at top", () => {
    m = "http://foo/a.js";
    src = "class Foo {}";
    ({generated, newSource, from, to, standaloneImport} = ImportInjector.run(S, m, src, importData));
    expect(generated).equals(`import { xxx } from "./src/b.js";\n`);
    expect(newSource).equals(`import { xxx } from "./src/b.js";\nclass Foo {}`);
    expect(from).equals(0);
    expect(to).equals(34);
    expect(standaloneImport).equals(`import { xxx } from "./src/b.js";`);
  });

  it("leaves source with existing imported as is", () => {
    src = `class Foo {}\nimport {\n  xxx\n} from "./src/b.js";`;
    ({newSource} = ImportInjector.run(S, m, src, importData));
    expect(newSource).equals(src);
  });

  it("modifies import from same module", () => {
    src = `class Foo {}\nimport {\n  yyy\n} from "./src/b.js";`;
    ({newSource, from, to} = ImportInjector.run(S, m, src, importData));
    expect(newSource).equals(`class Foo {}\nimport {\n  yyy, xxx\n} from "./src/b.js";`);
    expect(from).equals(27);
    expect(to).equals(27+5);
  });

  it("modifies default import from same module 1", () => {
    src = `class Foo {}\nimport yyy from "./src/b.js";`;
    ({newSource, from, to} = ImportInjector.run(S, m, src, importData));
    expect(newSource).equals(`class Foo {}\nimport yyy, { xxx } from "./src/b.js";`);
    expect(from).equals(23);
    expect(to).equals(23+9);
  });

  it("modifies default import from same module 2", () => {
    src = `class Foo {}\nimport yyy, { zzz } from "./src/b.js";`;
    ({newSource, from, to, standaloneImport} = ImportInjector.run(S, m, src, importData));
    expect(newSource).equals(`class Foo {}\nimport yyy, { zzz, xxx } from "./src/b.js";`);
    expect(standaloneImport).equals(`import { xxx } from "./src/b.js";`);
  });

  it("adds new import below existing from same module", () => {
    src = `class Foo {}\nimport yyy from "./src/b.js";`;
    ({newSource} = ImportInjector.run(S, m, src, importData));
    expect(newSource).equals(`class Foo {}\nimport yyy, { xxx } from "./src/b.js";`);
  });

  describe("default imports", () => {

    beforeEach(() => {
      importData = {
        ...importData,
        exported: "default",
        local: "xxx",
      }
    });

    it("injects new import at top", () => {
      m = "http://foo/a.js";
      src = "class Foo {}";
      ({newSource} = ImportInjector.run(S, m, src, importData));
      expect(newSource).equals(`import xxx from "./src/b.js";\nclass Foo {}`);
    });

    it("leaves source with existing imported as is", () => {
      src = `class Foo {}\nimport xxx\n from "./src/b.js";`;
      ({newSource, standaloneImport} = ImportInjector.run(S, m, src, importData));
      expect(newSource).equals(src);
      expect(standaloneImport).equals(`import xxx from "./src/b.js";`)
    });

    it("leaves source with existing imported as is 2", () => {
      src = `class Foo {}\nimport xxx, { yyy } from "./src/b.js";`;
      ({newSource, to, from} = ImportInjector.run(S, m, src, importData));
      expect(newSource).equals(src);
      expect(from).equals(13);
      expect(to).equals(51);
    });

    it("adds new import to existing from same module", () => {
      src = `class Foo {}\nimport { yyy } from "./src/b.js";`;
      ({newSource, to, from, generated, standaloneImport} = ImportInjector.run(S, m, src, importData));
      expect(generated).equals(` xxx,`);
      expect(newSource).equals(`class Foo {}\nimport xxx, { yyy } from "./src/b.js";`);
      expect(from).equals(19);
      expect(to).equals(19+5);
      expect(standaloneImport).equals(`import xxx from "./src/b.js";`)
    });

  });

  describe("from module name", () => {

    beforeEach(() => {
      importData = {
        ...importData,
        moduleId: "http://bar/src/b.js",
        packageName: "test-package-2",
        packageURL: "http://bar/",
      }
    });

    it("resolves to package name", () => {
      m = "http://foo/a.js";
      src = "class Foo {}";
      ({newSource} = ImportInjector.run(S, m, src, importData));
      expect(newSource).equals(`import { xxx } from "test-package-2/src/b.js";\nclass Foo {}`);
    });

    it("deals with 'no group'", () => {
      importData.packageName = "no group"
      m = "http://foo/a.js";
      src = "class Foo {}";
      ({newSource} = ImportInjector.run(S, m, src, importData));
      expect(newSource).equals(`import { xxx } from "http://bar/src/b.js";\nclass Foo {}`);
    });

  });
});
