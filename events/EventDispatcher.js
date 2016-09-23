import { arr, promise } from "lively.lang";
import { pt } from "lively.graphics";
import config from "../config.js";
import TextInput from './TextInput.js';
import KillRing from './KillRing.js';

import {
  Event, KeyEvent, SimulatedDOMEvent,
  cumulativeElementOffset,
  keyLikeEvents
} from './Event.js';

// note: keydown, keyup, cut, copy, paste, compositionstart, compositionend,
// compositionupdate, input are listened to by the text input helper
const domEventsWeListenTo = [
  {type: 'pointerdown', capturing: false},
  {type: 'pointerup',   capturing: false},
  {type: 'pointermove', capturing: false},
  {type: 'pointerover', capturing: false},
  {type: 'pointerout',  capturing: false},
  {type: 'contextmenu', capturing: false},
  {type: 'scroll',      capturing: true},
  {type: 'wheel',       capturing: false}
];

const globalDomEventsWeListenTo = [
  {type: 'resize', capturing: false, morphMethod: "onWindowResize"},
  {type: 'orientationchange', capturing: false, morphMethod: "onWindowResize"},
  {type: 'scroll', capturing: false, morphMethod: "onWindowScroll"}
];

const typeToMethodMap = {
  "pointerdown":       "onMouseDown",
  "pointerup":         "onMouseUp",
  "pointermove":       "onMouseMove",
  "hoverin":           "onHoverIn",
  "hoverout":          "onHoverOut",
  "drag":              "onDrag",
  "dragstart":         "onDragStart",
  "dragend":           "onDragEnd",
  "grab":              "onGrab",
  "drop":              "onDrop",
  "keydown":           "onKeyDown",
  "keyup":             "onKeyUp",
  "input":             "onTextInput",
  "compositionstart":  "onCompositionStart",
  "compositionupdate": "onCompositionUpdate",
  "compositionend":    "onCompositionEnd",
  "blur":              "onBlur",
  "focus":             "onFocus",
  "contextmenu":       "onContextMenu",
  "cut":               "onCut",
  "copy":              "onCopy",
  "paste":             "onPaste",
  "scroll":            "onScroll",
  "wheel" :            "onMouseWheel"
}

const focusTargetingEvents = [
  "keydown", "keyup", "keypress",
  "input", "compositionstart", "compositionupdate", "compositionend",
  "cut", "copy", "paste",
];

const textOnlyEvents = [
  "input", "compositionstart", "compositionupdate", "compositionend"
]

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers

function dragStartEvent(domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo) {
  var evt = new Event("dragstart", domEvt, dispatcher, [targetMorph], hand, halo, layoutHalo)
    .onDispatch(() => {
      state.draggedMorph = targetMorph;
      state.lastDragPosition = evt.position;
      state.dragDelta = pt(0,0);
    })
    .onStop(() => {
      state.draggedMorph = null;
      dispatcher.schedule(dragEndEvent(domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo));
    });
  return evt;
}

function dragEvent(domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo) {
  var evt = new Event("drag", domEvt, dispatcher, [state.draggedMorph], hand, halo, layoutHalo)
    .onDispatch(() => {
      state.dragDelta = evt.position.subPt(state.lastDragPosition);
    })
    .onAfterDispatch(() => state.lastDragPosition = evt.position)
    .onStop(() => {
      state.draggedMorph = null;
      dispatcher.schedule(dragEndEvent(domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo));
    });
  return evt;
}

function dragEndEvent(domEvt, dispatcher, targetMorph, state, hand, halo, layoutHalo) {
  var evt = new Event("dragend", domEvt, dispatcher, [state.draggedMorph || targetMorph], hand, halo, layoutHalo)
    .onDispatch(() => state.dragDelta = evt.position.subPt(state.lastDragPosition))
    .onAfterDispatch(() => {
      state.draggedMorph = null;
      state.lastDragPosition = null;
    });
  return evt;
}

