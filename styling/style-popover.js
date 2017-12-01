/*global target,connection*/
import {
  Morph, Icon,
  ProportionalLayout,
  config,
  Text,
  ShadowObject,
  GridLayout,
  TilingLayout,
  StyleSheet,
  CustomLayout,
  morph,
  HorizontalLayout,
  VerticalLayout,
} from "lively.morphic";
import KeyHandler from "lively.morphic/events/KeyHandler.js";

import { connect, signal } from "lively.bindings";
import { arr, string, obj } from "lively.lang";
import { Color, rect, Rectangle, pt } from "lively.graphics";

import {
  ModeSelector,
  DropDownSelector,
  SearchField,
  CheckBox
} from "lively.components/widgets.js";

import { SvgStyleHalo } from "lively.halos/vertices.js";

import { GradientEditor } from "./gradient-editor.js";
import { ColorPickerField } from "./color-picker.js";
import { NumberWidget } from "../value-widgets.js";
import { Icons } from "lively.morphic/text/icons.js";


const duration = 200;

export class Popover extends Morph {

  static get properties() {
    return {
      popoverColor: {
        defaultValue: Color.rgbHex('c9c9c9'),
        set(v) {
          this.setProperty('popoverColor', v);
          this.updateStyleSheet();
        }
      },

      targetMorph: {
        derived: true,
        after: ['submorphs'],
        defaultValue: {
          extent: pt(200, 200),
          fill: Color.transparent,
          submorphs: [
            {
              name: "placeholder",
              type: "label",
              value: "No Target Specified"
            }
          ]
        },
        get() { return this.get('body').submorphs[0]; },
        set(m) {
          this.get('body').addMorph(m);
          this.relayout();
        }
      },

      styleSheets: {
        initialize() {
          this.updateStyleSheet();
        }
      },

      layout: {
        initialize() {
          this.layout = new CustomLayout({
            relayout(self, animated) { self.relayout(animated); }
          });
        }
      },

      submorphs: {
        initialize() {
          this.submorphs = [
            {
              type: "polygon",
              name: "arrow",
              borderColor: Color.transparent,
              vertices: [pt(-10, 0), pt(0, -15), pt(10, 0)]
            },
            {name: "body"},
            {
              name: "close button",
              type: "button",
              label: Object.assign(Icon.makeLabel("times-circle"), {fontSize: 18}),
              tooltip: "close",
              fill: null,
              extent: pt(16,16),
              borderColor: Color.transparent,
            }
          ];
          let [_1, _2, btn] = this.submorphs;
          connect(btn, 'fire', this, 'close');
        }
      }
    };
  }

  relayout(animated) {
    let body = this.get("body"),
        arrow = this.get("arrow"),
        closeBtn = this.get("close button"),
        offset = arrow.height;
    if (body.extent.equals(this.extent)) return;
    if (animated) {
      this.animate({extent: body.extent, duration});
      body.animate({topCenter: pt(0, offset), duration});
      closeBtn.animate({topRight: body.topRight.addXY(8, -8), duration});
    } else {
      this.extent = body.extent;
      body.topCenter = pt(0, offset);
      closeBtn.topRight = body.topRight.addXY(8, -8);
    }
  }

  updateStyleSheet() {
    this.styleSheets = new StyleSheet({
      ".Popover": {
        dropShadow: true,
        fill: Color.transparent,
        borderRadius: 4
      },
      "[name=body]": {
        layout: new VerticalLayout({resizeContainer: true}),
        fill: this.popoverColor,
        borderRadius: 4,
        clipMode: "hidden"
      },
      ".controlName": {
          fontSize: 14,
          padding: rect(0, 3, 0, 0),
          opacity: 0.5,
          fontWeight: 'bold'
        },
      ".NumberWidget": {
        padding: rect(5, 3, 0, 0),
        borderRadius: 3,
        borderWidth: 1,
        borderColor: Color.gray
      },
      "[name=arrow]": {
        fill: this.popoverColor.isGradient ?
          this.popoverColor.stops[0].color : this.popoverColor,
        dropShadow: {blur: 3, color: Color.black.withA(0.4)},
        draggable: false
      },
    });
  }

