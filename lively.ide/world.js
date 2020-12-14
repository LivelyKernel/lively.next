/* global System,WeakMap,FormData,fetch,DOMParser,XMLHttpRequest */
import { resource } from 'lively.resources';
import { Rectangle, Color, pt } from 'lively.graphics';
import { arr, fun, obj, promise } from 'lively.lang';
import { once } from 'lively.bindings';
import {
  GridLayout, MorphicDB, easings, HTMLMorph, Text, Label, Path, Polygon, morph, Ellipse, touchInputDevice, Icon, Morph,
  VerticalLayout,
  HorizontalLayout,
  ProportionalLayout,
  Tooltip,
  Image,
  inspect,
  config,
  World
} from 'lively.morphic';

import { loadMorphFromSnapshot } from 'lively.morphic/serialization.js';
import { loadObjectFromPartsbinFolder, loadPart } from 'lively.morphic/partsbin.js';
import { uploadFile } from 'lively.morphic/events/html-drop-handler.js';

import {
  InformPrompt,
  ConfirmPrompt,
  MultipleChoicePrompt,
  TextPrompt,
  EditPrompt,
  PasswordPrompt,
  ListPrompt,
  EditListPrompt
} from 'lively.components/prompts.js';

import LoadingIndicator from 'lively.components/loading-indicator.js';
import { Halo, MorphHighlighter, StatusMessage, StatusMessageForMorph, ProportionalLayoutHalo, GridLayoutHalo, FlexLayoutHalo } from 'lively.halos';
import { Window, List, FilterableList, Menu } from 'lively.components';

import worldCommands from './world-commands.js';
import { GradientEditor } from './styling/gradient-editor.js';
import { completions, runEval } from 'lively.vm';
import { getClassName, serialize } from 'lively.serializer2';
import { Canvas } from 'lively.components/canvas.js';
import { CommentBrowser } from 'lively.collab';

export class LivelyWorld extends World {
  static get properties () {
    return {
      hiddenComponents: {
        // declared components are exported by default
        // this property prevents some of these components to be listed in the components browser, if they themselves do not provide useful information
        initialize () {
          this.hiddenComponents = [];
        }
      },
      fill: { defaultValue: Color.rgb(81, 90, 90) },
      draggable: {
        readOnly: true,
        get () { return !touchInputDevice; }
      }
    };
  }

  getListedComponents () {
    return this.withAllSubmorphsSelect(m => m.isComponent && !this.hiddenComponents.includes(m.name));
  }

  activeWindow () { return this.getWindows().reverse().find(ea => ea.isActive()); }
  getWindows () { return this.submorphs.filter(ea => ea.isWindow); }

  activePrompt () { return this.getPrompts().reverse().find(ea => ea.isActive()); }
  getPrompts () { return this.submorphs.filter(ea => ea.isPrompt); }

  openInWindow (morph, opts = { title: morph.name, name: 'window for ' + morph.name }) {
    const win = new Window({
      ...opts,
      extent: morph.extent.addXY(0, 25),
      targetMorph: morph
    }).openInWorld();
    win.ensureNotOverTheTop();
    return win;
  }

  onKeyUp (evt) {
    this.get('lively top bar').onKeyUp(evt);
  }

  onKeyDown (evt) {
    super.onKeyDown(evt);
    if (evt.targetMorph != this) return;
    this.get('lively top bar').onKeyDown(evt);
  }

  onMouseMove (evt) {
    super.onMouseMove(evt);
    this.handleHaloPreview(evt);
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    const target = evt.state.clickedOnMorph;
    const activeWindow = this.activeWindow();

    if (activeWindow && target == this) activeWindow.deactivate();

    this.handleHaloCycle(evt);

    if (evt.state.menu) evt.state.menu.remove();

    this._tooltipViewer.mouseDown(evt);

    this.handleHaloSelection(evt);
  }

  onMouseUp (evt) {
    if (evt.isCommandKey()/* || evt.isShiftDown() */) evt.stop();
    if (evt.isAltDown() && config.altClickDefinesThat) {
      const target = this.morphsContainingPoint(evt.position)[0];
      // FIXME currently delayed to overwrite that in old morphic
      setTimeout(() => System.global.that = target, 100);
      target.show();
      evt.stop();
      console.log(`Set global "that" to ${target}`);
    }
    this.handleShapeCreation(evt);
  }

  onLongClick (evt) {
    const target = evt.state.prevClick.clickedOnMorph;
    let haloTarget;

    let morphsBelow = evt.world.morphsContainingPoint(evt.position);
    let morphsBelowTarget = morphsBelow.slice(morphsBelow.indexOf(target));
    morphsBelow = morphsBelow.filter(ea => ea.halosEnabled);
    morphsBelowTarget = morphsBelowTarget.filter(ea => ea.halosEnabled);
    haloTarget = morphsBelowTarget[0] || morphsBelow[0];

    const removeHalo = evt.halo && !evt.targetMorphs.find(morph => morph.isHaloItem);
    const removeLayoutHalo = evt.layoutHalo && !evt.targetMorphs.find(morph => morph.isHaloItem);
    const addHalo = (!evt.halo || removeHalo) && haloTarget;
    if (removeLayoutHalo) evt.layoutHalo.remove();
    if (removeHalo) evt.halo.remove();
    if (addHalo) { evt.stop(); this.showHaloFor(haloTarget, evt.domEvt.pointerId); }
  }

  onDragStart (evt) {
    if (!this._yieldShapeOnClick && evt.leftMouseButtonPressed()) {
      this.selectionStartPos = evt.positionIn(this);
      this.morphSelection = this.addMorph({
        type: Selection,
        epiMorph: true,
        reactsToPointer: false,
        position: this.selectionStartPos,
        extent: evt.state.dragDelta
      });
      this.selectedMorphs = {};
    } else this.prepareShapeCreation(evt);
  }

