import {
  Ellipse, Icon,
  Morph,
  Path,
  Text,
  part
} from 'lively.morphic';
import { Color, pt, Rectangle } from 'lively.graphics';
import { arr } from 'lively.lang';
import { connect } from 'lively.bindings';
import { LabeledCheckbox } from 'lively.components';
import { Menu } from 'lively.components/menus.js';

class ProportionSlider extends Morph {
  static get properties () {
    return {
      axis: {},
      view: {},
      fill: { defaultValue: Color.transparent }
    };
  }

  alignWithTarget () {
    this.setBounds(this.axis.getProportionSliderBounds(this));
  }

  onDragStart () {
    this.view.visible = true;
  }

  onDrag (evt) {
    this.axis.adjustStretch(this.axis.getDelta(evt));
    this.axis.halo.alignWithTarget();
  }

  onDragEnd () {
    this.view.visible = false;
  }
}

class MinViewer extends Morph {
  static get properties () {
    return {
      axis: {}
    };
  }

  alignWithTarget () {
    const { min } = this.axis.targetAxis;
    this.textString = `min: ${min.toFixed()}px !`;
  }
}

class MinSlider extends Ellipse {
  static get properties () {
    return {
      axis: {},
      fill: { defaultValue: Color.green },
      visible: { defaultValue: false },
      becomesActiveOnHover: { defaultValue: true }
    };
  }

  alignWithTarget () {
    this.position = this.axis.getMinSliderPosition();
  }

  requestToShow () {
    this.visible = !this.axis.targetAxis.fixed;
  }

  requestToHide () {
    if (this.active) {
      this.shouldHide = true;
    } else {
      this.visible = false;
    }
  }

  onDragStart () {
    const [minViewer, minSpaceVisualizer] = this.submorphs;
    this.axis.forceMenuHidden = true;
    minViewer.visible = true;
    minSpaceVisualizer.visible = true;
    this.active = true;
  }

  onDrag (evt) {
    this.axis.targetAxis.min += -this.getDelta(evt);
    this.axis.halo.alignWithTarget();
  }

  onDragEnd () {
    const [minViewer, minSpaceVisualizer] = this.submorphs;
    this.axis.forceMenuHidden = false;
    minViewer.visible = false;
    minSpaceVisualizer.visible = false;
    this.active = false;
    if (this.shouldHide) {
      this.visible = false;
      this.shouldHide = false;
    }
  }
}

class AxisHalo extends Morph {
  static get properties () {
    return {
      halo: {},
      targetAxis: {},
      container: {},
      fill: { defaultValue: Color.transparent },
      submorphs: {
        initialize () {
          this.initialize();
        }
      }
    };
  }

  initialize () {
    this.setBounds(this.fetchBounds());
    const minSlider = this.minSlider();
    const axisMenu = this.axisMenu();
    const proportionSlider = this.proportionSlider();
    proportionSlider.addMorph(minSlider);
    this.submorphs = [proportionSlider, axisMenu];
    this.halo.addGuide(this);
  }

  // replace by constraint: if minSlider dragging, and mouse inside halo, hide menu

  set forceMenuHidden (hidden) {
    this._forceMenuHidden = hidden;
    this.axisMenu.visible = !hidden;
  }

  get forceMenuHidden () { return this._forceMenuHidden; }

  get lastAxis () { return !this.targetAxis.after; }

  fetchBounds () { return this.fetchPosition().extent(this.fetchExtent()); }

  alignWithTarget () {
    this.extent = this.fetchExtent();
    this.position = this.fetchPosition();
    this.proportionSlider.alignWithTarget();
    this.axisMenu.alignWithTarget();
  }

  // if mouse inside halo, show menu

  onHoverIn () {
    this.minSlider.requestToShow();
    this.axisMenu.visible = !this.forceMenuHidden && true;
  }

  onHoverOut (evt) {
    this.minSlider.requestToHide();
    this.axisMenu.visible = this.forceMenuVisible || false;
  }

  proportionSlider () {
    let proportionViewer = this.proportionViewer();

    return this.halo.addGuide(new ProportionSlider({
      nativeCursor: this.getResizeCursor(),
      axis: this,
      view: proportionViewer,
      submorphs: [this.devider(), proportionViewer]
    }));
  }

