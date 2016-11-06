import { pt, Color, rect } from "lively.graphics";
import { arr, grid, properties, num, obj } from "lively.lang";
import { GridLayoutHalo, FlexLayoutHalo } from "./halo/layout.js";
import { Morph } from "./index.js";

class Layout {
  
  constructor({spacing, border, container, autoResize} = {}) {
    this.border = {top: 0, left: 0, right: 0, bottom: 0, ...border};
    this.spacing = spacing || 0;
    this.active = false;
    this.container = container;
    this.autoResize = autoResize != undefined ? autoResize : true;
  }

  description() { return "Describe the layout behavior here." }
  name() { return "Name presented to the user." }

  onSubmorphResized(submorph) { this.apply() }
  onSubmorphAdded(submorph) { this.apply() }
  onSubmorphRemoved(submorph) { this.apply() }
  
  onChange({selector, args, prop, value, prevValue}) {
    switch (selector) {
      case "removeMorph":
        this.onSubmorphRemoved(args[0]);
        break;
      case "addMorphAt":
        this.onSubmorphAdded(args[0]);
        break;
    }
    if (prop == "extent" && !(value && value.equals(prevValue))) this.apply();
  }
  
  affectsLayout(submorph, {prop, value, prevValue}) {
    return ["position", "scale", "rotation"].includes(prop) 
           && !obj.equals(value, prevValue) 
           && this.container.submorphs.includes(submorph);
  }

  onSubmorphChange(submorph, change) {
    if ("extent" == change.prop && !change.value.equals(change.prevValue)) this.onSubmorphResized(submorph);
    if (this.affectsLayout(submorph, change)) this.apply();
  }
  
  inspect(pointerId) {}

  
  attachAnimated(duration = 0, container, easing) {
     this.container = container;
     this.apply({duration, easing});
     this.active = true;
     container.layout = this;
     this.active = false;
  }
}

/* TODO: This is just a very simple constraint layout, that should
   eventually be replaced by just dynamically appying constraints
   to morph properties that relate to other morph's properties */

export class FillLayout extends Layout {
  
  constructor(config = {}) {
    super(config);
    this.morphs = config.morphs || [];
    this.fixedHeight = config.fixedHeight;
    this.fixedWidth = config.fixedWidth;
  }

  name() { return "Fill" }
  description() { return "Forces all submorphs to match the extent of their owner."} 

  set spacing(spacing=0) {
     if (obj.isNumber(spacing)) {
        var top = left = right = bottom = spacing;
     } else {
        var {top, left, right, bottom} = spacing;
        top = top || 0;
        left = left || 0;
        right = right || 0;
        bottom = bottom || 0;
     }
     this._spacing = {top, left, right, bottom}
  }

  get spacing() { return this._spacing }
  
  apply(animate = false) {
    /* FIXME: Add support for destructuring default values */
    if (this.active) return;
    const {fixedWidth, fixedHeight} = this,
          {top, bottom, left, right} = this.spacing,
          height = !fixedHeight  && this.container.height - top - bottom,
          width = !fixedWidth && this.container.width - left - right;
    this.active = true;
    this.morphs.forEach(m => {
      var m = this.container.getSubmorphNamed(m),
          newBounds = pt(left,top).extent(pt(width || m.width, height || m.height));
      if (animate) {
         const {duration, easing} = animate;
         m.animate({bounds: newBounds, duration, easing});
      } else {
         m.setBounds(newBounds);
      }
    });
    this.active = false;
  }
  
}

export class VerticalLayout extends Layout {

  name() { return "Vertical" }
  description() { return "Assemble the submorphs in a vertically growing list." }

  apply(animate = false) {
    if (this.active) return;
    var pos = pt(this.spacing, this.spacing),
        submorphs = this.container.submorphs,
        maxWidth = 0;

    this.active = true;
    submorphs.forEach(m => {
      if (animate) {
        const {duration, easing} = animate;
        m.animate({position: pos, duration, easing})
      } else {
        m.position = pos;
      }
      pos = m.bottomLeft.addPt(pt(0, this.spacing));
      maxWidth = Math.max(m.width, maxWidth);
    });
    if (this.autoResize) this.container.extent = pt(maxWidth, pos.y)
    this.active = false;
  }

}

export class HorizontalLayout extends Layout {

