/* global System */
import { Rectangle, rect, Color, pt } from 'lively.graphics';
import { tree, date, Path, arr, string, obj } from 'lively.lang';
import { inspect, morph, Text, config, part } from 'lively.morphic';
import KeyHandler from 'lively.morphic/events/KeyHandler.js';
import { interactivelySaveWorld } from 'lively.morphic/world-loading.js';
import { show, showAndSnapToGuides, removeSnapToGuidesOf } from 'lively.halos';
import { LoadingIndicator } from 'lively.components';

import { createMorphSnapshot } from 'lively.morphic/serialization.js';
import { BrowserModuleTranslationCache } from 'lively.modules/src/cache.js';
import * as modules from 'lively.modules';
import { once } from 'lively.bindings';
import { CodeSearch } from './code-search.cp.js';
import { WorldBrowser } from './studio/world-browser.cp.js';
import { Console } from './debug/console.cp.js';

const commands = [

  {
    name: 'clear storage and reload',
    exec: async function () {
      const proceed = await $world.confirm(['Caution\n', {}, 'Proceeding will clear all local storage and reload the page! Make sure if you want to save your world before you continue.', { fontSize: 15, fontWeight: 'normal' }], { width: 400 });
      if (proceed) {
        localStorage.clear();
        const browserModule = new BrowserModuleTranslationCache('2');
        browserModule.closeDb();
        browserModule.deleteDb();
        window.location.reload(true);
      }
    }
  },

  {
    name: 'undo',
    exec: function (world) {
      if (
        world.focusedMorph &&
        world.focusedMorph !== world &&
        world.focusedMorph.undoManager
      ) return false;
      world.env.undoManager.undo();
      return true;
    }
  },

  {
    name: 'redo',
    exec: function (world) {
      if (
        world.focusedMorph &&
        world.focusedMorph !== world &&
        world.focusedMorph.undoManager
      ) return false;
      world.env.undoManager.redo();
      return true;
    }
  },

  {
    name: 'run command',
    handlesCount: true,
    exec: async (world, args, count) => {
      const target = world.focusedMorph || world;
      const items = KeyHandler.generateCommandToKeybindingMap(target, true).map(ea => {
        const { prettyKeys, target, command: { name } } = ea;
        const targetName = target.constructor.name;
        const keysPrinted = prettyKeys ? prettyKeys.join(', ') : '';
        return {
          isListItem: true,
          value: ea,
          label: [
            `${targetName}`, {
              fontSize: '80%',
              textStyleClasses: ['v-center-text'],
              paddingRight: '10px'
            },
            `${name}`, null
          ],
          annotation: [
            keysPrinted, {
              fontSize: '80%',
              textStyleClasses: ['truncated-text'],
              paddingRight: '5px',
              maxWidth: 140
            }
          ]
        };
      });

      const { prompt, selected: [cmd] } = await world.filterableListPrompt(
        'Run command', items, {
          historyId: 'lively.morphic-run command',
          requester: target,
          extent: pt(700, 600),
          prompt: world._cachedRunCommandPrompt
        });

      world._cachedRunCommandPrompt = prompt;
      return cmd ? cmd.target.execCommand(cmd.command, args, count) : true;
    }
  },

  {
    name: 'show command history',
    exec: (world, args) => {
      const handler = world.commandHandler;
      const items = arr.sortBy(handler.history, ea => -ea.time).map(cmd => {
        return {
          isListItem: true,
          string: handler.printCommand(cmd),
          value: cmd
        };
      });
      $world.editListPrompt('select commands', items, { multiSelect: true, requester: world });
      return true;
    }
  },

  {
    name: 'show halo for focused morph',
    exec: (world) => {
      const morph = world.focusedMorph;
      world.showHaloFor(morph.getWindow() || morph, world.firstHand.pointerId);
      return true;
    }
  },

  {
    name: 'show morph',
    exec: (world, { morph, loop = false }) => {
      show(morph, loop);
    }
  },

  {
    name: 'show and snap to guides',
    exec (world, { target, showGuides, snap }) {
      showAndSnapToGuides(target, showGuides, snap);
    }
  },

  {
    name: 'remove snap to guides',
    exec: (world, target) => {
      removeSnapToGuidesOf(target);
    }
  },

  {
    name: 'copy morph',
    exec: world => {
      const morph = world.focusedMorph;
      if (!morph || morph === world) {
        $world.setStatusMessage('no morph selected');
        return true;
      }
      const target = morph.getWindow() || morph;
      const copy = target.copy();
      copy.openInWorld(target.globalPosition.addXY(10, 10));
      if (copy.isWindow) copy.activate();
      return copy;
    }
  },

  {
    name: 'select morph',
    exec: async (world, opts = {
      root: world,
      selectionFn: null,
      justReturn: false,
      requester: world,
      filterFn: null,
      prependItems: [],
      prompt: null,
      remote: false
    }) => {
      let i = 0;
      const filterFn = opts.filterFn || (() => true);
      const selectionFn = opts.selectionFn || ((title, items, opts) => world.filterableListPrompt(title, items, opts));
      const { default: ObjectPackage } = await System.import('lively.classes/object-classes.js');
      const items = arr.compact(tree.map(opts.root || world,
        (m, depth) => {
          if (!filterFn(m)) return null;
          const isObjectPackage = !!ObjectPackage.lookupPackageForObject(m);
          return {
            isListItem: true,
            label: [
                  `${String(++i)}${'\u2003'.repeat(depth)}`, {
                    fontSize: '80%',
                    textStyleClasses: ['v-center-text'],
                    paddingRight: '10px'
                  }, `${m}`, {
                    fontWeight: isObjectPackage ? 'bolder' : 'normal',
                    fontStyle: isObjectPackage ? 'normal' : 'italic',
                    fontFamily: 'Inconsolata',
                    fontSize: 16
                  }, isObjectPackage ? ' [Object Class]' : '', {
                    opacity: 0.5
                  }],
            value: m
          };
        },
        m => filterFn(m) ? m.submorphs : []));
      const actions = ['show halo', 'open object editor', 'open object inspector'];
      let lastSelected;
      const { selected: morphs, action } = await selectionFn(
        opts.prompt || 'Choose morph',
        (opts.prependItems || []).concat(items),
        {
          historyId: 'lively.morphic-select morph',
          onSelection: sel => {
            if (this.lastSelectionHalo) this.lastSelectionHalo.remove();
            if (sel && sel.show && lastSelected !== sel) {
              this.lastSelectionHalo = sel.show();
              lastSelected = sel;
            }
          },
          selectedAction: 'show halo',
          actions
        });

      if (opts.justReturn) return morphs;

      morphs.forEach(m => {
        if (action === actions[0]) world.showHaloFor(m);
        else if (action === actions[1]) world.execCommand('open object editor', { target: m });
        else if (action === actions[2]) world.execCommand('open object inspector', { target: m });
      });

      return morphs;
    }
  },

  {
    name: 'print morph(s)',
    exec: async (world) => {
      let finishedSelection = false;
      const selectedMorphs = [];
      while (!finishedSelection) {
        const [morph] = await world.execCommand('select morph', { justReturn: true });
        selectedMorphs.push(morph);
        finishedSelection = !await world.confirm('Select additional morphs?', {
          rejectLabel: 'NO'
        });
      }
      const li = LoadingIndicator.open('printing morph...');
      const { default: L2LClient } = await System.import('lively.2lively/client.js');
      const l2l = L2LClient.default();
      const peers = await l2l.listPeers(true);
      const printer = peers.find(ea => ea.type === 'pdf printer');
      const opts = { ackTimeout: 30000 };
      const msg = await l2l.sendToAndWait(printer.id, '[PDF printer] print',
        await Promise.all(selectedMorphs.map(m => createMorphSnapshot(m, { addPreview: false, testLoad: false }))), opts);
      const err = msg.error || msg.data.error;
      if (err) { world.showError(err); throw err; }
      world.serveFileAsDownload(msg.data, { fileName: selectedMorphs[0].name + (selectedMorphs.length > 1 ? '.etc' : '') + '.pdf', type: 'application/pdf' });
      li.remove();
    }
  },

  {
    name: 'escape',
    exec: (world, _1, _2, evt) => {
      const eventState = world.env.eventDispatcher.eventState;
      if (eventState.menu) eventState.menu.remove();
      const halos = world.halos();
      halos.forEach(h => h.remove());
      world.hands.forEach(ea => ea.cancelGrab(true, evt));
      const f = (arr.last(halos) && arr.last(halos).target) ||
                      world.focusedMorph || world;
      f.focus();
      if (f.isText) {
        f.selection.disableMultiSelect && f.selection.disableMultiSelect();
      }
      return false;
    }
  },

  {
    name: 'move or resize halo target',
    exec: (world, opts = { direction: 'left', offset: 1, what: 'move' }) => {
      const halo = world.halos()[0];
      if (!halo || halo.changingName) return false;
      if (world.focusedMorph !== halo) return false;

      let { direction, offset, what } = opts;
      const t = halo.target;
      offset = offset || 1;
      switch (direction) {
        case 'left': t[what === 'move' ? 'left' : 'width'] -= offset; break;
        case 'right': t[what === 'move' ? 'left' : 'width'] += offset; break;
        case 'up': t[what === 'move' ? 'top' : 'height'] -= offset; break;
        case 'down': t[what === 'move' ? 'top' : 'height'] += offset; break;
      }
      halo.alignWithTarget();
      return true;
    }
  },

  {
    name: 'close halo target',
    exec: (world) => {
      const halo = world.halos()[0];
      const focusedMorph = $world.focusedMorph;
      if (!halo ||
          halo.changingName ||
         focusedMorph.isText || focusedMorph.isNumberWidget) { return false; }
      if (halo.target.selectedMorphs) {
        halo.target.selectedMorphs.forEach(m => m.abandon());
        world.halos()[0].remove();
      } else halo.target.abandon();

      return true;
    }
  },

  {
    name: 'resize manually',
    exec: async (world, args = {}) => {
      let width; let height;
      const winBounds = world.windowBounds();
      const bounds = world.bounds();
      width = Number(args.width || await world.prompt('Enter world width', {
        input: Math.max(bounds.width, winBounds.width), requester: world
      }));
      if (typeof width === 'number') {
        height = Number(args.height || await world.prompt('Enter world height', {
          input: Math.max(bounds.height, winBounds.height), requester: world
        }));
      }

      if (typeof width === 'number' && !isNaN(width) &&
       typeof height === 'number' && !isNaN(height)) { world.extent = pt(width, height); }

      return true;
    }
  },

  {
    name: 'resize windows to fit visible world bounds',
    exec: world => {
      const windows = world.getWindows().filter(ea => !ea.minimized);
      if (!windows.length) return true;
      const visibleBounds = world.visibleBoundsExcludingTopBar();
      const windowBoundsCombined = windows.reduce((bounds, win) =>
        win.bounds().union(bounds), new Rectangle(0, 0, 0, 0));
      const scaleX = visibleBounds.width / windowBoundsCombined.width;
      const scaleY = visibleBounds.height / windowBoundsCombined.height;
      windows.forEach(ea => {
        const { x, y, width, height } = ea.bounds();
        ea.setBounds(new Rectangle(x * scaleX, y * scaleY, width * scaleX, height * scaleY));
      });
      return true;
    }
  },

  {
    name: 'window switcher',
    exec: async (world) => {
      const p = world.activePrompt();
      if (p && p.historyId === 'lively.morphic-window switcher') {
        p.focus();
        return p.get('list').execCommand('select down');
      }

      const wins = world.submorphs.filter(({ isWindow }) => isWindow).reverse()
        .map(win => ({ isListItem: true, string: win.title || String(win), value: win }));
      wins.forEach(m => {
        m.value.opacity = 0.5;
        m.value.blur = 1;
      });
      let selectedWindow;
      let prevMinimizedState;
      const answer = await world.filterableListPrompt(
        'Choose window', wins, {
          preselect: 1,
          requester: world,
          historyId: 'lively.morphic-window switcher',
          onSelection: sel => {
            if (selectedWindow) {
              selectedWindow.minimized = prevMinimizedState;
              selectedWindow.blur = 1;
              selectedWindow.animate({
                opacity: 0.3, duration: 200
              });
            }
            selectedWindow = sel;
            if (sel) {
              sel.animate({ opacity: 1, duration: 200 });
              sel.blur = 0;
              prevMinimizedState = sel.minimized;
              sel.minimized = false;
            }
          },
          width: world.visibleBounds().extent().x * 1 / 3,
          itemPadding: Rectangle.inset(4)
        });
      const { selected: [win] } = answer;
      wins.forEach(m => {
        m.value.opacity = 1;
        m.value.blur = 0;
      });
      if (win) {
        win.activate();
        win.minimized = false;
      }
      return true;
    }
  },

  {
    name: 'close active window or morph',
    exec: world => {
      const focused = world.focusedMorph;
      if (!focused) return true;
      let win = focused.getWindow();
      world.undoStart('window close');
      if (win) win.close();
      else {
        arr.last(arr.without(focused.ownerChain(), world)).remove();
        win = world.activeWindow();
        win && win.activate();
      }
      world.undoStop('window close');
      return true;
    }
  },

  {
    name: 'toggle minimize active window',
    exec: world => {
      const win = world.activeWindow();
      win && win.toggleMinimize();
      return true;
    }
  },

  {
    name: 'toggle minimize all windows',
    exec: world => {
      const allWindows = world.getWindows();
      allWindows && allWindows.map(w => w.toggleMinimize());
      return true;
    }
  },

  {
    name: 'toggle minimize all except active window',
    exec: world => {
      const allWindowsExceptActive = world.getWindows().filter(w => !w.isActive());
      allWindowsExceptActive && allWindowsExceptActive.map(w => w.toggleMinimize());
      return true;
    }
  },

  {
    name: 'close all except active window',
    exec: world => {
      const allWindowsExceptActive = world.getWindows().filter(w => !w.isActive());
      allWindowsExceptActive && allWindowsExceptActive.map(w => w.close());
      return true;
    }
  },

  {
    name: 'close all like this window',
    exec: world => {
      const activeWindow = world.getWindows().filter(w => w.isActive())[0];
      const type = activeWindow.name.replace('window for', '');
      const allWindowsLikeThis = world.getWindows().filter(w => w.name.replace('window for', '') === type);
      allWindowsLikeThis.map(w => w.close());
      return true;
    }
  },

  {
    name: 'close all windows',
    exec: world => {
      const allWindows = world.getWindows();
      allWindows && allWindows.map(w => w.close());
      return true;
    }
  },

  {
    name: 'open status message of focused morph',
    exec: world => {
      const focused = world.focusedMorph;
      const [msg] = focused ? world.visibleStatusMessagesFor(focused) : [];
      if (msg) { msg.expand(); msg.focus(); }
      return msg || true;
    }
  },

  {
    name: 'resize active window',
    exec: async function (world, opts = { how: null, window: null }) {
      let { window, how } = opts;
      const win = window || world.activeWindow();

      if (!win) return;

      const worldB = world.visibleBoundsExcludingTopBar().insetBy(15);
      const winB = win.bounds();
      // FIXME!
      if (!win._normalBounds) win._normalBounds = winB;

      const thirdWMin = 700;
      const thirdW = Math.min(thirdWMin, Math.max(1000, worldB.width / 3));
      const thirdColBounds = worldB.withWidth(thirdW);

      if (!how) how = await askForHow();
      if (!how) return;

      win.setBounds(resizeBounds(how, worldB));
      if (how === 'reset') delete win._normalBounds;

      return true;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      async function askForHow () {
        const { selected: [how] } = await world.filterableListPrompt('How to resize the window?', [
          'full', 'center', 'right', 'left', 'bottom',
          'top', 'reset'], { requester: world });
        return how;
      }

      function resizeBounds (how, bounds) {
        switch (how) {
          case 'full': return worldB;
          case 'col1':
          case 'left': return thirdColBounds.withTopLeft(worldB.topLeft());
          case 'col2':
          case 'center': return thirdColBounds.withCenter(worldB.center());
          case 'col3':
          case 'right': return thirdColBounds.translatedBy(pt(worldB.width - thirdW, 0));
          case 'top': return worldB.divide([rect(0, 0, 1, 0.5)])[0];
          case 'bottom': return worldB.divide([rect(0, 0.5, 1, 0.5)])[0];
          case 'reset': return win._normalBounds || pt(500, 400).extentAsRectangle().withCenter(bounds.center());
          default: return bounds;
        }
      }
    }
  },

  {
    name: '[recovery] show last object editor saves',
    exec: (world, opts) => {
      return world.execCommand('[recovery] show last doits', {
        ...opts,
        title: 'logged ObjectEditor save',
        logAccessFn: () => JSON.parse(localStorage['oe helper']).saves
      });
    }
  },

  {
    name: '[recovery] show last doits',
    description: 'browse a list of your last doits',
    exec: async (world, opts = {}) => {
      let { logAccessFn } = opts;
      if (!logAccessFn) logAccessFn = () => JSON.parse(localStorage['lively.next-js-ide-doitlog']);
      let log;
      try { log = logAccessFn(); } catch (err) {}
      if (!log) return world.inform('no log yet');
      const normalizedLog = arr.sortBy(log.map((ea, i) => {
        const source = typeof ea === 'string' ? ea : ea.source;
        const time = typeof ea === 'string' ? i : (ea.time || i);
        const printedTime = date.format(new Date(time), 'yy-mm-dd HH:MM');
        return { time, source, printedTime };
      }), ea => -ea.time);
      const items = normalizedLog.map((ea, i) => {
        return {
          isListItem: true,
          string: `[${ea.printedTime}] ${ea.source.slice(0, 100).replace(/\n/g, '').trim()}`,
          value: ea
        };
      });
      const { selected: coices } = await world.filterableListPrompt('select doit code', items, {
        multiSelect: true, requester: world
      });
      if (coices.length) {
        const sources = [];
        for (const coice of coices) {
          const { source, printedTime } = coice;
          sources.push(`// ${printedTime}\n${source}`);
        }
        return world.execCommand('open workspace',
          { title: 'logged doits', mode: 'js', ...opts, content: sources.join('\n\n') });
      }
      return true;
    }
  },

  {
    name: 'open loading indicator',
    exec: (world, message) => {
      let props = {};
      if (typeof message === 'object') {
        props = message;
        message = props.label;
      }
      return LoadingIndicator.open(message, props);
    }
  },

  {
    name: 'open workspace',
    exec: async (world, opts = {}, _, evt) => {
      const relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;

      let language = opts.language || opts.mode || 'javascript';
      const workspaceModules = {
        javascript: 'lively.ide/js/workspace.js',
        shell: 'lively.ide/shell/workspace.js',
        html: 'lively.ide/html/workspace.js',
        py: 'lively.ide/py/workspace.js',
        md: 'lively.ide/md/workspace.js',
        sql: 'lively.ide/sql/workspace.js',
        css: 'lively.ide/css/workspace.js',
        less: 'lively.ide/css/less/workspace.js',
        text: null
      };
      const alias = Object.keys(config.ide.modes.aliases).reduce((inverted, ea) =>
        Object.assign(inverted, { [config.ide.modes.aliases[ea]]: ea }), {});

      if (opts.askForMode) {
        const workspaceLanguages = Object.keys(workspaceModules).concat('javascript console');
        ({ selected: [language] } = await world.filterableListPrompt(
          'Open workspace for...', workspaceLanguages));
        if (!language) return true;
      }

      if (language === 'javascript console') { return world.execCommand('open console', opts); }

      opts = { content: '', ...opts, mode: language, language };
      const mod = workspaceModules[opts.language] || workspaceModules[alias[opts.language]];

      if (language === 'text' || !mod) { return world.execCommand('open text window', { ...config.codeEditor.modes.text, ...opts }); }

      const { default: Workspace } = await System.import(mod);
      return new Workspace({
        title: opts.title || opts.language + ' workspace',
        center: world.center,
        content: opts.content,
        target: opts.target,
        systemInterface: opts.systemInterface || opts.backend
      }).activate();
    }
  },

  {
    name: 'open shell workspace',
    exec: (world, opts) => world.execCommand('open workspace', { ...opts, language: 'shell' })
  },

  {
    name: 'open javascript workspace',
    exec: (world, opts) => world.execCommand('open workspace', { ...opts, language: 'javascript' })
  },

  {
    name: 'open shell terminal',
    exec: async (world, opts) => {
      const { default: Terminal } = await System.import('lively.ide/shell/terminal.js');
      return Terminal.open(opts).openInWorldNearHand();
    }
  },

  {
    name: 'open text window',
    exec: (world, opts = {}) => {
      let { title, extent, content, mode, name, rangesAndStyles } = opts;
      title = title || 'text window';
      content = content || '';
      extent = extent || pt(500, 400);
      name = name || 'text workspace';
      const textAndAttributes = typeof content === 'string' ? [content, null] : content;
      const text = new Text({
        fill: Color.white,
        readOnly: false,
        padding: Rectangle.inset(3),
        ...obj.dissoc(opts, ['title', 'content']),
        textAndAttributes,
        clipMode: 'auto',
        name,
        extent
      });
      if (rangesAndStyles) { text.setTextAttributesWithSortedRanges(rangesAndStyles); }
      if (mode) text.changeEditorMode(mode);
      return world.openInWindow(text, { title }).activate();
    }
  },

  {
    name: 'diff and open in window',
    exec: async (world, opts = {}) => {
      // $world.execCommand("diff and open in window", {a: {foo: 23}, b: {bax: 23, foo: 23}})
      // $world.execCommand("diff and open in window", {a: "Hello\nworld", b: "Helo\nworld"})
      // $world.execCommand("diff and open in window", {a: "Hello\nworld", b: "Helo\nworld", format: "diffChars"})
      // $world.execCommand("diff and open in window", {a: "Hello\nworld", b: "Helo\nworld", format: "diffSentences"})
      // $world.execCommand("diff and open in window", {a: "Hello\nworld", b: "Helo\nworld", format: "patch"})

      let { a = '', b = '', format = null, extent = pt(500, 600) } = opts;
      if (!format) {
        ({ a, b, format } = findFormat(a, b));
      } else { a = String(a); b = String(b); }

      const diff = await System.import('esm://cache/diff@5.0.0');

      let diffed;

      diffed = await diffInWindow(a, b, { fontFamily: 'monospace', ...opts, format });

      function findFormat (a, b) {
        if (obj.isPrimitive(a) || a instanceof RegExp ||
         obj.isPrimitive(b) || b instanceof RegExp) { a = String(a); b = String(b); }
        if (typeof a !== 'string' || typeof b !== 'string') { try { JSON.stringify(a); JSON.stringify(b); return { format: 'diffJson', a, b }; } catch (e) { a = String(a); b = String(b); } }
        return { format: 'diffLines', a, b };
      }

      async function diffInWindow (a, b, opts) {
        const { format } = opts;
        let plugin = null; let content;

        if (format === 'patch') {
          const { headerA, headerB, filenameA, filenameB, context } = opts;
          content = [diff.createTwoFilesPatch(
            filenameA || 'a', filenameB || 'b', a, b,
            headerA, headerB, typeof context === 'number' ? { context } : undefined), {}];
          const { default: DiffEditorPlugin } = await System.import('lively.ide/diff/editor-plugin.js');
          plugin = new DiffEditorPlugin();
        } else {
          diffed = diff[format](a, b, opts);
          content = diffed.flatMap(({ count, value, added, removed }) => {
            const attribute = removed
              ? { fontWeight: 'normal', textDecoration: 'line-through', fontColor: Color.red }
              : added
                ? { fontWeight: 'bold', textDecoration: '', fontColor: Color.green }
                : { fontWeight: 'normal', textDecoration: '', fontColor: Color.darkGray };
            return [value, attribute];
          });
        }

        const win = world.execCommand('open text window', opts);
        const textMorph = win.targetMorph;
        win.extent = extent || pt(300, 200).maxPt(textMorph.textBounds().extent());

        textMorph.textAndAttributes = content;
        if (plugin) textMorph.addPlugin(plugin);

        return textMorph;
      }

      return diffed;
    }
  },

  {
    name: 'diff workspaces',
    exec: async function (world, opts = {}) {
      let { editor1, editor2 } = opts;

      let editors = [];
      if (!editor1 || !editor2) {
        editors = world.withAllSubmorphsSelect(ea =>
          ea.isText && !ea.isInputLine && !ea.isUsedAsEpiMorph()).reverse();
      }
      if (!editor1) editor1 = await selectMorph(editors);
      if (!editor1) return world.setStatusMessage('Canceled');
      if (!editor2) editor2 = await selectMorph(arr.without(editors, editor1));
      if (!editor2) return world.setStatusMessage('Canceled');

      return doDiff(editor1, editor2);

      function doDiff (ed1, ed2) {
        const p1 = ed1.pluginFind(ea => ea.evalEnvironment);
        const fn1 = (p1 && p1.evalEnvironment.targetModule) || 'no file';
        const p2 = ed2.pluginFind(ea => ea.evalEnvironment);
        const fn2 = (p2 && p2.evalEnvironment.targetModule) || 'no file';
        return world.execCommand('diff and open in window', {
          a: ed1.textString,
          b: ed2.textString,
          filenameA: fn1,
          filenameB: fn2
        });
      }

      async function selectMorph (morphs, thenDo) {
        const candidates = morphs.map(ea =>
          ({ isListItem: true, value: ea, string: ea.name || String(ea) }));
        const { selected: [choice] } = await world.filterableListPrompt(
          'choose text: ', candidates, {
            onSelection: m => {
              m && m.show();
            }
          });
        return choice;
      }
    }
  },

  {
    name: 'search workspaces',
    exec: async function () {
      const { selected: [choice] } = await $world.filterableListPrompt('search workspaces', [], {
        historyId: 'lively.morphic-ide-search-workspaces-hist',
        customize: function (listPrompt) {
          listPrompt.getSubmorphNamed('list').updateFilter = function () {
            const parsed = this.parseInput();
            if (parsed.input.length < 3) return;
            const morphs = findWindowOrMorphWithStrings(parsed.lowercasedTokens);
            this.listMorph.items = morphsToCandidates(morphs, parsed.lowercasedTokens);
          };
        }
      });

      if (choice) {
        const { morph, window: win, row } = choice;
        if (win) {
          if (win.minimized) win.toggleMinimize();
          win.activate();
        }
        (win || morph).show();
        this.cursorPosition = { row, column: 0 };

        return morph;
      }

      return null;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      function morphsToCandidates (morphs, tokens) {
        return morphs.map(function (m) {
          const win = m.world() ? m.getWindow() : $world.withAllSubmorphsDetect(m => m.isWindow && m.targetMorph === morph);
          let row = 0;
          const preview = string.lines(m.textString).find((l, i) => {
            l = l.toLowerCase(); row = i;
            return tokens.every(token => l.includes(token));
          });
          const title = win ? win.title : m.toString();
          return preview
            ? {
                isListItem: true,
                string: title + ' | ' + preview,
                value: { window: win, morph: m, row }
              }
            : null;
        }).filter(Boolean);
      }

      function findWindowOrMorphWithStrings (strings) {
        return $world.withAllSubmorphsDo(morph => {
          // collapsed window's codeeditor is not in world, pluck them manually
          if (morph.isWindow && morph.minimized && morph.targetMorph && morph.targetMorph.isText) morph = morph.targetMorph;
          if (!morph.textString) return null;
          if (!morph.isText) return null;
          if (morph.isUsedAsEpiMorph()) return null;
          const textString = morph.textString.toLowerCase();
          if (!strings.every(string => textString.includes(string))) return null;
          return morph;
        }).filter(Boolean);
      }
    }
  },

  {
    name: 'browse and load component',
    exec: async function (world) {
      const li = LoadingIndicator.open('loading component browser');
      const { ComponentBrowser } = await System.import('lively.ide/studio/component-browser.cp.js');
      if (!world._componentsBrowser) await li.whenRendered();
      const componentsBrowser = world._componentsBrowser || (world._componentsBrowser = part(ComponentBrowser));
      li.remove();
      const loadedComponent = await componentsBrowser.activate();
      if (loadedComponent && !loadedComponent.world()) { loadedComponent.openInWorld(); }
    }
  },

  {
    name: 'open console',
    exec: () => { part(Console).openInWindow(); }
  },

  {
    name: 'open object drawer',
    exec: async function (world) {
      const { default: ObjectDrawer } = await System.import('lively.components/object-drawer.js');
      return new ObjectDrawer().openInWorldNearHand();
    }
  },

  {
    name: 'open object editor',
    exec: async function (world, args = {
      target: null,
      selectedClass: null,
      selectedMethod: null,
      evalEnvironment: null
    }) {
      if (!args.target) {
        world.setStatusMessage('No target for ObjectEditor');
        return null;
      }
      const li = args.loadingIndicator = LoadingIndicator.open('Open Object Editor...');
      const ObjectEditor = await System.import('lively.ide/js/objecteditor/ui.cp.js');
      const ed = await ObjectEditor.open(args);
      li.remove();
      return ed;
    }
  },

  {
    name: 'open object inspector',
    exec: async (world, args = { target: null }) => {
      if (!args.target) {
        world.setStatusMessage('no target for Inspector');
        return null;
      }
      return inspect(args.target);
    }
  },

  {
    name: 'inspect server',
    exec: async (world) => {
      const Inspector = await System.import('lively.ide/js/inspector/ui.cp.js');
      const { serverInterfaceFor } = await System.import('lively-system-interface');
      const remote = serverInterfaceFor(System.baseURL + 'eval');
      const evalEnvironment = {
        format: 'esm',
        context: 'global',
        targetModule: 'lively://lively.next-workspace/world',
        sourceURL: 'inspect-server_' + Date.now(),
        systemInterface: remote
      };
      await remote.runEval(`
           import LivelyServer from "lively.server/server.js";
           let server = LivelyServer.servers.values().next().value;
        `, evalEnvironment);
      Inspector.openInWindow({ remoteTarget: { code: 'server', evalEnvironment } });
    }
  },

  {
    name: 'open browser',
    progressIndicator: 'opening browser...',
    exec: async (world, args = { packageName: 'lively.morphic', moduleName: 'morph.js', scroll: pt(0, 0) }, _, evt) => {
      // in case there is another morph implementing open browser...
      const relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;

      const Browser = await System.import('lively.ide/js/browser/ui.cp.js');
      let browser;
      if (args) {
        const loc = obj.select(args, ['packageName', 'moduleName', 'textPosition', 'codeEntity', 'systemInterface', 'scroll']);
        browser = await Browser.browse(loc, { extent: pt(700, 600) });
      } else {
        browser = await Browser.open();
      }
      browser.getWindow().activate();
      return browser;
    }
  },

  {
    name: 'choose and browse package resources',
    progressIndicator: 'browsing resources...',
    exec: async (world, opts = { browser: null, systemInterface: null }, _, evt) => {
      const relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;

      let browser = opts.browser ||
           (world.focusedMorph && world.focusedMorph.ownerChain().find(ea => ea.isBrowser));

      if (browser && browser.isBrowser) { browser = browser.getWindow(); } else browser = null;

      const { localInterface } = await System.import('lively-system-interface');
      const systemInterface = opts && opts.systemInterface
        ? opts.systemInterface
        : browser ? browser.systemInterface : localInterface;
      const pkgs = await systemInterface.getPackages({ excluded: config.ide.js.ignoredPackages });
      const items = [];

      for (const p of pkgs) {
        const excluded = (Path('lively.ide.exclude').get(p) || []).map(ea =>
          ea.includes('*') ? new RegExp(ea.replace(/\*/g, '.*')) : ea);
        excluded.push('.git', 'node_modules', '.module_cache');
        items.push(...(await systemInterface.resourcesOfPackage(p, excluded))
          .filter(({ url }) => !url.endsWith('/') && !excluded.some(ex => ex instanceof RegExp ? ex.test(url) : url.includes(ex)))
          .sort((a, b) => {
            if (a.isLoaded && !b.isLoaded) return -1;
            if (!a.isLoaded && b.isLoaded) return 1;
            if (a.nameInPackage.toLowerCase() < b.nameInPackage.toLowerCase()) return -1;
            if (a.nameInPackage.toLowerCase() === b.nameInPackage.toLowerCase()) return 0;
            return 1;
          })
          .map(resource => {
            const string = `[${p.name}] ${resource.nameInPackage}${resource.isLoaded ? '' : ' [not loaded]'}`;
            return { isListItem: true, string, value: resource };
          }));
      }

      const { selected } = await world.filterableListPrompt(
        'Choose module to open', items, {
          historyId: 'lively.morphic-choose and browse package resources',
          requester: browser,
          width: 700,
          multiSelect: true,
          fuzzy: 'value.shortName'
        });
      const [jsModules, nonJsModules] = arr.partition(selected, ea => ea.url.match(/\.js(on)?/));
      const { default: Browser } = await System.import('lively.ide/js/browser/index.js');

      await Promise.all(jsModules.map(ea => {
        const loc = { packageName: ea.package, moduleName: ea.url };
        return Browser.browse(loc, browser, systemInterface)
          .then(browser => browser.activate());
      }));

      if (nonJsModules.length) { await Promise.all(nonJsModules.map(({ url }) => world.execCommand('open file', { url }))); }

      return true;
    }
  },

  {
    name: 'choose and browse module',
    progressIndicator: 'browsing module...',
    handlesCount: true,
    exec: async (world, opts = { browser: undefined, systemInterface: undefined }, count) => {
      let focused;
      if (!opts.browser) { // invoked from a file browser? => use it
        focused = world.focusedMorph;
        const win = focused && focused.getWindow();
        if (win && win.targetMorph && win.targetMorph.isFileBrowser) { return win.targetMorph.execCommand('find file and select', opts, count); }
      }

      const browser = opts.browser ||
                 (focused && focused.ownerChain().find(ea => ea.isBrowser));
      const Browser = await System.import('lively.ide/js/browser/ui.cp.js');
      const { localInterface } = await System.import('lively-system-interface');
      const systemInterface = opts && opts.systemInterface
        ? opts.systemInterface
        : browser ? browser.systemInterface : localInterface;
      const locationString = systemInterface.name === 'local'
        ? ''
        : ` on [${
              string.truncate(systemInterface.name, 35, '...')
          }]`;
      const pkgs = await systemInterface.getPackages();
      let items = [];

      for (const p of pkgs) {
        let excluded = Path('lively.ide.exclude').get(p) || [];
        excluded = excluded.map(ea => ea.includes('*') ? new RegExp(ea.replace(/\*/g, '.*')) : ea);
        for (const m of p.modules) {
          if (excluded.some(ex => ex instanceof RegExp ? ex.test(m.name) : m.name.includes(ex))) continue;
          const shortName = systemInterface.shortModuleName(m.name, p);
          items.push({
            isListItem: true,
            string: `[${p.name}] ${shortName}`,
            value: { package: p, module: m, shortName }
          });
        }
      }

      items = arr.sortBy(items, ea => ea.string);
      (async () => {
        const requester = browser || focused;
        const { selected } = await world.filterableListPrompt(
             `Choose module to open${locationString}`, items, {
               historyId: 'lively.morphic-choose and browse module',
               requester,
               height: Math.min(requester.height, 700),
               width: 500,
               multiSelect: true,
               listFontColor: 'white',
               fuzzy: 'value.shortName'
             });

        for (let i = 0; i < selected.length; i++) {
          const { package: p, shortName } = selected[i];
          const loc = { packageName: p.name, moduleName: shortName };
          const b = await Browser.browse(
            loc, i === 0 ? browser : undefined, systemInterface);
          b.moveBy(pt(i * 20, i * 20));
          b.getWindow().activate();
        }
      })();

      return true;
    }
  },

  {
    name: 'open code search',
    progressIndicator: 'opening code search...',
    exec: async (world, opts = { browser: null, systemInterface: null, input: null }) => {
      const activeMorphs = world.focusedMorph ? world.focusedMorph.ownerChain() : [];
      let browser = opts.browser || activeMorphs.find(ea => ea.isBrowser);

      const li = LoadingIndicator.open('loading code search');

      if (browser && browser.isBrowser) {
        if (browser.associatedSearchPanel) {
          li.remove();
          browser.associatedSearchPanel.browser = browser;
          return browser.associatedSearchPanel.getWindow().activate();
        }
      } else browser = null;

      const { localInterface } = await System.import('lively-system-interface');
      let systemInterface = opts.systemInterface || (browser && browser.systemInterface);
      if (!systemInterface) {
        const ed = activeMorphs.find(ea =>
          ea.isText && ea.editorPlugin && ea.editorPlugin.isJSEditorPlugin);
        if (ed) systemInterface = ed.editorPlugin.systemInterface();
        else systemInterface = localInterface;
      }

      const searcher = part(CodeSearch);
      Object.assign(searcher, {
        browser,
        input: opts.input,
        systemInterface
      });

      searcher.openInWindow();
      searcher.focus();

      li.remove();

      if (browser) browser.associatedSearchPanel = searcher;
      return searcher;
    }
  },

  {
    name: 'open test runner',
    progressIndicator: 'opening test runner...',
    exec: async world => {
      const { default: TestRunner } = await System.import('lively.ide/test-runner.js');
      return await TestRunner.open();
    }
  },

  {
    name: 'open file browser',
    progressIndicator: 'opening file browser...',
    exec: async (world, opts = {}) => {
      const { default: HTTPFileBrowser } = await System.import('lively.ide/http-file-browser.js');
      const { location, url, file } = opts;
      const browser = file
        ? HTTPFileBrowser.forFile(file, location)
        : HTTPFileBrowser.forLocation(url || location || document.location.origin);
      return world.openInWindow(browser).activate();
    }
  },

  {
    name: 'open file',
    progressIndicator: 'opening file...',
    exec: async (world, opts = { url: null, lineNumber: null, reuse: false }) => {
      let { url, lineNumber, reuse } = opts;
      const li = world.commandHandler.progressIndicator;
      if (!url) {
        li.visible = false;
        url = await world.prompt('Enter file location', {
          historyId: 'lively.morphic-text editor url',
          useLastInput: true
        });
        li.visible = true;
      }
      if (reuse) {
        const editor = arr.findAndGet(world.getWindows(), ea => {
          const t = ea.targetMorph;
          return t && t.isTextEditor && t.location.split(':')[0] === url ? t : null;
        });
        if (editor) {
          if (typeof lineNumber === 'number') { editor.lineNumber = lineNumber; }
          return editor.getWindow().activate();
        }
      }

      if (lineNumber) url += ':' + lineNumber;
      const { default: TextEditor } = await System.import('lively.ide/text/text-editor.js');
      return url ? TextEditor.openURL(url, obj.dissoc(opts, ['url'])) : null;
    }
  },

  {
    name: 'open file for EDITOR',
    exec: async (world, opts = { url: null, lineNumber: null }) => {
      // for using from command line, see l2l default client actions and
      // lively.shell/bin/lively-as-editor.js
      const { default: TextEditor } = await System.import('lively.ide/text/text-editor.js');
      const { url } = opts;
      // "saved" || "aborted"
      return await TextEditor.openAsEDITOR(url, {});
    }
  },

  {
    name: '[lively.installer] publish new version of a package',
    exec: async world => {
      await lively.modules.registerPackage(
        document.location.origin + '/lively.installer');
      const { default: publishPackage } = await System.import(
        'lively.installer/packages/publish-new-package-version.js');
      await publishPackage();
      return true;
    }
  },

  {
    name: 'report a bug',
    exec: async world => {
      window.open('https://github.com/LivelyKernel/lively.next/issues/new', '_blank');
      return true;
    }
  },

  {
    name: 'fix font metric',
    exec: async world => {
      world.env.fontMetric.reset();
      world.withAllSubmorphsDo(ea => ea.isText && ea.textLayout && ea.textLayout.reset());
      return true;
    }
  },

  {
    name: 'delete change history',
    exec: world => {
      const { env } = world;
      const status = env.printStatus();
      env.deleteHistory();
      world.setStatusMessage(status);
      if (world._componentsBrowser) { world._componentsBrowser.reset(); }
      return true;
    }
  },

  {
    name: 'install global inspect and show',
    exec: world => {
      window.show = show;
      window.inspect = inspect;
      world.setStatusMessage('inspect() and show() are now globally available');
      return true;
    }
  },

  {
    name: 'save world',
    exec: async (world, args, _, evt) => {
      // in case there is another morph implementing save...
      const relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;
      args = { confirmOverwrite: true, showSaveDialog: true, moduleManager: modules, ...args };
      const focused = world.focusedMorph;
      const saved = await interactivelySaveWorld(world, args);
      if (focused && focused.focus());
      return saved;
    }
  },

  {
    name: 'freeze world',
    exec: async (world) => {
      let freezer = await System.import('lively.freezer');
      await freezer.interactivelyFreezeWorld(world);
    }
  },

  {
    name: 'save this world',
    exec: (world, args, _, evt) => {
      return world.execCommand('save world', { confirmOverwrite: true, ...args, showSaveDialog: false });
    }
  },

  {
    name: 'load world',
    exec: async (oldWorld, args = {}) => {
      // args: {
      //   id: commitId
      //   name: world name
      //   ref: ref the world was committed on
      //   world: the world morph to load
      // }
      const { id, commit, name, ref, world } = args;
      const World = oldWorld.constructor;

      if (world) return World.loadWorld(world, oldWorld, { moduleManager: modules });
      if (id || commit) return World.loadFromCommit(id || commit, oldWorld, { moduleManager: modules });
      if (name) return World.loadFromDB(name, ref, oldWorld, { moduleManager: modules });

      const li = LoadingIndicator.open('loading project browser...');
      await li.whenRendered();

      const fader = morph({ fill: Color.black.withA(0.5), extent: oldWorld.extent, name: 'dark overlay', opacity: 0, reactsToPointer: false, renderOnGPU: true, halosEnabled: false });
      fader.openInWorld(pt(0, 0));
      fader.animate({ opacity: 1, duration: 300 });

      const worldList = oldWorld.get('a project browser') || part(WorldBrowser, { name: 'a project browser' });
      worldList.name = 'a project browser';
      worldList.hasFixedPosition = true;
      worldList.epiMorph = true;
      worldList.bringToFront().alignInWorld(oldWorld);
      worldList.update();
      worldList.focus();
      once(worldList, 'remove', () => fader.animate({ opacity: 0 }).then(() => fader.remove()));
      li.remove();
      return worldList;
    }
  },

  {
    name: 'add external package dependency to object',
    exec: async (world, opts = {}) => {
      const object = opts.target || world;
      const externalPackages = (object.metadata && object.metadata.externalPackages) || [];
      const { list } = await world.editListPrompt(
        'modify package dependencies of ' + object, externalPackages);
      if (!list) return;
      if (!list.length) {
        if (object.metadata) { delete object.metadata.externalPackages; }
      } else {
        if (!object.metadata) object.metadata = {};
        object.metadata.externalPackages = list;
      }
      return true;
    }
  }
];

export default commands;
