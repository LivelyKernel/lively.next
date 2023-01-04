import { Color, Rectangle, pt, rect } from 'lively.graphics';
import { TilingLayout, Label, ViewModel, add, without, part, component } from 'lively.morphic';
import { string, num } from 'lively.lang';
import { DarkNumberIconWidget, PropertyLabel, PropertyLabelActive, DarkThemeList, EnumSelector, PropertyLabelHovered, AddButton } from '../shared.cp.js';
import { disconnect, epiConnect } from 'lively.bindings';

const FILL_ICON = '\ue5d7';
const HUG_ICON = '\ue5d6';
const FIXED_ICON = '\uea16';

export class ShapeControlModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      proportionalResize: { defaultValue: false },
      multiBorderRadiusActive: { defaultValue: false },
      propertyLabelComponent: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponent') || PropertyLabel;
        }
      },
      propertyLabelComponentActive: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponentActive') || PropertyLabelActive;
        }
      },
      propertyLabelComponentHover: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponentHover') || PropertyLabelHovered;
        }
      },
      expose: {
        get () {
          return ['refreshFromTarget'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'x input', signal: 'numberChanged', handler: 'changePosX' },
            { target: 'y input', signal: 'numberChanged', handler: 'changePosY' },
            { target: 'width input', signal: 'numberChanged', handler: 'changeWidth' },
            { target: 'height input', signal: 'numberChanged', handler: 'changeHeight' },
            { target: 'rotation input', signal: 'numberChanged', handler: 'changeRotation' },
            ...['', ' top left', ' top right', ' bottom right', ' bottom left'].map(d => [{
              target: 'radius input' + d,
              signal: 'numberChanged',
              handler: 'change' + string.camelCaseString('border radius ' + d),
              override: false
            }, {
              target: 'radius input' + d,
              signal: 'onMouseDown',
              handler: 'adjustCornerIndicator',
              converter: `() => "${string.camelCaseString(d)}"`
            }]).flat(),
            { model: 'clip mode selector', signal: 'selection', handler: 'changeClipMode' },
            { model: 'width mode selector', signal: 'selection', handler: 'changeWidthMode' },
            { model: 'height mode selector', signal: 'selection', handler: 'changeHeightMode' },
            { target: 'proportional resize toggle', signal: 'onMouseDown', handler: 'changeResizeMode' },
            { target: 'independent corner toggle', signal: 'onMouseDown', handler: 'toggleBorderMultiVar' }
          ];
        }
      }
    };
  }

  attach (view) {
    super.attach(view);
    this.refreshFromTarget();
  }

  onRefresh () {
    if (!this.view) return; // this should be handled by the view models superclass
    this.ui.multiRadiusContainer.visible = this.multiBorderRadiusActive;
    this.ui.independentCornerToggle.master = this.multiBorderRadiusActive
      ? this.propertyLabelComponentActive
      : {
          auto: this.propertyLabelComponent,
          hover: this.propertyLabelComponentHover
        };
    this.ui.proportionalResizeToggle.master = this.proportionalResize
      ? this.propertyLabelComponentActive
      : {
          auto: this.propertyLabelComponent,
          hover: this.propertyLabelComponentHover
        };
  }

  adjustCornerIndicator (cornerSide) {
    const sideToRotation = {
      TopRight: 0,
      TopLeft: Math.PI / 2 * 3,
      BottomRight: Math.PI / 2,
      BottomLeft: Math.PI
    };

    const rotation = sideToRotation[cornerSide] || 0;
    this.ui.borderIndicator.rotation = rotation;
  }

  refreshFromTarget () {
    if (!this.targetMorph) return;
    // update the fields based on the target Value
    const {
      xInput, yInput, widthInput, heightInput, rotationInput, radiusInput,
      clipModeSelector
    } = this.ui;
    const {
      top, left, width, height, rotation, clipMode, borderRadius
    } = this.targetMorph;
    if (this._updating) return;
    this.withoutBindingsDo(() => {
      xInput.number = left;
      yInput.number = top;
      widthInput.number = width;
      heightInput.number = height;
      rotationInput.number = num.toDegrees(rotation) % 360;
      clipModeSelector.selection = clipMode;
      radiusInput.number = borderRadius.valueOf();
      this.refreshExtentModes();
      this.refreshBorderRadiusSides();
    });
  }

  refreshExtentModes () {
    const target = this.targetMorph;
    const parent = target.owner;
    const { widthModeSelector, heightModeSelector, widthInput, heightInput, xInput, yInput, bufferAfterPosition } = this.ui;

    // helper function for generating the lists of valid modes
    function extentModeListItems (direction = 'width', fixed = true, fill = false, hug = false) {
      const items = [];
      switch (direction) {
        case 'width':
          if (fixed) items.push({ string: 'Fixed', value: 'fixed', isListItem: true });
          if (fill) items.push({ string: 'Fill', value: 'fill', isListItem: true });
          if (hug) items.push({ string: 'Hug', value: 'hug', isListItem: true });
          break;
        case 'height':
          if (fixed) items.push({ string: 'Fixed', value: 'fixed', isListItem: true });
          if (fill) items.push({ string: 'Fill', value: 'fill', isListItem: true });
          if (hug) items.push({ string: 'Hug', value: 'hug', isListItem: true });
      }
      return items;
    }

    const targetIsTiling = target.layout?.name() === 'Tiling' && target.submorphs.length > 0;
    const parentIsTiling = parent && parent.layout?.name() === 'Tiling'; // implicitly submorphs.length > 0 is guaranteed, target is child

    widthModeSelector.enable();
    heightModeSelector.enable();

    xInput.visible = true;
    yInput.visible = true;
    bufferAfterPosition.visible = true;

    if (targetIsTiling && parentIsTiling) {
      xInput.visible = false;
      yInput.visible = false;
      bufferAfterPosition.visible = false;

      widthModeSelector.items = extentModeListItems('width', true, true, true);
      heightModeSelector.items = extentModeListItems('height', true, true, true);

      if (!target.layout.resizePolicies.some(([_, { width }]) => width === 'fixed')) {
        widthModeSelector.items = extentModeListItems('width', true, true);
      }
      if (!target.layout.resizePolicies.some(([_, { height }]) => height === 'fixed')) {
        heightModeSelector.items = extentModeListItems('height', true, true);
      }

      const heightMode = parent.layout.getResizeHeightPolicyFor(target);
      heightModeSelector.selection = heightMode;
      if (heightMode === 'fill') heightInput.disable();
      else if (target.layout.hugContentsVertically) {
        heightModeSelector.selection = 'hug';
        heightInput.disable();
      } else heightInput.enable();

      const widthMode = parent.layout.getResizeWidthPolicyFor(target);
      widthModeSelector.selection = widthMode;
      if (widthMode === 'fill') widthInput.disable();
      else if (target.layout.hugContentsHorizontally) {
        widthModeSelector.selection = 'hug';
        widthInput.disable();
      } else widthInput.enable();
    }

    if (targetIsTiling && !parentIsTiling) {
      widthModeSelector.items = extentModeListItems('width', true, false, true);
      heightModeSelector.items = extentModeListItems('height', true, false, true);

      if (!target.layout.resizePolicies.some(([_, { width }]) => width === 'fixed')) {
        widthModeSelector.items = extentModeListItems('width', true);
        widthModeSelector.disable();
        widthInput.enable();
        widthModeSelector.selection = 'fixed';
        return;
      }
      if (!target.layout.resizePolicies.some(([_, { height }]) => height === 'fixed')) {
        heightModeSelector.items = extentModeListItems('height', true);
        heightModeSelector.disable();
        heightInput.enable();
        heightModeSelector.selection = 'fixed';
        return;
      }

      if (target.layout.hugContentsVertically) {
        heightModeSelector.selection = 'hug';
        heightInput.disable();
      } else {
        widthInput.enable();
        widthModeSelector.selection = 'fixed';
      }

      if (target.layout.hugContentsHorizontally) {
        widthModeSelector.selection = 'hug';
        widthInput.disable();
      } else {
        widthInput.enable();
        widthModeSelector.selection = 'fixed';
      }
    }

    if (!targetIsTiling && parentIsTiling) {
      xInput.visible = false;
      yInput.visible = false;
      bufferAfterPosition.visible = false;

      widthModeSelector.items = extentModeListItems('width', true, true, false);
      heightModeSelector.items = extentModeListItems('height', true, true, false);

      const heightMode = parent.layout.getResizeHeightPolicyFor(target);
      heightModeSelector.selection = heightMode;
      if (heightMode === 'fill') heightInput.disable();
      else heightInput.enable();

      const widthMode = parent.layout.getResizeWidthPolicyFor(target);
      widthModeSelector.selection = widthMode;
      if (widthMode === 'fill') widthInput.disable();
      else widthInput.enable();
    }

    if (!targetIsTiling && !parentIsTiling) {
      widthModeSelector.items = extentModeListItems('width');
      heightModeSelector.items = extentModeListItems('height');

      widthModeSelector.disable();
      heightModeSelector.disable();

      widthModeSelector.selection = 'fixed';
      heightModeSelector.selection = 'fixed';

      heightInput.enable();
      widthInput.enable();
    }
  }

  refreshBorderRadiusSides () {
    const {
      radiusInputTopLeft, radiusInputTopRight, radiusInputBottomLeft, radiusInputBottomRight
    } = this.ui;
    const {
      borderRadiusTopLeft, borderRadiusTopRight, borderRadiusBottomRight, borderRadiusBottomLeft
    } = this.targetMorph;
    radiusInputTopLeft.number = borderRadiusTopLeft;
    radiusInputTopRight.number = borderRadiusTopRight;
    radiusInputBottomRight.number = borderRadiusBottomRight;
    radiusInputBottomLeft.number = borderRadiusBottomLeft;
  }

  confirm (propName, val) {
    this._updating = true;
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph[propName] = val;
    });
    this._updating = false;
  }

  focusOn (targetMorph) {
    if (this.targetMorph) {
      disconnect(this.targetMorph, 'position', this, 'refreshFromTarget');
      disconnect(this.targetMorph, 'extent', this, 'refreshFromTarget');
      disconnect(this.targetMorph, 'rotation', this, 'refreshFromTarget');
    }
    this.targetMorph = targetMorph;
    epiConnect(this.targetMorph, 'position', this, 'refreshFromTarget');
    epiConnect(this.targetMorph, 'extent', this, 'refreshFromTarget');
    epiConnect(this.targetMorph, 'rotation', this, 'refreshFromTarget');
    if (this.targetMorph.isEllipse || this.targetMorph.isPolygon || this.targetMorph.isPath) {
      this.setBorderRadiusControlState(false);
    } else this.setBorderRadiusControlState(true);
    this.refreshFromTarget();
  }

  setBorderRadiusControlState (state) {
    // auto hide individual border widgets when deactivating border controls but do not necessarily show them when activcating again
    state ? null : this.multiBorderRadiusActive = state;
    ['independentCornerToggle', 'radiusInput'].forEach((elem) => {
      this.ui[elem].reactsToPointer = state;
      this.ui[elem].visible = state;
    });
  }

  changePosX (newX) { this.confirm('left', newX); }
  changePosY (newY) { this.confirm('top', newY); }
  changeWidth (newWidth) {
    if (this.proportionalResize) {
      const scaledHeight = this.targetMorph.height * (newWidth / this.targetMorph.width);
      this.withoutBindingsDo(() => this.ui.heightInput.number = scaledHeight); // this is a nasty bug with the number widgets who get invoked just when the connections are removed
      this.confirm('height', scaledHeight);
    }
    this.confirm('width', newWidth);
  }

  changeWidthMode (newMode) {
    const symbol = this.ui.widthModeSelector.get('interactive label');
    const target = this.targetMorph;
    let parent = target.owner;
    let heightMode;
    switch (newMode) {
      case ('fixed'):
        symbol.textAndAttributes = [FIXED_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }];
        heightMode = parent.layout?.getResizeHeightPolicyFor(target);
        if (heightMode) {
          parent.layout.setResizePolicyFor(target, {
            width: 'fixed',
            height: heightMode
          });
        }
        if (target.layout?.hugContentsHorizontally) target.layout.hugContentsHorizontally = false;
        target.withMetaDo({ reconcileChanges: true }, () => {
          target.layout = target.layout;
        });
        this.ui.widthInput.enable();
        break;
      case ('fill'):
        symbol.textAndAttributes = [FILL_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }];
        heightMode = parent.layout.getResizeHeightPolicyFor(target);
        parent.layout.wrapSubmorphs = false;
        parent.layout.setResizePolicyFor(target, {
          width: 'fill',
          height: heightMode
        });
        parent.withMetaDo({ reconcileChanges: true }, () => {
          parent.layout = parent.layout;
        });
        this.ui.widthInput.disable();
        break;
      case ('hug'):
        symbol.textAndAttributes = [HUG_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }];
        if (parent && parent.layout?.name() === 'Tiling') {
          heightMode = parent.layout.getResizeHeightPolicyFor(target);
          parent.layout.setResizePolicyFor(target, {
            width: 'fixed',
            height: heightMode
          });
        }
        target.layout.hugContentsHorizontally = true;
        target.layout.wrapSubmorphs = false;
        target.withMetaDo({ reconcileChanges: true }, () => {
          target.layout = target.layout;
        });
        this.ui.widthInput.disable();
    }
  }

  changeHeight (newHeight) {
    if (this.proportionalResize) {
      const scaledWidth = this.targetMorph.width * (newHeight / this.targetMorph.height);
      this.withoutBindingsDo(() => this.ui.widthInput.number = scaledWidth);
      this.confirm('width', scaledWidth);
    }
    this.confirm('height', newHeight);
  }

  changeHeightMode (newMode) {
    const symbol = this.ui.heightModeSelector.get('interactive label');
    const target = this.targetMorph;
    let parent = target.owner;
    let widthMode;
    switch (newMode) {
      case ('fixed'):
        symbol.textAndAttributes = [FIXED_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }];
        widthMode = parent.layout?.getResizeWidthPolicyFor(target);
        if (widthMode) {
          parent.layout.setResizePolicyFor(target, {
            width: widthMode,
            height: 'fixed'
          });
        }
        if (target.layout?.hugContentsVertically) target.layout.hugContentsVertically = false;
        this.ui.heightInput.enable();
        break;
      case ('fill'):
        symbol.textAndAttributes = [FILL_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }];
        widthMode = parent.layout.getResizeWidthPolicyFor(target);
        parent.layout.wrapSubmorphs = false;
        parent.layout.setResizePolicyFor(target, {
          width: widthMode,
          height: 'fill'
        });
        this.ui.heightInput.disable();
        break;
      case ('hug'):
        symbol.textAndAttributes = [HUG_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }];
        if (parent && parent.layout?.name() === 'Tiling') {
          widthMode = parent.layout.getResizeWidthPolicyFor(target);
          parent.layout.setResizePolicyFor(target, {
            width: widthMode,
            height: 'fixed'
          });
        }
        target.layout.hugContentsVertically = true;
        target.layout.wrapSubmorphs = false;
        this.ui.heightInput.disable();
    }
  }

  changeRotation (newRot) { this.updateTarget('rotation', num.toRadians(newRot)); }
  changeClipMode (newClipMode) { this.updateTarget('clipMode', newClipMode); }
  changeBorderRadius (rad) {
    this.confirm('borderRadius', rad);
    this.withoutBindingsDo(() => this.refreshBorderRadiusSides());
  }

  changeBorderRadiusTopLeft (rad) { this.confirm('borderRadiusTopLeft', rad); this.toggleMixedRadius(); }
  changeBorderRadiusTopRight (rad) { this.confirm('borderRadiusTopRight', rad); this.toggleMixedRadius(); }
  changeBorderRadiusBottomRight (rad) { this.confirm('borderRadiusBottomRight', rad); this.toggleMixedRadius(); }
  changeBorderRadiusBottomLeft (rad) { this.confirm('borderRadiusBottomLeft', rad); this.toggleMixedRadius(); }

  toggleMixedRadius () {
    this.ui.radiusInput.setMixed();
  }

  toggleBorderMultiVar () {
    this.multiBorderRadiusActive = !this.multiBorderRadiusActive;
  }

  changeResizeMode () {
    this.proportionalResize = !this.proportionalResize;
  }
}

