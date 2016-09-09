import { Ellipse, Morph, Path, Text, 
         HorizontalLayout, GridLayout, 
         VerticalLayout, morph, Menu } from "./index.js"
import { Color, pt, rect, Line, Rectangle } from "lively.graphics";
import { string, obj, arr, num, grid } from "lively.lang";

const itemExtent = pt(24,24);

const guideGradient = [[0, Color.red.withA(0)],
                       [0.1, Color.red],
                       [0.9, Color.red],
                       [1.0, Color.red.withA(0)]]

class HaloItem extends Morph {

  get isEpiMorph() { return true; }

  constructor(props) {
    super({
      borderRadius: 15,
      fill: Color.gray.withA(.7),
      grabbable: false,
      location: null, // where to appear on target morph
      property: null, // what property of target to represent + modify
      extent: itemExtent,
      ...props
    });

  }

  get isHaloItem() { return true };

  alignInHalo() {
    const {x: width, y: height} = this.halo.extent,
          {row, col} = this.location,
          collWidth = Math.max((width + this.extent.x) / 3, 26),
          rowHeight = Math.max(height / 3, 26),
          pos = pt(collWidth * col, rowHeight * row).subPt(itemExtent);
    this.setBounds(pos.extent(itemExtent));
  }

  init() {}
  update() {}
  stop() {}
  valueForPropertyDisplay() { return undefined; }

}

export class FlexHalo extends Morph {
  
}

class AxisHalo extends Morph {
  
}

class RowHalo extends AxisHalo {
  
}

class ColumnHalo extends AxisHalo {
  
}

export class GridLayoutHalo extends Morph {

  constructor(container, pointerId) {
    super({
      styleClasses: ["morph", "halo"],
      borderColor: Color.orange,
      borderWidth: 2,
      extent: container.extent,
      fill: Color.transparent
    });
    this.state = {container, pointerId, target: container.layout}
    this.initGuides();
    this.alignWithTarget();
    
    this.focus();
  }

  get isLayoutHalo() { return true }

  get container() { return this.state.container; }
  get target() { return this.state.target; }

  alignWithTarget() {
    this.position = this.container.globalPosition;
    this.extent = this.container.extent;
    arr.reverse(this.guides).forEach(guide => guide.alignWithTarget());
  }

  /* inspection of grid layout */

  initGuides() {
    this.submorphs = [];
    this.guides = [];
    this.initCellGuides();
    this.initColumnGuides();
    this.initRowGuides();
  }
  
  get cells() {
    return arr.flatten(grid.map(this.target.grid, (m, row, col) => {
      return {morph: m, bounds: this.target.computeCellBounds({row, col}), row, col};
    }));
  }
  
  initCellGuides() {
    
    this.target.getCellGroups().forEach(group => {
      this.addMorph(this.cellGuide(group));
    })
    
    this.addMorph(this.resizer());
  }
  
  addGuide(guide) {
    guide.isHaloItem = true;
    this.guides.push(guide);
    return guide;
  }
  
  initRowGuides() {
    const self = this;
    this.addGuide(this.addMorph(new Morph({
      width: 25,
      fill: Color.gray.withA(0.7),
      borderRadius: 15,
      height: this.container.height,
      topRight: pt(-5, 0),
      alignWithTarget() { this.height = self.container.height; }
    })))

    arr.range(0, this.target.rowCount - 1).forEach(row => {
        const last = row == (this.target.rowCount - 1);
        this.addMorph(this.axisGuide({row, last}));
    });
  }
  
  initColumnGuides() {
    const self = this;
    this.addGuide(this.addMorph(new Morph({
      height: 25,
      fill: Color.gray.withA(0.7),
      borderRadius: 15,
      width: this.container.width,
      bottomLeft: pt(0, -5),
      alignWithTarget() { this.width = self.container.width }
    })))
    
    arr.range(0, this.target.columnCount - 1).forEach(col => {
        const last = col == (this.target.columnCount - 1);
        this.addMorph(this.axisGuide({col, last}));
    });
  }
  
  resizer() {
    const self = this;
    return this.addGuide(new Morph({
      fill: Color.transparent,
      extent: pt(25,25),
      nativeCursor: 'nwse-resize',
      onDrag(evt) {
        self.container.resizeBy(evt.state.dragDelta);
        self.alignWithTarget();
      },
      alignWithTarget() {
        this.bottomRight = self.extent;
      }
    }))
  }
  
  axisMenu({row, col}) {
    const lockButton = this.lockButton({row, col}),
          menuButton = this.menuButton({row, col});
    return new Morph({
      layout: col != null ? new HorizontalLayout() : new VerticalLayout(),
      submorphs: [lockButton, menuButton],
      fill: Color.transparent,
      visible: false,
      becomesActiveOnHover: true,
      alignWithTarget() {
        var offset;
        if (col != null) {
          offset = this.owner.width > this.width ? pt(5, 3) : pt(8, 26);
          this.bottomRight = this.owner.extent.subPt(offset);
        } else {
          offset = this.owner.height > this.height ? pt(2, 5) : pt(26, 10);
          this.bottomRight = this.owner.extent.subPt(offset);
        }
      }
    });
  }
  
