import { fun } from 'lively.lang';
import { pt, Color } from 'lively.graphics';
import { morph } from 'lively.morphic';

const cachedGuideLines = new WeakMap();
const guideWidth = 1;
const guideColor = Color.orange.lighter();

/**
 * @typdef {('top'|'bottom'|'left'|'right'|'vCenter'|'hCenter')} Edge
 */

// here we find aligning edges
const edges = [
  ['vertical', 'top', 'top'],
  ['vertical', 'vCenter', 'top'],
  ['vertical', 'bottom', 'top'],
  ['vertical', 'top', 'vCenter'],
  ['vertical', 'vCenter', 'vCenter'],
  ['vertical', 'bottom', 'vCenter'],
  ['vertical', 'top', 'bottom'],
  ['vertical', 'vCenter', 'bottom'],
  ['vertical', 'bottom', 'bottom'],
  ['horizontal', 'left', 'left'],
  ['horizontal', 'hCenter', 'left'],
  ['horizontal', 'right', 'left'],
  ['horizontal', 'left', 'hCenter'],
  ['horizontal', 'hCenter', 'hCenter'],
  ['horizontal', 'right', 'hCenter'],
  ['horizontal', 'left', 'right'],
  ['horizontal', 'hCenter', 'right'],
  ['horizontal', 'right', 'right']
];

export function removeSnapToGuidesOf (target) {
  let dragGuides = cachedGuideLines.get(target);
  if (!dragGuides) return;
  dragGuides.forEach(ea => ea.remove());
}

function computeRefPoints (bounds) {
  let { x: left, y: top, width, height } = bounds;
  let hCenter = left + width / 2;
  let vCenter = top + height / 2;
  let right = left + width;
  let bottom = top + height;
  return { left, top, hCenter, vCenter, right, bottom, width, height };
}

/**
 * Find the closest neighbors of a morph.
 * @param { number } i - The index of the morph in question.
 * @param { Morph[] } morphs - The list of morphs to consider as neighbors.
 * @param { Point[] } refPoints - The set of reference points.
 * @param { number[] } lefts - The set of left offsets of each of the morphs.
 * @param { number[] } rights - The set of right offsets of each of the morphs.
 * @param { number[] } tops - The set of top offsets of each of the morphs.
 * @param { number[] } bottoms - The set of bottom offsets of each of the morphs.
 * @param { boolean } [overlappingProjected = true] - Wether or not to project overlapping morphs.
 * @returns { Object } The morph that is closest to the top, left, right and bottom respectively.
 */
function closest (i, morphs, refPoints, lefts, rights, tops, bottoms, overlappingProjected = true) {
  let l = lefts[i]; let r = rights[i]; let t = tops[i]; let b = bottoms[i];
  let closestL; let closestR; let closestT; let closestB;

  for (let j = 0; j < rights.length; j++) {
    if (i === j || l < rights[j] ||
        (closestL && rights[closestL.index] >= rights[j])) continue;
    if (overlappingProjected && bottoms[i] < tops[j] || tops[i] > bottoms[j]) continue;
    closestL = { index: j, dist: l - rights[j], refPointsA: refPoints[i], refPointsB: refPoints[j] };
  }

  for (let j = 0; j < lefts.length; j++) {
    if (i === j || r > lefts[j] ||
        (closestR && lefts[closestR.index] <= lefts[j])) continue;
    if (overlappingProjected && bottoms[i] < tops[j] || tops[i] > bottoms[j]) continue;
    closestR = { index: j, dist: lefts[j] - r, refPointsA: refPoints[i], refPointsB: refPoints[j] };
  }

  for (let j = 0; j < bottoms.length; j++) {
    if (i === j || t < bottoms[j] ||
        (closestT && bottoms[closestT.index] >= bottoms[j])) continue;
    if (overlappingProjected && lefts[i] > rights[j] || rights[i] < lefts[j]) continue;
    closestT = { index: j, dist: t - bottoms[j], refPointsA: refPoints[i], refPointsB: refPoints[j] };
  }

  for (let j = 0; j < tops.length; j++) {
    if (i === j || b > tops[j] ||
        (closestB && tops[closestB.index] <= tops[j])) continue;
    if (overlappingProjected && lefts[i] > rights[j] || rights[i] < lefts[j]) continue;
    closestB = { index: j, dist: tops[j] - b, refPointsA: refPoints[i], refPointsB: refPoints[j] };
  }
  return { l: closestL, r: closestR, t: closestT, b: closestB };
}

