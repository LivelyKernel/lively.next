import { component, without, add, ensureFont, ViewModel, part } from 'lively.morphic/components/core.js';
import { Color, pt } from 'lively.graphics';
import { Label, easings, TilingLayout } from 'lively.morphic';
import { rect } from 'lively.graphics/geometry-2d.js';
import { connect, disconnect } from 'lively.bindings';
import { defaultPropertiesPanelWidth } from './properties-panel.cp.js';

export class SidebarFlap extends ViewModel {
  static get properties () {
    return {
      target: {
        type: 'String'
      },
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'toggleSidebar' },
            { signal: 'openInWorld', handler: 'openInWorld' }
          ];
        }
      },
      expose: {
        get () {
          return ['onWorldResize'];
        }
      }
    };
  }

  toggleSidebar () {
    const sidebarIsFadingOut = !!$world.get(this.target);
    $world.get('lively top bar').viewModel.openSideBar(this.target);

    const targetSidebar = $world.get(this.target);
    if (sidebarIsFadingOut) {
      this.view.animate({
        left: (this.target == 'scene graph') ? 0 : $world.visibleBounds().width - this.view.width,
        duration: 300
      });

      if (this.target == 'scene graph') {
        disconnect(targetSidebar, 'extent', this.view, 'left');
      }
    } else {
      this.view.animate({
        left: (this.target == 'scene graph') ? targetSidebar.width : $world.visibleBounds().width - targetSidebar.width - this.view.width,
        duration: 300,
        easing: easings.outCirc
      });

      if (this.target == 'scene graph') {
        connect(targetSidebar, 'extent', this.view, 'left', { converter: (extent) => extent.x });
      }
    }
  }

  onWorldResize () {
    if (this.target == 'scene graph') return;
    const propertiesPanelExists = $world.get(this.target);
    if (propertiesPanelExists) this.view.position = pt($world.visibleBounds().width - defaultPropertiesPanelWidth - this.view.extent.x, this.view.position.y);
    else this.view.position = pt($world.visibleBounds().width - this.view.width, this.view.position.y);
  }

  openInWorld () {
    if (this.target == 'scene graph') {
      this.ui.label.textString = 'Scene Graph';
      const scene_graph = $world.get(this.target);
      if (scene_graph) this.view.position.x = scene_graph.right;
      else this.view.position.x = 0;
    }
    if (this.target == 'properties panel') {
      this.ui.label.textString = 'Properties Panel';
      const properties_panel = $world.get(this.target);
      if (properties_panel) this.view.position.x = $world.visibleBounds().width - defaultPropertiesPanelWidth - this.view.extent.x;
      else this.view.position.x = $world.visibleBounds().width - this.view.width;
    }
    this.view.top = 100;
  }
}

// part(Flap, {viewModel: {target: 'properties panel'} }).openInWorld();
// Flap.openInWorld()
const Flap = component({
  name: 'flap',
  defaultViewModel: SidebarFlap,
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    orderByIndex: true,
    wrapSubmorphs: false,
    padding: rect(5, 5, 0, 0)
  }),
  extent: pt(30, 120),
  fill: Color.rgb(30, 30, 30).withA(0.95),
  halosEnabled: true,
  epiMorph: true,
  submorphs: [
    new Label({
      name: 'label',
      rotation: 1.5708,
      fontColor: '#B2EBF2',
      fontSize: 14
    })
  ]
});

export { Flap };
