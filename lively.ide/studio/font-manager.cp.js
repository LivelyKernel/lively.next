/* global FormData */
import { component, add, part, TilingLayout, ViewModel } from 'lively.morphic';
import { pt, rect } from 'lively.graphics/geometry-2d.js';
import { Color } from 'lively.graphics/color.js';

import { Text } from 'lively.morphic/text/morph.js';

import { currentUsername } from 'lively.user';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { resource } from 'lively.resources';
import { DarkPopupWindow } from './shared.cp.js';

'format esm';

const FONT_ENTRY_HEADER_HEIGHT = 37;
const FONT_ENTRY_FULL_HEIGHT = 200;

export function openFontManager () {
  part(FontManagerPopup).openInWorld(); // eslint-disable-line no-use-before-define
}

class FontManagerModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return [];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onNativeDrop', target: 'drag and drop area', handler: 'onNativeDrop' },
            { signal: 'onNativeDragenter', target: 'drag and drop area', handler: 'onNativeDragenter' },
            { signal: 'onNativeDragleave', target: 'drag and drop area', handler: 'onNativeDragleave' },
            { signal: 'onNativeDragend', target: 'drag and drop area', handler: 'onNativeDragend' },
            { target: 'upload font button', signal: 'onMouseDown', handler: 'openFilePicker' }
          ];
        }
      }
    };
  }

  async viewDidLoad () {
    if ($world.openedProject) await this.regenerateFontList(true);
  }

  async regenerateFontList (withLoadingIndicator = false) {
    let li;
    if (withLoadingIndicator) li = $world.showLoadingIndicatorFor(this.view, 'Loadingf Project Fonts');
    this.ui.fontListContainer.submorphs = [];
    const projectFonts = await $world.openedProject.retrieveProjectFontsFromCSS();
    for (let fontObj of projectFonts) {
      const { fontName, fileName, fontWeight, fontStyle, unicodeRange } = fontObj;

      this.ui.fontListContainer.addMorph(part(FontListEntry, { // eslint-disable-line no-use-before-define
        viewModel: {
          collapsed: true,
          fontName,
          fileName,
          fontWeight,
          fontStyle,
          unicodeRange
        }
      }));
    }
    li?.remove();
  }

  async openFilePicker () {
    const pickerOpts = {
      multiple: true,
      types: [
        {
          description: 'woff2 webfonts',
          accept: {
            'font/*': ['.woff2']
          }
        }
      ],
      excludeAcceptAllOption: true

    };
    this.allowUploads = false;
    const files = await window.showOpenFilePicker(pickerOpts);
    if (files.length === 0) this.allowUploads = true;

    for (let fontFile of files) {
      let font = await fontFile.getFile();
      await this.uploadFont(font);
    }

    await this.regenerateFontList();
  }

  async uploadFont (file) {
    const fd = new FormData();
    fd.append('file', file, file.name);

    let res;
    res = resource(System.baseURL);
    let uploadPath;
    if (currentUsername() === 'guest') {
      uploadPath = 'uploads/';
    } else uploadPath = $world.openedProject ? $world.openedProject.url.replace(System.baseURL, '') + '/assets/' : 'users/' + currentUsername() + '/uploads';
    res = res.join(`/upload?uploadPath=${encodeURIComponent(uploadPath)}`);
    await res.write(fd);

    if (!$world.openedProject) return;
    let name = file.name.replace('.woff2', '');
    await $world.openedProject.addCustomFontFace({
      fontWeight: 400,
      fontName: name,
      fileName: name,
      fontStyle: 'normal',
      unicodeRange: '\"\"'
    });
  }

  async onNativeDrop (evt) {
    const { dragAndDropArea, statusText } = this.ui;

    dragAndDropArea.borderWidth = 2;

    const { domEvt } = evt;
    if (!domEvt.dataTransfer.items.length) return;
    const legalFiles = Array.from(domEvt.dataTransfer.items).filter(item => item.type === 'font/woff2').map(i => i.getAsFile());
    const legalFilesCount = legalFiles.length;
    statusText.value = `${legalFilesCount} fonts for upload!`;

    if (legalFilesCount) {
      for (let legalFile of legalFiles) {
        await this.uploadFont(legalFile);
      }
    }

    await this.regenerateFontList();
  }

  resetStatusText () {
    this.ui.statusTexts.value = 'Drop Fonts (woff2) for upload!';
  }

  onNativeDragenter (evt) {
    this.ui.dragAndDropArea.borderWidth = 7;
  }

  onNativeDragleave (evt) {
    this.ui.dragAndDropArea.borderWidth = 2;
  }

  onNativeDragend (evt) {
    this.ui.dragAndDropArea.borderWidth = 2;
  }
}

class FontListEntryModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { target: 'collapse button', signal: 'onMouseDown', handler: 'toggleCollapse' },
            { target: 'font delete', signal: 'onMouseDown', handler: 'deleteFont' },
            { target: 'name edit', signal: 'onMouseDown', handler: 'nameEdit' }
          ];
        }
      },
      collapsed: {
        defaultFalue: true
      },

      fontName: {},
      fileName: {},
      fontWeight: {
        defaultValue: 'normal'
      },
      fontStyle: {
        defaultValue: 'normal'
      },
      unicodeRange: {}
    };
  }

  async nameEdit () {
    const { nameEdit, fontName } = this.ui;
    if (this._nameEditing) {
      nameEdit.textAndAttributes = ['', {
        fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
        fontWeight: '900'
      }];
      fontName.readOnly = false;
      fontName.focus();
    } else {
      nameEdit.textAndAttributes = ['', {
        fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
        fontWeight: '900'
      }];
      await this.deleteFont(true);
      this.fontName = fontName.textString;
      await this.addFont();
    }

    this._nameEditing = !this._nameEditing;
  }

  async addFont () {
    await $world.openedProject.addCustomFontFace({
      fontWeight: this.fontWeight,
      fontName: this.fontName,
      fileName: this.fileName,
      fontStyle: this.fontStyle,
      unicodeRange: this.uniCodeRange
    });
  }

  async deleteFont (keepView = false) {
    const fontObj = {
      fileName: this.fileName,
      fontName: this.fontName,
      fontWeight: this.fontWeight,
      fontStyle: this.fontStyle,
      unicodeRange: this.unicodeRange
    };
    await $world.openedProject.deleteCustomFont(fontObj);
    if (!keepView) this.view.remove();
  }

  applyCollapse () {
    const { fontSettingsContainer, collapseButton } = this.ui;
    if (this.collapsed) {
      fontSettingsContainer.visible = fontSettingsContainer.layoutable = false;
      this.view.height = FONT_ENTRY_HEADER_HEIGHT;
      collapseButton.textAndAttributes = ['', {
        fontFamily: 'Tabler Icons',
        fontWeight: '900'
      }];
    } else {
      fontSettingsContainer.visible = fontSettingsContainer.layoutable = true;
      this.view.height = FONT_ENTRY_FULL_HEIGHT;
      collapseButton.textAndAttributes = ['', {
        fontFamily: 'Tabler Icons',
        fontWeight: '900'
      }];
    }
  }

  toggleCollapse () {
    this.collapsed = !this.collapsed;
    this.applyCollapse();
  }

  viewDidLoad () {
    // this.view.withAllSubmorphsDo(m => m.halosEnabled = false);
    this.onRefresh();
    this.applyCollapse();
  }

  onRefresh () {
    const { styleShow, unicodeShow, weightShow, fontName } = this.ui;
    styleShow.tooltip = this.fontStyle;
    unicodeShow.tooltip = this.unicodeRange || 'No specific range set.';
    weightShow.tooltip = this.fontWeight;
    fontName.textString = this.fontName;
  }
}

