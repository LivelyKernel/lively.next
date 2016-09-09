import { Color, pt } from "lively.graphics";
import { arr, obj, promise } from "lively.lang";
import { Halo } from "./halo/morph.js"
import { Menu } from "./menus.js"
import { show, StatusMessage } from "./markers.js";
import config from "./config.js";
import { morph, Morph, Text } from "./index.js";
import { connect, disconnectAll } from "lively.bindings";


import { ObjectDrawer, Workspace, Browser } from "./tools.js";

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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
        ["Workspace", () => { this.addMorph(new Workspace({center: this.center})); }],
        ["Browser", () => { this.addMorph(new Browser({center: this.center})); }],
        ["ObjectDrawer", () => { this.addMorph(new ObjectDrawer({center: this.center})); }],
      ]
    }));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // halos
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  halos() { return this.submorphs.filter(m => m.isHalo); }

  haloForPointerId(pointerId) {
    return this.submorphs.find(m => m.isHalo && m.state.pointerId === pointerId);
  }

  showHaloFor(morph, pointerId) {
    return this.addMorph(new Halo(pointerId, morph)).alignWithTarget();
  }

  layoutHaloForPointerId(pointerId) {
    return this.submorphs.find(m => m.isLayoutHalo && m.state.pointerId === pointerId);
  }

  showLayoutHaloFor(morph, pointerId) {
    return this.addMorph(morph.layout.inspect(pointerId));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleBounds() {
    // FIXME, see below
    return this.innerBounds()
  }

  // visibleBounds () {
  //   // the bounds call seems to slow down halos...
  //   return this.windowBounds().intersection(this.innerBounds());
  // }

  // windowBounds(optWorldDOMNode) {
  //   if (this.cachedWindowBounds) return this.cachedWindowBounds;
  //   var canvas = optWorldDOMNode || this.renderContext().getMorphNode(),
  //     topmost = document.documentElement,
  //     body = document.body,
  //     scale = 1 / this.getScale(),
  //     topLeft = pt(body.scrollLeft - (canvas.offsetLeft || 0), body.scrollTop - (canvas.offsetTop || 0)),
  //     width, height;
  //   if (UserAgent.isTouch || UserAgent.isMobile){
  //     width = window.innerWidth * scale;
  //     height = window.innerHeight * scale;
  //   } else {
  //     width = topmost.clientWidth * scale;
  //     height = topmost.clientHeight * scale;
  //   }
  //   return this.cachedWindowBounds = topLeft.scaleBy(scale).extent(pt(width, height));
  // }

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
  inform(message = "no message") {
    var dialog = this.addMorph(new InformPrompt({label: message}))
    dialog.center = this.innerBounds().center();
    return dialog.activate()
  }

  prompt(message, defaultInputOrOptions) {
    // that.prompt("test")
    // options = {
    //   input: STRING, -- optional, prefilled input string
    //   historyId: STRING, -- id to identify the input history for this prompt
    //   useLastInput: BOOLEAN -- use history for default input?
    // }
    var dialog = this.addMorph(new TextPrompt({label: message}))
    dialog.center = this.innerBounds().center();
    return dialog.activate()
  }
}


class AbstractPrompt extends Morph {

  constructor(props = {}) {
    var {label} = props;
    props = obj.dissoc(props, ["label", "autoRemove"])
    super({fill: Color.gray.lighter(), extent: pt(300,80), props});
    this.build();
    this.setLabel(label);
    this.state = {answer: promise.deferred()}
    var autoRemove = props.hasOwnProperty("autoRemove") ? props.autoRemove : true;
    if (autoRemove)
      this.state.answer.promise.then(() => this.remove(), err => this.remove());
  }

  setLabel(label) {
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
}

class InformPrompt extends AbstractPrompt {

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


class TextPrompt extends AbstractPrompt {

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
    if (label.width > this.width) this.width = label.width;
    input.width = this.width;
    input.top = label.bottom;
    cancelBtn.topRight = pt(this.width, input.bottom);
    okBtn.topRight = cancelBtn.topLeft;
    this.height = okBtn.bottom;
  }

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Enter': this.resolve(); evt.stop(); break;
      case 'Escape': this.reject(); evt.stop(); break;
    }
  }

  focus() { this.get("input").focus(); }
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
