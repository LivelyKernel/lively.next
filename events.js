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


function cumulativeOffset(element) {
  var top = 0, left = 0;
  do {
    top += element.offsetTop  || 0;
    left += element.offsetLeft || 0;
    element = element.offsetParent;
  } while(element);
  return {offsetLeft: left, offsetTop: top};
}

var Keys = {

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
          shifted = domEvt.isShiftDown(),
          ctrl = domEvt.isCtrlDown(),
          cmd = domEvt.isCommandKey(),
          alt = domEvt.isAltDown();
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
    if (keyEvt.keyCode === Event.KEY_BACKSPACE) key = "Backspace";
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
       && [16,17,18,91,93,224].include(domEvt.keyCode)
       && !id.include('-')) return "";
      if (options.ignoreKeys && options.ignoreKeys.include(id)) return '';
      return id;
    }
    var keyParts = [];
    // modifiers
    if (domEvt.metaKey || domEvt.keyIdentifier === 'Meta') keyParts.push('Command');
    if (domEvt.isCtrlDown()) keyParts.push('Control');
    if (domEvt.isAltDown()) keyParts.push('Alt');
    if (domEvt.isShiftDown()) keyParts.push('Shift');
    // key
    var id;
    if (domEvt.keyCode === Event.KEY_TAB) id = 'Tab';
    else if (domEvt.keyCode === Event.KEY_ESC) id = 'Esc';
    else if (domEvt.keyCode === Event.KEY_DELETE) id = 'Del';
    else id = this.decodeKeyIdentifier(domEvt);
    if (options.ignoreModifiersIfNoCombo) {
      if (keyParts.length >= 1 && keyParts.include(id)) return '';
    };
    keyParts.push(id);
    var result = keyParts.compact().uniq().join('-');
    if (options.ignoreKeys && options.ignoreKeys.include(result)) return '';
    return result;
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Event object
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class Event {

  constructor(type, domEvt, dispatcher, targetMorphs, hand, halo) {
    this.type = type;
    this.domEvt = domEvt;
    this.dispatcher = dispatcher;
    this.targetMorphs = targetMorphs;
    this.hand = hand;
    this.halo = halo;
    this.stopped = false;
    this.onAfterDispatchCallbacks = [];
    this.onStopCallbacks = [];
  }

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
    this.domEvt.stopPropagation();
    this.domEvt.preventDefault();
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

  isCommandKey() { return Keys.isCommandKey(this.domEvt); }
  isShiftDown() { return Keys.isShiftDown(this.domEvt); }
  isCtrlDown() {return Keys.isCtrlDown(this.domEvt);}
  isAltDown() { return Keys.isAltDown(this.domEvt); }

}

function dragStartEvent(domEvt, dispatcher, targetMorph, state, hand, halo) {
  var evt = new Event("dragstart", domEvt, dispatcher, [targetMorph], hand, halo)
    .onStop(() => {
      state.draggedMorph = null;
      dispatcher.schedule(dragEndEvent(domEvt, dispatcher, state, hand, halo));
    });
  state.draggedMorph = targetMorph;
  state.lastDragPosition = evt.position;
  state.dragDelta = pt(0,0);
  return evt;
}

function dragEvent(domEvt, dispatcher, targetMorph, state, hand, halo) {
  var evt = new Event("drag", domEvt, dispatcher, [state.draggedMorph], hand, halo)
    .onAfterDispatch(() => state.lastDragPosition = evt.position)
    .onStop(() => {
      state.draggedMorph = null;
      dispatcher.schedule(dragEndEvent(domEvt, dispatcher, state, hand, halo));
    })
  state.dragDelta = evt.position.subPt(state.lastDragPosition);
  return evt;
}

function dragEndEvent(domEvt, dispatcher, targetMorph, state, hand, halo) {
  var evt = new Event("dragend", domEvt, dispatcher, [state.draggedMorph], hand, halo)
    .onAfterDispatch(() => {
      state.draggedMorph = null;
      state.lastDragPosition = null;
    });
  state.dragDelta = evt.position.subPt(state.lastDragPosition);
  return evt;
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
        events.push(dragEndEvent(domEvt, this, targetMorph, state, hand, halo));
        defaultEvent.targetMorphs = [this.world];

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
        defaultEvent.targetMorphs = [this.world];
        events.push(dragEvent(domEvt, this, targetMorph, state, hand, halo));

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
            events.push(dragStartEvent(domEvt, this, targetMorph, state, hand, halo));
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

    if (!method)
      throw new Error(`dispatchEvent: ${evt.type} not yet supported!`);

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
    evt.onAfterDispatchCallbacks.forEach(ea => ea());
    if (err) throw err;
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
