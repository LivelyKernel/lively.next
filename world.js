/*global System*/
import { Rectangle, Color, pt } from "lively.graphics";
import { arr, obj, promise } from "lively.lang";
import { once, signal } from "lively.bindings";
import { StatusMessage, StatusMessageForMorph } from './components/markers.js';
import { Morph, inspect, config, MorphicEnv, Window, Menu } from "./index.js";
import { TooltipViewer } from "./components/tooltips.js";

import {
  InformPrompt,
  ConfirmPrompt,
  MultipleChoicePrompt,
  TextPrompt,
  PasswordPrompt,
  ListPrompt,
  EditListPrompt
} from "./components/prompts.js";
import { loadMorphFromSnapshot, loadWorldFromResource } from "./serialization.js";

import { loadObjectFromPartsbinFolder } from "./partsbin.js";
import { uploadFile } from "./events/html-drop-handler.js";
import worldCommands from "./world-commands.js";
import { loadWorldFromURL, loadWorld } from "./world-loading.js";


export class World extends Morph {

  static defaultWorld() { return MorphicEnv.default().world; }

  static async loadWorldFromURL(url, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorldFromURL(url, oldWorld, options);
  }

  static async loadWorld(newWorld, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorld(newWorld, oldWorld, options);
  }

  constructor(props) {
    super(props);
    this._renderer = null; // assigned in rendering/renderer.js
    this._tooltipViewer = new TooltipViewer(this);
  }

  __deserialize__(snapshot, objRef) {
    super.__deserialize__(snapshot, objRef);
    this._renderer = null;
    this._tooltipViewer = new TooltipViewer(this);
  }

