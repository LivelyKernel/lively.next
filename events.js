import { pt } from "lively.graphics";

const typeToMethodMap = {
  'pointerdown': "onMouseDown",
  'pointerup': "onMouseUp",
  'pointermove': "onMouseMove"
}

// A place where info about previous events can be stored, e.g. for tracking
// what was clicked on

const eventStatesPerWorld = new WeakMap();

class Event {

  constructor(domEvt, world, eventState) {
    this.domEvt = domEvt;
    this.world = world;
    this.eventState = eventState;
    this.type = domEvt.type;
    this.hand = this.ensureHand();
  }

  ensureHand() {
    return this.domEvt.pointerId ?
      this.world.handForPointerId(this.domEvt.pointerId) :
      null;
  }

  get targetMorph() {}

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
    var pos = pt(this.domEvt.pageX || 0, this.domEvt.pageY || 0);
    pos = pos.scaleBy(1 / this.world.scale);
    return pos;
  }

  positionIn(aMorph) {
    // returns the event position localized to aMorph
    return aMorph.localize(this.position);
  }

        // evt.hand = world ?
        //         evtHand || world.hands.find(function(hand) { return !hand.pointerId }) || world.firstHand() :
        //         undefined;
        // evt.getPositionIn = function(aMorph) {
        //     // returns the event position localized to aMorph
        //     return aMorph.localize(this.getPosition());
        // };
        // evt.mousePoint = evt.mousePoint
        //               || pt(evt.pageX || 0, evt.pageY || 0);
        // return evt;


  // evt.isLeftMouseButtonDown = function() { return Event.MOUSE_LEFT_DETECTOR(evt) };
  // evt.isMiddleMouseButtonDown = function() { return Event.MOUSE_MIDDLE_DETECTOR(evt) };
  // evt.isRightMouseButtonDown = function() { return Event.MOUSE_RIGHT_DETECTOR(evt) };

  // evt.isCommandKey = function() {
  //     // this is LK convention, not the content of the event
  //     var isCmd = false;
  //     if (Config.useAltAsCommand)
  //         isCmd = isCmd || evt.altKey;
  //     if (UserAgent.isWindows || UserAgent.isLinux )
  //         isCmd = isCmd || evt.ctrlKey;
  //     if (UserAgent.isOpera) // Opera recognizes cmd as ctrl!!?
  //         isCmd = isCmd || evt.ctrlKey;
  //     if (UserAgent.isMobile)
  //         isCmd = isCmd || lively.morphic.World.current().isCommandButtonPressed();
  //     return isCmd || evt.metaKey || evt.keyIdentifier === 'Meta';
  // };

        // evt.isShiftDown = function() { return !!evt.shiftKey };
        // evt.isCtrlDown = function() { return !!evt.ctrlKey };
        // evt.isAltDown = function() { return !!evt.altKey };
        // evt.stop = evt.stop || function() {
        //     evt.isStopped = true;
        //     evt.stopPropagation();
        //     evt.preventDefault();
        // };

        // evt.getKeyChar = function() {
        //     if (evt.type == "keypress") { // rk what's the reason for this test?
        //         var id = evt.charCode || evt.which;
        //         if (id > 63000) return ""; // Old Safari sends weird key char codes
        //         return id ? String.fromCharCode(id) : "";
        //     } else  {
        //         var code = evt.which;
        //         return code && String.fromCharCode(code);
        //     }
        // }

        // evt.getKeyCode = function() { return evt.keyCode }

        // evt.getKeyString = function(options) {
        //     return Event.pressedKeyString(evt, options);
        // }

        // evt.isMouseEvent = evt.type === Global.Event.INPUT_TYPE_DOWN || evt.type === Global.Event.INPUT_TYPE_UP || evt.type === Global.Event.INPUT_TYPE_MOVE || evt.type === Global.Event.INPUT_TYPE_OVER || evt.type === 'click' || evt.type === 'dblclick' || evt.type === 'selectstart' || evt.type === 'contextmenu' || evt.type === 'mousewheel';

        // evt.isKeyboardEvent = !evt.isMouseEvent && (evt.type === 'keydown' || evt.type === 'keyup' || evt.type === 'keypress');

        // evt.isArrowKey = function() {
        //     if (evt.isKeyboardEvent) {
        //         var c = evt.getKeyCode();
        //         return (c === Event.KEY_LEFT)
        //             || (c === Event.KEY_RIGHT)
        //             || (c === Event.KEY_UP)
        //             || (c === Event.KEY_DOWN);
        //     }
        //     return false
        // }

        // evt.isInBoundsOf = function(morph) {
        //     return morph.innerBounds().containsPoint(evt.getPositionIn(morph));
        // }

        // var world = lively.morphic.World.current();
        // evt.world = world;

        // var evtHand = world.hands.find(function(hand) { return hand.pointerId === evt.pointerId});
        // evt.hand = world ?
        //         evtHand || world.hands.find(function(hand) { return !hand.pointerId }) || world.firstHand() :
        //         undefined;
        // evt.getPosition = function() {
        //     if (!evt.scaledPos) {
        //         evt.scaledPos = evt.mousePoint.scaleBy(1 / evt.world.getScale());
        //     }
        //     return evt.scaledPos;
        // };
        // evt.getPositionIn = function(aMorph) {
        //     // returns the event position localized to aMorph
        //     return aMorph.localize(this.getPosition());
        // };
        // evt.mousePoint = evt.mousePoint
        //               || pt(evt.pageX || 0, evt.pageY || 0);
        // return evt;
    
}


export class EventDispatcher {

  constructor(domEventEmitter, world) {
    this.emitter = domEventEmitter;
    this.world = world;
    this.installed = false;
    this.handlerFunctions = {};
  }

  install() {
    if (this.installed) return this;
    this.installed = true;
    Object.keys(typeToMethodMap).forEach(type => {
      this.emitter.addEventListener(
        type, this.handlerFunctions[type] = evt => this.dispatchEvent(evt))
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

  dispatchEvent(domEvt) {
    var { type, target } = domEvt,
        targetId = target.id,
        targetMorph = this.world.withAllSubmorphsDetect(sub => sub.id === targetId),
        method = typeToMethodMap[type];

    if (!targetMorph) return;
  
    var evtState = eventStatesPerWorld.get(this.world) || eventStatesPerWorld.set(this.world, evtState = {}),
        evt = new Event(domEvt, this.world, evtState);
  
    if (method) {
      var eventTargets = [targetMorph].concat(targetMorph.ownerChain()).reverse();
      for (var i = 0; i < eventTargets.length; i++) {
        var morph = eventTargets[i];
        morph[method](evt);
      }
    } else {
      throw new Error(`dispatchEvent: ${type} nt yet supported!`)
    }
  }

}