  close() {
    this.fadeOut(300);
  }

}

class SelectableControl extends Morph {

  static get properties() {
    return {
      target: {
        type: 'Morph'
      },
      selectableControls: {},
      selectedControl: {},
      fill: {defaultValue: Color.transparent},
      layout: {
        initialize() {
          this.layout = new VerticalLayout({
            spacing: 10, autoResize: true,
            layoutOrder: function(m) {
              return this.container.submorphs.indexOf(m)
            }
          });
        }
      },
      submorphs: {
        after: ['selectableControls', 'selectedControl', 'target'],
        initialize() {
          const modeSelector = new ModeSelector({
            name: "modeSelector",
            items: this.selectableControls,
            init: this.selectedControl
          });
          this.submorphs = [modeSelector];
          modeSelector.width = 100;
          connect(modeSelector, "switchLabel", this, "select");
          this.select(this.selectableControls[this.selectedControl]);
        }
      }
    };
  }

  async select(cmd) {
    if (!this.target) return;
    const control = await this.target.execCommand(cmd),
          selector = this.get("modeSelector");
    control.opacity = 0;
    if (this.lastLabel) {
       let lr = selector.submorphs.indexOf(this.lastLabel) < selector.submorphs.indexOf(selector.currentLabel);
       control.topLeft = selector.bottomLeft.addXY(lr ? 20 : -20,10);
    }
    this.lastLabel = selector.currentLabel;
    this.animate({submorphs: [selector, control], duration});
    control.animate({opacity: 1, duration});
  }
}

class ToggledControl extends Morph {

  static get properties() {
    return {
      title: {defaultValue: 'Toggled Property'},
      toggledControl: {},
      checked: {},
      clipMode: {defaultValue: "hidden"},
      fill: {defaultValue: Color.transparent},
      layout: {
        initialize() {
          this.layout = new VerticalLayout({spacing: 5});
        }
      },
      submorphs: {
        initialize() {
          const toggler = new CheckBox({checked: this.checked});
          this.submorphs = [
            {
              fill: Color.transparent,
              layout: new HorizontalLayout({autoResize: false}),
              height: 25,
              submorphs: [
                {
                  type: "label",
                  name: "property name",
                  fontWeight: 'bold',
                  fontSize: 14,
                  autofit: true,
                  opacity: .8,
                  padding: rect(0,2,3,0),
                  textString: this.title,
                  styleClasses: ["controlLabel"]
                },
                toggler
              ]
            }
          ];
          this.toggle(this.checked);
          connect(toggler, "toggle", this, "toggle");
        }
      }
    }
  }

  toggle(value) {
    const [title] = this.submorphs,
          valueControl = this.toggledControl(value),
          submorphs = [title, ...(valueControl ? [valueControl] : [])];
    signal(this, "update", value && valueControl.value);
    if (valueControl) valueControl.opacity = 0;
    this.animate({submorphs, duration});
    if (valueControl) valueControl.animate({opacity: 1, duration});
  }

}

class StylePopover extends Popover {

  static get properties() {
    return {
      targetMorph: {
        initialize() {
          this.targetMorph = morph({
            fill: Color.transparent,
            submorphs: this.controls()});
          this.setupConnections();
        }
      }
    }
  }

  setupConnections() {
    // wire up signals and events to morphs
  }

  controls() {
    // return an array of control elements
    return [];
  }

}

export class IconPopover extends StylePopover {

  static get properties() {
    return {
      popoverColor: {defaultValue: Color.gray.lighter()},
      ui: {
        get() {
          return {
            searchInput: this.get('searchInput'),
            iconList: this.get('iconList')
          }
        }
      }
    };
  }

  updateStyleSheet() {
    super.updateStyleSheet();
    this.styleSheets = [...this.styleSheets, new StyleSheet({
        "[name=iconList]": {
          padding: 8,
          fill: Color.transparent,
          fontFamily: "FontAwesome",
          clipMode: "auto",
          lineWrapping: "by-chars",
          fontSize: 25,
          textAlign: "justify",
        }
    })]
  }

