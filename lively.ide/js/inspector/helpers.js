import { config } from 'lively.morphic';

import { arr } from 'lively.lang';
import { syncEval } from 'lively.vm';
import { module } from 'lively.modules';

export async function ensureDefaultImports () {
  if (typeof module === 'undefined') return;
  const inspectorEvalContext = module('lively://lively.morphic/inspector');
  const imports = config.ide.js.defaultInspectorImports;
  for (let modName in imports) {
    let exports;
    try {
      exports = await System.import(modName);
    } catch (err) {
      console.log('Failed to load inspector workspace default import: ' + modName);
      continue;
    }
    imports[modName].forEach(v => {
      inspectorEvalContext.define(v, exports[v], false);
    });
  }
}
export function generateReferenceExpression (morph, opts = {}) {
  // creates a expr (string) that, when evaluated, looks up a morph starting
  // from another morph
  // Example:
  // generateReferenceExpression(m)
  //   $world.get("aBrowser").get("sourceEditor");

  const world = morph.world();
  const {
    maxLength = 10,
    fromMorph = world
  } = opts;

  if (fromMorph === morph) return 'this';

  const rootExpr = world === fromMorph ? '$world' : 'this';

  // can we find it at all? if not return a generic "morph"
  if (!world && (!morph.name || fromMorph.get(morph.name) !== morph)) { return 'morph'; }

  const exprs = makeReferenceExpressionListFor(morph); // eslint-disable-line no-use-before-define

  return exprs.length > maxLength
    ? `$world.getMorphWithId("${morph.id}")`
    : exprs.join('.');

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function makeReferenceExpressionListFor (morph) {
    const name = morph.name;
    const owners = morph.ownerChain();
    const owner = morph.owner;
    const world = morph.world();
    let exprList;

    if (morph === fromMorph) exprList = [rootExpr];

    if (world === morph) exprList = ['$world'];

    if (!exprList && name && owner) {
      if (owner === world && arr.count(arr.pluck(world.submorphs, 'name'), name) === 1) {
        exprList = [`$world.get("${name}")`];
      }

      if (!exprList && owner !== world) {
        for (let i = owners.length - 1; i--;) {
          if (owners[i].getAllNamed(name).length === 1) {
            exprList = [...makeReferenceExpressionListFor(owners[i]), `get("${name}")`];
            break;
          }
        }
      }

      if (!exprList) {
        const exprsToCheck = [...makeReferenceExpressionListFor(owner), `get("${name}")`];
        if (syncEval(exprsToCheck.join('.'), { context: fromMorph }).value === morph) {
          exprList = exprsToCheck;
        }
      }
    }

    // if (!exprList && owner && owner.name) {
    //   var idx = owner.submorphs.indexOf(morph);
    //   exprList = makeReferenceExpressionListFor(morph.owner).concat([`submorphs[${idx}]`]);
    // }

    if (!exprList) {
      exprList = [`${rootExpr}.getMorphWithId("${morph.id}")`];
    }

    return exprList;
  }
}
