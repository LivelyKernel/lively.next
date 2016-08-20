import { pt, Color } from "lively.graphics";
import { arr, grid, properties } from "lively.lang";
import { GridLayoutHalo } from "./halo.js";
import { Morph } from "./index.js";

class Layout {
  constructor({spacing, border} = {}) {
    this.border = {top: 0, left: 0, right: 0, bottom: 0, ...border};
    this.spacing = spacing || 0;
    this.active = false;
  }

  onSubmorphResized(morph, submorph) { this.applyTo(morph) }
  onSubmorphAdded(morph, submorph) { this.applyTo(morph) }
  onSubmorphRemoved(morph, submorph) { this.applyTo(morph) }
  
  onChange(morph, change) {
    if (change.prop == "submorphs") {
      switch (change.selector) {
        case "removeMorph":
          this.onSubmorphRemoved(morph, change.args[0]);
          break;
        case "insertMorphAt":
          this.onSubmorphAdded(morph, change.args[0]);
          break;
      }
    }
    this.applyTo(morph);
  }
  
  affectsLayout({prop}) {
    return ["position", "scale", "rotation"].includes(prop);
  }

  onSubmorphChange(morph, submorph, change) {
    if ("extent" == change.prop) this.onSubmorphResized(morph, submorph);
    if (this.affectsLayout(change)) this.applyTo(morph);
  }
  
  inspect(pointerId) {}
}

export class VerticalLayout extends Layout {

  applyTo(morph) {
    if (this.active) return;
    var pos = pt(this.spacing, this.spacing),
        submorphs = morph.submorphs,
        maxWidth = 0;

    this.active = true;
    submorphs.forEach(m => {
      m.position = pos;
      pos = m.bottomLeft.addPt(pt(0, this.spacing));
      maxWidth = Math.max(m.width, maxWidth);
    });
    morph.extent = pt(maxWidth, pos.y)
    this.active = false;
  }

}

export class HorizontalLayout extends Layout {

 applyTo(morph) {
    if (this.active) return;
    var pos = pt(this.spacing, this.spacing),
        submorphs = morph.submorphs,
        maxHeight = 0;

    this.maxHeight = 0;
    this.active = true;
    submorphs.forEach(m => {
      m.position = pos;
      pos = m.topRight.addPt(pt(this.spacing, 0));
      maxHeight = Math.max(m.height, maxHeight);
    });
    morph.extent = pt(pos.x + this.spacing, maxHeight + 2 * this.spacing);
    this.active = false;
 }

}

export class TilingLayout extends Layout {

