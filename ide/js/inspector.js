/* globals Power4 */
import { Color, rect, pt } from "lively.graphics";
import { obj, arr, promise, string } from "lively.lang";
import { connect, disconnect, once } from "lively.bindings";
import { Morph, CustomLayout, Label, Icon, StyleSheet, config } from "lively.morphic";
import { Tree, TreeData } from "lively.morphic/components/tree.js";

import { isBoolean, isString, isNumber } from "lively.lang/object.js";
import { DropDownSelector, SearchField, LabeledCheckBox } from "../../components/widgets.js";
import { last } from "lively.lang/array.js";

import { GridLayout } from "../../layout.js";

import { NumberWidget, StyleSheetWidget, BooleanWidget, LayoutWidget, ColorWidget } from "../value-widgets.js";

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
        priority,
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
      props.push({key, value, valueString, isCollapsed})
    }
    if (options.includeSymbols) {
      for (let key of Object.getOwnPropertySymbols(target)) {
        var keyString = safeToString(key), value = target[key], valueString = printValue(value);
        props.push({key, keyString, value, valueString, isCollapsed});
      }
    }
  }

  if (options.sort) props = options.sortFunction(target, props);

  return props;
}

export class PropertyControl extends Label {

  static render({
        target, property, keyString, 
        valueString, value
     }) {
     let propertyControl = new this({
        keyString,
        valueString
      });
     // TODO:  this dispatch logic should be defined through the property
     // definition interface (i.e. static get properties()) where properties
     // also can define their 'type' and how this type is supposed to be
     // controlled by the inspector or style sheet editor
     if (value && (value.isColor || value.isGradient)) {
        let colorWidget = new ColorWidget({
          color: value, 
          gradientEnabled: value.isGradient
        });
        connect(colorWidget, 'color', propertyControl, 'propertyValue');
        propertyControl.control = colorWidget;
     } if (property == 'layout') {
        propertyControl.control = new LayoutWidget({context: target});
     } else if (property == 'clipMode') {
        let selector = new DropDownSelector({
          fill: Color.white.withA(.5),
          name: 'valueString',
          selectedValue: value,
          values: ["visible", "hidden", "scroll", 'auto']
        });
        // hack: since derived properties that are parametrized by a style sheet do not
        //       yet take effect in a morph such as the drop down selector, we need to
        //       manually trigger an update at render time
        selector.whenRendered().then(() => selector.updateStyleSheet());
        connect(selector, 'selectedValue', propertyControl, 'propertyValue');
        propertyControl.control = selector;
     } else if (isBoolean(value)) {
       propertyControl.control = new BooleanWidget({
         name: 'valueString',
         boolean: value
       });
       connect(propertyControl.control, 'boolean', propertyControl, 'propertyValue');
     } else if (isNumber(value)) {
       propertyControl.control = new NumberWidget({
           name: 'valueString',
           height: 17, baseFactor: .5,
           fontFamily: config.codeEditor.defaultStyle.fontFamily,
           number: value,
        });
       connect(propertyControl.control, 'number', propertyControl, 'propertyValue');
     } else if (isString(value)) {
       //controlClass = StringPropertyControl;
     } else if (keyString == 'styleSheets') { 
       propertyControl.control = new StyleSheetWidget({context: target});
     }
    if (propertyControl.control) {
      connect(propertyControl.control, "openWidget", propertyControl, 'openWidget');
      return propertyControl;
    }
    return false;
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
            relayout(self) {
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
    var stack = [], prev = root;
    for(let {node, depth} of nodes) {
      if (stack.length < depth) {
        stack.push(prev);
      }
      if (stack.length > depth) {
        stack.pop();
      }
      stack[depth - 1].children.push(prev = {...node, children: []});
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
         target = this.root.value.inspectee,
         property = node.key || node.keyString,
         value = node.value,
         controlClass;
     if (node._propertyWidget){
        if (typeof node._propertyWidget == 'string') return node._propertyWidget;
        node._propertyWidget.keyString = keyString;
        node._propertyWidget.valueString = valueString;
        return node._propertyWidget;
     }
     
     node._propertyWidget = PropertyControl.render({
        target, property, keyString, 
        valueString, value
     });
     
     if (node._propertyWidget) {
        node.isSelected = false; // should be replaced by a better selection style
        this.targetPropertyInfo = this.targetPropertyInfo || target.propertiesAndPropertySettings().properties;
      if (
        !this.isInternalProperty(keyString) && 
        !(this.targetPropertyInfo[property] && this.targetPropertyInfo[property].readOnly)
      ) {
        connect(node._propertyWidget, "propertyValue", target, property);
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


// inspect(this)
export function inspect(targetObject) {
  return Inspector.openInWindow({targetObject});
}

export default class Inspector extends Morph {

  static openInWindow(props) {
    var i = new this(props).openInWorld();
    i.world().openInWindow(i).activate();
    return i;
  }

  onWindowClosed() {
    this.stopStepping();
  }

  static get properties() {
    return {
       extent: {defaultValue: pt(400,500)},
       fill: {defaultValue: Color.transparent},
       styleSheets: {
          initialize() {
          this.styleSheets = new StyleSheet({
            "[name=searchBar]": {
              fill: Color.transparent,
              draggable: false
            },
            "[name=searchBar] .LabeledCheckBox": {
              fill: Color.transparent
            },
            "[name=resizer]": {
              fill: Color.gray.lighter(),
              nativeCursor: 'ns-resize'
            },
            "[name=valueString]": {
              fontFamily: config.codeEditor.defaultStyle.fontFamily,
              fontSize: 15
            }, 
            ".toggle": {
              nativeCursor: 'pointer',
              fill: Color.black.withA(.5), 
              draggable: false,
              fontSize: 15,
              borderRadius: 5, 
              padding: rect(5,2,1,1)
            },
            '.toggle.inactive': {
              fontColor: Color.white,
            },
            '.toggle.active': {
              fontColor: Color.rgbHex('00e0ff')
            }
          });
          }
       }
    }
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
      if (this.focusedNode && this.focusedNode.keyString == change.prop) return;
      this.lastChange = change;
      this.prepareForNewTargetObject(this.targetObject);
   }
    //if (!this.targetObject.isWorld) this.startStepping(50, 'refreshProperties');
  }

  get isInspector() { return true; }

  get targetObject() { return this.state.targetObject; }
  set targetObject(obj) {
    this.state.targetObject = obj;
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
          grid: [["searchField", "internals", "unknowns"]],
          rows: [0, {paddingTop: 5, paddingBottom: 5}],
          columns: [0, {paddingLeft: 5, paddingRight: 5}, 1, {fixed: 75}, 2, {fixed: 80}]
        }),
        height: 30,
        submorphs: [
          searchField,
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
    connect(this.get('propertyTree'), 'onScroll', this, 'repositionOpenWidget');
    connect(this.get('resizer'), 'onDrag', this, 'adjustProportions');
    connect(this.get('terminal toggler'), 'onMouseDown', this, 'toggleCodeEditor');
    connect(this, "extent", this, "relayout");
    connect(this.get('unknowns'), 'trigger', this, 'filterProperties');
    connect(this.get('internals'), 'trigger', this, 'filterProperties');
    connect(searchField, 'searchInput', this, 'filterProperties');
  }

  closeOpenWidget() {
    this.openWidget.close();
    disconnect(this.getWindow(), 'bringToFront', this.openWidget, 'openInWorld');
  }

  onWidgetOpened({node, widget}) {
    debugger;
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
