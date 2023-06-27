import { component, TilingLayout, without, ViewModel, add, part } from 'lively.morphic';
import { DarkPopupWindow } from '../studio/shared.cp.js';
import { RichTextControl } from '../studio/controls/text.cp.js';

class TextFormattingPopUpModel extends ViewModel {
  static get properties () {
    return {
      expose: { get () { return ['close']; } },
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

  close () {
    this.view.remove();
  }

  viewDidLoad () {
    this.ui.richTextControl.targetMorph = this.targetMorph;
    this.ui.richTextControl.update();
    this.view.withAllSubmorphsDo(m => m.halosEnabled = false);
  }
}

const SelectionBasedRichTextControl = component(RichTextControl, {
  submorphs: [
    without('h floater'),
    {
      name: 'bottom wrapper',
      height: 22,
      submorphs: [
        without('line wrapping selector'),
        without('resizing controls')
      ]
    },
    without('padding controls')
  ]
}
);

export const TextFormattingPopUp = component(DarkPopupWindow, {
  name: 'formatting pop up',
  defaultViewModel: TextFormattingPopUpModel,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsVertically: true,
    hugContentsHorizontally: true,
    resizePolicies: [
      ['header menu', { width: 'fill', height: 'fixed' }]
    ]
  }),
  submorphs: [
    {
      name: 'header menu',
      submorphs: [{ name: 'title', textAndAttributes: ['Format Selection', null] }]
    },
    add(part(SelectionBasedRichTextControl, {
      name: 'rich text control'
    }))
  ]

});
