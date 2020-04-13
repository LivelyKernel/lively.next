/*global System,WeakMap,FormData,fetch,DOMParser,XMLHttpRequest*/
import { resource } from "lively.resources";
import { Rectangle, Color, pt } from "lively.graphics";
import { arr, fun, obj, promise } from "lively.lang";
import { once } from "lively.bindings";
import {
  GridLayout, Morph,
  VerticalLayout,
  HorizontalLayout,
  ProportionalLayout,
  Tooltip,
  Image,
  inspect,
  config,
  World
} from "lively.morphic";

import { loadMorphFromSnapshot } from "lively.morphic/serialization.js";
import { loadObjectFromPartsbinFolder } from "lively.morphic/partsbin.js";
import { uploadFile } from "lively.morphic/events/html-drop-handler.js";

import {
  InformPrompt,
  ConfirmPrompt,
  MultipleChoicePrompt,
  TextPrompt,
  EditPrompt,
  PasswordPrompt,
  ListPrompt,
  EditListPrompt
} from "lively.components/prompts.js";

import LoadingIndicator from "lively.components/loading-indicator.js";
import { Halo, MorphHighlighter, StatusMessage, StatusMessageForMorph, ProportionalLayoutHalo, GridLayoutHalo, FlexLayoutHalo  } from 'lively.halos';
import { Window, List, FilterableList, Menu } from "lively.components";

import worldCommands from "./world-commands.js";
import { GradientEditor } from "./styling/gradient-editor.js";

export class LivelyWorld extends World {

  static get properties() {
    return {

      styleSheets: {
        initialize() {
          this.styleSheets = arr.compact([
            StatusMessage,
            GradientEditor,
            Window,
            FilterableList,
            List,
            LoadingIndicator,
            Tooltip
          ].map(klass => klass && klass.styleSheet).concat(Window && Window.nodeStyleSheet));
        }
      }

    };
  }

  activeWindow() { return this.getWindows().reverse().find(ea => ea.isActive()); }
  getWindows() { return this.submorphs.filter(ea => ea.isWindow); }

  activePrompt() { return this.getPrompts().reverse().find(ea => ea.isActive()); }
  getPrompts() { return this.submorphs.filter(ea => ea.isPrompt); }

  openInWindow(morph, opts = {title: morph.name, name: "window for " + morph.name}) {
    let win = new Window({
      ...opts,
      extent: morph.extent.addXY(0, 25),
      targetMorph: morph
    }).openInWorld();
    win.ensureNotOverTheTop();
    return win;
  }

  onMouseDown(evt) {
    var target = evt.state.clickedOnMorph,
        isCommandKey = evt.isCommandKey(),
        isShiftKey = evt.isShiftDown(),
        activeWindow = this.activeWindow();

    if (activeWindow && target == this) activeWindow.deactivate();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // halo activation + removal
    // note that the logic for cycling halos from morph to underlying morph is
    // implemented in Halo>>onMouseDown
    var haloTarget;
    if (isCommandKey && !target.isHalo) {
      var morphsBelow = evt.world.morphsContainingPoint(evt.position),
          morphsBelowTarget = morphsBelow;
      morphsBelow = morphsBelow.filter(ea => ea.halosEnabled);
      morphsBelowTarget = morphsBelowTarget.filter(ea => ea.halosEnabled);
      haloTarget = morphsBelowTarget[0] || morphsBelow[0];
    }
    if (isShiftKey && !target.isHaloItem && haloTarget &&
         evt.halo && evt.halo.borderBox != haloTarget) {
       evt.halo.addMorphToSelection(haloTarget);
       return;
    }
    var removeHalo = evt.halo && !evt.targetMorphs.find(morph => morph.isHaloItem),
        removeLayoutHalo = evt.layoutHalo && !evt.targetMorphs.find(morph => morph.isHaloItem),
        addHalo = (!evt.halo || removeHalo) && haloTarget;
    if (removeLayoutHalo) evt.layoutHalo.remove();
    if (removeHalo) evt.halo.remove();
    if (addHalo) { evt.stop(); this.showHaloFor(haloTarget, evt.domEvt.pointerId); return; }
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    if (evt.state.menu) evt.state.menu.remove();

    this._tooltipViewer.mouseDown(evt);
  }

