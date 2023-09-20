/* global FormData */
import { component, Text, Label, Image, part, add, TilingLayout, ViewModel } from 'lively.morphic';

import { pt, Color } from 'lively.graphics';
import { DarkPopupWindow } from './shared.cp.js';
import { rect } from 'lively.graphics/geometry-2d.js';
import { without } from 'lively.morphic/components/core.js';
import { ComponentPreviewDark } from './component-browser.cp.js';
import { LinearGradient } from 'lively.graphics/color.js';

import { ButtonDarkDefault, DarkButton } from 'lively.components/buttons.cp.js';
import { resource } from 'lively.resources';
import { FileStatusWarning } from '../js/browser/ui.cp.js';
import { promise } from 'lively.lang';
import { once } from 'lively.bindings';
import { ModeSelector } from 'lively.components/widgets/mode-selector.cp.js';

class AssetPreviewModel extends ViewModel {
  static get properties () {
    return {
      imageUrl: {},
      assetName: {},
      fullFileName: {},
      assetManager: {},
      expose: {
        get () {
          return ['onMouseDown'];
        }
      }
    };
  }

  onMouseDown () {
    this.assetManager.selectAssetEntry(this);
  }

  viewDidLoad () {
    this.ui.previewHolder.imageUrl = this.imageUrl;
    this.ui.componentName.value = this.assetName;
  }
}

const AssetPreviewUnselected = component(ComponentPreviewDark, {
  name: 'asset preview',
  defaultViewModel: AssetPreviewModel,
  submorphs: [
    {
      name: 'preview container',
      submorphs: [{
        name: 'preview holder',
        type: Image
      }
      ]
    }, {
      name: 'component name',
      textAndAttributes: ['hello', null]
    }
  ]
});

const AssetPreviewSelected = component(AssetPreviewUnselected, {
  borderColor: Color.rgb(52, 138, 117),
  borderWidth: 2,
  fill: Color.rgba(100, 255, 218, 0.6),
  submorphs: [{
    name: 'component name',
    fontColor: Color.rgb(255, 255, 255)
  }
  ]
});

const AssetPreview = component(AssetPreviewUnselected, {
  master: {
    states: {
      selected: AssetPreviewSelected
    }
  }
});

class AssetManagerPopupModel extends ViewModel {
  get bindings () {
    return [
      {
        target: 'close button',
        signal: 'onMouseUp',
        handler: 'close'
      },
      { target: 'upload button', signal: 'onMouseDown', handler: 'openFilePicker' },
      { target: 'delete button', signal: 'onMouseDown', handler: 'deleteAsset' },
      { target: 'selection button', signal: 'onMouseDown', handler: 'confirm' }

    ];
  }

  async deleteAsset () {
    const assetToDelete = resource($world.openedProject.url).join('assets/' + this.selectedAsset.fullFileName);
    await assetToDelete.remove();

    this.selectedAsset.view.remove();
    this.ui.deleteButton.visible = false;
    this.selectedAsset = null;
  }

  selectAssetEntry (assetEntryModel) {
    if (this.selectedAsset) this.selectedAsset.view.master.setState = null;
    this.selectedAsset = assetEntryModel;
    this.ui.deleteButton.visible = true;
    assetEntryModel.view.master.setState('selected');
    this.ui.selectionButton.enable();
  }

  async openFilePicker () {
    const pickerOpts = {
      multiple: true,
      types: [
        {
          description: 'asset files',
          accept: {
            'image/*': ['.jpg', '.jpeg', '.gif', '.png', '.webp', '.jxl']
          }
        }
      ],
      excludeAcceptAllOption: true

    };
    const files = await window.showOpenFilePicker(pickerOpts);
    for (let assetFile of files) {
      let asset = await assetFile.getFile();
      await this.uploadAsset(asset);
    }

    await this.listAssets();
  }

  async uploadAsset (file) {
    let overwriteAsset = false;
    const fd = new FormData();
    fd.append('file', file, file.name);

    let res;
    res = resource(System.baseURL);
    const uploadPath = $world.openedProject.url.replace(System.baseURL, '') + '/assets/';
    const assetFile = resource(System.baseURL).join(uploadPath).join(file.name);
    if (await assetFile.exists()) {
      const { statusText, statusPrompt, cancelButton, proceedButton } = this.ui;
      statusPrompt.visible = true;
      statusText.textString = 'This asset file already exists, do you want to proceed and override?';
      const p = promise.deferred();
      once(cancelButton, 'onMouseDown', () => p.resolve(false));
      once(proceedButton, 'onMouseDown', () => p.resolve(true));
      if (!await p.promise) {
        this.resetStatusText();
        return;
      }
      overwriteAsset = true;
      await assetFile.remove();
      this.resetStatusText();
    }
    res = res.join(`/upload?uploadPath=${encodeURIComponent(uploadPath)}`);
    await res.write(fd);

    await this.listAssets(overwriteAsset);
  }

  resetStatusText () {
    this.ui.statusPrompt.visible = false;
  }

  async viewDidLoad () {
    await this.listAssets();
    this.ui.selectionButton.disable();
  }

  async listAssets (forceUpdate) {
    if (forceUpdate) this.view.get('assets').submorphs = [];
    (await $world.openedProject.getAssets('image')).forEach(a => {
      const assetName = a.nameWithoutExt();
      if (!this.view.get(assetName)) {
        this.view.get('assets').addMorph(part(AssetPreview, {
          name: assetName,
          viewModel: {
            assetName,
            fullFileName: a.name(),
            imageUrl: a.url,
            assetManager: this
          }
        }));
      }
    });
  }

