import bowser from "bowser";
import { obj } from "lively.lang";
import { pt } from "lively.graphics";
import Keys from './Keys.js';

export function cumulativeElementOffset(element) {
  // computes offset in pixels of element from the top left screen position
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

  get data() { return this.domEvt.data; }
  get world() { return this.dispatcher.world; }
  get state() { return this.dispatcher.eventState; }

  isMouseEvent() {
    return pointerEvents.includes(this.type) || mouseEvents.includes(this.type);
  }

  isKeyboardEvent() {
    return !this.isMouseEvent() && keyboardEvents.includes(this.type);
  }

  stop() {
    this.stopped = true;
    this.domEvt && this.domEvt.stopPropagation();
    this.domEvt && this.domEvt.preventDefault();
    this.onStopCallbacks.forEach(ea => ea());
  }

  get targetMorph() { return this.targetMorphs[0]; }

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

  isCommandKey() {
    var domEvt = this.domEvt;
    if (!domEvt) return false;
    var isCmd = false;
    if (!bowser.mac)
        isCmd = isCmd || domEvt.ctrlKey;
    if (bowser.tablet || bowser.tablet)
        isCmd = isCmd || false/*FIXME!*/
    return isCmd || domEvt.metaKey || domEvt.keyIdentifier === 'Meta';
  }

  isShiftDown(domEvt) { return this.domEvt && !!this.domEvt.shiftKey }
  isCtrlDown(domEvt) { return this.domEvt && !!this.domEvt.ctrlKey }
  isAltDown(domEvt) { return this.domEvt && !!this.domEvt.altKey }

  keyString(opts) { return this.domEvt && Keys.eventToKeyString(this.domEvt, opts); }

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