const ShapeControl = component({
  name: 'shape control',
  borderRadius: 0,
  defaultViewModel: ShapeControlModel,
  borderColor: Color.rgba(97, 106, 107, 1),
  borderWidth: { top: 0, left: 0, right: 0, bottom: 1 },
  layout: new TilingLayout({
    axisAlign: 'center',
    justifySubmorphs: 'spaced',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(20, 20, 0, 0),
    spacing: 16
  }),
  fill: Color.transparent,
  extent: pt(250, 215.4),
  submorphs: [
    part(DarkNumberIconWidget, {
      name: 'x input',
      tooltip: 'X Position',
      min: -Infinity,
      max: Infinity,
      scaleFactor: 1,
      submorphs: [{
        name: 'interactive label',
        fontSize: 13,
        fontFamily: 'IBM Plex Mono',
        padding: rect(8, 0, -1, 0),
        textAndAttributes: ['X', {
          textStyleClasses: ['']
        }]
      }]
    }), part(DarkNumberIconWidget, {
      name: 'y input',
      tooltip: 'Y Position',
      min: -Infinity,
      max: Infinity,
      scaleFactor: 1,
      submorphs: [{
        name: 'interactive label',
        padding: rect(7, 0, 0, 0),
        fontFamily: 'IBM Plex Mono',
        fontSize: 13,
        textAndAttributes: ['Y', {
          textStyleClasses: ['']
        }]
      }]
    }), { opacity: 0, name: 'buffer after position', width: 25 },
    part(DarkNumberIconWidget, {
      name: 'width input',
      tooltip: 'Width',
      min: -Infinity,
      max: Infinity,
      scaleFactor: 1,
      submorphs: [{
        name: 'interactive label',
        padding: rect(6, 5, 1, -5),
        rotation: -1.57,
        textAndAttributes: ['', {
          fontSize: 18,
          textStyleClasses: ['material-icons']
        }]
      }]
    }),
    part(DarkNumberIconWidget, {
      name: 'height input',
      min: -Infinity,
      max: Infinity,
      scaleFactor: 1,
      tooltip: 'Height',
      submorphs: [{
        name: 'interactive label',
        padding: rect(3, 3, -3, -3),
        textAndAttributes: [FIXED_ICON, { textStyleClasses: ['material-icons'], fontSize: 18 }]
      }]
    }), part(AddButton, {
      master: { auto: AddButton, hover: PropertyLabelHovered },
      name: 'proportional resize toggle',
      tooltip: 'Proportional Resize',
      padding: rect(5, 5, 0, 0),
      textAndAttributes: ['', { fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"', fontWeight: '900', textStyleClasses: ['fas'] }]
    }),
    part(EnumSelector, {
      name: 'width mode selector',
      tooltip: 'Horizontal Resizing',
      extent: pt(72, 22),
      layout: new TilingLayout(
        {
          align: 'center',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          orderByIndex: true,
          padding: rect(5, 0, 5, 0),
          resizePolicies: [['label', [{ height: 'fixed', width: 'fill' }]]],
          wrapSubmorphs: false
        }),
      viewModel: {
        listMaster: DarkThemeList,
        openListInWorld: true,
        listAlign: 'selection',
        items: [
          { string: 'Fixed', value: 'fixed', isListItem: true },
          { string: 'Fill', value: 'fill', isListItem: true },
          { string: 'Hug', value: 'hug', isListItem: true }
        ]
      },
      submorphs: [
        add({
          type: Label,
          name: 'interactive label',
          fill: Color.rgba(229, 231, 233, 0),
          fontColor: Color.rgba(178, 235, 242, 0.6),
          fontFamily: 'Material Icons',
          nativeCursor: 'pointer',
          rotation: -1.5707963267948966,
          reactsToPointer: false,
          textAndAttributes: [FIXED_ICON, {
            fontSize: 16,
            textStyleClasses: ['material-icons']
          }]
        }, 'label'),
        { name: 'label', fontSize: 12, fontColor: Color.rgb(178, 235, 242) }]
    }),
    part(EnumSelector, {
      name: 'height mode selector',
      tooltip: 'Vertical Resizing',
      extent: pt(72, 22),
      layout: new TilingLayout(
        {
          align: 'center',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          orderByIndex: true,
          padding: rect(5, 0, 5, 0),
          resizePolicies: [['label', [{ height: 'fixed', width: 'fill' }]]],
          wrapSubmorphs: false
        }),
      viewModel: {
        listMaster: DarkThemeList,
        openListInWorld: true,
        listAlign: 'selection',
        items: [
          { string: 'Fixed', value: 'fixed', isListItem: true },
          { string: 'Fill', value: 'fill', isListItem: true },
          { string: 'Hug', value: 'hug', isListItem: true }
        ]
      },
      submorphs: [add({
        type: Label,
        name: 'interactive label',
        fill: Color.rgba(229, 231, 233, 0),
        fontColor: Color.rgba(178, 235, 242, 0.6),
        fontFamily: 'Material Icons',
        nativeCursor: 'pointer',
        reactsToPointer: false,
        lineHeight: 1,
        textAndAttributes: [FIXED_ICON, {
          fontSize: 16,
          textStyleClasses: ['material-icons']
        }]
      }, 'label'),
      { name: 'label', fontSize: 12, fontColor: Color.rgb(178, 235, 242) }]
    }), { opacity: 0, name: 'buffer', width: 25 },
    part(DarkNumberIconWidget, {
      name: 'rotation input',
      tooltip: 'Rotation',
      unit: '°',
      min: 0,
      max: 359,
      submorphs: [{
        name: 'interactive label',
        lineHeight: 1,
        padding: Rectangle.inset(6, 0, 0, 0)
      }, {
        name: 'value',
        cursorColor: Color.rgba(178, 235, 242, 0.75),
        extent: pt(42.6, 21)
      }]
    }),
    part(DarkNumberIconWidget, {
      name: 'radius input',
      tooltip: 'Border Radius',
      min: 0,
      submorphs: [{
        name: 'interactive label',
        fontFamily: 'Material Icons',
        lineHeight: 1,
        textAndAttributes: ['\ue920', {
          fontSize: 16,
          textStyleClasses: ['material-icons']
        }]
      }]
    }), part(AddButton, {
      master: { auto: AddButton, hover: PropertyLabelHovered },
      name: 'independent corner toggle',
      tooltip: 'Independent Border Radius per Corner',
      padding: rect(3, 3, 0, 0),
      textAndAttributes: ['\ue5d0', {
        fontSize: 18,
        textStyleClasses: ['material-icons']
      }]
    }),
    {
      name: 'multi radius container',
      layout: new TilingLayout({
        axisAlign: 'center',
        orderByIndex: true,
        spacing: 1
      }),
      fill: Color.transparent,
      extent: pt(223.5, 25),
      clipMode: 'hidden',
      submorphs: [
        {
          name: 'centering wrapper',
          fill: Color.transparent,
          clipMode: 'hidden',
          layout: new TilingLayout({
            align: 'center',
            axisAlign: 'center'
          }),
          extent: pt(21, 25),
          submorphs: [
            {
              type: Label,
              name: 'border indicator',
              borderRadius: 3,
              fill: Color.rgba(229, 231, 233, 0),
              fontColor: Color.rgb(178, 235, 242),
              fontFamily: 'Material Icons',
              padding: rect(2, 2, 0, -2),
              textAndAttributes: ['', {
                fontSize: 16,
                textStyleClasses: ['material-icons']
              }]
            }
          ]
        },
        part(DarkNumberIconWidget, {
          name: 'radius input top left',
          min: 0,
          extent: pt(35, 22),
          tooltip: 'Border Radius Top Left',
          borderRadiusTopRight: 0,
          borderRadiusBottomRight: 0,
          submorphs: [without('interactive label')]
        }), part(DarkNumberIconWidget, {
          name: 'radius input top right',
          min: 0,
          borderRadius: 0,
          extent: pt(35, 22),
          tooltip: 'Border Radius Top Right',
          submorphs: [without('interactive label')]
        }),
        part(DarkNumberIconWidget, {
          name: 'radius input bottom right',
          min: 0,
          borderRadius: 0,
          extent: pt(35, 22),
          tooltip: 'Border Radius Bottom Right',
          submorphs: [without('interactive label')]
        }),
        part(DarkNumberIconWidget, {
          name: 'radius input bottom left',
          min: 0,
          borderRadiusTopLeft: 0,
          borderRadiusBottomLeft: 0,
          extent: pt(35, 22),
          tooltip: 'Border Radius Bottom Left',
          submorphs: [without('interactive label')]
        })
      ]
    },
    part(EnumSelector, {
      name: 'clip mode selector',
      tooltip: 'Clip Mode',
      extent: pt(165, 23.3),
      viewModel: {
        listMaster: DarkThemeList,
        openListInWorld: true,
        listAlign: 'selection',
        items: [
          { string: 'Visible', value: 'visible', isListItem: true },
          { string: 'Hidden', value: 'hidden', isListItem: true },
          { string: 'Scroll', value: 'scroll', isListItem: true },
          { string: 'Auto', value: 'auto', isListItem: true }
        ]
      },
      submorphs: [add({
        type: Label,
        name: 'interactive label',
        fill: Color.rgba(229, 231, 233, 0),
        fontColor: Color.rgba(178, 235, 242, 0.6),
        fontFamily: 'Material Icons',
        nativeCursor: 'pointer',
        lineHeight: 1,
        padding: rect(6, 0, -6, 0),
        reactsToPointer: false,
        textAndAttributes: ['', {
          fontSize: 16,
          textStyleClasses: ['material-icons']
        }]
      }, 'label'), { name: 'label', fontColor: Color.rgb(178, 235, 242) }]
    })]
});

export { ShapeControl };
