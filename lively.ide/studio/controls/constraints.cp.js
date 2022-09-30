import { PropertySection } from './section.cp.js';
import { TilingLayout, ProportionalLayout, Label, component, ViewModel, part, add, without } from 'lively.morphic';
import { Rectangle, rect, pt, Color } from 'lively.graphics';
import { EnumSelector, DarkThemeList } from '../shared.cp.js';
import { signal } from 'lively.bindings';

const FILL_ICON = '\ue5d7';
const HUG_ICON = '\ue5d6';
const FIXED_ICON = '\uea16';

/*
 * Depending on the morph provides controls to configure the resizing behavior of a morph
 * inside a TilingLayout or the constraints of a morph controlled by a ProportionalLayout
 * or plain morph.
 */
export class AlignmentManager extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      bindings: {
        get () {
          return [
            { model: 'resizing', signal: 'changed', handler: 'updateResizingPolicies' },
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
      owner.layout = new ProportionalLayout({
        submorphSettings: owner.submorphs.map(m => [m.name, { x: 'fixed', y: 'fixed' }])
      });
    }
    return owner.layout;
  }

  /**
   * Refresh the UI to reflect the currently stored shadow value.
   */
  update () {
    let title;
    const { resizing, constraints, sectionHeadline } = this.ui;
    const target = this.targetMorph;
    const owner = target.owner;
    title = 'n/a';
    resizing.visible = false;
    constraints.visible = false;
    if (!owner.layout || owner.layout.name() === 'Proportional') {
      title = 'Constraints';
      constraints.visible = true;
    }
    if (target.layout && target.layout.name() === 'Tiling') {
      title = 'Constraints and Resizing';
      constraints.visible = true; // fixme: also enable to resizing in here....
    }
    if (owner.layout && owner.layout.name() === 'Tiling') {
      title = 'Resizing';
      resizing.visible = true;
      constraints.visible = false;
      if (target.layout && target.layout.name() === 'Tiling') {
        resizing.showInnerControls = true;
      } else {
        resizing.showInnerControls = false;
      }
    }

    sectionHeadline.textString = title;
    if (resizing.visible) this.refreshResizing();
    if (constraints.visible) this.refreshConstraints();
  }

  /**
   * Refresh the UI of the resizing controls based on the configuration
   * of the currently focused morph.
   */
  refreshResizing () {
    const { resizing } = this.models;
    const localLayout = this.targetMorph.layout;
    const layout = this.targetMorph.owner.layout;
    const heightPolicy = layout.getResizeHeightPolicyFor(this.targetMorph);
    const widthPolicy = layout.getResizeWidthPolicyFor(this.targetMorph);
    resizing.verticalResizing = heightPolicy;
    resizing.horizontalResizing = widthPolicy;
    if (localLayout && localLayout.hugContentsVertically) resizing.verticalResizing = 'hug';
    if (localLayout && localLayout.hugContentsHorizontally) resizing.horizontalResizing = 'hug';
    resizing.hideSelectors();
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
    if (layout.name() === 'Proportional') {
      const policy = layout.settingsFor(this.targetMorph);
      constraints.verticalConstraint = policy.y;
      constraints.horizontalConstraint = policy.x;
    }
  }

  /**
   * Update the current morph's resizing policy inside the TilingLayout
   * that controls the morph.
   */
  updateResizingPolicies () {
    const { resizing } = this.models;
    if (!this.targetMorph) return;
    let { layout } = this.targetMorph.owner;
    layout = layout.copy();
    const localLayout = this.targetMorph.layout;
    const policy = {};
    if (resizing.horizontalResizing !== 'hug') policy.width = resizing.horizontalResizing;
    if (resizing.verticalResizing !== 'hug') policy.height = resizing.verticalResizing;
    if (resizing.horizontalResizing === 'fill') layout.wrapSubmorphs = false;
    if (resizing.verticalResizing === 'fill') layout.wrapSubmorphs = false;

    layout.setResizePolicyFor(this.targetMorph, policy);

    if (localLayout && localLayout.name() === 'Tiling') {
      const shouldHugHorizontal = resizing.horizontalResizing === 'hug';
      // fixme: trigger refresh in the auto layout control
      localLayout.hugContentsHorizontally = shouldHugHorizontal;
      if (localLayout.axis === 'row' && shouldHugHorizontal) {
        localLayout.wrapSubmorphs = false;
      }
      const shouldHugVertically = resizing.verticalResizing === 'hug';
      localLayout.hugContentsVertically = shouldHugVertically;
      if (localLayout.axis === 'column' && shouldHugVertically) {
        localLayout.wrapSubmorphs = false;
      }
    }
    // trigger reconciliationm but this wont work because the layouts are the very same object
    //  ...
    this.targetMorph.owner.layout = layout;
  }

