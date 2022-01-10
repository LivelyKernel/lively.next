import { component, without, add, ensureFont, ViewModel, part } from 'lively.morphic/components/core.js';
import { Color, pt } from 'lively.graphics';
import { Label, easings, TilingLayout } from 'lively.morphic';
import { rect } from 'lively.graphics/geometry-2d.js';
import { connect, disconnect } from 'lively.bindings';
import { defaultPropertiesPanelWidth } from './properties-panel.cp.js';
import { promise } from 'lively.lang';

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
    const sidebarIsFadingOut = !!this.world().get(this.target);
    // rms 10.2.22: If we open the scene graph for the first time
    // there is an initial lag which obstructs the animation.
    let sceneGraphPresent = false;
    this.world().withTopBarDo(topBar => {
      sceneGraphPresent = !!topBar.sideBar;
      topBar.openSideBar(this.target);
    });
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
      // rms 10.2.22 we have to wait for the property panel to be mounted
      // because it will kill our animation du to the expensive VDOM update in progress.
      if (this.target != 'scene graph' || !sceneGraphPresent) await targetSidebar.whenRendered();
      const left = (this.target == 'scene graph') ? targetSidebar.width : $world.visibleBounds().width - targetSidebar.width - this.view.width;
      this.view.animate({
        left,
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

  async openInWorld () {
    const world = this.world();
    const { view } = this;
    const flapWidth = 28;
    view.opacity = 0;
    view.hasFixedPosition = true;
    view.top = 100;
    if (this.target == 'scene graph') {
      this.ui.label.textString = 'Scene Graph';
      view.borderRadius = { top: 5, right: 5, bottom: 5, left: 0 };
      await view.whenRendered();
      view.left = -flapWidth;
      view.withAnimationDo(() => {
        view.opacity = 1;
        const scene_graph = world.get(this.target);
        if (scene_graph) view.left = scene_graph.right;
        else view.position = pt(0, view.top);
      });
    }
    if (this.target == 'properties panel') {
      view.left = world.visibleBounds().width;
      this.ui.label.textString = 'Properties Panel';
      view.borderRadius = { top: 5, right: 0, bottom: 5, left: 5 };
      await view.whenRendered();
      view.withAnimationDo(() => {
        view.opacity = 1;
        const properties_panel = world.get(this.target);
        if (properties_panel) view.left = world.visibleBounds().width - defaultPropertiesPanelWidth - view.width;
        else view.position = pt(world.visibleBounds().width - flapWidth, view.top);
      });
    }
  }
}

// part(Flap, {viewModel: {target: 'properties panel'} }).openInWorld();
// Flap.openInWorld()
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
    new Label({
      reactsToPointer: false,
      name: 'label',
      rotation: 1.5708,
      fontColor: '#B2EBF2',
      fontSize: 14
    })
  ]
});

export { Flap };
