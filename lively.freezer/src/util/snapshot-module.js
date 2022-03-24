/**
 * This module is a template to be used for any of the synthesized snapshot modules
 * that are created when freezing a part or a world. It is not meant to be used anywhere
 * in the system. Doing so, may wreck the current runtime, so be careful! 
 */
import { World, MorphicEnv, loadMorphFromSnapshot } from 'lively.morphic';
import { deserialize } from 'lively.serializer2';
import { loadViaScript, resource } from 'lively.resources';
import { pt } from 'lively.graphics';
const snapshot = JSON.parse('{"SNAPSHOT": "PLACEHOLDER"}');
lively.resources = { resource, loadViaScript };
lively.morphic = { loadMorphFromSnapshot };
export async function renderFrozenPart (node = document.body) {
  if (!MorphicEnv.default().world) {
    let world = window.$world = window.$$world = new World({
      name: snapshot.name, extent: pt(window.innerWidth, window.innerHeight)
    });
    world.stealFocus = true;
    MorphicEnv.default().setWorldRenderedOn(world, node, window.prerenderNode);
  }
  window.$world.dontRecordChangesWhile(() => {
    let obj = deserialize(snapshot, {
      reinitializeIds: function (id) { return id; }
    });
    if (obj.isWorld) {
      obj.position = pt(0, 0);
      obj.isEmbedded = true;
      MorphicEnv.default().setWorldRenderedOn(obj, node, window.prerenderNode);
      obj.resizePolicy === 'elastic' && obj.execCommand('resize to fit window');
    } else {
      try {
        if (node !== document.body) {
          const observer = new window.ResizeObserver(entries =>
            obj.execCommand('resize on client', entries[0]));
          observer.observe(node);
        } else {
          window.onresize = lively.FreezerRuntime.resizeHandler = () => obj.execCommand('resize on client');
        }
        obj.openInWorld(pt(0, 0));
        obj.execCommand('resize on client', node);
      } catch (err) {
        obj.position = pt(0, 0);
      }
    }
  });
}
