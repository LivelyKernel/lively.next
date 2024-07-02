/* eslint-disable no-use-before-define */
import { Color, Rectangle, LinearGradient, rect, pt } from 'lively.graphics';
import {
  config, TilingLayout, morph, Text, Polygon,
  Path, HTMLMorph, Ellipse, Morph, Image, ShadowObject, Icon,
  component, ViewModel, part
} from 'lively.morphic';
import { Canvas } from 'lively.components/canvas.js';
import { Closure, fun, obj } from 'lively.lang';

import { once, connect, disconnect, signal } from 'lively.bindings';
import { getClassName } from 'lively.serializer2';
import { SystemTooltip } from 'lively.morphic/tooltips.cp.js';
import { RichTextPlugin } from '../text/rich-text-editor-plugin.js';
import { WorldMiniMap } from '../world-mini-map.cp.js';
import { UserFlap } from 'lively.user/user-flap.cp.js';
import { TopBarButton, TopBarButtonDropDown } from './top-bar-buttons.cp.js';
import { notYetImplemented } from 'lively.lang/function.js';
import { defaultDirectory } from '../shell/shell-interface.js';
import { ProjectSettingsPrompt, RepoCreationPrompt } from 'lively.project/prompts.cp.js';
import { isUserLoggedIn } from 'lively.user';
import { AssetBrowserLight } from './asset-browser.cp.js';
import { StatusMessageError } from 'lively.halos/components/messages.cp.js';

import { OfflineToggleDark } from '../offline-mode-toggle.cp.js';

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