  name() { return "Horizontal" }
  description() { return "Assemble the submorphs in a horizontally growing list." }

  apply(animate = false) {
    if (this.active) return;
    var pos = pt(this.spacing, this.spacing),
        submorphs = this.container.submorphs,
        maxHeight = 0;

    this.maxHeight = 0;
    this.active = true;
    submorphs.forEach(m => {
      if (animate) {
        const {duration, easing} = animate;
        m.animate({position: pos, duration, easing})
      } else {
        m.position = pos;
      }
      pos = m.topRight.addPt(pt(this.spacing, 0));
      maxHeight = Math.max(m.height, maxHeight);
    });
    if (this.autoResize) this.container.extent = pt(pos.x + this.spacing, maxHeight + 2 * this.spacing);
    this.active = false;
 }

}

export class TilingLayout extends Layout {

  name() { return "Tiling" }
  description() { return "Make the submorphs fill their owner, inserting breaks to defer intersecting the bounds as much as possible." }

  apply(animate = false) {
    var width = this.getOptimalWidth(),
        currentRowHeight = 0,
        currentRowWidth = 0,
        spacing = this.spacing,
        previousRowHeight = spacing,
        i = 0, rowSwitch = true;

    if (this.active) return;
    this.active = true;

    while (i < this.container.submorphs.length) {
        var submorphExtent = this.container.submorphs[i].extent, newPos;
        if (rowSwitch || currentRowWidth + submorphExtent.x + 2*spacing <= width) {
            newPos = pt(currentRowWidth + spacing, previousRowHeight);
            rowSwitch = false;
            if (animate) {
               const {duration, easing} = animate;
               this.container.submorphs[i].animate({position: newPos, duration, easing}); 
            } else {
               this.container.submorphs[i].position = newPos;
            }
            currentRowHeight = Math.max(currentRowHeight, submorphExtent.y);
            currentRowWidth += spacing + submorphExtent.x;
            i++;
        } else {
            previousRowHeight += spacing + currentRowHeight;
            currentRowWidth = currentRowHeight = 0;
            rowSwitch = true;
        }
    }

    this.active = false;
  }

  getMinWidth() {
      return this.container.submorphs.reduce((s, e) => (e.extent.x > s) ? e.extent.x : s, 0) +
          this.border.left + this.border.right;
  }

  getMinHeight() {
      return this.container.submorphs.reduce((s, e) => (e.extent.y > s) ? e.extent.y : s, 0) +
          this.border.top + this.border.bottom;
  }

  getOptimalWidth() {
      var width = this.container.width,
          maxSubmorphWidth = this.getMinWidth();
      return Math.max(width, maxSubmorphWidth);
  }
}

export class CellGroup {
  
  constructor({cell, morph, layout, align}) {
    this.state = {cells: [cell], layout: layout, align, resize: true};
    layout && layout.addGroup(this);
    this.morph = morph;
  }
  
  get morph() {
    if (this.state.morph) {
       if (this.state.morph.isMorph) return this.state.morph;
       return this.layout.container.submorphs.find(m => m.name == this.state.morph);
    }
    return null;
  }

  get compensateOrigin() { return this.layout.compensateOrigin }
  
  get resize() { return this.state.resize }
  set resize(forceBounds) { this.state.resize = forceBounds; this.layout.apply() }
  
  get align() { return this.state.align || "topLeft" }
  set align(orientation) { 
      this.state.align = orientation;
      this.resize = false; 
      this.layout.apply();
  }
  
  set morph(value) {
    const conflictingGroup = value && this.layout.getCellGroupFor(value);
    if (conflictingGroup) conflictingGroup.morph = null;
    if (value) {
       this.layout.morphToGroup[value.id || value] = this;
    } else {
       if (this.morph && this.layout.morphToGroup[this.morph.id] == this) delete this.layout.morphToGroup[this.morph.id];
    }
    this.state.morph = value;
    this.layout.apply();
  }
  
  manages(morph) {
    return this.morph && (this.morph == morph || this.morph.name == morph)
  }
  
  apply(animate = false) {
    var target = this.morph;
    if(target) {
      const bounds = this.layout.fitToCell ? this.bounds() : this.position.extent(target.extent),
            offset = this.compensateOrigin ? this.layout.container.origin.negated() : pt(0,0)
      if (animate) {
        var extent = this.resize ? bounds.extent() : target.extent,
            {duration, easing} = animate;
        target.animate({[this.align]: bounds[this.align]().addPt(offset), extent, duration, easing});
      } else {
        if (this.resize) target.extent = bounds.extent();
        target[this.align] = bounds[this.align]().addPt(offset);
      }
    }
    
  }
  
