import { component, without } from 'lively.morphic/components/core.js';
import { Color, materialDesignColors, rect, pt } from 'lively.graphics';
import { Icon, Path, easings, ViewModel, part, TilingLayout, Label } from 'lively.morphic';
import { num, arr } from 'lively.lang';
import { signal, disconnect, epiConnect } from 'lively.bindings';
import { PolicyApplicator, BreakpointStore } from 'lively.morphic/components/policy.js';

export class Arrow extends Path {
  onHoverIn (evt) {
    this.showControlPoints = true;
  }

  onHoverOut (evt) {
    this.showControlPoints = false;
  }
}

export function getColorForBreakpoint (idx, align) {
  // generate from different color cycles
  let colorCycles = {
    horizontal: [0, 14, 12, 13].map(i => Color.rgbHex(materialDesignColors[i * 15])),
    vertical: [9, 2, 5, 2].map(i => Color.rgbHex(materialDesignColors[i * 15]))
  };
  return colorCycles[align][idx % 4];
}

export class BreakpointSliderModel extends ViewModel {
  static get properties () {
    return {
      orientation: {
        type: 'Enum',
        values: ['vertical', 'horizontal'],
        after: ['submorphs', 'layout'],
        set (direction) {
          this.setProperty('orientation', direction);
        }
      },
      breakpointIndex: {},
      expose: {
        get () {
          return ['onDrag', 'breakpointIndex', 'alignInHalo', 'orientation'];
        }
      }
    };
  }

  alignInHalo (offset, halo) {
    const offsetControl = this.view.owner;
    // ensure we are rendered
    if (this.orientation === 'vertical') {
      halo.viewModel?.alignBreakpointSliderVertically(this.view, offset);
    }
    if (this.orientation === 'horizontal') {
      halo.viewModel?.alignBreakpointSliderHorizontally(this.view, offset);
    }
    this.ui.userAgentIcon.value = this.getIconForOffset(offset);
    this.ui.pixelView.value = `${offset.toFixed()} px`;
  }

  getIconForOffset (offset) {
    let sections = {
      horizontal: [
        0, 'mobile-screen',
        768, 'mi-tablet',
        1024, 'desktop'
      ],
      vertical: [
        0, 'mobile-screen',
        1024, 'mi-tablet',
        1440, 'desktop'
      ]
    };
    let ranges = arr.toTuples(sections[this.orientation], 2).toReversed();
    return Icon.textAttribute(ranges.find(t => offset >= t[0])[1]);
  }

  onDrag (evt) {
    signal(this.view, 'sliderDrag', evt.state.dragDelta);
  }
}

const BreakpointHorizontal = component({
  defaultViewModel: BreakpointSliderModel,
  clipMode: 'hidden',
  rotation: num.toRadians(0.0),
  draggable: true,
  extent: pt(72, 97.1),
  fill: Color.rgba(46, 75, 223, 0),
  layout: new TilingLayout({
    align: 'right',
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    spacing: 5
  }),
  nativeCursor: 'grab',
  position: pt(-86.5, 387.2),
  submorphs: [{
    type: Label,
    name: 'user agent icon',
    fixedHeight: true,
    extent: pt(21.7, 36.4),
    fontSize: 30.108,
    reactsToPointer: false,
    textAndAttributes: Icon.textAttribute('mobile')
  }, {
    type: Label,
    name: 'pixel view',
    borderRadius: 7,
    draggable: true,
    fill: Color.rgba(0, 0, 0, 0.381),
    fontColor: Color.rgb(255, 255, 255),
    fontSize: 16,
    grabbable: true,

    nativeCursor: 'pointer',
    padding: rect(10, 0, 3, 0),
    reactsToPointer: false,
    textAndAttributes: ['320 px', null]
  }, {
    name: 'pin wrapper',
    fill: Color.rgba(255, 255, 255, 0),
    borderStyle: 'none',
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 1,
    extent: pt(30.2, 20.7),
    position: pt(-8, 27),
    reactsToPointer: false,
    submorphs: [{
      type: Arrow,
      name: 'breakpoint pin',
      origin: pt(6.9, -2.1),
      borderColor: Color.rgb(0, 0, 0),
      borderWidth: 2,
      extent: pt(16.9, 16.6),
      fill: Color.transparent,
      position: pt(8.3, 5.1),
      reactsToPointer: false,
      rotation: 0.7853981633974483,
      startMarker: {
        children: [{
          d: 'M0,0 L10,5 L0,10 z',
          tagName: 'path'
        }],
        id: 'start-marker',
        markerHeight: '5',
        markerWidth: '5',
        orient: 'auto',
        refX: '5',
        refY: '5',
        tagName: 'marker',
        viewBox: '0 0 10 10'
      },
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(16.9, 16.6), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }]
  }]
});