  /**
   * Update the current morph's resizing policy inside the ProportionalLayout
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
 * or a morph with a ProportionalLayout.
 * A constraint is a policy that dictates how the different sides of a morph relate to its
 * owner morph frame.
 * This controller automatically creates ProportionalLayouts as needed to reify the constraints.
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
   * the morph is controlled by a ProportionalLayout.
   * The following constraint behaviors are supported (By the ProportionalLayout):
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

/**
 * Control the resizing behavior of a morph
 */
export class ResizingControlModel extends ViewModel {
  static get properties () {
    return {
      verticalResizing: {},
      horizontalResizing: {},
      showInnerControls: { defaultValue: true },
      expose: {
        get () {
          return ['showInnerControls'];
        }
      },
      bindings: {
        get () {
          return [
            { model: 'horizontal alignment selector', signal: 'selection', handler: 'selectHorizontalResizing' },
            { model: 'vertical alignment selector', signal: 'selection', handler: 'selectVerticalResizing' },
            { target: 'resizing simulator', signal: 'onMouseDown', handler: 'onSelectorClicked' },
            { target: 'resizing simulator', signal: 'onHoverIn', handler: 'showSelectors' },
            { target: 'resizing simulator', signal: 'onHoverOut', handler: 'hideSelectors' }
          ];
        }
      }
    };
  }