  get cells() { return this.state.cells; }
  
  get layout() { return this.state.layout; }
  
  bounds() {
    if (this.cells.length > 0) {
      return this.cells
                 .map(cell => cell.bounds())
                 .reduce((a,b) => a.union(b));
    } else {
      return rect(0,0,0,0);
    }
  }
  
  includes(cell) {
    return this.cells.find(c => c == cell);
  }
  
  connect(cell) {
    // connect partial row and col ?
    if (this.morph == undefined) {
      this.morph = cell.group.morph;
    }
    if(cell.group) {
      cell.group.disconnect(cell, this);
    } else {
      cell.group = this;
    }
    this.cells.push(cell);
  }
  
  disconnect(cell, newGroup=null) {
    // remove partial row and col ?
    cell.group = newGroup || new CellGroup({morph: null, layout: this.layout, cell});
    arr.remove(this.cells, cell);
    if (this.cells.length < 1 && this.layout) this.layout.removeGroup(this);
  }
  
  merge(otherGroup) {
    otherGroup.cells.forEach(c => {
      this.connect(c);
    })
  }
  
  get topLeft() {
    return this.cells.find(cell => 
        (cell.left == null || cell.left.group != this) && 
        (cell.top == null || cell.top.group != this));
  }
  
  get bottomRight() {
    return this.cells.find(cell => 
        (cell.right == null || cell.right.group != this) && 
        (cell.bottom == null || cell.bottom.group != this));
  }
  
  get position() {
    return this.topLeft.position();
  }
  
}

class LayoutAxis {
  
  get otherAxis() {
    return [...this.axisBefore, ...this.axisAfter]
  }
  get axisBefore() { 
    var curr = this, res = [];  
    while (curr = curr.before) res = [curr, ...res]
    return res;
  }
  get axisAfter() {
    var curr = this, res = [];
    while (curr = curr.after) res = [...res, curr];
    return res;
  }
  
  get before() { throw Error("before() not implemented!") }
  get after() { throw Error("after() not implemented!") }
  
  getRoot() { 
    return (this.axisBefore[0] || this).items[0];
  }

  adjustProportion(delta) {
    var dynamicProportion = this.dynamicLength / this.containerLength,
        nextDynamic;
    if (nextDynamic = this.axisAfter.find(axis => !axis.isStatic)) {
      delta = Math.min(delta, nextDynamic.proportion);
      this.proportion += delta
      nextDynamic.proportion -= delta; 
    } else { 
      // we are either the last row, or there are no rows to steal from
      if (this.length + (delta * this.containerLength) < 0) 
        delta = -this.length / this.containerLength;
      this.axisBefore.forEach(a => {
        a.proportion /= 1 + delta;
      });
      this.proportion = 1 - arr.sum(this.axisBefore.map(a => a.proportion))
      this.containerLength += delta * this.containerLength;
    }
  }
  
  adjustStretch(delta) {
     if (this.fixed) {
       this.fixed += delta;
       this.containerLength += delta;
     } else {
       this.adjustProportion(delta / this.containerLength);
     }
  }
  
  equalizeDynamicAxis() {
    var dynamicAxis = this.otherAxis.length + 1;
    this.otherAxis.forEach(a => {
      a.proportion = 1 / dynamicAxis;
    });
    this.proportion = 1 / dynamicAxis;
  }
  
  addBefore() {
    const newAxis = this.emptyAxis();
    this.before && this.before.attachTo(newAxis);
    newAxis.attachTo(this);
    this.equalizeDynamicAxis();
    this.layout.grid = this.getRoot();
  }
  
  addAfter() {
    const newAxis = this.emptyAxis();
    this.after && newAxis.attachTo(this.after);
    this.attachTo(newAxis);
    this.equalizeDynamicAxis();
    this.layout.grid = this.getRoot();
  }
  
}

export class LayoutColumn extends LayoutAxis {
  
  constructor(cell) {
    this.origin = cell;
    this.items = [...cell.above, cell, ...cell.below];
  }
  
