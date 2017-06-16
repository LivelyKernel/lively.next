/* globals Power4 */
import { Color, rect, pt } from "lively.graphics";
import { obj, arr, promise, string } from "lively.lang";
import { connect, signal, disconnect, once } from "lively.bindings";
import { Morph, HorizontalLayout, morph, CustomLayout, Label, Icon, StyleSheet, config } from "lively.morphic";
import { Tree, TreeData } from "lively.morphic/components/tree.js";

import { isBoolean, isString, isNumber } from "lively.lang/object.js";
import { DropDownSelector, SearchField, LabeledCheckBox } from "../../components/widgets.js";
import { last } from "lively.lang/array.js";

import { GridLayout } from "../../layout.js";

import { NumberWidget, VerticesWidget, ShadowWidget, PointWidget, StyleSheetWidget, BooleanWidget, LayoutWidget, ColorWidget } from "../value-widgets.js";
import { RichTextControl } from "../../text/ui.js";
import { Point } from "lively.graphics/geometry-2d.js";
import { MorphHighlighter } from "../../halo/morph.js";

var inspectorCommands = [

 {
   name: "focus codeEditor",
   exec: inspector => {
     inspector.get("codeEditor").show();
     inspector.get("codeEditor").focus();
     return true;
   }
 },

 {
   name: "focus propertyTree",
   exec: inspector => {
     inspector.get("propertyTree").show();
     inspector.get("propertyTree").focus();
     return true;
   }
 }

];


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// printing
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME duplication with lively.vm completions and lively morphic completions and inspector!
var symMatcher = /^Symbol\((.*)\)$/,
    knownSymbols = (() =>
      Object.getOwnPropertyNames(Symbol)
        .filter(ea => typeof Symbol[ea] === "symbol")
        .reduce((map, ea) => map.set(Symbol[ea], "Symbol." + ea), new Map()))();
function printSymbol(sym) {
  if (Symbol.keyFor(sym)) return `Symbol.for("${Symbol.keyFor(sym)}")`;
  if (knownSymbols.get(sym)) return knownSymbols.get(sym)
  var matched = String(sym).match(symMatcher);
  return String(sym);
}
function safeToString(value) {
  if (!value) return String(value);
  if (Array.isArray(value)) return `[${value.map(safeToString).join(",")}]`;
  if (typeof value === "symbol") return printSymbol(value);
  try {
    return String(value);
  } catch (e) { return `Cannot print object: ${e}`; }
}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function printValue(value) {
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
  return result;
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

var defaultPropertyOptions = {
  includeDefault: true,
  includeSymbols: true,
  sort: true,
  sortFunction: (target, props) => Array.isArray(target) ? props : props.sort(defaultSort)
}

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
        visible = true
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

  get isInspectionNode() { return true }

  static for(node, root = null) {
    // if is morph -> MorphContext
    if (node.value && node.value.isMorph) return new MorphNode({root, ...node});
    return new InspectionNode({root, ...node});
  }

  getSubNode(node) {
    return InspectionNode.for(node, this.root);
  }

  display() {
    let {keyString, valueString} = this;
    return this._propertyWidget || (this._propertyWidget = `${keyString}: ${valueString}`);
  }
  
}

class MorphNode extends InspectionNode {

