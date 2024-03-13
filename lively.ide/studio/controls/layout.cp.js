import { Morph, TilingLayout, component, without, ViewModel, part, add } from 'lively.morphic';
import { pt, rect, Rectangle, Color } from 'lively.graphics';
import { arr } from 'lively.lang';
import { epiConnect, signal, disconnect, once } from 'lively.bindings';
import {
  AddButton, PropLabel, DarkFlap, DarkThemeList, EnumSelector, PropertyLabel,
  DarkNumberIconWidget, PropertyLabelHovered
} from '../shared.cp.js';
import { PropertySection, PropertySectionModel } from './section.cp.js';
import { LabeledCheckbox } from 'lively.components';

export class LayoutPreview extends Morph {
  static get properties () {
    return {
      defaultSpacing: { defaultValue: 2 },
      defaultPadding: { defaultValue: rect(3, 3, 0, 0) }
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
      justifySubmorphs: autoLayout.justifySubmorphs
    });
    ['mini bar 1', 'mini bar 2', 'mini bar 3'].forEach(bar => {
      this.getSubmorphNamed(bar).rotation = autoLayout.axis === 'row' ? 0 : Math.PI / 2;
    });
  }

  async setActive (active) {
    this.master.setState(active ? 'active' : null);
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
            { target: 'mini layout preview', signal: 'onMouseDown', handler: 'openLayoutPopup' },
            { target: 'vertical', signal: 'onMouseDown', handler: 'setVerticalFlow' },
            { target: 'horizontal', signal: 'onMouseDown', handler: 'setHorizontalFlow' },
            { target: 'wrap submorphs checkbox', signal: 'checked', handler: 'toggleWrapping' },
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
    if (!prop || prop === 'targetMorph') this.update();
  }

  update () {
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
      vertical.master.setState(layout.axis === 'column' ? 'active' : null);
      horizontal.master.setState(layout.axis === 'row' ? 'active' : null);
      spacingInput.number = layout.spacing;
      if (this.hasMixedPadding()) {
        totalPaddingInput.setMixed();
      } else {
        totalPaddingInput.number = layout.padding.top();
      }
      wrapSubmorphsCheckbox.checked = layout.wrapSubmorphs;
    });
  }

  confirm () {
    const layout = this.targetMorph.layout;
    const { spacingInput, totalPaddingInput } = this.ui;
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      let changes = {
        spacing: spacingInput.number
      };
      if (!totalPaddingInput.isMixed) {
        changes.padding = Rectangle.inset(totalPaddingInput.number);
      }
      this.targetMorph.layout = layout.with(changes);
    });
    this.targetMorph.world()?.sceneGraph?.refresh();
  }

  toggleWrapping () {
    const layout = this.targetMorph.layout;
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.layout = layout.with({ wrapSubmorphs: !layout.wrapSubmorphs });
    });
    this.update('wrapping');
  }

  setVerticalFlow () {
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.layout = this.targetMorph.layout.with({ axis: 'column' });
    });
    this.update();
    const sceneGraph = this.world().sceneGraph;
    if (sceneGraph) sceneGraph.refresh();
  }

  setHorizontalFlow () {
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.layout = this.targetMorph.layout.with({ axis: 'row' });
    });
    this.update();
    const sceneGraph = this.world().sceneGraph;
    if (sceneGraph) sceneGraph.refresh();
  }

  hasMixedPadding () {
    const padding = this.targetMorph.layout.padding;
    return arr.uniq(['left', 'top', 'right', 'bottom'].map(side => padding[side]())).length > 1;
  }

  activate () {
    const { controls, wrapCheckboxWrapper } = this.ui;
    super.activate();
    controls.visible = true;
    wrapCheckboxWrapper.visible = true;

    this.view.master.setState(null);

    const layout = this.targetMorph && this.targetMorph.layout;
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      if (!layout || layout.name() !== 'Tiling') { this.targetMorph.layout = new TilingLayout(); }
    });
    this.update();
    this.targetMorph.world()?.sceneGraph?.refresh();
    signal(this.view, 'layout changed');
  }

  deactivate () {
    const { controls, wrapCheckboxWrapper } = this.ui;
    super.deactivate();
    this.view.master.setState('inactive');
    controls.visible = false;
    wrapCheckboxWrapper.visible = false;

    if (this.targetMorph && this.targetMorph.layout) {
      const layoutableSubmorphs = this.targetMorph.layout.layoutableSubmorphs;
      this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
        this.targetMorph.layout = undefined;
        layoutableSubmorphs.forEach(m => m.position = m.position);
      });
      this.targetMorph.world()?.sceneGraph?.refresh();
    }
    this.popup = false;

    signal(this.view, 'layout changed');
  }

  async openLayoutPopup () {
    if (this.popup) return;
    // FIXME: How to make this parametrizable?
    const p = this.popup = part(this.controlFlapComponent, { viewModel: { targetMorph: this.targetMorph } });
    epiConnect(p, 'update', this, 'update');
    once(p, 'close', this, 'closePopup');
    p.openInWorld();
    p.topRight = this.ui.miniLayoutPreview.globalBounds().bottomRight().addXY(0, 2);
    p.topLeft = this.world().visibleBounds().translateForInclusion(p.globalBounds()).topLeft();
    p.start();
    p.update();
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
            { target: 'spacing selector', signal: 'selection', handler: 'confirm' },
            { target: 'spacing preview', signal: 'onMouseMove', handler: 'showLayoutPreview' },
            { target: 'spacing preview', signal: 'onHoverOut', handler: 'clearLayoutPreview' },
            { target: 'spacing preview', signal: 'onMouseDown', handler: 'confirm' }
          ];
        }
      }
    };
  }

  confirm () {
    const {
      paddingTop, paddingRight, paddingBottom, paddingLeft,
      spacingSelector, spacingPreview
    } = this.ui;
    const layout = this.targetMorph.layout;
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.layout = layout.with({
        justifySubmorphs: spacingSelector.selection,
        align: spacingPreview.layout?.align || layout.align,
        axisAlign: spacingPreview.layout?.axisAlign || layout.axisAlign,
        padding: Rectangle.inset(paddingLeft.number,
          paddingTop.number,
          paddingRight.number,
          paddingBottom.number)
      });
    });
    this.ui.containerPlaceholder.previewLayout(this.targetMorph.layout);
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
    signal(this.view, 'update');
  }

  showLayoutPreview (evt) {
    if (evt.state.draggedMorph) return;
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
    this.ui.spacingPreview.layout = null;
  }

  start () {
    epiConnect($world, 'onMouseDown', this, 'closeIfClickedOutside');
  }

  closeIfClickedOutside (evt) {
    if (![evt.targetMorph, ...evt.targetMorph.ownerChain()].find(m => m === this.view || m.isList)) {
      this.close();
    }
  }

  close () {
    signal(this.view, 'close');
    this.view.remove();
    disconnect($world, 'onMouseDown', this, 'closeIfClickedOutside');
  }
}

