import { Morph, TilingLayout, touchInputDevice, morph, Icon, easings } from 'lively.morphic';
import { pt, Rectangle, rect, Color } from 'lively.graphics/index.js';
import { fun, num, Path, arr, string, obj } from 'lively.lang/index.js';
import { connect, signal, once, noUpdate } from 'lively.bindings/index.js';
import { TreeData } from 'lively.components';

import * as layouts from 'lively.morphic/layout.js';
import { InteractiveMorphSelector } from 'lively.halos';
import { resolvedMasters } from 'lively.morphic/components/policy.js';
import { resource } from 'lively.resources';
import { ViewModel, part } from 'lively.morphic/components/core.js';

export class SettingsTree extends TreeData {
  static default () {
    return new this({
      isCollapsed: false,
      children: [
        {
          isCollapsed: true,
          name: [' ', {}, ...Icon.textAttribute('font'), ' Rich Text', { fontWeight: 'bold' }],
          children: [{
            panel: morph({})
          }]
        },
        {
          isCollapsed: false,
          name: [' ', {}, ...Icon.textAttribute('image'), ' Shape', { fontWeight: 'bold' }],
          children: [{
            panel: morph({})
          }]
        },
        {
          isCollapsed: false,
          name: [' ', {}, ...Icon.textAttribute('border-style'), ' Border', { paddingLeft: '2px', fontWeight: 'bold' }],
          children: [{
            panel: morph({})
          }]
        },
        {
          isCollapsed: false,
          name: [' ', {}, ...Icon.textAttribute('grip-vertical'), ' Layout', { paddingLeft: '4px', fontWeight: 'bold' }],
          children: [{
            panel: morph({})
          }]
        }
      ]
    });
  }

  static border () {
    return new this({
      isCollapsed: false,
      children: [
        {
          isCollapsed: true,
          name: [' Type    ', {}, morph({ height: 20 }), {}],
          children: [{
            panel: morph({})
          }]
        },
        {
          isCollapsed: false,
          name: [' Color   ', {}, morph({ height: 20 }), {}],
          children: [{
            panel: morph({})
          }]
        },
        {
          isCollapsed: false,
          name: [' Width  ', {}, morph({ height: 20 }), {}],
          children: [{
            panel: morph({})
          }]
        },
        {
          isCollapsed: false,
          name: [' Radius ', {}, morph({ height: 20 }), {}],
          children: [{
            panel: morph({})
          }]
        }
      ]
    });
  }

  display (node) {
    if (node.panel) return [node.panel, {}];
    else return node.name;
  }

  collapse (node, bool) {
    node.isCollapsed = bool;
  }

  isCollapsed (node) {
    return node.isCollapsed;
  }

  isLeaf (node) {
    return !node.children;
  }

  getChildren (node) {
    if (node === this.root) {
      return node.children.filter(n => {
        if (this.target && n.applicabilityCheck) return eval(n.applicabilityCheck)(this.target);
        return true;
      });
    }
    return node.children;
  }
}

export default class StylingSideBar extends Morph {
  static get properties () {
    return {
      controls: {},
      richTextControl: {},
      isHaloItem: {
        get () {
          return true;
        }
      }
    };
  }

  relayout () {
    this.onWorldResize();
  }

  collapseAll () {
    this.getSubmorphsByStyleClassName('Tree').forEach(t => {
      t.nodes.forEach(n => t.treeData.root == n ? t.uncollapse(n) : t.collapse(n));
    });
  }

  onWorldResize (align = true) {
    if (!this.respondsToVisibleWindow) return;
    const bounds = $world.visibleBounds();
    const offsetTop = navigator.standalone && touchInputDevice ? 25 : 0;
    const hr = this.getSubmorphNamed('horizontal resizer');

    this.height = bounds.height - offsetTop;
    this.top = offsetTop + bounds.top();
    hr.height = this.height;
    hr.left = 0;
    hr.top = 0;
    if (!align) return;
    if (this.visible) {
      this.topRight = bounds.topRight();
    } else this.topLeft = bounds.topRight();
  }