const BreakpointVertical = component(BreakpointHorizontal, {
  layout: new TilingLayout({
    align: 'right',
    axisAlign: 'center',
    spacing: 5
  }),
  extent: pt(135, 40),
  submorphs: [{
    name: 'user agent icon'
  }, {
    name: 'pixel view',
    padding: rect(10, 0, 0, 0)
  }, {
    name: 'pin wrapper',
    extent: pt(31.9, 30.1),
    rotation: num.toRadians(-90.0),
    submorphs: [{
      name: 'breakpoint pin',
      origin: pt(-3.8, -4),
      position: pt(-0.5, -6.4),
      vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(16.9, 16.6), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
    }]
  }]
});

class BreakpointRangeModel extends ViewModel {
  static get properties () {
    return {
      breakpointIndex: {
        // ref to the breakpoint we are representing
      },
      expose: { get () { return ['breakpointIndex']; } },
      bindings: {
        get () {
          return [
            { target: 'remove breakpoint', signal: 'onMouseDown', handler: 'onRemoveClicked' }
          ];
        }
      }
    };
  }

  onRemoveClicked () {
    signal(this.view, 'requestRemove', this.breakpointIndex);
  }
}

const BreakpointRange = component({
  defaultViewModel: BreakpointRangeModel,
  clipMode: 'hidden',
  extent: pt(200, 20),
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    padding: rect(2, 2, 0, 0),
    spacing: 2
  }),
  submorphs: [{
    type: Label,
    name: 'remove breakpoint',
    nativeCursor: 'pointer',
    fontSize: 17,
    textAndAttributes: Icon.textAttribute('times'),
    tooltip: 'remove breakpoint'
  }]
});

const BreakpointControl = component({
  name: 'breakpoint control',
  clipMode: 'hidden',
  borderRadius: 5,
  extent: pt(545, 20),
  fill: Color.rgba(81, 90, 90, 0),
  layout: new TilingLayout({
    align: 'top',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true
  }),
  position: pt(34.4, 1.2),
  submorphs: [
    part(BreakpointRange, {
      name: 'base breakpoint',
      extent: pt(345.4, 20),
      fill: Color.rgb(244, 67, 54),
      opacity: 0.5,
      submorphs: [without('remove breakpoint')]
    }), part(BreakpointRange, { name: 'next breakpoint', fill: Color.rgb(255, 152, 0) })]
});