// PaddingInput.openInWorld()
const PaddingInput = component(DarkNumberIconWidget, {
  name: 'padding input',
  layout: new TilingLayout({
    axisAlign: 'center',
    align: 'center'
  }),
  viewModel: {
    unit: '',
    min: 0,
    autofit: false
  },
  extent: pt(33.7, 22.7),
  position: pt(57.3, 1.9),
  submorphs: [
    without('button holder'),
    without('interactive label'), {
      name: 'value',
      textAlign: 'center',
      padding: rect(0, 2, 0, -2)
    }]
});

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

const LayoutControl = component(PropertySection, {
  defaultViewModel: AutoLayoutControlModel,
  name: 'layout control',
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(0, 10, 0, 0),
    resizePolicies: [['h floater', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 3
  }),
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
      padding: Rectangle.inset(20, 0, 0, 0)
    }),
    submorphs: [
      part(AddButton, {
        master: { states: { active: PropertyLabelHovered } },
        name: 'vertical',
        tooltip: 'Position Items Vertically',
        textAndAttributes: ['', null],
        fontSize: 14,
        padding: rect(4, 4, 0, 0)
      }),
      part(AddButton, {
        master: { states: { active: PropertyLabelHovered } },
        name: 'horizontal',
        tooltip: 'Position Items Horizontally',
        fontSize: 14,
        textAndAttributes: ['', null],
        padding: rect(4, 4, 0, 0)
      }),
      part(DarkNumberIconWidget, {
        name: 'spacing input',
        width: 60,
        viewModel: { min: 0 },
        tooltip: 'Spacing between Items',
        submorphs: [{
          name: 'interactive label',
          fontSize: 14,
          tooltip: 'Spacing between elements.',
          textAndAttributes: ['', null]
        }]
      }),
      part(DarkNumberIconWidget, {
        name: 'total padding input',
        width: 60,
        viewModel: { min: 0 },
        tooltip: 'Padding between Container and Items',
        submorphs: [{
          name: 'interactive label',
          fontSize: 14,
          tooltip: 'Padding distance of elements to the container.',
          textAndAttributes: ['', null]
        }]
      }), part(MiniLayoutPreview, {
        master: { states: { active: MiniLayoutPreviewActive } },
        name: 'mini layout preview',
        tooltip: 'Alignment controls.'
      })

    ]
  }), add({
    name: 'wrap checkbox wrapper',
    extent: pt(250.0000, 20.0000),
    fill: Color.transparent,
    layout: new TilingLayout({
      axisAlign: 'center',
      orderByIndex: true
    }),
    submorphs: [{
      name: 'spacer',
      fill: Color.rgba(255, 255, 255, 0),
      borderColor: Color.rgba(23, 160, 251, 0),
      borderWidth: 1,
      extent: pt(20.0000, 30.0000)
    }, part(LabeledCheckbox, {
      name: 'wrap submorphs checkbox',
      viewModel: { label: 'Wrap Items' },
      submorphs: [
        {
          name: 'label',
          master: PropLabel
        }]
    })
    ]
  })]
});

