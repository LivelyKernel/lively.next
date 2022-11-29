import { PropertySection } from './section.cp.js';
import { TilingLayout, ConstraintLayout, Label, component, ViewModel, part, add, without } from 'lively.morphic';
import { Rectangle, rect, pt, Color } from 'lively.graphics';
import { EnumSelector, DarkThemeList } from '../shared.cp.js';
import { signal } from 'lively.bindings';

const FIXED_ICON = '\uea16';

/*
 * Depending on the morph provides controls to configure the resizing behavior of a morph
 * inside a TilingLayout or the constraints of a morph controlled by a ConstraintLayout
 * or plain morph.
 */
export class ConstraintsManagerModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      bindings: {
        get () {
          return [
            { model: 'constraints', signal: 'changed', handler: 'updateConstraintPolicies' }
          ];
        }
      }
    };
  }

  focusOn (aMorph) {
    this.targetMorph = aMorph;
    this.update();
  }

  /*
   * Ensure that the proportional layout is present in the owner of the focused morph.
   * This is nessecary to reify the constraints.
   */
  ensureLayout (x, y) {
    // skip if owner is world morph
    if (!this.targetMorph) return;
    const owner = this.targetMorph.owner;
    if (owner.isWorld) return;
    if (!owner.layout && (x !== 'fixed' || y !== 'fixed')) {
      owner.layout = new ConstraintLayout({
        submorphSettings: owner.submorphs.map(m => [m.name, { x: 'fixed', y: 'fixed' }])
      });
    }
    return owner.layout;
  }

  /**
   * Refresh the UI to reflect the currently stored shadow value.
   */
  update () {
    const target = this.targetMorph;
    const owner = target.owner;
    this.view.visible = false;
    if ((!owner.layout || owner.layout.name() === 'Proportional') ||
       (target.layout && target.layout.name() === 'Tiling')) {
      this.view.visible = true;
    }
    if (this.view.visible) this.refreshConstraints();
  }

  /**
   * Refresh the UI of the constraint controls based on the configuration
   * of the currently focused morph.
   */
  refreshConstraints () {
    const { constraints } = this.models;
    const { layout } = this.targetMorph.owner;
    if (!layout) {
      // display fixed height and left
      constraints.verticalConstraint = 'fixed';
      constraints.horizontalConstraint = 'fixed';
      return;
    }
    if (layout.name() === 'Constraint') {
      const policy = layout.settingsFor(this.targetMorph);
      constraints.verticalConstraint = policy.y;
      constraints.horizontalConstraint = policy.x;
    }
  }

  /**
   * Update the current morph's resizing policy inside the ConstraintLayout
   * that controls the morph.
   */
  updateConstraintPolicies () {
    const { constraints } = this.models;
    const { horizontalConstraint, verticalConstraint } = constraints;
    const layout = this.ensureLayout(horizontalConstraint, verticalConstraint);
    if (!layout) return;
    layout.changeSettingsFor(this.targetMorph, {
      x: horizontalConstraint,
      y: verticalConstraint
    });
  }
}

/**
 * Control the position/resize constraints of a morph inside a morph without any layout
 * or a morph with a ConstraintLayout.
 * A constraint is a policy that dictates how the different sides of a morph relate to its
 * owner morph frame.
 * This controller automatically creates ConstraintLayouts as needed to reify the constraints.
 */
export class ConstraintsControlModel extends ViewModel {
  static get properties () {
    return {
      verticalConstraint: { defaultValue: 'fixed' },
      horizontalConstraint: { defaultValue: 'fixed' },
      activeMarkerComponent: {
        isComponent: true,
        get () { return this.getProperty('activeMarkerComponent') || ConstraintMarkerActive; } // eslint-disable-line no-use-before-define
      },
      defaultMarkerComponent: {
        isComponent: true,
        get () { return this.getProperty('defaultMarkerComponent') || ConstraintMarker; } // eslint-disable-line no-use-before-define
      },
      bindings: {
        get () {
          return [
            { model: 'horizontal alignment selector', signal: 'selection', handler: 'selectHorizontalConstraint' },
            { model: 'vertical alignment selector', signal: 'selection', handler: 'selectVerticalConstraint' },
            { target: 'constraints simulator', signal: 'onMouseDown', handler: 'onMarkerClicked' }
          ];
        }
      }
    };
  }

