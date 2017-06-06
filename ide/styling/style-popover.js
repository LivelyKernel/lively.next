import { Morph, GridLayout, TilingLayout, StyleSheet, CustomLayout, morph, HorizontalLayout, VerticalLayout } from "lively.morphic";
import { ModeSelector, DropDownSelector, SearchField, CheckBox } from "../../components/widgets.js";
import { connect, signal } from "lively.bindings";
import { arr, obj } from "lively.lang";
import { Color, Rectangle, pt } from "lively.graphics";
import { GradientEditor } from "./gradient-editor.js";
import { ColorPickerField } from "./color-picker.js";
import { Icons } from "../../components/icons.js";
import KeyHandler from "../../events/KeyHandler.js";

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
                  autofit: true,
                  textString: this.title,
                  styleClasses: ["controlLabel"]
                },
                toggler
              ]
            }
          ];
          connect(toggler, "toggle", this, "toggle");
        }
      }    
    }
  }

  toggle(value) {
    const [title] = this.submorphs,
          valueControl = this.toggledControl,
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