  onMouseUp(evt) {
    if (evt.isCommandKey()/* || evt.isShiftDown()*/) evt.stop();
    if (evt.isAltDown() && config.altClickDefinesThat) {
      var target = this.morphsContainingPoint(evt.position)[0];
      // FIXME currently delayed to overwrite that in old morphic
      setTimeout(() => System.global.that = target, 100);
      target.show();
      evt.stop();
      console.log(`Set global "that" to ${target}`);
      return;
    }
  }

  onLongClick(evt) {
    var target = evt.state.prevClick.clickedOnMorph;
    var haloTarget;

    var morphsBelow = evt.world.morphsContainingPoint(evt.position),
        morphsBelowTarget = morphsBelow.slice(morphsBelow.indexOf(target));
    morphsBelow = morphsBelow.filter(ea => ea.halosEnabled);
    morphsBelowTarget = morphsBelowTarget.filter(ea => ea.halosEnabled);
    haloTarget = morphsBelowTarget[0] || morphsBelow[0];

    var removeHalo = evt.halo && !evt.targetMorphs.find(morph => morph.isHaloItem),
        removeLayoutHalo = evt.layoutHalo && !evt.targetMorphs.find(morph => morph.isHaloItem),
        addHalo = (!evt.halo || removeHalo) && haloTarget;
    if (removeLayoutHalo) evt.layoutHalo.remove();
    if (removeHalo) evt.halo.remove();
    if (addHalo) { evt.stop(); this.showHaloFor(haloTarget, evt.domEvt.pointerId); return; }
  }

  onDragStart(evt) {
     if (evt.leftMouseButtonPressed()) {
       this.selectionStartPos = evt.positionIn(this);
       this.morphSelection = this.addMorph({
          type: Selection,
          epiMorph: true,
          position: this.selectionStartPos,
          extent: evt.state.dragDelta,
       });
       this.selectedMorphs = {};
     }
  }

  onDrag(evt) {
    if (this.morphSelection) {
      const selectionBounds = Rectangle.fromAny(evt.position, this.selectionStartPos)
       this.morphSelection.setBounds(selectionBounds);
       this.submorphs.forEach(c => {
           if (c.isSelectionElement || c.isHand) return;
           const candidateBounds = c.bounds(),
                 included = selectionBounds.containsRect(candidateBounds);

           if (!this.selectedMorphs[c.id] && included) {
              this.selectedMorphs[c.id] = this.addMorph({
                  type: SelectionElement, 
                  bounds: candidateBounds
              }, this.morphSelection);
           }
           if (this.selectedMorphs[c.id] && !included) {
              this.selectedMorphs[c.id].remove();
              delete this.selectedMorphs[c.id];
           }
       })
    }
  }

