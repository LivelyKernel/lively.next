import { Morph, ShadowObject, GridLayout, TilingLayout, StyleSheet, CustomLayout, morph, HorizontalLayout, VerticalLayout } from "lively.morphic";
import { ModeSelector, DropDownSelector, SearchField, CheckBox } from "../../components/widgets.js";
import { connect, signal } from "lively.bindings";
import { arr, string, obj } from "lively.lang";
import { Color, rect, Rectangle, pt } from "lively.graphics";
import { GradientEditor } from "./gradient-editor.js";
import { ColorPickerField } from "./color-picker.js";
import { Icons } from "../../components/icons.js";
import KeyHandler from "../../events/KeyHandler.js";
import { NumberWidget } from "../value-widgets.js";
import { range, flatten } from "lively.lang/array.js";

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
            relayout(self, animated) {
              let body = self.get('body'),
                  arrow = self.get('arrow'),
                  offset = arrow.height;
              if (body.extent == self.extent) return;
              if (animated) {
                self.animate({
                  origin: pt(body.width / 2, -offset),
                  extent: body.extent,
                  duration
                });
                body.animate({position: pt(-body.width/2,offset), duration});
              } else {                
                self.extent = body.extent;
                self.origin = pt(self.width/2,-offset);
                body.topCenter = pt(0,offset);
                arrow.bottomCenter = pt(0,offset);
              }
            }
          })
        }
      },
      submorphs: {
        after: ["targetMorph"],
        initialize() {
          this.submorphs = [
            {
              type: "polygon",
              name: "arrow",
              extent: pt(20,20),
              vertices: [pt(-1, 0), pt(0, -0.5), pt(1, 0)]
            },
            {name: "body", submorphs: [this.targetMorph]},
          ];
        }
      }
    };
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
      ".NumberWidget": {
            padding: rect(5,3,0,0),
            borderRadius: 3,
            borderWidth: 1,
            borderColor: Color.gray,
      },
      "[name=arrow]": {
        fill: this.popoverColor.isGradient ? 
          this.popoverColor.stops[0].color : this.popoverColor,
        dropShadow: {blur: 3, color: Color.black.withA(0.4)}
      },
    });
  }

  close() {
    this.openInWorld(this.position);
    this.fadeOut(300);
  }

}

class SelectableControl extends Morph {
  static get properties() {
    return {
      value: {},
      selectableControls: {},
      selectedControl: {},
      fill: {defaultValue: Color.transparent},
      layout: {
        initialize() {
          this.layout = new VerticalLayout({spacing: 10, autoResize: true});
        }
      },
      submorphs: {
        initialize() {
          const modeSelector = new ModeSelector({
            name: "modeSelector",
            items: this.selectableControls,
            init: this.selectedControl
          });
          this.submorphs = [
            modeSelector,
            this.selectableControls[this.selectedControl](this.value)
          ];
          modeSelector.width = 100;
          connect(modeSelector, "switchLabel", this, "select");
        }
      }    };
  }
  
  select(control) {
    const c = control(this.value);
    c.opacity = 0;
    this.animate({submorphs: [this.get("modeSelector"), c], duration});
    c.animate({opacity: 1, duration});
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
        }
      }
    }  
  }

  controls() {
    // return an array of control elements
    return [];
  }
  
}

export class IconPopover extends StylePopover {

  static get properties() {
    return {
      popoverColor: {defaultValue: Color.gray.lighter()}
    };
  }

  controls() {
    let width = 200, height = 200,
        margin = 4,
        searchBarHeight = 20,
        controls = [
          new SearchField({
            name: "search-input",
            width,
            placeHolder: "Search Icons"
          }),
          morph({
            textAndAttributes: this.iconAsTextAttributes(),
            name: "icon-list",
            type: "text",
            extent: pt(width, height),
            padding: Rectangle.inset(8),
            fill: Color.transparent,
            fontFamily: "FontAwesome",
            textStyleClasses: ["fa"],
            clipMode: "auto",
            lineWrapping: "by-chars",
            fontSize: 25,
            textAlign: "justify",
            readOnly: true
          })
        ];

    let [searchInput, iconList] = controls;
    connect(searchInput, "searchInput", this, "filterIcons");
    connect(iconList, "onMouseUp", this, "iconSelectClick");
    return [{
      draggable: false,
      layout: new VerticalLayout({spacing: 4}),
      fill: Color.transparent,
      submorphs: controls
    }];
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
    let searchField = this.getSubmorphNamed("search-input");
    this.getSubmorphNamed("icon-list").textAndAttributes = this.iconAsTextAttributes(name =>
      searchField.matches(name.toLowerCase())
    );
  }
  