  async toggle (active) {
    const bounds = $world.visibleBounds();
    const offsetTop = navigator.standalone && touchInputDevice ? 25 : 0;
    this.height = bounds.height - offsetTop;
    this.top = offsetTop + bounds.top();
    if (active) {
      $world.addMorph(this, $world.get('lively top bar'));
      this.topLeft = bounds.topRight();
      this.visible = true;
      await this.whenRendered();
      this.onWorldResize(false);
      await this.animate({
        opacity: 1,
        easing: easings.outCirc,
        topRight: bounds.topRight(),
        duration: 300
      });
      this.attachToWorld($world);
    } else {
      this.detachFromWorld($world);
      await this.animate({
        opacity: 0,
        topLeft: bounds.topRight(),
        duration: 300
      });
      this.visible = false;
      this.remove();
    }
  }

  cleanupAnchors () {
    const morphsWithEmptyAnchors = this.withAllSubmorphsSelect(m => m.anchors && m.anchors.filter(a => !a.id).length);
    for (const m of morphsWithEmptyAnchors) {
      m.anchors.forEach(a => !a.id && m.removeAnchor(a));
    }
    return morphsWithEmptyAnchors.length;
  }

  // fixme: connect

  attachToWorld (world) {
    connect(world, 'showHaloFor', this, 'focusMorph', {
      garbageCollect: true
    });
  }

  detachFromWorld (world) {
    world.attributeConnections.forEach(conn => {
      if (conn.targetObj === this) conn.disconnect();
    });
  }

  focusMorph (target) {
    if (target.isMorph && target.ownerChain().includes(this)) return;
    if (target.isLabel || target.isText || target.isButton) {
      this.richTextControl.focusOn(target, false);
    } else {
      // temporary deactivate the rich text interface not to confuse the user
    }
    const tree = this.getSubmorphNamed('style settings tree');
    tree.treeData.target = target;
    tree.update(true);
    Object.values(this.controls).forEach(control => control && control.focusOn(target));
  }

  onHierarchyChange () {
    Object.values(this.controls).forEach(control => control && control.update());
  }
}

export class ShapeFormatStyler extends Morph {
  static get properties () {
    return {
      uiSpec: {
        get () {
          // ui member name: [field name, field property, target property]
          return this._uiSpec || (this._uiSpec = {
            clipModeSelector: ['clip mode selector', 'selection', 'clipMode'],
            fillPicker: ['fill picker', 'colorValue', 'fill'],
            shadowPicker: ['shadow picker', 'shadowValue', 'dropShadow'],
            opacityField: ['opacity field', 'number', 'opacity'],
            heightField: ['height field', 'number', 'height'],
            widthField: ['width field', 'number', 'width'],
            posXField: ['pos x field', 'number', 'left'],
            posYField: ['pos y field', 'number', 'top'],
            imageUrlInput: ['image url input', 'inputAccepted', 'imageUrl'],
            labelContentInput: ['label content input', 'inputAccepted', 'textString']
          });
        }
      },
      ui: {
        readOnly: true,
        get () {
          const { uiSpec } = this;
          return this._ui || (this._ui = obj.extract(uiSpec, obj.keys(uiSpec), (_, [name]) => {
            return this.getSubmorphNamed(name);
          }));
        }
      }
    };
  }

  constructor (props) {
    super(props);
    if (this.submorphs.length > 0) {
      this.setupConnections();
    }
  }

  // this.setupConnections()

  setupConnections () {
    const { uiSpec, ui } = this;
    for (const [field, [_, fieldProp, prop]] of Object.entries(uiSpec)) {
      const control = ui[field];
      connect(control, fieldProp, this, 'updateTarget', {
        updater: ($upd, val) => {
          control._updating = true;
          $upd(prop, val);
          control._updating = false;
        },
        varMapping: { prop, control }
      });
    }
  }

