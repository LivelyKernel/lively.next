import {
  Morph,
  morph,
  Label,
  HorizontalLayout,
  StyleSheet,
  Icon,
  GridLayout,
  config,
  InputLine
} from "lively.morphic";
import { connect, signal } from "lively.bindings";
import { Color, LinearGradient, pt, rect } from "lively.graphics";
import { num, obj } from "lively.lang";

import { FillPopover, IconPopover, RectanglePopover, ShadowPopover, PointPopover, VerticesPopover, LayoutPopover, Popover } from "./styling/style-popover.js";
import { StyleSheetEditor } from "./styling/style-sheet-editor.js";
import { ValueScrubber } from "lively.components/widgets.js";

/*

Value Widgets are the default visual elements in lively.morphic to modify
certain types of values via direct manipulation. The idea is to make frequently
reappearing types of values within the morphic system (such as Points,
Gradients, Colors etc...) easily recognizable by the user in various different
context (i.e. tools). The widgets are designed to be easily embeddable into a
variety of different context both in a programmatic and visual (that is
aesthetic) way.

Developers conceiving new tools in lively are therefore encouraged to make use
of these existing and/or add their own for new types of values as they please.

*/

/*

  About Context Sensitive Widgets:

  It so happens that some properties of morphs can not be inspected in a
  meaningful way without taking into account to which morph the current
  property belongs to.   Take for instance the example of the layout property:
  Parametrizing layouts in a visual ways often requires us to directly interact
  with the morph the layout is attached to. For instance adding and removing
  morphs to and from cells of a GridLayout can not be done via direct
  manipulation without referring top a concrete morph instance that the
  GridLayout is attached to. Though these types of properties are (fortnunately
  rare), the widgets that modify these properties require a certain context
  (that is a morph) they can bind the change requests by the user.

*/

class ContextSensitiveWidget extends Morph {

  static get properties() {
    return {
      fill: {defaultValue: Color.transparent},
      layout: {
        initialize() {
          this.layout = new HorizontalLayout();
        }
      },
      context: {/* a certain morph that the inspected property is assigned to */}
    };
  }

}

class ShortcutWidget extends ContextSensitiveWidget {

  static get properties() {
    return {
      title: {
        defaultValue: "No Title", /* Name denoting the shortcut */
        after: ["submorphs"],
        set(t) {
          this.setProperty("title", t);
          this.getSubmorphNamed("valueString").value = t;
        }
      },
      nativeCursor: {defaultValue: "pointer"},
      submorphs: {
        initialize() {
          this.submorphs = [
            Icon.makeLabel("arrow-right", {
              styleClasses: ["TreeLabel"],
              fontSize: 15, padding: rect(1,1,4,1)}),
            {type: "label", value: this.title,
              styleClasses: ["TreeLabel"],
              fontWeight: "bold",
              name: "valueString", opacity: .8,
              borderRadius: 5, padding: rect(0,1,0,0),
              nativeCursor: "pointer", fontSize: 12,
              borderWidth: 0}
          ];
        }
      }
    };
  }

  onMouseDown(evt) {
    this.openPopover();
  }

  async openPopover() {
    /* provide a tool for editing the property at hand */
  }

}

export class VerticesWidget extends ShortcutWidget {

  static get properties() {
    return {
      title: {defaultValue: "Edit Vertices"}
    };
  }

  async openPopover() {
    let editor = new VerticesPopover({pathOrPolygon: this.context});
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, "vertices", this, "vertices");
    signal(this, "openWidget", editor);
  }

}

export class StyleSheetWidget extends ShortcutWidget {

  static get properties() {
    return {
      title: {defaultValue: "Edit Style Sheets"}
    };
  }

  async openPopover() {
    let editor = new Popover({
      popoverColor: LinearGradient.create({0: Color.gray.lighter(), 1: Color.gray}),
      targetMorph: new StyleSheetEditor({target: this.context})
    });
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, "fadeOut", editor.targetMorph, "closeOpenWidget");
    signal(this, "openWidget", editor);
  }
}

