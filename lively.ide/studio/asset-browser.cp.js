/* global FormData */
import { component, Icon, easings, morph, Text, Label, Image, part, add, TilingLayout, ViewModel } from 'lively.morphic';

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
import { once, signal } from 'lively.bindings';
import { ModeSelector, ModeSelectorLabelDark, ModeSelectorLabel } from 'lively.components/widgets/mode-selector.cp.js';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { Spinner } from './shared.cp.js';
import { supportedImageFormatsForFilePickerAPI } from '../assets.js';

class AssetPreviewModel extends ViewModel {
  static get properties () {
    return {
      imageUrl: {},
      assetName: {},
      fullFileName: {},
      assetBrowser: {},
      allowDragging: {},
      assetBrowserAsPopup: {},
      expose: {
        get () {
          return ['assetName', 'isAssetPreview', 'onDragStart'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: () => this.assetBrowser.selectAssetEntry(this), override: true }
          ];
        }
      }
    };
  }

  async onDragStart () {
    if (!this.allowDragging) return;
    const imageForGrab = new Image({ imageUrl: this.imageUrl });
    const naturalExtent = await imageForGrab.determineNaturalExtent();
    const maxWidth = 500;
    const maxHeight = 500;
    const scaleFactor = Math.min(maxWidth / naturalExtent.x, maxHeight / naturalExtent.y);
    imageForGrab.extent = naturalExtent.scaleBy(scaleFactor);
    imageForGrab.scale = 0;
    $world.firstHand.grab(imageForGrab);
    imageForGrab.onBeingDroppedOn = (hand, recipient) => {
      if (recipient !== $world) imageForGrab.remove();
      else {
        imageForGrab.onBeingDroppedOn = imageForGrab.__proto__.onBeingDroppedOn;
        imageForGrab.onBeingDroppedOn(hand, recipient);
      }
    };
    imageForGrab.animate({
      scale: 1,
      duration: 300,
      easing: easings.outSine
    });
  }

  get isAssetPreview () {
    return true;
  }

  async viewDidLoad () {
    const img = this.ui.previewHolder;
    img.imageUrl = this.imageUrl;
    const naturalExtent = await img.determineNaturalExtent();
    const maxWidth = img.owner.width - 15;
    const maxHeight = img.owner.height - 35;
    const scaleFactor = Math.min(maxWidth / naturalExtent.x, maxHeight / naturalExtent.y);
    img.extent = naturalExtent.scaleBy(scaleFactor);
    img.opacity = 1;

    this.ui.componentName.value = this.assetName;
    this.view.nativeCursor = this.allowDragging ? 'pointer' : 'auto';
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
      name: 'component name', textAndAttributes: ['hello', null]
    }
  ]
});

const AssetPreviewUnselectedLight = component(AssetPreviewUnselected, {
  submorphs: [{
    name: 'component name',
    fontColor: Color.rgb(102, 102, 102)
  }
  ]
});

const AssetPreviewSelectedLight = component(AssetPreviewUnselected, {
  borderColor: Color.rgb(33, 150, 243),
  borderWidth: 2,
  fill: Color.rgba(3, 169, 244, 0.75),
  submorphs: [{
    name: 'component name',
    fontColor: Color.white
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
      selectedDark: AssetPreviewSelected,
      unselectedLight: AssetPreviewUnselectedLight,
      selectedLight: AssetPreviewSelectedLight
    }
  }
});

class AssetBrowserModel extends ViewModel {
  static get properties () {
    return {
      container: {},
      allowDraggingAssets: {
        defaultValue: false
      }
    };
  }

  get assetBrowserAsPopup () {
    return !this.view.ownerChain().some(m => m.isWindow);
  }

  get expose () {
    return ['activate', 'container', 'close', 'initialize', 'block'];
  }

