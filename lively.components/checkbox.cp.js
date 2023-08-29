import { ViewModel, part, TilingLayout, Label, component } from 'lively.morphic';
import { Color, rect } from 'lively.graphics';
import { signal } from 'lively.bindings';
import { pt } from 'lively.graphics/geometry-2d.js';

class CheckboxModel extends ViewModel {
  static get properties () {
    return {
      active: { defaultValue: true },
      checked: { defaultValue: false },
      uncheckedCheckboxComponent: {
        defaultValue: CheckboxUnchecked
      },
      checkedCheckboxComponent: {
        defaultValue: CheckboxChecked
      },
      expose: {
        get () {
          return ['isCheckbox', 'enable', 'disable', 'trigger', 'checked'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'trigger' }
          ];
        }
      }
    };
  }

  get isCheckbox () {
    return true;
  }

  disable () {
    this.active = false;
    this.view.opacity = 0.3;
  }

  enable () {
    this.active = true;
    this.view.opacity = 1;
  }

  trigger () {
    if (!this.active) return;
    this.checked = !this.checked;
    signal(this.view, 'checked', this.checked);
  }

  viewDidLoad () {
    this.view.master = this.checked ? this.checkedCheckboxComponent : this.uncheckedCheckboxComponent; // eslint-disable-line no-use-before-define
  }

  onRefresh () {
    this.view.master = this.checked ? this.checkedCheckboxComponent : this.uncheckedCheckboxComponent; // eslint-disable-line no-use-before-define
  }
}

const CheckboxChecked = component({
  name: 'checkbox/checked',
  type: Label,
  extent: pt(15, 15),
  fixedWidth: true,
  fixedHeight: true,
  lineHeight: 1,
  draggable: false,
  borderWidth: 1,
  borderColor: Color.transparent,
  fill: Color.rgb(178, 235, 242),
  fontColor: Color.rgb(65, 65, 65),
  borderRadius: 2,
  padding: rect(0, -3, 0, 3),
  nativeCursor: 'pointer',
  textAndAttributes: ['', {
    fontSize: 13,
    fontFamily: 'Material Icons'
  }]
});

const CheckboxUnchecked = component(CheckboxChecked, {
  name: 'checkbox/unchecked',
  borderWidth: 1,
  borderColor: Color.white,
  fill: Color.transparent,
  fontColor: Color.transparent
});

export const Checkbox = component(CheckboxUnchecked, {
  name: 'checkbox',
  defaultViewModel: CheckboxModel
});

const CheckboxCheckedLight = component(CheckboxChecked, {
  fill: Color.rgb(66, 165, 245),
  fontColor: Color.rgb(255, 255, 255),
  borderColor: Color.black
});

const CheckboxUncheckedLight = component(CheckboxUnchecked, {
  fontColor: Color.rgb(255, 255, 255),
  fill: Color.rgb(255, 255, 255),
  borderColor: Color.black
});

export const CheckboxLight = component(CheckboxUncheckedLight, {
  name: 'checkbox',
  viewModelClass: CheckboxModel,
  viewModel: {
    uncheckedCheckboxComponent: CheckboxUncheckedLight,
    checkedCheckboxComponent: CheckboxCheckedLight
  }
});

export class LabeledCheckboxModel extends ViewModel {
  static get properties () {
    return {
      active: {
        defaultValue: true
      },
      align: {
        defaultValue: 'left'
      },
      checked: {
        defaultValue: false
      },
      label: {
        defaultValue: 'a label'
      },
      labelMorph: {
        derived: true,
        readOnly: true,
        get () {
          return this.ui.label;
        }
      },
      checkbox: {
        derived: true,
        readOnly: true,
        get () {
          return this.ui.checkbox;
        }
      },
      expose: {
        get () {
          return ['isCheckbox', 'checked', 'active', 'label', 'enable', 'disable'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'trigger' }
          ];
        }
      }
    };
  }

  get isCheckbox () {
    return true;
  }

  onRefresh () {
    this.view.layout = this.view.layout.copy();
    this.view.layout.align = this.align;
    this.labelMorph.textString = this.label;
    this.checkbox.checked = this.checked;
  }

  viewDidLoad() {
    this.active ? this.enable() : this.disable();
  }

  trigger () {
    if (!this.active) return;
    this.checked = !this.checked;
    signal(this.view, 'checked', this.checked);
  }

  disable () {
    this.active = false;
    if (this.checkbox) this.checkbox.active = false;
    this.view.opacity = 0.3;
  }

  enable () {
    this.active = true;
    if (this.checkbox) this.checkbox.active = true;
    this.view.opacity = 1;
  }
}

export const LabeledCheckbox = component({
  defaultViewModel: LabeledCheckboxModel,
  name: 'labeled checkbox',
  fill: Color.rgba(0, 0, 0, 0),
  borderWidth: 0,
  layout: new TilingLayout({
    axisAlign: 'center',
    hugContentsHorizontally: true,
    orderByIndex: true,
    spacing: 5
  }),
  nativeCursor: 'pointer',
  submorphs: [part(Checkbox, {
    name: 'checkbox',
    reactsToPointer: false
  }), {
    type: Label,
    name: 'label',
    textAndAttributes: ['Some label...', null]
  }]
});

export const LabeledCheckboxLight = component({
  defaultViewModel: LabeledCheckboxModel,
  name: 'labeled checkbox',
  fill: Color.rgba(0, 0, 0, 0),
  borderWidth: 0,
  layout: new TilingLayout({
    axisAlign: 'center',
    hugContentsHorizontally: true,
    orderByIndex: true,
    spacing: 5
  }),
  nativeCursor: 'pointer',
  submorphs: [part(CheckboxLight, {
    name: 'checkbox',
    reactsToPointer: false
  }), {
    type: Label,
    name: 'label',
    textAndAttributes: ['Some label...', null],
    borderWidth: 0
  }]
});