  update () {
    const {
      top, left, isImage, isLabel, imageUrl, textString,
      clipMode, fill, dropShadow, opacity, height, width
    } = this.target;

    const {
      clipModeSelector, fillPicker, opacityField,
      shadowPicker, heightField, widthField, posXField, posYField,
      imageUrlInput, labelContentInput
    } = this.ui;

    noUpdate(() => {
      this.updateControl(shadowPicker, 'shadowValue', dropShadow); // fix this
      this.updateControl(clipModeSelector, 'selection', clipMode);
      this.updateControl(fillPicker, 'colorValue', fill);
      this.updateControl(opacityField, 'number', opacity);
      this.updateControl(heightField, 'number', height);
      this.updateControl(widthField, 'number', width);
      this.updateControl(posXField, 'number', left);
      this.updateControl(posYField, 'number', top);
      fillPicker.context = this.target;
      if (isImage) this.updateControl(imageUrlInput, 'input', imageUrl);
      imageUrlInput.owner.isLayoutable = imageUrlInput.owner.visible = !!isImage;
      if (isLabel) this.updateControl(labelContentInput, 'input', textString);
      labelContentInput.owner.isLayoutable = labelContentInput.owner.visible = !!isLabel;
      const specialControls = this.getSubmorphNamed('special controls');
      if (specialControls.visible = !!isLabel || !!isImage) {
        this.height = specialControls.bottom;
      } else {
        this.height = specialControls.top;
      }
    });
  }

  updateTarget (prop, value) {
    this.target[prop] = value;
    this.update();
  }

  updateControl (control, prop, value) {
    if (!control._updating && !obj.equals(control[prop], value)) { control[prop] = value; }
  }

  updateMultiValue (mainFieldName, value, prop) {
    const ui = this.ui;
    const mainField = ui[this.join(mainFieldName)];
    const indicator = mainField.get('multi value indicator');
    const isMultiValue = obj.values(value).some(v =>
      !obj.isFunction(v) && !obj.equals(v, value.valueOf()));

    indicator.left = 0;
    mainField.visible = mainField.isLayoutable = !isMultiValue;
    if (isMultiValue && indicator.visible != isMultiValue) {
      once(indicator, 'onMouseDown', mainField, prop, {
        converter: () => value.valueOf(),
        varMapping: { value }
      });
    }
    indicator.visible = indicator.isLayoutable = isMultiValue;
    indicator.left = isMultiValue ? 200 : 0;

    this.updateControl(mainField, prop, value.valueOf());

    for (const side of ['top', 'left', 'bottom', 'right']) {
      const subField = ui[this.join(mainFieldName, side)];
      this.updateControl(subField, prop, value[side]);
    }
  }

  lower (s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  join (fieldName, sub) {
    return this.lower(string.camelCaseString(fieldName + (sub ? ` ${sub}` : '')));
  }

  unwrap (mainFieldName, prop, targetProp) {
    const fields = {
      [this.lower(string.camelCaseString(mainFieldName))]: [mainFieldName, prop, targetProp]
    };
    for (const side of ['top', 'left', 'bottom', 'right']) {
      const subFieldName = mainFieldName + ' ' + side;
      fields[this.lower(string.camelCaseString(subFieldName))] = [subFieldName, prop, this.join(targetProp, side)];
    }
    return fields;
  }

  async focusOn (target) {
    if (target && !this.isAncestorOf(target) &&
        this.target !== target &&
        !obj.isArray(target)) { this.target = target; }

    const visible = this.visible;
    this.visible = true;
    await this.whenRendered();
    this.update();
    await this.whenRendered();
    this.getSubmorphsByStyleClassName('NumberWidget').map(m => m.relayout());
    this.visible = visible;
  }

  removeFocus () {
    this.target = null;
  }

  onHoverIn (evt) {
    this.watchForTarget = false;
  }

  onHoverOut (evt) {
    this.watchForTarget = true;
  }
}

export class BorderFormatStyler extends Morph {
  static get properties () {
    return {
      uiSpec: {
        derived: true,
        serialize: false,
        get () {
          // ui member name: [field name, field property, target property]
          return this._uiSpec || (this._uiSpec = {
            ...this.unwrap('border style selector', 'selection', 'borderStyle'),
            ...this.unwrap('border color picker', 'colorValue', 'borderColor'),
            ...this.unwrap('border radius field', 'number', 'borderRadius'),
            ...this.unwrap('border width field', 'number', 'borderWidth')
          });
        }
      },

      ui: {
        initialize () {
          this.setupUI();
        }
        // this needs to be hard refs since the tree removes morphs when collapsed
      }
    };
  }

  setupUI () {
    this.getSubmorphsByStyleClassName('NumberWidget').map(m => {
      let name = string.camelCaseString(m.name);
      name = name[0].toLowerCase() + name.slice(1);
      this.ui[name] = m;
    });
  }

