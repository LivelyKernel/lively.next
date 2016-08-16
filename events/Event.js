import { arr, obj } from "lively.lang";
import { pt } from "lively.graphics";
import Keys from './Keys.js';

export function cumulativeElementOffset(element) {
  var offsetTop = 0, offsetLeft = 0;
  do {
    offsetTop += element.offsetTop  || 0;
    offsetLeft += element.offsetLeft || 0;
    element = element.offsetParent;
  } while(element);
  return {offsetLeft, offsetTop};
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// event constants and type detection
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export const domEventsWeListenTo = [
  {type: 'pointerdown', capturing: false},
  {type: 'pointerup',   capturing: false},
  {type: 'pointermove', capturing: false},
  {type: 'pointerover', capturing: false},
  {type: 'pointerout',  capturing: false},
  {type: 'keydown',     capturing: false},
  {type: 'keyup',       capturing: false},
  {type: 'contextmenu', capturing: false},
  {type: 'cut',         capturing: false},
  {type: 'copy',        capturing: false},
  {type: 'paste',       capturing: false},
  {type: 'scroll',      capturing: true}
]

export const typeToMethodMap = {
  'pointerdown': "onMouseDown",
  'pointerup':   "onMouseUp",
  'pointermove': "onMouseMove",
  'hoverin':     "onHoverIn",
  'hoverout':    "onHoverOut",
  'drag':        "onDrag",
  'dragstart':   "onDragStart",
  'dragend':     "onDragEnd",
  'grab':        "onGrab",
  'drop':        "onDrop",
  'keydown':     "onKeyDown",
  'keyup':       "onKeyUp",
  'blur':        "onBlur",
  'focus':       "onFocus",
  'contextmenu': "onContextMenu",
  'cut':         "onCut",
  'copy':        "onCopy",
  'paste':       "onPaste",
  'scroll':       "onScroll"
}

export const pointerEvents = [
  "pointerover",
  "pointerenter",
  "pointerout",
  "pointerleave",
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "gotpointercapture",
  "lostpointercapture"
];

export const mouseEvents = [
  "mouseover",
  "mouseenter",
  "mousedown",
  "mousemove",
  "mouseup",
  "mouseout",
  "mouseleave",
  'click',
  'dblclick',
  'contextmenu',
  'mousewheel'
];

export const keyboardEvents = ["keydown", "keyup", "keypress"];

export const focusTargetingEvents = [
  "keydown", "keyup", "keypress",
  "input", "compositionStart", "compositionUpdate", "compositionEnd",
  "cut", "copy", "paste",
];


export class Event {

  constructor(type, domEvt, dispatcher, targetMorphs, hand, halo, layoutHalo) {
    this.type = type;
    this.domEvt = domEvt;
    this.dispatcher = dispatcher;
    this.targetMorphs = targetMorphs;
    this.hand = hand;
    this.halo = halo;
    this.layoutHalo = layoutHalo;
    this.stopped = false;
    this.onDispatchCallbacks = [];
    this.onAfterDispatchCallbacks = [];
    this.onStopCallbacks = [];
  }

  onDispatch(cb) { this.onDispatchCallbacks.push(cb); return this; }
  onAfterDispatch(cb) { this.onAfterDispatchCallbacks.push(cb); return this; }
  onStop(cb) { this.onStopCallbacks.push(cb); return this; }

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
    this.domEvt && this.domEvt.stopPropagation();
    this.domEvt && this.domEvt.preventDefault();
    this.onStopCallbacks.forEach(ea => ea());
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
    if (!this.domEvt) return pt(0,0);
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

    var {offsetLeft, offsetTop} = cumulativeElementOffset(worldNode),
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
    return this.domEvt ? (this.domEvt.buttons || 0) & 1 : false;
  }

  rightMouseButtonPressed() {
    return this.domEvt ? (this.domEvt.buttons || 0) & 2 : false;
  }

  middleMouseButtonPressed() {
    return this.domEvt ? (this.domEvt.buttons || 0) & 4 : false;
  }

  isCommandKey() { return this.domEvt && Keys.isCommandKey(this.domEvt); }
  isShiftDown() { return this.domEvt && Keys.isShiftDown(this.domEvt); }
  isCtrlDown() {return this.domEvt && Keys.isCtrlDown(this.domEvt);}
  isAltDown() { return this.domEvt && Keys.isAltDown(this.domEvt); }

  keyString(opts) { return this.domEvt && Keys.pressedKeyString(this.domEvt, opts); }

}

export class SimulatedDOMEvent {

  constructor(props = {}) {

    if (props.position) {
      let {position: {x, y}, target} = props;
      props = obj.dissoc(props, ["position"]);
      props.pageX = x; props.pageY = y;
    }

    if (!props.hasOwnProperty("pointerId") && mouseEvents.concat(pointerEvents).includes(props.type)) {
      props = {...props, pointerId: 1};
    }

    Object.assign(this, {
      type: undefined,
      target: undefined,
      pageX: undefined,
      pageY: undefined,
      pointerId: undefined,
      buttons: -1,
      keyCode: undefined,
      keyIdentifier: undefined,
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      ...props
    });
  }

  preventDefault() {}
  stopPropagation() {}
}