  devider () {
    return new Morph({
      visible: !this.lastAxis,
      fill: Color.black.withA(0.5),
      bounds: this.getDeviderBounds(),
      draggable: false,
      reactsToPointer: false
    });
  }

  minSlider () {
    const minSpaceVisualizer = this.minSpaceVisualizer();
    const minViewer = this.minViewer();

    return this.halo.addGuide(new MinSlider({
      nativeCursor: this.getResizeCursor(),
      axis: this,
      submorphs: [minSpaceVisualizer, minViewer]
    }));
  }

  minViewer () {
    return this.viewer(new MinViewer({
      axis: this,
      position: this.getMinViewerPosition()
    }));
  }

  minSpaceBorder () {
    return new Path({
      position: pt(-1, -1),
      borderStyle: 'dashed',
      borderColor: Color.green,
      borderWidth: 2,
      ...this.getMinSpaceBorder()
    });
  }

  minSpaceVisualizer () {
    const self = this;
    const minSpaceBorder = this.minSpaceBorder();
    return this.halo.addGuide(new Morph({
      fill: Color.green.withA(0.1),
      visible: false,
      isHaloItem: true,
      submorphs: [minSpaceBorder],
      alignWithTarget () {
        this.extent = self.getMinSpaceExtent();
        this.topLeft = pt(5, 5);
      }
    }));
  }

  axisMenu () {
    const lockButton = this.lockButton();
    const menuButton = this.menuButton();
    const self = this;
    return new Morph({
      layout: this.getMenuLayout(),
      submorphs: [lockButton, menuButton],
      fill: Color.transparent,
      visible: false,
      becomesActiveOnHover: true,
      alignWithTarget () { this.bottomRight = this.owner.extent.subPt(self.getMenuOffset(this)); }
    });
  }

  lockButton () {
    const self = this;
    return this.halo.addGuide(new Morph({
      fill: Color.transparent,
      extent: pt(25, 25),
      submorphs: [{
        center: pt(12.5, 12.5),
        fill: Color.transparent,
        styleClasses: ['fa', 'fa-unlock']
      }],
      alignWithTarget () {
        if (self.targetAxis.fixed) {
          this.fontColor = Color.red;
          this.submorphs[0].styleClasses = ['fa', 'fa-lock'];
        } else {
          this.fontColor = Color.green;
          this.submorphs[0].styleClasses = ['fa', 'fa-unlock'];
        }
      },
      onMouseDown () {
        this.toggleLock();
      },
      toggleLock () {
        self.targetAxis.fixed = !self.targetAxis.fixed;
        self.halo.alignWithTarget();
      }
    }));
  }

  menuButton () {
    const self = this;
    const remove = () => {
      this.targetAxis.remove();
      this.halo.initGuides();
      this.halo.alignWithTarget();
    };
    const addBefore = () => {
      this.targetAxis.addBefore();
      this.halo.initGuides();
      this.halo.alignWithTarget();
    };
    const addAfter = () => {
      this.targetAxis.addAfter();
      this.halo.initGuides();
      this.halo.alignWithTarget();
    };
    return new Morph({
      fill: Color.transparent,
      extent: pt(25, 25),
      submorphs: [{
        fill: Color.transparent,
        styleClasses: ['fa', 'fa-cog'],
        center: pt(12.5, 12.5)
      }],
      onMouseDown (evt) {
        // is menu open keep menu visible at all times
        // only hide menu when menu was removed
        self.forceMenuVisible = true;
        this.addMorph(evt.state.menu = new Menu({
          position: pt(15, 15),
          items: [
            [`Remove ${self.subject}`, () => remove()],
            [`Insert ${self.subject} before`, () => addBefore()],
            [`Insert ${self.subject} after`, () => addAfter()]]
        }));
      }
    });
  }

  viewer ({ position, alignWithTarget }) {
    return this.halo.addGuide(new Text({
      styleClasses: ['Halo'],
      padding: Rectangle.inset(6),
      visible: false,
      borderRadius: 10,
      fontColor: Color.white,
      fill: Color.black.withA(0.5),
      position,
      alignWithTarget,
      readOnly: true
    }));
  }

