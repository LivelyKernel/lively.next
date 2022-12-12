/* global System */
import { arr, fun, Path, promise } from 'lively.lang';
import { pt } from 'lively.graphics';
import config from '../config.js';
import TextInput from './TextInput.js';
import KillRing from './KillRing.js';
import { Event, KeyEvent, SimulatedDOMEvent, keyLikeEvents } from './Event.js';
import { cumulativeOffset } from '../rendering/dom-helper.js';
import bowser from 'bowser';
import { touchInputDevice } from '../helpers.js';

// note: keydown, keyup, cut, copy, paste, compositionstart, compositionend,
// compositionupdate, input are listened to by the text input helper
const domEventsWeListenTo = [
  { type: 'pointerdown', capturing: false },
  { type: 'pointerup', capturing: false },
  { type: 'pointermove', capturing: false, passive: false },
  { type: 'pointerover', capturing: false, passive: false },
  { type: 'pointerout', capturing: false, passive: false },
  { type: 'contextmenu', capturing: false },
  { type: 'wheel', capturing: false, passive: false },
  { type: 'scroll', capturing: true, passive: false },

  { type: 'drag', capturing: false },
  { type: 'dragstart', capturing: false },
  { type: 'dragend', capturing: false },
  { type: 'dragover', capturing: false },
  { type: 'dragenter', capturing: false },
  { type: 'dragleave', capturing: false },
  { type: 'drop', capturing: false }
];

const eventsCausingImmediateRender = new Set([
  'pointerdown', 'pointerup', 'keydown', 'keyup', 'input'
]);

const globalDomEventsWeListenTo = [
  { type: 'resize', capturing: false, morphMethod: 'onWindowResize' },
  { type: 'orientationchange', capturing: false, morphMethod: 'onWindowResize' },
  { type: 'scroll', capturing: false, passive: false, morphMethod: 'onWindowScroll' },
  { type: 'beforeunload', capturing: false, passive: false, morphMethod: 'onBeforeUnload' }
];

const typeToMethodMap = {
  pointerdown: 'onMouseDown',
  pointerup: 'onMouseUp',
  pointermove: 'onMouseMove',
  longclick: 'onLongClick',
  hoverin: 'onHoverIn',
  hoverout: 'onHoverOut',
  morphicdrag: 'onDrag',
  morphicdragstart: 'onDragStart',
  morphicdragend: 'onDragEnd',
  grab: 'onGrab',
  morphicdrop: 'onDrop',
  morphicdrophoverin: 'onDropHoverIn',
  morphicdrophoverout: 'onDropHoverOut',
  morphicdrophoverupdate: 'onDropHoverUpdate',
  keydown: 'onKeyDown',
  keyup: 'onKeyUp',
  input: 'onTextInput',
  compositionstart: 'onCompositionStart',
  compositionupdate: 'onCompositionUpdate',
  compositionend: 'onCompositionEnd',
  blur: 'onBlur',
  focus: 'onFocus',
  contextmenu: 'onContextMenu',
  cut: 'onCut',
  copy: 'onCopy',
  paste: 'onPaste',
  scroll: 'onScroll',
  wheel: 'onMouseWheel',

  drag: 'onNativeDrag',
  dragstart: 'onNativeDragstart',
  dragend: 'onNativeDragend',
  dragover: 'onNativeDragover',
  dragenter: 'onNativeDragenter',
  dragleave: 'onNativeDragleave',
  drop: 'onNativeDrop'
};

const focusTargetingEvents = [
  'keydown', 'keyup', 'keypress',
  'input', 'compositionstart', 'compositionupdate', 'compositionend',
  'cut', 'copy', 'paste'
];

const textOnlyEvents = [
  'input', 'compositionstart', 'compositionupdate', 'compositionend'
];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers

function dragStartEvent (domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo) {
  var evt = new Event('morphicdragstart', domEvt, dispatcher, [targetMorph], hand, halo, layoutHalo)
    .onDispatch(() => {
      state.draggedMorph = targetMorph;
      state.dragStartMorphPosition = targetMorph.position;
      state.dragStartPosition = evt.position;
      state.lastDragPosition = evt.position;
      state.dragDelta = pt(0, 0);
      state.absDragDelta = pt(0, 0);
    })
    .onStop(() => {
      state.draggedMorph = null;
      dispatcher.schedule(dragEndEvent(domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo));
    });
  return evt;
}

