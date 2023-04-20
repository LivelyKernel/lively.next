import { Morph, HorizontalLayout, morph, Path, Icon } from 'lively.morphic';
import { obj, num, arr } from 'lively.lang/index.js';
import { pt, materialDesignColors, Color, rect } from 'lively.graphics';

export class Arrow extends Path {
  onHoverIn (evt) {
    this.showControlPoints = true;
  }

  onHoverOut (evt) {
    this.showControlPoints = false;
  }
}

export class BreakpointSlider extends Morph {
  static get properties () {
    return {
      orientation: {
        type: 'Enum',
        values: ['vertical', 'horizontal'],
        after: ['submorphs', 'layout'],
        set (direction) {
          this.setProperty('orientation', direction);
          this.relayout();
        }
      },
      breakPointIndex: {}
    };
  }

  alignInHalo (halo) {
    let {
      horizontalBreakpointControl,
      verticalBreakpointControl
    } = halo.ui;
    let {
      verticalBreakPoints,
      horizontalBreakPoints
    } = halo.target;
    let idx = this.breakPointIndex; let offset;
    if (this.orientation === 'vertical') {
      let { top } = verticalBreakpointControl;
      offset = verticalBreakPoints[idx];
      this.rightCenter = pt(halo.width - 13, offset + top);
      verticalBreakpointControl.submorphs[idx].width = offset - (verticalBreakPoints[idx - 1] || 0);
    }
    if (this.orientation === 'horizontal') {
      let { left } = horizontalBreakpointControl;
      offset = horizontalBreakPoints[idx];
      this.bottomCenter = pt(offset + left, halo.height - 13);
      horizontalBreakpointControl.submorphs[idx].width = offset - (horizontalBreakPoints[idx - 1] || 0);
    }
    this.getSubmorphNamed('user agent icon').value = this.getIconForOffset(offset);
    this.getSubmorphNamed('pixel view').value = `${offset.toFixed()} px`;
  }

  getIconForOffset (offset) {
    let sections = {
      horizontal: [
        0, 'mobile',
        768, 'tablet',
        1024, 'desktop'
      ],
      vertical: [
        0, 'mobile',
        1024, 'tablet',
        1440, 'desktop'
      ]
    };
    let ranges = arr.toTuples(sections[this.orientation], 2).reverse();
    return Icon.textAttribute(ranges.find(t => offset > t[0])[1]);
  }

  relayout () {
    let [pixelView, userAgent] = this.submorphs;
    switch (this.orientation) {
      case 'vertical':
        this.rotation = -Math.PI / 2;
        pixelView.padding = rect(10, 0, 3, 0);
        pixelView.fit();
        pixelView.rotation = Math.PI / 2;
        userAgent.rotation = Math.PI / 2;
        userAgent.top = -100;
        this.height = 80;
        break;
      case 'horizontal':
        this.rotation = 0;
        pixelView.padding = rect(0, 0, 0, 9);
        pixelView.fit();
        pixelView.rotation = 0;
        userAgent.rotation = 0;
        userAgent.top = -100;
        this.height = 60;
        break;
    }
    // this.layout.forceLayout();
  }

  onDrag (evt) {
    this.owner.onSliderDrag(this, evt.state.dragDelta);
  }
}

export class ResponsiveLayoutMorph extends Morph {
  static get properties () {
    return {
      verticalBreakPoints: {
        initialize () {
          this.verticalBreakPoints = [this.height / 2];
        }
      },
      horizontalBreakPoints: {
        initialize () {
          this.horizontalBreakPoints = [this.width / 2];
        }
      },
      watchedProperties: {
        after: ['breakPointPropertyMapping'],
        set (propertyNames) {
          this.setProperty('watchedProperties', propertyNames);
          this.capturePropertiesForBreakPoint(this.getCurrentBreakPoints());
        }
      },
      configurationHalo: {},
      breakPointPropertyMapping: {
        after: ['submorphs'],
        set (mappingSpec) {
          let map = new WeakMap();
          map.__serialize__ = (pool, serializedObjMap, path) =>
            this.breakPointPropertyMappingAsSpec(pool, serializedObjMap, path);
          this.setProperty('breakPointPropertyMapping', map);
          // convert the spec to a weak map based mapping
          for (let [m, spec] of mappingSpec) {
            map.set(m, spec);
          }
        }
      },
      debug: {
        // toggle the halo that allows to modify breakpoints and the set of watched properties
        after: ['configurationHalo'],
        type: 'Boolean',
        set (active) {
          this.setProperty('debug', active);
          this.toggleHalo(active);
        }
      }
    };
  }

