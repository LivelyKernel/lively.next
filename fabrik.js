import { InteractiveMorphSelector } from "./halo/morph.js";
import { connect, once } from "lively.bindings";
import { Color } from "lively.graphics";
import { showConnector } from "./components/markers.js";
import { show } from "lively.morphic";


// this.attributeConnections[4].getConverter()
// c.getConverter()
// let o = {}
// let c = connect(o, 'x', o, 'y', {converter: () => 33});
// printConnection(c)


export function interactivelyShowConnection(connection) {
  let {sourceObj, sourceAttrName, targetObj, targetMethodName} = connection;
  if (sourceObj.isMorph && targetObj.isMorph) {
    sourceObj.show();
    targetObj.show();
    showConnector(sourceObj, targetObj);
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
  let source = `connect(sourceObj, '${sourceAttr}', targetObj, '${targetAttr}'`;
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
  let selected = await InteractiveMorphSelector.selectMorph(),
      bindings = selected && selected.targetDataBindings();
  if (!bindings || !bindings.length) {
    $world.setStatusMessage("connect canceled"); return; }
  
  let items = bindings.map(
    group => [group[0].group || "uncategorized",
              group.map(ea => [
                ea.name, () => interactivelyEvaluateConnection(
                                sourceObj, sourceAttr, selected, ea.name)])]);
  selected.openMenu(items);      
}

export async function interactivelyReEvaluateConnection(connection, prompt = "confirm connection") {
  let {
        sourceObj, sourceAttrName, targetObj, targetMethodName
      } = connection,
      converter = connection.getConverter(),
      updater = connection.getUpdater();
  return interactivelyEvaluateConnection(
    sourceObj, sourceAttrName, targetObj, targetMethodName,
    converter, updater)
}

export async function interactivelyEvaluateConnection(
  sourceObj, sourceAttr, targetObj, targetAttr, converter, updater,
  prompt = "confirm connection"
) {
  let targetModule = "lively://lively.bindings-interactive-connect/x" + sourceObj.id,
      evalEnvironment = {
        context: window,
        format: "esm",
        targetModule
      },
      input = printConnectionElements(sourceObj, sourceAttr, targetObj, targetAttr, converter, updater);
  Object.assign(lively.modules.module(targetModule).recorder, {
    sourceObj, targetObj, connect, once
  })
  let source = await $world.editPrompt(prompt, {
    requester: targetObj,
    input,
    historyId: "lively.bindings-interactive-morph-connect",
    mode: "js",
    evalEnvironment
  });
  if (!source) { $world.setStatusMessage("connect canceled"); return; }
  let result = await lively.vm.runEval(source, evalEnvironment);
  if (result.isError) {
    $world.logError(result.value);
    return interactivelyEvaluateConnection(
    sourceObj, sourceAttr, targetObj, targetAttr, converter, updater,
      prompt = "confirm connection"
    );
  }
  $world.setStatusMessage("connected!", Color.green);
}