  controls() {
    let width = 200,
        height = 200,
        margin = 4,
        searchBarHeight = 20;
    return [
      {
        draggable: false,
        layout: new VerticalLayout({spacing: 4}),
        fill: Color.transparent,
        submorphs: [
          new SearchField({
            name: "searchInput",
            width,
            placeHolder: "Search Icons"
          }),
          morph({
            textAndAttributes: this.iconAsTextAttributes(),
            name: "iconList",
            type: "text",
            extent: pt(width, height),
            textStyleClasses: ["fa"],
            clipMode: 'auto',
            readOnly: true
          })
        ]
      }
    ];
  }

  setupConnections() {
    let {searchInput, iconList} = this.ui;
    connect(searchInput, "searchInput", this, "filterIcons");
    connect(iconList, "onMouseUp", this, "iconSelectClick");
  }

  iconAsTextAttributes(filterFn) {
    let iconNames = Object.keys(Icons);
    if (filterFn) iconNames = iconNames.filter(filterFn);
    return arr.flatmap(iconNames,
      name => [
        Icons[name].code,
      {iconCode: Icons[name].code, iconName: name},
      " ", null
    ]);
  }

  filterIcons() {
    this.ui.iconList.textAndAttributes = this.iconAsTextAttributes(name =>
      this.ui.searchInput.matches(name.toLowerCase())
    );
  }

  iconSelectClick(evt) {
    // let iconList = this.get("icon-list");
    let textPos = this.ui.iconList.textPositionFromPoint(evt.positionIn(this.ui.iconList)),
        iconName = this.iconAtTextPos(textPos);
    this.setStatusMessage(iconName);
    signal(this, "select", iconName);
  }

  iconAtTextPos({row, column}) {
    let iconList = this.ui.iconList,
        range = {start: {row, column: column-1}, end: {row, column: column+1}},
        found = iconList.textAndAttributesInRange(range);
    while (found.length) {
      if (found[1]) break;
      found = found.slice(2)
    }
    return found.length ? found[1].iconName : null;
  }

}

export class LayoutPopover extends StylePopover {

  static get properties() {
    return {
      container: {},
      popoverColor: {defaultValue: Color.gray.lighter()}
    }
  }

  getLayoutObjects() {
    return [
      null,
      new HorizontalLayout({autoResize: false}),
      new VerticalLayout({autoResize: false}),
      new TilingLayout(),
      new ProportionalLayout(),
      new GridLayout({grid: [[null], [null], [null]]})
    ];
  }

  close() {
    super.close();
    this.clearLayoutHalo();
  }

  controls() {
    this.showLayoutHaloFor(this.container);
    return [
      {
        fill: Color.transparent,
        layout: new VerticalLayout({
          spacing: 5,
          layoutOrder: function(m) {
            return this.container.submorphs.indexOf(m);
          }
        }),
        submorphs: [this.layoutPicker(), this.layoutControls()]
      }];
  }

  updateControls() {
    this.get('Layout Type').relayout();
    this.getSubmorphNamed("controlContainer").animate(this.layoutHalo ? {
      isLayoutable: true,
      submorphs: this.layoutHalo.optionControls(this),
      duration: 300
    } : {
      isLayoutable: false,
      extent: pt(0, 0), submorphs: [],
      duration: 300
    });
  }

  showLayoutHaloFor(morph) {
    this.clearLayoutHalo();
    if (!morph || !morph.layout) return;
    let world = morph.world() || morph.env.world;
    this.layoutHalo = world.showLayoutHaloFor(morph);
  }

  clearLayoutHalo() {
    if (this.layoutHalo) {
      this.layoutHalo.remove();
      this.layoutHalo = null;
    }
  }

  getCurrentLayoutName() {
    return this.getLayoutName(this.container.layout);
  }

  getLayoutName(l) {
    return l ? l.name() + " Layout" : "No Layout";
  }

  update() {}

