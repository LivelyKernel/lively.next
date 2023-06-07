import bowser from 'bowser';
import { obj } from 'lively.lang';
import { pt } from 'lively.graphics';
import Keys from './Keys.js';
import { cumulativeOffset } from '../rendering/dom-helper.js';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// event constants and type detection
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export const pointerEvents = [
  'pointerover',
  'pointerenter',
  'pointerout',
  'pointerleave',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'gotpointercapture',
  'lostpointercapture'
];

export const mouseEvents = [
  'mouseover',
  'mouseenter',
  'mousedown',
  'mousemove',
  'mouseup',
  'mouseout',
  'mouseleave',
  'click',
  'dblclick',
  'contextmenu',
  'mousewheel'
];

export const keyboardEvents = ['keydown', 'keyup', 'keypress'];
export const keyLikeEvents = keyboardEvents.concat('input', 'compositionstart', 'compositionupdate', 'compositionend');

export class Event {
  constructor (type, domEvt, dispatcher, targetMorphs, hand, halo, layoutHalo) {
    this.type = type;
    this.domEvt = domEvt;
    this.dispatcher = dispatcher;
    this.targetMorphs = targetMorphs;
    this.hand = hand;
    this.halo = halo;
    this.layoutHalo = layoutHalo;
    this.stopped = false;
    this._keyCombo = undefined;
    this.onDispatchCallbacks = [];
    this.onAfterDispatchCallbacks = [];
    this.onStopCallbacks = [];
  }

  onDispatch (cb) { this.onDispatchCallbacks.push(cb); return this; }
  onAfterDispatch (cb) { this.onAfterDispatchCallbacks.push(cb); return this; }
  onStop (cb) { this.onStopCallbacks.push(cb); return this; }

  get data () { return this.domEvt.data; }
  get world () { return this.dispatcher.world; }
  get state () { return this.dispatcher.eventState; }
  get keyInputState () { return this.state.keyInputState; }

  isMouseEvent () {
    return pointerEvents.includes(this.type) || mouseEvents.includes(this.type);
  }

  isKeyboardEvent () {
    return !this.isMouseEvent() && keyboardEvents.includes(this.type);
  }

  stop () {
    this.stopped = true;
    this.domEvt && typeof this.domEvt.stopPropagation === 'function' && this.domEvt.stopPropagation();
    this.domEvt && typeof this.domEvt.preventDefault === 'function' && this.domEvt.preventDefault();
    this.onStopCallbacks.forEach(ea => ea());
  }

  get targetMorph () { return this.targetMorphs[0]; }
  get timestamp () { return this.domEvt.timeStamp; }

  get position () {
    if (!this.domEvt) return pt(0, 0);
    let worldNode = this.domEvt.composedPath()[0];
    while (worldNode) {
      if (worldNode.id === this.world.id) break;
      worldNode = worldNode.parentNode;
    }

    if (!worldNode) {
      const target = this.domEvt.composedPath()[0] || this.domEvt.target;
      const defaultDoc = this.world.env.domEnv.document;
      const doc = target.nodeType === target.DOCUMENT_NODE ? target : defaultDoc;
      worldNode = doc.getElementById(this.world.id);
    }

    if (!worldNode) {
      console.error('event position: cannot find world node for determining the position!');
      return pt(0, 0);
    }

    const { left, top } = cumulativeOffset(worldNode);
    const { pageX, pageY } = this.domEvt;
    let pos = pt((pageX || 0) - left, (pageY || 0) - top);
    if (this.world.scale !== 1) { pos = pos.scaleBy(1 / this.world.scale); }
    return pos;
  }

  get startPosition () {
    // FIXME, might be for more than just clicks...
    return this.state.clickedOnPosition;
  }

  get pressure () {
    if (!this.domEvt) return 0.5;
    return this.domEvt.pressure;
  }

  positionIn (aMorph) {
    // returns the event position localized to aMorph
    return aMorph.localize(this.position);
  }

  isClickTarget (morph) {
    const clicked = this.state.clickedOnMorph;
    return clicked && (morph === clicked || morph.isAncestorOf(clicked));
  }

  // mouse buttons, see
  // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
  leftMouseButtonPressed () {
    return this.domEvt ? this.domEvt.buttons === 1 : false;
  }

  rightMouseButtonPressed () {
    return this.domEvt ? this.domEvt.buttons === 2 : false;
  }

  middleMouseButtonPressed () {
    return this.domEvt ? this.domEvt.buttons === 4 : false;
  }

  isCommandKey () {
    const domEvt = this.domEvt;
    if (!domEvt) return false;
    let isCmd = false;
    if (!bowser.mac) { isCmd = isCmd || domEvt.ctrlKey; }
    if (bowser.tablet || bowser.tablet) { isCmd = isCmd || false; }/* FIXME! */
    return isCmd || domEvt.metaKey || domEvt.keyIdentifier === 'Meta';
  }

  isShiftDown () { return this.domEvt && !!this.domEvt.shiftKey; }
  isCtrlDown () { return this.domEvt && !!this.domEvt.ctrlKey; }
  isAltDown () { return this.domEvt && !!this.domEvt.altKey; }

  get keyCombo () { return this._keyCombo || (this._keyCombo = Keys.eventToKeyCombo(this.domEvt)); }
  set keyCombo (keyCombo) { return this._keyCombo = keyCombo; }
}

export class KeyEvent extends Event {
  constructor (type, domEvt, dispatcher, targetMorphs, hand, halo, layoutHalo) {
    console.assert(keyLikeEvents.includes(type), 'not a keyboard event: ' + type);
    super(type, domEvt, dispatcher, targetMorphs, hand, halo, layoutHalo);
    Object.assign(this, Keys.canonicalizeEvent(domEvt));
  }

  get isKeyEvent () { return true; }

  /**
   * Returns `true` when an arrow key press triggered this event and `false` otherwise.
   * @returns {Boolean}
   */
  get hasArrowPressed () {
    const keyCode = this.domEvt.keyCode;
    if (keyCode >= 37 && keyCode <= 40) return true;
    return false;
  }

  get hasCharacterPressed () {
    const keyCode = this.domEvt.keyCode;

    if (keyCode >= 48 && keyCode <= 57) {
      return true;
    } else if (keyCode >= 65 && keyCode <= 90) {
      return true;
    } else if (keyCode >= 97 && keyCode <= 122) {
      return true;
    }
    return false;
  }
}

export class SimulatedDOMEvent {
  constructor (props = {}) {
    if (props.position) {
      const { position: { x, y } } = props;
      props = obj.dissoc(props, ['position']);
      props.pageX = x; props.pageY = y;
    }

    if (!props.hasOwnProperty('pointerId') && mouseEvents.concat(pointerEvents).includes(props.type)) {
      props = { ...props, pointerId: 1 };
    }

    Object.assign(this, {
      type: undefined,
      target: undefined,
      pageX: undefined,
      pageY: undefined,
      pointerId: undefined,
      pointerType: 'mouse',
      buttons: 0,
      keyCode: undefined,
      keyString: '',
      keyIdentifier: undefined,
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      stopped: false,
      ...props
    });
  }

  preventDefault () { this.defaultPrevented = true; }
  stopPropagation () { this.propagationStopped = true; }
  composedPath () { return [this.target]; }
}
