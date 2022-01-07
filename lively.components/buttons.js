import { ViewModel } from 'lively.morphic/components/core.js';
import { Morph, morph, Icon, touchInputDevice } from 'lively.morphic';
import { Rectangle, LinearGradient, Color, pt } from 'lively.graphics';
import { signal, connect } from 'lively.bindings';
import { arr, obj, Closure } from 'lively.lang';

// fixme: Review if this model is really nessecary or rather overkill
export class ButtonModel extends ViewModel {
  static get properties () {
    return {
      deactivated: {
        group: 'button',
        defaultValue: false,
        after: ['labelMorph']
      },

      pressed: {
        group: '_internal',
        defaultValue: null,
        set (val) {
          const oldVal = this.getProperty('pressed');
          // this._realFill = (!val && oldVal && oldVal.originalFill);
          if (this.view) {
            this._realFill = val ? this.view.fill.darker() : oldVal.originalFill;
          }
          this.setProperty('pressed', val);
        }
      },

      // make this a merge in property
      label: {
        group: 'button',
        after: ['labelMorph'],
        isStyleProp: true,
        type: 'RichText', // this includes an attributes Array
        set (labelMorphProperties) {
          const prevLabel = this.label || {};
          this.setProperty('label', { ...prevLabel, ...labelMorphProperties });
        }
      },

      fire: {
        group: 'button', derived: true, readOnly: true, isSignal: true
      },

      action: {
        serialize: false
      },

      expose: {
        get () { return ['enable', 'disable']; }
      },

      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'handlePressStart' },
            { signal: 'onMouseUp', handler: 'handlePressEnd' },
            { signal: 'onHoverOut', handler: 'cancelPress' },
            { signal: 'onHoverIn', handler: 'recoverPressIfNeeded' },
            { signal: 'onDragStart', handler: 'cancelPressOnDrag', override: true },
            { signal: 'onDrag', handler: 'preventDrag', override: true }
          ];
        }
      }

    };
  }

  handlePressStart (evt) {
    if (!evt.isAltDown() && !this.deactivated && this.considerPress(evt)) {
      this.pressed = { originalFill: this.view.fill };
    }
  }

  handlePressEnd (evt) {
    if (evt.isClickTarget(this.view) && this.pressed) {
      this.trigger();
      this.pressed = null;
    }
  }

  cancelPressOnDrag ($onViewDragStart, evt) {
    if (touchInputDevice) {
      this.draggable = true;
      this.pressed = null;
    } else {
      $onViewDragStart(evt);
    }
  }

  preventDrag ($onViewDrag, evt) {
    // buttons should not be draggable
  }

  cancelPress (evt) {
    if (touchInputDevice) return;
    // When leaving the button without mouse up, reset appearance
    if (this.pressed && evt.isClickTarget(this.view)) this.pressed = null;
  }

  recoverPressIfNeeded (evt) {
    if (touchInputDevice) return;
    if (!this.deactivated && evt.isClickTarget(this.view)) {
      this.pressed = { originalFill: this.fill };
    }
  }

  enable () { this.deactivated = false; }

  disable () { this.deactivated = true; }

  onRefresh () {
    if (!this.ui.label) return;
    Object.assign(this.ui.label, this.label);
    this.view.nativeCursor = this.deactivated ? 'not-allowed' : 'pointer';
    this.ui.label.opacity = this.deactivated ? 0.3 : 1;
    if (this._realFill) this.view.fill = this._realFill;
  }

  trigger () {
    try {
      signal(this, 'fire');
      typeof this.action === 'function' && this.action();
    } catch (err) {
      const w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  considerPress (evt) {
    if (touchInputDevice) return true;
    else return this.view.innerBoundsContainsPoint(evt.positionIn(this.view));
  }

  async interactivelyChangeLabel () {
    const newLabel = await this.world().prompt('edit button label', {
      input: this.labelMorph.textString,
      historyId: 'lively.morphic-button-edit-label-hist'
    });
    if (typeof newLabel === 'string') { this.label = newLabel; }
  }

  // makes sense if this is model specific. At least if view model is directly defined
  // this should override the native menuItems of a morph
  menuItems (items) { // items from the view. we can discard or adjust.
    items.unshift({ isDivider: true });
    items.unshift(['change label', () => this.interactivelyChangeLabel()]);
    return items;
  }
}

// custom morph implementations
export class Button extends Morph {
  static get properties () {
    return {
      padding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(5, 2)
      },
      draggable: { defaultValue: false },
      extent: { defaultValue: pt(100, 20) },
      borderColor: { defaultValue: Color.gray },
      borderWidth: { defaultValue: 1 },
      borderRadius: { defaultValue: 5 },
      nativeCursor: { defaultValue: 'pointer' },

      fill: {
        defaultValue: new LinearGradient({
          stops: [
            { offset: 0, color: Color.white },
            { offset: 1, color: Color.rgb(236, 240, 241) }
          ],
          vector: 0
        })
      },

      deactivated: {
        group: 'button',
        defaultValue: false,
        after: ['labelMorph'],
        set (val) {
          this.setProperty('deactivated', val);
          this.nativeCursor = val ? 'not-allowed' : 'pointer';
          this.labelMorph.opacity = val ? 0.3 : 1;
        }
      },

      pressed: {
        group: '_internal',
        defaultValue: null,
        set (val) {
          const oldVal = this.getProperty('pressed');
          this.setProperty('pressed', val);
          const realFill = (!val && oldVal && oldVal.originalFill) || this.fill;
          // this.fill = val && realFill ? realFill.darker() : realFill;
        }
      },

      fontSize: {
        group: 'button styling',
        derived: true,
        type: 'Number',
        min: 4,
        isStyleProp: true,
        after: ['label'],
        set (s) {
          this.labelMorph.fontSize = s;
          // if (this.labelMorph._parametrizedProps) { this.labelMorph._parametrizedProps.fontSize = s; }
        },
        get () {
          return this.labelMorph.fontSize;
        }
      },

      fontColor: {
        group: 'button styling',
        derived: true,
        isStyleProp: true,
        after: ['labelMorph'],
        set (c) {
          this.labelMorph.fontColor = c;
        },
        get () {
          return this.labelMorph.fontColor;
        }
      },

      labelMorph: {
        group: '_internal',
        after: ['submorphs'],
        serialize: false,
        initialize () {
          this.labelMorph = this.getSubmorphNamed('label') || this.addMorph({
            type: 'label',
            name: 'label',
            value: 'no label yet'
          });
        },
        get () { return this.getSubmorphNamed('label'); },
        set (labelMorph) {
          const existing = this.labelMorph;
          if (existing) existing.remove();
          labelMorph.name = 'label';
          labelMorph.reactsToPointer = false;
          this.addMorphAt(labelMorph, 0);
        }
      },

      labelWithTextAttributes: {
        group: '_internal',
        after: ['labelMorph'],
        derived: true,
        get () { return this.labelMorph.textAndAttributes; },
        set (val) { this.labelMorph.textAndAttributes = val; }
      },

      label: {
        group: 'button',
        after: ['labelMorph'],
        isStyleProp: true,
        type: 'RichText', // this includes an attributes Array
        set (stringOrAttributesOrMorph) {
          if (stringOrAttributesOrMorph.isMorph) {
            this.setProperty('label', stringOrAttributesOrMorph.value);
            this.labelMorph = stringOrAttributesOrMorph;
          } else {
            this.setProperty('label', stringOrAttributesOrMorph);
            this.labelMorph.value = stringOrAttributesOrMorph;
            if (this.labelMorph._parametrizedProps) { this.labelMorph._parametrizedProps.value = stringOrAttributesOrMorph; }
          }
          this.fitLabelMorph();
        }
      },

      fire: {
        group: 'button', derived: true, readOnly: true, isSignal: true
      },

      action: {
        serialize: false
      }

    };
  }

  constructor (props) {
    super(props);
    if (props) {
      return;
      const { width, height, extent, bounds } = props;
      if (width === undefined && height === undefined &&
          extent === undefined && bounds === undefined) { this.fit(); }
    }
  }

  __additionally_serialize__ (snapshot, objRef, pool, addFn) {
    super.__additionally_serialize__(snapshot, objRef, pool, addFn);
    addFn('fontSize', this.fontSize); // this is needed to make master components style work
    if (this.label != this.labelMorph.value) {
      // in cases where someone just directly changed the label,
      // the value of the labelMorph "wins"
      addFn('label', this.labelMorph.value);
    }
  }

  get isButton () { return true; }

  enable () { this.deactivated = false; }

  disable () { this.deactivated = true; }

  onChange (change) {
    const { prop } = change;
    if (this.label/* don't call too early */) {
      switch (prop) {
        case 'extent':
        case 'fontSize':
        case 'fontFamily': this.relayout(); break;
        case 'padding': this.fit();
      }
    }
    return super.onChange(change);
  }

  onSubmorphChange (change, submorph) {
    if (submorph === this.labelMorph && change.prop === 'extent') this.relayout();
    return super.onSubmorphChange(change, submorph);
  }

  fitLabelMorph () {
    this.labelMorph.whenFontLoaded().then(() => {
      this.labelMorph.invalidateTextLayout();
      this.labelMorph.fit();
    });
  }

  relayout () {
    const label = this.labelMorph;
    if (!label || this._relayouting) return;
    this._relayouting = true;
    try {
      const padding = this.padding;
      const padT = padding.top();
      const padB = padding.bottom();
      const padL = padding.left();
      const padR = padding.right();
      const minHeight = label.height + padT + padB;
      const minWidth = label.width + padL + padR;
      if (minHeight > this.height) this.height = minHeight;
      if (minWidth > this.width) this.width = minWidth;
      const innerPadding = this.innerBounds().insetByRect(padding);
      label.center = innerPadding.center().subPt(this.origin);
    } finally { this._relayouting = false; }
  }

  fit () {
    const padding = this.padding; const label = this.labelMorph;
    label.fit();
    this.extent = padding.bottomLeft().addPt(padding.bottomRight()).addPt(label.extent);
    this.relayout();
    return this;
  }

  trigger () {
    try {
      signal(this, 'fire');
      typeof this.action === 'function' && this.action();
    } catch (err) {
      const w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  considerPress (evt) {
    if (touchInputDevice) return true;
    else return this.innerBoundsContainsPoint(evt.positionIn(this));
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    if (!evt.isAltDown() && !this.deactivated && this.considerPress(evt)) { this.pressed = { originalFill: this.fill }; }
  }

  onMouseUp (evt) {
    super.onMouseUp(evt);
    if (evt.isClickTarget(this) && this.pressed) {
      this.trigger();
      this.pressed = null;
    }
  }

  onDragStart (evt) {
    if (touchInputDevice) {
      this.draggable = true;
      this.pressed = null;
    } else {
      super.onDragStart(evt);
    }
  }

  onDrag (evt) {
    // buttons should not be draggable
  }

  onHoverOut (evt) {
    super.onHoverOut(evt);
    if (touchInputDevice) return;
    // When leaving the button without mouse up, reset appearance
    if (this.pressed && evt.isClickTarget(this)) this.pressed = null;
  }

  onHoverIn (evt) {
    super.onHoverIn(evt);
    if (touchInputDevice) return;
    if (!this.deactivated && evt.isClickTarget(this)) { this.pressed = { originalFill: this.fill }; }
  }

  async interactivelyChangeLabel () {
    const newLabel = await this.world().prompt('edit button label', {
      input: this.labelMorph.textString,
      historyId: 'lively.morphic-button-edit-label-hist'
    });
    if (typeof newLabel === 'string') { this.label = newLabel; }
  }

  menuItems () {
    const items = super.menuItems();
    items.unshift({ isDivider: true });
    items.unshift(['change label', () => this.interactivelyChangeLabel()]);
    return items;
  }
}

export class RadioButton extends Morph {
  static get properties () {
    return {
      indicator: {
        get () {
          return this.getSubmorphNamed('indicator');
        }
      },

      selectionColor: {},
      selectionStyle: {},

      selected: {
        after: ['indicator'],
        defaultValue: false,
        set (bool) {
          this.getMaster(bool).then(async auto => {
            const duration = 200;
            this.master = {
              auto
            };
          });
          this.setProperty('selected', !!bool);
        }
      },

      valueFunctionString: {
        defaultValue: '"function (morph) { return morph.value; }"',
        set (funcOrString) {
          this.setProperty('valueFunctionString', funcOrString.toString());
          this.valueFn = undefined;
        }
      },

      submorphs: {
        initialize () {
          this.submorphs = [
            { type: 'ellipse', name: 'indicator' }
          ];
        }
      }
    };
  }

  async getMaster (selected) {
    const { ChoiceButtonSelected, ChoiceButtonUnselected } = await System.import('lively.components/prompts.cp.js');
    return selected ? ChoiceButtonSelected : ChoiceButtonUnselected;
  }

  reset () {
    const indicator = this.indicator;
    indicator.borderWidth = 1;
    indicator.borderColor = Color.gray;
    this.selected = false;

    connect(indicator, 'onMouseUp', this, 'select');
  }

  get morph () {
    const indicator = this.indicator;
    return this.submorphs.find(m => m !== indicator);
  }

  set morph (morph) {
    const indicator = this.indicator;
    this.submorphs.forEach(m => {
      if (m === indicator) return;
      m.remove();
    });
    morph.position = pt(50, 0);
    this.addMorph(morph);
  }

  get value () {
    if (!this.valueFn) {
      let fnCode;
      try {
        fnCode = JSON.parse(this.valueFunctionString);
      } catch (e) {
        fnCode = this.valueFunctionString;
      }
      this.valueFn = Closure.fromSource(fnCode).recreateFunc();
    }

    return this.morph ? this.valueFn(this.morph) : undefined;
  }

  onMouseDown (evt) {
    this.select();
  }

  select () {
    this.selected = true;
    this.owner.setSelection(this);
  }
}

export class RadioButtonGroup extends Morph {
  static get properties () {
    return {
      choices: {
        derived: true,
        defaultValue: [],
        get () {
          return this.submorphs.map(m => m.value);
        },
        set (labels) {
          this.removeAllButtons();
          if (obj.isArray(labels)) {
            if (labels.length == 0) return;
            labels.forEach(value => {
              this.addButton(morph({
                name: 'label', type: 'label', value, reactsToPointer: false
              }));
            });
          } else {
            labels = [...labels.entries()];
            if (labels.length == 0) return;
            labels.forEach(([label, value]) => {
              this.addButton(morph({
                name: 'label', type: 'label', value: label, reactsToPointer: false
              }), value);
            });
          }
          // fixme: this should be handled by the components themselves
          this.setSelection(this.submorphs[0]);
        },
        value: {
          derived: true,
          after: ['submorphs'],
          get () {
            const selection = this.selectedButton;
            return selection ? selection.value : null;
          },
          set (value) {
            const buttonToSelect = this.submorphs.find(m => {
              try {
                return m.value === value;
              } catch (e) {
                return false;
              }
            });
            if (buttonToSelect) {
              buttonToSelect.select();
            } else {
              this.setSelection(null);
            }
          }
        }
      }
    };
  }

  reset () {
    this.submorphs.forEach(m => m.reset());
    this.layout.layoutableSubmorphs[0].selected = true;
  }

  removeAllButtons () {
    this.removeAllMorphs();
    this.height = 10;
  }

  addButton (morph, optValue) {
    const button = new RadioButton({ name: 'button ' + (this.submorphs.length + 1) });
    button.reset();
    button.morph = morph;
    if (optValue != undefined) {
      button.internalValue = optValue;
      button.valueFunctionString = 'function (morph) { return morph.owner.internalValue; }';
    }
    this.addMorph(button);
    return button;
  }

  setSelection (activeButton) {
    this.submorphs.forEach(m => {
      if (m !== activeButton) {
        m.selected = false;
      }
    });
    activeButton.selected = true;
  }

  get selectedButton () {
    return this.submorphs.find(m => m.selected);
  }

  get value () {
    const selection = this.selectedButton;
    return selection ? selection.value : null;
  }

  set value (value) {
    const buttonToSelect = this.submorphs.find(m => {
      try {
        return m.value === value;
      } catch (e) {
        return false;
      }
    });
    if (buttonToSelect) {
      buttonToSelect.select();
    } else {
      this.setSelection(null);
    }
  }
}
