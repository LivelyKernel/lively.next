import { component, without, ViewModel, add, part } from 'lively.morphic';

import { DarkPopupWindow } from '../studio/shared.cp.js';
import { RichTextControl } from '../studio/controls/text.cp.js';
import { Color } from 'lively.graphics';

class TextFormattingPopUpModel extends ViewModel {
  static get properties () {
    return {
      expose: { get () { return ['close', 'onHoverOut']; } },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' }
          ];
        }
      },
      targetMorph: {}
    };
  }

  onHoverOut (evt) {
    if (this.targetMorph.bounds().containsPoint(evt.hand.position)) return;

    this.targetMorph.removeFormattingPopUp();
  }

  close () {
    this.view.remove();
  }

  viewDidLoad () {
    this.ui.richTextControl.viewModel.targetMorph = this.targetMorph;
  }
}

const SelectionBasedRichTextControl = component(RichTextControl, {
  submorphs: [
    without('h floater'),
    {
      name: 'bottom wrapper',
      height: 22,
      submorphs: [
        without('line wrapping selector')
      ]
    }
  ]
}
);

// part(TextFormattingPopUp).openInWorld();
export const TextFormattingPopUp = component(DarkPopupWindow, {
  name: 'formatting pop up',
  defaultViewModel: TextFormattingPopUpModel,
  fill: Color.rgb(30, 30, 30),
  submorphs: [
    {
      name: 'header menu',
      submorphs: [{ name: 'title', textAndAttributes: ['Format Selection', null] }]
    },
    add(part(SelectionBasedRichTextControl))
  ]

});
