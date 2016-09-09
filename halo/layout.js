import { Ellipse, Morph, Path, Text, 
         HorizontalLayout, GridLayout, 
         VerticalLayout, morph, Menu } from "../index.js";
import { Color, pt, rect, Line, Rectangle } from "lively.graphics";
import { string, obj, arr, num, grid } from "lively.lang";

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
    
    this.target.cellGroups.forEach(group => {
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
        //self.target.clear(cell)
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

export class FlexLayoutHalo extends Morph {


  inspectHorizontalLayout() {

  }

  inspectVerticalLayout() {
    this.inspectHorizontalLayout();
  }

  inspectTilingLayout() {

  }

}