    /* Used for properties that store a morph as a value and thereby
       give rise to a new target context that subsequent properties need
       to be mapped against:

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
    let {spec = false} = this.propertyInfo[nodeArgs.keyString] || {};
    if (nodeArgs.value && nodeArgs.value.isMorph) return new MorphNode(nodeArgs)
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

  get isFoldable() {
    return !!this.spec.foldable
  }

  get isInternalProperty() {
     return this.keyString == 'id' || this.keyString.includes('internal'); 
  }

  getSubNode(nodeArgs) {
    if (this.isFoldable) {
      return this.getFoldedContext(nodeArgs)
    }
    return super.getSubNode(nodeArgs);
  }

  getFoldedContext(node) {
    return this.foldedNodes[node.key] = new FoldedNode({
      ...node,
      root: this.root,
      target: this.target, 
      foldableNode: this,
      spec: obj.dissoc(this.spec, ['foldable'])
    }); 
  }

  refreshProperty(v) {
    this.target[this.keyString] = v;
    this.value = this.target[this.keyString];
    signal(this._propertyWidget, 'update', this.value);
    if (this.isFoldable) {
      for (let m in this.foldedNodes) {
        this.foldedNodes[m].value = this.value[m];
        signal(this.foldedNodes[m]._propertyWidget, 'update', this.value[m])
      }
    }
  }

  display() {
    let {keyString, valueString, target, value, spec} = this;
    if (this._propertyWidget) {
      // recycle widget
      if (typeof this._propertyWidget == 'string') return this._propertyWidget;
      this._propertyWidget.keyString = keyString;
      this._propertyWidget.valueString = valueString;
      return this._propertyWidget;
    } else {
      // create a new widget
      this._propertyWidget = PropertyControl.render({
        target,
        keyString,
        valueString,
        value,
        spec
      });

      if (this._propertyWidget) {
        if (!this.isInternalProperty && !spec.readOnly) {
          connect(this._propertyWidget, "propertyValue", this, "refreshProperty");
          connect(this._propertyWidget, "openWidget", this.root, "onWidgetOpened", {
            converter: widget => {
              return {widget, node};
            },
            varMapping: {node: this._propertyWidget}
          });
        }
      }
    }
    return this._propertyWidget || super.display();    
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

  refreshProperty(v) {
    this.foldableNode.refreshProperty({...this.target[this.foldableNode.key], [this.key]: v})
  }
  
}

function propertiesOf(node) {
  let target = node.value;
  if (!target) return [];

  var seen = {}, props = [],
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

class DraggedProp extends Morph {

  static get properties() {
    return {
      control: {},
      borderColor: {defaultValue: Color.rgb(169,204,227)},
      fill: {defaultValue: Color.rgb(235, 245, 251).withA(.8)},
      borderWidth: {defaultValue: 2},
      borderRadius: {defaultValue: 4},
      submorphs: {
        after: ['control'],
        initialize() {
          this.submorphs = [this.control];
          this.height = 22;
          this.control.top = 0;
          this.control.fontSize = 14;
          this.control.relayout();
          this.width = this.control.width + 20;
          this.adjustOrigin(pt(10,10));
        }
      }
    }
  }

  applyToTarget() {
    let {keyString, propertyValue} = this.control;
    this.remove();
    MorphHighlighter.removeHighlightersFrom($world);
    this.currentTarget[keyString] = propertyValue;
  }

  update(handPosition) {
    let target = this.morphBeneath(handPosition);
    if (target == this.morphHighlighter) {
      target = this.morphHighlighter.morphBeneath(handPosition);
    }
    if (target != this.currentTarget) {
      this.currentTarget = target;
      if (this.morphHighlighter) this.morphHighlighter.deactivate();
      if (target.isWorld) return;
      this.morphHighlighter = MorphHighlighter.for($world, target);
      this.morphHighlighter.show();
    }
    this.position = handPosition;
  }
}

export class PropertyControl extends Label {
  
  get __only_serialize__() {
    return arr.without(super.__only_serialize__, 'attributeConnections');
  }

  static get properties() {
    return {
      control: {
        after: ['submorphs'],
        derived: true,
        get() {
          return this.submorphs[0] || false;
        },
        set(c) {
          this.submorphs = [c];
        }
      },
      draggable: {defaultValue: true},
      nativeCursor: {defaultValue: '-webkit-grab'},
      root: {},
      keyString: {},
      valueString: {},
      propertyValue: {},
      fontFamily: {defaultValue: config.codeEditor.defaultStyle.fontFamily},
      fill:  {defaultValue: Color.transparent},
      padding: {defaultValue: rect(0,0,10,0)},
      layout: {
        initialize() {
          this.layout = new CustomLayout({
            relayout: (self) => {
              self.relayout();
            }
          });
        }
      },
      submorphs: {
        initialize() {
          this.value = this.keyString + ":";
          this.submorphs = [];
        }
      }
    }
  }

  static inferSpec({keyString, value}) {
    if (value && (value.isColor || value.isGradient)) {
      return {type: 'Color'}
    } else if (value && value.isPoint) {
      return {type: 'Point'}
    } else if (isBoolean(value)) {
      return {type: 'Boolean'}
    } else if (isNumber(value)) {
      return {type: 'Number'}
    } else if (isString(value)) {
      return {type: 'String'}
    }
    return {}
  }
  
  static render(args) {
    let propertyControl = this.baseControl(args);
    
    if (!args.spec) args.spec = this.inferSpec(args);

    if (args.spec.foldable) {
      propertyControl.asFoldable(args.spec.foldable);
    }
    
    switch (args.spec.type) {
        // 12.6.17
        // rms: not sure wether a string based spec is that effective in the long run
        //      it may require too much dedicated maintenance
      case "Icon":
        propertyControl.renderIconControl(args); break;
      case "Color":
        propertyControl.renderColorControl(args); break;
      case "ColorGradient":
        propertyControl.renderColorControl(args, true); break;
      case "Number":
        propertyControl.renderNumberControl(args); break;
      case "String":
        propertyControl.renderStringControl(args); break;
      case "RichText":
        propertyControl.renderRichTextControl(args); break;
      case "Layout":
        propertyControl.renderLayoutControl(args); break;
      case "Enum":
        propertyControl.renderEnumControl(args); break;
      case "Vertices":
        propertyControl.renderVertexControl(args); break;
      case "Shadow":
        propertyControl.renderShadowControl(args); break;
      case "Point":
        propertyControl.renderPointControl(args); break;
      case "StyleSheets":
        propertyControl.renderStyleSheetControl(args); break;
      case "Rectangle": 
        propertyControl.renderRectangleControl(args); break;
      case "Boolean":
        propertyControl.renderBooleanControl(args); break;
    }

    if (propertyControl.control) {
      connect(propertyControl.control, "openWidget", propertyControl, "openWidget");
      propertyControl.toggleFoldableValue(args.value);
      return propertyControl;
    }
    
    return false;
  }
  
  renderValueSelector(propertyControl, selectedValue, values) {
    propertyControl.control = new DropDownSelector({
      opacity: 0.8,
      fill: Color.white.withA(0.5),
      name: "valueString",
      selectedValue,
      values
    });
    // hack: since derived properties that are parametrized by a style sheet do not
    //       yet take effect in a morph such as the drop down selector, we need to
    //       manually trigger an update at render time
    propertyControl.control.whenRendered().then(() => 
       propertyControl.control.updateStyleSheet());
    connect(propertyControl.control, "update", propertyControl, "propertyValue", {
      updater: function ($upd, val) {
        if (this.targetObj.propertyValue != val) $upd(val);
      }
    });
    connect(propertyControl, 'update', propertyControl.control, 'selectedValue', {
      updater: function ($upd, val) {
        val = (val && val.valueOf) ? val.valueOf() : val;
        if (this.targetObj.propertyValue != val) $upd(val);
      }
    });
    return propertyControl;
  }

  static baseControl({keyString, valueString, value}) {
    return new this({
      keyString,
      valueString,
      propertyValue: value
    });
  }

  toggleMultiValuePlaceholder(active) {
     this.multiValuePlaceholder = this.multiValuePlaceholder || this.addMorph({
        fill: Color.transparent,
        layout: new HorizontalLayout({spacing: 3}),
        name: 'multi value placeholder',
        nativeCursor: 'pointer',
        submorphs: arr.range(0,2).map(i => ({
          type: 'ellipse',
          fill: Color.gray.withA(.5),
          reactsToPointer: false,
          extent: pt(7,7)
        }))
      });
    if (active) {
      connect(this.multiValuePlaceholder, 'onMouseDown', this, 'propertyValue', {
        converter: () => self.propertyValue.valueOf(), varMapping: {self: this}
      });
      this.control.opacity = 0;
      this.multiValuePlaceholder.visible = true;
    } else {
      disconnect(this.multiValuePlaceholder, 'onMouseDown', this, 'propertyValue');
      this.control.opacity = 1;
      this.multiValuePlaceholder.visible = false;
    }
    
  }

  toggleFoldableValue(newValue) {
    if (!this.foldableProperties) return;
    if (arr.uniq(this.foldableProperties.map(p => newValue[p])).length > 1) {
      this.toggleMultiValuePlaceholder(true);
    } else {
      this.toggleMultiValuePlaceholder(false);
    }
  }

  asFoldable(foldableProperties) {
    this.foldableProperties = foldableProperties;
    connect(this, 'update', this, 'toggleFoldableValue');
  }

  renderEnumControl({value, spec: {values}}) {
    return this.renderValueSelector(this, value.valueOf ? value.valueOf() : value, values);
  }

  renderIconControl(args) {
    
  }

  renderStringControl(args) {
    
  }

  renderRichTextControl(args) {
    
  }

  renderRectangleControl(args) {
    
  }

  renderVertexControl({target}) {
    this.control = new VerticesWidget({context: target});
    connect(this.control, "vertices", this, "propertyValue");
    return this;
  }

  renderBooleanControl(args) {
    this.control = new BooleanWidget({
      name: "valueString",
      boolean: args.value
    });
    connect(this.control, "boolean", this, "propertyValue");
    return this;
  }

  renderNumberControl({value, spec, keyString}) {
    var baseFactor = .5, floatingPoint = false;
    if ("max" in spec && "min" in spec 
        && spec.min != -Infinity && spec.max != Infinity) {
      baseFactor = (spec.max - spec.min) / 100;
      floatingPoint = true;
    }
    this.control = new NumberWidget({
      name: "valueString",
      height: 17,
      baseFactor,
      floatingPoint,
      borderWidth: 0,
      borderColor: Color.transparent,
      fill: Color.transparent,
      padding: rect(0),
      fontFamily: config.codeEditor.defaultStyle.fontFamily,
      number: value,
      ...("max" in spec ? {max: spec.max} : {}),
      ...("min" in spec ? {min: spec.min} : {})
    });
    connect(this.control, "update", this, "propertyValue");
    connect(this, "update", this.control, "number", {
      updater: function($upd, val) {
        val = val.valueOf ? val.valueOf() : val;
        if (this.targetObj.number != val) $upd(val);
      }
    });
    return this;
  }

  renderShadowControl(args) {
    this.control = new ShadowWidget({name: 'valueString', shadowValue: args.value});
    connect(this.control, 'shadowValue', this, 'propertyValue');
    return this;
  }

  renderStyleSheetControl({target}) {
    this.control = new StyleSheetWidget({context: target});
    return this;
  }

  renderPointControl(args) {
    this.control = new PointWidget({name: "valueString", pointValue: args.value});
    connect(this.control, "pointValue", this, "propertyValue");
    connect(this, 'update', this.control, 'pointValue', {
      updater: function ($upd, val) {
        val = val.valueOf ? val.valueOf() : val;
        if (!this.targetObj.pointValue.equals(val)) $upd(val);
      }
    });
    return this;
  }

  renderLayoutControl({target}) {
    this.control = new LayoutWidget({context: target});
    connect(this.control, "layoutChanged", this, "propertyValue");
    return this;
  }

  renderColorControl(args, gradientEnabled = false) {
    this.control = new ColorWidget({
          color: (args.value && args.value.valueOf) ? args.value.valueOf() : args.value,
          gradientEnabled
        });
    connect(this.control, "update", this, "propertyValue");
    connect(this, 'update', this.control, 'color', {
      updater: function ($upd, val) {
        val = (val && val.valueOf )? val.valueOf() : val;
        if (!this.targetObj.color.equals(val)) $upd(val);
      }
    });
    return this;
  }

  onDragStart(evt) {
    this.draggedProp = new DraggedProp({
      control: this.copy()
    });
    this.draggedProp.openInWorld();
    connect(evt.hand, 'position', this.draggedProp, 'update');
  }

  onDrag(evt) {}

  onDragEnd(evt) {
    disconnect(evt.hand, 'position', this.draggedProp, 'update');
    this.draggedProp.applyToTarget();
  }

  relayout() {
    this.fit();
    if (this.control) {
      this.control.leftCenter = this.textBounds().rightCenter();
      this.width = this.textBounds().width + this.control.bounds().width;
    }

    if (this.multiValuePlaceholder) {
      this.multiValuePlaceholder.leftCenter = this.textBounds().rightCenter();
    }
  }

  toString() {
    return `${this.keyString}: ${this.valueString}`
  }

  highlight() {
   if (this.highlighter) this.highlighter.remove();
   const hl = this.highlighter = this.get('keyString').copy();
   hl.isLayoutable = false;
   hl.fontWeight = "bold", hl.fontColor = Color.orange;
   hl.reactsToPointer = false;
   this.addMorph(hl);
   hl.fadeOut(2000);
  }
}

class InspectorTreeData extends TreeData {

  constructor(args) {
    super(args);
    if (!this.root.isInspectionNode)
       this.root = InspectionNode.for(this.root, this);
  }

  asListWithIndexAndDepth(filtered = true) {
    let nodes = super.asListWithIndexAndDepth();
    return filtered ? nodes.filter(({node}) => node.visible) : nodes;
  }

  static fromListWithDepthAndIndexes(nodes) {
    // ensure that the nodes are sorted by index, 
    // or else the parent child relationship
    // will be inferred incorrectly
    var [root, ...nodes] = arr.sortBy(nodes, ({i}) => i);
    root = root.node // create new node
    root.children = [];
    var stack = [], prev = root;
    for(let {node, depth} of nodes) {
      if (stack.length < depth) {
        stack.push(prev); 
      }
      if (stack.length > depth) {
        stack.pop();
      }
      node.children = [];
      stack[depth - 1].children.push(prev = node);
    }
    return new this(root)
  }

  static forObject(obj) {
    return new this({key: "inspectee", value: {inspectee: obj}, isCollapsed: true});
  }

  display(node) {
    return node.display();
  }
  
  isCollapsed(node) { return node.isCollapsed; }

  collapse(node, bool) {
    node.isCollapsed = bool;
    if (bool || this.isLeaf(node)) return;

    node.children = propertiesOf(node).map(node => {
      this.parentMap.set(node, node); return node; });
  }

  getChildren(node) { return node.children; }

  isLeaf(node) { return obj.isPrimitive(node.value); }

  uncollapseAll(iterator, depth=0, node) {
    if (!node) return this.uncollapseAll(iterator, depth, this.root);
    if (iterator(node, depth)) {
      node.isCollapsed && this.collapse(node, false);
      for (let i in node.children) {
        this.uncollapseAll(iterator, depth + 1, node.children[i]);
      }
    } 
  }

  filter({sorter, maxDepth = 1, iterator, showUnknown, showInternal}) {
    this.uncollapseAll(
      (node, depth) => maxDepth > depth && (node == this.root || node.value.submorphs)
    );
    this.asListWithIndexAndDepth(false).forEach(({node, depth}) => {
      if (depth == 0) return (node.visible = true);
      if (depth > maxDepth) return (node.visible = false);
      if (!showUnknown && node.keyString && node.keyString.includes("UNKNOWN PROPERTY")) return (node.visible = false);
      if (!showInternal && node.keyString && node.keyString.includes("internal")) return (node.visible = false);
      if (node.value && node.value.submorphs) return (node.visible = true);
      return (node.visible = iterator(node));
    });
  }
}

export function inspect(targetObject) {
  return Inspector.openInWindow({targetObject});
}

export default class Inspector extends Morph {

  static openInWindow(props) {
    var i = new this(props).openInWorld();
    i.world().openInWindow(i).activate();
    return i;
  }

  onWindowClose() {
    this.stopStepping();
    this.openWidget && this.closeOpenWidget();
  }

  static get properties() {
    return {
      extent: {defaultValue: pt(400, 500)},
      fill: {defaultValue: Color.transparent},
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            "[name=selectionInstruction]": {
              fill: Color.black.withA(.7),
              borderRadius: 4,
              fontColor: Color.white,
              fontSize: 14,
              padding: rect(10,10)
            },
            "[name=escapeKey]": {
              opacity: .7,
              fill: Color.white,
              padding: rect(5,1,5,1),
              borderRadius: 4,
              fontWeight: 'bold'
            },
            "[name=searchBar]": {
              fill: Color.transparent,
              draggable: false
            },
            "[name=searchBar] .LabeledCheckBox": {
              fill: Color.transparent
            },
            "[name=targetPicker]": {
              fontSize: 18,
              padding: rect(2, 2),
              nativeCursor: "pointer"
            },
            "[name=resizer]": {
              fill: Color.gray.lighter(),
              nativeCursor: "ns-resize"
            },
            "[name=valueString]": {
              fontFamily: config.codeEditor.defaultStyle.fontFamily,
              fontSize: 15
            },
            ".toggle": {
              nativeCursor: "pointer",
              fill: Color.black.withA(0.5),
              draggable: false,
              fontSize: 15,
              borderRadius: 5,
              padding: rect(5, 2, 1, 1)
            },
            ".toggle.inactive": {
              fontColor: Color.white
            },
            ".toggle.active": {
              fontColor: Color.rgbHex("00e0ff")
            }
          });
        }
      }
    };  
  }

  constructor(props = {}) {
    var {targetObject} = props;
    props = obj.dissoc(props, ["targetObject"])
    super({
      name: "inspector",
      ...props
    });
    this.build();
    this.state = {targetObject: undefined, updateInProgress: false};
    this.targetObject = targetObject || null;
    // slow!
   //if (!this.targetObject.isWorld) this.startStepping(50, 'refreshProperties');
  }

  refreshAllProperties() {
    if (!this.targetObject || !this.targetObject.isMorph) return;
    let change = last(this.targetObject.env.changeManager.changesFor(this.targetObject));
    if (change == this.lastChange) return;
    if (this.focusedNode && this.focusedNode.keyString == change.prop) {
      this.repositionOpenWidget();
      return;
    }
    this.lastChange = change;
    this.targetObject = this.targetObject;
  }

  get isInspector() { return true; }

  get targetObject() { return this.state.targetObject; }
  set targetObject(obj) {
    this.state.targetObject = obj;
    this.originalData = null;
    this.prepareForNewTargetObject(obj);
  }

  async prepareForNewTargetObject(target) {
    if (this.isUpdating()) await this.whenUpdated();

    var {promise: p, resolve} = promise.deferred();
    this.state.updateInProgress = p;
    try {
      var td = InspectorTreeData.forObject(target),
          tree = this.get("propertyTree"),
          prevTd = tree.treeData;
      td.collapse(td.root, false);
      td.collapse(td.root.children[0], false);
      var updatedData = this.originalData && this.originalData.patch(td);
      if (updatedData) {
        this.originalData = updatedData;
        this.filterProperties();
        tree.highlightChangedNodes(prevTd);
      } else {
        tree.treeData = td;
        this.filterProperties();
        if (tree.treeData.root.isCollapsed) {
          await tree.onNodeCollapseChanged({node: td.root, isCollapsed: false});
          tree.selectedIndex = 1;
        }
        await tree.execCommand("uncollapse selected node");
      }
    } catch (e) { this.showError(e); }

    this.state.updateInProgress = null;

  }

  isUpdating() { return !!this.updateInProgress; }

  whenUpdated() { return this.updateInProgress || Promise.resolve(); }

  get selectedObject() {
    var sel = this.get("propertyTree").selection;
    return sel ? sel.value : this.state.targetObject
  }

  focus() {
    this.get("codeEditor").focus();
  }

  build() {
    var treeStyle = {
          borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: config.codeEditor.defaultStyle.fontFamily
        },
        textStyle = {
          type: "text",
          borderWidth: 1, borderColor: Color.gray,
          lineWrapping: "by-chars",
          ...config.codeEditor.defaultStyle,
          textString: ""
        };
    var searchBarBounds = rect(0,0,this.width, 30);

    let searchField = new SearchField({
      styleClasses: ["idle"],
      name: "searchField",
    });

    this.submorphs = [
      {
        name: "searchBar",
        layout: new GridLayout({
          grid: [["searchField", "targetPicker", "internals", "unknowns"]],
          rows: [0, {paddingTop: 5, paddingBottom: 5}],
          columns: [0, {paddingLeft: 5, paddingRight: 5}, 
                    1, {fixed: 25},
                    2, {fixed: 75}, 3, {fixed: 80}]
        }),
        height: 30,
        submorphs: [
          searchField,
          Icon.makeLabel('crosshairs', {name: 'targetPicker', 
                                        tooltip: 'Change Inspection Target'}),
          new LabeledCheckBox({label: "Internals", name: "internals"}),
          new LabeledCheckBox({label: "Unknowns", name: "unknowns"})
        ]
      },
      new Tree({
        name: "propertyTree", ...treeStyle,
        treeData: InspectorTreeData.forObject(null)
      }),
      Icon.makeLabel('keyboard-o', {
          name: 'terminal toggler',
          styleClasses: ['toggle', 'inactive']
      }),
      {name: "resizer"},
      {name: "codeEditor", ...textStyle}
    ];

    this.layout = new GridLayout({
      grid: [['searchBar'],
             ['propertyTree'],
             ['resizer'],
             ['codeEditor']],
      rows: [0, {fixed: 30}, 
             2, {fixed: 1},
             3, {height: 0}]
    });

    // FIXME? how to specify that directly??
    let ed = this.getSubmorphNamed("codeEditor");
    ed.changeEditorMode("js").then(() =>
      ed.evalEnvironment = {
        targetModule: "lively://lively.morphic/inspector",
        get context() { return ed.owner.selectedObject },
        format: "esm"
      }
    ).catch(err => $world.logError(err));

    this.editorOpen = false;
    connect(this.get('targetPicker'), 'onMouseDown', this, 'selectNewTarget');
    connect(this.get('propertyTree'), 'onScroll', this, 'repositionOpenWidget');
    connect(this.get('resizer'), 'onDrag', this, 'adjustProportions');
    connect(this.get('terminal toggler'), 'onMouseDown', this, 'toggleCodeEditor');
    connect(this, "extent", this, "relayout");
    connect(this.get('unknowns'), 'trigger', this, 'filterProperties');
    connect(this.get('internals'), 'trigger', this, 'filterProperties');
    connect(searchField, 'searchInput', this, 'filterProperties');
  }

  selectNewTarget() {
    this.get('targetPicker').fontColor = Color.orange;
    this.selectorMorph = Icon.makeLabel('crosshairs', {fontSize: 20}).openInWorld();
    connect($world.firstHand, 'position', this, 'scanForTargetAt');
    once(this.selectorMorph, 'onMouseDown', this, 'selectTarget');
    once(this.selectorMorph, 'onKeyDown', this, 'stopSelect');
    this.toggleSelectionInstructions(true);
    this.selectorMorph.focus();
    this.scanForTargetAt($world.firstHand.position);
  }

  scanForTargetAt(pos) {
    this.selectorMorph.center = pos;
    var target = this.selectorMorph.morphBeneath(pos);
    if (this.morphHighlighter == target) {
      target = this.morphHighlighter.morphBeneath(pos);
    }
    if (target != this.possibleTarget 
        && !target.ownerChain().includes(this.getWindow())) {
      if (this.morphHighlighter) this.morphHighlighter.deactivate();
      this.possibleTarget = target;
      if (this.possibleTarget && !this.possibleTarget.isWorld) {
        let h = this.morphHighlighter = MorphHighlighter.for($world, target);
        h && h.show();
      }
    }
  }

  selectTarget() {
    this.targetObject = this.possibleTarget;
    this.stopSelect()
  }
  
  stopSelect() {
    MorphHighlighter.removeHighlightersFrom($world);
    this.toggleSelectionInstructions(false);
    this.get('targetPicker').fontColor = Color.black;
    disconnect($world.firstHand, 'position', this, 'scanForTargetAt');
    this.selectorMorph.remove();
  }

  toggleSelectionInstructions(active) {
    if (active && !this.instructionWidget) {
      let esc = morph({
        type: "label",
        name: "escapeKey",
        value: "esc"
      });
      esc.whenRendered().then(() => esc.fit());
      this.instructionWidget = this.addMorph({
        type: "text",
        opacity: 0,
        center: this.extent.scaleBy(0.5),
        width: 120,
        fixedWidth: true,
        lineWrapping: true,
        name: "selectionInstruction",
        textAndAttributes: [
          "Select a new morph to inspect by hovering over it and clicking left. You can exit this mode by pressing ",
          {},
          esc, {}
        ]
      });
      this.instructionWidget.animate({opacity: 1, duration: 200});
    } else {
      this.instructionWidget.fadeOut(200);
      this.instructionWidget = null;
    }
  }
  closeOpenWidget() {
    this.openWidget.close();
    disconnect(this.getWindow(), 'bringToFront', this.openWidget, 'openInWorld');
  }

  onWidgetOpened({node, widget}) {
    if (this.openWidget) {
      this.openWidget.fadeOut();
    }
    this.focusedNode = node;
    this.openWidget = widget;
    once(this.get("propertyTree"), "onMouseDown", this, "closeOpenWidget");
    connect(this.getWindow(), 'bringToFront', widget, 'openInWorld', {
      converter: () => widget.globalPosition, varMapping: {widget}
    });
  }

  repositionOpenWidget(evt) {
    if (this.openWidget) {
      let pos = this.focusedNode.control.globalBounds().center(),
          treeBounds = this.get("propertyTree").globalBounds();
      if (pos.y < treeBounds.top()) {
        pos = treeBounds.topCenter().withX(pos.x)
      } else if (treeBounds.bottom() - 20 < pos.y) {
        pos = treeBounds.bottomCenter().addXY(0, -20).withX(pos.x);
      }
      this.openWidget.position = pos;
    }
  }
  
  adjustProportions(evt) {
    this.layout.row(1).height += evt.state.dragDelta.y;
  }

  async toggleCodeEditor() {
    let resizer = this.getSubmorphNamed('resizer'),
        prevExtent = this.extent;
     this.layout.disable();
    if (this.editorOpen) {
      this.editorOpen = false;
      this.get('terminal toggler').styleClasses = ['inactive', 'toggle'];
      this.layout.row(3).height = this.layout.row(2).height = 0;
    } else {
      this.editorOpen = true;
      this.get('terminal toggler').styleClasses = ['active', 'toggle'];
      this.layout.row(3).height = 180;
      this.layout.row(2).height = 5;
    }
    this.extent = prevExtent;
    this.layout.enable({duration: 300});
    this.relayout({duration: 300});
    this.get('codeEditor').focus();
  }


  filterProperties() {
    let searchField = this.get('searchField'),
        tree = this.get('propertyTree');
    if (!this.originalData) {
      this.originalData = tree.treeData;
    }
    disconnect(tree.treeData, 'onWidgetOpened', this, 'onWidgetOpened');
    this.originalData.filter({
       maxDepth: 2, showUnknown: this.get('unknowns').checked,
       showInternal: this.get('internals').checked,
       iterator: (node) => searchField.matches(node.key)
    });
    tree.treeData = this.originalData;
    connect(tree.treeData, 'onWidgetOpened', this, 'onWidgetOpened');
  }

  relayout(animated) {
    this.layout.forceLayout(); // removes "sluggish" button alignment
    var tree = this.get("propertyTree"),
        toggler = this.get('terminal toggler'),
        bottomRight = tree.bounds().insetBy(5).bottomRight();
    if (animated.duration) {
      toggler.animate({bottomRight, ...animated})
    } else {
      toggler.bottomRight = bottomRight
    }
  }

  get keybindings() {
    return [
      {keys: "Alt-Up", command: "focus propertyTree"},
      {keys: "Alt-Down", command: "focus codeEditor"},
      {keys: "F1", command: "focus propertyTree"},
      {keys: "F2", command: "focus codeEditor"},
    ].concat(super.keybindings);
  }

  get commands() { return inspectorCommands; }

}
