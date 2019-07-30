/*global System*/
export { default as config } from "./config.js";
export * from "./morph.js";
export * from "./world.js";
export * from "./text/morph.js";
export * from "./text/label.js";
export * from "./text/anchors.js";
export * from "./html-morph.js";
export * from "./env.js";
export * from "./layout.js";
export { StyleSheet } from "./style-sheets.js";
export { ShadowObject } from "./rendering/morphic-default.js";
export { addOrChangeCSSDeclaration, addOrChangeLinkedCSS } from "./rendering/dom-helper.js";
export { easings, stringToEasing } from "./rendering/animations.js";
export * from "./tooltips.js";
export { Icon } from "./text/icons.js";
export { loadMorphFromSnapshot } from './serialization.js'
export * from './morphicdb/index.js'

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { World, Hand } from "./world.js";
import { Morph, Image, Ellipse, Triangle, Path, Polygon, LineMorph } from "./morph.js";
import { Text } from "./text/morph.js";
import { Label } from "./text/label.js";
import { HTMLMorph } from './html-morph.js';
import InputLine, { PasswordInputLine } from "./text/input-line.js";
export { InputLine, PasswordInputLine };

import { Button } from "lively.components/buttons.js";
import { CheckBox, LabeledCheckBox } from "lively.components/widgets.js";
import { List, DropDownList } from "lively.components/list.js";
import { locateClass } from "lively.serializer2";
import { morph, addClassMappings, inspect } from './helpers.js';

addClassMappings({
  'default':         Morph,
  'world':           World,
  'hand':            Hand,
  'image':           Image,
  'ellipse':         Ellipse,
  'triangle':        Triangle,
  'path':            Path,
  'text':            Text,
  'input':           InputLine,
  'label':           Label,
  'list':            List,
  'polygon':         Polygon,
  'line':            LineMorph,
  'html':            HTMLMorph,
  'dropdownlist':    DropDownList,
  'button':          Button,
  'checkbox':        CheckBox,
  'labeledcheckbox': LabeledCheckBox
})

export { morph, inspect };