  axisGuide({col, row, last}) {
    const self = this,
          minSlider = this.minSlider({row, col}),
          axisMenu = this.axisMenu({row, col}),
          proportionSlider = this.proportionSlider({row, col, last});
    proportionSlider.addMorph(minSlider);
    return this.addGuide(new Morph({
      fill: Color.transparent,
      submorphs: [proportionSlider, axisMenu],
      alignWithTarget() {
          this.extent = col != null ? 
                pt(self.target.colWidths[col] - 10, 40) : 
                pt(40, self.target.rowHeights[row] - 10),
          this.position = pt(
              col != null ? 
              Math.round(arr.sum(self.target.colWidths.slice(0, col))) + 10 : -45, 
              row != null ? 
              Math.round(arr.sum(self.target.rowHeights.slice(0, row))) + 10 : -45
          );
          proportionSlider.alignWithTarget();
          axisMenu.alignWithTarget();
      },
      onHoverIn() {
          minSlider.requestToShow();
          axisMenu.visible = true;
      },
      onHoverOut(evt) {
          minSlider.requestToHide(); 
          axisMenu.visible = false;
      },
    }))
  }
  
  viewer({position, alignWithTarget}) {
    return this.addGuide(new Text({
        styleClasses: ["morph", "halo"],
        padding: 6,
        visible: false,
        borderRadius: 10,
        fontColor: Color.white,
        fill: Color.black.withA(0.5),
        position, alignWithTarget,
        readOnly: true
    }));
  }
  
  proportionViewer({row, col}) {
    const gridLayout = this.target;
    return this.viewer({
        position: col != null ? pt(20, 40) : pt(40, 20), 
        alignWithTarget() {
            const {fixed, proportion} = col != null ? 
                        gridLayout.colSizing[col] : 
                        gridLayout.rowSizing[row];
            this.textString = fixed ? 
                                `${fixed.toFixed(1)}px` : 
                                `${(proportion * 100).toFixed()}%`; 
        }
    });
  }
  
  minViewer({row, col}) {
    const self = this;
    return this.viewer({
        position: col ? pt(20, 20) : pt(20, 20), 
        alignWithTarget() {
            const {min} = col != null ? 
                        self.target.colSizing[col] : 
                        self.target.rowSizing[row];
            this.textString = `min: ${min.toFixed()}px !`; 
        }
    });
  }
  
  proportionSlider({row, col, last}) {
    var self = this,
        proportionViewer = this.proportionViewer({col, row});

    return new Morph({
            nativeCursor: col != null ? "col-resize" : "row-resize",
            extent: col != null ? pt(10, 40) : pt(40, 10),
            fill: Color.transparent,
            submorphs: [this.devider({row, col, last}), proportionViewer],
            alignWithTarget() {
              if (col != null) {
                this.position = pt(this.owner.width - 5, 0);
              } else {
                this.position = pt(0, this.owner.height - 5);
              }
            },
            onDragStart() {
              proportionViewer.visible = true;  
            },
            onDrag: (evt) => {
                var delta = delta = evt.state.dragDelta;
                if (col != null) {
                  this.target.adjustColumnStretch(col, delta.x); 
                } else {
                  this.target.adjustRowStretch(row, delta.y);
                }
                self.alignWithTarget();
            },
            onDragEnd() {
                proportionViewer.visible = false;
            }
        });
  }
  
  devider({row, col, last}) {
      return new Morph({
          visible: !last,
          fill: Color.black.withA(0.5),
          position: col != null ? pt(4,15) : pt(15, 4),
          extent: col != null ? pt(2, 25) : pt(25, 2),
          draggable: false,
          reactsToPointer: false
      });
  }
  
  minSpaceBorder({row, col}) {
    return new Path({
      position: pt(-1,-1),
      borderStyle: "dashed",
      borderColor: Color.green,
      borderWidth: 2,
      extent: col != null ? 
                  pt(2, this.container.height + 50) :
                  pt(this.container.width + 50, 2),
      vertices: col != null ? 
                  [pt(1,0), pt(1, this.container.height + 50)] :
                  [pt(0,1), pt(this.container.width + 50, 1)]
    });
  }
  
  minSpaceVisualizer({row, col}) {
    const self = this,
          minSpaceBorder = this.minSpaceBorder({col, row});
    return this.addGuide(new Morph({
            fill: Color.green.withA(0.1),
            visible: false,
            isHaloItem: true,
            submorphs: [minSpaceBorder],
            alignWithTarget() {
                this.height = col != null ? 
                        self.container.height + 45 : self.target.rowSizing[row].min;
                this.width = col != null ? 
                        self.target.colSizing[col].min : self.container.width + 45; 
                this.topLeft = pt(5,5);
            }
          }))
  }
  