  emptyAxis() {
    return new LayoutColumn(new LayoutCell({column: arr.withN(this.items.length, null), layout: this.layout}));
  }

  set paddingLeft(left) {
     this.items.forEach(c => {
        c.padding.x = left;
     });
  }

  set paddingRight(right) {
     this.items.forEach(c => {
        c.padding.width = right;
     });
  }
  
  get before() { return this.origin.left && new LayoutColumn(this.origin.left); }
  get after() { return this.origin.right && new LayoutColumn(this.origin.right); }
  
  get containerLength() { return this.container.width }
  set containerLength(width) { this.container.width = width; }
  
  get length() { return this.origin.width; }
  get dynamicLength() { return this.origin.dynamicWidth; }
  
  get container() { return this.origin.container }
  get layout() { return this.origin.layout }
  
  get isStatic() { return this.origin.staticWidth }
  
  attachTo(col) {
    arr.zip(this.items, col.items)
       .forEach(([a, b]) => {
         a.right = b;
         b.left = a;
       });
    this.equalizeDynamicAxis();
    return col
  }
  
  row(idx) { return this.items[idx]; }
  
  get min() { return this.origin.min.width || 0; }
  set min(x) { this.adjustMin(x - this.min); }
  
  adjustMin(delta) {
    this.items.forEach(c => {
      if (c.min.width + delta < 0) {
        c.min.width = 0;
      } else if (c.min.width + delta > c.width) {
        c.min.width += delta;
      } else {
        c.min.width += delta;
      }
    });
    this.layout.apply()
  }
  
  get fixed() {
    return this.origin.fixed.width
  }
  
  set fixed(active) {
    const fixedWidth = typeof active == "number" ? active : active && this.origin.width;
    this.items.forEach(c => {
      c.fixed.width = fixedWidth;
    });
    this.layout.apply();
  }
  
  set proportion(prop) {
    this.items.forEach(c => {
      c.proportion.width = prop;
    });
    this.layout.apply()
  }
  
  get proportion() { return this.origin.proportion.width; }
  get adjustedProportion() { return this.origin.adjustedProportion.width; }
  
  remove() {
    const a = this.before || this.after;
    this.items.forEach(c => {
      if (c.left) c.left.right = c.right;
      if (c.right) c.right.left = c.left;
      c.group.disconnect(c);
    });
    a.equalizeDynamicAxis();
  }

}

export class LayoutRow extends LayoutAxis {
  
  constructor(cell) {
    this.origin = cell;
    this.items = [...cell.before, cell, ...cell.after];
  }
    
  emptyAxis() {
    return new LayoutRow(new LayoutCell({row: arr.withN(this.items.length, null), layout: this.layout}));
  }

  set paddingTop(top) {
    this.items.forEach(c => {
       c.padding.y = top;
    })
  }

  set paddingBottom(bottom) {
    this.items.forEach(c => {
       c.padding.height = bottom;
    })
  }
  
  get before() { return this.origin.top && new LayoutRow(this.origin.top) }
  get after() { return this.origin.bottom && new LayoutRow(this.origin.bottom) }
  
  get container() { return this.origin.container }
  get layout() { return this.origin.layout }
  
  get isStatic() { return this.origin.staticHeight }
  
  attachTo(row) {
    arr.zip(this.items, row.items)
       .forEach(([a, b]) => {
          a.bottom = b;
          b.top = a;
      });
    this.equalizeDynamicAxis();
    return row
  }
  
  col(idx) { return this.items[idx]; }
  
  get min() { return this.origin.min.height || 0; }
  set min(x) { this.adjustMin(x - this.min); }
  
  adjustMin(delta) {
    this.items.forEach(c => {
      if (c.min.height + delta < 0) {
        c.min.height = 0;
      } else if (c.min.height + delta > c.height) {
        c.min.height += delta;
      } else {
        c.min.height += delta;
      }
    });
    this.layout.apply();
  }
  
  get containerLength() { return this.container.height }
  set containerLength(height) { this.container.height = height; }
  get dynamicLength() { return this.origin.dynamicHeight }
  get length() { return this.origin.height }
  get fixed() { return this.origin.fixed.height }
  
  set fixed(active) {
    const fixedHeight = typeof active == "number" ? active : active && this.origin.height
    this.items.forEach(c => { 
      c.fixed.height = fixedHeight;
    });
    this.layout.apply();
  }
  
