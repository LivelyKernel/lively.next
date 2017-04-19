import {
  GridLayout,
  VerticalLayout,
  HorizontalLayout,
  TilingLayout, Button,
  Morph, Icon, morph
} from "../../index.js";
import {
  Rectangle,
  Color,
  LinearGradient,
  pt,
  rect
} from "lively.graphics";
import { obj, properties, arr, string } from "lively.lang";
import { signal, connect, disconnect } from "lively.bindings";
import {
  CheckBox,
  ModeSelector,
  DropDownSelector,
  Slider,
  PropertyInspector,
  Leash,
} from "../../components/widgets.js";

import { ColorPickerField } from "./color-picker.js";
import { GradientEditor } from "./gradient-editor.js";
import { StyleSheet } from "../../style-rules.js";
import KeyHandler from "../../events/KeyHandler.js";
import { loadObjectFromPartsbinFolder } from "../../partsbin.js";

const duration = 200,
      focusHalo = {
          blur: 6,
          color: Color.rgb(52,152,219),
          distance: 0,
          rotation: 45
        };
var iconPicker;

async function initIconPicker() {
  iconPicker = await loadObjectFromPartsbinFolder('IconPicker');
  iconPicker.isHaloItem = true;
}

initIconPicker();

class StyleEditor extends Morph {

  constructor(props) {
    const {title, target} = props;
    if (!target)
      throw Error("No target provided!");
    super({
      styleClasses: ["closed"],
      clipMode: "hidden",
      layout: new VerticalLayout({spacing: 5}),
      ...props
    });
    this.build();
  }

  static get properties() {
     return {
         defaultPropertyValues: {defaultValue: {}}
     }
  }

  build() {
    this.submorphs = [this.titleLabel(this.title)];
    this.styleSheets = this.styler;
    connect(this, 'submorphChanged', this, 'equalizeControlWidths');
  }

  equalizeControlWidths() {
     const maxWidth = arr.max(this.submorphs, c => c.bounds().width);
     this.submorphs.forEach(c => c.width = maxWidth);
  }

  getColorField({target, property}) {
    const colorField = new ColorPickerField({
      target,
      name: "colorPicker",
      property,
      defaultValue: this.defaultPropertyValues[property]
    });
    connect(this, "remove", colorField, "remove");
    connect(this, "onMouseDown", colorField, "removeWidgets");
    return colorField;
  }

  get styler() {
    return new StyleSheet({
      closeStylerButton: {
        fontColor: Color.gray.darker(),
        nativeCursor: "pointer",
        fill: Color.transparent,
        fontSize: 22,
        borderWidth: 0
      },
      closed: {
        dropShadow: true,
        draggable: true,
        borderColor: Color.gray,
        borderWidth: 4,
        fill: Color.black.withA(0.7),
        borderRadius: 15
      },
      opened: {
        fill: new LinearGradient({
          stops: [
            {color: Color.rgb(242, 243, 244), offset: 0},
            {color: Color.rgb(229, 231, 233), offset: 1}
          ]
        }),
        borderWidth: 1,
        borderRadius: 7,
        borderColor: Color.gray
      },
      controlLabel: {
        fontSize: 12,
        fontWeight: "bold",
        fontColor: Color.black,
        padding: rect(5, 0, 0, 0),
        fill: Color.transparent,
        readOnly: true
      },
      controlWrapper: {
        clipMode: "hidden",
        fill: Color.transparent,
        reactsToPointer: false
      }
    });
  }

  titleLabel(title) {
    return {
      fill: Color.transparent,
      layout: new HorizontalLayout(),
      onDrag: evt => this.onDrag(evt),
      nativeCursor: "pointer",
      submorphs: [
        {
          type: "label",
          fontWeight: "bold",
          padding: Rectangle.inset(5),
          fontColor: Color.gray,
          fontSize: 12,
          fill: Color.transparent,
          reactsToPointer: false,
          textString: title,
        }
      ]
    };
  }

  onMouseDown() { signal(this, "open"); this.open() }
  onMouseMove() { this.show() }

  hide() {
    if (this.opened)
      return;
    this.animate({opacity: 0, visible: false, duration});
  }

  blur() {
    if (this.opened)
      return;
    var localHandPos = this.localize(this.env.world.firstHand.position);
    if (this.innerBounds().containsPoint(localHandPos))
      return;
    this.blurred = true;
    this.animate({opacity: 0.7, duration});
  }