export class Selection extends Morph {
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
        defaultValue: null,
        set (target) {
          delete this._cachedFilterFn;
          this.setProperty('primaryTarget', target);
        }
      },
      haloFilterFn: {
        defaultValue: '() => true',
        derived: true,
        set (fnSource) {
          delete this._cachedFilterFn;
          this.setProperty('haloFilterFn', fnSource);
        },
        get () {
          return this._cachedFilterFn || (this._cachedFilterFn = Closure.fromSource(
            this.getProperty('haloFilterFn'),
            {
              target: this.primaryTarget
            }
          ).asFunction());
        }
      },
      currentShapeMode: {
        defaultValue: 'Rectangle',
        set (shapeName) {
          this.setProperty('currentShapeMode', shapeName);
          this.ui.shapeModeButton.changeIcon(Icon.textAttribute(this.shapeToIcon[shapeName].args[0]));
        }
      },
      shapeToIcon: {
        initialize (prevValue) {
          this.shapeToIcon = prevValue || {
            Rectangle: { shortcut: 'R', args: ['square', {}] },
            Ellipse: { shortcut: 'E', args: ['circle', {}] },
            Image: { shortcut: 'I', args: ['image', {}] },
            Path: { shortcut: 'P', args: ['bezier-curve', { fontSize: 13, paddingTop: '3px' }] },
            Polygon: { shortcut: 'Q', args: ['draw-polygon', { fontSize: 17 }] },
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
      expose: { get () { return ['relayout', 'attachToTarget', 'setEditMode', 'showCurrentUser', 'showHaloFor', 'colorTopbarButton', 'isTopBar', 'mode']; } },
      bindings: {
        get () {
          return [
            { target: 'save button', signal: 'onMouseDown', handler: 'onSaveButtonClicked' },
            { target: 'text mode button', signal: 'onMouseDown', handler: 'setEditMode', converter: () => 'Text' },
            { target: 'shape mode button', signal: 'onMouseDown', handler: 'setEditMode', converter: () => 'Shape' },
            { target: 'shape mode button', signal: 'dropDownTriggered', handler: 'shapeMenu' },
            { target: 'save button', signal: 'dropDownTriggered', handler: 'saveMenu' },
            { target: 'hand or halo mode button', signal: 'dropDownTriggered', handler: 'cursorMenu' },
            { target: 'hand or halo mode button', signal: 'onMouseDown', handler: 'cursorMode' },
            { target: 'open asset browser', signal: 'onMouseDown', handler: 'browseAssets' },
            { target: 'open component browser', signal: 'onMouseDown', handler: 'interactivelyLoadComponent' },
            {
              target: 'canvas mode button',
              signal: 'onMouseDown',
              handler: 'onCanvasModeClicked'
            },
            { target: 'canvas mode button', signal: 'dropDownTriggered', handler: 'canvasMenu' },
            { signal: 'onKeyDown', handler: 'onKeyDown' },
            { signal: 'onKeyUp', handler: 'onKeyUp' }
          ];
        }
      }
    };
  }

  get mode () {
    return this.editMode;
  }

  get isTopBar () {
    return true;
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    addFn('haloFilterFn', this.getProperty('haloFilterFn'));
  }

  viewDidLoad () {
    if (config.ide.studio.worldMenuInTopBar) {
      const worldMenuButton = part(TopBarButton, {
        name: 'world menu button',
        textAndAttributes: Icon.textAttribute('burger'),
        tooltip: 'Open World Menu'
      });
      this.ui.tilingLayout.addMorphAt(worldMenuButton, 0);
      connect(worldMenuButton, 'onMouseDown', () => {
        $world.openMenu($world.menuItems());
      });
    }

    if ($world.playgroundsMode) {
      this.ui.saveButton.removeDropdown();
    }
  }

  shapeMenu (evt) {
    const pos = this.ui.shapeModeButton.globalBounds().bottomLeft().subPt($world.scroll);
    $world.openWorldMenu(evt, this.getShapeMenuItems(), pos);
  }

  async saveMenu (evt) {
    const pos = this.ui.saveButton.globalBounds().bottomLeft().subPt($world.scroll);
    $world.openWorldMenu(evt, (await this.getSaveMenuItems()), pos);
  }

  cursorMenu (evt) {
    const pos = this.ui.handOrHaloModeButton.globalBounds().bottomLeft().subPt($world.scroll);
    $world.openWorldMenu(evt, this.getHandAndHaloModeItems(), pos);
  }

  cursorMode () {
    const currentlyShowingHaloIcon = this.ui.handOrHaloModeButton.getIcon()[0] === Icon.textAttribute('arrow-pointer')[0];
    this.setEditMode(currentlyShowingHaloIcon ? 'Halo' : 'Hand');
  }

  canvasMenu (evt) {
    const pos = this.ui.canvasModeButton.globalBounds().bottomLeft().subPt(this.world().scroll);
    this.world().openWorldMenu(evt, this.getCanvasModeItems(), pos);
  }

  onKeyUp () {
    if (this._tmpEditMode === 'Hand') {
      this.setEditMode('Hand', true);
    }
  }

  onKeyDown (evt) {
    if (evt.isCommandKey()) {
      if (this.primaryTarget.isIDEWorld) return;
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

  onSaveButtonClicked (evt) {
    if (this.ui.saveButton === evt.targetMorphs[0]) $world.execCommand('save world or project');
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
    } finally { }
  }

  relayout () {
    this.ui.ipadStatusBar.width = this.view.width = $world.visibleBounds().width;
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

  async getSaveMenuItems () {
    if (!isUserLoggedIn()) {
      $world.setStatusMessage('You need to log in using GitHub.', StatusMessageError);
      $world.get('user flap').show();
      return;
    }
    return [
      [['💾', { fontFamily: 'Noto Emoji' }, ' Save this workspace', null], () => { notYetImplemented('Saving workspaces'); }],
      [['💾', { fontFamily: 'Noto Emoji' }, ' Save this workspace under different name', null], () => { notYetImplemented('Saving workspaces'); }],
      (await $world.openedProject?.hasRemoteConfigured())
        ? [['⚙️', { fontFamily: 'Noto Emoji' }, ' Change Project Settings', null], () => {
            $world.openPrompt(part(ProjectSettingsPrompt, { viewModel: { project: $world.openedProject }, hasFixedPosition: true }));
          }]
        : ([['🌏', { fontFamily: 'Noto Emoji' }, ' Create Remote Repository', null], async () => {
            if (lively.isInOfflineMode) {
              $world.setStatusMessage('Operation not available, as you are in offline mode!');
              return;
            }
            if (!isUserLoggedIn()) {
              $world.setStatusMessage('You need to log in using github.');
              $world.get('user flap').show();
              return;
            }
            $world.openPrompt(part(RepoCreationPrompt, { viewModel: { project: $world.openedProject }, hasFixedPosition: true }));
          }]),
      [['🧑‍💻', { fontFamily: 'Noto Emoji' }, ' Open a Terminal (advanced operation)', null], async () => {
        // This relies on the assumption, that the default directory the shell command gets dropped in is `lively.server`.
        const serverDir = await defaultDirectory();
        const projectsDir = serverDir.replace('lively.server', '') + 'local_projects/';
        const projectDir = projectsDir + `${$world.openedProject.repoOwner}--${$world.openedProject.name}`;
        $world.execCommand('open shell terminal', { cwd: projectDir, position: $world.center.subXY(300, 150) });
      }
      ]
    ];
  }

  getHandAndHaloModeItems () {
    return [
      [[
        ...this.editMode === 'Halo'
          ? [
              ...Icon.textAttribute('check', {
                fontSize: 11,
                paddingTop: '2px'
              }), '    ', {}
            ]
          : ['     ', {}],
        ...Icon.textAttribute('arrow-pointer', { paddingLeft: '6px', paddingRight: '2px' }), '   Editing '
      ], () => this.setEditMode('Halo')],
      [
        [
          ...this.editMode === 'Hand'
            ? [
                ...Icon.textAttribute('check', {
                  fontSize: 11,
                  paddingTop: '2px'
                }), '   ', {}
              ]
            : ['       ', {}],
          ...Icon.textAttribute('hand'), '   Interacting '
        ],
        () => this.setEditMode('Hand')
      ]
    ];
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
          '      ' + shortcut, { fontSize: 11, opacity: 0.5, fontFamily: 'IBM Plex Mono', textStyleClasses: ['annotation'] }
        ], () => {
          this.currentShapeMode = shapeName;
          this.setEditMode('Shape');
        }
      ];
    });
  }

  // When we have a control panel this should be moved there with a toggle as would be appropriate.
  getCanvasModeItems () {
    return [
      [
        [
          ...config.ide.studio.canvasModeEnabled
            ? Icon.textAttribute('check-square', {
              fontSize: 18,
              paddingTop: '2px'
            })

            : Icon.textAttribute('square', {
              fontSize: 18,
              paddingTop: '2px'
            }),
          '  Enabled '
        ], async () => {
          const currentMode = config.ide.studio.canvasModeEnabled;
          let changeMode = true;
          if (!currentMode) {
            changeMode = await $world.confirm('Confirm to activate Canvas Mode. This will reset the scale of all open Morphs to 1!');
          }
          if (!changeMode) return;
          config.ide.studio.canvasModeEnabled = !config.ide.studio.canvasModeEnabled;
          if (config.ide.studio.canvasModeEnabled) document.body.style['overscroll-behavior-x'] = 'none';
          else document.body.style['overscroll-behavior-x'] = 'auto';
          $world.resetScaleFactor();
          !config.ide.studio.canvasModeEnabled ? this.toggleMiniMap(false) : this.toggleMiniMap();
        }
      ]
    ];
  }

  colorTopbarButton (button, active) {
    button.master.setState(active ? 'selected' : null);
  }

  onCanvasModeClicked (evt) {
    if (this.ui.canvasModeButton === evt.targetMorphs[0]) this.toggleMiniMap(null);
  }

  toggleMiniMap (forceState) {
    let miniMap = $world.getSubmorphNamed('world mini map');
    if (miniMap && forceState !== true && forceState !== undefined) {
      this.ui.canvasModeButton.deactivateButton();
      miniMap.remove();
      $world.getSubmorphNamed('world zoom indicator').relayout();
    } else if (!miniMap && forceState !== false && forceState !== undefined) {
      this.ui.canvasModeButton.activateButton();
      const miniMap = part(WorldMiniMap).openInWorld();
      miniMap.relayout();
      $world.getSubmorphNamed('world zoom indicator').relayout();
    }
  }

  async browseAssets () {
    fun.guardNamed('loadingAssetBrowser', async () => {
      if (!$world._assetBrowser) {
        this.colorTopbarButton(this.ui.openAssetBrowser, true);
        const assetBrowser = part(AssetBrowserLight, { extent: pt(520, 600) });
        await assetBrowser.initialize();
        const win = assetBrowser.openInWindow({ title: 'Asset Browser' });
        assetBrowser.container = win;
        $world._assetBrowser = assetBrowser;
        once(win, 'close', () => {
          this.colorTopbarButton(this.ui.openAssetBrowser, false);
          $world._assetBrowser = null;
        });
      } else {
        $world._assetBrowser.getWindow().close();
        $world._assetBrowser = null;
        this.colorTopbarButton(this.ui.openAssetBrowser, false);
      }
    })();
  }

  async interactivelyLoadComponent () {
    if ($world._loadingComponentBrowser) return;
    let currComponentBrowser = this.world()._componentBrowser;
    if (currComponentBrowser && !!currComponentBrowser.world()) {
      return currComponentBrowser.getWindow().close(false);
    }
    this.colorTopbarButton(this.ui.openComponentBrowser, true);
    this.world().execCommand('browse and load component');

    this.colorTopbarButton(this.ui.openComponentBrowser, false);
  }

  setEditMode (mode, shallow = false, isTemporary = false) {
    this.editMode = mode;
    const target = this.primaryTarget || $world;
    if (!target) return;
    if (!shallow) this._tmpEditMode = mode;

    if (!isTemporary && (mode === 'Halo' || mode === 'Hand')) this.view.recoverMode = mode;
    const {
      shapeModeButton,
      textModeButton,
      handOrHaloModeButton
    } = this.ui;

    [
      ['Shape', shapeModeButton],
      ['Text', textModeButton],
      ['Hand', handOrHaloModeButton],
      ['Halo', handOrHaloModeButton]
    ].forEach(([modeName, morphToUpdate]) => {
      if (mode === 'Halo') { this.ui.handOrHaloModeButton.changeIcon(Icon.textAttribute('arrow-pointer', { paddingLeft: '7px' })); }
      if (mode === 'Hand') { this.ui.handOrHaloModeButton.changeIcon(Icon.textAttribute('hand')); }
      if (mode === 'Shape') {
        this.toggleShapeMode(target, true, this.currentShapeMode);
      } else if (mode === 'Text') {
        this.toggleShapeMode(target, true, 'Text');
      } else {
        this.toggleShapeMode(target, false);
      }
      this.showHaloPreviews(mode === 'Halo');
      if (!shallow && mode !== 'Halo') $world.halos().forEach(h => h.remove());

      if (modeName === mode) {
        morphToUpdate.activateButton();
        // we need to take into account that hand and halo mode share the same button
      } else if (!((mode === 'Hand' && modeName === 'Halo') || mode === 'Halo' && modeName === 'Hand')) {
        morphToUpdate.deactivateButton();
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
      $world.halos()[0]?.onDragEnd();
    }

    const target = this.primaryTarget || $world;
    const type = target._yieldShapeOnClick;
    if (!type) return false;
    if (target._sizeTooltip) target._sizeTooltip.remove();
    if (evt.targetMorph !== target) return false;
    if (target._shapeRequest && type && !target._yieldedShape) {
      const position = target.localize($world.firstHand.position);
      switch (type) {
        case Image:
          target.addMorph(morph({
            type,
            position,
            extent: pt(150, 150),
            fill: Color.transparent
          }));
          break;
        case Text:
          if (evt.targetMorph.isText) return;
          const textMorph = morph({
            type,
            position,
            readOnly: true,
            textString: 'I am a text field!',
            dynamicCursorColoring: true,
            fill: Color.rgbHex('FFFFFF')
          });
          textMorph.addPlugin(new RichTextPlugin());
          target.addMorph(textMorph);
          break;
      }
    }
    if (target._yieldedShape && target._yieldedShape.owner) {
      this.showHaloFor(target._yieldedShape);
      if (type === Text && target._yieldedShape) {
        target._yieldedShape.execCommand('temporary edit text');
      }
    }
    target._yieldedShape = null;
    target._shapeRequest = false;
  }

  prepareShapeCreation (evt) {
    const target = this.primaryTarget || $world;
    const type = target._yieldShapeOnClick;
    if (!type) return false;
    if (!this.canBeCreatedViaDrag(type)) return false;
    this._shapeCreationStartPos = evt.positionIn(target);
    target._yieldedShape = morph({
      type,
      scale: $world.scaleFactor,
      position: this._shapeCreationStartPos,
      extent: pt(1, 1),
      fill: Color.rgbHex('FFFFFF'),
      borderWidth: 1,
      borderColor: Color.rgb(23, 160, 251),
      fixedHeight: true,
      fixedWidth: true,
      lineWrapping: 'by-words',
      ...type === Text ? this.getDefaultTextAttrs() : {},
      ...type === Image ? this.getImageDefaultAttrs() : {},
      ...type === Polygon ? this.getPolyDefaultAttrs() : {},
      ...type === Path ? this.getPathDefaultAttrs() : {}
    });
    if (target._yieldedShape.isText) target._yieldedShape.addPlugin(new RichTextPlugin());
    target._sizeTooltip = part(SystemTooltip, { opacity: 0 });
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
    };
  }

  getDefaultTextAttrs () {
    return {
      readOnly: true,
      padding: Rectangle.inset(1, 1, 1, 1),
      cursorWidth: 1.5,
      dynamicCursorColoring: true
    };
  }

  yieldShapeIfNeeded (evt) {
    const target = this.primaryTarget || $world;
    if (target._yieldedShape) {
      if (!target._yieldedShape.owner && evt.state.absDragDelta.r() > 10) target.addMorph(target._yieldedShape);
      target._yieldedShape.setBounds(Rectangle.fromAny(evt.positionIn(target), this._shapeCreationStartPos).scaleBy(1 / $world.scaleFactor));

      Object.assign(
        target._sizeTooltip, {
          opacity: 1,
          description: `${target._yieldShapeOnClick[Symbol.for('__LivelyClassName__')]}: ${target._yieldedShape.width.toFixed(0)}x${target._yieldedShape.height.toFixed(0)}`,
          topLeft: evt.positionIn(target.world()).addXY(15, 15)
        });
      return true;
    }
    return false;
  }

  handleHaloSelection (evt) {
    const world = $world;
    const target = this.primaryTarget || world;
    if (this._showHaloPreview && this._currentlyHighlighted && world.halos().length === 0) {
      evt.stop();
      world.getSubmorphsByStyleClassName('HaloPreview').forEach(m => m.remove());
      this.showHaloFor(this._currentlyHighlighted);
    }
    if (evt.targetMorph !== target) return;
    target._shapeRequest = true;
  }

  showHaloFor (targets) {
    let halo;
    if (!targets) return;
    if (obj.isArray(targets)) {
      if (targets.length === 0) return;
      halo = $world.showHaloForSelection(targets);
    } else {
      halo = $world.showHaloFor(targets);
    }
    once(halo, 'remove', () => {
      if (halo.target !== $world.focusedMorph) {
        signal(this.primaryTarget, 'onHaloRemoved', targets);
      }
    });
    if (!this.activeHaloItems.includes('*')) {
      halo.activeItems = this.activeHaloItems;
    }
    halo.topBar = this;
    signal(this.primaryTarget, 'onHaloOpened', targets);
    return halo;
  }

  handleHaloPreview (evt) {
    this.clearHaloPreviews();
    if (this._showHaloPreview) {
      const { haloFilterFn } = this;
      const target = this.primaryTarget || $world;
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
      if (morphsContainingPoint.find(m => m.isMenuItem || m === this.sideBar || m === this.propertiesPanel) ||
        obj.equals([target], morphsContainingPoint)
      ) {
        this._currentlyHighlighted = false;
        this.clearHaloPreviews();
        return;
      }
      this.showHaloPreviewFor(haloTarget);
    }

    if (evt.state.draggedMorph) return;

    const [halo] = $world.halos();

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
    const target = this.primaryTarget || $world;
    if (!aMorph) return;
    if (![aMorph, ...aMorph.ownerChain()].find(m => m.isComponent) && aMorph.getWindow()) aMorph = null; // do not inspect windows
    else if ([aMorph, ...aMorph.ownerChain()].find(m => m.isEpiMorph)) aMorph = null; // do not inspect epi morphs
    else if (aMorph === target) aMorph = null; // reset halo preview
    // if the previously highlighted morph is different one, then clean all exisiting previews
    if (this._currentlyHighlighted !== aMorph) {
      this.clearHaloPreviews();
      this._currentlyHighlighted = aMorph;
    }

    if ($world.halos().length > 0) return;

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

    if (!preview.owner) $world.addMorph(preview);
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
    this._currentlyHighlighted = null;
    $world.getSubmorphsByStyleClassName('HaloPreview').forEach(m => m.remove());
  }

  prepareDragSelection (evt) {
    const target = this.primaryTarget || $world;
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
    const target = this.primaryTarget || $world;
    const world = target.world();
    const selectionBounds = Rectangle.fromAny(evt.position, this._selectionStartPos);
    this._morphSelection.setBounds(selectionBounds);
    target.submorphs.forEach(c => {
      if (c.isSelectionElement || c.isHand || c.isHalo || c.styleClasses.includes('HaloPreview') || c.isMorphSelection || !c.halosEnabled) return;
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
  finishDragSelectionIfNeeded () {
    if (this._morphSelection) {
      const world = $world;
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

const TopBar = component({
  name: 'top bar',
  layout: new TilingLayout({
    justifySubmorphs: 'spaced',
    orderByIndex: true,
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
      align: 'bottom',
      padding: {
        height: 0,
        width: 0,
        x: 13,
        y: 13
      },
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      spacing: 13
    }),
    submorphs: [
      part(TopBarButtonDropDown, {
        name: 'save button',
        viewModel: {
          opts: {
            tooltip: 'Choose advanced saving options for Projects.',
            symbol: {
              textAndAttributes: Icon.textAttribute('save'),
              tooltip: 'Save Project or World'
            }
          }
        }
      }),
      part(TopBarButtonDropDown, {
        name: 'hand or halo mode button',
        viewModel: {
          opts: {
            tooltip: 'Choose between Hand and Halo mode',
            symbol: {
              textAndAttributes: Icon.textAttribute('arrow-pointer'),
              tooltip: 'Current mode of the cursor (Hand or Halo)'
            }
          }
        }
      }),
      part(TopBarButton, {
        name: 'text mode button',
        textAndAttributes: Icon.textAttribute('font'),
        tooltip: 'Create textbox mode'
      }),
      part(TopBarButtonDropDown, {
        name: 'shape mode button',
        viewModel: {
          opts: {
            tooltip: 'Select different shape',
            symbol: {
              textAndAttributes: Icon.textAttribute('square'),
              tooltip: 'Create basic shape mode'
            }
          }
        }
      }),
      part(TopBarButton, {
        name: 'open asset browser',
        textAndAttributes: Icon.textAttribute('heart-music-camera-bolt'),
        tooltip: 'Browse Project Assets'
      }),
      part(TopBarButton, {
        name: 'open component browser',
        padding: rect(3, 0, -3, 0),
        textAndAttributes: Icon.textAttribute('cubes'),
        tooltip: 'Browse master components'
      }),
      part(TopBarButtonDropDown, {
        name: 'canvas mode button',
        viewModel: {
          opts: {
            tooltip: 'Enable/Disable Canvas mode',
            symbol: {
              textAndAttributes: Icon.textAttribute('map-location-dot'),
              tooltip: 'Open/Close the Minimap'
            }
          }
        }
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
  {
    name: 'right UI wrapper',
    layout: new TilingLayout({
      axisAlign: 'center',
      spacing: 10
    }),
    fill: Color.transparent,
    submorphs: [
      part(OfflineToggleDark),
      part(UserFlap, {
        name: 'user flap',
        fill: Color.transparent
      })]
  }]
});

export { TopBar };
