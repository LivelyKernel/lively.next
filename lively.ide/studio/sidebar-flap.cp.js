import { Color, pt } from 'lively.graphics';
import { easings, TilingLayout, component, ViewModel } from 'lively.morphic';
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

  async toggleSidebar () {
    const world = this.world();
    const sidebarIsFadingOut = world.get(this.target);
    const targetSidebar = await world.openSideBar(this.target);

    if (sidebarIsFadingOut) {
      this.view.animate({
        left: (this.target === 'scene graph') ? 0 : world.visibleBounds().width - this.view.width,
        duration: 300
      });

      if (this.target === 'scene graph') {
        disconnect(targetSidebar, 'extent', this.view, 'left');
      }
    } else {
      const sideBarWidth = targetSidebar?.width || defaultPropertiesPanelWidth;
      const dragAreaWidth = 5;
      const left = (this.target === 'scene graph')
        ? sideBarWidth - dragAreaWidth
        : world.visibleBounds().width - sideBarWidth - this.view.width;
      if (this.target === 'scene graph') {
        connect(targetSidebar, 'extent', this.view, 'left', {
          updater: ($upd, extent) => {
            $upd(extent.x - dragAreaWidth);
          },
          varMapping: { dragAreaWidth }
        });
      }
      this.view.animate({
        left,
        duration: 300,
        easing: easings.outCirc
      });
    }
  }

  onWorldResize () {
    if (this.target === 'scene graph') return;
    const propertiesPanelExists = $world.get(this.target);
    if (propertiesPanelExists) this.view.position = pt($world.visibleBounds().width - defaultPropertiesPanelWidth - this.view.extent.x, this.view.position.y);
    else this.view.position = pt($world.visibleBounds().width - this.view.width, this.view.position.y);
  }

  async openInWorld () {
    const world = this.world();
    const { view } = this;
    const flapWidth = 28;
    world.clipMode = 'hidden';
    view.opacity = 0;
    view.hasFixedPosition = false;
    view.top = 100;
    if (this.target === 'scene graph') {
      this.ui.label.textString = 'Scene Graph';
      view.borderRadius = { topLeft: 0, topRight: 5, bottomLeft: 0, bottomRight: 5 };
      await view.whenRendered();
      view.left = -flapWidth;
      await view.withAnimationDo(() => {
        view.opacity = 1;
        const scene_graph = world.get(this.target);
        if (scene_graph) view.left = scene_graph.right;
        else view.position = pt(0, view.top);
      });
      world.clipMode = 'visible';
      view.hasFixedPosition = true;
    }
    if (this.target === 'properties panel') {
      view.left = world.visibleBounds().width;
      this.ui.label.textString = 'Properties Panel';
      view.borderRadius = { topLeft: 5, topRight: 0, bottomLeft: 5, bottomRight: 0 };
      await view.whenRendered();
      await view.withAnimationDo(() => {
        view.opacity = 1;
        const properties_panel = world.get(this.target);
        if (properties_panel) view.left = world.visibleBounds().width - defaultPropertiesPanelWidth - view.width;
        else view.position = pt(world.visibleBounds().width - flapWidth, view.top);
      });
      world.clipMode = 'visible';
      view.hasFixedPosition = true;
    }
  }
}

// part(Flap, {viewModel: {target: 'properties panel'} }).openInWorld();
const Flap = component({
  name: 'flap',
  nativeCursor: 'pointer',
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
    {
      type: 'label',
      reactsToPointer: false,
      name: 'label',
      rotation: 1.5708,
      fontColor: '#B2EBF2',
      fontSize: 14,
      lineHeight: 1.4
    }
  ]
});

export { Flap };
