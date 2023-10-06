/* global FormData */
import { component, morph, Text, Label, Image, part, add, TilingLayout, ViewModel } from 'lively.morphic';

import { pt, Color } from 'lively.graphics';
import { DarkPopupWindow } from './shared.cp.js';
import { rect } from 'lively.graphics/geometry-2d.js';
import { without } from 'lively.morphic/components/core.js';
import { ComponentPreviewDark } from './component-browser.cp.js';
import { LinearGradient } from 'lively.graphics/color.js';

import { ButtonDarkDefault, SystemButton, DarkButton } from 'lively.components/buttons.cp.js';
import { resource } from 'lively.resources';
import { FileStatusWarning } from '../js/browser/ui.cp.js';
import { promise } from 'lively.lang';
import { once } from 'lively.bindings';
import { ModeSelectorDark } from 'lively.components/widgets/mode-selector.cp.js';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { Spinner } from './shared.cp.js';

class AssetPreviewModel extends ViewModel {
  static get properties () {
    return {
      imageUrl: {},
      assetName: {},
      fullFileName: {},
      assetManager: {},
      expose: {
        get () {
          return ['onMouseDown', 'assetName', 'isAssetPreview'];
        }
      }
    };
  }

  get isAssetPreview () {
    return true;
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
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsVertically: true,
    padding: rect(5, 5, 0, 0),
    resizePolicies: [['component name', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [
    {
      name: 'preview container',
      extent: pt(120.0000, 80.0000),
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

class AssetManagerModel extends ViewModel {
  static get properties () {
    return {
      container: {}
    };
  }

  get expose () {
    return ['activate', 'container', 'close', 'initialize'];
  }

  get bindings () {
    return [
      { target: 'upload button', signal: 'onMouseDown', handler: 'openFilePicker' },
      { target: 'delete button', signal: 'onMouseDown', handler: 'deleteAsset' },
      { target: 'selection button', signal: 'onMouseDown', handler: 'confirm' },
      { target: 'search input', signal: 'inputChanged', handler: 'filterAssets' },
      {
        target: 'search clear button',
        signal: 'onMouseDown',
        handler: () => {
          this.ui.searchInput.textString = '';
          this.filterAssets();
        }
      },
      {
        target: 'search input',
        signal: 'onKeyDown',
        handler: (evt) => {
          if (evt.key === 'Escape') {
            this.ui.searchInput.textString = '';
            this.filterAssets();
          }
        }
      }
    ];
  }

  filterAssets () {
    const needle = this.ui.searchInput.textString.toLowerCase();
    this.ui.assets.submorphs.forEach(s => {
      if (!s.isAssetPreview) return;
      s.visible = s.isLayoutable = true;
    });
    if (needle.trim() === '') {
      this.ui.noResultsIndicator.visible = false;
      this.ui.searchClearButton.visible = false;
      return;
    }

    this.ui.searchClearButton.visible = true;

    this.ui.assets.submorphs.forEach(s => {
      if (!s.isAssetPreview) return;
      if (!s.assetName.toLowerCase().includes(needle)) s.visible = s.isLayoutable = false;
    });
    if (this.ui.assets.submorphs.every(s => !s.isAssetPreview || !s.visible)) this.ui.noResultsIndicator.visible = true;
    else this.ui.noResultsIndicator.visible = false;
  }

  confirm () {
    this._promise.resolve(this.selectedAsset.imageUrl);
    this.container.remove();
  }

  async initialize () {
    this.ui.assetTypeSelector.enabled = false;
    this.view.visible = false;
    const li = $world.showLoadingIndicatorFor(null, 'Enumerating project assets...');
    await this.listAssets();
    this.ui.selectionButton.disable();
    this.view.visible = true;
    li.remove();
  }

  async activate () {
    await this.initialize();
    this._promise = promise.deferred();
    return this._promise.promise;
  }

  async deleteAsset () {
    const assetToDelete = resource($world.openedProject.url).join('assets/' + this.selectedAsset.fullFileName);
    await assetToDelete.remove();

    this.selectedAsset.view.remove();
    this.ui.deleteButton.visible = false;
    this.selectedAsset = null;
  }

  selectAssetEntry (assetEntryModel) {
    if (this.selectedAsset) this.selectedAsset.view.master.setState(null);
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
      const overWritten = await this.uploadAsset(asset);
      if (overWritten) this.needsListRefreshed = true;
    }

    await this.listAssets(true);
  }

  async uploadAsset (file) {
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

      if (!(await p.promise)) {
        this.resetStatusText();
        return;
      }
      this.needsListRefreshed = true;
      await assetFile.remove();
      this.resetStatusText();
    }
    res = res.join(`/upload?uploadPath=${encodeURIComponent(uploadPath)}`);
    await res.write(fd);
  }

  resetStatusText () {
    this.ui.statusPrompt.visible = false;
  }

  async listAssets (updateAtRuntime = false) {
    if (this.needsListRefreshed) this.view.get('assets').submorphs = [];
    this.needsListRefreshed = false;
    let fader, li;
    if (updateAtRuntime) {
      fader = morph({
        name: 'fader',
        position: this.container.position,
        extent: this.container.extent,
        fill: Color.rgbHex('202020'),
        opacity: 0.8
      });
      $world.addMorph(fader);
      li = $world.showLoadingIndicatorFor(this.container, 'Enumerating project assets');
    }
    const assets = $world.openedProject ? await $world.openedProject.getAssets('image') : await $world.getAssets('image');
    assets.forEach(a => {
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
    if (updateAtRuntime) {
      fader.remove();
      li.remove();
    }
  }

  close () {
    if (this._promise) this._promise.resolve(null);

    this.view.remove();
  }
}

const NoResultIndicator = component({
  name: 'no results indicator',
  fill: Color.rgba(255, 255, 255, 0),
  borderColor: Color.rgba(23, 160, 251, 0),
  borderWidth: 1,
  extent: pt(316.0000, 164.0000),
  position: pt(-104.0000, 21.0000),
  submorphs: [{
    type: Text,
    name: 'icon',
    borderColor: Color.rgba(23, 160, 251, 0),
    borderWidth: 1,
    cursorWidth: 1.5,
    dynamicCursorColoring: true,
    extent: pt(80.0000, 64.5000),
    fill: Color.rgba(255, 255, 255, 0),
    fixedHeight: true,
    fixedWidth: true,
    fontColor: Color.rgba(126, 126, 126, 0.75),
    fontSize: 80,
    lineWrapping: 'by-words',
    padding: rect(1, 1, 0, 0),
    position: pt(22.5000, 27.0000),
    textAndAttributes: ['', {
      fontFamily: 'Material Icons',
      fontWeight: '900'
    }, ' ', {}]
  }, {
    type: Text,
    name: 'text',
    dynamicCursorColoring: true,
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgba(126, 126, 126, 0.75),
    fontSize: 20,
    fontWeight: '600',
    position: pt(106.0000, 66.0000),
    textAndAttributes: ['No matching assets...', null]
  }]
});

export const AssetManagerDark = component({
  name: 'asset manager',
  defaultViewModel: AssetManagerModel,
  width: 440,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    resizePolicies: [['search input wrapper', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  fill: Color.rgba(255, 255, 255, 0),
  submorphs: [
    part(ModeSelectorDark, {
      name: 'asset type selector',
      layout: new TilingLayout({
        align: 'center',
        axisAlign: 'center',
        justifySubmorphs: 'spaced',
        spacing: 5
      }),
      viewModel: {
        items: [
          { text: 'Images', name: 'images', tooltip: 'Image' },
          { text: 'Video', name: 'video', tooltip: 'Video Assets' },
          { text: 'Audio', name: 'audio', tooltip: 'Audio Assets' }
        ]
      }
    }), {
      name: 'search input wrapper',
      layout: new TilingLayout({
        axisAlign: 'center',
        padding: rect(8, 0, -8, 0),
        resizePolicies: [['search input', {
          height: 'fixed',
          width: 'fill'
        }]]
      }),
      borderRadius: 3,
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(388.4, 42.6),
      position: pt(120, 541),
      submorphs: [{
        type: Text,
        name: 'search icon',
        extent: pt(17.5, 18),
        fontSize: 18,
        fontColor: Color.rgba(0, 0, 0, 0.5),
        cursorWidth: 1.5,
        fixedWidth: true,
        padding: rect(1, 1, 0, 0),
        textAndAttributes: ['', {
          fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
          fontWeight: '900',
          lineHeight: 1.2,
          textStyleClasses: ['fas']
        }]
      }, part(InputLineDefault, {
        name: 'search input',
        dropShadow: null,
        highlightWhenFocused: false,
        borderColor: Color.rgb(224, 224, 224),
        borderRadius: 2,
        extent: pt(445.3, 34.3),
        fill: Color.rgba(255, 255, 255, 0),
        padding: rect(6, 4, -4, 2),
        position: pt(11.9, 3.8),
        placeholder: 'Search for components...'
      }), part(Spinner, {
        name: 'spinner',
        opacity: .7,
        viewModel: { color: 'black' },
        visible: false
      }), {
        type: Text,
        name: 'search clear button',
        nativeCursor: 'pointer',
        visible: false,
        fontColor: Color.rgba(0, 0, 0, 0.5),
        fontSize: 25,
        lineHeight: 2,
        padding: rect(1, 1, 9, 0),
        textAndAttributes: ['', {
          fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
          fontWeight: '900',
          lineHeight: 1
        }]
      }]
    },
    {
      name: 'assets',
      extent: pt(440, 280),
      fill: Color.transparent,
      clipMode: 'auto',
      layout: new TilingLayout({
        align: 'center',
        spacing: 5,
        wrapSubmorphs: true
      }),
      submorphs: [part(NoResultIndicator, {
        visible: false
      })]
    }, {
      name: 'button wrapper',
      extent: pt(440, 33.9000),
      fill: Color.transparent,
      layout: new TilingLayout({
        align: 'right',
        axisAlign: 'center',
        justifySubmorphs: 'spaced',
        padding: rect(10, 10, 0, 0),
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
            part(SystemButton, {
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
            }),
            part(SystemButton, {
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
            })
          ]
        }, part(SystemButton, {
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
        })]
    }, {
      name: 'status prompt',
      visible: false,
      extent: pt(440, 62.5000),
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
    }
  ]
});

const AssetManagerLight = component(AssetManagerDark, {

});

class AssetManagerPopupModel extends ViewModel {
  static get properties () {
    return {
      isPrompt: { get () { return true; } },
      isEpiMorph: {
        get () { return true; }
      },
      isHaloItem: { get () { return true; } }
    };
  }

  get expose () {
    return ['activate', 'isPrompt', 'isHaloItem', 'isEpiMorph'];
  }

  get bindings () {
    return [{
      target: 'close button',
      signal: 'onMouseUp',
      handler: 'close'
    }
    ];
  }

  viewDidLoad () {
    this.ui.assetManager.container = this.view;
  }

  close () {
    this.ui.assetManager.close();
    this.view.remove();
  }

  async activate (pos) {
    const { view } = this;
    view.doNotAcceptDropsForThisAndSubmorphs();
    view.openInWorld();
    if (!pos) view.center = $world.visibleBounds().center();
    else view.position = pos;

    return this.ui.assetManager.activate();
  }
}
export const AssetManagerPopup = component(DarkPopupWindow, {
  styleClasses: [],
  defaultViewModel: AssetManagerPopupModel,
  hasFixedPosition: false,
  extent: pt(440, 140),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    resizePolicies: [['header menu', {
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
        textAndAttributes: ['Browse Assets', null]
      }]
    }, add(part(AssetManagerDark, {
      name: 'asset manager',
      extent: pt(10.0000, 476.0000),
      layout: new TilingLayout({
        axis: 'column',
        axisAlign: 'center',
        hugContentsHorizontally: true,
        hugContentsVertically: true,
        resizePolicies: [['search input wrapper', {
          height: 'fixed',
          width: 'fill'
        }]]
      })
    }))]
});
