import { Rectangle, Color, pt } from "lively.graphics";
import { tree, arr, obj, promise } from "lively.lang";
import { Halo } from "./halo/morph.js"
import { List, FilterableList } from "./list.js"
import { Menu } from "./menus.js"
import { show, StatusMessage } from "./markers.js";
import config from "./config.js";
import { morph, Morph, Text, Window, TooltipViewer } from "./index.js";
import { connect, disconnectAll } from "lively.bindings";
import KeyHandler from "./events/KeyHandler.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--

import { ObjectDrawer, Workspace } from "./tools.js";
import { Browser } from "./ide/javascript-browser.js";
import { CodeSearcher } from "./ide/code-search.js"
import TestRunner from "lively.morphic/ide/test-runner.js"

var worldCommands = [

  {
    name: "undo",
    exec: world => { world.env.undoManager.undo(); return true; }
  },

  {
    name: "redo",
    exec: world => { world.env.undoManager.redo(); return true; }
  },

  {
    name: "run command",
    exec: async world => {
      var items = KeyHandler.generateCommandToKeybindingMap(world.focusedMorph || world, true).map(ea => {
            var {keys, target, command: {name}} = ea,
                targetName = target.constructor.name,
                keysPrinted = keys ? ` [${keys.join(", ")}]` : "";
            return {isListItem: true, string: `[${targetName}] ${name}${keysPrinted}`, value: ea};
          }),
          {prompt, selected: [cmd]} = await world.filterableListPrompt("Run command", items, {extent: pt(700,900), prompt: world._cachedRunCommandPrompt})
      world._cachedRunCommandPrompt = prompt;
      return cmd ? cmd.target.execCommand(cmd.command) : true;
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
    exec: async (world, opts = {justReturn: false}) => {
      var i = 0, items = tree.map(world,
        (m, depth) => ({isListItem: true, string: `${++i} ${"  ".repeat(depth)}${m}`, value: m}),
        m => m.submorphs);
      var {selected: morphs} = await world.filterableListPrompt("Choose morph", items, {onSelection: sel => sel && sel.show()});
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
      var wins = world.submorphs.filter(({isWindow}) => isWindow).reverse()
            .map(win => ({isListItem: true, string: win.title || String(win), value: win})),
          answer = await world.filterableListPrompt(
            "Choose window", wins, {
              preselect: 1,
              onSelection: sel => sel && sel.show(), 
              width: world.visibleBounds().extent().x * 1/3,
              labelFontSize: 16,
              listFontSize: 18,
              itemPadding: Rectangle.inset(4)
            }),
          {selected: [win]} = answer;
      if (win) { win.bringToFront(); win.focus(); }
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
        var next = arr.last(world.getWindows());
        if (next) next.activate();
        else world.focus();
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

        var thirdWMin = 750,
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
                case 'center': bounds = thirdColBounds.withCenter(worldB.center()); break;
                case 'right': bounds = thirdColBounds.withTopRight(worldB.topRight()); break;
                case 'left': bounds = thirdColBounds.withTopLeft(bounds.topLeft()); break;
                case 'col3': case 'center': bounds = thirdColBounds.withCenter(worldB.center()); break;
                case 'col5': case 'right': bounds = thirdColBounds.withTopRight(worldB.topRight()); break;
                case 'col1': case 'left': bounds = thirdColBounds.withTopLeft(bounds.topLeft()); break;
                case 'bottom': bounds = bounds.withY(bounds.y + bounds.height/2);
                case 'top': bounds = bounds.withHeight(bounds.height/2); break;
                case 'col2': bounds = thirdColBounds.withTopLeft(worldB.topCenter().scaleByPt(pt(.333,1))).withWidth(thirdW); break;
                case 'col4': bounds = thirdColBounds.withTopRight(worldB.topCenter().scaleByPt(pt(1.666,1))).withWidth(thirdW); break;
                case 'halftop': bounds = winB.withY(bounds.top()).withHeight(bounds.height/2); break;
                case 'halfbottom': bounds = winB.withY(bounds.height/2).withHeight(bounds.height/2); break;
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
    exec: world => {
      return new Workspace({center: world.center}).activate(); 
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
        new Text({...obj.dissoc(opts, ["title", "content"]),
                  textString: content, fixedWidth: true, fixedHeight: true, name, extent}),
        {title}).activate();
    }
  },

  {
    name: "diff and open in window",
    exec: async (world, opts = {textA: "", textB: "", extent: pt(500,600)}) => {
      var {textA, textB, extent} = opts;

      // import * as diff from "https://cdnjs.cloudflare.com/ajax/libs/jsdiff/3.0.0/diff.js"
      var diff = await System.import("https://cdnjs.cloudflare.com/ajax/libs/jsdiff/3.0.0/diff.js");
      var diffed = diffInWindow(textA, textB, {extent, fontFamily: "monospace"});

      function diffInWindow(textA, textB, opts) {
        var diffed = diff.diffChars(textA, textB);
        
        var insertions = diffed.map(({count, value, added, removed}) => {
          var attribute = removed ?
              {fontWeight: "normal", textDecoration: "line-through", fontColor: Color.red} : added ? 
              {fontWeight: "bold", textDecoration: "", fontColor: Color.green} :
              {fontWeight: "normal", textDecoration: "", fontColor: Color.darkGray};
          return { text: value, attribute }
        })

        var win = world.execCommand("open text window", opts),
            textMorph = win.targetMorph;
      
        insertions.forEach(({text, attribute}) => {
          textMorph.insertTextWithTextAttributes(text, attribute ? [attribute] : [])
        });

        win.width = textMorph.textBounds().width

        return textMorph;
      }
    }
  },

  {
    name: "open browser",
    exec: world => {
      return new Browser({extent: pt(700, 600), center: world.center}).activate();
    }
  },

  {
    name: "choose and browse package resources",
    exec: async world => {
      var browser, focused = world.focusedMorph;
      if (focused && focused.getWindow() instanceof Browser)
        browser = focused.getWindow();

      var livelySystem = (await System.import("lively-system-interface")).localInterface, // FIXME
          pkgs = await livelySystem.getPackages(),
          pkgs = pkgs.filter(({address}) => "no group" !== address),
          items = [];

      for (let p of pkgs) {
        items.push(...(await livelySystem.resourcesOfPackage(p))
          .filter(({name}) => !name.endsWith("/"))
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

      var {selected: [selected]} = await world.filterableListPrompt("Choose module to open", items, {requester: browser || focused, width: 700})

      selected && (await Browser.browse(selected.package.address, selected.name, undefined, browser)).activate()

      return true;
    }
  },

  {
    name: "choose and browse module",
    exec: async world => {
      var browser, focused = world.focusedMorph;
      if (focused && focused.getWindow() instanceof Browser)
        browser = focused.getWindow();

      var livelySystem = (await System.import("lively-system-interface")).localInterface, // FIXME
          pkgs = await livelySystem.getPackages(),
          items = [];

      for (let p of pkgs) {
        for (let m of p.modules) {
          var shortName = livelySystem.shortModuleName(m.name, p);
          items.push({isListItem: true, string: `[${p.name}] ${shortName}`, value: {package: p, module: m, shortName}})
        }
      }

      items = arr.sortBy(items, ea => ea.string);

      var {selected} = await world.filterableListPrompt("Choose module to open", items, {requester: browser || focused, width: 700, multiSelect: true});
      for (var i = 0; i < selected.length; i++) {
        var {package: p, shortName} = selected[i],
            b = await Browser.browse(
              p.name, shortName, undefined,
              i === 0 ? browser : undefined);
        b.moveBy(pt(i*20, i*20));
      }

      return true;
    }
  },

  {
    name: "open code search",
    exec: world => {
      var browser, focused = world.focusedMorph;
      if (focused && focused.getWindow() instanceof Browser) {
        browser = focused.getWindow();
        if (browser.state.associatedSearchPanel)
          return browser.state.associatedSearchPanel.getWindow().activate();
      }
      return CodeSearcher.inWindow({title: "code search", extent: pt(800, 500), targetBrowser: browser}).activate();
    }
  },

  {
    name: "open test runner",
    exec: world => TestRunner.open()
  }
]

export class World extends Morph {

  constructor(props) {
    super(props);
    this.addStyleClass("world");
    this._renderer = null; // assigned in rendering/renderer.js
    this._tooltipViewer = new TooltipViewer(this);
  }

  get isWorld() { return true }

  get draggable() { return false; }
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
  openInWindow(morph, opts = {title: morph.name, name: "window for " + morph.name}) {
    return new Window({...opts, extent: morph.extent.addXY(0, 25), targetMorph: morph});
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
      // propagate to halo to owner
      addHalo = target == evt.halo.borderBox && evt.isCommandKey() && evt.halo.target.owner;
      if (addHalo) {
        this.showHaloFor(evt.halo.target.owner, evt.domEvt.pointerId);
        return
      }
      return;
    }

    removeHalo = evt.layoutHalo && !evt.targetMorphs.find(morph => morph.isHaloItem);
    if (removeHalo) {
      evt.layoutHalo.remove();
    }

    if (evt.isAltDown() && config.altClickDefinesThat) {
      // FIXME currently delayed to overwrite that in old morphic
      setTimeout(() => System.global.that = target, 100);
      target.show();
      evt.stop();
      console.log(`Set global "that" to ${target}`);
      return;
    }

    if (evt.state.menu) {
      evt.state.menu.remove();
    }
  }

  onMouseUp(evt) { }

  onContextMenu(evt) {
    evt.stop();
    if (evt.state.menu) evt.state.menu.remove();
    this.addMorph(evt.state.menu = new Menu({
      position: evt.position,
      title: "World menu", items: [
        ["undo",                                                   () => this.env.undoManager.undo()],
        ["redo",                                                   () => this.env.undoManager.redo()],
        [`Workspace [${this.keysForCommand("open workspace")}]`,   () => this.execCommand("open workspace")],
        [`Browser [${this.keysForCommand("open browser")}]`,       () => this.execCommand("open browser")],
        [`Test runner`,                                            () => this.execCommand("open test runner")],
        [`ObjectDrawer`,                                           () => this.addMorph(new ObjectDrawer({center: this.center}))],
        [`Run command... [${this.keysForCommand("run command")}]`, () => this.execCommand("run command")],
      ]
    }));
  }

  onWindowScroll(evt) {}

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

  layoutHaloForPointerId(pointerId = this.firstHand && this.firstHand.pointerId) {
    return this.submorphs.find(m => m.isLayoutHalo && m.state.pointerId === pointerId);
  }

  showLayoutHaloFor(morph, pointerId = this.firstHand && this.firstHand.pointerId) {
    return this.addMorph(morph.layout.inspect(pointerId));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleBounds () {
    // the bounds call seems to slow down halos...
    return this.windowBounds().intersection(this.innerBounds());
  }

  windowBounds(optWorldDOMNode) {
    if (this._cachedWindowBounds) return this._cachedWindowBounds;
    var canvas = optWorldDOMNode || this.env.renderer.domNode,
        topmost = canvas.ownerDocument.documentElement,
        body = canvas.ownerDocument.body,
        scale = 1 / this.scale,
        topLeft = pt(body.scrollLeft - (canvas.offsetLeft || 0), body.scrollTop - (canvas.offsetTop || 0)),
        {window} = this.env.domEnv,
        width = (window.innerWidth || this.width) * scale,
        height = (window.innerHeight || this.height) * scale;
    return this._cachedWindowBounds = topLeft.scaleBy(scale).extent(pt(width, height));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // status messages
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleStatusMessages() {
    return this.submorphs.filter(ea => ea.isStatusMessage)
  }

  logError(err) {
    this.setStatusMessage(err.stack || String(err), Color.red);
  }

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

    messages.forEach(msg => !msg.isMaximized && msg.moveBy(pt(0, -msgMorph.extent.y)));

    msgMorph.align(msgMorph.bounds().bottomRight(), this.visibleBounds().bottomRight().addXY(-20, -20));
    this.addMorph(msgMorph);

    if (typeof delay !== "undefined")
      setTimeout(() => msgMorph.stayOpen || msgMorph.remove(), delay);

    return msgMorph;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // dialogs
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  openPrompt(promptMorph, opts = {requester: null}) {
    var focused = this.focusedMorph, visBounds = this.visibleBounds();
    promptMorph.openInWorldNear(
      opts.requester ?
        opts.requester.globalBounds().center() :
        visBounds.center(), this);

    if (promptMorph.height > visBounds.height)
      promptMorph.height = visBounds.height - 5;

    return promise.finally(promptMorph.activate(), () => focused && focused.focus());
  }

  inform(label = "no message", opts = {fontSize: 16, requester: null}) {
    return this.openPrompt(new InformPrompt({label, ...opts}), opts);
  }

  prompt(label, opts = {requester: null, input: "", historyId: null, useLastInput: false}) {
    // this.world().prompt("test", {input: "123"})
    // options = {
    //   input: STRING, -- optional, prefilled input string
    //   historyId: STRING, -- id to identify the input history for this prompt
    //   useLastInput: BOOLEAN -- use history for default input?
    // }
    return this.openPrompt(new TextPrompt({label, ...opts}), opts);
  }
  
  confirm(label, opts = {requester: null}) {
    // await this.world().confirm("test")
    return this.openPrompt(new ConfirmPrompt({label, ...opts}), opts);
  }

  listPrompt(label = "", items = [], opts = {requester: null, onSelection: null, preselect: 0}) {
    return this.openPrompt(new ListPrompt({
      filterable: false, padding: Rectangle.inset(3),
      label, items, ...opts}), opts);
  }

  filterableListPrompt(label = "", items = [], opts = {requester: null, onSelection: null, preselect: 0, multiSelect: false}) {
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

}


export class AbstractPrompt extends Morph {

  constructor(props = {}) {
    super({
      fill: Color.gray.lighter(), extent: pt(300,80),
      borderWidth: 1, borderColor: Color.gray,
      ...obj.dissoc(props, ["label", "autoRemove"])});

    this.build(props);
    this.label = props.label || "no label";
    this.state = {
      answer: null,
      autoRemove: props.hasOwnProperty("autoRemove") ? props.autoRemove : true
    };
    connect(this, "extent", this, "applyLayout");
  }

  get label() { return this.get("label").textString; }
  set label(label) {
    this.get("label").textString = label;
    this.applyLayout();
  }

  resolve(arg) { this.state.answer.resolve(arg); }
  reject(reason) { this.state.answer.resolve(undefined); }

  async activate() {
    this.focus();
    this.state.answer = promise.deferred();
    if (this.state.autoRemove)
      promise.finally(this.state.answer.promise, () => this.remove());
    return this.state.answer.promise;
  }

  build() { throw new Error("Not yet implemented"); }
  applyLayout() { throw new Error("Not yet implemented"); }

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Enter': this.resolve(); evt.stop(); break;
      case 'Escape': this.reject(); evt.stop(); break;
    }
  }

}

export class InformPrompt extends AbstractPrompt {

  build(props) {
    this.get("label") || this.addMorph({fontSize: 16, padding: Rectangle.inset(3), fontSize: 14, fill: null, ...props,  name: "label", type: "text", textString: "", readOnly: true});
    this.get("okBtn") || this.addMorph({name: "okBtn", type: "button", label: "OK"});
    connect(this.get("okBtn"), 'fire', this, 'resolve');
  }

  applyLayout() {
    var label = this.get("label"),
        okBtn = this.get("okBtn");
    label.fit();
    if (label.width > this.width) this.width = label.width;
    okBtn.topRight = pt(this.width, label.bottom);
    this.height = okBtn.bottom;
  }

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Escape': case 'Enter': this.resolve(); evt.stop(); break;
    }
  }

}


export class ConfirmPrompt extends AbstractPrompt {

  build() {
    this.get("label") || this.addMorph({fill: null, padding: Rectangle.inset(3), fontSize: 14, name: "label", type: "text", textString: "", readOnly: true});
    this.get("okBtn") || this.addMorph({name: "okBtn", type: "button", label: "OK"});
    this.get("cancelBtn") || this.addMorph({name: "cancelBtn", type: "button", label: "Cancel"});
    connect(this.get("okBtn"), 'fire', this, 'resolve');
    connect(this.get("cancelBtn"), 'fire', this, 'reject');
  }

  resolve() { super.resolve(true); }
  reject() { super.resolve(false); }

  applyLayout() {
    var label = this.get("label"),
        okBtn = this.get("okBtn"),
        cancelBtn = this.get("cancelBtn");
    label.fit();
    label.position = pt(1,1);
    if (label.width > this.width) this.width = label.width+2;
    cancelBtn.topRight = pt(this.width-1, label.bottom+1);
    okBtn.topRight = cancelBtn.topLeft;
    this.height = okBtn.bottom + 3;
  }
}

export class TextPrompt extends AbstractPrompt {

  build({input}) {
    this.get("label") || this.addMorph({fill: null, padding: Rectangle.inset(3), fontSize: 14, name: "label", type: "text", textString: "", readOnly: true});
    this.get("input") || this.addMorph(Text.makeInputLine({name: "input", textString: input || ""}));
    this.get("okBtn") || this.addMorph({name: "okBtn", type: "button", label: "OK"});
    this.get("cancelBtn") || this.addMorph({name: "cancelBtn", type: "button", label: "Cancel"});
    connect(this.get("okBtn"), 'fire', this, 'resolve');
    connect(this.get("cancelBtn"), 'fire', this, 'reject');
  }

  resolve() { super.resolve(this.get("input").textString); }

  applyLayout() {
    var label = this.get("label"),
        input = this.get("input"),
        okBtn = this.get("okBtn"),
        cancelBtn = this.get("cancelBtn");
    label.fit();
    label.position = pt(1,1);
    if (label.width > this.width) this.width = label.width+2;
    input.width = this.width-2;
    input.topLeft = label.bottomLeft;
    cancelBtn.topRight = pt(this.width-1, input.bottom+1);
    okBtn.topRight = cancelBtn.topLeft;
    this.height = okBtn.bottom + 3;
  }

  focus() { this.get("input").focus(); }
}


export class ListPrompt extends AbstractPrompt {

  constructor(props = {}) {
    super(obj.dissoc(props, ["preselect", "items", "onSelection"]));
    this.get("list").items = props.items || [];
    if (typeof props.preselect === "number") {
      this.get("list").selectedIndex = props.preselect;
      this.get("list").scrollSelectionIntoView();
    }
    if (typeof props.onSelection === "function")
      connect(this.get("list"), "selection", props, "onSelection");
  }

  build({listFontSize,
         listFontFamily,
         labelFontSize,
         labelFontFamily,
         filterable,
         padding,
         itemPadding,
         extent,
         multiSelect}) {
    this.extent = extent || pt(500,400);
    var ListClass = filterable ? FilterableList : List;
    labelFontFamily = labelFontFamily || "Helvetica Neue, Arial, sans-serif";
    labelFontSize = labelFontSize || 14;
    listFontFamily = listFontFamily || labelFontFamily;
    listFontSize = listFontSize || labelFontSize;
    this.get("label") || this.addMorph({fill: null, padding: Rectangle.inset(3), name: "label", type: "text", textString: " ", readOnly: true, selectable: false, fontSize: labelFontSize, fontFamily: labelFontFamily});
    this.get("list") || this.addMorph(new ListClass({borderWidth: 1, borderColor: Color.gray, name: "list", fontSize: listFontSize, fontFamily: listFontFamily, padding, itemPadding, multiSelect}));
    this.get("okBtn") || this.addMorph({name: "okBtn", type: "button", label: "OK"});
    this.get("cancelBtn") || this.addMorph({name: "cancelBtn", type: "button", label: "Cancel"});
    connect(this.get("okBtn"), 'fire', this, 'resolve');
    connect(this.get("cancelBtn"), 'fire', this, 'reject');
  }

  resolve() {
    var answer = this.get("list") instanceof FilterableList ?
      {
        filtered: this.get("list").state.allItems,
        selected: this.get("list").get("list").selections,
        status: "accepted"
      } : {
        selected: this.get("list").selections,
        status: "accepted"
      }
    return this.state.answer.resolve(answer);
  }
  
  reject() { return this.state.answer.resolve({prompt: this, selected: [], filtered: [], status: "canceled"}); }

  applyLayout() {
    var label = this.get("label"),
        list = this.get("list"),
        okBtn = this.get("okBtn"),
        cancelBtn = this.get("cancelBtn");
    label.fit();
    if (label.width > this.width) this.width = label.width;
    list.width = this.width;
    list.top = label.bottom;
    cancelBtn.bottomRight = pt(this.width, this.height-3);
    okBtn.topRight = cancelBtn.topLeft;
    // this.height = okBtn.bottom + 3;
    list.height = this.height - list.top - cancelBtn.height - 3;
  }

  focus() { this.get("list").focus(); }
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
    this.addStyleClass("hand");
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
    this.prevMorphProps = {
      dropShadow: morph.dropShadow,
      reactsToPointer: morph.reactsToPointer
    }
    this.addMorph(morph);
    // So that the morph doesn't steal events
    morph.reactsToPointer = false;
    morph.dropShadow = true;
  }

  dropMorphsOn(dropTarget) {
    this.grabbedMorphs.forEach(morph => {
      dropTarget.addMorph(morph)
      morph.reactsToPointer = this.prevMorphProps.reactsToPointer;
      morph.dropShadow = this.prevMorphProps.dropShadow;
    });
  }
}