export class ResponsiveLayoutHaloModel extends ViewModel {
  static get properties () {
    return {
      horizontalBreakpoints: {
        get () { return this.store?._horizontalBreakpoints || [0]; }
      },
      verticalBreakpoints: {
        get () { return this.store?._verticalBreakpoints || [0]; }
      },
      store: {
        get () { return this.targetStylePolicy?._breakpointStore; }
      },
      targetStylePolicy: {
        get () {
          let stylePolicy = this.target.master;
          if (stylePolicy.overriddenMaster) stylePolicy = stylePolicy.overriddenMaster;
          return stylePolicy;
        }
      },
      sliders: { get () { return this.view.getAllNamed(/slider/); } },
      verticalSliders: { get () { return this.sliders.filter(slider => slider.orientation === 'vertical'); } },
      horizontalSliders: { get () { return this.sliders.filter(slider => slider.orientation === 'horizontal'); } },
      target: {},
      isHaloItem: { get () { return true; } },
      expose: {
        get () {
          return ['focusOn', 'close', 'isHaloItem', 'alignBreakpointSliderVertically', 'alignBreakpointSliderHorizontally'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'add vertical breakpoint btn', signal: 'onMouseDown', handler: 'addVerticalBreakpoint' },
            { target: 'add horizontal breakpoint btn', signal: 'onMouseDown', handler: 'addHorizontalBreakpoint' },
            // it would be nice to have support for something like this...
            { target: /horizontal breakpoint/, signal: 'onMouseDown', handler: 'jumpToHorizontalBreakpoint', converter: '() => source' },
            { target: /vertical breakpoint/, signal: 'onMouseDown', handler: 'jumpToVerticalBreakpoint', converter: '() => source' },
            { target: /vertical breakpoint/, signal: 'requestRemove', handler: 'removeVerticalBreakpoint' },
            { target: /horizontal breakpoint/, signal: 'requestRemove', handler: 'removeHorizontalBreakpoint' },
            { target: /slider/, signal: 'sliderDrag', handler: 'onSliderDrag', updater: '($upd, dragDelta) => { $upd(source, dragDelta)}' }
          ];
        }
      }
    };
  }

  alignBreakpointSliderVertically (bp, offset) {
    const control = this.ui.verticalBreakpointControl;
    if (!control.env.renderer.getNodeForMorph(control)) {
      control.env.forceUpdate(control);
    }
    const locBounds = control.transformRectToMorph(this.view, control.innerBounds());

    bp.rightCenter = pt(locBounds.right(), offset + locBounds.top());
  }

  alignBreakpointSliderHorizontally (bp, offset) {
    const control = this.ui.horizontalBreakpointControl;
    if (!control.env.renderer.getNodeForMorph(control)) {
      control.env.forceUpdate();
    }
    const locBounds = control.transformRectToMorph(this.view, control.innerBounds());
    if (!control.env.renderer.getNodeForMorph(control)) {
      control.env.forceUpdate(control);
    }
    bp.bottomCenter = pt(offset + locBounds.left(), locBounds.bottom());
  }

  ensureStore () {
    if (!this.target.master) this.target.master = new PolicyApplicator({ breakpoints: [] });
    if (!this.store) this.targetStylePolicy._breakpointStore = new BreakpointStore();
  }

  focusOn (target) {
    this.target = target;
    target._responsiveHalo = this.view;
    epiConnect(target, 'onChange', this, 'relayout');
    this.update();
  }

  close () {
    this.view.remove();
    disconnect(this.target, 'onChange', this, 'relayout');
    delete this.target._responsiveHalo;
  }

  jumpToHorizontalBreakpoint (elem) {
    const bps = this.horizontalBreakpoints;
    const maxLength = this.ui.horizontalBreakpointControl.width;
    const idx = this.ui.horizontalBreakpointControl.submorphs.indexOf(elem);
    if (idx < 0) return;
    this.target.animate({
      width: num.interpolate(.9, bps[idx], bps[idx + 1] || maxLength),
      easing: easings.outExpo,
      duration: 200
    });
  }

  jumpToVerticalBreakpoint (elem) {
    const bps = this.verticalBreakpoints;
    const maxLength = this.ui.verticalBreakpointControl.width;
    const idx = this.ui.verticalBreakpointControl.submorphs.indexOf(elem);
    if (idx < 0) return;
    this.target.animate({
      height: num.interpolate(.9, bps[idx], bps[idx + 1] || maxLength),
      easing: easings.outExpo,
      duration: 200
    });
  }

  /**
   * Updates the size and position of control elements in response
   * to changes in the target's breakpoints.
   */
  relayout () {
    let {
      horizontalBreakpointControl,
      verticalBreakpointControl,
      addHorizontalBreakpointBtn,
      addVerticalBreakpointBtn
    } = this.ui;
    let {
      verticalBreakpoints, horizontalBreakpoints,
      verticalSliders, horizontalSliders, view
    } = this;

    const padding = 10;

    view.position = this.target.globalPosition.subPt(pt(27, 33));
    for (let slider of horizontalSliders) {
      slider.alignInHalo(horizontalBreakpoints[slider.breakpointIndex] || 0, this.view);
    }
    for (let slider of verticalSliders) {
      slider.alignInHalo(verticalBreakpoints[slider.breakpointIndex] || 0, this.view);
    }

    verticalBreakpointControl.submorphs.forEach((v, i) => {
      const vOffset = (verticalBreakpoints[v.breakpointIndex + 1] || 0) - verticalBreakpoints[v.breakpointIndex];
      v.width = vOffset;
      if (num.between(this.target.height, verticalBreakpoints[i] || 0, verticalBreakpoints[i + 1] || this.target.height + padding)) {
        v.opacity = 1;
      } else v.opacity = 0.5;
    });

    horizontalBreakpointControl.submorphs.forEach((h, i) => {
      const hOffset = (horizontalBreakpoints[h.breakpointIndex + 1] || 0) - horizontalBreakpoints[h.breakpointIndex];
      h.width = hOffset;
      if (num.between(this.target.width, horizontalBreakpoints[i], horizontalBreakpoints[i + 1] || this.target.width + padding)) {
        h.opacity = 1;
      } else h.opacity = 0.5;
    });

    // adjust the last breakpoint marker
    let lastV = arr.last(verticalBreakpointControl.submorphs);
    lastV.width = Math.max(200, this.target.height - (arr.last(verticalBreakpoints) || 0) + padding);
    let lastH = arr.last(horizontalBreakpointControl.submorphs);
    lastH.width = Math.max(200, this.target.width - (arr.last(horizontalBreakpoints) || 0) + padding);

    addVerticalBreakpointBtn.top = verticalBreakpointControl.bottom + 10;
    addHorizontalBreakpointBtn.left = horizontalBreakpointControl.right + 10;
  }

  updateBreakpoints (control, breakpoints, align) {
    const newElems = arr.range(0, Math.max(0, breakpoints.length - 1)).map(i => {
      if (i > 0) {
        this.view.addMorph(part(align === 'horizontal' ? BreakpointHorizontal : BreakpointVertical, {
          name: align + ' slider ' + (i - 1),
          position: pt(0, 0),
          tooltip: 'Drag to change the breakpoint position.',
          viewModel: {
            orientation: align,
            breakpointIndex: i
          }
        }));
      }
      return part(BreakpointRange, {
        name: align + ' breakpoint ' + i,
        position: pt(0, 0),
        fill: getColorForBreakpoint(i, align),
        viewModel: { breakpointIndex: i },
        submorphs: i == 0 ? [without('remove breakpoint')] : []
      });
    });
    control.submorphs = newElems;
  }

  /**
   * Updates the structure of the UI in response to
   * changes in the target's breakpoints.
   */
  update () {
    let { verticalBreakpointControl, horizontalBreakpointControl } = this.ui;
    let { verticalBreakpoints, horizontalBreakpoints, sliders } = this;

    sliders.forEach(slider => slider.remove());

    this.updateBreakpoints(verticalBreakpointControl, verticalBreakpoints, 'vertical');
    this.updateBreakpoints(horizontalBreakpointControl, horizontalBreakpoints, 'horizontal');

    this.relayout();
  }

  addHorizontalBreakpoint () {
    let { horizontalBreakpointControl } = this.ui;
    this.ensureStore();
    this.store.addHorizontalBreakpoint(horizontalBreakpointControl.width);
    this.update();
    signal(this.target, 'breakpoint added');
    this.refreshChangeTrackers();
  }

  addVerticalBreakpoint () {
    let { verticalBreakpointControl } = this.ui;
    this.ensureStore();
    this.store.addVerticalBreakpoint(verticalBreakpointControl.width);
    this.update();
    signal(this.target, 'breakpoint added');
    this.refreshChangeTrackers();
  }

  removeHorizontalBreakpoint (idx) {
    this.store.removeHorizontalBreakpoint(idx);
    this.update();
    signal(this.target, 'breakpoint removed');
    this.refreshChangeTrackers();
  }

  removeVerticalBreakpoint (idx) {
    this.store.removeVerticalBreakpoint(idx);
    this.update();
    signal(this.target, 'breakpoint removed');
    this.refreshChangeTrackers();
  }

  onSliderDrag (slider, dragDelta) {
    const { orientation } = slider;
    const breakpointAccessor = orientation + 'Breakpoints';
    const axis = orientation === 'horizontal' ? 'x' : 'y';
    const delta = dragDelta[axis];
    const idx = slider.breakpointIndex;
    const bps = this.store['_' + breakpointAccessor];
    const lowerBound = bps[idx - 1] || 0;
    const upperBound = bps[idx + 1] || Infinity;
    bps[idx] += delta;
    if (bps[idx] < lowerBound) bps[idx] = lowerBound + 1;
    if (bps[idx] > upperBound) bps[idx] = upperBound - 1;
    this.relayout();
    signal(this.target, 'breakpoint changed');
    this.refreshChangeTrackers();
    this.target.master.applyIfNeeded(true);
  }

  refreshChangeTrackers () {
    if (!this.target._changeTracker) return;
    this.target._changeTracker.processChangeInComponent({
      prop: 'master',
      meta: { reconcileChanges: true },
      target: this.target,
      value: this.targetStylePolicy
    });
  }
}

