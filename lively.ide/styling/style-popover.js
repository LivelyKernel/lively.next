/* global target,connection */
import {
  Morph,
  Icon,
  ProportionalLayout,
  config,
  Text,
  ShadowObject,
  GridLayout,
  TilingLayout,
  StyleSheet,
  morph,
  HorizontalLayout,
  VerticalLayout
} from 'lively.morphic';
import KeyHandler from 'lively.morphic/events/KeyHandler.js';

import { connect, signal } from 'lively.bindings';
import { arr, promise, fun, string, obj } from 'lively.lang';
import { Color, rect, Rectangle, pt } from 'lively.graphics';
import { popovers } from '../index.js';

import {
  ModeSelector,
  DropDownSelector,
  SearchField,
  CheckBox
} from 'lively.components/widgets.js';

import {
  Popover
} from 'lively.components/popup.js';

import { SvgStyleHalo } from 'lively.halos';
import { NumberWidget } from '../value-widgets.js';
import { Icons } from 'lively.morphic/text/icons.js';

const duration = 200;
export var colorWidgets = colorWidgets || {
  // to be set by color-picker and gradient-editor
};

class SelectableControl extends Morph {
  static get properties () {
    return {
      target: {
        type: 'Morph'
      },
      selectableControls: {},
      selectedControl: {},
      fill: { defaultValue: Color.transparent },
      layout: {
        initialize () {
          this.layout = new VerticalLayout({
            spacing: 10,
            autoResize: true,
            layoutOrder: function (m) {
              return this.container.submorphs.indexOf(m);
            }
          });
        }
      },
      submorphs: {
        after: ['selectableControls', 'selectedControl', 'target'],
        initialize () {
          const modeSelector = new ModeSelector({
            name: 'modeSelector',
            items: this.selectableControls,
            init: this.selectedControl
          });
          this.submorphs = [modeSelector];
          modeSelector.width = 100;
          connect(modeSelector, 'switchLabel', this, 'select');
          this.select(this.selectableControls[this.selectedControl]);
        }
      }
    };
  }

  async select (cmd) {
    if (!this.target) return;
    const control = await this.target.execCommand(cmd);
    const selector = this.get('modeSelector');
    control.opacity = 0;
    if (this.lastLabel) {
      const lr = selector.submorphs.indexOf(this.lastLabel) < selector.submorphs.indexOf(selector.currentLabel);
      control.topLeft = selector.bottomLeft.addXY(lr ? 20 : -20, 10);
    }
    this.lastLabel = selector.currentLabel;
    this.animate({ submorphs: [selector, control], duration: duration });
    control.animate({ opacity: 1, duration: duration });
  }
}

class ToggledControl extends Morph {
  static get properties () {
    return {
      title: { defaultValue: 'Toggled Property' },
      toggledControl: {},
      checked: {},
      clipMode: { defaultValue: 'hidden' },
      fill: { defaultValue: Color.transparent },
      layout: {
        initialize () {
          this.layout = new VerticalLayout({ spacing: 5 });
        }
      },
      submorphs: {
        initialize () {
          const toggler = new CheckBox({ checked: this.checked });
          this.submorphs = [
            {
              fill: Color.transparent,
              layout: new HorizontalLayout({ autoResize: false }),
              height: 25,
              submorphs: [
                {
                  type: 'label',
                  name: 'property name',
                  fontWeight: 'bold',
                  fontSize: 14,
                  autofit: true,
                  opacity: 0.8,
                  padding: rect(0, 2, 3, 0),
                  textString: this.title,
                  styleClasses: ['controlLabel']
                },
                toggler
              ]
            }
          ];
          this.toggle(this.checked);
          connect(toggler, 'toggle', this, 'toggle');
        }
      }
    };
  }

  toggle (value) {
    const [title] = this.submorphs;
    const valueControl = this.toggledControl(value);
    const submorphs = [title, ...(valueControl ? [valueControl] : [])];
    signal(this, 'update', value && valueControl.value);
    if (valueControl) valueControl.opacity = 0;
    this.animate({ submorphs, duration: duration });
    if (valueControl) valueControl.animate({ opacity: 1, duration: duration });
  }
}