export class LayoutWidget extends ShortcutWidget {

  static get properties() {
    return {
      title: {
        after: ["submorphs"],
        initialize() {
          this.title = this.context && this.context.layout ?
            "Configure " + this.context.layout.name() + " Layout" : "No Layout";
        }
      }
    };
  }

  layoutChanged() {
    this.title = this.context.layout ?
      "Configure " + this.context.layout.name() + " Layout" : "No Layout";
  }

  async openPopover() {
    let editor = new LayoutPopover({container: this.context, position: pt(0)});
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, "layoutChanged", this, "layoutChanged");
    signal(this, "openWidget", editor);
  }

}

// these can exist outside of a certain morph context

export class ColorWidget extends Morph {

  static get properties() {
    return {
      layout: {
        initialize() {
          this.layout = new HorizontalLayout({direction: "centered"});
        }
      },
      color: {defaultValue: Color.blue},
      gradientEnabled: {defaultValue: false},
      fontSize: {defaultValue: 14},
      isSelected: {
        set(selected) {
          if (this.getProperty('isSelected') != selected) {
             selected ? this.addStyleClass('selected') : this.removeStyleClass('selected');
             this.setProperty('isSelected', selected);
          }
        }
      },
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            ".ColorWidget.selected .Label": {
              fontColor: Color.white
            },
            ".ColorWidget .Label": {
              opacity:.6,
              nativeCursor: "pointer",
              fontFamily: config.codeEditor.defaultStyle.fontFamily,
              fontSize: this.fontSize,
              padding: 0
            },
            ".colorValue": {
              nativeCursor: "pointer",
              borderColor: Color.gray.darker(),
              borderWidth: 1,
              draggable: false,
              extent: pt(this.fontSize - 3, this.fontSize - 3)
            },
            "[name=valueString]": {
              opacity: .6,
              fontFamily: config.codeEditor.defaultStyle.fontFamily,
            },
            ".ColorWidget": {
              fill: Color.transparent,
              nativeCursor: "pointer",
              fontFamily: config.codeEditor.defaultStyle.fontFamily,
            }
          });
        }
      },
      submorphs: {
        initialize() {
          connect(this, "color", this, "relayout", {
            converter: (next, prev) => {
              return (prev && prev.isColor) != (next && next.isColor);
            }
          });
          this.relayout(true);
        }
      }
    };
  }

  relayout(reset) {
    if (reset) {
      if (!this.color) {
        this.submorphs = this.renderNoColor();
        return;
      }
      this.submorphs = this.color.isGradient ?
        this.renderGradientValue() : this.renderColorValue();
    } else {
      if (!this.color) return;
      this.color.isGradient ?
        this.updateGradientValue() : this.updateColorValue();
    }
  }

  updateGradientValue() {
    let gradient = this.color;
    if (gradient.stops.length * 2 == this.submorphs.length - 3) {
      // patch the stops
      var stopLabel;
      for (let i in this.color.stops) {
        let {color, offset} = gradient.stops[i];
        let {submorphs: [stopColor]} = this.submorphs[2 + i * 2];
        stopLabel = this.submorphs[3 + i * 2];
        stopColor.fill = color;
        stopLabel.value = (offset * 100).toFixed() + "%" + (i < gradient.stops.length - 1 ? "," : "");
      }
    } else {
      this.submorphs = this.renderGradientValue();
    }
  }

  renderGradientValue() {
    return [
      {
        type: "label",
        styleClasses: ["TreeLabel"],
        value: this.color.type + "(",
        name: "valueString"
      },
      ...this.renderStops(),
      {
        type: "label",
        styleClasses: ["TreeLabel"],
        value: ")"
      }
    ];
  }

  updateColorValue() {
    this.getSubmorphNamed("color box").fill = this.color;
    this.getSubmorphNamed("valueString").value = obj.safeToString(this.color);
  }

  renderNoColor() {
    return [
      {
        extent: pt(15, 15),
        fill: Color.transparent,
        submorphs: [
          {
            styleClasses: ["colorValue"],
            name: "color box",
            center: pt(5, 7.5),
            fill: Color.white,
            borderColor: Color.gray.darker(),
            borderWidth: 1,
            submorphs: [
              {
                type: "path",
                name: "no fill",
                vertices: [pt(0,0), pt(10,10)],
                borderColor: Color.red
              }
            ]
          }
        ]
      },
      {
        type: "label",
        value: "No Color",
        fontSize: 14,
        name: "valueString",
        styleClasses: ["TreeLabel"]
      }
    ];  }

  renderColorValue() {
    return [
      {
        extent: pt(15, 15),
        fill: Color.transparent,
        submorphs: [{
          styleClasses: ["colorValue"],
          name: "color box",
          center: pt(5, 7.5),
          fill: this.color,
          borderColor: Color.gray.darker(),
          nativeCursor: "pointer",
          borderWidth: 1
        }
        ]
      },
      {
        type: "label",
        value: obj.safeToString(this.color),
        fontSize: 14,
        name: "valueString",
        styleClasses: ["TreeLabel"]
      }
    ];
  }

  renderStops() {
    let gradient = this.color,
        stops = [
          {
            type: "label",
            padding: rect(0, 0, 5, 0),
            value: gradient.type == "linearGradient"
              ? num.toDegrees(gradient.vectorAsAngle()).toFixed() + "°,"
              : ""
          }
        ];
    for (let i in gradient.stops) {
      var {color, offset} = gradient.stops[i];
      stops.push({
        extent: pt(this.fontSize, this.fontSize),
        fill: Color.transparent,
        layout: new HorizontalLayout({spacing: 3}),
        submorphs: [
          {
            styleClasses: ["colorValue"],
            fill: color
          }
        ]
      });
      stops.push({
        type: "label",
        padding: rect(0,0,5,0),
        value: (offset * 100).toFixed() + "%" + (i < gradient.stops.length - 1 ? "," : "")
      });
    }
    return stops;
  }

  onMouseDown(evt) {
    this.openFillEditor();
  }

  update(color) {
    this.color = color;
  }

  async openFillEditor() {
    let editor = new FillPopover({
      fillValue: this.color,
      title: "Fill Control",
      gradientEnabled: this.gradientEnabled
    });
    editor.position = pt(0);
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, "fillValue", this, "update");
    signal(this, "openWidget", editor);
  }

}

