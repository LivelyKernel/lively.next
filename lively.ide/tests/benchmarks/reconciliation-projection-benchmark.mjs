import { prepareShadowScalarProjection } from '../../components/reconciliation/shadow-projection.js';
import { ComponentBridgeCommandKind } from '../../components/reconciliation/morphic-change-set-adapter.js';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';

const moduleId = 'local://projectional-reconciliation-benchmark/component.cp.js';
const exportName = 'Example';
const componentId = `${moduleId}#${exportName}`;

function percentile (samples, fraction) {
  const ordered = samples.slice().sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
}

function summarize (samples) {
  return {
    iterations: samples.length,
    meanMs: samples.reduce((sum, sample) => sum + sample, 0) / samples.length,
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    maxMs: Math.max(...samples)
  };
}

function benchmarkSource ({ fillerDeclarations = 300, textAndAttributes }) {
  const filler = Array.from({ length: fillerDeclarations }, (_, index) =>
    `const filler${index} = { name: 'filler ${index}', value: ${index}, description: '${'x'.repeat(80)}' };`
  ).join('\n');
  return `${filler}
const ${exportName} = component({
  name: 'benchmark label',
  textAndAttributes: ${textAndAttributes}
});`;
}

function runProjectionBenchmark ({ source, values, expressions = null, iterations = 240 }) {
  const parsed = parseComponentSource({ source, moduleId, exportName, componentId });
  if (!parsed.supported) throw new Error(parsed.diagnostics[0]?.message || 'Benchmark source is unsupported');
  let currentSource = source;
  let currentDocument = parsed.document;
  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const beforeIndex = iteration % values.length;
    const afterIndex = (iteration + 1) % values.length;
    const bridgeCommand = {
      kind: ComponentBridgeCommandKind.EDIT_TEXT,
      componentId,
      nodeId: currentDocument.root.id,
      previousValue: values[beforeIndex],
      value: values[afterIndex]
    };
    const started = performance.now();
    const projection = prepareShadowScalarProjection({
      source: currentSource,
      moduleId,
      exportName,
      componentId,
      bridgeCommands: [bridgeCommand],
      beforeDocument: currentDocument,
      resolveNodeId: () => currentDocument.root.id,
      valueExpressionFor: expressions
        ? () => ({ __expr__: expressions[afterIndex], bindings: {} })
        : undefined
    });
    samples.push(performance.now() - started);
    if (!projection.supported) {
      const diagnostic = projection.diagnostics[0];
      throw new Error(`${diagnostic?.kind || 'projection failed'}: ${diagnostic?.message || ''}`);
    }
    currentSource = projection.sourceAfter;
    currentDocument = projection.document;
  }
  return summarize(samples.slice(Math.min(20, Math.floor(iterations / 10))));
}

function runParseBenchmark ({ source, iterations = 240 }) {
  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const started = performance.now();
    const parsed = parseComponentSource({ source, moduleId, exportName, componentId });
    samples.push(performance.now() - started);
    if (!parsed.supported) throw new Error(parsed.diagnostics[0]?.message || 'Parse failed');
  }
  return summarize(samples.slice(Math.min(20, Math.floor(iterations / 10))));
}

const plainValues = [
  ['a'.repeat(4096), { fontWeight: 'normal' }],
  ['b'.repeat(4096), { fontWeight: 'bold' }]
];
const plainSource = benchmarkSource({
  textAndAttributes: JSON.stringify(plainValues[0])
});

const results = {
  sourceBytes: plainSource.length,
  parse: runParseBenchmark({ source: plainSource }),
  staticTextProjection: runProjectionBenchmark({
    source: plainSource,
    values: plainValues
  })
};

class EmbeddedMorphValue {}
const embeddedValues = [
  ['before', null, new EmbeddedMorphValue(), null],
  ['after', { fontWeight: 'bold' }, new EmbeddedMorphValue(), null]
];
const embeddedExpressions = [
  `['before', null, morph({ name: 'embedded before', fill: 'red' }), null]`,
  `['after', { fontWeight: 'bold' }, morph({ name: 'embedded after', fill: 'blue' }), null]`
];
const embeddedSource = `import { morph } from 'lively.morphic';\n${benchmarkSource({
  textAndAttributes: embeddedExpressions[0]
})}`;
results.embeddedTextProjection = runProjectionBenchmark({
  source: embeddedSource,
  values: embeddedValues,
  expressions: embeddedExpressions
});

console.log(JSON.stringify(results, null, 2));
