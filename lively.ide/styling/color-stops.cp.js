import { Polygon, component, part } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { CheckerPattern } from './shared.cp.js';
import { signal } from 'lively.bindings';

export class ColorStopControl extends Polygon {
  static get properties () {
    return {
      stop: {},
      isSelected: {},
      isColorStop: {
        readOnly: true,
        get () { return true; }
      },
      ui: {
        get () {
          return {
            transparent: this.getSubmorphNamed('transparent'),
            opaque: this.getSubmorphNamed('opaque')
          };
        }
      }
    };
  }

  onDragStart (evt) {
    super.onDragStart(evt);
    this.bringToFront();
  }

  onDrag (evt) {
    const delta = this.getGlobalTransform().inverse().transformDirection(evt.state.dragDelta);
    signal(this, 'moveColorStop', [this.stop, delta.x]);
  }

  forStop (stop) {
    this.stop = stop;
    this.refresh();
    return this;
  }

  refresh (changedProp) {
    if (this.stop) {
      this.ui.transparent.fill = this.stop.color;
      this.ui.opaque.fill = this.stop.color.withA(1);
    }
    if (changedProp === 'isSelected') {
      this.master = this.isSelected ? SelectedColorStop : ColorStop; // eslint-disable-line no-use-before-define
    }
  }

  positionIn (gradientEditor) {
    this.bottomCenter = gradientEditor.getPositionFor(this.stop);
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this.select(this);
  }

  select () {
    this.isSelected = true;
    this.refresh('isSelected');
  }

  deselect () {
    this.isSelected = false;
    this.refresh('isSelected');
  }
}

// part(ColorStop).openInWorld()

const ColorCell = component({
  name: 'color cell',
  borderRadius: 1,
  borderWidth: 2,
  clipMode: 'hidden',
  extent: pt(20, 20),
  submorphs: [
    part(CheckerPattern, { name: 'checker pattern', extent: pt(25.3, 25.3) }),
    {
      name: 'opaque',
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(9, 18),
      fill: Color.rgb(255, 0, 0),
      position: pt(1.2, 1.2)
    }, {
      name: 'transparent',
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(9, 18),
      position: pt(9.6, 1),
      fill: Color.rgba(255, 0, 0, 0.38)
    }]
});

const ColorStop = component({
  type: ColorStopControl,
  name: 'color stop',
  borderColor: Color.rgb(127, 140, 141),
  borderWidth: 1,
  draggable: true,
  extent: pt(24, 28.7),
  submorphs: [part(ColorCell, {
    name: 'color cell',
    position: pt(2, 2)
  })],
  vertices: [({ position: pt(15.900091422187336, 24.046753447613565), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(12.388537571189591, 28.736349637681194), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(9.05093221433844, 24.003533970295216), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(1.9148586677257027, 24.02187830995731), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 22.053582048279853), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0.05972529570411431, 1.4675981539758662), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(1.8326500131114984, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(22.327151653198584, 0.06612585476395774), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(23.96388479762493, 1.7146839330382813), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(23.937061469131315, 22.31992067473174), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(22.024226083928863, 24.061687615284562), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(15.926023108578342, 24.053142413825835), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
});

const SelectedColorStop = component(ColorStop, {
  name: 'selected color stop',
  fill: Color.rgb(33, 150, 243),
  borderWidth: 0
});

// SelectedColorStop.openInWorld()
export { SelectedColorStop, ColorStop, ColorCell };
