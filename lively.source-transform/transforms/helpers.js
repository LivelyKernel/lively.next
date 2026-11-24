import { nodes } from 'lively.ast';
const { funcCall } = nodes;

export function declarationWrapperCall (
  declarationWrapperNode,
  declNode,
  varNameLiteral,
  varKindLiteral,
  valueNode,
  recorder,
  options
) {
  if (declNode) {
    // here we pass compile-time meta data into the runtime
    const keyVals = [];
    let addMeta = false; let start; let end; let evalId; let sourceAccessorName;
    if (declNode['x-lively-object-meta']) {
      ({ start, end, evalId, sourceAccessorName } = declNode['x-lively-object-meta']);
      addMeta = true;
      keyVals.push('start', nodes.literal(start), 'end', nodes.literal(end));
    }
    if (evalId === undefined && options.hasOwnProperty('evalId')) {
      evalId = options.evalId;
      addMeta = true;
    }
    if (sourceAccessorName === undefined && options.hasOwnProperty('sourceAccessorName')) {
      sourceAccessorName = options.sourceAccessorName;
      addMeta = true;
    }
    if (evalId !== undefined) keyVals.push('evalId', nodes.literal(evalId));
    if (sourceAccessorName) keyVals.push('moduleSource', nodes.id(sourceAccessorName));
    if (addMeta) {
      return funcCall(
        declarationWrapperNode, varNameLiteral, varKindLiteral, valueNode, recorder,
        nodes.objectLiteral(keyVals)/* meta node */);
    }
  }

  return funcCall(declarationWrapperNode, varNameLiteral, varKindLiteral, valueNode, recorder);
}