  get bindings () {
    return [
      { target: 'upload button', signal: 'onMouseDown', handler: 'openFilePicker' },
      // See https://github.com/LivelyKernel/lively.next/issues/1057
      { target: 'delete button', signal: 'onMouseUp', handler: 'deleteAsset' },
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
    // _promise is initialized inside of the popup, but not the window
    if (this._promise) {
      this._promise.resolve(this.selectedAsset.imageUrl);
      this.container.remove();
    } else {
      const image = new Image({ imageUrl: this.selectedAsset.imageUrl });
      image.determineNaturalExtent().then((extent) => {
        const maxWidth = 500;
        const maxHeight = 500;
        const scaleFactor = Math.min(maxWidth / extent.x, maxHeight / extent.y);
        image.extent = extent.scaleBy(scaleFactor);
        image.openInWorld();
      });
    }
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

  block () {
    const fader = morph({
      name: 'fader',
      position: this.container.position,
      extent: this.container.extent,
      fill: Color.rgbHex('202020'),
      opacity: 0.8
    });
    $world.addMorph(fader);
    const li = $world.showLoadingIndicatorFor(this.container, 'Changing Assets in Properties Panel...');
    once($world._assetBrowserPopup, 'close', () => {
      fader.remove();
      li.remove();
      this.updateAtRuntime = true;
      this.listAssets(true);
    });
  }

  async activate () {
    await this.initialize();
    this._promise = promise.deferred();
    return this._promise.promise;
  }

  async deleteAsset () {
    const assetToDelete = resource($world.openedProject.url).join('assets/' + this.selectedAsset.fullFileName);
    await assetToDelete.remove();
    this.ui.selectionButton.disable();
    this.selectedAsset.view.remove();
    this.ui.deleteButton.visible = false;
    this.selectedAsset = null;
  }

  selectAssetEntry (assetEntryModel) {
    if (this.selectedAsset) this.selectedAsset.view.master.setState(this.view.getWindow() ? 'unselectedLight' : null);
    this.selectedAsset = assetEntryModel;
    this.ui.deleteButton.visible = true;
    assetEntryModel.view.master.setState(this.assetBrowserAsPopup ? 'selectedDark' : 'selectedLight');
    this.ui.selectionButton.enable();
  }

  async openFilePicker () {
    const pickerOpts = {
      multiple: true,
      types: [
        {
          description: 'asset files',
          accept: {
            'image/*': supportedImageFormatsForFilePickerAPI
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
    const assetHolder = this.view.getSubmorphNamed('assets');
    if (this.needsListRefreshed) assetHolder.submorphs = assetHolder.submorphs.filter(m => !m.isAssetPreview);
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
    if (!assets) {
      this.ui.noAssetsIndicator.visible = true;
      return;
    }
    this.ui.noAssetsIndicator.visible = false;

    assets.forEach(a => {
      const assetName = a.nameWithoutExt();
      if (!this.view.getSubmorphNamed(assetName)) {
        const addedPreviewMorph = part(AssetPreview, {
          name: assetName,
          viewModel: {
            assetName,
            fullFileName: a.name(),
            imageUrl: a.url,
            assetBrowser: this,
            allowDragging: this.allowDraggingAssets
          }
        });
        if (true) addedPreviewMorph.master.setState('unselectedLight');
        this.view.getSubmorphNamed('assets').addMorph(addedPreviewMorph);
      }
    });
    if (updateAtRuntime) {
      fader.remove();
      li.remove();
    }
  }

  close () {
    this._promise?.resolve(null);
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

const NoAssetsIndicator = component({
  name: 'no assets indicator',
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
    fontSize: 73,
    lineWrapping: 'by-words',
    padding: rect(1, 1, 0, 0),
    position: pt(67.0000, 22.5000),
    textAndAttributes: ['懶', {
      fontFamily: 'Tabler Icons',
      fontWeight: '900'
    }, '  ', {}]

  }, {
    type: Text,
    name: 'text',
    dynamicCursorColoring: true,
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgba(126, 126, 126, 0.75),
    fontSize: 20,
    fontWeight: '600',
    position: pt(152.0000, 61.5000),
    textAndAttributes: ['No assets...', null]

  }]
});

export const AssetBrowserDark = component({
  name: 'asset browser',
  defaultViewModel: AssetBrowserModel,
  extent: pt(440.0000, 324),
  reactsToPointer: false,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    padding: rect(10, 10, 0, 0),
    resizePolicies: [['asset type selector wrapper', {
      height: 'fixed',
      width: 'fill'
    }], ['search input wrapper', {
      height: 'fixed',
      width: 'fill'
    }], ['assets', {
      height: 'fill',
      width: 'fill'
    }], ['button wrapper', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10
  }),
  fill: Color.rgba(255, 255, 255, 0),
  submorphs: [
    {
      name: 'asset type selector wrapper',
      layout: new TilingLayout({
        align: 'center',
        axisAlign: 'center'
      }),
      fill: Color.rgba(255, 255, 255, 0),
      submorphs: [part(ModeSelector, {
        name: 'asset type selector',
        nativeCursor: 'not-allowed',
        tooltip: 'Currently, only Images are supported.',
        layout: new TilingLayout({
          align: 'center',
          spacing: 30
        }),
        viewModel: {
          labelMaster: ModeSelectorLabelDark,
          items: [
            { text: 'Images', name: 'images', tooltip: 'Image' },
            { text: 'Video', name: 'video', tooltip: 'Video Assets' },
            { text: 'Audio', name: 'audio', tooltip: 'Audio Assets' }
          ]
        }
      })]
    }, {
      name: 'search input wrapper',
      extent: pt(440.0000, 42.6000),
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
        textAndAttributes: Icon.textAttribute('magnifying-glass', {
          lineHeight: 1.2
        })
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
          fontFamily: 'Font Awesome',
          fontWeight: '900',
          lineHeight: 1
        }]
      }]
    },
    {
      name: 'assets',
      extent: pt(420, 165),
      fill: Color.transparent,
      clipMode: 'auto',
      layout: new TilingLayout({
        align: 'center',
        padding: rect(5, 5, 0, 0),
        spacing: 5,
        wrapSubmorphs: true
      }),
      submorphs: [part(NoResultIndicator, {
        visible: false,
        name: 'no results indicator'
      }),
      part(NoAssetsIndicator, {
        visible: false,
        name: 'no assets indicator'
      })]
    }, {
      name: 'button wrapper',
      extent: pt(440, 33.9000),
      fill: Color.transparent,
      layout: new TilingLayout({
        align: 'center',
        axisAlign: 'center',
        justifySubmorphs: 'spaced',
        padding: rect(0, 10, 0, 0),
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
                fontColor: Color.white,
                textAndAttributes: ['', {
                  fontColor: Color.white,
                  fontFamily: 'Font Awesome',
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
                fontColor: Color.white,
                textAndAttributes: ['', {
                  fontFamily: 'Font Awesome',
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
            fontColor: Color.white,
            textAndAttributes: ['', {
              fontColor: Color.rgb(74, 214, 87),
              fontFamily: 'Font Awesome',
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
          lineWrapping: 'by-words'
        },
        part(DarkButton, {
          name: 'proceed button',
          extent: pt(80, 20),
          opacity: 0.8,
          submorphs: [{
            name: 'label',
            textAndAttributes: ['Proceed', null]

          }]
        }),
        part(DarkButton, {
          name: 'cancel button',
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

export const AssetBrowserLight = component(AssetBrowserDark, {
  viewModel: {
    allowDraggingAssets: true
  },
  submorphs: [
    {
      name: 'asset type selector wrapper',
      submorphs: [
        {
          name: 'asset type selector',
          viewModel: {
            labelMaster: ModeSelectorLabel
          }
        }
      ]
    },
    {
      name: 'assets',
      fill: Color.rgb(238, 238, 238)
    }, {
      name: 'button wrapper',
      submorphs: [
        {
          name: 'left buttons',
          submorphs: [{
            name: 'upload button',
            master: SystemButton,
            submorphs: [{
              name: 'label',
              textAndAttributes: ['', {
                fontFamily: 'Font Awesome',
                fontWeight: '900',
                lineHeight: 1
              }, ' Upload', {
                fontFamily: 'IBM Plex Sans'
              }]
            }]
          },
          {
            name: 'delete button',
            master: SystemButton,
            submorphs: [{
              name: 'label',
              textAndAttributes: ['', {
                fontFamily: 'Font Awesome',
                fontWeight: '900',
                lineHeight: 1
              }, ' Delete', {
                fontFamily: 'IBM Plex Sans'
              }]
            }]
          }
          ]
        },
        {
          name: 'selection button',
          master: SystemButton,
          submorphs: [{
            name: 'label',
            textAndAttributes: ['', {
              fontColor: Color.rgb(74, 174, 79),
              fontFamily: 'Font Awesome',
              fontWeight: '900',
              lineHeight: 1
            }, ' Use', {
              fontFamily: 'IBM Plex Sans'
            }]
          }]
        }]
    },
    {
      name: 'status prompt',
      submorphs: [
        {
          name: 'proceed button',
          master: SystemButton
        },
        {
          name: 'cancel button',
          master: SystemButton
        }
      ]
    }
  ]
});

class AssetBrowserPopupModel extends ViewModel {
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
    return ['activate', 'isPrompt', 'isHaloItem', 'isEpiMorph', 'close'];
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
    this.ui.assetBrowser.container = this.view;
  }

  close () {
    signal($world._assetBrowserPopup, 'close');
    this.ui.assetBrowser?.close();
    this.view.remove();
    $world._assetBrowserPopup = null;
  }

  activate (pos) {
    const { view } = this;
    view.doNotAcceptDropsForThisAndSubmorphs();
    view.openInWorld();
    if (!pos) view.center = $world.visibleBounds().center();
    else view.position = pos;

    return this.ui.assetBrowser.activate();
  }
}
export const AssetBrowserPopup = component(DarkPopupWindow, {
  styleClasses: [],
  defaultViewModel: AssetBrowserPopupModel,
  extent: pt(450, 365),
  hasFixedPosition: false,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
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
    }, add(part(AssetBrowserDark, {
      name: 'asset browser',
      extent: pt(440, 324)
    }))]
});