/**
 * Given a set of morphs compute the set of morphs that is closest to them.
 * @param { Morph[] } morphs - The set of morphs to check for.
 * @returns { Morph[] } A list of closest morphs.
 */
function computeClosestMorphs (morphs) {
  let lefts = [];
  let rights = [];
  let tops = [];
  let bottoms = [];
  let refPoints = [];
  let result = [];

  for (let i = 0; i < morphs.length; i++) {
    let m = morphs[i];
    let rps = computeRefPoints(m.bounds());
    refPoints.push(rps);
    let { left, right, top, bottom } = rps;
    lefts.push(left);
    rights.push(right);
    tops.push(top);
    bottoms.push(bottom);
  }

  for (let i = 0; i < morphs.length; i++) { result.push(closest(i, morphs, refPoints, lefts, rights, tops, bottoms)); }

  return result;
}

/**
 * Find the edges that are in alignment between the two sets of ref points.
 * @param { number[] } refPointsA - The first set of ref points.
 * @param { number[] } refPointsB - The second set of ref points.
 * @param { number } eps - The rounding interval.
 * @param { Edge[] } fromEdges - The source edges.
 * @param { Edge[] } toEdges - The target edges.
 * @param { number } distLeft - The lef offset.
 * @param { number } distTop - The top offset.
 * @param { number } distRight - The right offset.
 * @param { number } distBottom - The bottom offset.
 * @param { number } maxDist - The maximum distance to consider.
 */
function findEdgesInAlignment (refPointsA, refPointsB, eps = 15, fromEdges, toEdges, distLeft = 0, distTop = 0, distRight = 0, distBottom = 0, maxDist = 0) {
  let vertical = []; let horizontal = [];

  for (let i = 0; i < edges.length; i++) {
    let [type, edgeA, edgeB] = edges[i];
    let edgeAVal = refPointsA[edgeA];
    let edgeBVal = refPointsB[edgeB];
    let delta = Math.max(edgeAVal, edgeBVal) - Math.min(edgeAVal, edgeBVal);
    if (delta > eps) continue;
    if (fromEdges && !fromEdges.includes(edgeA)) continue;
    if (toEdges && !toEdges.includes(edgeB)) continue;

    let result = type === 'vertical' ? vertical : horizontal;
    result.push({
      delta,
      edgeA,
      edgeB,
      edgeAVal,
      edgeBVal,
      refPointsA,
      refPointsB,
      distLeft,
      distTop,
      distRight,
      distBottom,
      maxDist
    });
  }
  return vertical.length || horizontal.length ? { vertical, horizontal } : null;
}

/**
 * Map(morph => {
 *  horizontal: [{delta, edgeA/B, edgeA/BVal, refPointsA/B, dist[Left,...]}]
 * })
 * @param { Morph } refMorph - The reference morph.
 * @param { Morph[] } submorphs - The submorphs to consider.
 * @param { number } eps - The rounding error.
 * @param { number } distCutoff - The maximum dist.
 * @param { Edge[] } fromEdges - The set of edges to map from.
 * @param { Edge[] } toEdges - The set of edget to map to.
 */
