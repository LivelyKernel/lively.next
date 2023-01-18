import { component, part, Morph, Text, ViewModel, Icon, TilingLayout } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';

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

  onMouseDown (evt) {
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

    if ($world.activeSideBars.includes('properties panel')) view.position = pt($world.get('properties panel').left - 10 - view.width - miniMapOffset, $world.extent.y - 10 - view.height);
    else this.view.position = pt($world.extent.x - view.width - 10 - miniMapOffset, $world.extent.y - view.height - 10);
  }
}

export const WorldZoomIndicator = component({
  defaultViewModel: WorldZoomIndicatorModel,
  name: 'zoom indicator',
  borderColor: Color.rgb(23, 160, 251),
  borderRadius: 5,
  extent: pt(65, 27),
  fill: Color.rgba(0, 0, 0, 0.6),
  hasFixedPosition: true,
  halosEnabled: false,
  layout: new TilingLayout({
    axis: 'row',
    axisAlign: 'center',
    align: 'center',
    orderByIndex: true,
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    wrapSubmorphs: false,
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
});
