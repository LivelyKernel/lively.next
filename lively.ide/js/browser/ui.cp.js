import { Color, rect, LinearGradient, pt } from 'lively.graphics';
import { ShadowObject, ViewModel, morph, easings, Morph, TilingLayout, ConstraintLayout, Text, Label, Icon,  component, part } from 'lively.morphic';
import { HorizontalResizer } from 'lively.components';
import { SystemButton, DarkButton, ButtonDefault } from 'lively.components/buttons.cp.js';
import { MullerColumnView } from 'lively.components/muller-columns.cp.js';
import { promise } from 'lively.lang';
import { EvalBackendButton } from '../eval-backend-ui.js';
import { BrowserModel, DirectoryControls, PackageControls } from './index.js';
import { Tabs, TabModel, DefaultTab } from '../../studio/tabs.cp.js';
import { once } from 'lively.bindings';

async function positionInRange (context, range, label) {
  if (!context?.isText) return;
  await context.whenRendered();
  const pos = context.indexToPosition(range.start);
  const end = context.lineRange(pos.row).end;
  label.leftCenter = context.charBoundsFromTextPosition(end).rightCenter().addXY(5, 0);
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
      editor: {
        derived: true,
        get () {
          return this.view.owner;
        }
      },
      expose: {
        get () {
          return ['positionInLine', 'collapse'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseUp', handler: 'minifyComponentMorph' },
            { target: 'revert button', signal: 'onMouseUp', handler: 'resetComponentDef' }
          ];
        }
      }
    };
  }

  viewDidLoad () {
    super.viewDidLoad();
    this.updateResetButton();
    once(this.componentDescriptor, 'makeDirty', this, 'updateResetButton');
  }

  updateResetButton () {
    this.ui.revertButton.master = this.componentDescriptor.isDirty()
      ? RevertComponentButton // eslint-disable-line no-use-before-define
      : RevertComponentButtonDisabled; // eslint-disable-line no-use-before-define
  }

  positionInLine () {
    const { view } = this;
    this.editor.readOnly = this.componentDescriptor.isDirty();
    return positionInRange(view.owner, this.componentDescriptor[Symbol.for('lively-module-meta')].range, view);
  }

  resetComponentDef () {
    this.componentDescriptor.reset();
    // make the browser reload the module
  }

  async minifyComponentMorph () {
    if (this._active || this._initializing) return;
    this._active = true;
    const {
      componentMorph,
      editor,
      view
    } = this;
    const placeholderPos = view.position;
    const pos = componentMorph.position;
    const wrapper = morph({
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
    componentMorph.remove();
    wrapper.remove();
    this._active = false;
  }

  async collapse (editButton) {
    const { editor, view } = this;
    editButton.reset();
    editButton.opacity = 0;
    editor.addMorph(editButton);
    await editButton.positionInLine();
    await view.animate({
      opacity: 0,
      scale: .2,
      center: view.center, // to preserve tfm origin
      duration: 300,
      easing: easings.outQuint
    });
    view.remove();
    const { center } = editButton;
    editButton.scale = 1.2;
    editButton.center = center;
    editButton.animate({
      scale: 1,
      opacity: 1,
      center,
      duration: 300,
      easing: easings.outQuint
    });
  }
}

class ComponentEditButtonMorph extends Morph {
  static get properties () {
    return {
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
    this.openInWorld(this.globalPosition);
    this.layout = null;
    const wrapper = this.addMorph({
      fill: Color.transparent,
      opacity: 0,
      epiMorph: true,
      submorphs: [componentMorph]
    });
    componentMorph.position = pt(0, 0);
    wrapper.scale = 0;
    this.fill = Color.transparent;
    await editor.withAnimationDo(() => {
      placeholder.opacity = 1;
      placeholder.scale = 1;
      placeholder.leftCenter = anchorPoint;
      this.submorphs[0].opacity = 0;
      this.extent = componentMorph.bounds().extent();
      this.center = this.world().visibleBounds().center();
      this.submorphs[0].center = this.extent.scaleBy(.5);
      wrapper.opacity = 1;
      wrapper.scale = 1;
    }, { duration: 300, easing: easings.outQuint });
    await componentMorph.whenRendered();
    componentMorph.openInWorld(componentMorph.globalPosition);
    this.remove();
  }

  async replaceWithPlaceholder () {
    const {
      componentDescriptor,
      editor
    } = this;
    const componentMorph = componentDescriptor.getComponentMorph();
    const btnPlaceholder = editor.addMorph(part(ComponentEditControls, { // eslint-disable-line no-use-before-define
      name: 'component edit control',
      viewModel: {
        componentMorph,
        componentDescriptor
      },
      opacity: 0
    }));
    await btnPlaceholder.positionInLine();
    once(componentMorph, 'remove', () => btnPlaceholder.collapse(this));
    this.remove();
    btnPlaceholder.opacity = 1;
  }

  async expand () {
    const {
      componentDescriptor,
      editor,
      leftCenter: lineAnchorPoint
    } = this;
    const componentMorph = await componentDescriptor.edit();
    const btnPlaceholder = editor.addMorph(part(ComponentEditControls, { // eslint-disable-line no-use-before-define
      name: 'edit button placeholder',
      viewModel: {
        componentMorph,
        componentDescriptor
      },
      opacity: 0,
      scale: .2
    }));
    btnPlaceholder._initializing = true;
    btnPlaceholder.leftCenter = lineAnchorPoint;
    await this.animateSwapWithPlaceholder(btnPlaceholder, componentMorph);
    once(componentMorph, 'remove', () => btnPlaceholder.collapse(this));
    btnPlaceholder._initializing = false;
  }

  positionInLine () {
    if (this.componentDescriptor._cachedComponent?.world()) {
      return this.replaceWithPlaceholder();
    }
    return positionInRange(this.owner, this.componentDescriptor[Symbol.for('lively-module-meta')].range, this);
  }

  reset () {
    this.master = null;
    this.master = ComponentEditButton; // eslint-disable-line no-use-before-define
    this.master.applyIfNeeded(true);
    this.submorphs = [this.submorphs[0]]; // just keep the label
  }

  onMouseUp (evt) {
    super.onMouseUp(evt);
    this.expand();
  }
}

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
    this.master = FileStatusDefault; // eslint-disable-line no-use-before-define
    errorControls.isLayoutable = statusBox.isLayoutable = statusLabel.isLayoutable = false;
    statusBox.opacity = statusLabel.opacity = 0;
    this.adjustHeight();
  }

  showInfoInWorkspace () {
    const content = this.ui.statusBox.textString;
    const title = content.split('\n')[0];
    this.world().execCommand('open workspace',
      { title, content, language: 'text' });
  }

  relayout () {
    const { filePath, clipboardControls, statusBox, errorControls } = this.ui;
    let pad = 10 + filePath.left;
    filePath.width = this.width - clipboardControls.width - pad;
    clipboardControls.right = this.width;
    statusBox.width = this.width - 30;
    errorControls.topRight = statusBox.bottomRight.withX(this.width);
  }

  adjustHeight () {
    const { errorControls } = this.ui;
    if (this.ui.statusBox.opacity > 0) {
      this.height = errorControls.bottom;
    } else {
      this.height = 50;
    }
  }

  getPath () {
    return this.ui.filePath.textAndAttributes;
  }

  setPath (path) {
    const { filePath, clipboardControls, exportToHtml, freezeButton } = this.ui;
    clipboardControls.opacity = 1;
    filePath.value = path;
    freezeButton.isLayoutable = freezeButton.visible = filePath.textString.includes('.js');
    exportToHtml.isLayoutable = exportToHtml.visible = filePath.textString.includes('.md');
  }

  toggleTestButton (active) {
    this.ui.runTestsButton.visible = this.ui.runTestsButton.isLayoutable = active;
  }

  showInactive (duration = 300) {
    this.requestTransition(async () => {
      const { filePath, statusBox, statusLabel, pathContainer, clipboardControls } = this.ui;
      filePath.value = 'No file selected';
      this.master = FileStatusInactive; // eslint-disable-line no-use-before-define
      this.master.applyAnimated({ duration });
      pathContainer.layout.renderViaCSS = false;
      await this.withAnimationDo(() => {
        statusBox.isLayoutable = statusLabel.isLayoutable = false;
        statusLabel.opacity = 0;
        statusBox.opacity = 0;
        clipboardControls.opacity = 0.5;
        this.adjustHeight();
      }, { duration });

      pathContainer.layout.renderViaCSS = true;
    });
  }

  showDefault (duration = 300) {
    this.requestTransition(async () => {
      const { statusBox, statusLabel, pathContainer, errorControls } = this.ui;
      this.master = FileStatusDefault; // eslint-disable-line no-use-before-define
      this.master.applyAnimated({ duration });
      pathContainer.layout.renderViaCSS = false;
      await this.withAnimationDo(() => {
        errorControls.isLayoutable = statusBox.isLayoutable = statusLabel.isLayoutable = false;
        statusBox.opacity = statusLabel.opacity = 0;
        this.adjustHeight();
      }, { duration });
      pathContainer.layout.renderViaCSS = true;
    });
  }

  async showError (err, duration = 300) {
    this.requestTransition(async () => {
      const { statusBox, statusLabel, errorControls } = this.ui;
      statusBox.textString = err;
      statusLabel.value = ['Error ', null, ...Icon.textAttribute('exclamation-triangle', { paddingTop: '3px' })];
      await statusLabel.whenRendered();
      this.master = FileStatusError; // eslint-disable-line no-use-before-define
      this.master.applyAnimated({ duration });
      await this.withAnimationDo(() => {
        statusLabel.opacity = statusBox.opacity = 1;
        errorControls.isLayoutable = statusBox.isLayoutable = statusLabel.isLayoutable = true;
        this.adjustHeight();
      }, { duration });
    });
  }

  async showWarning (warning, duration = 300) {
    await this.requestTransition(async () => {
      const { statusBox, statusLabel, errorControls } = this.ui;
      statusBox.textString = warning;
      statusLabel.value = ['Warning ', null, ...Icon.textAttribute('exclamation-circle', { paddingTop: '3px' })];
      await statusLabel.whenRendered();
      this.master = FileStatusWarning; // eslint-disable-line no-use-before-define
      this.master.applyAnimated({ duration });
      await this.withAnimationDo(() => {
        statusLabel.opacity = statusBox.opacity = 1;
        errorControls.isLayoutable = statusBox.isLayoutable = statusLabel.isLayoutable = true;
        this.adjustHeight();
      }, { duration });
    });
  }

  async showFrozen (frozenMessage, duration = 300) {
    this.requestTransition(async () => {
      const { statusBox, statusLabel, pathContainer } = this.ui;
      statusBox.textString = frozenMessage;
      statusLabel.value = ['Frozen ', null, ...Icon.textAttribute('snowflake', { paddingTop: '3px' })];
      await statusLabel.whenRendered();
      this.master = FileStatusFrozen; // eslint-disable-line no-use-before-define
      this.master.applyAnimated({ duration });
      await this.withAnimationDo(() => {
        statusLabel.opacity = statusBox.opacity = 1;
        statusBox.isLayoutable = statusLabel.isLayoutable = true;
        this.adjustHeight();
      }, { duration });
      pathContainer.layout.renderViaCSS = true;
    });
  }

  async showSaved (duration = 300, timeout = 5000) {
    if (this._animating) return;
    this._animating = true;

    this.requestTransition(async () => {
      const { statusBox, statusLabel, errorControls } = this.ui;
      statusLabel.opacity = 0;
      statusLabel.value = ['Saved ', null, ...Icon.textAttribute('check', { paddingTop: '3px' })];
      await statusLabel.whenRendered();
      this.master = FileStatusSaved; // eslint-disable-line no-use-before-define
      this.master.applyAnimated({ duration });
      await this.withAnimationDo(() => {
        statusBox.opacity = 0;
        errorControls.isLayoutable = statusBox.isLayoutable = false;
        statusLabel.isLayoutable = true;
        statusLabel.opacity = 1;
        this.adjustHeight();
      }, { duration });
    });

    await promise.delay(timeout);
    this._animating = false;
    // cancel if another saved was triggered in the meantime
    this.showDefault(duration);
  }

  async requestTransition (transition) {
    if (this._currentTransition) {
      this._nextTransition = transition;
      await this._currentTransition; // in the meantime multiple next transitions may pour in
      this.requestTransition(this._nextTransition); // just animate the last transition that poured in
      this._nextTransition = null;
    } else {
      this._currentTransition = transition();
      await this._currentTransition;
      this._currentTransition = null;
    }
  }
}