// part(ResponsiveLayoutHalo).openInWorld().focusOn(this.get('test target'))

export const ResponsiveLayoutHalo = component({
  defaultViewModel: ResponsiveLayoutHaloModel,
  name: 'responsive layout halo',
  hasFixedPosition: true,
  styleClasses: ['Halo'],
  borderColor: Color.rgb(230, 126, 34),
  draggable: true,
  extent: pt(35.1, 35),
  fill: Color.rgba(46, 75, 223, 0),
  grabbable: true,
  position: pt(1272.9, 345.2),
  submorphs: [
    part(BreakpointVertical, {
      name: 'vertical slider',
      viewModel: { orientation: 'vertical' },
      position: pt(-120.4, 343)
    }),
    part(BreakpointHorizontal, {
      name: 'horizontal slider',
      viewModel: { orientation: 'horizontal' },
      position: pt(336.1, -92.5)
    }), {
      name: 'horizontal control wrapper',
      borderStyle: 'none',
      fill: Color.rgba(255, 255, 255, 0),
      layout: new TilingLayout({
        axisAlign: 'center',
        hugContentsHorizontally: true,
        hugContentsVertically: true,
        orderByIndex: true,
        spacing: 7
      }),
      borderColor: Color.rgb(23, 160, 251),
      borderWidth: 1,
      extent: pt(581, 41),
      position: pt(26.8, -8.2),
      submorphs: [part(BreakpointControl, {
        name: 'horizontal breakpoint control',
        position: pt(9.2, 14.7),
        reactsToPointer: false
      }), {
        type: Label,
        name: 'add horizontal breakpoint btn',
        fontSize: 30.108,
        nativeCursor: 'pointer',
        position: pt(565.2, 11.2),
        textAndAttributes: Icon.textAttribute('plus-circle'),
        tooltip: 'Add a horizontal breakpoint'
      }]
    }, {
      name: 'vertical control wrapper',
      borderStyle: 'none',
      fill: Color.rgba(255, 255, 255, 0),
      layout: new TilingLayout({
        axis: 'column',
        axisAlign: 'center',
        hugContentsHorizontally: true,
        hugContentsVertically: true,
        orderByIndex: true
      }),
      borderColor: Color.rgb(23, 160, 251),
      borderWidth: 1,
      extent: pt(137.2, 537.8),
      position: pt(-14.2, 32.6),
      submorphs: [part(BreakpointControl, {
        name: 'vertical breakpoint control',
        extent: pt(548, 20),
        position: pt(78.8, 5.3),
        rotation: 1.570796326794897,
        submorphs: [{
          name: 'base breakpoint',
          extent: pt(331.2, 20),
          fill: Color.rgb(76, 175, 80)
        }, {
          name: 'next breakpoint',
          extent: pt(194.9, 20),
          fill: Color.rgb(156, 39, 176),
          opacity: 0.5
        }]
      }), {
        type: Label,
        name: 'add vertical breakpoint btn',
        padding: rect(5, 0, 0, 0),
        fontSize: 30.108,
        nativeCursor: 'pointer',
        position: pt(-3.2, 527.4),
        textAndAttributes: Icon.textAttribute('plus-circle'),
        tooltip: 'Add a vertical breakpoint'
      }]
    }]
});
