// One fixture definition exercises the handwritten Babel, ESTree and SWC passes.
import './node-bootstrap.mjs';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Load package graphs after the flatn ESM hook has been installed.
const [
  { babel },
  { babelNodes, getScopeFromPath, livelyPreTranspile, rewriteToCaptureTopLevelVariables: captureBabel },
  { rewriteToCaptureTopLevelVariables: captureEstree, rewriteToRegisterModuleToCaptureSetters: registerEstree, insertCapturesForExportedImports: exportEstree },
  { classToFunctionTransform, classToFunctionTransformBabel },
  { initializeClass },
  { parse, stringify, query }
] = await Promise.all([
  import('../babel/ast.js'), import('../babel/plugin.js'), import('../capturing.js'),
  import('../../lively.classes/class-to-function-transform.js'),
  import('../../lively.classes/runtime.js'), import('../../lively.ast/index.js')
]);

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtureDir = new URL('./parity/', import.meta.url);
const suites = process.argv.slice(2);
const cases = [];
for (const file of (await readdir(fixtureDir)).filter(file => file.endsWith('.json')).sort()) {
  const suite = file.replace(/\.json$/, '');
  if (suites.length && !suites.includes(suite)) continue;
  for (const fixture of JSON.parse(await readFile(new URL(file, fixtureDir), 'utf8'))) {
    const pass = fixture.pass || (suite === 'classes' ? 'classes' : 'scope');
    const config = {
      captureObj: '_rec',
      exclude: [...query.knownGlobals, '_rec', 'initializeClass', 'module', ...(fixture.config?.exclude || [])],
      enableExportSplit: false, enableComponentTransform: false,
      enableNamespaceTransform: false, enableDynamicImportTransform: false,
      enableSystemjsTransform: false, enableScopeCapture: false,
      ...fixture.config
    };
    // Always exclude the recorder itself; fixture exclusions extend builtins.
    config.exclude = [...new Set([...query.knownGlobals, config.captureObj, 'initializeClass', 'module', ...(fixture.config?.exclude || [])])];
    const flag = {
      scope: 'enableScopeCapture', component: 'enableComponentTransform',
      namespace: 'enableNamespaceTransform', 'dynamic-import': 'enableDynamicImportTransform',
      systemjs: 'enableSystemjsTransform', 'export-split': 'enableExportSplit'
    }[pass];
    if (flag) config[flag] = true;
    if (pass === 'namespace') config.resurrection = true;
    if (pass === 'classes') config.classToFunction = {
      classHolder: '_rec', functionNode: 'initializeClass', currentModuleAccessor: 'undefined',
      ...config.classToFunction
    };
    cases.push({ ...fixture, name: `${suite}/${fixture.name}`, pass, config });
  }
}
assert.ok(cases.length, 'no parity fixtures selected');

if (process.env.PARITY_TRACE) console.log('Running native fixture batch');
const build = spawnSync('cargo', ['build', '--locked', '--message-format=json', '--manifest-path',
  `${root}lively.freezer/swc-plugin/Cargo.toml`, '-p', 'lively-swc-transforms', '--example', 'parity'], {
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 600000
});
assert.equal(build.status, 0, build.stderr || String(build.error));
const executable = build.stdout.trim().split('\n').map(line => JSON.parse(line))
  .find(message => message.target?.name === 'parity' && message.executable)?.executable;
assert.ok(executable, 'Cargo did not report the parity executable');
if (process.env.PARITY_TRACE) console.log('Executing native cases', executable, JSON.stringify(cases).length);
const native = spawnSync(executable, [], {
  input: JSON.stringify(cases), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60000
});
assert.equal(native.status, 0, native.stderr || String(native.error));
const outputs = JSON.parse(native.stdout);
assert.equal(outputs.length, cases.length);

