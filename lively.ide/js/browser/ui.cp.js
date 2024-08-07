import { Color, rect, LinearGradient, pt } from 'lively.graphics';
import {
  ShadowObject, ViewModel, morph, easings, Morph,
  TilingLayout, ConstraintLayout, Text, Label, Icon, component, part
} from 'lively.morphic';
import { HorizontalResizer } from 'lively.components';
import { SystemButton, DarkButton, ButtonDefault } from 'lively.components/buttons.cp.js';
import { MullerColumnView } from 'lively.components/muller-columns.cp.js';
import { promise, fun } from 'lively.lang';
import { EvalBackendButtonModel } from '../eval-backend-ui.js';
import { BrowserModel, DirectoryControls, PackageControls } from './index.js';
import { Tabs, TabModel, DefaultTab } from '../../studio/tabs.cp.js';
import { BlackOnWhite } from '../../text/defaults.cp.js';
import { once, noUpdate, disconnect, connect } from 'lively.bindings';
import { withAllViewModelsDo, PolicyApplicator } from 'lively.morphic/components/policy.js';
import { module } from 'lively.modules/index.js';
import { getEligibleSourceEditorsFor } from '../../components/helpers.js';

async function positionForAnchor (context, anchor, morphToPosition) {
  if (!context?.isText) return morphToPosition.leftCenter;
  if (context.renderingState.needsRerender) context.env.forceUpdate();
  const paddingToCode = 5;
  const bounds = context.charBoundsFromTextPosition(anchor.position);
  let pos = bounds.rightCenter().addXY(paddingToCode, 0);
  if (pos.x + morphToPosition.width > context.width) {
    // in this case we need to get the screen line range
    const startPos = context.charBoundsFromTextPosition({ row: anchor.position.row, column: 0 });
    pos = bounds.topRight()
      .withY(startPos.top() - morphToPosition.height / 2)
      .withX(context.width - morphToPosition.width);
  }
  return pos;
}

function ensureAnchor (control) {
  const { declaration, editor } = control;
  const varName = declaration.declarations[0]?.id?.name;
  const anchor = editor.addAnchor({
    id: 'Component->' + varName,
    ...editor.screenLineRange(editor.indexToPosition(declaration.start)).end
  });
  connect(anchor, 'position', control, 'positionInLine', {
    updater: ($upd) => $upd()
  });
  return anchor;
}