export class BooleanWidget extends Label {

  static get properties() {
    return {
      fontFamily: {defaultValue: config.codeEditor.defaultStyle.fontFamily},
      nativeCursor: {defaultValue: "pointer"},
      boolean: {
        set(b) {
          this.setProperty("boolean", b);
          this.value = obj.safeToString(b);
          this.fontColor = this.boolean ? Color.green : Color.red;
        }
      }
    };
  }

  onMouseDown(evt) {
    this.boolean = !this.boolean;
  }

}

export class NumberWidget extends Morph {

  static get properties() {

    return {
      extent: {defaultValue: pt(55, 25)},
      number: {
        defaultValue: 0,
        set(v) {
          this.setProperty("number", v);
          this.get("value") && this.relayout(false);
        }
      },
      min: {defaultValue: -Infinity},
      max: {defaultValue: Infinity},
      floatingPoint: {defaultValue: false}, // infer that indirectly by looking at the floating point of the passed number value
      padding: {isStyleProp: true, defaultValue: rect(5,3,0,0)},
      baseFactor: {
        after: ["submorphs"],
        derived: true,
        get() {
          return this.get("value").baseFactor;
        },
        set(v) {
          this.get("value").baseFactor = v;
        }
      },
      styleClasses: {defaultValue: ["unfocused"]},
      fontColor: {
        defaultValue: Color.rgbHex("#0086b3"),
        set(v) {
          this.setProperty("fontColor", v);
          this.updateStyleSheet();
        }
      },
      isSelected: {
        set(selected) {
          if (this.getProperty('isSelected') != selected) {
             selected ? this.addStyleClass('selected') : this.removeStyleClass('selected');
             this.setProperty('isSelected', selected);
          }
        }
      },
      fontFamily: {
        defaultValue: "Sans-Serif",
        set(v) {
          this.setProperty("fontFamily", v);
          this.updateStyleSheet();
        }
      },
      fontSize: {
        defaultValue: 15,
        set(v) {
          this.setProperty("fontSize", v);
          this.updateStyleSheet();
        }
      },
      styleSheets: {
        initialize() {
          this.updateStyleSheet();
        }
      },
      layout: {
        initialize() {
          this.layout = new GridLayout({
            resizeSubmorphs: true,
            columns: [1, {paddingLeft: 5, paddingRight: 0, fixed: 25}],
            grid: [["value", "up"], ["value", "down"]]
          });
          this.update(this.number);
        }
      },
      submorphs: {
        after: ["number", "min", "max"],
        initialize() {
          this.submorphs = [
            new ValueScrubber({
              name: "value",
              value: this.number,
              floatingPoint: this.floatingPoint,
              min: this.min,
              max: this.max
            }),
            {
              type: "button",
              name: "down", styleClasses: ["buttonStyle", "TreeLabel"],
              padding: rect(4,1,0,-1),
              label: Icon.makeLabel("sort-asc", {
                rotation: Math.PI,
                autofit: false,
                padding: rect(3,0,0,-8),
                fixedHeight: true, extent: pt(8,8),
                fontSize: 12
              }).fit()
            },
            {
              type: "button",
              name: "up", styleClasses: ["buttonStyle", "TreeLabel"],
              padding: rect(4,0,0,2),
              label: Icon.makeLabel("sort-asc", {
                autofit: false,
                padding: rect(0,0,0,-9),
                fixedHeight: true, extent: pt(8,8),
                fontSize: 12
              })
            }
          ];
          connect(this.get("value"), "scrub", this, "update");
          connect(this.get("up"), "fire", this, "increment");
          connect(this.get("down"), "fire", this, "decrement");
          connect(this, "number", this, "relayout");
          this.whenRendered().then(() => {
            this.relayout();
          });
        }
      }
    };
  }

