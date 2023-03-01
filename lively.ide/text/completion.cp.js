import { FilterableList, List } from 'lively.components';
import { pt, rect, Color } from 'lively.graphics';
import { ShadowObject, component } from 'lively.morphic';
import { InputLine } from 'lively.components/inputs.js';

// AutocompleteList.openInWorld()
const AutocompleteList = component({
  type: FilterableList,
  borderWidth: 0,
  name: 'autocomplete list',
  extent: pt(400, 360),
  renderOnGPU: true,
  selectedAction: 'default',
  submorphs: [{
    type: InputLine,
    name: 'input',
    extent: pt(22, 22),
    fill: Color.rgba(255, 255, 255, 0),
    fixedHeight: false,
    fixedWidth: true,
    fontFamily: '"IBM Plex Mono"',
    padding: rect(0, 3, 0, -1),
    placeholder: null
  }, {
    name: 'padding',
    extent: pt(10, 0),
    fill: Color.rgba(0, 0, 0, 0),
    position: pt(0, 21)
  }, {
    type: List,
    name: 'list',
    borderColor: Color.rgb(149, 165, 166),
    borderRadius: 3,
    clipMode: 'auto',
    dropShadow: new ShadowObject({ distance: 15, color: Color.rgba(0, 0, 0, 0.35), blur: 52 }),
    extent: pt(400, 339),
    fill: Color.rgba(255, 255, 255, 0.9),
    fontFamily: 'IBM Plex Mono',
    itemHeight: 18,
    itemPadding: rect(3, 2, 7, -1),
    manualItemHeight: true,
    padding: rect(0, 0, 0, 0),
    position: pt(0, 21)
  }]
});

export { AutocompleteList };