function dragEvent (domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo) {
  var evt = new Event('morphicdrag', domEvt, dispatcher, [state.draggedMorph], hand, halo, layoutHalo)
    .onDispatch(() => {
      state.dragDelta = (state.draggedMorph.owner || dispatcher.world)
        .getInverseTransform()
        .transformDirection(
          evt.position.subPt(
            state.lastDragPosition));
      state.absDragDelta = evt.position.subPt(state.clickedOnPosition);
    })
    .onAfterDispatch(() => state.lastDragPosition = evt.position)
    .onStop(() => {
      state.draggedMorph = null;
      dispatcher.schedule(dragEndEvent(domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo));
    });
  return evt;
}

function dragEndEvent (domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo) {
  const ctx = state.draggedMorph || targetMorph;
  var evt = new Event('morphicdragend', domEvt, dispatcher, [ctx], hand, halo, layoutHalo)
    .onDispatch(() => {
      state.dragDelta = (ctx.owner || dispatcher.world)
        .getInverseTransform()
        .transformDirection(
          evt.position.subPt(
            state.lastDragPosition));
      state.absDragDelta = evt.position.subPt(state.clickedOnPosition);
    })
    .onAfterDispatch(() => {
      state.draggedMorph = null;
      state.lastDragPosition = null;
      state.dragDelta = pt(0, 0);
      state.absDragDelta = pt(0, 0);
      state.dragStartMorphPosition = null;
      state.dragStartPosition = null;
    });
  return evt;
}

function focusEvents (dispatcher, targetMorph) {
  const state = dispatcher.eventState;

  if (state.focusedMorph === targetMorph) return [];

  const domEvt = null; const hand = null; const halo = null; const layoutHalo = null; const events = [];

  state.focusedMorph && events.push(
    new Event('blur', domEvt, this, [state.focusedMorph], hand, halo, layoutHalo)
      .onDispatch(() => state.focusedMorph = null));

  events.push(
    new Event('focus', domEvt, this, [targetMorph], hand, halo, layoutHalo)
      .onDispatch(() => state.focusedMorph = targetMorph));

  return events;
}

/*

The event dispatcher controls what events get send to morphs and what the basic
control flow (which events get send when) is.

There is only one outer event handler per event type on the DOM level. DOM
events we currently listen to are listed in `domEventsWeListenTo`.

The event dispatch for most events works by identifying the event target (DOM
node -> morph). We then use the morphic owner chain of that morph to establish
all event targets. I.e. the target morph itself, its owner, … until we reach
the world. Those morphs will receive the event, the dispatch happens in
“capturing” order, i.e. outside in, the world comes first, then its submorph,
etc. At each step we call the morphic event handler method. This method can has
the ability to `stop()` an event, i.e. that morphs further down the dispatch
chain (including the actual target) won’t receive the event.

There are some events that aren’t “capturing”, i.e. that are not being sent to
the entire owner chain of the target morph. Currently these are dragstart,
dragend, drag, focus, blur, grab, hoverin, hoverout.

*/

export default class EventDispatcher {
  constructor (domEventEmitter, world) {
    this.activations = 0;
    this.emitter = domEventEmitter;
    this.keyInputHelper = null;
    this.world = world;
    this.installed = false;
    this.handlerFunctions = [];
    this.killRing = new KillRing(config.text.clipboardBufferLength);
    this.nodeMorphMap = new WeakMap();
    this.timestampBase = Path('performance.timing.navigationStart').get(domEventEmitter) || 0;

    this.resetState();
  }

  resetState () {
    // A place where info about previous events can be stored, e.g. for tracking
    // what was clicked on
    this.eventState = {
      timeOfLastActivity: 0,
      focusedMorph: null,
      clickedOnPosition: null,
      clickedOnMorph: null,
      clickCount: 0,
      prevClick: {},
      draggedMorph: null,
      dragDelta: null,
      absDragDelta: null,
      lastDragPosition: null,
      dragStartMorphPosition: null,
      dragStartPosition: null,
      hover: { hoveredOverMorphs: [], unresolvedPointerOut: false },
      scroll: { interactiveScrollInProgress: null },
      keyInputState: null,
      pressedKeys: {},
      html5Drag: {},
      dropHoverTarget: null
    };
    this.resetKeyInputState();
  }

