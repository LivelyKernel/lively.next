import { Ellipse, Morph, Path, Text, 
         HorizontalLayout, GridLayout, 
         VerticalLayout, morph, Menu } from "../index.js";
import { Color, pt, rect, Line, Rectangle } from "lively.graphics";
import { string, obj, arr, num, grid } from "lively.lang";
import { CheckBox, ValueScrubber} from "../widgets.js";
import { connect } from "lively.bindings";

class AxisHalo extends Morph {
  
  constructor({halo, targetAxis}) {
    this.targetAxis = targetAxis;
    this.container = halo.container;
    this.halo = halo;
    
    super({fill: Color.transparent,
           bounds: this.fetchBounds()});
           
    this.minSlider = this.minSlider(),
    this.axisMenu = this.axisMenu(),
    this.proportionSlider = this.proportionSlider();
    this.proportionSlider.addMorph(this.minSlider);
    this.submorphs = [this.proportionSlider, this.axisMenu];
    
    this.halo.addGuide(this);
  }
  
  // replace by constraint: if minSlider dragging, and mouse inside halo, hide menu
  
  set forceMenuHidden(hidden) { 
    this._forceMenuHidden = hidden; 
    this.axisMenu.visible = !hidden;
  }
  
  get forceMenuHidden() { return this._forceMenuHidden }
  
  get lastAxis() { return !this.targetAxis.after }
  
  fetchBounds() { return this.fetchPosition().extent(this.fetchExtent()) }
  
  alignWithTarget() {
    this.extent = this.fetchExtent();
    this.position = this.fetchPosition();
    this.proportionSlider.alignWithTarget();
    this.axisMenu.alignWithTarget();
  }
  
  // if mouse inside halo, show menu
  
  onHoverIn() {
    this.minSlider.requestToShow();
    this.axisMenu.visible = !this.forceMenuHidden && true;
  }
  
  onHoverOut(evt) {
    this.minSlider.requestToHide(); 
    this.axisMenu.visible = this.forceMenuVisible || false;
  }
  
  proportionSlider() {
    var self = this,
        proportionViewer = this.proportionViewer();

    return this.halo.addGuide(new Morph({
            nativeCursor: this.getResizeCursor(),
            fill: Color.transparent,
            submorphs: [this.devider(), proportionViewer],
            alignWithTarget() {
              this.setBounds(self.getProportionSliderBounds(this));
            },
            onDragStart() {
              proportionViewer.visible = true;  
            },
            onDrag: (evt) => {
                this.targetAxis.adjustStretch(this.getDelta(evt)); 
                self.halo.alignWithTarget();
            },
            onDragEnd() {
                proportionViewer.visible = false;
            }
        }));
  }
  
  devider() {
    return new Morph({
        visible: !this.lastAxis,
        fill: Color.black.withA(0.5),
        bounds: this.getDeviderBounds(),
        draggable: false,
        reactsToPointer: false
    });
  }
  
