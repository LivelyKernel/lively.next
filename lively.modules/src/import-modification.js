import { arr, Path } from 'lively.lang';
import { fuzzyParse, query, stringify } from 'lively.ast';
import { resource } from 'lively.resources';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// injecting the import into a module
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/*

The injector doesn't actually modify modules (or evaluate import statements)
but only generates the code to do so.

// The import we want to add
var importData = {
  exported: "xxx",
  moduleId: "http://foo/src/b.js",
  packageName: "test-package",
  packageURL: "http://foo/",
  pathInPackage: "src/b.js"
}

// The module and source we want to modify
var m = "http://foo/a.js", src = "import { yyy } from './src/b.js'; class Foo {}";

// run
var {generated, newSource, from, to, standaloneImport, importedVarName} =
  ImportInjector.run(System, m, {name: "test-package"}, src, importData, "zzz");

generated // => ", xxx"
from, to // => 12, 17 , indexes to inject generated
newSource // => "import { yyy, xxx } from './src/b.js'; class Foo {}"
standaloneImport // => import { xxx } from "./src/b.js"; can be used for evaluation
importedVarName // => "xxx"

*/

export class ImportInjector {
  static run (
    System,
    intoModuleId, intoPackage, intoModuleSource,
    importData, alias = undefined,
    optAst = undefined
  ) {
    return new this(System, intoModuleId, intoPackage, intoModuleSource, importData, alias, optAst).run();
  }

  constructor (System, intoModuleId, intoPackage, intoModuleSource, importData, alias, optAst) {
    this.System = System;
    this.intoModuleId = intoModuleId;
    this.intoPackage = intoPackage;
    this.intoModuleSource = intoModuleSource;
    this.fromModuleId = importData.moduleId;
    this.importData = importData;
    this.alias = alias;
    this.parsed = optAst || fuzzyParse(intoModuleSource);
  }

  run () {
    const newImport = this.generateImportStatement();
    const { standaloneImport, importedVarName } = newImport;
    let { imports, importsOfFromModule, importsOfVar } = this.existingImportsOfFromModule();

    importsOfFromModule = this.importsToBeReused(importsOfFromModule, importsOfVar, newImport);

    // already imported?
    if (importsOfVar.length) {
      return {
        status: 'not modified',
        newSource: this.intoModuleSource,
        generated: '',
        importedVarName: '',
        standaloneImport,
        from: importsOfVar[0].start,
        to: importsOfVar[0].end
      };
    }

    // modify an existing import?
    if (importsOfFromModule.length) {
      const modified = this.modifyExistingImport(importsOfFromModule, standaloneImport);
      if (modified) return modified;
    }

    // prepend new import
    const lastImport = arr.last(imports);
    const insertPos = lastImport ? lastImport.end : 0;
    return this.insertNewImport(importsOfFromModule, standaloneImport, importedVarName, insertPos);
  }

  importsToBeReused (importsOfFromModule, importsOfVar, newImport) {
    if (newImport.isDefault) {
      importsOfFromModule = importsOfFromModule.filter(ea =>
        !ea.specifiers.some(spec => spec.type === 'ImportDefaultSpecifier'));
    }
    return importsOfFromModule;
  }

  generateImportStatement () {
    const { intoModuleId, fromModuleId, importData, intoPackage, alias } = this;
    const isDefault = importData.exported === 'default';
    const varName = alias || (isDefault ? importData.local : importData.exported);
    const aliased = !isDefault && importData.exported !== varName;
    const intoPackageName = intoPackage && intoPackage.name;
    let exportPath = fromModuleId;

    const { packageName, pathInPackage, isMain } = importData;
    if (isMain) exportPath = packageName;
    else if (intoPackageName === packageName) {
      try {
        exportPath = resource(fromModuleId).relativePathFrom(resource(intoModuleId));
        if (!exportPath.startsWith('.')) exportPath = './' + exportPath;
      } catch (e) {
        if (packageName && packageName !== 'no group' && pathInPackage) { exportPath = packageName + '/' + pathInPackage; }
      }
    } else {
      if (packageName && packageName !== 'no group' && pathInPackage) { exportPath = packageName + '/' + pathInPackage; }
    }

    return {
      isDefault,
      standaloneImport: isDefault
        ? `import ${varName} from "${exportPath}";`
        : `import { ${importData.exported}${aliased ? ` as ${varName}` : ''} } from "${exportPath}";`,
      importedVarName: varName
    };
  }

