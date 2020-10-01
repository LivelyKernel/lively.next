import { connect, once } from "lively.bindings";
import { Color, rect, pt } from "lively.graphics";
import { arr, promise, properties, Path, obj } from "lively.lang";
import { HorizontalLayout, Morph, VerticalLayout, StyleSheet, Icon, GridLayout, morph } from "lively.morphic";
import { TreeData, Tree } from "lively.components/tree.js";
import { Leash, LabeledCheckBox, SearchField } from "lively.components/widgets.js";
import {showConnector, show} from "lively.halos/markers.js"
import { InteractiveMorphSelector, MorphHighlighter } from "lively.halos/morph.js";
import Window from "lively.components/window.js";
import { classToFunctionTransform } from "lively.classes";

export function interactivelyShowConnection(connection) {
  let {sourceObj, sourceAttrName, targetObj, targetMethodName} = connection;
  if (sourceObj.isMorph && targetObj.isMorph) {
    sourceObj.show();
    targetObj.show();
    showConnector && showConnector(sourceObj, targetObj);
  } else show(String(connection));
}

export function printConnection(connection) {
  let {
        sourceObj, sourceAttrName, targetObj, targetMethodName
      } = connection,
      converter = connection.getConverter(),
      updater = connection.getUpdater();
  return printConnectionElements(
    sourceObj, sourceAttrName, targetObj, targetMethodName,
    converter, updater);
}


export function printConnectionElements(
  sourceObj, sourceAttr, targetObj, targetAttr,
  converter, updater
) {
  let source = `/* global connect, source, target */
connect(source, '${sourceAttr}', target, '${targetAttr}'`;
  if (converter || updater) source += ", {\n"
  if (converter) source += `  converter: ${converter}`
  if (converter && updater) source += ","
  if (converter) source += "\n"
  if (updater) source += `  updater: ${updater}\n`
  if (converter || updater) source += "}"
  source += ");"
  return source
}


export async function interactiveConnectGivenSource(sourceObj, sourceAttr) {
  let selected = await InteractiveMorphSelector.selectMorph();
  return selected ?
    interactiveConnectGivenSourceAndTarget(sourceObj, sourceAttr, selected) :
    null;
}

export async function interactiveConnectGivenSourceAndTarget(sourceObj, sourceAttr, targetObj, onConnect) {
  let bindings = targetObj && targetObj.world().targetDataBindings(targetObj),
      world = sourceObj.world(),
      prompts = [];
  if (!bindings || !bindings.length) {
    world.setStatusMessage("connect canceled"); return; }

  let items = bindings.map(
    group => [group[0].group || "uncategorized",
              group.map(ea => [
                ea.signature || ea.name, async () => await interactivelyEvaluateConnection(
                  {sourceObj, sourceAttr, targetObj, targetAttr: ea.name, onConnect})])]);


    items.push(["custom...", async () => {
      let targetAttr = await world.prompt("Enter custom connection point", {
            requester: $world,
            historyId: "lively.morphic-custom-connection-points",
            useLastInput: true
          })
      if (targetAttr) await interactivelyEvaluateConnection(
        {sourceObj, sourceAttr, targetObj, targetAttr, onConnect});
    }]);

  await targetObj.openMenu(items).whenFinished();
}

export async function interactivelyReEvaluateConnection(
  connection, prompt = "confirm connection", highlight, onConnect
) {
  let {
        sourceObj, sourceAttrName, targetObj, targetMethodName
      } = connection,
      converter = connection.getConverter(),
      updater = connection.getUpdater();
  return interactivelyEvaluateConnection({
    sourceObj, sourceAttr: sourceAttrName, targetObj, targetAttr: targetMethodName,
    converter, updater, prompt, highlight, onConnect});
}

