import { Color, Point, RadialGradient, rect, LinearGradient, pt } from 'lively.graphics';
import { ShadowObject, ViewModel, component, part } from 'lively.morphic';
import { CheckerPattern } from './shared.cp.js';
import { joinPath } from 'lively.lang/string.js';
import { ExpressionSerializer } from 'lively.serializer2';
import { arr, num, fun } from 'lively.lang';
import { signal, noUpdate, connect } from 'lively.bindings';
import { ColorStop } from './color-stops.cp.js';

const WHEEL_URL = joinPath(System.baseURL, '/lively.ide/assets/color-wheel.png');

export class GradientHaloModel extends ViewModel {
  static get properties () {
    return {
      picker: {}, // ref to picker
      targetMorph: {
        derived: true,
        get () {
          return this.picker._target;
        }
      },
      stopControls: {
        get () {
          return this.ui.colorStopWrapper.submorphs.filter(m => m.isColorStop);
        }
      },
      angle: {
        derived: true,
        get () {
          return this.directionPoint.subPt(this.originPoint).theta();
        }
      },
      expose: {
        get () {
          return ['reset', 'initFromPicker', 'confirm', 'refresh', 'relayout', 'stopControls'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'origin handle', signal: 'onDrag', handler: 'moveOriginHandle' },
            { target: 'direction handle', signal: 'onDrag', handler: 'moveDirectionHandle' },
            { target: 'orthogonal handle', signal: 'onDrag', handler: 'moveOrthogonalHandle' }
          ];
        }
      }
    };
  }

  reset () {
    this.stopControls.forEach(m => m.remove());
  }

  initFromPicker (picker) {
    this.onActivate(); // since that is not toggled by the system... bad
    const gradient = picker.gradientValue;
    this.picker = picker;
    if (gradient.type === 'linearGradient') { this.initFromLinearGradient(this.targetMorph, gradient); }
    if (gradient.type === 'radialGradient') { this.initFromRadialGradient(this.targetMorph, gradient); }
    this.alignWithTarget();
  }

  initFromLinearGradient (target, linearGradient) {
    // based on the angle
    const targetBounds = target.innerBounds();
    const theta = linearGradient.vectorAsAngle();
    const c = targetBounds.center();
    const d = Math.max(targetBounds.height, targetBounds.width);
    // from the angle, compute the intersections
    const br = c.addPt(Point.polar(d, theta));
    const tl = c.subPt(Point.polar(d, theta));
    const [p1, p2] = targetBounds.lineIntersection(tl.lineTo(br));
    // the direction point the the one closes to br
    let directionPoint = arr.min([p1, p2], p => p.dist(br));
    this.originPoint = directionPoint === p1 ? p2 : p1;
    this.directionPoint = directionPoint;
    this.orthogonalDist = arr.min(targetBounds.edges(), edge => edge.distanceFromLine(p2)).length() / 2;

    this.alignWithTarget();
  }

  initFromRadialGradient (target, radialGradient) {
    const targetBounds = target.innerBounds();
    const originPoint = targetBounds.relativeToAbsPoint(radialGradient.focus);
    const { height: gradientHeight, width: gradientWidth } = radialGradient.bounds;
    this.originPoint = originPoint;
    this.directionPoint = originPoint.addXY(0, gradientHeight / 2);
    this.orthogonalDist = gradientWidth / 2;
    this.alignWithTarget();
  }

  alignWithTarget () {
    const {
      originHandle,
      directionHandle,
      orthogonalHandle,
      colorStopWrapper
    } = this.ui;
    const { view } = this;
    originHandle.center = pt(0);
    directionHandle.center = pt(view.width, 0);
    view.width = this.originPoint.dist(this.directionPoint);
    colorStopWrapper.width = view.width;
    colorStopWrapper.origin = colorStopWrapper.innerBounds().center();
    directionHandle.center = pt(view.width, 0);
    orthogonalHandle.center = pt(0, this.orthogonalDist);

    if (this.orthogonalDist > 0) {
      colorStopWrapper.tilted = 1;
      colorStopWrapper.position = pt(view.width / 2, view.height / 4 - 1);
    } else {
      colorStopWrapper.tilted = 0;
      colorStopWrapper.position = pt(view.width / 2, -view.height / 4 + 1);
    }

    view.globalPosition = this.targetMorph.worldPoint(this.originPoint).subPt($world.scroll); // ignores world scroll
    view.rotation = this.angle;
  }

  relayout () {
    this.alignWithTarget();
  }

  confirm () {
    const { gradientControl } = this.picker.models;
    if (gradientControl.gradientValue.type === 'linearGradient') {
      gradientControl.gradientValue.vector = this.angle;
    }
    if (gradientControl.gradientValue.type === 'radialGradient') {
      const v = gradientControl.gradientValue;
      const width = Math.abs(this.orthogonalDist) * 2;
      const height = this.originPoint.dist(this.directionPoint) * 2;
      v.focus = this.originPoint.scaleByPt(this.targetMorph.extent.inverted());
      v.bounds = pt(0, 0).extent(pt(width, height));
      v.angle = this.angle;
    }
    gradientControl.confirm();
    this.refresh(gradientControl, this.targetMorph);
    this.alignWithTarget();
  }

  normalize (delta) {
    return this.view.getGlobalTransform().transformDirection(delta);
  }

  moveOriginHandle (evt) {
    const delta = this.normalize(evt.state.dragDelta);
    this.originPoint = this.originPoint.addPt(delta);
    this.confirm();
  }

  moveDirectionHandle (evt) {
    const delta = this.normalize(evt.state.dragDelta);
    this.directionPoint = this.directionPoint.addPt(delta);
    this.confirm();
  }

  moveOrthogonalHandle (evt) {
    const delta = this.normalize(evt.state.dragDelta);
    this.orthogonalDist -= delta.dotProduct(Point.polar(1, this.angle - Math.PI / 2));
    this.confirm();
  }

  moveStop ([aStop, dx]) {
    this.picker.models.gradientControl.adjustStop(aStop, dx / this.ui.colorStopWrapper.width);
  }

  refresh (gradientControl, target) {
    const gradientValue = gradientControl.gradientValue;
    this.alignWithTarget();
    fun.guardNamed('updateGradient', () => {
      gradientControl.updateStopControls(gradientValue.stops, this);
    })();
  }

  placeStop (aStopControl) {
    this.ui.colorStopWrapper.addMorph(aStopControl);
  }

  selectStop (aStopControl) {
    this.picker.models.gradientControl.selectStop(aStopControl);
  }

  getPositionFor (aStop) {
    const wrapper = this.ui.colorStopWrapper;
    const { start, end } = wrapper.innerBounds().bottomEdge();
    return start.interpolate(aStop.offset, end).subXY(0, 5).subPt(wrapper.origin);
  }
}