  cleanupAnchors () {
    const morphsWithEmptyAnchors = this.withAllSubmorphsSelect(m => m.anchors && m.anchors.filter(a => !a.id));
    for (let m of morphsWithEmptyAnchors) {
      m.anchors.forEach(a => !a.id && m.removeAnchor(a));
    }
  }

  // this.clear()

  constructor (props) {
    super(props);
    if (this.submorphs.length > 0) {
      this.setupConnections();
    }
  }

  // this.setupConnections()

  setupConnections () {
    let { uiSpec, ui } = this;
    for (let [field, [_, fieldProp, prop]] of Object.entries(uiSpec)) {
      let control = ui[field];
      connect(control, fieldProp, this, 'updateTarget', {
        updater: ($upd, val) => {
          control._updating = true;
          $upd(prop, val);
          control._updating = false;
        },
        varMapping: { prop, control }
      });
    }
  }

  // this.update()

  update () {
    let {
      clipMode, fill, dropShadow, opacity,
      borderStyle, borderColor,
      borderRadius, borderWidth
    } = this.target;

    let {
      clipModeSelector, fillPicker, opacityField, shadowPicker
    } = this.ui;

    noUpdate(() => {
      this.updateMultiValue('border style selector', borderStyle, 'selection');
      this.updateMultiValue('border color picker', borderColor, 'colorValue');
      this.updateMultiValue('border radius field', borderRadius, 'number');
      this.updateMultiValue('border width field', borderWidth, 'number');
    });
  }

  updateTarget (prop, value) {
    this.target[prop] = value;
    this.update();
  }

  updateControl (control, prop, value) {
    if (!control._updating && !obj.equals(control[prop], value)) { control[prop] = value; }
  }

  updateMultiValue (mainFieldName, value, prop) {
    let ui = this.ui;
    let mainField = ui[this.join(mainFieldName)];
    let indicator = mainField.get('multi value indicator');
    let isMultiValue = obj.values(value).some(v =>
      !obj.isFunction(v) && !obj.equals(v, value.valueOf()));

    mainField.visible = mainField.isLayoutable = !isMultiValue;
    if (isMultiValue && indicator.visible != isMultiValue) {
      once(indicator, 'onMouseDown', mainField, prop, {
        converter: () => value.valueOf(),
        varMapping: { value }
      });
    }
    indicator.visible = indicator.isLayoutable = isMultiValue;

    this.updateControl(mainField, prop, value.valueOf());

    for (let side of ['top', 'left', 'bottom', 'right']) {
      let subField = ui[this.join(mainFieldName, side)];
      this.updateControl(subField, prop, value[side]);
    }
  }

  lower (s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  join (fieldName, sub) {
    return this.lower(string.camelCaseString(fieldName + (sub ? ` ${sub}` : '')));
  }

  unwrap (mainFieldName, prop, targetProp) {
    let fields = {
      [this.lower(string.camelCaseString(mainFieldName))]: [mainFieldName, prop, targetProp]
    };
    for (let side of ['top', 'left', 'bottom', 'right']) {
      let subFieldName = mainFieldName + ' ' + side;
      fields[this.lower(string.camelCaseString(subFieldName))] = [subFieldName, prop, this.join(targetProp, side)];
    }
    return fields;
  }

  attachToWorld () {
    connect($world, 'showHaloFor', this, 'focusOn', {
      garbageCollect: true
    });
  }

  async focusOn (target) {
    if (target && !this.isAncestorOf(target) &&
        this.target !== target &&
        !obj.isArray(target)) { this.target = target; }

    let visible = this.visible;
    this.visible = true;
    await this.whenRendered();
    this.update();
    await this.whenRendered();
    this.getSubmorphsByStyleClassName('NumberWidget').map(m => m.relayout());
    this.visible = visible;
  }

  onHoverIn (evt) {
    this.watchForTarget = false;
  }

  onHoverOut (evt) {
    this.watchForTarget = true;
  }
}

export class ShapeLayoutControl extends Morph {
  static get properties () {
    return {
      managedProps: {
        get () {
          return [
            ['type', 'selection', true],
            ['align', 'selection'],
            ['direction', 'selection'],
            ['axis', 'selection'],
            ['spacing', 'number'],
            ['auto resize', 'checked'],
            ['resize submorphs', 'checked'],
            ['x axis policy', 'selection', true],
            ['y axis policy', 'selection', true],
            ['react to submorph animations', 'checked'],
            ['submorph settings', false, true],
            ['order by index', 'checked'],
            ['dragme', false, true],
            ['configure grid layout', false, true]
          ];
        }
      },
      ui: {
        readOnly: true,
        get () {
          let ui = {
            labelContainer: this.getSubmorphNamed('label container'),
            controlContainer: this.getSubmorphNamed('control container')
          };
          for (let [prop] of this.managedProps) {
            let labelName = prop + ' label';
            let controlName = prop + ' control';
            ui[this.join(labelName)] = this.getSubmorphNamed(labelName);
            ui[this.join(controlName)] = this.getSubmorphNamed(controlName);
          }
          return ui;
        }
      }
    };
  }

