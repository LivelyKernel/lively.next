import { Tooltip, config } from 'lively.morphic';
import { SystemTooltip } from 'lively.morphic/tooltips.cp.js';
import { num, arr } from 'lively.lang';
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

// number scrubbing
export function onNumberDragStart (evt, scrubState) {
  scrubState.initPos = evt.position;
  scrubState.factorLabel = new Tooltip({ master: SystemTooltip, description: '1x' }).openInWorld(
    evt.hand.position.addXY(10, 10)
  );
}

export function getScaleAndOffset (evt, scrubState) {
  const { x, y } = evt.position.subPt(scrubState.initPos);
  const scale = num.roundTo(Math.exp(-y / $world.height * 6), 0.01) * scrubState.baseFactor;
  return { offset: x, scale };
}

export function getCurrentValue (delta, s, scrubState) {
  const v = scrubState.scrubbedValue + (scrubState.floatingPoint ? delta * s : Math.round(delta * s));
  return Math.max(scrubState.min, Math.min(scrubState.max, v));
}

export function onNumberDragEnd (evt, scrubState) {
  const { offset, scale } = getScaleAndOffset(evt, scrubState);
  scrubState.factorLabel.softRemove();
  return getCurrentValue(offset, scale, scrubState);
}

export function onNumberDrag (evt, scrubState) {
  const { scale, offset } = getScaleAndOffset(evt, scrubState);
  scrubState.factorLabel.position = evt.hand.position.addXY(10, 10);
  scrubState.factorLabel.description = `${scale}x`;
  return getCurrentValue(offset, scale, scrubState);
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
      exprList = [`${rootExpr}.getMorphById("${morph.id}")`];
    }

    return exprList;
  }
}
