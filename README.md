# lively.keyboard

- capturing DOM key, input, composition and clipboard events
- mapping that to human readable event specs (e.g. via `Keys.canonicalizeEvent(evt)`)
- command handler that maps key specs like `Ctrl-A` to executable command objects (`{name, exec}`).

## Key bindings + commands

Example spec for bindings:

An object that should act as a target for key events can implement properties (or getters) for `keybindings` and `commands`:

```js
let obj = {
  // ...
  get keybindings() {
    return [
      {keys: {mac: "Meta-A|Ctrl-X H", win: "Ctrl-A|Ctrl-X H"}, command: "select all"}
    ];
  },

  get commands() {
    return [
      {
        name: "select all",
        doc: "Selects entire text contents.",
        scrollCursorIntoView: false,
        multiSelectAction: "single",
        exec: function(obj, args, count, evt) {/*magic happens here*/}
      }
    ];
  }
};
```

The [CommandTrait](https://github.com/LivelyKernel/lively.keyboard/blob/master/CommandTrait.js) and [KeyBindingsTrait](https://github.com/LivelyKernel/lively.keyboard/blob/master/KeyBindingsTrait.js) will then provide a) an interface to run those commands programmatically (`obj.execCommand`) and b) list supported commands, c) lookup keybindings given a command name, d) simulate key inputs.

## Event integration

Keyboard relevant DOM events are:

- `keydown`
- `keyup`
- `input`
- `compositionupdate`
- `compositionend`
- `compositionstart`
- `copy`, `cut`, `paste`

Those will be bound by [`DOMInputCapture`](https://github.com/LivelyKernel/lively.keyboard/blob/master/dom-input-capture.js), composed to be used with the KeyHandler mentioned above and then mapped via an event dispatcher object to the real event target.

An event integration can look like this:

```js
let methodMap = {
  keydown: "onKeyDown",
  keyup: "onKeyUp",
  input: "onTextInput",
  copy: "onCopy",
  cut: "onCut",
  paste: "onPaste",
}

let eventDispatcher = {
  dispatchDOMEvent: evt => {
    tScene.pointerEvent.event2D = evt;

    let target = tScene.keyboardTObject || tScene,
        method = methodMap[evt.type];

    // invokes onXXX handler method of target tObject.
    // if the return value is truthy than stop event dispatch
    // otherwise, bubble up the parent chain
    while (target) {
      if (typeof target[method] !== "function") {
        tScene.logError(`${target} does not have method ${method}!`);
      }
      try {
        let result = target[method](tScene.pointerEvent);
        if (result) { evt.stopPropagation(); return; }
        target = target.parent;
      } catch (err) {
        console.error(`Error in event handler ${target}.${method}:`, err);
        return;
      }
    }
    console.warn(`Unhandled event: ${evt.type}`);
  }
};

tScene.domInputCapture = new lively.keyboard.DOMInputCapture(eventDispatcher);
tScene.domInputCapture.install(document.body);
```

## License

[MIT](LICENSE)