const FontListEntry = component({
  defaultViewModel: FontListEntryModel,
  extent: pt(214.5, FONT_ENTRY_FULL_HEIGHT),
  layout: new TilingLayout({
    axis: 'column',
    orderByIndex: true,
    resizePolicies: [['list header', {
      height: 'fixed',
      width: 'fill'
    }], ['font settings container', {
      height: 'fill',
      width: 'fill'
    }]]
  }),
  submorphs: [{
    name: 'list header',
    height: FONT_ENTRY_HEADER_HEIGHT,
    borderWidth: {
      bottom: 2,
      left: 0,
      right: 0,
      top: 0
    },
    layout: new TilingLayout({
      justifySubmorphs: 'spaced',
      orderByIndex: true,
      padding: rect(9, 9, 0, 0)
    }),
    borderColor: Color.rgb(69, 69, 69),
    position: pt(14, 6),
    submorphs: [{
      type: Text,
      name: 'collapse button',
      dynamicCursorColoring: true,
      fill: Color.white,
      position: pt(-6, 18),
      textAndAttributes: ['', {
        fontFamily: 'Tabler Icons',
        fontWeight: '900'
      }]
    }, part(InputLineDefault, {
      name: 'font name',
      dropShadow: null,
      extent: pt(140.1, 19.8),
      fontSize: 12,
      fontWeight: 700,
      dynamicCursorColoring: true,
      fill: Color.white,
      position: pt(6, 10),
      textAndAttributes: ['Example Font Name ', {}]

    }), {
      name: 'header button container',
      layout: new TilingLayout({
        orderByIndex: true,
        spacing: 10
      }),
      submorphs: [{
        type: Text,
        name: 'name edit',
        dynamicCursorColoring: true,
        fill: Color.white,
        position: pt(132, 9),
        textAndAttributes: ['', {
          fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
          fontWeight: '900'
        }]

      }, {
        type: Text,
        name: 'font delete',
        dynamicCursorColoring: true,
        fill: Color.white,
        position: pt(176, 9),
        textAndAttributes: ['', {
          fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
          fontWeight: '900'
        }]

      }]
    }]
  }, {
    name: 'font settings container',
    layout: new TilingLayout({
      align: 'center',
      axis: 'column',
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(-8, -8, 0, 0),
      spacing: 10
    }),
    borderColor: Color.rgb(23, 160, 251),
    position: pt(-54, 28),
    submorphs: [{
      name: 'style container',
      borderColor: Color.rgb(69, 69, 69),
      borderWidth: 1,
      extent: pt(200, 37),
      layout: new TilingLayout({
        justifySubmorphs: 'spaced',
        orderByIndex: true,
        padding: rect(9, 9, 0, 0)
      }),
      position: pt(-55, 19),
      submorphs: [{
        type: Text,
        name: 'style label',
        extent: pt(92.5, 18.5),
        dynamicCursorColoring: true,
        fill: Color.white,
        fontWeight: 700,
        position: pt(9, 9),
        textAndAttributes: ['', {
          fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
          fontWeight: '900'
        }, ' Style', {}]
      }, {
        name: 'style button container',
        layout: new TilingLayout({
          orderByIndex: true,
          spacing: 30
        }),
        submorphs: [
          {
            type: Text,
            name: 'style show',
            dynamicCursorColoring: true,
            fill: Color.white,
            position: pt(106, 9),
            textAndAttributes: ['', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }]
          }, {
            type: Text,
            name: 'style edit',
            dynamicCursorColoring: true,
            fill: Color.white,
            position: pt(176, 9),
            textAndAttributes: ['', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }]
          }]
      }]
    }, {
      name: 'weight range container',
      borderWidth: 1,
      borderColor: Color.rgb(69, 69, 69),
      extent: pt(200, 37),
      layout: new TilingLayout({
        justifySubmorphs: 'spaced',
        orderByIndex: true,
        padding: rect(9, 9, 0, 0)
      }),
      position: pt(-58, 29),
      submorphs: [{
        type: Text,
        name: 'weight label',
        dynamicCursorColoring: true,
        fill: Color.white,
        fontWeight: 700,
        position: pt(9, 9),
        textAndAttributes: ['', {
          fontFamily: 'Tabler Icons',
          fontWeight: '900'
        }, ' Weight', {}, ' Range', null]
      }, {
        name: 'weight button container',
        layout: new TilingLayout({
          orderByIndex: true,
          spacing: 30
        }),
        submorphs: [{
          type: Text,
          name: 'weight show',
          dynamicCursorColoring: true,
          fill: Color.white,
          position: pt(132, 9),
          textAndAttributes: ['', {
            fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
            fontWeight: '900'
          }]
        }, {
          type: Text,
          name: 'weight edit',
          dynamicCursorColoring: true,
          fill: Color.white,
          position: pt(176, 9),
          textAndAttributes: ['', {
            fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
            fontWeight: '900'
          }]
        }]
      }]
    }, {
      name: 'unicode range container',
      borderWidth: 1,
      borderColor: Color.rgb(69, 69, 69),
      extent: pt(200, 37),
      layout: new TilingLayout({
        justifySubmorphs: 'spaced',
        orderByIndex: true,
        padding: rect(9, 9, 0, 0)
      }),
      position: pt(1.5, 14),
      submorphs: [{
        type: Text,
        name: 'unicode label',
        dynamicCursorColoring: true,
        fill: Color.white,
        fontWeight: 700,
        position: pt(9, 9),
        textAndAttributes: ['', {
          fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
          fontWeight: '900'
        }, ' ', {}, 'Unicode Range', null]

      }, {
        name: 'unicode button container',
        layout: new TilingLayout({
          orderByIndex: true,
          spacing: 30
        }),
        submorphs: [{
          type: Text,
          name: 'unicode show',
          dynamicCursorColoring: true,
          fill: Color.white,
          position: pt(176, 9),
          textAndAttributes: ['', {
            fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
            fontWeight: '900'
          }]
        }, {
          type: Text,
          name: 'unicode edit',
          dynamicCursorColoring: true,
          fill: Color.white,
          position: pt(20, -6),
          textAndAttributes: ['', {
            fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
            fontWeight: '900'
          }]
        }]
      }]
    }]
  }]
});