  minSlider({row, col}) {
    const self = this,
          minSpaceVisualizer = this.minSpaceVisualizer({row, col}),
          minViewer = this.minViewer({row, col});
    
    return this.addGuide(new Ellipse({
            nativeCursor: col != null ? "col-resize" : "row-resize",
            fill: Color.green,
            extent: pt(10,10),
            visible: false,
            submorphs: [minSpaceVisualizer, minViewer],
            becomesActiveOnHover: true,
            alignWithTarget() {
              this.position = col != null ? 
                        pt(-self.target.colSizing[col].min, 0) : 
                        pt(0, -self.target.rowSizing[row].min);
            },
            requestToShow() {
              this.visible = col != null ? 
                  !self.target.colSizing[col].fixed : 
                  !self.target.rowSizing[row].fixed;
            },
            requestToHide() {
                if (this.active) {
                    this.shouldHide = true;
                } else {
                    this.visible = false;
                }
            },
            onDragStart() {
              minViewer.visible = true;
              minSpaceVisualizer.visible = true;
              this.active = true;
            },
            onDrag: (evt) => {
                var delta;
                if (col != null) {
                    delta = evt.state.dragDelta.x;
                    this.target.adjustColumnMin(col, -delta);   
                } else {
                    delta = evt.state.dragDelta.y;
                    this.target.adjustRowMin(row, -delta);   
                }
                this.alignWithTarget();
            },
            onDragEnd() {
                minViewer.visible = false;
                minSpaceVisualizer.visible = false;
                this.active = false;
                if (this.shouldHide) {
                    this.visible = false; 
                    this.shouldHide = false;
                }
            }
        }));
  }
  
  lockButton({row, col}) {
      const self = this,
            getSizing = () => col != null ? 
                        this.target.colSizing[col] : 
                        this.target.rowSizing[row];
      return this.addGuide(new Morph({
            fill: Color.transparent,
            extent: pt(25,25),
            submorphs: [{center: pt(12.5, 12.5), 
                        fill: Color.transparent,
                        styleClasses: ["morph", "fa", "fa-unlock"]}],
            alignWithTarget() {
              if (getSizing().fixed) {
                this.fontColor = Color.red;
                this.submorphs[0].styleClasses = ["morph", "fa", "fa-lock"];
              } else {
                this.fontColor = Color.green;
                this.submorphs[0].styleClasses = ["morph", "fa", "fa-unlock"];
              }
            },
            onMouseDown() {
              this.toggleLock();
            },
            toggleLock() {
              const fixed = !getSizing().fixed;
              self.target.setFixed({col, row, fixed})
              this.alignWithTarget();
            }
          }));
  }
  
  menuButton({row, col}) {
    const subject = col != null ? "column" : "row",
          self = this,
          remove = () => {
            if (col != null) {
              this.target.removeColumn(col);
            } else {
              this.target.removeRow(row);
            }
            this.initGuides();
            this.alignWithTarget();
          },
          addBefore = () => {
            if (col != null) {
              this.target.addColumnBefore(col);
            } else {
              this.target.addRowBefore(row);
            }
            this.initGuides();
            this.alignWithTarget();
          },
          addAfter = () => {
            if (col != null) {
              this.target.addColumnBefore(col + 1)
            } else {
              this.target.addRowBefore(row);
            }
            this.initGuides();
            this.alignWithTarget();
          }
    return new Morph({
            fill: Color.transparent,
            extent: pt(25,25),
            submorphs: [{fill: Color.transparent,
                         styleClasses: ["morph", "fa", "fa-cog"], 
                         center: pt(12.5,12.5)}],
            onMouseDown(evt) {
              this.addMorph(evt.state.menu = new Menu({
                  position: pt(15,15),
                  items: [
                    [`Remove ${subject}`, () => remove() ],
                    [`Insert ${subject} before`, () => addBefore() ],
                    [`Insert ${subject} after`, () => addAfter() ]]
              }));
            }
          });
  }
  
  cellResizer(cellGroup, corner) {
    var self = this,
        adjacentCorner = corner == "topLeft" ? "bottomRight" : "topLeft",
        getCorner = (c) => { return cellGroup.bounds().partNamed(c) }
    return new Ellipse({
      borderWidth: 1, 
      visible: false,
      borderColor: Color.black, 
      nativeCursor: "nwse-resize",
      removeCell(cell) {
        self.target.clear(cell)
        cellGroup.removeCell(cell);
        self.alignWithTarget();
      },
      addCell(cell) {
        cellGroup.addCell(cell);
        self.target.assign(cellGroup.morph, {row: cellGroup.rows, col: cellGroup.cols});
        self.alignWithTarget();
      },
      start() {
        this.fixpointCell = cellGroup.fixpoint(adjacentCorner);
        this.draggedDelta = getCorner(corner)
        this.debugMorph = self.addMorph(new Morph({fill: Color.orange.withA(0.5)}));
      },
      update(delta) {
        this.draggedDelta =  this.draggedDelta.addPt(delta);
        const coveringRect = Rectangle.unionPts([this.draggedDelta]).union(this.fixpointCell.bounds);
        this.debugMorph.setBounds(coveringRect);
        self.cells.forEach((cell, i) => {
                    const coverage = coveringRect.intersection(cell.bounds).area() / cell.bounds.area();
                    if (cellGroup.includes(cell) && coverage < 0.1) this.removeCell(cell);
                    if (!cellGroup.includes(cell) && coverage > 1/3) this.addCell(cell);
                  });
      },
      onDragEnd(evt) {
        this.debugMorph.remove();
      },
      onDragStart(evt) {
        this.start(evt.position);
      },
      onDrag(evt) {
        this.update(evt.state.dragDelta)
      }
    });
  }

