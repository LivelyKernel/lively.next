/* global FormData */
import { component, add, part, TilingLayout, ViewModel } from 'lively.morphic';
import { pt, rect } from 'lively.graphics/geometry-2d.js';
import { Color } from 'lively.graphics/color.js';

import { Text } from 'lively.morphic/text/morph.js';

import { currentUsername } from 'lively.user';

import { resource } from 'lively.resources';
import { DarkPopupWindow, DarkThemeList, EnumSelector, RemoveButton, TextInput, PropertyLabelActive, PropertyLabelHovered, PropertyLabel } from './shared.cp.js';
import { PopupModel } from './controls/popups.cp.js';
import { DarkButton } from 'lively.components/buttons.cp.js';
import { FileStatusWarning } from '../js/browser/ui.cp.js';
import { Label } from 'lively.morphic/text/label.js';
import { arr, promise, obj } from 'lively.lang';
import { connect, once, signal } from 'lively.bindings';

export function openFontManager () {
  return part(FontManagerPopup).openInWorld(); // eslint-disable-line no-use-before-define
}

class FontManagerModel extends PopupModel {
  static get properties () {
    return {
      isHaloItem: { get () { return true; } },
      isPropertiesPanelPopup: { get () { return true; } }
    };
  }

  get bindings () {
    return [
      ...super.bindings,
      { signal: 'onNativeDrop', target: 'drag and drop area', handler: 'onNativeDrop' },
      { signal: 'onNativeDragenter', target: 'drag and drop area', handler: 'onNativeDragenter' },
      { signal: 'onNativeDragleave', target: 'drag and drop area', handler: 'onNativeDragleave' },
      { signal: 'onNativeDragend', target: 'drag and drop area', handler: 'onNativeDragend' },
      { target: 'upload font button', signal: 'onMouseDown', handler: 'openFilePicker' }
    ];
  }

  get expose () {
    return super.expose.concat(['isHaloItem', 'isPropertiesPanelPopup']);
  }

  async viewDidLoad () {
    if ($world.openedProject) await this.regenerateFontList(true);
  }

  async regenerateFontList (withLoadingIndicator = false) {
    let li;
    if (withLoadingIndicator) li = $world.showLoadingIndicatorFor($world, 'Loading Project Fonts');
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
    const fontFile = resource(System.baseURL).join(uploadPath).join(file.name);
    if (await fontFile.exists()) {
      const { statusText, statusPrompt, cancelButton, proceedButton } = this.ui;
      statusPrompt.visible = true;
      statusText.textString = 'This font file already exists, do you want to proceed and override?';
      const p = promise.deferred();
      once(cancelButton, 'onMouseDown', () => p.resolve(false));
      once(proceedButton, 'onMouseDown', () => p.resolve(true));
      if (!await p.promise) {
        this.resetStatusText();
        return;
      }
      await fontFile.remove();
      this.resetStatusText();
    }
    res = res.join(`/upload?uploadPath=${encodeURIComponent(uploadPath)}`);
    await res.write(fd);

    if (!$world.openedProject) return;
    let name = file.name.replace('.woff2', '');
    // do not add the same font face again
    const fontFace = {
      fontWeight: [],
      fontName: name,
      fileName: name,
      fontStyle: 'normal',
      unicodeRange: "''"
    };
    await $world.openedProject.deleteCustomFont(fontFace, false);
    await $world.openedProject.addCustomFontFace(fontFace);
    $world.get('text control')?.update();
  }

  async onNativeDrop (evt) {
    const { dragAndDropArea } = this.ui;

    dragAndDropArea.borderWidth = 2;

    const { domEvt } = evt;
    if (!domEvt.dataTransfer.items.length) return;
    const legalFiles = Array.from(domEvt.dataTransfer.items).filter(item => item.type === 'font/woff2').map(i => i.getAsFile());
    const legalFilesCount = legalFiles.length;

    if (legalFilesCount) {
      for (let legalFile of legalFiles) {
        await this.uploadFont(legalFile);
      }
    }

    await this.regenerateFontList();
  }

  resetStatusText () {
    this.ui.statusPrompt.visible = false;
  }

  onNativeDragenter () {
    this.ui.dragAndDropArea.borderWidth = 7;
  }

  onNativeDragleave () {
    this.ui.dragAndDropArea.borderWidth = 2;
  }

  onNativeDragend () {
    this.ui.dragAndDropArea.borderWidth = 2;
  }
}

class FontListEntryModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { target: 'font delete', signal: 'onMouseDown', handler: 'deleteFont', converter: () => false },
            { target: 'font edit', signal: 'onMouseDown', handler: 'editFont' }
          ];
        }
      },

      fontName: {}, // name of the font family
      fileName: {}, // name of the file
      fontWeight: {
        defaultValue: []
      },
      fontStyle: {
        defaultValue: 'normal'
      },
      unicodeRange: { defaultValue: 'U+0-10FFFF' }
    };
  }

  editFont () {
    // opens the font edit popup
    const p = part(FontConfigurationPopup, { // eslint-disable-line no-use-before-define
      viewModel: {
        fontName: this.fontName,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
        unicodeRange: this.unicodeRange
      }
    }).openInWorld();
    connect(p, 'fontFaceChanged', (fontFace) => {
      this.updateFontFace(() => {
        Object.assign(this, fontFace);
      });
    });
    p.env.forceUpdate(p);
    p.topRight = this.view.globalBounds().topLeft();
    p.topLeft = this.world().visibleBounds().translateForInclusion(p.globalBounds()).topLeft();
  }

  async updateFontFace (cb) {
    await this.deleteFont(true);
    await cb();
    await this.addFont();
    $world.get('text control')?.update();
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
    await $world.openedProject.deleteCustomFont(fontObj, !keepView);
    if (!keepView) this.view.remove();
  }

  viewDidLoad () {
    this.onRefresh();
  }

  onRefresh () {
    const { fontName } = this.ui;
    fontName.textString = this.fileName;
  }
}

class FontConfigurationModel extends PopupModel {
  static get properties () {
    return {
      isHaloItem: { get () { return true; } },
      isPropertiesPanelPopup: { get () { return true; } },
      fontName: {},
      fontStyle: { defaultValue: 'normal' },
      fontWeight: { defaultValue: [] },
      unicodeRange: { defaultValue: 'U+0-10FFFF' }
    };
  }

  viewDidLoad () {
    this.ui.nameInput.input = this.fontName;
    this.ui.styleSelector.selection = this.fontStyle;
    const [min, max] = this.fontWeight;
    this.ui.weightSelectorMin.selection = min;
    this.ui.weightSelectorMax.selection = max;
    this.ui.unicodeRangeInput.input = this.unicodeRange;
  }

  get bindings () {
    return [
      ...super.bindings,
      { target: 'name input', signal: 'onInput', handler: 'confirm' },
      { target: 'name input', signal: 'onBlur', handler: 'confirm' },
      { target: 'unicode range input', signal: 'onInput', handler: 'confirm' },
      { target: 'unicode range input', signal: 'onBlur', handler: 'confirm' },
      { model: 'weight selector min', signal: 'toggleList', handler: 'confirm' },
      { model: 'weight selector max', signal: 'toggleList', handler: 'confirm' },
      { model: 'style selector', signal: 'toggleList', handler: 'confirm' }
    ];
  }

  confirm () {
    this.fontName = this.ui.nameInput.textString;
    this.fontStyle = this.ui.styleSelector.selection;
    this.unicodeRange = this.ui.unicodeRangeInput.textString || "''";
    this.fontWeight = arr.compact([
      this.ui.weightSelectorMin.selection,
      this.ui.weightSelectorMax.selection
    ]);
    signal(this.view, 'fontFaceChanged', obj.select(this, ['fontName', 'fontStyle', 'unicodeRange', 'fontWeight']));
  }

  get expose () {
    return super.expose.concat(['isHaloItem', 'isPropertiesPanelPopup']);
  }
}

const FontListEntry = component({
  name: 'font list entry',
  defaultViewModel: FontListEntryModel,
  extent: pt(212.2, 36.7),
  layout: new TilingLayout({
    axisAlign: 'center',
    hugContentsVertically: true,
    orderByIndex: true,
    resizePolicies: [['list header', {
      height: 'fill',
      width: 'fill'
    }]]
  }),
  fill: Color.transparent,
  submorphs: [{
    name: 'list header',
    layout: new TilingLayout({
      axisAlign: 'center',
      orderByIndex: true,
      resizePolicies: [['font name', {
        height: 'fixed',
        width: 'fill'
      }]],
      spacing: 10
    }),
    fill: Color.transparent,
    borderColor: Color.rgb(69, 69, 69),
    submorphs: [part(PropertyLabel, {
      name: 'font edit',
      fontSize: 15,
      textAndAttributes: ['', {
        fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
        fontWeight: '900'
      }, ' ', {}],
      tooltip: 'Configure font properties',
      padding: rect(6, 1, -2, 1),
      master: {
        auto: PropertyLabel,
        hover: PropertyLabelHovered,
        click: PropertyLabelActive
      }
    }), part(TextInput, {
      name: 'font name',
      padding: rect(5, 2, -4, -1),
      height: 23.7265625,
      readOnly: true,
      tooltip: '.woff2 name of the font file',
      textAndAttributes: ['Example Font Name ', {}]
    }), part(RemoveButton, {
      master: { auto: RemoveButton, hover: PropertyLabelHovered },
      name: 'font delete',
      tooltip: 'Remove font from the project',
      padding: rect(4, 4, 0, 0)
    })]
  }]
});

