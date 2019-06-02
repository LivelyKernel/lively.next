/*global Map,System*/
import { obj, arr, string } from "lively.lang";
import { connect, signal } from "lively.bindings";
import { TreeData } from "lively.components";
import { newUUID } from "lively.lang/string.js";
import { localInterface } from "lively-system-interface";

/*

When using trees as a means to simply display information to the user
it is sufficient to just supply anonymous objects as nodes in order to
define a tree structure that can then be rendered by components/tree.js.

This changes, once we allow the user to also interact with the tree nodes
and modify the data being dispalyed. Nodes now need to be aware of how they relate
to the object that they are being retrieved from, and also which datafields
they need to updated and/or check for an updated value.

Furthermore, in order to reduce the total number of nodes that need to be
rendered again in response to a change in the observed data structure it
is nessecary for the nodes to make precise and easy to perform updates inside
the rendered tree.

The inspector therefore comes with a set of different node types that are
represented as first class objects. These nodes are aware of what kind of
data they are inspecting and also know how they react to changes in the system.

*/


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// printing
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME duplication with lively.vm completions and lively morphic completions and inspector!

var defaultPropertyOptions = {
  includeDefault: true,
  includeSymbols: true,
  sort: true,
  sortFunction: (target, props) => Array.isArray(target) ? props : props.sort(defaultSort)
};

var symMatcher = /^Symbol\((.*)\)$/,
    knownSymbols = (() =>
      Object.getOwnPropertyNames(Symbol)
        .filter(ea => typeof Symbol[ea] === "symbol")
        .reduce((map, ea) => map.set(Symbol[ea], "Symbol." + ea), new Map()))();
