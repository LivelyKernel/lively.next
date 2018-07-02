/*global Map*/
import { Color, Rectangle, rect, pt } from "lively.graphics";

import { obj, arr, promise, string } from "lively.lang";
import { connect, signal, disconnect, once } from "lively.bindings";
import { Morph, GridLayout, HorizontalLayout, morph, CustomLayout, Label, Icon, StyleSheet, config } from "lively.morphic";
import { Tree, DropDownList, TreeData } from "lively.components";
import { DropDownSelector, SearchField, LabeledCheckBox } from "lively.components/widgets.js";
import { MorphHighlighter, InteractiveMorphSelector } from "lively.halos/morph.js";

import { NumberWidget, StringWidget, IconWidget, PaddingWidget,
  VerticesWidget, ShadowWidget, PointWidget, StyleSheetWidget,
  BooleanWidget, LayoutWidget, ColorWidget } from "../value-widgets.js";


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
  if (knownSymbols.get(sym)) return knownSymbols.get(sym);
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
  if (result.length > 500) result = result.slice(0, 20) + `...[${result.length - 20} CHARS]"`;
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

function isMultiValue(foldableValue, propNames) {
    return !arr.every(propNames.map(p => foldableValue[p]),
        v => obj.equals(v, foldableValue && foldableValue.valueOf()))
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
};

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

  display() {
    let {keyString, valueString} = this;
    if (!this.interactive) return `${keyString}: ${valueString}`;
    return this._propertyWidget || (this._propertyWidget = new DraggableTreeLabel({value: `${keyString}: ${valueString}`}));
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

  display() {
    let {_propertyWidget: w, keyString, valueString, target, value, spec} = this;

    if (!this.interactive && !(spec.foldable && isMultiValue(value, spec.foldable))) {
      return PropertyControl.render({
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
    w = this._propertyWidget = PropertyControl.render({
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

class DraggedProp extends Morph {

  static get properties() {
    return {
      control: {},
      sourceObject: {},
      borderColor: {defaultValue: Color.rgb(169,204,227)},
      fill: {defaultValue: Color.rgb(235, 245, 251).withA(.8)},
      borderWidth: {defaultValue: 2},
      borderRadius: {defaultValue: 4},
      submorphs: {
        after: ["control"],
        initialize() {
          let {control} = this;
          if (!control) return this.submorphs = [];
          this.height = 22;
          this.submorphs = [control];
          control.top = 0;
          control.fontSize = 14;
          if (typeof control.relayout === "function")
            control.relayout();
          this.width = control.width + 20;
          this.adjustOrigin(pt(10,10));
        }
      }
    };
  }

  applyToTarget(evt) {
    let {currentTarget: target, control} = this;
    this.remove();
    MorphHighlighter.removeHighlighters(evt.world);
    if (!target) return;

    if (!target.isText || target.editorModeName !== "js") {
      // normal apply prop
      if (control.hasOwnProperty("propertyValue"))
        target[control.keyString] = control.propertyValue;
      return;
    }

    // rk 2017-10-01 FIXME this is a hack to get droppable code in...
    // this needs to go somewhere else and needs a better UI, at least
    let editor = target,
        toObject = editor.evalEnvironment.context,
        textPos = editor.textPositionFromPoint(editor.localize(evt.position)),
        expr = this.sourceObject.generateReferenceExpression({fromMorph: toObject});
    if (control.keyString) expr += "." + control.keyString;
    editor.insertTextAndSelect(expr, textPos);
    editor.focus();
  }

  update(handPosition) {
    var target = this.morphBeneath(handPosition), hiddenMorph;
    if (!target) return;
    if (target == this.morphHighlighter) {
      target = target.morphBeneath(handPosition);
    }
    while (hiddenMorph = [target, ...target.ownerChain()].find(m => !m.visible)) {
      target = hiddenMorph = hiddenMorph.morphBeneath(handPosition);
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

class DraggableTreeLabel extends Label {

  static get properties() {
    return {
      styleClasses: {defaultValue: ["TreeLabel"]},
      draggable: {defaultValue: true},
      nativeCursor: {defaultValue: "-webkit-grab"},
      keyString: {},
      valueString: {},
      fontFamily: {defaultValue: config.codeEditor.defaultStyle.fontFamily},
      fill:  {defaultValue: Color.transparent},
      padding: {defaultValue: rect(0,0,10,0)}
    };
  }

  get inspector() { return this.owner.owner.owner; }

  onDragStart(evt) {
    this.draggedProp = new DraggedProp({
      sourceObject: this.inspector.targetObject,
      control: this.copy()
    });
    this.draggedProp.openInWorld();
    connect(evt.hand, "position", this.draggedProp, "update");
  }

  onDrag(evt) {}

  onDragEnd(evt) {
    disconnect(evt.hand, "position", this.draggedProp, "update");
    this.draggedProp.applyToTarget(evt);
  }

}

export class PropertyControl extends DraggableTreeLabel {

  static get properties() {
    return {
      root: {},
      keyString: {},
      valueString: {},
      propertyValue: {},
      isSelected: {
        after: ['submorphs'],
        set(b) {
          this.setProperty('isSelected', b);
          if (this.control) this.control.isSelected = b;  
        }
      },
      control: {
        after: ["submorphs"],
        derived: true,
        get() { return this.submorphs[0] || false; },
        set(c) { this.submorphs = [c]; }
      },
      layout: {
        initialize() {
          this.layout = new CustomLayout({relayout: (self) => { self.relayout(); }});
        }
      },
      submorphs: {
        initialize() {
          this.value = this.keyString + ":";
          this.submorphs = [];
        }
      }
    };
  }

  static inferType({keyString, value}) {
    if (value && (value.isColor || value.isGradient)) {
      return "Color";
    } else if (value && value.isPoint) {
      return "Point";
    } else if (obj.isBoolean(value)) {
      return "Boolean";
    } else if (obj.isNumber(value)) {
      return "Number";
    } else if (obj.isString(value)) {
      return "String";
    } else if (value && value.isRectangle) {
      return "Rectangle";
    }
    return false;
  }

  static render(args) {
    let propertyControl;

    if (!args.spec.type) args.spec = {
      ...args.spec,
      type: this.inferType(args)
    }; // non mutating

    switch (args.spec.type) {
      // 12.6.17
      // rms: not sure wether a string based spec is that effective in the long run
      //      it may require too much dedicated maintenance
      case "Icon":
        propertyControl = this.renderIconControl(args); break;
      case "Color":
        propertyControl = this.renderColorControl(args); break;
      case "ColorGradient":
        propertyControl = this.renderColorControl({...args, gradientEnabled: true}); break;
      case "Number":
        propertyControl = this.renderNumberControl(args); break;
      case "String":
        propertyControl = this.renderStringControl(args); break;
      case "RichText":
        propertyControl = this.renderStringControl(args); break;
      case "Layout":
        propertyControl = this.renderLayoutControl(args); break;
      case "Enum":
        propertyControl = this.renderEnumControl(args); break;
      case "Vertices":
        propertyControl = this.renderVertexControl(args); break;
      case "Shadow":
        propertyControl = this.renderShadowControl(args); break;
      case "Point":
        propertyControl = this.renderPointControl(args); break;
      case "StyleSheets":
        propertyControl = this.renderStyleSheetControl(args); break;
      case "Rectangle":
        propertyControl = this.renderRectangleControl(args); break;
      case "Boolean":
        propertyControl = this.renderBooleanControl(args); break;
      default:
        propertyControl = this.renderItSomehow(args);
    }

    if (propertyControl.control) {
      connect(propertyControl.control, "openWidget", propertyControl, "openWidget");
      propertyControl.toggleFoldableValue(args.value);
      return propertyControl;
    }

    return propertyControl;
  }

  renderValueSelector(propertyControl, selectedValue, values) {
    propertyControl.control = new DropDownSelector({
      opacity: 0.8,
      fill: Color.white.withA(0.5),
      name: "valueString",
      styleClasses: ["TreeLabel"],
      selectedValue,
      padding: 0,
      values
    });
    connect(propertyControl.control, "update", propertyControl, "propertyValue", {
      updater: function ($upd, val) {
        if (this.targetObj.propertyValue != val) $upd(val);
      }
    });
    connect(propertyControl, "update", propertyControl.control, "selectedValue", {
      updater: function ($upd, val) {
        val = (val && val.valueOf) ? val.valueOf() : val;
        if (this.targetObj.propertyValue != val) $upd(val);
      }
    });
    return propertyControl;
  }

  static baseControl({keyString, valueString, value, spec}) {
    let propertyControl = new this({
      keyString,
      valueString,
      propertyValue: value
    });
    if (spec.foldable) {
      propertyControl.asFoldable(spec.foldable);
    }
    return propertyControl;
  }

  toggleMultiValuePlaceholder(active) {
    this.multiValuePlaceholder = this.multiValuePlaceholder || this.addMorph({
      fill: Color.transparent,
      layout: new HorizontalLayout({spacing: 3}),
      name: "multi value placeholder",
      nativeCursor: "pointer",
      submorphs: arr.range(0,2).map(i => ({
        type: "ellipse",
        fill: Color.gray.withA(.5),
        reactsToPointer: false,
        extent: pt(7,7)
      }))
    });
    if (active) {
      connect(this.multiValuePlaceholder, "onMouseDown", this, "propertyValue", {
        converter: function() { return this.targetObj.propertyValue.valueOf(); }
      });
      this.control.opacity = 0;
      this.multiValuePlaceholder.visible = true;
    } else {
      disconnect(this.multiValuePlaceholder, "onMouseDown", this, "propertyValue");
      this.control.opacity = 1;
      this.multiValuePlaceholder.visible = false;
    }
  }

  toggleFoldableValue(newValue) {
    if (!this.foldableProperties) return;
    this.toggleMultiValuePlaceholder(isMultiValue(newValue, this.foldableProperties));
  }

  asFoldable(foldableProperties) {
    this.foldableProperties = foldableProperties;
    connect(this, "update", this, "toggleFoldableValue");
  }

  static renderEnumControl(args) {
    let propertyControl,
        {fastRender, value, spec: {values}, valueString, keyString} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
              ` ${value ? (value.valueOf ? value.valueOf() : value) : 'Not set'}`, 
              {fontColor: Color.darkGray.darker()}]
    }
    propertyControl = this.baseControl(args);
    return propertyControl.renderValueSelector(propertyControl, 
      value && value.valueOf ? value.valueOf() : value, values);
  }

  static renderIconControl(args) {
    let propertyControl,
        {value, fastRender, keyString, valueString} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
              ` ${valueString}`, {fontColor: Color.darkGray}];
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new IconWidget({name: "valueString", iconValue: value});
    connect(propertyControl.control, "iconValue", propertyControl, "propertyValue");
    return propertyControl;
  }

  static renderStringControl(args) {
    let propertyControl,
        {value, fastRender, keyString, valueString, node} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
              ` ${value.length > 200 ? value.slice(0, 20) + '...' : value}`, {fontColor: Color.blue, paddingTop: '1px'}];
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new StringWidget({
      name: "valueString",
      stringValue: value || "",
      readOnly: keyString == "id"
    });
    connect(propertyControl.control, "stringValue", propertyControl, "propertyValue");
    connect(node, "isSelected", propertyControl.control, "isSelected");
    return propertyControl;
  }

  static renderRectangleControl(args) {
    let propertyControl,
        {value, fastRender, keyString, valueString} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
              ` ${valueString}`, {fontColor: Color.black}];
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new PaddingWidget({name: "valueString", rectangle: value});
    connect(propertyControl.control, "rectangle", propertyControl, "propertyValue");
    return propertyControl;
  }

  static renderVertexControl(args) {
    let propertyControl,
        {target, valueString, keyString, fastRender} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
              ` ${valueString}`, {fontColor: Color.black}]
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new VerticesWidget({context: target});
    connect(propertyControl.control, "vertices", propertyControl, "propertyValue");
    return propertyControl;
  }

  static renderBooleanControl(args) {
    let propertyControl, {value, keyString, valueString, fastRender} = args;
    if (fastRender) {
       return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
               ` ${valueString}`, {fontColor: value ? Color.green : Color.red}]
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new BooleanWidget({name: "valueString", boolean: value});
    connect(propertyControl.control, "boolean", propertyControl, "propertyValue");
    return propertyControl;
  }

  static renderNumberControl(args) {
    let propertyControl, {value, spec, keyString, valueString, fastRender} = args;
    var baseFactor = .5, floatingPoint = spec.isFloat;
    
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
             ` ${value != undefined && (value.valueOf ? value.valueOf() : value.valueString)}`, 
              {fontColor: NumberWidget.properties.fontColor.defaultValue}]
    }
    if ("max" in spec && "min" in spec
        && spec.min != -Infinity && spec.max != Infinity) {
      baseFactor = (spec.max - spec.min) / 100;
      floatingPoint = true;
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new NumberWidget({
      name: "valueString",
      baseFactor,
      extent: pt(50,17),
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
    connect(propertyControl.control, "update", propertyControl, "propertyValue");
    connect(propertyControl, "update", propertyControl.control, "number", {
      updater: function($upd, val) {
        val = (val && val.valueOf ? val.valueOf() : val) || 0;
        if (this.targetObj.number != val) $upd(val);
      }
    });
    return propertyControl;
  }

  static renderShadowControl(args) {
    let propertyControl, {fastRender, keyString, valueString, value} = args;
    if (fastRender) {
      // FIXME: actually display name of shadow
       return [`${keyString}:`, {nativeCursor: "-webkit-grab", paddingRight: '6pt'}, 
               `${value ? valueString : 'No Shadow'}`, {fontColor: Color.darkGray.darker()}]
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new ShadowWidget({name: "valueString", shadowValue: args.value});
    connect(propertyControl.control, "update", propertyControl, "propertyValue");
    connect(propertyControl, "update", propertyControl.control, "shadowValue", {
      updater: function($upd, val) {
        val = (val && val.valueOf ? val.valueOf() : val) || null;
        if (this.targetObj.shadowValue != val) $upd(val);
      }
    });
    return propertyControl;
  }

  static renderStyleSheetControl(args) {
    let propertyControl, {target, fastRender, valueString, keyString} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
               ` ${valueString}`, {fontColor: Color.black}]
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new StyleSheetWidget({context: target});
    return propertyControl;
  }

  static renderPointControl(args) {
    let propertyControl, {fastRender, keyString, valueString, value} = args,
        numberColor = NumberWidget.properties.fontColor.defaultValue;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
              ` pt(`, {}, 
              `${value.x}`, {fontColor: numberColor},
              ',', {}, `${value.y}`, {fontColor: numberColor}, ')', {}]
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new PointWidget({name: "valueString", pointValue: args.value});
    connect(propertyControl.control, "pointValue", propertyControl, "propertyValue");
    connect(propertyControl, "update", propertyControl.control, "pointValue", {
      updater: function ($upd, val) {
        val = val && val.valueOf ? val.valueOf() : val;
        if (!this.targetObj.pointValue.equals(val)) $upd(val);
      }
    });
    return propertyControl;
  }

  static renderLayoutControl(args) {
    let propertyControl, {target, fastRender, valueString, keyString, value} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
               ` ${value ? valueString : 'No Layout'}`, {fontColor: Color.black}];
    }
    propertyControl = this.baseControl(args);
    propertyControl.control = new LayoutWidget({context: target});
    connect(propertyControl.control, "layoutChanged", propertyControl, "propertyValue");
    return propertyControl;
  }

  static renderColorControl(args) {
    let propertyControl, {node, gradientEnabled, fastRender, 
                          valueString, keyString, value, target} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab", paddingRight: '23px'},
               `${value ? (value.valueOf ? value.valueOf() : valueString) : 'No Color'}`, {
                 fontColor: Color.darkGray}]
    } 
    propertyControl = this.baseControl(args);
    propertyControl.control = new ColorWidget({
      color: (args.value && args.value.valueOf) ? args.value.valueOf() : args.value,
      gradientEnabled, context: target
    });
    connect(propertyControl.control, "update", propertyControl, "propertyValue");
    connect(propertyControl, "update", propertyControl.control, "color", {
      updater: function ($upd, val) {
        val = (val && val.valueOf )? val.valueOf() : val;
        if (!this.targetObj.color.equals(val)) $upd(val);
      }
    });
    return propertyControl;
  }

  static renderItSomehow(args) {
    let propertyControl, {fastRender, keyString, valueString} = args;
    if (fastRender) {
      return [`${keyString}:`, {nativeCursor: "-webkit-grab"}, 
              ` ${valueString}`, {fontColor: Color.black}]
    }
    propertyControl = this.baseControl(args);
    propertyControl.value += " " + args.valueString;
    return propertyControl;
  }

  relayout() {
    this.fit();    
    if (this.control) {
      this.control.topLeft = this.textBounds().topRight().addXY(-2,0);
      this.width = this.textBounds().width + this.control.bounds().width;
    }

    this.height = 18;

    if (this.multiValuePlaceholder) {
      this.multiValuePlaceholder.leftCenter = this.textBounds().rightCenter();
    }
  }

  toString() {
    return `${this.keyString}: ${this.valueString}`;
  }

  highlight() {
    if (this.highlighter) this.highlighter.remove();
    const hl = this.highlighter = this.addMorph(({type: "label", name: "valueString", value: this.keyString}));
    hl.isLayoutable = false;
    hl.fontWeight = "bold", hl.fontColor = Color.orange;
    hl.reactsToPointer = false;
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
    return ["root"];
  }

  asListWithIndexAndDepth(filtered = true) {
    return super.asListWithIndexAndDepth(({node}) => filtered ? node.visible : true);
  }

  static forObject(obj) {
    return new this({key: "inspectee", value: {inspectee: obj}, isCollapsed: true});
  }

  display(node) { return node.display(); }

  isCollapsed(node) { return node.isCollapsed; }

  collapse(node, bool) {
    node.isCollapsed = bool;
    if (bool || this.isLeaf(node)) return;

    if (!node.children.length) {
      // if number of children is large, we only render them in batches,
      // that can be expanded selectively by the user
      node.children = propertiesOf(node).map(node => {
        this.parentMap.set(node, node);
        return node;
      });
    }
  }

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
  
  getChildren(node) {
    if (node.children && node.children.filter(c => c.visible).length > 1000) {
      return node._childGenerator || (node._childGenerator = this.partitionedChildren(node.children))
    } else {
      return node.children;
    }    
  }

  isLeaf(node) { return obj.isPrimitive(node.value); }

  filter({sorter, maxDepth = 1, iterator, showUnknown, showInternal}) {
    this.uncollapseAll(
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

  onMouseMove(evt) {
    let tree = this.ui.propertyTree,
        loc = tree.textPositionFromPoint(evt.positionIn(tree)),
        node;
    if (loc && (node = tree.nodes[loc.row + 1])) {
      if (node.interactive || this.lastInteractive == node) return;
      if (this.lastInteractive) {
        this.lastInteractive.interactive = false;  
      }
      this.lastInteractive = node;
      node.interactive = true;
      tree.update(true);
    }
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
      openWidget: {
        type: "Morph"
      },

      targetObject: {
        after: ["submorphs"],
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
          var sel = this.ui.propertyTree.selectedNode;
          return sel ? sel.value : this.targetObject;
        }
      },

      submorphs: {initialize() { this.build(); }},

      layout: {
        after: ["submorphs"],
        initialize() {
          this.layout = new GridLayout({
            manualUpdate: true,
            grid: [["searchBar"],
              ["propertyTree"],
              ["resizer"],
              ["codeEditor"]],
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
            fixImportButton:  this.getSubmorphNamed("fix import button"),
            thisBindingSelector: this.getSubmorphNamed("this binding selector"),
            propertyTree:     this.getSubmorphNamed("propertyTree"),
            unknowns:         this.getSubmorphNamed("unknowns"),
            internals:        this.getSubmorphNamed("internals"),
            targetPicker:     this.getSubmorphNamed("targetPicker"),
            searchBar:        this.getSubmorphNamed("searchBar"),
            searchField:      this.getSubmorphNamed("searchField"),
            resizer:          this.getSubmorphNamed("resizer")
          };
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
              fontWeight: "bold"
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
              fontSize: 14
            },
            "[name=propertyTree] .DraggableTreeLabel": {
              fontSize: 14
            },
            "[name=propertyTree]": {
              fontSize: 14
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
        fixImportButton,
        thisBindingSelector
      }
    } = this;
    // FIXME? how to specify that directly??
    codeEditor.changeEditorMode("js").then(() =>
      codeEditor.evalEnvironment = {
        targetModule: "lively://lively.morphic/inspector",
        get context() {
          return thisBindingSelector.selection == "selection" ?
            codeEditor.owner.selectedObject : codeEditor.owner.targetObject;
        },
        format: "esm"
      }
    ).catch(err => $world.logError(err));

    connect(targetPicker,    "onMouseDown", this, "selectTarget");
    connect(propertyTree,    "onScroll",    this, "repositionOpenWidget");
    connect(resizer,         "onDrag",      this, "adjustProportions");
    connect(terminalToggler, "onMouseDown", this, "toggleCodeEditor");
    connect(unknowns,        "trigger",     this, "filterProperties");
    connect(internals,       "trigger",     this, "filterProperties");
    connect(searchField,     "searchInput", this, "filterProperties");
    connect(propertyTree,    "onNodeCollapseChanged", this, 'filterProperties');
    connect(this,            "extent",      this, "relayout");
    connect(thisBindingSelector, "selection", this, "bindCodeEditorThis");
    connect(fixImportButton, "fire",        codeEditor, "execCommand", {
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
    let change = arr.last(this.targetObject.env.changeManager.changesFor(this.targetObject));
    if (change == this.lastChange && this.lastSubmorphs == printValue(this.targetObject && this.targetObject.submorphs))
      return;
    if (this.focusedNode && this.focusedNode.keyString == change.prop) {
      this.repositionOpenWidget();
    }
    this.lastChange = change;
    this.lastSubmorphs = printValue(this.targetObject && this.targetObject.submorphs);
    this.refreshTreeView();
  }

  refreshTreeView() {
    var v;
    this.originalTreeData && this.originalTreeData.asListWithIndexAndDepth(false).forEach(({node}) => {
      if (node.foldableNode) {
        v = this.targetObject[node.foldableNode.key][node.key];
      } else {
        v = this.targetObject[node.key];
      }
      if (!obj.equals(v, node.value) && node.refreshProperty) {
        node.refreshProperty(v);
      }
    });
    this.ui.propertyTree.update();
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

    this.startStepping(10,"refreshAllProperties");
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
        rightArrow = Icon.makeLabel("long-arrow-right").textAndAttributes,
        searchBarBounds = rect(0,0,this.width, 30),
        searchField = new SearchField({
          styleClasses: ["idle"],
          name: "searchField",
        });

    rightArrow[1].paddingTop = "2px";

    this.submorphs = [
      {
        name: "searchBar",
        layout: new GridLayout({
          manualUpdate: true,
          grid: [["searchField", "targetPicker", "internals", "unknowns"]],
          rows: [0, {paddingTop: 5, paddingBottom: 3}],
          columns: [0, {paddingLeft: 5, paddingRight: 5},
            1, {fixed: 25},
            2, {fixed: 75}, 3, {fixed: 80}]
        }),
        height: 30,
        submorphs: [
          searchField,
          Icon.makeLabel("crosshairs", {name: "targetPicker",
            tooltip: "Change Inspection Target"}),
          new LabeledCheckBox({label: "Internals", name: "internals"}),
          new LabeledCheckBox({label: "Unknowns", name: "unknowns"})
        ]
      },
      new Tree({
        name: "propertyTree", ...this.treeStyle,
        treeData: InspectorTreeData.forObject(null)
      }),
      Icon.makeLabel("keyboard-o", {
        name: "terminal toggler",
        styleClasses: ["toggle", "inactive"]
      }),
      {name: "resizer"},
      {name: "codeEditor", ...textStyle},
      {
        name: "fix import button", type: "button",
        fill:  Color.black.withA(.5),
        fontColor: Color.white,
        borderWidth: 0, visible: false,
        label: "fix undeclared vars", extent: pt(100, 20)
      },
      {
        name: "this binding selector", type: DropDownList,
        fill: Color.black.withA(.5),
        padding: Rectangle.inset(3),
        fontColor: Color.white, borderWidth: 0,
        visible: false,
        selection: "selection",
        items: [{isListItem: true, value: "target",
          label: ["this ", null, ...rightArrow, " target", null]},
        {isListItem: true, value: "selection",
          label: ["this ", null, ...rightArrow, " selection", null]}]
      }
    ];
  }

  async selectTarget() {
    var newTarget;
    if (this.env.eventDispatcher.isKeyPressed("Shift")) {
      [newTarget] = await $world.execCommand("select morph", {justReturn: true});
    } else {
      this.toggleSelectionInstructions(true);
      newTarget = await InteractiveMorphSelector.selectMorph();
      this.toggleSelectionInstructions(false);
    }
    if (newTarget) this.targetObject = newTarget;
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
    disconnect(this.getWindow(), "bringToFront", this.openWidget, "openInWorld");
  }

  onWidgetOpened({widget}) {
    if (this.openWidget) {
      this.openWidget.fadeOut();
    }
    this.focusedNode = this.ui.propertyTree.selectedNode;
    this.openWidget = widget;
    once(widget, 'close', this, 'closeOpenWidget');
    once(this.ui.propertyTree, "onMouseDown", this, "closeOpenWidget");
    connect(this.getWindow(), "bringToFront", widget, "openInWorld", {
      converter: () => widget.globalPosition, varMapping: {widget}
    });
  }

  repositionOpenWidget(evt) {
    if (this.openWidget && this.focusedNode) {
      let {propertyTree} = this.ui,
          {height, x, y} = propertyTree.textLayout.boundsFor(propertyTree, {column: 0, row: propertyTree.selectedIndex - 1}),
          pos = propertyTree.worldPoint(pt(x,y + height/2)).addPt(propertyTree.scroll.negated()),
          treeBounds = propertyTree.globalBounds();
      pos.x = this.globalBounds().center().x
      if (pos.y < treeBounds.top()) {
        pos = treeBounds.topCenter();
      } else if (treeBounds.bottom() - 20 < pos.y) {
        pos = treeBounds.bottomCenter().addXY(0, -20);
      }
      this.openWidget.top = pos.y;
    }
  }

  adjustProportions(evt) {
    this.layout.row(1).height += evt.state.dragDelta.y;
    this.relayout();
  }

  isEditorVisible() { return this.ui.codeEditor.height > 10; }

  makeEditorVisible(show) {
    if (show === this.isEditorVisible()) return;
    let {
      extent: prevExtent, layout,
      ui: {terminalToggler, codeEditor, 
           thisBindingSelector, fixImportButton}
    } = this, duration = 200;
    layout.disable();
    if (show) {
      terminalToggler.styleClasses = ["active", "toggle"];
      layout.row(3).height = this.codeEditorHeight || 180;
      layout.row(2).height = 5;
      fixImportButton.opacity = thisBindingSelector.opacity = 0;
      fixImportButton.visible = thisBindingSelector.visible = true;
      fixImportButton.animate({opacity: 1, duration});
      thisBindingSelector.animate({opacity: 1, duration});
    } else {
      this.codeEditorHeight = layout.row(3).height;
      terminalToggler.styleClasses = ["inactive", "toggle"];
      layout.row(3).height = layout.row(2).height = 0;
      fixImportButton.opacity = thisBindingSelector.opacity = 1;
      fixImportButton.animate({visible: false, opacity: 0, duration});
      thisBindingSelector.animate({visible: false, opacity: 0, duration});
    }
    this.extent = prevExtent;
    layout.enable({duration});
    this.relayout({duration});
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
    disconnect(tree.treeData, "onWidgetOpened", this, "onWidgetOpened");
    tree.treeData.filter({
      maxDepth: 2, showUnknown: this.ui.unknowns.checked,
      showInternal: this.ui.internals.checked,
      iterator: (node) => searchField.matches(node.key)
    });
    tree.update();
    connect(tree.treeData, "onWidgetOpened", this, "onWidgetOpened");
  }

  async relayout(animated={}) {
    this.layout.forceLayout(); // removes "sluggish" button alignment
    let {ui: {
          fixImportButton,
          terminalToggler: toggler,
          propertyTree: tree,
          thisBindingSelector,
          codeEditor
        }} = this,
        togglerBottomLeft = tree.bounds().insetBy(5).bottomLeft(),
        importBottomRight = tree.bounds().insetBy(5).bottomRight(),
        bindingBottomRight = importBottomRight.subXY(fixImportButton.width + 10, 0);

    if (animated.duration) {
      toggler.animate({bottomLeft: togglerBottomLeft, ...animated});
      fixImportButton.animate({bottomRight: importBottomRight, ...animated});
      thisBindingSelector.animate({bottomRight: bindingBottomRight, ...animated});
    } else {
      toggler.bottomLeft = togglerBottomLeft;
      fixImportButton.bottomRight = importBottomRight;
      thisBindingSelector.bottomRight = bindingBottomRight;
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