class ComponentEditControlModel extends ViewModel {
  static get properties () {
    return {
      componentDescriptor: {
        // the component descriptor object pointing to the policy
      },
      componentMorph: {
        // reference to the morph that reifies the visual representation of the component definition
      },
      anchor: {},
      editButton: {
        // reference to the button that allows to enter the editing session
      },
      declaration: {
        before: ['anchor'],
        set (decl) {
          this.setProperty('declaration', decl);
          this.anchor = null;
          this.positionInLine();
        }
      },
      editor: {
        derived: true,
        get () {
          return this.view?.owner;
        }
      },
      isLively: {
        get () {
          return !!this.instanceMorph;
        }
      },
      isActiveEditSession: { defaultValue: true },
      isComponentControl: { get () { return true; } },
      expose: {
        get () {
          return [
            'positionInLine', 'collapse', 'isComponentControl', 'componentDescriptor',
            'declaration', 'isActiveEditSession', 'terminateEditSession',
            'terminateIfNoEditorExcept'
          ];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseUp', handler: 'terminateEditSession' },
            { target: 'revert button', signal: 'onMouseUp', handler: 'resetComponentDef' },
            {
              target: 'lively button',
              signal: 'onMouseUp',
              handler: () => {
                this.toggleDerivedInstance(!this.isLively);
              }
            }
          ];
        }
      }
    };
  }

  async terminateIfNoEditorExcept () {
    const browsers = this.getAllOtherEqualBrowsers();
    if (browsers.length > 0) return true;
    const proceed = this.editor._confirmedProceed || await this.world().confirm(['Pending Edit Sessions', {}, '\nYou still have some active component edit sessions that are about to be closed. Are you sure you want to proceed?', { fontWeight: 'normal', fontSize: 18 }], { requester: this.editor.owner });
    if (!proceed) return false;
    this.editor._confirmedProceed = true;
    await this.terminateEditSession();
    return true;
  }

  viewDidLoad () {
    super.viewDidLoad();
    this.updateControlButtons();
    once(this.componentMorph, 'stop editing', this, 'terminateEditSession');
    once(this.componentDescriptor, 'makeDirty', this, 'updateControlButtons');
    connect(this.componentMorph, 'behaviorChanged', this, 'updateControlButtons');
  }

  hasViewModels () {
    let found = false;
    withAllViewModelsDo(this.componentMorph, m => {
      if (m.viewModel) found = true;
    });
    return found;
  }

  updateControlButtons () {
    this.ui.livelyButton.visible = this.hasViewModels();
    this.ui.livelyButton.master.setState(this.isLively ? null : 'disabled');
    this.ui.revertButton.master.setState(this.componentDescriptor?.isDirty() ? null : 'disabled');
  }

  async positionInLine (transition = !this.componentDescriptor?._cachedComponent) {
    let { view, editor, anchor, componentDescriptor } = this;
    if (!editor) return;
    if (!anchor) anchor = this.anchor = ensureAnchor(this);
    if (transition) {
      return this.replaceWithEditButton();
    }
    if (anchor.position.row > editor.renderingState.lastVisibleRow ||
        anchor.position.row < editor.renderingState.firstVisibleRow) {
      view.bottom = -10;
      return;
    }
    view.leftCenter = await positionForAnchor(editor, anchor, view);
  }

  resetComponentDef () {
    if (this.componentDescriptor?.isDirty()) this.componentDescriptor.reset();
  }

  toggleDerivedInstance (active) {
    if (active) {
      try {
        const pos = this.componentMorph.position;
        noUpdate(() => this.componentMorph.remove());
        this.world().sceneGraph?.refresh();
        this.instanceMorph = part(this.componentDescriptor).openInWorld();
        this.instanceMorph.position = pos;
        once(this.instanceMorph, 'abandon', this, 'terminateEditSession');
        this.world().sceneGraph?.refresh();
      } catch (err) {
        this.view.getWindow().showError('Failed to load live version of component: ' + err.message);
      }
    }

    if (!active && this.instanceMorph) {
      const pos = this.instanceMorph.position;
      this.cleanupInstance();
      this.world().sceneGraph?.refresh();
      this.componentMorph.openInWorld();
      this.world().sceneGraph?.refresh();
      this.componentMorph.position = pos;
      noUpdate(() => this.componentMorph.bringToFront());
    }
    this.updateControlButtons();
  }

  cleanupInstance () {
    if (this.instanceMorph) {
      disconnect(this.instanceMorph, 'abandon', this, 'terminateEditSession');
      this.instanceMorph.remove();
      this.instanceMorph = null;
    }
  }

  async terminateEditSession () {
    const mod = module(this.componentDescriptor.moduleName);
    if (mod._source) {
      mod.changeSource(mod._source, {
        doSave: true, doEval: false
      });
    }

    await this.minifyComponentMorph();
    this.componentDescriptor.stopEditSession();
  }

  /**
   * Removes the morph representing the component definition by fading
   * it out of the world via animation.
   */
  async minifyComponentMorph () {
    if (this._initializing) return;
    const {
      componentMorph,
      editor,
      view
    } = this;
    await fun.guardNamed('collapse-' + componentMorph.id, async () => {
      const halos = $world.halos();
      halos.forEach(h => {
        if (h.target.ownerChain().includes(componentMorph)) h.remove();
      });
      const placeholderPos = view.position;
      const pos = componentMorph.position;
      const wrapper = morph({
        epiMorph: true,
        fill: Color.transparent,
        submorphs: [componentMorph]
      }).openInWorld();
      componentMorph.position = pt(0);
      wrapper.position = pos;
      await wrapper.withAnimationDo(() => {
        wrapper.scale = 0;
        wrapper.opacity = 0;
        wrapper.center = editor.worldPoint(placeholderPos.subPt(editor.scroll));
      }, { duration: 300, easing: easings.outQuint });
      this.collapse(editor);
      this.isActiveEditSession = false;
      componentMorph.remove();
      wrapper.remove();
    })();
  }

  async replaceWithEditButton () {
    const {
      componentDescriptor,
      editor,
      editButton
    } = this;
    if (!editor) return;
    this.view.remove();
    editButton.reset();
    editor.addMorph(editButton);
    editButton.positionInLine();
  }

  getAllOtherEqualBrowsers () {
    const editors = getEligibleSourceEditorsFor(System.decanonicalize(this.componentDescriptor.moduleName), this.editor.textString);
    return editors
      .filter(m => m !== this.editor)
      .map(ed => ed.owner);
  }

  async collapse (editor = this.editor) {
    const animated = true;
    const { view, editButton } = this;
    const otherBrowsers = this.getAllOtherEqualBrowsers();
    this.cleanupInstance();
    disconnect(this.componentMorph, 'behaviorChanged', this, 'updateControlButtons');
    disconnect(this.anchor, 'position', this, 'positionInLine');
    editButton.reset();
    editButton.opacity = 0;
    editor.addMorph(editButton);
    this.componentDescriptor._dirty = false;
    await editButton.positionInLine(false);
    if (animated) {
      await view.animate({
        opacity: 0,
        scale: .2,
        center: view.center, // to preserve tfm origin
        duration: 300,
        easing: easings.outQuint
      });
    }
    view.remove();
    if (animated) {
      await editButton.positionInLine();
      const center = editButton.center;
      editButton.scale = 1.2;
      editButton.center = center;
      await editButton.animate({
        scale: 1,
        opacity: 1,
        center,
        duration: 300,
        easing: easings.outQuint
      });
    }
    editButton.scale = 1;
    editButton.opacity = 1;
    otherBrowsers.forEach(b => b.relayout());
  }
}

class ComponentEditButtonMorph extends Morph {
  static get properties () {
    return {
      isComponentControl: { get () { return true; } },
      componentMorph: {
        get () {
          return this.componentDescriptor._cachedComponent;
        }
      },
      declaration: {
        set (decl) {
          this.setProperty('declaration', decl);
          this.anchor = null;
          this.positionInLine();
        }
      },
      editor: {
        derived: true,
        get () { return this.owner; }
      },
      componentDescriptor: {
        // the component descriptor object pointing to the policy
      }
    };
  }

  async animateSwapWithPlaceholder (placeholder, componentMorph) {
    const {
      editor,
      leftCenter: anchorPoint
    } = this;
    placeholder._initializing = true;
    await placeholder.positionInLine();
    placeholder.scale = .2;
    this.openInWorld(this.globalPosition);
    this.layout = null;
    const wrapper = this.addMorph({
      fill: Color.transparent,
      opacity: 0,
      epiMorph: true,
      submorphs: [componentMorph]
    });
    wrapper.scale = 0;
    componentMorph.position = pt(0, 0);
    this.fill = Color.transparent;
    await $world.withAnimationDo(() => {
      placeholder.opacity = 1;
      placeholder.scale = 1;
      this.submorphs[0].opacity = 0;
      componentMorph.applyLayoutIfNeeded();
      this.extent = componentMorph.bounds().extent();
      this.center = this.world().visibleBounds().center();
      this.submorphs[0].center = this.extent.scaleBy(.5);
      wrapper.opacity = 1;
      wrapper.scale = 1;
    }, { duration: 300, easing: easings.outQuint });
    componentMorph.openInWorld(componentMorph.globalPosition);
    this.remove();
    placeholder._initializing = false;
  }