  proportionViewer () {
    const self = this;
    return this.viewer({
      position: this.getProportionViewerPosition(),
      alignWithTarget () {
        const { length } = self.targetAxis;
        this.textString = `${length.toFixed(1)}px`;
      }
    });
  }
}

class RowHalo extends AxisHalo {
  static get properties () {
    return {
      row: {},
      targetAxis: {
        derived: true,
        get () {
          return this.halo.target.row(this.row);
        }
      }
    };
  }

  get subject () { return 'row'; }

  adjustStretch (delta) {
    this.targetAxis.height += delta;
  }

  getDelta (evt) { return evt.state.dragDelta.y; }

  axisOffset () { return this.targetAxis.origin.position.y; }

  fetchPosition () { return pt(-45, this.axisOffset() + 10); }
  fetchExtent () { return pt(40, this.targetAxis.length - 10); }

  getMenuOffset (menu) { return this.targetAxis.length > menu.height ? pt(2, 5) : pt(26, 10); }
  getMenuLayout () { return new VerticalLayout(); }

  getResizeCursor () { return 'row-resize'; }

  getMinViewerPosition () { return pt(50, 20); }
  getMinSliderPosition () { return pt(0, -this.targetAxis.min); }
  getMinSpaceExtent () { return pt(this.container.width + 45, this.targetAxis.min); }
  getMinSpaceBorder () {
    return {
      extent: pt(this.container.width + 50, 2),
      vertices: [pt(0, 1), pt(this.container.width + 50, 1)]
    };
  }

  getProportionViewerPosition () { return pt(40, 20); }
  getProportionSliderBounds (slider) { return pt(0, slider.owner.height - 5).extent(pt(40, 10)); }

  getDeviderBounds () { return pt(15, 4).extent(pt(25, 2)); }
}

class ColumnHalo extends AxisHalo {
  constructor ({ col, halo }) {
    super({ targetAxis: halo.target.col(col), halo });
  }

  get subject () { return 'column'; }

  adjustStretch (delta) {
    this.targetAxis.width += delta;
  }

  getDelta (evt) { return evt.state.dragDelta.x; }

  axisOffset () { return this.targetAxis.origin.position.x; }

  fetchPosition () { return pt(this.axisOffset() + 10, -45); }
  fetchExtent () { return pt(this.targetAxis.length - 10, 40); }

  getMenuOffset (menu) { return this.targetAxis.length > menu.width ? pt(5, 3) : pt(8, 26); }
  getMenuLayout () { return new HorizontalLayout(); }

  getResizeCursor () { return 'col-resize'; }

  getMinViewerPosition () { return pt(20, 50); }
  getMinSliderPosition () { return pt(-this.targetAxis.min, 0); }
  getMinSpaceExtent () { return pt(this.targetAxis.min, this.container.height + 45); }
  getMinSpaceBorder () {
    return {
      extent: pt(2, this.container.height + 50),
      vertices: [pt(1, 0), pt(1, this.container.height + 50)]
    };
  }

  getProportionViewerPosition () { return pt(20, 40); }
  getProportionSliderBounds (slider) { return pt(slider.owner.width - 5, 0).extent(pt(10, 40)); }

  getDeviderBounds () { return pt(4, 15).extent(pt(2, 25)); }
}

class CellGuide extends Morph {
  static get properties () {
    return {
      cellGroup: {

      }
    };
  }

  menuItems () {
    let checked = Icon.textAttribute('check-square-o');
    let unchecked = Icon.textAttribute('square-o');
    checked[1].textStyleClasses.push('annotation');
    unchecked[1].textStyleClasses.push('annotation');
    unchecked[1].paddingRight = '2px';
    return [
      ['Resize Policy', [
        [['Rigid  ', null, ...(this.cellGroup.resize ? unchecked : checked)], () => {
          this.cellGroup.resize = false;
        }],
        [['Space Filling  ', null, ...(this.cellGroup.resize ? checked : unchecked)], () => {
          this.cellGroup.resize = true;
        }]]],
      ['Align at...',
        ['center', ...new Rectangle().sides, ...new Rectangle().corners].map(side => {
          return [[side, { paddingRight: '2px' }, ...(this.cellGroup.align === side ? checked : unchecked), '  ', null],
            () => this.cellGroup.align = side];
        })
      ]
    ].concat(this.cellGroup.morph
      ? [['Release Morph from Cell', () => {
          let m = this.cellGroup.morph;
          if (m) {
            this.world().firstHand.grab(m);
            this.world().firstHand.longClickGrab = true;
            m.position = pt(0);
          }
        }]]
      : []);
  }
}

