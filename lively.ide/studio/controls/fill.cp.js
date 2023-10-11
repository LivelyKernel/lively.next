/* global URL */
import { ViewModel, config, part, add, without, component } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { TilingLayout, Image } from 'lively.morphic';
import { TextInput, AddButton } from '../shared.cp.js';
import { PropertySection } from './section.cp.js';
import { DarkColorPicker } from '../dark-color-picker.cp.js';
import { obj } from 'lively.lang';
import { noUpdate, once } from 'lively.bindings';
import { AssetManagerPopup } from '../asset-manager.cp.js';

import { StatusMessageError } from 'lively.halos/components/messages.cp.js';
import { LabeledCheckbox } from 'lively.components/checkbox.cp.js';

export class FillControlModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      bindings: {
        get () {
          return [
            { model: 'fill color input', signal: 'onPickerClosedWithClick', handler: 'ensureHalo' },
            { model: 'fill color input', signal: 'color', handler: 'confirm' },
            { target: 'button', signal: 'onMouseDown', handler: 'imageButtonPressed' },
            { signal: 'onMouseDown', handler: 'onMouseDown' },
            { target: 'remote asset check', signal: 'checked', handler: 'remoteAssetChecked' },
            { target: 'source description', signal: 'onKeyDown', handler: 'imageButtonPressed' }
          ];
        }
      }
    };
  }

  remoteAssetChecked (checked) {
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.imageUrl = config.defaultImage;
    });
    this.update();
    const { sourceDescription, button } = this.ui;
    if (checked) {
      sourceDescription.readOnly = false;
      sourceDescription.nativeCursor = 'text';
      sourceDescription.textString = 'Enter URL';
      sourceDescription.tooltip = '';
      button.textAndAttributes = ['', {
        fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
        fontSize: 18,
        fontWeight: '900'
      }];
    } else {
      sourceDescription.readOnly = true;
      sourceDescription.nativeCursor = 'not-allowed';
      sourceDescription.tooltip = 'Select an image with the button to the right or enable remote assets to enter an URL.';
      sourceDescription.textString = 'Choose Asset';
      button.textAndAttributes = ['', {
        fontFamily: 'Tabler Icons',
        fontSize: 18,
        fontWeight: '900'
      }];
    }
  }

  onMouseDown () {
    this.deactivate();
  }

  async imageButtonPressed (evt) {
    if (evt && evt.key && evt.key !== 'Enter') return;
    if (this.ui.remoteAssetCheck.checked) {
      try {
        new URL(this.ui.sourceDescription.textString);
      } catch (e) {
        $world.setStatusMessage('Invalid URL', StatusMessageError);
        return;
      }
      this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
        this.targetMorph.imageUrl = this.ui.sourceDescription.textString;
      });
    } else {
      const assetManager = part(AssetManagerPopup);
      $world._assetBrowserPopup = assetManager;
      once(assetManager, 'close', this, 'closeAssetManagerPopup');
      if ($world._assetBrowser) $world._assetBrowser.block();
      const selectedImageUrl = await assetManager.activate();
      if (selectedImageUrl) {
        this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
          this.targetMorph.imageUrl = selectedImageUrl;
        });
      }
    }
    this.update();
  }

  closeAssetManagerPopup () {
    if (!$world._assetBrowserPopup) return;
    $world._assetBrowserPopup.close();
    $world._assetBrowserPopup = null;
  }

  focusOn (target) {
    this.targetMorph = target;
    this.ui.imageControl.visible = !!target.isImage;
    if (target.isImage) {
      const imageUrl = target.imageUrl;
      this.updateImageInfo(imageUrl, true);
    }

    this.models.fillColorInput.targetMorph = target;
    this.update();
  }

  updateImageInfo (imageUrl, withCheckState = false) {
    if (imageUrl.includes('local_projects')) {
      this.withoutBindingsDo(() => {
        this.ui.sourceDescription.textString = imageUrl.split('/').pop();
        if (withCheckState) this.ui.remoteAssetCheck.checked = false;
      });
    } else if (imageUrl.includes('http')) {
      this.withoutBindingsDo(() => {
        if (withCheckState) this.ui.remoteAssetCheck.checked = true;
        this.ui.sourceDescription.textString = imageUrl;
      });
    } else {
      if (withCheckState) this.ui.remoteAssetCheck.checked = false;
      this.ui.sourceDescription.textString = 'Other Asset';
    }
  }

  onRefresh (prop) {
    if (prop === 'targetMorph') this.update();
  }

  ensureHalo () {
    noUpdate(() => { if (this.targetMorph.world()) $world.showHaloFor(this.targetMorph); });
  }

  confirm () {
    if (!this.targetMorph) return;
    let color = this.ui.fillColorInput.colorValue;
    if (obj.equals(this.targetMorph.fill, color)) return;
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.fill = color;
    });
  }

  async update () {
    const { isImage, fill } = this.targetMorph;
    this.ui.fillColorInput.setColor(fill);
    this.ui.imageControl.visible = isImage;
    if (isImage) {
      this.ui.imageContainer.imageUrl = this.targetMorph.imageUrl;
      this.updateImageInfo(this.targetMorph.imageUrl);
      // fixme: autofit the image preview
    }
  }

  deactivate () {
    this.closeAssetManagerPopup();
    this.models.fillColorInput.closeColorPicker();
  }
}

const FillControl = component(PropertySection, {
  defaultViewModel: FillControlModel,
  name: 'fill control',
  extent: pt(250, 121),
  submorphs: [{
    name: 'h floater',
    submorphs: [
      without('add button'), {
        name: 'section headline',
        textAndAttributes: ['Fill', null]
      }]
  }, add(part(ColorInput, {
    name: 'fill color input',
    viewModel: {
      gradientEnabled: true,
      colorPickerComponent: DarkColorPicker
    },
    extent: pt(250, 27)
  })), add({
    name: 'image control',
    extent: pt(235.1, 25),
    fill: Color.rgba(255, 255, 255, 0),
    layout: new TilingLayout({
      axis: 'column',
      axisAlign: 'center',
      justifySubmorphs: 'spaced',
      padding: rect(20, 1, -10, 1)
    }),
    height: 25,
    submorphs: [
      {
        name: 'bottom wrapper',
        clipMode: 'hidden',
        extent: pt(235.0000, 62.5000),
        layout: new TilingLayout({
          axisAlign: 'center',
          padding: rect(12, 10, 18, 0),
          spacing: 5,
          wrapSubmorphs: true
        }),
        fill: Color.transparent,
        submorphs: [
          {
            name: 'image cell',
            fill: Color.transparent,
            clipMode: 'hidden',
            extent: pt(22.0000, 22.0000),
            submorphs: [{
              type: Image,
              name: 'image container',
              reactsToPointer: false,
              extent: pt(20, 20),
              naturalExtent: pt(48, 48),
              position: pt(1, 1)
            }]
          },
          part(TextInput, {
            name: 'source description',
            width: 130,
            placeholder: null,
            textAndAttributes: ['ddf', null]
          }), part(AddButton, {
            name: 'button',
            tooltip: 'Add an asset to this project',
            textAndAttributes: ['', {
              fontFamily: 'Tabler Icons',
              fontSize: 18,
              fontWeight: '900'
            }]
          }), part(LabeledCheckbox, {
            name: 'remote asset check',
            extent: pt(56.0000, 10.0000),
            viewModel: {
              label: 'Use remote image?'
            },
            submorphs: [{
              name: 'label',
              fontColor: Color.rgb(180, 224, 232)
            }]
          })
        ]
      }]
  })]
});

export { FillControl };
