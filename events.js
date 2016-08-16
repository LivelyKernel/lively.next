import { arr, obj, promise } from "lively.lang";
import { pt } from "lively.graphics";
import bowser from "bowser";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// event constants and type detection
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const domEventsWeListenTo = [
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

const typeToMethodMap = {
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

const pointerEvents = [
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
  'contextmenu',
  'mousewheel'
];

const keyboardEvents = ["keydown", "keyup", "keypress"];

const focusTargetingEvents = [
  "keydown", "keyup", "keypress",
  "input", "compositionStart", "compositionUpdate", "compositionEnd",
  "cut", "copy", "paste",
];


function cumulativeOffset(element) {
  var offsetTop = 0, offsetLeft = 0;
  do {
    offsetTop += element.offsetTop  || 0;
    offsetLeft += element.offsetLeft || 0;
    element = element.offsetParent;
  } while(element);
  return {offsetLeft, offsetTop};
}

export var Keys = {

  KEY_BACKSPACE: 8,
  KEY_TAB:     9,
  KEY_RETURN:   13,
  KEY_ESC:    27,
  KEY_LEFT:    37,
  KEY_UP:      38,
  KEY_RIGHT:  39,
  KEY_DOWN:    40,
  KEY_DELETE:   46,
  KEY_HOME:    36,
  KEY_END:    35,
  KEY_PAGEUP:   33,
  KEY_PAGEDOWN: 34,
  KEY_INSERT:   45,
  KEY_SPACEBAR: 32,
  KEY_SHIFT:  16,
  KEY_CTRL:    17,
  KEY_ALT:    18,
  KEY_CMD:    91,

  isCommandKey(domEvt) {
      var isCmd = false;
      if (!bowser.mac)
          isCmd = isCmd || domEvt.ctrlKey;
      if (bowser.tablet || bowser.tablet)
          isCmd = isCmd || false/*FIXME!*/
      return isCmd || domEvt.metaKey || domEvt.keyIdentifier === 'Meta';
  },
  isShiftDown(domEvt) { return !!domEvt.shiftKey },
  isCtrlDown(domEvt) { return !!domEvt.ctrlKey },
  isAltDown(domEvt) { return !!domEvt.altKey },

  manualKeyIdentifierLookup: (() => {
    // this is a fallback for browsers whose key events do not have a
    // "keyIdentifier" property.
    // FIXME: as of 12/30/2013 this is only tested on MacOS
    var keyCodeIdentifiers = {
      8: {identifier: "Backspace"},
      9: {identifier: "Tab"},
      13: {identifier: "Enter"},
      16: {identifier: "Shift"},
      17: {identifier: "Control"},
      18: {identifier: "Alt"},
      27: {identifier: "Esc"},
      32: {identifier: "Space"},
      37: {identifier: "Left"},
      38: {identifier: "Up"},
      39: {identifier: "Right"},
      40: {identifier: "Down"},
      46: {identifier: "Del"},
      48: {identifier: "0", shifted: ")"},
      49: {identifier: "1", shifted: "!"},
      50: {identifier: "2", shifted: "@"},
      51: {identifier: "3", shifted: "#"},
      52: {identifier: "4", shifted: "$"},
      53: {identifier: "5", shifted: "%"},
      54: {identifier: "6", shifted: "^"},
      55: {identifier: "7", shifted: "&"},
      56: {identifier: "8", shifted: "*"},
      57: {identifier: "9", shifted: "("},
      91: {identifier: "Command"},
      93: {identifier: "Command"},
      112: {identifier: "F1"},
      113: {identifier: "F2"},
      114: {identifier: "F3"},
      115: {identifier: "F4"},
      116: {identifier: "F5"},
      117: {identifier: "F6"},
      118: {identifier: "F7"},
      119: {identifier: "F8"},
      120: {identifier: "F9"},
      121: {identifier: "F10"},
      122: {identifier: "F11"},
      123: {identifier: "F12"},
      186: {identifier: ";", shifted:":"},
      187: {identifier: "=", shifted:"+"},
      188: {identifier: ",", shifted:"<"},
      189: {identifier: "-", shifted:"_"},
      190: {identifier: ".", shifted:">"},
      191: {identifier: "/", shifted:"?"},
      192: {identifier: "`", shifted:"~"},
      219: {identifier: "[", shifted:"{"},
      220: {identifier: "\\", shifted:"|"},
      221: {identifier: "]", shifted:"}"},
      222: {identifier: "'", shifted:"\""},
      224: {identifier: "Command"},
    }
    return function(domEvt) {
      var id, c = domEvt.keyCode,
          shifted = this.isShiftDown(domEvt),
          ctrl = this.isCtrlDown(domEvt),
          cmd = this.isCommandKey(domEvt),
          alt = this.isAltDown(domEvt);
      if ((c >= 65 && c <= 90)) {
        id = String.fromCharCode(c).toUpperCase();
      } else {
        var codeId = keyCodeIdentifiers[c];
        if (codeId === undefined) id = "???";
        else {
          id = shifted && codeId.shifted ?
            codeId.shifted : codeId.identifier
        }
      }
      if (shifted && c !== 16) id = 'Shift-' + id;
      if (alt && c !== 18) id = 'Alt-' + id;
      if (ctrl) id = 'Control-' + id;
      if (cmd && c !== 91 && c !== 93 && c !== 224) id = 'Command-' + id;
      return id
    }
  })(),

  unicodeUnescape: (() => {
    var unicodeDecodeRe = /u\+?([\d\w]{4})/gi;
    function unicodeReplacer(match, grp) { return String.fromCharCode(parseInt(grp, 16)); }
    return function(id) { return id ? id.replace(unicodeDecodeRe, unicodeReplacer) : null; }
  })(),

  decodeKeyIdentifier(keyEvt) {
    // trying to find out what the String representation of the key pressed
    // in key event is.
    // Uses keyIdentifier which can be Unicode like "U+0021"
    var key = this.unicodeUnescape(keyEvt.keyIdentifier);
    if (key === 'Meta') key = "Command";
    if (key === ' ') key = "Space";
    if (keyEvt.keyCode === this.KEY_BACKSPACE) key = "Backspace";
    return key;
  },

  pressedKeyString(domEvt, options) {
    // returns a human readable presentation of the keys pressed in the
    // event like Shift-Alt-X
    // options: {
    //   ignoreModifiersIfNoCombo: Bool, // if true don't print single mod like "Alt"
    //   ignoreKeys: Array // list of strings -- key(combos) to ignore
    // }
    options = options || {};
    if (domEvt.keyIdentifier === undefined) {
      var id = this.manualKeyIdentifierLookup(domEvt);
      if (options.ignoreModifiersIfNoCombo
       && [16,17,18,91,93,224].includes(domEvt.keyCode)
       && !id.includes('-')) return "";
      if (options.ignoreKeys && options.ignoreKeys.includes(id)) return '';
      return id;
    }
    var keyParts = [];
    // modifiers
    if (domEvt.metaKey || domEvt.keyIdentifier === 'Meta') keyParts.push('Command');
    if (this.isCtrlDown(domEvt)) keyParts.push('Control');
    if (this.isAltDown(domEvt)) keyParts.push('Alt');
    if (this.isShiftDown(domEvt)) keyParts.push('Shift');
    // key
    var id;
    if (domEvt.keyCode === this.KEY_TAB) id = 'Tab';
    else if (domEvt.keyCode === this.KEY_ESC) id = 'Esc';
    else if (domEvt.keyCode === this.KEY_DELETE) id = 'Del';
    else id = this.decodeKeyIdentifier(domEvt);
    if (options.ignoreModifiersIfNoCombo) {
      if (keyParts.length >= 1 && keyParts.includes(id)) return '';
    };
    keyParts.push(id);
    var result = arr.uniq(arr.compact(keyParts)).join('-');
    if (options.ignoreKeys && options.ignoreKeys.includes(result)) return '';
    return result;
  }
}


class DOMKeyInputHelper {

  constructor(eventDispatcher) {
    this.eventDispatcher = eventDispatcher;
    this.rootNode = null;
    this.textareaNode = null;
    this.handlerFunctions = [];
    this.isInstalled = false;
  }

  install(rootNode) {
    if (this.isInstalled) {
      if (this.rootNode === rootNode) return;
      this.uninstall();
    }

    this.isInstalled = true;
    this.rootNode = rootNode;

    rootNode.tabIndex = 1; // focusable so that we can relay the focus to the textarea

    var focusSpec = {type: "focus", node: rootNode, fn: evt => this.textareaNode.focus(), capturing: true}
    this.handlerFunctions.push(focusSpec);
    rootNode.addEventListener(focusSpec.type, focusSpec.fn, focusSpec.capturing);

    // var blurSpec = {type: "blur", node: domNode, fn: evt => evt => domNode.focus(), capturing: true}
    // this.handlerFunctions.push(blurSpec);
    // domNode.addEventListener(blurSpec.type, blurSpec.fn, blurSpec.capturing);

    var doc = rootNode.ownerDocument,
        textareaNode = this.textareaNode = doc.createElement("textarea");
    textareaNode.style = `
      position: absolute;
      width: 0px; height: 0px;
      z-index: 0;
      opacity: 0;
      background: transparent;
      -moz-appearance: none;
      appearance: none;
      border: none;
      resize: none;
      outline: none;
      overflow: hidden;
      font: inherit;
      padding: 0 1px;
      margin: 0 -1px;
      text-indent: -1em;
      -ms-user-select: text;
      -moz-user-select: text;
      -webkit-user-select: text;
      user-select: text;
      /*with pre-line chrome inserts &nbsp; instead of space*/
      white-space: pre!important;`;

    if (bowser.tablet || bowser.mobile)
      textareaNode.setAttribute("x-palm-disable-auto-cap", true);

    textareaNode.setAttribute("wrap", "off");
    textareaNode.setAttribute("autocorrect", "off");
    textareaNode.setAttribute("autocapitalize", "off");
    textareaNode.setAttribute("spellcheck", false);
    textareaNode.value = "";
    rootNode.insertBefore(textareaNode, rootNode.firstChild);

    return this;
  }

  uninstall() {
    this.isInstalled = false;

    this.handlerFunctions.forEach(({node, type, fn, capturing}) =>
      node.removeEventListener(type, fn, capturing));

    var n = this.textareaNode;
    n && n.parentNode && n.parentNode.removeChild(n)
    this.rootNode = null;

    return this;
  }

  focus() { this.textareaNode && this.textareaNode.focus(); }
  blur() { this.textareaNode && this.textareaNode.blur(); }
  onKeyDown(evt) { return this.eventDispatcher.dispatchDOMEvent(evt); }
  onKeyUp(evt) { return this.eventDispatcher.dispatchDOMEvent(evt); }
  onInput(evt) { return this.eventDispatcher.dispatchDOMEvent(evt); }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Event objects
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class SimulatedDOMEvent {

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

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// dispatcher: mapping DOM events to morph, invoking morph
// event handling methods
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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

export class EventDispatcher {

  constructor(domEventEmitter, world) {
    this.activations = 0;
    this.emitter = domEventEmitter;
    this.keyInputHelper = null;
    this.world = world;
    this.installed = false;
    this.handlerFunctions = [];

    // A place where info about previous events can be stored, e.g. for tracking
    // what was clicked on
    this.eventState = {
      focusedMorph: null,
      clickedOnPosition: null,
      clickedOnMorph: null,
      draggedMorph: null,
      dragDelta: null,
      lastDragPosition: null,
      hover: {hoveredOverMorphs: [], unresolvedPointerOut: false},
    };
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
    var { emitter } = this;

    domEventsWeListenTo.forEach(({type, capturing}) => {
      let fn = evt => this.dispatchDOMEvent(evt);
      this.handlerFunctions.push({node: emitter, type, fn, capturing});
      emitter.addEventListener(type, fn, capturing);
    });

    this.keyInputHelper = new DOMKeyInputHelper(this).install(rootNode);

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

    var type = domEvt.type,
        state = this.eventState,
        eventTargets = [targetMorph].concat(targetMorph.ownerChain()),
        hand = domEvt.pointerId ? this.world.handForPointerId(domEvt.pointerId) : null,
        halo = domEvt.pointerId ? this.world.haloForPointerId(domEvt.pointerId) : null,
        layoutHalo = domEvt.pointerId ? this.world.layoutHaloForPointerId(domEvt.pointerId) : null,
        defaultEvent = new Event(type, domEvt, this, eventTargets, hand, halo, layoutHalo),
        events = [defaultEvent],
        later = [];


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
        });
        break;


      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      case "pointerup":
        defaultEvent.onDispatch(() => state.clickedOnMorph = null);

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

    }

    return {events, later};
  }

  schedule(evt) {
    this.activations++;
    return Promise.resolve()
      .then(() => this.dispatchEvent(evt))
      .then(() => this.activations--, err => { this.activations--; throw err; })
  }

  dispatchEvent(evt) {
    var method = typeToMethodMap[evt.type], err;
    if (!method)
      throw new Error(`dispatchEvent: ${evt.type} not yet supported!`);

    evt.onDispatchCallbacks.forEach(ea => ea());
    this.activations++;
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

  dispatchDOMEvent(domEvt) {
    var targetMorph;
    if (focusTargetingEvents.includes(domEvt.type)) {
      targetMorph = this.eventState.focusedMorph || this.world;
    } else {
      var targetNode = domEvt.target,
          targetId = targetNode.id;
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
    events.forEach(evt => this.dispatchEvent(evt));
  }

  simulateDOMEvents(...eventSpecs) {
    var doc = (this.emitter.document || this.emitter.ownerDocument);
    for (let spec of eventSpecs) {
      let {target, position, type} = spec;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // find the target..

      // keyboard events always go to the keyInput textarea node
      if (focusTargetingEvents.includes(type)) {
        if (!this.keyInputHelper.textareaNode)
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
        var {offsetLeft, offsetTop} = cumulativeOffset(doc.getElementById(this.world.id));
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

}