class StylePopover extends Popover {
  static get properties () {
    return {

      targetMorph: {
        initialize () {
          this.targetMorph = morph({
            layout: new HorizontalLayout({ spacing: 5, resizeContainer: true }),
            fill: Color.transparent,
            submorphs: this.controls()
          });
          this.setupConnections();
        }
      }
    };
  }

  setupConnections () {
    // wire up signals and events to morphs
  }

  controls () {
    // return an array of control elements
    return [];
  }
}

export class IconPopover extends StylePopover {
  static get properties () {
    return {
      isEpiMorph: {
        get () { return false; }
      },
      popoverColor: { defaultValue: Color.gray.lighter() },
      ui: {
        get () {
          return {
            searchInput: this.get('searchInput'),
            iconList: this.get('iconList')
          };
        }
      }
    };
  }

  onDrop (evt) {
    const grabbedMorphs = evt.hand.grabbedMorphs;
    if (grabbedMorphs.find(m => m === this.iconLabel)) {
      evt.hand.dropMorphsOn(this);
      this.iconLabel.remove();
    }
  }

  controls () {
    const width = 200;
    const height = 200;
    const margin = 4;
    const searchBarHeight = 20;
    return [
      {
        draggable: false,
        layout: new VerticalLayout({ spacing: 4 }),
        fill: Color.transparent,
        submorphs: [
          new SearchField({
            name: 'searchInput',
            width,
            placeHolder: 'Search Icons'
          }),
          morph({
            textAndAttributes: this.iconAsTextAttributes(),
            name: 'iconList',
            draggable: true,
            type: 'text',
            extent: pt(width, height),
            textStyleClasses: ['fas', 'far'],
            clipMode: 'auto',
            readOnly: true
          })
        ]
      }
    ];
  }

  setupConnections () {
    const { searchInput, iconList } = this.ui;
    connect(searchInput, 'searchInput', this, 'filterIcons');
    connect(iconList, 'onMouseUp', this, 'iconSelectClick');
    connect(iconList, 'onDragStart', this, 'createIconLabel');
  }

  relayout () {}

  createIconLabel (evt) {
    const pos = this.ui.iconList.textPositionFromPoint(evt.positionIn(this.ui.iconList));
    const iconName = this.iconAtTextPos(pos);
    this.iconLabel = Icon.makeLabel(iconName, {
      fontSize: this.ui.iconList.fontSize, name: iconName
    });
    this.iconLabel.openInHand();
  }

  iconAsTextAttributes (filterFn) {
    let iconNames = Object.keys(Icons);
    if (filterFn) iconNames = iconNames.filter(filterFn);
    return arr.flatmap(iconNames,
      (name, i) => [
        Icons[name].code,
        { iconCode: Icons[name].code, iconName: name },
        ' ', { fontFamily: 'sans-serif', iconCode: false, iconName: false }
      ]);
  }

  async filterIcons () {
    await promise.delay(250);
    fun.debounceNamed('filterIcons', 200, () => {
      this.ui.iconList.textAndAttributes = this.iconAsTextAttributes(name =>
        this.ui.searchInput.matches(name.toLowerCase())
      );
    })();
  }

  iconSelectClick (evt) {
    // let iconList = this.get("icon-list");
    const textPos = this.ui.iconList.textPositionFromPoint(evt.positionIn(this.ui.iconList));
    const iconName = this.iconAtTextPos(textPos);
    this.setStatusMessage(iconName);
    signal(this, 'select', iconName);
  }

  iconAtTextPos ({ row, column }) {
    column = column - 1;
    const iconList = this.ui.iconList;
    const range = { start: { row, column: Math.max(0, column) }, end: { row, column: column + 2 } };
    let found = iconList.textAndAttributesInRange(range);
    while (found.length) {
      if (found[1].iconName) {
        break;
      }
      column++;
      found = found.slice(2);
    }
    const iconRange = { start: { row, column }, end: { row, column: column + 1 } };
    iconList.addTextAttribute({ backgroundColor: iconList.selectionColor.darker().withA(0.5) }, iconRange);
    promise.delay(1000).then(() => iconList.addTextAttribute({ backgroundColor: Color.transparent }, iconRange));
    return found.length ? found[1].iconName : null;
  }
}