  async activate (pos) {
    // popup specific
    const { view } = this;
    view.doNotAcceptDropsForThisAndSubmorphs();
    view.openInWorld();
    view.clipMode = 'hidden';
    if (!pos) view.center = $world.visibleBounds().center();
    else view.position = pos;
  }

  close () {
    this.view.remove();
  }
}

export const AssetManagerPopup = component(DarkPopupWindow, {
  defaultViewModel: AssetManagerPopupModel,
  styleClasses: [],
  hasFixedPosition: false,
  extent: pt(515.0000, 41.0000),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    resizePolicies: [['header menu', {
      height: 'fixed',
      width: 'fill'
    }], ['mode selector', {
      height: 'fixed',
      width: 'fill'
    }], ['status prompt', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [
    without('controls'),
    {
      name: 'header menu',
      layout: new TilingLayout({
        align: 'right',
        axisAlign: 'center',
        justifySubmorphs: 'spaced',
        padding: rect(5, 0, 0, 0)
      }),
      submorphs: [{
        name: 'title',
        fontSize: 18,
        reactsToPointer: false,
        textAndAttributes: ['Browse Components', null]
      }]
    }, {
      name: 'mode selector',
      layout: new TilingLayout({
        align: 'center',
        axisAlign: 'center',
        spacing: 5
      })
    }, add(part(ModeSelector, {
      viewModel: {
        items: [
          { text: 'Images', name: 'images', tooltip: 'demo one' },
          { text: 'Video', name: 'demo two', tooltip: 'demo two' },
          { text: 'Audio', name: 'demo three', tooltip: 'demo three' }
        ]
      },
      name: 'assets'
    })),
    add({
      name: 'assets',
      extent: pt(515.0000, 16.5000),
      fill: Color.transparent,
      layout: new TilingLayout({
        hugContentsVertically: true,
        resizePolicies: [['button wrapper', {
          height: 'fixed',
          width: 'fill'
        }]],
        spacing: 5
      })
    }), add({
      name: 'button wrapper',
      extent: pt(483.0000, 33.9000),
      fill: Color.transparent,
      layout: new TilingLayout({
        align: 'center',
        axisAlign: 'center',
        justifySubmorphs: 'spaced',
        spacing: 15
      }),
      submorphs: [
        {
          name: 'left buttons',
          layout: new TilingLayout({
            spacing: 5,
            orderByIndex: true
          }),
          fill: Color.transparent,
          submorphs: [
            {
              name: 'upload button',
              borderColor: Color.rgb(112, 123, 124),
              borderRadius: 5,
              borderWidth: 1,
              fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(149, 165, 166) }, { offset: 1, color: Color.rgb(127, 140, 141) }], vector: rect(0, 0, 0, 1) }),
              layout: new TilingLayout({
                align: 'center',
                axisAlign: 'center'
              }),
              master: ButtonDarkDefault,
              nativeCursor: 'pointer',
              submorphs: [{
                name: 'label',
                type: Label,
                fill: Color.transparent,
                fontColor: Color.rgb(255, 255, 255),
                textAndAttributes: ['', {
                  fontColor: Color.rgb(178, 235, 242),
                  fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
                  fontWeight: '900',
                  lineHeight: 1
                }, ' Upload', {
                  fontFamily: 'IBM Plex Sans'
                }]
              }]
            },
            {
              name: 'delete button',
              borderColor: Color.rgb(112, 123, 124),
              borderRadius: 5,
              borderWidth: 1,
              visible: false,
              fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(149, 165, 166) }, { offset: 1, color: Color.rgb(127, 140, 141) }], vector: rect(0, 0, 0, 1) }),
              layout: new TilingLayout({
                align: 'center',
                axisAlign: 'center'
              }),
              master: ButtonDarkDefault,
              nativeCursor: 'pointer',
              submorphs: [{
                name: 'label',
                type: Label,
                fill: Color.transparent,
                fontColor: Color.rgb(255, 255, 255),
                textAndAttributes: ['', {
                  fontColor: Color.rgb(178, 235, 242),
                  fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
                  fontWeight: '900',
                  lineHeight: 1
                }, ' Delete', {
                  fontFamily: 'IBM Plex Sans'
                }]
              }]
            }
          ]
        }, {
          name: 'selection button',
          borderColor: Color.rgb(112, 123, 124),
          borderRadius: 5,
          borderWidth: 1,
          fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgb(149, 165, 166) }, { offset: 1, color: Color.rgb(127, 140, 141) }], vector: rect(0, 0, 0, 1) }),
          master: ButtonDarkDefault,
          nativeCursor: 'pointer',
          submorphs: [{
            name: 'label',
            type: Label,
            fill: Color.transparent,
            fontColor: Color.rgb(255, 255, 255),
            textAndAttributes: ['', {
              fontColor: Color.rgb(178, 235, 242),
              fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
              fontWeight: '900',
              lineHeight: 1
            }, ' Use', {
              fontFamily: 'IBM Plex Sans'
            }]
          }]
        }]
    }), add({
      name: 'status prompt',
      visible: false,
      extent: pt(342.0000, 62.5000),
      layout: new TilingLayout({
        axisAlign: 'center',
        hugContentsVertically: true,
        justifySubmorphs: 'spaced',
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
    })]
});
