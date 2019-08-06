/*global System,WeakMap*/
import { fun, obj, properties, arr } from "lively.lang";
import {
  Text, config,
  HorizontalLayout,
  VerticalLayout,
  morph,
  Morph,
  Icon,
} from "lively.morphic";
import { pt, Rectangle, Color } from "lively.graphics";
import { connect, noUpdate } from "lively.bindings";
import { ColorPicker } from "../styling/color-picker.js";
import { DropDownList } from "lively.components";

// FIXME: this is something that should be in its own package, probably
import { loadObjectFromPartsbinFolder } from "lively.morphic/partsbin.js";


const cachedControls = new WeakMap();

export class RichTextControl extends Morph {

  static get properties() {
    return {
      autoRemove: {defaultValue: false},
      target: {},
      toggleColor: {},
      managedProps: {
        readOnly: true,
        get() {
          return ['fontFamily', 'fontWeight', 'fontSize', 'fontStyle', 
                  'fontColor', 'textAlign', 'link', 'textDecoration'];
        }
      },
      updateSpec: {
        get() {
          return {
            fontSelection: (target, fb) => {
              let fontFamily =  target.fontFamily,
                  existing = fontFamily && fb.items.find(ea =>
                    ea.value.toLowerCase() === fontFamily.toLowerCase());
              if (existing) fb.selection = existing.value;
              else if (fontFamily) {
                fb.items = fb.items.concat({
                  isListItem: true,
                  label: [fontFamily, {fontFamily: fontFamily}],
                  value: fontFamily
                });
                fb.selection = arr.last(fb.items);
              }
            },
            fontWeightSelection: (target, dropDownList) => {
              dropDownList.selection = target.fontWeight == 'normal' ? 'Medium' : target.fontWeight;
            },
            boldButton: (target, btn) => {
              this.toggleButton(btn, target.fontWeight === 'bold');
            },
            italicButton: (target, btn) => {
              this.toggleButton(btn, target.fontStyle === 'italic');
            },
            underlineButton: (target, btn) => {
              this.toggleButton(btn, target.textDecoration === 'underline');
            },
            linkButton: (target, btn) => {
              this.toggleButton(btn, !!target.link);
            },
            colorPicker: (target, picker) => {
              picker.colorValue = target.fontColor;
            },
            fontSizeField: (target, field) => {
              field.number = target.fontSize;
            },
            ...(
              ['left', 'center', 'right', 'block'].reduce((handlers, align) => {
                handlers[align + 'Align'] = (target, btn) => {
                  this.toggleButton(btn, target.textAlign == align); 
                };
                return handlers;
              }, {})
            )
          }
        }
      },
      ui: {
        get() {
          let uiMapping = {
            fontSelection: 'font selection',
            fontWeightSelection: 'font weight selection',
            boldButton: 'bold button',
            italicButton: 'italic button',
            underlineButton: 'underline button',
            linkButton: 'link button',
            leftAlign: 'left align',
            centerAlign: 'center align',
            rightAlign: 'right align',
            blockAlign: 'block align',
            fontSizeField: 'font size field',
            colorPicker: 'color picker',
            copyStyleButton: 'copy style',
            applyStyleButton: 'apply style',
            removeStyleButton: 'remove style'
          };
          return obj.extract(
            uiMapping,
            obj.keys(uiMapping),
            (_, name) => this.getSubmorphNamed(name)
          );
        }
      }
    };
  }

  // connect(this.ui.removeStyleButton, 'fire', this, 'clearStyle')

  static openDebouncedFor(textMorph) {
    var selection = textMorph.selection;

    if (selection.isEmpty()) {
      var ctrl = cachedControls.get(textMorph);
      if (ctrl) {
        ctrl.update();
        ctrl.alignAtTarget();
        if (!ctrl.world()) textMorph.world().addMorph(ctrl);
      }
      return;
    }

    fun.debounceNamed(textMorph.id+"openRichTextControl", 600, () => {
      var ctrl = cachedControls.get(textMorph);
      if (selection.isEmpty()) { ctrl && ctrl.removeFocus(); return; }
      if (!ctrl || !ctrl.world()) {
        ctrl = new RichTextControl();
        cachedControls.set(textMorph, ctrl);
      }
      textMorph.world().addMorph(ctrl);
      ctrl.focusOn(textMorph, true);
      ctrl.alwaysTargetFocusedMorph();
    })();
  }

