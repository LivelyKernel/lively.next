import { ViewModel, part, add, without, component } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { TilingLayout, Image } from 'lively.morphic';
import { PropLabel } from '../shared.cp.js';
import { PropertySection } from './section.cp.js';
import { DarkColorPicker } from '../dark-color-picker.cp.js';
import { obj } from 'lively.lang';
import { noUpdate } from 'lively.bindings';

const placeholderImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAfRJREFUaEPtmTFrFFEUhb+jIIKQgFZGi3QBU6SQCDaCXVJbqZCQpLW2E1OntRJCFEXxB2gdCxtFAxYh+QOJVYoU0c4THkxg3dmZnWXnTWbk3XLnzbvn3HPuXd4b0fFQx/GTCJy3gkmBVitg+wawAdwHrjcM9hewDTyVdFCUu9BCGfifwLWGgfenOwLmikiUEXgHPDpn8Gfp30t6PAhLGYEg21RLCBxKCnbORRkB966W1OjEsl0pfyIQy2JJgaoVSAoUVKBqAVMTJwslC41ZgWShMQuYptCoFrI9Kel42Hut/B+w/QBYB+5I+lNGonUEbM8A34AJYEvSWmsI2L4NXJQUAObC9hXgKzDb83BJ0tsiEo0pYPsq8AO4lFkjdwC3Peh4egLMS9orIB3/QGP7AvAJWMhAfAfu9frb9hPgRUGldzPSv/ufN6KA7dCQz/uSf5D0MPxm+y7wOVOnyC2vJK02TsD2IvARCCr0xzPgJbAD3Bw2MoFlSW9610VVwPZ05vvg/0HxF9gHblUAH5bk+iEaAduXgS9AmDx1xj/9EJPAJlA6w8dg9VrSStY/8afQGECHvhpNgaGZa1qQCFStQE0Fz21TNf9/fbnb+ev1cJ3d3Q8c2Szu7iemWM1Z976NfrSoG3zYLxGIUdVR9kwKjFKtGGtPAaQTYEDIYzesAAAAAElFTkSuQmCC';

export class FillControlModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      placeholderImage: {
        defaultValue: placeholderImage
      },
      bindings: {
        get () {
          return [
            { model: 'fill color input', signal: 'onPickerClosedWithClick', handler: 'ensureHalo' },
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
    if (prop === 'targetMorph') this.update();
  }

  ensureHalo () {
    if (this.targetMorph.world()) $world.showHaloFor(this.targetMorph);
  }

  confirm () {
    if (!this.targetMorph) return;
    let color = this.ui.fillColorInput.colorValue;
    if (obj.equals(this.targetMorph.fill, color)) return;
    this.targetMorph.fill = color;
  }

  async update () {
    const { isImage, fill } = this.targetMorph;
    this.ui.fillColorInput.setColor(fill);
    this.ui.imageControl.visible = isImage;
    if (isImage) {
      this.ui.imageContainer.imageUrl = this.targetMorph.imageUrl || this.placeholderImage;
      // fixme: autofit the image preview
    }
  }

  deactivate () {
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
        extent: pt(20, 20),
        imageUrl: placeholderImage,
        naturalExtent: pt(48, 48),
        position: pt(1, 1)
      }]
    }, part(PropLabel, { name: 'image marker', textString: 'Image' })]
  })]
});

export { FillControl };
