import { HeadlessSession } from 'lively.headless';
import { promise } from 'lively.lang';

export default class TestRunner {
  async setup (livelyServer) {
    this.baseURL = `http://localhost:${livelyServer.port}`;
    console.log('[Test Runner] Started');
  }

  async run (module_to_test) {
    let results;
    try {
      let attempts = 1;
      while (true) {
        try {
          this.headlessSession = new HeadlessSession();
          await this.headlessSession.open(this.baseURL + '/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=false',  (sess) => sess.runEval(`typeof $world !== 'undefined' && $world.isWorld && $world._uiInitialized`, { timeout: 5000 }).catch(() => false));
        } catch (err) {
          if (attempts < 3) {
            attempts++;
            await this.headlessSession.dispose();
            await promise.delay(1000);
            console.log('Failed to load browser, retrying...')
            continue;
          }
          else throw err;
        }
        break;
      }
      results = await this.headlessSession.runEval(`
      const { resource } = await System.import("lively.resources");
      const { promise } = await System.import('lively.lang')
      const { localInterface } = await System.import("lively-system-interface");
      const { loadPackage } = await System.import("lively-system-interface/commands/packages.js");
      const packageToTestLoaded = localInterface.coreInterface.getPackages().find(pkg => pkg.name === '${module_to_test}');
      const packageAddress = packageToTestLoaded?.url || '${this.baseURL}/local_projects/${module_to_test}';
      const packageIsLocalProject = packageAddress.startsWith('${this.baseURL}/local_projects/');
      if (!packageToTestLoaded){
        await loadPackage(localInterface.coreInterface, {
          name: '${module_to_test}',
          address: packageAddress,
          type: 'package'
        });
      } else if (packageIsLocalProject) {
        // Packages discovered during bootstrap can retain a stale cached
        // package.json. Reload so current project-scoped import maps are active
        // before the test files themselves are imported.
        await localInterface.coreInterface.reloadPackage(packageAddress);
      }
      $world.handForPointerId(1);
      await System.import('mocha-es6/index.js');
      await promise.waitFor(()=> !!window.chai && !!window.Mocha);
      const { default: TestRunner } = await System.import("lively.ide/test-runner.js");
      const runner = new TestRunner();
      const results = await runner.runTestsInPackage('${module_to_test}');
      results.forEach(r => {
        r.tests?.forEach(t => {
          if (t.error) {
            const err = t.error;
            t.error = {
              message: err.message || String(err),
              stack: err.stack || null,
              expected: err.expected,
              actual: err.actual,
              name: err.name || null
            };
          } else {
            t.error = false;
          }
        })
      });
      JSON.stringify(results);
      `)
    } catch (err) {
      const browserErrors = this.headlessSession?.summarizeRecentConsoleErrors();
      results = JSON.stringify({
        error: err.message,
        browserErrors
      });
    } finally {
      await this.headlessSession.dispose();
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