function findAlignedMorphs (refMorph, submorphs, eps = 15, distCutoff = Infinity, fromEdges, toEdges) {
  let result; let refPoints = computeRefPoints(refMorph.bounds());

  for (let i = 0; i < submorphs.length; i++) {
    let m = submorphs[i];
    if (m === refMorph) continue;

    let refPointsM = computeRefPoints(m.bounds());
    let distLeft = Math.max(0, refPoints.left - refPointsM.right);
    let distRight = Math.max(0, refPointsM.left - refPoints.right);
    let distTop = Math.max(0, refPoints.top - refPointsM.bottom);
    let distBottom = Math.max(0, refPointsM.top - refPoints.bottom);
    let maxDist = Math.max(distBottom, distTop, distRight, distLeft);

    if (Math.max(distBottom, distTop, distRight, distLeft) > distCutoff) continue;

    let found = findEdgesInAlignment(
      refPoints, refPointsM, eps,
      fromEdges, toEdges,
      distLeft, distTop, distRight, distBottom, maxDist);
    if (!found) continue;
    if (!result) result = new Map();
    result.set(m, found);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // owner
  {
    let owner = refMorph.owner;
    let refPointsO = computeRefPoints(owner.innerBounds());
    let found = findEdgesInAlignment(refPoints, refPointsO, eps);
    if (found) {
      if (!result) result = new Map();
      result.set(owner, found);
    }
  }

  return result;
}

/**
 * Show and snap to the guides.
 * @param { Morph } target - The morph to show the guides for.
 * @param { boolean } [showGuides=true] - Wether or not to show the guides.
 * @param { boolean } [snap=true] - Wether or not the snapping of the morph is enabled.
 * @param { number } [eps=10] - The snap distance.
 * @param { number } [maxDist=100] - The maximum distance of morphs to be considered guide worthy.
 */
export function showAndSnapToGuides (target, showGuides = true, snap = true, eps = 10, maxDist = 100) {
  if ((!showGuides && !snap) || !target.owner) return;

  let owner = target.owner;
  let world = owner.world();
  let tfm = owner.getGlobalTransform();
  let morphsForGuides = target.owner.submorphs.filter(ea =>
    ea !== target && !ea.isEpiMorph && ea.visible && ea.reactsToPointer);
  let fromEdges = ['left', 'top', 'right', 'bottom', 'hCenter', 'vCenter'];
  let toEdges = ['left', 'top', 'right', 'bottom', 'hCenter', 'vCenter'];
  let aligned = findAlignedMorphs(target, morphsForGuides, eps, maxDist, fromEdges, toEdges);
  let guideSpecs = [];
  let maxHPriority = 0; let maxVPriority = 0;
  let dragOffsetX = 0; let dragOffsetY = 0;

  // adjust world scroll in transform
  tfm.e -= world.scroll.x;
  tfm.f -= world.scroll.y;

  // compute guides and drag offset for snapping
  if (aligned) {
    for (let [_, { horizontal, vertical }] of aligned) {
      for (let { delta, edgeAVal, refPointsA, refPointsB, edgeBVal, maxDist } of horizontal) {
        let priority = Math.ceil(eps - delta);
        let top = Math.min(refPointsA.top, refPointsB.top);
        let bottom = Math.max(refPointsA.bottom, refPointsB.bottom);

        if (maxDist > eps) priority -= eps / 2;

        if (maxHPriority < priority) {
          maxHPriority = priority;
          dragOffsetX = edgeBVal - edgeAVal;
        }

        guideSpecs.push({
          type: 'line',
          epiMorph: true,
          hasFixedPosition: true,
          height: guideWidth,
          start: tfm.transformPoint(pt(edgeBVal, top)),
          end: tfm.transformPoint(pt(edgeBVal, bottom)),
          fill: guideColor,
          guideType: 'h',
          priority
        });
      }

      for (let { delta, edgeAVal, refPointsA, refPointsB, edgeBVal, maxDist } of vertical) {
        let priority = Math.ceil(eps - delta);
        let left = Math.min(refPointsA.left, refPointsB.left);
        let right = Math.max(refPointsA.right, refPointsB.right);

        if (maxDist > eps) priority -= eps / 2;

        if (maxVPriority < priority && Math.abs(edgeBVal - edgeAVal) <= eps) {
          maxVPriority = priority;
          dragOffsetY = edgeBVal - edgeAVal;
        }

        guideSpecs.push({
          type: 'line',
          epiMorph: true,
          hasFixedPosition: true,
          height: guideWidth,
          start: tfm.transformPoint(pt(left, edgeBVal)),
          end: tfm.transformPoint(pt(right, edgeBVal)),
          fill: guideColor,
          guideType: 'v',
          priority
        });
      }
    }
  }

  // try to constrain based on spacing between morphs
  if (!maxHPriority || !maxVPriority) {
    let morphs = [target, ...morphsForGuides];
    let closest = computeClosestMorphs(morphs);
    let targetRefPoints;
    let { l: targetL, r: targetR, t: targetT, b: targetB } = closest[0];
    let foundSimilarDist;

    if (targetL || targetR || targetT || targetB) {
      targetRefPoints = (targetL || targetR || targetT || targetB).refPointsA;
      for (let i = 1; i < closest.length; i++) {
        let { l, r, t, b } = closest[i];

        if (!maxHPriority) {
          if (targetL && l && targetL.index !== l.index && Math.abs(l.dist - targetL.dist) <= eps) foundSimilarDist = { neighbor: i, direction: 'left', ...l };
          else if (targetR && r && targetR !== r.index && Math.abs(r.dist - targetR.dist) <= eps) foundSimilarDist = { neighbor: i, direction: 'right', ...r };
        }
        if (!maxVPriority) {
          if (targetT && t && targetT.index !== t.index && Math.abs(t.dist - targetT.dist) <= eps) foundSimilarDist = { neighbor: i, direction: 'top', ...t };
          else if (targetB && b && targetB.index !== b.index && Math.abs(b.dist - targetB.dist) <= eps) foundSimilarDist = { neighbor: i, direction: 'bottom', ...b };
        }

        if (foundSimilarDist) break;
      }
    }

    if (foundSimilarDist) {
      let { direction: dir, refPointsA, refPointsB, dist } = foundSimilarDist;
      let { left: tl, top: tt, bottom: tb, right: tr, width: tw, height: th } = targetRefPoints;
      let { left: al, top: at, bottom: ab, right: ar, width: aw, height: ah } = refPointsA;
      let { left: bl, top: bt, bottom: bb, right: br } = refPointsB;

      let startXa = dir === 'left' ? tl : dir === 'right' ? tr : tl + tw / 2;
      let startYa = dir === 'bottom' ? tb : dir === 'top' ? tt : tt + th / 2;
      let endXa = dir === 'left' ? startXa - dist : dir === 'right' ? startXa + dist : tl + tw / 2;
      let endYa = dir === 'bottom' ? startYa + dist : dir === 'top' ? startYa - dist : tt + th / 2;

      let startXb = dir === 'left' ? al : dir === 'right' ? ar : al + aw / 2;
      let startYb = dir === 'bottom' ? ab : dir === 'top' ? at : at + ah / 2;
      let endXb = dir === 'left' ? br : dir === 'right' ? bl : al + aw / 2;
      let endYb = dir === 'bottom' ? bt : dir === 'top' ? bb : at + ah / 2;

      if (snap && !maxHPriority && (dir === 'right' || dir === 'left')) {
        maxHPriority = 10;

        let sign = dir === 'right' ? -1 : 1;
        dragOffsetX = (foundSimilarDist.dist - (targetR || targetL).dist) * sign;
        startXa += dragOffsetX;
        endXa += dragOffsetX;
      }

      if (snap && !maxVPriority && (dir === 'top' || dir === 'bottom')) {
        maxVPriority = 10;
        let sign = dir === 'top' ? -1 : 1;
        dragOffsetY = ((targetT || targetB).dist - foundSimilarDist.dist) * sign;
        startYa += dragOffsetY;
        endYa += dragOffsetY;
      }

      guideSpecs.push({
        type: 'line',
        epiMorph: true,
        hasFixedPosition: true,
        start: tfm.transformPoint(pt(startXb, startYb)),
        end: tfm.transformPoint(pt(endXb, endYb)),
        fill: Color.orange,
        height: guideWidth,
        guideType: dir,
        priority: 10
      }, {
        type: 'line',
        epiMorph: true,
        hasFixedPosition: true,
        start: tfm.transformPoint(pt(startXa, startYa)),
        end: tfm.transformPoint(pt(endXa, endYa)),
        fill: Color.orange,
        height: guideWidth,
        guideType: dir,
        priority: 10
      });
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // snap
  if (snap && (dragOffsetX || dragOffsetY)) {
    target.moveBy(pt(dragOffsetX, dragOffsetY));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // show guide lines
  if (showGuides) {
    guideSpecs = guideSpecs.filter(({ guideType, priority }) =>
      guideType === 'h'
        ? priority === maxHPriority
        : guideType === 'v' ? priority === maxVPriority : true);

    let dragGuides = cachedGuideLines.get(target);
    if (!dragGuides) cachedGuideLines.set(target, dragGuides = []);
    let i = 0;
    for (; i < guideSpecs.length; i++) {
      let guide;
      if (dragGuides[i]) guide = Object.assign(dragGuides[i], guideSpecs[i]);
      else { guide = morph(guideSpecs[i]); dragGuides.push(guide); }
      if (!guide.owner) world.addMorph(guide);
    }
    // dragGuides.splice(i, dragGuides.length-i).forEach(ea => ea.remove());
    dragGuides.slice(i).forEach(ea => ea.remove());

    fun.debounceNamed(target.id + '-drag-guides-cleanup', 1300, () => {
      let dragGuides = cachedGuideLines.get(target);
      if (!dragGuides) return;
      dragGuides.forEach(ea => ea.remove());
    })();
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// finding morphs with same width/heights

/**
 * Finds morphs with the same widths/heights.
 * @param { Morph } refMorph - The morph to be used as the reference for width/height.
 * @param { ('x'|'y'|'xy') } axis - The axis along which similarity should be checked for.
 * @param { Morph[] } others - The collection of morphs to scan for similar widths and/or heights.
 * @param { number } eps - The tolerance interval within which we consider a length "similar".
 * @param { number } distCutoff - The maximum distance up to which to consider morphs.
 * @returns { Map.<Morph, {similarIn: "width"|"height", valA: number, valB: number, delta: number, minDist: number }> }
 */
function findMorphsWithSimilarWidthOrHeight (refMorph, axis, others, eps = 15, distCutoff = Infinity) {
  let result; let refPoints = computeRefPoints(refMorph.bounds());

  for (let i = 0; i < others.length; i++) {
    let m = others[i];
    if (m === refMorph) continue;

    let refPointsM = computeRefPoints(m.bounds());
    let distLeft = Math.max(0, refPoints.left - refPointsM.right);
    let distRight = Math.max(0, refPointsM.left - refPoints.right);
    let distTop = Math.max(0, refPoints.top - refPointsM.bottom);
    let distBottom = Math.max(0, refPointsM.top - refPoints.bottom);
    let minDist = Math.min(distBottom, distTop, distRight, distLeft);
    let maxDist = Math.max(distBottom, distTop, distRight, distLeft);

    if (Math.max(distBottom, distTop, distRight, distLeft) > distCutoff) continue;

    let { width: widthA, height: heightA } = refPoints;
    let { width: widthB, height: heightB } = refPointsM;
    let widthDelta = widthB - widthA;
    let heightDelta = heightB - heightA;
    if ((axis === 'x' || axis === 'xy') && Math.abs(widthDelta) <= eps) {
      if (!result) result = new Map();
      result.set(m, {
        similarIn: 'width',
        minDist,
        maxDist,
        refPointsA: refPoints,
        refPointsB: refPointsM,
        valA: widthA,
        valB: widthB,
        delta: widthDelta
      });
    }

    if ((axis === 'y' || axis === 'xy') && Math.abs(heightDelta) <= eps) {
      if (!result) result = new Map();
      result.set(m, {
        similarIn: 'height',
        minDist,
        maxDist,
        refPointsA: refPoints,
        refPointsB: refPointsM,
        valA: heightA,
        valB: heightB,
        delta: heightDelta
      });
    }
  }

  return result;
}

/**
 * Constraints the extent of a morph based on width/heights of its siblings
 * and shows guides.
 * @param { Morph } target - The target to show the snap guides for.
 * @param { 'left'|'top'|'right'|'bottom' } sides - The sides to check for.
 * @param { boolean } [showGuides=true] - Wether or not to display the guides.
 * @param { boolean } [snap=true] - Wether or not to snap the target to the guides.
 * @param { number } [eps=5] - The snapping tolerance.
 * @param { number } [maxDist=100] - The maximum distance to check for guides.
 */
export function showAndSnapToResizeGuides (
  target, sides,
  showGuides = true, snap = true,
  eps = 5, maxDist = 100
) {
  if (!showGuides && !snap) return;

  let owner = target.owner;
  let world = owner.world();
  let tfm = owner.getGlobalTransform();
  let morphsForGuides = target.owner.submorphs.filter(ea =>
    ea !== target && !ea.isEpiMorph && ea.visible && ea.reactsToPointer);
  let axis = (sides.includes('left') || sides.includes('right') ? 'x' : '') + (sides.includes('top') || sides.includes('bottom') ? 'y' : '');
  let similarExtents = findMorphsWithSimilarWidthOrHeight(target, axis, morphsForGuides, eps, maxDist);
  let widthPriority = -Infinity; let heightPriority = -Infinity;
  let offsetRight = 0; let offsetLeft = 0;
  let offsetTop = 0; let offsetBottom = 0;
  let maxHPriority = 0; let maxVPriority = 0;
  let guideSpecs = [];

  // adjust world scroll in transform
  tfm.e -= world.scroll.x;
  tfm.f -= world.scroll.y;

  if (similarExtents) {
    for (let [_, { similarIn, delta, refPointsA, refPointsB, minDist }] of similarExtents) {
      let priority = eps - delta + (maxDist - minDist);
      if (similarIn === 'width') {
        if (widthPriority < priority) {
          widthPriority = priority;
          if (sides.includes('left')) offsetLeft = -delta;
          if (sides.includes('right')) offsetRight = delta;
        }
      } else {
        if (heightPriority < priority) {
          heightPriority = priority;
          if (sides.includes('top')) offsetTop = -delta;
          if (sides.includes('bottom')) offsetBottom = delta;
        }
      }

      let specA = {
        type: 'line',
        epiMorph: true,
        hasFixedPosition: true,
        height: guideWidth,
        fill: guideColor,
        guideType: similarIn,
        priority,
        start: tfm.transformPoint(
          similarIn === 'width'
            ? pt(refPointsA.left, refPointsA.top + refPointsA.height / 2)
            : pt(refPointsA.left + refPointsA.width / 2, refPointsA.top)),
        end: tfm.transformPoint(
          similarIn === 'width'
            ? pt(refPointsA.right, refPointsA.top + refPointsA.height / 2)
            : pt(refPointsA.left + refPointsA.width / 2, refPointsA.bottom))
      };
      let specB = {
        ...specA,
        start: tfm.transformPoint(
          similarIn === 'width'
            ? pt(refPointsB.left, refPointsB.top + refPointsB.height / 2)
            : pt(refPointsB.left + refPointsB.width / 2, refPointsB.top)),
        end: tfm.transformPoint(
          similarIn === 'width'
            ? pt(refPointsB.right, refPointsB.top + refPointsB.height / 2)
            : pt(refPointsB.left + refPointsB.width / 2, refPointsB.bottom))
      };
      guideSpecs.push(specA, specB);
    }
  }

  let fromEdges = sides; let toEdges;
  let aligned = findAlignedMorphs(target, morphsForGuides, eps, maxDist, fromEdges, toEdges);

  if (aligned) {
    for (let [_, { horizontal, vertical }] of aligned) {
      for (let { delta, edgeAVal, refPointsA, refPointsB, edgeBVal, maxDist } of horizontal) {
        let priority = Math.ceil(eps - delta);
        let top = Math.min(refPointsA.top, refPointsB.top);
        let bottom = Math.max(refPointsA.bottom, refPointsB.bottom);

        if (maxDist > eps) priority -= eps / 2;

        if (maxHPriority < priority) {
          maxHPriority = priority;
          if (sides.includes('left')) offsetLeft = -(edgeBVal - edgeAVal);
          if (sides.includes('right')) offsetRight = +(edgeBVal - edgeAVal);
        }

        guideSpecs.push({
          type: 'line',
          epiMorph: true,
          hasFixedPosition: true,
          height: guideWidth,
          start: tfm.transformPoint(pt(edgeBVal, top)),
          end: tfm.transformPoint(pt(edgeBVal, bottom)),
          fill: guideColor,
          guideType: 'h',
          priority
        });
      }

      for (let { delta, edgeAVal, refPointsA, refPointsB, edgeBVal, maxDist } of vertical) {
        let priority = Math.ceil(eps - delta);
        let left = Math.min(refPointsA.left, refPointsB.left);
        let right = Math.max(refPointsA.right, refPointsB.right);

        if (maxDist > eps) priority -= eps / 2;

        if (maxVPriority < priority && Math.abs(edgeBVal - edgeAVal) <= eps) {
          maxVPriority = priority;
          if (sides.includes('top')) offsetTop = edgeBVal - edgeAVal;
          if (sides.includes('bottom')) offsetBottom = edgeBVal - edgeAVal;
        }

        guideSpecs.push({
          type: 'line',
          epiMorph: true,
          hasFixedPosition: true,
          height: guideWidth,
          start: tfm.transformPoint(pt(left, edgeBVal)),
          end: tfm.transformPoint(pt(right, edgeBVal)),
          fill: guideColor,
          guideType: 'v',
          priority
        });
      }
    }
  }

  // snap
  if (snap) {
    if (offsetLeft) {
      target.left += offsetLeft;
      target.right -= offsetLeft;
    }
    if (offsetTop) {
      target.top += offsetTop;
      target.bottom -= offsetTop;
    }
    if (offsetRight) target.width += offsetRight;
    if (offsetBottom) target.height += offsetBottom;
  }

  // show guide lines
  if (showGuides) {
    guideSpecs = guideSpecs.filter(({ guideType, priority }) =>
      guideType === 'width'
        ? priority === widthPriority
        : guideType === 'height'
          ? priority === heightPriority
          : guideType === 'v'
            ? priority === maxVPriority
            : guideType === 'h' ? priority === maxHPriority : false);

    let dragGuides = cachedGuideLines.get(target);
    if (!dragGuides) cachedGuideLines.set(target, dragGuides = []);
    let i = 0;
    for (; i < guideSpecs.length; i++) {
      let guide;
      if (dragGuides[i]) guide = Object.assign(dragGuides[i], guideSpecs[i]);
      else { guide = morph(guideSpecs[i]); dragGuides.push(guide); }
      if (!guide.owner) world.addMorph(guide);
    }

    dragGuides.slice(i).forEach(ea => ea.remove());

    fun.debounceNamed(target.id + '-drag-guides-cleanup', 1300, () => {
      let dragGuides = cachedGuideLines.get(target);
      if (!dragGuides) return;
      dragGuides.forEach(ea => ea.remove());
    })();
  }
}