  minSlider() {
    const self = this,
          minSpaceVisualizer = this.minSpaceVisualizer(),
          minViewer = this.minViewer();
    
    return this.halo.addGuide(new Ellipse({
            nativeCursor: this.getResizeCursor(),
            fill: Color.green,
            extent: pt(10,10),
            visible: false,
            submorphs: [minSpaceVisualizer, minViewer],
            becomesActiveOnHover: true,
            alignWithTarget() {
              this.position = self.getMinSliderPosition();
            },
            requestToShow() {
              this.visible = !self.targetAxis.fixed;
            },
            requestToHide() {
              if (this.active) {
                  this.shouldHide = true;
              } else {
                  this.visible = false;
              }
            },
            onDragStart() {
              self.forceMenuHidden = true;
              minViewer.visible = true;
              minSpaceVisualizer.visible = true;
              this.active = true;
            },
            onDrag: (evt) => { 
              this.targetAxis.adjustMin(-this.getDelta(evt));
              this.halo.alignWithTarget();
            },
            onDragEnd() {
              self.forceMenuHidden = false;
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
  
  minViewer() {
    const gridLayout = this.target, 
          self = this;
    return this.viewer({
        position: this.getMinViewerPosition(), 
        alignWithTarget() {
            const {min} = self.targetAxis;
            this.textString = `min: ${min.toFixed()}px !`; 
        }
    });
  }
  
  minSpaceBorder() {
    return new Path({
      position: pt(-1,-1),
      borderStyle: "dashed",
      borderColor: Color.green,
      borderWidth: 2,
      ...this.getMinSpaceBorder()
    });
  }
  
  minSpaceVisualizer() {
    const self = this,
          minSpaceBorder = this.minSpaceBorder();
    return this.halo.addGuide(new Morph({
            fill: Color.green.withA(0.1),
            visible: false,
            isHaloItem: true,
            submorphs: [minSpaceBorder],
            alignWithTarget() {
                this.extent = self.getMinSpaceExtent();
                this.topLeft = pt(5,5);
            }
          }))
  }
  
  axisMenu() {
    const lockButton = this.lockButton(),
          menuButton = this.menuButton(),
          self = this;
    return new Morph({
      layout: this.getMenuLayout(),
      submorphs: [lockButton, menuButton],
      fill: Color.transparent,
      visible: false,
      becomesActiveOnHover: true,
      alignWithTarget() { this.bottomRight = this.owner.extent.subPt(self.getMenuOffset(this)) }
    });
  }
  
  lockButton() {
    const self = this;
    return this.halo.addGuide(new Morph({
          fill: Color.transparent,
          extent: pt(25,25),
          submorphs: [{center: pt(12.5, 12.5), 
                      fill: Color.transparent,
                      styleClasses: ["morph", "fa", "fa-unlock"]}],
          alignWithTarget() {
            if (self.targetAxis.fixed) {
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
            self.targetAxis.fixed = !self.targetAxis.fixed;
            self.halo.alignWithTarget();
          }
        }));
  }
  
  menuButton() {
    const self = this,
          remove = () => {
            this.targetAxis.remove();
            this.halo.initGuides();
            this.halo.alignWithTarget();
          },
          addBefore = () => {
            this.targetAxis.addBefore()
            this.halo.initGuides();
            this.halo.alignWithTarget();
          },
          addAfter = () => {
            this.targetAxis.addAfter();
            this.halo.initGuides();
            this.halo.alignWithTarget();
          }
    return new Morph({
            fill: Color.transparent,
            extent: pt(25,25),
            submorphs: [{fill: Color.transparent,
                         styleClasses: ["morph", "fa", "fa-cog"], 
                         center: pt(12.5,12.5)}],
            onMouseDown(evt) {
              // is menu open keep menu visible at all times
              // only hide menu when menu was removed
              self.forceMenuVisible = true;
              this.addMorph(evt.state.menu = new Menu({
                  position: pt(15,15),
                  items: [
                    [`Remove ${self.subject}`, () => remove() ],
                    [`Insert ${self.subject} before`, () => addBefore() ],
                    [`Insert ${self.subject} after`, () => addAfter() ]]
              }));
            }
          });
  }
  
  viewer({position, alignWithTarget}) {
    return this.halo.addGuide(new Text({
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
  
  proportionViewer() {
    const self = this;
    return this.viewer({
        position: this.getProportionViewerPosition(),
        alignWithTarget() {
            const {length} = self.targetAxis;
            this.textString = `${length.toFixed(1)}px`; 
        }
    });
  }
}

class RowHalo extends AxisHalo {
  
  constructor({row, halo}) {
    super({targetAxis: halo.target.row(row), halo});
  }
  
  get subject() { return "row" }
  
  getDelta(evt) { return evt.state.dragDelta.y }
  
  axisOffset() { return this.targetAxis.origin.position.y }
  
  fetchPosition() { return pt(-45, this.axisOffset() + 10); }
  fetchExtent() { return pt(40, this.targetAxis.length - 10); }
  
  getMenuOffset(menu) { return this.targetAxis.length > menu.height ? pt(2, 5) : pt(26, 10); }
  getMenuLayout() { return new VerticalLayout() }
  
  getResizeCursor() { return "row-resize" }
  
  getMinViewerPosition() { return pt(50, 20)}
  getMinSliderPosition() { return pt(0, -this.targetAxis.min) }
  getMinSpaceExtent() { return  pt(this.container.width + 45, this.targetAxis.min) }
  getMinSpaceBorder() { 
    return {
      extent: pt(this.container.width + 50, 2),
      vertices: [pt(0,1), pt(this.container.width + 50, 1)]
    }
  }
  
  getProportionViewerPosition() { return pt(40, 20) }
  getProportionSliderBounds(slider) { return pt(0, slider.owner.height - 5).extent(pt(40, 10)) }
  
  getDeviderBounds() { return pt(15, 4).extent(pt(25, 2)) }
}

class ColumnHalo extends AxisHalo {
  
  constructor({col, halo}) {
    super({targetAxis: halo.target.col(col), halo});
  }
  
  get subject() { return "column" }
  
  getDelta(evt) { return evt.state.dragDelta.x }
  
  axisOffset() { return this.targetAxis.origin.position.x }
  
  fetchPosition() { return pt(this.axisOffset() + 10, -45); }
  fetchExtent() { return pt(this.targetAxis.length - 10, 40); }
  
  getMenuOffset(menu) { return this.targetAxis.length > menu.width ? pt(5, 3) : pt(8, 26); }
  getMenuLayout() { return new HorizontalLayout() }
  
  getResizeCursor() { return "col-resize" }
  
  getMinViewerPosition() { return pt(20, 50) }
  getMinSliderPosition() { return pt(-this.targetAxis.min, 0) }
  getMinSpaceExtent() { return pt(this.targetAxis.min, this.container.height + 45) }
  getMinSpaceBorder() { 
    return {
      extent: pt(2, this.container.height + 50),
      vertices: [pt(1,0), pt(1, this.container.height + 50)]
    }
  }
  
  getProportionViewerPosition() { return pt(20, 40); }
  getProportionSliderBounds(slider) { return pt(slider.owner.width - 5, 0).extent(pt(10, 40));}
  
  getDeviderBounds() { return pt(4,15).extent(pt(2, 25)) }
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

  optionControls() {
      const layout = this.target,
            compensateOrigin = new CheckBox({
                name: "compensateOrigin", 
                checked: layout.compensateOrigin}),
            fitToCell = new CheckBox({
                name: "fitToCell", checked: layout.fitToCell});
      connect(compensateOrigin, "toggle", layout, "compensateOrigin");
      connect(fitToCell, "toggle", layout, "fitToCell");
      connect(compensateOrigin, "toggle", this, "alignWithTarget");
      return [[{type: "text", textString: "Compensate Origin", 
               padding: rect(5,0,10,10), fill: Color.transparent,
               fontColor: Color.gray.darker(),
               readOnly: true}, compensateOrigin],
               [{type: "text", textString: "Fit morphs to cell", 
               padding: rect(5,0,10,10), fill: Color.transparent,
               fontColor: Color.gray.darker(),
               readOnly: true}, fitToCell]]
              .map(x => { return {submorphs: x, fill: Color.transparent, 
                                  layout: new HorizontalLayout()}})
  }

  get isLayoutHalo() { return false }

  get container() { return this.state.container; }
  get target() { return this.state.target; }

  alignWithTarget() {
    this.target.apply();
    this.position = this.container.globalPosition;
    if (this.target.compensateOrigin) this.moveBy(this.container.origin.negated())
    this.extent = this.container.extent;
    this.addMissingGuides();
    arr.reverse(this.guides).forEach(guide => guide.alignWithTarget());
  }
  
  addMissingGuides() {
    arr.withoutAll(this.target.cellGroups, 
                   this.guides.map(g => g.cellGroup))
       .forEach(group => this.addMorph(this.cellGuide(group)));
  }

  initGuides() {
    this.submorphs = [];
    this.guides = [];
    this.initCellGuides();
    this.initColumnGuides();
    this.initRowGuides();
  }
  
  get cells() {
    return arr.flatten(this.target.col(0).items.map(c => c.row(0).items))
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
        this.addMorph(new RowHalo({row, halo: this}));
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
        this.addMorph(new ColumnHalo({col, halo: this}));
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
        cellGroup.disconnect(cell);
        self.alignWithTarget();
      },
      addCell(cell) {
        cellGroup.connect(cell);
        self.alignWithTarget();
      },
      start() {
        this.fixpointCell = cellGroup[adjacentCorner];
        this.draggedDelta = getCorner(corner)
        this.debugMorph = self.addMorph(new Morph({fill: Color.orange.withA(0.5)}));
      },
      update(delta) {
        this.draggedDelta =  this.draggedDelta.addPt(delta);
        const coveringRect = Rectangle.unionPts([this.draggedDelta]).union(this.fixpointCell.bounds());
        this.debugMorph.setBounds(coveringRect);
        self.cells.forEach(cell => {
                    const coverage = coveringRect.intersection(cell.bounds()).area() / cell.bounds().area();
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
      cellGroup,
      bounds: cellGroup.bounds(),
      fill: Color.transparent,
      borderColor: Color.orange,
      borderWidth: 1,
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
      onDrop(evt) {
        const [m] = evt.hand.grabbedMorphs; // pick the first of the grabbed submorphs
        evt.hand.dropMorphsOn(self.container);
        cellGroup.morph = m;
      },
      alignWithTarget() {
        const bounds = cellGroup.bounds();
        if (bounds.isNonEmpty()) {
          this.setBounds(cellGroup.bounds());
          topLeft.center = this.innerBounds().topLeft();
          bottomRight.center = this.innerBounds().bottomRight();
        } else {
          arr.remove(self.guides, this);
          this.remove();
        }
      }
    }));
  }
}

export class TilingLayoutHalo extends Morph {

}

export class FlexLayoutHalo extends Morph {

    constructor(container, pointerId) {
    super({
      styleClasses: ["morph", "halo"],
      extent: container.extent,
      fill: Color.transparent
    });
    this.state = {container, pointerId, target: container.layout}
    this.alignWithTarget();
  }

  onDrop(evt) {
    this.world().logError("drop in container")
    evt.hand.dropMorphsOn(this.container);
  }

  alignWithTarget() { 
       this.setBounds(this.container.globalBounds());
  };

  get target() { return this.state.target }
  get container() { return this.state.container }

  updateResizePolicy(auto) {
      if (auto) this.originalExtent = this.container.extent;
      this.target.autoResize = auto;
      if (!auto) this.container.extent = this.originalExtent;
      this.alignWithTarget()
  }

  optionControls() {
      const layout = this.target,
            spacing = new ValueScrubber({
                name: "spacing", value: layout.spacing}),
            autoResize = new CheckBox({
                name: "autoResize", checked: layout.autoResize});
      connect(spacing, "scrub", layout, "spacing");
      connect(autoResize, "toggle", this, "updateResizePolicy");      
      return [[{type: "text", textString: "Resize Container", 
               padding: rect(5,0,10,10), fill: Color.transparent,
               fontColor: Color.gray.darker(),
               readOnly: true}, autoResize],
               [{type: "text", textString: "Submorph Spacing", 
               padding: rect(5,0,10,10), fill: Color.transparent,
               fontColor: Color.gray.darker(),
               readOnly: true}, spacing]]
              .map(x => { return {submorphs: x, fill: Color.transparent, 
                                  layout: new HorizontalLayout()}})
  }

}