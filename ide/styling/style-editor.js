import {
  GridLayout,
  VerticalLayout,
  HorizontalLayout,
  TilingLayout,
  Morph
} from "../../index.js";
import {
  Rectangle,
  Color,
  LinearGradient,
  pt,
  rect
} from "lively.graphics";
import { obj, arr } from "lively.lang";
import { signal, connect } from "lively.bindings";
import {
  CheckBox,
  ModeSelector,
  DropDownSelector,
  Slider,
  PropertyInspector,
  Leash
} from "lively.morphic/components/widgets.js";

import { Icon } from "lively.morphic/components/icons.js";
import { ColorPickerField } from "./color-picker.js";
import { GradientEditor } from "./gradient-editor.js";
import { StyleRules } from "../../style-rules.js";
import KeyHandler from "../../events/KeyHandler.js";

const duration = 200;

class StyleEditor extends Morph {

   constructor(props) {
      const {title, target} = props;
      if (!target) throw Error("No target provided!");
      super({
        morphClasses: ['closed'],
        clipMode: "hidden",
        layout: new VerticalLayout({spacing: 5}),
        ...props,
        });
      this.build();
   }

   build() {
      this.submorphs = [this.titleLabel(this.title)];
      this.styleRules = this.styler;
   }

   getColorField({target, property}) {
       const colorField = new ColorPickerField({
                         target: target || this.target,
                         name: "colorPicker",
                         property
                    });
       connect(this, "remove", colorField, "remove");
       connect(this, "onMouseDown", colorField, "removeWidgets");
       return colorField;
   }

   get styler() {
       return new StyleRules({
          closeButton: {
              fontSize: 22,
              fontColor: Color.gray.darker(),
              nativeCursor: "pointer"
          },
          closed: {
              dropShadow: true,
              draggable: true,
              borderColor: Color.gray,
              borderWidth: 4,
              fill: Color.black.withA(.7),
              borderRadius: 15
          },
          opened: {
              fill: new LinearGradient({stops: [
                 {color: Color.rgb(242,243,244), offset: 0},
                 {color: Color.rgb(229,231,233), offset: 1}]}),
              borderWidth: 1, borderRadius: 7,
              borderColor: Color.gray,
          },
          controlLabel: {
              fontSize: 12, fontWeight: 'bold',
              fontColor: Color.black, padding: rect(5,0,0,0),
              fill: Color.transparent, readOnly: true,
         },
         controlWrapper: {
              clipMode: 'hidden',
              fill: Color.transparent,
              reactsToPointer: false
         }
       })
   }

   titleLabel(title) {
      return {
           fill: Color.transparent,
           layout: new HorizontalLayout(),
           onDrag: (evt) => this.onDrag(evt),
           submorphs: [{
             type: "text",
             fontWeight: "bold", padding: 5,
             fontColor: Color.gray, fontSize: 12, readOnly: true,
             fill: Color.transparent, draggable: true, nativeCursor: 'pointer',
             textString: title,
             onDrag: (evt) => this.onDrag(evt)
        }]
    }
   }

   onMouseDown() { signal(this, "open"); this.open() }
   onMouseMove() { this.show() }

   hide() {
      if (this.opened) return;
      this.animate({opacity: 0, visible: false, duration});
   }

   blur() {
      if (this.opened || this.innerBounds().containsPoint(this.localize(this.env.world.firstHand.position))) return;
      this.blurred = true;
      this.animate({opacity: .7, duration})
   }

   show() {
      var world;
      if (this.opened) return;
      this.blurred = false;
      this.animate({opacity: 1, visible: true, duration});
   }

   close() {
      this.opened = false;
      this.layout = null;
      this.submorphs = [this.titleLabel(this.title)];
      this.animate({
            morphClasses: ["closed"],
            position: this.openPosition,
            layout: new VerticalLayout({spacing: 5}),
            duration})
      signal(this, "close", false);
   }

   open() {
      if (this.opened) return this;
      this.opened = true;
      const [titleLabel] = this.submorphs,
            {submorphs: [instruction]} = titleLabel

      this.layout = null;
      this.opacity = 1;
      this.nativeCursor = "auto";
      this.openPosition = this.position;

      titleLabel.addMorphAt(Icon.makeLabel("times-circle-o", {
           name: "closeButton",
           onMouseDown: () => this.close()
      }), 0);
      instruction.animate({nativeCursor: "auto", fontColor: Color.gray.darker(), duration});
      this.controls(this.target).forEach(c => {
         c.opacity = 0;
         this.addMorph(c).animate({opacity: 1, duration});
      });
      this.animate({
          morphClasses: ['opened'],
          duration, layout: new VerticalLayout({spacing: 5})
      });
      return this;
   }