class LayoutHalo extends Morph {
  static get properties () {
    return {
      container: {},
      target: { get () { return this.container.layout; } },
      pointerId: {},
      halosEnabled: { defaultValue: false },
      isEpiMorph: { defaultValue: true },
      isHaloItem: { defaultValue: true },
      borderColor: { defaultValue: Color.orange },
      borderWidth: { defaultValue: 2 },
      styleClasses: { defaultValue: ['Halo'] }
    };
  }
}

export class GridLayoutHalo extends LayoutHalo {
  static get properties () {
    return {
      fill: { defaultValue: Color.transparent },
      cells: {
        derived: true,
        get () {
          return this.target.col(0).items.map(c => c.row(0).items).flat();
        }
      },
      submorphs: {
        after: ['target'],
        initialize () {
          this.initialize();
        }
      }
    };
  }

  previewDrop (morphs) {
    if (morphs.length < 1) return;
    let cell = this.cellGuides.find(g => g.fullContainsWorldPoint($world.firstHand.position));
    if (cell !== this.currentCell) {
      this.currentCell && this.currentCell.stopPreview();
    }
    this.currentCell = cell;
    this.currentCell && this.currentCell.startPreview();
  }

  handleDrop (morph) {
    if (this.currentCell) {
      morph.whenRendered().then(
        () => this.currentCell.cellGroup.morph = morph
      );
    }
  }

  initialize () {
    this.initGuides();
    this.alignWithTarget();
    this.focus();
  }

  optionControls () {
    const layout = this.target;
    const compensateOrigin = part(LabeledCheckbox, {
      name: 'compensateOrigin',
      viewModel: {
        label: 'Compensate Origin',
        checked: layout.compensateOrigin
      }
    });
    const fitToCell = part(LabeledCheckbox, {
      name: 'fitToCell',
      viewModel: {
        label: 'Resize Submorphs',
        checked: layout.fitToCell
      }
    });
    connect(compensateOrigin, 'checked', layout, 'compensateOrigin');
    connect(fitToCell, 'checked', layout, 'fitToCell');
    connect(compensateOrigin, 'checked', this, 'alignWithTarget');
    return [compensateOrigin, fitToCell];
  }

  get isLayoutHalo () { return false; }

  alignWithTarget () {
    this.target.apply();
    this.position = this.container.globalPosition;
    if (this.target.compensateOrigin) this.moveBy(this.container.origin.negated());
    this.extent = this.container.extent;
    this.addMissingGuides();
    this.guides.reverse().forEach(guide => guide.alignWithTarget());
  }

  addMissingGuides () {
    arr.withoutAll(this.target.cellGroups,
      this.guides.map(g => g.cellGroup))
      .forEach(group => this.addMorph(this.cellGuide(group)));
  }

  initGuides () {
    this.submorphs = [];
    this.guides = [];
    this.initCellGuides();
    this.initColumnGuides();
    this.initRowGuides();
  }

  initCellGuides () {
    const cellContainer = this.addMorph({
      fill: Color.transparent,
      borderRadius: this.borderRadius,
      extent: this.extent
    });
    this.target.cellGroups.forEach(group => {
      cellContainer.addMorph(this.cellGuide(group));
    });
    this.cellGuides = cellContainer.submorphs;
    this.addMorph(this.resizer());
  }

  addGuide (guide) {
    guide.isHaloItem = true;
    this.guides.push(guide);
    return guide;
  }

  initRowGuides () {
    const self = this;
    this.addGuide(this.addMorph(new Morph({
      width: 25,
      fill: Color.gray.withA(0.7),
      borderRadius: 15,
      height: this.container.height,
      topRight: pt(-5, 0),
      alignWithTarget () { this.height = self.container.height; }
    })));

    arr.range(0, this.target.rowCount - 1).forEach(row => {
      this.addMorph(new RowHalo({ row, halo: this }));
    });
  }