  show() {
    var world;
    if (this.opened)
      return;
    this.blurred = false;
    this.animate({opacity: 1, visible: true, duration});
  }

  async close() {
    this.opened = false;
    this.layout = null;
    const titleLabel = this.submorphs[0],
          {submorphs: [_, instruction]} = titleLabel;
    titleLabel.layout = null;
    titleLabel.submorphs = [instruction];
    titleLabel.animate({layout: new HorizontalLayout(), duration});
    instruction.animate({
       nativeCursor: 'pointer',
       fontColor: Color.gray,
       duration
    })
    this.animate({
      submorphs: [titleLabel],
      styleClasses: ["closed"],
      position: this.openPosition,
      layout: new VerticalLayout({spacing: 5}),
      duration
    });
    signal(this, "close", false);
  }

  open() {
    if (this.opened)
      return this;
    this.opened = true;
    const [titleLabel] = this.submorphs,
      {submorphs: [instruction]} = titleLabel;
    titleLabel.layout = null;
    this.layout = null;
    this.opacity = 1;
    this.nativeCursor = "auto";
    this.openPosition = this.position;

    var btn = morph({
      type: "button", styleClasses: ['closeStylerButton'],
      fontSize: 22,
      label: Icon.makeLabel("times-circle-o")
    });
    
    btn.fit();
    titleLabel.submorphs = [btn, instruction];
    titleLabel.animate({
        layout: new HorizontalLayout(), 
        duration});
    connect(btn, 'fire', this, 'close');
    instruction.animate({
      nativeCursor: "auto",
      fontColor: Color.gray.darker(),
      duration
    });
    this.controls(this.target).forEach(c => {
      c.opacity = 0;
      this.addMorph(c).animate({opacity: 1, duration});
    });
    this.animate({
      styleClasses: ["opened"],
      duration,
      layout: new VerticalLayout({spacing: 5})
    });
    return this;
  }

  get isHaloItem() { return true; }

  createLeashFor(target, side) {
    const leash = new Leash({
      draggable: false,
      start: pt(0, 0),
      end: pt(10, 10),
      opacity: 0
    });
    leash.startPoint.attachTo(target, side);
    leash.endPoint.attachTo(this, "center");
    leash.animate({opacity: 0.7, duration: 300});
    connect(this, "close", leash, "remove");
    connect(this, "remove", leash, "remove");
    return leash;
  }

  updateControls(newControls) {
    const [titleLabel, _] = this.submorphs;
    // this.animate({submorphs: [titleLabel, ...newControls], duration});
    this.submorphs = [titleLabel, ...newControls];
  }

  createControl(name, controlElement, toggleable) {
    return {
      name,
      styleClasses: ["controlWrapper"],
      layout: new VerticalLayout({spacing: 5}),
      submorphs: [
        {type: "text", styleClasses: ["controlLabel"], textString: name},
        controlElement
      ]
    };
  }

  createSelectableControl({controls, init}) {
    const modeSelector = new ModeSelector({
            name: "modeSelector",
            items: controls,
            init,
          }),
          selectableControl = new Morph({
            styleClasses: ["controlWrapper"],
            layout: new VerticalLayout({spacing: 10, autoResize: true}),
            remove() {
              super.remove();
              arr.invoke(this.submorphs, "remove");
            },
            select(control) {
              const c = control();
              c.opacity = 0;
              this.animate({submorphs: [modeSelector, c], duration});
              c.animate({opacity: 1, duration});
            },
            submorphs: [modeSelector, controls[init]()]
          });
    modeSelector.width = this.width - 40;
    connect(modeSelector, "switchLabel", selectableControl, "select");
    connect(selectableControl, 'extent', selectableControl, 'relayout');
    return selectableControl;
  }

