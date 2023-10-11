/* global URL */
/* global URL */
import { ViewModel, part, add, without, component } from 'lively.morphic';
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
import { CheckboxUnchecked } from 'lively.components';

export class FillControlModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      bindings: {
        get () {
          return [
            { model: 'fill color input', signal: 'onPickerClosedWithClick', handler: 'ensureHalo' },
            { model: 'fill color input', signal: 'color', handler: 'confirm' },
            { target: 'open asset manager button', signal: 'onMouseDown', handler: 'openAssetManager' },
            { target: 'confirm url', signal: 'onMouseDown', handler: 'changeRemoteURL' },
            { signal: 'onMouseDown', handler: 'onMouseDown' },
            { target: 'asset type selector', signal: 'selectionChanged', handler: 'showControlsForAssetType' }
          ];
        }
      }
    };
  }

  changeRemoteURL () {
    try {
      new URL(this.ui.sourceDescription.textString);
    } catch (e) {
      $world.setStatusMessage('Invalid URL', StatusMessageError);
      return;
    }
    this.targetMorph.imageUrl = this.ui.sourceDescription.textString;
  }

  showControlsForAssetType (type) {
    if (type === 'local') {
      this.ui.sourceDescription.readOnly = true;
      this.ui.sourceDescription.selectable = false;
      this.ui.confirmUrl.visible = this.ui.confirmUrl.isLayoutable = false;
      this.ui.openAssetManagerButton.visible = this.ui.openAssetManagerButton.isLayoutable = true;
    }
    if (type === 'remote') {
      this.ui.sourceDescription.readOnly = false;
      this.ui.sourceDescription.selectable = true;
      this.ui.confirmUrl.visible = this.ui.confirmUrl.isLayoutable = true;
      this.ui.openAssetManagerButton.visible = this.ui.openAssetManagerButton.isLayoutable = false;
    }
  }

  onMouseDown () {
    this.deactivate();
  }

  async openAssetManager () {
    const assetManager = part(AssetManagerPopup);
    $world._assetBrowserPopup = assetManager;
    once(assetManager, 'close', this, 'closeAssetManagerPopup');
    if ($world._assetBrowser) $world._assetBrowser.block();
    const selectedImageUrl = await assetManager.activate();
    if (selectedImageUrl) this.targetMorph.imageUrl = selectedImageUrl;
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
      if (imageUrl.includes('local_projects')) this.ui.sourceDescription.textString = 'Project Asset';
      else if (imageUrl.includes('http')) this.ui.sourceDescription.textString = target.imageUrl;
      else this.ui.sourceDescription.textString = 'Other Image';
    }
    this.models.fillColorInput.targetMorph = target;
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
      part(ModeSelectorDark, {
        name: 'asset type selector',
        viewModel: {
          items: [
            { text: 'Local Asset', name: 'local', tooltip: 'Use a local asset from within this project or add a new one.' },
            { text: 'Remote URL', name: 'remote', tooltip: 'Enter an Asset URL to use a remote asset.' }]
        }
      }
      ), {
        name: 'bottom wrapper',
        clipMode: 'hidden',
        extent: pt(235.0000, 30.0000),
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          padding: rect(15, 10, 15, 0),
          spacing: 5
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
            name: 'open asset manager button',
            tooltip: 'Add an asset to this project',
            textAndAttributes: ['', {
              fontFamily: 'Tabler Icons',
              fontSize: 18,
              fontWeight: '900'
            }]
          }),
          part(AddButton, {
            name: 'confirm url',
            visible: false,
            isLayoutable: false,
            tooltip: 'Load remote asset URL.',
            textAndAttributes: ['', {
              fontFamily: 'Tabler Icons',
              fontSize: 18,
              fontWeight: '900'
            }]
          })
        ]
      }]
  })]
});

export { FillControl };