  initColumnGuides () {
    const self = this;
    this.addGuide(this.addMorph(new Morph({
      height: 25,
      fill: Color.gray.withA(0.7),
      borderRadius: 15,
      width: this.container.width,
      bottomLeft: pt(0, -5),
      alignWithTarget () { this.width = self.container.width; }
    })));

    arr.range(0, this.target.columnCount - 1).forEach(col => {
      this.addMorph(new ColumnHalo({ col, halo: this }));
    });
  }

  resizer () {
    const self = this;
    return this.addGuide(new Morph({
      fill: Color.transparent,
      extent: pt(25, 25),
      nativeCursor: 'nwse-resize',
      onDrag (evt) {
        self.container.resizeBy(evt.state.dragDelta);
        self.alignWithTarget();
      },
      alignWithTarget () {
        this.bottomRight = self.extent;
      }
    }));
  }

  cellResizer (cellGroup, corner) {
    let self = this;
    let adjacentCorner = corner === 'topLeft' ? 'bottomRight' : 'topLeft';
    let getCorner = (c) => { return cellGroup.bounds().partNamed(c); };
    return new Ellipse({
      borderWidth: 1,
      visible: false,
      borderColor: Color.black,
      nativeCursor: 'nwse-resize',
      removeCell (cell) {
        cellGroup.disconnect(cell);
        self.alignWithTarget();
      },
      addCell (cell) {
        cellGroup.connect(cell);
        self.alignWithTarget();
      },
      start () {
        this.fixpointCell = cellGroup[adjacentCorner];
        this.draggedDelta = getCorner(corner);
        this.debugMorph = self.addMorph(new Morph({ fill: Color.orange.withA(0.5) }));
      },
      update (delta) {
        this.draggedDelta = this.draggedDelta.addPt(delta);
        const coveringRect = Rectangle.unionPts([this.draggedDelta]).union(this.fixpointCell.bounds());
        this.debugMorph.setBounds(coveringRect);
        self.cells.forEach(cell => {
          const coverage = coveringRect.intersection(cell.bounds()).area() / cell.bounds().area();
          if (cellGroup.includes(cell) && coverage < 0.1) this.removeCell(cell);
          if (!cellGroup.includes(cell) && coverage > 1 / 3) this.addCell(cell);
        });
      },
      onDragEnd (evt) {
        this.debugMorph.remove();
      },
      onDragStart (evt) {
        this.start(evt.position);
      },
      onDrag (evt) {
        this.update(evt.state.dragDelta);
      }
    });
  }

  cellGuide (cellGroup) {
    const self = this;
    const topLeft = this.cellResizer(cellGroup, 'topLeft');
    const bottomRight = this.cellResizer(cellGroup, 'bottomRight');

    return this.addGuide(new CellGuide({
      cellGroup,
      bounds: cellGroup.bounds(),
      fill: Color.transparent,
      borderColor: Color.orange,
      borderWidth: 1,
      isHaloItem: true,
      isCell: true,
      draggable: false,
      submorphs: [topLeft, bottomRight],
      onMouseDown (evt) {
        this.becomeActive();
      },
      deactivate () {
        this.borderColor = Color.orange;
        this.fill = Color.transparent;
        this.submorphs.forEach(b => { b.visible = false; });
      },
      becomeActive () {
        self.guides.forEach(guide => { if (guide.isCell) guide.deactivate(); });
        this.borderColor = Color.rgbHex('#1565C0'),
        this.fill = Color.rgbHex('#1565C0').withA(0.3),
        self.addMorph(this.remove());
        this.submorphs.forEach(b => { b.visible = true; });
      },
      startPreview (evt) {
        // if hand carries a morph, preview the alignment of the morph
        this.fill = Color.orange.withA(0.7);
      },
      stopPreview (evt) {
        this.fill = Color.transparent;
      },
      onDrop (evt) {
        const [m] = evt.hand.grabbedMorphs; // pick the first of the grabbed submorphs
        evt.hand.dropMorphsOn(self.container);
        cellGroup.morph = m;
      },
      alignWithTarget () {
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
