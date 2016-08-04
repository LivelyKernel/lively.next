import { Color, pt } from "lively.graphics";
import { arr } from "lively.lang";
import { Halo } from "./halo.js"
import { Menu } from "./menus.js"
import { show, StatusMessage } from "./markers.js";
import config from "./config.js";
import { morph } from "./index.js";
import { Morph } from "./morph.js";

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
      return;
    }

    if (evt.isAltDown() && config.altClickDefinesThat) {
      // FIXME currently delayed to overwrite that in old morphic
      (() => System.global.that = target).delay(0.1);
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
        ["redo", () => { this.env.undoManager.redo(); }]
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