const FontManager = component({
  name: 'font manager',
  fill: Color.rgba(255, 255, 255, 0),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(10, 10, 0, 0),
    resizePolicies: [['font list container', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10
  }),
  extent: pt(290.7, 176),
  submorphs: [
    {
      name: 'drag and drop area',
      fill: Color.rgba(255, 255, 255, 0),
      layout: new TilingLayout({
        align: 'center',
        axis: 'column',
        axisAlign: 'center',
        orderByIndex: true
      }),
      borderRadius: 10,
      borderWidth: 6,
      extent: pt(211.5, 111.2),
      borderStyle: 'dashed',
      borderColor: Color.rgb(101, 101, 101),
      submorphs: [{
        type: Text,
        name: 'drop label',
        extent: pt(176, 48.3),
        textAlign: 'center',
        fontColor: Color.rgb(139, 141, 142),
        fontSize: 17,
        fixedWidth: true,
        dynamicCursorColoring: true,
        fill: Color.rgba(255, 255, 255, 0),
        position: pt(22.6, 39.9),
        textAndAttributes: ['Drop font file here', {
          fontWeight: '600',
          textAlign: 'center'
        }, ' ', {
          textAlign: 'center'
        }, '', {
          fontFamily: 'Tabler Icons',
          fontWeight: '900',
          textAlign: 'center'
        }, ' \n\
', {
          textAlign: 'center'
        }, 'or', {
          fontWeight: '600',
          textAlign: 'center'
        }]

      }, part(DarkButton, {
        name: 'upload font button',
        extent: pt(88.8, 28.8),
        submorphs: [{
          name: 'label',
          fontSize: 12,
          textAndAttributes: ['Browse files', null]

        }]
      })]
    }, {
      name: 'status prompt',
      extent: pt(207, 58),
      layout: new TilingLayout({
        hugContentsVertically: true,
        orderByIndex: true,
        padding: rect(5, 5, 0, 0),
        spacing: 5,
        wrapSubmorphs: true
      }),
      master: FileStatusWarning,
      submorphs: [
        {
          type: Text,
          name: 'status text',
          padding: rect(5, 3, 0, 0),
          fixedWidth: true,
          fixedHeight: false,
          textAndAttributes: ['I am a status text', null],
          cursorWidth: 1.5,
          dynamicCursorColoring: true,
          extent: pt(195.3, 23),
          lineWrapping: true
        },
        part(DarkButton, {
          name: 'proceed button ',
          extent: pt(80, 20),
          opacity: 0.8,
          submorphs: [{
            name: 'label',
            textAndAttributes: ['Proceed', null]

          }]
        }),
        part(DarkButton, {
          name: 'cancel button ',
          opacity: .8,
          extent: pt(79.9, 19.7),
          submorphs: [{
            name: 'label',
            textAndAttributes: ['Cancel', null]

          }]
        })
      ]
    }, {
      name: 'font list container',
      fill: Color.transparent,
      layout: new TilingLayout({
        axis: 'column',
        axisAlign: 'center',
        hugContentsVertically: true,
        orderByIndex: true
      }),
      clipMode: 'auto',
      extent: pt(372, 396.5),
      position: pt(-120, 18)
    }]
});