  getAllOtherEqualBrowsers () {
    const editors = getEligibleSourceEditorsFor(System.decanonicalize(this.componentDescriptor.moduleName), this.editor?.textString);
    return editors
      .filter(m => m !== this.editor)
      .map(ed => ed.owner);
  }

  async ensureEditControlsFor (componentMorph, editor = this.editor) {
    const {
      componentDescriptor,
      anchor,
      declaration
    } = this;
    const btnPlaceholder = editor.addMorph(part(ComponentEditControls, { // eslint-disable-line no-use-before-define
      name: 'component edit control',
      viewModel: {
        componentMorph,
        componentDescriptor,
        declaration,
        anchor,
        editButton: this
      }
    }));
    btnPlaceholder.bottom = -10;
    await btnPlaceholder.positionInLine();
    return btnPlaceholder;
  }

  async replaceWithControls () {
    const {
      componentDescriptor,
      editor
    } = this;
    if (!editor) return;
    this.remove();
    const componentMorph = componentDescriptor.getComponentMorph();
    const btnPlaceholder = await this.ensureEditControlsFor(componentMorph, editor);
    btnPlaceholder.opacity = 1;
  }

  async expand () {
    const {
      componentDescriptor
    } = this;
    const otherBrowsers = this.getAllOtherEqualBrowsers();
    const componentMorph = await componentDescriptor.edit();
    if (componentMorph) {
      componentMorph.applyLayoutIfNeeded();
    }
    const btnPlaceholder = await this.ensureEditControlsFor(componentMorph);
    await this.animateSwapWithPlaceholder(btnPlaceholder, componentMorph);
    otherBrowsers.forEach(b => b.relayout());
  }

  async positionInLine (transition = !!this.componentDescriptor?._cachedComponent) {
    let { editor, anchor, componentDescriptor } = this;
    if (!editor) return;

    if (transition) {
      return this.replaceWithControls();
    }

    if (!anchor) anchor = this.anchor = ensureAnchor(this);

    if (anchor.position.row > editor.renderingState.lastVisibleRow ||
        anchor.position.row < editor.renderingState.firstVisibleRow) {
      this.bottom = -10;
      return;
    }

    this.leftCenter = await positionForAnchor(editor, anchor, this);
  }

  reset () {
    // reset the overridden props
    this.master = ComponentEditButton; // eslint-disable-line no-use-before-define
    this.submorphs = [this.submorphs[0]]; // just keep the label
  }

  onMouseUp (evt) {
    super.onMouseUp(evt);
    this.expand();
  }
}

const ComponentEditButtonDefault = component({
  type: ComponentEditButtonMorph,
  isLayoutable: false,
  fill: Color.rgba(76, 175, 80, 0.7539),
  nativeCursor: 'pointer',
  borderRadius: 20,
  layout: new TilingLayout({
    align: 'right',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(2, 1, -1, 0)
  }),
  submorphs: [
    {
      type: 'label',
      name: 'label',
      reactsToPointer: false,
      padding: rect(5, 1, 0, -1),
      fontColor: Color.white,
      fontWeight: 'bold',
      fontSize: 12,
      textAndAttributes: ['Edit Component  ', {}, '', {
        fontFamily: 'Font Awesome',
        paddingTop: '2px'
      }]

    }
  ]
});

const ComponentEditButtonClicked = component(ComponentEditButtonDefault, {
  fill: Color.rgba(27, 94, 32, 0.7095)
});

const ComponentEditButton = component(ComponentEditButtonDefault, {
  master: { click: ComponentEditButtonClicked }
});

const CloseComponentButtonDefault = component({
  type: Label,
  nativeCursor: 'pointer',
  borderRadius: 15,
  padding: rect(5, 1, 0, 0),
  fill: Color.rgb(221, 37, 37),
  fontColor: Color.white,
  fontWeight: 'bold',
  fontSize: 12,
  textAndAttributes: ['Stop ', {}, ...Icon.textAttribute('pause', { paddingTop: '2px' })]
});

const CloseComponentButtonClicked = component(CloseComponentButtonDefault, {
  fill: Color.rgb(183, 28, 28)
});

const CloseComponentButton = component(CloseComponentButtonDefault, {
  master: { click: CloseComponentButtonClicked }
});

const RevertComponentButtonDefault = component({
  type: Label,
  nativeCursor: 'pointer',
  borderRadius: 15,
  padding: rect(5, 1, 0, 0),
  fill: Color.rgb(33, 150, 243),
  fontColor: Color.white,
  fontWeight: 'bold',
  fontSize: 12,
  textAndAttributes: ['Revert ', {}, ...Icon.textAttribute('rotate-left', { lineHeight: 1.4 })]
});

const RevertComponentButtonClicked = component(RevertComponentButtonDefault, {
  fill: Color.rgb(0, 119, 189)
});

const RevertComponentButtonDisabled = component(RevertComponentButtonDefault, {
  opacity: 0.5,
  nativeCursor: 'not-allowed'
});

const RevertComponentButton = component(RevertComponentButtonDefault, {
  master: { click: RevertComponentButtonClicked }
});