  applyLayout(l) {
    this.container.animate({layout: l});
    this.showLayoutHaloFor(this.container);
    this.updateControls(this.controls());
    signal(this, "layoutChanged", this.container.layout);
  }

  layoutPicker() {
    const items = this.getLayoutObjects().map(l => {
      return {[this.getLayoutName(l)]: l};
    });
    let layoutSelector = this.get("Layout Type") || new DropDownSelector({
      name: "Layout Type",
      borderRadius: 2, padding: 3,
      getCurrentValue: () => this.getCurrentLayoutName(),
      selectedValue: this.container.layout,
      values: obj.merge(items)
    });
    connect(layoutSelector, 'selectedValue', this, 'applyLayout');
    return layoutSelector;
  }

  layoutControls() {
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

  static get properties() {
    return {
      gradientEnabled: {defaultValue: true},
      fillValue: {defaultValue: Color.blue},
      popoverColor: {defaultValue: Color.gray.lighter()},
      ui: {
        get() {
          return {
            colorField: this.get('colorField'),
            fillSelector: this.get('fillSelector'),
            gradientEditor: this.get("gradient editor")
          }
        }
      }
    }
  }

  setupConnections() {
    let {fillSelector, colorField, gradientEditor} = this.ui;
    fillSelector && connect(this, 'fillValue', fillSelector, 'value');
    gradientEditor && connect(gradientEditor, 'gradientValue', this, 'fillValue');
    if (colorField) {
      connect(this, 'close', colorField, 'remove');
      connect(colorField, 'update', this, 'fillValue');
      connect(this, "onMouseDown", colorField, "removeWidgets");
    }
  }

  get commands() {
    return super.commands.concat([
      {
        name: "switch to fill",
        exec: () => {
          let p = new ColorPickerField({
            name: "colorField",
            colorValue: this.fillValue
          });
          p.whenRendered().then(() => {
            this.setupConnections();
          });
          return p;
        }
      },
      {
        name: "switch to gradient",
        exec: () => {
          const g = new GradientEditor({
            name: "gradient editor",
            gradientValue: this.fillValue
          });
          g.whenRendered().then(() => {
            this.setupConnections();
            g.update();
          });
          return g;
        }
      }
    ]);
  }

  controls() {
    if (!this.gradientEnabled) {
      return [
        {
          fill: Color.transparent,
          layout: new VerticalLayout({spacing: 4}),
          submorphs: [
            new ColorPickerField({
              name: "colorField",
              colorValue: this.fillValue
            })
          ]
        }
      ];
    }
    let selectedControl = this.fillValue && this.fillValue.isGradient ? "Gradient" : "Fill";
    return [
      new SelectableControl({
        name: "fillSelector",
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

  static get properties() {
    return {
      shadowValue: {},
      cachedShadow: {defaultValue: new ShadowObject({})},
      popoverColor: {defaultValue: Color.gray.lighter()}
    }
  }

  controls() {
    let selectedValue = (this.shadowValue ? (this.shadowValue.inset ? 'Inset Shadow' : "Drop Shadow") : 'No Shadow');
    var shadowSelector,
        controls = [
          {
            layout: new VerticalLayout({resizeContainer: true, spacing:5}),
            fill: Color.transparent,
            name: 'control container',
            submorphs: [
              (shadowSelector = new DropDownSelector({
                name: "shadow type",
                borderRadius: 2,
                padding: 3,
                selectedValue,
                values: ["No Shadow", "Drop Shadow", "Inset Shadow"]
              })),
            ].concat(this.shadowValue ? this.shadowControls() : [])
          }
        ];
    connect(shadowSelector, "selectedValue", this, "changeShadowType");
    return controls;
  }

  shadowControls() {
    let value = this.shadowValue,
        distanceInspector = new NumberWidget({
          min: 0,
          name: "distanceSlider",
          number: value.distance,
          unit: "px"
        }),
        angleSlider = new NumberWidget({
          name: "angleSlider",
          min: 0,
          max: 360,
          number: value.rotation
        }),
        spreadInspector = new NumberWidget({
          name: "spreadSlider",
          min: 0,
          number: value.spread
        }),
        blurInspector = new NumberWidget({
          name: "blurSlider",
          min: 0,
          number: value.blur
        }),
        colorField = new ColorPickerField({
          name: "colorPicker",
          colorValue: value.color
        });
    connect(colorField, "colorValue", this, "updateShadow", {converter: color => ({color})});
    connect(this, 'onMouseDown', colorField, 'removeWidgets');
    connect(this, 'close', colorField, 'remove');
    connect(spreadInspector, "update", this, "updateShadow", {converter: spread => ({spread})});
    connect(distanceInspector, "update", this, "updateShadow", {
      converter: distance => ({distance})
    });
    connect(blurInspector, "update", this, "updateShadow", {converter: blur => ({blur})});
    connect(angleSlider, "update", this, "updateShadow", {converter: rotation => ({rotation})});

    return new Morph({
      layout: new GridLayout({
        autoAssign: false,
        fitToCell: false,
        columns: [0, {paddingLeft: 1}],
        rows: arr.flatten(arr.range(0, 3).map(i => [i, {paddingBottom: 5}]), 1),
        grid: [
          ["spreadLabel", null, "spreadSlider"],
          ["distanceLabel", null, "distanceSlider"],
          ["blurLabel", null, "blurSlider"],
          ["angleLabel", null, "angleSlider"],
          ["colorLabel", null, "colorPicker"]
        ]
      }),
      width: 120,
      height: 145,
      fill: Color.transparent,
      submorphs: arr.flatten(
        [
          ["distance", distanceInspector],
          ["spread", spreadInspector],
          ["blur", blurInspector],
          ["angle", angleSlider],
          ["color", colorField]
        ].map(([value, control]) => {
          return [
            {
              type: "label",
              styleClasses: ["controlName"],
              value: string.capitalize(value) + ":",
              name: value + "Label"
            },
            control
          ];
        })
      )
    });
  }

  changeShadowType(type) {
    if (type == 'No Shadow') {
      this.toggleShadow(false)
    } else if (type == 'Inset Shadow') {
      this.toggleShadow(true)
      this.shadowValue.inset = true;
    } else {
      this.toggleShadow(true)
      this.shadowValue.inset = false;
    }
    this.get('control container').animate({
      submorphs: [this.get('shadow type')].concat(this.shadowValue ? this.shadowControls() : []),
      duration: 300
    })
  }

  updateShadow(args) {
    let {color, spread, blur, distance, rotation, inset} = this.shadowValue,
        shadow = {color, spread, blur, distance, rotation, inset, ...args};
    this.shadowValue = new ShadowObject(shadow);
  }

  toggleShadow(shadowActive) {
    if (this.shadowValue) this.cachedShadow = this.shadowValue;
    this.shadowValue = shadowActive && this.cachedShadow;
  }

}

const milimeter = 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Millimeterpapier_10_x_10_cm.svg';

export class PointPopover extends StylePopover {

  static get properties() {
    return {
      pointValue: {defaultValue: pt(0,0)},
      resolution: {defaultValue: 1}
    }
  }

  refineResolution(evt) {
    this.resolution = .25 + this.get('scroller').scroll.y / 160;
    this.relayout();
  }

  adjustPoint({state: {dragDelta}}) {
    this.pointValue = this.pointValue.addPt(dragDelta.scaleBy(1/this.resolution)).roundTo(1);
    this.relayout();
  }

  relayout() {
    super.relayout();
    let m = this.getSubmorphNamed('mesh'),
        pv = this.getSubmorphNamed('point value view');
    m.origin = m.innerBounds().center().addXY(4,1);
    m.position = this.innerBounds().center();
    m.scale = this.resolution;
    this.getSubmorphNamed('resolution view').value = "Resolution: " + this.resolution.toFixed(2) + 'x';
    pv.value = obj.safeToString(this.pointValue);
    pv.position = this.getSubmorphNamed('knob').bottomRight;
  }

  constructor(props) {
    super(props);
    this.whenRendered().then(() => this.relayout());
  }

  async calibrate() {
    this.get('knob').animate({center: this.innerBounds().center(), duration: 200});
    await this.getSubmorphNamed('point value view').animate({opacity: 0, duration: 200})
    this.relayout();
  }

  showPointValue() {
    this.getSubmorphNamed('point value view').animate({opacity: 1, duration: 200})
  }

  controls() {
    var scroller, grabber,
        controls =  [morph({
      extent: pt(200,200),
      clipMode: 'hidden',
      fill: Color.transparent,
      submorphs: [
        {
          type: 'image',
          name: 'mesh',
          fill: Color.transparent,
          opacity: .5,
          imageUrl: milimeter,
          autoResize: true,
        },
        {
          extent: pt(200,200),
          draggable: false,
          dropShadow: {inset: true, spread: 5, color: Color.gray},
          fill: Color.transparent
        },
        scroller = morph({
          name: 'scroller',
          extent: pt(200,200),
          clipMode: 'scroll',
          draggable: false,
          opacity: 0.01,
          submorphs: [{height: 200 + 2.66 * 160, width: 10}]
        }),
        grabber = morph({
          name: 'knob',
          type: 'ellipse',
          nativeCursor: '-webkit-grab',
          fill: Color.red,
          borderColor: Color.black,
          borderWidth: 1,
          center: pt(100,100)
        }),
        {
          type: 'label',
          name: 'point value view',
          padding: 4,
          opacity: 0,
          styleClasses: ['Tooltip']
        },
        {
          position: pt(10,10),
          type: 'label',
          name: 'resolution view',
          padding: 4,
          styleClasses: ['Tooltip']
        }
      ]
    })];
    scroller.scroll = pt(0,.75 * 160);
    connect(grabber, 'onDragStart', this, 'showPointValue');
    connect(grabber, 'onDrag', this, 'adjustPoint');
    connect(grabber, 'onDragEnd', this, 'calibrate');
    connect(this, 'extent', this, 'relayout');
    connect(scroller, 'onScroll', this, 'refineResolution');
    return controls;
  }

}

export class VerticesPopover extends StylePopover {

  static get properties() {
    return {
      pathOrPolygon: {},
      popoverColor: {defaultValue: Color.gray.lighter()}
    }
  }

  controls() {
    this.showVertexHaloFor(this.pathOrPolygon)
    this.whenRendered().then(() => {
      signal(this, "add vertices");
      this.focus()
    });
    return this.vertexEditModes(this.pathOrPolygon);
  }

  showVertexHaloFor(pathOrPolygon) {
    if (!this.vertexHalo) this.vertexHalo = new SvgStyleHalo({target: pathOrPolygon}).openInWorld();
    this.vertexHalo.relayout();
    connect(this, "add vertices", this.vertexHalo, "startAddingVertices");
    connect(this, "delete vertices", this.vertexHalo, "startDeletingVertices");
    connect(this, "transform vertices", this.vertexHalo, "startTransformingVertices");
  }

  close() {
    super.close();
    this.vertexHalo.remove();
    this.vertexHalo = null;
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Alt-A", command: "add vertices"},
      {keys: "Alt-D", command: "delete vertices"},
      {keys: "Alt-S", command: "transform vertices"}
    ]);
  }

  get commands() {
    return [
      {
        name: "add vertices",
        doc: "Add Anchor Points",
        exec: () => signal(this, "add vertices")
      },
      {
        name: "delete vertices",
        doc: "Remove Anchor Points",
        exec: () => signal(this, "delete vertices")
      },
      {
        name: "transform vertices",
        doc: "Transform Control Points",
        exec: () => signal(this, "transform vertices")
      }
    ];
  }

  vertexEditModes(target) {
    return [{
      fill: Color.transparent,
      layout: new VerticalLayout({spacing: 5}),
      styleSheets: new StyleSheet({
        ".modeLabel": {
          fontColor: Color.white,
          fontWeight: "bold",
          fill: Color.transparent,
        },
        '.inactive': {opacity: .5},
        ".modeBox": {borderRadius: 5, nativeCursor: "pointer"},
        ".addMode": {fill: Color.rgb(39, 174, 96)},
        ".deleteMode": {fill: Color.rgb(231, 76, 60)},
        ".transformMode": {fill: Color.rgb(52, 152, 219)}
      }),
      submorphs: this.modes = KeyHandler.generateCommandToKeybindingMap(this).map(ea => {
        return this.newVertexMode(ea);
      })
    }];
  }

  newVertexMode(cmd) {
    const self = this,
      {prettyKeys, command: {doc, name}} = cmd,
      m = new Morph({
        styleClasses: this.commandToMorphClasses(cmd.command),
        layout: new HorizontalLayout({spacing: 5}),
        submorphs: [
          {type: "label", value: doc,
           reactsToPointer: false, styleClasses: ["modeLabel"]},
          {
            type: "label",
            value: prettyKeys.join(" "),
            styleClasses: ["modeLabel"]
          }
        ]
      });
    connect(m, 'onMouseDown', this, 'execCommand', {converter: () => cmd.command, varMapping: {cmd}});
    connect(this, name, this, "activate", {converter: () => m, varMapping: {m}});
    return m;
  }

  activate(mode) {
    this.modes.forEach(m => {
      m.addStyleClass('inactive');
    })
    mode.removeStyleClass('inactive');
  }

  commandToMorphClasses(cmd) {
    return {
      "add vertices": ["modeBox", "addMode"],
      "delete vertices": ["modeBox", "deleteMode"],
      "transform vertices": ["modeBox", "transformMode"]
    }[cmd.name];
  }
}

export class RectanglePopover extends StylePopover {

  static get properties() {
    return {
      popoverColor: {defaultValue: Color.gray.lighter()},
      rectangle: {defaultValue: rect(0)}
    }
  }

  controls() {
    return [
      {
        fill: Color.transparent,
        extent: pt(120, 100),
        layout: new GridLayout({
          grid: [
            ["top", "top scrubber"],
            ["right", "right scrubber"],
            ["left", "left scrubber"],
            ["bottom", "bottom scrubber"]
          ],
          columns: [0, {paddingLeft: 2}, 1, {paddingRight: 2, fixed: true, width: 40}],
          rows: arr.flatten(arr.range(0, 3).map(i => [i, {paddingTop: 2, paddingBottom: 2}]))
        }),
        submorphs: arr.flatten(
          ["top", "right", "bottom", "left"].map(side => {
            let widget = new NumberWidget({
              name: side + " scrubber",
              number: this.rectangle.partNamed(side)
            });
            connect(widget, "update", this, "rectangle", {
              updater: function($upd, val) {
                let r = this.targetObj.rectangle,
                    sides = {
                      left: r.left(),
                      top: r.top(),
                      right: r.right(),
                      bottom: r.bottom(),
                      [side]: val
                    };
                $upd(Rectangle.inset(sides.left, sides.top, sides.right, sides.bottom));
              },
              varMapping: {side, Rectangle}
            });
            return [
              {
                type: "label",
                styleClasses: ["controlName"],
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
  }}

export class TextPopover extends StylePopover {

  static get properties() {
    return {
      text: {defaultValue: 'Enter some text!'}
    }
  }

  controls() {
    let editor = new Text({
            name: "editor",
            extent: pt(300,200),
            textString: this.text,
            lineWrapping: "by-chars",
            ...config.codeEditor.defaultStyle
          });
    return [{layout: new HorizontalLayout(),
             fill: Color.transparent,
             borderColor: Color.gray,
             borderWidth: 1, borderRadius: 4,
             clipMode: 'hidden',
             submorphs: [editor]}]
  }

  get commands() {
    return super.commands.concat([
      {
        name: "save string",
        async exec(textPopover) {
          textPopover.text = textPopover.get('editor').textString;
          signal(textPopover, 'save', textPopover.text);
          textPopover.setStatusMessage(`String saved!`, Color.green);
        }
      }
    ]);
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: {mac: "Command-S", win: "Ctrl-S"}, command: "save string"}
    ]);
  }

}
