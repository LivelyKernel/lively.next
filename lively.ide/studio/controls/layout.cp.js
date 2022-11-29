import { Morph, TilingLayout, component, without, ViewModel, part, add } from 'lively.morphic';
import { pt, rect, Rectangle, Color } from 'lively.graphics';
import { arr } from 'lively.lang';
import { connect, disconnect, once } from 'lively.bindings';
import {
  AddButton, DarkFlap, DarkThemeList, EnumSelector, PropertyLabel,
  LabeledCheckbox, DarkNumberIconWidget, PropertyLabelHovered
} from '../shared.cp.js';
import { PropertySection, PropertySectionModel } from './section.cp.js';

export class LayoutPreview extends Morph {
  static get properties () {
    return {
      defaultSpacing: { defaultValue: 2 },
      defaultPadding: { defaultValue: rect(3, 3, 0, 0) },
      activeComponent: {
        isComponent: true,
        get () { return this.getProperty('activeComponent') || MiniLayoutPreviewActive; } // eslint-disable-line no-use-before-define
      },
      inactiveComponent: {
        isComponent: true,
        get () { return this.getProperty('inactiveComponent') || MiniLayoutPreview; } // eslint-disable-line no-use-before-define
      }
    };
  }

  previewLayout (autoLayout) {
    // to prevent master obstruction
    (this.getSubmorphNamed('outer border') || this).layout = new TilingLayout({
      spacing: this.defaultSpacing,
      padding: this.defaultPadding,
      align: autoLayout.align,
      axisAlign: autoLayout.axisAlign,
      axis: autoLayout.axis,
      justifySubmorphs: autoLayout.justifySubmorphs,
      wrapSubmorphs: false
    });
    ['mini bar 1', 'mini bar 2', 'mini bar 3'].forEach(bar => {
      this.getSubmorphNamed(bar).rotation = autoLayout.axis === 'row' ? 0 : Math.PI / 2;
    });
  }

  async setActive (active) {
    this.master = active ? this.activeComponent : this.inactiveComponent;
  }
}

export class AutoLayoutControlModel extends PropertySectionModel {
  static get properties () {
    return {
      targetMorph: {},
      activeSectionComponent: {
        isComponent: true,
        get () {
          return this.getProperty('activeSectionComponent') || LayoutControl; // eslint-disable-line no-use-before-define
        }
      },
      buttonActiveComponent: {
        isComponent: true,
        get () {
          return this.getProperty('buttonActiveComponent') || PropertyLabelHovered; // eslint-disable-line no-use-before-define
        }
      },
      buttonInactiveComponent: {
        isComponent: true,
        get () {
          return this.getProperty('buttonInactiveComponent') || PropertyLabel; // eslint-disable-line no-use-before-define
        }
      },
      controlFlapComponent: {
        isComponent: true,
        get () {
          return this.getProperty('controlFlapComponent') || AutoLayoutAlignmentFlap; // eslint-disable-line no-use-before-define
        }
      },
      bindings: {
        get () {
          return [
            ...super.prototype.bindings,
            {
              target: 'mini layout preview', signal: 'onMouseDown', handler: 'openLayoutPopup'
            },
            { target: 'vertical', signal: 'onMouseDown', handler: 'setVerticalFlow' },
            { target: 'horizontal', signal: 'onMouseDown', handler: 'setHorizontalFlow' },
            { target: 'wrap submorphs checkbox', signal: 'clicked', handler: 'toggleWrapping' },
            { target: 'spacing input', signal: 'number', handler: 'confirm' },
            { target: 'total padding input', signal: 'number', handler: 'confirm' }
          ];
        }
      }
    };
  }

  focusOn (aMorph) {
    this.targetMorph = null;
    if (!aMorph.layout || aMorph.layout.name() !== 'Tiling') {
      this.deactivate();
      this.targetMorph = aMorph;
    } else {
      this.targetMorph = aMorph;
      this.activate();
    }
  }

  onRefresh (prop) {
    if (!prop || prop === 'targetMorph') this.update(prop);
  }