const BehaviorToggleButton = component({
  master: {
    auto: new PolicyApplicator({ fill: Color.rgb(255, 111, 0) }),
    click: new PolicyApplicator({ fill: Color.rgb(206, 89, 0) })
  },
  nativeCursor: 'pointer',
  borderRadius: 20,
  layout: new TilingLayout({
    wrapSubmorphs: false,
    hugContentsVertically: true,
    hugContentsHorizontally: true
  }),
  submorphs: [
    {
      type: 'label',
      name: 'active',
      visible: true,
      reactsToPointer: false,
      padding: rect(5, 1, 0, 0),
      fontColor: Color.white,
      fontWeight: 'bold',
      fontSize: 12,
      textAndAttributes: ['Turn Stale ', {}, ...Icon.textAttribute('heart-pulse', { lineHeight: 1.4 })]
    },
    {
      type: 'label',
      name: 'inactive',
      visible: false,
      reactsToPointer: false,
      padding: rect(5, 1, 0, 0),
      fontColor: Color.white,
      fontWeight: 'bold',
      fontSize: 12,
      textAndAttributes: ['Turn Lively ', {}, ...Icon.textAttribute('heart-circle-xmark', { lineHeight: 1.4 })]
    }
  ]
});

const BehaviorToggleButtonDisabled = component(BehaviorToggleButton, {
  name: 'behavior toggle button disabled',
  fill: Color.rgb(121, 85, 72),
  opacity: 0.6,
  submorphs: [{
    name: 'active',
    visible: false
  }, {
    name: 'inactive',
    visible: true
  }]
});

const ComponentEditControls = component({
  viewModelClass: ComponentEditControlModel,
  fill: Color.rgba(255, 255, 255, 0),
  layout: new TilingLayout({
    orderByIndex: true,
    spacing: 5,
    wrapSubmorphs: false,
    hugContentsHorizontally: true,
    hugContentsVertically: true
  }),
  submorphs: [
    part(CloseComponentButton, { name: 'close button' }),
    part(RevertComponentButton, {
      name: 'revert button',
      master: { states: { disabled: RevertComponentButtonDisabled } }
    }),
    part(BehaviorToggleButton, {
      name: 'lively button',
      master: { states: { disabled: BehaviorToggleButtonDisabled } }
    })
  ]
});

const BrowserTabDefault = component(DefaultTab, {
  name: 'browser/tab/default',
  defaultViewModel: TabModel,
  borderRadius: 0,
  fill: Color.black.withA(.3),
  submorphs: [{
    name: 'horizontal container',
    extent: pt(300, 30.7),
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(6, 6, 0, 0),
      resizePolicies: [['tab caption', {
        height: 'fixed',
        width: 'fill'
      }]]
    })
  }]
});

const BrowserTabSelected = component(BrowserTabDefault, {
  name: 'browser/tab/selected',
  opacity: 1,
  borderRadius: 0,
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.5), blur: 5 }),
  fill: Color.transparent,
  submorphs: [{
    name: 'horizontal container',
    submorphs: [{
      name: 'tab caption',
      fontWeight: 700
    }]
  }]
});

const BrowserTabClicked = component(BrowserTabSelected, {
  name: 'browser/tab/clicked',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(126, 127, 127) },
      { offset: 1, color: Color.rgb(150, 152, 153) }
    ],
    vector: rect(0, 0, 0, 1)
  })
});

const BrowserTabHovered = component(BrowserTabSelected, {
  name: 'browser/tab/hovered',
  dropShadow: null,
  fill: Color.black.withA(.15),
  submorphs: [{
    name: 'horizontal container',
    submorphs: [{
      name: 'tab caption',
      fontWeight: '400'
    }]
  }]
});

const FileStatusDefault = component({
  name: 'file status default',
  borderColor: Color.rgb(44, 62, 80),
  borderRadius: 5,
  borderWidth: 1,
  dropShadow: new ShadowObject({ distance: 0, color: Color.rgba(0, 0, 0, 0.5) }),
  extent: pt(176.3, 35.3),
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgba(44, 62, 80, 0.9) }, { offset: 1, color: Color.rgba(33, 47, 60, 0.9) }], vector: rect(0.5, 0, 0, 1) })
});

const FileStatusError = component(FileStatusDefault, {
  name: 'file status error',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(231, 76, 60) },
      { offset: 1, color: Color.rgb(192, 57, 43) }],
    vector: rect(0.5, 0, 0, 1)
  })
});

const FileStatusSaved = component(FileStatusDefault, {
  name: 'file status saved',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(46, 204, 113) },
      { offset: 1, color: Color.rgb(39, 174, 96) }],
    vector: rect(0.5, 0, 0, 1)
  })
});

const FileStatusInactive = component(FileStatusDefault, {
  name: 'file status inactive',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(128, 139, 150) },
      { offset: 1, color: Color.rgb(93, 109, 126) }],
    vector: rect(0.5, 0, 0, 1)
  })
});

const FileStatusWarning = component(FileStatusDefault, {
  name: 'file status warning',
  borderColor: Color.rgbHex('DA9819'),
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(249, 213, 68) },
      { offset: 1, color: Color.rgb(219, 162, 18) }
    ],
    vector: rect(0.5, 1, 0, 1)
  })
});

const BackendButtonDefault = component(ButtonDefault, {
  name: 'backend button default',
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    padding: rect(5, 0, 0, 0)
  }),
  borderColor: Color.rgb(44, 62, 80),
  extent: pt(130.3, 26.1),
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgba(44, 62, 80, 0.9) }, { offset: 1, color: Color.rgba(33, 47, 60, 0.9) }], vector: rect(0.5, 0, 0, 1) }),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(163, 228, 215),
    fontFamily: '"IBM Plex Mono"',
    fontSize: 14
  }]
});

const BackendButtonClicked = component(BackendButtonDefault, {
  name: 'backend button clicked',
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(33, 48, 63) }, { offset: 1, color: Color.rgb(33, 47, 60) }], vector: rect(0.5, 0, 0, 1) }),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(63, 110, 101),
    fontFamily: '"IBM Plex Mono"',
    fontSize: 14
  }]
});

