import { TilingLayout, easings, touchInputDevice, component, without, add, ViewModel, part } from 'lively.morphic';
import { Color, Rectangle } from 'lively.graphics';
import { pt, rect } from 'lively.graphics/geometry-2d.js';
import { ColorInput } from 'lively.ide/styling/color-picker.cp.js';
import { epiConnect, disconnect } from 'lively.bindings';

import { RichTextControl } from './controls/text.cp.js';
import { ShapeControl } from './controls/shape.cp.js';
import { LayoutControl } from './controls/layout.cp.js';
import { BorderControl } from './controls/border.cp.js';
import { FillControl } from './controls/fill.cp.js';
import { ConstraintsManager } from './controls/constraints.cp.js';
import { BodyControl } from './controls/body.cp.js';
import { PropertySection } from './controls/section.cp.js';
import { DarkColorPicker } from './dark-color-picker.cp.js';
import { EmbeddingControl } from './controls/embedding.cp.js';
import { ComponentControl, ComponentStatesControl } from './controls/component.cp.js';
import { ResponsiveControl } from './controls/responsive.cp.js';

export class PropertiesPanelModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      isHaloItem: {
        get () {
          return true; // this trick allows us to keep halos while interacting with the side bar
        }
      },
      bindings: {
        get () {
          return [
            { model: 'layout control', signal: 'layout changed', handler: 'refreshShapeControl' },
            { target: 'component control', signal: 'component changed', handler: 'refreshResponsiveControl' },
            { target: 'component control', signal: 'component changed', handler: 'refreshComponentStatesControl' },
            { target: 'component control', signal: 'deactivate', handler: 'refreshResponsiveControl' }
          ];
        }
      },
      expose: {
        get () {
          return ['focusOn', 'relayout', 'isHaloItem', 'toggle', 'onHierarchyChange', 'clearFocus', 'isPropertiesPanel'];
        }
      }
    };
  }

  get isPropertiesPanel () {
    return true;
  }

  refreshShapeControl () {
    this.ui.shapeControl.refreshFromTarget();
  }

  refreshComponentStatesControl () {
    this.ui.componentStatesControl.visible = !!this.targetMorph.master;
  }

  refreshResponsiveControl () {
    this.ui.responsiveControl.visible = !!this.targetMorph.master?.parent;
  }

  updateLayoutControl () {
    this.models.layoutControl.update();
  }

  onHierarchyChange () {
  }

  onTargetMovedInHierarchy () {
    this.ui.shapeControl.refreshFromTarget();
    this.ui.constraintsControl.focusOn(this.targetMorph);
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
    const zoomIndicator = $world.get('world zoom indicator');
    this.onWorldResize(false);
    if (active) {
      $world.withTopBarDo(topBar => {
        view.opacity = 0;
        $world.addMorph(view, topBar.view);
      });
      view.topLeft = bounds.topRight();
      view.withAnimationDo(() => {
        view.opacity = 1,
        view.topRight = bounds.topRight();
        zoomIndicator?.relayout();
        $world.get('world mini map')?.relayout();
      }, {
        easing: easings.outCirc,
        duration: 300
      });
      this.attachToWorld($world);
    } else {
      this.detachFromWorld($world);
      await view.withAnimationDo(() => {
        view.opacity = 0,
        view.topLeft = bounds.topRight();
        zoomIndicator?.relayout();
        $world.get('world mini map')?.relayout();
      }
      , { duration: 300 }
      );
      view.remove();
    }

    const openedHalos = $world.halos();
    if (openedHalos.length > 0 && openedHalos[0].target.isMorph) this.focusOn(openedHalos[0].target);
  }

  /**
   * Alternatively to attaching to a world context, we can also connect to an arbitrary
   * morph as a context and listen for 'onHaloOpened' events.
   */
  attachToTarget (aMorph) {
    this.models.backgroundControl.focusOn(aMorph);
    epiConnect(aMorph, 'onHaloOpened', this, 'focusOn', {
      garbageCollect: true
    });
    epiConnect(aMorph, 'onHaloRemoved', this, 'clearFocus', {
      garbageCollect: true
    });
  }

  detachFromTarget (aMorph) {
    this.models.backgroundControl.clearFocus();
    aMorph.attributeConnections.forEach(conn => {
      if (conn.targetObj === this) conn.disconnect();
    });
  }

  attachToWorld (aWorld) {
    this.models.backgroundControl.focusOn(aWorld);
    epiConnect(aWorld, 'showHaloFor', this, 'focusOn', {
      garbageCollect: true
    });
    epiConnect(aWorld, 'onHaloRemoved', this, 'clearFocus', {
      garbageCollect: true
    });
  }

  detachFromWorld (aWorld) {
    this.models.backgroundControl.clearFocus();
    aWorld.attributeConnections.forEach(conn => {
      if (conn.targetObj === this) conn.disconnect();
    });
  }

  toggleDefaultControls (active) {
    const {
      shapeControl, fillControl, textControl,
      layoutControl, constraintsControl, borderControl,
      effectsControl, embeddingControl, componentControl,
      responsiveControl, componentStatesControl
    } = this.ui;
    [shapeControl, fillControl, textControl, layoutControl,
      constraintsControl, borderControl, effectsControl,
      embeddingControl, componentControl, responsiveControl, componentStatesControl].forEach(m => m.visible = active);
    embeddingControl.visible = false;
  }

  clearFocus () {
    $world.withAllSubmorphsDo(m => m.isPropertiesPanelPopup && m.close());
    if (this.targetMorph) {
      disconnect(this.targetMorph, 'onOwnerChanged', this, 'onTargetMovedInHierarchy');
      this.targetMorph = null;
    }

    this.ui.backgroundControl.visible = true;
    this.models.backgroundControl.onRefresh();
    this.toggleDefaultControls(false);
    // fixme: clear any open popups
    this.models.effectsControl.deactivate();
    this.models.fillControl.deactivate();
    this.models.borderControl.targetMorph = null;
    this.models.borderControl.deactivate();
    this.models.textControl.deactivate();

    this.models.componentControl.closePopup();
    this.models.componentStatesControl.closePopup();

    this.models.responsiveControl.clearHalo();
  }

  clearFocusIfRemoved () {
    if (this.targetMorph && !this.targetMorph.owner) { this.clearFocus(); }
  }

  focusOn (aMorph) {
    $world.withAllSubmorphsDo(m => m.isPropertiesPanelPopup && m.close());
    if (aMorph.isWorld) return;
    if (Array.isArray(aMorph) && aMorph.length === 1) aMorph = aMorph[0];
    // ignore multi selections of more than one morph for now.
    // fixme: We still do not support multi select targets... add support for that in the future
    if (!aMorph.isMorph) return;
    const {
      shapeControl, fillControl, textControl,
      layoutControl, constraintsControl, embeddingControl,
      borderControl, effectsControl, backgroundControl, alignmentControl,
      componentControl, responsiveControl, componentStatesControl
    } = this.models;
    if (this.targetMorph) {
      disconnect(this.targetMorph, 'onOwnerChanged', this, 'onTargetMovedInHierarchy');
      disconnect(this.targetMorph, 'remove', this, 'clearFocusIfRemoved');
    }
    this.targetMorph = aMorph;
    epiConnect(aMorph, 'onOwnerChanged', this, 'onTargetMovedInHierarchy');
    epiConnect(aMorph, 'remove', this, 'clearFocusIfRemoved');

    this.toggleDefaultControls(true);

    this.ui.backgroundControl.visible = false;
    backgroundControl.deactivate();

    shapeControl.focusOn(aMorph);
    if (aMorph.isText || aMorph.isLabel) {
      textControl.view.visible = true;
      textControl.focusOn(aMorph);
      layoutControl.view.visible = false;
    } else {
      textControl.view.visible = false;
    }
    if (aMorph.owner?.isText) {
      embeddingControl.view.visible = true;
      embeddingControl.focusOn(aMorph);
    }
    fillControl.focusOn(aMorph);
    layoutControl.focusOn(aMorph);
    if (aMorph.owner && aMorph.owner !== $world) {
      constraintsControl.view.visible = true;
      constraintsControl.focusOn(aMorph);
    } else {
      constraintsControl.view.visible = false;
    }
    this.refreshComponentStatesControl();
    borderControl.focusOn(aMorph);
    effectsControl.focusOn(aMorph);
    componentControl.focusOn(aMorph);
    componentStatesControl.focusOn(aMorph);
    responsiveControl.focusOn(aMorph);
  }
}

class BackgroundControlModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { model: 'background fill input', signal: 'color', handler: 'changeBackgroundColor' },
            { signal: 'onMouseDown', handler: 'onMouseDown' }
          ];
        }
      }
    };
  }

  onMouseDown () { this.deactivate(); }

  focusOn (aMorph) {
    this.targetMorph = aMorph;
    this.models.backgroundFillInput.targetMorph = aMorph;
    this.onRefresh();
  }

  clearFocus () {
    this.targetMorph = null;
  }

  onRefresh () {
    if (this.targetMorph) { this.ui.backgroundFillInput.setColor(this.targetMorph.fill); }
  }

  changeBackgroundColor (color) {
    if (this.targetMorph) { this.targetMorph.fill = color; } // use primary target instead
  }

  deactivate () { this.models.backgroundFillInput.closeColorPicker(); }
}

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
    spacing: 10
  }),
  extent: pt(250, 88),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Background', null]
    }, without('add button'), without('remove button')]
  }, add(part(ColorInput, {
    name: 'background fill input',
    viewModel: {
      gradientEnabled: true,
      colorPickerComponent: DarkColorPicker
    }
  }))]
});

export const defaultPropertiesPanelWidth = 250;

const PropertiesPanel = component({
  defaultViewModel: PropertiesPanelModel,
  name: 'properties panel',
  width: defaultPropertiesPanelWidth,
  height: 1000,
  hideScrollbars: true,
  fill: Color.rgb(30, 30, 30).withA(0.95),
  clipMode: 'auto',
  layout: new TilingLayout({
    axis: 'column',
    padding: rect(0, 50, 0, -50),
    resizePolicies: [['shape control', {
      height: 'fixed',
      width: 'fill'
    }], ['text control', {
      height: 'fixed',
      width: 'fill'
    }], ['component control', {
      height: 'fixed',
      width: 'fill'
    }],
    ['component states control', {
      height: 'fixed',
      width: 'fill'
    }], ['responsive control', {
      height: 'fixed',
      width: 'fill'
    }], ['layout control', {
      height: 'fixed',
      width: 'fill'
    }], ['embedding control', {
      height: 'fixed',
      width: 'fill'
    }], ['constraints control', {
      height: 'fixed',
      width: 'fill'
    }], ['fill control', {
      height: 'fixed',
      width: 'fill'
    }], ['border control', {
      height: 'fixed',
      width: 'fill'
    }], ['effects control', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [
    part(BackgroundControl, { name: 'background control' }),
    part(ShapeControl, { name: 'shape control', visible: false }),
    part(RichTextControl, {
      name: 'text control',
      visible: false,
      viewModel: { globalMode: true },
      submorphs: [{
        name: 'text controls',
        submorphs: [
          {
            name: 'weight and styles',
            submorphs: [
              {
                name: 'styling controls',
                submorphs: [
                  without('inline link'),
                  without('quote')
                ]
              }
            ]
          }

        ]
      }
      ]
    }),
    part(LayoutControl, { name: 'layout control', visible: false }),
    part(EmbeddingControl, { name: 'embedding control', visible: false }),
    part(ConstraintsManager, { name: 'constraints control', visible: false }),
    part(FillControl, { name: 'fill control', visible: false }),
    part(BorderControl, { name: 'border control', visible: false }),
    part(ComponentControl, { name: 'component control', visible: false }),
    part(ComponentStatesControl, { name: 'component states control', visible: false }),
    part(ResponsiveControl, { name: 'responsive control', visible: false }),
    part(BodyControl, { name: 'effects control', visible: false })
  ]
});

export { PropertiesPanel, BackgroundControl };
