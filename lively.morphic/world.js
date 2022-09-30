/* global System,WeakMap */
import bowser from 'bowser';
import { Rectangle, Color, pt } from 'lively.graphics';
import { arr, Path, obj } from 'lively.lang';
import { signal } from 'lively.bindings';
import config from './config.js';
import { MorphicEnv } from './env.js';
import { Morph } from './morph.js';
import { TooltipViewer } from './tooltips.js';

import { loadWorldFromURL, loadWorldFromDB, loadWorldFromCommit, loadWorld } from './world-loading.js';

import { UserRegistry } from 'lively.user';

import { resource } from 'lively.resources/index.js';
import { loadMorphFromSnapshot } from './serialization.js';

export class World extends Morph {
  static get properties () {
    return {

      resizePolicy: {
        doc: "how the world behaves on window size changes 'elastic': resizes to window extent, 'static': leaves its extent unchanged",
        defaultValue: 'elastic',
        after: ['clipMode'],
        type: 'Enum',
        values: ['static', 'elastic'],
        set (val) {
          this.setProperty('resizePolicy', val);
          this.clipMode = val === 'static' ? 'visible' : 'hidden';
          if (val === 'elastic') this.execCommand('resize to fit window');
        }
      },

      colorScheme: {
        derived: true,
        get () {
          // place somewhere were it is called less often???
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
      },

      showsUserFlap: {
        defaultValue: true,
        set (bool) {
          // allow to override from URL
          const { showsUserFlap } = resource(document.location.href).query();
          if (typeof showsUserFlap !== 'undefined') bool = showsUserFlap;
          this.setProperty('showsUserFlap', bool);
          System.import('lively.user/morphic/user-ui.js')
            .then(userUI => userUI.UserUI[bool ? 'showUserFlap' : 'hideUserFlap'](this));
        }
      }
    };
  }

  static defaultWorld () { return MorphicEnv.default().world; }

  static loadWorldFromURL (url, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorldFromURL(url, oldWorld, options);
  }

  static loadWorld (newWorld, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorld(newWorld, oldWorld, options);
  }

  static loadFromCommit (commitOrId, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorldFromCommit(commitOrId, oldWorld, options);
  }

  static loadFromDB (name, ref, oldWorld = this.defaultWorld(), options = {}) {
    return loadWorldFromDB(name, ref, oldWorld, options);
  }

  static async loadFromResource (res, oldWorld = this.defaultWorld(), options = {}) {
    return await loadWorld(await loadMorphFromSnapshot(await res.readJson()), oldWorld, options);
  }

  constructor (props) {
    super(props);
    this._renderer = null; // assigned in rendering/renderer.js
    this._tooltipViewer = new TooltipViewer(this);
  }

  __deserialize__ (snapshot, objRef, serializedMap, pool) {
    super.__deserialize__(snapshot, objRef, serializedMap, pool);
    this._renderer = null;
    this._tooltipViewer = new TooltipViewer(this);
  }

  __additionally_serialize__ (snapshot, objRef, pool, addFn) {
    super.__additionally_serialize__(snapshot, objRef, pool, addFn);
    // remove epi morphs
    if (snapshot.props.submorphs) {
      const submorphs = snapshot.props.submorphs.value;
      for (let i = submorphs.length; i--;) {
        const { id } = submorphs[i];
        if (pool.refForId(id).realObj.isHand) { arr.removeAt(submorphs, i); }
      }
    }
  }

  get commands () {
    return [
      ...super.commands, {
        name: 'resize to fit window',
        exec: async (world) => {
          const adhereToWindow = !!lively.FreezerRuntime || world.submorphs.filter(m => !m.isEpiMorph && !m.isHand).length < 1;
          world.extent = adhereToWindow
            ? world.windowBounds().extent()
            : world.windowBounds().union(world.submorphBounds(m => !m.isEpiMorph && !m.isHand)).extent();
          world.relayout();
          return true;
        }
      }];
  }

  get isWorld () { return true; }

  async whenReady () {
    return true;
  }

  render (renderer) { return renderer.renderWorld(this); }

  get grabbable () { return false; }
  set grabbable (_) {}

  existingHandForPointerId (pointerId) {
    return this.submorphs.find(m => m.isHand && m.pointerId === pointerId);
  }

  layoutHaloForPointerId (pointerId) { /* only in LivelyWorld */ }

  haloForPointerId (pointerId) { /* only in LivelyWorld */ }

  handForPointerId (pointerId, isPrimary = false) {
    const currentHand = this.existingHandForPointerId(pointerId);
    if (currentHand) return currentHand;
    if (!currentHand && this.firstHand && isPrimary) {
      this.firstHand.pointerId = pointerId;
      return this.firstHand;
    }
    return this.addMorph(new Hand(pointerId), this.submorphs[0]); // eslint-disable-line no-use-before-define
  }

  removeHandForPointerId (pointerId) {
    const hand = this.existingHandForPointerId(pointerId);
    if (hand && this.hands.length > 1) hand.remove();
  }

  world () { return this; }

  makeDirty () {
    if (this._dirty) return;
    this._dirty = true;
    const r = this.env.renderer;
    r && r.renderLater();
  }

  get hands () {
    return arr.sortBy(this.submorphs.filter(ea => ea.isHand), ea => ea.pointerId);
  }

  get firstHand () { return this.hands[0]; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // user related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  getCurrentUser () {
    const reg = UserRegistry && UserRegistry.current;
    return reg && reg.loadUserFromLocalStorage(window.AUTH_SERVER_URL || config.users.authServerURL);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get focusedMorph () {
    const dispatcher = this.env.eventDispatcher;
    const focused = dispatcher && dispatcher.eventState.focusedMorph;
    return focused && focused.world() === this ? focused : this;
  }

  onMouseMove (evt) {
    evt.hand && evt.hand.update(evt);
    this._tooltipViewer.mouseMove(evt);
  }

  onHoverOut (evt) {
    super.onHoverOut(evt);
    if (evt.state.draggedMorph) {
      const state = evt.state;
      state.dragDelta = (state.draggedMorph.owner || this)
        .getInverseTransform()
        .transformDirection(
          evt.position.subPt(
            state.lastDragPosition));
      state.absDragDelta = evt.position.subPt(state.clickedOnPosition);
      evt.onAfterDispatch(() => state.lastDragPosition = evt.position);
      evt.state.draggedMorph.onDrag(evt);
    }
  }

  onMouseDown (evt) {
    if (evt.state.menu) evt.state.menu.remove();
    this.onWindowScroll();
    this._tooltipViewer.mouseDown(evt);
  }

  onMouseWheel (evt) {
    // When holding shift pressed you can scroll around in the world without
    // scrolling an individual clipped morph that might be below the mouse cursor
    if (evt.isShiftDown()) {
      window.scrollBy(-evt.domEvt.wheelDeltaX, -evt.domEvt.wheelDeltaY);
      evt.stop();
    }
  }

  onBeforeUnload (evt) {
    // called when browser window is closed
    return this.onUnload(evt);
  }

  onUnload (evt) {
    // world is deactivated, either b/c a different world is loaded or the
    // browser window is closed
    // var confirmationMessage = "\o/";
    // e.returnValue = confirmationMessage;     // Gecko, Trident, Chrome 34+
    // return confirmationMessage;              // Gecko, WebKit, Chrome <34
    this.submorphs.forEach(ea => {
      if (typeof ea.onWorldUnload === 'function') { ea.onWorldUnload(evt); }
    });
  }

  updateVisibleWindowMorphs () {
    // Currently checks all morphs to see if an update is required.  Could
    // possibly be streamlined by having a discrete list of morphs to be updated
    // instead of traversing tree or moving to a CSS method if necessary.
    this.withAllSubmorphsDo(aMorph => {
      if (!aMorph.respondsToVisibleWindow) return;
      if (typeof aMorph.relayout !== 'function') {
        return aMorph.showError(new Error(`${aMorph} listed as responding to visible window` +
                                          ' change, but has no relayout instruction'));
      }
      aMorph.relayout();
    });
  }

  onWindowScroll () {
    // rk 2017-07-02: Experimental, see evts/TextInput.js ensureBeingAtCursorOfText
    const {
      positionChangedTime,
      scrollLeftWhenChanged,
      scrollTopWhenChanged
    } = this.env.eventDispatcher.keyInputHelper.inputState;
    const docEl = document.documentElement;
    if (Date.now() - positionChangedTime < 500 && !bowser.firefox) {
      docEl.scrollLeft = scrollLeftWhenChanged;
      docEl.scrollTop = scrollTopWhenChanged;
      return;
    }

    this.setProperty('scroll', pt(docEl.scrollLeft, docEl.scrollTop));
    this._cachedWindowBounds = null;
    this.updateVisibleWindowMorphs();
  }

  async onWindowResize (evt) {
    this._cachedWindowBounds = null;
    if (this.resizePolicy === 'elastic') { await this.execCommand('resize to fit window'); }
    this.updateVisibleWindowMorphs();
    for (const morph of this.submorphs) {
      if (typeof morph.onWorldResize === 'function') { morph.onWorldResize(evt); }
    }
  }

  relayCommandExecutionToFocusedMorph (evt) {
    // can be called from exec method of commands with 4. argument (evt)
    // Will try to invoke mapped a command triggered by evt in the focused
    // morph or one of its owners. This provides optional "bubble" semantics
    // for command invocation
    if (!evt) return null;
    const focused = this.focusedMorph;
    const { command, morph } = arr.findAndGet(
      arr.without([focused, ...focused.ownerChain()], this),
      morph => arr.findAndGet(morph.keyhandlers, kh => {
        const command = kh.eventCommandLookup(morph, evt);
        return command ? { command, morph } : null;
      })) || {};
    return command ? morph.execCommand(command) : null;
  }
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleBounds () {
    // the bounds call seems to slow down halos...
    let visibleBounds;
    if (!this.env.renderer) visibleBounds = this.innerBounds();
    else visibleBounds = this.windowBounds().intersection(this.innerBounds());
    // if not the whole world is visible, we have to adjust for scrollbars on Win and Linux (on Mac they are transparent)
    if (bowser.mac) return visibleBounds;
    // it does not matter in which direction the space is too small, since we always get both scroll bars
    if (visibleBounds.height < this.extent.y || visibleBounds.width < this.extent.x) visibleBounds.width = visibleBounds.width - this.scrollbarOffset.x;

    return visibleBounds;
  }

  visibleBoundsExcludingTopBar () {
    return this.visibleBounds();
  }

  windowBounds (optWorldDOMNode) {
    if (this._cachedWindowBounds) return this._cachedWindowBounds;
    const { window } = this.env.domEnv;
    const scale = 1 / this.scale;
    const x = window.scrollX * scale;
    const y = window.scrollY * scale;
    const width = (window.innerWidth || this.width) * scale;
    const height = (window.innerHeight || this.height) * scale;
    return this._cachedWindowBounds = new Rectangle(x, y, width, height);
  }

  logError (msg) { console.log(msg); }

  relayout () { /* subclass responsibility */ }

  defaultMenuItems (morph) {
    return []; /* subclass responsibility */
  }

  // file download serving

  serveFileAsDownload (fileString, { fileName = 'file.txt', type = 'text/plain' } = {}) {
    const isDataURL = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;
    const isBlob = fileString instanceof Blob;
    const a = window.document.createElement('a');
    a.href = obj.isString(fileString) && !!fileString.match(isDataURL) ? fileString : window.URL.createObjectURL(isBlob ? fileString : new Blob([fileString], { type }));
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export class Hand extends Morph {
  static get properties () {
    return {
      hasFixedPosition: { defaultValue: true },
      fill: { defaultValue: lively.FreezerRuntime ? Color.transparent : Color.orange },
      extent: { defaultValue: pt(1, 1) },
      reactsToPointer: { defaultValue: false },
      pointerId: {},
      isHand: { readOnly: true, get () { return true; } },
      draggable: {
        readOnly: true,
        get () { return false; }
      },
      grabbable: {
        readOnly: true,
        get () { return false; }
      },
      grabbedMorphs: {
        readOnly: true,
        get () { return this.submorphs; }
      },
      _grabbedMorphProperties: {
        serialize: false,
        initialize: function () { this._grabbedMorphProperties = new WeakMap(); }
      }
    };
  }

  constructor (pointerId) {
    super({ pointerId });
  }

  __deserialize__ (snapshot, objRef, serializedMap, pool) {
    super.__deserialize__(snapshot, objRef, serializedMap, pool);
    this.reset();
  }

  reset () {
    // stores properties of morphs while those are being carried
    this._grabbedMorphProperties = new WeakMap();
  }

  carriesMorphs () { return !!this.grabbedMorphs.length; }

  morphsContainingPoint (point, list) { return list; }

  update (evt) {
    let visibleBox = this.world().visibleBounds();
    visibleBox = pt(0).extent(visibleBox.extent()).insetBy(15);
    this.position = visibleBox.constrainPt(evt.position.subXY(window.scrollX, window.scrollY));
  }

  async cancelGrab (animate = true, causingEvent) {
    if (!this.grabbedMorphs.length) return;
    this.env.eventDispatcher.cancelGrab(this, causingEvent);
    const anims = [];
    for (const m of this.grabbedMorphs) {
      const { prevOwner, prevIndex, prevPosition, pointerAndShadow } =
        this._grabbedMorphProperties.get(m) || {};
      Object.assign(m, pointerAndShadow);
      if (!prevOwner) { m.remove(); continue; }
      prevOwner.addMorphAt(m, prevIndex);
      if (animate) anims.push(m.animate({ position: prevPosition }));
      else m.position = prevPosition;
    }
    return anims.length ? Promise.all(anims) : null;
  }

  grab (morph) {
    if (obj.isArray(morph)) return morph.forEach(m => this.grab(m));
    this.withMetaDo({
      metaInteraction: true
    }, () => {
      this._grabbedMorphProperties.set(morph, {
        prevOwner: morph.owner,
        prevPosition: morph.position,
        prevIndex: morph.owner ? morph.owner.submorphs.indexOf(morph) : -1,
        pointerAndShadow: obj.select(morph, ['dropShadow', 'reactsToPointer'])
      });
      // So that the morphs doesn't steal events
      morph.reactsToPointer = false;
      morph.dropShadow = true;
      this.addMorph(morph);
      this.bringToFront();
    });
    signal(this, 'grab', morph);
  }

  dropMorphsOn (dropTarget) {
    this.withMetaDo({
      metaInteraction: true
    }, () => {
      this.grabbedMorphs.forEach(morph => {
        try {
          const { pointerAndShadow } = this._grabbedMorphProperties.get(morph) || {};
          Object.assign(morph, pointerAndShadow);
          signal(this, 'drop', morph);
          morph.onBeingDroppedOn(this, dropTarget);
        } catch (err) {
          console.error(err);
          this.world().showError(`Error dropping ${morph} onto ${dropTarget}:\n${err.stack}`);
          if (morph.owner !== dropTarget) { this.world().addMorph(dropTarget); }
        }
      });
    });
  }

  findDropTarget (position = this.globalPosition, grabbedMorphs = this.grabbedMorphs, optFilterFn) {
    const morphs = this.world().morphsContainingPoint(position);
    const sortedTargets = arr.sortBy(morphs, m => [m, ...m.ownerChain()].find(m => Path('owner.isWorld').get(m) && m.hasFixedPosition) ? 0 : 1);
    const filterFn = typeof optFilterFn === 'function'
      ? (m, i) =>
          !this.isAncestorOf(m) &&
              m.acceptsDrops && !grabbedMorphs.includes(m) &&
              grabbedMorphs.every(ea => ea.wantsToBeDroppedOn(m)) &&
              optFilterFn(m, i)
      : m => !this.isAncestorOf(m) && m.acceptsDrops &&
            m.ownerChain().every(m => m.visible) &&
            grabbedMorphs.every(ea => ea.wantsToBeDroppedOn(m));
    return sortedTargets.find(filterFn);
  }
}