  resetKeyInputState () {
    this.eventState.keyInputState = {
      keyChain: '',
      count: undefined
    };
  }

  focusMorph (morph) {
    this.keyInputHelper && this.keyInputHelper.focus(morph, this.world);
    focusEvents(this, morph).forEach(evt => this.dispatchEvent(evt));
  }

  isMorphFocused (morph) {
    return this.eventState.focusedMorph === morph;
  }

  isMorphHovered (morph) {
    return this.eventState.hover.hoveredOverMorphs.includes(morph);
  }

  isMorphClicked (morph) {
    return this.eventState.clickedMorph == morph;
  }

  isKeyPressed (keyName) {
    return Object.keys(this.eventState.pressedKeys).map(ea => ea.toLowerCase())
      .includes(keyName.toLowerCase());
  }

  whenIdle () {
    return promise.waitFor(() => this.activations === 0);
  }

  install (rootNode) {
    if (this.installed) return this;
    this.installed = true;
    const { emitter } = this;
    const globalEmitter = System.global/* FIXME? */;

    domEventsWeListenTo.forEach(({ type, capturing, passive }) => {
      const fn = evt => this.dispatchDOMEvent(evt);
      this.handlerFunctions.push({ node: emitter, type, fn, capturing });
      const arg = { capture: capturing, passive };
      emitter.addEventListener(type, fn, arg);
    });

    globalEmitter.addEventListener && globalDomEventsWeListenTo.forEach(({ type, capturing, morphMethod, passive }) => {
      const fn = evt => this.dispatchDOMEvent(evt, this.world, morphMethod);
      this.handlerFunctions.push({ node: globalEmitter, type, fn, capturing });
      const arg = { capture: capturing, passive };
      globalEmitter.addEventListener(type, fn, arg);
    });

    this.keyInputHelper = new TextInput(this).install(rootNode, this.world);

    // rms 6.9.18: In order for us to handle touch events ourselves,
    //             we need to pass this undocumented touch-action attribute as "none"
    //             to the body of the document, since iOS does not support the
    //             CSS property touch-action.
    // if (bowser.firefox) rootNode.setAttribute("touch-action", "none");
    // rms 3.9.19: Setting touch-action to none seems to break the scroll on iOS9 and possibly others.
    //             setting it to auto seems to fix things for now.
    if (bowser.ios) rootNode.setAttribute('touch-action', 'auto');

    return this;
  }

  uninstallHandler (handler) {
    const handlerToBeRemoved = this.handlerFuntions.find(({ type }) => type == handler);
    if (handlerToBeRemoved) { handlerToBeRemoved.node.removeEventListener(handlerToBeRemoved.node, handlerToBeRemoved.fn, handlerToBeRemoved.capturing); }
  }

  uninstall () {
    this.installed = false;

    const handlerFunctions = this.handlerFunctions;
    handlerFunctions.forEach(({ node, type, fn, capturing }) => {
      const arg = capturing;
      node.removeEventListener(type, fn, arg);
    });
    handlerFunctions.length = 0;

    this.keyInputHelper && this.keyInputHelper.uninstall();
    this.keyInputHelper = null;

    return this;
  }

