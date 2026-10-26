/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { part } from 'lively.morphic';
import { signal } from 'lively.bindings';
import { WorldPreviewModel } from '../studio/world-browser.cp.js';

describe('world browser session transitions', () => {
  let previous, routes, bootstrapCalls;
  beforeEach(() => {
    previous = {
      native: globalThis.livelyNative,
      frozen: lively.FreezerRuntime,
      resurrection: lively.isResurrectionBuild,
      noFastLoad: lively.doNotUseFastLoad,
      importModule: System.import,
      url: document.location.href
    };
    routes = [];
    bootstrapCalls = [];
    lively.FreezerRuntime = false;
    lively.isResurrectionBuild = false;
    lively.doNotUseFastLoad = false;
  });
  afterEach(() => {
    System.import = previous.importModule;
    lively.FreezerRuntime = previous.frozen;
    lively.isResurrectionBuild = previous.resurrection;
    lively.doNotUseFastLoad = previous.noFastLoad;
    globalThis.livelyNative = previous.native;
    window.history.replaceState({}, '', previous.url);
  });

  /** Exercise the tile's Open binding while keeping the test document alive. */
  async function open (target, project = false, progress, frozen = false) {
    const { WorldPreviewTile, ProjectPreviewTile } = lively.modules.module('lively.ide/studio/world-browser.cp.js').recorder;
    const browser = { fadeOut () {}, progressIndicator: progress };
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
        System.import = async function (id, ...args) {
          if (id === 'lively.freezer/src/util/bootstrap.js') return { bootstrap: async options => { bootstrapCalls.push(options); } };
          return previous.importModule.call(this, id, ...args);
        };
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
        System.import = previous.importModule;
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
      expect(bootstrapCalls.length).equals(1);
      expect(bootstrapCalls[0].progress).equals(progress);
      expect(bootstrapCalls[0][project ? 'projectName' : 'commit']).equals(target);
      expect(bootstrapCalls[0].fastLoad).equals(true);
    });
  }
});
