import { Color, pt, Rectangle } from 'lively.graphics';
import { TilingLayout, component, ViewModel, part } from 'lively.morphic';
import { HeadlineLabel, RemoveButton, PropertyLabelHovered, AddButton } from '../shared.cp.js';

export class PropertySectionModel extends ViewModel {
  static get properties () {
    return {
      inactiveSectionComponent: {
        isComponent: true,
        get () {
          return this.getProperty('inactiveSectionComponent') || PropertySectionInactive; // eslint-disable-line no-use-before-define
        }
      },
      hoverSectionComponent: {
        isComponent: true,
        get () {
          return this.getProperty('hoverSectionComponent') || PropertySection; // eslint-disable-line no-use-before-define
        }
      },
      bindings: {
        get () {
          return [
            { target: 'add button', signal: 'onMouseDown', handler: 'activate' },
            { target: 'remove button', signal: 'onMouseDown', handler: 'deactivate' }
          ];
        }
      }
    };
  }

  activate () {
    this.ui.removeButton.visible = true;
    this.ui.addButton.visible = false;
  }

  deactivate () {
    this.ui.addButton.visible = true;
    this.ui.removeButton.visible = false;
  }
}

const PropertySection = component({
  name: 'property section',
  borderColor: Color.rgba(97, 106, 107, 1),
  layout: new TilingLayout({
    spacing: 10,
    padding: Rectangle.inset(0, 10, 0, 10),
    resizePolicies: [
      ['h floater', { width: 'fill', height: 'fixed' }]
    ],
    axis: 'column',
    hugContentsVertically: true
  }),
  clipMode: 'hidden',
  fill: Color.transparent,
  borderWidth: { top: 0, left: 0, right: 0, bottom: 1 },
  extent: pt(195.1, 51),
  submorphs: [{
    name: 'h floater',
    epiMorph: true,
    layout: new TilingLayout({
      padding: Rectangle.inset(10, 0, 10, 0),
      justifySubmorphs: 'spaced',
      axisAlign: 'center'
    }),
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 0,
    extent: pt(180.6, 31),
    fill: Color.rgba(0, 0, 0, 0),
    position: pt(14.9, 5.5),
    submorphs: [part(HeadlineLabel, {
      name: 'section headline',
      textAndAttributes: ['Property Section', null]
    }), part(AddButton, {
      master: { auto: AddButton, hover: PropertyLabelHovered },
      name: 'add button',
      tooltip: 'Add Effect'
    }), part(RemoveButton, {
      master: { auto: AddButton, hover: PropertyLabelHovered },
      name: 'remove button',
      tooltip: 'Remove Effect',
      visible: false
    })]
  }]
});

const PropertySectionInactive = component(PropertySection, {
  name: 'property section inactive',
  submorphs: [{
    name: 'h floater',
    opacity: 0.5
  }]
});

export { PropertySection, PropertySectionInactive };
