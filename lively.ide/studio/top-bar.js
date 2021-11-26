import { Morph } from 'lively.morphic/morph.js';
import { Icon, Tooltip, morph, Text, Polygon, Label, Path, Image, HTMLMorph, Ellipse } from 'lively.morphic/index.js';
import { pt, Rectangle, Color } from 'lively.graphics/index.js';
import { arr, Closure, obj } from 'lively.lang/index.js';
import { LoadingIndicator } from 'lively.components/index.js';
import { resource } from 'lively.resources/index.js';
import { Canvas } from 'lively.components/canvas.js';
import { getClassName } from 'lively.serializer2/index.js';
import { Selection, SelectionElement } from 'lively.ide/world.js';
import { connect, signal, once, disconnect } from 'lively.bindings/index.js';
import { CommentBrowser } from 'lively.collab/index.js';
import { part } from 'lively.morphic/components/core.js';
import { PropertiesPanel } from './properties-panel.cp.js';

export class FastLoadToggler extends Morph {
  static get properties () {
    return {
      loadConfig: {
        derived: true,
        get () {
          return JSON.parse(localStorage.getItem('lively.load-config') || '{}');
        },
        set (data) {
          localStorage.setItem('lively.load-config', JSON.stringify(data));
        }
      }
    };
  }

  onLoad () {
    // initialize on cold load
    if (!localStorage.getItem('lively.load-config')) {
      localStorage.setItem('lively.load-config', JSON.stringify({
        'lively.lang': 'dynamic',
        'lively.ast': 'dynamic',
        'lively.source-transform': 'dynamic',
        'lively.classes': 'dynamic',
        'lively.vm': 'dynamic',
        'lively.modules': 'dynamic',
        'lively.user': 'dynamic',
        'lively.storage': 'dynamic',
        'lively.morphic': 'dynamic'
      }));
    }
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this.toggleFastLoad();
  }

  refresh () {
    const toggleIndicator = this.getSubmorphNamed('toggle indicator');
    const label = this.getSubmorphNamed('label');
    const bolt = this.getSubmorphNamed('bolt');
    let active = Object.values(this.loadConfig).every(v => v == 'frozen');
    const color = active ? this.owner.haloColor : this.owner.get('label').fontColor;
    toggleIndicator.fontColor = label.fontColor = bolt.fontColor = color;
    toggleIndicator.textAndAttributes = Icon.textAttribute(active ? 'toggle-on' : 'toggle-off');
  }

  toggleFastLoad () {
    const { loadConfig } = this;
    let active = Object.values(loadConfig).every(v => v == 'frozen');
    for (let key in loadConfig) loadConfig[key] = active ? 'dynamic' : 'frozen';
    this.loadConfig = loadConfig;
    this.refresh();
  }
}

export class LivelyTopBar extends Morph {
  static get properties () {
    return {
      isTopBar: { readOnly: true, get () { return true; } },
      activeHaloItems: {
        initialize (v) {
          if (!v) this.activeHaloItems = ['*'];
        }
      },
      primaryTarget: {
        doc: 'A reference to the morph that the top bar considers its primary target',
        defaultValue: null
      },
      haloFilterFn: {
        defaultValue: '() => true',
        derived: true,
        set (fnSource) {
          this.setProperty('haloFilterFn', fnSource);
        },
        get () {
          return Closure.fromSource(
            this.getProperty('haloFilterFn'),
            {
              target: this.primaryTarget
            }
          ).asFunction();
        }
      },
      userFlap: {},
      activeSideBars: {},
      currentShapeMode: {
        after: ['submorphs'],
        set (shapeName) {
          this.setProperty('currentShapeMode', shapeName);
          this.get('shape status icon').textAndAttributes = Icon.textAttribute(this.shapeToIcon[shapeName].args[0]);
        }
      },
      sideBarToIcon: {
        readOnly: true,
        get () {
          return {
            'Scene Graph': { args: ['sitemap', { textStyleClasses: ['fas'] }] },
            'Styling Palette': { args: ['palette', { textStyleClasses: ['fas'] }] }
          };
        }
      },
      shapeToIcon: {
        initialize (prevValue) {
          this.shapeToIcon = prevValue || {
            Rectangle: { shortcut: 'R', args: ['square', { textStyleClasses: ['fas'] }] },
            Ellipse: { shortcut: 'E', args: ['circle', { textStyleClasses: ['fas'] }] },
            Image: { shortcut: 'I', args: ['image', { textStyleClasses: ['fas'], paddingTop: '1px' }] },
            Path: { shortcut: 'P', args: ['bezier-curve', { fontSize: 13, paddingTop: '3px' }] },
            Polygon: { shortcut: 'Q', args: ['draw-polygon', { fontSize: 17 }] },
            Label: { shortcut: 'L', args: ['tag', { paddingTop: '1px' }] },
            Canvas: { shortcut: 'C', args: ['chess-board', { paddingTop: '1px' }] },
            HTML: { shortcut: 'H', args: ['code', { paddingTop: '1px' }] }
          };
        }
      },
      keyToShape: {
        initialize (prevValue) {
          this.keyToShape = prevValue || {
            R: 'Rectangle',
            E: 'Ellipse',
            I: 'Image',
            P: 'Path',
            Q: 'Polygon',
            L: 'Label',
            C: 'Canvas',
            H: 'HTML'
          };
        }
      },
      shapeToClass: {
        serialize: false,
        defaultValue: {
          Rectangle: Morph,
          Ellipse: Ellipse,
          HTML: HTMLMorph,
          Canvas: Canvas,
          Image: Image,
          Path: Path,
          Label: Label,
          Polygon: Polygon,
          Text: Text
        }
      },
      shapesCreatedViaDrag: {
        serialize: false,
        initialize () {
          this.shapesCreatedViaDrag = [Morph, Ellipse, HTMLMorph, Canvas, Text, Polygon, Path, Image];
        }
      }
    };
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    super.__additionally_serialize__(snapshot, ref, pool, addFn);
    addFn('haloFilterFn', this.getProperty('haloFilterFn'));
  }

