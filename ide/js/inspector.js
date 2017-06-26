/*global Map, Power4*/
import { Color, rect, pt } from "lively.graphics";
import { obj, arr, promise, string } from "lively.lang";
import { connect, disconnectAll, signal, disconnect, once } from "lively.bindings";
import { Morph, HorizontalLayout, morph, CustomLayout, Label, Icon, StyleSheet, config } from "lively.morphic";
import { Tree, TreeData } from "lively.morphic/components/tree.js";

import { isBoolean, isString, isNumber } from "lively.lang/object.js";
import { DropDownSelector, SearchField, LabeledCheckBox } from "../../components/widgets.js";
import { last } from "lively.lang/array.js";

import { GridLayout } from "../../layout.js";

import { NumberWidget, StringWidget, IconWidget, PaddingWidget, VerticesWidget, ShadowWidget, PointWidget, StyleSheetWidget, BooleanWidget, LayoutWidget, ColorWidget } from "../value-widgets.js";
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

  get __only_serialize__() {
    return [];
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
    let spec = this.propertyInfo[nodeArgs.key] || {};
    if (nodeArgs.value && nodeArgs.value.isMorph) 
       return new MorphNode({...nodeArgs, root: this.root})
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
    this.spec = {}
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

  refreshProperty(v, updateTarget = false) {
    if (updateTarget) this.target[this.key] = v;
    this.value = this.target[this.key];
    if (typeof this._propertyWidget == 'string') {
      this._propertyWidget = `${this.keyString}: ${this.valueString = printValue(v)}`;
      this.renderedNode.labelValue = this._propertyWidget;
    } else {
      signal(this._propertyWidget, 'update', this.value);
    }
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
        spec,
        node: this
      });

      if (this._propertyWidget) {
        if (!this.isInternalProperty && !spec.readOnly) {
          connect(this._propertyWidget, "propertyValue", this, "refreshProperty", {
            updater: function($upd, val) {
              $upd(val, true);
            }
          });
          connect(this._propertyWidget, "openWidget", this.root, "onWidgetOpened", {
            converter: function(widget) { return {widget, node: this.sourceObj}; }
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

  refreshProperty(v, updateTarget) {
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

  static inferType({keyString, value}) {
    if (value && (value.isColor || value.isGradient)) {
      return 'Color'
    } else if (value && value.isPoint) {
      return 'Point'
    } else if (isBoolean(value)) {
      return 'Boolean'
    } else if (isNumber(value)) {
      return 'Number'
    } else if (isString(value)) {
      return 'String'
    } else if (value && value.isRectangle) {
      return 'Rectangle'
    }
    return false
  }

  static render(args) {
    let propertyControl = this.baseControl(args);

    if (!args.spec.type) args.spec = {...args.spec, type: this.inferType(args)}; // non mutating

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
        propertyControl.renderStringControl(args); break;
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
        converter: function() { return this.targetObj.propertyValue.valueOf(); }
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
    this.toggleMultiValuePlaceholder(
      !arr.every(this.foldableProperties.map(p => newValue[p]),
                 v => obj.equals(v, newValue && newValue.valueOf())));
  }

  asFoldable(foldableProperties) {
    this.foldableProperties = foldableProperties;
    connect(this, 'update', this, 'toggleFoldableValue');
  }

  renderEnumControl({value, spec: {values}}) {
    return this.renderValueSelector(this, value && value.valueOf ? value.valueOf() : value, values);
  }

  renderIconControl({value}) {
    this.control = new IconWidget({name: 'valueString', iconValue: value});
    connect(this.control, "iconValue", this, "propertyValue");
    return this;
  }

  renderStringControl({value, node, keyString}) {
    this.control = new StringWidget({
      name: "valueString",
      textString: value,
      readOnly: keyString == 'id'
    });
    connect(this.control, "textString", this, "propertyValue");
    connect(node, "isSelected", this.control, "isSelected");
    return this;
  }
  renderRichTextControl(args) {

  }

  renderRectangleControl({value}) {
    this.control = new PaddingWidget({name: 'valueString', rectangle: value});
    connect(this.control, "rectangle", this, "propertyValue");
    return this;
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
    var baseFactor = .5, floatingPoint = spec.isFloat;
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
        val = (val && val.valueOf ? val.valueOf() : val) || 0;
        if (this.targetObj.number != val) $upd(val);
      }
    });
    return this;
  }

  renderShadowControl(args) {
    this.control = new ShadowWidget({name: 'valueString', shadowValue: args.value});
    connect(this.control, 'update', this, 'propertyValue');
    connect(this, "update", this.control, "shadowValue", {
      updater: function($upd, val) {
        val = (val && val.valueOf ? val.valueOf() : val) || null;
        if (this.targetObj.shadowValue != val) $upd(val);
      }
    });
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
        val = val && val.valueOf ? val.valueOf() : val;
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
    this.draggedProp = new DraggedProp({control: this.copy()});
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

  get __only_serialize__() {
    return ['root'];
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

    if (!node.children.length) {
      node.children = propertiesOf(node).map(node => {
        this.parentMap.set(node, node);
        return node;
      });
    }
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
    //disconnect(this.targetObject, 'onChange', this, 'refreshAllProperties');
    this.openWidget && this.closeOpenWidget();
  }

  __after_deserialize__() {
    let t = this._serializableTarget;
    var tree = new Tree({
      name: "propertyTree",
      ...this.treeStyle,
      treeData: InspectorTreeData.forObject(null)
    });

    this.addMorph(tree, this.getSubmorphNamed("terminal toggler"));
    this.layout.col(0).row(1).group.morph = tree;

    this.whenRendered().then(
      () => { 
        if (this.targetObject.isMorph && 
            this.targetObject.world() == this.world()) {
          this.targetObject = this.targetObject;
        } else {
          this.targetObject = null;
        }
      }
    );
    
    super.__after_deserialize__();
  }
  
  __additionally_serialize__(snapshot, ref, pool, addFn) {
    // empty tree
    let submorphs = snapshot.props.submorphs.value;
    for (let i = submorphs.length; i--; ) {
      let {id} = submorphs[i];
      if (pool.refForId(id).realObj == this.ui.propertyTree) arr.removeAt(submorphs, i);
    }
  }
  

  static get properties() {
    return {

      extent: {defaultValue: pt(400, 500)},
      fill: {defaultValue: Color.transparent},
      name: {defaultValue: "inspector"},

      _serializableTarget: {defaultValue: null},

      targetObject: {
        after: ["submorphs"],
        //serialize: false,
        set(obj) {
          this._serializableTarget = obj.isMorph ? obj.id : obj;
          this.setProperty("targetObject", obj);
          if (!this.ui.propertyTree) return;
          this.originalTreeData = null;
          this.prepareForNewTargetObject(obj);
        }
      },

      originalTreeData: {
        // for filering
        serialize: false
      },

      selectedObject: {
        readOnly: true, derived: true,
        get() {
          var sel = this.ui.propertyTree.selection;
          return sel ? sel.value : this.targetObject
        }
      },

      submorphs: {initialize() { this.build(); }},

      layout: {
        after: ["submorphs"],
        initialize() {
          this.layout = new GridLayout({
            grid: [['searchBar'],
                   ['propertyTree'],
                   ['resizer'],
                   ['codeEditor']],
            rows: [0, {fixed: 30},
                   2, {fixed: 1},
                   3, {height: 0}]
          });
        }
      },

      ui: {
        readOnly: true, derived: true, after: ["submorphs"],
        get() {
          return {
            codeEditor:       this.getSubmorphNamed("codeEditor"),
            terminalToggler:  this.getSubmorphNamed("terminal toggler"),
            fixImportButton:  this.getSubmorphNamed('fix import button'),
            propertyTree:     this.getSubmorphNamed("propertyTree"),
            unknowns:         this.getSubmorphNamed("unknowns"),
            internals:        this.getSubmorphNamed("internals"),
            targetPicker:     this.getSubmorphNamed("targetPicker"),
            searchBar:        this.getSubmorphNamed("searchBar"),
            searchField:      this.getSubmorphNamed("searchField"),
            resizer:          this.getSubmorphNamed("resizer")
          }
        }
      },

      updateInProgress: {
        defaultValue: false, serialize: false
      },

      treeStyle: {
        readOnly: true,
        defaultValue: {
          borderWidth: 1,
          borderColor: Color.gray,
          fontSize: 14,
          fontFamily: config.codeEditor.defaultStyle.fontFamily
        }
      },
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

  constructor(props) {
    super(props);

    let {
      ui: {
        targetPicker,
        propertyTree,
        resizer,
        terminalToggler,
        unknowns,
        internals,
        searchField,
        codeEditor,
        fixImportButton
      }
    } = this;

    // FIXME? how to specify that directly??
    codeEditor.changeEditorMode("js").then(() =>
      codeEditor.evalEnvironment = {
        targetModule: "lively://lively.morphic/inspector",
        get context() { return codeEditor.owner.selectedObject },
        format: "esm"
      }
    ).catch(err => $world.logError(err));

    connect(targetPicker,    'onMouseDown', this, 'selectNewTarget');
    connect(propertyTree,    'onScroll',    this, 'repositionOpenWidget');
    connect(resizer,         'onDrag',      this, 'adjustProportions');
    connect(terminalToggler, 'onMouseDown', this, 'toggleCodeEditor');
    connect(unknowns,        'trigger',     this, 'filterProperties');
    connect(internals,       'trigger',     this, 'filterProperties');
    connect(searchField,     'searchInput', this, 'filterProperties');
    connect(this,            "extent",      this, "relayout");
    connect(fixImportButton, 'fire',        codeEditor, 'execCommand', {
      updater: ($upd) => $upd(
        "[javascript] fix undeclared variables",
        {autoApplyIfSingleChoice: true})});
  }

  refreshAllProperties() {
    if (!this.targetObject || !this.targetObject.isMorph) return;
    if (this.targetObject._styleSheetProps != this.lastStyleSheetProps) {
      this.refreshTreeView();
      this.lastStyleSheetProps = this.targetObject._styleSheetProps;
      return;
    }
    let change = last(this.targetObject.env.changeManager.changesFor(this.targetObject));
    if (change == this.lastChange && this.lastSubmorphs == printValue(this.targetObject && this.targetObject.submorphs)) 
      return;
    if (this.focusedNode && this.focusedNode.keyString == change.prop) {
      this.repositionOpenWidget();
      return;
    }
    this.lastChange = change;
    this.lastSubmorphs = printValue(this.targetObject && this.targetObject.submorphs)
    this.refreshTreeView()
  }

  refreshTreeView() {
    this.originalTreeData && this.originalTreeData.asListWithIndexAndDepth(false).forEach(({node}) => {
      let v = this.targetObject[node.key];
      if (!obj.equals(v, node.value) && node.refreshProperty) {
         node.refreshProperty(v);
      }
    });
  }

  get isInspector() { return true; }

  async prepareForNewTargetObject(target) {
    if (this.isUpdating()) await this.whenUpdated();

    var {promise: p, resolve} = promise.deferred();
    this.updateInProgress = p;
    try {
      var td = InspectorTreeData.forObject(target),
          tree = this.ui.propertyTree,
          prevTd = tree.treeData;
      td.collapse(td.root, false);
      td.collapse(td.root.children[0], false);
      var changedNodes = this.originalTreeData && this.originalTreeData.diff(td);
      if (changedNodes) {
        for (let [curr, upd] of changedNodes)
          curr.refreshProperty(upd.value);
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

    this.startStepping(10,'refreshAllProperties');
    this.updateInProgress = null;
  }

  isUpdating() { return !!this.updateInProgress; }

  whenUpdated() { return this.updateInProgress || Promise.resolve(); }

  focus() {
    this.ui.codeEditor.focus();
  }

  build() {
    var textStyle = {
          type: "text",
          borderWidth: 1, borderColor: Color.gray,
          lineWrapping: "by-chars",
          ...config.codeEditor.defaultStyle,
          textString: ""
        },
        searchBarBounds = rect(0,0,this.width, 30),
        searchField = new SearchField({
          styleClasses: ["idle"],
          name: "searchField",
        });

    this.submorphs = [
      {
        name: "searchBar",
        layout: new GridLayout({
          grid: [["searchField", "targetPicker", "internals", "unknowns"]],
          rows: [0, {paddingTop: 5, paddingBottom: 3}],
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
        name: "propertyTree", ...this.treeStyle,
        treeData: InspectorTreeData.forObject(null)
      }),
      Icon.makeLabel('keyboard-o', {
        name: 'terminal toggler',
        styleClasses: ['toggle', 'inactive']
      }),
      {name: "resizer"},
      {name: "codeEditor", ...textStyle},
      {
        name: 'fix import button', type: "button",
        label: "fix undeclared vars", extent: pt(100, 20)
      }
    ];
  }

  selectNewTarget() {
    this.ui.targetPicker.fontColor = Color.orange;
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
    this.ui.targetPicker.fontColor = Color.black;
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
    once(this.ui.propertyTree, "onMouseDown", this, "closeOpenWidget");
    connect(this.getWindow(), 'bringToFront', widget, 'openInWorld', {
      converter: () => widget.globalPosition, varMapping: {widget}
    });
  }

  repositionOpenWidget(evt) {
    if (this.openWidget) {
      let pos = this.focusedNode.control.globalBounds().center(),
          x = Math.min(pos.x, this.globalBounds().center().x),
          treeBounds = this.ui.propertyTree.globalBounds();
      if (pos.y < treeBounds.top()) {
        pos = treeBounds.topCenter().withX(x)
      } else if (treeBounds.bottom() - 20 < pos.y) {
        pos = treeBounds.bottomCenter().addXY(0, -20).withX(x);
      }
      this.openWidget.animate({position: pos, duration: 200});
    }
  }

  adjustProportions(evt) {
    this.layout.row(1).height += evt.state.dragDelta.y;
    this.relayout();
  }

  isEditorVisible() { return this.ui.codeEditor.height > 10; }

  makeEditorVisible(bool) {
    if (bool === this.isEditorVisible()) return;
    let {
      extent: prevExtent, layout,
      ui: {terminalToggler, codeEditor}
    } = this;
    layout.disable();
    if (!bool) {
      this.codeEditorHeight = layout.row(3).height;
      terminalToggler.styleClasses = ['inactive', 'toggle'];
      layout.row(3).height = layout.row(2).height = 0;
    } else {
      terminalToggler.styleClasses = ['active', 'toggle'];
      layout.row(3).height = this.codeEditorHeight || 180;
      layout.row(2).height = 5;
    }
    this.extent = prevExtent;
    layout.enable({duration: 300});
    this.relayout({duration: 300});
    codeEditor.focus();
  }

  async toggleCodeEditor() {
    this.makeEditorVisible(!this.isEditorVisible());
  }

  filterProperties() {
    let searchField = this.ui.searchField,
        tree = this.ui.propertyTree;
    if (!this.originalTreeData)
      this.originalTreeData = tree.treeData;
    disconnect(tree.treeData, 'onWidgetOpened', this, 'onWidgetOpened');
    this.originalTreeData.filter({
       maxDepth: 2, showUnknown: this.ui.unknowns.checked,
       showInternal: this.ui.internals.checked,
       iterator: (node) => searchField.matches(node.key)
    });
    tree.treeData = this.originalTreeData;
    connect(tree.treeData, 'onWidgetOpened', this, 'onWidgetOpened');
  }

  async relayout(animated={}) {
    this.layout.forceLayout(); // removes "sluggish" button alignment
    let {ui: {
          fixImportButton,
          terminalToggler: toggler,
          propertyTree: tree,
          codeEditor
        }} = this,
        togglerBottomLeft = tree.bounds().insetBy(5).bottomLeft(),
        buttonTopRight = codeEditor.bounds().insetBy(5).topRight();

    if (animated.duration) {
      toggler.animate({bottomLeft: togglerBottomLeft, ...animated})
      fixImportButton.animate({topRight: buttonTopRight, ...animated});
    } else {
      toggler.bottomLeft = togglerBottomLeft;
      fixImportButton.topRight = buttonTopRight;
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
