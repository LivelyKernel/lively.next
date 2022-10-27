/* global System,WeakMap */
import { fun, string, obj, properties, arr } from 'lively.lang';
import {
  Text, config,
  HorizontalLayout,
  VerticalLayout,
  morph,
  Morph,
  Icon
} from 'lively.morphic';
import { pt, Rectangle, Color } from 'lively.graphics';
import { connect, disconnect, once, noUpdate } from 'lively.bindings';
import { ColorPicker } from '../styling/color-picker.js';
import { DropDownList } from 'lively.components';

const cachedControls = new WeakMap();

export class RichTextControl extends Morph {
  static get properties () {
    return {
      autoRemove: { defaultValue: false },
      target: {},
      toggleColor: {},
      buttonMaster: {
        defaultValue: 'styleguide://System/dark button'
      },
      selectedButtonMaster: {
        defaultValue: 'styleguide://SystemIDE/selected button'
      },
      managedProps: {
        readOnly: true,
        get () {
          return ['fontFamily', 'fontWeight', 'fontSize', 'fontStyle', 'isText',
            'fontColor', 'textAlign', 'link', 'textDecoration', 'fixedWidth',
            'fixedHeight', 'lineWrapping', 'padding'];
        }
      },
      updateSpec: {
        get () {
          return {
            fontSelection: (target, fb) => {
              const fontFamily = target.fontFamily;
              const existing = fontFamily && fb.items.find(ea =>
                ea.value.toLowerCase() === fontFamily.toLowerCase());
              if (existing) fb.selection = existing.value;
              else if (fontFamily) {
                fb.items = fb.items.concat({
                  isListItem: true,
                  label: [fontFamily, { fontFamily: fontFamily }],
                  value: fontFamily
                });
                fb.selection = arr.last(fb.items);
              }
            },
            fontWeightSelection: (target, dropDownList) => {
              dropDownList.selection = target.fontWeight == 'normal' ? 'Medium' : (target.fontWeight ? string.capitalize(target.fontWeight) : 'Medium');
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
            fixedWidthControl: (target, field) => {
              target.isText ? field.enable() : field.disable();
              field.checked = target.fixedWidth;
            },
            fixedHeightControl: (target, field) => {
              target.isText ? field.enable() : field.disable();
              field.checked = target.fixedHeight;
            },
            lineWrappingControl: (target, control) => {
              const [checkBox, selector] = control.submorphs;
              checkBox.checked = !!target.lineWrapping;
              !target.isText ? checkBox.disable() : checkBox.enable();
              selector.deactivated = !target.lineWrapping;

              // connect(checkBox, 'checked', this, 'setLineWrapping');
              // connect(selector, 'selection', this, 'setLineWrapping');

              if (selector.deactivated) {
                selector.opacity = 0.5;
              } else {
                selector.opacity = 1;
                selector.selection = target.lineWrapping;
              }
            },
            paddingControl: ({ padding }, control) => {
              const left = padding.left();
              const top = padding.top();
              const right = padding.right();
              const bottom = padding.bottom();
              const isMultiVar = ![left, top, right, bottom].every(side => side == left);

              control.get('multi value indicator').visible = isMultiVar;
              connect(control.get('multi value indicator'), 'onMouseDown', control.get('padding field'), 'number', {
                converter: '() => left',
                varMapping: { left }
              });

              try {
                control.get('padding field').number = left;
                control.get('padding field').visible = !isMultiVar;
                control.get('padding field top').number = top;
                control.get('padding field left').number = left;
                control.get('padding field right').number = right;
                control.get('padding field bottom').number = bottom;
              } catch (e) {
                // ignore
              }
            },
            ...(
              ['left', 'center', 'right', 'block'].reduce((handlers, align) => {
                handlers[align + 'Align'] = (target, btn) => {
                  btn.deactivated = !target.isText;
                  this.toggleButton(btn, target.textAlign == align);
                };
                return handlers;
              }, {})
            )
          };
        }
      },
      ui: {
        get () {
          const uiMapping = {
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
            removeStyleButton: 'remove style',
            fixedHeightControl: 'fixed height control',
            fixedWidthControl: 'fixed width control',
            lineWrappingControl: 'line wrapping control',
            paddingControl: 'padding control',
            paddingField: 'padding field',
            paddingFieldTop: 'padding field top',
            paddingFieldLeft: 'padding field left',
            paddingFieldRight: 'padding field right',
            paddingFieldBottom: 'padding field bottom'
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

  static openDebouncedFor (textMorph) {
    const selection = textMorph.selection;

    if (selection.isEmpty()) {
      const ctrl = cachedControls.get(textMorph);
      if (ctrl) {
        ctrl.update();
        ctrl.alignAtTarget();
        if (!ctrl.world()) textMorph.world().addMorph(ctrl);
      }
      return;
    }

    fun.debounceNamed(textMorph.id + 'openRichTextControl', 600, () => {
      let ctrl = cachedControls.get(textMorph);
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

  static openFor (textMorph) {
    // cachedControls = new WeakMap();
    let ctrl = cachedControls.get(textMorph);
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

  toggleButton (btn, active) {
    const { fontSelection } = this.ui;
    if (active) {
      btn.master = {
        auto: this.selectedButtonMaster
      };
    } else {
      btn.master = {
        auto: this.buttonMaster
      };
    }
  }

  onLoad () {
    this.reset();
  }

  reset () {
    const { fontSelection } = this.ui;
    fontSelection.items = arr.uniq([...this.env.fontMetric.supportedFonts, ...config.text.basicFontItems]);

    if (!this.target) return;
    fontSelection.selection = this.target.fontFamily || fontSelection.items[0].value;
    connect(this.target, 'selectionChange', this, 'update', {
      garbageCollect: true
    });
  }

  alignAtTarget (animated = !!this.world()) {
    // this.alignAtTarget()
    // this.openInWorld()
    const { target } = this;
    const w = target.world() || $world;
    const bounds = this.globalBounds();
    const targetBounds = target.selection.isEmpty()
      ? target.globalBounds()
      : target.getGlobalTransform().transformRectToRect(
        target.selectionBounds().translatedBy(
          target.scroll.negated()));
    const delta = targetBounds.bottomCenter().subPt(bounds.topCenter());
    const translated = w.visibleBounds().translateForInclusion(bounds.translatedBy(delta));
    const realDelta = translated.topLeft().subPt(bounds.topLeft());
    const newPos = this.position.addPt(realDelta);
    if (animated) this.animate({ duration: 300, position: newPos });
    else this.position = newPos;
  }

  removeFocus () {
    if (this.target && this.target.attributeConnections) {
      this.target.attributeConnections.forEach(
        con => con.targetObj === this && con.disconnect());
    }
    if (this.autoRemove && this.target) {
      this.remove();
      this.target = null;
    }
  }

  async focusOn (textMorph, align = true) {
    if (this.target) {
      disconnect(this.target, 'selectionChange', this, 'update');
    }
    this.target = textMorph;
    this.reset();
    this.update();
    await this.whenRendered();
    this.ui.fontSizeField.relayout();
    if (align) this.alignAtTarget();
  }

  setupConnections () {
    connect(this.ui.paddingField, 'number', this, 'setPadding');
    connect(this.ui.paddingFieldTop, 'number', this, 'setPaddingTop');
    connect(this.ui.paddingFieldBottom, 'number', this, 'setPaddingBottom');
    connect(this.ui.paddingFieldLeft, 'number', this, 'setPaddingLeft');
    connect(this.ui.paddingFieldRight, 'number', this, 'setPaddingRight');
  }

  // this.update()

  update () {
    const { target, updateSpec } = this;
    const sel = target.selection;
    const attr = (!target.readOnly && sel)
      ? (sel.isEmpty()
          ? target.textAttributeAt(sel.start)
          : target.getStyleInRange(sel))
      : {};
    const managedProps = this.managedProps;
    const targetProps = obj.select(target, managedProps);

    for (const [key, value] of Object.entries(obj.select(attr || {}, managedProps))) {
      if (typeof value !== 'undefined') targetProps[key] = value;
    }

    noUpdate(() => {
      for (const [key, elem] of Object.entries(this.ui)) {
        if (updateSpec[key]) updateSpec[key](targetProps, elem);
      }
    });
  }

  relayout () {

  }

  /* ------------UPDATING------------ */

  changeAttributeInSelectionOrMorph (name, valueOrFn) {
    const { target } = this;
    const sel = target.selection;
    if (target.isLabel || sel && sel.isEmpty()) {
      target[name] = typeof valueOrFn === 'function'
        ? valueOrFn(target[name])
        : valueOrFn;
    } else {
      target.undoManager.group();
      target.changeStyleProperty(name,
        oldVal => typeof valueOrFn === 'function'
          ? valueOrFn(oldVal)
          : valueOrFn);
      target.undoManager.group();
    }
  }

  async changeFont (fontFamily) {
    this._last = fontFamily;
    const custom = fontFamily === 'custom...';
    if (custom) {
      fontFamily = await $world.prompt('Enter font family name', {
        requester: this.target,
        historyId: 'lively.morphic-rich-text-font-names',
        useLastInput: true
      });
      if (!fontFamily) return;
    }
    this.changeAttributeInSelectionOrMorph('fontFamily', fontFamily);
  }

  setPadding (padding) {
    this.target.padding = Rectangle.inset(padding);
  }

  setPaddingTop (top) {
    const r = this.target.padding;
    this.target.padding = Rectangle.inset(r.left(), top, r.right(), r.bottom());
  }

  setPaddingLeft (left) {
    const r = this.target.padding;
    this.target.padding = Rectangle.inset(left, r.top(), r.right(), r.bottom());
  }

  setPaddingRight (right) {
    const r = this.target.padding;
    this.target.padding = Rectangle.inset(r.left(), r.top(), right, r.bottom());
  }

  setPaddingBottom (bottom) {
    const r = this.target.padding;
    this.target.padding = Rectangle.inset(r.left(), r.top(), r.right(), bottom);
  }

  setLineWrapping (wrapStyle) {
    this.target.lineWrapping = wrapStyle;
  }

  changeFontWeight (weight) {
    this.changeAttributeInSelectionOrMorph('fontWeight', weight);
  }

  changeTextAlign (textAlign) {
    this.changeAttributeInSelectionOrMorph('textAlign', textAlign);
  }

  changeFontColor (color) {
    this.changeAttributeInSelectionOrMorph('fontColor', color);
  }

  changeFontSize (size) {
    this.changeAttributeInSelectionOrMorph('fontSize', size);
  }

  changeFixedWidth (fixed) {
    this.target.fixedWidth = fixed;
  }

  changeFixedHeight (fixed) {
    this.target.fixedHeight = fixed;
  }

  async changeLink () {
    const morph = this.target;
    const sel = morph.selection;
    const { link } = morph.getStyleInRange(sel);
    const newLink = await this.world().prompt('Set link', { input: link || 'https://' });
    morph.undoManager.group();
    morph.setStyleInRange({ link: newLink || undefined }, sel);
    morph.undoManager.group();
    this.autoRemove && this.remove();
  }

  toggleUnderline () {
    this.changeAttributeInSelectionOrMorph(
      'textDecoration',
      textDecoration => (textDecoration === 'underline' ? 'none' : 'underline'));
  }

  toggleItalic () {
    this.changeAttributeInSelectionOrMorph(
      'fontStyle',
      fontStyle => fontStyle === 'italic' ? 'normal' : 'italic');
  }

  toggleBold () {
    this.changeAttributeInSelectionOrMorph(
      'fontWeight',
      fontWeight => fontWeight === 'bold' || fontWeight === '700' ? 'normal' : 'bold');
  }

  copyStyle () {
    const { target } = this;
    const { applyStyleButton } = this.ui;
    const style = target.selection.isEmpty()
      ? target.defaultTextStyle
      : target.getStyleInRange(target.selection);
    const styleString = JSON.stringify(style, null, 2);
    this.constructor.copiedStyle = style;

    applyStyleButton.tooltip = 'paste style\n' + styleString;

    this.env.eventDispatcher.doCopyWithMimeTypes([
      { type: 'text/plain', data: styleString },
      { type: 'application/morphic-text-style', styleString }
    ]).then(() => this.setStatusMessage(`Copied style\n${styleString}`))
      .catch(err => this.showError(err));
  }

  pasteStyle () {
    const { target, constructor: { copiedStyle } } = this;
    if (target.selection.isEmpty()) {
      Object.assign(target, copiedStyle);
    } else {
      target.selections.forEach(sel =>
        target.addTextAttribute(this.constructor.copiedStyle, sel));
    }
    this.update();
  }

  clearStyle () {
    const morph = this.target;
    morph.selections.forEach(sel =>
      morph.resetStyleInRange(sel));
    this.update();
  }

  configureRichTextOptions () {
    if (this.getSubmorphNamed('config panel')) { this.getSubmorphNamed('config panel').remove(); }
    const { defaultSpec, uiSpec } = this;
    const config = this.addMorph({
      name: 'config panel',
      layout: new VerticalLayout({ spacing: 5 }),
      epiMorph: true,
      submorphs: [
        ...Object.keys(defaultSpec).map(key => {
          const checked = uiSpec.rows.some(row => row.some(name => name === key));
          const l = { type: 'labeledcheckbox', label: key, name: key, checked };
          return l;
        }),
        {
          layout: new HorizontalLayout({ spacing: 3 }),
          submorphs: [
            { type: 'button', name: 'OK button', label: 'OK' },
            { type: 'button', name: 'cancel button', label: 'Cancel' }]
        }
      ]
    });
    config.center = this.innerBounds().center();
    connect(config.getSubmorphNamed('OK button'), 'fire', this, 'configureAccepted');
    connect(config.getSubmorphNamed('cancel button'), 'fire', this, 'configureCanceled');
  }

  configureAccepted () {
    const panel = this.getSubmorphNamed('config panel');
    if (!panel) return;
    panel.remove();
    const cbs = panel.submorphs.filter(ea => ea.constructor.name === 'LabeledCheckBox');
  }

  configureCanceled () {
    const panel = this.getSubmorphNamed('config panel');
    if (panel) panel.remove();
  }

  close () {
    if (this.target && this.target.attributeConnections) {
      this.target.attributeConnections.forEach(
        con => con.targetObj === this && con.disconnect());
    }
    this.remove();
  }

  alwaysTargetFocusedMorph () {
    this.startStepping(1500, 'updateTarget');
  }

  updateTarget () {
    const w = this.world();
    if (!w) return;
    const { focusedMorph: m } = w;
    if (m && (m.isLabel || m.isText) && !this.isAncestorOf(m) && this.target !== m) { this.focusOn(m, false); }
  }

  async onMouseUp (evt) {
    await this.whenRendered();
    this.update();
  }

  attachToWorld () {
    connect($world, 'onMouseDown', this, 'updateTarget', {
      garbageCollect: true
    });
  }
}