  // only works for shapes that are created via drag as of now
  registerCustomShape (shapeName, klass, shapeKey, iconArgs) {
    this.shapeToClass[shapeName] = klass;
    this.keyToShape[shapeKey] = shapeName;
    this.shapeToIcon[shapeName] = { shortcut: shapeKey, args: iconArgs };
    this.shapesCreatedViaDrag.push(klass);
  }

  beforePublish () {
    this.activeSideBars = [];
    this.currentShapeMode = 'Rectangle';
    this.setEditMode('Halo');
  }

  async onLoad () {
    if (this.isComponent) return; // only with instances
    await this.whenRendered();
    delete this.shapeToIcon._rev;
    document.body.style.background = 'black';
    this.setEditMode('Halo');
    this.userFlap.getSubmorphNamed('fast load toggler').refresh();
  }

  onUserChanged (evt) {
    try {
      this.userFlap.onUserChanged(evt);
    } finally {}
  }

  // this.relayout()

  relayout () {
    if (this.respondsToVisibleWindow) {
      this.width = this.world().visibleBounds().width;
      this.position = pt(0, 0);
    }
  }

  adjustElements () {
    const statusBar = this.get('ipad status bar');
    if (statusBar) statusBar.width = this.width;
    if (this.userFlap.owner == this) // only adjust position if this flap is within top bar
    {
      this.userFlap.right = this.width - 10;
      this.userFlap.visible = this.width > 750;
    }
  }

  getShapeMenuItems () {
    return Object.entries(this.shapeToIcon).map(([shapeName, { shortcut, args }]) => {
      return [
        [
          ...this.currentShapeMode === shapeName
            ? [
                ...Icon.textAttribute('check', {
                  fontSize: 11,
                  paddingTop: '2px'
                }), '   ', {}
              ]
            : ['     ', {}],
          ...Icon.textAttribute(...args), `   ${shapeName} `, { float: 'none' },
          '      ' + shortcut, { float: 'right', fontSize: 11, opacity: 0.5, fontFamily: 'IBM Plex Mono' }
        ], () => {
          this.currentShapeMode = shapeName;
          this.setEditMode('Shape');
        }
      ];
    });
  }

  getSideBarMenuItems () {
    return Object.entries(this.sideBarToIcon).map(([sideBarName, { args }]) => {
      return [
        [
          ...this.activeSideBars.includes(sideBarName)
            ? [
                ...Icon.textAttribute('check', {
                  fontSize: 11,
                  paddingTop: '2px'
                }), '   ', {}
              ]
            : ['     ', {}],
          ...Icon.textAttribute(...args), `   ${sideBarName} `, { float: 'none' }
        ], () => this.openSideBar(sideBarName)
      ];
    });
  }

  reloadSidebar () {
    this.sideBar.remove();
    this.sideBar = null;
    this.stylingPalette.remove();
    this.stylingPalette = null;
    this.openSideBar('Scene Graph');
    this.openSideBar('Styling Palette');
  }

