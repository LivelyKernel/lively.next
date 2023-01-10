import { Color, pt } from 'lively.graphics';
import { TilingLayout, component, ViewModel } from 'lively.morphic';
import { rect } from 'lively.graphics/geometry-2d.js';

export class FlapModel extends ViewModel {
  static get properties () {
    return {
      target: {
        type: 'String'
      },
      action: { },
      relayoutRoutine: {},
      openingRoutine: {},
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'executeAction' },
            { signal: 'openInWorld', handler: 'openInWorld' }
          ];
        }
      },
      expose: {
        get () {
          return ['onWorldResize', 'isFlap'];
        }
      }
    };
  }

  get isFlap () {
    return true;
  }

  async executeAction () {
    this.action(this);
  }

  onWorldResize () {
    this.relayoutRoutine(this);
  }

  openInWorld () {
    this.openingRoutine(this);
  }
}

// part(Flap, {viewModel: {target: 'properties panel'} }).openInWorld();
const Flap = component({
  name: 'flap',
  nativeCursor: 'pointer',
  defaultViewModel: FlapModel,
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: false,
    orderByIndex: true,
    wrapSubmorphs: false,
    padding: rect(5, 5, 0, 0)
  }),
  extent: pt(30, 120),
  fill: Color.rgb(30, 30, 30).withA(0.95),
  halosEnabled: true,
  epiMorph: true,
  submorphs: [
    {
      type: 'label',
      reactsToPointer: false,
      name: 'label',
      rotation: 1.5708,
      fontColor: '#B2EBF2',
      fontSize: 14
    }
  ]
});

export { Flap };