// GradientHalo.openInWorld()
const GradientHalo = component({
  defaultViewModel: GradientHaloModel,
  name: 'gradient halo',
  borderColor: Color.rgb(23, 160, 251),
  dropShadow: new ShadowObject({
    rotation: 34, color: Color.rgba(0, 0, 0, 0.5), blur: 12, fast: false
  }),
  extent: pt(113.5, 70),
  fill: Color.rgba(0, 0, 0, 0),
  hasFixedPosition: true,
  origin: pt(0, 35),
  submorphs: [{
    name: 'color stop wrapper',
    position: pt(56.5, 0.2),
    dropShadow: false,
    extent: pt(113.5, 35.1),
    fill: Color.rgba(0, 0, 0, 0),
    origin: pt(56.7, 17.5),
    tilted: 1
  }, {
    name: 'origin handle',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 5,
    draggable: true,
    extent: pt(10, 10),
    nativeCursor: 'all-scroll'
  }, {
    name: 'direction handle',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 10,
    draggable: true,
    extent: pt(10, 10),
    nativeCursor: 'all-scroll'
  }, {
    name: 'orthogonal handle',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 10,
    draggable: true,
    extent: pt(10, 10),
    nativeCursor: 'all-scroll'
  }]
});

export class GradientControlModel extends ViewModel {
  static get properties () {
    return {
      gradientValue: {},
      gradientHalo: { initialize () { this.gradientHalo = part(GradientHalo); } }, // if active, this is openend in the world
      serializer: {
        serialize: false,
        get () {
          return this._serializer || (this._serializer = new ExpressionSerializer());
        }
      },
      isDisabled: {
        get () {
          return this.view && !this.view.visible; // bad style
        }
      },
      stopControls: {
        derived: true,
        get () {
          return this.view.submorphs.filter(m => m.isColorStop);
        }
      },
      selectedStopControl: {
        derived: true,
        get () {
          return this.stopControls.find(each => each.isSelected);
        }
      },
      expose: {
        get () {
          return ['toggle', 'gradientHalo'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onKeyDown', handler: 'onKeyDown' },
            { signal: 'onMouseDown', handler: 'onMouseDown' }
          ];
        }
      }
    };
  }