const EmbeddedIconDefault = component({
  type: Label,
  name: 'embedded icon default',
  fontColor: Color.rgb(253, 254, 254),
  fontFamily: 'IBM Plex Mono',
  nativeCursor: 'pointer',
  padding: rect(5, 5, 0, 0),
  borderRadius: 4,
  textAndAttributes: Icon.textAttribute('external-link-alt')
});

const EmbeddedIconHovered = component(EmbeddedIconDefault, {
  name: 'embedded icon hovered',
  fill: Color.rgba(0, 0, 0, 0.2)
});

const EmbeddedIconClicked = component(EmbeddedIconDefault, {
  name: 'embedded icon clicked',
  fill: Color.rgba(0, 0, 0, 0.4)
});

const EmbeddedIcon = component(EmbeddedIconDefault, {
  name: 'embedded icon',
  master: { auto: EmbeddedIconDefault, hover: EmbeddedIconHovered, click: EmbeddedIconClicked }
});

const BrowserDirectoryControls = component({
  type: DirectoryControls,
  name: 'directory controls',
  acceptsDrops: false,
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(83.2, 30.8),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new TilingLayout({
    axisAlign: 'center',
    align: 'center',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 5,
      y: 5
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    spacing: 5
  }),
  submorphs: [
    part(DarkButton, {
      name: 'add folder',
      extent: pt(21, 21),
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('folder-plus')
      }],
      tooltip: 'Add folder'
    }),
    part(DarkButton, {
      name: 'remove selected',
      extent: pt(21, 21),
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('minus')
      }],
      tooltip: 'Remove selected'
    }),
    part(DarkButton, {
      name: 'add file',
      extent: pt(21, 21),
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('file-medical')
      }],
      tooltip: 'Add file'
    })]
});

const BrowserPackageControls = component({
  type: PackageControls,
  name: 'browser package controls',
  acceptsDrops: false,
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(123.4, 30.8),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new TilingLayout({
    axisAlign: 'center',
    align: 'center',
    padding: {
      height: 0,
      width: 0,
      x: 5,
      y: 5
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    spacing: 5
  }),
  position: pt(767.5, 1556.9),
  submorphs: [
    part(DarkButton, {
      name: 'add pkg',
      extent: pt(21, 21),
      tooltip: 'Add package',
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('plus')
      }]
    }),
    part(DarkButton, {
      name: 'remove pkg',
      extent: pt(21, 21),
      tooltip: 'Remove package',
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('minus')
      }]
    }),
    part(DarkButton, {
      name: 'run all pkg tests',
      extent: pt(62, 21),
      tooltip: 'Run all tests in this package',
      submorphs: [{
        name: 'label',
        textAndAttributes: ['Run all tests', null]
      }]

    })]
});

export class PathIndicator extends Morph {
  static get properties () {
    return {
      ui: {
        get () {
          return {
            filePath: this.getSubmorphNamed('file path'),
            pathContainer: this.getSubmorphNamed('path container'),
            clipboardControls: this.getSubmorphNamed('clipboard controls'),
            statusBox: this.getSubmorphNamed('status box'),
            statusLabel: this.getSubmorphNamed('status label'),
            errorControls: this.getSubmorphNamed('error controls'),
            exportToHtml: this.getSubmorphNamed('export to html'),
            runTestsButton: this.getSubmorphNamed('run tests in module'),
            freezeButton: this.getSubmorphNamed('freeze button')
          };
        }
      }
    };
  }

  reset () {
    const { statusBox, statusLabel, errorControls } = this.ui;
    this.master.setState(null);
    this.setPath();
  }

  showInfoInWorkspace () {
    const content = this.ui.statusBox.textString;
    const title = content.split('\n')[0];
    part(BlackOnWhite, {
      textString: content.split('\n').slice(1).join('\n'),
      name: title
    }).openInWindow();
  }

  getPath () {
    return this.ui.filePath.textAndAttributes;
  }

  setPath (path = this.getPath()) {
    const { filePath, clipboardControls, exportToHtml, freezeButton, runTestsButton } = this.ui;
    clipboardControls.opacity = 1;
    filePath.value = path;
    freezeButton.isLayoutable = freezeButton.visible = !this.testModuleMode && filePath.textString.includes('.js');
    exportToHtml.isLayoutable = exportToHtml.visible = filePath.textString.includes('.md');
    runTestsButton.isLayoutable = runTestsButton.visible = this.testModuleMode;
  }

  showInactive (duration = 300) {
    this.requestTransition(async () => {
      const { filePath } = this.ui;
      filePath.value = 'No file selected';
      this.master.setState('inactive');
      await this.master.applyAnimated({ duration, easing: easings.outQuint });
    });
    this.setPath();
  }

  showDefault (duration = 300) {
    this.requestTransition(async () => {
      const { statusBox } = this.ui;
      this.master.setState(null);
      await this.master.applyAnimated({ duration, easing: easings.outQuint });
      statusBox.reactsToPointer = false;
    });
    this.setPath();
  }

  async showError (err, duration = 300) {
    this.requestTransition(async () => {
      const { statusBox, statusLabel } = this.ui;
      statusBox.textString = err;
      statusLabel.value = ['Error ', null, ...Icon.textAttribute('exclamation-triangle', { paddingTop: '3px' })];
      this.master.setState('error');
      await this.master.applyAnimated({ duration, easing: easings.outQuint });
      statusBox.reactsToPointer = true;
    });
    this.setPath();
  }

