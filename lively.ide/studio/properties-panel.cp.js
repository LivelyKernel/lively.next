import { component, without, add, ensureFont, ViewModel, part } from 'lively.morphic/components/core.js';
import { RichTextControl } from './controls/text.cp.js';
import { TilingLayout, easings, touchInputDevice } from 'lively.morphic';
import { ShapeControl } from './controls/shape.cp.js';
import { LayoutControl } from './controls/layout.cp.js';
import { BorderControl } from './controls/border.cp.js';
import { FillControl } from './controls/fill.cp.js';
import { AlignmentControl } from './controls/constraints.cp.js';
import { Color, Rectangle } from 'lively.graphics';
import { pt, rect } from 'lively.graphics/geometry-2d.js';
import { BodyControl } from './controls/body.cp.js';
import { PropertySection } from './controls/section.cp.js';
import { ColorInput } from 'lively.ide/styling/color-picker.cp.js';
import { connect } from 'lively.bindings';

ensureFont({
  'Material Icons': 'https://fonts.googleapis.com/icon?family=Material+Icons'
});

export class PropertiesPanelModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      isHaloItem: {
        get () {
          return true; // this trick allows us to keep halos while interacting with the side bar
        }
      },
      expose: {
        get () {
          return ['focusOn', 'relayout', 'isHaloItem', 'toggle', 'onHierarchyChange', 'clearFocus'];
        }
      },
      bindings: {
        get () {
          return [
            { model: 'alignment control', signal: 'updateResizingPolicies', handler: 'updateLayoutControl' }
          ];
        }
      }
    };
  }

  updateLayoutControl () {
    this.models.layoutControl.update();
  }

  onHierarchyChange () {

  }

  relayout () {
    this.onWorldResize();
  }

  onWorldResize (align = true) {
    const { view } = this;
    const bounds = $world.visibleBounds();
    const offsetTop = navigator.standalone && touchInputDevice ? 25 : 0;

    view.height = bounds.height - offsetTop;
    view.top = offsetTop + bounds.top();
    if (!align) return;
    if (view.owner) {
      view.topRight = bounds.topRight();
    } else view.topLeft = bounds.topRight();
  }

  async toggle (active) {
    const { view } = this;
    const bounds = $world.visibleBounds();
    this.onWorldResize(false);
    if (active) {
      $world.withTopBarDo(topBar => {
        view.opacity = 0;
        $world.addMorph(view, topBar.view);
      });
      view.topLeft = bounds.topRight();
      await view.whenRendered();
      await view.withAnimationDo(() => {
        view.opacity = 1;
        view.topRight = bounds.topRight();
      }, {
        easing: easings.outCirc,
        duration: 300
      });
      this.attachToWorld($world);
    } else {
      this.detachFromWorld($world);
      await view.animate({
        opacity: 0,
        topLeft: bounds.topRight(),
        duration: 300
      });
      view.remove();
    }
  }

  attachToWorld (aWorld) {
    connect(aWorld, 'showHaloFor', this, 'focusOn', {
      garbageCollect: true
    });
  }

  detachFromWorld (aWorld) {
    aWorld.attributeConnections.forEach(conn => {
      if (conn.targetObj === this) conn.disconnect();
    });
  }

  toggleDefaultControls (active) {
    const {
      shapeControl, fillControl, textControl,
      layoutControl, alignmentControl, borderControl,
      effectsControl
    } = this.ui;
    [shapeControl, fillControl, textControl, layoutControl, alignmentControl, borderControl, effectsControl].forEach(m => m.visible = active);
  }

  clearFocus () {
    this.ui.backgroundControl.visible = true;
    this.toggleDefaultControls(false);
  }

  focusOn (aMorph) {
    if (aMorph.isWorld) return;
    const {
      shapeControl, fillControl, textControl,
      layoutControl, alignmentControl, borderControl,
      effectsControl
    } = this.models;

    this.toggleDefaultControls(true);
    this.ui.backgroundControl.visible = false;

    shapeControl.focusOn(aMorph);
    if (aMorph.isText || aMorph.isLabel) {
      textControl.view.visible = true;
      textControl.focusOn(aMorph);
    } else {
      textControl.view.visible = false;
    }
    fillControl.focusOn(aMorph);
    layoutControl.focusOn(aMorph);
    alignmentControl.focusOn(aMorph);
    borderControl.focusOn(aMorph);
    effectsControl.focusOn(aMorph);
  }
}

class BackgroundControlModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { model: 'background fill input', signal: 'color', handler: 'changeBackgroundColor' }
          ];
        }
      }
    };
  }

  onRefresh () {
    this.ui.backgroundFillInput.setColor($world.fill);
  }

  changeBackgroundColor (color) {
    $world.fill = color;
  }
}

// BackgroundSection.openInWorld()
const BackgroundControl = component(PropertySection, {
  defaultViewModel: BackgroundControlModel,
  name: 'background control',
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(0, 10, 0, 10),
    resizePolicies: [['h floater', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10,
    wrapSubmorphs: false
  }),
  extent: pt(250, 88),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Background', null]
    }, without('add button'), without('remove button')]
  }, add(part(ColorInput, { name: 'background fill input', viewModle: { gradientEnabled: true } }))]
});

// bar = part(PropertiesPanel);
// bar.openInWorld()
// bar.focusOn($world.get('test 1'))
// bar.remove()
const PropertiesPanel = component({
  defaultViewModel: PropertiesPanelModel,
  name: 'properties panel',
  width: 250,
  height: 1000,
  fill: Color.rgb(30, 30, 30).withA(0.95),
  clipMode: 'auto',
  layout: new TilingLayout({
    axis: 'column',
    wrapSubmorphs: false,
    padding: Rectangle.inset(0, 50, 0, 0),
    resizePolicies: [
      ['shape control', { width: 'fill', height: 'fixed' }],
      ['fill control', { width: 'fill', height: 'fixed' }],
      ['text control', { width: 'fill', height: 'fixed' }],
      ['layout control', { width: 'fill', height: 'fixed' }],
      ['alignment control', { width: 'fill', height: 'fixed' }],
      ['border control', { width: 'fill', height: 'fixed' }],
      ['effects control', { width: 'fill', height: 'fixed' }]
    ]
  }),
  submorphs: [
    part(BackgroundControl, { name: 'background control', fill: Color.transparent }),
    part(ShapeControl, { name: 'shape control', fill: Color.transparent, visible: false }),
    part(RichTextControl, { name: 'text control', fill: Color.transparent, visible: false }),
    part(LayoutControl, { name: 'layout control', fill: Color.transparent, visible: false }),
    part(AlignmentControl, { name: 'alignment control', fill: Color.transparent, visible: false }),
    part(FillControl, { name: 'fill control', fill: Color.transparent, visible: false }),
    part(BorderControl, { name: 'border control', fill: Color.transparent, visible: false }),
    part(BodyControl, { name: 'effects control', fill: Color.transparent, visible: false })
  ]
});

export { PropertiesPanel, BackgroundControl };