  // this.focusOn(this.get('tester'))

  focusOn (target) {
    this.target = target;
    this.update(false);
  }

  setupConnections () {
    let ui = this.ui;
    connect(ui.submorphSettingsControl, 'fire', this, 'chooseSubmorphToChangeLayoutSettings');
    connect(ui.dragmeControl, 'onDragStart', this, 'onSubmorphSettingsDragStart');
    connect(ui.xAxisPolicyControl, 'selection', this, 'updateSubmorphConstraintLayoutSettings', {
      converter: `policy => ({
        policy,
        axis: "x",
        submorph: self.selectedSubmorph,
      })`,
      varMapping: {
        self: this
      }
    });
    connect(ui.yAxisPolicyControl, 'selection', this, 'updateSubmorphConstraintLayoutSettings', {
      converter: `policy => ({
        policy,
        axis: "y",
        submorph: self.selectedSubmorph,
      })`,
      varMapping: {
        self: this
      }
    });

    for (let [propName, accessor, customConnect] of this.managedProps) {
      if (customConnect) { continue; }
      let prop = this.join(propName);
      let control = ui[this.join(propName, 'control')];
      connect(control, accessor, this, 'updateLayout', {
        updater: ($upd, val) => {
          $upd(prop, val);
        },
        varMapping: { prop }
      });
    }
  }

