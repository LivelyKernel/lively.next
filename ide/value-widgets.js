import { Morph, Text, morph, Label, HorizontalLayout, 
        StyleSheet, Icon, GridLayout, config } from "lively.morphic";
import { connect, signal } from "lively.bindings";
import { Color, LinearGradient, pt, rect } from "lively.graphics";
import { ValueScrubber } from "../components/widgets.js";
import { FillPopover, ShadowPopover, PointPopover, VerticesPopover, LayoutPopover, Popover } from "./styling/style-popover.js";
import { num, obj } from "lively.lang";
import { StyleSheetEditor } from "../style-rules.js";


//new NumberWidget().openInWorld()

// these only work if supplied together with a single morph as context

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
    }
  }
  
}

class ShortcutWidget extends ContextSensitiveWidget {
  
  static get properties() {
    return {
      title: {
        defaultValue: 'No Title', /* Name denoting the shortcut */ 
        after: ['submorphs'],
        set(t) {
          this.setProperty('title', t);
          this.getSubmorphNamed('valueString').value = t;
        }
      },
      nativeCursor: {defaultValue: 'pointer'},
      submorphs: {
        initialize() {
          this.submorphs = [
            Icon.makeLabel('arrow-right', {fontSize: 15, padding: rect(1,1,4,1)}),
            {type: "label", value: this.title, fontSize: 14, 
             fontWeight: 'bold',
             name: 'valueString', opacity: .8,
             borderRadius: 5, padding: rect(0,1,0,0), 
             nativeCursor: 'pointer', fontSize: 12,
             borderWidth: 0}
          ];
        }
      }
    }
  }

  onMouseDown(evt) {
    this.openPopover();
  }

  openPopover() {
    /* provide a tool for editing the property at hand */
  }
  
} 

export class VerticesWidget extends ShortcutWidget {

  static get properties() {
    return {
      title: {defaultValue: 'Edit Vertices'}
    }
  }

  openPopover() {
     let editor = new VerticesPopover({pathOrPolygon: this.context});
     editor.fadeIntoWorld(this.globalBounds().center());
     connect(editor, 'vertices', this, 'vertices');
     signal(this, "openWidget", editor);
  }
  
} 

export class StyleSheetWidget extends ShortcutWidget {

  static get properties() {
    return {
      title: {defaultValue: 'Edit Style Sheets'}
    }
  }
  
  openPopover() {
     let editor = new Popover({
       popoverColor: LinearGradient.create({0: Color.gray.lighter(), 1: Color.gray}),
       targetMorph: new StyleSheetEditor({target: this.context})});
     editor.fadeIntoWorld(this.globalBounds().center());
     signal(this, "openWidget", editor);
  }
  
}

export class LayoutWidget extends ShortcutWidget {

  static get properties() {
    return {
      title: {
        initialize() {
          this.title = this.context.layout ? 
            'Configure ' + this.context.layout.name() + ' Layout' : 'No Layout';
        }
      }
    }
  }

  layoutChanged() {
    this.title = this.context.layout ? 
            'Configure ' + this.context.layout.name() + ' Layout' : 'No Layout';
  }

  openPopover() {
    let editor = new LayoutPopover({container: this.context})
    editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, 'layoutChanged', this, 'layoutChanged');
    signal(this, "openWidget", editor);
  }
  
}

// these can exist outside of a certain morph context

export class ColorWidget extends Morph {

