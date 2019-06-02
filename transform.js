import { obj } from "lively.lang";
var debug = false;

function isEqualRef(objA, objB) {
  if (!objA || !objB) return false;
  if (objA === objB) return true;
  if (objA.type === "lively-sync-morph-ref" && objB.type === "lively-sync-morph-ref"
   && objA.id === objB.id) return true;
  if (objA.type === "lively-sync-morph-spec" && objB.type === "lively-sync-morph-spec"
   && objA._id === objB._id) return true;
  return false;
}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// transforming ops
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function nullTransform(op1, op2) {
  // does nothing
  return {op1, op2, handled: false};
}

export function morphicDefaultTransform(op1, op2, syncer) {
  var c1 = op1.change, c2 = op2.change,
      {prop: prop1, type: type1, target: {id: target1}, owner: owner1, value: value1, selector: selector1, args: args1, creator: creator1} = c1,
      {prop: prop2, type: type2, target: {id: target2}, owner: owner2, value: value2, selector: selector2, args: args2, creator: creator2} = c2;

  if (target1 === target2) {

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // position
    if (prop1 === "position" && prop2 === "position"
     && type1 === "setter" && type2 === "setter"
    // && owner1.id === owner2.id
     ) {
       op1.change = op2.change = {...c1, value: value1.addPt(value2.subPt(value1).scaleBy(.5))}
       return {op1, op2, handled: true}
    }

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // addMorph...
  if (selector1 === "addMorphAt" && selector2 === "addMorphAt") {

    // ...same owner, different morphs => transform order
    if (target1 === target2 && args1[0].spec._id !== args2[0].spec._id) {
       var newArgs1 = [args1[0], op1.creator < op2.creator ? args1[1] : args2[1]+1],
           newArgs2 = [args2[0], op1.creator < op2.creator ? args1[1]+1 : args2[1]];
       op1.change = {...c1, args: newArgs1};
       op2.change = {...c2, args: newArgs2};
       return {op1, op2, handled: true};
    }

    // ...same morph, different owners => one wins
    else if (args1[0].spec._id === args2[0].spec._id) {
      if (op1.creator < op2.creator) op2.change = {...c1};
      else op1.change = {...c2};
      return {op1, op2, handled: true};
    }

    // inverse addMorph, m1 added to m2 vs. m2 added to m1
    else if (target1 === args2[0].spec._id && target2 === args1[0].spec._id) {
      // if (op1.creator < op2.creator) op2.change = {...c1};
      // else op1.change = {...c2};
      if (op1.creator < op2.creator) {
        op2.change = {
          ...op2.change,
          selector: "replaceWith",
          args: op2.change.args.slice(0,1)
        }
      }
      else {
        op1.change = {
          ...op1.change,
          selector: "replaceWith",
          args: op1.change.args.slice(0,1)
        };
      }
      return {op1, op2, handled: true};
    }

  }

  return {op1, op2, handled: false};
}

function runTransforms(op1, op2, tfmFns, syncer) {
  op1 = obj.clone(op1),
  op2 = obj.clone(op2);
  for (let tfmFn of tfmFns) {
    try {
      var {op1, op2, handled} = tfmFn(op1, op2, syncer);
      if (debug && handled && op1.change.selector === "addMorphAt" && op2.change.selector === "addMorphAt") {
        var sel1 = op1.change.selector,
            sel2 = op2.change.selector
        console.log(`[${syncer}] xform ${sel1} x ${sel2}\n`
                  + `${op1}\n${op2}\n`
                  + `${syncer.state.objects.get(op1.change.target.id)}\n`
                  + `${syncer.state.objects.get(op1.change.args[0].spec._id)}`);
      }

      if (handled) break;
    } catch (e) {
      console.error(`Error while transforming ${op1} with ${op2}:\n ${e.stack || e}`);
    }
  }

  op1.parent = op2.id;
  op2.parent = op1.id;
  var v1 = op2.version + 1,
      v2 = op1.version + 1;
  op1.version = v1;
  op2.version = v2;

  return {op1, op2};
}

export function transformOp_1_to_n(op, againstOps, transformFns = [], syncer) {
  // transform an op against other ops
  if (!againstOps.length)
    return {transformedOp: op, transformedAgainstOps: []}

  var op2 = op, transformedAgainstOps = [];
  for (let op1 of againstOps) {
    ({op1, op2} = runTransforms(op1, op2, transformFns, syncer));
    transformedAgainstOps.push(op1);
  }

  return {transformedOp: op2, transformedAgainstOps}
}



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// composing ops
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function composeOps(ops) {
  return ops.length <= 1 ?
    ops :
    ops.slice(0, -1).reduceRight((composed, op1) => {
      var [op2, ...rest] = composed;
      return composeOpPair(op1, op2).concat(rest);
    }, ops.slice(-1));
}

function composeOpPair(op1, op2) {
  // composing setters: Use the last change as it overrides everything before
  if (op1.change.prop === op2.change.prop
   && isEqualRef(op1.change.target, op2.change.target)
   && op1.change.type === "setter" && op2.change.type === "setter")
     return [op2]

  return [op1, op2];
}
