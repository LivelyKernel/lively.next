function onDropOn(target){
  alert('test function')
}

export function makeDroppable(aMorph){
  aMorph.onDropOn = onDropOn
}