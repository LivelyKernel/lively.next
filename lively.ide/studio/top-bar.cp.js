import { Color, Rectangle, LinearGradient, rect, pt } from 'lively.graphics';
import { config, touchInputDevice, TilingLayout, morph, Text, Polygon, Path, HTMLMorph, Ellipse, Morph, Image, Label, ShadowObject, Icon, component, ViewModel, part } from 'lively.morphic';
import { Canvas } from 'lively.components/canvas.js';
import { Closure, string, obj, arr } from 'lively.lang';
import { resource } from 'lively.resources';
import { CommentBrowser } from 'lively.collab';
import { once, connect, disconnect, signal } from 'lively.bindings';
import { getClassName } from 'lively.serializer2';
import { Selection, SelectionElement } from '../world.js';
import { UserRegistry } from 'lively.user';
import { UserUI } from 'lively.user/morphic/user-ui.js';
import { SystemTooltip } from 'lively.morphic/tooltips.cp.js';

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
    let active = Object.values(this.loadConfig).every(v => v === 'frozen');
    label.master = bolt.master = toggleIndicator.master = active ? TopBarButtonSelected : TopBarButton; // eslint-disable-line no-use-before-define
    toggleIndicator.textAndAttributes = Icon.textAttribute(active ? 'toggle-on' : 'toggle-off');
  }

  toggleFastLoad () {
    const { loadConfig } = this;
    let active = Object.values(loadConfig).every(v => v === 'frozen');
    for (let key in loadConfig) loadConfig[key] = active ? 'dynamic' : 'frozen';
    this.loadConfig = loadConfig;
    this.refresh();
  }
}