  onRefresh (prop) {
    this.clearAllMarkers();
    const {
      topMarker, bottomMarker, verticalMarker,
      verticalAlignmentSelector
    } = this.ui;

    const ActiveMarker = this.activeMarkerComponent;

    verticalAlignmentSelector.selection = this.verticalConstraint;
    switch (this.verticalConstraint) {
      case 'scale':
        break; // this is not visualized
      case 'move':
        bottomMarker.master = ActiveMarker;
        break;
      case 'fixed':
        topMarker.master = ActiveMarker;
        break;
      case 'resize':
        topMarker.master = ActiveMarker;
        bottomMarker.master = ActiveMarker;
        break;
      case 'center':
        verticalMarker.master = ActiveMarker;
        break;
    }
    const {
      leftMarker, rightMarker, horizontalMarker,
      horizontalAlignmentSelector
    } = this.ui;

    horizontalAlignmentSelector.selection = this.horizontalConstraint;
    switch (this.horizontalConstraint) {
      case 'scale':
        break; // this is not visualized
      case 'move':
        rightMarker.master = ActiveMarker;
        break;
      case 'fixed':
        leftMarker.master = ActiveMarker;
        break;
      case 'resize':
        leftMarker.master = ActiveMarker;
        rightMarker.master = ActiveMarker;
        break;
      case 'center':
        horizontalMarker.master = ActiveMarker;
        break;
    }
  }

  clearAllMarkers () {
    const MarkerDefault = this.defaultMarkerComponent;
    this.view.getAllNamed(/marker/).forEach(m => {
      m.master = MarkerDefault;
    });
  }

  /**
   * Configures the vertical constraint behavior of a morph. This applies when
   * the morph is controlled by a ConstraintLayout.
   * The following constraint behaviors are supported (By the ConstraintLayout):
   *  scale: this scales the morph along the vertial direction when the container resizes.
   *  move: this moves the morph along the vertical direction when the container resizes. (Also known as Bottom)
   *  fixed: this leaves the morph at a fixed vertical offset when the container resizes. (Also known as Top)
   *  resize: this resizes the morph by the same amount that the container resizes (Also known as Top and Botton)
   *  center: this moves the morph vertically via its relative center to the container as the container resizes.
   *
   * @params {("scale"|"move"|"fixed"|"resize"|"center")} behavior - The behavior for the vertical constraints of
   *                                                                 the morph controlled by the proportional layout.
   */
  selectVerticalConstraint (behavior) {
    if (behavior) this.verticalConstraint = behavior;
    signal(this, 'changed');
  }

  /**
   * Same as setlectVerticalConstraint() but for horizontal direction.
   *
   * @params {("scale"|"move"|"fixed"|"resize"|"center")} behavior - The behavior for the vertical constraints of
   *                                                                 the morph controlled by the proportional layout.
   */
  selectHorizontalConstraint (behavior) {
    if (behavior) this.horizontalConstraint = behavior;
    signal(this, 'changed');
  }

  onMarkerClicked (evt) {
    const markerName = evt.targetMorph.name;
    if (markerName.endsWith('marker')) {
      // send the signal accordingly
      this.selectVerticalConstraint(({
        'top marker': 'fixed',
        'bottom marker': 'move',
        'vertical marker': 'center'
      })[markerName]);
      this.selectHorizontalConstraint(({
        'left marker': 'fixed',
        'right marker': 'move',
        'horizontal marker': 'center'
      })[markerName]);
    }
  }
}

const Plain = component({ name: 'plain', extent: pt(10, 14), fill: Color.transparent, nativeCursor: 'pointer' });
const Hovered = component({ name: 'marked', extent: pt(10, 14), fill: Color.rgba(128, 216, 255, 0.5), nativeCursor: 'pointer' });

const ConstraintMarker = component({
  name: 'constraint marker',
  master: { auto: Plain, hover: Hovered },
  nativeCursor: 'pointer',
  extent: pt(10, 14),
  fill: Color.transparent,
  submorphs: [{
    name: 'accent',
    reactsToPointer: false,
    position: pt(4, 2),
    extent: pt(2, 10),
    borderColor: Color.rgb(178, 235, 242),
    fill: Color.rgb(176, 190, 197)
  }]
});

// part(ConstraintMarkerActive).openInWorld();
const ConstraintMarkerActive = component(ConstraintMarker, {
  name: 'constraint marker active',
  submorphs: [{
    name: 'accent',
    position: pt(2.5, 2),
    fill: Color.rgb(178, 235, 242),
    borderWidth: 1.5
  }]
});

// ConstraintsSimulator.openInWorld()
// fixme: Think about parametrizing components via component definition/policy
const ConstraintsSimulator = component({
  name: 'constraints simulator',
  borderColor: Color.darkGray,
  borderWidth: 1,
  extent: pt(75, 75),
  fill: Color.rgba(0, 0, 0, 0),
  position: pt(1.3, 12.1),
  submorphs: [
    part(ConstraintMarker, {
      name: 'top marker',
      tooltip: 'Resize with Top Border',
      position: pt(32.9, 4.4)
    }), part(ConstraintMarker, {
      name: 'right marker',
      tooltip: 'Resize with Right Border',
      rotation: Math.PI / 2,
      position: pt(71.6, 33.4)
    }), part(ConstraintMarker, {
      name: 'bottom marker',
      tooltip: 'Resize with Bottom Border',
      position: pt(31.7, 57.5)
    }), part(ConstraintMarker, {
      name: 'left marker',
      rotation: Math.PI / 2,
      position: pt(17, 32.8)
    }), {
      name: 'inner constraints',
      borderWidth: 1,
      borderColor: Color.rgb(176, 190, 197),
      extent: pt(35, 35),
      fill: Color.transparent,
      position: pt(20, 20),
      submorphs: [part(ConstraintMarker, {
        name: 'vertical marker',
        tooltip: 'Proportionally Fix Center Vertically',
        height: 19,
        position: pt(13.3, 9.1),
        submorphs: [{ name: 'accent', height: 15 }]
      }), part(ConstraintMarker, {
        name: 'horizontal marker',
        tooltip: 'Proportionally Fix Center Horizontally',
        rotation: -1.5707963267948966,
        height: 19,
        position: pt(7.9, 22.7),
        submorphs: [{ name: 'accent', height: 15 }]
      })]
    }]
});

