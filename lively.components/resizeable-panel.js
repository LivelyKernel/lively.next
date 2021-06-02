import { Morph } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import { connect, disconnectAll } from 'lively.bindings';

const CONSTANTS = {
  DEFAULT_RESIZER_WIDTH: 6
};

export class ResizeablePanel extends Morph {
  static get properties () {
    return {
      ui: {
        after: ['submorphs', 'extent'],
        initialize () {
          this.build();
        }
      },
      resizers: {
        after: ['ui'],
        initialize () {
          this.resizers = {
            north: false,
            south: false,
            east: false,
            west: false
          };
        },
        set (resizersOrBoolean) {
          const resizers = typeof resizersOrBoolean === 'boolean'
            ? {
                north: resizersOrBoolean,
                south: resizersOrBoolean,
                east: resizersOrBoolean,
                west: resizersOrBoolean
              }
            : resizersOrBoolean;
          this.setProperty('resizers', resizers);
          this.updateResizers();
        }
      },
      extent: {
        defaultValue: pt(50, 50)
      }
    };
  }

  build () {
    this._building = true;

    this.ui = {};

    this.ui.resizers = {
      north: this.buildResizer({
        extent: pt(0, CONSTANTS.DEFAULT_RESIZER_WIDTH),
        nativeCursor: 'n-resize'
      }),
      south: this.buildResizer({
        extent: pt(0, CONSTANTS.DEFAULT_RESIZER_WIDTH),
        nativeCursor: 's-resize'
      }),
      east: this.buildResizer({
        extent: pt(CONSTANTS.DEFAULT_RESIZER_WIDTH, 0),
        nativeCursor: 'e-resize'
      }),
      west: this.buildResizer({
        extent: pt(CONSTANTS.DEFAULT_RESIZER_WIDTH, 0),
        nativeCursor: 'w-resize'
      })
    };

    connect(this.ui.resizers.north, 'onDragStart', this, 'onResizeStart');
    connect(this.ui.resizers.south, 'onDragStart', this, 'onResizeStart');
    connect(this.ui.resizers.east, 'onDragStart', this, 'onResizeStart');
    connect(this.ui.resizers.west, 'onDragStart', this, 'onResizeStart');
    connect(this.ui.resizers.north, 'onDrag', this, 'onResizeNorth');
    connect(this.ui.resizers.south, 'onDrag', this, 'onResizeSouth');
    connect(this.ui.resizers.east, 'onDrag', this, 'onResizeEast');
    connect(this.ui.resizers.west, 'onDrag', this, 'onResizeWest');
    connect(this.ui.resizers.north, 'onDragEnd', this, 'onResizeEnd');
    connect(this.ui.resizers.south, 'onDragEnd', this, 'onResizeEnd');
    connect(this.ui.resizers.east, 'onDragEnd', this, 'onResizeEnd');
    connect(this.ui.resizers.west, 'onDragEnd', this, 'onResizeEnd');

    delete this._building;

    connect(this, 'extent', this, 'relayout').update(this.extent);
  }

  buildResizer (props) {
    return this.addMorph(new Morph({
      ...props,
      draggable: true,
      fill: Color.transparent
    }));
  }

  updateResizers () {
    Object.keys(this.resizers).forEach(side => this.enableResizer(side, this.resizers[side]));
  }

  enableResizer (side, enable) {
    this.ui.resizers[side].reactsToPointer = enable;
    this.ui.resizers[side].visible = enable;
  }

  onResizeStart (evt) {
    evt.state.dragStartPanelExtent = this.extent;
    evt.state.dragStartPanelPosition = this.position;
  }

  get isResizing () {
    return !!this._resizeInProgress;
  }

  onResize () {
    this._resizeInProgress = true;
  }

  onResizeNorth (evt) {
    this.onResize();
    const { dragStartPanelPosition, dragStartPanelExtent, absDragDelta } = evt.state;

    const newHeight = dragStartPanelExtent.subPt(absDragDelta).y;
    this.extent = pt(this.width, newHeight);
    this.position = pt(this.position.x,
      this.ui.resizers.north.globalPosition.y + this.ui.resizers.north.height / 2);

    const newPanelPosition = pt(
      this.position.x, dragStartPanelPosition.addPt(absDragDelta).y);
    this.ui.resizers.north.position =
      this.defaultResizerPosition(this.ui.resizers.north, 'north');
    this.position = newPanelPosition;
  }

  onResizeSouth () {
    this.onResize();
    this.extent = pt(this.width, this.ui.resizers.south.center.y);
  }

  onResizeEast () {
    this.onResize();
    this.extent = pt(this.ui.resizers.east.center.x, this.height);
  }

  onResizeWest (evt) {
    this.onResize();
    const { dragStartPanelPosition, dragStartPanelExtent, absDragDelta } = evt.state;

    const newWidth = dragStartPanelExtent.subPt(absDragDelta).x;
    this.extent = pt(newWidth, this.height);

    const newPanelPosition = pt(
      dragStartPanelPosition.addPt(absDragDelta).x, this.position.y);
    this.ui.resizers.west.position =
      this.defaultResizerPosition(this.ui.resizers.west, 'west');
    this.position = newPanelPosition;
  }

  onResizeEnd () {
    delete this._resizeInProgress;
    this.relayout();
  }

  addMorphAt (submorph, index) {
    debugger;
    const morph = super.addMorphAt(submorph, index);
    const resizers = Object.values(this.ui.resizers || {});
    if (this._building || resizers.includes(morph)) return morph;
    resizers.forEach(resizer => resizer.bringToFront());
    return morph;
  }

  defaultResizerPosition (resizer, side) {
    switch (side) {
      case 'north':
        return pt(0, -resizer.height / 2);
      case 'south':
        return pt(0, this.height - resizer.height / 2);
      case 'east':
        return pt(this.width - resizer.width / 2, 0);
      case 'west':
        return pt(-resizer.width / 2, 0);
    }
  }

  relayout () {
    if (this.isResizing) return;
    Object.keys(this.ui.resizers).forEach(side => {
      const resizer = this.ui.resizers[side];
      switch (side) {
        case 'north':
          resizer.extent = pt(this.width, resizer.height);
          break;
        case 'south':
          resizer.extent = pt(this.width, resizer.height);
          break;
        case 'east':
          resizer.extent = pt(resizer.width, this.height);
          break;
        case 'west':
          resizer.extent = pt(resizer.width, this.height);
          break;
      }
      resizer.position = this.defaultResizerPosition(resizer, side);
    });
  }

  abandon () {
    Object.values(this.ui.resizers).forEach(resizer => disconnectAll(resizer));
    super.abandon();
  }
}
