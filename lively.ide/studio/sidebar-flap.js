import { disconnect, connect } from 'lively.bindings';
import { defaultPropertiesPanelWidth } from './properties-panel.cp.js';
import { easings } from 'lively.morphic';
import { pt } from 'lively.graphics';
export async function toggleSidebar () {
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

export function relayoutSidebarFlapInWorld () {
  if (this.target === 'scene graph') return;
  const propertiesPanelExists = $world.get(this.target);
  if (propertiesPanelExists) this.view.position = this.view.position.withX($world.visibleBounds().width - defaultPropertiesPanelWidth - this.view.width);
  else this.view.position = this.view.position.withX($world.visibleBounds().width - this.view.width);
}

export async function openSidebarFlapInWorld () {
  const world = this.world();
  const { view } = this;
  world.clipMode = 'hidden';
  view.opacity = 0;
  view.hasFixedPosition = false;
  view.top = 100;
  if (this.target === 'scene graph') {
    this.ui.label.textString = 'Scene Graph';
    view.borderRadius = { topLeft: 0, topRight: 5, bottomLeft: 0, bottomRight: 5 };
    view.left = -view.width;
    await view.withAnimationDo(() => {
      view.opacity = 1;
      const scene_graph = world.get(this.target);
      if (scene_graph) view.left = scene_graph.right;
      else view.position = pt(0, view.top);
    });
    view.hasFixedPosition = true;
  }
  if (this.target === 'properties panel') {
    view.left = world.visibleBounds().width;
    this.ui.label.textString = 'Properties Panel';
    view.borderRadius = { topLeft: 5, topRight: 0, bottomLeft: 5, bottomRight: 0 };
    await view.withAnimationDo(() => {
      view.opacity = 1;
      const properties_panel = world.get(this.target);
      if (properties_panel) view.left = world.visibleBounds().width - defaultPropertiesPanelWidth - view.width;
      else view.position = pt(world.visibleBounds().width - view.width, view.top);
    });
    view.hasFixedPosition = true;
  }
}
