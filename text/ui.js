/*global System,WeakMap*/
import { fun, arr } from "lively.lang"
import { show, Text, HorizontalLayout, VerticalLayout, 
         inspect, morph, Morph, Icon, loadObjectFromPartsbinFolder } from "lively.morphic";
import { pt, LinearGradient, Rectangle, Color } from "lively.graphics";
import { connect, noUpdate } from "lively.bindings"

import { DropDownList } from "lively.components";


const cachedControls = new WeakMap();

export class RichTextControl extends Morph {

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
      if (selection.isEmpty()) { ctrl && ctrl.removeFocus(); return }
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

  static get properties() {
    return {
      autoRemove: {defaultValue: false},
      target: {},
      uiSpec: {
        defaultValue: {
          closeButton: true,
          rows: [
            [
              "bold button",
              "italic button",
              "underline button",
              "link button",
              "fontcolor button",
            ],

            ["text align tabs"],

            ["inc fontsize button", "dec fontsize button", "font button"],

            ["copy style button", "paste style button", "clear style button"],
          ]
        }
      }
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  constructor(props = {}) {
    super({
      name: "rich-text-control",
      dropShadow: true,
      extent: pt(200,35),
      fill: Color.gray,
      borderRadius: 7,
      ...props
    });

    connect(this, "extent", this, "relayout");
    this.build();
    this.relayout();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ui parts

  get defaultSpec() {
    return {

      "bold button": {
        type: "button",
        props: {label: Icon.makeLabel("bold"), tooltip: "toggle bold font"},
        action: "toggleBold"
      },

      "italic button": {
        type: "button",
        props: {label: Icon.makeLabel("italic"), tooltip: "toggle italic font"},
        action: "toggleItalic"
      },

      "underline button": {
        type: "button",
        props: {label: Icon.makeLabel("underline"), tooltip: "toggle underlined font"},
        action: "toggleUnderline"
      },

      "link button": {
        type: "button",
        props: {label: Icon.makeLabel("link"), tooltip: "add or edit link"},
        action: "changeLink"
      },

      "fontcolor button": {
        type: "button",
        props: {label: Icon.makeLabel("tint"), tooltip: "change font color"},
        action: "openFontColorChooser"
      },

      "inc fontsize button": {
        type: "button",
        props: {label: Icon.makeLabel("plus"), tooltip: "increase font size"},
        action: "incFontSize"
      },

      "dec fontsize button": {
        type: "button",
        props: {label: Icon.makeLabel("minus"), tooltip: "decrease font size"},
        action: "decFontSize"
      },

      "copy style button": {
        type: "button",
        props: {label: Icon.makeLabel("copy"), tooltip: "copy style button"},
        action: "copyStyle"
      },

      "paste style button": {
        type: "button",
        props: {label: Icon.makeLabel("paint-brush"), tooltip: "paste style button"},
        action: "pasteStyle"
      },

      "clear style button": {
        type: "button",
        props: {label: Icon.makeLabel("remove"), tooltip: "clear style button"},
        action: "clearStyle"
      },

      "configure button": {
        type: "button",
        props: {label: Icon.makeLabel("cog"), tooltip: "configure rich text options"},
        action: "configureRichTextOptions"
      },

      "font button": {
        type: "custom",
        ensure() {
          let existing = this.getSubmorphNamed("font button");
          if (existing) return existing;
          let fontItems = Text.basicFontItems();
          let {extent} = this.btnStyle;
          let btn = this.addMorph(new DropDownList({
            selection: fontItems[0], items: fontItems,
            extent, width: 100, name: "font button",
            // fill: new LinearGradient({
            //   stops: [
            //     {color: Color.white, offset: 0},
            //     {color: Color.rgb(236,240,241), offset: 1}
            //   ]
            // }),
            tooltip: "change font family",
            listAlign: "top"
          }));
          connect(btn, "selection", this, "changeFont");
        }
      },

      "text align tabs": {
        type: "custom",
        ensure() {
          let existing = this.getSubmorphNamed("text align tabs");
          if (existing) return existing;
          let pre = this.addMorph({name: "text align tabs", width: 120, height: 24});
          loadObjectFromPartsbinFolder("tab-buttons").then(tabs => {
            pre.replaceWith(tabs);
            tabs.owner.addMorphBack(tabs);
            connect(tabs, "activeTab", this, "changeTextAlign");
            connect(tabs, "extent", this, "relayout");
            Object.assign(tabs, {
              tabs: [
                {name: "left", label: Icon.textAttribute("align-left")},
                {name: "center", label: Icon.textAttribute("align-center")},
                {name: "right", label: Icon.textAttribute("align-right")},
                {name: "justify", label: Icon.textAttribute("align-justify")}
              ],
              name: "text align tabs"
            })
          }).catch(err => this.showError(err));
          return pre;
        }

      }
    }
  }

  ensureCloseButton() {
    return this.getOrAddButton({
      name: "close button",
      label: Icon.makeLabel("times-circle"),
      tooltip: "close",
      fill: null,
      borderColor: Color.transparent,
      activeStyle: {borderWidth: 0}
    }, "close");
  }

  addDivider() {
    return this.addMorph({name: "divider", fill: Color.gray, extent: pt(4,30)});
  }

  get btnStyle() {
    return {
      type: "button", borderRadius: 5, padding: Rectangle.inset(0),
      extent: pt(20,22),
      grabbable: false, draggable: false,
    }
  }

  getOrAddButton(spec, connectTo) {
    let btn = this.getSubmorphNamed(spec.name);
    if (btn) return btn;
    if (!spec.tooltip) spec.tooltip = spec.name;
    btn = this.addMorph({...this.btnStyle, ...spec});
    connectTo && connect(btn, "fire", this, connectTo);
    return btn;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  build() {
    // this.build();
    // this.submorphs[0].show()
    // this.relayout();

    let defaultSpec = this.defaultSpec

    this.removeAllMorphs();

    let {uiSpec} = this;
    if (!uiSpec || !uiSpec.rows) return;

    for (let row = 0; row < uiSpec.rows.length; row++) {
      for (let spec of uiSpec.rows[row]) {
        if (typeof spec === "string") spec = {name: spec};
        if (!defaultSpec[spec.name]) continue;
        spec = {...defaultSpec[spec.name], ...spec}
        if (typeof spec.ensure === "function") spec.ensure.call(this, spec);
        else if (spec.type === "button") this.getOrAddButton({name: spec.name, ...spec.props}, spec.action);
      }
    }

    if (this.uiSpec.closeButton)
      this.ensureCloseButton();
  }


  reset() {
    this.get("font button").items = RichTextControl.basicFontItems();
    this.get("font button").selection = this.get("font button").items[0].value;
    connect(this.target, "selectionChange", this, "update");

    this.uiSpec = {
      closeButton: true,
      rows: [
        [
          "bold button",
          "italic button",
          "underline button",
          "link button",
          "fontcolor button",

          "inc fontsize button",
          "dec fontsize button",

        ],

        [
          "font button",
          "text align tabs",

        ],

        ["copy style button", "paste style button", "clear style button"],
        // ["configure button"],
      ]
    }
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
    if (animated) this.animate({duration: 300, position: newPos})
    else this.position = newPos;
  }

  removeFocus() {
   if (this.autoRemove && this.target) {
     this.remove();
     this.target = null;
   }
  }

  focusOn(textMorph, align = true) {
    // if (this.autoRemove) {
    //   this.topCenter = textMorph.getGlobalTransform()
    //       .transformRectToRect(textMorph.selectionBounds()).bottomCenter();
    //   this.animate({opacity: 1, duration: 1});
    // }
    this.target = textMorph;
    this.update();
    if (align) this.alignAtTarget();
  }

  update() {
    this.setFontFromTarget();
    this.setTextAlignFromTarget();
  }

  relayout() {
    // this.build();
    // this.relayout();

    // this.height = 30;
    var offset = 3;
    // var h = this.innerBounds().height;
    var {uiSpec} = this,
        defaultSpec = this.defaultSpec,
        rowMorphs = [],
        rowWidths = [],
        rowHeights = [],
        maxWidth = 0;

    if (!uiSpec || !uiSpec.rows) return;

    for (let row = 0; row < uiSpec.rows.length; row++) {
      let morphs = []; rowMorphs.push(morphs);
      let rowWidth = offset;
      let rowHeight = 0;
      for (let spec of uiSpec.rows[row]) {
        if (typeof spec === "string") spec = {name: spec};
        if (!defaultSpec[spec.name]) continue;
        spec = {...defaultSpec[spec.name], ...spec}
        let m;
        if (typeof spec.ensure === "function") m = spec.ensure.call(this, spec);
        else if (spec.type === "button") m = this.getOrAddButton(spec, spec.action);
        else continue;
        morphs.push(m);
        rowWidth += m.width + offset;
        rowHeight = Math.max(rowHeight, m.height)
      }
      rowWidths[row] = rowWidth;
      rowHeights[row] = rowHeight;
      maxWidth = Math.max(maxWidth, rowWidth);
    }

    var x = offset, y = offset;

    for (let row = 0; row < uiSpec.rows.length; row++) {
      let offsetLeft = (maxWidth - rowWidths[row]) / 2,
          rowHeight = rowHeights[row];

      for (let m of rowMorphs[row]) {
        let {width, height} = m;
        m.position = pt(offsetLeft + x, y + (rowHeight - height)/2);
        x += width + offset;
      }
      maxWidth = Math.max(x, maxWidth);
      x = offset;
      y += rowHeight + offset;
    }

    this.extent = pt(maxWidth, y);

    if (this.uiSpec.closeButton)
      this.ensureCloseButton().topRight = this.innerBounds().topRight().addXY(8,-8);

    return;
  }

  changeAttributeInSelectionOrMorph(name, valueOrFn) {
    let {target} = this,
        sel = target.selection;
    if (sel.isEmpty()) {
      target[name] = typeof valueOrFn === "function"
                      ? valueOrFn(target[name])
                      : valueOrFn
    } else {
      target.undoManager.group();
      target.changeStyleProperty(name,
        oldVal => typeof valueOrFn === "function"
          ? valueOrFn(oldVal) : valueOrFn);
      target.undoManager.group();
    }
  }

  static basicFontItems() {
    return [
      "Sans-serif",
      "serif",
      "Monospace",
      "Arial Black",
      "Arial Narrow",
      "Comic Sans MS",
      "Garamond",
      "Tahoma",
      "Trebuchet MS",
      "Verdana",
      "custom..."
    ].map(ea => ({isListItem: true, label: [ea, {fontFamily: ea}], value: ea}));
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
    if (custom) this.setFontFromTarget();
  }

  setFontFromTarget() {
    // this.reset();
    // this.target.resetTextAttributes()

    let {target} = this, sel = target.selection,
        fb = this.get("font button"),
        attr = sel.isEmpty() ? target.textAttributeAt(sel.start) : target.getStyleInRange(sel),
        fontFamily = (attr && attr.fontFamily) || target.fontFamily,
        existing = fb.items.find(ea =>
          ea.value.toLowerCase() === fontFamily.toLowerCase());

    noUpdate({
      sourceObj: fb, sourceAttribute: "selection",
      targetObj: this.get("rich-text-control"), targetAttribute: "changeFont"
    }, () => {
      if (existing) fb.selection = existing.value;
      else {
        fb.items = fb.items.concat({
          isListItem: true,
          label: [fontFamily, {fontFamily: fontFamily}],
          value: fontFamily
        });
        fb.selection = arr.last(fb.items);
      }
    });

    this.relayout();
  }

  changeTextAlign(textAlign) {
    this.changeAttributeInSelectionOrMorph("textAlign", textAlign);
  }

  setTextAlignFromTarget() {
    // this.reset();
    // this.target.resetTextAttributes()

    let {target} = this, sel = target.selection,
        tabs = this.get("text align tabs"),
        attr = sel.isEmpty() ? target.textAttributeAt(sel.start) : target.getStyleInRange(sel),
        textAlign = (attr && attr.textAlign) || target.textAlign,
        tab = tabs.submorphs.find(ea => ea.name === textAlign);

    noUpdate({
      sourceObj: tabs, sourceAttribute: "activeTab",
      targetObj: this.get("rich-text-control"), targetAttribute: "changeTextAlign"
    }, () => tabs.activeTab = tab);
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

  async openFontColorChooser() {
    let { ColorPicker } = await System.import("lively.ide/styling/color-picker.js"),
        {target: t} = this,
        {fontColor} = t.getStyleInRange(t.selection) || {};
    if (!fontColor) fontColor = t.fontColor;
    let picker = new ColorPicker({color: fontColor}).openInWorldNearHand();
    connect(picker, "color", this, "changeFontColor");
    this.autoRemove && this.remove();
  }

  changeFontColor(color) {
    this.changeAttributeInSelectionOrMorph("fontColor", color);
  }

  incFontSize() {
    let defaultFontSize = this.target.fontSize;
    this.changeAttributeInSelectionOrMorph("fontSize", oldSize => {
      oldSize = oldSize || defaultFontSize;
      return oldSize + (oldSize >= 18 ? 2 : 1);
    });
  }

  decFontSize() {
    let defaultFontSize = this.target.fontSize;
    this.changeAttributeInSelectionOrMorph("fontSize", oldSize => {
      oldSize = oldSize || defaultFontSize;
      return oldSize - (oldSize <= 18 ? 1 : 2);
    });
  }

  copyStyle() {
    let {target} = this,
        style = target.selection.isEmpty() ?
                  target.defaultTextStyle :
                  target.getStyleInRange(target.selection),
        styleString = JSON.stringify(style, null, 2);
    this.constructor.copiedStyle = style;

    this.getSubmorphNamed("paste style button").tooltip = "paste style\n" + styleString;

    this.env.eventDispatcher.doCopyWithMimeTypes([
      {type: 'text/plain', data: styleString},
      {type: 'application/morphic-text-style', styleString}
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
  }

  clearStyle() {
    let morph = this.target;
    morph.selections.forEach(sel =>
      morph.resetStyleInRange(sel));
    this.setFontFromTarget();
    this.setTextAlignFromTarget();
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
    connect(config.getSubmorphNamed("OK button"), 'fire', this, 'configureAccepted');
    connect(config.getSubmorphNamed("cancel button"), 'fire', this, 'configureCanceled');
  }

  configureAccepted() {
    let panel = this.getSubmorphNamed("config panel")
    if (!panel) return;
    panel.remove();
    let cbs = panel.submorphs.filter(ea => ea.constructor.name === "LabeledCheckBox");
  }

  configureCanceled() {
    let panel = this.getSubmorphNamed("config panel")
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
    if (m && m.isText && !this.isAncestorOf(m) && this.target !== m)
      this.focusOn(m, false);
  }

  onMouseDown(evt) {
    this.updateTarget();
  }
}
