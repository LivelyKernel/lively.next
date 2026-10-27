/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { part, config } from 'lively.morphic';
import { signal } from 'lively.bindings';
import { resource } from 'lively.resources';
import { WorldBrowserModel, WorldPreviewModel } from '../studio/world-browser.cp.js';

describe('world browser session transitions', () => {
  let previous, routes, bootstrapCalls, fades;
  beforeEach(() => {
    const frozenRuntime = lively.FreezerRuntime || lively.frozenModules;
    previous = {
      native: globalThis.livelyNative,
      frozen: lively.FreezerRuntime,
      resurrection: lively.isResurrectionBuild,
      noFastLoad: lively.doNotUseFastLoad,
      importers: [...new Set([System, frozenRuntime?.oldSystem].filter(Boolean))]
        .map(loader => ({ loader, importModule: loader.import })),
      bootstrapModule: frozenRuntime?.registry?.['lively.freezer/src/util/bootstrap.js']?.contextModule,
      url: document.location.href
    };
    routes = [];
    bootstrapCalls = [];
    fades = 0;
    lively.FreezerRuntime = false;
    lively.isResurrectionBuild = false;
    lively.doNotUseFastLoad = false;
  });
  afterEach(() => {
    for (const { loader, importModule } of previous.importers) loader.import = importModule;
    lively.FreezerRuntime = previous.frozen;
    lively.isResurrectionBuild = previous.resurrection;
    lively.doNotUseFastLoad = previous.noFastLoad;
    globalThis.livelyNative = previous.native;
    window.history.replaceState({}, '', previous.url);
  });

  /** Exercise the tile's Open binding while keeping the test document alive. */
  async function open (target, project = false, progress, frozen = false) {
    const { WorldPreviewTile, ProjectPreviewTile } = lively.modules.module('lively.ide/studio/world-browser.cp.js').recorder;
    const browser = { fadeOut () { fades++; }, progressIndicator: progress };
    const tile = part(project ? ProjectPreviewTile : WorldPreviewTile, {
      ...(!project && { defaultViewModel: WorldPreviewModel }),
      viewModel: { _worldBrowser: browser, ...(project ? { _project: { _name: target } } : { _commit: target }) }
    });
    const model = tile.viewModel;
    let transition;
    const original = model.transitionToLivelyWorld;
    model.transitionToLivelyWorld = function (...args) { return transition = original.apply(this, args); };
    try {
      const button = tile.get('open button');
      const native = globalThis.livelyNative;
      try {
        // Frozen module contexts import through their retained loader and chunk ID.
        for (const { loader, importModule } of previous.importers) {
          loader.import = async function (id, ...args) {
            if (id === 'lively.freezer/src/util/bootstrap.js' ||
                (previous.bootstrapModule && this.normalizeSync(id, args[0]) === previous.bootstrapModule)) {
              return { bootstrap: async options => { bootstrapCalls.push(options); } };
            }
            return importModule.call(this, id, ...args);
          };
        }
        globalThis.livelyNative = {
          ...native,
          assetURL: url => url,
          route (route) {
            routes.push(route);
            return 'javascript:void(0)';
          }
        };
        lively.FreezerRuntime = frozen ? {} : false;
        signal(button, 'onMouseDown', {
          isAltDown: () => false,
          isClickTarget: morph => morph === button,
          positionIn: morph => morph.innerBounds().center()
        });
      } finally {
        for (const { loader, importModule } of previous.importers) loader.import = importModule;
        lively.FreezerRuntime = false;
        globalThis.livelyNative = native;
      }
      expect(transition, 'actual Open button binding').to.be.ok;
      await transition;
    } finally { tile.remove(); }
  }

  for (const project of [false, true]) {
    it('navigates an active session to the selected ' + (project ? 'project' : 'playground'), async () => {
      const name = project ? 'owner--A project & more' : 'A playground & more';
      await open(project ? name : { name, _id: 'selected-commit' }, project);
      expect(bootstrapCalls).deep.equals([]);
      expect(fades, 'keep the browser visible if beforeunload cancels navigation').equals(0);
      expect(routes.length).equals(1);
      const destination = new URL(routes[0], document.location.origin);
      expect(destination.pathname).equals(project ? '/projects/load' : '/worlds/load');
      expect(destination.searchParams.get('name')).equals(name);
      expect(destination.searchParams.get('fastLoad')).equals('false');
      expect(destination.searchParams.has('snapshot')).equals(false);
    });

    it('keeps the frozen dashboard bootstrap for a ' + (project ? 'project' : 'playground'), async () => {
      const progress = {};
      const target = project ? 'owner--project' : { name: 'playground', _id: 'selected-commit' };
      await open(target, project, progress, true);
      expect(routes).deep.equals([]);
      expect(fades).equals(1);
      expect(bootstrapCalls.length).equals(1);
      expect(bootstrapCalls[0].progress).equals(progress);
      expect(bootstrapCalls[0][project ? 'projectName' : 'commit']).equals(target);
      expect(bootstrapCalls[0].fastLoad).equals(true);
    });

    it('preserves explicit fastLoad=false in an active resurrection session for a ' + (project ? 'project' : 'playground'), async () => {
      lively.isResurrectionBuild = true;
      window.history.replaceState({}, '', '?fastLoad=false&snapshot=old-session');
      await open(project ? 'owner--project' : { name: 'playground', _id: 'selected-commit' }, project);
      expect(bootstrapCalls).deep.equals([]);
      const destination = new URL(routes[0], document.location.origin);
      expect(destination.searchParams.get('fastLoad')).equals('false');
      expect(destination.searchParams.has('snapshot')).equals(false);
    });
  }
});

describe('world browser optional local configuration', () => {
  const root = resource(System.baseURL).join('world-browser-localconfig-test/');
  let previous, calls, model;

  beforeEach(async () => {
    previous = {
      frozen: lively.FreezerRuntime,
      baseURL: window.SYSTEM_BASE_URL,
      hideScrollbars: config.hideScrollbarsInWorldBrowser
    };
    await root.ensureExistance();
    lively.FreezerRuntime = previous.frozen || {};
    window.SYSTEM_BASE_URL = root.url.replace(/\/$/, '');
    config.hideScrollbarsInWorldBrowser = false;
    calls = [];
    model = {
      async displayItems () { calls.push('items'); },
      onRefresh (property) { calls.push(property); }
    };
  });

  afterEach(async () => {
    lively.FreezerRuntime = previous.frozen;
    window.SYSTEM_BASE_URL = previous.baseURL;
    config.hideScrollbarsInWorldBrowser = previous.hideScrollbars;
    await root.remove();
  });

  it('initializes the frozen browser without a localconfig.js file', async () => {
    await WorldBrowserModel.prototype.viewDidLoad.call(model);
    expect(config.hideScrollbarsInWorldBrowser).equals(false);
    expect(calls).deep.equals(['items', 'showCloseButton']);
  });

  it('applies an existing scrollbar preference before displaying items', async () => {
    await root.join('localconfig.js').write('config.hideScrollbarsInWorldBrowser = true;');
    model.displayItems = async () => {
      expect(config.hideScrollbarsInWorldBrowser).equals(true);
      calls.push('items');
    };
    await WorldBrowserModel.prototype.viewDidLoad.call(model);
    expect(calls).deep.equals(['items', 'showCloseButton']);
  });
});