  onRefresh (prop) {
    const {
      innerConstraints, resizingSimulator,
      innerBottomSelector, innerTopSelector,
      innerLeftSelector, innerRightSelector,
      outerTopSelector, outerBottomSelector,
      outerLeftSelector, outerRightSelector,
      horizontalAlignmentSelector,
      verticalAlignmentSelector
    } = this.ui;
    if (!resizingSimulator) return;
    let bbx = resizingSimulator.innerBounds();
    const widths = { fill: [40, 20], fixed: [40, 20], hug: [15, 15] };
    const horizontalWidth = widths[this.horizontalResizing] || widths.fill;
    const verticalWidth = widths[this.verticalResizing] || widths.fill;
    // reset scene
    resizingSimulator.getAllNamed(/inner /).forEach(ctrl => ctrl.visible = this.showInnerControls);

    if (prop === 'showInnerControls') {
      this.models.verticalAlignmentSelector.items = this.showInnerControls
        ? [
            { string: 'Fixed height', value: 'fixed', isListItem: true },
            { string: 'Hug contents', value: 'hug', isListItem: true },
            { string: 'Fill container', value: 'fill', isListItem: true }
          ]
        : [
            { string: 'Fixed height', value: 'fixed', isListItem: true },
            { string: 'Fill container', value: 'fill', isListItem: true }
          ];
      this.models.horizontalAlignmentSelector.items = this.showInnerControls
        ? [
            { string: 'Fixed width', value: 'fixed', isListItem: true },
            { string: 'Hug contents', value: 'hug', isListItem: true },
            { string: 'Fill container', value: 'fill', isListItem: true }
          ]
        : [
            { string: 'Fixed width', value: 'fixed', isListItem: true },
            { string: 'Fill container', value: 'fill', isListItem: true }
          ];
    }

    innerConstraints.visible = true;

    innerLeftSelector.width = innerRightSelector.width = innerTopSelector.width = innerBottomSelector.width = 20;
    outerLeftSelector.width = outerRightSelector.width = outerTopSelector.width = outerBottomSelector.width = 40;

    switch (this.verticalResizing) {
      case 'fill':
        innerConstraints.height = resizingSimulator.height;
        innerConstraints.top = 0;
        outerTopSelector.width = horizontalWidth[0];
        innerTopSelector.width = horizontalWidth[1];
        innerBottomSelector.width = horizontalWidth[1];
        outerBottomSelector.width = horizontalWidth[0];
        verticalAlignmentSelector.get('interactive label').value[0] = FILL_ICON;
        break;
      case 'fixed':
        innerConstraints.height = resizingSimulator.height - 30;
        innerConstraints.top = 15;
        innerTopSelector.width = horizontalWidth[1];
        innerBottomSelector.width = horizontalWidth[1];
        verticalAlignmentSelector.get('interactive label').value[0] = FIXED_ICON;
        break;
      case 'hug':
        innerConstraints.height = 20;
        innerConstraints.center = bbx.center();
        verticalAlignmentSelector.get('interactive label').value[0] = HUG_ICON;
        break;
    }

    switch (this.horizontalResizing) {
      case 'fill':
        innerConstraints.width = resizingSimulator.width;
        innerConstraints.left = 0;
        outerLeftSelector.width = verticalWidth[0];
        innerLeftSelector.width = verticalWidth[1];
        innerRightSelector.width = verticalWidth[1];
        outerRightSelector.width = verticalWidth[0];
        horizontalAlignmentSelector.get('interactive label').value[0] = FILL_ICON;
        break;
      case 'fixed':
        innerConstraints.width = resizingSimulator.width - 30;
        innerConstraints.left = 15;
        innerLeftSelector.width = verticalWidth[1];
        innerRightSelector.width = verticalWidth[1];
        horizontalAlignmentSelector.get('interactive label').value[0] = FIXED_ICON;
        break;
      case 'hug':
        innerConstraints.width = 20;
        innerConstraints.center = bbx.center();
        horizontalAlignmentSelector.get('interactive label').value[0] = HUG_ICON;
        break;
    }

    this.withoutBindingsDo(() => {
      // this does not update the label properly
      verticalAlignmentSelector.selection = this.verticalResizing;
      verticalAlignmentSelector.get('interactive label').makeDirty();
      horizontalAlignmentSelector.selection = this.horizontalResizing;
      horizontalAlignmentSelector.get('interactive label').makeDirty();
    });

    bbx = bbx.insetBy(22);
    innerLeftSelector.center = bbx.leftCenter();
    innerRightSelector.center = bbx.rightCenter();
    innerTopSelector.center = bbx.topCenter();
    innerBottomSelector.center = bbx.bottomCenter();

    bbx = bbx.insetBy(-15);
    outerLeftSelector.center = bbx.leftCenter();
    outerRightSelector.center = bbx.rightCenter();
    outerTopSelector.center = bbx.topCenter();
    outerBottomSelector.center = bbx.bottomCenter();
  }

  /**
   * Configures the vertical resize behavior of a morph. This applies when
   * the morph is controlled by a TilingLayout.
   * In this situation there are following cases:
   * The selected behavior can be "fixed" (the morph maintains its own size) or
   * "fill" (the morph fits to the bounds of its owner).
   * Should the morph own itself a TilingLayout an additional option "hug" is applicable
   * which would make the morph assign itself the vertical dimension of the submorph bounds.
   * This is essentially a fixed height but with respect to the submorphs.
   *
   * @prop {("fixed"|"fill"|"hug")} .
   */
  selectHorizontalResizing (behavior) {
    this.horizontalResizing = behavior;
    signal(this, 'changed');
  }

  /**
   * Same as verticalResizing but for the horizontal dimension.
   *
   * @prop {("fixed"|"fill"|"hug")}
   */
  selectVerticalResizing (behavior) {
    this.verticalResizing = behavior;
    signal(this, 'changed');
  }

