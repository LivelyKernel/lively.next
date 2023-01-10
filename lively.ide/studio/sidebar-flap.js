import { disconnect, connect } from 'lively.bindings';
import { defaultPropertiesPanelWidth } from './properties-panel.cp.js';
import { easings } from 'lively.morphic';
import { pt } from 'lively.graphics';

export async function toggleSidebar (flapModel) {
  const world = flapModel.world();
  const sidebarIsFadingOut = world.get(flapModel.target);
  const targetSidebar = await world.openSideBar(flapModel.target);
  if (sidebarIsFadingOut) {
    flapModel.view.animate({
      left: (flapModel.target === 'scene graph') ? 0 : world.visibleBounds().width - flapModel.view.width,
      duration: 300
    });

    if (flapModel.target === 'scene graph') {
      disconnect(targetSidebar, 'extent', flapModel.view, 'left');
    }
  } else {
    const sideBarWidth = targetSidebar?.width || defaultPropertiesPanelWidth;
    const dragAreaWidth = 5;
    const left = (flapModel.target === 'scene graph')
      ? sideBarWidth - dragAreaWidth
      : world.visibleBounds().width - sideBarWidth - flapModel.view.width;
    if (flapModel.target === 'scene graph') {
      connect(targetSidebar, 'extent', flapModel.view, 'left', {
        updater: ($upd, extent) => {
          $upd(extent.x - dragAreaWidth);
        },
        varMapping: { dragAreaWidth }
      });
    }
    flapModel.view.animate({
      left,
      duration: 300,
      easing: easings.outCirc
    });
  }
}

export function relayoutSidebarFlapInWorld (flapModel) {
  if (flapModel.target === 'scene graph') return;
  const propertiesPanelExists = $world.get(flapModel.target);
  if (propertiesPanelExists) flapModel.view.position = flapModel.view.position.withX($world.visibleBounds().width - defaultPropertiesPanelWidth - flapModel.view.width);
  else flapModel.view.position = flapModel.view.position.withX($world.visibleBounds.width - flapModel.view.width);
}

export async function openSidebarFlapInWorld (flapModel) {
  const world = flapModel.world();
  const { view } = flapModel;
  world.clipMode = 'hidden';
  view.opacity = 0;
  view.hasFixedPosition = false;
  view.top = 100;
  if (flapModel.target === 'scene graph') {
    flapModel.ui.label.textString = 'Scene Graph';
    view.borderRadius = { topLeft: 0, topRight: 5, bottomLeft: 0, bottomRight: 5 };
    view.left = -view.width;
    await view.withAnimationDo(() => {
      view.opacity = 1;
      const scene_graph = world.get(flapModel.target);
      if (scene_graph) view.left = scene_graph.right;
      else view.position = pt(0, view.top);
    });
    view.hasFixedPosition = true;
  }
  if (flapModel.target === 'properties panel') {
    view.left = world.visibleBounds().width;
    flapModel.ui.label.textString = 'Properties Panel';
    view.borderRadius = { topLeft: 5, topRight: 0, bottomLeft: 5, bottomRight: 0 };
    await view.withAnimationDo(() => {
      view.opacity = 1;
      const properties_panel = world.get(flapModel.target);
      if (properties_panel) view.left = world.visibleBounds().width - defaultPropertiesPanelWidth - view.width;
      else view.position = pt(world.visibleBounds().width - view.width, view.top);
    });
    view.hasFixedPosition = true;
  }
}