function printSymbol(sym) {
  if (Symbol.keyFor(sym)) return `Symbol.for("${Symbol.keyFor(sym)}")`;
  if (knownSymbols.get(sym)) return knownSymbols.get(sym);
  var matched = String(sym).match(symMatcher);
  return String(sym);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function defaultSort(a, b) {
  if (a.hasOwnProperty("priority") || b.hasOwnProperty("priority")) {
    let aP = a.priority || 0, bP = b.priority || 0;
    if (aP < bP) return -1;
    if (aP > bP) return 1;
  }
  let aK = (a.keyString || a.key).toLowerCase(),
      bK = (b.keyString || b.key).toLowerCase();
  return aK < bK ? -1 : aK === bK ? 0 : 1;
}

function safeToString(value) {
  if (!value) return String(value);
  if (Array.isArray(value)) return `[${value.map(safeToString).join(",")}]`;
  if (typeof value === "symbol") return printSymbol(value);
  try {
    return String(value);
  } catch (e) { return `Cannot print object: ${e}`; }
}

function propertyNamesOf(obj) {
  if (!obj) return [];
  var keys = arr.sortBy(Object.keys(obj), p => p.toLowerCase());
  if (Array.isArray(obj)) {
    var indexes = obj.length ? arr.range(0, obj.length-1).map(String) : [];
    return indexes.concat(arr.withoutAll(keys, indexes));
  }
  return keys;
}

export function isMultiValue(foldableValue, propNames) {
  return !arr.every(propNames.map(p => foldableValue[p]),
      v => obj.equals(v, foldableValue && foldableValue.valueOf()))
}

export function printValue(value) {
  var result;
  if (obj.isPrimitive(value)) result = string.print(value);
  else if (Array.isArray(value)) {
    var tooLong = value.length > 3;
    if (tooLong) value = value.slice(0, 3);
    var printed = string.print(value);
    if (tooLong) printed = printed.slice(0, -1) + ", ...]";
    result = printed;
  } else {
    result = string.print(value);
  }
  result = result.replace(/\n/g, "");
  if (result.length > 500) result = result.slice(0, 20) + `...[${result.length - 20} CHARS]"`;
  return result;
}

export class InspectionTree extends TreeData {

  constructor(args) {
    super(args);
    this.inspector = args.inspector;
    if (!this.root.isInspectionNode)
      this.root = InspectionNode.for(this.root, this);
  }

  get __only_serialize__() {
    return ["root"];
  }

  asListWithIndexAndDepth(filtered = true) {
    return super.asListWithIndexAndDepth(({node}) => filtered ? node.visible : true);
  }

  static forObject(obj, inspector) {
    return new this({key: "inspectee", value: {inspectee: obj}, isCollapsed: true, inspector});
  }

  getContextFor(node) {
    if (node == this.root) return this.root.value.inspectee;
    return node.value;
  }

  dispose() {}

  partitionedChildren(nodes) {
    let partitionSize = 250,
        numPartitions = nodes.length / partitionSize,
        partitions = [];
    for (let i = 0; i < numPartitions; i++) {
      let partition = nodes.slice(i * partitionSize, (i + 1) * partitionSize);
      partitions.push(new InspectionNode({
        keyString: `[${i * partitionSize}-${(i + 1) * partitionSize}]`,
        valueString: '...',
        value: partition,
        children: partition,
        isCollapsed: true
      }))
    }
    return partitions;
  }

  async filter({sorter, maxDepth = 1, iterator, showUnknown, showInternal}) {
    await this.uncollapseAll(
      (node, depth) => maxDepth > depth && (node == this.root || node.value.submorphs)
    );
    this.asListWithIndexAndDepth(false).forEach(({node, depth}) => {
      if (depth == 0) return (node.visible = true);
      if (!showUnknown && node.keyString && node.keyString.includes("UNKNOWN PROPERTY")) return (node.visible = false);
      if (!showInternal && node.keyString && node.keyString.includes("internal")) return (node.visible = false);
      if (node.value && node.value.submorphs) return (node.visible = true);
      return (node.visible = iterator(node));
    });
  }
  
  getChildren(node) {
    if (node.children && node.children.filter(c => c.visible).length > 1000) {
      return node._childGenerator || (node._childGenerator = this.partitionedChildren(node.children))
    } else {
      return node.children;
    }    
  }

  display(node) { return node.display(this.inspector); }

  isCollapsed(node) { return node.isCollapsed; }

  isLeaf(node) { return obj.isPrimitive(node.value); }

  collapse(node, bool) {
    node.isCollapsed = bool;
    if (bool || this.isLeaf(node)) return;

    if (!node.children.length) {
      node.children = propertiesOf(node).map(n => {
        this.parentMap.set(n, node);
        return n;
      });
    }
  }

  retrieveForRemoteProxy(node) {
    if (!node.uuid) {
       node.uuid = newUUID();
       this.idToNodeMap[node.uuid] = node; 
    }
    return {
      uuid: node.uuid,
      value: this.isLeaf(node) ? node.value : {},
      keyString: node.keyString,
      key: node.keyString,
      valueString: safeToString(node.value),
      isCollapsed: true,
      children: []
    }
  }

  get systemInterface() {
    return localInterface;
  }

  getNodeViaId(uuid) {
    return this.idToNodeMap[uuid];
  }

  asRemoteDelegate(sessionId) {
    this.idToNodeMap = {};
    this.isRemoteDelegate = true;
    if (!System.get('@lively-env').remoteInspectionContext) {
      System.get('@lively-env').remoteInspectionContext = {};
    }
    System.get('@lively-env').remoteInspectionContext[sessionId] = this;
    return this.retrieveForRemoteProxy(this.root)
  }
  
}

export class RemoteInspectionTree extends InspectionTree {

  static async forObject(target, inspector) {  
    let { proxy, delegateId, evalEnvironment } = await this.createRemoteContext(target, inspector)
    return new this({key: 'inspectee', proxy, delegateId,  evalEnvironment, inspector});
  }

  static async createRemoteContext({code, evalEnvironment, delegateId}, inspector) {
    if (delegateId) {
      // try to reconned to the remote context
      // if it fails throw error
    }
    
    delegateId = `lively://inspector-${inspector.id}`;

    let { value: proxy } = await evalEnvironment.systemInterface.runEval(`
       const { InspectionTree } = await System.import("lively.ide/js/inspector/context.js");
       const t = (() => ${code})();
       const tree = InspectionTree.forObject(t);
       tree.asRemoteDelegate("${delegateId}");
    `, evalEnvironment);

    return { delegateId, evalEnvironment, proxy }
  }

  get systemInterface() {
    return this.evalEnvironment.systemInterface;
  }

  constructor(args) {
    this.parentMap = new WeakMap();
    this.root = args.proxy;
    this.evalEnvironment = args.evalEnvironment;
    this.inspector = args.inspector;
    this.delegateId = args.delegateId;
  }

  getContextFor(node) {
    return `System.get('@lively-env').remoteInspectionContext["${this.delegateId}"].getNodeViaId("${node.uuid}").value`
  }

  async dispose() {
    // dispose the remote inspection context
    await this.evalEnvironment.systemInterface.runEval(`
      delete System.get('@lively-env').remoteInspectionContext['${this.delegateId}']
    `, this.evalEnvironment);
  }

  display(node) { return `${node.keyString}: ${node.valueString}` }

  async collapse(node, bool) {
    node.isCollapsed = bool;
    if (bool || this.isLeaf(node)) return;
    if (!node.children.length) {
      const res = (await this.evalEnvironment.systemInterface.runEval(`
         const node = this.getNodeViaId("${node.uuid}");
         this.collapse(node, false);
         node.children.map(n => this.retrieveForRemoteProxy(n));
      `, {
        targetModule: "/lively.ide/js/inspector/context.js",
        context: `System.get('@lively-env').remoteInspectionContext["${this.delegateId}"]`
      }));
     node.children = res.value;
    }
    console.log(node.children)
  }
  
}

class InspectionNode {

  /* This node type is used for datapoints that do not provide any
     context information whatsoever, that is: They are not a Morph,
     a property of a morph or a member of a folded property.
     Plain Inspection nodes do not provide interactiveness (they are read only),
     so they do not store a target that they poll or propagate changes from and to. */

  constructor({
    root, // the tree data object that serves as the root of the node tree
    priority, // order inside the tree
    key, //property on the object
    keyString, //a printed version of the property, sometimes different to key i.e. [INTERNAL] ...
    value, //the value of the inspected datafield
    valueString, // the value of the datafield printed safely to a string
    isCollapsed, // wether or not the node is dispalying its child nodes,
    children = [],
    isSelected = false,
    visible = true,
    draggable = true
  }) {
    this.priority = priority;
    this.key = key;
    this.keyString = keyString || String(key);
    this.value = value;
    this.valueString = valueString || printValue(value);
    this.isCollapsed = isCollapsed;
    this.children = children;
    this.isSelected = isSelected;
    this.visible = visible;
    this.root = root;
  }

  get __only_serialize__() {
    return [];
  }

  get isInspectionNode() { return true; }

  static for(node, root = null) {
    // if is morph -> MorphContext
    if (node.value && node.value.isMorph) return new MorphNode({root, ...node});
    return new InspectionNode({root, ...node});
  }

  getSubNode(node) {
    return InspectionNode.for(node, this.root);
  }

  display(inspector) {
    let {keyString, valueString} = this;
    if (!this.interactive) return `${keyString}: ${valueString}`;
    return this._propertyWidget || (this._propertyWidget = inspector.renderDraggableTreeLabel({value: `${keyString}: ${valueString}`}));
  }

}

class MorphNode extends InspectionNode {

  /* Used for properties that store a morph as a value and thereby
       give rise to a new target context that subsequent properties need
       to be bound to:

           MorphA : {
              position: ... (position of A),
              fill: ... (fill of A),
              b: (new morph context) {
                  position: ... (position of B)
                  fill: ... (fill of B)
              }
           }

        Morph nodes cache the propertyInfo from propertiesAndSettings() in order
        to supply their subnode with meta information about the property values.
    */

  constructor(args) {
    super(args);
    this.target = this.value; // target changes to the value of the node
    this.propertyInfo = this.target.propertiesAndPropertySettings().properties;
  }

  getSubNode(nodeArgs) {
    let spec = this.propertyInfo[nodeArgs.key] || {};
    if (nodeArgs.value && nodeArgs.value.isMorph)
      return new MorphNode({...nodeArgs, root: this.root});
    return new PropertyNode({
      ...nodeArgs,
      root: this.root,
      target: this.target,
      spec
    });
  }
}

class PropertyNode extends InspectionNode {

  /* Used for properties attached to a morph.
     Also come with a spec object that is retrieved from
     the previous morph node's propertyInfo dictionary.
     The spec object is used to render the direct manipulation
     widgets for the property value correctly. */

  constructor(args) {
    super(args);
    let {
      spec, // spec providing information about the inspected values type etc...
      target // target is passed from previous morph context
    } = args;
    this.target = target;
    this.spec = spec;
    this.foldedNodes = {};
  }

  __deserialize__(snapshot, objRef) {
    this.spec = {};
  }

  get interactive() {
    return this._interactive;
  }

  set interactive(b) {
    this._interactive = b;
  }

  get isFoldable() {
    return !!this.spec.foldable;
  }

  get isInternalProperty() {
    return this.keyString == "id" || this.keyString.includes("internal");
  }

  getSubNode(nodeArgs) {
    if (this.isFoldable) {
      return this.getFoldedContext(nodeArgs);
    }
    return super.getSubNode(nodeArgs);
  }

  getFoldedContext(node) {
    return this.foldedNodes[node.key] = new FoldedNode({
      ...node,
      root: this.root,
      target: this.target,
      foldableNode: this,
      spec: obj.dissoc(this.spec, ["foldable"])
    });
  }

  refreshProperty(v, updateTarget = false) {
    if (updateTarget) this.target[this.key] = v;
    this.value = this.target[this.key];
    this._propertyWidget && signal(this._propertyWidget, "update", this.value);
    this.valueString = printValue(v);
    if (this.interactive) {
      if (!updateTarget) {
        this._propertyWidget.highlight();
      }
    }
    if (this.isFoldable) {
      for (let m in this.foldedNodes) {
        this.foldedNodes[m].value = this.value[m];
        this.foldedNodes[m].valueString = printValue(this.value[m]);
        this.foldedNodes[m]._propertyWidget && signal(this.foldedNodes[m]._propertyWidget, 'update', this.value[m]);
      }
    }
  }

  display(inspector) {
    let {_propertyWidget: w, keyString, valueString, target, value, spec} = this;

    if (!this.interactive && !(spec.foldable && isMultiValue(value, spec.foldable))) {
      return inspector.renderPropertyControl({
        target, keyString, valueString, 
        value, spec, node: this, fastRender: true
      });
    }

    if (w) { // recycle widget
      w.keyString = keyString;
      w.valueString = valueString;
      w.control && (w.control.isSelected = this.isSelected);
      return w;
    }

    // create a new widget
    w = this._propertyWidget = inspector.renderPropertyControl({
        target, keyString, valueString, value, spec, node: this});

    if (!this.isInternalProperty && !spec.readOnly) {
      connect(w, "propertyValue", this, "refreshProperty", {
        updater: ($upd, val) => $upd(val, true)});
      connect(w, "openWidget", this.root, "onWidgetOpened", {
        converter: widget => ({widget, node: this.sourceObj})});
    }

    return w;
  }
}

class FoldedNode extends PropertyNode {

  constructor(args) {
    super(args);
    let {foldableNode} = args;
    this.foldableNode = foldableNode;
    /* key and keyString will be just the member name (i.e. .left, or .right).
       In order to update a folded property correctly the accessor that triggers the
       update correctly is needed. This is synthesized from the parent nodes
       keyString and the folded nodes keyString */
    this.foldedProp = foldableNode.key + string.capitalize(this.key);
  }

  refreshProperty(v, updateTarget = false) {
    this.foldableNode.refreshProperty({...this.target[this.foldableNode.key], [this.key]: v}, updateTarget);
  }

}

function propertiesOf(node) {
  let target = node.value;
  if (!target) return [];

  var seen = {_rev: true}, props = [],
      isCollapsed = true,
      customProps = typeof target.livelyCustomInspect === "function" ?
        target.livelyCustomInspect() : {},
      options = {
        ...defaultPropertyOptions,
        ...customProps
      };

  if (customProps.properties) {
    for (let {key, hidden, priority, keyString, value, valueString} of customProps.properties) {
      seen[key] = true;
      if (hidden) continue;
      props.push(node.getSubNode({
        priority,
        key,
        keyString: keyString || safeToString(key),
        value,
        valueString,
        isCollapsed
      }));
    }
  }
  if (options.includeDefault) {
    var defaultProps = propertyNamesOf(target);
    for (let key of defaultProps) {
      if (key in seen) continue;
      var value = target[key], valueString = printValue(value),
          nodeArgs = {key, keyString: key, value, valueString, isCollapsed};
      props.push(node.getSubNode(nodeArgs));
    }
    if (options.includeSymbols) {
      for (let key of Object.getOwnPropertySymbols(target)) {
        var keyString = safeToString(key), value = target[key],
            valueString = printValue(value),
            nodeArgs = {key, keyString, value, valueString, isCollapsed};
        props.push(node.getSubNode(nodeArgs));
      }
    }
  }

  if (options.sort) props = options.sortFunction(target, props);

  return props;
}