  /**
   * Makes all available selectors visible.
   * Active selectors are displayed fully opaque, inactive ones semi transparent.
   */
  showSelectors () {
    const {
      innerBottomSelector, innerTopSelector,
      innerLeftSelector, innerRightSelector,
      outerTopSelector, outerBottomSelector,
      outerLeftSelector, outerRightSelector
    } = this.ui;

    switch (this.verticalResizing) {
      case 'fill':
        outerTopSelector.opacity = 1;
        outerBottomSelector.opacity = 1;
        innerBottomSelector.opacity = 0.5;
        innerTopSelector.opacity = 0.5;
        break;
      case 'fixed':
        outerTopSelector.opacity = 0.5;
        outerBottomSelector.opacity = 0.5;
        innerBottomSelector.opacity = 0.5;
        innerTopSelector.opacity = 0.5;
        break;
      case 'hug':
        outerTopSelector.opacity = 0.5;
        outerBottomSelector.opacity = 0.5;
        innerBottomSelector.opacity = 1;
        innerTopSelector.opacity = 1;
        break;
    }

    switch (this.horizontalResizing) {
      case 'fill':
        outerLeftSelector.opacity = 1;
        outerRightSelector.opacity = 1;
        innerRightSelector.opacity = 0.5;
        innerLeftSelector.opacity = 0.5;
        break;
      case 'fixed':
        outerLeftSelector.opacity = 0.5;
        outerRightSelector.opacity = 0.5;
        innerRightSelector.opacity = 0.5;
        innerLeftSelector.opacity = 0.5;
        break;
      case 'hug':
        outerLeftSelector.opacity = 0.5;
        outerRightSelector.opacity = 0.5;
        innerRightSelector.opacity = 1;
        innerLeftSelector.opacity = 1;
        break;
    }
  }

  /**
   * Hides all the available selectors except for the active ones.
   */
  hideSelectors () {
    const {
      innerBottomSelector, innerTopSelector,
      innerLeftSelector, innerRightSelector,
      outerTopSelector, outerBottomSelector,
      outerLeftSelector, outerRightSelector
    } = this.ui;

    switch (this.verticalResizing) {
      case 'fill':
        outerTopSelector.opacity = 1;
        outerBottomSelector.opacity = 1;
        innerBottomSelector.opacity = 0;
        innerTopSelector.opacity = 0;
        break;
      case 'fixed':
        outerTopSelector.opacity = 0;
        outerBottomSelector.opacity = 0;
        innerBottomSelector.opacity = 0;
        innerTopSelector.opacity = 0;
        break;
      case 'hug':
        outerTopSelector.opacity = 0;
        outerBottomSelector.opacity = 0;
        innerBottomSelector.opacity = 1;
        innerTopSelector.opacity = 1;
        break;
    }

    switch (this.horizontalResizing) {
      case 'fill':
        outerLeftSelector.opacity = 1;
        outerRightSelector.opacity = 1;
        innerRightSelector.opacity = 0;
        innerLeftSelector.opacity = 0;
        break;
      case 'fixed':
        outerLeftSelector.opacity = 0;
        outerRightSelector.opacity = 0;
        innerRightSelector.opacity = 0;
        innerLeftSelector.opacity = 0;
        break;
      case 'hug':
        outerLeftSelector.opacity = 0;
        outerRightSelector.opacity = 0;
        innerRightSelector.opacity = 1;
        innerLeftSelector.opacity = 1;
        break;
    }
  }