  onKeyUp (evt) {
    if (this._tmpEditMode == 'Hand') {
      this.setEditMode('Hand', true);
    }
  }

  onKeyDown (evt) {
    super.onKeyDown(evt);

    if (evt.isCommandKey()) {
      // temporary toggle halo mode
      if (this._tmpEditMode == 'Hand') {
        this.setEditMode('Halo', true);
        return;
      }
    }

    if (evt.isAltDown()) {
      return;
    }

    const keyToShape = this.keyToShape;

    if (keyToShape[evt.key]) {
      this.currentShapeMode = keyToShape[evt.key];
      this.setEditMode('Shape');
      return;
    }
    switch (evt.key) {
      case 'Escape':
        this.setEditMode('Halo');
        break;
      case 'T':
        this.setEditMode('Text');
        break;
    }
  }

  // this.reloadSidebar()

  async openSideBar (name) {
    if (this.activeSideBars.includes(name)) { arr.remove(this.activeSideBars, name); } else { this.activeSideBars.push(name); }

    if (name == 'Scene Graph') {
      if (!this.sideBar) {
        const li = LoadingIndicator.open('loading side bar');
        await li.whenRendered();
        this.sideBar = await resource('part://SystemIDE/scene graph side bar master').read();
        this.sideBar.hasFixedPosition = true;
        this.sideBar.respondsToVisibleWindow = true;
        this.sideBar.openInWorld();
        this.sideBar.right = 0;
        await this.sideBar.whenRendered();
        li.remove();
      }
      await this.sideBar.toggle(this.activeSideBars.includes('Scene Graph'));
    }

    if (name == 'Styling Palette') {
      if (!this.stylingPalette) {
        const li = LoadingIndicator.open('loading side bar');
        await li.whenRendered();
        // this.stylingPalette.remove()
        // this.stylingPalette = null
        this.stylingPalette = part(PropertiesPanel);
        // this.stylingPalette.collapseAll();
        this.stylingPalette.hasFixedPosition = true;
        this.stylingPalette.respondsToVisibleWindow = true;
        this.stylingPalette.openInWorld();
        this.stylingPalette.left = this.world().width;
        this.stylingPalette.relayout();
        await this.stylingPalette.whenRendered();
        li.remove();
      }
      await this.stylingPalette.toggle(this.activeSideBars.includes('Styling Palette'));
    }

    const checker = this.get('lively version checker');
    if (checker && checker.owner == $world) {
      checker.relayout();
    }
  }

  onMouseDown (evt) {
    const selector = this.get('select shape type');
    const shapeModeButton = this.get('shape mode button');
    const sideBarSelector = this.get('side bar selector');
    const target = this.primaryTarget || this.world();
    if (evt.targetMorph == selector) {
      const menu = this.world().openWorldMenu(evt, this.getShapeMenuItems());
      menu.position = shapeModeButton.globalBounds().bottomLeft().subPt(this.world().scroll);
    }

    if (evt.targetMorph.name == 'undo button') {
      target.execCommand('undo');
    }

    if (evt.targetMorph.name == 'redo button') {
      target.execCommand('redo');
    }

    if (evt.targetMorph.name == 'save button') {
      $world.execCommand('save world');
    }

    if (evt.targetMorph == shapeModeButton) {
      this.setEditMode('Shape');
    }

    if (evt.targetMorph.name == 'text mode button') {
      this.setEditMode('Text');
    }

    if (evt.targetMorph.name == 'hand mode button') {
      this.setEditMode('Hand');
    }

    if (evt.targetMorph.name == 'halo mode button') {
      this.setEditMode('Halo');
    }

    if (evt.targetMorph.name == 'open component browser') {
      this.interactivelyLoadComponent();
    }

    if (evt.targetMorph.name == 'load world button') {
      this.world().execCommand('load world');
    }

    if (evt.targetMorph.name == 'comment browser button') {
      this.toggleCommentBrowser();
    }

    if (evt.targetMorph == sideBarSelector) {
      const menu = this.world().openWorldMenu(evt, this.getSideBarMenuItems());
      menu.position = sideBarSelector.globalBounds().bottomLeft().subPt(this.world().scroll);
    }
  }

  colorCommentBrowserButton () {
    const { haloShadow, haloColor } = this.get('user flap');
    const label = this.get('comment browser button');
    label.fontColor = haloColor;
    label.dropShadow = haloShadow;
  }

