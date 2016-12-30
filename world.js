/*global System*/
import { Rectangle, Color, pt, rect } from "lively.graphics";
import { tree, arr, string, obj, promise } from "lively.lang";
import { Halo } from "./halo/morph.js"
import { Menu } from "./menus.js"
import { show, StatusMessage } from "./markers.js";
import { Morph, Text, Window, config, MorphicEnv } from "./index.js";
import { TooltipViewer } from "./tooltips.js";
import KeyHandler from "./events/KeyHandler.js";

import {
  AbstractPrompt,
  InformPrompt,
  ConfirmPrompt,
  MultipleChoicePrompt,
  TextPrompt,
  PasswordPrompt,
  ListPrompt,
  EditListPrompt
} from "./prompts.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--

var worldCommands = [

  {
    name: "undo",
    exec: world => {
      if (world.focusedMorph && world.focusedMorph !== world && world.focusedMorph.undoManager)
        return false;
      world.env.undoManager.undo();
      return true;
    }
  },

  {
    name: "redo",
    exec: world => {
      if (world.focusedMorph && world.focusedMorph !== world && world.focusedMorph.undoManager)
        return false;
      world.env.undoManager.redo();
      return true;
    }
  },

  {
    name: "run command",
    handlesCount: true,
    exec: async (world, args, count) => {
      var items = KeyHandler.generateCommandToKeybindingMap(world.focusedMorph || world, true).map(ea => {
            var {prettyKeys, target, command: {name}} = ea,
                targetName = target.constructor.name,
                keysPrinted = prettyKeys ? prettyKeys.join(", ") : "";
            return {
              isListItem: true,
              label: [
                [`${targetName}`, {fontSize: "70%", textStyleClasses: ["v-center-text"], top: "-8%", paddingRight: "10px"}],
                [`${name}`, {}]],
              annotation: [keysPrinted, {fontSize: "70%", textStyleClasses: ["truncated-text"], maxWidth: 140}],
              value: ea
            };
          }),
          {prompt, selected: [cmd]} = await world.filterableListPrompt(
            "Run command", items, {
              historyId: "lively.morphic-run command",
              extent: pt(700,900), prompt: world._cachedRunCommandPrompt})
      world._cachedRunCommandPrompt = prompt;
      return cmd ? cmd.target.execCommand(cmd.command, args, count) : true;
    }
  },

  {
    name: "show halo for focused morph",
    exec: (world) => {
      var morph = world.focusedMorph;
      world.showHaloFor(morph.getWindow() || morph, world.firstHand.pointerId);
      return true;
    }
  },

  {
    name: "select morph",
    exec: async (world, opts = {root: world, justReturn: false, filterFn: null, prependItems: [], prompt: null}) => {
      var filterFn = opts.filterFn || (() => true),
          i = 0,
          items = arr.compact(tree.map(opts.root || world,
            (m, depth) => filterFn(m) ?
              {isListItem: true, string: `${++i} ${"  ".repeat(depth)}${m}`, value: m} : null,
            m => filterFn(m) ? m.submorphs : [])),
          {selected: morphs} = await world.filterableListPrompt(
            opts.prompt || "Choose morph",
            (opts.prependItems || []).concat(items),
            {historyId: "lively.morphic-select morph",
             onSelection: sel => sel && sel.show && sel.show()});
      if (!opts.justReturn)
        morphs[0] && world.showHaloFor(morphs[0]);
      return morphs;
    }
  },

  {
    name: "escape",
    exec: (world) => {
      var eventState =  world.env.eventDispatcher.eventState;
      if (eventState.menu) eventState.menu.remove();
      var halos = world.halos();
      halos.forEach(h => h.remove());
      var focusTarget = (arr.last(halos) && arr.last(halos).target) || world.focusedMorph || world;
      focusTarget.focus();
      return false;
    }
  },

  {
    name: "move or resize halo target",
    exec: (world, opts = {direction: "left", offset: 1, what: "move"}) => {
      var halo = world.halos()[0];
      if (!halo) return false;

      var {direction, offset, what} = opts,
          t = halo.target;
      offset = offset || 1;
      switch (direction) {
        case "left": t[what === "move" ? "left" : "width"] -= offset; break;
        case "right": t[what === "move" ? "left" : "width"] += offset; break;
        case "up": t[what === "move" ? "top" : "height"] -= offset; break;
        case "down": t[what === "move" ? "top" : "height"] += offset; break;
      }
      halo.alignWithTarget();
      return true;
    }
  },

  {
    name: "resize to fit window",
    exec: (world) => {
      delete world._cachedWindowBounds;
      world.extent = world.windowBounds().extent();
      return true;
    }
  },

  {
    name: "window switcher",
    exec: async (world) => {
      var p = world.activePrompt();
      if (p && p.historyId === "lively.morphic-window switcher") {
        p.focus();
        return p.get("list").execCommand("select down");
      }

      var wins = world.submorphs.filter(({isWindow}) => isWindow).reverse()
            .map(win => ({isListItem: true, string: win.title || String(win), value: win})),
          answer = await world.filterableListPrompt(
            "Choose window", wins, {
              preselect: 1,
              historyId: "lively.morphic-window switcher",
              onSelection: sel => sel && sel.show(),
              width: world.visibleBounds().extent().x * 1/3,
              labelFontSize: 16,
              listFontSize: 16,
              itemPadding: Rectangle.inset(4)
            }),
          {selected: [win]} = answer;
      win && win.activate();
      return true;
    }
  },

  {
    name: "close active window",
    exec: world => {
      var focused = world.focusedMorph,
          win = focused && focused.getWindow();
      if (win) {
        world.undoStart("window close");
        win.close();
        world.undoStop("window close");
      }
      return true;
    }
  },

  {
    name: "toggle minimize active window",
    exec: world => {
      var win = world.activeWindow();
      win && win.toggleMinimize();
      return true;
    }
  },

  {
    name: "resize active window",
    exec: function(world, opts = {how: null, window: null}) {

        var {window, how} = opts,
            win = window || world.activeWindow();

        if (!win) return;

        var worldB = world.visibleBounds().insetBy(20),
            winB = win.bounds(),
            bounds = worldB;

        // FIXME!
        if (!win._normalBounds) win._normalBounds = winB;

        var thirdWMin = 700,
            thirdW = Math.min(thirdWMin, Math.max(1000, bounds.width/3)),
            thirdColBounds = bounds.withWidth(thirdW);

        if (!how) askForHow(); else doResize(how);

        return true;

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


        async function askForHow() {
          var {selected: [how]} = await world.filterableListPrompt("How to resize the window?", [
            'full', 'fullscreen','center','right','left','bottom',
            'top',"shrinkWidth", "growWidth","shrinkHeight",
            "growHeight", 'col1','col2', 'col3', 'col4', 'col5',
            'reset']);
          how && doResize(how);
        }

        function doResize(how) {

            switch(how) {
                case 'full': case 'fullscreen': break;
                case 'left': bounds = thirdColBounds; break;
                case 'col3': case 'center': bounds = thirdColBounds.withCenter(worldB.center()); break;
                case 'col5': case 'right': bounds = thirdColBounds.translatedBy(pt(worldB.width - thirdW, 0)); break;
                case 'col1': case 'left': bounds = thirdColBounds.withTopLeft(bounds.topLeft()); break;
                case 'bottom': bounds = bounds.withY(bounds.y + bounds.height/2);
                case 'top': bounds = bounds.withHeight(bounds.height/2); break;
                case 'col2': bounds = thirdColBounds.withTopLeft(worldB.topCenter().scaleByPt(pt(.333,1))).withWidth(thirdW); break;
                case 'col4': bounds = thirdColBounds.translatedBy(worldB.topCenter().withY(0)); break;
                case 'halftop': bounds = winB.withY(bounds.top()).withHeight(bounds.height/2); break;
                case 'halfbottom': bounds = winB.withY(bounds.center().y).withHeight(bounds.height/2); break;
                case 'reset': bounds = win.normalBounds || pt(500,400).extentAsRectangle().withCenter(bounds.center()); break;
                default: return;
            }

            if (how === 'reset') delete win.normalBounds;

            win.setBounds(bounds);
        }

        return true;
    }
  },

  {
    name: "open workspace",
    exec: async (world, opts = {language: "javascript"}) => {
      var lang = opts.language || "javascript",
          workspaceModules = {
            "javascript": "lively.morphic/ide/js/workspace.js",
            get "js"() { return this["javascript"]; },
            "shell": "lively.morphic/ide/shell/workspace.js"
          },
          { default: Workspace } = await System.import(workspaceModules[lang]);
      return new Workspace({center: world.center}).activate();
    }
  },

  {
    name: "open shell workspace",
    exec: (world, opts) => world.execCommand("open workspace", {...opts, language: "shell"})
  },

  {
    name: "open shell terminal",
    exec: async (world, opts) => {
      var { default: Terminal } = await System.import("lively.morphic/ide/shell/terminal.js");
      return Terminal.open(opts).openInWorldNearHand();
    }
  },

  {
    name: "open text window",
    exec: (world, opts = {}) => {
      var {title, extent, content, mode, name} = opts;

      title = title ||  "text window";
      content = content ||  "";
      extent = extent || pt(500, 400);
      name = name || "text workspace";

      return world.openInWindow(
        new Text({padding: Rectangle.inset(3),
                  ...obj.dissoc(opts, ["title", "content"]),
                  textString: content, clipMode: "auto", name, extent}),
        {title}).activate();
    }
  },

  {
    name: "diff and open in window",
    exec: async (world, opts = {a: "", b: "", extent: pt(500,600)}) => {
      // $$world.execCommand("diff and open in window", {a: {foo: 23}, b: {bax: 23, foo: 23}})
      var {a, b, extent} = opts;

      // import * as diff from "https://cdnjs.cloudflare.com/ajax/libs/jsdiff/3.0.0/diff.js"
      var diff = await System.import("https://cdnjs.cloudflare.com/ajax/libs/jsdiff/3.0.0/diff.js"),
          diffed = diffInWindow(a, b, {extent, fontFamily: "monospace"});
      return diffed;

      function diffInWindow(a, b, opts) {
        var diffed;
        if (obj.isPrimitive(a) || a instanceof RegExp
         || obj.isPrimitive(b) || b instanceof RegExp)
           { a = String(a); b = String(b); }

        try { JSON.stringify(a);  JSON.stringify(b); }
        catch (e) { a = String(a); b = String(b); }

        if (typeof a === "string" || typeof b === "string") diffed = diff.diffLines(a,b);
        else diffed = diff.diffJson(a,b);

        var win = world.execCommand("open text window", opts),
            textMorph = win.targetMorph;
        win.extent = pt(300, 200).maxPt(textMorph.textBounds().extent());

        textMorph.textAndAttributes = diffed.map(({count, value, added, removed}) => {
          var attribute = removed ?
              {fontWeight: "normal", textDecoration: "line-through", fontColor: Color.red} : added ?
              {fontWeight: "bold", textDecoration: "", fontColor: Color.green} :
              {fontWeight: "normal", textDecoration: "", fontColor: Color.darkGray};
          return [value, attribute];
        });

        return textMorph;
      }
    }
  },

  {
    name: "open object drawer",
    exec: async world => {
      var { default: ObjectDrawer } = await System.import("lively.morphic/object-drawer.js")
      return new ObjectDrawer().openInWorldNearHand();
    }
  },

  {
    name: "open browser",
    progressIndicator: "opening browser...",
    exec: async (world, args = {packageName: "lively.morphic", moduleName: "morph.js"}) => {
      var { default: Browser } = await System.import("lively.morphic/ide/js/browser/index.js"),
          browser = await Browser.browse(args.packageName, args.moduleName, undefined, {extent: pt(700, 600)});
      browser.getWindow().activate();
      return browser;
    }
  },

  {
    name: "choose and browse package resources",
    progressIndicator: "browsing resources...",
    exec: async (world, opts = {browser: null, backend: null}) => {
      var browser = opts.browser
           || (world.focusedMorph && world.focusedMorph.ownerChain().find(ea => ea.isBrowser));

      if (browser && browser.isBrowser)
        browser = browser.getWindow();
      else browser = null;

      var backend = opts.backend || (browser && browser.backend),
          systemInterface = await System.import("lively-system-interface"),
          livelySystem = backend && backend !== "local" ?
            systemInterface.serverInterfaceFor(backend) :
            systemInterface.localInterface, // FIXME
          pkgs = await livelySystem.getPackages(),
          pkgs = pkgs.filter(({address}) => "no group" !== address),
          items = [];

      for (let p of pkgs) {
        items.push(...(await livelySystem.resourcesOfPackage(p))
          .filter(({url}) => !url.endsWith("/"))
          .sort((a, b) => {
            if (a.isLoaded && !b.isLoaded) return -1;
            if (!a.isLoaded && b.isLoaded) return 1;
            if (a.nameInPackage.toLowerCase() < b.nameInPackage.toLowerCase()) return -1;
            if (a.nameInPackage.toLowerCase() == b.nameInPackage.toLowerCase()) return 0;
            return 1
          })
          .map(resource => {
            var string = `[${p.name}] ${resource.nameInPackage}${resource.isLoaded ? "" : " [not loaded]"}`;
            return {isListItem: true, string, value: resource}
          }));
      }

      var {selected} = await world.filterableListPrompt(
        "Choose module to open", items, {
          historyId: "lively.morphic-choose and browse package resources",
          requester: browser, width: 700, multiSelect: true})

      var [jsModules, nonJsModules] = arr.partition(selected, ea => ea.url.match(/\.js(on)?/));

      var { default: Browser } = await System.import("lively.morphic/ide/js/browser/index.js");
      await Promise.all(jsModules.map(ea =>
        Browser.browse(ea.package.address, ea.name, undefined, browser, backend)
          .then(browser => browser.activate())));

      if (nonJsModules.length)
        await Promise.all(nonJsModules.map(({url}) => world.execCommand("open file", {url})));

      return true;
    }
  },

  {
    name: "choose and browse module",
    progressIndicator: "browsing module...",
    handlesCount: true,
    exec: async (world, opts = {browser: undefined, backend: undefined}, count) => {

      if (!opts.browser) { // invoked from a file browser? => use it
        var focused = world.focusedMorph,
            win = focused && focused.getWindow();
        if (win && win.targetMorph && win.targetMorph.isFileBrowser)
          return win.targetMorph.execCommand("find file and select", opts, count);
      }

      var browser = opts.browser
                 || (focused && focused.ownerChain().find(ea => ea.isBrowser)),
          { default: Browser } = await System.import("lively.morphic/ide/js/browser/index.js"),
          backend = opts.backend || (browser && browser.backend),
          remote = backend && backend !== "local" ? backend : null,
          systemInterface = await System.import("lively-system-interface"),
          livelySystem = remote ?
            systemInterface.serverInterfaceFor(remote) :
            systemInterface.localInterface, // FIXME
          pkgs = await livelySystem.getPackages(),
          items = [];

      for (let p of pkgs) {
        for (let m of p.modules) {
          var shortName = livelySystem.shortModuleName(m.name, p);
          items.push({
            isListItem: true,
            string: `[${p.name}] ${shortName}`,
            value: {package: p, module: m, shortName}
          });
        }
      }

      items = arr.sortBy(items, ea => ea.string);

      var {selected} = await world.filterableListPrompt(
            "Choose module to open", items, {
              historyId: "lively.morphic-choose and browse module",
              requester: browser || focused,
              width: 700, multiSelect: true, listFontColor: "white"});

      for (var i = 0; i < selected.length; i++) {
        var {package: p, shortName} = selected[i],
            b = await Browser.browse(
              p.name, shortName, undefined,
              i === 0 ? browser : undefined,
              backend);
        b.moveBy(pt(i*20, i*20));
        b.activate();
      }

      return true;
    }
  },

  {
    name: "open code search",
    exec: async (world, opts = {browser: null, backend: null}) => {
      var browser = opts.browser
                 || (world.focusedMorph && world.focusedMorph.ownerChain().find(ea => ea.isBrowser)),
          { CodeSearcher } = await System.import("lively.morphic/ide/code-search.js");

      if (browser && browser.isBrowser) {
        if (browser.state.associatedSearchPanel)
          return browser.state.associatedSearchPanel.getWindow().activate();
      } else browser = null;

      var backend = opts.backend || (browser && browser.backend),
          searcher = CodeSearcher.inWindow({
            title: "code search", extent: pt(800, 500),
            targetBrowser: browser,
            backend
          }).activate();
      if (browser) browser.state.associatedSearchPanel = searcher;
      return searcher;
    }
  },

  {
    name: "open test runner",
    progressIndicator: "opening test runner...",
    exec: async world => {
      var {default: TestRunner} = await System.import("lively.morphic/ide/test-runner.js");
      return TestRunner.open();
    }
  },

  {
    name: "open file browser",
    progressIndicator: "opening file browser...",
    exec: async (world, opts = {}) => {
      var { default: HTTPFileBrowser } = await System.import("lively.morphic/ide/http-file-browser.js"),
          { location, file } = opts;
      var browser = file ?
        HTTPFileBrowser.forFile(file, location) :
        HTTPFileBrowser.forLocation(location || document.location.origin);
      return world.openInWindow(browser).activate();
    }
  },

  {
    name: "open file",
    progressIndicator: "opening file...",
    exec: async (world, opts = {url: null, lineNumber: null}) => {
      var { default: TextEditor } = await System.import("lively.morphic/ide/text-editor.js"),
          { url, lineNumber } = opts;
      if (!url)
        url = await world.prompt("Enter file location", {
          historyId: "lively.morphic-text editor url", useLastInput: true
        });
      if (lineNumber) url += ":" + lineNumber;
      return url ? TextEditor.openURL(url, obj.dissoc(opts, ["url"])) : null;
    }
  },

  {
    name: "open file for EDITOR",
    exec: async (world, opts = {url: null, lineNumber: null}) => {
      // for using from command line, see l2l default client actions and
      // lively.shell/bin/lively-as-editor.js
      var { default: TextEditor } = await System.import("lively.morphic/ide/text-editor.js"),
          { url, lineNumber } = opts;
      // "saved" || "aborted"
      return  await TextEditor.openAsEDITOR(url, {});
    }
  },

  {
    name: "[lively.installer] publish new version of a package",
    exec: async world => {
      await lively.modules.registerPackage(
        document.location.origin + "/lively.installer");
      var {default: publishPackage} = await System.import(
        "lively.installer/packages/publish-new-package-version.js")
      await publishPackage();
      return true;
    }
  },

  {
    name: "report a bug",
    exec: async world => {
      window.open("https://github.com/LivelyKernel/lively.morphic/issues/new", "_blank");
      return true;
    }
  }
]