  iconSelectClick(evt) {
    // let iconList = this.get("icon-list");
    let iconList = this.getSubmorphNamed("icon-list"),
        textPos = iconList.textPositionFromPoint(evt.positionIn(iconList)),
        iconName = this.iconAtTextPos(textPos);
    this.setStatusMessage(iconName);
    signal(this, "select", iconName);
  }

  iconAtTextPos({row, column}) {
    // let iconList = this.get("icon-list");
    let iconList = this.getSubmorphNamed("icon-list"),
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
      new GridLayout({grid: [[null], [null], [null]]})
    ];
  }

  close() {
    super.close();
    this.clearLayoutHalo();
  }

  controls() {
    this.showLayoutHaloFor(this.container)
    return [{
      fill: Color.transparent,
      layout: new VerticalLayout({spacing: 5}),
      submorphs: [this.layoutPicker(), this.layoutControls()]
    }];
  }

  updateControls() {
    if (this.layoutHalo) {
      this.getSubmorphNamed("controlContainer").animate({
        submorphs: this.layoutHalo.optionControls(),
        duration: 300
      });
    } else {
      this.getSubmorphNamed("controlContainer").animate({
        extent: pt(0, 0), submorphs: [],
        duration: 300
      });
    }
  }

  showLayoutHaloFor(morph) {
    this.clearLayoutHalo();
    if (!morph || !morph.layout) return;
    this.layoutHalo = $world.showLayoutHaloFor(morph);
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

  layoutPicker() {
    const items = this.getLayoutObjects().map(l => {
      return {
        [this.getLayoutName(l)]: () => {
          this.container.animate({layout: l});
          this.showLayoutHaloFor(this.container);
          this.updateControls(this.controls());
          signal(this, 'layoutChanged', this.container.layout);
        }
      };
    });
    let layoutSelector = this.get("Layout Type") || new DropDownSelector({
            name: "Layout Type",
            borderRadius: 2, padding: 3,
            getCurrentValue: () => this.getCurrentLayoutName(),
            selectedValue: this.container.layout,
            values: obj.merge(items)
          });
    connect(layoutSelector, 'selectedValue', this.container, 'layout');
    return layoutSelector;
  }

  layoutControls() {
    return {
      name: 'controlContainer',
      fill: Color.transparent,
      layout: new VerticalLayout(),
      submorphs: this.layoutHalo ? this.layoutHalo.optionControls() : []
    };
  }
}

export class FillPopover extends StylePopover {

  static get properties() {
    return {
      gradientEnabled: {defaultValue: true},
      fillValue: {defaultValue: Color.blue},
      popoverColor: {defaultValue: Color.gray.lighter()}
    }
  }

  getColorField(colorValue) {
    const colorField = new ColorPickerField({
      name: "colorPicker", colorValue
    });
    connect(colorField, 'update', this, 'fillValue');
    connect(this, "onMouseDown", colorField, "removeWidgets");
    return colorField;
  }
  
