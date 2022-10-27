// /* global declare, it, describe, beforeEach, afterEach, before, after,System,xdescribe */
// import { expect } from 'mocha-es6';
// import { createFiles, resource } from 'lively.resources';
// import FreezerPackage from '../package.js';
// import Bundle from '../bundle.js';
// import { MorphicEnv, morph, World } from 'lively.morphic';
// import { createDOMEnvironment } from 'lively.morphic/rendering/dom-helper.js';
// import { pt } from 'lively.graphics';
// import MorphicDB from 'lively.morphic/morphicdb/db.js';
// import ObjectPackage, { addScript } from 'lively.classes/object-classes.js';
// import { serialize, requiredModulesOfSnapshot, deserialize } from 'lively.serializer2';
// import { obj, arr } from 'lively.lang';
// import { getPackage, module } from 'lively.modules/index.js';
// import { Package } from 'lively.modules/src/packages/package.js';
// import { serializeMorph } from 'lively.morphic/serialization.js';
// import FreezerPart from '../part.js';
// 
// function buildPackage1 () {
//   return createFiles(baseDir, {
//     package1: {
//       'package.json': '{"name": "package1", "version": "1"}',
//       'file1.js': "import { x } from './file2.js'; export var y = x + 2; export { z } from './file3.js'",
//       'file2.js': 'export var x = 23;',
//       'file3.js': 'export var z = 99;',
//       'file_star_import.js': "import * as x from './file1.js'; export { x as file1 };",
//       'file_star_export.js': "export * from './file1.js';",
//       'file_package_import.js': "import { version } from './package.json'; export { version };"
//     }
//   });
// }
// 
// let publishOpts = { addPreview: !System.get('@system-env').node };
// let env; let packagesToRemove;
// let isNode = System.get('@system-env').node;
// let testDB; let partToFreeze; let partPackage;
// 
// async function setupDB () {
//   if (isNode) {
//     env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
//     env.setWorld(new World({ name: 'world', extent: pt(300, 300) }));
//   }
//   packagesToRemove = [];
// 
//   testDB = MorphicDB.named('lively.morphic/objectdb/partsbin-test-db', {
//     snapshotLocation: 'lively.morphic/objectdb/partsbin-test-db/snapshots/',
//     serverURL: System.baseURL + 'objectdb/'
//   });
//   publishOpts.morphicDB = testDB;
// 
//   // publish dummy parts
//   await savePart(morph({ name: 'rudolph' }), 'rudolph', publishOpts, { author: { name: 'foo-user' } });
//   await savePart(morph({ name: 'wichtel' }), 'wichtel', publishOpts, { author: { name: 'foo-user' } });
//   partToFreeze = morph({
//     name: 'santa clause',
//     submorphs: [
//       await loadPart('rudolph', { morphicDB: testDB }),
//       await loadPart('wichtel', { morphicDB: testDB })]
//   });
//   partPackage = ObjectPackage.withId('package-for-loads-a-part-test');
//   packagesToRemove.push(partPackage);
//   await partPackage.adoptObject(partToFreeze);
//   await addScript(partToFreeze, () => 23, 'foo');
//   await savePart(partToFreeze, partToFreeze.name, publishOpts, { author: { name: 'foo-user' } });
// }
// 
// async function teardownDB () {
//   isNode && MorphicEnv.popDefault().uninstall();
//   await Promise.all(packagesToRemove.map(ea => ea.remove()));
//   await testDB.destroyDB();
//   await resource(System.decanonicalize(testDB.snapshotLocation)).parent().remove();
// }
// 
// let baseDir = resource('local://freezer-tests/');
// let standaloneOpts = { addRuntime: true, isExecutable: true, runtimeGlobal: 'lively.freezerRuntimeTest' };
// let packages; let bundle;
// 
// let expectedPackage1File1Code = `System.register("package1@1/file1.js", ["package1@1/file2.js", "package1@1/file3.js"], function(_export, _context) {
//   "use strict";
//   var x;
//   return {
//     setters: [
//       function (package1_at_1_forwardslash_file2_period_js) {
//         x = package1_at_1_forwardslash_file2_period_js.x;
//       },
//       function (package1_at_1_forwardslash_file3_period_js) {
//         _export("z", package1_at_1_forwardslash_file3_period_js.z);
//       }
//     ],
//     execute: function() {
//       var y = x + 2;
//       _export("y", y);
//     }
//   }
// });`;
// 
// let expectedPackage1File2Code = `System.register("package1@1/file2.js", [], function(_export, _context) {
//   "use strict";
//   return {
//     setters: [],
//     execute: function() {
//       var x = 23;
//       _export("x", x);
//     }
//   }
// });`;
// 
// describe('bundler', function () {
//   this.timeout(6000);
// 
//   beforeEach(async () => {
//     await buildPackage1();
//     packages = await FreezerPackage.buildPackageMap(
//       { package1: { path: baseDir.join('package1/') } });
//     bundle = new Bundle(packages);
//   });
// 
//   afterEach(async () => {
//     await baseDir.remove();
//   });
// 
//   describe('resolves modules', () => {
//     it('reads dependencies of simple package', async () => {
//       await bundle.resolveDependenciesStartFrom('file1.js', 'package1');
//       expect(bundle.report().trim()).equals(
// `package1@1/file1.js (84B)
//   => y, z
//   <= package1@1/file2.js x
//   <= package1@1/file3.js z
// 
// package1@1/file2.js (18B)
//   => x
// 
// package1@1/file3.js (18B)
//   => z`);
//     });
//   });
// 
//   describe('module transforms', () => {
//     it('into function', async () => {
//       await bundle.resolveDependenciesStartFrom('file1.js', 'package1');
//       expect(bundle.entryModule.transformToRegisterFormat()).equals(expectedPackage1File1Code);
//     });
// 
//     it('star import', async () => {
//       await bundle.resolveDependenciesStartFrom('file_star_import.js', 'package1');
//       expect(bundle.entryModule.transformToRegisterFormat())
//         .contains('x = package1_at_1_forwardslash_file1_period_js;');
//     });
// 
//     it('star export', async () => {
//       await bundle.resolveDependenciesStartFrom('file_star_export.js', 'package1');
//       expect(bundle.entryModule.transformToRegisterFormat())
//         .contains('_export(package1_at_1_forwardslash_file1_period_js);');
//     });
// 
//     it('part export', async () => {
//       // await setupDB();
// 
//       // let frozenPart = await FreezerPart.fromMorph(partToFreeze),
//       //     reconstructed = await eval(await frozenPart.standalone()).frozenPart;
//       // 
//       // expect(reconstructed).not.to.to.null;
//       // expect(reconstructed.name).equals('santa clause');
//       // expect(reconstructed.foo).not.to.be.null;
// 
//       // await teardownDB();
//     });
//   });
// 
//   describe('bundle execution', () => {
//     afterEach(() => delete lively.freezerRuntimeTest);
// 
//     it('standalone', async () => {
//       eval(await bundle.standalone({ ...standaloneOpts, entryModule: 'package1/file1.js' }));
//       expect(lively.freezerRuntimeTest.get('package1@1/file1.js').exports)
//         .deep.equals({ y: 25, z: 99 });
//     });
// 
//     it('star import', async () => {
//       eval(await bundle.standalone({ ...standaloneOpts, entryModule: 'package1/file_star_import.js' }));
//       expect(lively.freezerRuntimeTest.get('package1@1/file_star_import.js').exports)
//         .deep.equals({ file1: { y: 25, z: 99 } });
//     });
// 
//     it('star export', async () => {
//       eval(await bundle.standalone({ ...standaloneOpts, entryModule: 'package1/file_star_export.js' }));
//       expect(lively.freezerRuntimeTest.get('package1@1/file_star_export.js').exports)
//         .deep.equals({ y: 25, z: 99 });
//     });
// 
//     it('can import json', async () => {
//       eval(await bundle.standalone({ ...standaloneOpts, entryModule: 'package1/file_package_import.js' }));
//       expect(lively.freezerRuntimeTest.get('package1@1/file_package_import.js').exports)
//         .deep.equals({ version: '1' });
//     });
//   });
// });
