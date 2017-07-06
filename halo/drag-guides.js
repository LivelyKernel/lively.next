import { debounceNamed } from "lively.lang/function.js";
import { pt, Rectangle, Color } from "lively.graphics";
import { detent } from "lively.lang/number.js";
import { show } from "lively.morphic";

const cachedGuideLines = new WeakMap();

const guideWidth = 4,
      guideColor = Color.orange.lighter();

export function removeSnapToGuidesOf(target) {
  let dragGuides = cachedGuideLines.get(target);
  if (!dragGuides) return;
  dragGuides.forEach(ea => ea.remove());
  cachedGuideLines.delete(target);
}

export function showAndSnapToGuides(target, showGuides = true, snap = true, eps = 5, maxDist = 100) {
  if (!showGuides && !snap) return;

  let owner = target.owner,
      world = owner.world(),
      tfm = owner.getGlobalTransform(),
      morphsForGuides = target.owner.submorphs.filter(ea =>
          ea !== target && !ea.isEpiMorph && ea.visible && ea.reactsToPointer);

  // if (!morphsForGuides.length) return;

  let aligned = findAlignedMorphs(target, morphsForGuides, eps, maxDist),
      guideSpecs = [],
      maxHPriority = 0, maxVPriority = 0,
      dragOffsetX = 0, dragOffsetY = 0;


  // compute guides and drag offset for snapping
  if (aligned) {
    for (let [m, {horizontal, vertical}] of aligned) {

      for (let {delta, edgeA, edgeAVal, edgeB, refPointsA, refPointsB, edgeBVal, maxDist} of horizontal) {

        let priority = Math.ceil(eps - delta),
            top = Math.min(refPointsA.top, refPointsB.top),
            bottom = Math.max(refPointsA.bottom, refPointsB.bottom);

        if (maxDist > eps) priority -= eps/2;

        if (maxHPriority < priority) {
          maxHPriority = priority;
          dragOffsetX = edgeBVal - edgeAVal;
        }

        guideSpecs.push({
          type: "line",
          epiMorph: true,
          start: tfm.transformPoint(pt(edgeBVal, top)),
          end: tfm.transformPoint(pt(edgeBVal, bottom)),
          fill: guideColor,
          guideType: "h", priority
        });
      }

      for (let {delta, edgeA, edgeAVal, edgeB, refPointsA, refPointsB, edgeBVal, maxDist} of vertical) {
        let priority = Math.ceil(eps - delta),
            left = Math.min(refPointsA.left, refPointsB.left),
            right = Math.max(refPointsA.right, refPointsB.right);

        if (maxDist > eps) priority -= eps/2;

        if (maxVPriority < priority && Math.abs(edgeBVal - edgeAVal) <= eps) {
          maxVPriority = priority;
          dragOffsetY = edgeBVal - edgeAVal;
        }
        
        guideSpecs.push({
          type: "line",
          epiMorph: true,
          start: tfm.transformPoint(pt(left, edgeBVal)),
          end: tfm.transformPoint(pt(right, edgeBVal)),
          fill: guideColor,
          guideType: "v", priority
        });
      }
    }
    

  } 
  // else
  {
    // try to constrain based on spacing between morphs
    let morphs = [target, ...morphsForGuides];
    let closest = computeClosestMorphs(morphs);
    let targetRefPoints;
    let {l: targetL, r: targetR, t: targetT, b: targetB} = closest[0];
    let foundSimilarDist;
    

    if (targetL || targetR || targetT || targetB) {
      targetRefPoints = (targetL || targetR || targetT || targetB).refPointsA;
      for (let i = 1; i < closest.length; i++) {
        let {l, r, t, b} = closest[i];
        if (targetL && l && targetL.index !== l.index && Math.abs(l.dist - targetL.dist) <= eps)      foundSimilarDist = {neighbor: i, direction: "left", ...l};
        else if (targetR && r && targetR !== r.index && Math.abs(r.dist - targetR.dist) <= eps) foundSimilarDist = {neighbor: i, direction: "right", ...r};
        else if (targetT && t && targetT.index !== t.index && Math.abs(t.dist - targetT.dist) <= eps) foundSimilarDist = {neighbor: i, direction: "top", ...t};
        else if (targetB && b && targetB.index !== b.index && Math.abs(b.dist - targetB.dist) <= eps) foundSimilarDist = {neighbor: i, direction: "bottom", ...b};
        else continue;
        break;
      }
    }

    if (foundSimilarDist) {
      let {direction, refPointsA, refPointsB} = foundSimilarDist;

      let startXa = direction === "left" ? targetRefPoints.left :
            direction === "right" ? targetRefPoints.right :
              targetRefPoints.left + targetRefPoints.width/2,
          startYa = direction === "bottom" ? targetRefPoints.bottom :
            direction === "top" ? targetRefPoints.top :
              targetRefPoints.top + targetRefPoints.height/2,
          endXa = direction === "left" ? refPointsA.right :
                    direction === "right" ? refPointsA.left :
                      targetRefPoints.left + targetRefPoints.width/2,
          endYa = direction === "bottom" ? refPointsA.top :
              direction === "top" ? refPointsA.bottom :
                targetRefPoints.top + targetRefPoints.height/2;

      let startXb = direction === "left" ? refPointsA.left :
            direction === "right" ? refPointsA.right :
              refPointsA.left + refPointsA.width/2,
          startYb = direction === "bottom" ? refPointsA.bottom :
            direction === "top" ? refPointsA.top :
              refPointsA.top + refPointsA.height/2,
          endXb = direction === "left" ? refPointsB.right :
                    direction === "right" ? refPointsB.left :
                      refPointsA.left + refPointsA.width/2,
          endYb = direction === "bottom" ? refPointsB.top :
              direction === "top" ? refPointsB.bottom :
                refPointsA.top + refPointsA.height/2;

      guideSpecs.push({
        type: "line",
        epiMorph: true,
        start: tfm.transformPoint(pt(startXb, startYb)),
        end: tfm.transformPoint(pt(endXb, endYb)),
        fill: Color.orange,
        height: 3,
        guideType: direction, priority: 10
      }, {
        type: "line",
        epiMorph: true,
        start: tfm.transformPoint(pt(startXa, startYa)),
        end: tfm.transformPoint(pt(endXa, endYa)),
        fill: Color.orange,
        height: 3,
        guideType: direction, priority: 10
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
    guideSpecs = guideSpecs.filter(({guideType, priority}) =>
      guideType === "h" ? priority === maxHPriority :
        guideType === "v" ? priority === maxVPriority : true);

    let dragGuides = cachedGuideLines.get(target);
    if (!dragGuides) cachedGuideLines.set(target, dragGuides = []);
    let i = 0;
    for (; i < guideSpecs.length; i++) {
      if (dragGuides[i]) Object.assign(dragGuides[i], guideSpecs[i]);
      else dragGuides.push(world.addMorph(guideSpecs[i]));
    }
    dragGuides.splice(i, dragGuides.length-i).forEach(ea => ea.remove());

    debounceNamed(target.id + "-drag-guides-cleanup", 1300, () => {
      let dragGuides = cachedGuideLines.get(target);
      if (!dragGuides) return;
      dragGuides.forEach(ea => ea.remove());
      dragGuides.length = 0;
    })();
  }

}

export function showAndSnapToResizeGuides(
  target, axis /*= "x"|"y"|"xy"*/,
  showGuides = true, snap = true,
  eps = 5, maxDist = 100
) {

  // constraints the extent of a morph based on width/heights of its siblings
  // shows guides

  // showAndSnapToResizeGuides(that)
  // target = that, showGuides = true, snap = true, eps = 5, maxDist = 100

  if (!showGuides && !snap) return;

  let owner = target.owner,
      world = owner.world(),
      tfm = owner.getGlobalTransform(),
      morphsForGuides = target.owner.submorphs.filter(ea =>
          ea !== target && !ea.isEpiMorph && ea.visible && ea.reactsToPointer),
      similarExtents = findMorphsWithSimilarWidthOrHeight(target, axis, morphsForGuides, eps, maxDist),
      widthPriority = -Infinity,
      heightPriority = -Infinity,
      offsetWidth = 0, offsetHeight = 0,
      guideSpecs = [];

  if (similarExtents) {

    for (let [m, {similarIn, delta, valA, valB, refPointsA, refPointsB, minDist}] of similarExtents) {
      let priority = eps - delta + (maxDist - minDist);
      if (similarIn === "width") {
        if (widthPriority < priority) {
          widthPriority = priority;
          offsetWidth = -delta
        }        
      } else {
        if (heightPriority < priority) {
          heightPriority = priority;
          offsetHeight = -delta;
        }
      }

      let color = guideColor,
          specA = {
            type: "line",
            epiMorph: true,
            height: guideWidth,
            fill: guideColor,
            guideType: similarIn === "width" ? "w" : "h", priority,
            start: tfm.transformPoint(
              similarIn === "width"
              ? pt(refPointsA.left, refPointsA.top+refPointsA.height/2)
              : pt(refPointsA.left+refPointsA.width/2, refPointsA.top)),
            end: tfm.transformPoint(
              similarIn === "width"
              ? pt(refPointsA.right, refPointsA.top+refPointsA.height/2)
              : pt(refPointsA.left+refPointsA.width/2, refPointsA.bottom)),
          },
          specB = {
            ...specA,
            start: tfm.transformPoint(
              similarIn === "width"
              ? pt(refPointsB.left, refPointsB.top+refPointsB.height/2)
              : pt(refPointsB.left+refPointsB.width/2, refPointsB.top)),
            end: tfm.transformPoint(
              similarIn === "width"
              ? pt(refPointsB.right, refPointsB.top+refPointsB.height/2)
              : pt(refPointsB.left+refPointsB.width/2, refPointsB.bottom)),
          }
      guideSpecs.push(specA, specB);
    }
  }

  // snap
  if (snap && offsetWidth) target.width -= offsetWidth;
  if (snap && offsetHeight) target.height -= offsetHeight;

  // show guide lines
  if (showGuides) {
    guideSpecs = guideSpecs.filter(({guideType, priority}) =>
      guideType === "w" ? priority === widthPriority :
        guideType === "h" ? priority === heightPriority : false);

    let dragGuides = cachedGuideLines.get(target);
    if (!dragGuides) cachedGuideLines.set(target, dragGuides = []);
    let i = 0;
    for (; i < guideSpecs.length; i++) {
      if (dragGuides[i]) Object.assign(dragGuides[i], guideSpecs[i]);
      else dragGuides.push(world.addMorph(guideSpecs[i]));
    }
    dragGuides.splice(i, dragGuides.length-i).forEach(ea => ea.remove());

    debounceNamed(target.id + "-drag-guides-cleanup", 1300, () => {
      let dragGuides = cachedGuideLines.get(target);
      if (!dragGuides) return;
      dragGuides.forEach(ea => ea.remove());
      dragGuides.length = 0;
    })();
  }
  
}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// stuff below is for edge alignment computation, does not modify anything
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// here we find aligning edges

const edges = [
  ["vertical",   "top",     "top"],
  ["vertical",   "vCenter", "top"],
  ["vertical",   "bottom",  "top"],
  ["vertical",   "top",     "vCenter"],
  ["vertical",   "vCenter", "vCenter"],
  ["vertical",   "bottom",  "vCenter"],
  ["vertical",   "top",     "bottom"],
  ["vertical",   "vCenter", "bottom"],
  ["vertical",   "bottom",  "bottom"],
  ["horizontal", "left",    "left"],
  ["horizontal", "hCenter", "left"],
  ["horizontal", "right",   "left"],
  ["horizontal", "left",    "hCenter"],
  ["horizontal", "hCenter", "hCenter"],
  ["horizontal", "right",   "hCenter"],
  ["horizontal", "left",    "right"],
  ["horizontal", "hCenter", "right"],
  ["horizontal", "right",   "right"],
];


function computeRefPoints(bounds) {
  let {x: left, y: top, width, height} = bounds,
      hCenter = left + width/2,
      vCenter = top + height/2,
      right = left + width,
      bottom = top + height;
  return {left, top, hCenter, vCenter, right, bottom, width, height};
}

function findEdgesInAlignment(
  refPointsA, refPointsB, eps = 15,
   distLeft = 0, distTop = 0, distRight = 0, distBottom = 0, maxDist = 0
) {
  let vertical = [], horizontal = [];
  for (let i = 0; i < edges.length; i++) {
    let [type, edgeA, edgeB] = edges[i],
        edgeAVal = refPointsA[edgeA],
        edgeBVal = refPointsB[edgeB],
        delta = Math.max(edgeAVal, edgeBVal) - Math.min(edgeAVal, edgeBVal);
    if (delta > eps) continue;

    let result = type === "vertical" ? vertical : horizontal;
    result.push({
      delta,
      edgeA, edgeB,
      edgeAVal, edgeBVal,
      refPointsA, refPointsB,
      distLeft, distTop, distRight, distBottom, maxDist
    });
  }
  return vertical.length || horizontal.length ? {vertical, horizontal} : null;
}

function findAlignedMorphs(refMorph, submorphs, eps = 15, distCutoff = Infinity) {
  // Map(morph => {
  //   horizontal: [{delta, edgeA/B, edgeA/BVal, refPointsA/B, dist[Left,...]}]
  // })
  let result, refPoints = computeRefPoints(refMorph.bounds());

  for (let i = 0; i < submorphs.length; i++) {
    let m = submorphs[i];
    if (m === refMorph) continue;

    let refPointsM = computeRefPoints(m.bounds()),
        distLeft =   Math.max(0, refPoints.left - refPointsM.right),
        distRight =  Math.max(0, refPointsM.left - refPoints.right),
        distTop =    Math.max(0, refPoints.top - refPointsM.bottom),
        distBottom = Math.max(0, refPointsM.top - refPoints.bottom),
        maxDist =    Math.max(distBottom, distTop, distRight, distLeft);

    if (Math.max(distBottom, distTop, distRight, distLeft) > distCutoff) continue;

    let found = findEdgesInAlignment(
      refPoints, refPointsM, eps,
      distLeft, distTop, distRight, distBottom, maxDist);
    if (!found) continue;
    if (!result) result = new Map();
    result.set(m, found);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // owner
  {
    let owner = refMorph.owner,
        refPointsO = computeRefPoints(owner.innerBounds());
    let found = findEdgesInAlignment(refPoints, refPointsO, eps);
    if (found) {
      if (!result) result = new Map();
      result.set(owner, found);
    }
  }

  return result;
}



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// finding morphs with same width/heights

function findMorphsWithSimilarWidthOrHeight(refMorph, axis, others, eps = 15, distCutoff = Infinity) {
  // returns
  // Map(morph => {similarIn: "width"|"height", valA, valB, delta, minDist})

  let result, refPoints = computeRefPoints(refMorph.bounds());

  for (let i = 0; i < others.length; i++) {
    let m = others[i];
    if (m === refMorph) continue;

    let refPointsM = computeRefPoints(m.bounds()),
        distLeft =   Math.max(0, refPoints.left - refPointsM.right),
        distRight =  Math.max(0, refPointsM.left - refPoints.right),
        distTop =    Math.max(0, refPoints.top - refPointsM.bottom),
        distBottom = Math.max(0, refPointsM.top - refPoints.bottom),
        minDist =    Math.min(distBottom, distTop, distRight, distLeft),
        maxDist =    Math.max(distBottom, distTop, distRight, distLeft);

    if (Math.max(distBottom, distTop, distRight, distLeft) > distCutoff) continue;

    let {width: widthA,height: heightA} = refPoints,
        {width: widthB,height: heightB} = refPointsM,
        widthDelta = widthB - widthA,
        heightDelta = heightB - heightA;
    if ((axis === "x" || axis === "xy") && Math.abs(widthDelta) <= eps) {
      if (!result) result = new Map();
      result.set(m, {
        similarIn: "width", minDist, maxDist,
        refPointsA: refPoints, refPointsB: refPointsM,
        valA: widthA, valB: widthB,
        delta: widthDelta
      });
    }

    if ((axis === "y" || axis === "xy") && Math.abs(heightDelta) <= eps) {
      if (!result) result = new Map();
      result.set(m, {
        similarIn: "height", minDist, maxDist,
        refPointsA: refPoints, refPointsB: refPointsM,
        valA: heightA, valB: heightB,
        delta: heightDelta
      });
    }
  }

  return result;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// finding closest neighbors
function closest(i/*morphIndex*/, morphs, refPoints, lefts, rights, tops, bottoms, overlappingProjected = true) {
  let l = lefts[i], r = rights[i], t = tops[i], b = bottoms[i],
      closestL, closestR, closestT, closestB;

  for (let j = 0; j < rights.length; j++) {
    if (i === j || l < rights[j] ||
        (closestL && rights[closestL.index] >= rights[j])) continue;
    if (overlappingProjected && bottoms[i] < tops[j] || tops[i] > bottoms[j]) continue;
    closestL = {index: j, dist: l - rights[j], refPointsA: refPoints[i], refPointsB: refPoints[j]};
  }

  for (let j = 0; j < lefts.length; j++) {
    if (i === j || r > lefts[j] ||
        (closestR && lefts[closestR.index] <= lefts[j])) continue;
    if (overlappingProjected && bottoms[i] < tops[j] || tops[i] > bottoms[j]) continue;
    closestR = {index: j, dist: lefts[j] - r, refPointsA: refPoints[i], refPointsB: refPoints[j]};
  }

  for (let j = 0; j < bottoms.length; j++) {
    if (i === j || t < bottoms[j] ||
        (closestT && bottoms[closestT.index] >= bottoms[j])) continue;
    if (overlappingProjected && lefts[i] > rights[j] || rights[i] < lefts[j]) continue;
    closestT = {index: j, dist: t - bottoms[j], refPointsA: refPoints[i], refPointsB: refPoints[j]};
  }
  
  for (let j = 0; j < tops.length; j++) {
    if (i === j || b > tops[j] ||
        (closestB && tops[closestB.index] <= tops[j])) continue;
    if (overlappingProjected && lefts[i] > rights[j] || rights[i] < lefts[j]) continue;
    closestB = {index: j, dist: tops[j] - b, refPointsA: refPoints[i], refPointsB: refPoints[j]};
  }
  return {l: closestL, r: closestR, t: closestT, b: closestB}
}

function computeClosestMorphs(morphs) {
  let lefts = [],
      rights = [],
      tops = [],
      bottoms = [],
      refPoints = [],
      result = [];
  
  for (let i = 0; i < morphs.length; i++) {
    let m = morphs[i];
    let rps = computeRefPoints(m.bounds());
    refPoints.push(rps);
    let {left,right,top,bottom} = rps;
    lefts.push(left);
    rights.push(right);
    tops.push(top);
    bottoms.push(bottom);
  }

  for (let i = 0; i < morphs.length; i++)
    result.push(closest(i, morphs, refPoints, lefts, rights, tops, bottoms));

  return result;
}