  updateStyleSheet() {
    this.styleSheets = new StyleSheet({
      ".Button": {
        clipMode: "hidden",
        fill: Color.transparent,
        borderWidth: 0
      },
      ".PropertyInspector .Button.activeStyle [name=label]": {
        fontColor: Color.white.darker()
      },
      ".Button.triggerStyle [name=label]": {
        fontColor: Color.black
      },
      ".NumberWidget": {
        clipMode: "hidden"
      },
      ".selected .Label": {
        fontColor: Color.white
      },
      "[name=value]": {
        padding: this.padding,
        fill: Color.transparent,
        fontSize: this.fontSize,
        fontColor: this.fontColor,
        fontFamily: this.fontFamily
      }
    });
  }

  update(v, fromScrubber = true) {
    this.setProperty("number", v);
    this.relayout(fromScrubber);
  }

  relayout(fromScrubber) {
    if (!fromScrubber) this.get("value").value = this.number;
    this.get("up").labelMorph.fit();
    this.get("down").labelMorph.fit();
    this.layout.col(0).width = this.get("value").textBounds().width;
  }

  onHoverIn(evt) {
    this.animate({styleClasses: ["focused"]});
  }

  onHoverOut(evt) {
    this.animate({styleClasses: ["unfocused"]});
  }

  increment() {
    if (this.max != undefined && this.number >= this.max) return;
    this.update(this.number + 1, false);
  }

