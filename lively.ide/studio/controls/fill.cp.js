import { ViewModel, part, add, without, component } from 'lively.morphic/components/core.js';
import { pt, rect, Color } from 'lively.graphics';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { TilingLayout, Image } from 'lively.morphic';
import { PropLabel } from '../shared.cp.js';
import { PropertySection } from './section.cp.js';
import { DarkColorPicker } from '../dark-color-picker.cp.js';

export class FillControlModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      bindings: {
        get () {
          return [
            { model: 'fill color input', signal: 'onPickerClosed', handler: 'ensureHalo' },
            { model: 'fill color input', signal: 'color', handler: 'confirm' },
            { target: 'image cell', signal: 'onMouseDown', handler: 'changeImageUrl' }
          ];
        }
      }
    };
  }

  focusOn (target) {
    this.targetMorph = target;
    this.ui.imageControl.visible = !!target.isImage;
    this.models.fillColorInput.targetMorph = target;
  }

  onRefresh (prop) {
    if (prop == 'targetMorph') this.update();
  }

  ensureHalo () {
    $world.showHaloFor(this.targetMorph);
  }

  confirm () {
    if (!this.targetMorph) return;
    this.targetMorph.fill = this.ui.fillColorInput.colorValue;
  }

  async update () {
    const { isImage, fill } = this.targetMorph;
    this.ui.fillColorInput.setColor(fill);
    this.ui.imageControl.visible = isImage;
    if (isImage) {
      this.ui.imageContainer.imageUrl = this.targetMorph.imageUrl || 'http://localhost:9011/users/robin/uploads/outline_insert_photo_white_24dp.png';
      // fixme: autofit the image preview
    }
  }

  deactivate () {
    this.models.fillColorInput.closeColorPicker();
  }
}

// FillControl.openInWorld()
// ColorInput.openInWorld()
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
      axisAlign: 'center',
      wrapSubmorphs: false,
      padding: rect(20, 1, -10, 1)
    }),
    height: 25,
    submorphs: [{
      name: 'image cell',
      nativeCursor: 'pointer',
      fill: Color.transparent,
      clipMode: 'hidden',
      extent: pt(22, 22),
      submorphs: [{
        type: Image,
        name: 'image container',
        reactsToPointer: false,
        autoResize: false,
        extent: pt(20, 20),
        // fixme: add placeholder image
        imageUrl: 'http://localhost:9011/users/robin/uploads/outline_insert_photo_white_24dp.png',
        naturalExtent: pt(48, 48),
        position: pt(1, 1)
      }]
    }, part(PropLabel, { name: 'image marker', textString: 'Image' })]
  })]
});

export { FillControl };