  cellGuide(cellGroup) {
    const self = this,
          topLeft = this.cellResizer(cellGroup, "topLeft"),
          bottomRight = this.cellResizer(cellGroup, "bottomRight");
    
    return this.addGuide(new Morph({
      fill: Color.transparent,
      borderColor: Color.orange,
      borderWidth: 2,
      isHaloItem: true,
      isCell: true,
      draggable: false,
      submorphs: [ topLeft, bottomRight ],
      onMouseDown(evt) {
        this.becomeActive();
      },
      deactivate() {
        this.borderColor = Color.orange;
        this.fill = Color.transparent;
        this.submorphs.forEach(b => { b.visible = false });
      },
      becomeActive() {
        self.guides.forEach(guide => { if (guide.isCell) guide.deactivate(); });
        this.borderColor = Color.rgbHex("#1565C0"),
        this.fill = Color.rgbHex("#1565C0").withA(0.3),
        self.addMorph(this.remove());
        this.submorphs.forEach(b => { b.visible = true });
      },
      onHover(evt) {
        // if hand carries a morph, preview the alignment of the morph
      },
      onDrop(droppedMorph) {
        // the dropped Morph is placed into the cell of the layout
        console.log(droppedMorph);
      },
      alignWithTarget() {
        this.setBounds(cellGroup.bounds());
        topLeft.center = this.innerBounds().topLeft();
        bottomRight.center = this.innerBounds().bottomRight();
      }
    }));
  }
}

class FlexLayoutHalo extends Morph {


  inspectHorizontalLayout() {

  }

  inspectVerticalLayout() {
    this.inspectHorizontalLayout();
  }

  inspectTilingLayout() {

  }

}

class NameHalo extends HaloItem {

  constructor(props) {

    super({
        borderRadius: 15,
        fill: Color.gray.withA(.7),
        borderColor: Color.green,
        layout: new HorizontalLayout({spacing: 3}),
        ...props
      });

    this.nameHolder = new Text({
        leftCenter: pt(5,8),
        fixedHeight: true,
        height: 20,
        fill: Color.gray.withA(0),
        draggable: false,
        fill: Color.transparent,
        fontColor: Color.garkgray});

    this.addMorph({
      draggable: false,
      height: 20, fill: Color.gray.transparent,
      submorphs: [this.nameHolder]});

    this.validityIndicator = new Text({
      readOnly: true,
      draggable: false,
      fill: Color.orange.withA(0),
      fontColor: Color.green,
      fixedWidth: true,
      fixedHeight: true,
      extent: pt(18,18),
      submorphs: [{name: "validityIcon",
                   draggable: false,
                   styleClasses: ["morph", "fa", "fa-check"],
                   center: pt(9,9),
                   fill: Color.white.withA(0),
                   extent: pt(18,18)}]});

    this.alignInHalo();
  }

  updateName(newName) {
    if (this.validName) {
      this.halo.target.name = newName;
      this.toggleActive(false);
    }
  }

  toggleActive(active) {
    if (active) {
      this.borderWidth = 3;
      this.halo.changingName = true;
      this.addMorph(this.validityIndicator);
      this.alignInHalo();
    } else {
      this.borderWidth = 0;
      this.halo.changingName = false;
      this.validityIndicator.remove();
      this.alignInHalo();
    }
  }

  toggleNameValid(valid) {
    this.validName = valid;
    if (valid) {
      this.borderColor = Color.green;
      this.validityIndicator.fontColor = Color.green;
      this.validityIndicator.get("validityIcon").styleClasses = ["fa", "fa-check"];
    } else {
      this.borderColor = Color.red;
      this.validityIndicator.fontColor = Color.red;
      this.validityIndicator.get("validityIcon").styleClasses = ["fa", "fa-exclamation-circle"];
    }
  }

  alignInHalo() {
    this.nameHolder.textString = this.halo.target.name;
    this.nameHolder.fit();
    var {x, y} = this.halo.innerBounds().bottomCenter().addPt(pt(0, 2));
    this.topCenter = pt(Math.max(x, 30), Math.max(y, 80));
  }

  onKeyDown(evt) {
    if ("Enter" == evt.keyCombo) {
      this.updateName(this.nameHolder.textString);
      evt.stop();
    }
  }

  onMouseDown() {
    this.toggleActive(true)
  }

  onKeyUp(evt) {
    const newName = this.nameHolder.textString,
          owner = this.halo.target.owner;
    this.toggleNameValid(!owner || !owner.getSubmorphNamed(newName) ||
                          this.halo.target.name == newName);
  }
}