const FontManager = component({
  defaultViewModel: FontManagerModel,
  name: 'font manager',
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    wrapSubmorphs: true
  }),
  extent: pt(400, 600),
  submorphs: [
    {
      name: 'drag and drop area',
      borderWidth: 2,
      extent: pt(212, 103),
      borderStyle: 'dashed',
      borderColor: Color.rgb(101, 101, 101),
      submorphs: [{
        type: Text,
        name: 'status text',
        cursorWidth: 1.5,
        dynamicCursorColoring: true,
        extent: pt(198, 111),
        fill: Color.white,
        lineWrapping: true,
        padding: rect(1, 1, 0, 0),
        position: pt(30.5, 18)
      }]
    }, {
      name: 'upload font button',
      borderColor: Color.rgb(23, 160, 251),
      borderWidth: 1,
      extent: pt(26, 28),
      fill: Color.rgb(248, 22, 22)

    }, {
      name: 'font list container',
      layout: new TilingLayout({
        axis: 'column',
        axisAlign: 'center',
        orderByIndex: true
      }),
      clipMode: 'auto',
      borderColor: Color.rgba(0, 28, 255, 0.9293),
      borderWidth: 2,
      extent: pt(372, 396.5),
      position: pt(-120, 18)
    }, {
      name: 'font confirm button',
      borderColor: Color.rgb(23, 160, 251),
      borderWidth: 1,
      extent: pt(108, 28.5),
      fill: Color.rgb(25, 177, 0),
      position: pt(-34, 28)
    }]
});

// TODO: I copied this basically from `TextFormattingPopUpModel`.
// I think the best scenario would be to ship the popup with functionality like this as a default?
class FontManagerPopupModel extends ViewModel {
  static get properties () {
    return {
      expose: { get () { return ['close']; } },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' }
          ];
        }
      }
    };
  }

  close () {
    this.view.remove();
  }
}

const FontManagerPopup = component(DarkPopupWindow, {
  name: 'font manager pop up',
  defaultViewModel: FontManagerPopupModel,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsVertically: true,
    hugContentsHorizontally: true,
    resizePolicies: [
      ['header menu', { width: 'fill', height: 'fixed' }]
    ]
  }),
  submorphs: [
    {
      name: 'header menu',
      submorphs: [{ name: 'title', textAndAttributes: ['Format Selection', null] }]
    },
    add(part(FontManager))
  ]
});