// ConstraintsControl.openInWorld()
const ConstraintsControl = component({
  defaultViewModel: ConstraintsControlModel,
  name: 'constraint controller',
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    justifySubmorphs: false,
    orderByIndex: true,
    padding: Rectangle.inset(20, 0, 0, 10),
    spacing: 10
  }),
  borderColor: Color.rgb(23, 160, 251),
  borderWidth: 0,
  extent: pt(229, 84.9),
  fill: Color.rgba(0, 0, 0, 0),
  submorphs: [
    part(ConstraintsSimulator, { name: 'constraints simulator' }),
    part(EnumSelector, {
      name: 'horizontal alignment selector',
      tooltip: 'Choose Horizontal Alignment',
      viewModel: {
        listMaster: DarkThemeList,
        listAlign: 'selection',
        openListInWorld: true,
        listHeight: 500,
        items: [
          { string: 'Left and Right', value: 'resize', isListItem: true },
          { string: 'Center', value: 'center', isListItem: true },
          { string: 'Left', value: 'fixed', isListItem: true },
          { string: 'Right', value: 'move', isListItem: true },
          { string: 'Scale', value: 'scale', isListItem: true }
        ]
      },
      clipMode: 'hidden', // fixme: avoids weird css layout isse
      extent: pt(128.8, 23.3),
      submorphs: [add({
        type: Label,
        name: 'interactive label',
        padding: rect(0, 0, 8, 0),
        rotation: -1.5707963267948966,
        fontColor: Color.white,
        textAndAttributes: [FIXED_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }]
      }, 'label'), {
        name: 'label',
        fontSize: 12
      }]
    }),
    part(EnumSelector, {
      name: 'vertical alignment selector',
      tooltip: 'Choose Vertical Alignment',
      viewModel: {
        listMaster: DarkThemeList,
        listAlign: 'selection',
        openListInWorld: true,
        listHeight: 500,
        items: [
          { string: 'Top and Bottom', value: 'resize', isListItem: true },
          { string: 'Center', value: 'center', isListItem: true },
          { string: 'Top', value: 'fixed', isListItem: true },
          { string: 'Bottom', value: 'move', isListItem: true },
          { string: 'Scale', value: 'scale', isListItem: true }
        ]
      },
      extent: pt(128.5, 23.3),
      clipMode: 'hidden', // fixme: avoids weird css layout isse
      submorphs: [add({
        type: Label,
        name: 'interactive label',
        padding: rect(0, 4, 10, -4),
        fontColor: Color.white,
        textAndAttributes: [FIXED_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }]
      }, 'label'), {
        name: 'label',
        fontSize: 12
      }]
    })]
});

// part(ConstraintSizeSelectorDefault).openInWorld()
const ConstraintSizeSelectorDefault = component({
  name: 'constraint size selector default',
  extent: pt(38.6, 10),
  clipMode: 'hidden',
  nativeCursor: 'pointer',
  fill: Color.transparent,
  layout: new TilingLayout({ wrapSubmorphs: false, axis: 'row', align: 'center', axisAlign: 'center' }),
  submorphs: [{
    type: Label,
    name: 'caret',
    reactsToPointer: false,
    fontColor: Color.rgb(176, 190, 197),
    padding: rect(3, 0, 0, 0),
    extent: pt(17, 17),
    position: pt(9.8, -2),
    borderRadius: 2,
    fontFamily: 'Material Icons',
    textAndAttributes: [
      '\ue5ce', { textStyleClasses: ['material-icons'], fontSize: 14 }
    ]
  }]
});

const ConstraintsManager = component(PropertySection, {
  defaultViewModel: ConstraintsManagerModel,
  name: 'constraints control',
  extent: pt(250.6, 145),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Constraints', null]
    }, without('add button')]
  },
  add(part(ConstraintsControl, { name: 'constraints' }))
  ]
});

export { ConstraintsManager, ConstraintsControl, ConstraintsSimulator, ConstraintSizeSelectorDefault, ConstraintMarker, ConstraintMarkerActive };
