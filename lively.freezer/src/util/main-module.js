/* global main, prepare, WORLD_CLASS, TITLE, TRACE */
/**
 * This module is a template to be used for any of the synthesized entry modules
 * that are created when freezing a particular module as an entrypoint.
 */
import { MorphicEnv } from 'lively.morphic';
import { World } from 'lively.morphic';
import { pt } from 'lively.graphics';

// fixme: what to do to make IDE worlds load? They require components before $world is a thing yet....
export async function renderFrozenPart (node = document.body) {
  prepare();
  if (!MorphicEnv.default().world) {
    let world = window.$world = window.$$world = new WORLD_CLASS({
      extent: pt(window.innerWidth, window.innerHeight),
      name: TITLE
    });
    world.stealFocus = true;
    MorphicEnv.default().setWorldRenderedOn(world, node, window.prerenderNode);
  }
  System.trace = TRACE;
  // if IDE world required import that now and require that stuff too!
  main();
}