  lower (s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  join (fieldName, sub) {
    return this.lower(string.camelCaseString(fieldName + (sub ? ` ${sub}` : '')));
  }

  updateLayoutOfTarget (layout) {
    let layoutClass = layouts[string.camelCaseString(layout)];
    this.target.layout = layoutClass ? new layoutClass({ autoResize: false }) : null;
    this.update();
  }

  updateLayout (prop, value) {
    const newLayout = this.target.layout.copy();
    newLayout[prop] = value;
    this.target.layout = newLayout;
  }

  update (refresh = true) {
    if (!this.target) return;
    noUpdate(() => {
      let ui = this.ui;
      let layout = this.target.layout || { name: () => 'No' };
      let i = 0;
      for (let [prop, accessor, updater] of this.managedProps) {
        i += 5;
        let control = ui[this.join(prop, 'control')];
        let label = ui[this.join(prop, 'label')];

        if (!accessor) continue;
        if (prop === 'type') {
          control.selection = layout.name() + ' Layout';
          continue;
        }

        let value = layout[this.join(prop)];
        let propApplicable = typeof value !== 'undefined';
        if (propApplicable) {
          switch (prop) {
            case 'align':
              control.items = layout.possibleAlignValues; break;
            case 'direction':
              control.items = layout.possibleDirectionValues; break;
            case 'axis':
              control.items = layout.possibleAxisValues; break;
          }
          control[accessor] = value;
        }
        label.isLayoutable = label.visible = propApplicable;
      }
      this.showGridLayoutControl(layout.name() === 'Grid');
      this.showProportionalControl(layout.name() === 'Proportional');
    });
  }

  // proportional layout stuff

  updateSubmorphConstraintLayoutSettings ({ policy, axis, submorph }) {
    this.target.layout.changeSettingsFor(submorph, {
      [axis]: policy
    }, true);
  }

  onSubmorphSettingsDragStart (evt) {
    evt.stop();
    let layout = this.target.layout;
    let settings = layout.settingsFor(this.selectedSubmorph); let descr = [];
    for (let name in settings) descr = [...descr, name + ': ', { fontWeight: 'bold' }, settings[name] + ' ', {}];
    let grabme = morph({
      type: 'label',
      fontColor: Color.white,
      value: descr,
      fill: Color.black.withA(0.7),
      padding: 5,
      borderRadius: 10,
      isLayoutable: false
    });
    grabme.wantsToBeDroppedOn = (dropTarget) => layout.layoutableSubmorphs.includes(dropTarget);
    grabme.onBeingDroppedOn = (hand, dropTarget) => {
      grabme.remove();
      let target = layout.layoutableSubmorphs.includes(dropTarget)
        ? dropTarget
        : evt.world.morphsContainingPoint(evt.hand.position).find(ea =>
          layout.layoutableSubmorphs.includes(ea));
      if (target) {
        this.updateSubmorphConstraintLayoutSettings({ policy: settings.x, axis: 'x', submorph: target });
        this.updateSubmorphConstraintLayoutSettings({ policy: settings.y, axis: 'y', submorph: target });
        target.show();
        $world.setStatusMessage('layout settings applied');
      }
    };
    evt.hand.grab(grabme);
    grabme.moveBy(pt(10, 10));
  }

  async chooseSubmorphToChangeLayoutSettings () {
    let morphs = this.target.layout.layoutableSubmorphs; let submorph;
    // prevent drawer from loosing focus
    this.manageFocus = true;
    if (this.env.eventDispatcher.isKeyPressed('Shift')) {
      let items = morphs.map(m => ({ isListItem: true, string: String(m), value: m }));
      ({ selected: [submorph] } = await $world.listPrompt(
        'Select morph', items, { onSelection: ea => ea.show() }));
    } else {
      submorph = await InteractiveMorphSelector.selectMorph(
        this.world(), this, target => morphs.includes(target));
    }
    this.manageFocus = false;
    // stop prevention
    this.selectedSubmorph = submorph;
    if (!submorph) return;

    let { xAxisPolicyControl, yAxisPolicyControl } = this.ui;
    let submorphSettings = this.target.layout.settingsFor(submorph);
    noUpdate(() => {
      xAxisPolicyControl.selection = submorphSettings.x;
      yAxisPolicyControl.selection = submorphSettings.y;
    });
  }

  showProportionalControl (active) {
    let {
      submorphSettingsControl, dragmeControl,
      xAxisPolicyControl, xAxisPolicyLabel,
      yAxisPolicyControl, yAxisPolicyLabel
    } = this.ui;
    [
      submorphSettingsControl, dragmeControl,
      xAxisPolicyControl, xAxisPolicyLabel,
      yAxisPolicyControl, yAxisPolicyLabel
    ].forEach(elem => {
      elem.isLayoutable = active;
      elem.visible = active;
    });
  }

  showGridLayoutHalo () {
    $world.showLayoutHaloFor(this.target);
  }

  showGridLayoutControl (active) {
    let button = this.ui.configureGridLayoutControl;
    button.visible = button.isLayoutable = active;
  }
}

class MasterComponentControl extends Morph {
  focusOn (target) {
    this.target = target;
    this.update();
  }

  async onMouseUp (evt) {
    let stateToModify;
    if (evt.targetMorph.name == 'auto master selection') {
      stateToModify = 'auto';
    }
    if (evt.targetMorph.name == 'hover master selection') {
      stateToModify = 'hover';
    }
    if (evt.targetMorph.name == 'click master selection') {
      stateToModify = 'click';
    }

    this.refreshButtons();

    if (!this.target) return;

    for (const state of ['auto', 'hover', 'click']) {
      if (this.target.master &&
          this.target.master[state] &&
          !this.get(state + ' master checkbox').checked) {
        this.adjustMasterComponent(state, null);
      }
    }

    if (stateToModify) {
      const menu = this.openMenu(await this.getMastersMenu(stateToModify), evt);
    }
  }

  async getMastersMenu (stateToModify) {
    return await Promise.all([...Object.keys(resolvedMasters), this.world().name].map(async worldName => {
      const isLocal = worldName == this.world().name;
      return [
        isLocal ? 'This World' : worldName,
        this.componentsToMenu(await resource(`styleguide://${worldName}/`).dirList(), stateToModify)
      ];
    }));
  }