export class World extends Morph {

  static defaultWorld() { return MorphicEnv.default().world; }

  constructor(props) {
    super(props);
    this._renderer = null; // assigned in rendering/renderer.js
    this._tooltipViewer = new TooltipViewer(this);
  }

  __deserialize__(snapshot, objRef) {
    super.__deserialize__(snapshot, objRef);
    this._tooltipViewer = new TooltipViewer(this);
  }

  get isWorld() { return true }

  get draggable() { return true; }
  set draggable(_) {}
  get grabbable() { return false; }
  set grabbable(_) {}

  handForPointerId(pointerId) {
    return this.submorphs.find(m => m instanceof Hand && m.pointerId === pointerId)
        || this.addMorph(new Hand(pointerId), this.submorphs[0]);
  }

  world() { return this }

  get hands() {
    return this.submorphs.filter(ea => ea.isHand);
  }

  get firstHand() { return this.hands[0]; }

  activeWindow() { return this.getWindows().reverse().find(ea => ea.isActive()); }
  getWindows() { return this.submorphs.filter(ea => ea.isWindow); }

  activePrompt() { return this.getPrompts().reverse().find(ea => ea.isActive()); }
  getPrompts() { return this.submorphs.filter(ea => ea.isPrompt); }

  openInWindow(morph, opts = {title: morph.name, name: "window for " + morph.name}) {
    return new Window({
      ...opts,
      extent: morph.extent.addXY(0, 25),
      targetMorph: morph
    }).openInWorld();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get focusedMorph() {
    var focused = this.env.eventDispatcher.eventState.focusedMorph;
    return focused && focused.world() === this ? focused : this;
  }

  onMouseMove(evt) {
    evt.hand.update(evt);
    this._tooltipViewer.mouseMove(evt);
  }

  onMouseDown(evt) {
    var target = evt.state.clickedOnMorph;

    if (!target.isHaloItem &&
         evt.halo && evt.halo.borderBox != target &&
         evt.isCommandKey() && evt.isShiftDown()) {
       evt.halo.addMorphToSelection(target);
       return;
    }

    var addHalo = target.halosEnabled && !evt.halo && evt.isCommandKey();
    if (addHalo) {
      this.showHaloFor(target, evt.domEvt.pointerId);
      return;
    }

    var removeHalo = evt.halo && !evt.targetMorphs.find(morph => morph.isHaloItem);
    if (removeHalo) {
      evt.halo.remove();
      // switch immediately to a different morph
      addHalo = !target.isHalo && target.halosEnabled && evt.isCommandKey();
      if (addHalo) {
        this.showHaloFor(target, evt.domEvt.pointerId);
        return;
      }
    }

    removeHalo = evt.layoutHalo && !evt.targetMorphs.find(morph => morph.isHaloItem);
    if (removeHalo) {
      evt.layoutHalo.remove();
    }

    if (evt.state.menu) {
      evt.state.menu.remove();
    }

    this._tooltipViewer.mouseDown(evt);
  }

  onMouseUp(evt) {
    var target = evt.state.clickedOnMorph;
    if (evt.isAltDown() && config.altClickDefinesThat) {
      // FIXME currently delayed to overwrite that in old morphic
      setTimeout(() => System.global.that = target, 100);
      target.show();
      evt.stop();
      console.log(`Set global "that" to ${target}`);
      return;
    }
  }

  onMouseWheel(evt) {
    // When holding shift pressed you can scroll around in the world without
    // scrolling an individual clipped morph that might be below the mouse cursor
    if (evt.isShiftDown()) {
      window.scrollBy(-evt.domEvt.wheelDeltaX, -evt.domEvt.wheelDeltaY)
      evt.stop();
    }
  }

  onDragStart(evt) {
     this.selectionStartPos = evt.positionIn(this);
     this.morphSelection = this.addMorph({
        isSelectionElement: true,
        position: this.selectionStartPos, extent: evt.state.dragDelta,
        fill: Color.gray.withA(.2),
        borderWidth: 2, borderColor: Color.gray
     });
     this.selectedMorphs = {};
  }

  onDrag(evt) {
     const selectionBounds = Rectangle.fromAny(evt.position, this.selectionStartPos)
     this.morphSelection.setBounds(selectionBounds);
     this.submorphs.forEach(c => {
         if (c.isSelectionElement || c.isHand) return;
         const candidateBounds = c.bounds(),
               included = selectionBounds.containsRect(candidateBounds);

         if (!this.selectedMorphs[c.id] && included) {
            this.selectedMorphs[c.id] = this.addMorph({
                isSelectionElement: true,
                bounds: candidateBounds,
                borderColor: Color.red,
                borderWidth: 1,
                fill: Color.transparent
            }, this.morphSelection);
         }
         if (this.selectedMorphs[c.id] && !included) {
            this.selectedMorphs[c.id].remove();
            delete this.selectedMorphs[c.id];
         }
     })
  }

  onDragEnd(evt) {
     this.morphSelection.fadeOut(200);
     obj.values(this.selectedMorphs).map(m => m.remove());
     this.showHaloForSelection(Object.keys(this.selectedMorphs)
                                     .map(id => this.getMorphWithId(id)));
     this.selectedMorphs = {};
  }

  menuItems() {
    return [
      {title: "World menu"},
      {command: "undo",                     target: this},
      {command: "redo",                     target: this},
      {isDivider: true},
      {command: "run command",              target: this},
      {command: "select morph",             target: this},
      {command: "resize to fit window",     target: this},
      {command: "window switcher",          target: this},
      {isDivider: true},
      ["Tools", [
        {command: "open object drawer",       target: this},
        {command: "open workspace",           target: this},
        {command: "open browser",             target: this},
        {command: "choose and browse module", target: this},
        {command: "open code search",         target: this},
        {command: "open test runner",         target: this},
        {command: "open shell workspace",     target: this}]
      ],
      {command: "report a bug",          target: this},
      ];
  }

  openWorldMenu(evt, items) {
    var eventState =  this.env.eventDispatcher.eventState;
    if (eventState.menu) eventState.menu.remove();
    return eventState.menu = items && items.length ?
      Menu.openAtHand(items, {hand: (evt && evt.hand) || this.firstHand}) : null;
  }

  onWindowScroll(evt) {
    // this.env.eventDispatcher
    this._cachedWindowBounds = null;
  }

  onWindowResize(evt) {
    this._cachedWindowBounds = null;
    this.execCommand("resize to fit window");
  }


  get commands() { return worldCommands.concat(super.commands); }
  get keybindings() { return super.keybindings.concat(config.globalKeyBindings); }
  set keybindings(x) { super.keybindings = x }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // halos
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  halos() { return this.submorphs.filter(m => m.isHalo); }

  haloForPointerId(pointerId) {
    return this.submorphs.find(m => m.isHalo && m.state.pointerId === pointerId);
  }

  showHaloFor(morph, pointerId = this.firstHand && this.firstHand.pointerId) {
    return this.addMorph(new Halo(pointerId, morph)).alignWithTarget();
  }

  showHaloForSelection(selection, pointerId = this.firstHand && this.firstHand.pointerId) {
     return selection.length > 0 && this.addMorph(new Halo(pointerId, selection)).alignWithTarget();
  }

  layoutHaloForPointerId(pointerId = this.firstHand && this.firstHand.pointerId) {
    return this.submorphs.find(m => m.isLayoutHalo && m.state.pointerId === pointerId);
  }

  showLayoutHaloFor(morph, pointerId = this.firstHand && this.firstHand.pointerId) {
    return this.addMorph(morph.layout.inspect(pointerId));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleBounds () {
    // the bounds call seems to slow down halos...
    if (!this.env.renderer) return this.innerBounds();
    return this.windowBounds().intersection(this.innerBounds());
  }

  windowBounds(optWorldDOMNode) {
    if (this._cachedWindowBounds) return this._cachedWindowBounds;
    var {window} = this.env.domEnv,
        scale = 1 / this.scale,
        x = window.scrollX * scale,
        y = window.scrollY * scale,
        width = (window.innerWidth || this.width) * scale,
        height = (window.innerHeight || this.height) * scale;
    return this._cachedWindowBounds = new Rectangle(x, y, width, height);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // status messages
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleStatusMessages() {
    return this.submorphs.filter(ea => ea.isStatusMessage)
  }

  logError(err) {
    var stringified = String(err),
        stack = err.stack || "";
    if (stack) {
      stack = String(stack);
      var errInStackIdx = stack.indexOf(stringified);
      if (errInStackIdx === 0)
        stack = stack.slice(stringified.length);
      stringified += "\n" + stack;
    }
    this.setStatusMessage(stringified, Color.red);
  }

  showError(err) { return this.logError(err); }

  setStatusMessage(msg, color, delay = 5000, optStyle = {}) {
    // world.setStatusMessage("test", Color.green)
    msg = String(msg);

    console[color == Color.red ? "error" : "log"](msg);

    if (!config.verboseLogging) return null;

    var msgMorph = new StatusMessage(msg, color, optStyle);

    var messages = this.visibleStatusMessages();
    for (let m of messages) {
      if (messages.length <= (config.maxStatusMessages || 0)) break;
      if (m.stayOpen) continue;
      m.remove();
      arr.remove(messages, m);
    }

    messages.forEach(msg => !msg.isMaximized && msg.animate({
        position: msg.position.addPt(pt(0, -msgMorph.extent.y - 10)),
        duration: 500
    }));

    const msgPos = this.visibleBounds().bottomRight().addXY(-20, -20);
    msgMorph.align(msgMorph.bounds().bottomRight(), msgPos);
    msgMorph.topRight = msgPos.addPt(pt(0,40));
    this.addMorph(msgMorph);
    msgMorph.animate({
       bottomRight: msgPos,
       duration: 500
    });

    if (typeof delay !== "undefined")
      setTimeout(() => msgMorph.stayOpen || msgMorph.fadeOut(), delay);

    return msgMorph;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // dialogs
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async openPrompt(promptMorph, opts = {requester: null, animated: false}) {
    var focused = this.focusedMorph, visBounds = this.visibleBounds();

    promptMorph.openInWorldNear(
      opts.requester ?
        opts.requester.globalBounds().center() :
        visBounds.center(), this);

    if (promptMorph.height > visBounds.height)
      promptMorph.height = visBounds.height - 5;

    if (typeof opts.customize === "function")
      opts.customize(promptMorph);

    if (opts.animated) {
       var animator = new Morph({
          fill: Color.transparent, extent: pt(1,1),
          opacity: 0, center: this.center
       });
       animator.openInWorld();
       animator.addMorph(promptMorph);
       animator.scale = 2;
       await animator.animate({scale: 1, opacity: 1, duration: 500});
       animator.remove(); promptMorph.openInWorld();
    }
    return promise.finally(promptMorph.activate(), () => focused && focused.focus());
  }

  inform(label = "no message", opts = {fontSize: 16, requester: null, animated: true}) {
    return this.openPrompt(new InformPrompt({label, ...opts}), opts);
  }

  prompt(label, opts = {requester: null, input: "", historyId: null, useLastInput: false}) {
    // await this.world().prompt("test", {input: "123"})
    // options = {
    //   input: STRING, -- optional, prefilled input string
    //   historyId: STRING, -- id to identify the input history for this prompt
    //   useLastInput: BOOLEAN -- use history for default input?
    // }
    return this.openPrompt(new TextPrompt({label, ...opts}), opts);
  }

  passwordPrompt(label, opts = {requester: null, input: ""}) {
    // await this.world().passwordPrompt("secret")
    return this.openPrompt(new PasswordPrompt({label, ...opts}), opts);
  }

  confirm(label, opts = {requester: null, animated: true}) {
    // await this.world().confirm("test")
    return this.openPrompt(new ConfirmPrompt({label, ...opts}), opts);
  }

  multipleChoicePrompt(label, opts = {requester: null, animated: true, choices: []}) {
    // await this.world().multipleChoicePrompt("test", {choices: ["1","2","3","4"]})
    return this.openPrompt(new MultipleChoicePrompt({label, ...opts}), opts);
  }

  listPrompt(label = "", items = [], opts = {requester: null, onSelection: null, preselect: 0}) {
    return this.openPrompt(new ListPrompt({
      filterable: false, padding: Rectangle.inset(3),
      label, items, ...opts}), opts);
  }

  filterableListPrompt(
    label = "",
    items = [],
    opts = {
      requester: null, onSelection: null,
      preselect: 0, multiSelect: false,
      historyId: null
    }) {

    if (opts.prompt) {
      var list = opts.prompt.get("list");
      list.items = items;
      list.selectedIndex = opts.preselect || 0;
      return this.openPrompt(opts.prompt, opts);
    }

    return this.openPrompt(new ListPrompt({
      filterable: true, padding: Rectangle.inset(3),
      label, items, ...opts}), opts);
  }

  editListPrompt(label = "", items = [], opts = {requester: null, multiSelect: true, historyId: null}) {
    return this.openPrompt(new EditListPrompt({
      label, multiSelect: true, items, padding: Rectangle.inset(3), ...opts}), opts);
  }
}

export class Hand extends Morph {

  constructor(pointerId) {
    super({
      fill: Color.orange,
      extent: pt(4,4),
      reactsToPointer: false
    });
    this.prevMorphProps = {};
    this.pointerId = pointerId;
  }

  get isHand() { return true }

  get draggable() { return false; }
  set draggable(_) {}
  get grabbable() { return false; }
  set grabbable(_) {}

  get grabbedMorphs() { return this.submorphs; }

  carriesMorphs() { return !!this.grabbedMorphs.length; }

  morphsContainingPoint(point, list) { return list }

  update(evt) {
    this.position = evt.position;
    this.carriesMorphs() && evt.halo && evt.halo.grabHalo().update();
  }

  grab(morph) {
    if (obj.isArray(morph)) return morph.forEach(m => this.grab(m));
    this.prevMorphProps = {
      dropShadow: morph.dropShadow,
      reactsToPointer: morph.reactsToPointer
    }
    this.addMorph(morph);
    // So that the morph doesn't steal events
    morph.reactsToPointer = false;
    morph.animate({dropShadow: true, duration: 500});
  }

  dropMorphsOn(dropTarget) {
    this.grabbedMorphs.forEach(morph => {
      dropTarget.addMorph(morph)
      morph.reactsToPointer = this.prevMorphProps.reactsToPointer;
      morph.animate({dropShadow: this.prevMorphProps.dropShadow, duration: 200});
    });
  }
}