const ComponentEditButtonDefault = component({
  type: ComponentEditButtonMorph,
  isLayoutable: false,
  fill: Color.rgba(76, 175, 80, 0.7539),
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
      name: 'label',
      reactsToPointer: false,
      padding: rect(5, 1, 0, 0),
      fontColor: Color.white,
      fontWeight: 'bold',
      fontSize: 12,
      textAndAttributes: ['Edit Component ', {}, ...Icon.textAttribute('play', { paddingTop: '2px' })]
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
    part(RevertComponentButton, { name: 'revert button' })
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
      }]],
      wrapSubmorphs: false
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
      fontWeight: 400
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

const FileStatusFrozen = component(FileStatusDefault, {
  name: 'file status frozen',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(41, 182, 246) },
      { offset: 1, color: Color.rgb(30, 136, 229) }],
    vector: rect(0, 0, 0, 1)
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
  borderColor: Color.rgb(44, 62, 80),
  extent: pt(130.3, 26.1),
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgba(44, 62, 80, 0.9) }, { offset: 1, color: Color.rgba(33, 47, 60, 0.9) }], vector: rect(0.5, 0, 0, 1) }),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(163, 228, 215),
    fontFamily: 'IBM Plex Mono',
    fontSize: 14
  }]
});

const BackendButtonClicked = component(BackendButtonDefault, {
  name: 'backend button clicked',
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(33, 48, 63) }, { offset: 1, color: Color.rgb(33, 47, 60) }], vector: rect(0.5, 0, 0, 1) }),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(63, 110, 101),
    fontFamily: 'IBM Plex Mono',
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
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(83.2, 30.8),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new TilingLayout({
    axis: 'column',
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
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(123.4, 30.8),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new TilingLayout({
    axis: 'column',
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

const SystemBrowser = component({
  name: 'system browser',
  defaultViewModel: BrowserModel,
  layout: new ConstraintLayout({
    lastExtent: pt(605, 745),
    reactToSubmorphAnimations: false,
    submorphSettings: [
      ['header buttons', {
        x: 'resize',
        y: 'fixed'
      }],
      ['column view', {
        x: 'resize',
        y: 'fixed'
      }],
      ['source editor', {
        x: 'resize',
        y: 'resize'
      }],
      ['tabs', {
        x: 'resize',
        y: 'fixed'
      }],
      ['meta info text', {
        x: 'resize',
        y: 'fixed'
      }],
      ['vertical resizer', {
        x: 'resize',
        y: 'fixed'
      }]
    ]
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
    name: 'header buttons',
    extent: pt(605, 49.8),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new ConstraintLayout({
      lastExtent: {
        x: 605,
        y: 49.79296875
      },
      reactToSubmorphAnimations: false,
      submorphSettings: [
        ['eval backend button', {
          x: 'move',
          y: 'fixed'
        }],
        ['add tab', {
          x: 'fixed',
          y: 'fixed'
        }],
        ['global search', {
          x: 'fixed',
          y: 'fixed'
        }],
        ['browse modules', {
          x: 'fixed',
          y: 'fixed'
        }],
        ['go forward', {
          x: 'fixed',
          y: 'fixed'
        }],
        ['browse history', {
          x: 'fixed',
          y: 'fixed'
        }],
        ['go back', {
          x: 'fixed',
          y: 'fixed'
        }],
        ['eval backend chooser wrapper', {
          x: 'move',
          y: 'fixed'
        }]]
    }),
    reactsToPointer: false,
    submorphs: [
      part(SystemButton, {
        name: 'go back',
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
      }), part(SystemButton, {
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
          axis: 'row',
          axisAlign: 'center',
          align: 'right',
          padding: {
            height: 0,
            width: 0,
            x: 15,
            y: 15
          },
          spacing: 15
        }),
        position: pt(354.8, 5.8),
        reactsToPointer: false,
        submorphs: [{
          type: EvalBackendButton,
          master: { auto: BackendButtonDefault, click: BackendButtonClicked },
          name: 'eval backend button',
          tooltip: 'Select evaluation backend for browser.',
          padding: rect(5, 4, 0, 0),
          nativeCursor: 'pointer',
          submorphs: [{
            type: Label,
            name: 'label',
            textAndAttributes: ['local', null]
          }]
        }]
      }]
  }, part(Tabs, {
    name: 'tabs',
    extent: pt(605, 32),
    position: pt(0, 50),
    viewModel: {
      showsSingleTab: false,
      selectedTabMaster: BrowserTabSelected,
      defaultTabMaster: BrowserTabDefault,
      clickedTabMaster: BrowserTabClicked,
      hoveredTabMaster: BrowserTabHovered
    }
  }), part(MullerColumnView, {
    viewModel: { defaultTooltips: true },
    name: 'column view',
    extent: pt(605, 221),
    borderWidthBottom: 1,
    borderWidthTop: 1,
    borderColor: Color.rgb(112, 123, 124),
    position: pt(0, 50)
  }), {
    type: Text,
    name: 'source editor',
    readOnly: false,
    acceptsDrops: false,
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
  }, {
    type: PathIndicator,
    master: FileStatusDefault,
    name: 'meta info text',
    isLayoutable: true,
    clipMode: 'hidden',
    extent: pt(587.6, 60.4),
    position: pt(9, 280.8),
    layout: new TilingLayout({
      axis: 'column',
      axisAlign: 'right',
      hugContentsVertically: true,
      orderByIndex: true,
      padding: rect(10, 10, 0, 0),
      reactToSubmorphAnimations: true,
      resizePolicies: [['path container', {
        height: 'fixed',
        width: 'fill'
      }], ['status box', {
        height: 'fixed',
        width: 'fill'
      }], ['error controls', {
        height: 'fixed',
        width: 'fixed'
      }]],
      wrapSubmorphs: false
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
        }]],
        wrapSubmorphs: false
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
        opacity: 0,
        padding: rect(10, 4, 0, 0),
        textAndAttributes: ['Error ', null, '', {
          fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
          fontWeight: '900',
          paddingTop: '3px',
          textStyleClasses: ['fas']
        }]
      }, {
        type: Label,
        name: 'file path',
        extent: pt(388.9, 18),
        clipMode: 'hidden',
        fontColor: Color.rgb(253, 254, 254),
        fontFamily: 'IBM Plex Mono',
        fontSize: 14,
        fixedWidth: true,
        fontWeight: 'bold',
        textAndAttributes: ['lively.sync/client.js:Client#toString', null]
      }, {
        name: 'clipboard controls',
        clipMode: 'hidden',
        extent: pt(169.1, 27.7),
        fill: Color.rgba(0, 0, 0, 0),
        layout: new TilingLayout({
          align: 'right',
          axisAlign: 'center',
          orderByIndex: true,
          spacing: 5,
          wrapSubmorphs: false,
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
      fontFamily: '"IBM Plex Sans",Sans-Serif',
      fontSize: 16,
      padding: rect(5, 0, -5, 0),
      lineWrapping: true,
      opacity: 0,
      reactsToPointer: false,
      readOnly: true
    }, {
      name: 'error controls',
      extent: pt(205, 41),
      fill: Color.rgba(0, 0, 0, 0),
      layout: new TilingLayout({
        axis: 'row',
        wrapSubmorphs: false,
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
            fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
            fontWeight: '900',
            paddingTop: '1px',
            textStyleClasses: ['fas']
          }]
        }),
        part(EmbeddedIcon, {
          name: 'open in workspace',
          textAndAttributes: ['Open in workspace ', null, '', {
            fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
            fontWeight: '900',
            paddingTop: '2px',
            textStyleClasses: ['fas']
          }]
        })]
    }]
  }, {
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
  const browser = browserOrProps.isBrowser ? browserOrProps : part(SystemBrowser);
  if (!browser.world()) browser.openInWindow();
  browser.env.forceUpdate();
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
  await browser.viewModel.toggleWindowStyle(false);
  await browser.viewModel.ensureColumnViewData();
  browser.openInWindow();
  return browser;
}

export {
  ComponentEditButton,
  FileStatusDefault, FileStatusError, FileStatusSaved,
  FileStatusFrozen, FileStatusInactive, FileStatusWarning,
  BrowserTabDefault, BrowserTabClicked, BrowserTabSelected, BrowserTabHovered,
  BackendButtonDefault, BackendButtonClicked,
  DarkButton,
  BrowserDirectoryControls,
  BrowserPackageControls,
  SystemBrowser,
  open, browse, browserForFile
};