export class LayoutPopover extends StylePopover {
  static get properties () {
    return {
      container: {},
      popoverColor: { defaultValue: Color.gray.lighter() }
    };
  }

  getLayoutObjects () {
    return [
      null,
      new HorizontalLayout({ autoResize: false }),
      new VerticalLayout({ autoResize: false }),
      new TilingLayout(),
      new ProportionalLayout(),
      new GridLayout({ grid: [[null], [null], [null]] })
    ];
  }

  close () {
    super.close();
    this.clearLayoutHalo();
  }

  controls () {
    this.showLayoutHaloFor(this.container);
    return [
      {
        fill: Color.transparent,
        layout: new VerticalLayout({
          spacing: 5,
          layoutOrder: function (m) {
            return this.container.submorphs.indexOf(m);
          }
        }),
        submorphs: [this.layoutPicker(), this.layoutControls()]
      }];
  }

  updateControls () {
    this.get('Layout Type').relayout();
    this.getSubmorphNamed('controlContainer').animate(this.layoutHalo
      ? {
          isLayoutable: true,
          submorphs: this.layoutHalo.optionControls(this),
          duration: 300
        }
      : {
          isLayoutable: false,
          extent: pt(0, 0),
          submorphs: [],
          duration: 300
        });
  }

  showLayoutHaloFor (morph) {
    this.clearLayoutHalo();
    if (!morph || !morph.layout) return;
    const world = morph.world() || morph.env.world;
    this.layoutHalo = world.showLayoutHaloFor(morph);
  }

  clearLayoutHalo () {
    if (this.layoutHalo) {
      this.layoutHalo.remove();
      this.layoutHalo = null;
    }
  }

  getCurrentLayoutName () {
    return this.getLayoutName(this.container.layout);
  }

  getLayoutName (l) {
    return l ? l.name() + ' Layout' : 'No Layout';
  }

  update () {}

  applyLayout (l) {
    this.container.animate({ layout: l });
    this.showLayoutHaloFor(this.container);
    this.updateControls(this.controls());
    signal(this, 'layoutChanged', this.container.layout);
  }

  layoutPicker () {
    const items = this.getLayoutObjects().map(l => {
      return { [this.getLayoutName(l)]: l };
    });
    const layoutSelector = this.get('Layout Type') || new DropDownSelector({
      name: 'Layout Type',
      borderRadius: 2,
      padding: 3,
      getCurrentValue: () => this.getCurrentLayoutName(),
      selectedValue: this.container.layout,
      values: obj.merge(items)
    });
    connect(layoutSelector, 'selectedValue', this, 'applyLayout');
    return layoutSelector;
  }

  layoutControls () {
    return {
      name: 'controlContainer',
      fill: Color.transparent,
      layout: new VerticalLayout(),
      isLayoutable: !!this.layoutHalo,
      submorphs: this.layoutHalo ? this.layoutHalo.optionControls(this) : []
    };
  }
}

export class FillPopover extends StylePopover {
  static get properties () {
    return {
      gradientEnabled: { defaultValue: true },
      fillValue: { defaultValue: Color.blue },
      popoverColor: { defaultValue: Color.gray.lighter() },
      handleMorph: {},
      openHandles: {
        defaultValue: []
      },

      ui: {
        get () {
          return {
            colorField: this.get('colorField'),
            fillSelector: this.get('fillSelector'),
            gradientEditor: this.get('gradient editor')
          };
        }
      }
    };
  }

  openHandle (handle) {
    handle.openInWorld();
    this.openHandles.push(handle);
  }

  close () {
    super.close();
    this.openHandles.forEach(h => h.remove());
  }

  setupConnections () {
    const { fillSelector, colorField, gradientEditor } = this.ui;
    fillSelector && connect(this, 'fillValue', fillSelector, 'value');
    if (gradientEditor) {
      connect(gradientEditor, 'gradientValue', this, 'fillValue');
      connect(gradientEditor, 'openHandle', this, 'openHandle');
    }
    if (colorField) {
      connect(this, 'close', colorField, 'remove');
      connect(colorField, 'update', this, 'fillValue');
      connect(this, 'onMouseDown', colorField, 'removeWidgets');
    }
  }

