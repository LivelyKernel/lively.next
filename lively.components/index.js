export * from './list.js';
export * from './buttons.js';
export * from './menus.js';
export * from './resizers.js';
export * from './tree.js';
export * from './iframe.js';
import Window from './window.js';

import * as prompts from './prompts.js';
import * as widgets from './widgets.js';
import * as LoadingIndicator from './loading-indicator.cp.js';
import { addClassMappings } from 'lively.morphic/helpers.js';
import { List, DropDownList } from './list.js';
import { Button } from './buttons.js';
import { CheckBox } from './widgets.js';

addClassMappings({
  list: List,
  dropdownlist: DropDownList,
  button: Button,
  checkbox: CheckBox,
  labeledcheckbox: widgets.LabeledCheckBox
});

export { Window, LoadingIndicator, prompts, widgets };
