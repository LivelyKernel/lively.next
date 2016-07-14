import { arr } from "lively.lang";
import { pt } from "lively.graphics";
import bowser from "bowser";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// event constants and type detection
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const typeToMethodMap = {
  'pointerdown': "onMouseDown",
  'pointerup': "onMouseUp",
  'pointermove': "onMouseMove",
  'drag': "onDrag",
  'dragstart': "onDragStart",
  'dragend': "onDragEnd",
  'grab' : "onGrab",
  'drop' : "onDrop",
  'input' : "onInput",
  'select' : "onSelect",
  'deselect' : "onDeselect",
  'keydown' : "onKeyDown",
  'blur' : "onBlur",
  'focus' : "onFocus"
}

const pointerEvents = [
  "pointerover",
  "pointerenter",
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "pointerout",
  "pointerleave",
  "gotpointercapture",
  "lostpointercapture",
];

const mouseEvents = [
  "mouseover",
  "mouseenter",
  "mousedown",
  "mousemove",
  "mouseup",
  "mouseout",
  "mouseleave",
  'click',
  'dblclick',
  'selectstart',
  'contextmenu',
  'mousewheel'
];

const keyboardEvents = [
  'keydown',
  'keyup',
  'keypress'
];


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Event object
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function cumulativeOffset(element) {
  var top = 0, left = 0;
  do {
    top += element.offsetTop  || 0;
    left += element.offsetLeft || 0;
    element = element.offsetParent;
  } while(element);
  return {offsetLeft: left, offsetTop: top};
}

export class Event {

  constructor(type, domEvt, dispatcher, targetMorphs, hand, halo) {
    this.type = type;
    this.domEvt = domEvt;
    this.dispatcher = dispatcher;
    this.targetMorphs = targetMorphs;
    this.hand = hand;
    this.halo = halo;
    this.stopped = false;
  }

  get world() { return this.dispatcher.world; }
  get state() { return this.dispatcher.eventState; }

  isMouseEvent() {
    return arr.include(pointerEvents, this.type) || arr.include(mouseEvents, this.type)
  }

  isKeyboardEvent() {
    return !this.isMouseEvent() && arr.include(keyboardEvents, this.type);
  }

  stop() {
    this.stopped = true;
    this.domEvt.stopPropagation();
    this.domEvt.preventDefault();

    var draggedMorph = this.state.draggedMorph;
    if (this.type === "drag" || this.type === "dragstart" || draggedMorph) {
      this.state.draggedMorph = null;
      this.dispatcher.schedule(new Event("dragend", this.domEvt, this.dispatcher, [draggedMorph], this.hand, this.halo));
    }
  }

  get targetMorph() { return this.targetMorphs[0]; }

  // evt.getTargetMorph = function() {
  //     var node = evt.target;
  //     while (node) {
  //         if (node.getAttribute
  //         && node.getAttribute('data-lively-node-type') === 'morph-node') break;
  //         node = node.parentNode;
  //     }
  //     return node && lively.$(node).data('morph');
  // }

  get position() {
    var worldNode = this.domEvt.target;
    while (worldNode) {
      if (worldNode.id === this.world.id) break;
      worldNode = worldNode.parentNode;
    }
    // if (!worldNode)
    //   worldNode = this.domEvt.target.ownerDocument.getElementById(this.world.id);

    if (!worldNode) {
      console.error(`event position: cannot find world node for determining the position!`)
      return pt(0,0)
    }

    var {offsetLeft, offsetTop} = cumulativeOffset(worldNode),
        {pageX, pageY} = this.domEvt,
        pos = pt((pageX || 0) - offsetLeft, (pageY || 0) - offsetTop);
    if (this.world.scale !== 1)
      pos = pos.scaleBy(1 / this.world.scale);
    return pos;
  }

  get startPosition() {
    // FIXME, might be for more than just clicks...
    return this.state.clickedOnPosition;
  }

  positionIn(aMorph) {
    // returns the event position localized to aMorph
    return aMorph.localize(this.position);
  }

  // mouse buttons, see
  // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
  leftMouseButtonPressed() {
    return (this.domEvt.buttons || 0) & 1;
  }

  rightMouseButtonPressed() {
    return (this.domEvt.buttons || 0) & 2;
  }

  middleMouseButtonPressed() {
    return (this.domEvt.buttons || 0) & 4;
  }