   get isHaloItem() { return true }

   createLeashFor(target, side) {
      const leash = new Leash({draggable: false, start: pt(0,0), end: pt(10,10), opacity: 0});
      leash.startPoint.attachTo(target, side);
      leash.endPoint.attachTo(this, "center");
      leash.animate({opacity: .7, duration: 300});
      connect(this, "close", leash, "remove");
      connect(this, "remove", leash, "remove");
      return leash;
   }

   updateControls(newControls) {
      const [titleLabel, _] = this.submorphs;
      this.animate({submorphs: [titleLabel, ...newControls], duration});
   }

   createControl(name, controlElement) {
     return {
      name,
      morphClasses: ['controlWrapper'],
      layout: new VerticalLayout({spacing: 5}),
      submorphs: [
        {type: "text", morphClasses: ['controlLabel'], textString: name},
        controlElement
     ]}
  }

  createSelectableControl({controls, init}) {
      const modeSelector = new ModeSelector({
                    name: "modeSelector",
                    items: controls, init,
                    width: this.width - 20}),
            selectableControl = new Morph({
              morphClasses: ['controlWrapper'],
              layout: new VerticalLayout({spacing: 10}),
              remove() { super.remove(); arr.invoke(this.submorphs, 'remove'); },
              select(control) {
                 const c = control();
                 c.opacity = 0;
                 this.animate({submorphs: [modeSelector, c], duration});
                 c.animate({opacity: 1, duration})
              },
              submorphs: [modeSelector, controls[init]()]});
      connect(modeSelector, "switchLabel", selectableControl, "select");
      modeSelector.layout.col(0).remove();
      return selectableControl;
  }

  createToggledControl({title, render, target, property}) {
    if (!target || !property) throw Error("Please pass property AND target to toggled control.");
    const toggler = new CheckBox({checked: target[property]}),
          flap = new Morph({
            clipMode: "hidden",
            fill: Color.transparent,
            draggable: true, onDrag: (evt) =>  this.onDrag(evt),
            layout: new VerticalLayout({spacing: 5}),
            toggle(value) {
                if (value) {
                    value = this.memoizedValue || value;
                } else {
                    this.memoizedValue = target[property];
                }
                target[property] = value;
                const [title] = this.submorphs,
                      controls =  render(target[property]),
                      submorphs = [title, ...controls ? [controls] : []];
                if (controls) controls.opacity = 0;
                this.animate({submorphs, duration});
                if (controls) controls.animate({opacity: 1, duration})
            },
            submorphs: [
              {fill: Color.transparent, layout: new HorizontalLayout({autoResize: false}), height: 25,
               submorphs: [
                {type: "text", textString: title, morphClasses: ['controlLabel']},
                toggler]}
           ]});

     connect(toggler, "toggle", flap, "toggle");
     flap.toggle(target[property]);
     return flap;
  }

  opacityControl(target) {
      return this.createControl("Opacity", new Slider({
             target: this.target, min: 0, max: 1,
             property: "opacity", width: 150
      }));
  }

  shadowControl() {
     return this.createToggledControl({
          title: "Drop Shadow",
          target: this.target, property: "dropShadow",
          render: (value) => {
             if (!value) return null;
             const distanceInspector = new PropertyInspector({
                  name: "distanceSlider",
                  min: 0, target: value,
                  property: "distance"
             }),
             angleSlider = new PropertyInspector({
                  name: "angleSlider",
                  min: 0, max: 360,
                  target: value,
                  property: "rotation"
             }),
             blurInspector = new PropertyInspector({
                 name: "blurSlider",
                 min: 0, target: value,
                 property: "blur"
             });
             const control = new Morph({
                  width: 150, height: 120, fill: Color.transparent,
                  submorphs: [
                    {type: "label", value: "Distance: ", padding: 4, name: "distanceLabel"}, distanceInspector,
                    {type: "label", value: "Blur: ", padding: 4, name: "blurLabel"}, blurInspector,
                    {type: "label", value: "Angle: ", padding: 4, name: "angleLabel"}, angleSlider,
                    {type: "label", value: "Color: ", padding: 4, name: "colorLabel"},
                    this.getColorField({target: value, property: 'color'})]
               });

             control.layout = new GridLayout({
                      autoAssign: false,
                      fitToCell: false,
                      grid: [
                      ["distanceLabel", null, "distanceSlider"],
                      ["blurLabel", null, "blurSlider"],
                      ["angleLabel", null, "angleSlider"],
                      ["colorLabel", null, "colorPicker"]]}),
             control.layout.col(0).paddingLeft = 1;
             control.layout.row(0).paddingBottom = 5;
             control.layout.row(1).paddingBottom = 5;
             control.layout.row(2).paddingBottom = 5;
             return control;
          }
          })
  }


}

