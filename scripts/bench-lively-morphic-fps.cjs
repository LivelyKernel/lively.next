const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const puppeteer = createRequire(path.join(root, 'lively.headless/package.json'))('puppeteer');
const baseline = process.argv[2] || 'd62a66be8';
const baseURL = new URL(process.argv[3] || 'http://localhost:9013').origin;
const trials = Number(process.argv[4] || 3);
const sampleMs = Number(process.argv[5] || 6000);
assert(Number.isInteger(trials) && trials > 0, 'Positive integer trial count required');
assert(Number.isFinite(sampleMs) && sampleMs >= 1000, 'Sample duration must be at least one second');
const out = process.argv[6] || '/tmp/lively-morphic-gpu-results.json';
const traceDir = out.replace(/\.json$/, '') + '-traces';
const files = ['lively.morphic/morph.js', 'lively.morphic/layout.js', 'lively.morphic/rendering/renderer.js'];
const sources = Object.fromEntries(files.map(file => [file,
  execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' })]));
const results = []; const diagnostics = [];
const metadata = { baseline, trials, sampleMs, warmupMs: 1500, node: process.version,
  viewport: { width: 1280, height: 900 },
  method: 'Hardware GPU; headless compositor presentation (not physical display FPS); fresh Chrome per version/trial; alternating order; no CPU throttling; native compositor frame reports; shared-device NVIDIA utilization samples' };
fs.mkdirSync(traceDir, { recursive: true });
const save = () => fs.writeFileSync(out, JSON.stringify({ metadata, results, diagnostics }, null, 2));
const key = e => JSON.stringify([e.pid, e.scope, e.id2 || e.id, e.name]);

function summarize (events) {
  const start = events.find(e => e.name === 'gpu-benchmark-start');
  const end = events.find(e => e.name === 'gpu-benchmark-end');
  assert(start && end && end.ts > start.ts, 'Trace must delimit the sample');
  const inSample = ts => ts >= start.ts && ts < end.ts;
  const pending = new Map(); const presented = new Map(); const states = {};
  for (const e of events) {
    if (e.name === 'PipelineReporter' && e.pid === start.pid) {
      if (e.ph === 'b') {
        pending.set(key(e), e);
        const r = e.args.chrome_frame_reporter;
        if (inSample(e.ts)) states[r.state] = (states[r.state] || 0) + 1;
      } else if (e.ph === 'e') {
        const begin = pending.get(key(e));
        if (!begin) continue;
        const r = begin.args.chrome_frame_reporter;
        if (inSample(e.ts) && ['STATE_PRESENTED_ALL', 'STATE_PRESENTED_PARTIAL'].includes(r.state)) {
          const frame = JSON.stringify([r.frame_source, r.frame_sequence, r.layer_tree_host_id]);
          presented.set(frame, e.ts);
        }
      }
    }
  }
  assert(presented.size > 10, 'Need presented compositor frames');
  const displayFrames = events.filter(e => e.name === 'Display::FrameDisplayed' && inSample(e.ts)).length;
  assert(Math.abs(displayFrames - presented.size) <= 5, 'Display and renderer frame counts must agree');
  const elapsedMs = (end.ts - start.ts) / 1000;
  return { elapsedMs, presentedFrames: displayFrames, rendererReportedFrames: presented.size, fps: displayFrames * 1000 / elapsedMs,
    frameStates: states, gpuTimerIntervals: events.filter(e => e.cat.includes('gpu.device') && e.ph === 'F' && inSample(e.ts)).length,
    rasterTasks: events.filter(e => e.name === 'RasterTask' && e.ph === 'X' && inSample(e.ts)).length,
    compositedQuads: events.filter(e => e.name === 'SkiaRenderer::DoDrawQuad' && e.ph === 'X' && inSample(e.ts)).length };
}

async function measureVersion (version, trial) {
  console.log(new Date().toISOString(), 'START', version, trial);
  const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--use-angle=gl', '--ozone-platform=x11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':1',
      XAUTHORITY: process.env.XAUTHORITY || '/run/user/1000/gdm/Xauthority' }, protocolTimeout: 600000 });
  const errors = []; const served = new Set();
  try {
    metadata.browser = await browser.version();
    const browserSession = await browser.target().createCDPSession();
    const { gpu } = await browserSession.send('SystemInfo.getInfo');
    assert(!/SwiftShader|llvmpipe|software/i.test(gpu.auxAttributes.glRenderer), 'Hardware GPU required');
    assert.equal(gpu.featureStatus.gpu_compositing, 'enabled');
    assert(gpu.featureStatus.rasterization.startsWith('enabled'), 'GPU rasterization required');
    metadata.gpu = { devices: gpu.devices, renderer: gpu.auxAttributes.glRenderer, features: gpu.featureStatus };
    const page = await browser.newPage();
    await page.setViewport({ ...metadata.viewport, deviceScaleFactor: 1 });
    page.on('pageerror', err => errors.push(err.stack));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '9011') return request.abort();
      const file = url.pathname.slice(1);
      if (version === 'baseline' && url.origin === baseURL && sources[file]) {
        served.add(file);
        return request.respond({ status: 200, contentType: 'application/javascript', body: sources[file] });
      }
      return request.continue();
    });
    await page.goto(`${baseURL}/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=false&noModuleCache=true`,
      { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof $world !== 'undefined' && $world.isWorld && $world._uiInitialized,
      { timeout: 180000 });
    await page.evaluate(async optimized => {
      const { default: Renderer } = await System.import('lively.morphic/rendering/renderer.js');
      const { Morph, TilingLayout, GridLayout } = await System.import('lively.morphic');
      if (Renderer.prototype.renderStep.toString().includes('_layoutCSSOrder') !== optimized ||
          !Morph.prototype.applyLayoutIfNeeded.toString().includes('submorphs.length') !== optimized ||
          TilingLayout.prototype.addSubmorphCSS.toString().includes('submorphIndices') !== optimized ||
          GridLayout.prototype.measureSubmorph.toString().includes('measuredLayouts') !== optimized) {
        throw new Error('Wrong source version loaded');
      }
      $world.suspendSteppingAll(); $world.env.forceUpdate();
      await $world.env.renderer.stopRenderWorldLoop();
    }, version === 'optimized');
    if (version === 'baseline') assert.equal(served.size, files.length);
    const session = await page.createCDPSession();
    let layers = [];
    session.on('LayerTree.layerTreeDidChange', event => { layers = event.layers || []; });
    await session.send('LayerTree.enable');
    for (const scenario of ['native-layers', 'native-blur', 'hierarchy-pan']) {
      console.log(new Date().toISOString(), 'SCENE', version, trial, scenario);
      const scene = await page.evaluate(async ({ scenario, sampleMs }) => {
        const { Morph, morph, MorphicEnv } = await System.import('lively.morphic');
        const { createDOMEnvironment } = await System.import('lively.morphic/rendering/dom-helper.js');
        const { pt, Color } = await System.import('lively.graphics');
        const { promise } = await System.import('lively.lang');
        const env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
        env.domEnv.iframe.style.width = '1280px'; env.domEnv.iframe.style.height = '850px';
        const count = { 'native-layers': 1000, 'native-blur': 300, 'hierarchy-pan': 5000 }[scenario];
        const blurred = scenario === 'native-blur'; const native = scenario !== 'hierarchy-pan';
        const children = Array.from({ length: count }, (_, i) => new Morph({
          name: `gpu-${i}`, renderOnGPU: native, extent: pt(blurred ? 180 : 24, blurred ? 180 : 24),
          position: pt((i % 40) * 30, Math.floor(i / 40) * 30),
          fill: i % 2 ? Color.blue : Color.green, opacity: blurred ? .65 : 1, blur: blurred ? 8 : 0 }));
        const container = new Morph({ renderOnGPU: !native, extent: pt(1200, 3800), submorphs: children });
        const world = morph({ type: 'world', extent: pt(1280, 850), clipMode: 'hidden', submorphs: [container] });
        await env.setWorld(world);
        await promise.waitFor(60000, () => !env.renderer.renderWorldLoopLater && !world.needsRerender());
        const targets = native ? children : [container];
        for (const m of targets) {
          const node = env.renderer.getNodeForMorph(m);
          if (!node.isConnected || node.style.willChange !== 'transform' || !node.style.transform.includes('translate')) {
            throw new Error('Morph must use existing GPU promotion');
          }
        }
        let running = true; let renderTimes = []; let collecting = false;
        const original = env.renderer.renderStep.bind(env.renderer);
        env.renderer.renderStep = () => {
          const start = performance.now();
          try { return original(); }
          finally { if (collecting) renderTimes.push(performance.now() - start); }
        };
        if (native) {
          world.dontRecordChangesWhile(() => children.forEach(m => {
            m.animate({ position: m.position.addPt(pt(50, 20)), rotation: .4,
              duration: sampleMs + 10000, easing: 'linear' });
          }));
          env.forceUpdate();
          if (children.some(m => !env.renderer.getNodeForMorph(m).getAnimations().length)) {
            throw new Error('Lively native transform animation must be running');
          }
        } else {
          const start = performance.now();
          const update = () => {
            if (!running) return;
            const t = (performance.now() - start) / 1000;
            world.dontRecordChangesWhile(() => container.position = pt(Math.sin(t) * 30, Math.cos(t) * 30));
            env.domEnv.window.requestAnimationFrame(update);
          };
          env.domEnv.window.requestAnimationFrame(update);
        }
        window.gpuBenchmark = {
          start () { renderTimes = []; collecting = true; performance.mark('gpu-benchmark-start'); },
          stop () {
            performance.mark('gpu-benchmark-end'); collecting = false; running = false;
            for (const m of targets) for (const a of env.renderer.getNodeForMorph(m).getAnimations()) a.pause();
            return { renderSteps: renderTimes.length, renderMeanMs: renderTimes.length
              ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length : 0 };
          },
          cleanup () { MorphicEnv.popDefault().uninstall(); delete window.gpuBenchmark; }
        };
        return { morphs: count, nativeAnimation: native, blurred, promotedMorphs: targets.length };
      }, { scenario, sampleMs });
      await new Promise(resolve => setTimeout(resolve, metadata.warmupMs));
      const reasons = {};
      for (const layer of layers.filter(l => l.drawsContent)) {
        const result = await session.send('LayerTree.compositingReasons', { layerId: layer.layerId });
        for (const reason of result.compositingReasonIds) reasons[reason] = (reasons[reason] || 0) + 1;
      }
      assert(reasons.WillChangeTransform > 0 || reasons.ActiveTransformAnimation > 0, 'Verify compositor promotion');
      const tracePath = path.join(traceDir, `${trial}-${version}-${scenario}.json`);
      await page.tracing.start({ path: tracePath, categories: ['gpu', 'cc', 'viz', 'blink.user_timing',
        'disabled-by-default-gpu.device', 'disabled-by-default-devtools.timeline.frame'] });
      const utilization = [];
      const meter = spawn('nvidia-smi', ['--query-gpu=utilization.gpu,clocks.current.graphics', '--format=csv,noheader,nounits', '--loop-ms=500']);
      let buffer = '';
      meter.stdout.on('data', chunk => {
        buffer += chunk;
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          const [busy, clock] = line.split(',').map(Number);
          if (Number.isFinite(busy) && Number.isFinite(clock)) utilization.push({ busy, clock });
        }
      });
      meter.on('error', err => errors.push(err.message));
      let cpu;
      try {
        await page.evaluate(() => gpuBenchmark.start());
        await new Promise(resolve => setTimeout(resolve, sampleMs));
        cpu = await page.evaluate(() => gpuBenchmark.stop());
      } finally { meter.kill(); }
      await new Promise(resolve => setTimeout(resolve, 500)); // Flush completed asynchronous GPU timer queries.
      const trace = JSON.parse((await page.tracing.stop()).toString());
      if (trial === 1) await page.screenshot({ path: path.join(traceDir, `${version}-${scenario}.png`) });
      const result = { version, trial, scenario, ...scene, ...cpu,
        layers: layers.filter(l => l.drawsContent).length, compositingReasons: reasons,
        ...summarize(trace.traceEvents), gpuUtilizationSamples: utilization,
        gpuUtilizationMean: utilization.length ? utilization.reduce((n, v) => n + v.busy, 0) / utilization.length : null, tracePath };
      results.push(result); save();
      console.log('RESULT', JSON.stringify(result));
      await page.evaluate(() => gpuBenchmark.cleanup());
    }
  } finally {
    diagnostics.push({ version, trial, errors }); save(); await browser.close();
  }
}
(async () => {
  for (let trial = 1; trial <= trials; trial++) {
    for (const version of trial % 2 ? ['baseline', 'optimized'] : ['optimized', 'baseline']) await measureVersion(version, trial);
  }
  assert.equal(results.length, trials * 6);
  console.log('COMPLETE', out);
})().catch(err => { console.error(err.stack); process.exitCode = 1; });