class HaloPropertyDisplay extends Text {

  get defaultPosition() { return pt(0,-25); }

  constructor(halo) {
    super({
      name: "propertyDisplay",
      fill: Color.black.withA(0.5),
      borderRadius: 15,
      padding: 5,
      position: this.defaultPosition,
      visible: false,
      readOnly: true,
      fontSize: 12,
      fontColor: Color.white,
      halo
    });
  }

  get isHaloItem() { return true; }

  displayedValue() { return this.textString; }

  displayProperty(val) {
    val = String(val);
    this.visible = true;
    this.textString = val;
    var activeButton = this.halo.activeButton;
    if (activeButton &&
        activeButton.topLeft.x < (this.width + 10) &&
        activeButton.topLeft.y < 0) {
      this.position = pt(activeButton.topRight.x + 10, -25);
    } else {
      this.position = this.defaultPosition;
    }
  }

  disable() {
    this.position = this.defaultPosition;
    this.visible = false;
  }
}

export class Halo extends Morph {

  get isEpiMorph() { return true; }

  constructor(pointerId, target) {
    super({
      styleClasses: ["morph", "halo"],
      borderColor: Color.red,
      borderWidth: 2,
      fill: Color.transparent
    });
    this.state = {pointerId, target, draggedButton: null}
    this.initButtons();
    this.focus();
    this.alignWithTarget();
  }

  get isHalo() { return true }

  get target() { return this.state.target; }

  morphsContainingPoint(list) { return list }

  get propertyDisplay() {
    return this.getSubmorphNamed("propertyDisplay") || this.addMorph(new HaloPropertyDisplay(this));
  }

  refocus(newTarget) {
    var owner = this.owner;
    this.remove();
    this.state.target = newTarget;
    owner.addMorphAt(this, 0);
    this.alignWithTarget();
  }

  nameHalo() {
    return this.getSubmorphNamed("name") || this.addMorph(new NameHalo({halo: this, name: "name"}));
  }

  resizeHalo() {
    const halo = this;
    return this.getSubmorphNamed("resize") || this.addMorph(new HaloItem({
      name: "resize",
      styleClasses: ["halo-item", "fa", "fa-crop"],
      location: {col: 3, row: 3},
      origin: pt(12, 12),
      property: 'extent',
      halo: this,

      valueForPropertyDisplay: () => {
        var {x: width, y: height} = this.target.extent;
        return `${width.toFixed(1)}w ${height.toFixed(1)}h`;
      },

      update(delta, proportional=false) {
        delta = this.proportionalMode(proportional, delta);
        halo.target.resizeBy(delta.scaleBy(1 / halo.target.scale));
        halo.alignWithTarget();
      },

      init(proportional=false) {
        halo.target.undoStart("resize-halo");
        this.proportionalMode(proportional);
        halo.activeButton = this;
      },

      stop(proportional=false) {
        halo.target.undoStop("resize-halo");
        this.proportionalMode(false);
        halo.activeButton = null;
        halo.alignWithTarget();
      },

      adaptAppearance(proportional) {
        if (proportional) {
          this.styleClasses = ["halo-item", "fa", "fa-expand"];
          this.rotation = -Math.PI / 2;
        } else {
          this.styleClasses = ["halo-item", "fa", "fa-crop"];
          this.rotation = 0;
        }
      },

      onDragStart(evt) { this.init(evt.isShiftDown()) },
      onDrag(evt) { this.update(evt.state.dragDelta, evt.isShiftDown()) },
      onDragEnd(evt) { this.stop(evt.isShiftDown()) },

      onKeyDown(evt) {
        this.adaptAppearance(evt.isShiftDown());
      },

      onKeyUp(evt) {
        this.adaptAppearance(false);
      },

      proportionalMode(active, delta=null) {
        if (active) {
          const diagonal = halo.toggleDiagonal(true);
          if (delta) {
            delta = diagonal.scaleBy(
                      diagonal.dotProduct(delta) /
                      diagonal.dotProduct(diagonal));
          }
          return delta;
        } else {
          halo.toggleDiagonal(false);
          return delta;
        }
      }

    }));
  }

  closeHalo() {
    return this.getSubmorphNamed("close") || this.addMorph(new HaloItem({
      name: "close",
      styleClasses: ["halo-item", "fa", "fa-close"],
      location: {col: 3, row: 0},
      draggable: false,
      halo: this,
      update: () => {
        this.remove();
        var o = this.target.owner
        o.undoStart("close-halo");
        this.target.remove();
        o.undoStop("close-halo");
      },
      onMouseDown(evt) { this.update(); }
    }));
  }