  applyTo(morph) {
    var width = this.getOptimalWidth(morph, morph.submorphs),
        currentRowHeight = 0,
        currentRowWidth = 0,
        spacing = this.spacing,
        previousRowHeight = spacing,
        i = 0, rowSwitch = true;

    if (this.active) return;
    this.active = true;

    while (i < morph.submorphs.length) {
        var submorphExtent = morph.submorphs[i].extent;
        if (rowSwitch || currentRowWidth + submorphExtent.x + 2*spacing <= width) {
            rowSwitch = false;
            morph.submorphs[i].position = pt(currentRowWidth + spacing, previousRowHeight);
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

  getMinWidth(container, submorphs) {
      return submorphs.reduce((s, e) => (e.extent.x > s) ? e.extent.x : s, 0) +
          this.border.left + this.border.right;
  }

  getMinHeight(container, submorphs) {
      return submorphs.reduce((s, e) => (e.extent.y > s) ? e.extent.y : s, 0) +
          this.border.top + this.border.bottom;
  }

  getOptimalWidth(container, submorphs) {
      var width = container.width,
          maxSubmorphWidth = this.getMinWidth(container, submorphs);
      return Math.max(width, maxSubmorphWidth);
  }
}

export class CellGroup {
  
  constructor({morph, cells, layout}) {
    this.state = {morph, cells: cells.map(cell => ({...cell, bounds: layout.computeCellBounds(cell)})), layout};
  }
  
  get morph() { return this.state.morph; }
  get cells() { return this.state.cells; }
  get layout() { return this.state.layout; }
  
  get rows() { return arr.uniq(this.cells.map(cell => cell.row)); }
  get cols() { return arr.uniq(this.cells.map(cell => cell.col)); }
  
  fixpoint(part) {
    switch (part) {
      case "topLeft":
        return this.cells.reduce((a,b) => 
                  a.row <= b.row && a.col <= b.col ? a : b);
      case "bottomRight":
        return this.cells.reduce((a,b) => 
                  a.row >= b.row && a.col >= b.col ? a : b);
      default:
        throw new Error("No fixpoint available for: " + part);
    }
    part = this.bounds().partNamed(part);
    return this.cells.find(cell => cell.bounds.containsPoint(part));
  }
  
  bounds() {
    return this.cells
                .map(cell => this.layout.computeCellBounds(cell))
                .reduce((a,b) => a.union(b));
  }
  
  includes(cell) {
    return this.cells.find(({row, col}) => row == cell.row && col == cell.col);
  }
  
  addCell(cell) {
    this.cells.push({bounds: this.layout.computeCellBounds(cell), ...cell});
  }
  
  removeCell(cell) {
    if (this.cells.length > 1) arr.remove(this.cells, this.includes(cell));
  }
  
}

export class GridLayout extends Layout {

  constructor(props) {
    super(props);
    this.initGrid(props);
    this.colSizing = this.initSizing(this.columnCount, props.colSizing);
    this.rowSizing = this.initSizing(this.rowCount, props.rowSizing);
  }

  applyTo(morph) {
    if (this.active) return;
    this.active = true;
    this.container = morph;
    this.initMorphToCells()
    this.adjustRowAndColSizes();
    this.adjustExtents();
    this.adjustPositions();
    this.active = false;
  }
  
  computeCellBounds({row, col}) {
    const extent = pt(this.colWidths[col] + 1, 
                      this.rowHeights[row] + 1),
          position = pt(arr.sum(this.colWidths.slice(0, col)),
                        arr.sum(this.rowHeights.slice(0, row)));
    return position.extent(extent);
  }
  
  getCellGroups() {
    const cellGroups = [];
    
    grid.forEach(this.grid, (morph, row, col) => {
      if (morph) {
        var g = cellGroups.find(g => g.morph == morph);
        if (g) { 
          g.addCell({row, col});
          return;
        }
      }
      cellGroups.push(new CellGroup({morph, cells: [{row, col}], layout: this}));
    });
    
    return cellGroups;
  }
  
  onSubmorphRemoved(container, removedMorph) {
    this.morphToCells
        .get(removedMorph)
        .forEach(({row, col}) => {
      this.grid[row][col] = null;
    })
    this.morphToCells.delete(removedMorph);
    //this.applyTo(container);
  }
  
  inspect(pointerId) {
    return new GridLayoutHalo(this.container, pointerId);
  }

  initSizing(count, sizingParams) {
    var sizing = arr.withN(count, {min: 0, fixed: false});
    properties.forEachOwn(sizingParams, i => {
      sizing[i] = sizingParams[i];
    })
    const dynamicSizings = count - this.countFixed(sizing);
    return sizing.map(s => {
       return {
          proportion: 1 / dynamicSizings,
          ...s
        }
    });
  }

  initGrid({grid, rowCount, columnCount}) {
    this.grid = grid || [[]];
    this.rowCount =  rowCount || this.grid.length;
    this.columnCount = columnCount || arr.max(this.grid.map(row => row.length));

    if (this.grid.length < this.rowCount) {
      this.grid = this.grid.concat(arr.withN(this.rowCount - this.grid.length, []));
    } else {
      this.rowCount = this.grid.length;
    }

    this.grid = this.grid.map(row => {
      if (row.length < this.columnCount) {
        row = row.concat(arr.withN(this.columnCount - row.length, null));
      }
      return row;
    });
  }

  countFixed(sizings) {
    return sizings.filter(s => s.fixed).length;
  }

  insertSizing(index, sizings) {
    var dynamicSizings = sizings.length - this.countFixed(sizings) + 1;
    arr.range(0, sizings.length - 1).forEach(i => {
      sizings[i].proportion = 1 / dynamicSizings;
    });
    sizings.splice(index, 0, {proportion: 1 / dynamicSizings, fixed: false, min: 0});
  }

  removeSizing(index, sizings) {
    var dynamicSizings = sizings.length - this.countFixed(sizings) - 1;
    if(sizings[index].fixed) dynamicSizings++;
    arr.range(0, sizings.length - 1).forEach(i => {
      sizings[i].proportion = 1 / dynamicSizings;
    });
    sizings.splice(index, 1);
  }

  addRowBefore(index) {
    this.grid.splice(index, 0, arr.withN(this.columnCount, null));
    this.insertSizing(index, this.rowSizing);
    this.rowCount++;
    this.applyTo(this.container);
  }

  removeRow(index) {
    this.grid.splice(index, 1);
    this.removeSizing(index, this.rowSizing);
    this.rowCount--;
    this.applyTo(this.container);
  }

  addColumnBefore(index) {
    this.grid.forEach(row => row.splice(index, 0, null));
    this.insertSizing(index, this.colSizing);
    this.columnCount++;
    this.applyTo(this.container);
  }

  removeColumn(index) {
    this.grid.forEach(row => row.splice(index, 1));
    this.removeSizing(index, this.colSizing);
    this.columnCount--;
    this.applyTo(this.container);
  }
  
  adjustRowMin(row, delta) {
    this.adjustMin({row, delta})
  }
  
  adjustColumnMin(col, delta) {
    this.adjustMin({col, delta})
  }
  
  adjustMin({row, col, delta}) {
    var sizing = row != null ? this.rowSizing[row] : this.colSizing[col],
        space = row != null ? this.rowHeights[row] : this.colWidths[col];
    if (sizing.min + delta < 0) {
      sizing.min = 0;
    } else if (sizing.min + delta > space) {
      sizing.min = space;
    } else {
      sizing.min += delta;
    }
    this.applyTo(this.container);
  }
  
  setFixed({row, col, fixed}) {
    var sizings = col != null ? this.colSizing : this.rowSizing,
        sizing = sizings[col != null ? col : row],
        space = col != null ? this.colWidths[col] : this.rowHeights[row],
        orthogonalSpace = col != null ? this.container.width : this.container.height;
    if (fixed && !sizing.fixed) {
      // the axis became fixed, so distribute proportion to all other proportions accordingly
      sizing.fixed = space;
      sizings.forEach(s => {
        if (sizing != s) {
          s.proportion /= 1 - sizing.proportion;
        }
      });
      sizing.proportion = 0;
    } else if (!fixed && sizing.fixed) {
      // the axis was turned dynamic again, steal proportion from all other axis accordingly
      sizing.fixed = false;
      sizing.proportion = space / (orthogonalSpace - arr.sum(sizings.map(s => s.fixed)));
      sizings.forEach(s => {
        if (sizing != s) {
          s.proportion -= s.proportion * sizing.proportion;
        }
      });
    }
    this.applyTo(this.container);
  }
  
  adjustStretch(sizings, idx, delta, length) {
    var sizing = sizings[idx],
        dynamicLength = length - arr.sum(sizings.map(s => s.fixed)),
        dynamicProportion = dynamicLength / length,
        nextDynamicSizing;
     if (sizing.fixed) {
      sizing.fixed += delta;
      length += delta;
     } else if (nextDynamicSizing = sizings.slice(idx + 1).find(s => !s.fixed)) {
      delta = Math.min(delta / length, nextDynamicSizing.proportion);
      sizing.proportion += delta;
      nextDynamicSizing.proportion -= delta; 
    } else {
      if (sizing.proportion * dynamicLength + delta < 0)
        delta = -sizing.proportion * dynamicLength;
      sizings.forEach((sizing, i) => {
        if (!sizing.fixed && i < idx) {
          sizings[i].proportion /= 1 + (delta / length / dynamicProportion);
        }
      });
      sizing.proportion = 1 - arr.sum(sizings.filter(s => s != sizing && !s.fixed)
                                             .map(s => s.proportion))
      length += delta;
    }
    return length;
  }
  
  adjustRowStretch(row, delta) {
    this.container.height = this.adjustStretch(this.rowSizing, row, delta, this.container.height);
    this.applyTo(this.container);
  }
  
  adjustColumnStretch(col, delta) {
    this.container.width = this.adjustStretch(this.colSizing, col, delta, this.container.width);
    this.applyTo(this.container);
  }

  initMorphToCells() {
    this.morphToCells = new WeakMap();
    grid.forEach(this.grid, (m, row, col) => {
      if (m && !m.isMorph) m = this.container.getSubmorphNamed(m);
      if(this.morphToCells.get(m)) {
        this.morphToCells.get(m).push({row, col});
      } else if (m) {
        this.morphToCells.set(m , [{row, col}]);
      }
    });
  }

  assign(submorph, {row, col}) {
    this.grid = grid.map(this.grid, (m, r, c) => {
        const rowMatch = r == row || Array.isArray(row) && row.includes(r),
              colMatch = c == col || Array.isArray(col) && col.includes(c),
              match = rowMatch && colMatch,
              alreadyAssigned = m === submorph || 
                                this.container.getSubmorphNamed(m) === submorph;
        if (alreadyAssigned && !match) return null;
        if (match) return submorph;
        return m;
    });
    this.applyTo(this.container);
  }
  
  clear({row, col}) {
    this.grid[row][col] = null;
    this.applyTo(this.container);
  }

  adjustRowAndColSizes() {
    const computeLength = (sizing, ids, containerLength, i) => {
      const {proportion, fixed, min} = sizing[i];
      if (fixed) return fixed;
      var fixedLength = 0, remainingProportion = 1;
      ids.forEach(i => {
        const {fixed, proportion, min} = sizing[i];
        if (fixed) {
          fixedLength += fixed
        } else if (proportion * containerLength < min) {
          remainingProportion -= proportion;
          fixedLength += min;
        }
      });
      return Math.max(min, (containerLength - fixedLength) * proportion / remainingProportion);
    }

    this.colWidths = arr.range(0, this.columnCount - 1).map(x =>
        computeLength(this.colSizing, arr.range(0, this.columnCount - 1), this.container.width, x));
    this.rowHeights = arr.range(0, this.rowCount - 1).map(y =>
        computeLength(this.rowSizing, arr.range(0, this.rowCount - 1), this.container.height, y));

    const minWidth = arr.sum(this.colWidths),
          minHeight = arr.sum(this.rowHeights);
    this.container.extent = pt(Math.max(minWidth, this.container.width),
                               Math.max(minHeight, this.container.height));
  }

  adjustExtents() {
    var cells;
    arr.forEach(this.container.submorphs, m => {
      cells = this.morphToCells.get(m);
      if (cells) {
        const height = arr.sum(arr.uniq(cells.map(({row}) => row))
                                  .map(r => this.rowHeights[r])),
              width = arr.sum(arr.uniq(cells.map(({col}) => col))
                                 .map(c => this.colWidths[c]));
        m.resizeBy(pt(width, height).subPt(m.extent));
      }
    });
  }

  adjustPositions() {
    var distanceToTop = 0,
        distanceToLeft = 0,
        layoutedMorphs = [];
    arr.range(0, this.rowCount - 1).forEach(y => {
        distanceToLeft = 0;
        arr.range(0, this.columnCount - 1).forEach(x => {
            var m = this.grid[y][x];
            if (m && !m.isMorph) m = this.container.getSubmorphNamed(m);
            if (m && !layoutedMorphs.includes(m)) {
              m.position = pt(distanceToLeft, distanceToTop);
              layoutedMorphs.push(m);
            }
            distanceToLeft += this.colWidths[x];
        });
        distanceToTop += this.rowHeights[y];
    });

    const remaining = this.container.submorphs.filter(m => !layoutedMorphs.includes(m));
    if (remaining.length > 0 && this.getCellGroups().find(g => !g.morph)) {
        this.autoAssign(remaining);
        this.adjustPositions();
    }
  }

  autoAssign(morphs) {
    morphs.forEach(m => {
      var row = 0, col = 0, closestDist = Infinity, found = false;
      grid.forEach(this.grid, (v, y, x) => {
        if (!v) {
            found = true;
            var distToCell = pt(arr.sum(this.colWidths.slice(0, x)),
                                arr.sum(this.rowHeights.slice(0, y))).dist(m.position);
            if (distToCell < closestDist) {
               row = y;
               col = x;
               closestDist = distToCell;
            }
        }
      });
      found && this.assign(m, {row, col})
    });
  }

}