  onKeyDown (evt) {
    if (evt.keyCombo === 'Delete') {
      this.removeStop(this.selectedStopControl);
    }
  }

  onMouseDown (evt) {
    if (evt.targetMorph.name === 'gradient preview') {
      const offset = evt.positionIn(evt.targetMorph).x / evt.targetMorph.width;
      this.addStopAt(offset);
    }
  }

  removeStop (aStopControl) {
    if (this.gradientValue.stops.length < 3) return;
    arr.remove(this.gradientValue.stops, aStopControl.stop);
    this.refresh();
    this.confirm();
  }

  addStopAt (offset) {
    const stops = [...this.gradientValue.stops];
    const [before, after] = arr.sortBy(arr.sortBy(stops, stop => Math.abs(stop.offset - offset)).slice(0, 2), stop => stop.offset);
    const p = (offset - before.offset) / (after.offset - before.offset);
    stops.push({
      color: before.color.interpolate(p, after.color),
      offset
    });
    this.gradientValue.stops = arr.sortBy(stops, stop => stop.offset);
    this.refresh();
    this.confirm();
  }

  toggle (active, picker) {
    const { view } = this;
    view.isLayoutable = view.visible = active;
    if (active) {
      this.gradientHalo.openInWorld();
    } else {
      this.gradientHalo.remove();
      this.reset();
    }
  }

  reset () {
    this.gradientValue = null;
    this.stopControls.forEach(m => m.remove());
    this.gradientHalo.reset();
  }

  initLinearGradient (color) {
    if (color.isGradient) this.gradientValue = new LinearGradient({ stops: color.stops.map(s => ({ ...s })) });
    else {
      this.gradientValue = new LinearGradient({
        stops: [{ color, offset: 0 }, { color: Color.transparent, offset: 1 }]
      });
    }
  }

  initRadialGradient (color, target) {
    const bounds = target.innerBounds();
    if (color.isGradient) this.gradientValue = new RadialGradient({ bounds, stops: color.stops.map(s => ({ ...s })) });
    else {
      this.gradientValue = new RadialGradient({
        bounds,
        stops: [{ color, offset: 0 }, { color: Color.transparent, offset: 1 }]
      });
    }
  }

  deref (gradient) {
    return this.serializer.deserializeExprObj(gradient.__serialize__());
  }

  setGradient (color, colorPicker) {
    this.gradientValue = this.deref(color);
    this.gradientHalo.initFromPicker(colorPicker);
  }

  update (colorPicker) {
    if (this.isDisabled) return;
    const { selectedStopControl } = this;
    if (!this.gradientValue || this.gradientValue.type !== colorPicker.colorMode) {
      if (colorPicker.colorMode === 'linearGradient') this.initLinearGradient(this.gradientValue || colorPicker.color);
      if (colorPicker.colorMode === 'radialGradient') this.initRadialGradient(this.gradientValue || colorPicker.color, colorPicker._target);
      this.gradientHalo.initFromPicker(colorPicker);
      this.gradientHalo.confirm();
    }
    if (selectedStopControl) {
      const stopToChange = this.gradientValue.stops.find(aStop => selectedStopControl.stop === aStop);
      if (stopToChange) stopToChange.color = colorPicker.color;
      this.confirm();
    }
    this.refresh();
  }