  decrement() {
    if (this.min != undefined && this.number <= this.min) return;
    this.update(this.number - 1, false);
  }
}

export class ShadowWidget extends Morph {

  static get properties() {
    return {
      shadowValue: {
        after: ["submorphs"],
        defaultValue: null,
        set(v) {
          this.setProperty("shadowValue", v);
          this.renderShadowDisplay();
        }
      },
      fill: {defaultValue: Color.transparent},
      nativeCursor: {defaultValue: "pointer"},
      fontSize: {defaultValue: 12},
      layout: {
        initialize() {
          this.layout = new HorizontalLayout();
        }
      },
      submorphs: {
        initialize() {
          this.update();
        }
      }
    };
  }

  onMouseDown(evt) {
    this.openPopover();
  }

  async openPopover() {
    let shadowEditor = new ShadowPopover({shadowValue: this.shadowValue, position: pt(0)});
    await shadowEditor.fadeIntoWorld(this.globalBounds().center());
    connect(shadowEditor, "shadowValue", this, "shadowValue");
    connect(this, "shadowValue", this, "update");
    signal(this, "openWidget", shadowEditor);
  }

  update() {
    this.renderShadowDisplay();
  }

  renderShadowDisplay() {
    if (!this.shadowValue) {
      this.submorphs = [
        {
          opacity: 0.8,
          reactsToPointer: false,
          styleClasses: ["TreeLabel"],
          name: "valueString",
          type: "label",
          value: "No Shadow"
        }
      ];
      return;
    }
    if (this.submorphs.length > 1) {
      this.updateShadowDisplay();
    } else {
      this.initShadowDisplay();
    }
  }
  updateShadowDisplay() {
    let {inset, blur, spread, distance, color} = this.shadowValue,
        [nameLabel, {submorphs: [shadowColor]}, paramLabel] = this.submorphs;
    nameLabel.value  = `${this.shadowValue.inset ? "inset" : "drop"}-shadow(`;
    shadowColor.fill = color;
    paramLabel.value = `, ${blur}px, ${distance}px, ${spread}px)`;
  }

  initShadowDisplay() {
    let {inset, blur, spread, distance, color} = this.shadowValue;
    this.submorphs = [
      {name: "valueString", opacity: .7, reactsToPointer: false,
        type: "label", value: `${this.shadowValue.inset ? "inset" : "drop"}-shadow(`},
      morph({
        fill: Color.transparent,
        extent: pt(this.fontSize + 6, this.fontSize + 4),
        submorphs: [
          {
            extent: pt(this.fontSize, this.fontSize),
            position: pt(2, 2),
            fill: color,
            borderColor: Color.black,
            borderWidth: 1
          }
        ]
      }),
      {name: "valueString", type: "label", opacity: .7,reactsToPointer: false,
        value: `, ${blur}px, ${distance}px, ${spread}px)`}
    ];
  }

}

export class PointWidget extends Label {

  static get properties() {
    return {
      isSelected: {
        defaultValue: "false",
        set(v) {
          this.setProperty("isSelected", v);
          this.fontColor = v ? Color.white : Color.blue;
        }
      },
      fontFamily: {defaultValue: config.codeEditor.defaultStyle.fontFamily},
      nativeCursor: {defaultValue: "pointer"},
      styleClasses: {defaultValue: ["TreeLabel"]}, // in order to be highlighted in tree
      pointValue: {
        after: ["textAndAttributes"],
        set(p) {
          let fontColor = Color.rgbHex("#0086b3");
          this.setProperty("pointValue", p);
          this.textAndAttributes = ["pt(", {},
            p.x.toFixed(), {fontColor},
            ",", {},
            p.y.toFixed(), {fontColor}, ")", {}];
          this.fixedWidth = true;
          this.fixedHeight = true;
          this.height = 20;
          this.width = this.textString.length * this.fontSize;
        }
      }
    };
  }

  onMouseDown(evt) {
    this.openPopover();
  }

