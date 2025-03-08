import { component, Text, ViewModel, Icon, TilingLayout } from 'lively.morphic';
import { Color, rect, pt } from 'lively.graphics';

class WorldZoomIndicatorModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['isZoomIndicator', 'onMouseDown', 'relayout', 'updateZoomLevel', 'isEpiMorph'];
        }
      },
      isEpiMorph: {
        get () { return true; }
      },
      bindings: {
        get () {
          return [
            {
              signal: 'onMouseDown', handler: 'onMouseDown', override: true
            }];
        }
      }
    };
  }

  get isZoomIndicator () {
    return true;
  }

  onMouseDown () {
    $world.resetScaleFactor();
  }

  updateZoomLevel (newPercentage) {
    this.ui.zoomFactorLabel.textString = newPercentage + ' %';
    this.relayout();
  }

  relayout () {
    const { view } = this;
    const miniMap = $world.getSubmorphNamed('world mini map');
    let miniMapOffset = 0;
    if (miniMap) miniMapOffset = miniMap.width + 10;

    if ($world.activeSideBars.includes('properties panel')) view.position = pt($world.get('properties panel').left - view.width - miniMapOffset, $world.extent.y - view.height);
    else this.view.position = pt($world.extent.x - view.width - miniMapOffset, $world.extent.y - view.height);
  }
}

export const WorldZoomIndicator = component({
  name: 'zoom indicator wrapper',
  defaultViewModel: WorldZoomIndicatorModel,
  fill: Color.transparent,
  extent: pt(100, 100),
  layout: new TilingLayout({
    align: 'right',
    axisAlign: 'right',
    padding: rect(0, 0, 10, 10)
  }),
  reactsToPointer: false,
  submorphs: [{
    name: 'zoom indicator',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 5,
    extent: pt(65, 27),
    fill: Color.rgba(0, 0, 0, 0.6),
    hasFixedPosition: true,
    halosEnabled: false,
    layout: new TilingLayout({
      axisAlign: 'center',
      align: 'center',
      orderByIndex: true,
      hugContentsHorizontally: true,
      hugContentsVertically: true,
      padding: {
        height: 0,
        width: 0,
        x: 5,
        y: 5
      },
      reactToSubmorphAnimations: false,
      resizeSubmorphs: false,
      spacing: 5
    }),
    nativeCursor: 'pointer',
    position: pt(535, 438.4),
    submorphs: [
      {
        type: Text,
        name: 'zoom icon label',
        fontSize: 14,
        fontColor: Color.white,
        nativeCursor: 'pointer',
        halosEnabled: false,
        textAndAttributes: Icon.textAttribute('magnifying-glass')

      }, {
        type: Text,
        name: 'zoom factor label',
        fontColor: Color.rgb(253, 254, 254),
        nativeCursor: 'pointer',
        halosEnabled: false,
        textAndAttributes: ['100 %', null]
      }]
  }
  ]
}
);