  set proportion(prop) { 
    this.items.forEach(c => {
      c.proportion.height = prop;
    });
    this.layout.apply();
  }
  
  get proportion() { return this.origin.proportion.height; }
  get adjustedProportion() { return this.origin.adjustedProportion.height; }
  
  remove() {
    const a = this.before || this.after;
    this.items.forEach(c => {
      if (c.top) c.top.bottom = c.bottom;
      if (c.bottom) c.bottom.top = c.top;
      c.group.disconnect(c);
    });
    a.equalizeDynamicAxis();
  }
  
}

export class LayoutCell {
  
  constructor({row, column, 
               top, left, right, bottom, 
               layout}) {
    var group, 
        [rv, ...row] = row || [],
        [cv, ...column] = column || [];
       
    this.layout = layout;
    this.fixed = {};
    this.min = {width: 0, height: 0};
    this.top = top; this.left = left;
    this.bottom = bottom; this.right = right;

    this.padding = rect(0,0,0,0);
    
    if (row.length > 0) {
      this.right = new LayoutCell({row, left: this, layout});
    } else if (column.length > 0) {
      this.bottom = new LayoutCell({column, top: this, layout});
    }
    
    this.proportion = {height: 1 / this.col(0).items.length,
                       width: 1 / this.row(0).items.length}

    if (group = layout && layout.getCellGroupFor(rv || cv)) { 
      group.connect(this);
    } else {
      this.group = new CellGroup({cell: this, morph: rv || cv, layout}); 
    }
  }
  
  get container() { return this.layout.container }
  
  get above() { return this.collect({neighbor: "top", prepend: true}) }
  
  get below() { return this.collect({neighbor: "bottom", append: true}) }
  
  get before() { return this.collect({neighbor: "left", prepend: true}) }
  
  get after() { return this.collect({neighbor: "right", append: true}) }
  
  collect({neighbor, prepend, append}) {
    var items = [], curr = this;
    while (curr = curr[neighbor]) {
      if (prepend) items = [curr, ...items];
      if (append) items = [...items, curr];
    }
    return items
  }
  
  col(idx) {
    var cell = this, i = idx;
    while (i > 0 && cell) {
      cell = cell.right;
      i--;
    }
    if (!cell) throw Error(`${idx} out of bounds! Last column was ${idx - i - 1}`);
    return new LayoutColumn(cell);
  }
  
  row(idx) {
    var cell = this, i = idx;
    while (i > 0 && cell) {
      cell = cell.bottom;
      i--;
    }
    if (!cell) throw Error(`${idx} out of bounds! Last row was ${idx - i - 1}`);
    return new LayoutRow(cell);
  }
  
  get extent() {
    return pt(this.width, this.height);
  }
  
  get staticWidth() { return this.fixed.width || (this.min.width > (this.proportion.width * this.container.width)) }
  
  get totalStaticWidth() { 
    return arr.sum([this, ...this.before, ...this.after].map(c => {
      if (c.staticWidth) {
        return c.fixed.width || c.min.width;
      } else {
        return 0;
      }
    })) }
    
  get staticHeight() { return this.fixed.height || (this.min.height > (this.proportion.height * this.container.height)) }
                             
  get totalStaticHeight() {
    return arr.sum([this, ...this.above, ...this.below].map(c => {
      if (c.staticHeight) {
        return c.fixed.height || c.min.height;
      } else {
        return 0;
      }
    }));
  }
  
  get dynamicWidth() { 
    return Math.max(this.container.width - this.totalStaticWidth, 0);
  }
  
  get dynamicHeight() { 
    return Math.max(this.container.height - this.totalStaticHeight, 0);
  }
  
  get inactiveProportion() {
    return {width: arr.sum([this, ...this.before, ...this.after].map(c => 
                            (c.staticWidth && c.proportion.width) || 0)),
            height: arr.sum([this, ...this.above, ...this.below].map(c => 
                            (c.staticHeight && c.proportion.height) || 0))}
  }
  
  get adjustedProportion() {
    return {
      width: this.inactiveProportion.width > 0 ? 
               this.proportion.width / (1.0 - this.inactiveProportion.width) :
               this.proportion.width,
      height: this.inactiveProportion.height > 0 ?
               this.proportion.height / (1.0 - this.inactiveProportion.height) :
               this.proportion.height
    }
  }
  