const AutoLayoutAlignmentFlap = component(DarkFlap, {
  defaultViewModel: AutoLayoutAlignmentFlapModel,
  name: 'auto layout alignment control',
  layout: new TilingLayout({
    wrapSubmorphs: true,
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
          master: { hover: PaddingInputHovered },
          name: 'padding top',
          position: pt(61.1, 0),
          tooltip: 'Padding Top',
          submorphs: [{
            name: 'value',
            fontSize: 14,
            padding: rect(0, 2, 0, -2)
          }]
        }),
        part(PaddingInput, {
          name: 'padding bottom',
          master: { hover: PaddingInputHovered },
          position: pt(61.2, 110.3),
          tooltip: 'Padding Bottom',
          submorphs: [{
            name: 'value',
            fontSize: 14,
            padding: rect(0, 2, 0, -2)
          }]
        }),
        part(PaddingInput, {
          name: 'padding left',
          master: { hover: PaddingInputHovered },
          position: pt(0, 56.9),
          tooltip: 'Padding Left',
          submorphs: [{
            name: 'value',
            fontSize: 14,
            padding: rect(0, 2, 0, -2)
          }]
        }),
        part(PaddingInput, {
          name: 'padding right',
          master: { hover: PaddingInputHovered },
          position: pt(122.3, 56.9),
          tooltip: 'Padding Right',
          submorphs: [{
            name: 'value',
            fontSize: 14,
            padding: rect(0, 2, 0, -2)
          }]
        })]
    }),
    add(part(EnumSelector, {
      name: 'spacing selector',
      extent: pt(155, 23),
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
