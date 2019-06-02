// import { getCompletions } from "lively.vm/lib/completions.js";
// window.events.pointerdown
// 
// async function printProperties(obj) {
//   var {completions} = await getCompletions(() => obj, "")
//   
//   var report = ""
//   for (let [protoName, properties] of completions) {
//     report += protoName + "\n";
//     report += "  " + properties.join("\n  ");
//     report += "\n";
//   }
//   return report
// }
// 
// await printProperties(window.events.pointerdown)


// var eventTypes = [
//   "scroll",
//   "keyup",
//   "keydown",
//   "copy",
//   "pointerover",
//   "pointermove",
//   "pointerout",
//   "pointerdown",
//   "pointerup",
//   "paste",
//   "input",
//   "wheel",
//   "cut"
// ]

var eventProperties = [
  // InputEvent
  "data",

  // KeyboardEvent
  "altKey",
  "charCode",
  "code",
  "ctrlKey",
  "key",
  "keyCode",
  "location",
  "metaKey",
  "repeat",
  "shiftKey",
  "which",

  // ClipboardEvent
  "clipboardData",

  // WheelEvent
  "deltaMode",
  "deltaX",
  "deltaY",
  "deltaZ",
  "wheelDelta",
  "wheelDeltaX",
  "wheelDeltaY",

  // PointerEvent
  "height",
  "isPrimary",
  "pointerId",
  "pointerType",
  "pressure",
  "tiltX",
  "tiltY",
  "width",

  // MouseEvent
  "altKey",
  "button",
  "buttons",
  "clientX",
  "clientY",
  "ctrlKey",
  "fromElement",
  "layerX",
  "layerY",
  "metaKey",
  "movementX",
  "movementY",
  "offsetX",
  "offsetY",
  "pageX",
  "pageY",
  "screenX",
  "screenY",
  "shiftKey",
  "which",
  "x",
  "y",

  // Event
  // "target",
  "timeStamp",
  "type"
]

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

const focusTargetingEvents = [
  "keydown", "keyup", "keypress",
  "input", "compositionstart", "compositionupdate", "compositionend",
  "cut", "copy", "paste",
];

const textOnlyEvents = [
  "input", "compositionstart", "compositionupdate", "compositionend"
]


export default class EventCollector {

  constructor(domEventEmitter, world) {
    this.installed = false;
    this.emitter = domEventEmitter;
    this.keyInputHelper = null;
    this.handlerFunctions = [];
    this.collectedEvents = [];
  }

  install() {
    if (this.installed) return this;
    this.installed = true;
    var { emitter } = this,
        globalEmitter = System.global/*FIXME?*/;

    domEventsWeListenTo.forEach(({type, capturing}) => {
      let fn = evt => this.collectDOMEvent(evt);
      this.handlerFunctions.push({node: emitter, type, fn, capturing});
      emitter.addEventListener(type, fn, capturing);
    });

    // globalEmitter.addEventListener && globalDomEventsWeListenTo.forEach(({type, capturing, morphMethod}) => {
    //   let fn = evt => this.collectDOMEvent(evt, this.world, morphMethod);
    //   this.handlerFunctions.push({node: globalEmitter, type, fn, capturing});
    //   globalEmitter.addEventListener(type, fn, capturing);
    // });

    // this.keyInputHelper = new TextInput(this).install(rootNode);

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
  

  collectDOMEvent(domEvt) {

    domEvt.preventDefault();
    domEvt.stopPropagation();

    var eventSpec = {};
    for (var i = 0; i < eventProperties.length; i++) {
      var p = eventProperties[i];
      if (p in domEvt) eventSpec[p] = domEvt[p];
    }

    if (domEvt.target) {
      var targetNode = domEvt.target;
      while (true) {
        var cssClasses = targetNode.className || "";
        if (typeof cssClasses !== "string" && "baseVal" in cssClasses/*svg*/)
          cssClasses = cssClasses.baseVal;
        // Maybe better "is-morph-node" test?
        if (cssClasses && cssClasses.includes("Morph")) break;
        if (!(targetNode = targetNode.parentNode)) return;
      }
      if (targetNode)
        eventSpec.target = targetNode.getAttribute("id");
    }

    this.collectedEvents.push(eventSpec);
  }

}