  update (prop) {
    this.withoutBindingsDo(() => {
      const {
        miniLayoutPreview, vertical, horizontal,
        spacingInput, totalPaddingInput, wrapSubmorphsCheckbox
      } = this.ui;
      miniLayoutPreview.setActive(!!this.popup);
      if (!this.targetMorph) return;
      const layout = this.targetMorph.layout;
      if (!layout) return;
      miniLayoutPreview.previewLayout(layout);
      vertical.master = layout.axis === 'column' ? this.buttonActiveComponent : this.buttonInactiveComponent;
      horizontal.master = layout.axis === 'row' ? this.buttonActiveComponent : this.buttonInactiveComponent;
      spacingInput.number = layout.spacing;
      if (this.hasMixedPadding()) {
        totalPaddingInput.getSubmorphNamed('value').textString = 'Mix';
      } else {
        totalPaddingInput.number = layout.padding.top();
      }
      wrapSubmorphsCheckbox.setChecked(layout.wrapSubmorphs);
    });
  }

  confirm () {
    const layout = this.targetMorph.layout;
    const { spacingInput, totalPaddingInput } = this.ui;
    this.targetMorph.layout = layout.with({
      padding: Rectangle.inset(totalPaddingInput.number),
      spacing: spacingInput.number
    });
  }

  toggleWrapping () {
    const layout = this.targetMorph.layout;
    this.targetMorph.layout = layout.with({ wrapSubmorphs: !layout.wrapSubmorphs });
    this.update('wrapping');
  }

  setVerticalFlow () {
    this.targetMorph.layout = this.targetMorph.layout.with({ axis: 'column' });
    this.update();
  }

  setHorizontalFlow () {
    this.targetMorph.layout = this.targetMorph.layout.with({ axis: 'row' });
    this.update();
  }

  hasMixedPadding () {
    const padding = this.targetMorph.layout.padding;
    return arr.uniq(['left', 'top', 'right', 'bottom'].map(side => padding[side]())).length > 1;
  }

  activate () {
    super.activate();
    this.ui.controls.visible = true;
    this.ui.wrapSubmorphsCheckbox.visible = true;
    this.view.master = this.activeSectionComponent;

    const layout = this.targetMorph && this.targetMorph.layout;
    if (!layout || layout.name() !== 'Tiling') { this.targetMorph.layout = new TilingLayout(); }
    this.update();
    
    const propertiesPanel = this.view.ownerChain().find(m => m.isPropertiesPanel)
    if (propertiesPanel) propertiesPanel.viewModel.ui.shapeControl.refreshFromTarget();
  }

  deactivate () {
    super.deactivate();
    this.ui.controls.visible = false;
    this.ui.wrapSubmorphsCheckbox.visible = false;
    this.view.master = { auto: this.inactiveSectionComponent, hover: this.hoverSectionComponent };

    if (this.targetMorph && this.targetMorph.layout) {
      const layoutableSubmorphs = this.targetMorph.layout.layoutableSubmorphs;
      this.targetMorph.layout = null;
      layoutableSubmorphs.forEach(m => m.position = m.position);
    }
    this.popup = false;
    
    const propertiesPanel = this.view.ownerChain().find(m => m.isPropertiesPanel)
    if (propertiesPanel) propertiesPanel.viewModel.ui.shapeControl.refreshFromTarget();
  }

  async openLayoutPopup () {
    if (this.popup) return;
    // fixme: How to make this parametrizable?
    const p = this.popup = part(this.controlFlapComponent, { viewModel: { targetMorph: this.targetMorph } });
    connect(p.viewModel, 'update', this, 'update');
    once(p.viewModel, 'close', this, 'closePopup');
    p.openInWorld();
    p.topRight = this.ui.miniLayoutPreview.globalBounds().bottomRight().addXY(0, 2);
    p.topLeft = this.world().visibleBounds().translateForInclusion(p.globalBounds()).topLeft();
    p.opacity = 0;
    await p.whenRendered();
    p.start();
    p.opacity = 1;
    p.viewModel.update();
  }

  closePopup () {
    this.popup.close();
    this.popup = null;
    this.update();
  }
}

export class AutoLayoutAlignmentFlapModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      isHaloItem: { defaultValue: true },
      expose: {
        get () {
          return ['start', 'close', 'update', 'isHaloItem'];
        }
      },
      bindings: {
        get () {
          return [
            ...['top', 'right', 'bottom', 'left'].map(side => ({
              target: 'padding ' + side, signal: 'number', handler: 'confirm'
            })),
            { model: 'spacing selector', signal: 'selection', handler: 'changeMorphSpacing' },
            { target: 'spacing preview', signal: 'onMouseMove', handler: 'showLayoutPreview' },
            { target: 'spacing preview', signal: 'onHoverOut', handler: 'clearLayoutPreview' },
            { target: 'spacing preview', signal: 'onMouseDown', handler: 'setAlignmentConfig' }
          ];
        }
      }
    };
  }

  confirm () {
    const {
      paddingTop, paddingRight, paddingBottom, paddingLeft
    } = this.ui;
    const layout = this.targetMorph.layout;
    this.targetMorph.layout = layout.with({
      padding: Rectangle.inset(paddingLeft.number,
        paddingTop.number,
        paddingRight.number,
        paddingBottom.number)
    });
  }

  changeMorphSpacing () {
    const {
      spacingSelector
    } = this.ui;
    const layout = this.targetMorph.layout;
    this.targetMorph.layout = layout.with({
      justifySubmorphs: spacingSelector.selection
    });
    this.update();
  }

  update () {
    this.withoutBindingsDo(() => {
      const {
        paddingTop, paddingRight, paddingBottom,
        paddingLeft, containerPlaceholder,
        spacingSelector
      } = this.ui;
      const layout = this.targetMorph.layout;
      paddingTop.number = layout.padding.top();
      paddingRight.number = layout.padding.right();
      paddingBottom.number = layout.padding.bottom();
      paddingLeft.number = layout.padding.left();
      spacingSelector.selection = layout.justifySubmorphs;
      containerPlaceholder.previewLayout(layout);
    });
  }

  setAlignmentConfig (evt) {
    const layout = this.targetMorph.layout;
    const { spacingPreview } = this.ui;
    this.targetMorph.layout = layout.with({
      align: spacingPreview.layout.align,
      axisAlign: spacingPreview.layout.axisAlign
    });
    this.update();
  }

  showLayoutPreview (evt) {
    const { spacingPreview } = this.ui;
    const layout = this.targetMorph.layout;
    spacingPreview.opacity = 0.3;

    let pos = evt.positionIn(spacingPreview);
    if (layout.axis === 'row') pos = pt(pos.y, pos.x);

    let align = 'left';
    if (pos.y > spacingPreview.height / 3) align = 'center';
    if (pos.y > spacingPreview.height * 2 / 3) align = 'right';
    let axisAlign = 'left';
    if (pos.x > spacingPreview.width / 3) axisAlign = 'center';
    if (pos.x > spacingPreview.width * 2 / 3) axisAlign = 'right';
    spacingPreview.previewLayout(layout.with({
      align,
      axisAlign
    }));
  }

  clearLayoutPreview () {
    this.ui.spacingPreview.opacity = 0;
  }

  start () {
    connect($world, 'onMouseDown', this, 'closeIfClickedOutside');
  }

  closeIfClickedOutside (evt) {
    if (![evt.targetMorph, ...evt.targetMorph.ownerChain()].find(m => m === this.view || m.isList)) {
      this.close();
    }
  }

  close () {
    this.view.remove();
    disconnect($world, 'onMouseDown', this, 'closeIfClickedOutside');
  }
}

// PaddingInput.openInWorld()
const PaddingInput = component(DarkNumberIconWidget, {
  name: 'padding input',
  layout: new TilingLayout({
    axisAlign: 'center',
    align: 'center',
    axis: 'row'
  }),
  unit: '',
  min: 0,
  autofit: false,
  extent: pt(33.7, 22.7),
  position: pt(57.3, 1.9),
  submorphs: [
    without('up'),
    without('down'),
    without('interactive label'), {
      name: 'value',
      textAlign: 'center',
      min: 0,
      padding: rect(0, 2, 0, -2)
    }]
});