  componentsToMenu (components, state, items = null, depth = 1) {
    if (!items) {
      items = components.map(component => ({
        name: arr.last(component.name.split('/')),
        path: component.name.split('/'),
        value: component
      }));
    }

    if (items.length == 0) return [];
    if (depth > 100) return [];
    const self = this;
    return Object.entries(arr.groupBy(items, c => c.path[depth - 1])).map(([name, entries]) => {
      const [components, categories] = arr.partition(entries, entry => entry.path.length <= depth);
      const subMenu = [
        name,
        this.componentsToMenu(null, state, categories, depth + 1)
      ];
      return [
        ...components.map(entry => {
          return [entry.name, () => { self.adjustMasterComponent(state, entry.value); }];
        }),
        ...subMenu[1].length ? [subMenu] : []
      ];
    }).flat();
  }

  async getComponentSelectionMenu (state) {
    const worldName = this.world().metadata.commit.name;
    const res = resource(`styleguide://${worldName}/`);
    const components = await res.dirList();
    const systemComponents = await resource('styleguide://System/').dirList();
    const localMenu = this.componentsToMenu(components, state);
    const remoteMenu = this.componentsToMenu(systemComponents, state);
    return [
      ...localMenu.length > 0
        ? [
            ...localMenu,
            { isDivider: true }
          ]
        : [],
      ...remoteMenu
    ];
  }

  adjustMasterComponent (state, component) {
    if (this.target.master) { this.target.master[state] = component; } else if (component) {
      this.target.master = {
        [state]: component
      };
    }
    const { auto, hover, click } = this.target.master;
    if (!auto && !hover && !click) this.target.master = null;
    this.update();
    this.target.withAllSubmorphsDo(m => delete m._parametrizedProps); // clear them all
    this.target.requestMasterStyling();
  }

  componentsToMenu (components, state, items = null, depth = 1) {
    if (!items) {
      items = components.map(component => ({
        name: arr.last(component.name.split('/')),
        path: component.name.split('/'),
        value: component
      }));
    }

    if (items.length == 0) return [];
    if (depth > 100) return [];
    const self = this;
    return Object.entries(arr.groupBy(items, c => c.path[depth - 1])).map(([name, entries]) => {
      const [components, categories] = arr.partition(entries, entry => entry.path.length <= depth);
      const subMenu = [
        name,
        this.componentsToMenu(null, state, categories, depth + 1)
      ];
      return [
        ...components.map(entry => {
          return [entry.name, () => { self.adjustMasterComponent(state, entry.value); }];
        }),
        ...subMenu[1].length ? [subMenu] : []
      ];
    }).flat();
  }

  update () {
    if (!this.target) return;
    for (const state of ['auto', 'hover', 'click']) {
      const btn = this.getSubmorphNamed(state + ' master selection');
      const checkBox = this.getSubmorphNamed(state + ' master checkbox');
      if (Path(['master', state]).get(this.target)) checkBox.checked = true;
      else checkBox.checked = false;
      btn.label = string.truncateLeft(Path(['master', state, 'name']).get(this.target) || 'select master', 15, '...');
    }
    this.refreshButtons();
  }

  refreshButtons () {
    for (const state of ['auto', 'hover', 'click']) {
      const btn = this.getSubmorphNamed(state + ' master selection');
      const checkBox = this.getSubmorphNamed(state + ' master checkbox');
      const disabled = btn.deactivated = !checkBox.checked;

      this.getSubmorphNamed(state + ' master selection').opacity = disabled ? 0.5 : 1;
    }
    // display overridden properties
    const overriddenPropsList = this.getSubmorphNamed('overridden props list');
    overriddenPropsList.items = this.getOverriddenProps();
    this.getSubmorphNamed('clear overridden prop button').deactivated = !overriddenPropsList.selection;
  }

  getMasterForTarget () {
    if (!this.target.isMorph) return;
    return [this.target, ...this.target.ownerChain()].map(m => m.master).find(Boolean);
  }

  clearSelectedProperty () {
    const prop = this.getSubmorphNamed('overridden props list').selection;
    this.getMasterForTarget().clearOverriddenPropertiesFor(this.target, [prop]);
    this.refreshButtons();
  }

  getOverriddenProps () {
    const master = this.getMasterForTarget();
    if (!master || !master._overriddenProps) return [];
    const props = master._overriddenProps.get(this.target);
    if (!props) return [];
    return Object.keys(props);
  }
}
