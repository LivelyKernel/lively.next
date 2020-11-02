/*global System,WeakMap,FormData,fetch,DOMParser*/
import bowser from 'bowser';
import { Rectangle, Color, pt } from "lively.graphics";
import { arr, promise, Path, obj } from "lively.lang";
import { signal } from "lively.bindings";
import config from './config.js';
import { MorphicEnv } from './env.js'
import { Morph } from "./morph.js";
import { TooltipViewer, Tooltip } from "./tooltips.js";

import { loadWorldFromURL, loadWorldFromDB, loadWorldFromCommit, loadWorld } from "./world-loading.js";
import { touchInputDevice } from "./helpers.js";
import { UserRegistry } from "lively.user";
import { loadMorphFromSnapshot } from "lively.morphic";
import { emit } from "lively.notifications/index.js";
import { resource } from "lively.resources/index.js";

export class World extends Morph {

  static get properties() {
    return {

      resizePolicy : {
        doc: "how the world behaves on window size changes 'elastic': resizes to window extent, 'static': leaves its extent unchanged",
        defaultValue: 'elastic',
        after: ["clipMode"],
        type: 'Enum',
        values: ['static', 'elastic'],
        set(val) {
          this.setProperty("resizePolicy", val);
          this.clipMode = val === "static" ? "visible" : "hidden";
          if (val == "elastic") this.execCommand("resize to fit window");
        }
      },

      colorScheme: {
        derived: true,
        get() {
          // place somewhere were it is called less often???
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light"
        }
      },

      showsUserFlap: {
        defaultValue: true,
        set(bool) {
          // allow to override from URL
          const { showsUserFlap } = resource(document.location.href).query();
          if (typeof showsUserFlap != 'undefined') bool = showsUserFlap;
          this.setProperty("showsUserFlap", bool);
          System.import("lively.user/morphic/user-ui.js")
            .then(userUI => userUI.UserUI[bool ? "showUserFlap" : "hideUserFlap"](this));
        }
      },
    };
  }

  static defaultWorld() { return MorphicEnv.default().world; }

  static loadWorldFromURL(url, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorldFromURL(url, oldWorld, options);
  }

  static loadWorld(newWorld, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorld(newWorld, oldWorld, options);
  }

  static loadFromCommit(commitOrId, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorldFromCommit(commitOrId, oldWorld, options);
  }

  static loadFromDB(name, ref, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorldFromDB(name, ref, oldWorld, options);
  }

  static async loadFromResource(res, oldWorld = this.defaultWorld(), options = {}) {
    return await loadWorld(await loadMorphFromSnapshot(await res.readJson()), oldWorld, options);
  }

  constructor(props) {
    super(props);
    this._renderer = null; // assigned in rendering/renderer.js
    this._tooltipViewer = new TooltipViewer(this);
  }

  __deserialize__(snapshot, objRef, serializedMap, pool) {
    super.__deserialize__(snapshot, objRef, serializedMap, pool);
    this._renderer = null;
    this._tooltipViewer = new TooltipViewer(this);
  }

  __additionally_serialize__(snapshot, objRef, pool, addFn) {
    super.__additionally_serialize__(snapshot, objRef, pool, addFn);
    // remove epi morphs
    if (snapshot.props.submorphs) {
      let submorphs = snapshot.props.submorphs.value;
      for (let i = submorphs.length; i--; ) {
        let {id} = submorphs[i];
        if (pool.refForId(id).realObj.isHand)
          arr.removeAt(submorphs, i);
      }
    }
  }

  get commands() {
    return [
      ...super.commands, {
      name: "resize to fit window",
      exec: async (world) => {
        let resize = () => {
          world.extent = lively.FreezerRuntime ? 
            world.windowBounds().extent() : 
            world.windowBounds().union(world.submorphBounds(m => !m.isEpiMorph && !m.hasFixedPosition)).extent();
        }
        let needsMoreResize = async () => {
          await world.whenRendered();
          delete world._cachedWindowBounds;
          return !world.windowBounds().extent().equals(world.extent);
        }
        let attempts = 0;
        while (attempts < 5 && await needsMoreResize()) {
          attempts++;
          resize();  
        }
        world.relayout();
        return true;
      }
    }];
  }
  
  get isWorld() { return true }

  render(renderer) { return renderer.renderWorld(this); }

