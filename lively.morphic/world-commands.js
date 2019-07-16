/*global System*/
import { Rectangle, rect, Color, pt } from 'lively.graphics';
import { tree, date, Path, arr, string, obj } from "lively.lang";
import { inspect, MorphicDB, Text, config } from "./index.js";
import KeyHandler from "./events/KeyHandler.js";
import { loadObjectFromPartsbinFolder, loadPart } from "./partsbin.js";
import { interactivelySaveWorld } from "./world-loading.js";
import { show } from "lively.halos/markers.js";
import { LoadingIndicator } from "lively.components";
import { ensureCommitInfo } from "./morphicdb/db.js";
import { serializeMorph, createMorphSnapshot } from "./serialization.js";

var commands = [

  {
    name: "undo",
    exec: function(world) {
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
    name: "redo",
    exec: function(world) {
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
    name: "run command",
    handlesCount: true,
    exec: async (world, args, count) => {
      let target = world.focusedMorph || world,
          items = KeyHandler.generateCommandToKeybindingMap(target, true).map(ea => {
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
    name: "show command history",
    exec: (world, args) => {
      let handler = world.commandHandler,
          items = arr.sortBy(handler.history, ea => -ea.time).map(cmd => {
            return {
              isListItem: true,
              string: handler.printCommand(cmd),
              value: cmd
            }
          });
      $world.editListPrompt("select commands", items, {multiSelect: true});
      return true;
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
    name: "copy morph",
    exec: world => {
      var morph = world.focusedMorph;
      if (!morph || morph === world) {
        $world.setStatusMessage("no morph selected");
        return true;
      }
      let target = morph.getWindow() || morph,
          copy = target.copy();
      copy.openInWorld(target.globalPosition.addXY(10,10));
      if (copy.isWindow) copy.activate();
      return copy;
    }
  },

  {
    name: "select morph",
    exec: async (world, opts = {root: world, selectionFn: null, justReturn: false,
                                filterFn: null, prependItems: [], prompt: null, remote: false}) => {
      let i = 0,
          filterFn = opts.filterFn || (() => true),
          selectionFn = opts.selectionFn || ((title, items, opts) => world.filterableListPrompt(title, items, opts)),
          {default: ObjectPackage} = await System.import("lively.classes/object-classes.js"),
          items = arr.compact(tree.map(opts.root || world,
            (m, depth) => {
              if (!filterFn(m)) return null;
              const isObjectPackage = !!ObjectPackage.lookupPackageForObject(m);
              return {
                isListItem: true,
                label: [
                  `${String(++i)}${"\u2003".repeat(depth)}`, {
                    fontSize: "80%",
                    textStyleClasses: ["v-center-text"],
                    paddingRight: "10px"
                  }, `${m}`, {
                    fontWeight: isObjectPackage ? 'bolder' : 'normal',
                    fontStyle: isObjectPackage ? 'normal' : 'italic',
                    fontFamily: 'Inconsolata',
                    fontSize: 16
                  }, isObjectPackage ? " [Object Class]" : "", {
                    opacity: .5
                  }],
                value: m
              }
            },
            m => filterFn(m) ? m.submorphs : [])),
          actions = ["show halo", "open object editor", "open object inspector"];
          let {selected: morphs, action} = await selectionFn(
              opts.prompt || "Choose morph",
              (opts.prependItems || []).concat(items),
              {historyId: "lively.morphic-select morph",
               onSelection: sel => {
                 if (this.lastSelectionHalo) this.lastSelectionHalo.remove();
                 if (sel && sel.show) {
                   this.lastSelectionHalo = sel.show();
                 }
               },
               selectedAction: "show halo",
               actions
             });

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
    name: 'print morph(s)',
    exec: async (world) => {
      let finishedSelection = false;
      let selectedMorphs = [];
      while (!finishedSelection) {
         let [morph] = await world.execCommand('select morph', {justReturn: true});
         selectedMorphs.push(morph)
         finishedSelection = !await world.confirm('Select additional morphs?');        
      }
      let li = LoadingIndicator.open('printing morph...');
      let { default: L2LClient} = await System.import("lively.2lively/client.js");
      let l2l = L2LClient.default();
      let peers = await l2l.listPeers(true)
      let printer = peers.find(ea => ea.type === "lively.next.org freezer service");
      let opts = { ackTimeout: 30000};
      let msg = await l2l.sendToAndWait(printer.id, '[PDF printer] print', 
        await Promise.all(selectedMorphs.map(m => createMorphSnapshot(m, {addPreview: false, testLoad: false}))), opts);
      let err = msg.error || msg.data.error;
      if (err) { world.showError(err); throw err; }
      li.remove();
      world.serveFileAsDownload(msg.data, {fileName: selectedMorphs[0].name + (selectedMorphs.length > 1 ? '.etc' : '') + ".pdf", type: 'application/pdf'});
    }
  },

  {
    name: "escape",
    exec: (world, _1, _2, evt) => {
      var eventState =  world.env.eventDispatcher.eventState;
      if (eventState.menu) eventState.menu.remove();
      var halos = world.halos();
      halos.forEach(h => h.remove());
      world.hands.forEach(ea => ea.cancelGrab(true, evt));
      var f = (arr.last(halos) && arr.last(halos).target)
                      || world.focusedMorph || world;
      f.focus();
      if (f.isText) {
        f.selection.disableMultiSelect && f.selection.disableMultiSelect();
      }
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
      world.extent = lively.FreezerRuntime ? 
        world.windowBounds().extent() : 
        world.windowBounds().union(world.submorphBounds()).extent();
      return true;
    }
  },

  {
    name: "resize manually",
    exec: async (world, args = {}) => {
      let width, height,
          winBounds = world.windowBounds(),
          bounds = world.bounds();
      width = Number(args.width || await world.prompt("Enter world width", {input: Math.max(bounds.width, winBounds.width)}));
      if (typeof width === "number")
        height = Number(args.height || await world.prompt("Enter world height", {input: Math.max(bounds.height, winBounds.height)}));

      if (typeof width === "number" && !isNaN(width)
       && typeof height === "number" && !isNaN(height))
        world.extent = pt(width, height);

      return true;
    }
  },

  {
    name: "resize windows to fit visible world bounds",
    exec: world => {
      let windows = world.getWindows().filter(ea => !ea.minimized);
      if (!windows.length) return true;
      let visibleBounds = world.visibleBounds(),
          windowBoundsCombined = windows.reduce((bounds, win) =>
            win.bounds().union(bounds), new Rectangle(0,0,0,0)),
          scaleX = visibleBounds.width / windowBoundsCombined.width,
          scaleY = visibleBounds.height / windowBoundsCombined.height;
      windows.forEach(ea => {
        let {x, y, width, height} = ea.bounds();
        ea.setBounds(new Rectangle(x * scaleX, y * scaleY, width * scaleX, height * scaleY));
      });
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
    name: "[recovery] show last object editor saves",
    exec: (world, opts) => {
      return world.execCommand("[recovery] show last doits", {
        ...opts,
        title: "logged ObjectEditor save",
        logAccessFn: () => JSON.parse(localStorage["oe helper"]).saves
      });
    }
  },

  {
    name: "[recovery] show last doits",
    description: "browse a list of your last doits",
    exec: async (world, opts = {}) => {
      let {logAccessFn} = opts;
      if (!logAccessFn) logAccessFn = () => JSON.parse(localStorage["lively.next-js-ide-doitlog"]);
      let log;
      try { log = logAccessFn(); } catch (err) {};
      if (!log) return world.inform("no log yet");
      let normalizedLog = arr.sortBy(log.map((ea, i) => {
            let source = typeof ea === "string" ? ea : ea.source,
                time = typeof ea === "string" ? i : (ea.time || i),
                printedTime = date.format(new Date(time), "yy-mm-dd HH:MM");
            return {time, source, printedTime}
          }), ea => -ea.time),
          items = normalizedLog.map((ea, i) => {
            return {
              isListItem: true,
              string: `[${ea.printedTime}] ${ea.source.slice(0, 100).replace(/\n/g, "").trim()}`,
              value: ea
            }
          }),
          {selected: coices} = await world.filterableListPrompt("select doit code", items, {multiSelect: true});
      if (coices.length) {
        let sources = [];
        for (let coice of coices) {
          let {source, printedTime} = coice;
          sources.push(`// ${printedTime}\n${source}`);
        }
        return world.execCommand("open workspace",
          {title: "logged doits", mode: "js", ...opts, content: sources.join("\n\n")});
      }
      return true;
    }
  },

  {
    name: "open workspace",
    exec: async (world, opts = {}, _, evt) => {
      var relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;

      var language = opts.language || opts.mode || "javascript",
          workspaceModules = {
            "javascript": "lively.ide/js/workspace.js",
            "shell": "lively.ide/shell/workspace.js",
            "html": "lively.ide/html/workspace.js",
            "py": "lively.ide/py/workspace.js",
            "md": "lively.ide/md/workspace.js",
            "sql": "lively.ide/sql/workspace.js",
            "text": null
          },
          alias = Object.keys(config.ide.modes.aliases).reduce((inverted, ea) =>
            Object.assign(inverted, {[config.ide.modes.aliases[ea]]: ea}), {});

      if (opts.askForMode) {
        let workspaceLanguages = Object.keys(workspaceModules).concat("javascript console");
        ({selected: [language]} = await world.filterableListPrompt(
          "Open workspace for...", workspaceLanguages));
        if (!language) return true;
      }

      if (language === "javascript console")
        return world.execCommand("open console", opts);

      opts = {content: "", ...opts, mode: language, language};
      var mod = workspaceModules[opts.language] || workspaceModules[alias[opts.language]];

      if (language === "text" || !mod)
        return world.execCommand("open text window", {...config.codeEditor.modes.text, ...opts});

      let { default: Workspace } = await System.import(mod);
      return new Workspace({
        title: opts.title || opts.language + " workspace",
        center: world.center,
        content: opts.content,
        target: opts.target,
        systemInterface: opts.systemInterface || opts.backend
      }).activate();
    }
  },

  {
    name: "open console",
    exec: async (world, opts = {}) => {
      let console = await loadObjectFromPartsbinFolder("Console");
      return console.openInWorldNearHand();
    }
  },

  {
    name: "open shell workspace",
    exec: (world, opts) => world.execCommand("open workspace", {...opts, language: "shell"})
  },

  {
    name: "open shell terminal",
    exec: async (world, opts) => {
      var { default: Terminal } = await System.import("lively.ide/shell/terminal.js");
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
      let textAndAttributes = typeof content === "string" ? [content, null] : content,
          text = new Text({
            padding: Rectangle.inset(3),
            ...obj.dissoc(opts, ["title", "content"]),
            textAndAttributes, clipMode: "auto", name, extent
          });
      if (rangesAndStyles)
        text.setTextAttributesWithSortedRanges(rangesAndStyles);
      if (mode) text.changeEditorMode(mode);
      return world.openInWindow(text, {title}).activate();
    }
  },

  {
    name: "merge and open in window",
    exec: async (world, opts = {a: "", b: "", format: null, extent: pt(500,600)}) => {
      let merger = await loadObjectFromPartsbinFolder("text merger");
      return merger.targetMorph.open(opts.a, opts.b, opts);
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

      var {a,b, format, extent} = opts;
      if (!format) var {a,b, format} = findFormat(a, b);
      else { a = String(a);  b = String(b); }

      var diff = await System.import("jsdiff", System.decanonicalize("lively.morphic")),
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
          var { default: DiffEditorPlugin } = await System.import("lively.ide/diff/editor-plugin.js");
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
        win.extent = extent || pt(300, 200).maxPt(textMorph.textBounds().extent());

        textMorph.textAndAttributes = content;
        if (plugin) textMorph.addPlugin(plugin);

        return textMorph;
      }
    }
  },

  {
    name: 'merge workspaces',
    exec: function(world, opts) {
      return world.execCommand("diff workspace", {...opts, merge: true});
    }
  },

  {
    name: 'diff workspaces',
    exec: async function(world, opts = {}) {
      var {editor1, editor2, merge} = opts;

      if (!editor1 || !editor2)
        var editors = world.withAllSubmorphsSelect(ea =>
          ea.isText && !ea.isInputLine && !ea.isUsedAsEpiMorph()).reverse();
      if (!editor1) editor1 = await selectMorph(editors);
      if (!editor1) return world.setStatusMessage("Canceled");
      if (!editor2) editor2 = await selectMorph(arr.without(editors, editor1));
      if (!editor2) return world.setStatusMessage("Canceled");

      return merge ? doMerge(editor1, editor2) : doDiff(editor1, editor2);

      function doDiff(ed1, ed2) {
        var p1 = ed1.pluginFind(ea => ea.evalEnvironment),
            fn1 = (p1 && p1.evalEnvironment.targetModule) || 'no file',
            p2 = ed2.pluginFind(ea => ea.evalEnvironment),
            fn2 = (p2 && p2.evalEnvironment.targetModule) || 'no file';
        return world.execCommand("diff and open in window", {
          a: ed1.textString, b: ed2.textString,
          filenameA: fn1, filenameB: fn2
        })
      }

      async function doMerge(ed1, ed2) {
        let merger = await loadObjectFromPartsbinFolder("text merger");
        return merger.targetMorph.open(ed1.textString, ed2.textString);
      }

      async function selectMorph(morphs, thenDo) {
        var candidates = morphs.map(ea =>
          ({isListItem: true, value: ea, string: ea.name || String(ea)}));
        var {selected: [choice]} = await world.filterableListPrompt(
          "choose text: ", candidates, {onSelection: m => m && m.show()});
        return choice;
      }

    }
  },

  {
    name: 'search workspaces',
    exec: async function() {

      let {selected: [choice]} = await $world.filterableListPrompt("search workspaces", [], {
        historyId: "lively.morphic-ide-search-workspaces-hist",
        customize: function(listPrompt) {
          listPrompt.getSubmorphNamed("list").updateFilter = function() {
            var parsed = this.parseInput();
            if (parsed.input.length < 3) return;
            let morphs = findWindowOrMorphWithStrings(parsed.lowercasedTokens);
            this.listMorph.items = morphsToCandidates(morphs, parsed.lowercasedTokens);
          }

        }
      });

      if (choice) {
        let {morph, window: win, row} = choice;
        if (win) {
          if (win.minimized) win.toggleMinimize();
          win.activate()
        }
        (win || morph).show();
        this.cursorPosition = {row, column: 0};

        return morph;
      }

      return null;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      function morphsToCandidates(morphs, tokens) {
        return morphs.map(function(m) {
          var win = m.world() ? m.getWindow() : $world.withAllSubmorphsDetect(m => m.isWindow && m.targetMorph === morph),
              row = 0,
              preview = lively.lang.string.lines(m.textString).find((l, i) => {
                l = l.toLowerCase(); row = i;
                return tokens.every(token => l.includes(token));
              }),
              title = win ? win.title : m.toString();
          return preview ? {
            isListItem: true,
            string: title + " | " + preview,
            value: {window: win, morph: m, row}
          } : null;
        }).filter(Boolean);
      }

      function findWindowOrMorphWithStrings(strings) {
        return $world.withAllSubmorphsDo(morph => {
          // collapsed window's codeeditor is not in world, pluck them manually
          if (morph.isWindow && morph.minimized && morph.targetMorph && morph.targetMorph.isText) morph = morph.targetMorph;
          if (!morph.textString) return null;
          if (!morph.isText) return null;
          if (morph.isUsedAsEpiMorph()) return null;
          let textString = morph.textString.toLowerCase();
          if (!strings.every(string => textString.includes(string))) return null;
          return morph;
        }).filter(Boolean);
      }
    }
  },

  {
    name: "open PartsBin",
    exec: async function(world) {
      var li = LoadingIndicator.open('Loading Partsbin...');
      var { loadPart } = await System.import("lively.morphic/partsbin.js")
      var pb = await loadPart("PartsBin");
      pb.openInWorldNearHand();
      pb.targetMorph.selectedCategory = "*basics*";
      pb.focus();
      li.remove();
      return pb;
    }
  },

  {
    name: "load object from PartsBin",
    exec: async function(world, opts = {}) {
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
    exec: async function(world) {
      var { default: ObjectDrawer } = await System.import("lively.components/object-drawer.js")
      return new ObjectDrawer().openInWorldNearHand();
    }
  },

  {
    name: 'open object editor',
    exec: async function(world, args = {
      target: null,
      selectedClass: null,
      selectedMethod: null,
      evalEnvironment: null
    }) {
      if (!args.target) {
        world.setStatusMessage('No target for ObjectEditor');
        return null;
      }
      let { ObjectEditor } = await System.import('lively.ide/js/objecteditor/index.js');
      return await ObjectEditor.open(args);
    }
  },

  {
    name: "open object inspector",
    exec: async (world, args = {target: null}) => {
      if (!args.target) {
        world.setStatusMessage("no target for Inspector");
        return null;
      }
      return inspect(args.target);
    }
  },

  {
     name: "inspect server",
     exec: async(world) => {
        let { default: Inspector } = await System.import("lively.ide/js/inspector.js"),
            { serverInterfaceFor } = await System.import('lively-system-interface'),
            remote = serverInterfaceFor(System.baseURL + 'eval'),
            evalEnvironment = {
          format: 'esm',
          context: 'global',
          targetModule: "lively://lively.next-workspace/world",
          sourceURL: 'inspect-server_' + Date.now(),
          systemInterface: remote
        }
        await remote.runEval(`
           import LivelyServer from "lively.server/server.js";
           let server = LivelyServer.servers.values().next().value;
        `, evalEnvironment);
        Inspector.openInWindow({ remoteTarget: { code: 'server', evalEnvironment }})
     }
  },

  {
    name: "open scene graph inspector",
    exec: async (world, args = {target: null}) => {
      let inspector = await loadObjectFromPartsbinFolder("scene graph inspector");
      inspector.targetMorph = args.target || world;
      return inspector.openInWindow({title: "morph graph"});
    }
  },

  {
    name: "open browser",
    progressIndicator: "opening browser...",
    exec: async (world, args = {packageName: "lively.morphic", moduleName: "morph.js"}, _, evt) => {
      // in case there is another morph implementing open browser...
      var relayed = evt && world.relayCommandExecutionToFocusedMorph(evt);
      if (relayed) return relayed;

      var { default: Browser } = await System.import("lively.ide/js/browser/index.js"),
          loc = obj.select(args, ["packageName", "moduleName", "textPosition", "codeEntity", "systemInterface"]),
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
        let excluded = (Path("lively.ide.exclude").get(p) || []).map(ea =>
                 ea.includes("*") ? new RegExp(ea.replace(/\*/g, ".*")): ea);
        excluded.push(".git", "node_modules", ".module_cache");
        items.push(...(await systemInterface.resourcesOfPackage(p, excluded))
          .filter(({url}) => !url.endsWith("/") && !excluded.some(ex => ex instanceof RegExp ? ex.test(url): url.includes(ex)))
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
          { default: Browser } = await System.import("lively.ide/js/browser/index.js");

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
          { default: Browser } = await System.import("lively.ide/js/browser/index.js"),
          { localInterface } = await System.import("lively-system-interface"),
          systemInterface = opts && opts.systemInterface ? opts.systemInterface :
            browser ? browser.systemInterface : localInterface,
          locationString = systemInterface.name == 'local' ? '' : ` on [${
              string.truncate(systemInterface.name, 35, '...')
          }]`,
          pkgs = await systemInterface.getPackages(),
          items = [];

      for (let p of pkgs) {
        let excluded = Path("lively.ide.exclude").get(p) || [];
        excluded = excluded.map(ea => ea.includes("*") ? new RegExp(ea.replace(/\*/g, ".*")): ea)
        for (let m of p.modules) {
          if (excluded.some(ex => ex instanceof RegExp ? ex.test(m.name): m.name.includes(ex))) continue;
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
         let requester = browser || focused;
         var {selected} = await world.filterableListPrompt(
             `Choose module to open${locationString}`, items, {
              historyId: "lively.morphic-choose and browse module",
              requester, height: Math.min(requester.height, 700),
              width: 500, multiSelect: true, listFontColor: "white", fuzzy: "value.shortName"});

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

      let { localInterface } = await System.import("lively-system-interface"),
          systemInterface = opts.systemInterface || (browser && browser.systemInterface);
      if (!systemInterface) {
        let ed = activeMorphs.find(ea =>
          ea.isText && ea.editorPlugin && ea.editorPlugin.isJSEditorPlugin);
        if (ed) systemInterface = ed.editorPlugin.systemInterface()
        else systemInterface = localInterface;
      }

      let searcher = await loadObjectFromPartsbinFolder("code search");
      Object.assign(searcher.targetMorph, {
        browser,
        input: opts.input,
        systemInterface
      });
      searcher.activate();

      if (browser) browser.state.associatedSearchPanel = searcher;
      return searcher;
    }
  },

  {
    name: "open grep search",
    progressIndicator: "opening code search...",
    exec: async (world, opts) => {
      let searcher = await loadObjectFromPartsbinFolder("grep search")
      return searcher.openInWorldNearHand(world).activate();
    }
  },

  {
    name: "open test runner",
    progressIndicator: "opening test runner...",
    exec: async world => {
      var {default: TestRunner} = await System.import("lively.ide/test-runner.js");
      return await TestRunner.open();
    }
  },

  {
    name: "open file browser",
    progressIndicator: "opening file browser...",
    exec: async (world, opts = {}) => {
      var { default: HTTPFileBrowser } = await System.import("lively.ide/http-file-browser.js"),
          { location, url, file } = opts;
      var browser = file ?
        HTTPFileBrowser.forFile(file, location) :
        HTTPFileBrowser.forLocation(url || location || document.location.origin);
      return world.openInWindow(browser).activate();
    }
  },

  {
    name: "open file",
    progressIndicator: "opening file...",
    exec: async (world, opts = {url: null, lineNumber: null, reuse: false}) => {
      let { url, lineNumber, reuse } = opts;
      if (!url)
        url = await world.prompt("Enter file location", {
          historyId: "lively.morphic-text editor url",
          useLastInput: true
        });

      if (reuse) {
        let ea = world.getWindows().slice(-2)[0],
            editor = arr.findAndGet(world.getWindows(), ea => {
              let t = ea.targetMorph;
              return t && t.isTextEditor && t.location.split(":")[0] === url ? t : null;
            });
        if (editor) {
          if (typeof lineNumber === "number")
            editor.lineNumber = lineNumber;
          return editor.getWindow().activate();
        }
      }

      if (lineNumber) url += ":" + lineNumber;
      let { default: TextEditor } = await System.import("lively.ide/text-editor.js");
      return url ? TextEditor.openURL(url, obj.dissoc(opts, ["url"])) : null;
    }
  },

  {
    name: "open file for EDITOR",
    exec: async (world, opts = {url: null, lineNumber: null}) => {
      // for using from command line, see l2l default client actions and
      // lively.shell/bin/lively-as-editor.js
      var { default: TextEditor } = await System.import("lively.ide/text-editor.js"),
          { url, lineNumber } = opts;
      // "saved" || "aborted"
      return  await TextEditor.openAsEDITOR(url, {});
    }
  },

  {
    name: "open subserver controller",
    exec: async (world, opts) => {
      let controller = await loadPart("subserver controller");
      return controller.openInWorld();
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
      args = {confirmOverwrite: true, showSaveDialog: true, ...args};
      let focused = world.focusedMorph,
          saved = await interactivelySaveWorld(world, args);
      if (focused && focused.focus());
      return saved;
    }
  },

  {
    name: 'freeze world',
    exec: async (world) => {
      let { default: L2LClient} = await System.import("lively.2lively/client.js");
      let l2lClient = L2LClient.default();
      let peers = await l2lClient.listPeers(true)
      let freezer = peers.find(ea => ea.type === "lively.next.org freezer service");
      let name = await world.prompt('Please enter an identifier for the frozen world');
      if (!name) return;
      let { data: status } = await l2lClient.sendToAndWait(freezer.id, "[freezer] status", {}); 
      let deployment;
      if (deployment = status.find(({id}) => id === name)) {
        if(await $world.confirm('A frozen part/world with this name already exists. Would you like to update this deployment?')) {
           return LoadingIndicator.forPromise(
               l2lClient.sendToAndWait(freezer.id, "[freezer] update part", deployment),
               `updating deployment for ${name}...`);
        }
      }
      deployment = {
        id: name,
        commit: await ensureCommitInfo(world.metadata.commit),
        dbName: MorphicDB.default.name
      };
      return LoadingIndicator.forPromise(
         l2lClient.sendToAndWait(freezer.id, "[freezer] register part", deployment),
        `freezing world ${name}...`
      ); 
    }
  },

  {
    name: "save this world",
    exec: (world, args, _, evt) => {
      return world.execCommand("save world", {confirmOverwrite: true, ...args, showSaveDialog: false});
    }
  },

  {
    name: "load world",
    exec: async (oldWorld, args = {}) => {
      // args: {
      //   id: commitId
      //   name: world name
      //   ref: ref the world was committed on
      //   world: the world morph to load
      // }
      let {id, commit, name, ref, world} = args;
      let World = oldWorld.constructor;

      if (world) return World.loadWorld(world, oldWorld);
      if (id || commit) return World.loadFromCommit(id || commit, oldWorld);
      if (name) return World.loadFromDB(name, ref, oldWorld);

      let worldList = oldWorld.get("world-list") || await loadObjectFromPartsbinFolder("world-list");
      worldList.bringToFront().alignInWorld(oldWorld);
      worldList.update();
      worldList.focus();
      return worldList;

    }
  },

  {
    name: "add external package dependency to object",
    exec: async (world, opts = {}) => {
      let object = opts.target || world,
          externalPackages = (object.metadata && object.metadata.externalPackages) || [],
          {list} = await world.editListPrompt(
            "modify package dependencies of " + object, externalPackages);
      if (!list) return;
      if (!list.length) {
        if (object.metadata)
          delete object.metadata.externalPackages;
      } else {
        if (!object.metadata) object.metadata = {};
        object.metadata.externalPackages = list;
      }
      return true;
    }
  }

]

export default commands;