  processDOMEvent (domEvt, targetMorph) {
    // In morphic we don't map events 1:1 from the DOM to the events morph get
    // triggered with. E.g. we have our own drag behvior. This is the place where
    // dom events get mapped to those morph events, zero to many.
    // Also for some kinds of event we need to accumulate
    // For touch events we do not want a halo per finger

    const type = domEvt.type;
    const state = this.eventState;
    const eventTargets = [targetMorph].concat(targetMorph.ownerChain());
    const touch = domEvt.pointerType === 'touch';
    const pointerId = domEvt.pointerId;
    const targetNode = domEvt.composedPath()[0];
    const considerPointerId = typeof pointerId === 'number' && (touchInputDevice || domEvt.isPrimary);
    const hand = considerPointerId ? this.world.handForPointerId(pointerId, domEvt.isPrimary) : this.world.firstHand;
    const halo = considerPointerId && !touch ? this.world.haloForPointerId(pointerId) : null;
    const layoutHalo = considerPointerId && !touch ? this.world.layoutHaloForPointerId(pointerId) : null;
    const klass = keyLikeEvents.includes(type) ? KeyEvent : Event;
    const defaultEvent = new klass(type, domEvt, this, eventTargets, hand, halo, layoutHalo);
    let events = [defaultEvent];
    const later = [];

    switch (type) {
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // tracking pressed keys
      case 'keydown':
        state.pressedKeys[defaultEvent.key] = true;
        break;

      case 'keyup':
        if (defaultEvent.key === 'Meta') state.pressedKeys = {};
        else delete state.pressedKeys[defaultEvent.key];
        break;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case 'click':
        // Note, we currently don't subscribe to click DOM events, this is just a
        // convenience for event simulation
        var { events: downEvents } = this.processDOMEvent(new SimulatedDOMEvent({ ...domEvt, type: 'pointerdown' }), targetMorph);
        var { events: upEvents } = this.processDOMEvent(new SimulatedDOMEvent({ ...domEvt, type: 'pointerup' }), targetMorph);
        events = downEvents.concat(upEvents);
        break;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case 'pointerdown':
        // so that we receive pointerups even if the cursor leaves the browser
        if (typeof targetNode.setPointerCapture === 'function') {
          try {
            // rk 2016-07-18: This currently doesn't work well with running a new
            // morphic world inside an old Lively...
            // domEvt.target.setPointerCapture(domEvt.pointerId);
          } catch (e) {}
        }

        // we manually manage focus on clicks
        defaultEvent.onDispatch(() => {
          this.focusMorph(targetMorph);
          // We remember the morph that we clicked on until we get an up event.
          // This allows us to act on this info later

          state.clickedOnMorph = targetMorph;
          state.clickedOnPosition = defaultEvent.position;
          state.downTimeStamp = domEvt.timeStamp;

          let repeatedClick = false; let prevClickCount = 0;
          if (state.prevClick) {
            const {
              clickedOnMorph, clickedOnPosition,
              clickedAtTime, clickCount
            } = state.prevClick;
            const clickInterval = Date.now() - clickedAtTime;
            repeatedClick = clickedOnMorph === targetMorph &&
                         clickInterval < config.repeatClickInterval;
            prevClickCount = clickCount;
          }
          state.clickCount = repeatedClick ? prevClickCount + 1 : 1;

          // setTimeout(() => {
          //   if (targetMorph.grabbable && !state.draggedMorph
          //       && state.clickedOnMorph === targetMorph
          //       && !hand.carriesMorphs()) hand.grab(targetMorph);
          // }, 800);
        });
        break;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case 'pointerup':
        defaultEvent.onAfterDispatch(() => {
          const { clickedOnMorph, clickedOnPosition, clickCount } = state;
          const clickedAtTime = Date.now();
          state.prevClick = { clickedOnMorph, clickedOnPosition, clickedAtTime, clickCount };
          state.clickedOnMorph = null;
          state.clickCount = 0;

          // long click
          const clickDuration = domEvt.timeStamp - state.downTimeStamp;
          const dist = state.clickedOnPosition.dist(defaultEvent.position);
          const { maxDist, minDur, maxDur } = config.longClick;
          if (dist < maxDist && clickDuration >= minDur && clickDuration <= maxDur) {
            const evt = new Event('longclick', domEvt, this, eventTargets, hand, halo, layoutHalo);
            this.schedule(evt);
          }
        });

        // drag release
        if (state.draggedMorph) {
          events.push(dragEndEvent(domEvt, this, targetMorph, state, hand, halo, layoutHalo));
          defaultEvent.targetMorphs = arr.uniq([state.draggedMorph, ...defaultEvent.targetMorphs, this.world]);
        }

        // grab release
        if (hand.carriesMorphs()) {
          // make sure that the morph receiving the grabbed morphs is not a
          // grabbed morph itself, i.e. the drop target must not be a child morph
          // of the hand
          if (state.dropHoverTarget) {
            events.push(new Event('morphicdrophoverout', domEvt, this, [state.dropHoverTarget], hand, halo, layoutHalo));
            targetMorph = state.dropHoverTarget;
            state.dropHoverTarget = null;
          } else {
            targetMorph = hand.findDropTarget(defaultEvent.position, hand.grabbedMorphs);
          }
          if (hand.isAncestorOf(targetMorph)) { targetMorph = this.world; }
          events.push(new Event('morphicdrop', domEvt, this, [targetMorph], hand, halo, layoutHalo));
          defaultEvent.targetMorphs = [this.world];
        }

        break;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case 'pointermove':
        // Are we dragging a morph? If so the move gets only send to the world
        // and the drag only send to the dragged morph

        if (hand.carriesMorphs()) {
          defaultEvent.targetMorphs = [this.world];
          const dropTargetMorph = hand.findDropTarget(defaultEvent.position, hand.grabbedMorphs) ||
                             this.world;

          if (state.dropHoverTarget === dropTargetMorph) {
            events.push(new Event('morphicdrophoverupdate', domEvt, this, [dropTargetMorph], hand, halo, layoutHalo));
          } else {
            if (state.dropHoverTarget) { events.push(new Event('morphicdrophoverout', domEvt, this, [state.dropHoverTarget], hand, halo, layoutHalo)); }
            state.dropHoverTarget = dropTargetMorph;
            events.push(new Event('morphicdrophoverin', domEvt, this, [dropTargetMorph], hand, halo, layoutHalo));
          }
        } else if (state.draggedMorph) {
          defaultEvent.targetMorphs = [this.world];
          events.push(dragEvent(domEvt, this, targetMorph, state, hand, halo, layoutHalo));

        // Start dragging when we are holding the hand pressed and and move it
        // beyond targetMorph.dragTriggerDistance
        } else if (state.clickedOnMorph && state.clickedOnPosition &&
                state.clickedOnMorph.draggable &&
                !state.draggedMorph &&
                !hand.carriesMorphs()) {
          const dist = state.clickedOnPosition.dist(defaultEvent.position);
          const dragTarget = state.clickedOnMorph;
          if (dist > dragTarget.dragTriggerDistance) {
            // FIXME should grab really be triggered through drag?
            if (dragTarget.grabbable) {
              events.push(new Event('grab', domEvt, this, [dragTarget], hand, halo, layoutHalo));
            } else if (dragTarget.draggable) {
              events.push(dragStartEvent(domEvt, this, dragTarget, state, hand, halo, layoutHalo));
            }

            defaultEvent.targetMorphs = [this.world];
          }
        }
        break;

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
        // The DOM doesn't directly support "hover" events, instead pointerover
        // and pointerout events are sent to DOM nodes when a pointer enters or
        // leaves the direct boundaries of that node. These events cannot be
        // directly mapped to hover in /out because:
        // a) a pointerout event is sent when the pointer enters a child node. In
        // this case we do not want to signal hoverout of the parent node!
        // b) if a child node "sticks out" a parent node and the pointer is moved
        // out the child nodes bounds without entering the parents node bounds
        // again, a pointerout event is only sent to the child node. In this case,
        // however, we want to generate hoverOut events for both the child and the
        // parent node.

      case 'pointerover':
        if (state.hover.unresolvedPointerOut) { state.hover.unresolvedPointerOut = false; }

        var hoveredOverMorphs = [targetMorph].concat(targetMorph.ownerChain()).reverse();
        var hoverOutEvents = arr.withoutAll(state.hover.hoveredOverMorphs, hoveredOverMorphs)
          .map(m => new Event('hoverout', domEvt, this, [m], hand, halo, layoutHalo)
            .onDispatch(() => arr.remove(state.hover.hoveredOverMorphs, m)));
        var hoverInEvents = arr.withoutAll(hoveredOverMorphs, state.hover.hoveredOverMorphs)
          .map(m => new Event('hoverin', domEvt, this, [m], hand, halo, layoutHalo)
            .onDispatch(() => arr.pushIfNotIncluded(state.hover.hoveredOverMorphs, m)));
        events = hoverOutEvents.concat(hoverInEvents);
        break;

      case 'pointerout':
        events = [];
        state.hover.unresolvedPointerOut = true;
        later.push(() => {
          // outTargetMorph usually gets reset by a asynchronously following
          // pointerover event *except* when we the pointer leaves the entire
          // window. In this case we hover out of all morphs that are currently
          // marked as hovered in
          if (state.hover.unresolvedPointerOut) {
            return Promise.all(state.hover.hoveredOverMorphs.map(m =>
              this.schedule(new Event('hoverout', domEvt, this, [m], hand, halo, layoutHalo)
                .onAfterDispatch(() => arr.remove(state.hover.hoveredOverMorphs, m)))));
          }
        });
        // remove hand created for this finger
        if (touch) {
          this.world.removeHandForPointerId(pointerId);
        }
        break;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // Note: these events can be used manually. If you just want to focus
      // a morph use morph.focus()
      case 'blur':
        events = [new Event(type, domEvt, this, [targetMorph], hand, halo, layoutHalo)
          .onDispatch(() => state.focusedMorph = null)];
        break;
      case 'focus':
        events = focusEvents(this, targetMorph);
        break;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case 'scroll':
        events = [new Event(type, domEvt, this, [targetMorph], hand, halo, layoutHalo)
          .onDispatch(() => {
            // Here we install a debouncer for letting the renderer know when it is
            // safe to update the DOM for scroll values without interrupting
            // the browser internal scroll.
            // See https://github.com/LivelyKernel/lively.morphic/issues/88 for more info
            const scrollInProgress = !!state.scroll.interactiveScrollInProgress;
            if (!scrollInProgress) {
              const { promise: p, resolve } = promise.deferred();
              let delay = bowser.name == 'Firefox' ? 500 : 250;
              if (bowser.name == 'Safari') delay = 1000; // safari recently became more sensitive to this
              state.scroll.interactiveScrollInProgress = p;
              p.debounce = fun.debounce(delay, () => {
                state.scroll.interactiveScrollInProgress = null;
                resolve();
              });
            }
            state.scroll.interactiveScrollInProgress.debounce();

            const target = targetNode.documentElement || targetNode;
            const { scrollLeft: newX, scrollTop: newY, style } = target;
            const { x, y } = targetMorph.scroll;
            if (style.overflow != 'hidden' && x !== newX || y !== newY) targetMorph.scroll = pt(newX, newY);
          })];
        break;

      case 'input': case 'compositionstart': case 'compositionupdate': case 'compositionend':
        // text only
        if (!targetMorph.isText) events = [];
        else defaultEvent.targetMorphs = [targetMorph];
        break;

      case 'drag':
      case 'dragstart':
      case 'dragend':
      case 'dragover':
      case 'dragenter':
      case 'dragleave':
      case 'drop':
        if (type === 'drop' || type === 'dragover') {
          // prevent default to allow drop and to prevent action (open as link
          // for some elements)
          domEvt.preventDefault();
        }
        break;
    }

    return { events, later };
  }