  onSelectorClicked (evt) {
    const markerName = evt.targetMorph.name;
    if (markerName.endsWith('selector')) {
      switch (markerName) {
        case 'inner top selector':
        case 'inner bottom selector':
          this.verticalResizing = this.verticalResizing === 'hug' ? 'fixed' : 'hug';
          break;
        case 'outer top selector':
        case 'outer bottom selector':
          this.verticalResizing = this.verticalResizing === 'fill' ? 'fixed' : 'fill';
          break;
        case 'inner left selector':
        case 'inner right selector':
          this.horizontalResizing = this.horizontalResizing === 'hug' ? 'fixed' : 'hug';
          break;
        case 'outer left selector':
        case 'outer right selector':
          this.horizontalResizing = this.horizontalResizing === 'fill' ? 'fixed' : 'fill';
          break;
      }
      this.showSelectors();
      signal(this, 'changed');
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

const ConstraintSizeSelectorHovered = component(ConstraintSizeSelectorDefault, {
  name: 'constraint size selector/hovered',
  layout: new TilingLayout({ wrapSubmorphs: false, axis: 'row', align: 'center', axisAlign: 'center' }),
  fill: Color.rgba(128, 216, 255, 0.5)
});

// ConstraintSizeSelector.openInWorld()
const ConstraintSizeSelector = component(ConstraintSizeSelectorDefault, {
  name: 'constraint size selector',
  master: { auto: ConstraintSizeSelectorDefault, hover: ConstraintSizeSelectorHovered }
});

// ResizingSimulator.openInWorld()
const ResizingSimulator = component({
  name: 'resizing simulator',
  borderColor: Color.darkGray,
  borderWidth: 1,
  extent: pt(75, 75),
  fill: Color.rgba(0, 0, 0, 0),
  position: pt(1.3, 12.1),
  submorphs: [{
    name: 'inner constraints',
    borderWidth: 1,
    borderColor: Color.rgb(176, 190, 197),
    extent: pt(46.4, 46.5),
    fill: Color.transparent,
    position: pt(14.7, 14.4)
  },
  part(ConstraintSizeSelector, {
    name: 'outer top selector',
    tooltip: 'Fill Container',
    position: pt(17.9, 2)
  }), part(ConstraintSizeSelector, {
    name: 'inner bottom selector',
    tooltip: 'Hug Contents',
    position: pt(18.4, 46.6)
  }), part(ConstraintSizeSelector, {
    name: 'outer bottom selector',
    tooltip: 'Fill Container',
    rotation: -3.141592653589793,
    position: pt(57.4, 72.4)
  }), part(ConstraintSizeSelector, {
    name: 'inner top selector',
    tooltip: 'Hug Contents',
    rotation: -3.141592653589793,
    position: pt(56.9, 26.8)
  }), part(ConstraintSizeSelector, {
    name: 'outer left selector',
    tooltip: 'Fill Container',
    position: pt(2.8, 55.6),
    rotation: -1.5707963267948966
  }), part(ConstraintSizeSelector, {
    name: 'outer right selector',
    tooltip: 'Fill Container',
    position: pt(72.5, 18.6),
    rotation: 1.570796326794897
  }), part(ConstraintSizeSelector, {
    name: 'inner left selector',
    tooltip: 'Hug Contents',
    position: pt(27.5, 18.3),
    rotation: 1.570796326794897
  }), part(ConstraintSizeSelector, {
    name: 'inner right selector',
    tooltip: 'Hug Contents',
    position: pt(47.7, 56.8),
    rotation: -1.5707963267948966
  })]
});

// if the morph is controlled by an auto layout we display
// this control instead to allow to choose between fixed/fill
// the width/height of the selected morph
// part(ResizingControl).openInWorld()
const ResizingControl = component(ConstraintsControl, {
  defaultViewModel: ResizingControlModel,
  name: 'resizing control',
  submorphs: [
    without('constraints simulator'),
    add(part(ResizingSimulator, { name: 'resizing simulator' }), 'horizontal alignment selector'),
    {
      name: 'horizontal alignment selector',
      viewModel: {
        listMaster: DarkThemeList,
        openListInWorld: true,
        listAlign: 'selection',
        tooltip: 'Choose Resizing Rule',
        items: [
          { string: 'Fixed width', value: 'fixed', isListItem: true },
          { string: 'Hug contents', value: 'hug', isListItem: true },
          { string: 'Fill container', value: 'fill', isListItem: true }
        ]
      }
    },
    {
      name: 'vertical alignment selector',
      viewModel: {
        listMaster: DarkThemeList,
        openListInWorld: true,
        listAlign: 'selection',
        tooltip: 'Choose Resizing Rule',
        items: [
          { string: 'Fixed height', value: 'fixed', isListItem: true },
          { string: 'Hug contents', value: 'hug', isListItem: true },
          { string: 'Fill container', value: 'fill', isListItem: true }
        ]
      }
    }
  ]
});

// part(AlignmentControl).openInWorld()
const AlignmentControl = component(PropertySection, {
  defaultViewModel: AlignmentManager,
  name: 'alignment control',
  extent: pt(250.6, 145),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Constraints', null]
    }, without('add button')]
  },
  add(part(ConstraintsControl, { name: 'constraints' })),
  add(part(ResizingControl, { name: 'resizing' }))
  ]
});

export { AlignmentControl, ConstraintsControl, ConstraintsSimulator, ResizingControl, ResizingSimulator, ConstraintSizeSelectorDefault, ConstraintMarker, ConstraintMarkerActive };
