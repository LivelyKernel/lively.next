/* global describe, it, beforeEach, afterEach, System, lively */
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';
import { Project } from '../project.js';
import { VersionChecker } from 'lively.ide/studio/version-checker.cp.js';
import { unregisterExtension } from 'lively.resources';

describe('project Git connection preflight', () => {
  let originalImport, originalMethods, originalVersionCheck, registered, events;
  let previousPull, previousVersionCheck;

  beforeEach(() => {
    registered = promise.deferred();
    events = [];
    previousPull = lively.projectRepoPull;
    previousVersionCheck = lively.checkedProjectVersionRelation;
    originalMethods = {};
    for (const key of ['ensureGitResource', 'resetConfigFiles', 'projectDirectory', 'pullUpstreamChangesIfRemote']) {
      originalMethods[key] = Project[key];
    }
    Project.ensureGitResource = async () => { events.push('git directory'); return {}; };
    Project.resetConfigFiles = async () => { events.push('reset'); };
    Project.projectDirectory = async () => ({ join: () => ({ readJson: async () => ({ lively: {} }) }) });
    Project.pullUpstreamChangesIfRemote = async () => { events.push('pull'); };
    originalVersionCheck = VersionChecker.checkVersionRelation;
    VersionChecker.checkVersionRelation = async () => true;
    const client = {
      once () {},
      whenRegistered (timeout) { events.push(`registration ${timeout}`); return registered.promise; }
    };
    const modules = {
      'lively.modules': { importPackage: async () => {} },
      'lively.user': { currentUser: () => ({ login: 'user' }) },
      'lively.2lively/client.js': { default: { forLivelyInBrowser: () => client } },
      'lively.shell/client-command.js': { default: { installLively2LivelyServices () {} } },
      'lively.shell/client-resource.js': { resourceExtension: { name: 'preflight-fixture', matches: () => false, resourceClass: class {} } }
    };
    originalImport = System.import;
    System.import = function (id, ...args) {
      return id in modules ? Promise.resolve(modules[id]) : originalImport.call(this, id, ...args);
    };
  });

  afterEach(async () => {
    registered.resolve();
    await lively.projectRepoPull.catch(() => {});
    Object.assign(Project, originalMethods);
    VersionChecker.checkVersionRelation = originalVersionCheck;
    System.import = originalImport;
    unregisterExtension('preflight-fixture');
    lively.projectRepoPull = previousPull;
    lively.checkedProjectVersionRelation = previousVersionCheck;
  });

  it('waits for registration before resolving the shell directory or running Git', async () => {
    Project.fetchInfoPreflight('connection-fixture');
    await promise.delay(0);
    expect(events).deep.equals(['registration 30000']);
    registered.resolve();
    await lively.projectRepoPull;
    expect(events).deep.equals(['registration 30000', 'git directory', 'reset', 'pull']);
  });

  it('rejects failed registration before touching the project repository', async () => {
    Project.fetchInfoPreflight('connection-fixture');
    const result = lively.projectRepoPull.catch(error => error);
    await promise.delay(0);
    const offline = new Error('offline project server');
    registered.reject(offline);
    expect(await result).equals(offline);
    expect(events).deep.equals(['registration 30000']);
  });
});
