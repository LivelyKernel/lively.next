import { arr } from "lively.lang";
import { pt, Color } from "lively.graphics";
import { Morph } from "lively.morphic";

export class VerticalResizer extends Morph {

  static get properties() {
    return {fill: Color.gray.lighter(), nativeCursor: "ew-resize",
      fixed: {defaultValue: []},
      scalingLeft: {defaultValue: []},
      scalingRight: {defualtValue: []},
      minWidth: {defaultValue: 20}
    }
  }

  onDrag(evt) {
    var p1 = evt.state.lastDragPosition,
        p2 = evt.position,
        deltaX = p2.x - p1.x;
    this.movedHorizontallyBy(deltaX);
  }

  divideRelativeToParent(ratio) {
    // 0 <= ratio <= 1. Set divider so that it divides its owner by ration.
    // |-------|          |-------|           |<=====>|
    // |   ^   |          |       ^           ^       |
    // |   |   |          |       |           |       |
    // |   |   |  = 0.5   |       |  = 1      |       |  = 0
    // |   |   |          |       |           |       |
    // |   v   |          |       v           v       |
    // |-------|          |-------|           |-------|
    if (!this.owner || typeof ratio !== "number" || ratio < 0 || ratio > 1) return;
    var ownerWidth = this.owner.extent.x - this.extent.x;
    if (ownerWidth < 0) return;
    var currentRatio = this.getRelativeDivide(),
        deltaRation = ratio - currentRatio,
        deltaX = ownerWidth * deltaRation;
    this.movedHorizontallyBy(deltaX);
  }

  getRelativeDivide(ratio) {
    var bounds = this.bounds(),
        myLeft = bounds.left(),
        myWidth = bounds.width,
        ownerWidth = this.owner.extent.x - myWidth;
    return ownerWidth < 0 ? NaN : myLeft / ownerWidth;
  }

  movedHorizontallyBy(deltaX) {
    if (!this.resizeIsSave(deltaX)) return;

    var morphsForPosChange = this.fixed.concat(this.scalingRight);
    morphsForPosChange.forEach(m => {
        var pos = m.position;
        m.position = pt(pos.x + deltaX, pos.y);
    });
    this.scalingLeft.forEach(m => {
        var ext = m.extent;
        m.extent = pt(ext.x + deltaX, ext.y);
    });
    this.scalingRight.forEach(m => {
        var ext = m.extent;
        m.extent = pt(ext.x - deltaX, ext.y);
    });
    this.position = this.position.addPt(pt(deltaX, 0));
  }

  resizeIsSave(deltaX) {
    return this.scalingLeft.every(m => (m.extent.x + deltaX) >= this.minWidth)
        && this.scalingRight.every(m => (m.extent.x - deltaX) >= this.minWidth);
  }

  addFixed(m) { arr.pushIfNotIncluded(this.fixed, m); }

  addScalingLeft(m) { arr.pushIfNotIncluded(this.scalingLeft, m); }

  addScalingRight(m) { arr.pushIfNotIncluded(this.scalingRight, m); }
}


export class HorizontalResizer extends Morph {

  static get properties() {
    return {
      fill: {defaultValue: Color.gray.lighter()},
      nativeCursor: {defaultValue: 'ns-resize'},
      fixed: {defaultValue: []},
      scalingBelow: {defaultValue: []},
      scalingAbove: {defaultValue: []},
      minHeight: {defaultValue: 20}
    }
  }

  onDrag(evt) {
    var p1 = evt.state.lastDragPosition,
        p2 = evt.position,
        deltaY = p2.y - p1.y;
    this.movedVerticallyBy(deltaY);
  }

  divideRelativeToParent(ratio) {
    // 0 <= ratio <= 1. Set divider so that it divides its owner by ration.
    // |--------|          |--------|           |<======>|
    // |        |          |        |           |        |
    // |        |          |        |           |        |
    // |<======>|   = 0.5  |        |   = 1     |        |   = 0
    // |        |          |        |           |        |
    // |        |          |        |           |        |
    // |--------|          |<======>|           |--------|

    if (!this.owner || typeof ratio !== "number" || ratio < 0 || ratio > 1) return;
    var ownerHeight = this.owner.extent.y - this.extent.y;
    if (ownerHeight < 0) return;
    var currentRatio = this.getRelativeDivide(),
        deltaRation = ratio - currentRatio,
        deltaY = ownerHeight * deltaRation;
    this.movedVerticallyBy(deltaY);
  }

  getRelativeDivide(ratio) {
    var bounds = this.bounds(),
        myTop = bounds.top(),
        myHeight = bounds.height,
        ownerHeight = this.owner.extent.y - myHeight;
    return ownerHeight < 0 ? NaN : myTop / ownerHeight;
  }

  movedVerticallyBy(deltaY) {
    if (!this.resizeIsSave(deltaY)) return;

    var morphsForPosChange = this.fixed.concat(this.scalingBelow);
    morphsForPosChange.forEach(m => {
      var pos = m.position;
      m.position = pt(pos.x, pos.y + deltaY);
    });
    this.scalingAbove.forEach(m => {
      var ext = m.extent;
      m.extent = pt(ext.x, ext.y + deltaY);
    });
    this.scalingBelow.forEach(m => {
      var ext = m.extent;
      m.extent = pt(ext.x, ext.y - deltaY);
    });
    this.position = this.position.addPt(pt(0, deltaY));
  }

  resizeIsSave(deltaY) {
    return this.scalingAbove.every(m => (m.extent.y + deltaY) >= this.minHeight)
        && this.scalingBelow.every(m => (m.extent.y - deltaY) >= this.minHeight);
  }

  addFixed(m) { arr.pushIfNotIncluded(this.fixed, m); }

  addScalingAbove(m) { arr.pushIfNotIncluded(this.scalingAbove, m); }

  addScalingBelow(m) { arr.pushIfNotIncluded(this.scalingBelow, m); }
}