  async showWarning (warning, duration = 300) {
    await this.requestTransition(async () => {
      const { statusBox, statusLabel } = this.ui;
      statusBox.textString = warning;
      statusLabel.value = ['Warning ', null, ...Icon.textAttribute('exclamation-circle', { paddingTop: '3px' })];
      this.master.setState('warning');
      await this.master.applyAnimated({ duration, easing: easings.outQuint });
      statusBox.reactsToPointer = true;
    });
    this.setPath();
  }

  async showSaved (duration = 300, timeout = 5000) {
    if (this._animating) return;
    this._animating = true;

    this.requestTransition(async () => {
      const { statusBox, statusLabel, errorControls } = this.ui;
      statusLabel.value = ['Saved ', null, ...Icon.textAttribute('check', { paddingTop: '3px' })];
      this.master.setState('saved');
      await this.master.applyAnimated({ duration, easing: easings.outQuint });
      statusBox.reactsToPointer = false;
    });
    this.setPath();

    await promise.delay(timeout);
    this._animating = false;
    // cancel if another saved was triggered in the meantime
    this.showDefault(duration);
  }

  async requestTransition (transition) {
    if (this._currentTransition) {
      this._nextTransition = transition;
      await this._currentTransition; // in the meantime multiple next transitions may pour in
      this._nextTransition && this.requestTransition(this._nextTransition); // just animate the last transition that poured in
      this._nextTransition = null;
    } else {
      this._currentTransition = transition();
      await this._currentTransition;
      this._currentTransition = null;
    }
  }
}

const MetaInfoContainerExpanded = component({
  type: PathIndicator,
  master: FileStatusDefault,
  isLayoutable: true,
  clipMode: 'hidden',
  extent: pt(587.6, 60.4),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'right',
    hugContentsVertically: true,
    padding: rect(10, 10, 0, 0),
    reactToSubmorphAnimations: true,
    resizePolicies: [['path container', {
      height: 'fixed',
      width: 'fill'
    }], ['status box', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [{
    name: 'path container',
    clipMode: 'hidden',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(568, 30),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      justifySubmorphs: 'spaced',
      orderByIndex: true,
      reactToSubmorphAnimations: true,
      spacing: 5,
      resizePolicies: [['status label', {
        height: 'fixed',
        width: 'fixed'
      }], ['file path', {
        height: 'fixed',
        width: 'fill'
      }], ['clipboard controls', {
        height: 'fixed',
        width: 'fixed'
      }]]
    }),
    position: pt(9.1, 11.7),
    submorphs: [{
      type: Label,
      name: 'status label',
      borderRadius: 20,
      fill: Color.rgba(0, 0, 0, 0.30302366762504984),
      fontColor: Color.rgb(255, 255, 255),
      fontSize: 14,
      fontWeight: 'bold',
      padding: rect(10, 4, 0, 0),
      textAndAttributes: ['Error ', null, '', {
        fontFamily: 'Font Awesome',
        paddingTop: '3px'
      }]
    }, {
      type: Label,
      name: 'file path',
      extent: pt(388.9, 18),
      clipMode: 'hidden',
      fontColor: Color.rgb(253, 254, 254),
      fontFamily: 'IBM Plex Mono',
      hideScrollbars: true,
      fontSize: 14,
      fixedWidth: true,
      fontWeight: 'bold',
      textAndAttributes: ['lively.sync/client.js:Client#toString', null]
    }, {
      name: 'clipboard controls',
      extent: pt(169.1, 27.7),
      fill: Color.rgba(0, 0, 0, 0),
      layout: new TilingLayout({
        align: 'right',
        axisAlign: 'center',
        orderByIndex: true,
        spacing: 5,
        hugContentsHorizontally: true
      }),
      submorphs: [
        part(EmbeddedIcon, {
          type: Label,
          tooltip: 'Freeze this module',
          name: 'freeze button',
          textAndAttributes: Icon.textAttribute('snowflake')
        }),
        part(EmbeddedIcon, {
          type: Label,
          tooltip: 'Open file in editor',
          name: 'open in editor'
        }), part(EmbeddedIcon, {
          type: Label,
          tooltip: 'Open path in workspace',
          name: 'copy to clipboard',
          textAndAttributes: Icon.textAttribute('clipboard')
        }), part(EmbeddedIcon, {
          type: Label,
          tooltip: 'Jump to code entity',
          name: 'jump to entity',
          textAndAttributes: Icon.textAttribute('search')
        }), part(EmbeddedIcon, {
          type: Label,
          tooltip: 'Export markdown to HTML',
          name: 'export to html',
          textAndAttributes: Icon.textAttribute('file-export')
        }), part(EmbeddedIcon, {
          type: Label,
          tooltip: 'Run tests in this module',
          name: 'run tests in module',
          visible: false,
          textAndAttributes: Icon.textAttribute('tachometer-alt')
        })]
    }]
  }, {
    type: Text,
    name: 'status box',
    clipMode: 'auto',
    extent: pt(560.7, 85.3),
    fill: Color.rgba(0, 0, 0, 0),
    fixedHeight: true,
    fixedWidth: true,
    fontColor: Color.rgb(255, 255, 255),
    fontFamily: 'IBM Plex Sans',
    fontSize: 16,
    padding: rect(5, 0, -5, 0),
    lineWrapping: 'by-words',
    readOnly: true
  }, {
    name: 'error controls',
    extent: pt(205, 41),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      orderByIndex: true,
      hugContentsVertically: true,
      padding: {
        height: -8,
        width: 0,
        x: 8,
        y: 8
      },
      reactToSubmorphAnimations: false,
      spacing: 8
    }),
    position: pt(385, 123.5),
    submorphs: [
      part(EmbeddedIcon, {
        name: 'close button',
        textAndAttributes: ['Close ', null, '', {
          fontFamily: 'Font Awesome',
          paddingTop: '1px'
        }]
      }),
      part(EmbeddedIcon, {
        name: 'open in workspace',
        textAndAttributes: ['Open in workspace ', null, '', {
          fontFamily: 'Font Awesome',
          fontWeight: '900',
          paddingTop: '2px'
        }]
      })]
  }]
});

