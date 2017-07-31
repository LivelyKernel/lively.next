export * from "./list.js";
export * from "./buttons.js";
export * from './menus.js';
export * from './resizers.js';
export * from './tree.js';
export * from './iframe.js';
import * as prompts from './prompts';
import * as widgets from './widgets.js';

import {Button} from './buttons.js';
import {List, FilterableList} from './list.js';
import InputLine from './input-line.js';
import {menuCommands} from './menus.js';
import {Window, windowCommands} from './window.js';
import {LoadingIndicator, loadingIndicatorCommands} from './loading-indicator.js';

export {LoadingIndicator, Window, prompts, widgets, InputLine};

import { registerMorphClass, Tooltip } from 'lively.morphic';
import worldCommands from 'lively.morphic/world-commands.js';

let classMapping = {
  button:     Button,
  list:       List,
  input:      InputLine,
  checkbox:   widgets.CheckBox,
  labeledcheckbox: widgets.LabeledCheckBox,
  window:     Window
};

import {promise} from 'lively.lang';

promise.waitFor(() => registerMorphClass).then(() => {
  // install world commands
  worldCommands.push(
    ...menuCommands,
    ...prompts.promptCommands,
    ...windowCommands,
    ...loadingIndicatorCommands);

  for (let klass in classMapping) {
    registerMorphClass(klass, classMapping[klass]);
  }
});