export class TopBarModel extends ViewModel {
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
      currentShapeMode: {
        defaultValue: 'Rectangle',
        set (shapeName) {
          this.setProperty('currentShapeMode', shapeName);
          this.ui.shapeStatusIcon.textAndAttributes = Icon.textAttribute(this.shapeToIcon[shapeName].args[0]);
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
      },
      expose: { get () { return ['relayout', 'attachToTarget', 'setEditMode', 'showCurrentUser', 'showHaloFor', 'colorCommentBrowserButton', 'uncolorCommentBrowserButton']; } },
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'onMouseDown' },
            { signal: 'onKeyDown', handler: 'onKeyDown' },
            { signal: 'onKeyUp', handler: 'onKeyUp' }
          ];
        }
      }
    };
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    addFn('haloFilterFn', this.getProperty('haloFilterFn'));
  }

  onMouseDown (evt) {
    const selector = this.ui.selectShapeType;
    const shapeModeButton = this.ui.shapeModeButton;
    const target = this.primaryTarget || this.world();
    if (evt.targetMorph === selector) {
      const menu = this.world().openWorldMenu(evt, this.getShapeMenuItems());
      menu.position = shapeModeButton.globalBounds().bottomLeft().subPt(this.world().scroll);
    }

    if (evt.targetMorph.name === 'undo button') {
      target.execCommand('undo');
    }

    if (evt.targetMorph.name === 'redo button') {
      target.execCommand('redo');
    }

    if (evt.targetMorph.name === 'save button') {
      $world.execCommand('save world');
    }

    if (evt.targetMorph === shapeModeButton) {
      this.setEditMode('Shape');
    }

    if (evt.targetMorph.name === 'text mode button') {
      this.setEditMode('Text');
    }

    if (evt.targetMorph.name === 'hand mode button') {
      this.setEditMode('Hand');
    }

    if (evt.targetMorph.name === 'halo mode button') {
      this.setEditMode('Halo');
    }

    if (evt.targetMorph.name === 'open component browser') {
      this.interactivelyLoadComponent();
    }

    if (evt.targetMorph.name === 'load world button') {
      this.world().execCommand('load world');
    }

    if (evt.targetMorph.name === 'comment browser button') {
      this.toggleCommentBrowser();
    }
  }

  onKeyUp (evt) {
    if (this._tmpEditMode === 'Hand') {
      this.setEditMode('Hand', true);
    }
  }

  onKeyDown (evt) {
    if (evt.isCommandKey()) {
      // temporary toggle halo mode
      if (this._tmpEditMode === 'Hand') {
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

  // only works for shapes that are created via drag as of now
  registerCustomShape (shapeName, klass, shapeKey, iconArgs) {
    this.shapeToClass[shapeName] = klass;
    this.keyToShape[shapeKey] = shapeName;
    this.shapeToIcon[shapeName] = { shortcut: shapeKey, args: iconArgs };
    this.shapesCreatedViaDrag.push(klass);
  }

  onUserChanged (evt) {
    try {
      this.ui.userFlap.onUserChanged(evt);
    } finally {}
  }

  relayout () {
    this.ui.ipadStatusBar.width = this.view.width = this.world().visibleBounds().width;
    this.view.position = pt(0, 0);
  }

  adjustElements () {
    const statusBar = this.ui.ipadStatusBar;
    if (statusBar) statusBar.width = this.view.width;
    if (this.ui.userFlap.owner === this) { // only adjust position if this flap is within top bar
      this.ui.userFlap.right = this.width - 10;
      this.ui.userFlap.visible = this.width > 750;
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

  colorCommentBrowserButton () {
    const label = this.ui.commentBrowserButton;
    label.master = TopBarButtonSelected; // eslint-disable-line no-use-before-define
  }

  uncolorCommentBrowserButton () {
    const label = this.ui.commentBrowserButton;
    label.master = TopBarButton; // eslint-disable-line no-use-before-define
  }

  toggleCommentBrowser () {
    const commentBrowser = $world.getSubmorphNamed('Comment Browser');
    if (commentBrowser) {
      this.uncolorCommentBrowserButton();
      commentBrowser.getWindow().close();
    } else {
      this.colorCommentBrowserButton();
      part(CommentBrowser).openInWindow();
    }
  }

  async interactivelyLoadComponent () {
    const label = this.ui.openComponentBrowser;
    label.master = TopBarButtonSelected; // eslint-disable-line no-use-before-define
    await this.world().execCommand('browse and load component');
    label.master = null;
  }

  setEditMode (mode, shallow = false) {
    this.editMode = mode;
    const target = this.primaryTarget || this.world();
    if (!target) return;
    if (!shallow) this._tmpEditMode = mode;

    const {
      shapeModeButton,
      textModeButton,
      handModeButton,
      haloModeButton
    } = this.ui;

    [
      ['Shape', shapeModeButton.submorphs],
      ['Text', [textModeButton]],
      ['Hand', [handModeButton]],
      ['Halo', [haloModeButton]]
    ].forEach(([modeName, morphsToUpdate]) => {
      if (mode === 'Shape') {
        this.toggleShapeMode(target, true, this.currentShapeMode);
      } else if (mode === 'Text') {
        this.toggleShapeMode(target, true, 'Text');
      } else {
        this.toggleShapeMode(target, false);
      }
      this.showHaloPreviews(mode === 'Halo');
      if (!shallow && mode !== 'Halo') this.world().halos().forEach(h => h.remove());

      if (modeName === mode) {
        morphsToUpdate.forEach(m => {
          m.master = TopBarButtonSelected; // eslint-disable-line no-use-before-define
        });
      } else {
        morphsToUpdate.forEach(m => {
          m.master = null;
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
    if (this._customDrag) {
      this._customDrag = false;
      this.world().halos()[0]?.onDragEnd();
    }

    const target = this.primaryTarget || this.world();
    const type = target._yieldShapeOnClick;
    if (!type) return false;
    if (target._sizeTooltip) target._sizeTooltip.remove();
    if (evt.targetMorph !== target) return false;
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
    if (type === Text && target._yieldedShape) {
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
      ...type === Text ? this.getDefaultTextAttrs() : {},
      ...type === Image ? this.getImageDefaultAttrs() : {},
      ...type === Polygon ? this.getPolyDefaultAttrs() : {},
      ...type === Path ? this.getPathDefaultAttrs() : {}
    });

    target._sizeTooltip = part(SystemTooltip);
    target._sizeTooltip.openInWorld();
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
    if (this._showHaloPreview && this._currentlyHighlighted && world.halos().length === 0) {
      evt.stop();
      world.getSubmorphsByStyleClassName('HaloPreview').forEach(m => m.remove());
      this.showHaloFor(this._currentlyHighlighted);
    }
    if (currentHalo &&
        currentHalo.target === evt.state.prevClick.clickedOnMorph &&
        evt.targetMorph.name === 'border-box' &&
        evt.state.timeOfLastActivity - evt.state.prevClick.clickedAtTime < 50) {
      currentHalo.temporaryEditTextMorph(evt);
      return;
    }
    if (evt.targetMorph !== target) return;
    target._shapeRequest = true;
  }

  showHaloFor (targets) {
    let halo;
    if (!targets) return;
    if (obj.isArray(targets)) {
      if (targets.length === 0) return;
      halo = this.world().showHaloForSelection(targets);
    } else {
      halo = this.world().showHaloFor(targets);
    }
    once(halo, 'remove', () => {
      if (halo.target !== this.world().focusedMorph) {
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
      if (evt.type === 'hoverout') {
        morphsContainingPoint = [target];
      }
      const haloTarget = morphsContainingPoint.filter(m => {
        return haloFilterFn(m) &&
               m.halosEnabled &&
               [m, ...m.ownerChain()].every(m => m.visible && m.opacity > 0 &&
               !m.styleClasses.includes('HaloPreview'));
      })[0];
      // when we are hovering a menu item or one of the sidebars, then we do not trigger the halo preview
      if (morphsContainingPoint.find(m => m.isMenuItem || m === this.sideBar || m === this.propertiesPanel)) {
        this._currentlyHighlighted = false;
        this.clearHaloPreviews();
        return;
      }
      this.showHaloPreviewFor(haloTarget);
    }

    if (evt.state.draggedMorph) return;

    const [halo] = this.world().halos();

    if (halo &&
        this._customDrag &&
        evt.leftMouseButtonPressed()) {
      halo.customDrag(evt);
    }

    if (evt.leftMouseButtonPressed() &&
        !this._customDrag &&
        !evt.state.draggedMorph &&
        evt.startPosition &&
        evt.startPosition.subPt(evt.position).r() > 25 &&
        halo &&
        halo.fullContainsPoint(evt.position)) {
      halo.onDragStart(evt);
      this._customDrag = true;
    }
  }

  showHaloPreviewFor (aMorph) {
    const target = this.primaryTarget || this.world();
    if (!aMorph) return;
    if (![aMorph, ...aMorph.ownerChain()].find(m => m.isComponent) && aMorph.getWindow()) aMorph = null; // do not inspect windows
    else if ([aMorph, ...aMorph.ownerChain()].find(m => m.isEpiMorph)) aMorph = null; // do not inspect epi morphs
    else if (aMorph === target) aMorph = null; // reset halo preview
    // if the previously highlighted morph is different one, then clean all exisiting previews
    if (this._currentlyHighlighted !== aMorph) {
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

  showCurrentUser () {
    const { userFlap } = this.models;
    userFlap.showUser(userFlap.currentUser(), false);
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
    try {
      target.draggable = true;
    } catch (err) {
      // sometimes draggable is read only...
    }
  }
}

export class UserFlapModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['isUserFlap', 'isMaximized', 'updateNetworkIndicator', 'alignInWorld'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onBlur', handler: 'collapse' },
            { target: 'avatar', signal: 'onMouseDown', handler: 'maximize' },
            { target: 'keyboard input', signal: 'onMouseDown', handler: 'toggleKeyboardInput' },
            { target: 'profile item', signal: 'onMouseDown', handler: 'showCurrentUserInfo' },
            { target: 'logout item', signal: 'onMouseDown', handler: 'logoutCurrentUser' },
            { target: 'login item', signal: 'onMouseDown', handler: 'showCurrentUserLogin' },
            { target: 'register item', signal: 'onMouseDown', handler: 'showRegister' }
          ];
        }
      }
    };
  }

  get isUserFlap () { return true; }

  async collapse () {
    this.minimize();
    await this.view.whenRendered();
    if (this.world().focusedMorph.ownerChain().includes(this.view)) { this.view.focus(); }
  }

  open () {
    this.openInWorld();
    this.showUser(this.currentUser(), false);
    this.alignInWorld(false);
    this.hasFixedPosition = true;
    return this;
  }

  showCurrentUserInfo () {
    this.showUserInfo(this.currentUser());
  }

  async logoutCurrentUser () {
    await this.minimize();
    await this.logout(this.currentUser());
  }

  showCurrentUserLogin () {
    this.showLogin(this.currentUser());
  }

  toggleKeyboardInput (active = !touchInputDevice) {
    const keyboardToggleButton = this.ui.keyboardInput;
    if (!active) {
      keyboardToggleButton.fontColor = this.fontColor;
      keyboardToggleButton.dropShadow = false;
    } else {
      keyboardToggleButton.fontColor = Color.rgb(0, 176, 255);
      keyboardToggleButton.dropShadow = this.haloShadow;
    }
  }

  currentUser () {
    return UserRegistry.current.loadUserFromLocalStorage(config.users.authServerURL);
  }

  onUserChanged (evt) {
    this.showUser(evt.user || { name: '???' }, false);
  }

  onWorldResize (evt) { !this.isComponent && this.alignInWorld(); }

  relayout () { this.alignInWorld(); }

  async alignInWorld (animated) {
    const { owner } = this.view;
    if (!owner) return;
    await this.view.whenRendered();

    if (this.view.hasFixedPosition && owner.isWorld) {
      this.view.topRight = pt(this.world().visibleBounds().width, 0);
    } else if (owner.isWorld) {
      const tr = $world.visibleBounds().topRight().withY(0).subXY(10, 0);
      if (animated) this.view.animate({ topRight: tr, duration: 200 });
      else this.view.topRight = tr;
    }
  }

  async minimize () {
    const menu = this.ui.userMenu;
    if (!menu) return;
    await menu.animate({
      opacity: 0,
      scale: 0.8,
      duration: 200
    });
    menu.visible = false;
  }

  ensureMenu () {
    const menu = this.ui.userMenu || this.view.addMorph(part(UserMenu, { name: 'user menu' })); // eslint-disable-line no-use-before-define
    menu.visible = false;
    menu.opacity = 0;
    menu.scale = 0.8;
    menu.position = this.ui.avatar.bottomCenter.addXY(0, 10);
    this.reifyBindings(); // since the menu is now present
    return menu;
  }

  async maximize () {
    this.view.focus();
    let menu = this.ui.userMenu;
    if (!menu) {
      menu = this.ensureMenu();
    }
    menu.right = this.view.width - 5;
    menu.visible = true;
    await menu.animate({
      opacity: 1,
      scale: 1,
      duration: 200
    });
  }

  async changeWidthAndHeight (newWidth, newHeight, animated) {
    if (animated) {
      await this.animate({
        position: this.position.addXY(this.width - newWidth, 0),
        extent: pt(newWidth, newHeight),
        duration: 200
      });
    } else {
      this.extent = pt(newWidth, newHeight);
      this.position = this.position.addXY(this.width - newWidth, 0);
    }
  }

  showMenuItems (items) {
    this.view.withMetaDo({ metaInteraction: true }, () => {
      const allItems = ['login item', 'logout item', 'profile item', 'register item'];
      arr.withoutAll(allItems, items)
        .map(name => this.view.getSubmorphNamed(name))
        .forEach(m => {
          m.visible = false;
          m.bringToFront();
        });
      items.map(name => this.view.getSubmorphNamed(name))
        .forEach(m => {
          m.visible = true;
        });
    });
  }

  async showUser (user, animated = false) {
    const { nameLabel, userMenu, avatar } = this.ui;
    let userName = String(user.name);
    const gravatar = resource('https://s.gravatar.com/avatar').join(string.md5(user.email || '')).withQuery({ s: 160 }).url;
    this.ensureMenu();
    if (userName.startsWith('guest-')) {
      this.showMenuItems(['login item', 'register item']);
      userName = 'guest';
    } else {
      this.showMenuItems(['logout item', 'profile item']);
    }
    nameLabel.value = userName;
    avatar.imageUrl = gravatar;
    if (userMenu) {
      userMenu.position = avatar.bottomCenter.addXY(0, 10);
    }
    await this.view.whenRendered();
    this.alignInWorld();
  }

  showRegister () { return UserUI.showRegister(); }
  showUserInfo (user) { return UserUI.showUserInfo({ user }); }
  showLogin (user) { return UserUI.showLogin({ user }); }
  logout (user) { return UserRegistry.current.logout(user); }

  updateNetworkIndicator (l2lClient) {
    let color = 'red';
    if (l2lClient) {
      if (l2lClient.isOnline()) color = 'yellow';
      if (l2lClient.isRegistered()) color = 'green';
    }
    this.ui.networkIndicator.animate({
      fill: Color[color], duration: 300
    });
  }
}

const TopBarButton = component({
  type: Label,
  name: 'top bar button',
  fontColor: {
    value: Color.rgb(102, 102, 102),
    onlyAtInstantiation: true
  },
  fontSize: {
    value: 23,
    onlyAtInstantiation: true
  },
  nativeCursor: 'pointer',
  padding: {
    value: rect(0, 1, 0, -1),
    onlyAtInstantiation: true
  }
});

const TopBarButtonSelected = component(TopBarButton, {
  name: 'top bar button selected',
  dropShadow: new ShadowObject({ color: Color.rgba(64, 196, 255, 0.4), fast: false }),
  fontColor: Color.rgb(0, 176, 255)
});

const UserFlap = component({
  name: 'user flap',
  defaultViewModel: UserFlapModel,
  borderColor: {
    bottom: Color.rgb(204, 204, 204),
    left: Color.rgb(204, 204, 204),
    right: Color.rgb(204, 204, 204),
    top: Color.rgb(255, 255, 255)
  },
  position: pt(580.2, 897.3),
  borderRadius: 7,
  clipMode: 'visible',
  extent: pt(362.3, 52.3),
  fontColor: Color.rgb(102, 102, 102),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'right',
    align: 'center',
    autoResize: false,
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 10,
      y: 10
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false,
    spacing: 10
  }),
  submorphs: [{
    type: FastLoadToggler,
    name: 'fast load toggler',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(115.3, 41.1),
    fill: Color.rgba(0, 0, 0, 0),
    tooltip: 'Toggle fast load',
    layout: new TilingLayout({
      axis: 'column',
      axisAlign: 'center',
      align: 'center',
      autoResize: false,
      direction: 'rightToLeft',
      orderByIndex: true,
      padding: {
        height: 0,
        width: 0,
        x: 10,
        y: 10
      },
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      resizeSubmorphs: false,
      spacing: 10
    }),
    submorphs: [
      part(TopBarButton, {
        name: 'bolt',
        fontSize: 17,
        padding: rect(0, 4, 0, -4),
        textAndAttributes: Icon.textAttribute('bolt')
      }), part(TopBarButton, {
        name: 'label',
        fontSize: 16,
        textAndAttributes: ['Fast Load', null]
      }), part(TopBarButton, {
        name: 'toggle indicator',
        fontSize: 23,
        nativeCursor: 'pointer',
        textAndAttributes: Icon.textAttribute('toggle-off')
      })]
  }, {
    name: 'network-indicator',
    borderRadius: 5,
    extent: pt(5, 5),
    fill: Color.rgb(0, 204, 0),
    reactsToPointer: false
  }, {
    type: Label,
    name: 'name label',
    draggable: true,
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: {
      onlyAtInstantiation: true,
      value: Color.rgb(102, 102, 102)
    },
    fontSize: 16,
    grabbable: true,
    nativeCursor: 'pointer',
    reactsToPointer: false,
    textAndAttributes: ['guest', null]
  }, {
    type: Image,
    name: 'avatar',
    borderRadius: 25,
    clipMode: 'hidden',
    dropShadow: new ShadowObject({ rotation: 72, color: Color.rgba(0, 0, 0, 0.47), blur: 5 }),
    extent: pt(30, 30),
    fill: Color.transparent,
    imageUrl: 'https://s.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=160',
    nativeCursor: 'pointer',
    naturalExtent: pt(160, 160)
  }]
});

const DarkUserFlap = component(UserFlap, {
  name: 'dark user flap',
  fill: Color.rgba(255, 255, 255, 0),
  submorphs: [{
    name: 'fast load toggler',
    submorphs: [{
      name: 'bolt',
      fontColor: Color.rgb(255, 255, 255)
    }, {
      name: 'label',
      fontColor: Color.white
    }, {
      name: 'toggle indicator',
      fontColor: Color.rgb(255, 255, 255)
    }]
  }, {
    name: 'name label',
    fontColor: Color.white
  }, {
    name: 'user menu',
    position: pt(15, 40),
    scale: 0.8,
    opacity: 0,
    borderColor: Color.rgb(202, 207, 210),
    borderRadius: 5,
    borderWidth: 1,
    dropShadow: new ShadowObject({ distance: 7, rotation: 75, color: Color.rgba(0, 0, 0, 0.11), blur: 20, fast: false }),
    extent: pt(146.3, 70.9),
    fill: Color.rgb(253, 254, 254),
    isLayoutable: false,
    origin: pt(121.7, -4.7),
    visible: false
  }, {
    name: 'avatar',
    imageUrl: 'https://s.gravatar.com/avatar/81fca83dcbbab5d52e990f7b76aa97ca?s=160'
  }]
});

const ProfileItem = component({
  type: Text,
  name: 'profile item',
  borderColor: Color.rgb(204, 204, 204),
  extent: pt(144, 28.8),
  fill: Color.rgba(0, 0, 0, 0),
  fixedHeight: true,
  fixedWidth: true,
  fontFamily: 'IBM Plex Sans',
  fontSize: 16,
  nativeCursor: 'pointer',
  padding: rect(10, 3, -5, 0),
  position: pt(19.9, 35.6),
  textString: 'Profile',
  readOnly: true,
  selectable: false
});

const ProfileItemSelected = component(ProfileItem, {
  name: 'profile item selected',
  fill: Color.rgb(215, 219, 221)
});

const UserMenu = component({
  name: 'user menu',
  borderColor: Color.rgb(202, 207, 210),
  borderRadius: 5,
  borderWidth: 1,
  dropShadow: new ShadowObject({ distance: 7, rotation: 75, color: Color.rgba(0, 0, 0, 0.11), blur: 20, fast: false }),
  extent: pt(146.3, 70.9),
  fill: Color.rgb(253, 254, 254),
  isLayoutable: false,
  origin: pt(121.7, -4.7),
  position: pt(330.1, 33.2),
  submorphs: [{
    type: Polygon,
    name: 'menu shape',
    borderColor: Color.rgb(202, 207, 210),
    borderWidth: 1,
    extent: pt(20.2, 10.4),
    fill: Color.rgb(253, 254, 254),
    isLayoutable: false,
    position: pt(-10.5, -5.4),
    vertices: [{
      position: pt(0, 10),
      isSmooth: false,
      controlPoints: {
        next: pt(0, 0), previous: pt(0, 0)
      }
    }, {
      position: pt(10, 0),
      isSmooth: false,
      controlPoints: { next: pt(0, 0), previous: pt(0, 0) }
    }, {
      position: pt(20, 10),
      isSmooth: false,
      controlPoints: { next: pt(0, 0), previous: pt(0, 0) }
    }]
  }, {
    name: 'item container',
    layout: new TilingLayout({
      axis: 'column',
      orderByIndex: true,
      wrapSubmorphs: false
    }),
    position: pt(-120.6, 10.9),
    clipMode: 'hidden',
    draggable: true,
    extent: pt(144.2, 65),
    fill: Color.rgba(46, 75, 223, 0),
    grabbable: true,
    submorphs: [
      part(ProfileItem, {
        name: 'profile item',
        master: { auto: ProfileItem, hover: ProfileItemSelected }
      }),
      part(ProfileItem, {
        name: 'login item',
        textString: 'Sign in',
        master: { auto: ProfileItem, hover: ProfileItemSelected }
      }),
      part(ProfileItem, {
        name: 'logout item',
        textString: 'Sign out',
        master: { auto: ProfileItem, hover: ProfileItemSelected }
      }),
      part(ProfileItem, {
        name: 'register item',
        textString: 'Create Account',
        master: { auto: ProfileItem, hover: ProfileItemSelected }
      })
    ]
  }]
});

const TopBar = component({
  name: 'top bar',
  layout: new TilingLayout({
    justifySubmorphs: 'spaced',
    orderByIndex: true,
    wrapSubmorphs: false,
    padding: Rectangle.inset(10, 0, 10, 0)
  }),
  defaultViewModel: TopBarModel,
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.31), blur: 20 }),
  extent: pt(929.1, 49.7),
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.white },
      { offset: 1, color: Color.rgb(229, 231, 233) }
    ],
    vector: rect(0, 0, 0, 1)
  }),
  submorphs: [{
    name: 'tiling layout',
    extent: pt(476.8, 51.1),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new TilingLayout({
      axis: 'column',
      align: 'bottom',
      autoResize: false,
      orderByIndex: true,
      padding: {
        height: 0,
        width: 0,
        x: 13,
        y: 13
      },
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      resizeSubmorphs: false,
      spacing: 13
    }),
    submorphs: [
      part(TopBarButton, {
        name: 'undo button',
        textAndAttributes: Icon.textAttribute('reply'),
        tooltip: 'Undo'
      }),
      part(TopBarButton, {
        name: 'redo button',
        textAndAttributes: Icon.textAttribute('share'),
        tooltip: 'Redo'
      }),
      part(TopBarButton, {
        name: 'save button',
        padding: rect(0, 1, 16, -1),
        textAndAttributes: Icon.textAttribute('save'),
        tooltip: 'Save World'
      }),
      part(TopBarButton, {
        name: 'halo mode button',
        padding: rect(0, 0, 3, 0),
        textAndAttributes: Icon.textAttribute('mouse-pointer'),
        tooltip: 'Halo mode'
      }),
      part(TopBarButton, {
        name: 'hand mode button',
        textAndAttributes: Icon.textAttribute('hand-paper'),
        tooltip: 'Interaction mode'
      }),
      part(TopBarButton, {
        name: 'text mode button',
        textAndAttributes: Icon.textAttribute('font'),
        tooltip: 'Create textbox mode'
      }), {
        name: 'shape mode button',
        extent: pt(55.8, 24.7),
        fill: Color.rgba(46, 75, 223, 0),
        layout: new TilingLayout({
          axis: 'column',
          axisAlign: 'center',
          align: 'center',
          autoResize: false,
          direction: 'leftToRight',
          padding: {
            height: 0,
            width: 0,
            x: 5,
            y: 5
          },
          resizeSubmorphs: false,
          spacing: 5
        }),
        nativeCursor: 'pointer',
        submorphs: [
          part(TopBarButton, {
            name: 'shape status icon',
            reactsToPointer: false,
            textAndAttributes: Icon.textAttribute('square'),
            tooltip: 'Create basic shape mode'
          }),
          part(TopBarButton, {
            name: 'select shape type',
            fontSize: 23,
            nativeCursor: 'pointer',
            textAndAttributes: Icon.textAttribute('angle-down')
          })
        ],
        tooltip: 'Select different shape'
      },
      part(TopBarButton, {
        name: 'open component browser',
        fontSize: 25,
        padding: rect(3, 0, -3, 0),
        textAndAttributes: Icon.textAttribute('cubes'),
        tooltip: 'Browse master components'
      }),
      part(TopBarButton, {
        name: 'load world button',
        padding: rect(3, 0, -3, 0),
        textAndAttributes: Icon.textAttribute('globe'),
        tooltip: 'Load other project'
      }),
      part(TopBarButton, {
        name: 'comment browser button',
        padding: rect(3, 0, -3, 0),
        textAndAttributes: Icon.textAttribute('comment-alt'),
        tooltip: 'Toggle Comment Browser'
      })]
  },
  {
    name: 'ipad status bar',
    isLayoutable: false,
    borderColor: Color.rgba(0, 0, 0, 0),
    extent: pt(929.2, 26),
    fill: Color.rgb(0, 0, 0),
    position: pt(0, -26)
  },
  part(UserFlap, {
    name: 'user flap',
    fill: Color.transparent
  })]
});

export { DarkUserFlap, UserFlap, TopBar, ProfileItem, ProfileItemSelected, UserMenu };
