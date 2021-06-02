import { copy } from 'lively.serializer2';
import { pt } from 'lively.graphics';
import ObjectPackage, { addScript } from 'lively.classes/object-classes.js';

function onDropOn (target) {
  console.log(target);
}

function onDragStart (evt) {
  console.log(evt);
  return;
  let newMorph = copy(this);
  newMorph.openInWorld();
  let hand = evt.hand;
  hand.grab(newMorph);
  newMorph.position = pt(0, 0);
}

function onDragEnd (evt) {
  // super.onDragEnd(evt)
  let hand = evt.hand;
  hand.onDrop(evt);
}

export async function makeDroppable (aMorph) {
  let functionsToApply = [onDragStart, onDragEnd, onDropOn];
  let obj = $world.get(aMorph);

  if (!ObjectPackage.lookupPackageForObject(obj)) {
    let pkg = ObjectPackage.withId('DroppedMethods');
    await pkg.adoptObject(obj);
  }

  functionsToApply.forEach(async function (fn) {
    let name = fn.name;
    console.log(name);
    let { methodName } = await addScript(obj, fn, name);
  });
}
