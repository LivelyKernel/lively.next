/* global System,FormData,DOMParser */
import { resource } from 'lively.resources';
import { Rectangle, Point, Color, pt } from 'lively.graphics';
import { arr, fun, obj, promise, Path as PropertyPath } from 'lively.lang';
import { once } from 'lively.bindings';
import {
  GridLayout,
  MorphicDB,
  easings,
  HTMLMorph,
  Text,
  touchInputDevice,
  Icon,
  ConstraintLayout,
  Image,
  inspect,
  config,
  World
} from 'lively.morphic';

import { loadMorphFromSnapshot } from 'lively.morphic/serialization.js';
import { uploadFile } from 'lively.morphic/events/html-drop-handler.js';

import { prompts } from 'lively.components';
import * as moduleManager from 'lively.modules';

import * as LoadingIndicator from 'lively.components/loading-indicator.cp.js';
import { Halo, MorphHighlighter, ProportionalLayoutHalo, GridLayoutHalo } from 'lively.halos';
import { Window, Menu } from 'lively.components';
import { completions, runEval } from 'lively.vm';
import { getClassName, serialize } from 'lively.serializer2';
import { StatusMessageDefault, StatusMessageConfirm, StatusMessageError } from 'lively.halos/components/messages.cp.js';
import { part } from 'lively.morphic';

import worldCommands from './world-commands.js';
import { CommentData } from 'lively.collab';
import './js/linter.js';
import { localInterface } from 'lively-system-interface';

