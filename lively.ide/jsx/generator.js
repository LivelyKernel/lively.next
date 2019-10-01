import { h, create } from "virtual-dom";

export default function jsx({elementName, attributes, children}) {
  let elem = h(elementName, {attributes}, children)
  elem.toString = () => create(elem).outerHTML;
  elem.asDomNode = () => create(elem);
  return elem;
}