  get grabbable() { return false; }
  set grabbable(_) {}

  existingHandForPointerId(pointerId) {
    return this.submorphs.find(m => m instanceof Hand && m.pointerId === pointerId);
  }

  layoutHaloForPointerId(pointerId) { /* only in LivelyWorld */ }

  haloForPointerId(pointerId) { /* only in LivelyWorld */ }

  handForPointerId(pointerId, isPrimary = false) {
    let currentHand = this.existingHandForPointerId(pointerId);
    if (currentHand) return currentHand;
    if (!currentHand && this.firstHand && isPrimary) {
      this.firstHand.pointerId = pointerId;
      return this.firstHand;
    }
    return this.addMorph(new Hand(pointerId), this.submorphs[0]);
  }

  removeHandForPointerId(pointerId) {
    let hand = this.existingHandForPointerId(pointerId);
    if (hand && this.hands.length > 1) hand.remove();
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // user related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  getCurrentUser() {
    let reg = UserRegistry.current;
    return reg.loadUserFromLocalStorage(config.users.authServerURL);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get focusedMorph() {
    var dispatcher = this.env.eventDispatcher,
        focused = dispatcher && dispatcher.eventState.focusedMorph;
    return focused && focused.world() === this ? focused : this;
  }

  onMouseMove(evt) {
    evt.hand && evt.hand.update(evt);
    this._tooltipViewer.mouseMove(evt);
  }

  onMouseDown(evt) {
    if (evt.state.menu) evt.state.menu.remove();
    this.onWindowScroll();
    this._tooltipViewer.mouseDown(evt);
  }

  onMouseUp(evt) {
    if (evt.isCommandKey()/* || evt.isShiftDown()*/) evt.stop();
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

  onBeforeUnload(evt) {
    // called when browser window is closed
    return this.onUnload(evt);
  }

  onUnload(evt) {
    // world is deactivated, either b/c a different world is loaded or the
    // browser window is closed
    // var confirmationMessage = "\o/";
    // e.returnValue = confirmationMessage;     // Gecko, Trident, Chrome 34+
    // return confirmationMessage;              // Gecko, WebKit, Chrome <34
    this.submorphs.forEach(ea => {
      if (typeof ea.onWorldUnload === "function")
        ea.onWorldUnload(evt)
    });
  }

  updateVisibleWindowMorphs() {
    // Currently checks all morphs to see if an update is required.  Could
    // possibly be streamlined by having a discrete list of morphs to be updated
    // instead of traversing tree or moving to a CSS method if necessary.
    this.withAllSubmorphsDo(aMorph => {
      if (!aMorph.respondsToVisibleWindow) return;
      if (typeof aMorph.relayout !== 'function')
        return aMorph.showError(new Error(`${aMorph} listed as responding to visible window`
                                          + ` change, but has no relayout instruction`));
      aMorph.relayout();
    });
  }

  onWindowScroll() {
    // rk 2017-07-02: Experimental, see evts/TextInput.js ensureBeingAtCursorOfText
    let {
      positionChangedTime,
      scrollLeftWhenChanged,
      scrollTopWhenChanged,
    } = this.env.eventDispatcher.keyInputHelper.inputState;
    let docEl = document.documentElement;
    if (Date.now() - positionChangedTime < 500 && !bowser.firefox) {
      docEl.scrollLeft = scrollLeftWhenChanged;
      docEl.scrollTop = scrollTopWhenChanged;
      return;
    }

    this.setProperty("scroll", pt(docEl.scrollLeft, docEl.scrollTop));
    this._cachedWindowBounds = null;
    this.updateVisibleWindowMorphs();
  }

  async onWindowResize(evt) {
    await this.whenRendered();
    this._cachedWindowBounds = null;
    if (this.resizePolicy === 'elastic')
      await this.execCommand("resize to fit window");
    this.updateVisibleWindowMorphs();
    for (let morph of this.submorphs)
      if (typeof morph.onWorldResize === "function")
        morph.onWorldResize(evt);
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
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleBounds() {
    // the bounds call seems to slow down halos...
    if (!this.env.renderer) return this.innerBounds();
    return this.windowBounds().intersection(this.innerBounds());
  }

  fullVisibleBounds() {
    // returns the visible rect of the world with respect to the topbar
    let bar = $world.getSubmorphNamed("lively top bar");
    let bounds = this.visibleBounds();
    let visibleBounds = new Rectangle(bounds.x, bounds.y + bar.height, bounds.width, bounds.height - bar.height);
    return visibleBounds;
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

  logError(msg) { console.log(msg) }

  relayout() { /* subclass responsibility */ }

  defaultMenuItems(morph) {
    return []; /* subclass responsibility */
  }

}

export class Hand extends Morph {

  static get properties() {
    return {
      hasFixedPosition: { defaultValue: true },
      fill: {defaultValue: touchInputDevice ? Color.transparent : Color.orange},
      extent: {defaultValue: pt(1,1)},
      reactsToPointer: {defaultValue: false},
      _grabbedMorphProperties: {
        serialize: false,
        initialize: function() { this._grabbedMorphProperties = new WeakMap(); }
      }
    }
  }
  
  constructor(pointerId) {
    super({pointerId});
  }

  __deserialize__(snapshot, objRef, serializedMap, pool) {
    super.__deserialize__(snapshot, objRef, serializedMap, pool);
    this.reset();
  }

  reset() {
    // stores properties of morphs while those are being carried
    this._grabbedMorphProperties = new WeakMap();
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
    this.position = evt.position.subXY(window.scrollX, window.scrollY);
  }

  async cancelGrab(animate = true, causingEvent) {
    if (!this.grabbedMorphs.length) return;
    this.env.eventDispatcher.cancelGrab(this, causingEvent);
    let anims = []
    for (let m of this.grabbedMorphs) {
      let {prevOwner, prevIndex, prevPosition, pointerAndShadow} =
        this._grabbedMorphProperties.get(m) || {};
      Object.assign(m, pointerAndShadow);
      if (!prevOwner) { m.remove(); continue; }
      prevOwner.addMorphAt(m, prevIndex);
      if (animate) anims.push(m.animate({position: prevPosition}));
      else m.position = prevPosition;
    }
    return anims.length ? Promise.all(anims) : null;
  }

  grab(morph) {
    if (obj.isArray(morph)) return morph.forEach(m => this.grab(m));
    this.withMetaDo({
      metaInteraction: true
    }, () => {
      this._grabbedMorphProperties.set(morph, {
        prevOwner: morph.owner,
        prevPosition: morph.position,
        prevIndex: morph.owner ? morph.owner.submorphs.indexOf(morph) : -1,
        pointerAndShadow: obj.select(morph, ["dropShadow", "reactsToPointer"])
      })
      // So that the morphs doesn't steal events
      morph.reactsToPointer = false;
      morph.dropShadow = true;
      this.addMorph(morph);
    });
    signal(this, "grab", morph);
  }

  dropMorphsOn(dropTarget) {
    this.withMetaDo({
      metaInteraction: true
    }, () => {
      this.grabbedMorphs.forEach(morph => {
        try {
          let {pointerAndShadow} = this._grabbedMorphProperties.get(morph) || {}
          Object.assign(morph, pointerAndShadow);
          signal(this, "drop", morph);
          morph.onBeingDroppedOn(this, dropTarget);
        } catch (err) {
          console.error(err);
          this.world().showError(`Error dropping ${morph} onto ${dropTarget}:\n${err.stack}`);
          if (morph.owner !== dropTarget)
            this.world().addMorph(dropTarget);
        }
      });
    });
  }

  findDropTarget(position = this.globalPosition, grabbedMorphs = this.grabbedMorphs, optFilterFn) {
    let morphs = this.world().morphsContainingPoint(position),
        sortedTargets = arr.sortBy(morphs, m => [m, ...m.ownerChain()].find(m => Path('owner.isWorld').get(m) && m.hasFixedPosition) ? 0 : 1),
        filterFn = typeof optFilterFn === "function"
          ? (m, i) =>
              !this.isAncestorOf(m) &&
              m.acceptsDrops && !grabbedMorphs.includes(m)
              && grabbedMorphs.every(ea => ea.wantsToBeDroppedOn(m)) &&
              optFilterFn(m, i)
          : m => !this.isAncestorOf(m) && m.acceptsDrops &&
            grabbedMorphs.every(ea => ea.wantsToBeDroppedOn(m));
    return sortedTargets.find(filterFn);
  }

}
