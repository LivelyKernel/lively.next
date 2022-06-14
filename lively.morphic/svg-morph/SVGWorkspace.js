import Window from 'lively.components/window.js';
import { pt } from 'lively.graphics';

export default class SVGWorkspace extends Window {
  static get properties () {
    return {

      title: { defaultValue: 'SVG Workspace' },
      name: { defaultValue: 'svg-workspace' },

      targetMorph: {},

      content: {
        derived: true,
        after: ['targetMorph'],
        set (content) {
          this.setProperty('content', content);
          const span = this.env.domEnv.document.createElement('span');
          span.innerHTML = content;
          this.targetMorph.svgPath = span.getElementsByTagName('svg')[0];
        }
      },

      extent: { defaultValue: pt(400, 300) }
    };
  }
}
