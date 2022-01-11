import { component, part, ViewModel } from 'lively.morphic/components/core.js';
import { Color, rect, LinearGradient, pt } from 'lively.graphics';
import { ShadowObject, Morph, TilingLayout, ProportionalLayout, Text, Label, Icon, HorizontalLayout } from 'lively.morphic';
import { ButtonDefault } from 'lively.components/buttons.cp.js';
import { DefaultList } from 'lively.components/list.cp.js';
import { MullerColumnView } from 'lively.components/muller-columns.cp.js';
import { PackageTreeData, BrowserModel, DirectoryControls, PackageControls } from './index.js';
import { signal, noUpdate, connect } from 'lively.bindings';
import { arr, promise } from 'lively.lang';
import { EvalBackendButton } from '../eval-backend-ui.js';
import { HorizontalResizer } from 'lively.components';

const FileStatusDefault = component({
  name: 'file status default',
  borderColor: Color.rgb(44, 62, 80),
  borderRadius: 5,
  borderWidth: 1,
  dropShadow: new ShadowObject({ distance: 0, color: Color.rgba(0, 0, 0, 0.5) }),
  extent: pt(176.3, 35.3),
  fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgba(44, 62, 80, 0.9) }, { offset: 1, color: Color.rgba(33, 47, 60, 0.9) }], vector: rect(0.5, 0, 0, 1) }),
  position: pt(772.1, 1648.5)
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
  name: 'file sttaus inactive',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(128, 139, 150) },
      { offset: 1, color: Color.rgb(93, 109, 126) }],
    vector: rect(0.5, 0, 0, 1)
  })
});

const FileStatusWarning = component(FileStatusDefault, {
  name: 'file status warning',
  fill: new LinearGradient({
    stops: [
      { offset: 0, color: Color.rgb(241, 196, 15) },
      { offset: 1, color: Color.rgb(249, 231, 159) }],
    vector: rect(0.5, 1, 0, -1)
  })
});

// BackendButtonDefault.openInWorld()
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

// BackendButtonClicked.openInWorld()
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

// part(EmbeddedIcon).openInWorld()
const EmbeddedIcon = component(EmbeddedIconDefault, {
  name: 'embedded icon',
  master: { auto: EmbeddedIconDefault, hover: EmbeddedIconHovered, click: EmbeddedIconClicked }
});

// DarkButton.openInWorld()
const DarkButton = component(ButtonDefault, {
  name: 'dark button',
  borderWidth: 0,
  fill: Color.rgba(0, 0, 0, 0.75),
  submorphs: [{
    name: 'label',
    fontSize: 9,
    fontColor: Color.rgb(255, 255, 255)
  }]
});