  onOwnerChanged (newOwner) {
    if (newOwner && !newOwner.isHand) this.toggleHalo(this.debug);
  }

  remove () {
    super.remove();
    this.configurationHalo.remove();
  }

  menuItems () {
    let checked = Icon.textAttribute('check-square-o');
    let unchecked = Icon.textAttribute('square-o');
    Object.assign(unchecked[1], { paddingRight: '5px', float: 'none', display: 'inline' });
    Object.assign(checked[1], { paddingRight: '5px', float: 'none', display: 'inline' });

    return [
      [
        [...this.debug ? checked : unchecked, 'Responsive Controls ', { float: 'none' }],
        () => {
          this.debug = !this.debug;
        }
      ],
      { isDivider: true },
      ...super.menuItems()];
  }

  // this.copy()

  breakPointPropertyMappingAsSpec (pool, serializedObjMap, path) {
    let spec = [];
    this.withAllSubmorphsDo(m => {
      spec.push(m);
      spec.push(this.breakPointPropertyMapping.get(m) || [[{}, {}], [{}, {}]]);
    });
    return pool.ref(this).snapshotProperty(this.id, arr.toTuples(spec, 2), path, serializedObjMap, pool);
  }

  onChange (change) {
    super.onChange(change);
    if (change.prop === 'extent') {
      this.update();
    }
    if (change.prop === 'position') {
      this.configurationHalo.relayout();
    }
  }

  update () {
    let [h, v] = this.getCurrentBreakPoints();
    if (!this.lastBreakPoints) this.lastBreakPoints = [h, v];
    let [oldH, oldV] = this.lastBreakPoints;
    if (oldH != h || oldV != v) {
      this.capturePropertiesForBreakPoint(this.lastBreakPoints);
      this.updateSubmorphHierarchy([h, v]);
      this.lastBreakPoints = [h, v];
    }
    this.configurationHalo.relayout();
  }

  updateSubmorphHierarchy (breakPoint) {
    this.withAllSubmorphsDo(m => {
      let breakPointsToProps = this.breakPointPropertyMapping.get(m);
      Object.assign(m, breakPointsToProps[breakPoint]);
    });
  }

  getCurrentBreakPoints () {
    let h = arr.findIndex([...this.horizontalBreakPoints, this.width], (b) => this.width <= b);
    let v = arr.findIndex([...this.verticalBreakPoints, this.height], (b) => this.height <= b);
    return [h, v];
  }

  capturePropertiesForBreakPoint (breakPoint) {
    this.withAllSubmorphsDo(m => {
      let breakPointsToProps = this.breakPointPropertyMapping.get(m) || {};
      // fixme: maybe we need to be more careful when capturing properties? what about layouts?
      breakPointsToProps[breakPoint] = obj.select(m, this.watchedProperties);
      this.breakPointPropertyMapping.set(m, breakPointsToProps);
    });
  }

  toggleHalo (active) {
    let halo = this.configurationHalo;
    if (active) {
      halo.openInWorld();
      halo.relayout();
    } else {
      halo.remove();
    }
  }
}

export class ResponsiveLayoutMorphHalo extends Morph {
  static get properties () {
    return {
      target: {},
      sliderProto: {},
      removeBreakpointButton: {
        readOnly: true,
        get () {
          return Icon.makeLabel('times', {
            fontSize: 17, name: 'remove breakpoint', tooltip: 'remove breakpoint'
          });
        }
      },
      ui: {
        derived: true,
        get () {
          return {
            sliders: this.getSubmorphsByStyleClassName('BreakpointSlider'),
            addVerticalBreakPointButton: this.getSubmorphNamed('add vertical breakpoint'),
            addHorizontalBreakpointButton: this.getSubmorphNamed('add horizontal breakpoint'),
            addVerticalBreakpointButton: this.getSubmorphNamed('add vertical breakpoint'),
            verticalBreakpointControl: this.getSubmorphNamed('vertical breakpoint control'),
            horizontalBreakpointControl: this.getSubmorphNamed('horizontal breakpoint control')
          };
        }
      }
    };
  }

  getColorForBreakpoint (idx, align) {
    // generate from different color cycles
    let colorCycles = {
      horizontal: [0, 14, 12, 13].map(i => Color.rgbHex(materialDesignColors[i * 15])),
      vertical: [9, 2, 5, 2].map(i => Color.rgbHex(materialDesignColors[i * 15]))
    };
    return colorCycles[align][idx % 4];
  }