  __additionally_serialize__(snapshot, objRef, pool, addFn) {
    super.__additionally_serialize__(snapshot, objRef, pool, addFn);
    // remove epi morphs
    let submorphs = snapshot.props.submorphs.value;
    for (let i = submorphs.length; i--; ) {
      let {id} = submorphs[i];
      if (pool.refForId(id).realObj.isHand)
        arr.removeAt(submorphs, i);
    }
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

  makeDirty() {
    if (this._dirty) return;
    this._dirty = true;
    let r = this.env.renderer;
    r && r.renderLater();
  }

  get hands() {
    return arr.sortBy(this.submorphs.filter(ea => ea.isHand), ea => ea.pointerId);
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
    evt.hand && evt.hand.update(evt);
    this._tooltipViewer.mouseMove(evt);
  }

  onMouseDown(evt) {
    var target = evt.state.clickedOnMorph,
        isCommandKey = evt.isCommandKey(),
        isShiftKey = evt.isShiftDown();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // halo activation + removal
    // note that the logic for cycling halos from morph to underlying morph is
    // implemented in Halo>>onMouseDown
    var haloTarget;
    if (isCommandKey) {
      var morphsBelow = evt.world.morphsContainingPoint(evt.position),
          morphsBelowTarget = morphsBelow.slice(morphsBelow.indexOf(target));
      morphsBelow = morphsBelow.filter(ea => ea.halosEnabled);
      morphsBelowTarget = morphsBelowTarget.filter(ea => ea.halosEnabled);
      haloTarget = morphsBelowTarget[0] || morphsBelow[0];
    }
    if (isShiftKey && !target.isHaloItem && haloTarget &&
         evt.halo && evt.halo.borderBox != haloTarget) {
       evt.halo.addMorphToSelection(haloTarget);
       return;
    }
    var removeHalo = evt.halo && !evt.targetMorphs.find(morph => morph.isHaloItem),
        removeLayoutHalo = evt.layoutHalo && !evt.targetMorphs.find(morph => morph.isHaloItem),
        addHalo = (!evt.halo || removeHalo) && haloTarget;
    if (removeLayoutHalo) evt.layoutHalo.remove();
    if (removeHalo) evt.halo.remove();
    if (addHalo) { evt.stop(); this.showHaloFor(haloTarget, evt.domEvt.pointerId); return; }
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    if (evt.state.menu) evt.state.menu.remove();

    this._tooltipViewer.mouseDown(evt);
  }

  onMouseUp(evt) {
    if (evt.isCommandKey() || evt.isShiftDown()) evt.stop();
    if (evt.isAltDown() && config.altClickDefinesThat) {
      var target = this.morphsContainingPoint(evt.position)[0];
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
     if (evt.leftMouseButtonPressed()) {
       this.selectionStartPos = evt.positionIn(this);
       this.morphSelection = this.addMorph({
          isSelectionElement: true,
          position: this.selectionStartPos, extent: evt.state.dragDelta,
          fill: Color.gray.withA(.2),
          borderWidth: 2, borderColor: Color.gray
       });
       this.selectedMorphs = {};
     }
  }

  onDrag(evt) {
    if (this.morphSelection) {
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
  }

  onDragEnd(evt) {
     if (this.morphSelection) {
       this.morphSelection.fadeOut(200);
       obj.values(this.selectedMorphs).map(m => m.remove());
       this.showHaloForSelection(Object.keys(this.selectedMorphs)
                                       .map(id => this.getMorphWithId(id)));
       this.selectedMorphs = {};
       this.morphSelection = null;
     }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // html5 drag - drop
  
  async onNativeDragover(evt) {
    if (!this._cachedDragIndicator)
      this._cachedDragIndicator = loadObjectFromPartsbinFolder("upload-indicator");
    let i = await this._cachedDragIndicator;
    if (!i.world()) i.openInWorld();
  }

  async onNativeDrop(evt) {
    if (this._cachedDragIndicator)
      this._cachedDragIndicator.then(i => i.remove());

    let {domEvt} = evt;
    // show(`
    //   ${domEvt.dataTransfer.files.length}
    //   ${domEvt.dataTransfer.items.length}
    //   ${domEvt.target}
    //   ${domEvt.dataTransfer.types}
    // `)

    for (let i = 0; i < domEvt.dataTransfer.items.length; i++) {
      let item = domEvt.dataTransfer.items[i];
      // console.log(`${item.kind} - ${item.type}`)
      if (item.kind === "file") {
        let f = item.getAsFile();
        let upload = await this.confirm(`Upload ${f.name}?`);
        if (upload) {
          let uploadedMorph = await uploadFile(f, f.type);
          uploadedMorph && uploadedMorph.openInWorld();
        }
      } else if (item.kind === "string") {
        item.getAsString((s) => inspect(s))
      }
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // menu
  menuItems() {
    return [
      {title: "World menu"},
      {command: "undo",                     target: this},
      {command: "redo",                     target: this},
      {isDivider: true},
      ["Debugging", [
        {command: "delete change history", target: this},
        {command: "fix font metric", target: this}
      ]],
      ["Tools", [
        {command: "open PartsBin",            target: this},
        {command: "open object drawer",       target: this},
        {command: "open workspace",           target: this},
        {command: "open browser",             target: this},
        {command: "choose and browse module", target: this},
        {command: "open code search",         target: this},
        {command: "open file browser",         target: this},
        {command: "open shell workspace",     target: this}
      ]],
      {isDivider: true},
      {command: "run command",              target: this},
      {command: "select morph",             target: this},
      // {command: "resize to fit window",     target: this},
      {command: "window switcher",          target: this},
      {command: "report a bug",          target: this},
      {command: "save world",          target: this},
      {command: "load world",          target: this},
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

  async onPaste(evt) {
    try {
      let data = evt.domEvt.clipboardData;
      if (data.types.includes("application/morphic")) {
        evt.stop();
        let snapshots = JSON.parse(data.getData("application/morphic")),
            morphs = [];
        data.clearData()
        if (!Array.isArray(snapshots)) snapshots = [snapshots];
        for (let s of snapshots) {
          let morph = await loadMorphFromSnapshot(s);
          morph.openInWorld(evt.hand.position);
          if (s.copyMeta && s.copyMeta.offset) {
            let {x,y} = s.copyMeta.offset;
            morph.moveBy(pt(x,y));
          }
          morphs.push(morph);
        }
        this.showHaloFor(morphs);
      }
    } catch (e) {
      this.showError(e)
    }
  }

  relayCommandExecutionToFocusedMorph(evt) {
    // can be called from exec method of commands with 4. argument (evt)
    // Will try to invoke mapped a command triggered by evt in the focused
    // morph or one of its owners. This provides optional "bubble" semantics
    // for command invocation
    if (!evt) return null;
    let focused = this.focusedMorph,
        {command, morph} = arr.findAndGet(
      arr.without([focused, ...focused.ownerChain()], this),
      morph => arr.findAndGet(morph.keyhandlers, kh => {
        let command = kh.eventCommandLookup(morph, evt);
        return command ? {command, morph} : null;
      })) || {};
    return command ? morph.execCommand(command) : null;
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

  async showHaloFor(target, pointerId = this.firstHand && this.firstHand.pointerId) {
    var {default: Halo} = await System.import("lively.morphic/halo/morph.js");
    return this.addMorph(new Halo({pointerId, target}));
  }

  async showHaloForSelection(selection, pointerId) {
    return selection.length > 0 && await this.showHaloFor(selection, pointerId);
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

  visibleStatusMessagesFor(morph) {
    return this.submorphs.filter(ea => ea.isStatusMessage && ea.targetMorph === morph)
  }

  logErrorPreperation(err) {
    var stringified = String(err),
        stack = err.stack || "";
    if (stack && err.message !== err.stack) {
      stack = String(stack);
      var errInStackIdx = stack.indexOf(stringified);
      if (errInStackIdx === 0)
        stack = stack.slice(stringified.length);
      stringified += "\n" + stack;
    }
    return stringified;
  }

  logError(err) {
    this.setStatusMessage(this.logErrorPreperation(err), Color.red);
  }

  showError(err) { return this.logError(err); }

  showErrorFor(morph, err) {
    return this.setStatusMessageFor(morph, this.logErrorPreperation(err), Color.red);
  }

  setStatusMessageFor(morph, message, color, delay = 5000, props) {
    this.visibleStatusMessagesFor(morph).forEach(ea => ea.remove());
    var msgMorph = new StatusMessageForMorph({message, color, ...props});
    this.openStatusMessage(msgMorph, delay);
    msgMorph.targetMorph = morph;
    msgMorph.fadeIn(300);
    if (msgMorph.removeOnTargetMorphChange && morph.isText) {
      once(morph, "selectionChange", msgMorph, "fadeOut", {converter: () => 200});
    }
    return msgMorph;
  }

  setStatusMessage(message, color, delay = 5000, optStyle = {}) {
    // $world.setStatusMessage("test", Color.green)
    console[color == Color.red ? "error" : "log"](message);
    return config.verboseLogging ?
      this.openStatusMessage(new StatusMessage({message, color, ...optStyle}), delay) :
      null;
  }

  openStatusMessage(statusMessage, delay) {
    // $world.setStatusMessage("test", Color.green)

    this.addMorph(statusMessage);

    if (statusMessage.slidable) {
      var messages = this.visibleStatusMessages();
      for (let m of messages) {
        if (messages.length <= (config.maxStatusMessages || 0)) break;
        if (m.stayOpen || !m.slidable) continue;
        m.remove();
        arr.remove(messages, m);
      }

      messages.forEach(async msg => {
        if(!msg.isMaximized && msg.slidable) {
          msg.slideTo(msg.position.addPt(pt(0, -statusMessage.extent.y - 10)))
        }
      });

      const msgPos = this.visibleBounds().bottomRight().addXY(-20, -20);
      statusMessage.align(statusMessage.bounds().bottomRight(), msgPos);
      statusMessage.topRight = msgPos.addPt(pt(0,40));
      statusMessage.animate({bottomRight: msgPos, duration: 500});
    }

    if (typeof delay === "number")
      setTimeout(() => statusMessage.stayOpen || statusMessage.fadeOut(), delay);

    return statusMessage;
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
      historyId: null,
      fuzzy: false,
      actions: ["default"],
      selectedAction: "default"
      // sortFunction: (parsedInput, item) => ...
      // filterFunction: (parsedInput, item) => ...
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
      reactsToPointer: false,
      pointerId
    });
    this.reset();
  }

  __deserialize__(snapshot, objRef) {
    super.__deserialize__(snapshot, objRef);
    this.reset();
  }

  reset() {
    // stores properties of morphs while those are being carried
    this.prevMorphProps = new WeakMap();
  }

  get isHand() { return true }

  get pointerId() { return this.getProperty("pointerId"); }
  set pointerId(id) { this.setProperty("pointerId", id); }

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
    this.prevMorphProps.set(morph, obj.select(morph, ["dropShadow", "reactsToPointer"]))
    // So that the morphs doesn't steal events
    morph.reactsToPointer = false;
    morph.dropShadow = true;
    this.addMorph(morph);
    signal(this, "grab", morph);
  }

  dropMorphsOn(dropTarget) {
    this.grabbedMorphs.forEach(morph => {
      try {
        dropTarget.addMorph(morph);      
        Object.assign(morph, this.prevMorphProps.get(morph));
        signal(this, "drop", morph);
        morph.onBeingDroppedOn(dropTarget);
      } catch (err) {
        console.error(err);
        this.world().showError(`Error dropping ${morph} onto ${dropTarget}:\n${err.stack}`);
        if (morph.owner !== dropTarget)
          this.world.addMorph(dropTarget);
      }
    });
  }

  findDropTarget(position = this.position, optFilterFn) {
    let morphs = this.world().morphsContainingPoint(position),
        filterFn = typeof optFilterFn === "function" ?
          (m, i) => !this.isAncestorOf(m) && m.acceptsDrops && optFilterFn(m, i) :
          m => !this.isAncestorOf(m) && m.acceptsDrops;
    return morphs.find(filterFn);
  }

}