  get width() {
    var width = this.fixed.width,
        width = width || this.adjustedProportion.width * this.dynamicWidth;
    return width < this.min.width ? this.min.width : width;
  }
  
  get height() {
    var height = this.fixed.height,
        height = height || this.adjustedProportion.height * this.dynamicHeight;
    return height < this.min.height ? this.min.height : height;
  }
  
  get position() {
    return pt(arr.sum(this.before.map(c => c.width)),
              arr.sum(this.above.map(c => c.height)));
  }
  
  bounds() {
    return this.position.addPt(this.padding.topLeft())
               .extent(this.extent.subPt(this.padding.extent())
                                  .subPt(this.padding.topLeft()));
  }
  
}

export class GridLayout extends Layout {

  constructor(config) {
    super(config);
    config = {autoAssign: true, fitToCell: true, ...config};
    this.cellGroups = [];
    this.morphToGroup = {};
    this.config = config;
  }

  name() { return "Grid" }
  description() { return "Aligns the submorphs alongside a configurable grid. Columns and rows and be configured to have different proportional, minimal or fixed sizes. Cells can further be grouped such that submorphs fill up multiple slots of the grid." }

  initGrid() {
    const grid = this.ensureGrid(this.config),
          rows = grid.map(row => new LayoutRow(new LayoutCell({row, layout: this})));
    rows.reduce((a, b) => a.attachTo(b));
    this.config.autoAssign && this.autoAssign(this.notInLayout);
    this.grid = rows[0].col(0);
  }

  get compensateOrigin() { return this.config.compensateOrigin; }
  set compensateOrigin(compensate) { this.config.compensateOrigin = compensate }

  get fitToCell() { return this.config.fitToCell }
  set fitToCell(fit) { this.config.fitToCell = fit }
  
  get notInLayout() { return arr.withoutAll(this.container.submorphs, this.cellGroups.map(g => g.morph)) }
  
  col(idx) { return this.grid.col(idx) }
  row(idx) { return this.grid.row(idx) }
  
  get rowCount() { return this.grid.col(0).items.length }
  get columnCount() { return this.grid.row(0).items.length }
  
  addGroup(group) {
    this.cellGroups.push(group);
  }
  
  removeGroup(group) {
    arr.remove(this.cellGroups, group);
  }

  apply(animate = false) {
    if (this.active) return;
    this.active = true;
    if (!this.grid) this.initGrid();
    this.container.submorphs.forEach(m => {
         const g = this.getCellGroupFor(m);
         g && g.apply(animate);
    });
    this.container.extent = pt(Math.max(this.grid.totalStaticWidth, this.container.width),
                               Math.max(this.grid.totalStaticHeight, this.container.height));
    this.active = false;
  }
  
  getCellGroupFor(morph) { 
    return morph && (this.morphToGroup[morph.id] || this.morphToGroup[morph.name]);
  }
  
  onSubmorphRemoved(removedMorph) {
    const cellGroup = this.getCellGroupFor(removedMorph);
    if (cellGroup) cellGroup.morph = null;
    super.onSubmorphRemoved(removedMorph);
  }
  
  inspect(pointerId) {
    return new GridLayoutHalo(this.container, pointerId);
  }

  ensureGrid({grid, rowCount, columnCount}) {
    grid = grid || [[]];
    rowCount =  rowCount || grid.length;
    columnCount = columnCount || arr.max(grid.map(row => row.length));

    if (grid.length < rowCount) {
      grid = grid.concat(arr.withN(rowCount - grid.length, []));
    }

    grid = grid.map(row => {
      if (row.length < columnCount)
        row = row.concat(arr.withN(columnCount - row.length, null));
      return row.map(v => v ? (v.isMorph && v) || this.container.getSubmorphNamed(v) || v : v);
    });

    return grid;
  }

  autoAssign(morphs) {
    morphs.forEach(m => {
      var cellGroup, closestDist = Infinity;
      this.cellGroups.forEach(g => {
        if (!g.morph) {
          g.cells.forEach(c => {
            var distToCell = c.position.dist(m.position);
            if (distToCell < closestDist) {
               cellGroup = g
               closestDist = distToCell;
            }
          });
        }
      });
      if(cellGroup) cellGroup.morph = m;
    });
  }

}