  uncolorCommentBrowserButton () {
    const label = this.get('comment browser button');
    const defaultColor = Color.rgb(102, 102, 102);
    label.dropShadow = false;
    label.fontColor = defaultColor;
  }

  async toggleCommentBrowser () {
    if (CommentBrowser.isOpen()) {
      this.uncolorCommentBrowserButton();
    } else {
      this.colorCommentBrowserButton();
    }
    await this.world().execCommand('toggle comment browser');
  }

  get commentCountBadge () {
    return this.get('comment browser button').get('comment count badge');
  }

  async interactivelyLoadComponent () {
    const label = this.get('open component browser');
    const { haloShadow, haloColor } = this.userFlap;
    const defaultColor = Color.rgb(102, 102, 102);
    label.fontColor = haloColor;
    label.dropShadow = haloShadow;
    await this.world().execCommand('browse and load component');
    label.dropShadow = false;
    label.fontColor = defaultColor;
  }

  setEditMode (mode, shallow = false) {
    this.editMode = mode;
    const target = this.primaryTarget || this.world();
    const { haloShadow, haloColor } = this.userFlap;
    const defaultColor = Color.rgb(102, 102, 102);
    if (!shallow) this._tmpEditMode = mode;

    const shapeModeButton = this.get('shape mode button');
    const textModeButton = this.get('text mode button');
    const handModeButton = this.get('hand mode button');
    const haloModeButton = this.get('halo mode button');

    [
      ['Shape', shapeModeButton.submorphs],
      ['Text', [textModeButton]],
      ['Hand', [handModeButton]],
      ['Halo', [haloModeButton]]
    ].forEach(([modeName, morphsToUpdate]) => {
      if (mode == 'Shape') {
        this.toggleShapeMode(target, true, this.currentShapeMode);
      } else if (mode == 'Text') {
        this.toggleShapeMode(target, true, 'Text');
      } else {
        this.toggleShapeMode(target, false);
      }
      this.showHaloPreviews(mode == 'Halo');
      if (!shallow && mode != 'Halo') this.world().halos().forEach(h => h.remove());

      if (modeName == mode) {
        morphsToUpdate.forEach(m => {
          m.dropShadow = haloShadow;
          m.fontColor = haloColor;
        });
      } else {
        morphsToUpdate.forEach(m => {
          m.dropShadow = null;
          m.fontColor = defaultColor;
        });
      }
    });
  }

  canBeCreatedViaDrag (klass) {
    return this.shapesCreatedViaDrag.includes(klass);
  }

  toggleShapeMode (target, active, shapeName) {
    const shapeToClass = this.shapeToClass;
    if (active) {
      target.nativeCursor = 'crosshair';
      target._yieldShapeOnClick = shapeToClass[shapeName];
    } else {
      target._yieldShapeOnClick = false;
      target.nativeCursor = 'auto';
    }
  }

  handleShapeCreation (evt) {
    const target = this.primaryTarget || this.world();
    const type = target._yieldShapeOnClick;
    if (!type) return false;
    if (target._sizeTooltip) target._sizeTooltip.remove();
    if (evt.targetMorph != target) return false;
    if (target._shapeRequest && type && !target._yieldedShape) {
      const position = target.localize(this.world().firstHand.position);
      switch (type) {
        case Image:
          target.addMorph(morph({
            type,
            position,
            extent: pt(150, 150),
            fill: Color.transparent,
            imageUrl: 'https://i.imgur.com/uGRFZEs.jpg'
          }));
          break;
        case Label:
          target.addMorph(morph({
            type,
            position,
            value: 'I am a label!',
            fill: Color.transparent
          }));
          break;
        case Text:
          if (evt.targetMorph.isText) return;
          target.addMorph(morph({
            type,
            position,
            readOnly: true,
            textString: 'I am a text field!',
            fill: Color.transparent
          }));
          break;
      }
    }
    if (type == Text && target._yieldedShape) {
      target._yieldedShape.focus();
    } else if (target._yieldedShape && target._yieldedShape.owner) {
      this.showHaloFor(target._yieldedShape);
    }
    target._yieldedShape = null;
    target._shapeRequest = false;
  }