export class LivelyWorld extends World {
  static get properties () {
    return {
      clipMode: {
        defaultValue: 'hidden',
        readOnly: true,
        set () {}
      },
      hideScrollbars: {
        defaultValue: true
      },

      name: {
        set (name) {
          this.setProperty('name', name);
          document.title = `lively.next - ${name}`;
        }
      },
      activeSideBars: {
        serialize: false,
        initialize () { this.activeSideBars = []; }
      },
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
      },
      morphCommentMap: {
        initialize () {
          this.morphCommentMap = new Map();
        },
        doc: 'Stores a mapping from Morphs to an Array with their comments (if they have any).'
      },
      scaleFactor: {
        defaultValue: 1
      },
      offsetX: {
        defaultValue: 0
      },
      offsetY: {
        defaultValue: 0
      }
    };
  }

  get isIDEWorld () {
    return true;
  }

  get topbarMode () {
    // `withTopbarDo` does not return return-value of callback. Catch it instead.
    let mode;
    this.withTopBarDo((bar) => { mode = bar.mode; });
    return mode;
  }

  visibleBoundsExcludingTopBar () {
    // returns the visible rect of the world with respect to the topbar
    const bar = $world.getSubmorphNamed('lively top bar');
    const visibleBounds = this.visibleBounds();
    if (bar) {
      const visibleBoundsExclTopBar = new Rectangle(visibleBounds.x, visibleBounds.y + bar.height, visibleBounds.width, visibleBounds.height - bar.height);
      return visibleBoundsExclTopBar;
    } else {
      return visibleBounds;
    }
  }

  visibleBoundsExcludingStudioInterface () {
    const boundsExcludingTopBar = this.visibleBoundsExcludingTopBar();
    const sideBars = this.activeSideBars;
    let bounds = boundsExcludingTopBar;
    if (sideBars.includes('scene graph')) {
      const sceneGraph = this.get('scene graph');
      bounds = pt(bounds.x + sceneGraph.width, bounds.y).extent(pt(bounds.width - sceneGraph.width, bounds.height));
    }
    if (sideBars.includes('properties panel')) {
      const propertiesPanel = this.get('properties panel');
      bounds = pt(bounds.x, bounds.y).extent(pt(bounds.width - propertiesPanel.width, bounds.height));
    }
    return bounds;
  }

  makeDirty () {
    if (!this.renderingState.needsRerender && this.get('world mini map')) {
      this.get('world mini map').drawMorphs();
    }
    super.makeDirty();
  }

  getListedComponents () {
    const componentsInWorld = this.withAllSubmorphsSelect(m => m.isComponent && !this.hiddenComponents.includes(m.name));
    return arr.uniq([...componentsInWorld, ...this.localComponents]);
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
    win.ensureNotBeyondBottom();
    return win;
  }

  withTopBarDo (cb) {
    const topBar = this.get('lively top bar');
    if (topBar) cb(topBar.viewModel);
  }

  onTopBarLoaded () {
    this.withTopBarDo((bar) => bar.setEditMode(config.ide.studio.defaultMode));
  }

  onKeyUp (evt) {
    this.withTopBarDo(tb => tb.onKeyUp(evt));
  }

  onKeyDown (evt) {
    super.onKeyDown(evt);
    if (evt.targetMorph !== this) return;
    this.withTopBarDo(tb => tb.onKeyDown(evt));
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    const target = evt.state.clickedOnMorph;
    const activeWindow = this.activeWindow();

    if (activeWindow && target === this) activeWindow.deactivate();

    if (!target.isFlap) this.handleHaloCycle(evt);

    if (evt.state.menu) {
      evt.state.menu.remove();
    }

    this._tooltipViewer.mouseDown(evt);
  }

  onMouseUp (evt) {
    if (evt.isCommandKey()/* || evt.isShiftDown() */) evt.stop();
    if (evt.isAltDown() && config.altClickDefinesThat) {
      let target = this.morphsContainingPoint(evt.position)[0];
      // alt+click in halo mode causes the border box of the halo to be selected
      if (target.owner.isHalo) target = target.owner.target;
      // FIXME currently delayed to overwrite that in old morphic
      setTimeout(() => System.global.that = target, 100);
      target.show();
      evt.stop();
      console.log(`Set global "that" to ${target}`); // eslint-disable-line no-console
    }
  }

  onDrag (evt) {
    // prevent default dragging behavior
  }

  addMorphAt (submorph, index) {
    const returnValue = super.addMorphAt(submorph, index);

    if (!this.morphsInWorld.includes(submorph)) return returnValue;
    submorph._positionOnCanvas = this.screenToWorld(submorph.position);
    submorph.scale = this.scaleFactor;
    return returnValue;
  }

  onSubmorphChange (change, submorph) {
    if (!this.morphsInWorld.includes(submorph)) return;

    if (change.selector === 'addMorphAt') {
      submorph._positionOnCanvas = this.screenToWorld(submorph.position);
    }

    if (change.prop === 'scale' && change.meta?.metaInteraction) {
      fun.guardNamed('reset-scale-' + submorph.id, () => {
        submorph.scale = this.scaleFactor;
      })();
    }

    if (change.meta && change.meta.metaInteraction) return;
    if (change.type !== 'setter' || change.prop !== 'position') return;

    submorph._positionOnCanvas = this.screenToWorld(change.value);
  }

  worldToScreen (worldPoint) {
    const screenX = Number((worldPoint.x - this.offsetX) * this.scaleFactor);
    const screenY = Number((worldPoint.y - this.offsetY) * this.scaleFactor);
    return new Point(screenX, screenY);
  }

  screenToWorld (screenPoint) {
    const worldX = Number((screenPoint.x / this.scaleFactor) + this.offsetX);
    const worldY = Number((screenPoint.y / this.scaleFactor) + this.offsetY);
    return new Point(worldX, worldY);
  }

  get morphsInWorldWithSubmorphs () {
    return this.morphsInWorld.map(morph => morph.withAllSubmorphsSelect(() => true)).flat(1000);
  }

  get morphsInWorld () {
    return this.submorphs
      .filter(m => !m.hasFixedPosition)
      .filter(m => !m.isWindow)
      .filter(m => !m.isHand)
      .filter(m => !m.isHalo)
      .filter(m => !m.isTopBar)
      .filter(m => !m.isFlap)
      .filter(m => !m.isVersionChecker)
      .filter(m => !m.isSearchWidget)
      .filter(m => !m.isStatusMessage)
      .filter(m => !m.isSceneGraphPanel)
      .filter(m => !m.isLoadingIndicator)
      .filter(m => !m.isPropertiesPanel)
      .filter(m => !m.isZoomIndicator)
      .filter(m => !m.isMiniMap)
      .filter(m => !m.isMenu)
      .filter(m => !m.isTooltip)
      .filter(m => !m.isHaloItem)
      .filter(m => !m.styleClasses.includes('HaloPreview'))
      .filter(m => !m.isPrompt);
  }

  zoomWorld (delta) {
    const cursorPositionOnScreen = this.firstHand.position;
    const cursorPositionInSpaceBeforeZoom = this.screenToWorld(cursorPositionOnScreen);

    const scaleDirection = delta < 0 ? 1 : 0;
    const { step, min } = config.ide.studio.zoom;
    if (scaleDirection) this.scaleFactor *= 1 + step;
    else this.scaleFactor *= 1 - step;

    if (this.scaleFactor < min) this.scaleFactor = min;

    const cursorPositionInZoomedSpaceAfterZoom = this.screenToWorld(cursorPositionOnScreen);
    this.offsetX += (cursorPositionInSpaceBeforeZoom.x - cursorPositionInZoomedSpaceAfterZoom.x);
		  this.offsetY += (cursorPositionInSpaceBeforeZoom.y - cursorPositionInZoomedSpaceAfterZoom.y);

    this.morphsInWorld.forEach(m => m.scale = this.scaleFactor);
    this.morphsInWorld.forEach(m => {
      m.withMetaDo({ metaInteraction: true }, () => {
        m.position = this.worldToScreen(m.positionOnCanvas);
      });
    });

    const percentage = Number.parseInt((this.scaleFactor * 100));
    $world.get('world zoom indicator').updateZoomLevel(percentage);
  }

  scrollWorld (dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;

    this.morphsInWorld.forEach(m => {
      m.withMetaDo({ metaInteraction: true }, () => {
        m.position = this.worldToScreen(m.positionOnCanvas);
      });
    });
    this.halos().forEach(h => h.alignWithTarget()); // also update the nested ones
  }

  onMouseWheel (evt) {
    if (!config.ide.studio.canvasModeEnabled) return;

    const { domEvt, targetMorphs } = evt;

    const zoomOperation = domEvt.ctrlKey || domEvt.buttons === 4 || evt.isCommandKey();
    if (zoomOperation) domEvt.preventDefault();

    const openedMorphs = this.morphsInWorldWithSubmorphs;

    if (targetMorphs[0] === this) {
      // all scroll/zoom operations are legal directly over the world
    } else if (!targetMorphs.some(t => openedMorphs.includes(t))) return; // no "opened" morph in targets -> we are over an illegal morph (like window)
    // in hand mode, cancel scroll operations when we are over an element which can be scrolled itself
    else if (targetMorphs.some(m => {
      if (m.isWorld) return false;
      return (m.horizontalScrollbarVisible || m.verticalScrollbarVisible);
    }) &&
       $world.topbarMode === 'Hand' &&
       !zoomOperation) return;

    // scrolling/zooming needs to reset the cache,
    // otherwise the preview will lag behind the morph, causing a visual artifact
    $world.getSubmorphsByStyleClassName('HaloPreview').forEach(m => m.remove());
    $world.withTopBarDo(tb => tb._previewCache = null);

    const { deltaX, deltaY } = domEvt;

    if (zoomOperation) {
      this.zoomWorld(deltaY);
      return;
    }

    this.scrollWorld(deltaX, deltaY);
  }

  onWindowResize () {
    super.onWindowResize();
    setTimeout(() => {
      this.get('world mini map')?.relayout();
      this.get('world zoom indicator')?.relayout();
    });
  }

  resetScaleFactor () {
    this.scaleFactor = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.morphsInWorld.forEach(m => m.scale = 1);
    this.morphsInWorld.forEach(m => {
      m.withMetaDo({ metaInteraction: true }, () => {
        m.position = m.positionOnCanvas;
      });
    });
    $world.get('world zoom indicator').updateZoomLevel(100);
  }

  async whenReady () {
    await this._styleLoading;
    return true;
  }

  async onLoad () {
    this.opacity = 0;
    this.onWindowResize();
    // some meta stuff...
    if (lively.modules) lively.modules.removeHook('fetch', window.__logFetch);
    this.animate({ opacity: 1, blur: 3, duration: 1000, easing: easings.inOutExpo }).then(async () => {
      let li;
      if (li = window.worldLoadingIndicator) {
        const oldWorld = li.world();
        if (oldWorld && oldWorld.env !== this.env) {
          oldWorld.env.renderer.stopRenderWorldLoop();
        }
      }
    });
    this
      .animate({ blur: 0, duration: 1000, easing: easings.inOutExpo })
      .then(() => {
        document.body.style.background = 'black';
      });
    document.body.style.overflowX = 'visible';
    document.body.style.overflowY = 'visible';
    await localInterface.exportsOfModules({
      excludedPackages: config.ide.js.ignoredPackages
    });
  }

  async isNotUnique (worldName) {
    return (await MorphicDB.default.exists('world', worldName)).exists;
  }

  async openSideBar (name) {
    if (this.activeSideBars.includes(name)) {
      arr.remove(this.activeSideBars, name);
    } else {
      this.activeSideBars.push(name);
    }

    if (name === 'scene graph') {
      if (!this.sceneGraph) {
        const { MorphPanel } = await System.import('lively.ide/studio/scene-graph.cp.js');
        this.sceneGraph = part(MorphPanel);
        this.sceneGraph.epiMorph = true;
        this.sceneGraph.hasFixedPosition = true;
        this.sceneGraph.respondsToVisibleWindow = true;
        this.sceneGraph.openInWorld();
        this.sceneGraph.right = 0;
      }
      this.sceneGraph.toggle(this.activeSideBars.includes('scene graph'));
    }

    if (name === 'properties panel') {
      if (!this.propertiesPanel) {
        const { PropertiesPanel } = await System.import('lively.ide/studio/properties-panel.cp.js');
        this.propertiesPanel = part(PropertiesPanel);
        this.propertiesPanel.epiMorph = true;
        this.propertiesPanel.hasFixedPosition = true;
        this.propertiesPanel.respondsToVisibleWindow = true;
      }
      this.propertiesPanel.toggle(this.activeSideBars.includes('properties panel'));
    }

    const checker = this.get('lively version checker');
    const zoomIndicator = this.get('world zoom indicator');
    if ((checker && checker.owner === $world) ||
       (zoomIndicator && zoomIndicator.owner === $world)) {
      checker?.relayout();
      zoomIndicator?.relayout();
    }
    return name === 'properties panel' ? this.propertiesPanel : this.sceneGraph;
  }

  async askForName () {
    await this.whenEnvReady();
    let worldName;
    while (!worldName) {
      worldName = await this.prompt(['New Project\n', {}, 'Enter a name for this project:', { fontWeight: 'normal' }], { width: 400, hasFixedPosition: true, forceConfirm: true });
      if (await this.isNotUnique(String(worldName))) {
        const override = await this.confirm('This Project name is already taken. Do you want to override it?', {
          hasFixedPosition: true, width: 400
        });
        if (override) {
          const reallyOverride = await this.confirm('The old project will be lost! Are you sure you want to override?', {
            hasFixedPosition: true, width: 400
          });
          if (reallyOverride) {
            await MorphicDB.default.delete('world', worldName);
            return worldName;
          }
        }
        worldName = false;
      }
    }
    return String(worldName);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // html5 drag - drop

  async onNativeDrop (evt) {
    if (evt.targetMorph !== this) return;

    const { domEvt } = evt;
    const { files } = domEvt.dataTransfer;
    const baseURL = document.location.origin;

    if (files.length) {
      let uploadPath = $world.currentUser === 'guest' ? 'uploads/' : 'users/' + $world.currentUser + '/uploads';
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
        const images = []; const others = [];
        for (const f of files) {
          if (f.type.startsWith('image/')) images.push(f);
          else others.push(f);
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
                name: ea.name
              });
              img.whenLoaded().then(async () => {
                img.extent = img.naturalExtent.scaleBy(0.8 * this.visibleBounds().height / img.height);
                img.openInWorld();
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
          name: arr.last(url.split('/'))
        });
        img.whenLoaded().then(() => img.openInWorld());
      } else {
        new HTMLMorph({ html }).openInWorld();
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
        { command: 'open javascript workspace', target: this },
        { command: 'open browser', target: this },
        { command: 'choose and browse module', target: this },
        { command: 'open code search', target: this },
        { command: 'open file browser', target: this },
        {
          command: 'open shell workspace',
          target: this,
          tooltip: `Opens a workspace like interface\nthat allows you to trigger shell comands\nvia select + eval by pressing either ${new Text().keysForCommand('doit')} or ${new Text().keysForCommand('printit')}`
        },
        {
          command: 'open shell terminal',
          target: this,
          tooltip: 'Opens a classic remote shell interface,\nthat allows you to send commands to a\nbash session running on the server.\nAlso comes with advanced git support.'
        },
        { command: 'open workspace', args: { askForMode: true }, target: this }
      ]],
      { isDivider: true },
      { command: 'run command', target: this },
      { command: 'select morph', target: this },
      { command: 'window switcher', target: this },
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
      ? Menu.openAtHand(items, { hand: (evt && evt.hand) || this.firstHand })
      : null;
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
          const morph = await loadMorphFromSnapshot(s, { moduleManager });
          morph.openInWorld(evt.hand.position);
          if (s.copyMeta && s.copyMeta.offset) {
            const { x, y } = s.copyMeta.offset;
            morph.moveBy(pt(x, y));
          }
          morphs.push(morph);
        }
        this.halos().forEach(h => h.remove());
        this.showHaloFor(morphs);
      }
    } catch (e) {
      this.showError(e);
    } finally {
      if (li) li.remove();
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // comments
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  /**
   * Creates a comment with `commentText` on `morph` at `relativePosition`.
   * For more information on the comments feature @see `lively.collab`.
   * @param {Morph} morph
   * @param {String} commentText
   * @param {Point} relativePosition
   * @returns {CommentData} The comment created. CommentData holds some more information, e.g. the timestamp of the comment creation.
   */
  addCommentFor (morph, commentText, relativePosition = pt(0, 0)) {
    const comment = new CommentData(commentText, relativePosition);
    if (this.morphCommentMap.has(morph)) this.morphCommentMap.set(morph, this.morphCommentMap.get(morph).concat([comment]));
    else this.morphCommentMap.set(morph, [comment]);

    const commentBrowser = $world.getSubmorphNamed('Comment Browser');
    if (commentBrowser) commentBrowser.viewModel.addCommentForMorph(comment, morph);
    return comment;
  }

  /**
   * Removes the specified `commentToRemove` that was made on `morph`.
   * @param {Morph} morph
   * @param {CommentData} commentToRemove
   */
  removeCommentFor (morph, commentToRemove) {
    const commentBrowser = $world.getSubmorphNamed('Comment Browser');
    if (commentBrowser) commentBrowser.viewModel.removeCommentForMorph(commentToRemove, morph);
    this.morphCommentMap.set(morph, arr.without(this.morphCommentMap.get(morph), commentToRemove));
  }

  /**
   * Shorthand to remove all comments belonging to `morph`.
   * Used e.g. when a morph is abandoned, thus rendering its comments obsolete.
   * @param {Morph} morph
   */
  emptyCommentsFor (morph) {
    const commentBrowser = $world.getSubmorphNamed('Comment Browser');
    if (this.morphCommentMap.has(morph)) {
      if (commentBrowser) this.morphCommentMap.get(morph).forEach((comment) => commentBrowser.viewModel.removeCommentForMorph(comment, morph));
      this.morphCommentMap.set(morph, []);
    }
  }

  get commands () {
    return worldCommands
      .concat(super.commands);
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
    if (!obj.isArray(target) && !target.halosEnabled) return;
    if (this.halos().filter(halo => halo.target === target).length > 0) return;
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
    const ownerInWorld = morph === world
      ? null
      : morph.owner === world
        ? morph
        : morph.ownerChain().slice(-2)[0];
    const insertionIndex = ownerInWorld
      ? world.submorphs.indexOf(ownerInWorld) + 1
      : world.submorphs.length;
    let overlay;
    switch (morph.layout.constructor) {
      case ConstraintLayout:
        overlay = new ProportionalLayoutHalo({ container: morph, pointerId });
        break;
      case GridLayout:
        overlay = new GridLayoutHalo({ container: this.container, pointerId });
        break;
    }
    return overlay && this.addMorphAt(overlay, insertionIndex);
  }

  //= ====== hover halo interface ========
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
         evt.halo && evt.halo.borderBox !== haloTarget) {
      evt.halo.addMorphToSelection(haloTarget);
      return;
    }
    const removeHalo = evt.halo && !evt.targetMorphs.find(morph =>
      morph.isHaloItem || morph.keepHalo && morph.keepHalo(evt));
    const removeLayoutHalo = evt.layoutHalo && !evt.targetMorphs.find(morph => morph.isHaloItem);
    const addHalo = (!evt.halo || removeHalo) && haloTarget;
    if (removeLayoutHalo) evt.layoutHalo.remove();
    if (removeHalo) {
      evt.halo.remove();
      this.withTopBarDo(tb => {
        if (tb.stylingPalette) { tb.stylingPalette.clearFocus(); }
        if (tb.sideBar) { tb.sideBar.clearFocus(); }
      });
    }
    if (addHalo) {
      haloTarget.cancelTemporaryEdit && haloTarget.cancelTemporaryEdit(null, false);
      evt.stop();
      this.showHaloFor(haloTarget, evt.domEvt.pointerId);
    }
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
    this.setStatusMessage(this.logErrorPreperation(err), StatusMessageError);
  }

  showError (err) { return this.logError(err); }

  showErrorFor (morph, err) {
    return this.setStatusMessageFor(morph, this.logErrorPreperation(err), StatusMessageError);
  }

  // $world.logError('hello')
  // part(StatusMessageDefault, { message: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.' }, { width: 300, maxLines: 3 }).openInWorld()

  setStatusMessageFor (morph, message, StatusMessageComponent, delay = 5000, props) {
    if (!StatusMessageComponent) StatusMessageComponent = StatusMessageDefault;
    this.visibleStatusMessagesFor(morph).forEach(ea => ea.remove());
    const msgMorph = part(StatusMessageComponent, { epiMorph: true, viewModel: { slidable: false, message, ...props } });
    this.openStatusMessage(msgMorph, delay);
    msgMorph.alignAtBottomOf(morph);
    msgMorph.targetMorph = morph;
    msgMorph.fadeIn(300);
    if (msgMorph.removeOnTargetMorphChange && morph.isText) {
      once(morph, 'selectionChange', msgMorph, 'fadeOut', { converter: () => 200, garbageCollect: true });
    }
    return msgMorph;
  }

  setStatusMessage (message, StatusMessageComponent, delay = 5000, optStyle = {}) {
    if (!StatusMessageComponent) StatusMessageComponent = StatusMessageDefault;
    console[StatusMessageComponent === StatusMessageError ? 'error' : 'log'](message); // eslint-disable-line no-console
    return config.verboseLogging
      ? this.openStatusMessage(part(StatusMessageComponent, { epiMorph: true, viewModel: { message }, hasFixedPosition: true, width: 300, ...optStyle }), delay)
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
          msg.slideTo(msg.position.subPt(pt(0, statusMessage.height + 10)));
        }
      });

      // $world.logError('hello')

      const msgPos = this.visibleBounds().bottomRight().addXY(-20, -20);
      statusMessage.align(statusMessage.bounds().bottomRight(), msgPos);
      statusMessage.topRight = msgPos.addPt(pt(0, 40));
      statusMessage.animate({ bottomRight: msgPos, duration: 500 });
    }

    if (typeof delay === 'number') { setTimeout(() => statusMessage.stayOpen || statusMessage.fadeOut(), delay); }
    return statusMessage;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // dialogs
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async openPrompt (promptMorph, opts = { requester: null, animated: false }) {
    const focused = this.focusedMorph; const visBounds = this.visibleBounds();

    return this.withRequesterDo(opts.requester, async (pos) => {
      promptMorph.openInWorld();
      promptMorph.center = pos;
      if (promptMorph.height > visBounds.height) { promptMorph.height = visBounds.height - 5; }

      const translatedPromptBounds = $world.visibleBoundsExcludingTopBar().translateForInclusion(promptMorph.bounds());
      promptMorph.setBounds(translatedPromptBounds);

      if (typeof opts.customize === 'function') { opts.customize(promptMorph); }

      if (opts.animated) {
        if (this.previousPrompt && this.previousPrompt.world() && this.previousPrompt.transitionTo) {
          this.previousPrompt.transitionTo(promptMorph);
        }
      }
      this.previousPrompt = promptMorph;
      // ensure that promptMorph always in front of requester
      return promise.finally(promptMorph.activate(opts), () => focused && focused.focus());
    });
  }

  async withRequesterDo (requester, doFn) {
    let win; let pos = this.visibleBounds().center();
    if (requester) {
      pos = requester.globalBounds().center();
      if (requester.isWorld) pos = requester.visibleBounds().center();
      if (win = requester.getWindow()) {
        fun.guardNamed('toggleFader-' + win.id, () => {
          return win.toggleFader(true);
        })();
        pos = win.globalBounds().center();
      }
    }
    const res = await doFn(pos);
    if (win) {
      setTimeout(() => {
        fun.guardNamed('toggleFader-' + win.id, () => {
          return win.toggleFader(false);
        })();
      }, 300);
    }
    return res;
  }

  inform (label = 'no message', opts = { fontSize: 16, requester: null, animated: true }) {
    return this.openPrompt(part(prompts.InformPrompt, { viewModel: { label, ...opts } }), opts);
  }

  // $world.prompt('hello', { forceConfirm: true })

  prompt (label, opts = { requester: null, input: '', historyId: null, useLastInput: false, selectInput: false }) {
    // await this.world().prompt("test", {input: "123"})
    // options = {
    //   input: STRING, -- optional, prefilled input string
    //   historyId: STRING, -- id to identify the input history for this prompt
    //   useLastInput: BOOLEAN -- use history for default input?
    //   forceConfirm: BOOLEAN -- force the user to proceed with a valid input
    // }
    // const textPrompt = new TextPrompt({ label, ...opts });
    return this.openPrompt(part(prompts.TextPrompt, { viewModel: { label, ...opts } }), opts);
  }

  editPrompt (label, opts = {
    // await this.world().editPrompt("secret")
    requester: null,
    input: '',
    historyId: null,
    useLastInput: false,
    textStyle: null,
    mode: null,
    evalEnvironment: null
  }) {
    return this.openPrompt(part(prompts.EditPrompt, { viewModel: { label, ...opts } }), opts);
  }

  passwordPrompt (label, opts = { requester: null, input: '' }) {
    // await this.world().passwordPrompt("secret")
    return this.openPrompt(part(prompts.PasswordPrompt, { viewModel: { label, ...opts } }), opts);
  }

  confirm (label, opts = { requester: null, animated: true }) {
    // await this.world().confirm("test")
    return this.openPrompt(part(prompts.ConfirmPrompt, { viewModel: { label, ...opts } }), opts);
  }

  multipleChoicePrompt (label, opts = { requester: null, animated: true, choices: [] }) {
    // await this.world().multipleChoicePrompt("test", {choices: ["1","2","3","4"]})
    return this.openPrompt(part(prompts.MultipleChoicePrompt, { viewModel: { label, ...opts } }), opts);
  }

  listPrompt (label = '', items = [], opts = { requester: null, onSelection: null, preselect: 0 }) {
    // await this.world().listPrompt("test", ["1","2","3","4"])
    return this.openPrompt(part(prompts.ListPrompt, {
      viewModel: {
        filterable: false,
        padding: Rectangle.inset(3),
        label,
        items,
        ...opts
      }
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
    // await this.world().filterableListPrompt("test", ["1","2","3","4"])
    let list;

    if (opts.prompt) {
      opts.prompt.items = items;
      opts.prompt.ui.list.selectedIndex = opts.preselect || 0;
      return this.openPrompt(opts.prompt.view, opts);
    }

    list = part(prompts.ListPrompt, {
      viewModel: {
        filterable: true,
        padding: Rectangle.inset(3),
        label,
        items,
        ...opts
      }
    });

    return this.openPrompt(list, opts);
  }

  editListPrompt (label = '', items = [], opts = { requester: null, multiSelect: true, historyId: null }) {
    return this.openPrompt(part(prompts.EditListPrompt, { viewModel: { label, multiSelect: true, items, padding: Rectangle.inset(3), ...opts } }), opts);
  }

  /**
   * Opens a Progress Bar / Loading Indicator centered with regard to the `requester`.
   * @param {Morph} requester
   * @param {String} label - The text displayed on the progress bar.
   * @returns {Morph} The loading indicator morph.
   */
  showLoadingIndicatorFor (requester, label) {
    return this.addMorph(LoadingIndicator.open(label, { center: requester.globalBounds().center() }));
  }

  async withLoadingIndicatorDo (doFn, requester, label) {
    const pBar = await this.showLoadingIndicatorFor(requester, label);
    try { return await doFn(pBar); } finally { pBar.remove(); }
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

    // items.push(['Publish...', () => self.interactivelyPublish()]);

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
        ['Send to back', () => self.owner.addMorphBack(self)],
        ['Fit to submorphs', async () => {
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
        }],
        ...PropertyPath('master.auto').get(self)
          ? [
              ['Adjust to Master Component Submorph Hierarchy', () => self.master.reconcileSubmorphs()]
            ]
          : []
      ]]);
    }

    if (this.submorphs.length) {
      items.push(['Select all submorphs',
        () => self.world().showHaloFor(self.submorphs.slice())]);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // stepping scripts
    const steppingItems = [];

    if (self.startSteppingScripts) {
      steppingItems.push(['Start stepping', function () { self.startSteppingScripts(); }]);
    } else {
      steppingItems.push(['Start stepping', async () => {
        const items = [];
        for (const methodsPerProto of (await completions.getCompletions(() => self, '')).completions) {
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

    if (self.tickingScripts.length !== 0) {
      steppingItems.push(['Stop stepping', () => self.stopStepping()]);
    }

    if (steppingItems.length !== 0) {
      items.push(['Stepping', steppingItems]);
    }

    items.push(['Change Tooltip', async () => {
      self.tooltip = await self.world().prompt('Enter Tooltip', {
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

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // const connectionItems = this.defaultConnectionMenuItems(self);
    // if (connectionItems) {
    //   items.push(['connections...', connectionItems]);
    // }
    //
    // const connectItems = this.defaultConnectMenuItems(() => {}, self);
    // if (connectItems) {
    //   items.push(['connect...', connectItems]);
    // }

    items.push(['export to HTML', async function () {
      const { generateHTML } = await System.import('lively.morphic/rendering/html-generator.js');
      new HTMLMorph({
        name: 'exported-' + morph.name,
        html: await generateHTML(morph, null, {
          isFragment: true, addStyles: false
        })
      }).openInWorld();
    }]);

    items.push(['Remove Morph', () => self.abandon(true)]);
    items.push(['Rename Morph', async () => {
      const newName = await $world.prompt('Enter new Name for Morph', { input: self.name });
      if (!newName) return;
      self.name = newName;
    }]);
    items.push(['Open Inspector', () => self.inspect()]);

    items.push({ isDivider: true });
    items.push(['Add comment', async () => {
      const commentText = await $world.prompt('Enter comment');
      if (commentText) {
        let relativePosition = pt(0, 0);
        if (evt && !evt.halo) {
          const xRelative = self.localize(evt.position).x / self.width;
          const yRelative = self.localize(evt.position).y / self.height;
          relativePosition = pt(xRelative, yRelative);
        }
        $world.addCommentFor(self, commentText, relativePosition);
        $world.setStatusMessage('Comment saved', StatusMessageConfirm);
      } else {
        $world.setStatusMessage('Comment not saved', StatusMessageError);
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
          ea.name, actionFn
            ? () => actionFn(ea.name, self, ea)
            : async () => {
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

  updateVisibleWindowMorphs () {
    super.updateVisibleWindowMorphs();
    this.halos().forEach(halo => {
      halo.maskBounds = this.visibleBounds();
    });
  }
}