// PaddingInputHovered.openInWorld()
const PaddingInputHovered = component(PaddingInput, {
  name: 'padding input hovered',
  borderWidth: 1
});

const LayoutSimulator = component({
  type: LayoutPreview,
  defaultSpacing: 5,
  defaultPadding: rect(5, 5, 0, 0),
  name: 'layout simulator',
  layout: new TilingLayout({
    align: 'right',
    orderByIndex: true,
    padding: rect(5, 5, 0, 0),
    spacing: 5
  }),
  borderColor: Color.rgb(176, 190, 197),
  borderWidth: 1,
  extent: pt(65.1, 65.1),
  fill: Color.rgba(0, 0, 0, 0),
  position: pt(44.6, 34.9),
  submorphs: [{
    name: 'mini bar 1',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 5,
    extent: pt(5.1, 19.9),
    fill: Color.rgb(178, 235, 242),
    position: pt(5.1, 6.1)
  }, {
    name: 'mini bar 2',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 5,
    extent: pt(5.1, 24.9),
    fill: Color.rgb(178, 235, 242),
    position: pt(49.1, 16)
  }, {
    name: 'mini bar 3',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 5,
    extent: pt(5.1, 14.9),
    fill: Color.rgb(178, 235, 242),
    position: pt(34.5, 32.7)
  }]
});

const MiniLayoutPreview = component({
  type: LayoutPreview,
  extent: pt(22, 22),
  name: 'mini layout preview',
  tooltip: 'Configure Layout',
  borderRadius: 2,
  fill: Color.transparent,
  nativeCursor: 'pointer',
  submorphs: [{
    name: 'outer border',
    layout: new TilingLayout({
      spacing: 4,
      padding: Rectangle.inset(3)
    }),
    reactsToPointer: false,
    borderColor: Color.rgb(176, 190, 197),
    borderRadius: 2,
    borderWidth: 1,
    extent: pt(18, 18),
    fill: Color.rgba(0, 0, 0, 0),
    position: pt(2, 2),
    submorphs: [{
      reactsToPointer: false,
      name: 'mini bar 1',
      fill: Color.rgb(176, 190, 197),
      extent: pt(1, 5),
      position: pt(10, 10)
    }, {
      reactsToPointer: false,
      name: 'mini bar 2',
      fill: Color.rgb(176, 190, 197),
      extent: pt(1, 10),
      position: pt(5.6, 7.7)
    }, {
      reactsToPointer: false,
      name: 'mini bar 3',
      fill: Color.rgb(176, 190, 197),
      extent: pt(1, 7.5),
      position: pt(15.5, 8.7)
    }]
  }]
});

// MiniLayoutPreviewActive.openInWorld()
const MiniLayoutPreviewActive = component(MiniLayoutPreview, {
  name: 'mini layout preview active',
  fill: Color.rgb(178, 235, 242),
  submorphs: [{
    name: 'outer border',
    borderColor: Color.rgb(66, 73, 73),
    submorphs: [
      {
        name: 'mini bar 1',
        fill: Color.rgb(66, 73, 73)
      },
      {
        name: 'mini bar 2',
        fill: Color.rgb(66, 73, 73)
      },
      {
        name: 'mini bar 3',
        fill: Color.rgb(66, 73, 73)
      }]
  }]
});
// LayoutControl.openInWorld()
// part(LayoutControl).openInWorld()
const LayoutControl = component(PropertySection, {
  defaultViewModel: AutoLayoutControlModel,
  name: 'layout control',
  extent: pt(248.9, 131),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Auto Layout', null]
    }]
  }, add({
    name: 'controls',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(250.1, 31),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      axisAlign: 'center',
      orderByIndex: true,
      spacing: 5,
      padding: Rectangle.inset(20, 0, 0, 0),
      wrapSubmorphs: false
    }),
    submorphs: [
      part(AddButton, {
        master: { auto: AddButton, hover: PropertyLabelHovered },
        name: 'vertical',
        tooltip: 'Position Items Vertically',
        textAndAttributes: ['', null],
        fontSize: 14,
        padding: rect(4, 4, 0, 0)
      }),
      part(AddButton, {
        master: { auto: AddButton, hover: PropertyLabelHovered },
        name: 'horizontal',
        tooltip: 'Position Items Horizontally',
        fontSize: 14,
        textAndAttributes: ['', null],
        padding: rect(4, 4, 0, 0)
      }),
      part(DarkNumberIconWidget, {
        name: 'spacing input',
        width: 60,
        min: 0,
        tooltip: 'Spacing between Items',
        submorphs: [{
          name: 'interactive label',
          fontSize: 14,
          textAndAttributes: ['', null]
        }]
      }),
      part(DarkNumberIconWidget, {
        name: 'total padding input',
        width: 60,
        min: 0,
        tooltip: 'Padding between Container and Items',
        submorphs: [{
          name: 'interactive label',
          fontSize: 14,
          textAndAttributes: ['', null]
        }]
      }), part(MiniLayoutPreview, { name: 'mini layout preview' })

    ]
  }), add(part(LabeledCheckbox, {
    name: 'wrap submorphs checkbox',
    submorphs: [{
      name: 'prop label',
      textAndAttributes: ['Wrap Items', null]
    }]
  }))]
});

