/* globals Power4 */
import { Color, rect, pt } from "lively.graphics";
import { obj, arr, promise, string } from "lively.lang";
import { connect, disconnect, once } from "lively.bindings";
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

function propertiesOf(target) {
  if (!target) return [];

  var seen = {}, props = [],
      isCollapsed = true,
      context = target.isMorph ? 
        {target, propertiesAndSettings: target.propertiesAndPropertySettings()} : {},
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
      props.push({
        priority, context,
        key, keyString: keyString || safeToString(key),
        value, valueString,
        isCollapsed
      });
    }
  }

  if (options.includeDefault) {
    var defaultProps = propertyNamesOf(target);
    for (let key of defaultProps) {
      if (key in seen) continue;
      var value = target[key], valueString = printValue(value);
      props.push({key, value, valueString, isCollapsed, context})
    }
    if (options.includeSymbols) {
      for (let key of Object.getOwnPropertySymbols(target)) {
        var keyString = safeToString(key), value = target[key], valueString = printValue(value);
        props.push({key, keyString, value, valueString, isCollapsed, context});
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
      propertyControl.asFoldable();
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
      return propertyControl;
    }
    
    return false;
  }
  
  renderValueSelector(propertyControl, selectedValue, values) {
    let selector = new DropDownSelector({
      opacity: 0.8,
      fill: Color.white.withA(0.5),
      name: "valueString",
      selectedValue,
      values
    });
    // hack: since derived properties that are parametrized by a style sheet do not
    //       yet take effect in a morph such as the drop down selector, we need to
    //       manually trigger an update at render time
    selector.whenRendered().then(() => selector.updateStyleSheet());
    connect(selector, "selectedValue", propertyControl, "propertyValue");
    propertyControl.control = selector;
    return propertyControl;
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

  static baseControl({keyString, valueString, value}) {
    return new this({
      keyString,
      valueString,
      propertyValue: value
    });
  }

  asFoldable() {
    // TODO: adjust the widget to display folded value or non reconciled "..." when folded values vary
  }

  renderEnumControl({value, spec: {values}}) {
    return this.renderValueSelector(this, value, values);
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

  renderNumberControl({value}) {
    this.control = new NumberWidget({
      name: "valueString",
      height: 17,
      baseFactor: 0.5,
      fill: Color.transparent,
      padding: rect(0),
      fontFamily: config.codeEditor.defaultStyle.fontFamily,
      number: value
    });
    connect(this.control, "number", this, "propertyValue");
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
    return this;
  }

  renderLayoutControl({target}) {
    this.control = new LayoutWidget({context: target});
    connect(this.control, "layoutChanged", this, "propertyValue");
    return this;
  }

  renderColorControl(args, gradientEnabled = false) {
    this.control = new ColorWidget({
          color: args.value,
          gradientEnabled
        });
    connect(this.control, "color", this, "propertyValue");
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

  static fromListWithDepthAndIndexes(nodes) {
    // ensure that the nodes are sorted by index, 
    // or else the parent child relationship
    // will be inferred incorrectly
    
    var [root, ...nodes] = arr.sortBy(nodes, ({i}) => i);
    root = {...root.node, children: []}; // create new node
    var stack = [], prev = root, morphStack = [];
    for(let {node, depth} of nodes) {
      if (stack.length < depth) {
        stack.push(prev);
        if (node.value && node.value.isMorph) {
          morphStack.push({
            target: node.value,
            propertiesAndSettings: node.value.propertiesAndPropertySettings()
          }); // push a new morph context        
        } else {
          morphStack.push(arr.last(morphStack)) // morph context stays the same
        }
      }
      if (stack.length > depth) {
        stack.pop();
        morphStack.pop();
      }
      stack[depth - 1].children.push(prev = {
        ...node, context: morphStack[depth - 1], children: []
      });
    }
    return new this(root)
  }

  static forObject(obj) {
    return new this({key: "inspectee", value: {inspectee: obj}, isCollapsed: true});
  }

  isInternalProperty(key) {
     return key == 'id' || key.includes('internal'); 
  }

  display(node) {
     /* Special display mode on certain data types:
        color, numbers (float, int) */
     var keyString = node.keyString || node.key,
         valueString = node.valueString || printValue(node.value),
         {target, propertiesAndSettings} = node.context || {},
         {spec} = (propertiesAndSettings && propertiesAndSettings.properties[keyString]) || {spec: {}},
         value = node.value,
         controlClass;
    
     if (node._propertyWidget){
        if (typeof node._propertyWidget == 'string') return node._propertyWidget;
        node._propertyWidget.keyString = keyString;
        node._propertyWidget.valueString = valueString;
        return node._propertyWidget;
     }
     
     node._propertyWidget = PropertyControl.render({
        target, keyString, 
        valueString, value, spec
     });
     if (node._propertyWidget) {
        node.isSelected = false; // should be replaced by a better selection style
        this.targetPropertyInfo = propertiesAndSettings.properties;
      if (
        !this.isInternalProperty(keyString) && 
        !(this.targetPropertyInfo[keyString] && this.targetPropertyInfo[keyString].readOnly)
      ) {
        connect(node._propertyWidget, "propertyValue", target, keyString);
        connect(node._propertyWidget, "openWidget", this, "onWidgetOpened", {
          converter: widget => {
            return {widget, node};
          },
          varMapping: {node: node._propertyWidget}
        });      
       }
     }
     return node._propertyWidget || (node._propertyWidget = `${keyString}: ${valueString}`);
  }
  
  isCollapsed(node) { return node.isCollapsed; }

  collapse(node, bool) {
    node.isCollapsed = bool;
    if (bool || this.isLeaf(node)) return;

    node.children = propertiesOf(node.value).map(node => {
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
    let filteredItems = this.asListWithIndexAndDepth().filter(({node, depth}) => {
      if (depth == 0) return true;
      if (depth > maxDepth) return false;
      if (!showUnknown && node.keyString && node.keyString.includes("UNKNOWN PROPERTY")) return false;
      if (!showInternal && node.keyString && node.keyString.includes("internal")) return false;
      if (node.value && node.value.submorphs) return true;
      return iterator(node);
    });
    return InspectorTreeData.fromListWithDepthAndIndexes(filteredItems);
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
    this.refreshProperties = () => {
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
    // slow!
   //if (!this.targetObject.isWorld) this.startStepping(50, 'refreshProperties');
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
          esc
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
      let pos = this.focusedNode.globalBounds().center(),
          treeBounds = this.get("propertyTree").globalBounds();
      if (pos.y < treeBounds.top()) {
        pos = treeBounds.topCenter()
      } else if (treeBounds.bottom() - 20 < pos.y) {
        pos = treeBounds.bottomCenter().addXY(0, -20);
      }
      this.openWidget.position = pos.withX(treeBounds.center().x);
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
      connect(this.originalData, 'onWidgetOpened', this, 'onWidgetOpened');
    }
    tree.treeData = this.originalData.filter({
       maxDepth: 2, showUnknown: this.get('unknowns').checked,
       showInternal: this.get('internals').checked,
       iterator: (node) => searchField.matches(node.key)
    });
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
