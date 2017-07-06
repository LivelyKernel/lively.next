import { debounceNamed } from "lively.lang/function.js";
import { pt, rect, Transform, Rectangle, Color } from "lively.graphics";
import { detent } from "lively.lang/number.js";
import { show, morph } from "lively.morphic";

const cachedGuideLines = new WeakMap();

const guideWidth = 4,
      guideColor = Color.orange.lighter();

export function removeSnapToGuidesOf(target) {
  let dragGuides = cachedGuideLines.get(target);
  if (!dragGuides) return;
  dragGuides.forEach(ea => ea.remove());
  // cachedGuideLines.delete(target);
}

export function showAndSnapToGuides(target, showGuides = true, snap = true, eps = 10, maxDist = 100) {
  if (!showGuides && !snap) return;

  let owner = target.owner,
      world = owner.world(),
      tfm = owner.getGlobalTransform(),
      morphsForGuides = target.owner.submorphs.filter(ea =>
          ea !== target && !ea.isEpiMorph && ea.visible && ea.reactsToPointer),
      fromEdges = ["left", "top", "right", "bottom", "hCenter", "vCenter"],
      toEdges = ["left", "top", "right", "bottom", "hCenter", "vCenter"],
      aligned = findAlignedMorphs(target, morphsForGuides, eps, maxDist, fromEdges, toEdges),
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
          height: 2,
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
          height: 2,
          start: tfm.transformPoint(pt(left, edgeBVal)),
          end: tfm.transformPoint(pt(right, edgeBVal)),
          fill: guideColor,
          guideType: "v", priority
        });
      }
    }
  }


  // try to constrain based on spacing between morphs
  if (!maxHPriority || !maxVPriority) {
    let morphs = [target, ...morphsForGuides],
        closest = computeClosestMorphs(morphs),
        targetRefPoints,
        {l: targetL, r: targetR, t: targetT, b: targetB} = closest[0],
        foundSimilarDist;

    if (targetL || targetR || targetT || targetB) {
      targetRefPoints = (targetL || targetR || targetT || targetB).refPointsA;
      for (let i = 1; i < closest.length; i++) {
        let {l, r, t, b} = closest[i];

        if (!maxHPriority) {
          if (targetL && l && targetL.index !== l.index && Math.abs(l.dist - targetL.dist) <= eps)      foundSimilarDist = {neighbor: i, direction: "left", ...l};
          else if (targetR && r && targetR !== r.index && Math.abs(r.dist - targetR.dist) <= eps) foundSimilarDist = {neighbor: i, direction: "right", ...r};
        }
        if (!maxVPriority) {
          if (targetT && t && targetT.index !== t.index && Math.abs(t.dist - targetT.dist) <= eps) foundSimilarDist = {neighbor: i, direction: "top", ...t};
          else if (targetB && b && targetB.index !== b.index && Math.abs(b.dist - targetB.dist) <= eps) foundSimilarDist = {neighbor: i, direction: "bottom", ...b};
        }

        if (foundSimilarDist) break;
      }
    }

    if (foundSimilarDist) {

      let {direction: dir, refPointsA, refPointsB, dist} = foundSimilarDist,
          {left: tl, top: tt, bottom: tb, right: tr, width: tw, height: th} = targetRefPoints,
          {left: al, top: at, bottom: ab, right: ar, width: aw, height: ah} = refPointsA,
          {left: bl, top: bt, bottom: bb, right: br, width: bw, height: bh} = refPointsB;

      let startXa = dir === "left" ? tl : dir === "right" ? tr : tl + tw/2,
          startYa = dir === "bottom" ? tb : dir === "top" ? tt : tt + th/2,
          endXa = dir === "left" ? startXa-dist : dir === "right" ? startXa+dist : tl + tw/2,
          endYa = dir === "bottom" ? startYa+dist : dir === "top" ? startYa-dist : tt + th/2;

      let startXb = dir === "left" ? al : dir === "right" ? ar : al + aw/2,
          startYb = dir === "bottom" ? ab : dir === "top" ? at : at + ah/2,
          endXb = dir === "left" ? br : dir === "right" ? bl : al + aw/2,
          endYb = dir === "bottom" ? bt : dir === "top" ? bb : at + ah/2;


      if (snap && !maxHPriority && (dir === "right" || dir === "left")) {
        maxHPriority = 10;

        let sign = dir === "right" ? -1 : 1
        dragOffsetX = (foundSimilarDist.dist - (targetR || targetL).dist) * sign
        startXa += dragOffsetX;
        endXa += dragOffsetX;
      }

      if (snap && !maxVPriority && (dir === "top" || dir === "bottom")) {
        maxVPriority = 10;
        let sign = dir === "top" ? -1 : 1
        dragOffsetY = ((targetT || targetB).dist - foundSimilarDist.dist) * sign
        startYa += dragOffsetY;
        endYa += dragOffsetY;
      }


      guideSpecs.push({
        type: "line",
        epiMorph: true,
        start: tfm.transformPoint(pt(startXb, startYb)),
        end: tfm.transformPoint(pt(endXb, endYb)),
        fill: Color.orange,
        height: 2,
        guideType: dir, priority: 10
      }, {
        type: "line",
        epiMorph: true,
        start: tfm.transformPoint(pt(startXa, startYa)),
        end: tfm.transformPoint(pt(endXa, endYa)),
        fill: Color.orange,
        height: 2,
        guideType: dir, priority: 10
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
      let guide;
      if (dragGuides[i]) guide = Object.assign(dragGuides[i], guideSpecs[i]);
      else { guide = morph(guideSpecs[i]); dragGuides.push(guide); }
      if (!guide.owner) world.addMorph(guide);
    }
    // dragGuides.splice(i, dragGuides.length-i).forEach(ea => ea.remove());
    dragGuides.slice(i).forEach(ea => ea.remove());

    debounceNamed(target.id + "-drag-guides-cleanup", 1300, () => {
      let dragGuides = cachedGuideLines.get(target);
      if (!dragGuides) return;
      dragGuides.forEach(ea => ea.remove());
    })();
  }

}

export function showAndSnapToResizeGuides(
  target, sides /*[left,top,bottom,right]*/,
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
      axis = (sides.includes("left") || sides.includes("right") ? "x" : "") + (sides.includes("top") || sides.includes("bottom") ? "y" : ""),
      similarExtents = findMorphsWithSimilarWidthOrHeight(target, axis, morphsForGuides, eps, maxDist),
      widthPriority = -Infinity, heightPriority = -Infinity,
      offsetRight = 0, offsetLeft = 0,
      offsetTop = 0, offsetBottom = 0,
      maxHPriority = 0, maxVPriority = 0,
      guideSpecs = [];

  if (similarExtents) {

    for (let [m, {similarIn, delta, valA, valB, refPointsA, refPointsB, minDist}] of similarExtents) {
      let priority = eps - delta + (maxDist - minDist);
      if (similarIn === "width") {
        if (widthPriority < priority) {
          widthPriority = priority;
          if (sides.includes("left")) offsetLeft = -delta;
          if (sides.includes("right")) offsetRight = delta;
        }
      } else {
        if (heightPriority < priority) {
          heightPriority = priority;
          if (sides.includes("top")) offsetTop = -delta;
          if (sides.includes("bottom")) offsetBottom = delta;
        }
      }

      let color = guideColor,
          specA = {
            type: "line",
            epiMorph: true,
            height: 4,
            fill: guideColor,
            guideType: similarIn, priority,
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
  
  // if (!guideSpecs.length) {
  
    let fromEdges = sides, toEdges,
        aligned = findAlignedMorphs(target, morphsForGuides, eps, maxDist, fromEdges, toEdges);

    if (aligned) {
      for (let [m, {horizontal, vertical}] of aligned) {
        
        for (let {delta, edgeA, edgeAVal, edgeB, refPointsA, refPointsB, edgeBVal, maxDist} of horizontal) {
          
          let priority = Math.ceil(eps - delta),
              top = Math.min(refPointsA.top, refPointsB.top),
              bottom = Math.max(refPointsA.bottom, refPointsB.bottom);
          
          if (maxDist > eps) priority -= eps/2;
          
          if (maxHPriority < priority) {
            maxHPriority = priority;
            if (sides.includes("left")) offsetLeft = -(edgeBVal - edgeAVal);
            if (sides.includes("right")) offsetRight = +(edgeBVal - edgeAVal);
          }
          
          guideSpecs.push({
            type: "line",
            epiMorph: true,
            height: 2,
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
            // offsetHeight = offsetHeight + edgeBVal - edgeAVal;
            if (sides.includes("top")) offsetTop = edgeBVal - edgeAVal;
            if (sides.includes("bottom")) offsetBottom = edgeBVal - edgeAVal;
          }
          
          guideSpecs.push({
            type: "line",
            epiMorph: true,
            height: 2,
            start: tfm.transformPoint(pt(left, edgeBVal)),
            end: tfm.transformPoint(pt(right, edgeBVal)),
            fill: guideColor,
            guideType: "v", priority
          });
        }
      }
    }
  // }

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
    guideSpecs = guideSpecs.filter(({guideType, priority}) =>
      guideType === "width" ? priority === widthPriority :
        guideType === "height" ? priority === heightPriority : 
          guideType === "v" ? priority === maxVPriority : 
            guideType === "h" ? priority === maxHPriority : false);

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

    debounceNamed(target.id + "-drag-guides-cleanup", 1300, () => {
      let dragGuides = cachedGuideLines.get(target);
      if (!dragGuides) return;
      dragGuides.forEach(ea => ea.remove());
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
  fromEdges, toEdges,
  distLeft = 0, distTop = 0, distRight = 0, distBottom = 0, maxDist = 0
) {
  let vertical = [], horizontal = [];

  for (let i = 0; i < edges.length; i++) {
    let [type, edgeA, edgeB] = edges[i],
        edgeAVal = refPointsA[edgeA],
        edgeBVal = refPointsB[edgeB],
        delta = Math.max(edgeAVal, edgeBVal) - Math.min(edgeAVal, edgeBVal);
    if (delta > eps) continue;
    if (fromEdges && !fromEdges.includes(edgeA)) continue;
    if (toEdges && !toEdges.includes(edgeB)) continue;

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

function findAlignedMorphs(refMorph, submorphs, eps = 15, distCutoff = Infinity, fromEdges, toEdges) {
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
      fromEdges, toEdges,
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