const MetaInfoContainerCollapsed = component(MetaInfoContainerExpanded, {
  submorphs: [{
    name: 'path container',
    submorphs: [{
      name: 'status label',
      isLayoutable: false,
      opacity: 0
    }]
  }, {
    name: 'status box',
    isLayoutable: false,
    reactsToPointer: false,
    opacity: 0
  }, {
    name: 'error controls',
    reactsToPointer: false,
    opacity: 0,
    isLayoutable: false
  }]
});

const MetaInfoWarning = component(MetaInfoContainerExpanded, {
  clipMode: 'hidden',
  master: FileStatusWarning
});

const MetaInfoError = component(MetaInfoContainerExpanded, { clipMode: 'hidden', master: FileStatusError });

const MetaInfoSaved = component(MetaInfoContainerCollapsed, {
  clipMode: 'hidden',
  master: FileStatusSaved,
  submorphs: [{
    name: 'path container',
    submorphs: [{
      name: 'status label',
      opacity: 1,
      isLayoutable: true
    }]
  }]
});

const MetaInfoInactive = component(MetaInfoContainerCollapsed, {
  clipMode: 'hidden',
  master: FileStatusInactive,
  submorphs: [{
    name: 'path container',
    submorphs: [{
      name: 'clipboard controls',
      visible: false
    }]
  }]
});