function focusEvents(dispatcher, targetMorph) {
  var state = dispatcher.eventState;

  if (state.focusedMorph === targetMorph) return [];

  var domEvt = null, hand = null, halo = null, layoutHalo = null, events = [];

  state.focusedMorph && events.push(
    new Event("blur", domEvt, this, [state.focusedMorph], hand, halo, layoutHalo)
      .onDispatch(() => state.focusedMorph = null));

  events.push(
    new Event("focus", domEvt, this, [targetMorph], hand, halo, layoutHalo)
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

There are some events that aren’t “capturing”, i.e. that are not being send to
the entire owner chain of the target morph. Currently these are dragstart,
dragend, drag, focus, blur, grab, hoverin, hoverout.

*/

export default class EventDispatcher {

  constructor(domEventEmitter, world) {
    this.activations = 0;
    this.emitter = domEventEmitter;
    this.keyInputHelper = null;
    this.world = world;
    this.installed = false;
    this.handlerFunctions = [];
    this.killRing = new KillRing(config.text.clipboardBufferLength);

    this.resetState();
  }

  resetState() {
    // A place where info about previous events can be stored, e.g. for tracking
    // what was clicked on
    this.eventState = {
      focusedMorph: null,
      clickedOnPosition: null,
      clickedOnMorph: null,
      clickCount: 0,
      prevClick: null,
      draggedMorph: null,
      dragDelta: null,
      lastDragPosition: null,
      hover: {hoveredOverMorphs: [], unresolvedPointerOut: false},
      keyInputState: null
    };
    this.resetKeyInputState()
  }

  resetKeyInputState() {
    this.eventState.keyInputState = {
      keyChain: undefined,
      count: undefined
    }
  }

  focusMorph(morph) {
    this.keyInputHelper && this.keyInputHelper.focus();
    focusEvents(this, morph).forEach(evt => this.dispatchEvent(evt));
  }

  isMorphFocused(morph) {
    return this.eventState.focusedMorph === morph;
  }

  whenIdle() {
    return promise.waitFor(() => this.activations === 0);
  }

  install(rootNode) {
    if (this.installed) return this;
    this.installed = true;
    var { emitter } = this,
        globalEmitter = System.global/*FIXME?*/;

    domEventsWeListenTo.forEach(({type, capturing}) => {
      let fn = evt => this.dispatchDOMEvent(evt);
      this.handlerFunctions.push({node: emitter, type, fn, capturing});
      emitter.addEventListener(type, fn, capturing);
    });

    globalEmitter.addEventListener && globalDomEventsWeListenTo.forEach(({type, capturing, morphMethod}) => {
      let fn = evt => this.dispatchDOMEvent(evt, this.world, morphMethod);
      this.handlerFunctions.push({node: globalEmitter, type, fn, capturing});
      globalEmitter.addEventListener(type, fn, capturing);
    });

    this.keyInputHelper = new TextInput(this).install(rootNode);

    return this;
  }

  uninstall() {
    this.installed = false;

    var handlerFunctions = this.handlerFunctions;
    handlerFunctions.forEach(({node, type, fn, capturing}) =>
      node.removeEventListener(type, fn, capturing));
    handlerFunctions.length = 0;

    this.keyInputHelper && this.keyInputHelper.uninstall();
    this.keyInputHelper = null;

    return this;
  }

  processDOMEvent(domEvt, targetMorph) {
    // In morphic we don't map events 1:1 from the DOM to the events morph get
    // triggered with. E.g. we have our own drag behvior. This is the place where
    // dom events get mapped to those morph events, zero to many.
    // Also for some kinds of event we need to accumulate

    var type         = domEvt.type,
        state        = this.eventState,
        eventTargets = [targetMorph].concat(targetMorph.ownerChain()),
        hand         = domEvt.pointerId ? this.world.handForPointerId(domEvt.pointerId) : null,
        halo         = domEvt.pointerId ? this.world.haloForPointerId(domEvt.pointerId) : null,
        layoutHalo   = domEvt.pointerId ? this.world.layoutHaloForPointerId(domEvt.pointerId) : null,
        klass        = keyLikeEvents.includes(type) ? KeyEvent : Event,
        defaultEvent = new klass(type, domEvt, this, eventTargets, hand, halo, layoutHalo),
        events       = [defaultEvent],
        later        = [];


    switch (type) {

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case 'click':
        // Note, we currently don't subscribe to click DOM events, this is just a
        // convenience for event simulation
        var {events: downEvents} = this.processDOMEvent({...domEvt, type: "pointerdown"}, targetMorph),
            {events: upEvents} = this.processDOMEvent({...domEvt, type: "pointerup"}, targetMorph);
        events = downEvents.concat(upEvents);
        break;


      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case "pointerdown":
        // so that we receive pointerups even if the cursor leaves the browser
        if (typeof domEvt.target.setPointerCapture === "function") {
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

          let repeatedClick = false, prevClickCount = 0;
          if (state.prevClick) {
            let { clickedOnMorph, clickedOnPosition, clickedAtTime, clickCount } = state.prevClick,
              clickInterval = Date.now() - clickedAtTime;
            repeatedClick = clickedOnMorph === targetMorph && clickInterval < config.repeatClickInterval;
            prevClickCount = clickCount
          }
          state.clickCount = repeatedClick ? prevClickCount + 1 : 1;
        });
        break;


      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case "pointerup":
        defaultEvent.onDispatch(() => {
          let { clickedOnMorph, clickedOnPosition, clickCount } = state,
              clickedAtTime = Date.now();
          state.prevClick = { clickedOnMorph, clickedOnPosition, clickedAtTime, clickCount };
          state.clickedOnMorph = null;
          state.clickCount = 0;
        });

        // drag release
        if (state.draggedMorph) {
          events.push(dragEndEvent(domEvt, this, targetMorph, state, hand, halo, layoutHalo));
          defaultEvent.targetMorphs = [this.world];

        // grap release
        } else if (hand.carriesMorphs()) {
          events.push(new Event("drop", domEvt, this, [targetMorph], hand, halo, layoutHalo));
          defaultEvent.targetMorphs = [this.world];
        }
        break;


      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case "pointermove":
        // Are we dragging a morph? If so the move gets only send to the world
        // and the drag only send to the dragged morph

        if (hand.carriesMorphs()) {
          defaultEvent.targetMorphs = [this.world];

        } else if (state.draggedMorph) {
          defaultEvent.targetMorphs = [this.world];
          events.push(dragEvent(domEvt, this, targetMorph, state, hand, halo, layoutHalo));

        // Start dragging when we are holding the hand pressed and and move it
        // beyond targetMorph.dragTriggerDistance
        } else if (state.clickedOnMorph && state.clickedOnPosition
                && targetMorph.draggable
                && !state.draggedMorph
                && !hand.carriesMorphs()
                && state.clickedOnPosition) {

          var dist = state.clickedOnPosition.dist(defaultEvent.position),
              dragTarget = state.clickedOnMorph;
          if (dist > dragTarget.dragTriggerDistance) {
            // FIXME should grab really be triggered through drag?
            if (dragTarget.grabbable) {
              events.push(new Event("grab", domEvt, this, [dragTarget], hand, halo, layoutHalo));
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

      case "pointerover":
        if (state.hover.unresolvedPointerOut)
          state.hover.unresolvedPointerOut = false;

        var hoveredOverMorphs = [targetMorph].concat(targetMorph.ownerChain()).reverse(),
            hoverOutEvents = arr.withoutAll(state.hover.hoveredOverMorphs, hoveredOverMorphs)
              .map(m => new Event("hoverout", domEvt, this, [m], hand, halo, layoutHalo)
                          .onDispatch(() => arr.remove(state.hover.hoveredOverMorphs, m))),
            hoverInEvents = arr.withoutAll(hoveredOverMorphs, state.hover.hoveredOverMorphs)
              .map(m => new Event("hoverin", domEvt, this, [m], hand, halo, layoutHalo)
                          .onDispatch(() => arr.pushIfNotIncluded(state.hover.hoveredOverMorphs, m)))
        events = hoverOutEvents.concat(hoverInEvents);
        break;

      case "pointerout":
        events = [];
        state.hover.unresolvedPointerOut = true;
        later.push(() => {
          // outTargetMorph usually gets reset by a asynchronously following
          // pointerover event *except* when we the pointer leaves the entire
          // window. In this case we hover out of all morphs that are currently
          // marked as hovered in
          if (state.hover.unresolvedPointerOut) {
            return Promise.all(state.hover.hoveredOverMorphs.map(m =>
              this.schedule(new Event("hoverout", domEvt, this, [m], hand, halo, layoutHalo)
                              .onAfterDispatch(() => arr.remove(state.hover.hoveredOverMorphs, m)))));

          }
        });
        break;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // Note: these events can be used manually. If you just want to focus
      // a morph use morph.focus()
      case "blur":
        events = [new Event(type, domEvt, this, [targetMorph], hand, halo, layoutHalo)
                  .onDispatch(() => state.focusedMorph = null)]
        break;
      case "focus":
        events = focusEvents(this, targetMorph);
        break;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case "scroll":
        events = [new Event(type, domEvt, this, [targetMorph], hand, halo, layoutHalo)
          .onDispatch(() => targetMorph.scroll = pt(domEvt.target.scrollLeft, domEvt.target.scrollTop))]
        break;

      case "input": case "compositionstart": case "compositionupdate": case "compositionend":
        // text only
        if (!targetMorph.isText) events = [];
        else defaultEvent.targetMorphs = [targetMorph];
        break;
    }

    return {events, later};
  }

  schedule(evt) {
    this.activations++;
    return Promise.resolve()
      .then(() => this.dispatchEvent(evt))
      .then(() => this.activations--, err => { this.activations--; throw err; })
  }

  dispatchEvent(evt, method) {
    method = method || typeToMethodMap[evt.type];

    if (!method)
      throw new Error(`dispatchEvent: ${evt.type} not yet supported!`);

    evt.onDispatchCallbacks.forEach(ea => ea());
    this.activations++;

    var err;
    for (var j = evt.targetMorphs.length-1; j >= 0; j--) {
      try {
        evt.targetMorphs[j][method](evt);
      } catch (e) {
        err = new Error(`Error in event handler ${evt.targetMorphs[j]}.${method}: ${e.stack || e}`);
        err.originalError = e;
        typeof $world !== "undefined" ? $world.logError(err) : console.error(err);
      }
      if (err || evt.stopped) break;
    }
    this.activations--;
    evt.onAfterDispatchCallbacks.forEach(ea => ea());
    if (err) throw err;
  }

  dispatchDOMEvent(domEvt, targetMorph, morphMethod) {
    if (!targetMorph && focusTargetingEvents.includes(domEvt.type)) {
      targetMorph = this.eventState.focusedMorph || this.world;
    } else if (!targetMorph) {
      // search for the target node that represents a morph: Not all nodes with
      // event handlers might be rendered by morphs, e.g. in case of HTML morphs
      var targetNode = domEvt.target;
      while (true) {
        var cssClasses = targetNode.className;
        // Maybe better "is-morph-node" test?
        if (cssClasses && cssClasses.includes("morph")) break;
        if (!(targetNode = targetNode.parentNode)) return;
      }
      var targetId = targetNode.id;
      targetMorph = this.world.withAllSubmorphsDetect(sub => sub.id === targetId);
    }

    if (!targetMorph) {
      // console.warn(`No target morph when dispatching DOM event ${domEvt.type}`);
      return;
    }

    var {events, later} = this.processDOMEvent(domEvt, targetMorph);

    // run "later" callbacks
    later.map(callback => {
      this.activations++;
      return promise.delay(0)
        .then(callback)
        .then(() => this.activations--, err => { this.activations--; throw err; })
    });
    events.forEach(evt => this.dispatchEvent(evt, morphMethod));
  }

  simulateDOMEvents(...eventSpecs) {
    var doc = (this.emitter.document || this.emitter.ownerDocument);
    for (let spec of eventSpecs) {
      let {target, position, type} = spec;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // find the target..

      // keyboard events always go to the keyInput textarea node
      if (focusTargetingEvents.includes(type)) {
        if (!this.keyInputHelper.domState.textareaNode)
          throw new Error(`Cannot simulate event of type ${type}, no keyInputHelper installed!`);
        spec = {...spec, target: this.keyInputHelper.textareaNode};
      }

      if (!target) {
        if (!position) target = this.world;
        else target = this.world.morphsContainingPoint(position)[0];
      }
      if (target.isMorph)
        spec = {...spec, target: doc.getElementById(target.id)};

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // position
      if (spec.position) {
        var {offsetLeft, offsetTop} = cumulativeElementOffset(doc.getElementById(this.world.id));
        spec.position = spec.position.addXY(offsetLeft, offsetTop);
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // scroll events
      if (type === "scroll" && ("scrollLeft" in spec || "scrollRight" in spec)) {
        spec.target.scrollLeft = spec.scrollLeft || 0;
        spec.target.scrollTop = spec.scrollTop || 0;
      }

      this.dispatchDOMEvent(new SimulatedDOMEvent(spec))
    }
    return this;
  }

  doCopy(content) {
    // via document.execCommand, might not work
    // usage:
    //   await $world.env.eventDispatcher.doCopy("foo124");
    return this.keyInputHelper.doCopy(content);
  }
  doPaste() { return this.keyInputHelper.doPaste(); }

}