export class BodyStyleEditor extends StyleEditor {

   controls(target) {
       return [
           this.selectedFillControl = this.fillControl(target),
           this.opacityControl(target),
           this.shadowControl(target)
       ]
   }

   remove() {
      super.remove();
      this.selectedFillControl && this.selectedFillControl.remove();
   }

   placeBehindMe(handle) {
      handle.remove();
      this.owner.addMorph(handle, this);
      handle.center = this.owner.localize(this.target.globalBounds().center());
   }

   fillControl(target) {
      return this.createSelectableControl({controls: {
                "Fill": () => this.getColorField({property: "fill"}),
               "Gradient": () => {
                   const g = new GradientEditor({target, property: "fill"});
                   g.gradientHandle && this.placeBehindMe(g.gradientHandle)
                   connect(g, "openHandle", this, "placeBehindMe");
                   g.update();
                   return g
                }
             }, init: target.fill && target.fill.isGradient ? "Gradient" : "Fill"})
   }
}

export class BorderStyleEditor extends StyleEditor {

  controls(target) {
     return [
         this.borderControl(target),
         this.clipControl(target)
      ]
  }

  onHoverOut() {
     this.blur();
  }

  clipControl(target) {
     return this.createControl("Clip Mode",
       {layout: new HorizontalLayout({spacing: 5}),
        fill: Color.transparent,
        submorphs: [
         new DropDownSelector({
             isHaloItem: true,
             target, property: "clipMode",
             values: ["visible", "hidden", "scroll"]
       })]
     });
  }

  borderControl(target) {
     return this.createControl("Border", {
             layout: new HorizontalLayout({spacing: 5, compensateOrigin: true}),
             fill: Color.transparent,
             submorphs: [new DropDownSelector({target, isHaloItem: true, property: "borderStyle", values: ["solid", "dashed", "dotted"]}),
                         this.getColorField({property: 'borderColor'}),
                         new PropertyInspector({min: 0, target, unit: "pt", property: "borderWidth"})]
              })
  }

}

export class PolygonEditor extends BorderStyleEditor {

    constructor(props) {
       super(props);
       signal(this, 'add vertices');
    }

    controls(target) {
       return [...super.controls(target),
               this.vertexEditModes(target)
               ]
    }

    get keybindings() { return super.keybindings.concat([
        {keys: "Alt-A", command: "add vertices"},
        {keys: "Alt-D", command: "delete vertices"},
        {keys: "Alt-S", command: "transform vertices"}]);
    }

    get commands() {
       return [
          {
             name: "add vertices",
             doc: 'Add Anchor Points',
             exec: () => signal(this, "add vertices")
          },
          {
             name: "delete vertices",
             doc: 'Remove Anchor Points',
             exec: () => signal(this, "delete vertices")
          },
          {
             name: "transform vertices",
             doc: 'Transform Control Points',
             exec: () => signal(this, "transform vertices")
          }
       ]
    }

    get vertexModeStyles() {
       return new StyleRules({
          modeLabel: {
             fontColor: Color.white, fontWeight: 'bold', fill: Color.transparent,
          },
          modeBox: {borderRadius: 5, nativeCursor: 'pointer'},
          addMode: {fill: Color.rgb(39,174,96)},
          deleteMode: {fill: Color.rgb(231,76,60)},
          transformMode: {fill: Color.rgb(52,152,219)}
       })
    }

    vertexEditModes(target) {
       return this.createControl("Edit Modes", {
           morphClasses: ['controlWrapper'],
           layout: new VerticalLayout({spacing: 5}),
           styleRules: this.vertexModeStyles,
           submorphs: KeyHandler.generateCommandToKeybindingMap(this).map(ea => {
                return this.newVertexMode(ea)
           })
       })
    }

    newVertexMode(cmd) {
        const self = this,
              {prettyKeys, command: {doc, name}} = cmd,
              m = new Morph({
            morphClasses: this.commandToMorphClasses(cmd.command),
            layout: new HorizontalLayout({spacing: 5}),
            onMouseDown: () => {
               this.execCommand(cmd.command);
            },
            activate() {
               signal(self, "reset modes");
               this.opacity = 1;
            },
            deactivate() {
               this.opacity = .5;
            },
            submorphs: [{
                 type: 'label', value: doc,
                 morphClasses: ['modeLabel']
            }, {type: 'label', value: prettyKeys.join(" "), morphClasses: ['modeLabel']}]
        });
        connect(this, name, m, "activate");
        connect(this, 'reset modes', m, "deactivate");
        return m;
    }