  get commands () {
    return super.commands.concat([
      {
        name: 'switch to fill',
        exec: () => {
          const p = new colorWidgets.ColorPickerField({
            name: 'colorField',
            colorValue: this.fillValue.isGradient ? Color.blue : this.fillValue
          });
          p.whenRendered().then(() => {
            this.setupConnections();
          });
          return p;
        }
      },
      {
        name: 'switch to gradient',
        exec: () => {
          const g = new colorWidgets.GradientEditor({
            name: 'gradient editor',
            gradientValue: this.fillValue
          });
          g.whenRendered().then(() => {
            this.setupConnections();
            this.handleMorph && g.showGradientHandlesOn(this.handleMorph);
            g.update();
          });
          return g;
        }
      }
    ]);
  }

  controls () {
    if (!this.gradientEnabled) {
      const pickerField = new colorWidgets.ColorPickerField({
        name: 'colorField',
        colorValue: this.fillValue
      });
      pickerField.whenRendered().then(() => {
        pickerField.update(this.fillValue);
      });

      return [
        {
          fill: Color.transparent,
          layout: new VerticalLayout({ spacing: 0 }),
          submorphs: [
            pickerField
          ]
        }
      ];
    }
    const selectedControl = this.fillValue && this.fillValue.isGradient ? 'Gradient' : 'Fill';
    return [
      new SelectableControl({
        name: 'fillSelector',
        target: this,
        selectedControl,
        selectableControls: {
          Fill: 'switch to fill',
          Gradient: 'switch to gradient'
        }
      })
    ];
  }
}

export class ShadowPopover extends StylePopover {
  static get properties () {
    return {
      shadowValue: {},
      cachedShadow: { defaultValue: new ShadowObject({ fast: true }) },
      popoverColor: { defaultValue: Color.gray.lighter() }
    };
  }

  controls () {
    const selectedValue = (this.shadowValue ? (this.shadowValue.inset ? 'Inset Shadow' : 'Drop Shadow') : 'No Shadow');
    let shadowSelector;
    const controls = [
      {
        layout: new VerticalLayout({ resizeContainer: true, spacing: 5 }),
        fill: Color.transparent,
        name: 'control container',
        submorphs: [
          (shadowSelector = new DropDownSelector({
            name: 'shadow type',
            borderRadius: 2,
            padding: 3,
            selectedValue,
            values: ['No Shadow', 'Drop Shadow', 'Inset Shadow']
          }))
        ].concat(this.shadowValue ? this.shadowControls() : [])
      }
    ];
    connect(shadowSelector, 'selectedValue', this, 'changeShadowType');
    return controls;
  }

  shadowControls () {
    const value = this.shadowValue;
    const autofit = false;
    const distanceInspector = new NumberWidget({
      min: 0,
      autofit,
      name: 'distanceSlider',
      number: value.distance,
      unit: 'px'
    });
    const angleSlider = new NumberWidget({
      name: 'angleSlider',
      min: 0,
      max: 360,
      number: value.rotation,
      autofit
    });
    const spreadInspector = new NumberWidget({
      name: 'spreadSlider',
      min: 0,
      number: value.spread,
      autofit
    });
    const blurInspector = new NumberWidget({
      name: 'blurSlider',
      min: 0,
      number: value.blur,
      autofit
    });
    const colorField = new colorWidgets.ColorPickerField({
      name: 'colorPicker',
      colorValue: value.color
    });
    connect(colorField, 'colorValue', this, 'updateShadow', { converter: color => ({ color }) });
    connect(this, 'onMouseDown', colorField, 'removeWidgets');
    connect(this, 'close', colorField, 'remove');
    connect(spreadInspector, 'update', this, 'updateShadow', { converter: spread => ({ spread }) });
    connect(distanceInspector, 'update', this, 'updateShadow', {
      converter: distance => ({ distance })
    });
    connect(blurInspector, 'update', this, 'updateShadow', { converter: blur => ({ blur }) });
    connect(angleSlider, 'update', this, 'updateShadow', { converter: rotation => ({ rotation }) });

    return new Morph({
      layout: new GridLayout({
        autoAssign: false,
        fitToCell: false,
        columns: [0, { paddingLeft: 1 }],
        rows: arr.flatten(arr.range(0, 3).map(i => [i, { paddingBottom: 5 }]), 1),
        grid: [
          ['spreadLabel', null, 'spreadSlider'],
          ['distanceLabel', null, 'distanceSlider'],
          ['blurLabel', null, 'blurSlider'],
          ['angleLabel', null, 'angleSlider'],
          ['colorLabel', null, 'colorPicker']
        ]
      }),
      width: 120,
      height: 145,
      fill: Color.transparent,
      submorphs: arr.flatten(
        [
          ['distance', distanceInspector],
          ['spread', spreadInspector],
          ['blur', blurInspector],
          ['angle', angleSlider],
          ['color', colorField]
        ].map(([value, control]) => {
          return [
            {
              type: 'label',
              styleClasses: ['controlName'],
              value: string.capitalize(value) + ':',
              name: value + 'Label'
            },
            control
          ];
        })
      )
    });
  }