  getPositionFor (aStop) {
    // returns the appropriate position for a stop control corresponding to aStop
    const { start, end } = this.ui.gradientPreview.bounds().topEdge();
    return start.interpolate(aStop.offset, end).subXY(0, 5);
  }

  confirm () {
    signal(this, 'gradientChanged', this.deref(this.gradientValue));
  }

  refresh () {
    if (!this.gradientValue) return;
    // updates the UI to be in tune with the gradient value
    const gradient = this.ui.gradient;
    const stops = this.gradientValue.stops.map(stop => {
      return { ...stop };
    });
    gradient.fill = new LinearGradient({
      vector: rect(0),
      stops // do not share stops!!
    });
    fun.guardNamed('updateGradient', () => {
      this.updateStopControls(this.gradientValue.stops);
    })();
    this.gradientHalo.refresh(this);
  }

  moveStop ([aStop, dx]) {
    const relativeDelta = dx / this.ui.gradientPreview.width;
    this.adjustStop(aStop, relativeDelta);
  }

  adjustStop (aStop, relativeDelta) {
    aStop.offset = num.clamp(aStop.offset + relativeDelta, 0, 1);
    this.refresh(); // update the stop position
    this.confirm();
  }

  placeStop (aStopControl) {
    this.view.addMorph(aStopControl);
  }

  getControlFor (aStop, haloOrEditor = this) {
    const s = part(ColorStop);
    s.withAllSubmorphsDo(m => m.halosEnabled = false);
    haloOrEditor.placeStop(s);
    connect(s, 'select', haloOrEditor, 'selectStop');
    connect(s, 'moveColorStop', haloOrEditor, 'moveStop');
    return s.forStop(aStop);
  }

  selectStop (aStopControl) {
    this.deselectAllStopsExcept(aStopControl, this);
    this.deselectAllStopsExcept(aStopControl, this.gradientHalo);
    // ask the color picker to manage the color of this stop
    signal(this, 'switchColor', aStopControl.stop.color);
  }

  deselectAllStopsExcept (aStopControl, haloOrEditor) {
    noUpdate(() => {
      haloOrEditor.stopControls.forEach(each => {
        if (each.stop !== aStopControl.stop) {
          each.deselect();
        } else {
          each.select();
        }
      });
    });
  }

  async updateStopControls (stops, haloOrEditor = this) {
    let stopControls = haloOrEditor.stopControls;
    // fixme: do not rely on the ordering of stop controls
    for (const stop of stops) {
      let control = stopControls.find(s => s.stop === stop);
      if (control) {
        // adjust the color of the stops if needed
        control.forStop(stop);
        arr.remove(stopControls, control);
      } else { await this.getControlFor(stop, haloOrEditor); }
    }
    arr.invoke(stopControls, 'remove');
    // adjust the position of the stops if needed
    haloOrEditor.stopControls.forEach(stopControl => {
      stopControl.positionIn(haloOrEditor);
    });
    this.selectStop(haloOrEditor.stopControls[0]);
    haloOrEditor.stopControls[0].viewModel.select();
  }
}

// part(GradientControl)
const GradientControl = component({
  viewModelClass: GradientControlModel,
  name: 'gradient control',
  borderWidth: 0,
  borderColor: Color.rgb(215, 219, 221),
  extent: pt(241, 74.3),
  fill: Color.rgba(0, 0, 0, 0),
  isDisabled: true,
  isLayoutable: false,
  submorphs: [{
    name: 'gradient preview',
    position: pt(24.1, 42.9),
    borderWidth: 0,
    borderColor: Color.rgb(127, 140, 141),
    borderRadius: 3,
    clipMode: 'hidden',
    extent: pt(195.4, 15),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(CheckerPattern, {
      name: 'checkerboard pattern gradient',
      extent: pt(218.4, 38.8)
    }), {
      name: 'gradient',
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(196.3, 37),
      fill: new LinearGradient({ stops: [{ offset: 0, color: Color.rgba(71, 181, 65, 0.9877472914564251) }, { offset: 1, color: Color.transparent }], vector: rect(0, 0, 0, 0) }),
      reactsToPointer: false
    }]
  }]
});

// GradientControl.openInWorld()

export { GradientHalo, GradientControl };