  static get properties() {
    return {
      layout: {
        initialize() {
           this.layout = new HorizontalLayout({direction: "centered", spacing: 1});
        }
      },
      color: {defaultValue: Color.blue},
      gradientEnabled: {defaultValue: false},
      fontSize: {defaultValue: 14},
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            ".ColorWidget .Label": {
              opacity:.6,
              nativeCursor: 'pointer',
              fontFamily: config.codeEditor.defaultStyle.fontFamily,
              fontSize: this.fontSize,
            },
            ".colorValue": {
              nativeCursor: 'pointer',
              borderColor: Color.gray.darker(),
              borderWidth: 1,
              extent: pt(this.fontSize - 3, this.fontSize - 3)
            },
            "[name=valueString]": {
              opacity: .6,
              fontFamily: config.codeEditor.defaultStyle.fontFamily,
            },
            ".ColorWidget": {
              fill: Color.transparent,
              nativeCursor: 'pointer',
              fontFamily: config.codeEditor.defaultStyle.fontFamily,
            }
          })
        }
      },
      submorphs: {
        initialize() {
          connect(this, "color", this, "relayout", {
            converter: (prev, next) => {
              return prev.isColor != next.isColor 
            }
          });
          this.relayout(true);
        }
      }
    }
  }

  relayout(reset) {
    if (reset) {
      this.submorphs = this.color.isGradient ? 
        this.renderGradientValue() : this.renderColorValue(); 
    } else {
      this.color.isGradient ? 
        this.updateGradientValue() : this.updateColorValue();
    }
  }

  updateGradientValue() {
    this.submorphs = this.renderGradientValue();
  }

  renderGradientValue() {
    return [
        {
          type: "label",
          value: this.color.type + "(",
          name: "valueString"
        },
        ...this.renderStops(),
        {
          type: "label",
          value: ")"
        }
     ];
  }

  updateColorValue() {
     this.get('color box').fill = this.color;
     this.get('valueString').value = obj.safeToString(this.color);  
  }

  renderColorValue() {
    return [
        {
          extent: pt(15, 15),
          fill: Color.transparent,
          submorphs: [{
              styleClasses: ["colorValue"],
              name: 'color box',
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
          name: "valueString"
        }
      ];
  }

  renderStops() {
    let gradient = this.color,
        stops = [
      {
        type: "label",
        padding: rect(0, 0, 5, 0),
        value: gradient.type == 'linearGradient'
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
        value: (offset * 100).toFixed() + "%" + (i < gradient.stops.length - 1 ? ',' : '')
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

  openFillEditor() {
    let editor = new FillPopover({
      fillValue: this.color,
      title: "Fill Control",
      gradientEnabled: this.gradientEnabled
    });    
    editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, "fillValue", this, "update");
    signal(this, "openWidget", editor);
  }

}

export class BooleanWidget extends Label {

  static get properties() {
    return {
      fontFamily: {defaultValue: config.codeEditor.defaultStyle.fontFamily},
      nativeCursor: {defaultValue: 'pointer'},
      boolean: {
        set(b) {
          this.setProperty('boolean', b);
          this.value = obj.safeToString(b);
          this.fontColor = this.boolean ? Color.green : Color.red;
        }
      }
    }
  }

  onMouseDown(evt) {
    this.boolean = !this.boolean;
  }

}

export class NumberWidget extends Morph {

  static get properties() {

    return {
      number: {
        defaultValue: 0,
        set(v) {
          this.setProperty('number', v);
          this.get('value') && this.relayout(false);
        }
      },
      min: {defaultValue: -Infinity},
      max: {defaultValue: Infinity},
      floatingPoint: {defaultValue: false}, // infer that indirectly by looking at the floating point of the passed number value
      padding: {isStyleProp: true, defaultValue: rect(5,3,0,0)},
      baseFactor: {
        after: ['submorphs'],
        derived: true,
        get() {
          return this.get('value').baseFactor;
        },
        set(v) {
          this.get('value').baseFactor = v;
        }
      },
      styleClasses: {defaultValue: ['unfocused']},
      fontColor: {
        defaultValue: Color.rgbHex("#0086b3"),
        set(v) {
          this.setProperty('fontColor', v);
          this.updateStyleSheet();
        }
      },
      fontFamily: {
        defaultValue: 'Sans-Serif',
        set(v) {
          this.setProperty('fontFamily', v);
          this.updateStyleSheet();
        }
      },
      fontSize: {
        defaultValue: 15,
        set(v) {
          this.setProperty('fontSize', v);
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
            columns: [1, {paddingLeft: 5, paddingRight: 5, fixed: 25}],
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
              name: "down", styleClasses: ['buttonStyle'],
              label: Icon.makeLabel("sort-asc", {
                rotation: Math.PI,
                autofit: false, 
                fixedHeight: true, extent: pt(8,8),
                padding: rect(1, 2, 0, 0), 
                fontSize: 12
              })
            },
            {
              type: "button",
              name: "up", styleClasses: ['buttonStyle'],
              label: 
              Icon.makeLabel("sort-asc", {
                autofit: false, 
                fixedHeight: true, extent: pt(8,8),
                padding: rect(0, 2, 0, 0), fontSize: 12
              })
            }
          ];
          connect(this.get("value"), "scrub", this, 'update');
          connect(this.get("up"), "fire", this, "increment");
          connect(this.get("down"), "fire", this, "decrement");
          connect(this, 'number', this, 'relayout');
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
      ".focused .Button": {visible: true},
      ".unfocused .Button": {visible: false},
      ".PropertyInspector .Button.activeStyle [name=label]": {
        fontColor: Color.white.darker()
      },
      ".Button.triggerStyle [name=label]": {
        fontColor: Color.black
      },
      ".NumberWidget": {
        extent: pt(55, 25),
        fill: this.fill || Color.transparent,
        clipMode: "hidden"
      },
      "[name=down]": {padding: rect(0, -3)},
      "[name=up]": {padding: rect(0, -5)},
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
    this.setProperty('number', v);
    this.relayout(fromScrubber);
  }

  relayout(fromScrubber) {
    if (!fromScrubber) this.get("value").value = this.number;
    this.layout.col(0).width = this.get('value').textBounds().width;
  }

  onHoverIn(evt) {
    this.animate({styleClasses: ['focused']});
  }

  onHoverOut(evt) {
    this.animate({styleClasses: ['unfocused']});
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
      shadowValue: {},
      fill: {defaultValue: Color.transparent},
      nativeCursor: {defaultValue: 'pointer'},
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
    }
  }

  onMouseDown(evt) {
    this.openPopover();
  }

  openPopover() {
    let shadowEditor = new ShadowPopover({shadowValue: this.shadowValue});
    shadowEditor.fadeIntoWorld(this.globalBounds().center());
    connect(shadowEditor, 'shadowValue', this, 'shadowValue');
    connect(this, 'shadowValue', this, 'update');
    signal(this, "openWidget", shadowEditor);
  }

  update() {
    if (!this.shadowValue) {
      this.submorphs = [{opacity: .8, reactsToPointer: false, 
                         name: 'valueString', type: 'label', value: 'No Shadow'}];
      return;
    }
    if (this.submorphs.length > 1) {
      this.updateShadowDisplay();
    } else {
      this.initShadowDisplay()
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
      {name: 'valueString', opacity: .7, reactsToPointer: false,
       type: 'label', value: `${this.shadowValue.inset ? "inset" : "drop"}-shadow(`},
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
      {name: 'valueString', type: 'label', opacity: .7,reactsToPointer: false,
       value: `, ${blur}px, ${distance}px, ${spread}px)`}
    ];
  }
  
}

export class PointWidget extends Label {

  static get properties() {
    return {
      fontFamily: {defaultValue: config.codeEditor.defaultStyle.fontFamily},
      nativeCursor: {defaultValue: 'pointer'},
      pointValue: {
        set(p) {
          this.setProperty('pointValue', p);
          this.value = obj.safeToString(p);
        }
      }    
    }
  }

  onMouseDown(evt) {
    this.openPopover();
  }

  openPopover() {
    let editor = new PointPopover({pointValue: this.pointValue});
    editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, 'pointValue', this, 'pointValue');
    signal(this, "openWidget", editor);
  }
  
}