  changeShadowType (type) {
    if (type == 'No Shadow') {
      this.toggleShadow(false);
    } else if (type == 'Inset Shadow') {
      this.toggleShadow(true);
      this.shadowValue.inset = true;
    } else {
      this.toggleShadow(true);
      this.shadowValue.inset = false;
    }
    this.get('control container').animate({
      submorphs: [this.get('shadow type')].concat(this.shadowValue ? this.shadowControls() : []),
      duration: 300
    });
  }

  updateShadow (args) {
    const { color, spread, blur, distance, rotation, inset, fast } = this.shadowValue;
    const shadow = { fast, color, spread, blur, distance, rotation, inset, ...args };
    this.shadowValue = new ShadowObject(shadow);
  }

  toggleShadow (shadowActive) {
    if (this.shadowValue) this.cachedShadow = this.shadowValue;
    this.shadowValue = shadowActive && this.cachedShadow;
  }
}

const milimeter = 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Millimeterpapier_10_x_10_cm.svg';

export class PointPopover extends StylePopover {
  static get properties () {
    return {
      pointValue: { defaultValue: pt(0, 0) },
      resolution: { defaultValue: 1 }
    };
  }

  refineResolution (evt) {
    this.resolution = 0.25 + this.get('scroller').scroll.y / 160;
    this.relayout();
  }

  adjustPoint ({ state: { dragDelta } }) {
    this.pointValue = this.pointValue.addPt(dragDelta.scaleBy(1 / this.resolution)).roundTo(1);
    this.relayout();
  }

  relayout () {
    super.relayout();
    const m = this.getSubmorphNamed('mesh');
    const pv = this.getSubmorphNamed('point value view');
    m.origin = m.innerBounds().center().addXY(4, 1);
    m.position = this.get('body').innerBounds().center();
    m.scale = this.resolution;
    this.getSubmorphNamed('resolution view').value = 'Resolution: ' + this.resolution.toFixed(2) + 'x';
    pv.value = obj.safeToString(this.pointValue);
    pv.position = this.getSubmorphNamed('knob').bottomRight;
  }

  constructor (props) {
    super(props);
    this.whenRendered().then(() => this.relayout());
  }

  async calibrate () {
    this.get('knob').animate({ center: this.innerBounds().center(), duration: 200 });
    await this.getSubmorphNamed('point value view').animate({ opacity: 0, duration: 200 });
    this.relayout();
  }

  showPointValue () {
    this.getSubmorphNamed('point value view').animate({ opacity: 1, duration: 200 });
  }