const BrowserDirectoryControls = component({
  type: DirectoryControls,
  name: 'directory controls',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(83.2, 30.8),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new HorizontalLayout({
    align: 'center',
    autoResize: false,
    direction: 'rightToLeft',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 5,
      y: 5
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false,
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

// BrowserPackageControls.openInWorld();
const BrowserPackageControls = component({
  type: PackageControls,
  name: 'browser package controls',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(123.4, 30.8),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new HorizontalLayout({
    align: 'center',
    autoResize: false,
    direction: 'rightToLeft',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 5,
      y: 5
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false,
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
            runTestsButton: this.getSubmorphNamed('run tests in module')
          };
        }
      }
    };
  }

  reset () {
    const { statusBox, statusLabel, pathContainer, errorControls } = this.ui;
    this.master = FileStatusDefault;
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
    const { statusBox, clipboardControls, pathContainer, errorControls } = this.ui;
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
    const { filePath, clipboardControls, exportToHtml } = this.ui;
    clipboardControls.opacity = 1;
    filePath.value = path;
    exportToHtml.isLayoutable = exportToHtml.visible = filePath.textString.includes('.md');
  }

  toggleTestButton (active) {
    this.ui.runTestsButton.visible = this.ui.runTestsButton.isLayoutable = active;
  }

  // this.showInactive(300)

  showInactive (duration = 300) {
    this.requestTransition(async () => {
      const { filePath, statusBox, statusLabel, pathContainer, clipboardControls } = this.ui;
      filePath.value = 'No file selected';
      this.master = FileStatusInactive;
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
      this.master = FileStatusDefault;
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
      const { statusBox, statusLabel, pathContainer, errorControls } = this.ui;
      statusBox.textString = err;
      statusLabel.value = ['Error ', null, ...Icon.textAttribute('exclamation-triangle', { paddingTop: '3px' })];
      await statusLabel.whenRendered();
      this.master = FileStatusError;
      this.master.applyAnimated({ duration });
      pathContainer.layout.renderViaCSS = false;
      await this.withAnimationDo(() => {
        statusLabel.opacity = statusBox.opacity = 1;
        errorControls.isLayoutable = statusBox.isLayoutable = statusLabel.isLayoutable = true;
        this.adjustHeight();
      }, { duration });
      pathContainer.layout.renderViaCSS = true;
    });
  }

  async showWarning (warning, duration = 300) {
    await this.requestTransition(async () => {
      const { statusBox, statusLabel, pathContainer, errorControls } = this.ui;
      statusBox.textString = warning;
      statusLabel.value = ['Warning ', null, ...Icon.textAttribute('exclamation-circle', { paddingTop: '3px' })];
      await statusLabel.whenRendered();
      this.master = FileStatusWarning;
      this.master.applyAnimated({ duration });
      pathContainer.layout.renderViaCSS = false;
      await this.withAnimationDo(() => {
        statusLabel.opacity = statusBox.opacity = 1;
        errorControls.isLayoutable = statusBox.isLayoutable = statusLabel.isLayoutable = true;
        this.adjustHeight();
      }, { duration });
      pathContainer.layout.renderViaCSS = true;
    });
  }

  async showFrozen (frozenMessage, duration = 300) {
    this.requestTransition(async () => {
      const { statusBox, statusLabel, pathContainer } = this.ui;
      statusBox.textString = frozenMessage;
      statusLabel.value = ['Frozen ', null, ...Icon.textAttribute('snowflake', { paddingTop: '3px' })];
      await statusLabel.whenRendered();
      this.master = FileStatusFrozen;
      this.master.applyAnimated({ duration });
      pathContainer.layout.renderViaCSS = false;
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
      const { statusBox, statusLabel, pathContainer, errorControls } = this.ui;
      statusLabel.opacity = 0;
      statusLabel.value = ['Saved ', null, ...Icon.textAttribute('check', { paddingTop: '3px' })];
      await statusLabel.whenRendered();
      this.master = FileStatusSaved;
      this.master.applyAnimated({ duration });
      pathContainer.layout.renderViaCSS = false;
      await this.withAnimationDo(() => {
        statusBox.opacity = 0;
        errorControls.isLayoutable = statusBox.isLayoutable = false;
        statusLabel.isLayoutable = true;
        statusLabel.opacity = 1;
        this.adjustHeight();
      }, { duration });
      pathContainer.layout.renderViaCSS = true;
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

// b = part(SystemBrowser)
// b.get('column view').width
// b.openInWindow()
// SystemBrowser.openInWorld()
const SystemBrowser = component({
  name: 'system browser',
  defaultViewModel: BrowserModel,
  layout: new ProportionalLayout({
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
    layout: new ProportionalLayout({
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
        ['global search', {
          x: 'fixed',
          y: 'fixed'
        }],
        ['browse modules', {
          x: 'fixed',
          y: 'fixed'
        }], ['go forward', {
          x: 'fixed',
          y: 'fixed'
        }], ['browse history', {
          x: 'fixed',
          y: 'fixed'
        }], ['go back', {
          x: 'fixed',
          y: 'fixed'
        }], ['eval backend chooser wrapper', {
          x: 'move',
          y: 'fixed'
        }]]
    }),
    reactsToPointer: false,
    submorphs: [
      part(ButtonDefault, {
        name: 'go back',
        borderRadius: {
          topLeft: 5,
          topRight: 0,
          bottomRight: 0,
          bottomLeft: 5
        },
        extent: pt(35, 26),
        padding: rect(10, 2, 3, -1),
        position: pt(7, 12.9),
        submorphs: [
          { name: 'label', textAndAttributes: Icon.textAttribute('caret-left'), fontSize: 20, fontColor: Color.rgb(52, 73, 94) }
        ]
      }), part(ButtonDefault, {
        name: 'browse history',
        extent: pt(35, 26),
        borderRadius: 0,
        padding: rect(10, 5, 0, 0),
        position: pt(40, 12.9),
        submorphs: [
          { name: 'label', textAndAttributes: Icon.textAttribute('history'), fontSize: 14 }
        ]
      }), part(ButtonDefault, {
        name: 'go forward',
        borderRadius: {
          topLeft: 0,
          topRight: 5,
          bottomRight: 5,
          bottomLeft: 0
        },
        extent: pt(35, 26),
        padding: rect(15, 2, -5, -1),
        position: pt(74, 12.9),
        submorphs: [{
          name: 'label',
          fontSize: 20,
          fontColor: Color.rgb(52, 73, 94),
          textAndAttributes: Icon.textAttribute('caret-right')
        }]
      }), part(ButtonDefault, {
        name: 'browse modules',
        extent: pt(35, 26),
        borderRadius: {
          topLeft: 5,
          topRight: 0,
          bottomRight: 0,
          bottomLeft: 5
        },
        padding: rect(10, 5, 0, 0),
        position: pt(152, 12),
        submorphs: [{
          name: 'label',
          fontColor: Color.rgb(52, 73, 94),
          fontSize: 14,
          textAndAttributes: Icon.textAttribute('list-alt')
        }]
      }), part(ButtonDefault, {
        name: 'global search',
        extent: pt(35, 26),
        borderRadius: {
          topLeft: 0,
          topRight: 5,
          bottomRight: 5,
          bottomLeft: 0
        },
        padding: rect(10, 5, 0, 0),
        position: pt(186, 12),
        submorphs: [{
          name: 'label',
          fontColor: Color.rgb(52, 73, 94),
          fontSize: 14,
          textAndAttributes: Icon.textAttribute('search')
        }]
      }),
      {
        name: 'eval backend chooser wrapper',
        extent: pt(252.1, 39),
        fill: Color.rgba(0, 0, 0, 0),
        layout: new HorizontalLayout({
          align: 'center',
          autoResize: false,
          direction: 'rightToLeft',
          orderByIndex: true,
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
          master: BackendButtonDefault,
          name: 'eval backend button',
          padding: rect(5, 4, 0, 0),
          submorphs: [{
            type: Label,
            name: 'label',
            textAndAttributes: ['local', null]
          }]
        }]
      }]
  }, part(MullerColumnView, {
    name: 'column view',
    extent: pt(605, 221.1),
    borderWidthBottom: 1,
    borderWidthTop: 1,
    borderColor: Color.rgb(112, 123, 124),
    position: pt(0, 50)
  }), {
    type: Text,
    name: 'source editor',
    acceptsDrops: false,
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 6,
      bottomLeft: 6
    },
    borderWidth: 1,
    clipMode: 'auto',
    extent: pt(605, 472.2),
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
      resizePolicies: [['path container', {
        height: 'fixed',
        width: 'fill'
      }], ['status box', {
        height: 'fixed',
        width: 'fill'
      }], ['error controls', {
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
        renderViaCSS: true,
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
          wrapSubmorphs: false
        }),
        submorphs: [part(EmbeddedIcon, {
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
      readOnly: true
    }, {
      name: 'error controls',
      extent: pt(205, 41),
      fill: Color.rgba(0, 0, 0, 0),
      layout: new TilingLayout({
        axis: 'row',
        direction: 'leftToRight',
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
    position: pt(-0.6, 271.1)
  }]
});

async function browse (browseSpec = {}, browserOrProps = {}, optSystemInterface) {
  // browse spec:
  // packageName, moduleName, codeEntity, scroll, textPosition like {row: 0, column: 0}
  const browser = browserOrProps.isBrowser ? browserOrProps : part(SystemBrowser);
  if (!browser.world()) browser.openInWindow();
  return browser.browse(browseSpec, optSystemInterface);
}

async function open () {
  const browser = part(SystemBrowser);
  browser.openInWindow();
  return browser;
}

export {
  FileStatusDefault, FileStatusError, FileStatusSaved,
  FileStatusFrozen, FileStatusInactive, FileStatusWarning,
  BackendButtonDefault, BackendButtonClicked,
  DarkButton,
  BrowserDirectoryControls,
  BrowserPackageControls,
  SystemBrowser,
  open, browse
};
