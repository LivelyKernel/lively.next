import { component, ViewModel } from 'lively.morphic/components/core.js';
import { PropertySection, PropertySectionModel } from './section.cp.js';

export class ComponentControlModel extends PropertySectionModel {

}

const ComponentControl = component(PropertySection, {
  name: 'component control'
});

export { ComponentControl };