  createToggledControl({title, render, target, property}) {
    if (!target || !property) throw Error("Please pass property AND target to toggled control.");
    const toggler = new CheckBox({checked: target[property]}),
          flap = new Morph({
            clipMode: "hidden",
            fill: Color.transparent,
            draggable: true,
            onDrag: evt => this.onDrag(evt),
            layout: new VerticalLayout({spacing: 5}),
            toggle(value) {
              if (value) {
                value = this.memoizedValue || value;
              } else {
                this.memoizedValue = target[property];
              }
              target[property] = value;
              const [title] = this.submorphs,
                controls = render(target[property]),
                submorphs = [title, ...(controls ? [controls] : [])];
              if (controls)
                controls.opacity = 0;
              this.animate({submorphs, duration});
              if (controls)
                controls.animate({opacity: 1, duration});
            },
            submorphs: [
              {
                fill: Color.transparent,
                layout: new HorizontalLayout({autoResize: false}),
                height: 25,
                submorphs: [
                  {type: "text", textString: title, styleClasses: ["controlLabel"]},
                  toggler
                ]
              }
            ]
          });

     connect(toggler, "toggle", flap, "toggle");
     flap.toggle(target[property]);
     return flap;
  }

  opacityControl(target) {
    return this.createControl("Opacity", new Slider({
      target,
      min: 0,
      max: 1,
      property: "opacity",
      width: 150
    }));
  }

  shadowControl(target) {
    return this.createToggledControl({
      title: "Drop Shadow",
      target,
      property: "dropShadow",
      render: value => {
        if (!value)
          return null;
        const distanceInspector = new PropertyInspector({
          name: "distanceSlider",
          min: 0,
          target: value,
          property: "distance"
        }),
          angleSlider = new PropertyInspector({
            name: "angleSlider",
            min: 0,
            max: 360,
            target: value,
            property: "rotation"
          }),
          insetToggle = new CheckBox({
            name: 'insetToggle',
            checked: value.inset
          }),
          blurInspector = new PropertyInspector({
            name: "blurSlider",
            min: 0,
            target: value,
            property: "blur"
          });
        connect(insetToggle, 'toggle', value, 'inset');
        const control = new Morph({
          width: 150,
          height: 155,
          fill: Color.transparent,
          submorphs: [
            {
              type: "label",
              value: "Inset: ",
              padding: Rectangle.inset(4),
              name: "insetLabel"
            },
            insetToggle, 
            {
              type: "label",
              value: "Distance: ",
              padding: Rectangle.inset(4),
              name: "distanceLabel"
            },
            distanceInspector,
            {
              type: "label",
              value: "Blur: ",
              padding: Rectangle.inset(4),
              name: "blurLabel"
            },
            blurInspector,
            {
              type: "label",
              value: "Angle: ",
              padding: Rectangle.inset(4),
              name: "angleLabel"
            },
            angleSlider,
            {
              type: "label",
              value: "Color: ",
              padding: Rectangle.inset(4),
              name: "colorLabel"
            },
            this.getColorField({target: value, property: "color"})
          ]
        });

        control.layout = new GridLayout({
          autoAssign: false,
          fitToCell: false,
          grid: [
            ["insetLabel", null, "insetToggle"],
            ["distanceLabel", null, "distanceSlider"],
            ["blurLabel", null, "blurSlider"],
            ["angleLabel", null, "angleSlider"],
            ["colorLabel", null, "colorPicker"]
          ]
        });
        control.layout.col(0).paddingLeft = 1;
        control.layout.row(0).paddingBottom = 5;
        control.layout.row(1).paddingBottom = 5;
        control.layout.row(2).paddingBottom = 5;
        control.layout.row(3).paddingBottom = 5;
        return control;
      }
    });
  }

}

export class BodyStyleEditor extends StyleEditor {

  controls(target) {
    return [
      this.selectedFillControl = this.fillControl(target),
      this.opacityControl(target),
      this.shadowControl(target)
    ];
  }

  remove() {
    super.remove();
    this.selectedFillControl && this.selectedFillControl.remove();
  }

  placeBehindMe(handle) {
    handle.remove();
    this.owner.addMorph(handle, this);
    handle.relayout();
  }

  fillControl(target) {
    return this.createSelectableControl({
      controls: {
        "Fill": () => this.getColorField({target, property: "fill"}),
        "Gradient": () => {
          const g = new GradientEditor({target, property: "fill"});
          g.gradientHandle && this.placeBehindMe(g.gradientHandle);
          connect(g, "openHandle", this, "placeBehindMe");
          g.update();
          return g;
        }
      },
      init: target.fill && target.fill.isGradient ? "Gradient" : "Fill"
    });
  }
}

export class BorderStyleEditor extends StyleEditor {

  controls(target) {
    return [this.borderControl(target), this.clipControl(target)];
  }

  onHoverOut() { this.blur(); }

