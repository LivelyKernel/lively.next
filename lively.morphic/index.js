export { default as config } from './config.js';
export * from './morph.js';
export * from './world.js';
export * from './text/morph.js';
export * from './text/label.js';
export * from './text/anchors.js';
export * from './html-morph.js';
export * from './env.js';
export * from './layout.js';
export * from './components/core.js';
export { StyleSheet } from './style-sheets.js';
export { ShadowObject } from './rendering/morphic-default.js';
export { addOrChangeCSSDeclaration, addOrChangeLinkedCSS } from './rendering/dom-helper.js';
export { easings, stringToEasing } from './rendering/animations.js';
export { Icon } from './text/icons.js';
export { loadMorphFromSnapshot } from './serialization.js';
export * from './morphicdb/index.js';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { World, Hand } from './world.js';
import { Morph, Image, Ellipse, Triangle, Path, Polygon, LineMorph } from './morph.js';
import { Text } from './text/morph.js';
import { Label } from './text/label.js';
import { HTMLMorph } from './html-morph.js';
import InputLine, { PasswordInputLine } from './text/input-line.js';
export { InputLine, PasswordInputLine };

import { morph, addClassMappings, inspect, touchInputDevice } from './helpers.js';

addClassMappings({
  default: Morph,
  world: World,
  hand: Hand,
  image: Image,
  ellipse: Ellipse,
  triangle: Triangle,
  path: Path,
  text: Text,
  input: InputLine,
  label: Label,
  polygon: Polygon,
  line: LineMorph,
  html: HTMLMorph
});

export { morph, inspect, touchInputDevice };