  static openFor(textMorph) {
    // cachedControls = new WeakMap();
    var ctrl = cachedControls.get(textMorph);
    if (!ctrl) {
      ctrl = new RichTextControl();
      cachedControls.set(textMorph, ctrl);
      ctrl.focusOn(textMorph, true);
      ctrl.alwaysTargetFocusedMorph();
    } else ctrl.update();
    ctrl.alignAtTarget();
    if (!ctrl.world()) textMorph.world().addMorph(ctrl);
    return ctrl;
  }

  toggleButton(btn, active) {
    let { fontSelection } = this.ui;
    if (active) {
      btn.fontColor = Color.white;
      btn.fill = this.toggleColor;
    } else {
      btn.fontColor = fontSelection.fontColor;
      btn.fill = fontSelection.fill;
    }
  }

  reset() {
    let { fontSelection } = this.ui;
    fontSelection.items = RichTextControl.basicFontItems();
    fontSelection.selection = fontSelection.items[0].value;
    connect(this.target, "selectionChange", this, "update");
  }

  alignAtTarget(animated = !!this.world()) {
    // this.alignAtTarget()
    // this.openInWorld()
    let {target} = this,
        w = target.world() || $world,
        bounds = this.globalBounds(),
        targetBounds = target.selection.isEmpty()
          ? target.globalBounds()
          : target.getGlobalTransform().transformRectToRect(
            target.selectionBounds().translatedBy(
              target.scroll.negated())),
        delta = targetBounds.bottomCenter().subPt(bounds.topCenter()),
        translated = w.visibleBounds().translateForInclusion(bounds.translatedBy(delta)),
        realDelta = translated.topLeft().subPt(bounds.topLeft()),
        newPos = this.position.addPt(realDelta);
    if (animated) this.animate({duration: 300, position: newPos});
    else this.position = newPos;
  }

  removeFocus() {
    if (this.autoRemove && this.target) {
      this.remove();
      this.target = null;
    }
  }

  async focusOn(textMorph, align = true) {
    this.target = textMorph;
    this.update();
    await this.whenRendered();
    this.ui.fontSizeField.relayout();
    if (align) this.alignAtTarget();
  }

  // this.update()

  update() {
    let {target, updateSpec} = this,
        sel = target.selection,
        attr = sel ? (sel.isEmpty() ? 
                target.textAttributeAt(sel.start) : 
                target.getStyleInRange(sel)) : {},
        managedProps = this.managedProps,
        targetProps = obj.select(target, managedProps);
 
    for (let [key, value] of Object.entries(obj.select(attr || {}, managedProps))) {
       if (typeof elem !== 'undefined') targetProps[key] = value;
    }

    for (let [key, elem] of Object.entries(this.ui)) {
      if (updateSpec[key]) updateSpec[key](targetProps, elem);
    }
  }

  relayout() {
    
  }

  /*------------UPDATING------------*/

  changeAttributeInSelectionOrMorph(name, valueOrFn) {
    let {target} = this,
        sel = target.selection;
    if (target.isLabel || sel.isEmpty()) {
      target[name] = typeof valueOrFn === "function"
        ? valueOrFn(target[name])
        : valueOrFn;
    } else {
      target.undoManager.group();
      target.changeStyleProperty(name,
        oldVal => typeof valueOrFn === "function"
          ? valueOrFn(oldVal) : valueOrFn);
      target.undoManager.group();
    }
  }

  async changeFont(fontFamily) {
    let custom = fontFamily === "custom...";
    if (custom) {
      fontFamily = await $world.prompt("Enter font family name", {
        requester: this.target,
        historyId: "lively.morphic-rich-text-font-names",
        useLastInput: true,
      });
      if (!fontFamily) return;
    }
    this.changeAttributeInSelectionOrMorph("fontFamily", fontFamily);
  }

  changeFontWeight(weight) {
    this.changeAttributeInSelectionOrMorph("fontWeight", weight);
  }

  changeTextAlign(textAlign) {
    this.changeAttributeInSelectionOrMorph("textAlign", textAlign);
  }

  changeFontColor(color) {
    this.changeAttributeInSelectionOrMorph("fontColor", color);
  }