  existingImportsOfFromModule () {
    let { System, fromModuleId, intoModuleId, importData: { exported, local }, parsed, alias } = this;
    const isDefault = exported === 'default';
    const imports = parsed.body.filter(({ type }) => type === 'ImportDeclaration');
    const varName = isDefault ? (alias || local) : (alias || exported);
    fromModuleId = System.decanonicalize(fromModuleId, intoModuleId);

    const importsOfFromModule = imports.filter(ea => {
      if (!ea.source || typeof ea.source.value !== 'string') return null;
      const sourceId = System.decanonicalize(ea.source.value, intoModuleId);
      return fromModuleId === sourceId;
    });

    const importsOfImportedVar = importsOfFromModule.filter(ea =>
      (ea.specifiers || []).some(iSpec =>
        isDefault
          ? iSpec.type === 'ImportDefaultSpecifier' && iSpec.local.name === varName
          : Path('imported.name').get(iSpec) === exported &&
         Path('local.name').get(iSpec) === varName));

    return {
      imports,
      importsOfFromModule,
      importsOfVar: importsOfImportedVar
    };
  }

  modifyExistingImport (imports, standaloneImport) {
    const specifiers = imports.flatMap(({ specifiers }) => specifiers || []);
    if (!specifiers.length) return null;

    const [[defaultSpecifier], [normalSpecifier]] =
      arr.partition(specifiers, ({ type }) => type === 'ImportDefaultSpecifier');

    // defaultSpecifier = arr.partition(imports, ({type}) => type === "ImportDefaultSpecifier")[0][0]
    // normalSpecifier = arr.partition(imports, ({type}) => type === "ImportDefaultSpecifier")[1][0]

    const { alias, intoModuleSource: src, importData: { exported: impName, local: defaultImpName } } = this;
    const isDefault = impName === 'default';

    // Since this method is only called with imports this should never happen:
    if (isDefault) console.assert(!!normalSpecifier, 'no ImportSpecifier found');
    else console.assert(normalSpecifier || defaultSpecifier, 'at least one kine of specifier is expected');
    let generated, pos;
    if (isDefault) {
      pos = src.slice(0, normalSpecifier.start).lastIndexOf('{') - 1;
      if (pos < 0) return null;

      generated = (alias || defaultImpName) + ',';
      const pre = src.slice(0, pos);
      const post = src.slice(pos);

      if (!pre.endsWith(' ') || !pre.endsWith('\n')) generated = ' ' + generated;
      if (!post.startsWith(' ')) generated += ' ';

      return {
        status: 'modified',
        newSource: `${pre}${generated}${post}`,
        generated,
        standaloneImport,
        importedVarName: alias || defaultImpName,
        from: pos,
        to: pos + generated.length
      };
    }

    pos = normalSpecifier ? normalSpecifier.end : defaultSpecifier.end;
    const aliased = alias && alias !== impName;
    const namePart = aliased ? `${impName} as ${alias}` : impName;
    generated = normalSpecifier ? `, ${namePart}` : `, { ${namePart} }`;

    return {
      status: 'modified',
      newSource: `${src.slice(0, pos)}${generated}${src.slice(pos)}`,
      generated,
      standaloneImport,
      importedVarName: aliased ? alias : impName,
      from: pos,
      to: pos + generated.length
    };
  }

