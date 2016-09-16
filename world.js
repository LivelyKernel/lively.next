import { Color, pt } from "lively.graphics";
import { arr, obj, promise } from "lively.lang";
import { Halo } from "./halo/morph.js"
import { FilterableList } from "./list.js"
import { Menu } from "./menus.js"
import { show, StatusMessage } from "./markers.js";
import config from "./config.js";
import { morph, Morph, Text, Window } from "./index.js";
import { connect, disconnectAll } from "lively.bindings";


import { ObjectDrawer, Workspace, Browser } from "./tools.js";
import { CodeSearcher } from "./ide/code-search.js"

var worldCommands = [

  {
    name: "show halo for focused morph",
    exec: (world) => {
      var morph = world.focusedMorph;
      world.showHaloFor(morph.getWindow() || morph, world.firstHand.pointerId);
      return true;
    }
  },

  {
    name: "escape",
    exec: (world) => {
      var halos = world.halos();
      halos.forEach(h => h.remove());
      arr.last(halos) && arr.last(halos).target.focus();
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
          win = await world.filterableListPrompt("Choose window", wins, {preselect: 1, width: world.visibleBounds().extent().x * 1/3, fontSize: 20});
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
    name: "open workspace",
    exec: world => {
      return world.addMorph(new Workspace({center: world.center})); 
    }
  },

  {
    name: "open browser",
    exec: world => {
      return new Browser({center: world.center}).activate();
    }
  },

  {
    name: "open code search",
    exec: world => CodeSearcher.inWindow({title: "code search", extent: pt(800, 500)}).activate()
  }
]

export class World extends Morph {

  constructor(props) {
    super(props);
    this.addStyleClass("world");
    this._renderer = null; // assigned in rendering/renderer.js
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
    return this.env.eventDispatcher.eventState.focusedMorph;
  }

  onMouseMove(evt) {
    evt.hand.update(evt);
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
      addHalo = target == evt.halo && evt.isCommandKey() && evt.halo.target.owner;
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
        ["undo", () => { this.env.undoManager.undo(); }],
        ["redo", () => { this.env.undoManager.redo(); }],
        ["Workspace", () => this.execCommand("open workspace")],
        ["Browser", () => this.execCommand("open browser")],
        ["ObjectDrawer", () => { this.addMorph(new ObjectDrawer({center: this.center})); }],
      ]
    }));
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
        width, height;
    if (false && (UserAgent.isTouch || UserAgent.isMobile)){
      width = window.innerWidth * scale;
      height = window.innerHeight * scale;
    } else {
      width = topmost.clientWidth * scale;
      height = topmost.clientHeight * scale;
    }
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
    var focused = this.focusedMorph;
    this.addMorph(promptMorph);
    promptMorph.center = opts.requester ? opts.requester.globalBounds().center() : this.visibleBounds().center();
    return promise.finally(promptMorph.activate(), () => focused && focused.focus());
  }

  inform(label = "no message", opts = {requester: null}) {
    return this.openPrompt(new InformPrompt({label, ...opts}), opts).activate();
  }

  prompt(label, opts = {requester: null, input: "", historyId: null, useLastInput: false}) {
    // this.world().prompt("test")
    // options = {
    //   input: STRING, -- optional, prefilled input string
    //   historyId: STRING, -- id to identify the input history for this prompt
    //   useLastInput: BOOLEAN -- use history for default input?
    // }
    return this.openPrompt(new TextPrompt({label, ...opts}), opts);
  }

  filterableListPrompt(label = "", items = [], opts = {requester: null, preselect: 0}) {
    return this.openPrompt(new FilterableListPrompt({label, items, ...opts}), opts);
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
    this.state = {answer: promise.deferred()}
    var autoRemove = props.hasOwnProperty("autoRemove") ? props.autoRemove : true;
    if (autoRemove)
      promise.finally(this.state.answer.promise, () => this.remove());
  }

  get label() { return this.get("label").textString; }
  set label(label) {
    this.get("label").textString = label;
    this.applyLayout();
  }

  resolve(arg) { this.state.answer.resolve(arg); }
  reject(reason) { this.state.answer.reject(reason); }

  async activate() {
    this.focus();
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

  build() {
    this.get("label") || this.addMorph({fill: null, name: "label", type: "text", textString: "", readOnly: true});
    this.get("okBtn") || this.addMorph({name: "okBtn", type: "button", label: "OK"});
    connect(this.get("okBtn"), 'fire', this, 'resolve');
  }

  applyLayout() {
    var label = this.get("label"),
        okBtn = this.get("okBtn");
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


export class TextPrompt extends AbstractPrompt {

  build() {
    this.get("label") || this.addMorph({fill: null, name: "label", type: "text", textString: "", readOnly: true});
    this.get("input") || this.addMorph(Text.makeInputLine({name: "input"}));
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
    label.position = pt(1,1);
    if (label.width > this.width) this.width = label.width+2;
    input.width = this.width-2;
    input.topLeft = label.bottomLeft;
    cancelBtn.topRight = pt(this.width-1, input.bottom+1);
    okBtn.topRight = cancelBtn.topLeft;
    this.height = okBtn.bottom;
  }

  focus() { this.get("input").focus(); }
}


export class FilterableListPrompt extends AbstractPrompt {

  constructor(props = {}) {
    super(obj.dissoc(props, ["preselect", "items"]));
    this.get("list").items = props.items || [];
    if (typeof props.preselect === "number") {
      this.get("list").selectedIndex = props.preselect;
      this.get("list").get("list").scrollSelectionIntoView();
    }
  }

  build({fontSize, fontFamily}) {
    this.get("label") || this.addMorph({fill: null, name: "label", type: "text", textString: "", readOnly: true, selectable: false, fontSize, fontFamily});
    this.get("list") || this.addMorph(new FilterableList({name: "list", fontSize, fontFamily}));
    this.get("okBtn") || this.addMorph({name: "okBtn", type: "button", label: "OK"});
    this.get("cancelBtn") || this.addMorph({name: "cancelBtn", type: "button", label: "Cancel"});
    connect(this.get("okBtn"), 'fire', this, 'resolve');
    connect(this.get("cancelBtn"), 'fire', this, 'reject');
  }

  resolve() { super.resolve(this.get("list").selection); }

  applyLayout() {
    var label = this.get("label"),
        list = this.get("list"),
        okBtn = this.get("okBtn"),
        cancelBtn = this.get("cancelBtn");
    if (label.width > this.width) this.width = label.width;
    list.width = this.width;
    list.top = label.bottom;
    cancelBtn.topRight = pt(this.width, list.bottom);
    okBtn.topRight = cancelBtn.topLeft;
    this.height = okBtn.bottom;
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