const SystemBrowser = component({
  name: 'system browser',
  defaultViewModel: BrowserModel,
  layout: new ConstraintLayout({
    lastExtent: {
      x: 605,
      y: 745
    },
    reactToSubmorphAnimations: false,
    submorphSettings: [['top side wrapper', {
      x: 'resize',
      y: 'fixed'
    }], ['source editor', {
      x: 'resize',
      y: 'resize'
    }], ['meta info text', {
      x: 'resize',
      y: 'fixed'
    }], ['vertical resizer', {
      x: 'resize',
      y: 'fixed'
    }]]
  }),
  extent: pt(605, 745),
  fill: Color.rgba(0, 0, 0, 0),
  position: pt(125.8, 1349.5),
  reactsToPointer: false,
  submorphs: [{
    type: Label,
    name: 'smiley',
    isLayoutable: true,
    fontSize: 100,
    opacity: 0.2,
    position: pt(254, 456.7),
    textAndAttributes: Icon.textAttribute('smile')
  }, {
    name: 'top side wrapper',
    reactsToPointer: false,
    extent: pt(605, 302.8),
    fill: Color.transparent,
    layout: new TilingLayout({
      align: 'column',
      axis: 'column',
      hugContentsVertically: true,
      resizePolicies: [['header buttons', {
        height: 'fixed',
        width: 'fill'
      }], ['tabs', {
        height: 'fixed',
        width: 'fill'
      }], ['column view', {
        height: 'fixed',
        width: 'fill'
      }]]
    }),
    submorphs: [{
      name: 'header buttons',
      extent: pt(605, 49.8),
      fill: Color.rgba(0, 0, 0, 0),
      layout: new TilingLayout({
        axisAlign: 'center',
        padding: rect(10, 0, -10, 0),
        resizePolicies: [['eval backend chooser wrapper', {
          height: 'fixed',
          width: 'fill'
        }]]
      }),
      reactsToPointer: false,
      submorphs: [
        part(SystemButton, {
          name: 'go back',
          clipMode: 'hidden',
          borderRadius: {
            topLeft: 5,
            topRight: 0,
            bottomRight: 0,
            bottomLeft: 5
          },
          tooltip: 'Move backwards in history.',
          extent: pt(35, 26),
          padding: rect(10, 2, 3, -1),
          position: pt(7, 12.9),
          submorphs: [
            { name: 'label', textAndAttributes: Icon.textAttribute('caret-left'), fontSize: 20, fontColor: Color.rgb(52, 73, 94) }
          ]
        }), part(SystemButton, {
          name: 'browse history',
          borderWidth: {
            bottom: 1,
            left: 0,
            right: 0,
            top: 1
          },
          extent: pt(35, 26),
          borderRadius: 0,
          padding: rect(10, 5, 0, 0),
          position: pt(40, 12.9),
          tooltip: 'Browse navigation history.',
          submorphs: [
            { name: 'label', textAndAttributes: Icon.textAttribute('history'), fontSize: 14 }
          ]
        }), part(SystemButton, {
          name: 'go forward',
          clipMode: 'hidden',
          borderRadius: {
            topLeft: 0,
            topRight: 5,
            bottomRight: 5,
            bottomLeft: 0
          },
          tooltip: 'Move forwards in history.',
          extent: pt(35, 26),
          padding: rect(15, 2, -5, -1),
          position: pt(74, 12.9),
          submorphs: [{
            name: 'label',
            fontSize: 20,
            fontColor: Color.rgb(52, 73, 94),
            textAndAttributes: Icon.textAttribute('caret-right')
          }]
        }), {
          name: 'spacer',
          fill: Color.rgba(255, 255, 255, 0),
          extent: pt(15.1, 45.9),
          position: pt(-15.2, 19.6)
        }, part(SystemButton, {
          name: 'browse modules',
          extent: pt(35, 26),
          borderRadius: {
            topLeft: 5,
            topRight: 0,
            bottomRight: 0,
            bottomLeft: 5
          },
          tooltip: 'Browse loaded modules in the system.',
          padding: rect(10, 5, 0, 0),
          position: pt(152, 12),
          submorphs: [{
            name: 'label',
            fontColor: Color.rgb(52, 73, 94),
            fontSize: 14,
            textAndAttributes: Icon.textAttribute('list-alt')
          }]
        }), part(SystemButton, {
          name: 'global search',
          borderWidth: {
            bottom: 1,
            left: 0,
            right: 1,
            top: 1
          },
          extent: pt(35, 26),
          borderRadius: {
            topLeft: 0,
            topRight: 0,
            bottomRight: 0,
            bottomLeft: 0
          },
          tooltip: 'Open global code search.',
          padding: rect(10, 5, 0, 0),
          position: pt(186, 12),
          submorphs: [{
            name: 'label',
            fontColor: Color.rgb(52, 73, 94),
            fontSize: 14,
            textAndAttributes: Icon.textAttribute('search')
          }]
        }),
        part(SystemButton, {
          name: 'add tab',
          extent: pt(35, 26),
          tooltip: 'Open up a new browser tab.',
          borderRadius: {
            topLeft: 0,
            topRight: 5,
            bottomRight: 5,
            bottomLeft: 0
          },
          borderWidth: {
            left: 0,
            top: 1,
            bottom: 1,
            right: 1
          },
          padding: rect(10, 5, 0, 0),
          position: pt(221, 12),
          submorphs: [{
            name: 'label',
            fontColor: Color.rgb(52, 73, 94),
            fontSize: 14,
            textAndAttributes: Icon.textAttribute('plus')
          }]
        }),
        {
          name: 'eval backend chooser wrapper',
          extent: pt(252.1, 39),
          fill: Color.rgba(0, 0, 0, 0),
          layout: new TilingLayout({
            align: 'right',
            axisAlign: 'center',
            padding: rect(15, 15, 0, 0),
            spacing: 15
          }),
          position: pt(354.8, 5.8),
          reactsToPointer: false,
          submorphs: [part(BackendButtonDefault, {
            defaultViewModel: EvalBackendButtonModel,
            master: { auto: BackendButtonDefault, click: BackendButtonClicked },
            name: 'eval backend button',
            tooltip: 'Select evaluation backend for browser.',
            padding: rect(5, 4, 0, 0),
            nativeCursor: 'pointer',
            submorphs: [{
              type: 'label',
              name: 'label',
              textAndAttributes: ['local', null]
            }]
          })]
        }]
    }, part(Tabs, {
      name: 'tabs',
      extent: pt(605, 32),
      position: pt(0, 50),
      viewModel: {
        showsSingleTab: false,
        defaultTabMaster: component(BrowserTabDefault, {
          master: {
            click: BrowserTabClicked,
            hover: BrowserTabHovered,
            states: { selected: BrowserTabSelected }
          }
        })
      }
    }), part(MullerColumnView, {
      viewModel: { defaultTooltips: true },
      name: 'column view',
      extent: pt(605, 221),
      borderWidthBottom: 1,
      borderWidthTop: 1,
      borderColor: Color.rgb(112, 123, 124),
      position: pt(0, 50)
    })
    ]
  }, {
    type: Text,
    name: 'source editor',
    readOnly: false,
    needsDocument: true,
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 6,
      bottomLeft: 6
    },
    borderWidth: 1,
    clipMode: 'auto',
    extent: pt(605, 474),
    fixedHeight: true,
    fixedWidth: true,
    fontFamily: '"IBM Plex Mono"',
    lineWrapping: 'by-chars',
    padding: rect(4, 60, 0, -60),
    position: pt(0, 271.1),
    scroll: pt(0, 15)
  }, part(MetaInfoContainerCollapsed, {
    name: 'meta info text',
    master: {
      states: {
        warning: MetaInfoWarning,
        error: MetaInfoError,
        saved: MetaInfoSaved,
        inactive: MetaInfoInactive
      }
    },
    position: pt(9, 280.8)
  }), {
    // fixme: implement with view model...?
    type: HorizontalResizer,
    name: 'vertical resizer',
    scalingAbove: ['column view'],
    scalingBelow: ['source editor'],
    fixed: ['meta info text'],
    extent: pt(605, 8.7),
    fill: Color.rgba(230, 230, 230, 0),
    position: pt(0, 271)
  }]
});

async function browse (browseSpec = {}, browserOrProps = {}, optSystemInterface) {
  const browser = browserOrProps.isBrowser ? browserOrProps : part(SystemBrowser, browserOrProps);
  if (!browser.world()) browser.openInWindow();
  browser.env.forceUpdate();
  delete browser.state.selectedModule;
  return browser.browse({ systemInterface: optSystemInterface, ...browseSpec });
}

function browserForFile (fileName) {
  const browsers = $world.getWindows()
    .map(win => win.targetMorph).filter(ea => ea.isBrowser);
  const browserWithFile = browsers.find(({ selectedModule }) =>
    selectedModule && selectedModule.url === fileName);
  return browserWithFile;
}

async function open () {
  const browser = part(SystemBrowser);
  await browser.toggleWindowStyle(false);
  await browser.ensureColumnViewData();
  browser.openInWindow();
  return browser;
}

export {
  ComponentEditButton,
  FileStatusDefault,
  FileStatusError,
  FileStatusSaved,
  FileStatusInactive,
  FileStatusWarning,
  BrowserTabDefault,
  BrowserTabClicked,
  BrowserTabSelected,
  BrowserTabHovered,
  BackendButtonDefault,
  BackendButtonClicked,
  DarkButton,
  BrowserDirectoryControls,
  BrowserPackageControls,
  SystemBrowser,
  open,
  browse,
  browserForFile,
  BehaviorToggleButton,
  BehaviorToggleButtonDisabled
};
