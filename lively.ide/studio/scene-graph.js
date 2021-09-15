import { Morph, touchInputDevice, easings } from 'lively.morphic';
import { fun } from 'lively.lang/index.js';
import { connect } from 'lively.bindings/index.js';

export class MorphicSideBar extends Morph {
  static get properties () {
    return {
      isHaloItem: {
        get () {
          return false;
        }
      }
    };
  }

  relayout () {
    this.onWorldResize();
  }

  onWorldResize (align = true) {
    if (!this.respondsToVisibleWindow) return;
    const bounds = $world.visibleBounds();
    const offsetTop = navigator.standalone && touchInputDevice ? 25 : 0;
    this.height = bounds.height - offsetTop;
    this.top = offsetTop + bounds.top();
    const hr = this.get('horizontal resizer');
    hr.height = this.height;
    hr.top = 0;
    if (!align) return;
    if (this.visible) {
      this.topLeft = bounds.topLeft();
    } else this.topRight = bounds.topLeft();
  }

  switchMode (mode) {
    if (mode == 'inspector') this.showInspector();
    if (mode == 'connections') this.showConnections();
  }

  showInspector () {
    this.get('inspector').visible = true;
    this.get('connections tree').visible = false;
  }

  showConnections () {
    this.get('inspector').visible = false;
    this.get('connections tree').visible = true;
  }

  async toggle (active) {
    const bounds = $world.visibleBounds();
    const offsetTop = navigator.standalone && touchInputDevice ? 25 : 0;
    this.height = bounds.height - offsetTop;
    this.top = offsetTop + bounds.top();
    if (active) {
      $world.addMorph(this, $world.get('lively top bar'));
      this.topRight = bounds.topLeft();
      this.attachToWorld($world);
      this.visible = true;
      await this.whenRendered();
      this.onWorldResize(false);
      this.get('scene graph').adjustProportions();
      await this.animate({
        opacity: 1,
        easing: easings.outCirc,
        topLeft: bounds.topLeft(),
        duration: 300
      });
      this.get('scene graph').refresh();
    } else {
      this.detachFromWorld($world);
      await this.animate({
        opacity: 0,
        topRight: bounds.topLeft(),
        duration: 300
      });
      this.visible = false;
      this.remove();
    }
  }

  attachToWorld (world) {
    connect(world, 'onChange', this, 'onHierarchyChange', {
      garbageCollect: true
    });
    connect(world, 'onSubmorphChange', this, 'onHierarchyChange', {
      garbageCollect: true
    });
    connect(world, 'showHaloFor', this, 'selectNode', {
      garbageCollect: true
    });
  }

  detachFromWorld (world) {
    world.attributeConnections.forEach(conn => {
      if (conn.targetObj === this) conn.disconnect();
    });
  }

  selectNode (target) {
    this.getSubmorphNamed('scene graph').selectMorphInTarget(target);
    this.getSubmorphNamed('connections tree').inspectConnectionsOf(target);
  }

  async onHierarchyChange (change) {
    if (change.selector === 'addMorphAt' ||
        change.selector === 'removeMorph' ||
        change.prop === 'name') {
      const sceneGraph = this._sceneGraph || (this._sceneGraph = this.getSubmorphNamed('scene graph'));
      if (!sceneGraph) return;
      if (!sceneGraph.owner.visible) return;
      if (change.target && change.target.isHand) return;
      if (change.target && sceneGraph.ignoreMorph(change.target)) return;
      if (change.args && !change.args[0].isHalo && sceneGraph.ignoreMorph(change.args[0])) return;
      if (change.target.ownerChain().find(m => sceneGraph.ignoreMorph(m))) return;
      fun.debounceNamed('scene-graph-update', 50, () => sceneGraph.refresh())();
    }
  }

  // this.toggle(true)
}

export class FrameResizer extends Morph {
  static get properties () {
    return {
      direction: {
        type: 'Enum',
        values: ['left', 'right']
      }
    };
  }

  onDrag (evt) {
    const prevLeft = this.owner.left;
    const minWidth = 350;
    // compute the delta relative to own position
    const dragOffset = evt.positionIn(this).x;
    let delta = (this.direction == 'left' ? -1 : 1) * dragOffset;
    this.owner.width += delta;
    if (this.owner.width < minWidth) {
      // get the distance that needs to be corrected
      let overflow = minWidth - this.owner.width;
      delta = delta + overflow; // remove the overflow from the delta;
      this.owner.width = minWidth;
    }
    this.owner.left = this.direction == 'left' ? prevLeft - delta : prevLeft;
  }
}
