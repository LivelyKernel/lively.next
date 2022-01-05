import { arr, obj } from 'lively.lang';
import { pt, Color } from 'lively.graphics';
import { Morph } from 'lively.morphic';

export class VerticalResizer extends Morph {
  static get properties () {
    return {
      fill: { defaultValue: Color.gray.lighter() },
      nativeCursor: { defaultValue: 'ew-resize' },
      fixed: { defaultValue: [] },
      scalingLeft: { defaultValue: [] },
      scalingRight: { defualtValue: [] },
      minWidth: { defaultValue: 20 },
      draggable: { defaultValue: true }
    };
  }

  onDrag (evt) {
    let p1 = evt.state.lastDragPosition;
    let p2 = evt.position;
    let deltaX = p2.x - p1.x;
    this.movedHorizontallyBy(deltaX);
  }

  divideRelativeToParent (ratio) {
    // 0 <= ratio <= 1. Set divider so that it divides its owner by ration.
    // |-------|          |-------|           |<=====>|
    // |   ^   |          |       ^           ^       |
    // |   |   |          |       |           |       |
    // |   |   |  = 0.5   |       |  = 1      |       |  = 0
    // |   |   |          |       |           |       |
    // |   v   |          |       v           v       |
    // |-------|          |-------|           |-------|
    if (!this.owner || typeof ratio !== 'number' || ratio < 0 || ratio > 1) return;
    let ownerWidth = this.owner.extent.x - this.extent.x;
    if (ownerWidth < 0) return;
    let currentRatio = this.getRelativeDivide();
    let deltaRation = ratio - currentRatio;
    let deltaX = ownerWidth * deltaRation;
    this.movedHorizontallyBy(deltaX);
  }

  getRelativeDivide (ratio) {
    let bounds = this.bounds();
    let myLeft = bounds.left();
    let myWidth = bounds.width;
    let ownerWidth = this.owner.extent.x - myWidth;
    return ownerWidth < 0 ? NaN : myLeft / ownerWidth;
  }

  movedHorizontallyBy (deltaX) {
    if (!this.resizeIsSave(deltaX)) return;

    let morphsForPosChange = this.fixed.concat(this.scalingRight);
    morphsForPosChange.forEach(m => {
      let pos = m.position;
      m.position = pt(pos.x + deltaX, pos.y);
    });
    this.scalingLeft.forEach(m => {
      let ext = m.extent;
      m.extent = pt(ext.x + deltaX, ext.y);
    });
    this.scalingRight.forEach(m => {
      let ext = m.extent;
      m.extent = pt(ext.x - deltaX, ext.y);
    });
    this.position = this.position.addPt(pt(deltaX, 0));
  }

  resizeIsSave (deltaX) {
    return this.scalingLeft.every(m => (m.extent.x + deltaX) >= this.minWidth) &&
        this.scalingRight.every(m => (m.extent.x - deltaX) >= this.minWidth);
  }

  addFixed (m) { arr.pushIfNotIncluded(this.fixed, m); }

  addScalingLeft (m) { arr.pushIfNotIncluded(this.scalingLeft, m); }

  addScalingRight (m) { arr.pushIfNotIncluded(this.scalingRight, m); }
}

export class HorizontalResizer extends Morph {
  static get properties () {
    return {
      fill: { defaultValue: Color.gray.lighter() },
      nativeCursor: { defaultValue: 'ns-resize' },
      fixed: {
        defaultValue: []
      },
      scalingBelow: {
        defaultValue: []
      },
      scalingAbove: {
        defaultValue: []
      },
      minHeight: { defaultValue: 20 },
      draggable: { defaultValue: true }
    };
  }

  getRefs (refs) {
    return arr.uniq(refs.map(m => {
      return obj.isString(m) ? this.get(m) : m;
    }));
  }

  onDrag (evt) {
    let p1 = evt.state.lastDragPosition;
    let p2 = evt.position;
    let deltaY = p2.y - p1.y;
    this.movedVerticallyBy(deltaY);
  }

  divideRelativeToParent (ratio) {
    // 0 <= ratio <= 1. Set divider so that it divides its owner by ration.
    // |--------|          |--------|           |<======>|
    // |        |          |        |           |        |
    // |        |          |        |           |        |
    // |<======>|   = 0.5  |        |   = 1     |        |   = 0
    // |        |          |        |           |        |
    // |        |          |        |           |        |
    // |--------|          |<======>|           |--------|

    if (!this.owner || typeof ratio !== 'number' || ratio < 0 || ratio > 1) return;
    let ownerHeight = this.owner.extent.y - this.extent.y;
    if (ownerHeight < 0) return;
    let currentRatio = this.getRelativeDivide();
    let deltaRation = ratio - currentRatio;
    let deltaY = ownerHeight * deltaRation;
    this.movedVerticallyBy(deltaY);
  }

  getRelativeDivide (ratio) {
    let bounds = this.bounds();
    let myTop = bounds.top();
    let myHeight = bounds.height;
    let ownerHeight = this.owner.extent.y - myHeight;
    return ownerHeight < 0 ? NaN : myTop / ownerHeight;
  }

  movedVerticallyBy (deltaY) {
    if (!this.resizeIsSave(deltaY)) return;

    let morphsForPosChange = this.getRefs(this.fixed.concat(this.scalingBelow));
    morphsForPosChange.forEach(m => {
      let pos = m.position;
      m.position = pt(pos.x, pos.y + deltaY);
    });
    this.getRefs(this.scalingAbove).forEach(m => {
      let ext = m.extent;
      m.extent = pt(ext.x, ext.y + deltaY);
    });
    this.getRefs(this.scalingBelow).forEach(m => {
      let ext = m.extent;
      m.extent = pt(ext.x, ext.y - deltaY);
    });
    this.position = this.position.addPt(pt(0, deltaY));
  }

  resizeIsSave (deltaY) {
    return this.getRefs(this.scalingAbove).every(m => (m.extent.y + deltaY) >= this.minHeight) &&
        this.getRefs(this.scalingBelow).every(m => (m.extent.y - deltaY) >= this.minHeight);
  }

  addFixed (m) { arr.pushIfNotIncluded(this.fixed, m); }

  addScalingAbove (m) { arr.pushIfNotIncluded(this.scalingAbove, m); }

  addScalingBelow (m) { arr.pushIfNotIncluded(this.scalingBelow, m); }
}

