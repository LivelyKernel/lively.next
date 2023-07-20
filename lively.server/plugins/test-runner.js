import { HeadlessSession } from 'lively.headless';

export default class TestRunner {
  async setup (livelyServer) {
    console.log('[Test Runner] Started');
  }

  async run (module_to_test) {
    let results;
    try {
    this.headlessSession = new HeadlessSession();
    await this.headlessSession.open('http://localhost:9011/worlds/load?name=__newWorld__&askForWorldName=false',  (sess) => sess.runEval(`$world.name == 'aLivelyWorld' && $world._uiInitialized`))
    results = await this.headlessSession.runEval(`
    const { resource } = await System.import("lively.resources");
    const { promise } = await System.import('lively.lang')
    const { localInterface } = await System.import("lively-system-interface");
    const { loadPackage } = await System.import("lively-system-interface/commands/packages.js");
    const packageToTestLoaded = localInterface.coreInterface.getPackages().find(pkg => pkg.name === '${module_to_test}');
    if (!packageToTestLoaded){
      await loadPackage(localInterface.coreInterface, {
        name: '${module_to_test}',
        address: 'http://localhost:9011/local_projects/${module_to_test}',
        type: 'package'
      });
    }
    const { default: TestRunner } = await System.import("lively.ide/test-runner.js");
    const runner = new TestRunner();
    await promise.waitFor(()=> !!window.chai && !!window.Mocha);
    const results = await runner.runTestsInPackage('${module_to_test}');
    results.forEach(r => {
      r.tests?.forEach(t => {
        if (t.error) t.error = true
        else t.error = false;
      })
    });
    JSON.stringify(results);
    `)
    } catch (err) {
      results = JSON.stringify({ error: err.message });
    } finally {
      this.headlessSession.dispose();
      return results;
    }
  }

  get pluginId () { return 'TestRunner'; }

  async handleRequest (req, res, next) {
    if (!req.url.startsWith('/subserver/TestRunner')) {
      return next();
    }
    if (req.url.startsWith('/subserver/TestRunner/')) {
      const [_, module_to_test] = req.url.split('TestRunner/');
      const results = await this.run(module_to_test);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(results);
    }
  }
}