    commandToMorphClasses(cmd) {
        return {
           'add vertices': ['modeBox', 'addMode'],
           'delete vertices': ['modeBox', 'deleteMode'],
           'transform vertices': ['modeBox', 'transformMode']
        }[cmd.name]
    }

}

export class LayoutStyleEditor extends StyleEditor {

    getLayoutObjects() {
       return [null,
               new HorizontalLayout({autoResize: false}),
               new VerticalLayout({autoResize: false}),
               // new FillLayout(),
               new TilingLayout(),
               new GridLayout({grid: [[null], [null], [null]]})];
   }

   remove() {
       this.clearLayoutHalo()
       super.remove();
   }

   controls(target) {
      return [this.layoutPicker(),
              ...this.layoutHalo ? [this.layoutControls()] : []]
   }

   open() {
      if (this.opened) return;
      super.open();
      this.clearLayoutHalo();
      if (this.target.layout) {
          this.layoutHalo = this.world().showLayoutHaloFor(this.target, this.pointerId);
      }
      this.updateControls(this.controls());
   }

   clearLayoutHalo() {
      if (this.layoutHalo) {
          this.layoutHalo.remove(); this.layoutHalo = null;
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
             [this.getLayoutName(l)]:
             () => {
                 this.target.animate({layout: l});
                 this.clearLayoutHalo();
                 if (this.target.layout) {
                     this.layoutHalo = this.world().showLayoutHaloFor(this.target, this.pointerId);
                 }
                 this.updateControls(this.controls());
             }
           }
         });
      return this.get("Layout Type") || this.createControl(
          "Layout Type",
           {name: "layoutPicker",
            morphClasses: ["controlWrapper"],
            layout: new HorizontalLayout({spacing: 5}),
            submorphs: [new DropDownSelector({
               isHaloItem: true,
               target: this.target,
               property: "layout",
               getCurrentValue: () => this.getCurrentLayoutName(),
               values: obj.merge(items)
          })]}
        );
   }

   layoutControls() {
      return this.createControl("Layout Options", {
           fill: Color.transparent,
           layout: new VerticalLayout(),
           submorphs: this.layoutHalo.optionControls()})
   }
}

export class HTMLEditor extends Morph {

   constructor(props) {
      super({
        extent: props.target.extent,
        fill: Color.black.withA(.5),
        borderRadius: props.target.borderRadius,
        ...props,
      });
      this.build();
   }

   get isHaloItem() { return true }

   build() {
      const htmlMorph = this.target;
      this.submorphs = [
         {type: "text", textString: this.target.html, fontColor: Color.white,
          fontFamily: "Inconsolata, monospace",
          padding: Rectangle.inset(10, 10, 10, 2),
          fontSize: 14, fill: Color.transparent, extent: this.extent,
          clipMode: "auto", doSave() { htmlMorph.html = this.textString }}
      ]
   }

   onMouseMove() { this.show() }

   blur() { this.animate({opacity: .5, duration})}
   show() { this.animate({opacity: 1, visible: true, duration}) }
   hide() { this.visible = false; }

}

export class PathEditor extends BorderStyleEditor {

    constructor(props) {
       super({title: "Change Path",
             ...props});
    }

    controls(target) {
       return [this.borderControl(target),
               this.opacityControl(target),
               this.shadowControl(target)]
    }

}

export class ImageEditor extends StyleEditor {

    constructor(props) {
       super({title: "Change Image URL",
             ...props});
    }

    controls(target) {
       return [this.urlEditor(target)]
    }

    urlEditor(target) {
       return {
          layout: new HorizontalLayout({spacing: 3}),
          fill: Color.transparent,
          styleRules: new StyleRules({
                 urlBar: {borderRadius: 5,
                   padding: 4, fill: Color.white.withA(.8),
                   fontColor: Color.gray.darker(), fontSize: 15
                 },
                  saveButton: {
                     fontSize: 18, padding: 2,
                     nativeCursor: "pointer",
                     fontColor: Color.gray.darker(),
                     tooltip: "Update the image URL"
                  }
              }),
          submorphs: [{
           type: "text", name: "urlBar",
           textString: target.imageUrl,
           doSave() { target.imageUrl = this.textString }
       }, Icon.makeLabel("check-circle", {
             name: "saveButton",
             onMouseDown() {
                this.fontColor = Color.black;
                this.get("urlBar").doSave()
             },
             onMouseUp() {
                this.fontColor = Color.gray.darker();
             }})]}
    }

}

export class NoEditor {

   constructor(props) {

   }

   blur() {

   }

   show() {

   }

   hide() {

   }

   openInWorld() {

   }

   remove() {

   }

   open() {
      return this;
   }

}
