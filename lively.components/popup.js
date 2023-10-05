import { Morph, Icon } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { PopupLight } from './popup.cp.js';

let duration = 200;

export class Popover extends Morph {
  static get properties () {
    return {
      epiMorph: { defaultValue: true },
      hasFixedPosition: { defaultValue: true },
      master: {
        initialize () {
          this.master = PopupLight;
        }
      },

      targetMorph: {
        derived: true,
        after: ['submorphs'],
        defaultValue: {
          extent: pt(200, 200),
          fill: Color.transparent,
          submorphs: [
            {
              name: 'placeholder',
              type: 'label',
              value: 'No Target Specified'
            }
          ]
        },
        get () { return this.get('body').submorphs[0]; },
        set (m) {
          this.get('body').addMorph(m);
          this.whenRendered().then(() => this.relayout());
        }
      },

      submorphs: {
        initialize () {
          this.submorphs = [
            {
              type: 'polygon',
              name: 'arrow',
              topCenter: pt(0, 0),
              borderColor: Color.transparent,
              vertices: [pt(-10, 0), pt(0, -15), pt(10, 0)]
            },
            { name: 'body' },
            {
              name: 'close button',
              type: 'label',
              textAndAttributes: Icon.textAttribute('times-circle', { fontSize: 18 }),
              tooltip: 'close',
              fill: null,
              extent: pt(16, 16),
              borderColor: Color.transparent
            }
          ];
          let [_1, body, btn] = this.submorphs;
          connect(btn, 'onMouseDown', this, 'close');
          connect(body, 'extent', this, 'relayout', {
            converter: '() => target.animated'
          });
          setTimeout(() => this.animated = true, 1000);
        }
      }
    };
  }

  relayout (animated) {
    let body = this.get('body');
    let arrow = this.get('arrow');
    let closeBtn = this.get('close button');
    let offset = arrow.height;
    let padding = 8;

    if (animated) {
      body.animate({
        topCenter: pt(0, offset),
        duration
      });
      closeBtn.animate({ topRight: body.topRight.addXY(padding, -padding), duration });
    } else {
      body.topCenter = pt(0, offset);
      closeBtn.topRight = body.topRight.addXY(padding, -padding);
    }
  }

  close () {
    this.fadeOut(300);
  }
}