  relayout () {
    if (!this.owner) return;
    let {
      sliders,
      horizontalBreakpointControl,
      verticalBreakpointControl,
      addHorizontalBreakpointButton,
      addVerticalBreakpointButton
    } = this.ui;
    let {
      verticalBreakPoints,
      horizontalBreakPoints
    } = this.target;

    this.position = this.target.globalPosition.subPt(pt(35, 35));

    for (let slider of sliders) {
      // slider.layout.forceLayout();
      slider.alignInHalo(this);
    }

    // adjust the last breakpoint marker
    let lastV = verticalBreakpointControl.submorphs[verticalBreakPoints.length];
    lastV.width = Math.max(200, this.target.height - (arr.last(verticalBreakPoints) || 0) + 10);
    let lastH = horizontalBreakpointControl.submorphs[horizontalBreakPoints.length];
    lastH.width = Math.max(200, this.target.width - (arr.last(horizontalBreakPoints) || 0) + 10);

    // avoid sluggish relayouting
    // verticalBreakpointControl.layout.forceLayout();
    // horizontalBreakpointControl.layout.forceLayout();

    verticalBreakpointControl.submorphs.forEach((v, i) => {
      if (num.between(this.target.height, verticalBreakPoints[i - 1] || 0, verticalBreakPoints[i] || this.target.height + 10)) { v.opacity = 1; } else v.opacity = 0.5;
    });
    horizontalBreakpointControl.submorphs.forEach((v, i) => {
      if (num.between(this.target.width, horizontalBreakPoints[i - 1] || 0, horizontalBreakPoints[i] || this.target.width + 10)) { v.opacity = 1; } else v.opacity = 0.5;
    });

    addVerticalBreakpointButton.top = verticalBreakpointControl.bottom + 10;
    addHorizontalBreakpointButton.left = horizontalBreakpointControl.right + 10;
  }

  // this.update()
  // this.relayout()

  update () {
    let { sliders, verticalBreakpointControl, horizontalBreakpointControl } = this.ui;
    let { verticalBreakPoints, horizontalBreakPoints } = this.target;
    let updateBreakPoints = (control, breakpoints, align) => {
      control.submorphs = arr.range(0, breakpoints.length).map(i => {
        if (i > 0) {
          let slider = this.sliderProto.copy();
          slider.breakPointIndex = i - 1;
          slider.orientation = align;
          this.addMorph(slider);
        }
        return morph({
          left: i * 100,
          name: align[0] + i,
          fill: this.getColorForBreakpoint(i, align),
          height: 20,
          submorphs: i > 0 ? [this.removeBreakpointButton] : [],
          clipMode: 'hidden',
          layout: i > 0 && new HorizontalLayout({
            spacing: 2, direction: 'rightToLeft', autoResize: false, align: 'center'
          })
        });
      });
    };

    sliders.forEach(slider => slider.remove());

    updateBreakPoints(verticalBreakpointControl, verticalBreakPoints, 'vertical');
    updateBreakPoints(horizontalBreakpointControl, horizontalBreakPoints, 'horizontal');

    this.relayout();
  }

  // this.target.horizontalBreakPoints

  onMouseDown (evt) {
    let target = evt.targetMorph;
    let { verticalBreakpointControl, horizontalBreakpointControl } = this.ui;
    switch (target.name) {
      case 'add horizontal breakpoint':
        this.target.horizontalBreakPoints = [
          ...this.target.horizontalBreakPoints,
          horizontalBreakpointControl.width
        ];
        this.update();
        break;
      case 'add vertical breakpoint':
        this.target.verticalBreakPoints = [
          ...this.target.verticalBreakPoints,
          verticalBreakpointControl.width
        ];
        this.update();
        break;
      case 'remove breakpoint':
        let control = target.owner.owner;
        let idx = control.submorphs.indexOf(target.owner) - 1;
        if (control === verticalBreakpointControl) { arr.removeAt(this.target.verticalBreakPoints, idx); }
        if (control === horizontalBreakpointControl) { arr.removeAt(this.target.horizontalBreakPoints, idx); }
        this.update();
        break;
    }
  }

  onSliderDrag (slider, dragDelta) {
    let { orientation } = slider;
    let breakPointAccessor = orientation + 'BreakPoints';
    let delta = dragDelta[orientation == 'horizontal' ? 'x' : 'y'];
    let idx = slider.breakPointIndex;
    this.target[breakPointAccessor][idx] += delta; // in place to prevent update
    // shift all proceeding breakpoints by the same delta
    this.relayout();
  }
}
