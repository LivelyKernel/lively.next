import { ViewModel, TilingLayout, add, without, Icon, part, component } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import { EnumSelector, DarkThemeList } from '../shared.cp.js';

import { PropertySection } from './section.cp.js';

export class EmbeddingControlModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      bindings: {
        get () {
          return [
            { model: 'morph embedding selector', signal: 'selection', handler: 'changeMorphEmbedding' }
          ];
        }
      }
    };
  }

  changeMorphEmbedding (embedding) {
    const { targetMorph } = this;
    const textMorph = targetMorph.owner;
    if (embedding === 'plain') {
      const charPos = targetMorph.position;
      textMorph.removeMorph(targetMorph);
      textMorph.addMorph(targetMorph);
      targetMorph.position = charPos;
    }
    if (embedding === 'no-wrap') {
      const textPos = textMorph.textPositionFromPoint(targetMorph.position);
      textMorph.insertText([targetMorph, null], textPos);
    }
  }

  attach (view) {
    super.attach(view);
  }

  focusOn (targetMorph) {
    const selector = this.ui.morphEmbeddingSelector;
    this.targetMorph = targetMorph;
    if (!this.targetMorph || !this.targetMorph.owner.isText) return;

    this.withoutBindingsDo(() => {
      if (this.targetMorph.owner.embeddedMorphs.includes(targetMorph)) selector.selection = 'no-wrap';
      else if (this.targetMorph.owner.displacingMorphs.includes(targetMorph)) selector.selection = 'wrap';
      else selector.selection = 'plain';
    });
  }
}

const EmbeddingControl = component(PropertySection, {
  defaultViewModel: EmbeddingControlModel,
  name: 'embedding control',
  extent: pt(250, 121),
  submorphs: [{
    name: 'h floater',
    submorphs: [
      without('add button'), {
        name: 'section headline',
        textAndAttributes: ['Content Embeddings', null]
      }]
  },
  add({
    name: 'elements wrapper',
    extent: pt(250, 30),
    fill: Color.transparent,
    layout: new TilingLayout({
      axisAlign: 'center',
      padding: 20
    }),
    submorphs: [
      part(EnumSelector, {
        name: 'morph embedding selector',
        extent: pt(202.2, 23.3),
        tooltip: 'Choose Embedding of Contents',
        viewModel: {
          listAlign: 'selection',
          openListInWorld: true,
          listMaster: DarkThemeList,
          items: [
            {
              isListItem: true,
              label: Icon.textAttribute('ghost', { lineHeight: 1.4, paddingRight: '3px' }).concat([' Floating Above Text', null]),
              value: 'plain'
            },
            {
              isListItem: true,
              label: Icon.textAttribute('envelope', { lineHeight: 1.4 }).concat([' Treated as Character', null]),
              value: 'no-wrap'
            }
            // TODO: activate this third entry when text wrapping around morphs is properly implemented
            // {
            //   isListItem: true,
            //   label: Icon.textAttribute('compress').concat([' Wrapping Text', null]),
            //   value: 'wrap'
            // }
          ]
        },
        submorphs: [{
          name: 'label',
          fontSize: 12,
          padding: 7
        }]
      })]
  })]
});

export { EmbeddingControl };