const FontConfigurationPopup = component(DarkPopupWindow, {
  viewModelClass: FontConfigurationModel,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    resizePolicies: [['font controls', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [
    add({
      name: 'font controls',
      fill: Color.rgba(255, 255, 255, 0),
      layout: new TilingLayout({
        axis: 'column',
        orderByIndex: true,
        resizePolicies: [['name control', {
          height: 'fixed',
          width: 'fill'
        }], ['style control', {
          height: 'fixed',
          width: 'fill'
        }], ['weight control', {
          height: 'fixed',
          width: 'fill'
        }], ['unicode range control', {
          height: 'fixed',
          width: 'fill'
        }]]
      }),
      submorphs: [
        {
          name: 'name control',
          layout: new TilingLayout({
            align: 'right',
            axis: 'column',
            hugContentsVertically: true,
            orderByIndex: true,
            padding: rect(15, 10, 0, 0),
            resizePolicies: [['name input', {
              height: 'fixed',
              width: 'fill'
            }]],
            spacing: 5
          }),
          height: 35.6796875,
          fill: Color.rgba(255, 255, 255, 0),
          submorphs: [{
            type: Label,
            name: 'name label',
            nativeCursor: 'pointer',
            opacity: 0.7,
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            position: pt(13.6, 8),
            tooltip: 'Defines the name under which the font is going to be available throughout the project.',
            textAndAttributes: ['Font Name  ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {}]
          }, part(TextInput, {
            name: 'name input',
            fixedWidth: true,
            height: 25
          })]
        },
        {
          name: 'style control',
          layout: new TilingLayout({
            align: 'right',
            axis: 'column',
            hugContentsVertically: true,
            orderByIndex: true,
            padding: rect(15, 10, 0, 0),
            resizePolicies: [['style selector', {
              height: 'fixed',
              width: 'fill'
            }]],
            spacing: 5
          }),
          fill: Color.rgba(255, 255, 255, 0),
          submorphs: [{
            type: Label,
            name: 'style label',
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(11.6, 1.9),
            tooltip: 'Defines the style this font file covers. For instance different font styles may be partitioned in different font files.',
            textAndAttributes: ['Font Style  ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {}]
          }, part(EnumSelector, {
            name: 'style selector',
            layout: new TilingLayout({
              align: 'right',
              justifySubmorphs: 'spaced',
              orderByIndex: true,
              padding: rect(5, 0, 10, 0)
            }),
            viewModel: {
              openListInWorld: true,
              listMaster: DarkThemeList,
              items: ['normal', 'italic', 'underline']
            }
          })]
        },
        {
          name: 'weight control',
          layout: new TilingLayout({
            align: 'right',
            hugContentsVertically: true,
            justifySubmorphs: 'spaced',
            orderByIndex: true,
            padding: rect(15, 10, 0, 0),
            spacing: 5,
            wrapSubmorphs: true
          }),
          fill: Color.rgba(255, 255, 255, 0),
          submorphs: [{
            type: Label,
            name: 'weight label',
            extent: pt(210.5, 18),
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(5.4, 28.4),
            fixedWidth: true,
            tooltip: 'A single fontweight or a range of fontweights for which to use this font file. For most cases, the default value will suffice.',
            textAndAttributes: ['Font Weight  ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {}]
          }, {
            type: Label,
            name: 'min label',
            extent: pt(99, 17),
            fixedWidth: true,
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(-163, 27),
            textAndAttributes: ['Min', null]
          }, {
            type: Label,
            name: 'max label',
            extent: pt(99.8, 16.1),
            fixedWidth: true,
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(-113, 27),
            textAndAttributes: ['Max', null]
          }, part(EnumSelector, {
            name: 'weight selector min',
            extent: pt(100, 23.3),
            viewModel: {
              openListInWorld: true,
              listMaster: DarkThemeList,
              listHeight: 500,
              items: arr.range(1, 9).map(i => i * 100),
              listAlign: 'selection'
            }
          }), part(EnumSelector, {
            name: 'weight selector max',
            extent: pt(100, 23.3),
            viewModel: {
              openListInWorld: true,
              listMaster: DarkThemeList,
              listHeight: 500,
              items: arr.range(1, 9).map(i => i * 100),
              listAlign: 'selection'
            }
          })]
        },
        {
          name: 'unicode range control',
          layout: new TilingLayout({
            align: 'right',
            axis: 'column',
            hugContentsVertically: true,
            orderByIndex: true,
            padding: rect(15, 10, 0, 10),
            resizePolicies: [['unicode range input', {
              height: 'fixed',
              width: 'fill'
            }]],
            spacing: 5
          }),
          fill: Color.rgba(255, 255, 255, 0),
          submorphs: [{
            type: Label,
            name: 'unicode range label',
            extent: pt(213.2, 18),
            fontColor: Color.rgb(255, 255, 255),
            fontWeight: 'bold',
            nativeCursor: 'pointer',
            opacity: 0.7,
            position: pt(44.6, 31.4),
            tooltip: 'A list of unicode code-points for which to use this font. If empty, this font-file will be used for all code-points. Usually, this is the warranted behavior.',
            textAndAttributes: ['Unicode Range  ', null, '', {
              fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
              fontWeight: '900'
            }, ' ', {}]
          },
          part(TextInput, {
            name: 'unicode range input',
            extent: pt(100, 23)
          })]
        }
      ]
    }), {
      name: 'header menu',
      submorphs: [{
        name: 'title',
        textAndAttributes: ['Font Configuration', null]
      }]
    }
  ]
});

const FontManagerPopup = component(DarkPopupWindow, {
  defaultViewModel: FontManagerModel,
  extent: pt(241, 568),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    resizePolicies: [['header menu', {
      height: 'fixed',
      width: 'fill'
    }], ['font manager', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [
    {
      name: 'header menu',
      submorphs: [{
        name: 'title',
        textAndAttributes: ['Manage Fonts', null]
      }]
    },
    add(part(FontManager, {
      name: 'font manager',
      submorphs: [{
        name: 'status prompt',
        visible: false
      }, {
        name: 'font list container',
        height: 1
      }]
    }))
  ]
});
