import { Morph, ViewModel } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import { signal } from 'lively.bindings';

export class LabeledCheckBoxModel extends ViewModel {
  static get properties () {
    return {
      alignCheckBox: {
        defaultValue: 'left',
        type: 'Enum',
        values: ['left', 'right']
      },
      label: {
        defaultValue: 'a label'
      },
      checked: {
        type: 'Boolean'
      },
      active: {
        type: 'Boolean',
        defaultValue: true
      },
      labelMorph: {
        derived: true,
        readOnly: true,
        get () {
          return this.ui.label;
        }
      },
      checkboxMorph: {
        derived: true,
        readOnly: true,
        get () {
          return this.ui.checkbox;
        }
      },

      expose: {
        get () {
          return ['checked', 'active', 'label'];
        }
      },

      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'onClick' },
            { target: 'checkbox', signal: 'checked', handler: 'onTrigger' }
          ];
        }
      }
    };
  }

  onRefresh () {
    if (!this.view) return;
    this.view.withMetaDo({ metaInteraction: true }, () => {
      this.labelMorph.value = this.label;
      this.checkboxMorph.checked = this.checked;
    });
  }

  onTrigger (active) {
    this.setProperty('checked', active); // bypass the update
    signal(this, 'checked', active);
  }

  disable () {
    this.active = false;
    this.labelMorph.opacity = 0.5;
  }

  enable () {
    this.active = true;
    this.labelMorph.opacity = 1;
  }

  trigger () {
    this.checkboxMorph.trigger();
  }

  onClick (evt) {
    if (this.active) this.trigger();
    evt.stop();
  }
}

// custom morph implementation since we have to adjust the rendering
export class CheckBoxMorph extends Morph {
  static get properties () {
    return {
      draggable: { defaultValue: false },
      extent: { defaultValue: pt(15, 15) },
      borderWidth: { defaultValue: 0 },
      active: { defaultValue: true },
      checked: { defaultValue: false },
      fill: { defaultValue: Color.transparent },
      nativeCursor: { defaultValue: 'pointer' }
    };
  }

  get isCheckbox () {
    return true;
  }

  trigger () {
    try {
      this.checked = !this.checked;
      signal(this, 'toggle', this.checked);
    } catch (err) {
      const w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  onMouseDown (evt) {
    if (this.active) this.trigger();
  }

  patchSpecialProps (node) {
    if (this.renderingState.checked !== this.checked) {
      node.firstChild.checked = this.checked;
      this.renderingState.checked = this.checked;
    }
    if (this.renderingState.active !== this.active) {
      node.firstChild.disabled = !this.active;
      this.renderingState.active = this.active;
    }
  }

  getNodeForRenderer (renderer) {
    return renderer.nodeForCheckbox(this);
  }
}