  onDragEnd(evt) {
     if (this.morphSelection) {
       this.morphSelection.fadeOut(200);
       obj.values(this.selectedMorphs).map(m => m.remove());
       this.showHaloForSelection(
         Object.keys(this.selectedMorphs)
               .map(id => this.getMorphWithId(id))
       );
       this.selectedMorphs = {};
       this.morphSelection = null;
     }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // html5 drag - drop

  async nativeDrop_ensureUploadIndicator() {
    if (!this._cachedDragIndicator)
      this._cachedDragIndicator = loadObjectFromPartsbinFolder("upload-indicator");
    let i = await this._cachedDragIndicator;
    if (!i.world()) i.openInWorld();
    fun.debounceNamed("remove-upload-indicator", 1000, () => {
      this.nativeDrop_removeUploadIndicator();
    })();
  }

  nativeDrop_removeUploadIndicator() {
    if (this._cachedDragIndicator)
      this._cachedDragIndicator.then(i => i.remove());
  }

  onNativeDragover(evt) {
    if (evt.targetMorph === this)
      this.nativeDrop_ensureUploadIndicator();
  }

  async onNativeDrop(evt) {
    /*global show, inspect*/
    this.nativeDrop_removeUploadIndicator();
    if (evt.targetMorph != this) return;

    let {domEvt} = evt,
        {files, items} = domEvt.dataTransfer,
        baseURL = document.location.origin;

    if (files.length) {
      let user = this.getCurrentUser(),
          uploadPath = user.isGuestUser ? "uploads/" : "users/" + $world.getCurrentUser().name + "/uploads";
      if (evt.isAltDown()) {
        uploadPath = await this.prompt("Choose upload location", {
          history: "lively.morphic-html-drop-file-upload-location",
          input: uploadPath
        });
        if (!uploadPath) return this.setStatusMessage("Canceled upload");
      }

      let really = await this.confirm(
        `Upload ${files.length} file${files.length > 1 ? "s": ""}?`);

      if (!really) return;

      let fd = new FormData()
      for (let i = 0; i < files.length; i++)
        fd.append('file', files[i], files[i].name);

      let res, answer, ld = LoadingIndicator.open('Uploading File');
      try {
        let headers = {};
        let onProgress = (evt) => {
          // set progress of loading indicator
          let p = evt.loaded / evt.total;
          ld.progress = p;
          ld.status = 'Uploaded ' + (100 * p).toFixed() + '%';
        };
        if (!user.isGuestUser) headers["Authorization"] = `Bearer ${user.token}`;
        res = resource(System.baseURL, { headers, onProgress, onLoad: (res) => answer = res });
        res = res.join(`/upload?uploadPath=${encodeURIComponent(uploadPath)}`);
        await res.write(fd);
      } catch (err) {
        return this.showError(`Upload failed: ${err.message}\n`);
      }

      ld.remove();

      try {

        this.setStatusMessage(`Uploaded ${answer.uploadedFiles.length} file`)

        let files = answer.uploadedFiles.map(ea => {
          let res = resource(baseURL).join(ea.path);
          return {
            ...ea,
            url: res.url,
            name: res.name()
          }
        });
        let images = [], videos = [], others = [];
        for (let f of files) {
          if (f.type.startsWith("image/")) images.push(f);
          else if (f.type.startsWith("video")) videos.push(f);
          else others.push(f);
        }
        if (videos.length) {
          for (let v of videos) {
            let video = Object.assign(await loadObjectFromPartsbinFolder("video morph"), {
              videoURL: v.url,
              name: v.name
            }).openInWorld();
          }
        }
        if (images.length) {
          let openImages = true;
          // let openImages = await this.confirm(
          //   images.length > 1 ?
          //     `There were ${images.length} images uploaded. Open them?` :
          //     `There was 1 image uploaded. Open it?`);
          if (openImages) {
            images.forEach(ea => {
              let img = new Image({
                imageUrl: ea.url,
                autoResize: true,
                name: ea.name
              });
              img.whenLoaded().then(async () => {
                img.extent = img.naturalExtent.scaleBy(.8 * this.visibleBounds().height / img.height);
                img.openInWorld();
                await img.whenRendered();
                img.center = this.visibleBounds().center();
              });
            });
          }
        }
        if (others.length) {
          for (let file of others) {
            let open = await this.confirm(`open file ${file.name} (${file.type})?`);
            if (open) this.execCommand("open file", {url: file.url})
          }
        }
      } catch (err) { this.showError(err); }
      return;
    }

    // show(`
    //   ${domEvt.dataTransfer.files.length}
    //   ${domEvt.dataTransfer.items.length}
    //   ${domEvt.target}
    //   ${domEvt.dataTransfer.types}
    // `)

    let types = domEvt.dataTransfer.types;
    if (types.includes("text/html")) {
      let html = domEvt.dataTransfer.getData("text/html"),
          parsed = new DOMParser().parseFromString(html, "text/html"),
          imgs = parsed.querySelectorAll("img");
      // is it a dropped image?
      if (imgs.length === 1 && imgs[0].src && types.includes("text/uri-list")) {
        let url = imgs[0].src;
        let img = new Image({
          imageUrl: url,
          autoResize: true,
          name: arr.last(url.split("/"))
        });
        img.whenLoaded().then(() => img.openInWorld());
      } else {
        Object.assign(await loadObjectFromPartsbinFolder("html-morph"), {html})
          .openInWorld();
      }
      return;
    }

    for (let i = 0; i < domEvt.dataTransfer.items.length; i++) {
      let item = domEvt.dataTransfer.items[i];
      // console.log(`${item.kind} - ${item.type}`)
      if (item.kind === "file") {
        let f = item.getAsFile();
        let upload = await this.confirm(`Upload ${f.name}?`);
        if (upload) {
          let uploadedMorph = await uploadFile(f, f.type);
          uploadedMorph && uploadedMorph.openInWorld();
          uploadedMorph.center = this.visibleBounds().center();
        }
      } else if (item.kind === "string") {
        // show({kind: item.kind, type: item.type})
        item.getAsString((s) => inspect(s));
      }
    }
  }

  // file download serving

  serveFileAsDownload(fileString, {fileName = 'file.txt', type = 'text/plain'} = {}) {
    const isDataURL = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;

    var a = window.document.createElement('a');
    a.href = obj.isString(fileString) && !!fileString.match(isDataURL) ? fileString : window.URL.createObjectURL(new Blob([fileString], {type}));
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // menu
  menuItems() {
    return [
      {title: "World menu"},
      {command: "undo",                     target: this},
      {command: "redo",                     target: this},
      {isDivider: true},
      ["Debugging", [
        {command: "delete change history", target: this},
        {command: "fix font metric", target: this},
        {command: "inspect server", target: this}
      ]],
      ["Tools", [
        {command: "open PartsBin",            target: this},
        {command: "open workspace",           target: this},
        {command: "open browser",             target: this},
        {command: "choose and browse module", target: this},
        {command: "open code search",         target: this},
        {command: "open file browser",         target: this},
        {command: "open shell workspace",     target: this}
      ]],
      {isDivider: true},
      {command: "run command",              target: this},
      {command: "select morph",             target: this},
      {command: "window switcher",          target: this},
      ["Resize",
         this.resizePolicy === "static" ? [
          {command: "resize to fit window", target: this},
          {command: "resize manually", target: this},
          ["switch to automatic resizing of world", () => this.resizePolicy = "elastic"]
         ] : [
           ["switch to manual resizing of world", () => this.resizePolicy = "static"]
         ]
      ],
      {command: "report a bug",          target: this},
      {isDivider: true},
      {command: "save world",          target: this},
      {command: "load world",          target: this},
    ];
  }

  openWorldMenu(evt, items) {
    var eventState =  this.env.eventDispatcher.eventState;
    if (eventState.menu) eventState.menu.remove();
    return eventState.menu = items && items.length ?
      Menu.openAtHand(items, {hand: (evt && evt.hand) || this.firstHand}) : null;
  }

  async onPaste(evt) {
    try {
      let data = evt.domEvt.clipboardData;
      if (data.types.includes("application/morphic")) {
        evt.stop();
        let snapshots = JSON.parse(data.getData("application/morphic")),
            morphs = [];
        data.clearData()
        if (!Array.isArray(snapshots)) snapshots = [snapshots];
        for (let s of snapshots) {
          let morph = await loadMorphFromSnapshot(s);
          morph.openInWorld(evt.hand.position);
          if (s.copyMeta && s.copyMeta.offset) {
            let {x,y} = s.copyMeta.offset;
            morph.moveBy(pt(x,y));
          }
          morphs.push(morph);
        }
        this.showHaloFor(morphs);
      }
    } catch (e) {
      this.showError(e)
    }
  }

  get commands() { return worldCommands.concat(super.commands); }
  get keybindings() { return super.keybindings.concat(config.globalKeyBindings); }
  set keybindings(x) { super.keybindings = x }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // halos
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  halos() { return this.submorphs.filter(m => m.isHalo); }

  haloForPointerId(pointerId) {
    return this.submorphs.find(m => m.isHalo && m.state && m.state.pointerId === pointerId);
  }

  showHaloFor(target, pointerId = this.firstHand && this.firstHand.pointerId, focus = true) {
    var halo;
    if (!Halo) return;
    if (typeof target.createHalo === "function") {
      halo = target.createHalo(Halo, pointerId);
    } else {
      halo = new Halo({pointerId, target});
    }
    this.addMorph(halo);
    if (focus) halo.focus();
    halo.alignWithTarget();
    return halo;
  }

  showHaloForSelection(selection, pointerId) {
    return selection.length > 0 && this.showHaloFor(selection, pointerId);
  }

  layoutHaloForPointerId(pointerId = this.firstHand && this.firstHand.pointerId) {
    return this.submorphs.find(m => m.isLayoutHalo && m.state && m.state.pointerId === pointerId);
  }

  showLayoutHaloFor(morph, pointerId = this.firstHand && this.firstHand.pointerId) {
    let world = this,
        ownerInWorld = morph === world ? null :
                                  morph.owner === world ? morph :
                                  morph.ownerChain().slice(-2)[0],
        insertionIndex = ownerInWorld ?
                          world.submorphs.indexOf(ownerInWorld) + 1 :
                          world.submorphs.length;
    let overlay;
    switch (morph.layout.constructor) {
      case ProportionalLayout:
        overlay = new ProportionalLayoutHalo({ container: morph, pointerId});
        break;
      case HorizontalLayout:
      case VerticalLayout:
        overlay = new FlexLayoutHalo({ container: morph, pointerId});
        break;
      case GridLayout:
        overlay = new GridLayoutHalo({ container: this.container, pointerId});
        break;
    }
    return overlay && this.addMorphAt(overlay, insertionIndex);
  }

  highlightMorph(highlightOwner, morph, showLayout = false, highlightedSides = []) {
    return MorphHighlighter.for(highlightOwner, morph, showLayout, highlightedSides);
  }

  removeHighlighters(highlightOwner = this) {
    return MorphHighlighter.removeHighlighters(highlightOwner);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // status messages
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleStatusMessages() {
    return this.submorphs.filter(ea => ea.isStatusMessage)
  }

  visibleStatusMessagesFor(morph) {
    return this.submorphs.filter(ea => ea.isStatusMessage && ea.targetMorph === morph)
  }

  logErrorPreperation(err) {
    var stringified = String(err),
        stack = err.stack || "";
    if (stack && err.message !== err.stack) {
      stack = String(stack);
      var errInStackIdx = stack.indexOf(stringified);
      if (errInStackIdx === 0)
        stack = stack.slice(stringified.length);
      stringified += "\n" + stack;
    }
    return stringified;
  }

  logError(err) {
    this.setStatusMessage(this.logErrorPreperation(err), Color.red);
  }

  showError(err) { return this.logError(err); }

  showErrorFor(morph, err) {
    return this.setStatusMessageFor(morph, this.logErrorPreperation(err), Color.red);
  }

  setStatusMessageFor(morph, message, color, delay = 5000, props) {
    if (!StatusMessageForMorph) return;
    this.visibleStatusMessagesFor(morph).forEach(ea => ea.remove());
    var msgMorph = new StatusMessageForMorph({message, color, ...props});
    this.openStatusMessage(msgMorph, delay);
    msgMorph.targetMorph = morph;
    msgMorph.fadeIn(300);
    if (msgMorph.removeOnTargetMorphChange && morph.isText) {
      once(morph, "selectionChange", msgMorph, "fadeOut", {converter: () => 200});
    }
    return msgMorph;
  }

  setStatusMessage(message, color, delay = 5000, optStyle = {}) {
    if (!StatusMessage) return;
    console[color == Color.red ? "error" : "log"](message);
    return config.verboseLogging ?
      this.openStatusMessage(new StatusMessage({message, color, hasFixedPosition: true, ...optStyle}), delay) :
      null;
  }

  openStatusMessage(statusMessage, delay) {
    this.addMorph(statusMessage);
    if (statusMessage.slidable) {
      var messages = this.visibleStatusMessages();
      for (let m of messages) {
        if (messages.length <= (config.maxStatusMessages || 0)) break;
        if (m.stayOpen || !m.slidable) continue;
        m.remove();
        arr.remove(messages, m);
      }

      arr.without(messages, statusMessage).forEach(async msg => {
        if(!msg.isMaximized && msg.slidable) {
          msg.slideTo(msg.position.addPt(pt(0, -statusMessage.extent.y - 10)))
        }
      });

      const msgPos = this.visibleBounds().bottomRight().addXY(-20, -20);
      statusMessage.align(statusMessage.bounds().bottomRight(), msgPos);
      statusMessage.topRight = msgPos.addPt(pt(0,40));
      statusMessage.animate({bottomRight: msgPos, duration: 500});
    }

    if (typeof delay === "number")
      setTimeout(() => statusMessage.stayOpen || statusMessage.fadeOut(), delay);
    return statusMessage;
  }

  async addProgressBar(opts = {}) {
    let {location = "center"} = opts,
        pBar = await loadObjectFromPartsbinFolder("progress bar");
    Object.assign(pBar, {progress: 0}, obj.dissoc(opts, ["location"]));
    this.addMorph(pBar);
    pBar.align(pBar[location], this.visibleBounds()[location]());
    return pBar;
  }

  async withProgressBarDo(doFn, opts) {
    let pBar = await this.addProgressBar(opts);
    try { return await doFn(pBar); } finally { pBar.remove(); }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // dialogs
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async openPrompt(promptMorph, opts = {requester: null, animated: false}) {
    var focused = this.focusedMorph, visBounds = this.visibleBounds();

    promptMorph.openInWorldNear(
      opts.requester && !opts.requester.isWorld ?
        visBounds.intersection(opts.requester.globalBounds()).center() :
        visBounds.center(), this);

    if (promptMorph.height > visBounds.height)
      promptMorph.height = visBounds.height - 5;

    if (typeof opts.customize === "function")
      opts.customize(promptMorph);

    if (opts.animated) {
      if (this.previousPrompt && this.previousPrompt.world()) {
        this.previousPrompt.transitionTo(promptMorph);
      }
    }
    this.previousPrompt = promptMorph;
    return promise.finally(promptMorph.activate(opts), () => focused && focused.focus());
  }

  async withRequesterDo(requester, doFn) {
     let win, pos = this.visibleBounds().center();
     if (requester) {
       pos = requester.globalBounds().center();
       if (requester.isWorld) pos = requester.visibleBounds().center();
       if (win = requester.getWindow()) {
         await win.toggleFader(true);
         pos = win.globalBounds().center();
       }
     }
     await doFn(pos);
     if (win) win.toggleFader(false);
  }

  inform(label = "no message", opts = {fontSize: 16, requester: null, animated: true}) {
    return this.openPrompt(new InformPrompt({label, ...opts}), opts);
  }

  prompt(label, opts = {requester: null, input: "", historyId: null, useLastInput: false}) {
    // await this.world().prompt("test", {input: "123"})
    // options = {
    //   input: STRING, -- optional, prefilled input string
    //   historyId: STRING, -- id to identify the input history for this prompt
    //   useLastInput: BOOLEAN -- use history for default input?
    // }
    return this.openPrompt(new TextPrompt({label, ...opts}), opts);
  }

  editPrompt(label, opts = {requester: null, input: "", historyId: null, useLastInput: false, textStyle: null, mode: null, evalEnvironment: null}) {
    return this.openPrompt(new EditPrompt({label, ...opts}), opts);
  }

  passwordPrompt(label, opts = {requester: null, input: ""}) {
    // await this.world().passwordPrompt("secret")
    return this.openPrompt(new PasswordPrompt({label, ...opts}), opts);
  }

  confirm(label, opts = {requester: null, animated: true}) {
    // await this.world().confirm("test")
    return this.openPrompt(new ConfirmPrompt({label, ...opts}), opts);
  }

  multipleChoicePrompt(label, opts = {requester: null, animated: true, choices: []}) {
    // await this.world().multipleChoicePrompt("test", {choices: ["1","2","3","4"]})
    return this.openPrompt(new MultipleChoicePrompt({label, ...opts}), opts);
  }

  listPrompt(label = "", items = [], opts = {requester: null, onSelection: null, preselect: 0}) {
    return this.openPrompt(new ListPrompt({
      filterable: false, padding: Rectangle.inset(3),
      label, items, ...opts}), opts);
  }

  filterableListPrompt(
    label = "",
    items = [],
    opts = {
      requester: null, onSelection: null,
      preselect: 0, multiSelect: false,
      historyId: null,
      fuzzy: false,
      actions: ["default"],
      selectedAction: "default",
      theme: 'dark',
      // sortFunction: (parsedInput, item) => ...
      // filterFunction: (parsedInput, item) => ...
    }) {

    if (opts.prompt) {
      var list = opts.prompt.get("list");
      list.items = items;
      list.selectedIndex = opts.preselect || 0;
      return this.openPrompt(opts.prompt, opts);
    }

    return this.openPrompt(new ListPrompt({
      filterable: true, padding: Rectangle.inset(3),
      label, items, ...opts}), opts);
  }

  editListPrompt(label = "", items = [], opts = {requester: null, multiSelect: true, historyId: null}) {
    return this.openPrompt(new EditListPrompt({
      label, multiSelect: true, items, padding: Rectangle.inset(3), ...opts}), opts);
  }

  showLoadingIndicatorFor(requester, label) {
     return this.addMorph(LoadingIndicator.open(label, { center: requester.globalBounds().center() }))
  }

}

class SelectionElement extends Morph {
  static get properties() {
    return {
      borderColor: { defaultValue: Color.red },
      borderWidth: { defaultValue: 1 },
      fill: { defaultValue: Color.transparent },
      epiMorph: { defaultValue: true },
      isSelectionElement: {
        readOnly: true,
        get() { return true }
      }
    }
  }
}

class Selection extends Morph {
  static get properties() {
    return {
      fill: { defaultValue: Color.gray.withA(.2) },
      borderWidth: { defaultValue: 2 },
      borderColor: { defaultValue: Color.gray },
      isSelectionElement: {
        readOnly: true,
        get() { return true }
      }
    }
  }
}

