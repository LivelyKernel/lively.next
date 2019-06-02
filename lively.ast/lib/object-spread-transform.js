import Visitor from "../generated/estree-visitor.js";
import {funcCall, member} from "./nodes.js";

class ObjectSpreadTransformer extends Visitor {

  accept(node, state, path) {
    if (node.type === "ObjectExpression") {
      node = this.transformSpreadElement(node);
    }
    return super.accept(node, state, path);
  }

  transformSpreadElement(node) {
    var currentGroup = [],
        propGroups = [currentGroup];

    node.properties.forEach(prop => {
      if (prop.type !== "SpreadElement") currentGroup.push(prop)
      else {
        propGroups.push(prop)
        currentGroup = [];
        propGroups.push(currentGroup);
      }
    });

    if (propGroups.length === 1) return node;

    if (!currentGroup.length) propGroups.pop();
    
    return funcCall(
      member("Object", "assign"),
      ...propGroups.map(group => {
        return group.type === "SpreadElement" ? group.argument : {
          properties: group,
          type: 'ObjectExpression'
        }
      }))
    
  }
}

export default function objectSpreadTransform(parsed) {
  // "var x = {y, ...z}" => "var x = Object.assign({ y }, z);"
  return new ObjectSpreadTransformer().accept(parsed, {}, []);
};