  schedule (evt) {
    this.activations++;
    return Promise.resolve()
      .then(() => this.dispatchEvent(evt))
      .then(() => this.activations--, err => { this.activations--; throw err; });
  }

  dispatchEvent (evt, method) {
    method = method || typeToMethodMap[evt.type];

    if (!method) { throw new Error(`dispatchEvent: ${evt.type} not yet supported!`); }

    evt.onDispatchCallbacks.forEach(ea => ea());
    this.activations++;

    let err;
    for (let j = evt.targetMorphs.length - 1; j >= 0; j--) {
      try {
        evt.targetMorphs[j][method](evt);
      } catch (e) {
        err = new Error(`Error in event handler ${evt.targetMorphs[j]}.${method}: ${e.stack || e}`);
        err.originalError = e;
        typeof this.world !== 'undefined' ? this.world.logError(err) : console.error(err);
      }
      if (err || evt.stopped) break;
    }

    this.activations--;
    evt.onAfterDispatchCallbacks.forEach(ea => ea());
    if (err) throw err;
  }

  dispatchDOMEvent (domEvt, targetMorph, morphMethod) {
    const { world, eventState: state, nodeMorphMap } = this;
    const { timeStamp, type } = domEvt;

    state.timeOfLastActivity = this.timestampBase + timeStamp;

    if (!targetMorph && focusTargetingEvents.includes(type)) {
      targetMorph = state.focusedMorph || world;
    } else if (!targetMorph) {
      // search for the target node that represents a morph: Not all nodes with
      // event handlers might be rendered by morphs, e.g. in case of HTML morphs.
      // rms 13.4.20: What to do in case of a morph that is rendered to canvas?
      let targetNode = domEvt.composedPath()[0];
      while (true) {
        let cssClasses = targetNode.className || '';
        if (typeof cssClasses !== 'string' && 'baseVal' in cssClasses/* svg */) { cssClasses = cssClasses.baseVal; }
        // Maybe better "is-morph-node" test?
        if (cssClasses && cssClasses.includes('Morph')) break;
        if (!(targetNode = targetNode.parentNode)) return;
      }

      targetMorph = nodeMorphMap.get(targetNode);
      if (!targetMorph) {
        const targetId = targetNode.id;
        targetMorph = world.withAllSubmorphsDetect(sub => sub.id === targetId);
        if (targetMorph) nodeMorphMap.set(targetNode, targetMorph);
      }
    }

    if (!targetMorph) {
      // console.warn(`No target morph when dispatching DOM event ${type}`);
      return;
    }

    const { events, later } = this.processDOMEvent(domEvt, targetMorph);

    // run "later" callbacks
    later.map(callback => {
      this.activations++;
      return promise.delay(0)
        .then(callback)
        .then(() => this.activations--, err => { this.activations--; throw err; });
    });
    events.forEach(evt => this.dispatchEvent(evt, morphMethod));

    if (world && world.needsRerender() && eventsCausingImmediateRender.has(type)) {
      world.env.renderer.renderLater();
    }
  }