  onDrag (evt) {
    if (!this._yieldShapeOnClick && this.morphSelection) {
      const selectionBounds = Rectangle.fromAny(evt.position, this.selectionStartPos);
      this.morphSelection.setBounds(selectionBounds);
      this.submorphs.forEach(c => {
        if (c.isSelectionElement || c.isHand) return;
        const candidateBounds = c.bounds();
        const included = selectionBounds.containsRect(candidateBounds);

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
      });
      return;
    }
    this.yieldShapeIfNeeded(evt);
  }

  onDragEnd (evt) {
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

  async onLoad () {
    this.opacity = 0;
    this.onWindowResize();
    await this.whenRendered();
    this.animate({ opacity: 1, duration: 1000, easing: easings.inOutExpo });
    document.body.style.overflowX = 'visible';
    document.body.style.overflowY = 'visible';
  }

  // this.world().askForName()

  async askForName () {
    await this.whenRendered();
    let worldName;
    while (!worldName) {
      worldName = await this.prompt(['New Project\n', {}, 'Enter a name for this project:', { fontWeight: 'normal' }], { width: 400, hasFixedPosition: true });
      if ((await MorphicDB.default.exists('world', worldName)).exists) {
        await this.confirm('This Project name is already taken. Please pick a different one!', {
          hasFixedPosition: true, width: 400
        });
        worldName = false;
      }
    }
    return worldName;
  }

  onWindowResize (evt) {
    super.onWindowResize(evt);
    if (this.resizePolicy === 'elastic') {
      this.execCommand('resize to fit window');
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // html5 drag - drop

  async nativeDrop_ensureUploadIndicator () {
    if (!this._cachedDragIndicator) { this._cachedDragIndicator = loadObjectFromPartsbinFolder('upload-indicator'); }
    const i = await this._cachedDragIndicator;
    if (!i.world()) i.openInWorld();
    fun.debounceNamed('remove-upload-indicator', 1000, () => {
      this.nativeDrop_removeUploadIndicator();
    })();
  }

  nativeDrop_removeUploadIndicator () {
    if (this._cachedDragIndicator) { this._cachedDragIndicator.then(i => i.remove()); }
  }

  onNativeDragover (evt) {
    if (evt.targetMorph === this) { this.nativeDrop_ensureUploadIndicator(); }
  }

  async onNativeDrop (evt) {
    /* global show, inspect */
    this.nativeDrop_removeUploadIndicator();
    if (evt.targetMorph != this) return;

    const { domEvt } = evt;
    const { files, items } = domEvt.dataTransfer;
    const baseURL = document.location.origin;

    if (files.length) {
      const user = this.getCurrentUser();
      let uploadPath = user.isGuestUser ? 'uploads/' : 'users/' + $world.getCurrentUser().name + '/uploads';
      if (evt.isAltDown()) {
        uploadPath = await this.prompt('Choose upload location', {
          history: 'lively.morphic-html-drop-file-upload-location',
          input: uploadPath
        });
        if (!uploadPath) return this.setStatusMessage('Canceled upload');
      }

      const really = await this.confirm(
        `Upload ${files.length} file${files.length > 1 ? 's' : ''}?`);

      if (!really) return;

      const fd = new FormData();
      for (let i = 0; i < files.length; i++) { fd.append('file', files[i], files[i].name); }

      let res; let answer; const ld = LoadingIndicator.open('Uploading File');
      try {
        const headers = {};
        const onProgress = (evt) => {
          // set progress of loading indicator
          const p = evt.loaded / evt.total;
          ld.progress = p;
          ld.status = 'Uploaded ' + (100 * p).toFixed() + '%';
        };
        if (!user.isGuestUser) headers.Authorization = `Bearer ${user.token}`;
        res = resource(System.baseURL, { headers, onProgress, onLoad: (res) => answer = res });
        res = res.join(`/upload?uploadPath=${encodeURIComponent(uploadPath)}`);
        await res.write(fd);
      } catch (err) {
        return this.showError(`Upload failed: ${err.message}\n`);
      }

      ld.remove();

      try {
        this.setStatusMessage(`Uploaded ${answer.uploadedFiles.length} file`);

        const files = answer.uploadedFiles.map(ea => {
          const res = resource(baseURL).join(ea.path);
          return {
            ...ea,
            url: res.url,
            name: res.name()
          };
        });
        const images = []; const videos = []; const others = [];
        for (const f of files) {
          if (f.type.startsWith('image/')) images.push(f);
          else if (f.type.startsWith('video')) videos.push(f);
          else others.push(f);
        }
        if (videos.length) {
          for (const v of videos) {
            const video = Object.assign(await loadObjectFromPartsbinFolder('video morph'), {
              videoURL: v.url,
              name: v.name
            }).openInWorld();
          }
        }
        if (images.length) {
          const openImages = true;
          // let openImages = await this.confirm(
          //   images.length > 1 ?
          //     `There were ${images.length} images uploaded. Open them?` :
          //     `There was 1 image uploaded. Open it?`);
          if (openImages) {
            images.forEach(ea => {
              const img = new Image({
                imageUrl: ea.url,
                autoResize: true,
                name: ea.name
              });
              img.whenLoaded().then(async () => {
                img.extent = img.naturalExtent.scaleBy(0.8 * this.visibleBounds().height / img.height);
                img.openInWorld();
                await img.whenRendered();
                img.center = this.visibleBounds().center();
              });
            });
          }
        }
        if (others.length) {
          for (const file of others) {
            const open = await this.confirm(`open file ${file.name} (${file.type})?`);
            if (open) this.execCommand('open file', { url: file.url });
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

    const types = domEvt.dataTransfer.types;
    if (types.includes('text/html')) {
      const html = domEvt.dataTransfer.getData('text/html');
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const imgs = parsed.querySelectorAll('img');
      // is it a dropped image?
      if (imgs.length === 1 && imgs[0].src && types.includes('text/uri-list')) {
        const url = imgs[0].src;
        const img = new Image({
          imageUrl: url,
          autoResize: true,
          name: arr.last(url.split('/'))
        });
        img.whenLoaded().then(() => img.openInWorld());
      } else {
        Object.assign(await loadObjectFromPartsbinFolder('html-morph'), { html })
          .openInWorld();
      }
      return;
    }

    for (let i = 0; i < domEvt.dataTransfer.items.length; i++) {
      const item = domEvt.dataTransfer.items[i];
      // console.log(`${item.kind} - ${item.type}`)
      if (item.kind === 'file') {
        const f = item.getAsFile();
        const upload = await this.confirm(`Upload ${f.name}?`);
        if (upload) {
          const uploadedMorph = await uploadFile(f, f.type);
          uploadedMorph && uploadedMorph.openInWorld();
          uploadedMorph.center = this.visibleBounds().center();
        }
      } else if (item.kind === 'string') {
        // show({kind: item.kind, type: item.type})
        item.getAsString((s) => inspect(s));
      }
    }
  }

  // file download serving

  serveFileAsDownload (fileString, { fileName = 'file.txt', type = 'text/plain' } = {}) {
    const isDataURL = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;

    const a = window.document.createElement('a');
    a.href = obj.isString(fileString) && !!fileString.match(isDataURL) ? fileString : window.URL.createObjectURL(new Blob([fileString], { type }));
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // menu
  menuItems () {
    return [
      { title: 'World menu' },
      { command: 'undo', target: this },
      { command: 'redo', target: this },
      { isDivider: true },
      ['Debugging', [
        { command: 'delete change history', target: this },
        { command: 'fix font metric', target: this },
        { command: 'inspect server', target: this }
      ]],
      ['Tools', [
        { command: 'open PartsBin', target: this },
        { command: 'open javascript workspace', target: this },
        { command: 'open browser', target: this },
        { command: 'choose and browse module', target: this },
        { command: 'open code search', target: this },
        { command: 'open file browser', target: this },
        { command: 'open shell workspace', target: this },
        { command: 'open workspace', args: { askForMode: true }, target: this }
      ]],
      { isDivider: true },
      { command: 'run command', target: this },
      { command: 'select morph', target: this },
      { command: 'window switcher', target: this },
      ['Exported Components',
        [
          ['Toggle Select All', () => {
            if (this.getListedComponents().length == 0) {
              this.hiddenComponents = [];
            } else {
              this.hiddenComponents = this.withAllSubmorphsSelect(m => m.isComponent).map(m => m.name);
            }
          }],
          ...this.withAllSubmorphsSelect(m => m.isComponent).map(c => {
            const isHidden = this.hiddenComponents.includes(c.name);
            return [[...Icon.textAttribute(isHidden ? 'square' : 'check-square'), '  ' + c.name, {}], () => {
              if (isHidden) {
                this.hiddenComponents = arr.without(this.hiddenComponents, c.name);
              } else {
                this.hiddenComponents = [c.name, ...this.hiddenComponents];
              }
            }];
          })]
      ],
      ['Resize',
        this.resizePolicy === 'static' ? [
          { command: 'resize to fit window', target: this },
          { command: 'resize manually', target: this },
          ['switch to automatic resizing of world', () => this.resizePolicy = 'elastic']
        ] : [
          ['switch to manual resizing of world', () => this.resizePolicy = 'static']
        ]
      ],
      ['Troubleshooting', [
        { command: 'report a bug', target: this },
        { command: 'clear storage and reload', target: this }
      ]
      ],
      { isDivider: true },
      ['Windows',
        [
          { command: 'toggle minimize all windows', target: this },
          { command: 'close all windows', target: this }
        ]
      ],
      { isDivider: true },
      { command: 'save world', target: this },
      { command: 'load world', target: this }
    ];
  }

  openWorldMenu (evt, items) {
    const eventState = this.env.eventDispatcher.eventState;
    if (eventState.menu) eventState.menu.remove();
    return eventState.menu = items && items.length
      ? Menu.openAtHand(items, { hand: (evt && evt.hand) || this.firstHand }) : null;
  }

  async onPaste (evt) {
    let li;
    try {
      const data = evt.domEvt.clipboardData;
      if (data.types.includes('application/morphic')) {
        evt.stop();
        let snapshots = JSON.parse(data.getData('application/morphic'));
        const morphs = [];

        // data.clearData()
        if (!Array.isArray(snapshots)) snapshots = [snapshots];
        li = LoadingIndicator.open('pasting morphs...');
        for (const s of snapshots) {
          const morph = await loadMorphFromSnapshot(s);
          morph.openInWorld(evt.hand.position);
          if (s.copyMeta && s.copyMeta.offset) {
            const { x, y } = s.copyMeta.offset;
            morph.moveBy(pt(x, y));
          }
          morphs.push(morph);
        }
        this.showHaloFor(morphs);
      }
    } catch (e) {
      this.showError(e);
    } finally {
      if (li) li.remove();
    }
  }

  get commands () {
    return worldCommands
      .concat(super.commands)
      .concat([
        {
          name: 'open in prototype box',
          exec: async (world, opts) => {
            const box = await loadPart('prototype box');
            box.wrapProto(opts.target);
          }
        }
      ]);
  }

  get keybindings () { return super.keybindings.concat(config.globalKeyBindings); }
  set keybindings (x) { super.keybindings = x; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // halos
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  halos () { return this.submorphs.filter(m => m.isHalo); }

  haloForPointerId (pointerId) {
    return this.submorphs.find(m => m.isHalo && m.state && m.state.pointerId === pointerId);
  }

  showHaloFor (target, pointerId = this.firstHand && this.firstHand.pointerId, focus = true) {
    let halo;
    if (!Halo) return;
    if (typeof target.createHalo === 'function') {
      halo = target.createHalo(Halo, pointerId);
    } else {
      halo = new Halo({ pointerId, target });
    }
    this.addMorph(halo);
    if (focus) halo.focus();
    halo.alignWithTarget();
    return halo;
  }

  showHaloForSelection (selection, pointerId) {
    return selection.length > 0 && this.showHaloFor(selection, pointerId);
  }

  layoutHaloForPointerId (pointerId = this.firstHand && this.firstHand.pointerId) {
    return this.submorphs.find(m => m.isLayoutHalo && m.state && m.state.pointerId === pointerId);
  }

  showLayoutHaloFor (morph, pointerId = this.firstHand && this.firstHand.pointerId) {
    const world = this;
    const ownerInWorld = morph === world ? null
      : morph.owner === world ? morph
        : morph.ownerChain().slice(-2)[0];
    const insertionIndex = ownerInWorld
      ? world.submorphs.indexOf(ownerInWorld) + 1
      : world.submorphs.length;
    let overlay;
    switch (morph.layout.constructor) {
      case ProportionalLayout:
        overlay = new ProportionalLayoutHalo({ container: morph, pointerId });
        break;
      case HorizontalLayout:
      case VerticalLayout:
        overlay = new FlexLayoutHalo({ container: morph, pointerId });
        break;
      case GridLayout:
        overlay = new GridLayoutHalo({ container: this.container, pointerId });
        break;
    }
    return overlay && this.addMorphAt(overlay, insertionIndex);
  }

  highlightMorph (highlightOwner, morph, showLayout = false, highlightedSides = []) {
    return MorphHighlighter.for(highlightOwner, morph, showLayout, highlightedSides);
  }

  removeHighlighters (highlightOwner = this) {
    return MorphHighlighter.removeHighlighters(highlightOwner);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // status messages
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  visibleStatusMessages () {
    return this.submorphs.filter(ea => ea.isStatusMessage);
  }

  visibleStatusMessagesFor (morph) {
    return this.submorphs.filter(ea => ea.isStatusMessage && ea.targetMorph === morph);
  }

  logErrorPreperation (err) {
    let stringified = String(err);
    let stack = err.stack || '';
    if (stack && err.message !== err.stack) {
      stack = String(stack);
      const errInStackIdx = stack.indexOf(stringified);
      if (errInStackIdx === 0) { stack = stack.slice(stringified.length); }
      stringified += '\n' + stack;
    }
    return stringified;
  }

  logError (err) {
    this.setStatusMessage(this.logErrorPreperation(err), Color.red);
  }

  showError (err) { return this.logError(err); }

  showErrorFor (morph, err) {
    return this.setStatusMessageFor(morph, this.logErrorPreperation(err), Color.red);
  }

  setStatusMessageFor (morph, message, color, delay = 5000, props) {
    if (!StatusMessageForMorph) return;
    this.visibleStatusMessagesFor(morph).forEach(ea => ea.remove());
    const msgMorph = new StatusMessageForMorph({ message, color, ...props });
    this.openStatusMessage(msgMorph, delay);
    msgMorph.targetMorph = morph;
    msgMorph.fadeIn(300);
    if (msgMorph.removeOnTargetMorphChange && morph.isText) {
      once(morph, 'selectionChange', msgMorph, 'fadeOut', { converter: () => 200 });
    }
    return msgMorph;
  }

  setStatusMessage (message, color, delay = 5000, optStyle = {}) {
    if (!StatusMessage) return;
    console[color == Color.red ? 'error' : 'log'](message);
    return config.verboseLogging
      ? this.openStatusMessage(new StatusMessage({ message, color, hasFixedPosition: true, ...optStyle }), delay)
      : null;
  }

  openStatusMessage (statusMessage, delay) {
    this.addMorph(statusMessage);
    if (statusMessage.slidable) {
      const messages = this.visibleStatusMessages();
      for (const m of messages) {
        if (messages.length <= (config.maxStatusMessages || 0)) break;
        if (m.stayOpen || !m.slidable) continue;
        m.remove();
        arr.remove(messages, m);
      }

      arr.without(messages, statusMessage).forEach(async msg => {
        if (!msg.isMaximized && msg.slidable) {
          msg.slideTo(msg.position.addPt(pt(0, -statusMessage.extent.y - 10)));
        }
      });

      const msgPos = this.visibleBounds().bottomRight().addXY(-20, -20);
      statusMessage.align(statusMessage.bounds().bottomRight(), msgPos);
      statusMessage.topRight = msgPos.addPt(pt(0, 40));
      statusMessage.animate({ bottomRight: msgPos, duration: 500 });
    }

    if (typeof delay === 'number') { setTimeout(() => statusMessage.stayOpen || statusMessage.fadeOut(), delay); }
    return statusMessage;
  }

  async addProgressBar (opts = {}) {
    const { location = 'center' } = opts;
    const pBar = await loadObjectFromPartsbinFolder('progress bar');
    Object.assign(pBar, { progress: 0 }, obj.dissoc(opts, ['location']));
    this.addMorph(pBar);
    pBar.align(pBar[location], this.visibleBounds()[location]());
    return pBar;
  }

  async withProgressBarDo (doFn, opts) {
    const pBar = await this.addProgressBar(opts);
    try { return await doFn(pBar); } finally { pBar.remove(); }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // dialogs
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async openPrompt (promptMorph, opts = { requester: null, animated: false }) {
    const focused = this.focusedMorph; const visBounds = this.visibleBounds();

    return this.withRequesterDo(opts.requester, async (pos) => {
      promptMorph.openInWorldNear(pos, this);
      if (promptMorph.height > visBounds.height) { promptMorph.height = visBounds.height - 5; }

      if (typeof opts.customize === 'function') { opts.customize(promptMorph); }

      if (opts.animated) {
        if (this.previousPrompt && this.previousPrompt.world()) {
          this.previousPrompt.transitionTo(promptMorph);
        }
      }
      this.previousPrompt = promptMorph;
      return promise.finally(promptMorph.activate(opts), () => focused && focused.focus());
    });
  }

  async withRequesterDo (requester, doFn) {
    let win; let pos = this.visibleBounds().center();
    if (requester) {
      pos = requester.globalBounds().center();
      if (requester.isWorld) pos = requester.visibleBounds().center();
      if (win = requester.getWindow()) {
        await win.toggleFader(true);
        pos = win.globalBounds().center();
      }
    }
    const res = await doFn(pos);
    if (win) win.toggleFader(false);
    return res;
  }

  inform (label = 'no message', opts = { fontSize: 16, requester: null, animated: true }) {
    return this.openPrompt(new InformPrompt({ label, ...opts }), opts);
  }

  prompt (label, opts = { requester: null, input: '', historyId: null, useLastInput: false }) {
    // await this.world().prompt("test", {input: "123"})
    // options = {
    //   input: STRING, -- optional, prefilled input string
    //   historyId: STRING, -- id to identify the input history for this prompt
    //   useLastInput: BOOLEAN -- use history for default input?
    // }
    return this.openPrompt(new TextPrompt({ label, ...opts }), opts);
  }

  editPrompt (label, opts = { requester: null, input: '', historyId: null, useLastInput: false, textStyle: null, mode: null, evalEnvironment: null }) {
    return this.openPrompt(new EditPrompt({ label, ...opts }), opts);
  }

  passwordPrompt (label, opts = { requester: null, input: '' }) {
    // await this.world().passwordPrompt("secret")
    return this.openPrompt(new PasswordPrompt({ label, ...opts }), opts);
  }

  confirm (label, opts = { requester: null, animated: true }) {
    // await this.world().confirm("test")
    return this.openPrompt(new ConfirmPrompt({ label, ...opts }), opts);
  }

  multipleChoicePrompt (label, opts = { requester: null, animated: true, choices: [] }) {
    // await this.world().multipleChoicePrompt("test", {choices: ["1","2","3","4"]})
    return this.openPrompt(new MultipleChoicePrompt({ label, ...opts }), opts);
  }

  listPrompt (label = '', items = [], opts = { requester: null, onSelection: null, preselect: 0 }) {
    return this.openPrompt(new ListPrompt({
      filterable: false,
      padding: Rectangle.inset(3),
      label,
      items,
      ...opts
    }), opts);
  }

  filterableListPrompt (
    label = '',
    items = [],
    opts = {
      requester: null,
      onSelection: null,
      preselect: 0,
      multiSelect: false,
      historyId: null,
      fuzzy: false,
      actions: ['default'],
      selectedAction: 'default',
      theme: 'dark'
      // sortFunction: (parsedInput, item) => ...
      // filterFunction: (parsedInput, item) => ...
    }) {
    if (opts.prompt) {
      const list = opts.prompt.get('list');
      list.items = items;
      list.selectedIndex = opts.preselect || 0;
      return this.openPrompt(opts.prompt, opts);
    }

    return this.openPrompt(new ListPrompt({
      filterable: true,
      padding: Rectangle.inset(3),
      label,
      items,
      ...opts
    }), opts);
  }

  editListPrompt (label = '', items = [], opts = { requester: null, multiSelect: true, historyId: null }) {
    return this.openPrompt(new EditListPrompt({ label, multiSelect: true, items, padding: Rectangle.inset(3), ...opts }), opts);
  }

  showLoadingIndicatorFor (requester, label) {
    return this.addMorph(LoadingIndicator.open(label, { center: requester.globalBounds().center() }));
  }

  // morph meta menu items

  defaultMenuItems (morph, evt) {
    const world = this;
    const items = [];
    const self = morph;
    // If reset exists and is a function, it will add it as the first option in the menu list
    if (this.reset && typeof this.reset === 'function') {
      items.push(['Reset', () => { this.reset(); }]);
    }
    // items.push(['Select all submorphs', function(evt) { self.world().setSelectedMorphs(self.submorphs.clone()); }]);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // morphic hierarchy / windows

    items.push(['Publish...', () => self.interactivelyPublish()]);

    items.push(['Open in...', [
      ['Window', () => { self.openInWindow(); }]
    ]]);

    // Drilling into scene to addMorph or get a halo
    // whew... this is expensive...
    function menuItemsForMorphsBeneathMe (itemCallback) {
      let morphs = world.morphsContainingPoint(self.worldPoint(pt(0, 0)));
      morphs.pop(); // remove world
      const selfInList = morphs.indexOf(self);
      // remove self and other morphs over self (the menu)
      morphs = morphs.slice(selfInList + 1);
      return morphs.map(ea => [String(ea), itemCallback.bind(this, ea)]);
    }

    items.push(['Add morph to...', {
      getItems: menuItemsForMorphsBeneathMe.bind(self, morph => morph.addMorph(self))
    }]);

    items.push(['Get halo on...', {
      getItems: menuItemsForMorphsBeneathMe.bind(self, morph => morph.world().showHaloFor(morph))
    }]);

    if (self.owner && self.owner.submorphs.length > 1) {
      items.push(['Arrange morph', [
        ['Bring to front', () => self.owner.addMorph(self)],
        ['Send to back', () => self.owner.addMorphBack(self)]
      ]]);
    }

    if (this.submorphs.length) {
      items.push(['Select all submorphs',
        () => self.world().showHaloFor(self.submorphs.slice())]);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // stepping scripts
    const steppingItems = [];

    if (this.startSteppingScripts) {
      steppingItems.push(['Start stepping', function () { self.startSteppingScripts(); }]);
    } else {
      steppingItems.push(['Start stepping', async () => {
        const items = [];

        for (const methodsPerProto of await completions.getCompletions(() => this, '')) {
          const [protoName, methods] = methodsPerProto;
          for (const method of methods) {
            if (method.startsWith('_') || method.startsWith('$')) continue;
            const [_, selector, args] = method.match(/^([^\(]+)\(?([^\)]+)?\)?$/) || [];
            if (!selector || typeof self[selector] !== 'function') continue;
            items.push({
              isListItem: true,
              string: `${protoName} ${method}`,
              value: { selector, args }
            });
          }
        }

        const { selected: [choice] } = await $world.filterableListPrompt('Select method to start', items, {
          requester: self,
          historyId: 'lively.morphic-start-stepping-chooser'
        });
        if (!choice) return;

        let time = await $world.prompt('Steptime in ms (how of the method will be called)?', { input: 100 });
        time = Number(time);
        if (isNaN(time)) return;

        const args = [time, choice.selector];
        if (choice.args) {
          const evalEnvironment = { targetModule: 'lively://lively.morphic-stepping-args/eval.js' };
          const _args = await $world.editPrompt('Arguments to pass', {
            input: `[${choice.args}]`,
            mode: 'js',
            evalEnvironment
          });
          const { value: _argsEvaled, isError } = await runEval(_args, evalEnvironment);
          if (isError) {
            $world.inform(`Error evaluating the arguments: ${_argsEvaled}`);
            return;
          }
          if (Array.isArray(_argsEvaled)) { args.push(..._argsEvaled); }
        }

        self.startStepping(...args);
      }]);
    }

    if (self.tickingScripts.length != 0) {
      steppingItems.push(['Stop stepping', () => self.stopStepping()]);
    }

    if (steppingItems.length != 0) {
      items.push(['Stepping', steppingItems]);
    }

    items.push(['Change Tooltip', async () => {
      self.tooltip = await self.world().editPrompt('Enter Tooltip', {
        placeholder: 'Description',
        input: self.tooltip || ''
      });
    }]);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // morphic properties
    const morphicMenuItems = ['Morphic properties', []];
    items.push(morphicMenuItems);
    items.push(['display serialization info', async function () {
      const { SnapshotInspector } = await System.import('lively.serializer2/debugging.js');
      const snapshot = serialize(self);
      SnapshotInspector.forSnapshot(snapshot).openSummary();
    }]);
    items.push(['display object report', async function () {
      const { SnapshotInspector } = await System.import('lively.serializer2/debugging.js');
      const snapshot = serialize(self);
      SnapshotInspector.forSnapshot(snapshot).openObjectReport();
    }]);

    const checked = Icon.textAttribute('check-square');
    const unchecked = Icon.textAttribute('square');
    Object.assign(checked[1], { float: 'none', display: 'inline' });

    ['grabbable', 'draggable', 'acceptsDrops', 'halosEnabled'].forEach(propName =>
      morphicMenuItems[1].push(
        [[...(morph[propName] ? checked : unchecked), ' ' + propName, { float: 'none' }],
          () => morph[propName] = !morph[propName]]));

    items.push(['Fit to submorphs', async () => {
      let padding = await self.world().prompt('Padding around submorphs:', {
        input: 'Rectangle.inset(5)',
        historyId: 'lively.morphic-fit-to-submorphs-padding-hist',
        requester: self
      });
      if (typeof padding !== 'string') return;
      const { value } = await runEval(padding, { topLevelVarRecorder: { Rectangle } });

      padding = value && value.isRectangle ? value : Rectangle.inset(0);

      self.undoStart('fitToSubmorphs');
      self.fitToSubmorphs(padding);
      self.undoStop('fitToSubmorphs');
    }]);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    const connectionItems = this.defaultConnectionMenuItems(self);
    if (connectionItems) {
      items.push(['connections...', connectionItems]);
    }

    const connectItems = this.defaultConnectMenuItems(() => {}, self);
    if (connectItems) {
      items.push(['connect...', connectItems]);
    }
    items.push({ isDivider: true });
    items.push(['Add comment', async () => {
      // TODO: maybe use promise functionality instead of if else
      const commentText = await $world.prompt('Enter comment');
      if (commentText) {
        let relativePosition = pt(0, 0);
        if (evt) {
          const xRelative = self.localize(evt.position).x / self.width;
          const yRelative = self.localize(evt.position).y / self.height;
          relativePosition = pt(xRelative, yRelative);
        }
        await self.addComment(commentText, relativePosition);
        $world.setStatusMessage('Comment saved', 'green');
      } else {
        $world.setStatusMessage('Comment not saved', 'red');
      }
    }]);

    return items;
  }

  defaultConnectionMenuItems (morph) {
    const self = morph;

    if (!self.attributeConnections || !self.attributeConnections.length) return null;
    return self.attributeConnections.map(c => [String(c), [
      ['show', async () => {
        const { interactivelyShowConnection } = await System.import('lively.ide/fabrik.js');
        interactivelyShowConnection(c);
      }],
      ['edit', async () => {
        const { interactivelyReEvaluateConnection } = await System.import('lively.ide/fabrik.js');
        interactivelyReEvaluateConnection(c);
      }],
      ['disconnect', () => { c.disconnect(); $world.setStatusMessage('disconnected ' + c); }]
    ]]);
  }

  defaultSourceDataBindings (morph) {
    const self = morph;

    const allProps = self.propertiesAndPropertySettings().properties;
    const groupedProps = arr.groupByKey(
      Object.keys(allProps).map(name => {
        const props = { name, ...allProps[name] };
        // group "_..." is private, don't show
        if (props.group && props.group.startsWith('_')) return null;
        return props;
      }).filter(Boolean), 'group');
    const customOrder = ['core', 'geometry', 'interaction', 'styling', 'layouting'];
    const sortedGroupedProps = [];

    customOrder.forEach(ea => sortedGroupedProps.push(groupedProps[ea]));

    arr.withoutAll(groupedProps.keys(), customOrder).forEach(
      ea => sortedGroupedProps.push(groupedProps[ea]));

    return sortedGroupedProps;
  }

  targetDataBindings (morph) {
    const self = morph;
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // builds a ["proto name", [metthod, ...]] list
    const methodsByProto = [];
    for (let proto = self; proto !== Object.prototype;) {
      const protoName = proto === self ? String(this) : getClassName(proto);
      let group = null;
      const descrs = obj.getOwnPropertyDescriptors(proto);
      const nextProto = Object.getPrototypeOf(proto);
      for (const prop in descrs) {
        const val = descrs[prop].value;
        if (typeof val !== 'function' || val === proto.constructor) continue;
        if (prop.startsWith('$') || prop.startsWith('_')) continue;

        if (!group) group = [];
        const args = fun.argumentNames(val);
        group.push({ group: protoName + ' methods', signature: `${prop}(${args.join(', ')})`, name: prop });
      }

      if (group) methodsByProto.push(group);
      proto = nextProto;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    return this.defaultSourceDataBindings(self).concat(methodsByProto);
  }

  defaultConnectMenuItems (actionFn, morph) {
    const self = morph;
    // returns menu of source attributes that can be used for connection from this object.
    // when actionFn is passed it will be called with (sourceAttrName, morph, propertySpec)
    // sourceAttrName can be "custom..." in this case the user can enter specify manually
    // what the source should be
    const bindings = this.defaultSourceDataBindings(morph);
    const w = self.world();
    const items = bindings.map(
      group => [
        group[0].group || 'uncategorized',
        group.map(ea => [
          ea.name, actionFn ? () => actionFn(ea.name, self, ea) : async () => {
            const { interactiveConnectGivenSource } =
                   await System.import('lively.ide/fabrik.js');
            interactiveConnectGivenSource(self, ea.name);
          }
        ])]);

    w && items.push([
      'custom...', actionFn
        ? () => actionFn('custom...', self, null)
        : async () => {
          const { interactiveConnectGivenSource } =
             await System.import('lively.ide/fabrik.js');
          const attr = await w.prompt('Enter custom connection point', {
            requester: self,
            historyId: 'lively.morphic-custom-connection-points',
            useLastInput: true
          });
          if (attr) interactiveConnectGivenSource(this, attr);
        }]);
    return items;
  }

  //= ====== default shape creation interface ========

  clearHaloPreviews () {
    this.getSubmorphsByStyleClassName('HaloPreview').forEach(m => m.remove());
  }

  showHaloPreviews (active) {
    if (!active) this.clearHaloPreviews();
    this._showHaloPreview = active;
  }

  handleHaloPreview (evt) {
    if (this._showHaloPreview) {
      const target = this.morphsContainingPoint(evt.positionIn(this)).filter(m => {
        return m.halosEnabled && [m, ...m.ownerChain()].every(m => m.visible && m.opacity > 0 && !m.styleClasses.includes('HaloPreview'));
      })[0];
      this.showHaloPreviewFor(target);
    }
  }

  handleHaloCycle (evt) {
    const target = evt.state.clickedOnMorph;
    const isCommandKey = evt.isCommandKey();
    const isShiftKey = evt.isShiftDown();
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // halo activation + removal
    // note that the logic for cycling halos from morph to underlying morph is
    // implemented in Halo>>onMouseDown
    let haloTarget;
    if (isCommandKey && !target.isHalo) {
      let morphsBelow = evt.world.morphsContainingPoint(evt.position);
      let morphsBelowTarget = morphsBelow;
      morphsBelow = morphsBelow.filter(ea => ea.halosEnabled);
      morphsBelowTarget = morphsBelowTarget.filter(ea => ea.halosEnabled);
      haloTarget = morphsBelowTarget[0] || morphsBelow[0];
    }
    if (isShiftKey && !target.isHaloItem && haloTarget &&
         evt.halo && evt.halo.borderBox != haloTarget) {
      evt.halo.addMorphToSelection(haloTarget);
      return;
    }
    const removeHalo = evt.halo && !evt.targetMorphs.find(morph => morph.isHaloItem);
    const removeLayoutHalo = evt.layoutHalo && !evt.targetMorphs.find(morph => morph.isHaloItem);
    const addHalo = (!evt.halo || removeHalo) && haloTarget;
    if (removeLayoutHalo) evt.layoutHalo.remove();
    if (removeHalo) evt.halo.remove();
    if (addHalo) {
      evt.stop();
      this.showHaloFor(haloTarget, evt.domEvt.pointerId);
    }
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  }

  handleHaloSelection (evt) {
    if (this._showHaloPreview && this._currentlyHighlighted && this.halos().length == 0) {
      evt.stop();
      this.getSubmorphsByStyleClassName('HaloPreview').forEach(m => m.remove());
      this.showHaloFor(this._currentlyHighlighted);
    }
    if (evt.targetMorph != this) return;
    this._shapeRequest = true;
  }

  showHaloPreviewFor (aMorph) {
    if (!aMorph) return;
    if (aMorph.getWindow()) aMorph = null; // do not inspect windows
    else if ([aMorph, ...aMorph.ownerChain()].find(m => m.isEpiMorph)) aMorph = null; // do not inspect epi morphs
    else if (aMorph == this) aMorph = null; // reset halo preview
    // if the previously highlighted morph is different one, then clean all exisiting previews
    if (this._currentlyHighlighted != aMorph) {
      this.clearHaloPreviews();
      this._currentlyHighlighted = aMorph;
    }

    if (this.halos().length > 0) return;

    if (!aMorph) return;
    if (!this._previewCache) this._previewCache = new WeakMap();

    let type = Morph;

    switch (getClassName(aMorph)) {
      case 'Ellipse':
        type = Ellipse;
        break;
    }

    const preview = this._previewCache.get(aMorph) || morph({
      type,
      styleClasses: ['HaloPreview'],
      epiMorph: true,
      fill: Color.transparent,
      reactsToPointer: false,
      halosEnabled: false,
      acceptsDrops: false,
      border: {
        color: Color.rgb(23, 160, 251),
        width: 1
      }
    });

    if (!preview.owner) this.addMorph(preview);
    preview.setBounds(aMorph.globalBounds());
    preview.borderColor = Color.rgb(23, 160, 251);
    preview.borderStyle = 'solid';
    if (aMorph.master) preview.borderColor = Color.purple;
    if (aMorph.ownerChain().find(m => m.master && m.master.managesMorph(aMorph))) {
      preview.borderColor = Color.purple;
      preview.borderStyle = 'dotted';
    }
    if (aMorph.isComponent) preview.borderColor = Color.magenta;
    this._previewCache.set(aMorph, preview);
  }

  prepareShapeCreation (evt) {
    const type = this._yieldShapeOnClick;
    if (!this.canBeCreatedViaDrag(type)) return;
    this._yieldedShape = this.addMorph(morph({
      type,
      position: evt.positionIn(this),
      extent: pt(1, 1),
      fill: Color.transparent,
      borderWidth: 1,
      borderColor: Color.rgb(23, 160, 251),
      fixedHeight: true,
      fixedWidth: true,
      lineWrapping: true,
      ...type == Polygon ? this.getPolyDefaultAttrs() : {},
      ...type == Path ? this.getPathDefaultAttrs() : {}
    }));
    this._sizeTooltip = morph({
      type: Tooltip,
      padding: Rectangle.inset(5, 5, 5, 5),
      styleClasses: ['Tooltip']
    }).openInWorld();
  }

  yieldShapeIfNeeded (evt) {
    if (this._yieldedShape) {
      this._yieldedShape.extent = evt.positionIn(this).subPt(evt.state.dragStartPosition).subPt(pt(1, 1)).maxPt(pt(1, 1));
      this._sizeTooltip.description = `${this._yieldShapeOnClick.className}: ${this._yieldedShape.width.toFixed(0)}x${this._yieldedShape.height.toFixed(0)}`;
      this._sizeTooltip.topLeft = evt.positionIn(this).addXY(15, 15);
    }
  }

  getPolyDefaultAttrs () {
    return {
      vertices: [pt(131.4, 86.3), pt(171.0, 139.6), pt(105.9, 119.9), pt(65.3, 172.5), pt(64.7, 107.0), pt(0.0, 86.3), pt(64.7, 65.5), pt(65.3, 0.0), pt(105.9, 52.6), pt(171.0, 32.9), pt(131.4, 86.3)],
      borderWidth: 1
    };
  }

  getPathDefaultAttrs () {
    return {
      vertices: [pt(0, 0), pt(1, 1)],
      borderWidth: 1
    };
  }

  handleShapeCreation (evt) {
    const type = this._yieldShapeOnClick;
    if (this._sizeTooltip) this._sizeTooltip.remove();
    if (evt.targetMorph != this) return;
    if (this._shapeRequest && type && !this._yieldedShape) {
      switch (type) {
        case Image:
          morph({
            type,
            extent: pt(150, 150),
            fill: Color.transparent
          }).openInWorldNearHand();
          break;
        case Label:
          morph({
            type,
            value: 'I am a label!',
            fill: Color.transparent
          }).openInWorldNearHand();
          break;
        case Text:
          if (evt.targetMorph.isText) return;
          morph({
            type,
            textString: 'I am a text field!',
            fill: Color.transparent
          }).openInWorldNearHand();
          break;
      }
    }
    if (type == Text && this._yieldedShape) { this._yieldedShape.focus(); } else if (this._yieldedShape) this.showHaloFor(this._yieldedShape);
    this._yieldedShape = null;
    this._shapeRequest = false;
  }

  canBeCreatedViaDrag (klass) {
    return [Morph, Ellipse, HTMLMorph, Canvas, Text, Polygon, Path, Image].includes(klass);
  }

  toggleShapeMode (active, shapeName) {
    const shapeToClass = {
      Rectangle: Morph,
      Ellipse: Ellipse,
      HTML: HTMLMorph,
      Canvas: Canvas,
      Image: Image,
      Path: Path,
      Label: Label,
      Polygon: Polygon,
      Text: Text
    };

    if (active) {
      this.nativeCursor = 'crosshair';
      this._yieldShapeOnClick = shapeToClass[shapeName];
    } else {
      this._yieldShapeOnClick = false;
      this.nativeCursor = 'auto';
    }
  }
}

class SelectionElement extends Morph {
  static get properties () {
    return {
      borderColor: { defaultValue: Color.red },
      borderWidth: { defaultValue: 1 },
      fill: { defaultValue: Color.transparent },
      epiMorph: { defaultValue: true },
      isSelectionElement: {
        readOnly: true,
        get () { return true; }
      }
    };
  }
}

class Selection extends Morph {
  static get properties () {
    return {
      fill: { defaultValue: Color.gray.withA(0.2) },
      borderWidth: { defaultValue: 2 },
      borderColor: { defaultValue: Color.gray },
      isSelectionElement: {
        readOnly: true,
        get () { return true; }
      }
    };
  }
}