  controls() {
    if (!this.gradientEnabled) {
      return [{fill: Color.transparent,
              layout: new VerticalLayout({spacing: 4}),
              submorphs: [this.getColorField(this.fillValue)]}];
    }
    let selectedControl = this.fillValue && this.fillValue.isGradient ? "Gradient" : "Fill",
        fillSelector = new SelectableControl({
          value: this.fillValue,
          selectedControl,
          selectableControls: {
            Fill: value => this.getColorField(value),
            Gradient: value => {
              const g = new GradientEditor({name: "gradient editor", gradientValue: value});
              // g.gradientHandle && this.placeBehindMe(g.gradientHandle);
              // connect(g, "openHandle", this, "placeBehindMe");
              connect(g, "gradientValue", this, "fillValue");
              (async () => {
                await g.whenRendered();
                g.update();
              })();
              return g;
            }
          }
        });
    connect(this, 'fillValue', fillSelector, 'value');
    return [fillSelector];
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

  shadowControl() {
    const value = this.shadowValue;
    const distanceInspector = new NumberWidget({
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
            name: 'spreadSlider',
            min: 0,
            number: value.spread
          }),
          insetToggle = new CheckBox({
            name: "insetToggle",
            checked: value.inset
          }),
          blurInspector = new NumberWidget({
            name: "blurSlider",
            min: 0,
            number: value.blur
          }),
          colorField = new ColorPickerField({
            name: 'colorPicker', colorValue: value.color
          });
    connect(colorField, 'colorValue', this, 'updateShadow', {converter: (color) => ({color})});
    connect(spreadInspector, 'number', this, 'updateShadow', {converter: (spread) => ({spread})});
    connect(distanceInspector, 'number', this, 'updateShadow', {converter: (distance) => ({distance})});
    connect(blurInspector, 'number', this, 'updateShadow', {converter: (blur) => ({blur})});
    connect(angleSlider, 'number', this, 'updateShadow', {converter: (rotation) => ({rotation})});
    connect(insetToggle, "toggle", this, "updateShadow", {converter: (inset) => ({inset})});
    return new Morph({
      layout: new GridLayout({
        autoAssign: false,
        fitToCell: false,
        columns: [0, {paddingLeft: 1}],
        rows: flatten(range(0, 3).map(i => [i, {paddingBottom: 5}]), 1),
        grid: [
          ["spreadLabel", null, "spreadSlider"],
          ["distanceLabel", null, "distanceSlider"],
          ["blurLabel", null, "blurSlider"],
          ["angleLabel", null, "angleSlider"],
                    ["insetLabel", null, "insetToggle"],
          ["colorLabel", null, "colorPicker"]
        ]
      }),
      width: 120,
      height: 185,
      fill: Color.transparent,
      styleSheets: new StyleSheet({
        '.controlName': {
          fontSize: 14,
          padding: rect(0,3,0,0),
          opacity: .9
        }
      }),
      submorphs: arr.flatten([
        ["inset",
        insetToggle],
        ["distance",
        distanceInspector],
        ["spread",
        spreadInspector],
        ["blur",
        blurInspector],
        ['angle',
        angleSlider],
        ["color",
        colorField]
      ].map(([value, control]) => {
        return [{type: 'label', styleClasses: ['controlName'],
                 value: string.capitalize(value) + ":", name: value + 'Label'}, control]
      }))
    });
  }
  controls() {
    var shadowToggle, controls = [{
      layout: new VerticalLayout({resizeContainer: true}),
      fill: Color.transparent,
      submorphs: [shadowToggle = new ToggledControl({
        checked: !!this.shadowValue,
        title: 'Drop Shadow',
        toggledControl: (checked) => {
          this.toggleShadow(checked);
          return checked && this.shadowControl();
         }
      })]
    }];
    return controls;
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
        scroller = morph({
          name: 'scroller',
          extent: pt(200,200),
          clipMode: 'scroll',
          dropShadow: {inset: true, spread: 5, color: Color.gray},
          fill: Color.transparent,
          submorphs: [{fill: Color.transparent, height: 200 + 2.75 * 160, width: 10}]
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
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            '.modeLabel': {
              fontColor: Color.white,
              fontWeight: "bold",
              fill: Color.transparent
            },
            '.modeBox': {borderRadius: 5, nativeCursor: "pointer"},
            '.addMode': {fill: Color.rgb(39, 174, 96)},
            '.deleteMode': {fill: Color.rgb(231, 76, 60)},
            '.transformMode': {fill: Color.rgb(52, 152, 219)}
          });
        }
      },
      submorphs: {
        initialize() {
          this.vertexEditModes(this.targetMorph)
        }
      }
    }
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
    return this.createControl("Edit Modes", {
      styleClasses: ["controlWrapper"],
      layout: new VerticalLayout({spacing: 5}),
      styleSheets: this.vertexModeStyles,
      submorphs: KeyHandler.generateCommandToKeybindingMap(this).map(ea => {
        return this.newVertexMode(ea);
      })
    });
  }

  newVertexMode(cmd) {
    const self = this,
      {prettyKeys, command: {doc, name}} = cmd,
      m = new Morph({
        styleClasses: this.commandToMorphClasses(cmd.command),
        layout: new HorizontalLayout({spacing: 5}),
        onMouseDown: () => {
          this.execCommand(cmd.command);
        },
        activate() {
          signal(self, "reset modes");
          this.opacity = 1;
        },
        deactivate() {
          this.opacity = 0.5;
        },
        submorphs: [
          {type: "label", value: doc, styleClasses: ["modeLabel"]},
          {
            type: "label",
            value: prettyKeys.join(" "),
            styleClasses: ["modeLabel"]
          }
        ]
      });
    connect(this, name, m, "activate");
    connect(this, "reset modes", m, "deactivate");
    return m;
  }

  commandToMorphClasses(cmd) {
    return {
      "add vertices": ["modeBox", "addMode"],
      "delete vertices": ["modeBox", "deleteMode"],
      "transform vertices": ["modeBox", "transformMode"]
    }[cmd.name];
  } 
}