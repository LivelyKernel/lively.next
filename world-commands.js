/*global System*/
import { Rectangle, rect, Color, pt } from 'lively.graphics';
import { tree, arr, string, obj } from "lively.lang";
import { show, inspect, Text, config } from "./index.js";
import KeyHandler from "./events/KeyHandler.js";
import { saveWorldToResource, loadWorldFromResource } from "./serialization.js";
import { loadObjectFromPartsbinFolder } from "./partsbin.js";


var commands = [

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
      let target = world.focusedMorph || world;
      let items = KeyHandler.generateCommandToKeybindingMap(target, true).map(ea => {
        var {prettyKeys, target, command: {name}} = ea,
            targetName = target.constructor.name,
            keysPrinted = prettyKeys ? prettyKeys.join(", ") : "";
        return {
          isListItem: true,
          value: ea,
          label: [
            `${targetName}`, {
              fontSize: "80%",
              textStyleClasses: ["v-center-text"],
              top: "-8%",
              paddingRight: "10px"
            },
            `${name}`, null
          ],
          annotation: [
            keysPrinted, {
              fontSize: "80%",
              textStyleClasses: ["truncated-text"],
              maxWidth: 140
            }
          ]
        };
      });

      let {prompt, selected: [cmd]} = await world.filterableListPrompt(
        "Run command", items, {
          historyId: "lively.morphic-run command",
          extent: pt(700,900), prompt: world._cachedRunCommandPrompt});

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
            (m, depth) => {
              if (!filterFn(m)) return null;
              return {
                isListItem: true,
                label: [
                  `${String(++i)}${"\u2003".repeat(depth)}`, {fontSize: "80%", textStyleClasses: ["v-center-text"], top: "-8%", paddingRight: "10px"},
									`${m}`, null
                ],
                value: m
              }
            },
            m => filterFn(m) ? m.submorphs : [])),
          actions = ["show halo", "open object editor", "open object inspector"],
          {selected: morphs, action} = await world.filterableListPrompt(
            opts.prompt || "Choose morph",
            (opts.prependItems || []).concat(items),
            {historyId: "lively.morphic-select morph",
             onSelection: sel => sel && sel.show && sel.show(),
             selectedAction: "show halo",
             actions});

      if (opts.justReturn) return morphs;

      morphs.forEach(m => {
        if (action === actions[0]) world.showHaloFor(m);
        else if (action === actions[1]) world.execCommand("open object editor", {target: m});
        else if (action === actions[2]) world.execCommand("open object inspector", {target: m});
      });

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
      if (!halo || halo.changingName) return false;

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

      let wins = world.submorphs.filter(({isWindow}) => isWindow).reverse()
            .map(win => ({isListItem: true, string: win.title || String(win), value: win})),
          answer = await world.filterableListPrompt(
            "Choose window", wins, {
              preselect: 1,
              historyId: "lively.morphic-window switcher",
              onSelection: sel => sel && sel.show(),
              width: world.visibleBounds().extent().x * 1/3,
              itemPadding: Rectangle.inset(4)
            }),
          {selected: [win]} = answer;
      win && win.activate();
      return true;
    }
  },

  {
    name: "close active window or morph",
    exec: world => {
      var focused = world.focusedMorph;
      if (!focused) return true;
      var win = focused.getWindow();
      world.undoStart("window close");
      if (win) win.close();
      else {
        arr.last(arr.without(focused.ownerChain(), world)).remove();
        var win = world.activeWindow();
        win && win.activate();
      }
      world.undoStop("window close");
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
    name: "open status message of focused morph",
    exec: world => {
      var focused = world.focusedMorph;
      var [msg] = focused ? world.visibleStatusMessagesFor(focused) : [];
      if (msg) { msg.expand(); msg.focus(); }
      return msg || true;
    }
  },

  {
    name: "resize active window",
    exec: async function(world, opts = {how: null, window: null}) {

      var {window, how} = opts,
          win = window || world.activeWindow();

      if (!win) return;

      var worldB = world.visibleBounds().insetBy(20),
          winB = win.bounds();
        // FIXME!
      if (!win._normalBounds) win._normalBounds = winB;

      var thirdWMin = 700,
          thirdW = Math.min(thirdWMin, Math.max(1000, worldB.width/3)),
          thirdColBounds = worldB.withWidth(thirdW);

      if (!how) how = await askForHow();
      if (!how) return;

      if (how === "reset") delete win.normalBounds;
      win.setBounds(resizeBounds(how, how.startsWith("half") ? winB : worldB));

      return true;

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


      async function askForHow() {
        var {selected: [how]} = await world.filterableListPrompt("How to resize the window?", [
          "full", "fullscreen","center","right","left","bottom",
          "top","shrinkWidth", "growWidth","shrinkHeight",
          "growHeight", "col1","col2", "col3", "col4", "col5",
          "reset"]);
        return how
      }

      function resizeBounds(how, bounds) {
        switch(how) {
          case "full": case "fullscreen": return worldB;
          case "col1":
          case "left": return thirdColBounds.withTopLeft(worldB.topLeft());
          case "col2": return thirdColBounds.withTopLeft(worldB.topCenter().scaleByPt(pt(.333,1))).withWidth(thirdW);
          case "col3":
          case "center": return thirdColBounds.withCenter(worldB.center());
          case "col4": return thirdColBounds.translatedBy(worldB.topCenter().withY(0));
          case "col5":
          case "right": return thirdColBounds.translatedBy(pt(worldB.width - thirdW, 0));
          case "top": return worldB.divide([rect(0, 0, 1, .5)])[0];
          case "bottom": return worldB.divide([rect(0, .5, 1, .5)])[0];
          case "halftop": return bounds.withY(worldB.top()).withHeight(bounds.height/2);
          case "halfbottom": return bounds.withHeight(worldB.height/2).withY(worldB.top() + worldB.height/2);
          case "reset": return win.normalBounds || pt(500,400).extentAsRectangle().withCenter(bounds.center());

          case "quadrant1": return resizeBounds("halftop", resizeBounds("col1", bounds));
          case "quadrant2": return resizeBounds("halftop", resizeBounds("col2", bounds));
          case "quadrant3": return resizeBounds("halftop", resizeBounds("col3", bounds));
          case "quadrant4": return resizeBounds("halftop", resizeBounds("col4", bounds));
          case "quadrant5": return resizeBounds("halftop", resizeBounds("col5", bounds));
          case "quadrant6": return resizeBounds("halfbottom", resizeBounds("col1", bounds));
          case "quadrant7": return resizeBounds("halfbottom", resizeBounds("col2", bounds));
          case "quadrant8": return resizeBounds("halfbottom", resizeBounds("col3", bounds));
          case "quadrant9": return resizeBounds("halfbottom", resizeBounds("col4", bounds));
          case "quadrant0": return resizeBounds("halfbottom", resizeBounds("col5", bounds));
          default: return bounds;
        }
      }

    }
  },

  {
    name: "open workspace",
    exec: async (world, opts) => {
      opts = {content: "", language: "javascript", ...opts};
      var workspaceModules = {
            "javascript": "lively.morphic/ide/js/workspace.js",
            get "js"() { return this["javascript"]; },
            "shell": "lively.morphic/ide/shell/workspace.js"
          },
          { default: Workspace } = await System.import(workspaceModules[opts.language]);
      return new Workspace({center: world.center, content: opts.content}).activate();
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
      var {title, extent, content, mode, name, rangesAndStyles} = opts;

      title = title ||  "text window";
      content = content ||  "";
      extent = extent || pt(500, 400);
      name = name || "text workspace";
      let textAndAttributes = typeof content === "string" ? [content, null] : content;
      let text = new Text({padding: Rectangle.inset(3),
                  ...obj.dissoc(opts, ["title", "content"]),
                  textAndAttributes, clipMode: "auto", name, extent});
      if (rangesAndStyles)
        text.setTextAttributesWithSortedRanges(rangesAndStyles);
      return world.openInWindow(text, {title}).activate();
    }
  },

  {
    name: "diff and open in window",
    exec: async (world, opts = {a: "", b: "", format: null, extent: pt(500,600)}) => {
      // $world.execCommand("diff and open in window", {a: {foo: 23}, b: {bax: 23, foo: 23}})
      // $world.execCommand("diff and open in window", {a: "Hello\nworld", b: "Helo\nworld"})
      // $world.execCommand("diff and open in window", {a: "Hello\nworld", b: "Helo\nworld", format: "diffChars"})
      // $world.execCommand("diff and open in window", {a: "Hello\nworld", b: "Helo\nworld", format: "diffSentences"})
      // $world.execCommand("diff and open in window", {a: "Hello\nworld", b: "Helo\nworld", format: "patch"})

      var {a,b,format} = opts;
      if (!format) var {a,b, format} = findFormat(a, b);
      else { a = String(a);  b = String(b); }

      // import * as diff from "https://cdnjs.cloudflare.com/ajax/libs/jsdiff/3.0.0/diff.js"
      var diff = await System.import("https://cdnjs.cloudflare.com/ajax/libs/jsdiff/3.0.0/diff.js"),
          diffed = await diffInWindow(a, b, {fontFamily: "monospace", ...opts, format});

      return diffed;

      function findFormat(a, b) {
        if (obj.isPrimitive(a) || a instanceof RegExp
         || obj.isPrimitive(b) || b instanceof RegExp)
           { a = String(a); b = String(b); }
        if (typeof a !== "string" || typeof b !== "string")
          try { JSON.stringify(a);  JSON.stringify(b); return {format: "diffJson", a, b}; }
          catch (e) { a = String(a); b = String(b); }
        return {format: "diffLines", a, b}
      }

      async function diffInWindow(a, b, opts) {
        var {format} = opts;
        var plugin = null, content;

        if (format === "patch") {
          var {headerA, headerB, filenameA, filenameB, context} = opts
          var content = [diff.createTwoFilesPatch(
                         filenameA || "a", filenameB || "b", a, b,
                         headerA, headerB, typeof context === "number" ? {context} : undefined), {}];
          var { default: DiffEditorPlugin } = await System.import("lively.morphic/ide/diff/editor-plugin.js");
          plugin = new DiffEditorPlugin();

        } else {
          diffed = diff[format](a,b, opts);
          content = arr.flatmap(diffed, ({count, value, added, removed}) => {
            var attribute = removed ?
                {fontWeight: "normal", textDecoration: "line-through", fontColor: Color.red} : added ?
                {fontWeight: "bold", textDecoration: "", fontColor: Color.green} :
                {fontWeight: "normal", textDecoration: "", fontColor: Color.darkGray};
            return [value, attribute];
          })
        }

        var win = world.execCommand("open text window", opts),
            textMorph = win.targetMorph;
        win.extent = pt(300, 200).maxPt(textMorph.textBounds().extent());

        textMorph.textAndAttributes = content;
        if (plugin) textMorph.addPlugin(plugin);

        return textMorph;
      }
    }
  },

  {
    name: 'diff workspaces',
    exec: async function(world, opts = {}) {
      var {editor1, editor2} = opts;

      if (!editor1 || !editor2)
        var editors = world.withAllSubmorphsSelect(ea =>
          ea.isText && !ea.isInputLine && !ea.isUsedAsEpiMorph()).reverse();
      if (!editor1) editor1 = await selectMorph(editors);
      if (!editor1) return world.setStatusMessage("Canceled");
      if (!editor2) editor2 = await selectMorph(arr.without(editors, editor1));
      if (!editor2) return world.setStatusMessage("Canceled");

      return doDiff(editor1, editor2);

      function doDiff(ed1, ed2) {
        var p1 = ed1.pluginFind(ea => ea.evalEnvironment);
        var fn1 = (p1 && p1.evalEnvironment.targetModule) || 'no file';
        var p2 = ed2.pluginFind(ea => ea.evalEnvironment);
        var fn2 = (p2 && p2.evalEnvironment.targetModule) || 'no file';
        return world.execCommand("diff and open in window", {
          a: ed1.textString, b: ed2.textString,
          filenameA: fn1, filenameB: fn2
        })
      }

      async function selectMorph(morphs, thenDo) {
        var candidates = morphs.map(ea =>
          ({isListItem: true, value: ea, string: ea.name || String(ea)}));
        var {selected: [choice]} = await world.filterableListPrompt("choose text: ", candidates, {onSelection: m => m && m.show()});
        return choice;
      }

    }
  },

  {
    name: "open PartsBin",
    exec: async world => {
      var { loadObjectFromPartsbinFolder } = await System.import("lively.morphic/partsbin.js")
      var pb = await loadObjectFromPartsbinFolder("PartsBin");
      return pb.openInWorldNearHand();
    }
  },

  {
    name: "load object from PartsBin",
    exec: async (world, opts = {}) => {
      let part, {name, open = true} = opts;
      if (name) {
        let {loadObjectFromPartsbinFolder} = await System.import("lively.morphic/partsbin.js");
        part = await loadObjectFromPartsbinFolder(name);
      } else {
        let { interactivelyLoadObjectFromPartsBinFolder } = await System.import("lively.morphic/partsbin.js");
        part = await interactivelyLoadObjectFromPartsBinFolder();
      }          
      if (part && open) part.openInWorldNearHand();
      return part;
    }
  },

  
  {
    name: "open object drawer",
    exec: async world => {
      var { default: ObjectDrawer } = await System.import("lively.morphic/components/object-drawer.js")
      return new ObjectDrawer().openInWorldNearHand();
    }
  },

  {
    name: "open object editor",
    exec: async (world, args = {target: null}) => {
      if (!args.target) {
        world.setStatusMessage("no target for ObjectEditor");
        return null;
      }
      var { ObjectEditor } = await System.import("lively.morphic/ide/js/objecteditor/index.js"),
          editor = await ObjectEditor.open({target: args.target});
      return editor;
    }
  },

  {
    name: "open object inspector",
    exec: async (world, args = {target: null}) => {
      if (!args.target) {
        world.setStatusMessage("no target for Inspector");
        return null;
      }
      return inspect({target: args.target});
    }
  },

  {
    name: "open browser",
    progressIndicator: "opening browser...",
    exec: async (world, args = {packageName: "lively.morphic", moduleName: "morph.js"}, _, evt) => {
      // in case there is another morph implementing open browser...
      var relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;

      var { default: Browser } = await System.import("lively.morphic/ide/js/browser/index.js"),
          loc = obj.select(args, ["packageName", "moduleName", "textPosition", "codeEntity"]),
          browser = await Browser.browse(loc, {extent: pt(700, 600)});
      browser.getWindow().activate();
      return browser;
    }
  },

  {
    name: "choose and browse package resources",
    progressIndicator: "browsing resources...",
    exec: async (world, opts = {browser: null, systemInterface: null}, _, evt) => {
      var relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;

      var browser = opts.browser
           || (world.focusedMorph && world.focusedMorph.ownerChain().find(ea => ea.isBrowser));

      if (browser && browser.isBrowser)
        browser = browser.getWindow();
      else browser = null;

      var { localInterface } = await System.import("lively-system-interface"),
          systemInterface = opts && opts.systemInterface ? opts.systemInterface :
            browser ? browser.systemInterface : localInterface,
          pkgs = await systemInterface.getPackages({excluded: config.ide.js.ignoredPackages}),
          items = [];

      for (let p of pkgs) {
        items.push(...(await systemInterface.resourcesOfPackage(p))
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
                          requester: browser, width: 700, multiSelect: true, fuzzy: "value.shortName"}),
          [jsModules, nonJsModules] = arr.partition(selected, ea => ea.url.match(/\.js(on)?/)),
          { default: Browser } = await System.import("lively.morphic/ide/js/browser/index.js");

      await Promise.all(jsModules.map(ea => {
        var loc = {packageName: ea.package, moduleName: ea.url}
        return Browser.browse(loc, browser, systemInterface)
                .then(browser => browser.activate())
      }));

      if (nonJsModules.length)
        await Promise.all(nonJsModules.map(({url}) => world.execCommand("open file", {url})));

      return true;
    }
  },

  {
    name: "choose and browse module",
    progressIndicator: "browsing module...",
    handlesCount: true,
    exec: async (world, opts = {browser: undefined, systemInterface: undefined}, count) => {

      if (!opts.browser) { // invoked from a file browser? => use it
        var focused = world.focusedMorph,
            win = focused && focused.getWindow();
        if (win && win.targetMorph && win.targetMorph.isFileBrowser)
          return win.targetMorph.execCommand("find file and select", opts, count);
      }

      var browser = opts.browser
                 || (focused && focused.ownerChain().find(ea => ea.isBrowser)),
          { default: Browser } = await System.import("lively.morphic/ide/js/browser/index.js"),
          { localInterface } = await System.import("lively-system-interface"),
          systemInterface = opts && opts.systemInterface ? opts.systemInterface :
            browser ? browser.systemInterface : localInterface,
          pkgs = await systemInterface.getPackages(),
          items = [];

      for (let p of pkgs) {
        for (let m of p.modules) {
          var shortName = systemInterface.shortModuleName(m.name, p);
          items.push({
            isListItem: true,
            string: `[${p.name}] ${shortName}`,
            value: {package: p, module: m, shortName}
          });
        }
      }

      items = arr.sortBy(items, ea => ea.string);
      (async () => {
         var {selected} = await world.filterableListPrompt(
            "Choose module to open", items, {
              historyId: "lively.morphic-choose and browse module",
              requester: browser || focused,
              width: 700, multiSelect: true, listFontColor: "white", fuzzy: "value.shortName"});

         for (var i = 0; i < selected.length; i++) {
           var {package: p, shortName} = selected[i],
               loc = {packageName: p.name, moduleName: shortName},
               b = await Browser.browse(
                  loc, i === 0 ? browser : undefined, systemInterface);
           b.moveBy(pt(i*20, i*20));
           b.activate();
         }
      })();

      return true;
    }
  },

  {
    name: "open code search",
    progressIndicator: "opening code search...",
    exec: async (world, opts = {browser: null, systemInterface: null, input: null}) => {

      let activeMorphs = world.focusedMorph ? world.focusedMorph.ownerChain() : [],
          browser = opts.browser || activeMorphs.find(ea => ea.isBrowser);

      if (browser && browser.isBrowser) {
        if (browser.state.associatedSearchPanel)
          return browser.state.associatedSearchPanel.getWindow().activate();
      } else browser = null;

      let { CodeSearcher } = await System.import("lively.morphic/ide/code-search.js"),
          { localInterface } = await System.import("lively-system-interface");

      let systemInterface = opts.systemInterface || (browser && browser.systemInterface);
      if (!systemInterface) {
        let ed = activeMorphs.find(ea =>
          ea.isText && ea.editorPlugin && ea.editorPlugin.isJSEditorPlugin);
        if (ed) systemInterface = ed.editorPlugin.systemInterface()
        else systemInterface = localInterface;
      }

      let searcher = CodeSearcher.inWindow({
        title: "code search", extent: pt(800, 500),
        targetBrowser: browser,
        input: opts.input,
        systemInterface
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
      return await TestRunner.open();
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
  },

  {
    name: "fix font metric",
    exec: async world => {
      world.env.fontMetric.reset();
      world.withAllSubmorphsDo(ea => ea.isText && ea.textLayout && ea.textLayout.reset());
      return true;
    }
  },

  {
    name: "delete change history",
    exec: world => {
      let {env} = world,
          status = env.printStatus();
      env.deleteHistory()
      world.setStatusMessage(status);
      return true;
    }
  },

  {
    name: "install global inspect and show",
    exec: world => {
      window.show = show;
      window.inspect = inspect;
      world.setStatusMessage(`inspect() and show() are now globally available`);
      return true;
    }
  },

  {
    name: "save world",
    exec: async (world, args, _, evt) => {
      // in case there is another morph implementing save...
      var relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;

      let dialog = await loadObjectFromPartsbinFolder("save world dialog"),
          {destination, name} = await world.openPrompt(dialog);

      if (!name) return null;      

      let url;
      if (destination === "server")
        url = System.decanonicalize(`lively.morphic/worlds/${name}.json`);
      else if (destination === "local storage")
        url = `lively.storage://worlds/${name}.json`;
      else {
        world.showError(new Error("Invalid destination: " + destination));
        return null;
      }

      try {
        await saveWorldToResource(world, url, {previewWidth: 200, previewHeight: 200, previewType: "png"});
        world.setStatusMessage(`saved world to ${url}`);
        world.get("world-list") && world.get("world-list").onWorldSaved(name);
      } catch (err) {
        $world.logError("Error saving world: " + err.stack);
      }
    }
  },
  
  {
    name: "load world",
    exec: async (oldWorld, args = {}) => {
      let {resource, world} = args;

      if (!resource && !world) { // old world selection
        let worldList = oldWorld.get("world-list") || await loadObjectFromPartsbinFolder("world-list");
        return await worldList.bringToFront().alignInWorld(oldWorld).setLocationToLastChoiceOr("public");
      }

      let World = oldWorld.constructor;
      return resource ?
        World.loadWorldFromURL(resource, oldWorld) :
        World.loadWorld(world, oldWorld);
    }
  }

]

export default commands;