const estreeExpression = source => parse(`(${source})`).body[0].expression;
const babelExpression = source => babel.parse(`(${source})`).program.body[0].expression;
function classOptions (config, expression) {
  return Object.fromEntries(Object.entries(config.classToFunction).map(([key, value]) => [key, expression(value)]));
}
function scopeOptions (config, expression) {
  return { ...config, captureObj: expression(config.captureObj),
    declarationWrapper: config.declarationWrapper ? expression(config.declarationWrapper) : undefined };
}
function babelTransform (fixture) {
  const { source, config, pass } = fixture;
  if (pass === 'pipeline') return babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: [[livelyPreTranspile, {
      recordGlobals: true, topLevelVarRecorder: {}, varRecorderName: config.captureObj,
      dontTransform: config.exclude, moduleName: config.moduleId,
      transformES6Classes: !!config.classToFunction,
      classToFunction: config.classToFunction ? classOptions(config, babelExpression) : undefined,
      currentModuleAccessor: config.currentModuleAccessor ? babelExpression(config.currentModuleAccessor) : undefined,
      declarationWrapper: config.declarationWrapper ? babelExpression(config.declarationWrapper) : undefined
    }]]
  }).code;
  return babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: [() => ({ visitor: { Program (path, state) {
      if (pass === 'scope') captureBabel(path, { ...scopeOptions(config, babelExpression), scope: getScopeFromPath(path) });
      else if (pass === 'classes') {
        const scope = { decls: [], resolvedRefMap: new Map() };
        for (const binding of Object.values(path.scope.bindings)) {
          const decl = binding.path.node;
          scope.decls.push([decl, binding.identifier]);
          for (const ref of binding.referencePaths) scope.resolvedRefMap.set(ref.node, { decl, declId: binding.identifier, ref });
        }
        classToFunctionTransformBabel(path, state, { ...classOptions(config, babelExpression), scope, nodes: babelNodes });
      } else {
        const options = { ...scopeOptions(config, babelExpression), varRecorderName: config.captureObj };
        switch (pass) {
          case 'component': moduleTransforms.ensureComponentDescriptors(path, config.moduleId || '', options); break;
          case 'dynamic-import': moduleTransforms.transformDynamicImports(path); break;
          case 'export-split': moduleTransforms.replaceExportedVarDeclarations(path, config.moduleId || '', { recorderName: config.captureObj }); break;
          case 'namespace': moduleTransforms.transformNamespaces(path, options); break;
          case 'systemjs': moduleTransforms.rewriteToRegisterModuleToCaptureSetters(path, state, options); break;
          default: throw new Error('Unknown parity pass: ' + pass);
        }
      }
    } } })]
  }).code;
}
let moduleTransforms;
if (cases.some(fixture => !['scope', 'classes', 'pipeline', 'exported-import-capture'].includes(fixture.pass))) {
  moduleTransforms = await import('../babel/transforms/index.js');
}
function estreeTransform ({ source, config, pass }) {
  if (pass === 'scope') return stringify(captureEstree(parse(source), estreeExpression(config.captureObj), scopeOptions(config, estreeExpression)));
  if (pass === 'systemjs') return stringify(registerEstree(parse(source), estreeExpression(config.captureObj), scopeOptions(config, estreeExpression)));
  if (pass === 'exported-import-capture') return stringify(exportEstree(parse(source), scopeOptions(config, estreeExpression)));
  return stringify(classToFunctionTransform(source, classOptions(config, estreeExpression)));
}
function canonical (code) {
  const ast = babel.parseSync(code, { configFile: false, babelrc: false, parserOpts: { allowUndeclaredExports: true } });
  return JSON.parse(JSON.stringify(ast.program, (key, value) =>
    ['start', 'end', 'loc', 'extra', 'leadingComments', 'trailingComments', 'innerComments', 'comments'].includes(key) ? undefined : value));
}
function execute (code, fixture) {
  // Fixtures are repository-owned executable tests, not untrusted input.
  const recorder = structuredClone(fixture.recorder || {});
  const runtime = { FreezerRuntime: { recorderFor: () => recorder } };
  const system = { get: () => ({ moduleEnv: () => ({ recorder }) }) };
  const evaluate = new Function('_rec', 'initializeClass', 'module', 'lively', 'System', '__contextModule__',
    `{ ${fixture.setup || ''}\nreturn (() => {\n${code}\nreturn (${fixture.evaluate});\n})(); }`);
  return JSON.parse(JSON.stringify(evaluate(recorder, initializeClass, {}, runtime, system, {})));
}

let checks = 0;
for (let i = 0; i < cases.length; i++) {
  const fixture = cases[i];
  if (process.env.PARITY_TRACE) console.log(fixture.name);
  const output = outputs[i];
  assert.equal(output.name, fixture.name);
  assert.ok(!output.error, `${fixture.name}: ${output.error}`);
  const backends = { rust: output.code };
  if (fixture.pass !== 'exported-import-capture') backends.babel = babelTransform(fixture);
  if (['scope', 'classes', 'systemjs', 'exported-import-capture'].includes(fixture.pass)) backends.estree = estreeTransform(fixture);
  for (const [backend, code] of Object.entries(backends)) {
    try {
      canonical(code); // All backends must emit valid JavaScript.
      if (fixture.evaluate) assert.deepEqual(execute(code, fixture), fixture.expected);
      if (fixture.structural) assert.deepEqual(canonical(code), canonical(backends.babel || backends.estree));
      if (fixture.expectedCode) assert.deepEqual(canonical(code), canonical(fixture.expectedCode));
      for (const text of fixture.contains || []) assert.ok(code.includes(text), `missing ${text}`);
      for (const text of fixture.excludes || []) assert.ok(!code.includes(text), `unexpected ${text}`);
      checks++;
    } catch (error) {
      error.message = `${fixture.name} [${backend}]: ${error.message}\n\n${code}`;
      throw error;
    }
  }
}
console.log(`${cases.length} shared parity fixtures, ${checks} backend checks passed`);