  changeFontSize(size) {
    this.changeAttributeInSelectionOrMorph("fontSize", size);
  }

  async changeLink() {
    let morph = this.target,
        sel = morph.selection,
        {link} = morph.getStyleInRange(sel),
        newLink = await this.world().prompt("Set link", {input: link || "https://"});
    morph.undoManager.group();
    morph.setStyleInRange({link: newLink || undefined}, sel);
    morph.undoManager.group();
    this.autoRemove && this.remove();
  }

  toggleUnderline() {
    this.changeAttributeInSelectionOrMorph(
      "textDecoration",
      textDecoration => (textDecoration === "underline" ? "none" : "underline"));
  }

  toggleItalic() {
    this.changeAttributeInSelectionOrMorph(
      "fontStyle",
      fontStyle => fontStyle === "italic" ? "normal" : "italic");
  }

  toggleBold() {
    this.changeAttributeInSelectionOrMorph(
      "fontWeight",
      fontWeight => fontWeight === "bold" || fontWeight === "700" ? "normal" : "bold");
  }

  copyStyle() {
    let {target} = this,
        {applyStyleButton} = this.ui,
        style = target.selection.isEmpty() ?
          target.defaultTextStyle :
          target.getStyleInRange(target.selection),
        styleString = JSON.stringify(style, null, 2);
    this.constructor.copiedStyle = style;

    applyStyleButton.tooltip = "paste style\n" + styleString;

    this.env.eventDispatcher.doCopyWithMimeTypes([
      {type: "text/plain", data: styleString},
      {type: "application/morphic-text-style", styleString}
    ]).then(() => this.setStatusMessage(`Copied style\n${styleString}`))
      .catch(err => this.showError(err));

  }

  pasteStyle() {
    let {target, constructor: {copiedStyle}} = this;
    if (target.selection.isEmpty()) {
      Object.assign(target, copiedStyle);
    } else {
      target.selections.forEach(sel =>
        target.addTextAttribute(this.constructor.copiedStyle, sel));
    }
    this.update();
  }

  clearStyle() {
    let morph = this.target;
    morph.selections.forEach(sel =>
      morph.resetStyleInRange(sel));
    this.update();
  }

  configureRichTextOptions() {
    if (this.getSubmorphNamed("config panel"))
      this.getSubmorphNamed("config panel").remove();
    let {defaultSpec, uiSpec} = this,
        config = this.addMorph({
          name: "config panel",
          layout: new VerticalLayout({spacing: 5}),
          epiMorph: true,
          submorphs: [
            ...Object.keys(defaultSpec).map(key => {
              let checked = uiSpec.rows.some(row => row.some(name => name === key)),
                  l = {type: "labeledcheckbox", label: key, name: key, checked};
              return l;
            }),
            {
              layout: new HorizontalLayout({spacing: 3}),
              submorphs: [
                {type: "button", name: "OK button", label: "OK"},
                {type: "button", name: "cancel button", label: "Cancel"}]
            }
          ]
        });
    config.center = this.innerBounds().center();
    connect(config.getSubmorphNamed("OK button"), "fire", this, "configureAccepted");
    connect(config.getSubmorphNamed("cancel button"), "fire", this, "configureCanceled");
  }

  configureAccepted() {
    let panel = this.getSubmorphNamed("config panel");
    if (!panel) return;
    panel.remove();
    let cbs = panel.submorphs.filter(ea => ea.constructor.name === "LabeledCheckBox");
  }

  configureCanceled() {
    let panel = this.getSubmorphNamed("config panel");
    if (panel) panel.remove();
  }

  close() {
    if (this.target && this.target.attributeConnections)
      this.target.attributeConnections.forEach(
        con => con.targetObj === this && con.disconnect());
    this.remove();
  }

  alwaysTargetFocusedMorph() {
    this.startStepping(1500, "updateTarget");
  }

  updateTarget() {
    let w = this.world();
    if (!w) return;
    let {focusedMorph: m} = w;
    if (m && (m.isLabel || m.isText) && !this.isAncestorOf(m) && this.target !== m)
      this.focusOn(m, false);
  }

  async onMouseUp(evt) {
    await this.whenRendered();
    this.update();
  }

  attachToWorld() {
    connect($world, 'onMouseDown', this, 'updateTarget', {
      garbageCollect: true
    });
  }
}
