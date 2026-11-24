export function inspectorToggle(target, keyString, node) {
  return () => { target[keyString] = !target[keyString]; node.rerender(); };
}