  prepareShapeCreation (evt) {
    const target = this.primaryTarget || this.world();
    const type = target._yieldShapeOnClick;
    if (!type) return false;
    if (!this.canBeCreatedViaDrag(type)) return false;
    target._yieldedShape = morph({
      type,
      position: evt.positionIn(target),
      extent: pt(1, 1),
      fill: Color.transparent,
      borderWidth: 1,
      borderColor: Color.rgb(23, 160, 251),
      fixedHeight: true,
      fixedWidth: true,
      lineWrapping: true,
      ...type == Text ? this.getDefaultTextAttrs() : {},
      ...type == Image ? this.getImageDefaultAttrs() : {},
      ...type == Polygon ? this.getPolyDefaultAttrs() : {},
      ...type == Path ? this.getPathDefaultAttrs() : {}
    });
    target._sizeTooltip = morph({
      type: Tooltip,
      padding: Rectangle.inset(5, 5, 5, 5),
      styleClasses: ['Tooltip']
    }).openInWorld();
    return true;
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

  getImageDefaultAttrs () {
    return {
      imageUrl: 'https://i.imgur.com/uGRFZEs.jpg' // everyone's favorite
    };
  }

  getDefaultTextAttrs () {
    return {
      readOnly: true
    };
  }

  yieldShapeIfNeeded (evt) {
    const target = this.primaryTarget || this.world();
    if (target._yieldedShape) {
      if (!target._yieldedShape.owner && evt.state.absDragDelta.r() > 10) target.addMorph(target._yieldedShape);
      target._yieldedShape.extent = evt.positionIn(target.world()).subPt(evt.state.dragStartPosition).subPt(pt(1, 1)).maxPt(pt(1, 1));
      target._sizeTooltip.description = `${target._yieldShapeOnClick[Symbol.for('__LivelyClassName__')]}: ${target._yieldedShape.width.toFixed(0)}x${target._yieldedShape.height.toFixed(0)}`;
      target._sizeTooltip.topLeft = evt.positionIn(target.world()).addXY(15, 15);
      return true;
    }
    return false;
  }

  handleHaloSelection (evt) {
    const world = this.world();
    const target = this.primaryTarget || world;
    const [currentHalo] = world.halos();
    if (this._showHaloPreview && this._currentlyHighlighted && world.halos().length == 0) {
      evt.stop();
      world.getSubmorphsByStyleClassName('HaloPreview').forEach(m => m.remove());
      this.showHaloFor(this._currentlyHighlighted);
    }
    if (currentHalo &&
        currentHalo.target == evt.state.prevClick.clickedOnMorph &&
        evt.targetMorph.name == 'border-box' &&
        evt.state.timeOfLastActivity - evt.state.prevClick.clickedAtTime < 50) {
      currentHalo.temporaryEditTextMorph(evt);
      return;
    }
    if (evt.targetMorph != target) return;
    target._shapeRequest = true;
  }

  showHaloFor (targets) {
    let halo;
    if (!targets) return;
    if (obj.isArray(targets)) {
      if (targets.length == 0) return;
      halo = this.world().showHaloForSelection(targets);
    } else halo = this.world().showHaloFor(targets);
    once(halo, 'remove', () => {
      if (halo.target != this.world().focusedMorph) {
        signal(this.primaryTarget, 'onHaloRemoved', targets);
      }
    });
    if (!this.activeHaloItems.includes('*')) {
      halo.activeItems = this.activeHaloItems;
    }
    halo.topBar = this;
    signal(this.primaryTarget, 'onHaloOpened', targets);
  }

  handleHaloPreview (evt) {
    if (this._showHaloPreview) {
      const { haloFilterFn } = this;
      const target = this.primaryTarget || this.world();
      let morphsContainingPoint = target.morphsContainingPoint(evt.positionIn(target.world()));
      if (evt.type == 'hoverout') {
        morphsContainingPoint = [target];
      }
      const haloTarget = morphsContainingPoint.filter(m => {
        return haloFilterFn(m) &&
               m.halosEnabled &&
               [m, ...m.ownerChain()].every(m => m.visible && m.opacity > 0 &&
               !m.styleClasses.includes('HaloPreview'));
      })[0];
      // when we are hovering a menu item or one of the sidebars, then we do not trigger the halo preview
      if (morphsContainingPoint.find(m => m.isMenuItem || m == this.sideBar || m == this.stylingPalette)) {
        this._currentlyHighlighted = false;
        this.clearHaloPreviews();
        return;
      }
      this.showHaloPreviewFor(haloTarget);
    }
  }

  showHaloPreviewFor (aMorph) {
    const target = this.primaryTarget || this.world();
    if (!aMorph) return;
    if (![aMorph, ...aMorph.ownerChain()].find(m => m.isComponent) && aMorph.getWindow()) aMorph = null; // do not inspect windows
    else if ([aMorph, ...aMorph.ownerChain()].find(m => m.isEpiMorph)) aMorph = null; // do not inspect epi morphs
    else if (aMorph == target) aMorph = null; // reset halo preview
    // if the previously highlighted morph is different one, then clean all exisiting previews
    if (this._currentlyHighlighted != aMorph) {
      this.clearHaloPreviews();
      this._currentlyHighlighted = aMorph;
    }

    if (this.world().halos().length > 0) return;

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

    if (!preview.owner) this.world().addMorph(preview);
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

  // this.showHaloPreviews(true);

  showHaloPreviews (active) {
    if (!active) {
      this.clearHaloPreviews();
    }
    this._showHaloPreview = active;
  }

  clearHaloPreviews () {
    this.world().getSubmorphsByStyleClassName('HaloPreview').forEach(m => m.remove());
  }

  prepareDragSelection (evt) {
    const target = this.primaryTarget || this.world();
    const world = target.world();
    this._selectionStartPos = evt.positionIn(world);
    this._morphSelection = world.addMorph({
      type: Selection,
      epiMorph: true,
      reactsToPointer: false,
      position: this._selectionStartPos,
      extent: evt.state.dragDelta
    });
    this._selectedMorphs = {};
  }

  adjustDragSelection (evt) {
    const target = this.primaryTarget || this.world();
    const world = target.world();
    const selectionBounds = Rectangle.fromAny(evt.position, this._selectionStartPos);
    this._morphSelection.setBounds(selectionBounds);
    target.submorphs.forEach(c => {
      if (c.isSelectionElement || c.isHand) return;
      const candidateBounds = c.globalBounds();
      const included = selectionBounds.containsRect(candidateBounds);

      if (!this._selectedMorphs[c.id] && included) {
        this._selectedMorphs[c.id] = world.addMorph({
          type: SelectionElement,
          bounds: candidateBounds
        }, this._morphSelection);
      }
      if (this._selectedMorphs[c.id] && !included) {
        this._selectedMorphs[c.id].remove();
        delete this._selectedMorphs[c.id];
      }
    });
  }

  // called from onDragEnd
  finishDragSelectionIfNeeded (evt) {
    if (this._morphSelection) {
      const world = this.world();
      this._morphSelection.fadeOut(200);
      obj.values(this._selectedMorphs).map(m => m.remove());
      this.showHaloFor(
        Object.keys(this._selectedMorphs)
          .map(id => world.getMorphWithId(id))
      );
      this._selectedMorphs = {};
      this._morphSelection = null;
    }
  }

  onTargetDragStart (evt) {
    if (!this.prepareShapeCreation(evt) && evt.leftMouseButtonPressed()) {
      this.prepareDragSelection(evt);
    }
  }

  onTargetDrag (evt) {
    if (!this.yieldShapeIfNeeded(evt) && this._morphSelection) {
      this.adjustDragSelection(evt);
    }
  }

  detachFromTarget (target) {
    disconnect(target, 'onMouseMove', this, 'handleHaloPreview');
    disconnect(target, 'onMouseDown', this, 'handleHaloSelection');
    disconnect(target, 'onMouseUp', this, 'handleShapeCreation');
    disconnect(target, 'onDragStart', this, 'onTargetDragStart');
    disconnect(target, 'onDrag', this, 'onTargetDrag');
    disconnect(target, 'onDragEnd', this, 'finishDragSelectionIfNeeded');
  }

  attachToTarget (target) {
    if (this.primaryTarget) this.detachFromTarget(this.primaryTarget);
    this.primaryTarget = target;
    this.setEditMode('Halo');
    // target = this.primaryTarget
    // setup connections
    connect(target, 'onMouseMove', this, 'handleHaloPreview', {
      garbageCollect: true
    });
    connect(target, 'onHoverOut', this, 'handleHaloPreview', {
      garbageCollect: true
    });
    connect(target, 'onMouseDown', this, 'handleHaloSelection', {
      garbageCollect: true
    });
    connect(target, 'onMouseUp', this, 'handleShapeCreation', {
      garbageCollect: true
    });
    connect(target, 'onDragStart', this, 'onTargetDragStart', {
      garbageCollect: true
    });
    connect(target, 'onDrag', this, 'onTargetDrag', {
      garbageCollect: true
    });
    connect(target, 'onDragEnd', this, 'finishDragSelectionIfNeeded', {
      garbageCollect: true
    });
  }
}