  clipControl(target) {
    return this.createControl("Clip Mode", {
      layout: new HorizontalLayout({spacing: 5}),
      fill: Color.transparent,
      submorphs: [
        new DropDownSelector({
          isHaloItem: true,
          target,
          property: "clipMode",
          values: ["visible", "hidden", "scroll"]
        })
      ]
    });
  }

  borderControl(target) {
    return this.createControl("Border", {
      layout: new HorizontalLayout({spacing: 5, compensateOrigin: true}),
      fill: Color.transparent,
      submorphs: [
        new DropDownSelector({
          target,
          isHaloItem: true,
          property: "borderStyle",
          values: ["solid", "dashed", "dotted"]
        }),
        this.getColorField({target, property: "borderColor"}),
        new PropertyInspector({
          min: 0, defaultValue: 0,
          target,
          unit: "pt",
          property: "borderWidth"
        })
      ]
    });
  }

}

export class PolygonEditor extends BorderStyleEditor {

  constructor(props) {
    super(props);
    signal(this, "add vertices");
  }

  controls(target) {
    return [...super.controls(target), this.vertexEditModes(target)];
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

  get vertexModeStyles() {
    return new StyleSheet({
      modeLabel: {
        fontColor: Color.white,
        fontWeight: "bold",
        fill: Color.transparent
      },
      modeBox: {borderRadius: 5, nativeCursor: "pointer"},
      addMode: {fill: Color.rgb(39, 174, 96)},
      deleteMode: {fill: Color.rgb(231, 76, 60)},
      transformMode: {fill: Color.rgb(52, 152, 219)}
    });
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

export class LayoutStyleEditor extends StyleEditor {

  getLayoutObjects() {
    return [
      null,
      new HorizontalLayout({autoResize: false}),
      new VerticalLayout({autoResize: false}),
      // new FillLayout(),
      new TilingLayout(),
      new GridLayout({grid: [[null], [null], [null]]})
    ];
  }

  remove() {
    this.clearLayoutHalo();
    super.remove();
  }

  controls(target) {
    return [
      this.layoutPicker(),
      ...(this.layoutHalo ? [this.layoutControls()] : [])
    ];
  }

  open() {
    if (this.opened)
      return;
    super.open();
    this.clearLayoutHalo();
    if (this.target.layout) {
      this.layoutHalo = this
        .world()
        .showLayoutHaloFor(this.target, this.pointerId);
    }
    this.updateControls(this.controls());
  }

  clearLayoutHalo() {
    if (this.layoutHalo) {
      this.layoutHalo.remove();
      this.layoutHalo = null;
    }
  }

  close() {
    this.clearLayoutHalo();
    super.close();
  }

  getCurrentLayoutName() {
    return this.getLayoutName(this.target.layout);
  }

  getLayoutName(l) {
    return l ? l.name() + " Layout" : "No Layout";
  }

   update() {}

  layoutPicker() {
    const items = this.getLayoutObjects().map(l => {
      return {
        [this.getLayoutName(l)]: () => {
          this.target.animate({layout: l});
          this.clearLayoutHalo();
          if (this.target.layout) {
            this.layoutHalo = this
              .world()
              .showLayoutHaloFor(this.target, this.pointerId);
          }
          this.updateControls(this.controls());
        }
      };
    });
    return this.get("Layout Type") ||
      this.createControl("Layout Type", {
        name: "layoutPicker",
        styleClasses: ["controlWrapper"],
        layout: new HorizontalLayout({spacing: 5}),
        submorphs: [
          new DropDownSelector({
            isHaloItem: true,
            target: this.target,
            property: "layout",
            getCurrentValue: () => this.getCurrentLayoutName(),
            values: obj.merge(items)
          })
        ]
      });
  }

  layoutControls() {
    return this.createControl("Layout Options", {
      fill: Color.transparent,
      layout: new VerticalLayout(),
      submorphs: this.layoutHalo.optionControls()
    });
  }
}

export class HTMLEditor extends Morph {

  constructor(props) {
    super({
      extent: props.target.extent,
      fill: Color.black.withA(0.5),
      borderRadius: props.target.borderRadius,
      ...props
    });
    this.build();
  }

   get isHaloItem() { return true }

  build() {
    this.submorphs = [
      {
        type: "text",
        name: "html editor",
        textString: this.target.html,
        fontColor: Color.white,
        fontFamily: "Inconsolata, monospace",
        padding: Rectangle.inset(10, 10, 10, 2),
        fontSize: 14,
        fill: Color.transparent,
        extent: this.extent,
        clipMode: "auto"
      }
    ];
  }

  get keybindings() {
    return [
      {keys: {mac: "Meta-S", win: "Ctrl-S"}, command: "save html"}
    ]
  }
  
  get commands() {
    return [
      {
        name: "save html",
        exec() {
          this.target.html = this.get("html editor").textString;
          return true;
        }
      }
    ]
  }

  onMouseMove() { this.show() }

  blur() { this.animate({opacity: .5, duration})}
  show() { this.animate({opacity: 1, visible: true, duration}) }
  hide() { this.visible = false; }

}

export class PathEditor extends BorderStyleEditor {

  constructor(props) {
    super({title: "Change Path", ...props});
  }

  controls(target) {
    return [
      this.borderControl(target),
      this.opacityControl(target),
      this.shadowControl(target)
    ];
  }

}

export class ImageEditor extends StyleEditor {

  constructor(props) {
    super({title: "Change Image URL", name: "image editor", ...props});
  }

  controls(target) {
    return [this.urlEditor(target)];
  }

  urlEditor(target) {

    return {
      layout: new HorizontalLayout({spacing: 3}),
      fill: Color.transparent,
      styleSheets: new StyleSheet({
        urlBar: {
          borderRadius: 5,
          padding: Rectangle.inset(4),
          fill: Color.white.withA(0.8),
          fontColor: Color.gray.darker(),
          fontSize: 15
        },
        saveButton: {
          fontSize: 18,
          padding: Rectangle.inset(2),
          nativeCursor: "pointer",
          fontColor: Color.gray.darker(),
          tooltip: "Update the image URL"
        }
      }),

      submorphs: [
        {
          type: "input", name: "urlBar",
          textString: target.imageUrl,
          fixedWidth: false,
          onInput() { 
            target.imageUrl = this.get("urlBar").input;
          }
        },
        Icon.makeLabel("check-circle", {
          name: "saveButton",
          onMouseDown() {
            this.fontColor = Color.black;
            target.imageUrl = this.get("urlBar").input;
          },
          onMouseUp() {
            this.fontColor = Color.gray.darker();
          }
        })
      ]

    };
  }

}

function buttonModeSelector(buttonEditor, button, getControls) {
   var selector, 
       renderControls = (mode) => {
            buttonEditor.updateControls([selector, ...getControls(buttonEditor.switchButtonMode(button, mode))])
       };
   selector = morph({
      fill: Color.transparent,
      layout: new HorizontalLayout({spacing: 4}),
      submorphs: [{
       type: 'label',
       value: 'Button Mode: ',
       fontWeight: 'bold',
       padding: 6
      },
      new DropDownSelector({
        isHaloItem: true,
        width: buttonEditor.width - 20,
        target: buttonEditor, property: 'buttonMode',
        values: {
          "Inactive": () => renderControls('inactive'),
          "Active": () => renderControls('active'),
          "Triggered": () => renderControls('triggered')
        },
        getCurrentValue() { return string.capitalize(buttonEditor.buttonMode) }
      })]});
   return selector;
}

export class ButtonBorderEditor extends BorderStyleEditor {
 
  controls(button) {
     const getControls = (b) => [
        ...super.controls.bind(this)(b)
     ];
     this.defaultPropertyValues = button.defaultProperties
     return [buttonModeSelector(this, button, getControls), ...getControls(button)];
  }

  get buttonMode() {
     return this.target.activeMode;
  }

  close() {
     this.target.activeMode = 'active'
     super.close();
  }

  remove() {
     this.target.activeMode = 'active';
     super.remove();
  }

  switchButtonMode(button, mode) {
     button.activeMode = mode;
     return button;
  }
}


export class ButtonBodyEditor extends BodyStyleEditor {

  controls(button) {
     const getControls = (b) => [
          this.labelTypeControl(b),
          this.createControl('Font Style', this.labelControl(b)),
          ...super.controls.bind(this)(b)
       ];
     this.defaultPropertyValues = button.defaultProperties
     return [buttonModeSelector(this, button, getControls), ...getControls(button)];
  }

  get buttonMode() {
    return this.target.activeMode;
  }

  remove() {
     this.target.activeMode = 'active';
     super.remove();
  }

  close() {
     this.target.activeMode = 'active';
     super.close();
  }

  labelTypeControl(button) {
    return this.createSelectableControl({
      controls: {
        "Icon": () => {
            if (!button.labelMorph.isIcon) this.setButtonIcon('smile-o');
            return this.iconLabelControl(button)
         },
        "Text": () => {
            if (button.labelMorph.isIcon) button.label = "a button";
            return this.textLabelControl(button);
        }
      },
      init: button.labelMorph.isIcon ? "Icon" : "Text"
    })
  }

  labelControl(button) {
    var container,
        btnStyle = {
          type: "button", borderRadius: 5, padding: Rectangle.inset(0),
          grabbable: false, draggable: false, extent: pt(30,30)
        },
        fontSizeInspector = new PropertyInspector({
            name: "fontSizeInspector",
            min: 0,
            target: button,
            property: "fontSize"
          }),
        container = new Morph({
          width: 130,
          height: 100,
          fill: Color.transparent,
          submorphs: [
            {
              type: "label",
              value: "Font Size: ",
              padding: Rectangle.inset(4),
              name: "fontSizeLabel"
            },
            fontSizeInspector,
            {
              type: "label",
              value: "Font Color: ",
              padding: Rectangle.inset(4),
              name: "fontColorLabel"
            },
            this.getColorField({
               target: button, 
               property: "fontColor"
            }),
            {fill: Color.transparent, name: "rich text controls",
             layout: new HorizontalLayout({spacing: 3}),
             submorphs:[
              {name: "bold button",      ...btnStyle, label: Icon.makeLabel("bold")},
              {name: "italic button",    ...btnStyle, label: Icon.makeLabel("italic")},
              {name: "underline button", ...btnStyle, label: Icon.makeLabel("underline")}]}
          ]
        });

        container.layout = new GridLayout({
          autoAssign: false,
          fitToCell: false,
          grid: [
            ["fontSizeLabel", null, "fontSizeInspector"],
            ["fontColorLabel", null, "colorPicker"],
            ["rich text controls", "rich text controls", "rich text controls"]
          ]
        }), 
        container.layout.col(0).paddingLeft = 1;
        container.layout.row(0).paddingBottom = 5;
        return container;
  }

  textLabelControl(button) {
     let input = morph({
      type: "input", name: "button label input",
      fixedHeight: false,
      textString: button.label,
      padding: Rectangle.inset(2,5), borderRadius: 5, fontSize: 14,
      onFocus() {
        this.animate({dropShadow: focusHalo})
      },
      onBlur() {
        this.animate({dropShadow: false, duration});
        button.label = this.textString;
      }
    });
    connect(input, 'inputAccepted', button, 'label', {
      converter: function() { return this.sourceObj.input; }
    });

    return input;
  }

  setButtonIcon(iconName) {
     const v = Icon.makeLabel(iconName).value,
           changeIconButton = this.get('changeIconButton');
     if (changeIconButton) changeIconButton.label = v;
     this.target.label = v;
     if (this.iconPicker) {
       disconnect(this.iconPicker, 'select', this, 'setButtonIcon');
       this.iconPicker.remove();
     }
  }

  iconLabelControl(button) {
     // icon picker
     return morph({
        fill: Color.transparent,
        layout: new HorizontalLayout({spacing: 4}),
        submorphs: [
        {
          type: "label",
          value: "Label Icon: ",
          padding: rect(0,13,30,4)
        },
        new Button({
          name: 'changeIconButton',
          label: button.labelMorph.isIcon ? button.labelMorph.value : Icon.makeLabel('smile-o').value,
          extent: pt(40,40), 
          fontSize: 28,
          triggerStyle: {fontSize: 28},
          activeStyle: {fill: Color.white, borderRadius: 5, fontSize: 28},
          action: async () => {
             this.iconPicker = iconPicker
             connect(this.iconPicker, 'select', this, 'setButtonIcon');
             this.iconPicker.openInWorld();
          }
       })]})
  }

  switchButtonMode(button, mode) {
     button.activeMode = mode;
     return button;
  }

}

export class NoEditor {
  constructor(props) {}
  blur() {}
  show() {}
  hide() {}
  openInWorld() {}
  remove() {}
  update() {}
  open() { return this; }
}