  insertNewImport (importsOfFromModule, standaloneImport, importedVarName, insertPos = 0) {
    if (importsOfFromModule && importsOfFromModule.length) { insertPos = arr.last(importsOfFromModule).end; }

    const src = this.intoModuleSource;
    const pre = src.slice(0, insertPos);
    const post = src.slice(insertPos);
    let generated = standaloneImport;

    if (pre.length && !pre.endsWith('\n')) generated = '\n' + generated;
    if (post.length && !post.startsWith('\n')) generated += '\n';

    return {
      status: 'modified',
      newSource: pre + generated + post,
      generated,
      standaloneImport,
      importedVarName,
      from: insertPos,
      to: insertPos + generated.length
    };
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// removing imports from a module
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/*

var src = "import { xxx, yyy } from './src/b.js'; class Foo { m() { return yyy + 1 } }";
var unusedImports = ImportRemover.findUnusedImports(src);
unusedImports // => [{local: "xxx", importStmt: {...}}]

var {changes, removedImports, source} = ImportRemover.removeImports(src, unusedImports)
changes // => [{start: 0, end: 38, replacement: "import { yyy } from './src/b.js';"}]
removedImports // => [{from: "./src/b.js", local: "xxx"}]
source // => "import { yyy } from './src/b.js'; class Foo { m() { return yyy + 1 } }"

// or short:
ImportRemover.removeUnusedImports(src)

*/

export class GlobalInjector {
  static getGlobals (src, optAst) {
    const parsed = optAst || fuzzyParse(src, { withComments: true });
    const globalComment = parsed.comments
      ? parsed.comments.find(c => c.isBlock && c.text.match(/^\s*global/))
      : null;
    const declaredGlobals = globalComment
      ? globalComment.text.replace(/^\s*global\s*/, '')
        .split(',').map(ea => ea.trim()).filter(Boolean)
      : [];
    const knownGlobals = [...declaredGlobals, ...query.knownGlobals];
    const undefinedVariables = query.findGlobalVarRefs(parsed, { jslintGlobalComment: true })
      .filter(ea => !knownGlobals.includes(ea.name)).map(ea => ea.name);
    return arr.compact([...declaredGlobals, ...undefinedVariables]);
  }

  // GlobalInjector.getGlobals(this.textString)

  static run (src, namesToDeclareGlobal, optAst) {
    const parsed = optAst || fuzzyParse(src, { withComments: true });
    const globalComment = parsed.comments
      ? parsed.comments.find(c => c.isBlock && c.text.startsWith('global'))
      : null;
    const existingDecls = globalComment
      ? globalComment.text.replace(/^global\s*/, '')
        .split(',').map(ea => ea.trim()).filter(Boolean)
      : [];
    const namesToInsert = namesToDeclareGlobal.filter(ea => !existingDecls.includes(ea));

    if (!namesToInsert.length) {
      return {
        status: 'not modified',
        newSource: src,
        generated: '',
        from: 0,
        to: 0
      };
    }

    if (!globalComment) {
      const generated = `/*global ${namesToInsert.join(',')}*/\n`;
      const from = 0; const to = generated.length;
      const newSource = generated + src;
      return {
        status: 'modified',
        newSource,
        generated,
        from,
        to
      };
    }

    const from = globalComment.start + '/*'.length + globalComment.text.length;
    let generated = namesToInsert.join(',');
    if (!existingDecls.length) {
      if (!globalComment.text.startsWith('global ')) { generated = ' ' + generated; }
    } else {
      generated = ',' + generated;
    }
    const to = from + generated.length;
    const newSource = src.slice(0, from) + generated + src.slice(from);
    return {
      status: 'modified',
      newSource,
      generated,
      from,
      to
    };
  }
}

export class ImportRemover {
  static removeImports (moduleSource, importsToRemove, optModuleAst) {
    // returns {
    //   source: STRING,
    //   modifications: [{start: NUMBER, end: NUMBER, replacement: STRING}]
    //   removedImports: [{local: STRING, from: STRING}]
    // }

    const parsed = optModuleAst || fuzzyParse(moduleSource);

    // 1.get imports with specifiers
    const imports = parsed.body.flatMap(ea => {
      if (ea.type !== 'ImportDeclaration' || !ea.specifiers.length) return [];
      return ea.specifiers.map(spec => ({ local: spec.local, importStmt: ea }));
    });

    // 3. figure out what imports need to be removed or changed
    const importsToChange = imports.filter(ea =>
      importsToRemove.some(rem => rem.local === ea.local.name));
    const removedImports = importsToChange.map(ea =>
      ({ local: ea.local.name, from: ea.importStmt.source.value }));
    const affectedStmts = arr.uniq(importsToChange.map(ea => {
      const specToRemove = ea.importStmt.specifiers.find(spec => ea.local === spec.local);
      arr.remove(ea.importStmt.specifiers, specToRemove);
      return ea.importStmt;
    }));

    // 4. Compute the actual modifications to transform source and also new source itself
    const modifications = affectedStmts.slice().reverse().reduce((state, importStmt) => {
      let { source, changes } = state;
      const { start, end, specifiers } = importStmt;
      const pre = source.slice(0, start); const post = source.slice(end);
      const removed = source.slice(start, end);
      let replacement = !specifiers.length ? '' : stringify(importStmt);

      if (replacement && replacement.includes('\n') && !removed.includes('\n')) { replacement = replacement.replace(/\s+/g, ' '); }

      source = pre + replacement + post;
      changes = changes.concat({ replacement, start, end });
      return { source, changes };
    }, { source: moduleSource, changes: [] });

    return { ...modifications, removedImports };
  }

  static findUnusedImports (moduleSourceOrAst) {
    // get all var references of source without those included in the import
    // statments

    // 1.get imports with specifiers
    const parsed = typeof moduleSourceOrAst === 'string'
      ? fuzzyParse(moduleSourceOrAst)
      : moduleSourceOrAst;

    const imports = parsed.body.flatMap(ea => {
      if (ea.type !== 'ImportDeclaration' || !ea.specifiers.length) return [];
      return ea.specifiers.map(spec =>
        ({ local: spec.local, from: ea.source ? ea.source.value : '', importStmt: ea }));
    });
    const importIdentifiers = imports.map(ea => ea.local);

    const scope = query.resolveReferences(query.scopes(parsed));
    const refsWithoutImports = Array.from(scope.resolvedRefMap.keys()).filter(ea =>
      !importIdentifiers.includes(ea));
    const realRefs = arr.uniq(refsWithoutImports.map(ea => ea.name));

    return imports
      .filter(ea => !realRefs.includes(ea.local.name))
      .map(ea => ({ ...ea, local: ea.local.name }));
  }

  static removeUnusedImports (moduleSource) {
    const parsed = fuzzyParse(moduleSource);
    return this.removeImports(moduleSource, this.findUnusedImports(parsed), parsed);
  }
}