const AutoLayoutAlignmentFlap = component(DarkFlap, {
  defaultViewModel: AutoLayoutAlignmentFlapModel,
  name: 'auto layout alignment control',
  layout: new TilingLayout({
    orderByIndex: true,
    hugContentsVertically: true,
    resizeSubmorphs: true,
    padding: 10
  }),
  extent: pt(175.7, 201),
  submorphs: [
    add({
      name: 'padding and spacing',
      epiMorph: true,
      reactsToPointer: false,
      fill: Color.rgba(255, 255, 255, 0),
      extent: pt(156, 136.5),
      submorphs: [
        part(LayoutSimulator, { name: 'container placeholder' }),
        part(LayoutSimulator, {
          name: 'spacing preview',
          borderColor: Color.transparent,
          opacity: 0
        }),
        part(PaddingInput, {
          master: { auto: PaddingInput, hover: PaddingInputHovered },
          name: 'padding top',
          position: pt(61.1, 0),
          tooltip: 'Padding Top',
          submorphs: [{
            name: 'value',
            padding: rect(0, 2, 0, -2)
          }]
        }),
        part(PaddingInput, {
          name: 'padding bottom',
          master: { auto: PaddingInput, hover: PaddingInputHovered },
          position: pt(61.2, 110.3),
          tooltip: 'Padding Bottom',
          submorphs: [{
            name: 'value',
            padding: rect(0, 2, 0, -2)
          }]
        }),
        part(PaddingInput, {
          name: 'padding left',
          master: { auto: PaddingInput, hover: PaddingInputHovered },
          position: pt(0, 56.9),
          tooltip: 'Padding Left',
          submorphs: [{
            name: 'value',
            padding: rect(0, 2, 0, -2)
          }]
        }),
        part(PaddingInput, {
          name: 'padding right',
          master: { auto: PaddingInput, hover: PaddingInputHovered },
          position: pt(122.3, 56.9),
          tooltip: 'Padding Right',
          submorphs: [{
            name: 'value',
            padding: rect(0, 2, 0, -2)
          }]
        })]
    }),
    add(part(EnumSelector, {
      name: 'spacing selector',
      extent: pt(165, 23.3),
      tooltip: 'Select Spacing of Items',
      viewModel: {
        openListInWorld: true,
        listMaster: DarkThemeList,
        items: [
          { string: 'Packed', value: 'packed', isListItem: true },
          { string: 'Space between', value: 'spaced', isListItem: true }
        ],
        listAlign: 'selection'
      }
    }))
  ]
});

const GridLayoutControl = component(PropertySection, {
  name: 'grid layout control',
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Grid Layout', null]
    }]
  }]
});

export { MiniLayoutPreviewActive, MiniLayoutPreview, GridLayoutControl, LayoutControl, AutoLayoutAlignmentFlap };