  controls () {
    this.extent = pt(200, 200);
    let scroller; let grabber;
    const controls = [morph({
      extent: pt(200, 200),
      clipMode: 'hidden',
      fill: Color.transparent,
      submorphs: [
        {
          type: 'image',
          name: 'mesh',
          fill: Color.transparent,
          opacity: 0.5,
          imageUrl: milimeter,
          autoResize: true
        },
        {
          extent: pt(200, 200),
          draggable: false,
          dropShadow: { inset: true, spread: 5, color: Color.gray },
          fill: Color.transparent
        },
        scroller = morph({
          name: 'scroller',
          extent: pt(200, 200),
          clipMode: 'scroll',
          draggable: false,
          opacity: 0.01,
          submorphs: [{ height: 200 + 2.66 * 160, width: 10 }]
        }),
        grabber = morph({
          name: 'knob',
          type: 'ellipse',
          nativeCursor: '-webkit-grab',
          fill: Color.red,
          borderColor: Color.black,
          borderWidth: 1,
          center: pt(100, 100),
          draggable: true
        }),
        {
          type: 'label',
          name: 'point value view',
          padding: 4,
          opacity: 0,
          styleClasses: ['Tooltip']
        },
        {
          position: pt(10, 10),
          type: 'label',
          name: 'resolution view',
          padding: 4,
          styleClasses: ['Tooltip']
        }
      ]
    })];
    scroller.scroll = pt(0, 0.75 * 160);
    connect(grabber, 'onDragStart', this, 'showPointValue');
    connect(grabber, 'onDrag', this, 'adjustPoint');
    connect(grabber, 'onDragEnd', this, 'calibrate');
    connect(this, 'extent', this, 'relayout');
    connect(scroller, 'onScroll', this, 'refineResolution');
    return controls;
  }
}

export class RectanglePopover extends StylePopover {
  static get properties () {
    return {
      popoverColor: { defaultValue: Color.gray.lighter() },
      rectangle: { defaultValue: rect(0) }
    };
  }

  controls () {
    return [
      {
        fill: Color.transparent,
        extent: pt(120, 120),
        layout: new GridLayout({
          grid: [
            ['top', 'top scrubber'],
            ['right', 'right scrubber'],
            ['left', 'left scrubber'],
            ['bottom', 'bottom scrubber']
          ],
          columns: [0, { paddingLeft: 4 }, 1, { paddingRight: 4, fixed: true, width: 60 }],
          rows: arr.flatten(arr.range(0, 3).map(i => [i, {
            paddingTop: i == 0 ? 4 : 2,
            paddingBottom: i == 3 ? 4 : 2
          }]))
        }),
        submorphs: arr.flatten(
          ['top', 'right', 'bottom', 'left'].map(side => {
            const widget = new NumberWidget({
              master: { auto: 'styleguide://SystemWidgets/number field/light' },
              name: side + ' scrubber',
              autofit: false,
              number: this.rectangle.partNamed(side)
            });
            connect(widget, 'update', this, 'rectangle', {
              updater: function ($upd, val) {
                const r = this.targetObj.rectangle;
                const sides = {
                  left: r.left(),
                  top: r.top(),
                  right: r.right(),
                  bottom: r.bottom(),
                  [side]: val
                };
                $upd(Rectangle.inset(sides.left, sides.top, sides.right, sides.bottom));
              },
              varMapping: { side, Rectangle }
            });
            return [
              {
                type: 'label',
                styleClasses: ['controlName'],
                name: side,
                value: side,
                padding: 3
              },
              widget
            ];
          })
        )
      }
    ];
  }
}

export class TextPopover extends StylePopover {
  static get properties () {
    return {
      text: { defaultValue: 'Enter some text!' }
    };
  }

  controls () {
    const editor = new Text({
      name: 'editor',
      extent: pt(300, 200),
      textString: this.text,
      lineWrapping: 'by-chars',
      ...config.codeEditor.defaultStyle
    });
    return [{
      layout: new HorizontalLayout(),
      fill: Color.transparent,
      borderColor: Color.gray,
      borderWidth: 1,
      borderRadius: 4,
      clipMode: 'hidden',
      submorphs: [editor]
    }];
  }

  get commands () {
    return super.commands.concat([
      {
        name: 'save string',
        async exec (textPopover) {
          textPopover.text = textPopover.get('editor').textString;
          signal(textPopover, 'save', textPopover.text);
          textPopover.setStatusMessage('String saved!', Color.green);
        }
      }
    ]);
  }

  get keybindings () {
    return super.keybindings.concat([
      { keys: { mac: 'Command-S', win: 'Ctrl-S' }, command: 'save string' }
    ]);
  }
}

Object.assign(popovers, {
  FillPopover,
  IconPopover,
  RectanglePopover,
  ShadowPopover,
  PointPopover,
  LayoutPopover
});
