import { Morph } from "lively.morphic";
import { referenceGraph } from "../snapshot-navigation.js";
import { graph, arr, obj, Path } from "lively.lang";
import ClassHelper, { locateClass } from "../class-helper.js";

// todo: add plugin interface here

function isMorphClass(klass) {
    if (!klass) return false;
    if (Morph === klass) return true;
    return isMorphClass(klass[Symbol.for("lively-instance-superclass")]);
}

function replaceMorphsBySerializableExpressions(snapshot, pool) {
  /*
  finds all the morphs inside a snapshot that can be represented by the expression
  returned via exportToJSON({ asExpression: true }). This requires that the snapshot contains no
  references to any of the morphs in that morphs hierarchy (i.e. via AttributeConnections, embedded morphs, custom properties)
  Those deemed suitable are then being replaced by the aforementioned expression */
  
  //1. compute inverse reference graph
  let G = referenceGraph(snapshot),
      inverseG = graph.invert(G);
  // 2. find all morphs and objects which are only referenced once

  let referencedOnce = Object.entries(inverseG).filter(([id, refs]) => {
    if (refs.length < 2 && isMorphClass(locateClass(snapshot[id][ClassHelper.classMetaForSerializationProp] || {}))) return true
  }).map(([id, refs]) => id);

  referencedOnce = referencedOnce.filter((id) => {
    return G[id].filter(ref => {
      // filter all morphs that have a property that references an object that is referenced by other morphs
      if (inverseG[ref].length > 1) return true;
    }).length == 0;
  });

  // 3. successively reduce the collection gathered in 2, by replacing each of the morphs with their parent
  let morphsToReplaceByExpr = new Set(referencedOnce); 
  for (let id of referencedOnce) {
    if (referencedOnce.includes(inverseG[id][0])) {
      morphsToReplaceByExpr.delete(id);
    }
  }

  for (let id of [...morphsToReplaceByExpr]) {
    let referer = snapshot[inverseG[id][0]],
        morphExpression = pool.expressionSerializer.exprStringEncode(
            pool.resolveToObj(id).exportToJSON({ asExpression: true }));

    // remove all referencedOnce morphs since they are no longer needed
    delete snapshot[id];
    
    let replaceReferenceInArray = (morphRefs, id) => {
       let idx = arr.findIndex(morphRefs, value => value && value.id === id);
       if (idx > -1) {
          morphRefs[idx] = morphExpression;
         return true;
       } 
    }

    for (let prop in referer.props) {
      if (Path('props.' + prop + '.value.id').get(referer) == id) {
        referer.props[prop].value = morphExpression;
        continue;
      }
      if (obj.isArray(referer.props[prop].value)) {
        if (replaceReferenceInArray(referer.props[prop].value, id)) continue;
      }
    }
  }
}