export function visualizeConnection(m1, m2, existingLeash, leashStyle = {}, orientation = 'left') {
  // if m2 is not a morph, then render a data pointer (to open inspector)
  let sides = rect(0).sides.concat(rect(0).corners),
      leash = existingLeash || new Leash({
        isSmooth: true,
        styleClasses: ['Halo'],
        borderColor: Color.orange,
        epiMorph: true,
        endpointStyle: {
          start: {fill: Color.transparent, nativeCursor: "auto"},
          end: {fill: Color.orange}
        },
        ...leashStyle,
        hasFixedPosition: true
      });
  // fixme: the attachment points of the leashes should be parametrized...
  leash.startPoint.attachTo(m1, 'rightCenter');
  if (m2.isMorph) {
     var nearestPart = m2.globalBounds().partNameNearest(sides, m1.globalPosition);
     if (m1.globalPosition.equals(m2.globalBounds().partNamed(nearestPart))) {
       // pick another part, that is not exactly the same
       nearestPart = m2.globalBounds().partNameNearest(arr.without(sides, nearestPart), m1.globalPosition);
     }
     leash.endPoint.attachTo(m2, 'leftCenter');
  } else {
     let virtualNodePos = m1.globalBounds().topRight().addPt(pt(100,0)),
          visualPointer = morph({
           type: 'label', value: m2.toString(),
           styleClasses: ['Tooltip'] , padding: rect(8,4)
         }).openInWorld(virtualNodePos);
     visualPointer.position = m1.world().bounds().translateForInclusion(visualPointer.bounds()).topLeft();
     // if (visualPointer.bounds().intersection(this.globalBounds()).area() > 0) {
     //   visualPointer.top = this.owner.globalBounds().insetBy(-20).bottom();
     // }
     once(leash, 'remove', visualPointer, 'remove');
     leash.endPoint.attachTo(visualPointer, 'leftCenter');
  }
  return leash;
}

export async function interactivelyEvaluateConnection(opts) {
  let {
    sourceObj, sourceAttr, targetObj, targetAttr, converter, updater,
    prompt, // = "confirm connection",
    highlight = true, onConnect
  } = opts;
  let targetModule = "lively://lively.bindings-interactive-connect/x" + sourceObj.id,
      evalEnvironment = {
        context: window,
        format: "esm",
        targetModule,
        classTransform: classToFunctionTransform,
      },
      input = printConnectionElements(sourceObj, sourceAttr, targetObj, targetAttr, converter, updater);
  if (targetObj.isMorph && sourceObj.isMorph) {
    // figure out if the properties can be coerced naively
    let { type: targetType } = targetObj.propertiesAndPropertySettings().properties[targetAttr] || {
      type: typeof targetObj[targetAttr]
    };
    let { type: sourceType } = sourceObj.propertiesAndPropertySettings().properties[sourceAttr] || {
      type: typeof sourceObj[sourceAttr]
    }
    if (sourceType !== targetType) {
      prompt = true;
    }
  }
  Object.assign(lively.modules.module(targetModule).recorder,
    {source: sourceObj, target: targetObj, connect, once, [sourceAttr]: sourceObj[sourceAttr]
  });
  let source;
  if (prompt) {
    source = await $world.editPrompt(prompt, {
      input, historyId: "lively.bindings-interactive-morph-connect", mode: "js",
      requester: $world,
      evalEnvironment,
      animated: false
    });
    if (!source) { $world.setStatusMessage("connect canceled"); return; }
  } else {
    source = input;
  }
  let result = await lively.vm.runEval(source, evalEnvironment);
  if (result.isError) {
    $world.logError(result.value);
    return interactivelyEvaluateConnection({
      sourceObj, sourceAttr, targetObj, targetAttr, converter, updater,
      prompt: "confirm connection", highlight, onConnect
    });
  }
  if (highlight) {
    $world.setStatusMessage("connected!", Color.green);
    interactivelyShowConnection(result.value);
  }
  if (typeof onConnect === "function") {
    onConnect(result);
  }
}