  grabHalo() {
    var dropTarget;
    return this.getSubmorphNamed("grab") || this.addMorph(new HaloItem({
      name: "grab",
      styleClasses: ["halo-item", "fa", "fa-hand-rock-o"],
      location: {col: 1, row: 0},
      halo: this,
      valueForPropertyDisplay() {
        dropTarget = this.morphBeneath(this.hand.position);
        this.halo.toggleDropIndicator(dropTarget && dropTarget != this.world(), dropTarget);
        return dropTarget && dropTarget.name;
      },

      init(hand) {
        var undo = this.halo.target.undoStart("grab-halo");
        undo.addTarget(this.halo.target.owner);
        this.hand = hand;
        hand.grab(this.halo.target);
        this.halo.activeButton = this;
      },

      update() {
        this.halo.alignWithTarget();
      },

      stop(hand) {
        var undo = this.halo.target.undoInProgress,
            dropTarget = this.morphBeneath(hand.position);
        undo.addTarget(dropTarget);
        hand.dropMorphsOn(dropTarget);
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleDropIndicator(false, dropTarget);
        this.halo.target.undoStop("grab-halo");
      },

      onDragStart(evt) {
        this.init(evt.hand)
      },

      onDragEnd(evt) {
        this.stop(evt.hand)
      }
    }));
  }

  dragHalo() {
    return this.getSubmorphNamed("drag") || this.addMorph(new HaloItem({
      name: "drag",
      styleClasses: ["halo-item", "fa", "fa-arrows"],
      property: 'position',
      location: {col: 2, row: 0},
      halo: this,
      valueForPropertyDisplay: () => this.target.position,
      init() {
        this.halo.target.undoStart("drag-halo");
        this.halo.activeButton = this;
      },
      stop() {
        this.halo.target.undoStop("drag-halo");
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleMesh(false);
      },
      update: (delta, grid=false) => {
        var newPos = this.target.globalPosition.addPt(delta);
        if (grid) {
          newPos = newPos.griddedBy(pt(10,10));
        }
        this.target.globalPosition = newPos;
        this.alignWithTarget();
        this.toggleMesh(grid);
      },
      onDragStart(evt) { this.init() },
      onDrag(evt) { this.update(
                    this.halo.tranformMoveDeltaDependingOnHaloPosition(
                        evt, evt.state.dragDelta, "topRight"
                      ),
                    evt.isAltDown()); },
      onDragEnd(evt) { this.stop() },
      onKeyUp(evt) { this.halo.toggleMesh(false) }
    }));
  }

  inspectHalo() {
    return this.getSubmorphNamed("inspect") || this.addMorph(new HaloItem({
      name: "inspect",
      styleClasses: ["halo-item", "fa", "fa-eye"],
      draggable: false,
      location: {col: 3, row: 2},
      halo: this,
      onMouseDown: (evt) => {
        this.target.inspect();
      }
    }));
  }

  editHalo() {
    return this.getSubmorphNamed("edit") || this.addMorph(new HaloItem({
      name: "edit",
      styleClasses: ["halo-item", "fa", "fa-pencil"],
      draggable: false,
      location: {col: 3, row: 1},
      halo: this,
      onMouseDown: (evt) => {
        this.target.edit();
      }
    }));
  }

  rotateHalo() {
    var angle = 0,
        scaleGauge = null,
        initRotation = 0;

    return this.getSubmorphNamed("rotate") || this.addMorph(new HaloItem({
      name: "rotate",
      property: "rotation",
      styleClasses: ["halo-item", "fa", "fa-repeat"],
      location: {col: 0, row: 3},
      halo: this,
      valueForPropertyDisplay: () => scaleGauge ?
                                       this.target.scale.toFixed(4).toString() :
                                       num.toDegrees(this.target.rotation).toFixed(1) + "°",

      init(angleToTarget) {
        this.halo.target.undoStart("rotate-halo");
        this.halo.activeButton = this;
        angle = angleToTarget;
        initRotation = this.halo.target.rotation;
        this.halo.toggleRotationIndicator(true, this);
      },

      initScale(gauge) {
        this.halo.activeButton = this;
        scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
        this.halo.toggleRotationIndicator(true, this);
      },

      update(angleToTarget) {
        scaleGauge = null;
        var newRotation = initRotation + (angleToTarget - angle);
        newRotation = num.toRadians(num.detent(num.toDegrees(newRotation), 10, 45))
        this.halo.target.rotation = newRotation;
        this.halo.alignWithTarget(this);
        this.halo.toggleRotationIndicator(true, this);
      },

      updateScale(gauge) {
        if (!scaleGauge) scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
        angle = gauge.theta();
        initRotation = this.halo.target.rotation;
        this.halo.target.scale = num.detent(gauge.dist(pt(0,0)) / scaleGauge.dist(pt(0,0)), 0.1, 0.5);
        this.halo.alignWithTarget(this);
        this.halo.toggleRotationIndicator(true, this);
      },

      stop() {
        scaleGauge = null;
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleRotationIndicator(false, this);
        this.halo.target.undoStop("rotate-halo");
      },

      adaptAppearance(scaling) {
        this.styleClasses = ["halo-item", "fa", scaling ? "fa-search-plus" : "fa-repeat"];
      },

      // events
      onDragStart(evt) {
        this.adaptAppearance(evt.isShiftDown());
        if (evt.isShiftDown()) {
          this.initScale(evt.position.subPt(this.halo.target.globalPosition));
        } else {
          this.init(evt.position.subPt(this.halo.target.globalPosition).theta());
        }
      },

      onDrag(evt) {
        this.globalPosition = evt.position.addPt(pt(-10,-10));
        this.adaptAppearance(evt.isShiftDown());
        if (evt.isShiftDown()) {
          this.updateScale(evt.position.subPt(this.halo.target.globalPosition));
        } else {
          this.update(evt.position.subPt(this.halo.target.globalPosition).theta());
        }
      },

      onDragEnd(evt) {
        this.adaptAppearance(evt.isShiftDown());
        this.stop();
      },

      onKeyDown(evt) {
        this.adaptAppearance(evt.isShiftDown());
      },

      onKeyUp(evt) {
        this.adaptAppearance(evt.isShiftDown());
      }

    }));
  }