  simulateDOMEvents (...eventSpecs) {
    const doc = (this.emitter.document || this.emitter.ownerDocument); const events = [];

    for (let spec of eventSpecs) {
      let { target, position, type } = spec;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // find the target..

      // keyboard events always go to the keyInput textarea node
      if (focusTargetingEvents.includes(type)) {
        if (!this.keyInputHelper.domState.textareaNode) { throw new Error(`Cannot simulate event of type ${type}, no keyInputHelper installed!`); }
        spec = { ...spec, target: this.keyInputHelper.textareaNode };
      }

      if (!target) {
        if (!position) target = this.world;
        else target = this.world.morphsContainingPoint(position)[0];
      }
      if (target.isMorph) { spec = { ...spec, target: doc.getElementById(target.id) }; }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // position
      if (spec.position) {
        const { left, top } = cumulativeOffset(doc.getElementById(this.world.id));
        spec.position = spec.position.addXY(left, top);
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // scroll events
      if (type === 'scroll' && ('scrollLeft' in spec || 'scrollTop' in spec)) {
        spec.target.scrollLeft = spec.scrollLeft || 0;
        spec.target.scrollTop = spec.scrollTop || 0;
      }

      const evt = new SimulatedDOMEvent(spec);
      events.push(evt);
      this.dispatchDOMEvent(evt);
    }
    return events;
  }

  doCopy (content) {
    // via document.execCommand, might not work
    // usage:
    //   await $world.env.eventDispatcher.doCopy("foo124");
    return this.keyInputHelper.doCopy(content);
  }

  doCopyWithMimeTypes (dataAndTypes) {
    // usage:
    //   await $world.env.eventDispatcher.doCopyWithMimeTypes([{type: 'text/html', data: '<h1>fooo?</h1>'}]);
    return this.keyInputHelper.doCopyWithMimeTypes(dataAndTypes);
  }

  doPaste () { return this.keyInputHelper.doPaste(); }

  cancelGrab (hand, causingEvent) {
    const cleanupEvents = [];
    const state = this.eventState;
    state.clickedOnMorph = null;
    if (state.dropHoverTarget) {
      cleanupEvents.push(new Event('morphicdrophoverout', causingEvent.domEvt, this, [state.dropHoverTarget], hand, null, null));
      state.dropHoverTarget = null;
    }
    cleanupEvents.forEach(evt => this.dispatchEvent(evt));
  }
}