  async openPopover() {
    let editor = new PointPopover({pointValue: this.pointValue});
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, "pointValue", this, "pointValue");
    signal(this, "openWidget", editor);
  }

}

export class PaddingWidget extends Label {

  static get properties() {
    return {
      nativeCursor: {defaultValue: "pointer"},
      styleClasses: {defaultValue: ["TreeLabel"]},
      fontFamily: {defaultValue: config.codeEditor.defaultStyle.fontFamily},
      isSelected: {
        defaultValue: "false",
        set(v) {
          this.setProperty("isSelected", v);
          this.fontColor = v ? Color.white : Color.blue;
        }
      },
      rectangle: {
        defaultValue: rect(0),
        set(r) {
          this.setProperty("rectangle", r);
          this.value = obj.safeToString(r);
        }
      }
    };
  }

  onMouseDown(evt) {
    this.openPopover();
  }

  async openPopover() {
    let editor = new RectanglePopover({rectangle: this.rectangle});
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, "rectangle", this, "rectangle");
    signal(this, "openWidget", editor);
  }
}

export class IconWidget extends Label {

  static get properties() {
    return {
      fontColor: {defaultValue: Color.gray.darker()},
      fontFamily: {defaultValue: "FontAwesome"},
      nativeCursor: {defaultValue: "pointer"},
      iconValue: {
        derived: true,
        get() {
          return this.value;
        },
        set(v) {
          this.value = v || "No Icon";
        }
      }
    };
  }

  onMouseDown(evt) {
    this.openPopover();
  }

  async openPopover() {
    let iconPicker = new IconPopover();
    await iconPicker.fadeIntoWorld(this.globalBounds().center());
    connect(iconPicker, "select", this, "iconValue", {converter: (iconName) => {
      return iconName && Icon.makeLabel(iconName).value;
    }, varMapping: {Icon}});
    signal(this, "openWidget", iconPicker);
  }

}

export class StringWidget extends InputLine {

  // inline editing of string, very basic
  static get properties() {
    return {
      fill: {defaultValue: Color.transparent},
      fontColor: {defaultValue: Color.blue},
      nativeCursor: {defaultValue: "auto"},
      borderColor: {defaultValue: Color.transparent},
      borderStyle: {defaultValue: "dashed"},
      borderRadius: {defaultValue: 4},
      borderWidth: {defaultValue: 1},
      padding: {defaultValue: rect(0,0,0,0)},
      fixedWidth:   {defaultValue: false},
      fixedHeight:   {defaultValue: false},
      stringValue: {
        after: ["textString"],
        set(v) {
          this.setProperty("stringValue", v);
          this.textString = this.truncate(v);
          this.nativeCursor = this.stringTooLong ? "pointer" : "auto";
        }
      },
      stringTooLong: {
        readOnly: true,
        get() { return this.stringValue.includes("\n"); }
      },
      isSelected: {
        defaultValue: "false",
        set(v) {
          this.setProperty("isSelected", v);
          this.fontColor = v ? Color.white : Color.blue;
        }
      }
    };
  }

  truncate(s) {
    if (s.length > 200) {
      return s.slice(1, 20) + "...";
    } else {
      return s;
    }
  }

  async onFocus(evt) {
    super.onFocus(evt);
    if (this.readOnly) return;
    if (!this.stringTooLong) {
      this.borderColor = Color.white.withA(.9);
      this.textString = this.stringValue;
      return;
    }
    let result = await this.world().editPrompt(
      "edit string", {requester: this,input: this.stringValue});
    if (typeof result === "string") this.onInput(result);
  }

  onBlur(evt) {
    super.onBlur(evt);
    if (this.readOnly) return;
    this.borderColor = Color.transparent;
    this.onInput(this.textString);
  }

  onInput(input) {
    this.owner.focus();
    signal(this, "inputAccepted", input);
    this.stringValue = input;
  }

}