  metaPressed() {
    return !!this.domEvt.metaKey
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// dispatcher: mapping DOM events to morph, invoking morph
// event handling methods
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class EventDispatcher {

  constructor(domEventEmitter, world) {
    this.emitter = domEventEmitter;
    this.world = world;
    this.installed = false;
    this.handlerFunctions = {};
    // A place where info about previous events can be stored, e.g. for tracking
    // what was clicked on
    this.eventState = {};
  }

  install() {
    if (this.installed) return this;
    this.installed = true;
    Object.keys(typeToMethodMap).forEach(type => {
      this.emitter.addEventListener(
        type, this.handlerFunctions[type] = evt => this.dispatchDOMEvent(evt))
    });
    return this;
  }

  uninstall() {
    this.installed = false;
    Object.keys(this.handlerFunctions).forEach(type => {
      this.emitter.removeEventListener(type, this.handlerFunctions[type]);
    });
    this.handlerFunctions = {};
    return this;
  }

  createMorphicEventsFromDOMEvent(domEvt, targetMorph) {
    // In morphic we don't map events 1:1 from the DOM to the events morph get
    // triggered with. E.g. we have our own drag behvior. This is the place where
    // dom events get mapped to those morph events, zero to many.

    var type = domEvt.type,
        state = this.eventState,
        eventTargets = [targetMorph].concat(targetMorph.ownerChain()),
        hand = domEvt.pointerId ? this.world.handForPointerId(domEvt.pointerId) : null,
        halo = domEvt.pointerId ? this.world.haloForPointerId(domEvt.pointerId) : null,
        defaultEvent = new Event(type, domEvt, this, eventTargets, hand, halo),
        events = [defaultEvent];

    if (type === "pointerdown") {
      // so that we receive pointerups even if the cursor leaves the browser
      if (typeof domEvt.target.setPointerCapture === "function") {
        try {
          // domEvt.target.setPointerCapture(domEvt.pointerId);
        } catch (e) {}
      }

      // We remember the morph that we clicked on until we get an up event.
      // This allows us to act on this info later
      state.clickedOnMorph = targetMorph;
      state.clickedOnPosition = defaultEvent.position;
    } else if (type === "pointerup") {
      state.clickedOnMorph = null;

      // drag release
      if (state.draggedMorph) {
        events.push(new Event("dragend", domEvt, this, [state.draggedMorph], hand, halo));
        defaultEvent.targetMorphs = [this.world];
        state.draggedMorph = null;

      // grap release
      } else if (hand.carriesMorphs()) {
        events.push(new Event("drop", domEvt, this, [targetMorph], hand, halo));
        defaultEvent.targetMorphs = [this.world];
      }

    } else if (type === "pointermove") {
      // Are we dragging a morph? If so the move gets only send to the world
      // and the drag only send to the dragged morph
      if (hand.carriesMorphs()) {
        defaultEvent.targetMorphs = [this.world];
      } else if (state.draggedMorph) {
        events.push(new Event("drag", domEvt, this, [state.draggedMorph], hand, halo));
        defaultEvent.targetMorphs = [this.world];

      // Start dragging when we are holding the hand pressed and and move it
      // beyond targetMorph.dragTriggerDistance
      } else if (state.clickedOnMorph === targetMorph
              && targetMorph.draggable
              && !state.draggedMorph
              && !hand.carriesMorphs()
              && state.clickedOnPosition) {
        var dist = state.clickedOnPosition.dist(defaultEvent.position);

        if (dist > targetMorph.dragTriggerDistance) {
          // FIXME should grab really be triggered through drag?
          if (targetMorph.grabbable) {
            events.push(new Event("grab", domEvt, this, [targetMorph], hand, halo));
          } else {
            state.draggedMorph = targetMorph;
            events.push(new Event("dragstart", domEvt, this, [targetMorph], hand, halo));
          }
          defaultEvent.targetMorphs = [this.world];
        }
      }

    } else if (type === "select") {
      state.selectionMorph = targetMorph;
    }

    if (state.selectionMorph && (type === "keydown" || type === "pointerdown" || type === "blur" || type === "focus")) {
      events.push(new Event("deselect", domEvt, this, [state.selectionMorph], hand));
      state.selectionMorph = null;
    }

    return events;
  }

  schedule(evt) {
    setTimeout(() => this.dispatchEvent(evt), 0);
  }

  dispatchEvent(evt) {
    var method = typeToMethodMap[evt.type],
        err;

    if (method) {
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
      if (err) throw err;
    } else {
      throw new Error(`dispatchEvent: ${evt.type} not yet supported!`)
    }
  }

  dispatchDOMEvent(domEvt) {
    var target = domEvt.target,
        targetId = target.id,
        targetMorph = this.world.withAllSubmorphsDetect(sub => sub.id === targetId);
    if (targetMorph)
      this.createMorphicEventsFromDOMEvent(domEvt, targetMorph)
        .forEach(evt => this.dispatchEvent(evt))
  }

}