  copyHalo() {
    return this.getSubmorphNamed("copy") || this.addMorph(new HaloItem({
      name: "copy",
      styleClasses: ["halo-item", "fa", "fa-clone"],
      location: {col: 0, row: 1},
      halo: this,
      init: (hand) => {
        var pos = this.target.globalPosition,
            copy = this.target.copy();
        copy.undoStart("copy-halo");
        hand.grab(copy);
        copy.globalPosition = pos;
        this.refocus(copy);
      },
      update(hand) {
        var dropTarget = this.morphBeneath(hand.position),
            undo = this.halo.target.undoInProgress;
        undo.addTarget(dropTarget);
        hand.dropMorphsOn(dropTarget);
        this.halo.target.undoStop("copy-halo");
        this.halo.alignWithTarget();
      },
      onDragStart(evt) {
        this.init(evt.hand)
      },
      onDragEnd(evt) {
        this.update(evt.hand);
      }
    }));
  }

  originHalo() {
    return this.getSubmorphNamed("origin") || this.addMorph(new HaloItem({
      name: "origin", fill: Color.red,
      opacity: 0.5, borderColor: Color.black,
      borderWidth: 2,
      position: this.target.origin.subPt(pt(7.5,7.5)),
      extent: pt(15,15),
      halo: this,
      computePositionAtTarget: () => {
          return this.localizePointFrom(pt(0,0),this.target)
                     .subPt(pt(7.5,7.5));
      },
      alignInHalo() {
        this.position = this.computePositionAtTarget();
      },
      valueForPropertyDisplay: () => this.target.origin,
      init() {
        this.halo.target.undoStart("origin-halo");
        this.halo.activeButton = this;
      },
      stop() {
        this.halo.target.undoStop("origin-halo");
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      update: (delta) => {
        var oldOrigin = this.target.origin,
            globalOrigin = this.target.worldPoint(oldOrigin),
            newOrigin = this.target.localize(globalOrigin.addPt(delta));
        delta = newOrigin.subPt(oldOrigin);
        this.target.adjustOrigin(this.target.origin.addPt(delta));
        this.alignWithTarget();
      },
      onDragStart(evt) { this.init(); },
      onDragEnd(evt) { this.stop(); },
      onDrag(evt) { this.update(evt.state.dragDelta); }
    }));;
  }

  stylizeHalo() {
    return this.getSubmorphNamed("style") || this.addMorph(new HaloItem({
      name: "style",
      styleClasses: ["halo-item", "fa", "fa-picture-o"],
      location: {col: 0, row: 2},
      halo: this,
      onMouseDown: (evt) => {
        this.world().showLayoutHaloFor(this.target, this.state.pointerId);
        this.remove();
      }
    }));
  }

  initButtons() {
    this.buttonControls = [
      this.originHalo(),
      this.resizeHalo(),
      this.closeHalo(),
      this.dragHalo(),
      this.grabHalo(),
      this.inspectHalo(),
      this.editHalo(),
      this.copyHalo(),
      this.rotateHalo(),
      this.stylizeHalo(),
      this.nameHalo()
    ];
  }

  updatePropertyDisplay(haloItem) {
    var val = haloItem.valueForPropertyDisplay();
    if (typeof val !== "undefined")
      this.propertyDisplay.displayProperty(val);
    else
      this.propertyDisplay.disable();
  }

  onKeyUp(evt) {
    if (this.changingName) return;
    this.buttonControls.map(b => b.onKeyUp(evt));
  }

  onKeyDown(evt) {
    var offsets = {
      "Up":          pt(0,-1),
      "Shift-Up":    pt(0,-1),
      "Down":        pt(0,1),
      "Shift-Down":  pt(0,1),
      "Left":        pt(-1, 0),
      "Shift-Left":  pt(-1, 0),
      "Right":       pt(1, 0),
      "Shift-Right": pt(1, 0),
    }, delta;
    if (this.changingName) return;
    if (delta = offsets[evt.keyCombo]) {
      evt.stop();
      if (evt.isShiftDown()) {
        this.target.resizeBy(delta);
      } else {
        this.target.moveBy(delta);
      }
      this.alignWithTarget();
    } else {
      this.buttonControls.map(b => b.onKeyDown(evt));
    }
  }

  tranformMoveDeltaDependingOnHaloPosition(evt, moveDelta, cornerName) {
    // Griding and rounding might move the morph differently
    // so we have to recalculate the delta...
    if(!evt.isAltDown())
        return moveDelta

    var pos = this.target.bounds()[cornerName]()
    var newOffset = evt.position.subPt(this.target.owner.worldPoint(pos))
    this.startOffset = this.startOffset || newOffset;

    var deltaOffset = newOffset.subPt(this.startOffset)

    moveDelta = moveDelta.addPt(deltaOffset);
    return moveDelta
 }

  toggleMesh(active) {
    var mesh = this.getSubmorphNamed("mesh"),
        horizontal = this.getSubmorphNamed("horizontal"),
        vertical = this.getSubmorphNamed("vertical");
    if (active) {
        const position = this.localize(pt(0,0)),
              {width, height, extent} = this.world(),
              defaultGuideProps = {
                     styleClasses: ["morph", "halo-guide"],
                     borderStyle: "dashed",
                     position, extent,
                     borderWidth: 2,
                     gradient: guideGradient},
               {x, y} = this.target.worldPoint(pt(0,0));
        // init
         vertical = vertical || this.addMorphBack(
           new Path({
             ...defaultGuideProps,
             name: "vertical",
             vertices: [pt(x,0), pt(x, height)]
           }));
         horizontal = horizontal || this.addMorphBack(
           new Path({
             ...defaultGuideProps,
             name: "horizontal",
             vertices: [pt(0,y), pt(width, y)]
           }));
         mesh = mesh || this.addMorphBack(
           new Morph({name: "mesh",
                      onKeyUp: (evt) => this.toggleMesh(false),
                      extent, position: this.localize(pt(2,2)),
                      styleClasses: ["morph", "halo-mesh"], fill: null}));
        // update
        horizontal.position = position;
        vertical.position = position;
        mesh.position = this.localize(pt(2,2));
        horizontal.vertices = [pt(0,y), pt(this.world().width, y)];
        vertical.vertices = [pt(x,0), pt(x, this.world().height)];
    } else {
      vertical && vertical.remove();
      horizontal && horizontal.remove();
      mesh && mesh.remove();
    }
    this.focus();
  }

  toggleDiagonal(active) {
    var diagonal = this.getSubmorphNamed("diagonal");
    if (active) {
      var offset = this.extent.normalized().scaleByPt(pt(100,100));
      diagonal = diagonal || this.addMorphBack(new Path({
          name: "diagonal",
          styleClasses: ["morph", "halo-guide"],
          borderStyle: "dashed",
          borderWidth: 2,
          gradient: guideGradient,
          position: offset.negated(),
          extent: this.extent.addPt(offset.scaleBy(2)),
          vertices: [pt(0,0), this.extent.addPt(offset.scaleBy(2))]}));
        diagonal.setBounds(diagonal.position.extent(this.extent.addPt(diagonal.position.scaleBy(-2))))
        return diagonal.vertices[1];
    } else {
      diagonal && diagonal.remove();
    }
  }

  toggleRotationIndicator(active, haloItem) {
    var rotationIndicator = this.getSubmorphNamed("rotationIndicator");
    if (!active || !haloItem) {
      rotationIndicator && rotationIndicator.remove();
      return;
    }

    const originPos = this.getSubmorphNamed("origin").center,
          localize = (p) => rotationIndicator.localizePointFrom(p, this);
    rotationIndicator = rotationIndicator || this.addMorphBack(new Path({
      styleClasses: ["morph", "halo-guide"],
      name: "rotationIndicator",
      borderColor: Color.red,
      vertices: []
    }));
    rotationIndicator.setBounds(haloItem.bounds().union(this.innerBounds()));
    rotationIndicator.vertices = [localize(originPos), localize(haloItem.center)];
  }

  toggleDropIndicator(active, target) {
    var dropIndicator = this.getSubmorphNamed("dropTargetIndicator");
    if (active && target && target != this.world()) {
        dropIndicator = dropIndicator || this.addMorphBack({
                        styleClasses: ["morph", "halo-guide"],
                        name: "dropTargetIndicator",
                        fill: Color.orange.withA(0.5)});
        dropIndicator.position = this.localize(target.globalBounds().topLeft());
        dropIndicator.extent = target.globalBounds().extent();
    } else {
      dropIndicator && dropIndicator.remove();
    }
  }

  alignWithTarget(skip) {
    const {x, y, width, height} = this.target.globalBounds(),
          origin = this.target.origin;
    this.setBounds(rect(x,y, width, height));
    if (this.activeButton) {
      this.buttonControls.forEach(ea => ea.visible = false);
      this.activeButton.visible = true;
      this.updatePropertyDisplay(this.activeButton);
      if (skip != this.activeButton) this.activeButton.alignInHalo();
    } else {
      if (this.changingName) this.nameHalo().toggleActive(false);
      this.buttonControls.forEach(b => { b.visible = true; b.alignInHalo(); });
      this.propertyDisplay.disable();
    }
    this.originHalo().alignInHalo();
    return this;
  }

}
