import { pt, rect, Color } from 'lively.graphics';
import { List, DropDownListModel } from './list.js';
import { ShadowObject, component } from 'lively.morphic';
import { ButtonDefault, SystemButtonDark, SystemButton, ButtonDark } from './buttons.cp.js';

const DefaultList = component({
  // implementing lists via viewModel does not really make sense since they are
  // purely presentational elements that provide custom style props. If the list behavior is
  // active during design this will not disrupt the designers workflow
  type: List,
  name: 'default list',
  borderColor: Color.rgb(149, 165, 166),
  extent: pt(226.5, 93.5),
  itemHeight: 20,
  itemPadding: rect(3, 2, -2, -1),
  manualItemHeight: true
});

const DarkList = component(DefaultList, {
  name: 'dark list',
  borderColor: Color.rgb(149, 165, 166),
  borderRadius: 4,
  dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
  extent: pt(194, 91.9),
  fill: Color.rgba(66, 73, 73, 0.85),
  fontFamily: 'IBM Plex Mono',
  nonSelectionFontColor: Color.rgb(204, 204, 204),
  selectionColor: Color.rgb(230, 230, 230),
  selectionFontColor: Color.rgb(0, 0, 0)
});

const DropDownList = component(SystemButton, {
  defaultViewModel: DropDownListModel,
  name: 'drop down list'
});

const DarkDropDownList = component(SystemButtonDark, {
  name: 'dark drop down list',
  defaultViewModel: DropDownListModel
});

export { DefaultList, DarkList, DropDownList, DarkDropDownList };
